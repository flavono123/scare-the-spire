/**
 * Step 1 Worker API: router, runtime flags, the flag cookie and /api/read/nav
 * (docs/supabase-exit/STEP1_DESIGN.md 3, 4, 8). D1 and Supabase are in-memory stubs.
 * Usage: tsx scripts/api-worker.spec.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { flagCookieValue, parseFlagCookieValue } from "../src/lib/api-surfaces";
import { flagCookieHeader, isPageRequest, readCookie } from "../workers/api/flag-cookie";
import { FLAGS_SQL, FRESH_MS, pageFlags, resetFlagsForTest } from "../workers/api/flags";
import type { D1Database, D1PreparedStatement, D1Result } from "../workers/api/d1";
import { isCrossSiteWrite } from "../workers/api/router";
import {
  NAV_FAIL_SQL,
  NAV_LEASE_SQL,
  NAV_SAVE_SQL,
  NAV_SNAPSHOT_SQL,
  resetNavForTest,
} from "../workers/api/routes/nav";
import mainWorker from "../workers/main-worker";

const ORIGIN = "https://testbed.example.workers.dev";
const PROJECT = "https://abcdefghijklmnopqrst.supabase.co";
const VARS = {
  API_RUNTIME_FLAGS: "d1",
  API_SUPABASE_URL: PROJECT,
  API_SUPABASE_KEY: "sb_publishable_test",
  API_DATA_ENV: "development",
};

type CacheRow = { body: string; fetched_at: number; lease_until: number; fail_count: number; fail_until: number };

class FakeD1 implements D1Database {
  flags = new Map<string, string>();
  cache = new Map<string, CacheRow>();
  queries: string[] = [];
  failing = false;
  delayMs = 0;

  prepare(query: string): D1PreparedStatement {
    let args: unknown[] = [];
    const exec = async (): Promise<D1Result<Record<string, unknown>>> => {
      this.queries.push(query);
      if (this.delayMs) await new Promise((resolve) => setTimeout(resolve, this.delayMs));
      if (this.failing) throw new Error("D1 down");
      if (query === FLAGS_SQL) {
        return { success: true, results: [...this.flags].map(([key, value]) => ({ key, value })) };
      }
      if (query === NAV_SNAPSHOT_SQL) {
        const row = this.cache.get(String(args[0]));
        return { success: true, results: row ? [{ ...row }] : [] };
      }
      // Same semantics as the SQL in routes/nav.ts (checked against sqlite3 in the code review).
      if (query === NAV_LEASE_SQL) {
        const [key, leaseUntil, now, staleBefore] = args as [string, number, number, number];
        const row = this.cache.get(key);
        if (!row) {
          this.cache.set(key, { body: "", fetched_at: 0, lease_until: leaseUntil, fail_count: 0, fail_until: 0 });
          return { success: true, results: [], meta: { changes: 1 } };
        }
        if (row.lease_until < now && row.fail_until <= now && row.fetched_at <= staleBefore) {
          row.lease_until = leaseUntil;
          return { success: true, results: [], meta: { changes: 1 } };
        }
        return { success: true, results: [], meta: { changes: 0 } };
      }
      if (query === NAV_SAVE_SQL) {
        const [key, body, fetchedAt, leaseUntil] = args as [string, string, number, number];
        const row = this.cache.get(key);
        if (!row || row.lease_until !== leaseUntil) return { success: true, results: [], meta: { changes: 0 } };
        Object.assign(row, { body, fetched_at: fetchedAt, lease_until: 0, fail_count: 0, fail_until: 0 });
        return { success: true, results: [], meta: { changes: 1 } };
      }
      if (query === NAV_FAIL_SQL) {
        const [key, until, leaseUntil] = args as [string, number, number];
        const row = this.cache.get(key);
        if (!row || row.lease_until !== leaseUntil) return { success: true, results: [], meta: { changes: 0 } };
        Object.assign(row, { lease_until: 0, fail_count: row.fail_count + 1, fail_until: until });
        return { success: true, results: [], meta: { changes: 1 } };
      }
      throw new Error(`unexpected SQL: ${query}`);
    };
    const statement: D1PreparedStatement = {
      bind(...values: unknown[]) {
        args = values;
        return statement;
      },
      all: exec as D1PreparedStatement["all"],
      async first() {
        const result = await exec();
        return (result.results[0] ?? null) as never;
      },
      run: exec as D1PreparedStatement["run"],
    };
    return statement;
  }

  async batch<T>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
    if (this.failing) throw new Error("D1 down");
    return Promise.all(statements.map((statement) => statement.all<T>()));
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

const html = (body = "<!DOCTYPE html><html><head></head><body>page</body></html>") =>
  new Response(body, { headers: { "content-type": "text/html; charset=utf-8", etag: "\"abc\"" } });

function assets() {
  return {
    fetch: async (request: Request) => {
      const { pathname } = new URL(request.url);
      if (pathname.includes("not-found") || pathname.includes("404")) return new Response("missing", { status: 404 });
      if (request.headers.get("if-none-match") === "\"abc\"") {
        return new Response(null, { status: 304, headers: { etag: "\"abc\"" } });
      }
      return html();
    },
  };
}

function patchWorker() {
  return {
    fetch: async (request: Request) => {
      const { pathname } = new URL(request.url);
      // Service binding responses have immutable headers.
      const response = pathname.endsWith(".js")
        ? new Response("js", { headers: { "content-type": "text/javascript" } })
        : html();
      return Response.redirect === undefined ? response : new Response(response.body, response);
    },
  };
}

type SupabaseCall = { url: URL; at: number };

function stubSupabase(respond: (url: URL) => Response | Promise<Response>) {
  const calls: SupabaseCall[] = [];
  let inFlight = 0;
  let peak = 0;
  globalThis.fetch = (async (input: Request | string | URL) => {
    const url = new URL(String(input instanceof Request ? input.url : input));
    calls.push({ url, at: Date.now() });
    inFlight += 1;
    peak = Math.max(peak, inFlight);
    try {
      await new Promise((resolve) => setTimeout(resolve, 2));
      return await respond(url);
    } finally {
      inFlight -= 1;
    }
  }) as typeof fetch;
  return { calls, peak: () => peak };
}

function healthySupabase(url: URL): Response {
  const table = url.pathname.split("/").pop();
  if (table === "comments") {
    return Response.json([
      { id: "c1", story_id: "sts2-codex:card:bash", content: `${"긴 댓글 ".repeat(60)}끝`, created_at: "2026-11-05T01:02:03.456789+00:00" },
      { id: "c2", story_id: "sts2-patch:0.107.1", content: "[카드콘:bash]", created_at: "2026-11-04T00:00:00+00:00" },
      { id: "c3", story_id: "", content: "no thread", created_at: "2026-11-04T00:00:00+00:00" },
    ]);
  }
  if (table === "colorful_philosopher_posts") return Response.json([{ week_start: "2026-11-02" }]);
  if (table === "runs") return Response.json([]);
  return Response.json([{ created_at: "2026-11-04T09:12:33.120456+00:00" }]);
}

const env = (db: FakeD1, extra: Record<string, unknown> = {}) => ({
  ...VARS,
  DB: db,
  ASSETS: assets(),
  PATCH_WORKER: patchWorker(),
  ...extra,
});

function get(path: string, init: RequestInit = {}) {
  return new Request(`${ORIGIN}${path}`, init);
}

async function nav(db: FakeD1, ctx: Ctx, init: RequestInit = {}, extra: Record<string, unknown> = {}) {
  return mainWorker.fetch(get("/api/read/nav", init), env(db, extra) as never, ctx);
}

function resetAll() {
  resetFlagsForTest();
  resetNavForTest();
}

function checkWranglerConfig() {
  // Strip // comments (not inside strings) before parsing the JSONC file.
  const text = readFileSync("wrangler.jsonc", "utf8").replace(/^\s*\/\/.*$/gm, "");
  const config = JSON.parse(text);
  const prod = config.d1_databases?.find((db: { binding: string }) => db.binding === "DB");
  const testbed = config.env?.testbed?.d1_databases?.find((db: { binding: string }) => db.binding === "DB");
  assert.ok(prod?.database_id && testbed?.database_id, "both D1 bindings have ids (no auto-create on deploy)");
  assert.notEqual(prod.database_id, testbed.database_id, "testbed flags must never flip production");
  assert.equal(prod.database_name, "slseoun-prod");
  assert.equal(testbed.database_name, "slseoun-testbed");
  assert.equal(config.vars?.API_RUNTIME_FLAGS, "d1", "production reads runtime_flags since step 2");
  assert.deepEqual(config.assets?.run_worker_first, ["/api/*"]);
  // Step 4 defaults (2026-11-09): every path.<group> is api and every write.<group> row is set,
  // so these only decide a failed flag read (STEP4_WRITE_GATE.md 7, 8).
  for (const vars of [config.vars, config.env?.testbed?.vars]) {
    assert.equal(vars?.API_PATH_DEFAULT, "api", "API_PATH_DEFAULT is api in both envs");
    assert.equal(vars?.API_WRITE_MODE_DEFAULT, "worker", "API_WRITE_MODE_DEFAULT is worker in both envs");
  }
  for (const key of ["API_SUPABASE_URL", "API_SUPABASE_KEY", "API_DATA_ENV"]) {
    assert.equal(config.vars?.[key], undefined, `${key} comes from --var, not the repo`);
    assert.equal(config.env?.testbed?.vars?.[key], undefined, `${key} comes from --var, not the repo`);
  }
}

async function main() {
  const realFetch = globalThis.fetch;
  checkWranglerConfig();

  // --- Shared cookie helpers -------------------------------------------------
  assert.equal(flagCookieValue(["nav", "comments", "nav"]), "v1.comments.nav");
  assert.equal(flagCookieValue([]), null);
  assert.deepEqual(parseFlagCookieValue("v1.comments.nav"), new Set(["comments", "nav"]));
  assert.equal(parseFlagCookieValue("v2.nav"), null);
  assert.equal(parseFlagCookieValue("v1.nav.bogus"), null);
  assert.equal(parseFlagCookieValue("v1"), null);
  assert.equal(readCookie(get("/", { headers: { cookie: "a=1; slseoun_rf=v1.nav; b=2" } }), "slseoun_rf"), "v1.nav");

  assert.equal(flagCookieHeader(null, new Set(), true), null, "nothing to do");
  assert.equal(flagCookieHeader("v1.nav", new Set(), true), "slseoun_rf=; Path=/; Max-Age=0; SameSite=Lax; Secure");
  assert.equal(flagCookieHeader("v1.nav", new Set(["nav"]), true), null, "unchanged cookie is not resent");
  assert.equal(flagCookieHeader(null, new Set(["nav"]), false), "slseoun_rf=v1.nav; Path=/; Max-Age=86400; SameSite=Lax");
  assert.equal(flagCookieHeader("garbage", new Set(["nav"]), true), "slseoun_rf=v1.nav; Path=/; Max-Age=86400; SameSite=Lax; Secure");

  assert.equal(isPageRequest(get("/compendium/cards"), new URL(`${ORIGIN}/compendium/cards`)), true);
  assert.equal(isPageRequest(get("/patches/0.107.1"), new URL(`${ORIGIN}/patches/0.107.1`)), true);
  for (const path of ["/_patches/patch.css", "/images/x.webp", "/fonts/a.woff2", "/robots.txt", "/api/read/nav", "/api/link-preview"]) {
    assert.equal(isPageRequest(get(path), new URL(`${ORIGIN}${path}`)), false, path);
  }
  assert.equal(isPageRequest(get("/", { method: "POST" }), new URL(`${ORIGIN}/`)), false);

  // --- Cross-site rule -------------------------------------------------------
  const url = new URL(`${ORIGIN}/api/write/x`);
  assert.equal(isCrossSiteWrite(get("/api/write/x", { method: "POST" }), url), false, "no headers: old browser");
  assert.equal(isCrossSiteWrite(get("/api/write/x", { method: "POST", headers: { "sec-fetch-site": "same-origin" } }), url), false);
  assert.equal(isCrossSiteWrite(get("/api/write/x", { method: "POST", headers: { "sec-fetch-site": "cross-site" } }), url), true);
  assert.equal(isCrossSiteWrite(get("/api/write/x", { method: "POST", headers: { "sec-fetch-site": "same-site" } }), url), true);
  assert.equal(isCrossSiteWrite(get("/api/write/x", { method: "POST", headers: { origin: "https://evil.example" } }), url), true);
  assert.equal(isCrossSiteWrite(get("/api/write/x", { method: "POST", headers: { origin: "null" } }), url), true);
  assert.equal(isCrossSiteWrite(get("/api/write/x", { method: "POST", headers: { origin: ORIGIN } }), url), false);

  // --- Router legacy signals -------------------------------------------------
  {
    resetAll();
    const db = new FakeD1();
    db.flags.set("path.nav", "api");
    const ctx = new Ctx();
    const unknown = await mainWorker.fetch(get("/api/read/nope"), env(db) as never, ctx);
    assert.equal(unknown.status, 409);
    assert.equal(unknown.headers.get("x-slseoun-api"), "1");
    assert.deepEqual(await unknown.json(), { error: "surface_legacy", reason: "no_route" });

    const patchesLike = await mainWorker.fetch(get("/api/read/patches/0.107.1"), env(db) as never, ctx);
    assert.equal(patchesLike.status, 409, "never reaches the patch Worker");

    const trailing = await mainWorker.fetch(get("/api/read/nav/"), env(db) as never, ctx);
    assert.equal(trailing.status, 409);

    const post = await mainWorker.fetch(get("/api/read/nav", { method: "POST" }), env(db) as never, ctx);
    assert.equal(post.status, 405);
    assert.equal(post.headers.get("allow"), "OPTIONS, GET, HEAD");

    const options = await mainWorker.fetch(get("/api/read/nav", { method: "OPTIONS" }), env(db) as never, ctx);
    assert.equal(options.status, 204);
    assert.equal(options.headers.get("access-control-allow-origin"), null, "no CORS");

    const badQuery = await mainWorker.fetch(get("/api/read/nav?x=1"), env(db) as never, ctx);
    assert.equal(badQuery.status, 400);

    for (const [label, extra, reason] of [
      ["kill switch", { API_RUNTIME_FLAGS: "off" }, "off"],
      ["no binding", { DB: undefined }, "off"],
      ["bad url", { API_SUPABASE_URL: `${PROJECT}/x` }, "not_configured"],
      ["secret key", { API_SUPABASE_KEY: "sb_secret_x" }, "not_configured"],
      ["bad env", { API_DATA_ENV: "staging" }, "not_configured"],
    ] as const) {
      resetAll();
      const response = await mainWorker.fetch(get("/api/read/nav"), env(db, extra) as never, new Ctx());
      assert.equal(response.status, 409, label);
      assert.deepEqual(await response.json(), { error: "surface_legacy", reason }, label);
    }

    resetAll();
    const qa = await mainWorker.fetch(get("/api/read/nav", { headers: { cookie: "slseoun_qa=no-supabase" } }), env(db) as never, new Ctx());
    assert.deepEqual(await qa.json(), { error: "surface_legacy", reason: "qa" });

    // Existing /api paths keep their handlers.
    const linkPreview = await mainWorker.fetch(get("/api/link-preview?url=x"), env(db) as never, new Ctx());
    assert.equal(linkPreview.headers.get("x-slseoun-api"), null);
  }

  // --- Flags: legacy, D1 failure, freshness ---------------------------------
  {
    resetAll();
    const db = new FakeD1();
    const supabase = stubSupabase(healthySupabase);
    const legacy = await nav(db, new Ctx());
    assert.deepEqual(await legacy.json(), { error: "surface_legacy", reason: "flag" }, "no row means legacy");
    assert.equal(supabase.calls.length, 0);

    resetAll();
    db.flags.set("path.nav", "legacy");
    assert.equal((await nav(db, new Ctx())).status, 409);

    resetAll();
    db.flags.set("path.nav", "API");
    assert.equal((await nav(db, new Ctx())).status, 409, "values are exact");

    resetAll();
    db.flags.set("path.nav", "api");
    db.failing = true;
    const down = await nav(db, new Ctx());
    assert.deepEqual(await down.json(), { error: "surface_legacy", reason: "flag" }, "D1 down means legacy");
    db.failing = false;
    // Backoff after a failure: the next request does not hit D1 again right away.
    const before = db.queries.length;
    assert.equal((await nav(db, new Ctx())).status, 409);
    assert.equal(db.queries.length, before, "failure backoff");

    // A slow D1 read is cut at 1 s and treated as legacy.
    resetAll();
    db.delayMs = 1200;
    const started = Date.now();
    const slow = await nav(db, new Ctx());
    assert.equal(slow.status, 409);
    assert.ok(Date.now() - started < 1150, "flag wait capped near 1 s");
    db.delayMs = 0;
    globalThis.fetch = realFetch;
  }

  // --- API_PATH_DEFAULT: the env default of a missing row or a failed read (plan 7.2) ---
  {
    const supabase = stubSupabase(healthySupabase);
    const db = new FakeD1();
    const api = { API_PATH_DEFAULT: "api" };
    resetAll();
    assert.equal((await nav(db, new Ctx(), {}, api)).status, 200, "no row: the default");
    resetAll();
    db.flags.set("path.nav", "legacy");
    assert.deepEqual(await (await nav(db, new Ctx(), {}, api)).json(), { error: "surface_legacy", reason: "flag" }, "an explicit legacy row wins");
    resetAll();
    db.flags.set("path.nav", "API");
    assert.equal((await nav(db, new Ctx(), {}, api)).status, 200, "an unknown value takes the default");
    resetAll();
    db.flags.set("path.nav", "legacy");
    db.failing = true;
    // The handler runs (nav's own snapshot is on D1 too, so it answers 503 unavailable, not legacy).
    const down = await nav(db, new Ctx(), {}, api);
    assert.deepEqual([down.status, await down.json()], [503, { error: "unavailable" }], "D1 down: the default, not legacy");
    const backoff = await nav(db, new Ctx(), {}, api);
    assert.deepEqual([backoff.status, await backoff.json()], [503, { error: "unavailable" }], "the failure backoff keeps the default");
    db.failing = false;
    resetAll();
    db.delayMs = 1200;
    // The slow D1 also holds nav's own snapshot read; what matters is that the router did not say legacy.
    assert.notEqual((await nav(db, new Ctx(), {}, api)).status, 409, "a read past 1 s takes the default");
    db.delayMs = 0;
    for (const [label, extra, reason] of [
      ["kill switch", { API_RUNTIME_FLAGS: "off" }, "off"],
      ["bad config", { API_SUPABASE_KEY: "sb_secret_x" }, "not_configured"],
    ] as const) {
      resetAll();
      db.failing = true;
      const response = await nav(db, new Ctx(), {}, { ...api, ...extra });
      assert.deepEqual(await response.json(), { error: "surface_legacy", reason }, `${label} wins over the default`);
      db.failing = false;
    }
    resetAll();
    const qa = await nav(db, new Ctx(), { headers: { cookie: "slseoun_qa=no-supabase" } }, api);
    assert.deepEqual(await qa.json(), { error: "surface_legacy", reason: "qa" }, "QA no-supabase wins over the default");
    for (const value of [undefined, "", "legacy", "API", "1"]) {
      resetAll();
      db.flags.clear();
      db.failing = true;
      const response = await nav(db, new Ctx(), {}, { API_PATH_DEFAULT: value });
      assert.deepEqual(await response.json(), { error: "surface_legacy", reason: "flag" }, `API_PATH_DEFAULT=${value}: legacy as today`);
      db.failing = false;
    }

    // Pages: a cold or failing isolate says api instead of leaving a cookie-less browser on legacy.
    resetAll();
    const pageDb = new FakeD1();
    pageDb.flags.set("path.nav", "legacy");
    const ctx = new Ctx();
    const routed = new Set(["nav"] as const);
    assert.deepEqual(pageFlags(env(pageDb, api) as never, ctx, routed), new Set(["nav"]), "cold isolate: the default");
    await ctx.drain();
    assert.deepEqual(pageFlags(env(pageDb, api) as never, ctx, routed), new Set(), "a read row wins");
    resetAll();
    const cold = await mainWorker.fetch(get("/compendium/cards"), env(new FakeD1(), api) as never, new Ctx());
    assert.equal(
      cold.headers.get("set-cookie"),
      "slseoun_rf=v1.colorful-philosophers.comments.contact.history-runs.nav.profile.puzzlebox.stories.toybox-feed; Path=/; Max-Age=86400; SameSite=Lax; Secure",
      "cold page sets every routed group to the default",
    );
    resetAll();
    assert.equal(pageFlags(env(pageDb) as never, new Ctx(), routed), null, "unset: unknown stays unknown");
    assert.ok(supabase.calls.length > 0);
    globalThis.fetch = realFetch;
  }

  // --- Page flags never wait, and unknown leaves the cookie alone -----------
  {
    resetAll();
    const db = new FakeD1();
    db.flags.set("path.nav", "api");
    db.delayMs = 50;
    const ctx = new Ctx();
    const routed = new Set(["nav"] as const);
    const started = Date.now();
    assert.equal(pageFlags(env(db) as never, ctx, routed), null, "cold isolate: unknown");
    assert.ok(Date.now() - started < 20, "did not wait for D1");
    assert.equal(pageFlags(env(db) as never, ctx, routed), null, "refresh guard: no second read");
    await ctx.drain();
    assert.equal(db.queries.filter((query) => query === FLAGS_SQL).length, 1);
    assert.deepEqual(pageFlags(env(db) as never, ctx, routed), new Set(["nav"]));
    // A group without routes in this Worker cannot be turned on.
    db.flags.set("path.comments", "api");
    resetFlagsForTest();
    pageFlags(env(db) as never, ctx, routed);
    await ctx.drain();
    assert.deepEqual(pageFlags(env(db) as never, ctx, routed), new Set(["nav"]));
    db.delayMs = 0;
  }

  // --- Flag cookie on page responses ----------------------------------------
  {
    resetAll();
    const db = new FakeD1();
    db.flags.set("path.nav", "api");
    const ctx = new Ctx();
    const cold = await mainWorker.fetch(get("/compendium/cards"), env(db) as never, ctx);
    assert.equal(cold.headers.get("set-cookie"), null, "cold isolate does not change the cookie");
    await ctx.drain();

    const warm = await mainWorker.fetch(get("/compendium/cards"), env(db) as never, ctx);
    assert.equal(warm.status, 200);
    assert.equal(warm.headers.get("set-cookie"), "slseoun_rf=v1.nav; Path=/; Max-Age=86400; SameSite=Lax; Secure");
    assert.equal(warm.headers.get("etag"), "\"abc\"", "ETag untouched");
    assert.equal(await warm.text(), "<!DOCTYPE html><html><head></head><body>page</body></html>", "body untouched");

    const same = await mainWorker.fetch(get("/compendium/cards", { headers: { cookie: "slseoun_rf=v1.nav" } }), env(db) as never, ctx);
    assert.equal(same.headers.get("set-cookie"), null, "no resend when the cookie already matches");

    const revalidated = await mainWorker.fetch(get("/compendium/cards", { headers: { "if-none-match": "\"abc\"" } }), env(db) as never, ctx);
    assert.equal(revalidated.status, 304, "304 still works");
    assert.ok(revalidated.headers.get("set-cookie")?.startsWith("slseoun_rf=v1.nav"), "304 carries the cookie");

    const head = await mainWorker.fetch(get("/compendium/cards", { method: "HEAD" }), env(db) as never, ctx);
    assert.ok(head.headers.get("set-cookie"), "HEAD carries the cookie");

    const patchPage = await mainWorker.fetch(get("/patches/0.107.1"), env(db) as never, ctx);
    assert.ok(patchPage.headers.get("set-cookie"), "patch pages through the service binding get the cookie");

    const patchScript = await mainWorker.fetch(get("/_patches/patch-nav-indicators.js"), env(db) as never, ctx);
    assert.equal(patchScript.headers.get("set-cookie"), null, "files never get the cookie");

    const qa = await mainWorker.fetch(get("/compendium/cards", { headers: { cookie: "slseoun_rf=v1.nav; slseoun_qa=no-supabase" } }), env(db) as never, ctx);
    assert.equal(qa.headers.get("set-cookie"), "slseoun_rf=; Path=/; Max-Age=0; SameSite=Lax; Secure", "QA cookie clears the flag");

    // The pin must win over D1 (legacy here) with no flag read, so reset the isolate memory first.
    resetAll();
    const legacyDb = new FakeD1();
    legacyDb.flags.set("path.nav", "legacy");
    const pinnedCtx = new Ctx();
    const pinned = await mainWorker.fetch(get("/compendium/cards", { headers: { cookie: "slseoun_qa_path=nav" } }), env(legacyDb) as never, pinnedCtx);
    assert.equal(pinned.headers.get("set-cookie"), "slseoun_rf=v1.nav; Path=/; Max-Age=86400; SameSite=Lax; Secure", "QA pin works on development data");
    await pinnedCtx.drain();
    assert.equal(legacyDb.queries.filter((query) => query === FLAGS_SQL).length, 0, "a pin does not read D1 flags");
    const unpinned = await mainWorker.fetch(get("/compendium/cards"), env(legacyDb) as never, new Ctx());
    assert.equal(unpinned.headers.get("set-cookie"), null, "without the pin, a cold isolate leaves the cookie alone");

    resetAll();
    const prodPin = await mainWorker.fetch(
      get("/compendium/cards", { headers: { cookie: "slseoun_qa_path=nav" } }),
      env(new FakeD1(), { API_DATA_ENV: "production" }) as never,
      new Ctx(),
    );
    assert.equal(prodPin.headers.get("set-cookie"), null, "QA pin is ignored on production data");

    // Turning a group back to legacy clears the cookie once the isolate knows.
    resetAll();
    db.flags.set("path.nav", "legacy");
    const ctx2 = new Ctx();
    await mainWorker.fetch(get("/compendium/cards"), env(db) as never, ctx2);
    await ctx2.drain();
    const cleared = await mainWorker.fetch(get("/compendium/cards", { headers: { cookie: "slseoun_rf=v1.nav" } }), env(db) as never, ctx2);
    assert.equal(cleared.headers.get("set-cookie"), "slseoun_rf=; Path=/; Max-Age=0; SameSite=Lax; Secure");
  }

  // --- Kill switch off: responses are exactly what they were before step 1 ---
  {
    resetAll();
    const db = new FakeD1();
    db.flags.set("path.nav", "api");
    const requests = [
      () => get("/compendium/cards"),
      () => get("/compendium/cards", { headers: { "if-none-match": "\"abc\"" } }),
      () => get("/compendium/cards", { method: "HEAD" }),
      () => get("/patches/0.107.1"),
      () => get("/_patches/patch.css"),
      () => get("/no-such-page"),
      () => get("/compendium/cards", { headers: { cookie: "slseoun_qa_path=nav" } }),
    ];
    for (const make of requests) {
      const baseline = await mainWorker.fetch(make(), { ASSETS: assets(), PATCH_WORKER: patchWorker() } as never, new Ctx());
      const off = await mainWorker.fetch(make(), env(db, { API_RUNTIME_FLAGS: "off" }) as never, new Ctx());
      assert.equal(off.status, baseline.status);
      assert.deepEqual([...off.headers], [...baseline.headers], `headers for ${make().url}`);
      assert.equal(await off.text(), await baseline.text());
    }
    assert.equal(db.queries.length, 0, "no D1 reads while off");
  }

  // --- /api/read/nav -----------------------------------------------------------
  {
    resetAll();
    const db = new FakeD1();
    db.flags.set("path.nav", "api");
    const supabase = stubSupabase(healthySupabase);
    const ctx = new Ctx();

    // First fill waits for its own lease.
    const first = await nav(db, ctx);
    assert.equal(first.status, 200);
    assert.equal(first.headers.get("cache-control"), "public, max-age=30");
    assert.equal(first.headers.get("x-slseoun-api"), "1");
    const body = await first.json();
    assert.equal(body.v, 1);
    assert.equal(body.env, "development");
    assert.equal(body.latest.combo, "2026-11-04T09:12:33.120Z", "ISO normalized to ms and Z");
    assert.equal(body.latest["history-course"], null, "no rows");
    assert.deepEqual(body.weekly, { "colorful-philosophers": "2026-11-02" });
    assert.equal(body.courier.length, 2, "empty thread ids dropped");
    assert.equal([...body.courier[0].text].length, 160, "courier text capped");
    assert.ok(body.courier[0].text.endsWith("…"));
    assert.equal(body.courier[1].text, "bash", "card-con markers reduced like the legacy client");
    assert.equal(supabase.calls.length, 10);
    assert.ok(supabase.peak() <= 5, `at most 5 PostgREST calls in flight (saw ${supabase.peak()})`);
    for (const call of supabase.calls) {
      assert.equal(call.url.searchParams.get("env"), "eq.development", "env pinned by the Worker");
      assert.equal(call.url.origin, PROJECT);
    }
    const tableCall = supabase.calls.find((call) => call.url.pathname.endsWith("/combo_posts"))!;
    assert.equal(tableCall.url.searchParams.get("created_at"), "not.is.null");
    assert.equal(tableCall.url.searchParams.get("order"), "created_at.desc.nullslast");
    await ctx.drain();
    assert.ok(db.cache.get("nav")?.body, "snapshot saved to D1");

    // Within 30 s the isolate answers from memory: no D1, no Supabase.
    const queriesBefore = db.queries.length;
    assert.equal((await nav(db, ctx)).status, 200);
    assert.equal(db.queries.length, queriesBefore);
    assert.equal(supabase.calls.length, 10);

    // A new isolate with a fresh D1 row reads D1 once and does not call Supabase.
    resetAll();
    assert.equal((await nav(db, ctx)).status, 200);
    assert.equal(supabase.calls.length, 10);

    // Stale row (> 60 s): the stale body is served at once and one isolate refreshes.
    db.cache.get("nav")!.fetched_at -= 61_000;
    resetAll();
    const stale = await nav(db, ctx);
    assert.equal(stale.status, 200);
    resetNavForTest();
    resetFlagsForTest();
    await nav(db, ctx); // another isolate while the lease is held
    await ctx.drain();
    assert.equal(supabase.calls.length, 20, "one refresh for two isolates");

    // Partial failure keeps the failed surface's previous value.
    db.cache.get("nav")!.fetched_at -= 61_000;
    const partial = stubSupabase((url) => (url.pathname.endsWith("/combo_posts")
      ? new Response("", { status: 500 })
      : healthySupabase(url)));
    resetAll();
    await nav(db, ctx);
    await ctx.drain();
    assert.equal(partial.calls.length, 10);
    assert.equal(JSON.parse(db.cache.get("nav")!.body).latest.combo, "2026-11-04T09:12:33.120Z", "kept the last good value");
    assert.equal(db.cache.get("nav")!.fail_count, 0, "partial is not a failure");

    // Total failure backs every isolate off together.
    db.cache.get("nav")!.fetched_at -= 61_000;
    const down = stubSupabase(() => new Response("", { status: 503 }));
    resetAll();
    assert.equal((await nav(db, ctx)).status, 200, "stale body still served");
    await ctx.drain();
    assert.equal(down.calls.length, 10);
    assert.equal(db.cache.get("nav")!.fail_count, 1);
    assert.ok(db.cache.get("nav")!.fail_until > Date.now() + 50_000);
    assert.equal(db.cache.get("nav")!.lease_until, 0, "the failed refresh released its lease");
    for (let index = 0; index < 5; index += 1) {
      resetAll();
      await nav(db, ctx);
      await ctx.drain();
    }
    assert.equal(down.calls.length, 10, "no Supabase calls during the backoff");

    // HEAD never calls Supabase.
    db.cache.get("nav")!.fail_until = 0;
    resetAll();
    const head = await nav(db, ctx, { method: "HEAD" });
    assert.equal(head.status, 200);
    assert.equal(head.body, null);
    await ctx.drain();
    assert.equal(down.calls.length, 10);

    // No snapshot and Supabase down: 503, not cacheable.
    const empty = new FakeD1();
    empty.flags.set("path.nav", "api");
    resetAll();
    const unavailable = await nav(empty, new Ctx());
    assert.equal(unavailable.status, 503);
    assert.equal(unavailable.headers.get("cache-control"), "private, no-store");
    assert.equal(unavailable.headers.get("retry-after"), "30");

    // A cached body for another data env is ignored.
    const other = new FakeD1();
    other.flags.set("path.nav", "api");
    other.cache.set("nav", { body: JSON.stringify({ ...body, env: "production" }), fetched_at: Date.now(), lease_until: 0, fail_count: 0, fail_until: 0 });
    stubSupabase(healthySupabase);
    resetAll();
    const refilled = await nav(other, new Ctx());
    assert.equal((await refilled.json()).env, "development");

    // The same bytes with and without Authorization.
    resetAll();
    const withToken = await nav(db, new Ctx(), { headers: { Authorization: "Bearer x.y.z" } });
    resetNavForTest();
    resetFlagsForTest();
    const withoutToken = await nav(db, new Ctx());
    assert.equal(await withToken.text(), await withoutToken.text(), "public reads ignore Authorization");
  }

  // QA pin on /api: dev data only, exact groups, and no-supabase wins.
  {
    const db = new FakeD1();
    db.flags.set("path.nav", "legacy");
    db.cache.set("nav", { body: "", fetched_at: 0, lease_until: 0, fail_count: 0, fail_until: 0 });
    stubSupabase(healthySupabase);
    resetAll();
    const pinned = await nav(db, new Ctx(), { headers: { cookie: "slseoun_qa_path=nav" } });
    assert.equal(pinned.status, 200, "pinned nav served despite D1 legacy");
    assert.equal(db.queries.filter((query) => query === FLAGS_SQL).length, 0);
    resetAll();
    const prod = await nav(db, new Ctx(), { headers: { cookie: "slseoun_qa_path=nav" } }, { API_DATA_ENV: "production" });
    assert.deepEqual(await prod.json(), { error: "surface_legacy", reason: "flag" }, "pin ignored on production data");
    resetAll();
    const other = await nav(db, new Ctx(), { headers: { cookie: "slseoun_qa_path=comments" } });
    assert.deepEqual(await other.json(), { error: "surface_legacy", reason: "flag" }, "pin is per group");
    resetAll();
    const both = await nav(db, new Ctx(), { headers: { cookie: "slseoun_qa_path=nav; slseoun_qa=no-supabase" } });
    assert.deepEqual(await both.json(), { error: "surface_legacy", reason: "qa" });
  }

  // Concurrent flag reads that fail together count as one failure (10 s backoff, not 60 s).
  {
    resetAll();
    const db = new FakeD1();
    db.flags.set("path.nav", "api");
    db.failing = true;
    const ctx = new Ctx();
    await Promise.all([nav(db, ctx), nav(db, ctx), nav(db, ctx)]);
    await ctx.drain();
    db.failing = false;
    stubSupabase(healthySupabase);
    const realNow = Date.now;
    Date.now = () => realNow() + 11_000;
    try {
      const recovered = await nav(db, ctx);
      assert.equal(recovered.status, 200, "one failure, so D1 is retried after 10 s");
    } finally {
      Date.now = realNow;
    }
  }

  // Lease race: an isolate holding an older copy cannot lease a row another isolate just saved.
  {
    resetAll();
    const db = new FakeD1();
    db.flags.set("path.nav", "api");
    const supabase = stubSupabase(healthySupabase);
    const ctx = new Ctx();
    await nav(db, ctx);
    await ctx.drain();
    assert.equal(supabase.calls.length, 10);
    // Isolate A read the row while it was stale; isolate B has since saved a fresh one.
    const row = db.cache.get("nav")!;
    const staleCopy = { ...row, fetched_at: row.fetched_at - 61_000 };
    resetAll();
    const lateStart = await mainWorker.fetch(get("/api/read/nav"), env(db) as never, ctx).then(() => undefined);
    void lateStart;
    await ctx.drain();
    assert.equal(supabase.calls.length, 10, "fresh row: no second refresh");
    // Simulate A's lease attempt with its stale view: the SQL guard refuses it.
    const lease = await db.prepare(NAV_LEASE_SQL).bind("nav", Date.now() + 10_000, Date.now(), Date.now() - 60_000).run();
    assert.equal(lease.meta?.changes, 0, "lease requires a stale row");
    void staleCopy;
    // A writer whose lease is gone cannot overwrite the newer save.
    const save = await db.prepare(NAV_SAVE_SQL).bind("nav", "{}", Date.now(), 12345).run();
    assert.equal(save.meta?.changes, 0, "only the lease holder saves");
  }

  // Freshness bound: /api never uses flags older than FRESH_MS.
  {
    resetAll();
    const db = new FakeD1();
    db.flags.set("path.nav", "api");
    stubSupabase(healthySupabase);
    const ctx = new Ctx();
    await nav(db, ctx);
    await ctx.drain();
    db.flags.set("path.nav", "legacy");
    const realNow = Date.now;
    Date.now = () => realNow() + FRESH_MS + 1;
    try {
      const after = await nav(db, ctx);
      assert.equal(after.status, 409, "rollback reaches /api after the TTL");
    } finally {
      Date.now = realNow;
    }
  }

  globalThis.fetch = realFetch;
  console.log("api-worker spec passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
