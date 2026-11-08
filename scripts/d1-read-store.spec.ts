/**
 * Step 3 reads from D1 (docs/SUPABASE_EXIT_PLAN.md 7.3 step 3): the read.<group> flag and its CLI
 * rules, the router's choice between a GET route's Supabase handler and its D1 adapter (headers,
 * cache, rate limit, HEAD, no shadow, the fallback and D1 as the origin), and the history-course
 * list, picker, detail and covers the client builds from the D1 answers (summary columns, R3r raw)
 * against the ones it builds from the Supabase answers (raw files), including a run without a
 * summary. Same synthetic data as the shadow spec: a PGlite PostgREST stand-in for Supabase and a
 * first-copy node:sqlite D1. No network.
 *   pnpm exec tsx scripts/d1-read-store.spec.ts
 */
import assert from "node:assert/strict";
import { isDeepStrictEqual } from "node:util";

import { API_SURFACE_GROUPS, pathFlagKey, readFlagKey, shadowFlagKey } from "../src/lib/api-surfaces";
import { HISTORY_RUN_RAW_PATH } from "../src/lib/history-runs-api-rules";
import { pickAlternatingCover } from "../src/lib/run-cover-suggest";
import { coverFromSummaryCoverRow, donatedRunsFromListRows, type RunSummaryCoverRow } from "../src/lib/run-list-summary";
import {
  normalizeRunRow,
  parseCoverSpec,
  parseRunSafely,
  type DonatedRunSummary,
  type RunRow,
} from "../src/lib/run-summary-row";
import { sourceFlagKey } from "../src/lib/write-source-flags";
import { D1_ADAPTERS } from "../workers/api/d1-adapters";
import { answerText } from "../workers/api/d1-adapters/rows";
import type { D1Database, D1PreparedStatement, D1Result } from "../workers/api/d1";
import { d1ReadAnswer, D1_READ_FALLBACK_MS, resetD1ReadForTest } from "../workers/api/d1-read";
import { flagValues, readStoreFor, resetFlagsForTest } from "../workers/api/flags";
import { resetJwtCachesForTest } from "../workers/api/jwt";
import { createApiRouter, type ApiEnv } from "../workers/api/router";
import { API_ROUTES } from "../workers/api/routes";
import { resetNavForTest } from "../workers/api/routes/nav";
import { compareAnswers } from "../workers/api/shadow/compare";
import { resetShadowForTest, setShadowRandomForTest, shadowOnResponse } from "../workers/api/shadow/shadow";
import { SHADOW_SPECS, type ShadowContext } from "../workers/api/shadow/specs";
import { materialize } from "../workers/api/d1-adapters/rows";
import { checkFlagSet, KNOWN_KEYS } from "./runtime-flag-keys";
import { SqliteD1 } from "./d1-shadow/d1-shim";
import { compareDonatedRuns } from "./d1-sync/run-summary-compare";
import { Ctx } from "./d1-shadow/harness";
import { fakePostgrest, TEST_SUPABASE_URL } from "./d1-shadow/fake-postgrest";
import { DEV, firstCopy, IDS, loadFixture, RUN1, RUN2, RUN3, U1 } from "./d1-shadow/fixture";
import { openSupabase } from "./d1-shadow/supabase-pglite";

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

/** The D1 stand-in, with a switch that makes every data read fail or hang (flags still read). */
class FlakyD1 implements D1Database {
  mode: "ok" | "fail" | "hang" = "ok";
  constructor(readonly inner: SqliteD1) {}

  private isData(sql: string): boolean {
    return !/runtime_flags|api_cache|shadow_|sync_/.test(sql);
  }

  private gate<T>(sql: string, run: () => Promise<T>): Promise<T> {
    if (this.mode === "ok" || !this.isData(sql)) return run();
    if (this.mode === "fail") return Promise.reject(new Error("D1_ERROR: spec"));
    return new Promise<T>(() => undefined);
  }

  prepare(sql: string): D1PreparedStatement {
    const inner = this.inner.prepare(sql);
    const statement: D1PreparedStatement & { sql: string } = {
      sql,
      bind: (...values: unknown[]) => {
        inner.bind(...values);
        return statement;
      },
      all: <T>() => this.gate(sql, () => inner.all<T>()),
      first: <T>() => this.gate(sql, () => inner.first<T>()),
      run: () => this.gate(sql, () => inner.run()),
    };
    return statement;
  }

