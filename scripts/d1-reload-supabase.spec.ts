/**
 * The full D1 -> Supabase reload (scripts/d1-sync/reload-supabase.ts) against fakes only: D1 is a local
 * SQLite copy of the D1 schema filled through the step 5 D1 write handlers (the mirror off, as after
 * step 7) and read through a fake D1 HTTP API; Supabase is the repo schema on PGlite with its real
 * triggers and the step 5 mirror functions, behind a PostgREST stand-in run as service_role.
 * Usage: tsx scripts/d1-reload-supabase.spec.ts
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

import { WRITE_PAUSED_KEY, sourceFlagKey } from "../src/lib/write-source-flags";
import { MIRROR_TABLES } from "../workers/api/d1-write/tables";
import { SYNC_FLAG_KEY } from "./d1-sync/cutover";
import { d1HttpClient, type FetchLike } from "./d1-sync/d1-http-client";
import { PgliteRest, repoSupabase } from "./d1-sync/pglite-supabase";
import { postgrestReader } from "./d1-sync/postgrest-reader";
import { FakeD1 } from "./d1-sync/reconcile-fakes";
import { allRowsSql, RELOAD_ORDER, runReload, type ReloadOptions } from "./d1-sync/reload-supabase";
import { OTHER, setupHarness, USER } from "./d1-sync/write-harness";

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

const URL_ = "https://abcdefghijklmnopqrst.supabase.co";
const KEY = "sb_secret_reload";
const U = (n: number) => `${String(n).padStart(8, "0")}-0000-4000-8000-${String(n).padStart(12, "0")}`;

async function main() {
  const realFetch = globalThis.fetch;
  const pg = await repoSupabase({ contactWhen: true });
  await pg.query("insert into auth.users (id) values ($1), ($2)", [USER, OTHER]);
  const rest = new PgliteRest(pg);
  const h = await setupHarness(); // no service key: the mirror is off, D1 alone takes the writes
  const one = async (sql: string, params: unknown[] = []) => (await pg.query<Record<string, unknown>>(sql, params)).rows[0];
  const count = async (sql: string, params: unknown[] = []) => Number((await one(sql, params)).n);

  // ---- D1: one of every write kind, through the real router and D1 handlers.
  const created = async (path: string, body: unknown, as?: string) => {
    const res = await h.call(path, { method: "POST", body, as });
    assert.ok(res.status < 300, `${path}: ${res.status} ${res.text}`);
    return String((res.json as unknown as Array<Record<string, unknown>>)[0].id);
  };
  const combo = await created("/api/write/toybox-post?service=combo", {
    user_id: USER, nickname: "콤보왕", content: [{ type: "p", text: "본문" }], content_text: "콤보 본문입니다", resources: [{ type: "card", id: "bash" }, { type: "relic", id: "anchor" }], env: "development", palette_id: "red",
  });
  const key = `c-c-c-combo:${combo}`;
  const comment = await h.call("/api/write/comments", { method: "POST", body: { threadKey: key, nickname: "닉", content: "좋은 콤보" }, as: OTHER });
  const commentId = String((comment.json.comment as Record<string, unknown>).id);
  await h.call(`/api/write/likes?key=${encodeURIComponent(key)}`, { method: "PUT", as: OTHER });
  await h.call(`/api/write/comment-likes?id=${commentId}`, { method: "PUT" });
  await h.call("/api/write/reactions", { method: "PUT", body: { resourceType: "card", resourceId: "bash", gameVersion: "0.107.1", kind: "buff" } });
  const tot = await created("/api/write/toybox-post?service=this_or_that", {
    user_id: USER, nickname: "닉", left_type: "card", left_id: "a", right_type: "card", right_id: "b", reason: "어느 쪽?", env: "development",
  });
  await h.call(`/api/write/this-or-that/like?id=${tot}`, { method: "PUT", as: OTHER });
  await h.call(`/api/write/this-or-that/vote?id=${tot}`, { method: "PUT", body: { choice: "left", surface: "index" }, as: OTHER });
  const pool = ["a", "b", "c", "d"].map((id) => ({ type: "relic", id }));
  const ft = await created("/api/write/toybox-post?service=favorite_tournament", { user_id: USER, nickname: "닉", title: "월드컵", preset_key: "custom", game_version: "0.107", pool, env: "development" });
  const m = (l: string, r: string, winner: string) => ({ left_type: "relic", left_id: l, right_type: "relic", right_id: r, winner });
  await h.call("/api/write/favorite-tournament/play", { method: "POST", body: { tournamentId: ft, startingSize: 4, championType: "relic", championId: "a", matches: [m("a", "b", "left"), m("c", "d", "right"), m("a", "d", "left")] }, as: OTHER });
  await created("/api/write/pagestorm/drafts", { user_id: USER, nickname: "닉", title: "초안", content: { type: "doc" }, content_text: "초안 본문", env: "development" });
  await h.call("/api/write/defragment-body", { method: "PUT", body: { env: "development", source_service: "combo", source_id: combo, user_id: USER, nickname: "닉", content: [], content_text: "조각 본문" } });
  const run = { id: "r00000000000000d1", donor_user_id: USER, donor_nickname: "기증자", env: "development", seed: "SEED", build: "v", character: "CHARACTER.SILENT", ascension: 1, win: true, start_time: 1, run_time: 2, acts_count: 3, total_floors: 30, badges: [], cover_spec: { auto: true } };
  const raw = JSON.stringify({ seed: "SEED", text: "따옴표 \" 와 줄바꿈 \n 그리고 \\ 역슬래시" });
  const rowText = JSON.stringify(run);
  const shared = await h.call("/api/write/history-runs/share", { method: "POST", raw: `[${rowText},${raw}]`, headers: { "x-slseoun-row-length": String(rowText.length) } });
  assert.equal(shared.status, 201, shared.text);
  // A post and a run Supabase never saw (made after the mirror stopped), each with a comment and a like:
  // Supabase's triggers can only count them into a parent row that is already there.
  const chemical = await created("/api/write/toybox-post?service=chemical_x", { user_id: USER, nickname: "닉", content: [], content_text: "새 글입니다", env: "development" });
  for (const thread of [`chemical-x:${chemical}`, `history-course:${run.id}`]) {
    assert.equal((await h.call("/api/write/comments", { method: "POST", body: { threadKey: thread, nickname: "닉", content: "새 댓글" }, as: OTHER })).status, 201);
    assert.equal((await h.call(`/api/write/likes?key=${encodeURIComponent(thread)}`, { method: "PUT", as: OTHER })).status, 200);
  }
  const board = { game: "connections", board: "1", run: { guesses: [[0, 0, 0, 0], [1, 1, 1, 1], [2, 2, 2, 2], [3, 3, 3, 3]], rocks: 0, rocksLeft: 3, shown: { token: true, local: true, original: true } }, player: { nickname: "퍼즐러" } };
  assert.equal((await h.call("/api/write/puzzlebox/runs", { method: "POST", body: board })).status, 200);
  await h.call("/api/write/stories", { method: "POST", body: { sentence: "새 이야기입니다", nickname: "닉", patchLineId: "v0.1:1", source: "v0.1", linkedEntities: [] } });
  await h.call("/api/write/contact-inquiries", { method: "POST", body: { category: "bug", message: "버그가 있습니다. 확인 부탁.", replyEmail: null, pagePath: "/", serviceLocale: "ko", gameLocale: "kor", viewportWidth: 390, viewportHeight: 844 } });
  assert.ok(h.outbox().length > 10, "D1 kept every change in its outbox; nothing was mirrored");
  assert.equal(rest.calls.length, 0);
  globalThis.fetch = realFetch;

  // ---- Supabase: stale and extra rows of this env, and rows of the other env that must stay.
  await pg.query("insert into public.combo_posts (id, user_id, nickname, content, content_text, resources, env) values ($1, $2, '옛닉', '[]', '옛 본문입니다', '[{\"type\":\"card\",\"id\":\"bash\"},{\"type\":\"relic\",\"id\":\"anchor\"}]', 'development')", [combo, USER]);
  await pg.query("insert into public.combo_posts (id, user_id, nickname, content, content_text, resources, env) values ($1, $2, '닉', '[]', '지운 글입니다', '[{\"type\":\"card\",\"id\":\"bash\"},{\"type\":\"relic\",\"id\":\"anchor\"}]', 'development')", [U(900), USER]);
  await pg.query("insert into public.comments (id, story_id, user_id, nickname, content, env) values ($1, $2, $3, '닉', '지운 댓글', 'development')", [U(901), key, USER]);
  await pg.query("insert into public.comment_likes (comment_id, user_id) values ($1, $2)", [U(901), OTHER]);
  await pg.query("insert into public.likes (story_id, user_id, env) values ('sts2-codex:card:gone', $1, 'development')", [USER]);
  await pg.query("insert into public.comments (id, story_id, user_id, nickname, content, env) values ($1, 'sts2-codex:card:prod', $2, '닉', '운영 댓글', 'production')", [U(902), USER]);
  await pg.query("insert into public.likes (story_id, user_id, env) values ('sts2-codex:card:prod', $1, 'production')", [USER]);

  const fakeD1 = new FakeD1(h.db.sqlite, "acc", "db", "tok");
  const d1 = d1HttpClient({ accountId: "acc", databaseId: "db", token: "tok", fetch: fakeD1.fetch });
  const restFetch: FetchLike = async (url, init) => {
    const res = await rest.handle(new Request(url, { method: init.method, headers: init.headers, body: init.body }));
    const text = await res.text();
    return { ok: res.ok, status: res.status, text: async () => text };
  };
  const seen: Headers[] = [];
  let refuseWritesTo: string | null = null;
  const ports = (target: "testbed" | "production" = "testbed") => ({
    d1,
    supabase: postgrestReader({ url: URL_, serviceKey: KEY, fetch: restFetch }),
    config: { url: URL_, key: KEY, dataEnv: target === "testbed" ? "development" as const : "production" as const },
    fetcher: async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init);
      seen.push(request.headers);
      if (refuseWritesTo && request.method !== "GET" && new URL(request.url).pathname === `/rest/v1/${refuseWritesTo}`) {
        return new Response(JSON.stringify({ code: "23514" }), { status: 400 });
      }
      return rest.handle(request);
    },
    log: () => undefined,
  });
  const reload = (options: Partial<ReloadOptions> = {}) => runReload(ports(options.target), { target: "testbed", ...options });
  const writes = () => rest.calls.filter((entry) => entry.method !== "GET").length;

  await check("refused unless writes are paused, every source is d1 and the sync is off; a dry run writes nothing", async () => {
    assert.equal((await reload()).status, "refused", "write.paused is off");
    h.setFlag(WRITE_PAUSED_KEY, "on");
    h.setFlag(sourceFlagKey("comments"), "supabase");
    assert.equal((await reload()).status, "refused", "a source is supabase");
    h.setFlag(sourceFlagKey("comments"), "d1");
    h.setFlag(SYNC_FLAG_KEY, "on");
    assert.equal((await reload()).status, "refused", "the sync is on");
    h.setFlag(SYNC_FLAG_KEY, "off");
    const dry = await reload({ dryRun: true });
    assert.equal(dry.status, "dry_run", dry.lines.join("\n"));
    assert.equal(writes(), 0);
    assert.ok(fakeD1.writes.length === 0, "never writes D1");
    const combos = dry.tables.find((entry) => entry.table === "combo_posts")!;
    assert.deepEqual([combos.d1Rows, combos.extra], [1, 1]);
  });

  const snapshot = async () => {
    const out: Record<string, unknown> = {};
    for (const table of RELOAD_ORDER) {
      const spec = MIRROR_TABLES[table];
      const where = spec.hasEnv ? "where env = 'development'" : table === "comment_likes"
        ? "where comment_id in (select id from public.comments where env = 'development')" : "";
      out[table] = (await pg.query<Record<string, unknown>>(`select ${spec.key.map((name) => `${name}::text`).join(", ")} from public.${table} ${where}`)).rows
        .map((row) => JSON.stringify(spec.key.map((name) => String(row[name])))).sort();
    }
    return out;
  };
  const d1Keys = (table: string) => {
    const spec = MIRROR_TABLES[table];
    return h.db.rows(`SELECT * FROM (${allRowsSql(spec)})`).map((row) => JSON.stringify(spec.key.map((name) => String(row[name])))).sort();
  };

  await check("Supabase's rows of this env become D1's; Supabase triggers recount; the other env is untouched", async () => {
    const report = await reload();
    assert.equal(report.status, "done", report.lines.join("\n"));
    const after = await snapshot();
    for (const table of RELOAD_ORDER) {
      // Env-less tables (puzzlebox_players, profile_character_nickname_pools) reload from production only.
      if (MIRROR_TABLES[table].productionOnly) continue;
      assert.deepEqual([...(after[table] as string[])].sort(), d1Keys(table), `${table}: Supabase keys equal D1 keys`);
    }
    assert.deepEqual(await one("select nickname, content_text, like_count, comment_count from public.combo_posts where id = $1", [combo]),
      { nickname: "콤보왕", content_text: "콤보 본문입니다", like_count: 1, comment_count: 1 }, "stale row merged; counts from Supabase triggers");
    assert.deepEqual(h.db.one("SELECT like_count, comment_count FROM posts WHERE id = ?1", combo), { like_count: 1, comment_count: 1 });
    assert.equal(await count("select count(*)::int as n from public.comment_likes where comment_id = $1", [commentId]), 1);
    assert.deepEqual(await one("select like_count, left_vote_count from public.this_or_that_posts where id = $1", [tot]), { like_count: 1, left_vote_count: 1 });
    assert.deepEqual(await one("select play_count, game_version from public.favorite_tournament_posts where id = $1", [ft]), { play_count: 1, game_version: "d1-reload" },
      "a write-only NOT NULL column D1 does not keep gets the reload placeholder on a new row");
    assert.equal((await one("select created_surface from public.this_or_that_post_votes where post_id = $1", [tot])).created_surface, "detail");
    const sbStats = (await pg.query<Record<string, unknown>>("select resource_id, match_wins, current_rank from public.favorite_tournament_candidate_stats where tournament_id = $1 order by resource_id", [ft])).rows;
    assert.deepEqual(sbStats, h.db.rows("SELECT resource_id, match_wins, current_rank FROM favorite_tournament_candidate_stats WHERE tournament_id = ?1 ORDER BY resource_id", ft));
    assert.deepEqual(await one("select raw, win from public.runs where id = $1", [run.id]), { raw, win: true }, "the raw through the text RPC");
    assert.deepEqual(await one("select like_count, comment_count from public.chemical_posts where id = $1", [chemical]), { like_count: 1, comment_count: 1 },
      "a post new to Supabase counts the comment and like reloaded with it");
    assert.deepEqual(await one("select like_count, comment_count from public.runs where id = $1 and env = 'development'", [run.id]), { like_count: 1, comment_count: 1 },
      "so does a run new to Supabase");
    assert.equal((await one("select buff_count from public.resource_reaction_counts where resource_id = 'bash' and env = 'development'")).buff_count, 1);
    assert.equal(await count("select count(*)::int as n from public.comment_likes where comment_id = $1", [U(901)]), 0, "the extra comment's like went with it");
    assert.equal(await count("select count(*)::int as n from public.comments where env = 'production'"), 1);
    assert.equal(await count("select count(*)::int as n from public.likes where env = 'production'"), 1);
    assert.equal(await count("select count(*)::int as n from public.puzzlebox_players"), 0, "testbed never writes the env-less players");
    assert.equal(await count("select count(*)::int as n from public.profile_character_nickname_pools"), 10,
      "nor the env-less nickname pools (Supabase keeps its migration's ten rows)");
    assert.ok(seen.every((headers) => headers.get("apikey") === KEY && headers.get("authorization") === null));
  });

  await check("running it again changes nothing; a row Supabase has keeps its write-only value", async () => {
    await pg.query("update public.favorite_tournament_posts set game_version = '0.107' where id = $1", [ft]);
    const before = await snapshot();
    const counts = await one("select like_count, comment_count from public.combo_posts where id = $1", [combo]);
    const report = await reload();
    assert.equal(report.status, "done");
    assert.ok(report.tables.every((entry) => entry.deleted === 0));
    assert.deepEqual(await snapshot(), before);
    assert.deepEqual(await one("select like_count, comment_count from public.combo_posts where id = $1", [combo]), counts, "a merged row does not count twice");
    assert.deepEqual(await one("select play_count, game_version from public.favorite_tournament_posts where id = $1", [ft]), { play_count: 1, game_version: "0.107" });
  });

  await check("production reloads the env-less players; a refused row stops with the table named", async () => {
    const report = await reload({ target: "production", tables: ["puzzlebox_players"] });
    assert.equal(report.status, "done", report.lines.join("\n"));
    assert.equal(await count("select count(*)::int as n from public.puzzlebox_players"), 1);
    // The operator-written env-less nickname pools follow the same rule: production's D1 rows, exactly.
    h.db.run("INSERT INTO profile_character_nickname_pools (character_id, locale, nicknames, updated_at) VALUES ('IRONCLAD', 'ko', '[\"철갑\"]', '2026-11-09T00:00:00.000000Z')");
    const pools = await reload({ target: "production", tables: ["profile_character_nickname_pools"] });
    assert.equal(pools.status, "done", pools.lines.join("\n"));
    assert.deepEqual((await pg.query("select character_id, locale, nicknames from public.profile_character_nickname_pools")).rows,
      [{ character_id: "IRONCLAD", locale: "ko", nicknames: ["철갑"] }]);
    h.db.run("INSERT INTO likes (story_id, user_id, created_at) VALUES ('sts2-codex:card:new', ?1, '2026-11-09T00:00:00.000000Z')", USER);
    refuseWritesTo = "likes";
    const failed = await reload({ tables: ["likes"] });
    refuseWritesTo = null;
    assert.equal(failed.status, "failed");
    assert.ok(failed.lines.some((line) => line.startsWith("stopped: likes: Supabase refused a chunk")), failed.lines.join("\n"));
    rest.outage = 503;
    assert.equal((await reload({ tables: ["likes"] })).status, "failed", "Supabase down: stops at the first read");
    rest.outage = null;
    assert.equal((await reload({ tables: ["likes"] })).status, "done", "and a later run finishes");
    assert.equal(await count("select count(*)::int as n from public.likes where story_id = 'sts2-codex:card:new'"), 1);
  });

  await check("the CLI stops on its arguments before any call", () => {
    const cli = (args: string[]) => spawnSync(process.execPath, ["--import", "tsx", "scripts/d1-reload-supabase.ts", ...args], {
      encoding: "utf8",
      env: { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "" } as unknown as NodeJS.ProcessEnv,
    });
    const production = cli(["--env", "production"]);
    assert.equal(production.status, 2);
    assert.match(production.stderr, /--confirm-production/);
    assert.match(cli(["--env", "testbed"]).stderr, /missing environment: SUPABASE_URL/);
    assert.equal(cli(["--env", "testbed", "--tables", "nope"]).status, 2);
    assert.equal(cli(["--env", "testbed", "--remote"]).status, 2);
  });

  await pg.close();
  console.log(`d1-reload-supabase: ${checks} checks passed`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
