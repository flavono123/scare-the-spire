/**
 * Step 2 shadow reads (docs/supabase-exit/D1_SCHEMA_DESIGN.md 6, 9): every step-1 read route and the
 * parameter shapes the clients send, answered twice from one synthetic data set. The Supabase side is
 * the real step-1 handler against a PostgREST stand-in over PGlite (the repo's Supabase schema, RLS
 * and RPCs); the D1 side is the route's D1 adapter on a node:sqlite copy made by the first-copy path
 * (the shared mapper). The two must compare equal under the design-6 rules, key for key. Then the
 * comparison rules, the known-difference rules, the ledger, the sampling clamp and the router hook.
 *   pnpm exec tsx scripts/d1-shadow-reads.spec.ts
 * SUPABASE_PUBLIC_SCHEMA=<pg_dump --schema-only of public> builds the Supabase side from that dump.
 * No network: Supabase calls go to the stand-in and anything else throws.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { pathFlagKey, shadowFlagKey, type ApiSurfaceGroup } from "../src/lib/api-surfaces";
import { RUN_SUMMARY_COLUMNS } from "../src/lib/history-runs-api-rules";
import { D1_ADAPTERS } from "../workers/api/d1-adapters";
import { md5Hex } from "../workers/api/d1-adapters/md5";
import * as Q from "../workers/api/d1-adapters/queries";
import { answerText, materialize, RawJson } from "../workers/api/d1-adapters/rows";
import {
  DEAD_POST_COLUMNS,
  defragmentRunsSql,
  defragmentSql,
  feedSql,
  postSql,
  SUPABASE_BODY_COLUMNS,
  SUPABASE_DRAFT_COLUMNS,
  SUPABASE_POST_COLUMNS,
  voteRateBps,
  type FeedService,
  type FeedSort,
} from "../workers/api/d1-adapters/toybox";
import { clampShadowRate, parseShadowRates, resetFlagsForTest } from "../workers/api/flags";
import { createApiRouter, type ApiRoute, type PublicRouteContext, type UserRouteContext } from "../workers/api/router";
import { API_ROUTES } from "../workers/api/routes";
import { resetNavForTest } from "../workers/api/routes/nav";
import { canonical, compareAnswers, differsOnRecentRows, normalizeAnswer, type CompareRules } from "../workers/api/shadow/compare";
import {
  compareShadow,
  pendingRechecksForTest,
  readCappedJson,
  recordOutcome,
  resetShadowForTest,
  sampleText,
  setShadowRandomForTest,
  SHADOW_MAX_BYTES,
  shadowOnResponse,
  SYNC_LAG_MS,
} from "../workers/api/shadow/shadow";
import { atRowCap, SHADOW_SPECS, type ShadowContext, type SupabaseSide } from "../workers/api/shadow/specs";
import type { SupabaseApiConfig } from "../workers/api/supabase-rest";
import { SqliteD1 } from "./d1-shadow/d1-shim";
import { fakePostgrest, TEST_SUPABASE_URL, testToken } from "./d1-shadow/fake-postgrest";
import { DEV, firstCopy, IDS, loadFixture, ORPHAN_BODY, RUN1, RUN2, RUN3, timeAgo, U1, U2, U3, U4 } from "./d1-shadow/fixture";
import { openSupabase } from "./d1-shadow/supabase-pglite";

async function main() {
  let checks = 0;
  async function check(name: string, fn: () => Promise<void> | void) {
    try {
      await fn();
      checks += 1;
    } catch (error) {
      console.error(`FAIL ${name}`);
      throw error;
    }
  }

  class Ctx {
    pending: Promise<unknown>[] = [];
    waitUntil(promise: Promise<unknown>) {
      this.pending.push(promise);
    }
    async drain() {
      while (this.pending.length) await Promise.allSettled(this.pending.splice(0));
    }
  }

  const NOW = Date.now();
  const config: SupabaseApiConfig = { url: TEST_SUPABASE_URL, key: "sb_publishable_test", dataEnv: DEV };

  const { db: pg, source } = await openSupabase();
  await loadFixture(pg, NOW);
  const { sqlite, report } = await firstCopy(pg, DEV, NOW);
  const d1 = new SqliteD1(sqlite);
  const fake = fakePostgrest(pg);
  const realFetch = globalThis.fetch;
  globalThis.fetch = fake.fetch as typeof fetch;

  const ROUTES = new Map<string, ApiRoute>(API_ROUTES.map((route) => [route.id, route]));

  function contextFor(routeId: string, query: string, userId: string | null, ctx = new Ctx()) {
    const route = ROUTES.get(routeId);
    if (!route) throw new Error(`no route ${routeId}`);
    const url = new URL(`https://testbed.example${route.path}${query ? `?${query}` : ""}`);
    const base: PublicRouteContext = {
      request: new Request(url),
      url,
      env: { DB: d1, API_RUNTIME_FLAGS: "d1", API_SUPABASE_URL: TEST_SUPABASE_URL, API_SUPABASE_KEY: config.key, API_DATA_ENV: DEV },
      ctx,
      config,
      now: Date.now(),
      allowUpstream: true,
      prefetched: null,
      db: d1,
    };
    const context: PublicRouteContext | UserRouteContext = userId
      ? { ...base, user: { userId, isAnonymous: true, expiresAt: NOW + 3_600_000 }, token: testToken(userId), body: undefined, bodyStream: null }
      : base;
    return { route, context, ctx };
  }

  function shadowContextOf(routeId: string, context: PublicRouteContext | UserRouteContext): ShadowContext {
    return {
      routeId,
      url: context.url,
      config,
      db: d1,
      userId: "user" in context ? context.user.userId : null,
      now: context.now,
    };
  }

  /** The Supabase side as the shadow hook gets it: the spec's own read, or the route's answer. */
  async function supabaseSideOf(routeId: string, query: string, userId: string | null): Promise<{ side: SupabaseSide; shadow: ShadowContext; status: number }> {
    resetNavForTest();
    const { route, context, ctx } = contextFor(routeId, query, userId);
    const response = await (route.handle as (c: PublicRouteContext | UserRouteContext) => Promise<Response>)(context);
    const shadow = shadowContextOf(routeId, context);
    const spec = SHADOW_SPECS[routeId];
    const own = spec.supabase?.(shadow) ?? null;
    const side = own ? await own : await readCappedJson(response.clone());
    if (own) void response.body?.cancel().catch(() => undefined);
    await ctx.drain();
    return { side, shadow, status: response.status };
  }

  /** order: paths whose rows must carry the Supabase keys in order (and must have rows unless `empty`). */
  type Case = { route: string; query?: string; user?: string; expect?: "same" | "expected"; order?: string[]; empty?: boolean };

  function keysAt(value: unknown, path: string): string[][] {
    const segments = path === "" ? [] : path.split(".");
    let nodes: unknown[] = [value];
    for (const segment of segments) {
      nodes = nodes.flatMap((node) => {
        if (!node || typeof node !== "object") return [];
        if (segment === "*") return Object.values(node);
        return [(node as Record<string, unknown>)[segment]];
      });
    }
    return nodes.flatMap((node) => (Array.isArray(node) ? node : [])).filter((row) => row && typeof row === "object").map((row) => Object.keys(row));
  }

  const caseResults: string[] = [];
  let orderedRows = 0;

  async function runCase(item: Case): Promise<void> {
    const label = `${item.route}?${item.query ?? ""}${item.user ? ` as ${item.user.slice(0, 2)}` : ""}`;
    await check(label, async () => {
      const { side, shadow, status } = await supabaseSideOf(item.route, item.query ?? "", item.user ?? null);
      assert.equal(status, 200, `${label}: the step-1 route answers 200`);
      assert.ok(side.ok, `${label}: the Supabase side is readable (${side.ok ? "" : side.reason})`);
      const spec = SHADOW_SPECS[item.route];
      if (process.env.DEBUG_SHADOW) console.log(label, JSON.stringify(side.answer).slice(0, 600));
      const outcome = await compareShadow(spec, shadow, side);
      if (outcome.kind !== (item.expect ?? "same")) {
        console.error(JSON.stringify(outcome, null, 2).slice(0, 4000));
        assert.fail(`${label}: ${outcome.kind}, expected ${item.expect ?? "same"}`);
      }
      // Key for key: every row object carries the Supabase keys in the Supabase order.
      if (item.order) {
        const supabaseValue = spec.prepareSupabase ? spec.prepareSupabase(side.answer, shadow) : side.answer;
        const adapter = D1_ADAPTERS[item.route];
        let d1Value = materialize(spec.d1 ? await spec.d1({ db: d1, dataEnv: DEV, url: shadow.url, userId: shadow.userId, now: shadow.now }, side.answer)
          : await adapter({ db: d1, dataEnv: DEV, url: shadow.url, userId: shadow.userId, now: shadow.now }));
        if (spec.prepareD1) d1Value = spec.prepareD1(d1Value, supabaseValue, shadow);
        for (const path of item.order) {
          const left = keysAt(supabaseValue, path);
          const right = keysAt(d1Value, path);
          assert.equal(right.length, left.length, `${label}: row count at "${path}"`);
          assert.ok(item.empty || left.length > 0, `${label}: the case has rows at "${path}"`);
          orderedRows += left.length;
          for (let i = 0; i < left.length; i++) assert.deepEqual(right[i], left[i], `${label}: key order at "${path}"[${i}]`);
        }
      }
      caseResults.push(label);
    });
  }

  // ------------------------------------------------------------------------------------------- setup

  await check("first copy: every fixture row maps, the orphan body is not copied", () => {
    assert.deepEqual(report.rejects, []);
    const bodies = sqlite.prepare("SELECT count(*) AS n FROM defragment_bodies").get() as { n: number };
    assert.equal(Number(bodies.n), 1, "only the body whose post exists");
    const versions = sqlite.prepare("SELECT count(*) AS n FROM post_history_course WHERE summary_version = 0").get() as { n: number };
    assert.equal(Number(versions.n), 0, "every run has its summary");
    const production = sqlite.prepare("SELECT count(*) AS n FROM comments WHERE nickname = '운영'").get() as { n: number };
    assert.equal(Number(production.n), 0, "production rows stay out of the development copy");
  });

  await check("verbatim statements: every Q_ constant is its queries.sql statement", () => {
    const text = readFileSync("docs/supabase-exit/d1-schema/queries.sql", "utf8");
    const blocks = new Map<string, string>();
    for (const match of text.matchAll(/^-- @ (\S+) [^\n]*\n([\s\S]*?;)\s*$/gm)) blocks.set(match[1], match[2]);
    const norm = (sql: string) => sql.replace(/;\s*$/, "").replace(/\s+/g, " ").trim();
    const constants = Object.entries(Q).filter(([name]) => name.startsWith("Q_"));
    assert.ok(constants.length >= 50);
    for (const [name, sql] of constants) {
      const id = name.slice(2);
      assert.ok(blocks.has(id), `${id} is in queries.sql`);
      assert.equal(norm(sql as string), norm(blocks.get(id)!), `${id} is verbatim`);
    }
    // The builders reproduce the validated templates for the services and sorts queries.sql shows.
    const templates: Array<[string, string]> = [
      [feedSql("combo", "latest", false)!, "T1"],
      [feedSql("chemical_x", "latest", true)!, "T1c"],
      [feedSql("transfigure", "recommended", true)!, "T2"],
      [feedSql("decisions_decisions", "comments", false)!, "T3"],
      [feedSql("this_or_that", "vote_rate_high", true)!, "T4"],
      [feedSql("favorite_tournament", "play_count", false)!, "T5"],
      [defragmentSql("latest", true), "T6a"],
      [defragmentSql("recommended", true), "T6b"],
      [defragmentSql("comments", false), "T6c"],
      [defragmentRunsSql("comments", true), "T7"],
    ];
    for (const [built, id] of templates) assert.equal(norm(built), norm(blocks.get(id)!), `builder reproduces ${id}`);
    assert.equal(norm(postSql("transfigure")), norm(blocks.get("T8")!), "builder reproduces T8");
  });

  await check("feed variants: every service, sort and page reads through its index without a temp sort", () => {
    sqlite.exec("ANALYZE");
    const services = Object.keys(SUPABASE_POST_COLUMNS) as FeedService[];
    const sorts: FeedSort[] = ["latest", "recommended", "comments", "vote_rate_high", "vote_rate_low", "play_count"];
    const plan = (sql: string, params: unknown[]) =>
      (sqlite.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...(params as never[])) as Array<{ detail: string }>).map((row) => row.detail);
    const cursorParams = (sort: string) => (sort === "latest" ? ["2026-01-01T00:00:00.000000Z", "x"] : [1, "2026-01-01T00:00:00.000000Z", "x"]);
    for (const service of services) {
      for (const sort of sorts) {
        for (const cursor of [false, true]) {
          const sql = feedSql(service, sort, cursor);
          if (!sql) continue;
          const sentinel = sort === "vote_rate_high" || sort === "vote_rate_low";
          const details = plan(sql, sentinel || cursor ? cursorParams(sentinel ? "x" : sort) : []);
          const byDesign = sentinel || sort === "play_count"; // T4, T5: read the service, sort (design 4.3)
          if (!byDesign) {
            assert.ok(!details.some((line) => /TEMP B-TREE FOR ORDER BY/.test(line)), `${service} ${sort} ${cursor}: ${details.join(" | ")}`);
            assert.ok(details.some((line) => /USING (?:COVERING )?INDEX posts_service_/.test(line)), `${service} ${sort} ${cursor}: ${details.join(" | ")}`);
          }
          assert.ok(!details.some((line) => /^SCAN p$/.test(line)), `${service} ${sort}: no plain scan of posts`);
        }
      }
    }
    for (const sort of ["latest", "recommended", "comments"] as const) {
      for (const cursor of [false, true]) {
        for (const sql of [defragmentSql(sort, cursor), defragmentRunsSql(sort, cursor)]) {
          const details = plan(sql, cursor ? cursorParams(sort) : []);
          assert.ok(!details.some((line) => /TEMP B-TREE FOR ORDER BY/.test(line)), `${sort} ${cursor}: ${details.join(" | ")}`);
        }
      }
    }
  });

  await check("post column lists: Supabase table order, dead columns apart", async () => {
    const columnsOf = async (table: string) => (await pg.query<{ attname: string }>(
      "select attname from pg_attribute where attrelid = ('public.' || $1)::regclass and attnum > 0 and not attisdropped order by attnum", [table],
    )).rows.map((row) => row.attname);
    const tables: Record<FeedService, string> = {
      combo: "combo_posts", transfigure: "transfigure_posts", this_or_that: "this_or_that_posts", chemical_x: "chemical_posts",
      decisions_decisions: "decisions_decisions_posts", favorite_tournament: "favorite_tournament_posts", pagestorm: "pagestorm_posts",
    };
    for (const [service, table] of Object.entries(tables) as Array<[FeedService, string]>) {
      const live = await columnsOf(table);
      const dead = DEAD_POST_COLUMNS[service] ?? [];
      assert.deepEqual(live.filter((name) => !dead.includes(name)), [...SUPABASE_POST_COLUMNS[service]], table);
      for (const name of dead) assert.ok(live.includes(name), `${table}.${name} exists`);
    }
    assert.deepEqual(await columnsOf("pagestorm_drafts"), [...SUPABASE_DRAFT_COLUMNS]);
    assert.deepEqual(await columnsOf("defragment_bodies"), [...SUPABASE_BODY_COLUMNS]);
  });

  // ------------------------------------------------------------------------------------------- route cases

  const S1 = IDS.story(1);
  const P2 = IDS.philosopher(2);
  const cases: Case[] = [
    { route: "read.nav" },

    { route: "read.engagement", query: `threads=sts2-codex:card:bash,community:${S1},sts2-codex:relic:anchor,sts2-codex:card:none`, order: ["threads.*"] },
    { route: "read.engagement", query: `likes=sts2-codex:card:bash,community:${S1},history-course:${RUN1},sts2-codex:card:none` },
    { route: "read.engagement", query: "reactions=card:bash:0.107.1,card:bash:0.106.0,relic:anchor:0.107.1,card:strike:0.107.1" },
    { route: "read.engagement", query: "philosophers=card:bash", order: ["philosophers.*", "threads.*"] },
    { route: "read.engagement", query: "threads=sts2-codex:card:bash&likes=sts2-codex:card:bash&reactions=card:bash:0.107.1&philosophers=card:bash" },
    { route: "read.engagement", query: `threads=colorful-philosophers:${P2}&philosophers=card:bash,relic:anchor` },
    { route: "read.engagement", query: "philosophers=card:none&reactions=card:bash:0.107.1" },
    { route: "read.engagement-counts" },
    { route: "me.engagement", query: `threads=sts2-codex:card:bash,community:${S1}`, user: U1 },
    { route: "me.engagement", query: `likes=sts2-codex:card:bash,community:${S1}`, user: U1 },
    { route: "me.engagement", query: "reactions=card:bash:0.107.1,card:bash:0.106.0,relic:anchor:0.107.1", user: U1 },
    { route: "me.engagement", query: `threads=sts2-codex:card:bash&likes=community:${S1}&reactions=relic:anchor:0.107.1`, user: U2 },

    { route: "read.colorful-philosophers.week", order: ["posts"] },
    { route: "read.colorful-philosophers.post", query: `id=${P2}` },
    { route: "read.colorful-philosophers.post", query: `id=${IDS.philosopher(99)}` },
    { route: "read.colorful-philosophers.reel", order: ["posts"] },

    { route: "me.mailbox", user: U1 },
    { route: "me.mailbox", user: U2 },
    { route: "me.mailbox", user: U3 },

    { route: "read.profile.nicknames", order: ["rows"] },
    { route: "me.profile.stats", user: U1, order: ["rows"] },
    { route: "me.profile.stats", user: U2 },
    ...[
      "category=all&sort=latest&offset=0", "category=all&sort=likes&offset=0", "category=comments&sort=latest&offset=0",
      "category=stories&sort=likes&offset=0", "category=this_or_that&sort=likes&offset=0", "category=history_course&sort=latest&offset=0",
      "category=combo&sort=latest&offset=0", "category=chemical_x&sort=latest&offset=0", "category=all&sort=latest&offset=20",
    ].map((query): Case => ({ route: "me.profile.activity", query, user: U1, order: query.endsWith("offset=20") ? undefined : ["rows"] })),
    { route: "me.profile.activity", query: "category=all&sort=latest&offset=0", user: U2 },
    { route: "me.profile.inquiries", user: U1, order: ["rows"] },
    { route: "me.profile.inquiries", user: U2 },

    ...[
      "game=connections&boards=1:4,2:4&board=total&offset=0&around_me=0",
      "game=connections&boards=1:4,2:4&board=1&offset=0&around_me=0",
      "game=connections&boards=1:4,2:4&board=2&offset=0&around_me=0",
      "game=connections&boards=1:4,2:4&board=total&offset=10&around_me=0",
      "game=connections&boards=1:3&board=total&offset=0&around_me=0",
      "game=connections&boards=1:4&board=7&offset=0&around_me=0",
      "game=beta-quiz&boards=1:9&board=total&offset=0&around_me=0",
    ].map((query): Case => ({ route: "read.puzzlebox.leaderboard", query })),
    { route: "me.puzzlebox.leaderboard", query: "game=connections&boards=1:4,2:4&board=total&offset=0&around_me=1", user: U1 },
    { route: "me.puzzlebox.leaderboard", query: "game=connections&boards=1:4,2:4&board=1&offset=10&around_me=1", user: U3 },
    { route: "me.puzzlebox.leaderboard", query: "game=connections&boards=1:4&board=1&offset=0&around_me=1", user: U4 },
    { route: "me.puzzlebox.standings", query: "game=connections&boards=1:4,2:4", user: U1 },
    { route: "me.puzzlebox.standings", query: "game=connections&boards=1:4,2:4", user: U3 },
    { route: "me.puzzlebox.standings", query: "game=beta-quiz&boards=1:9", user: U1 },

    { route: "read.history-runs", query: "view=recent", order: [""] },
    { route: "read.history-runs", query: "view=reference", order: [""] },
    { route: "read.history-run", query: `id=${RUN1}&view=detail`, order: [""] },
    { route: "read.history-run", query: `id=${RUN2}&view=detail` },
    { route: "read.history-run", query: `id=${RUN1}&view=meta`, order: ["rows"] },
    { route: "read.history-run", query: `id=${RUN3}&view=cover`, order: [""] },
    { route: "read.history-run", query: "id=missing&view=meta" },
    { route: "read.history-runs.engagement", query: `ids=${RUN1},${RUN2},${RUN3}` },
    { route: "me.history-runs", user: U1 },
    { route: "me.history-runs", query: `id=${RUN1}`, user: U1 },
    { route: "me.history-runs", query: `id=${RUN2}`, user: U1 },
    { route: "me.history-runs", user: U2 },

    { route: "read.stories", query: "limit=100", order: [""] },
    { route: "read.stories", query: "limit=200&source=v0.103.0" },
    { route: "read.stories", query: "limit=1000" },
    { route: "read.stories", query: "limit=100&source=v0.107.1" },
    { route: "read.stories", query: "limit=100&source=v9.9.9" },

    { route: "read.favorite-tournament.presets", order: [""] },
    { route: "read.favorite-tournament.stats", query: `id=${IDS.tournament(3)}`, order: [""] },
    { route: "read.favorite-tournament.stats", query: `id=${IDS.tournament(1)}` },
    { route: "read.pagestorm.posts", order: [""] },
    { route: "me.pagestorm.drafts", user: U1, order: [""] },
    { route: "me.pagestorm.drafts", query: `id=${IDS.draft(1)}`, user: U1, order: [""] },
    { route: "me.pagestorm.drafts", query: `id=${IDS.draft(3)}`, user: U1 },
    { route: "me.pagestorm.drafts", user: U2 },
    { route: "read.defragment-body", query: `service=combo&id=${IDS.combo(1)}`, order: [""] },
    { route: "read.defragment-body", query: `service=chemical_x&id=${ORPHAN_BODY}`, expect: "expected" },
    { route: "read.defragment-body", query: `service=combo&id=${IDS.combo(2)}` },
    { route: "read.this-or-that.like-counts", query: `ids=${IDS.tot(1)},${IDS.tot(2)},${IDS.tot(3)}`, order: ["rows"] },
    { route: "read.this-or-that.like-counts", query: `ids=${IDS.tot(1).toUpperCase()}` },
    { route: "me.this-or-that.likes", query: `ids=${IDS.tot(1)},${IDS.tot(2)}`, user: U1 },
    { route: "me.this-or-that.likes", query: `ids=${IDS.tot(1)},${IDS.tot(2)}`, user: U2 },
    { route: "read.this-or-that.vote-summaries", query: `ids=${IDS.tot(1)},${IDS.tot(2)},${IDS.tot(3)}`, order: ["rows"] },
    { route: "me.this-or-that.votes", query: `ids=${IDS.tot(1)},${IDS.tot(2)},${IDS.tot(3)}`, user: U1 },
    { route: "me.this-or-that.votes", query: `ids=${IDS.tot(1)}`, user: U2 },
  ];

  const POST_IDS: Record<FeedService, string> = {
    combo: IDS.combo(1), transfigure: IDS.transfigure(1), this_or_that: IDS.tot(1), chemical_x: IDS.chem(1),
    decisions_decisions: IDS.decisions(1), favorite_tournament: IDS.tournament(3), pagestorm: IDS.pagestorm(1),
  };
  for (const service of Object.keys(SUPABASE_POST_COLUMNS) as FeedService[]) {
    cases.push({ route: "read.toybox-post", query: `service=${service}&id=${POST_IDS[service]}`, order: [""] });
    cases.push({ route: "read.toybox-post", query: `service=${service}&id=${IDS.combo(77)}` });
  }
  cases.push({ route: "read.toybox-post", query: `service=defragment&id=${IDS.combo(1)}` });
  cases.push({ route: "read.toybox-post", query: `service=transfigure&id=${IDS.transfigure(2).toUpperCase()}` });

  for (const item of cases) await runCase(item);

  // Feeds: each service and sort, first page, then the page after its first row (the client's cursor).
  type FeedRow = Record<string, unknown> & { post?: Record<string, unknown> };
  function cursorScore(row: FeedRow, sort: string): number {
    const post = row.post ?? {};
    if (sort === "comments") return Number(row.comment_count);
    if (sort === "recommended") return Number(row.like_count);
    if (sort === "vote_rate_high") return Number(post.left_vote_count) + Number(post.right_vote_count);
    if (sort === "vote_rate_low") return 1_000_000_000 - (Number(post.left_vote_count) + Number(post.right_vote_count));
    if (sort === "play_count") return Number(post.play_count);
    return Number(row.recommend_score);
  }

  async function firstPage(routeId: string, query: string): Promise<FeedRow[]> {
    const { side } = await supabaseSideOf(routeId, query, null);
    assert.ok(side.ok);
    return side.answer as FeedRow[];
  }

  for (const service of Object.keys(SUPABASE_POST_COLUMNS) as FeedService[]) {
    for (const sort of ["latest", "recommended", "comments", "vote_rate_high", "vote_rate_low", "play_count"]) {
      const query = `service=${service}&sort=${sort}`;
      const applies = feedSql(service, sort as FeedSort, false) !== null;
      await runCase({ route: "read.toybox-feed", query, order: [""], empty: !applies });
      const rows = await firstPage("read.toybox-feed", query);
      if (rows.length === 0) continue;
      const head = rows[0];
      const cursor = new URLSearchParams({ score: String(cursorScore(head, sort)), created_at: String(head.post?.created_at), cursor_id: String(head.id) });
      await runCase({ route: "read.toybox-feed", query: `${query}&${cursor}` });
    }
  }
  for (const routeId of ["read.defragment-feed", "read.defragment-runs"]) {
    for (const sort of ["latest", "recommended", "comments", ...(routeId === "read.defragment-feed" ? ["vote_rate_high"] : [])]) {
      await runCase({ route: routeId, query: `sort=${sort}`, order: [""] });
      const rows = await firstPage(routeId, `sort=${sort}`);
      assert.ok(rows.length > 1, `${routeId} ${sort} has rows`);
      const head = rows[0];
      const score = sort === "comments" ? head.comment_count : head.like_count;
      const cursor = new URLSearchParams({ score: String(score), created_at: String(head.created_at), cursor_id: String(head.id) });
      await runCase({ route: routeId, query: `sort=${sort}&${cursor}` });
    }
  }

  await check("every step-1 read route has a D1 adapter, shadow rules and at least one case", () => {
    const reads = API_ROUTES.filter((route) => route.method === "GET").map((route) => route.id).sort();
    assert.deepEqual(Object.keys(D1_ADAPTERS).sort(), reads);
    assert.deepEqual(Object.keys(SHADOW_SPECS).sort(), reads);
    for (const id of reads) assert.ok(caseResults.some((label) => label.startsWith(`${id}?`)), `case for ${id}`);
  });

  await check("run list and picker rows: step-1 summary columns without raw, then the summary columns", async () => {
    const listColumns = RUN_SUMMARY_COLUMNS.split(",").filter((name) => name !== "raw");
    const summary = ["characters", "badges", "game_mode", "game_elements", "list_facts", "summary_version"];
    for (const view of ["recent", "reference"]) {
      const rows = await D1_ADAPTERS["read.history-runs"]({ db: d1, dataEnv: DEV, url: new URL(`https://x/?view=${view}`), userId: null, now: NOW }) as Record<string, unknown>[];
      assert.ok(rows.length === 3);
      const keys = Object.keys(rows[0]);
      assert.deepEqual(keys.slice(0, listColumns.length), listColumns);
      assert.deepEqual(keys.slice(listColumns.length, listColumns.length + summary.length), summary);
      assert.deepEqual(keys.slice(listColumns.length + summary.length), view === "recent" ? ["like_count", "comment_count"] : []);
      assert.ok(rows[0].game_elements instanceof RawJson, "large JSON stays unparsed");
      assert.ok(!keys.includes("raw"));
    }
  });

  await check("answerText splices RawJson unparsed and matches JSON.stringify of the parsed value", async () => {
    const answer = await D1_ADAPTERS["read.history-runs"]({ db: d1, dataEnv: DEV, url: new URL("https://x/?view=recent"), userId: null, now: NOW });
    const text = answerText(answer);
    assert.deepEqual(JSON.parse(text), materialize(answer));
    assert.equal(answerText({ a: new RawJson('{"x": 1.50}'), b: [new RawJson("[1, 2]"), null], c: undefined }), '{"a":{"x": 1.50},"b":[[1, 2],null]}');
  });

  await check("vote rate: the generated column's integer division", () => {
    assert.equal(voteRateBps(0, 0), 0);
    assert.equal(voteRateBps(1, 1), 5000);
    assert.equal(voteRateBps(2, 0), 10000);
    assert.equal(voteRateBps(2, 1), 6666);
    assert.equal(voteRateBps(1, 2), 6666);
  });

  await check("md5 tag: same digest as node:crypto", () => {
    for (const text of ["", "a", U1, U4, "x".repeat(55), "x".repeat(56), "x".repeat(64), "가나다".repeat(30)]) {
      assert.equal(md5Hex(text), createHash("md5").update(text).digest("hex"), text.slice(0, 10));
    }
  });

  // ------------------------------------------------------------------------------------------- comparison rules

  await check("rule 2: JSON compares parsed, keys in any order", () => {
    const result = compareAnswers({ a: JSON.parse('{"x": 1.50, "y": [1]}') }, { a: { y: [1], x: 1.5 } }, {});
    assert.equal(result.equal, true);
    assert.equal(canonical({ b: 1, a: { d: null, c: [true] } }), '{"a":{"c":[true],"d":null},"b":1}');
  });

  await check("rule 1: tie runs compare as sets, the run at the LIMIT boundary by size, order across runs matters", () => {
    const rows = (pairs: Array<[string, string]>) => pairs.map(([at, id]) => ({ created_at: at, id }));
    const rules: CompareRules = { lists: [{ path: "", keys: ["created_at"], limit: 4 }] };
    assert.equal(compareAnswers(rows([["2", "a"], ["2", "b"], ["1", "c"]]), rows([["2", "b"], ["2", "a"], ["1", "c"]]), rules).equal, true);
    assert.equal(compareAnswers(rows([["2", "a"], ["1", "c"], ["2", "b"]]), rows([["2", "a"], ["2", "b"], ["1", "c"]]), rules).equal, false);
    // Full list (4 = LIMIT): the last run [1, x] has two members; which ones made the page may differ.
    assert.equal(compareAnswers(rows([["3", "a"], ["2", "b"], ["1", "x"], ["1", "y"]]), rows([["3", "a"], ["2", "b"], ["1", "z"], ["1", "y"]]), rules).equal, true);
    assert.equal(compareAnswers(rows([["3", "a"], ["2", "b"], ["1", "x"]]), rows([["3", "a"], ["2", "b"], ["1", "z"]]), rules).equal, false, "not full: compared by members");
    assert.equal(compareAnswers({ rows: [1, 2, 3] }, { rows: [3, 1, 2] }, { lists: [{ path: "rows", set: true }] }).equal, true);
    assert.equal(compareAnswers({ rows: [1, 2, 2] }, { rows: [1, 1, 2] }, { lists: [{ path: "rows", set: true }] }).equal, false, "multiset");
    assert.equal(compareAnswers({ t: { k: [{ c: 1, id: "a" }, { c: 1, id: "b" }] } }, { t: { k: [{ c: 1, id: "b" }, { c: 1, id: "a" }] } }, { lists: [{ path: "t.*", keys: ["c"] }] }).equal, true);
    assert.equal(compareAnswers([1, 2], [2, 1], {}).equal, false, "no rule: strict order");
  });

  await check("difference entries name the path and the rows on one side only", () => {
    const result = compareAnswers({ rows: [{ id: "a" }, { id: "b" }], n: 1 }, { rows: [{ id: "a" }, { id: "c" }], n: 2 }, { lists: [{ path: "rows", set: true }] });
    assert.equal(result.equal, false);
    assert.deepEqual(result.entries, [
      { path: "n", supabase: 1, d1: 2 },
      { path: "rows", onlySupabase: [{ id: "b" }], onlyD1: [{ id: "c" }] },
    ]);
    const ignored = normalizeAnswer({ fetchedAt: "x", v: 1 }, { ignore: ["fetchedAt"] });
    assert.deepEqual(ignored, { v: 1 });
  });

  await check("rule 7: differences on rows from the last 2 minutes are deferred, older ones counted", () => {
    const now = Date.now();
    const recent = new Date(now - 30_000).toISOString();
    const old = new Date(now - 10 * 60_000).toISOString();
    assert.equal(differsOnRecentRows([{ path: "", onlyD1: [{ created_at: recent }] }], now, SYNC_LAG_MS), true);
    assert.equal(differsOnRecentRows([{ path: "", onlySupabase: [{ created_at: old }] }], now, SYNC_LAG_MS), false);
    assert.equal(differsOnRecentRows([{ path: "likes.k", supabase: 3, d1: 2 }], now, SYNC_LAG_MS), false, "a count has no time: counted");
  });

  await check("rule 6: answers at PostgREST's row cap or over the byte cap are skipped", async () => {
    assert.equal(atRowCap(Array.from({ length: 1000 }, () => ({}))), true);
    assert.equal(atRowCap({ rows: Array.from({ length: 999 }, () => ({})) }), false);
    const spec = SHADOW_SPECS["read.stories"];
    const shadow = { routeId: "read.stories", url: new URL("https://x/api/read/stories?limit=1000"), config, db: d1, userId: null, now: NOW };
    const capped = await compareShadow(spec, shadow, { ok: true, answer: Array.from({ length: 1000 }, (_, i) => ({ id: i })) });
    assert.deepEqual(capped, { kind: "skipped", reason: "row_cap" });
    const big = await readCappedJson(new Response(JSON.stringify("x".repeat(SHADOW_MAX_BYTES + 10))));
    assert.deepEqual(big, { ok: false, reason: "too_large" });
    const failed = await readCappedJson(new Response("{}", { status: 503 }));
    assert.deepEqual(failed, { ok: false, reason: "supabase_unavailable" });
    const unavailable = await compareShadow(SHADOW_SPECS["read.engagement"], { ...shadow, routeId: "read.engagement", url: new URL("https://x/?threads=a") }, { ok: true, answer: { v: 1, env: DEV, unavailable: ["threads"] } });
    assert.deepEqual(unavailable, { kind: "skipped", reason: "unavailable" });
  });

  await check("nav: a snapshot older than 90 s is not compared", async () => {
    const spec = SHADOW_SPECS["read.nav"];
    const shadow = { routeId: "read.nav", url: new URL("https://x/api/read/nav"), config, db: d1, userId: null, now: NOW };
    const outcome = await compareShadow(spec, shadow, { ok: true, answer: { v: 1, env: DEV, fetchedAt: new Date(NOW - 120_000).toISOString() } });
    assert.deepEqual(outcome, { kind: "skipped", reason: "stale_snapshot" });
  });

  await check("rules 3 and 9: dead columns are not compared; a Supabase-only row (crafted, rejected by the sync) is a difference", async () => {
    // Rule 3: the transfigure post's source_game_locale exists only in Supabase and is not compared.
    const { side, shadow } = await supabaseSideOf("read.toybox-post", `service=transfigure&id=${IDS.transfigure(1)}`, null);
    assert.ok(side.ok && Array.isArray(side.answer) && "source_game_locale" in (side.answer[0] as object));
    assert.equal((await compareShadow(SHADOW_SPECS["read.toybox-post"], shadow, side)).kind, "same");
    // Rule 9: a row only Supabase holds is counted, even an old one (no lag recheck).
    await pg.exec(`set session_replication_role = replica;
      insert into public.comments (id, story_id, user_id, nickname, content, env, created_at)
      values ('${IDS.comment(50)}', 'sts2-codex:card:crafted', '${U1}', '철갑', 'crafted', 'development', '${timeAgo(NOW, 3000)}');
      set session_replication_role = origin;`);
    const crafted = await supabaseSideOf("read.engagement", "threads=sts2-codex:card:crafted", null);
    const outcome = await compareShadow(SHADOW_SPECS["read.engagement"], crafted.shadow, crafted.side);
    assert.equal(outcome.kind, "differed");
    // A recent Supabase-only row is deferred instead (rule 7), then counted on the recheck.
    await pg.exec(`set session_replication_role = replica;
      insert into public.comments (id, story_id, user_id, nickname, content, env, created_at)
      values ('${IDS.comment(51)}', 'sts2-codex:card:fresh', '${U1}', '철갑', 'fresh', 'development', '${timeAgo(Date.now(), 0.5)}');
      set session_replication_role = origin;`);
    const fresh = await supabaseSideOf("read.engagement", "threads=sts2-codex:card:fresh", null);
    assert.equal((await compareShadow(SHADOW_SPECS["read.engagement"], fresh.shadow, fresh.side)).kind, "deferred");
    assert.equal((await compareShadow(SHADOW_SPECS["read.engagement"], fresh.shadow, fresh.side, { recheck: true })).kind, "differed");
    // Both answers agree again for the router checks below.
    await pg.exec(`delete from public.comments where id in ('${IDS.comment(50)}', '${IDS.comment(51)}')`);
  });

  // ------------------------------------------------------------------------------------------- ledger

  function stats(day: string) {
    return sqlite.prepare("SELECT route_id, compared, differed, skipped FROM shadow_stats WHERE day = ?1 ORDER BY route_id").all(day)
      .map((row) => ({ ...(row as object) }));
  }

  await check("ledger: S5 counts every outcome, S6 keeps one sample per distinct difference, 8 KB at most", async () => {
    sqlite.exec("DELETE FROM shadow_stats; DELETE FROM shadow_diffs;");
    const context = { routeId: "read.stories", url: new URL(`https://x/api/read/stories?limit=100&${"q=".padEnd(3000, "x")}`), now: NOW };
    const entries = Array.from({ length: 20 }, (_, i) => ({ path: `[${i}]`, onlySupabase: [{ sentence: "가".repeat(3000), i }], onlyD1: [] }));
    await recordOutcome(d1, context, { kind: "same" });
    await recordOutcome(d1, context, { kind: "skipped", reason: "too_large" });
    await recordOutcome(d1, context, { kind: "differed", entries });
    await recordOutcome(d1, context, { kind: "differed", entries });
    await recordOutcome(d1, context, { kind: "differed", entries: [{ path: "x", supabase: 1, d1: 2 }] });
    await recordOutcome(d1, context, { kind: "deferred", entries });
    const day = new Date(NOW).toISOString().slice(0, 10);
    assert.deepEqual(stats(day), [{ route_id: "read.stories", compared: 4, differed: 3, skipped: 1 }]);
    const diffs = sqlite.prepare("SELECT hits, sample FROM shadow_diffs ORDER BY hits DESC").all() as Array<{ hits: number; sample: string }>;
    assert.equal(diffs.length, 2);
    assert.equal(Number(diffs[0].hits), 2, "the same difference collapses");
    for (const row of diffs) assert.ok(new TextEncoder().encode(row.sample).byteLength <= 8192);
    const sample = JSON.parse(sampleText(context, entries));
    assert.equal(sample.route, "read.stories");
    assert.ok(sample.shown >= 1 && sample.total === 20);
  });

  // ------------------------------------------------------------------------------------------- sampling and the router hook

  await check("sampling clamp: shadow.<group> values become rates in 0..1, missing or bad is 0", () => {
    assert.equal(clampShadowRate(undefined), 0);
    assert.equal(clampShadowRate(""), 0);
    assert.equal(clampShadowRate("abc"), 0);
    assert.equal(clampShadowRate("-0.5"), 0);
    assert.equal(clampShadowRate("0"), 0);
    assert.equal(clampShadowRate("0.1"), 0.1);
    assert.equal(clampShadowRate(" 0.25 "), 0.25);
    assert.equal(clampShadowRate("1"), 1);
    assert.equal(clampShadowRate("7"), 1);
    assert.equal(clampShadowRate("Infinity"), 0);
    assert.equal(clampShadowRate(0.5), 0.5);
    const routed = new Set<ApiSurfaceGroup>(["comments", "stories"]);
    const rates = parseShadowRates([
      { key: shadowFlagKey("comments"), value: "0.5" },
      { key: shadowFlagKey("stories"), value: "nope" },
      { key: shadowFlagKey("nav"), value: "1" },
      { key: pathFlagKey("comments"), value: "api" },
    ], routed);
    assert.deepEqual([...rates], [["comments", 0.5]], "unrouted groups and bad values are left out");
  });

  function setFlags(values: Record<string, string>) {
    sqlite.exec("DELETE FROM runtime_flags");
    for (const [key, value] of Object.entries(values)) {
      sqlite.prepare("INSERT INTO runtime_flags (key, value, updated_at, note) VALUES (?1, ?2, ?3, 'spec')").run(key, value, new Date().toISOString());
    }
    resetFlagsForTest();
  }

  const router = createApiRouter(API_ROUTES, { onResponse: shadowOnResponse });
  const routerEnv = { DB: d1, API_RUNTIME_FLAGS: "d1", API_SUPABASE_URL: TEST_SUPABASE_URL, API_SUPABASE_KEY: config.key, API_DATA_ENV: DEV };

  async function viaRouter(path: string, method = "GET") {
    const ctx = new Ctx();
    const response = await router.handle(new Request(`https://testbed.example${path}`, { method }), routerEnv, ctx);
    const body = method === "HEAD" ? "" : await response.text();
    await ctx.drain();
    return { response, body };
  }

  await check("router hook: no shadow rate, no comparison; the client's answer is unchanged", async () => {
    resetShadowForTest();
    sqlite.exec("DELETE FROM shadow_stats; DELETE FROM shadow_diffs;");
    setFlags({ [pathFlagKey("comments")]: "api" });
    const before = d1.statements.length;
    const { response, body } = await viaRouter("/api/read/engagement-counts");
    assert.equal(response.status, 200);
    assert.ok(JSON.parse(body).likes);
    assert.equal(stats(new Date().toISOString().slice(0, 10)).length, 0);
    assert.ok(!d1.statements.slice(before).some((sql) => sql.includes("FROM threads")), "no D1 adapter read");
  });

  await check("router hook: a sampled read is compared in waitUntil and counted; HEAD and unsampled reads are not", async () => {
    resetShadowForTest();
    sqlite.exec("DELETE FROM shadow_stats; DELETE FROM shadow_diffs;");
    setFlags({ [pathFlagKey("comments")]: "api", [shadowFlagKey("comments")]: "0.5", [pathFlagKey("stories")]: "api", [shadowFlagKey("stories")]: "1" });
    const day = new Date().toISOString().slice(0, 10);
    setShadowRandomForTest(() => 0.7);
    await viaRouter("/api/read/engagement-counts");
    assert.deepEqual(stats(day), [], "0.7 >= 0.5: not sampled");
    setShadowRandomForTest(() => 0.3);
    const { body } = await viaRouter("/api/read/engagement-counts");
    const direct = await supabaseSideOf("read.engagement-counts", "", null);
    assert.ok(direct.side.ok);
    assert.deepEqual(JSON.parse(body), direct.side.answer, "the client still gets the Supabase answer");
    await viaRouter("/api/read/engagement-counts", "HEAD");
    await viaRouter(`/api/read/stories?limit=100`);
    assert.deepEqual(stats(day), [
      { route_id: "read.engagement-counts", compared: 1, differed: 0, skipped: 0 },
      { route_id: "read.stories", compared: 1, differed: 0, skipped: 0 },
    ]);
  });

  await check("router hook: a recent difference waits 2 minutes, then a later request rechecks and counts it", async () => {
    resetShadowForTest();
    sqlite.exec("DELETE FROM shadow_stats; DELETE FROM shadow_diffs;");
    setFlags({ [pathFlagKey("comments")]: "api", [shadowFlagKey("comments")]: "1", [pathFlagKey("stories")]: "api" });
    setShadowRandomForTest(() => 0);
    const day = new Date().toISOString().slice(0, 10);
    // A comment written 30 s ago through the legacy path: in Supabase, not yet synced to D1.
    await pg.exec(`set session_replication_role = replica;
      insert into public.comments (id, story_id, user_id, nickname, content, env, created_at)
      values ('${IDS.comment(51)}', 'sts2-codex:card:fresh', '${U1}', '철갑', 'fresh', 'development', '${timeAgo(Date.now(), 0.5)}');
      set session_replication_role = origin;`);
    await viaRouter("/api/read/engagement?threads=sts2-codex:card:fresh");
    assert.equal(pendingRechecksForTest().length, 1);
    assert.deepEqual(stats(day), [], "deferred: not counted yet");
    const realNow = Date.now;
    try {
      Date.now = () => realNow() + SYNC_LAG_MS + 1000;
      // The sync caught up meanwhile: the row is in D1 now.
      sqlite.prepare("INSERT INTO comments (id, story_id, user_id, nickname, content, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)")
        .run(IDS.comment(51), "sts2-codex:card:fresh", U1, "철갑", "fresh", String((await pg.query<{ at: string }>(
          `select to_char(created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as at from public.comments where id = '${IDS.comment(51)}'`)).rows[0].at));
      // A later read of a group without a shadow rate: not sampled itself, but it runs the due recheck.
      await viaRouter("/api/read/stories?limit=100");
    } finally {
      Date.now = realNow;
    }
    assert.equal(pendingRechecksForTest().length, 0);
    assert.deepEqual(stats(day), [{ route_id: "read.engagement", compared: 1, differed: 0, skipped: 0 }]);
  });

  await check("router hook: the QA path override reads no flags and samples nothing", async () => {
    resetShadowForTest();
    sqlite.exec("DELETE FROM shadow_stats;");
    setFlags({ [pathFlagKey("comments")]: "api", [shadowFlagKey("comments")]: "1" });
    setShadowRandomForTest(() => 0);
    const ctx = new Ctx();
    const request = new Request("https://testbed.example/api/read/engagement-counts", { headers: { cookie: "slseoun_qa_path=comments" } });
    const response = await router.handle(request, routerEnv, ctx);
    await response.text();
    await ctx.drain();
    assert.deepEqual(stats(new Date().toISOString().slice(0, 10)), []);
  });

  globalThis.fetch = realFetch;
  resetShadowForTest();
  await pg.close();
  console.log(`d1-shadow-reads spec passed (${checks} checks, ${caseResults.length} route cases, ${orderedRows} rows key-order checked, Supabase from ${source}, ${fake.requests.length} PostgREST calls)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