  batch<T>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
    const sqls = statements.map((statement) => (statement as unknown as { sql: string }).sql);
    if (this.mode !== "ok" && sqls.some((sql) => this.isData(sql))) return this.gate(sqls.find((sql) => this.isData(sql))!, () => Promise.resolve([]));
    return this.inner.batch(statements);
  }
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function makeSigner(issuer: string) {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const publicJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  const jwks = { keys: [{ kty: "EC", crv: "P-256", alg: "ES256", use: "sig", kid: "read-store-kid", x: publicJwk.x, y: publicJwk.y }] };
  const segment = (value: unknown) => base64Url(new TextEncoder().encode(JSON.stringify(value)));
  async function token(sub: string) {
    const now = Math.floor(Date.now() / 1000);
    const input = `${segment({ alg: "ES256", kid: "read-store-kid", typ: "JWT" })}.${segment({
      iss: issuer, sub, aud: "authenticated", role: "authenticated", exp: now + 3600, iat: now, is_anonymous: true,
    })}`;
    const signature = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, pair.privateKey, new TextEncoder().encode(input)));
    return `${input}.${base64Url(signature)}`;
  }
  return { jwks, token };
}

const ANSWER_HEADERS = ["content-type", "cache-control", "x-robots-tag", "x-slseoun-api", "x-slseoun-api-env", "retry-after"];

function headersOf(response: Response): Record<string, string | null> {
  return Object.fromEntries(ANSWER_HEADERS.map((name) => [name, response.headers.get(name)]));
}

function listsMatch(today: DonatedRunSummary[], d1: DonatedRunSummary[], label: string, sortKey: "created_at" | "start_time"): void {
  assert.equal(d1.length, today.length, `${label}: run count`);
  // Same order up to ties of the sort key (design 6 rule 1: Postgres has no tie-breaker; D1 adds the id).
  assert.deepEqual(d1.map((run) => run[sortKey]), today.map((run) => run[sortKey]), `${label}: order`);
  assert.deepEqual(compareDonatedRuns(today, d1), [], label);
}

/** getRunCoverSpec on a Supabase cover row (id, raw, cover_spec), as run-donation.ts does today. */
function coverFromRawRow(runId: string, row: RunRow) {
  const stored = parseCoverSpec(row.cover_spec);
  if (stored?.auto === false) return stored;
  const parsed = parseRunSafely(row.raw);
  return parsed ? pickAlternatingCover(runId, parsed) : stored;
}

async function main() {
  const { db: pg, source } = await openSupabase();
  const NOW = Date.now();
  await loadFixture(pg, NOW);
  const { sqlite } = await firstCopy(pg, DEV, NOW);
  // An upload writes these run columns from the same parsed raw (run-donation.ts parsedMetaFromRun);
  // the shadow fixture's columns differ from its raws, which the list checks below would read as a
  // difference between the raw (today) and the columns (D1 summary rows).
  await pg.exec("update public.runs set ascension = 7, build = 'v0.107.1', run_time = 3600");
  sqlite.exec("UPDATE post_history_course SET ascension = 7, build = 'v0.107.1', run_time = 3600");
  const shim = new SqliteD1(sqlite);
  const d1 = new FlakyD1(shim);
  const fake = fakePostgrest(pg);
  const signer = await makeSigner(`${TEST_SUPABASE_URL}/auth/v1`);
  const realFetch = globalThis.fetch;
  const specFetch = (async (input: Request | string | URL, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url);
    if (url.origin === TEST_SUPABASE_URL && url.pathname === "/auth/v1/.well-known/jwks.json") return Response.json(signer.jwks);
    return fake.fetch(input, init);
  }) as typeof fetch;
  globalThis.fetch = specFetch;

  const env: ApiEnv = { DB: d1, API_RUNTIME_FLAGS: "d1", API_SUPABASE_URL: TEST_SUPABASE_URL, API_SUPABASE_KEY: "sb_publishable_test", API_DATA_ENV: DEV };
  const router = createApiRouter(API_ROUTES, { onResponse: shadowOnResponse, d1Read: d1ReadAnswer });
  const allApi = Object.fromEntries(API_SURFACE_GROUPS.map((group) => [pathFlagKey(group), "api"]));

  function setFlags(values: Record<string, string>) {
    sqlite.exec("DELETE FROM runtime_flags");
    for (const [key, value] of Object.entries({ ...allApi, ...values })) {
      sqlite.prepare("INSERT INTO runtime_flags (key, value, updated_at, note) VALUES (?1, ?2, ?3, 'spec')").run(key, value, new Date().toISOString());
    }
    resetFlagsForTest();
    resetD1ReadForTest();
    resetNavForTest();
  }

  async function get(path: string, init: { method?: string; headers?: Record<string, string>; envOverride?: Partial<ApiEnv> } = {}) {
    const ctx = new Ctx();
    const statementsBefore = shim.statements.length;
    const requestsBefore = fake.requests.length;
    const response = await router.handle(
      new Request(`https://testbed.example${path}`, { method: init.method ?? "GET", headers: init.headers }),
      { ...env, ...init.envOverride },
      ctx,
    );
    const body = init.method === "HEAD" ? "" : await response.text();
    await ctx.drain();
    return {
      response,
      body,
      statements: shim.statements.slice(statementsBefore),
      supabaseRequests: fake.requests.slice(requestsBefore).filter((request) => !request.includes("runtime_flags")),
    };
  }

  /** Lines the Worker logged while `fn` ran. */
  async function logged<T>(fn: () => Promise<T>): Promise<{ value: T; lines: string[] }> {
    const lines: string[] = [];
    const original = console.log;
    console.log = (...args: unknown[]) => {
      lines.push(args.map(String).join(" "));
    };
    try {
      return { value: await fn(), lines };
    } finally {
      console.log = original;
    }
  }

  // ------------------------------------------------------------------------------------------- the flag

  await check("read store: read.<group> = d1 reads D1, source.<group> = d1 makes D1 the origin, anything else is supabase", () => {
    const values = flagValues([
      { key: readFlagKey("nav"), value: "d1" },
      { key: readFlagKey("stories"), value: "D1" },
      { key: readFlagKey("comments"), value: "supabase" },
      { key: sourceFlagKey("comments"), value: "d1" },
      { key: readFlagKey("puzzlebox"), value: "d1" },
      { key: sourceFlagKey("puzzlebox"), value: "supabase" },
      { key: "source.nav", value: "d1" },
      { key: "source.colorful-philosophers", value: "d1" },
    ]);
    assert.equal(readStoreFor(values, "nav"), "d1");
    assert.equal(readStoreFor(values, "stories"), "supabase", "values are exact");
    assert.equal(readStoreFor(values, "comments"), "d1-origin", "the write source wins over read.<group>");
    assert.equal(readStoreFor(values, "puzzlebox"), "d1");
    assert.equal(readStoreFor(values, "colorful-philosophers"), "supabase", "groups without writes have no source flag");
    assert.equal(readStoreFor(new Map(), "history-runs"), "supabase", "no row: today");
  });

  await check("flags CLI: read.<group> for every group takes supabase or d1; production needs --confirm-production", () => {
    for (const group of API_SURFACE_GROUPS) {
      assert.ok(KNOWN_KEYS.has(readFlagKey(group)), `read.${group} is a known key`);
      for (const value of ["supabase", "d1"]) {
        assert.deepEqual(checkFlagSet(readFlagKey(group), value, { env: "testbed", remote: true, confirmProduction: false }), { ok: true });
      }
      assert.equal(checkFlagSet(readFlagKey(group), "api", { env: "testbed", remote: true, confirmProduction: false }).ok, false);
    }
    assert.equal(checkFlagSet("read.nowhere", "d1", { env: "testbed", remote: true, confirmProduction: false }).ok, false);
    const production = checkFlagSet(readFlagKey("nav"), "d1", { env: "production", remote: true, confirmProduction: false });
    assert.equal(production.ok, false);
    assert.match(production.ok ? "" : production.message, /--confirm-production/);
    assert.deepEqual(checkFlagSet(readFlagKey("nav"), "d1", { env: "production", remote: true, confirmProduction: true }), { ok: true });
    assert.deepEqual(checkFlagSet(readFlagKey("nav"), "d1", { env: "production", remote: false, confirmProduction: false }), { ok: true });
    // The keys of earlier steps keep their rules.
    assert.deepEqual(checkFlagSet(pathFlagKey("nav"), "api", { env: "testbed", remote: true, confirmProduction: false }), { ok: true });
    assert.deepEqual(checkFlagSet(sourceFlagKey("comments"), "d1", { env: "testbed", remote: true, confirmProduction: false }), { ok: true });
    assert.deepEqual(checkFlagSet(shadowFlagKey("nav"), "0.5", { env: "testbed", remote: true, confirmProduction: false }), { ok: true });
  });

  // ------------------------------------------------------------------------------------------- router choice

  // One or more public reads of every public GET route (me routes below), with the client's shapes.
  const PUBLIC_CASES: Array<{ route: string; path: string }> = [
    { route: "read.nav", path: "/api/read/nav" },
    { route: "read.engagement", path: `/api/read/engagement?threads=sts2-codex:card:bash,community:${IDS.story(1)}` },
    { route: "read.engagement", path: "/api/read/engagement?likes=sts2-codex:card:bash&reactions=card:bash:0.107.1&philosophers=card:bash" },
    { route: "read.engagement-counts", path: "/api/read/engagement-counts" },
    { route: "read.colorful-philosophers.week", path: "/api/read/colorful-philosophers/week" },
    { route: "read.colorful-philosophers.post", path: `/api/read/colorful-philosophers/post?id=${IDS.philosopher(2)}` },
    { route: "read.colorful-philosophers.reel", path: "/api/read/colorful-philosophers/reel" },
    { route: "read.profile.nicknames", path: "/api/read/profile/nicknames" },
    { route: "read.puzzlebox.leaderboard", path: "/api/read/puzzlebox/leaderboard?game=connections&boards=1:4,2:4&board=total&offset=0&around_me=0" },
    { route: "read.history-runs", path: "/api/read/history-runs?view=recent" },
    { route: "read.history-runs", path: "/api/read/history-runs?view=reference" },
    { route: "read.history-run", path: `/api/read/history-run?id=${RUN1}&view=detail` },
    { route: "read.history-run", path: `/api/read/history-run?id=${RUN1}&view=meta` },
    { route: "read.history-run", path: `/api/read/history-run?id=${RUN3}&view=cover` },
    { route: "read.history-run.raw", path: `${HISTORY_RUN_RAW_PATH}?id=${RUN2}` },
    { route: "read.history-runs.engagement", path: `/api/read/history-runs/engagement?ids=${RUN1},${RUN2},${RUN3}` },
    { route: "read.stories", path: "/api/read/stories?limit=100" },
    { route: "read.toybox-feed", path: "/api/read/toybox-feed?service=combo&sort=latest" },
    { route: "read.defragment-feed", path: "/api/read/defragment-feed?sort=latest" },
    { route: "read.defragment-runs", path: "/api/read/defragment-runs?sort=latest" },
    { route: "read.toybox-post", path: `/api/read/toybox-post?service=combo&id=${IDS.combo(1)}` },
    { route: "read.favorite-tournament.presets", path: "/api/read/favorite-tournament/presets" },
    { route: "read.favorite-tournament.stats", path: `/api/read/favorite-tournament/stats?id=${IDS.tournament(3)}` },
    { route: "read.pagestorm.posts", path: "/api/read/pagestorm/posts" },
    { route: "read.defragment-body", path: `/api/read/defragment-body?service=combo&id=${IDS.combo(1)}` },
    { route: "read.this-or-that.like-counts", path: `/api/read/this-or-that/like-counts?ids=${IDS.tot(1)},${IDS.tot(2)}` },
    { route: "read.this-or-that.vote-summaries", path: `/api/read/this-or-that/vote-summaries?ids=${IDS.tot(1)},${IDS.tot(2)},${IDS.tot(3)}` },
  ];
  const routeById = new Map(API_ROUTES.map((route) => [route.id, route]));

  await check("every public GET route has a case here", () => {
    const publicReads = API_ROUTES.filter((route) => route.method === "GET" && route.access === "public").map((route) => route.id);
    for (const id of publicReads) assert.ok(PUBLIC_CASES.some((item) => item.route === id), `case for ${id}`);
  });

  for (const item of PUBLIC_CASES) {
    await check(`router: ${item.route} reads Supabase on supabase and D1 on d1, same headers and the D1 adapter's body`, async () => {
      const route = routeById.get(item.route)!;
      setFlags({});
      const today = await get(item.path);
      assert.equal(today.response.status, 200, `${item.path}: Supabase 200`);
      assert.ok(today.supabaseRequests.length > 0, "read.<group> missing: Supabase answers");

      setFlags({ [readFlagKey(route.group)]: "d1" });
      const served = await get(item.path);
      assert.equal(served.response.status, 200, `${item.path}: D1 200`);
      assert.deepEqual(served.supabaseRequests, [], "nothing goes to Supabase");
      assert.deepEqual(headersOf(served.response), headersOf(today.response), "the Supabase answer's headers");

      const url = new URL(`https://testbed.example${item.path}`);
      const adapterAnswer = await D1_ADAPTERS[item.route]({ db: shim, dataEnv: DEV, url, userId: null, now: Date.now() });
      const expected = item.route === "read.history-run.raw" ? (adapterAnswer as { text: string }).text : answerText(adapterAnswer);
      if (item.route === "read.nav") {
        const withoutTime = (text: string) => ({ ...JSON.parse(text), fetchedAt: null });
        assert.deepEqual(withoutTime(served.body), withoutTime(expected), "nav: the adapter's snapshot");
      } else {
        assert.equal(served.body, expected, "the body is the D1 adapter's answer");
      }

      // The served D1 body compares equal to the served Supabase body under the shadow rules. Routes
      // whose Supabase answer carries raw run files are compared by the client checks below.
      const spec = SHADOW_SPECS[item.route];
      if (!spec.supabase) {
        const context: ShadowContext = { routeId: item.route, url, config: { url: TEST_SUPABASE_URL, key: "k", dataEnv: DEV }, db: shim, userId: null, now: Date.now() };
        const supabaseValue = spec.prepareSupabase ? spec.prepareSupabase(JSON.parse(today.body), context) : JSON.parse(today.body);
        const d1Value = materialize(spec.prepareD1 ? spec.prepareD1(JSON.parse(served.body), supabaseValue, context) : JSON.parse(served.body));
        const rules = spec.rules?.(context) ?? {};
        const ignore = item.route === "read.nav" ? { ...rules, ignore: [...(rules.ignore ?? []), "fetchedAt"] } : rules;
        const comparison = compareAnswers(supabaseValue, d1Value, ignore);
        assert.ok(comparison.equal, `${item.path}: ${JSON.stringify(comparison.entries).slice(0, 600)}`);
      }
    });
  }

  await check("router: source.<group> = d1 reads D1 too (the origin), without read.<group>", async () => {
    setFlags({ [sourceFlagKey("history-runs")]: "d1" });
    const served = await get("/api/read/history-runs?view=recent");
    assert.equal(served.response.status, 200);
    assert.deepEqual(served.supabaseRequests, []);
    assert.ok((JSON.parse(served.body) as Array<Record<string, unknown>>).every((row) => "summary_version" in row && !("raw" in row)));
  });

  await check("router: an /api/me GET of a D1 group answers from D1 for the verified caller", async () => {
    resetJwtCachesForTest();
    setFlags({ [readFlagKey("history-runs")]: "d1", [readFlagKey("toybox-feed")]: "d1" });
    const token = await signer.token(U1);
    const mine = await get("/api/me/history-runs", { headers: { authorization: `Bearer ${token}` } });
    assert.equal(mine.response.status, 200);
    assert.deepEqual(mine.supabaseRequests, [], "no PostgREST read (the JWKS aside)");
    const expected = await D1_ADAPTERS["me.history-runs"]({ db: shim, dataEnv: DEV, url: new URL("https://x/api/me/history-runs"), userId: U1, now: Date.now() });
    assert.deepEqual(JSON.parse(mine.body), materialize(expected));
    assert.ok((JSON.parse(mine.body).ids as string[]).length > 0, "U1 has runs in the fixture");
    const drafts = await get("/api/me/pagestorm/drafts", { headers: { authorization: `Bearer ${token}` } });
    assert.equal(drafts.response.status, 200);
    assert.deepEqual(drafts.supabaseRequests, []);
    assert.equal(drafts.response.headers.get("x-slseoun-api-env"), DEV, "a passed-through PostgREST array keeps its env header");
    const unauthenticated = await get("/api/me/history-runs");
    assert.equal(unauthenticated.response.status, 401, "identity is checked before the D1 read");
  });

  await check("router: HEAD keeps the route's handler (no D1 read), rate limits apply before D1", async () => {
    setFlags({ [readFlagKey("stories")]: "d1" });
    const head = await get("/api/read/stories?limit=100", { method: "HEAD" });
    assert.equal(head.response.status, 200);
    assert.ok(!head.statements.some((sql) => sql.includes("community_stories")), "HEAD reads no D1 data");
    const limited = await get("/api/read/stories?limit=100", {
      headers: { "cf-connecting-ip": "203.0.113.9" },
      envOverride: { API_READ_LIMITER: { limit: async () => ({ success: false }) } },
    });
    assert.equal(limited.response.status, 429);
    assert.ok(!limited.statements.some((sql) => sql.includes("community_stories")), "a limited request reads no D1 data");
    assert.equal((await get("/api/read/stories?limit=7")).response.status, 400, "the router's query check runs first");
  });

  await check("router: a D1 answer is never shadow-compared", async () => {
    resetShadowForTest();
    sqlite.exec("DELETE FROM shadow_stats; DELETE FROM shadow_diffs;");
    setFlags({ [readFlagKey("stories")]: "d1", [shadowFlagKey("stories")]: "1" });
    setShadowRandomForTest(() => 0);
    await get("/api/read/stories?limit=100");
    assert.equal(Number((sqlite.prepare("SELECT count(*) AS n FROM shadow_stats").get() as { n: number }).n), 0);
    setFlags({ [shadowFlagKey("stories")]: "1" });
    await get("/api/read/stories?limit=100");
    assert.equal(Number((sqlite.prepare("SELECT count(*) AS n FROM shadow_stats").get() as { n: number }).n), 1, "on supabase the shadow still runs");
    resetShadowForTest();
  });

  await check("router: nav on D1 keeps public max-age=30 and answers from isolate memory for 30 s", async () => {
    setFlags({ [readFlagKey("nav")]: "d1" });
    const first = await get("/api/read/nav");
    assert.equal(first.response.headers.get("cache-control"), "public, max-age=30");
    assert.ok(first.statements.some((sql) => sql.includes("FROM comments")), "the first read goes to D1");
    const second = await get("/api/read/nav");
    assert.equal(second.body, first.body);
    assert.ok(!second.statements.some((sql) => sql.includes("FROM comments")), "the second one comes from memory");
  });

  await check("router: the QA path override uses this isolate's last flags read for the read store", async () => {
    setFlags({ [readFlagKey("stories")]: "d1" });
    await get("/api/read/engagement-counts"); // any api read: the flags are read and remembered
    const pinned = await get("/api/read/stories?limit=100", { headers: { cookie: "slseoun_qa_path=stories" } });
    assert.equal(pinned.response.status, 200);
    assert.deepEqual(pinned.supabaseRequests, [], "pinned to api and reading D1");
  });

  // ------------------------------------------------------------------------------------------- failures

  await check("fallback: with Supabase the source, a D1 error answers from Supabase and logs one line", async () => {
    setFlags({ [readFlagKey("stories")]: "d1" });
    await get("/api/read/engagement-counts");
    d1.mode = "fail";
    try {
      const { value, lines } = await logged(() => get("/api/read/stories?limit=100"));
      assert.equal(value.response.status, 200);
      assert.ok(value.supabaseRequests.some((request) => request.includes("community_stories")), "the Supabase handler answered");
      setFlags({});
      d1.mode = "ok";
      const today = await get("/api/read/stories?limit=100");
      assert.equal(value.body, today.body, "today's answer");
      assert.deepEqual(lines.filter((line) => line.startsWith("api d1read")), ["api d1read read.stories fallback"]);
    } finally {
      d1.mode = "ok";
    }
  });

  await check("fallback: a D1 that does not answer gives way to Supabase after the fallback timeout", async () => {
    setFlags({ [readFlagKey("stories")]: "d1" });
    await get("/api/read/engagement-counts");
    d1.mode = "hang";
    try {
      const started = Date.now();
      const { value, lines } = await logged(() => get("/api/read/stories?limit=100"));
      assert.equal(value.response.status, 200);
      assert.ok(Date.now() - started >= D1_READ_FALLBACK_MS - 50);
      assert.ok(value.supabaseRequests.length > 0);
      assert.deepEqual(lines.filter((line) => line.startsWith("api d1read")), ["api d1read read.stories fallback"]);
    } finally {
      d1.mode = "ok";
    }
  });

  await check("origin: with source.<group> = d1 a D1 error is the 503 a Supabase failure gives, never a Supabase read", async () => {
    setFlags({ [sourceFlagKey("stories")]: "d1" });
    await get("/api/read/engagement-counts");
    d1.mode = "fail";
    let failure: Response;
    try {
      const { value, lines } = await logged(() => get("/api/read/stories?limit=100"));
      assert.equal(value.response.status, 503);
      assert.deepEqual(JSON.parse(value.body), { error: "unavailable" });
      assert.deepEqual(value.supabaseRequests, []);
      assert.deepEqual(lines.filter((line) => line.startsWith("api d1read")), ["api d1read read.stories unavailable"]);
      failure = value.response;
    } finally {
      d1.mode = "ok";
    }
    // The answer a Supabase failure gives today: the route's handler with PostgREST down.
    setFlags({});
    globalThis.fetch = (async () => new Response("{\"code\":\"XX000\"}", { status: 503 })) as typeof fetch;
    let today: Response;
    try {
      today = (await get("/api/read/stories?limit=100")).response;
    } finally {
      globalThis.fetch = specFetch;
    }
    assert.equal(today.status, 503);
    assert.deepEqual(headersOf(failure), headersOf(today));
  });

  await check("input: a cursor D1 cannot compare goes to the Supabase handler on read = d1, and is a 400 with D1 the origin", async () => {
    const path = `/api/read/toybox-feed?service=combo&sort=latest&score=0&created_at=2026-01-01T00:00:00&cursor_id=${IDS.combo(1)}`;
    setFlags({ [readFlagKey("toybox-feed")]: "d1" });
    const { value: fallback, lines } = await logged(() => get(path));
    setFlags({});
    const today = await get(path);
    assert.equal(fallback.response.status, today.response.status);
    assert.equal(fallback.body, today.body, "today's answer");
    assert.deepEqual(lines.filter((line) => line.startsWith("api d1read")), [], "an input error is not a D1 failure");
    setFlags({ [sourceFlagKey("toybox-feed")]: "d1" });
    const origin = await get(path);
    assert.equal(origin.response.status, 400);
    assert.deepEqual(origin.supabaseRequests, []);
  });

  // ------------------------------------------------------------------------------------------- the client on D1 answers

  const runIds = [RUN1, RUN2, RUN3];
  async function rows(path: string, store: "supabase" | "d1"): Promise<RunRow[]> {
    setFlags(store === "d1" ? { [readFlagKey("history-runs")]: "d1" } : {});
    const answer = await get(path);
    assert.equal(answer.response.status, 200, path);
    return JSON.parse(answer.body) as RunRow[];
  }
  const rawCalls: string[] = [];
  const fetchRaw = async (runId: string) => {
    rawCalls.push(runId);
    const answer = await get(`${HISTORY_RUN_RAW_PATH}?id=${encodeURIComponent(runId)}`);
    assert.equal(answer.response.headers.get("content-type"), "text/plain; charset=utf-8");
    return answer.body || null;
  };
  const noRaw = async (): Promise<string | null> => {
    throw new Error("a Supabase row never reads R3r");
  };

  await check("R3r: the raw route answers the stored raw file as text/plain on both stores, empty for a run that is not shared", async () => {
    for (const id of runIds) {
      const stored = (await pg.query<{ raw: string }>("select raw from public.runs where id = $1 and env = $2", [id, DEV])).rows[0].raw;
      setFlags({});
      const today = await get(`${HISTORY_RUN_RAW_PATH}?id=${id}`);
      setFlags({ [readFlagKey("history-runs")]: "d1" });
      const served = await get(`${HISTORY_RUN_RAW_PATH}?id=${id}`);
      assert.equal(today.body, stored, `${id}: Supabase`);
      assert.equal(served.body, stored, `${id}: D1`);
      assert.deepEqual(headersOf(served.response), headersOf(today.response));
    }
    for (const store of ["supabase", "d1"] as const) {
      setFlags(store === "d1" ? { [readFlagKey("history-runs")]: "d1" } : {});
      const missing = await get(`${HISTORY_RUN_RAW_PATH}?id=missing`);
      assert.equal(missing.response.status, 200);
      assert.equal(missing.body, "", `${store}: empty body`);
    }
  });

  await check("history-course list and picker: the D1 summary rows build the same cards, search and chips as the raw rows", async () => {
    for (const view of ["recent", "reference"]) {
      const today = await donatedRunsFromListRows(await rows(`/api/read/history-runs?view=${view}`, "supabase"), noRaw);
      rawCalls.length = 0;
      const d1Rows = await rows(`/api/read/history-runs?view=${view}`, "d1");
      assert.ok(d1Rows.every((row) => !("raw" in row)), "the D1 answer has no raw");
      const fromD1 = await donatedRunsFromListRows(d1Rows, fetchRaw);
      assert.deepEqual(rawCalls, [], "runs with a summary read no raw");
      assert.ok(fromD1.every((run) => run.search_facts && run.raw === null));
      assert.ok(today.every((run) => run.raw && !run.search_facts));
      listsMatch(today, fromD1, view, view === "recent" ? "created_at" : "start_time");
      assert.ok(today.length === 3);
    }
  });

  await check("history-course list: a run with summary_version 0 reads its raw from R3r and is built as today", async () => {
    sqlite.prepare("UPDATE post_history_course SET summary_version = 0 WHERE post_id = ?1").run(RUN2);
    try {
      const today = await donatedRunsFromListRows(await rows("/api/read/history-runs?view=recent", "supabase"), noRaw);
      rawCalls.length = 0;
      const fromD1 = await donatedRunsFromListRows(await rows("/api/read/history-runs?view=recent", "d1"), fetchRaw);
      assert.deepEqual(rawCalls, [RUN2]);
      const zero = fromD1.find((run) => run.id === RUN2)!;
      assert.ok(zero.raw && !zero.search_facts, "built from its raw, like a Supabase row");
      listsMatch(today, fromD1, "summary_version 0", "created_at");
      assert.deepEqual(fromD1.find((run) => run.id === RUN2), today.find((run) => run.id === RUN2), "the same object as today, raw included");
      // A raw that cannot be read leaves the card with its columns (no throw).
      const unreadable = await donatedRunsFromListRows(await rows("/api/read/history-runs?view=recent", "d1"), async () => {
        throw new Error("offline");
      });
      assert.equal(unreadable.length, 3);
    } finally {
      sqlite.prepare("UPDATE post_history_course SET summary_version = 1 WHERE post_id = ?1").run(RUN2);
    }
  });

  await check("run detail: the D1 detail row plus its R3r raw is the run the Supabase row gives", async () => {
    for (const id of runIds) {
      const [today] = await rows(`/api/read/history-run?id=${id}&view=detail`, "supabase");
      const [served] = await rows(`/api/read/history-run?id=${id}&view=detail`, "d1");
      assert.ok(!("raw" in served));
      const raw = await fetchRaw(id);
      assert.deepEqual(normalizeRunRow({ ...served, raw: raw ?? undefined }, id), normalizeRunRow(today, id), id);
    }
  });

  await check("covers: the R4 cover row picks the cover the raw cover row picks (summary_version 0 through R3r)", async () => {
    for (const zero of [false, true]) {
      if (zero) sqlite.exec("UPDATE post_history_course SET summary_version = 0");
      try {
        for (const id of runIds) {
          const [today] = await rows(`/api/read/history-run?id=${id}&view=cover`, "supabase");
          const [served] = await rows(`/api/read/history-run?id=${id}&view=cover`, "d1");
          rawCalls.length = 0;
          const cover = await coverFromSummaryCoverRow(id, served as unknown as RunSummaryCoverRow, fetchRaw);
          assert.deepEqual(cover, coverFromRawRow(id, today), `${id}${zero ? " (summary_version 0)" : ""}`);
          const manual = parseCoverSpec(today.cover_spec)?.auto === false;
          assert.equal(rawCalls.length, zero && !manual ? 1 : 0, "the raw is read only without a summary");
        }
      } finally {
        if (zero) sqlite.exec("UPDATE post_history_course SET summary_version = 1");
      }
    }
  });

  await check("cover editor: the raw it reads from R3r is the raw the Supabase list row carries", async () => {
    const today = await donatedRunsFromListRows(await rows("/api/read/history-runs?view=recent", "supabase"), noRaw);
    for (const run of today) assert.equal(await fetchRaw(run.id), run.raw);
    assert.ok(isDeepStrictEqual(today.map((run) => run.id).sort(), [...runIds].sort()));
  });

  globalThis.fetch = realFetch;
  await pg.close();
  console.log(`d1-read-store spec passed (${checks} checks, ${PUBLIC_CASES.length} public read cases, Supabase from ${source})`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
