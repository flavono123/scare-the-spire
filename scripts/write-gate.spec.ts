/**
 * Step 4 write gate wiring (docs/supabase-exit/STEP4_WRITE_GATE.md 4): the write.<group> flags, the
 * router hook, the uid the gate takes from the router's identity and the service-key requests, against
 * an in-memory Supabase.
 * What Supabase decides is covered by write-gate-equivalence.spec.ts on PGlite.
 * Usage: tsx scripts/write-gate.spec.ts
 */
import assert from "node:assert/strict";

import { API_SURFACE_GROUPS, pathFlagKey } from "../src/lib/api-surfaces";
import { WRITE_FLAG_GROUPS, writeFlagKey } from "../src/lib/api-write-modes";
import type { D1Database, D1PreparedStatement, D1Result } from "../workers/api/d1";
import { FLAGS_SQL, resetFlagsForTest } from "../workers/api/flags";
import { resetJwtCachesForTest } from "../workers/api/jwt";
import { createApiRouter } from "../workers/api/router";
import { commentsRoutes } from "../workers/api/routes/comments";
import { contactRoutes } from "../workers/api/routes/contact";
import { toyboxRoutes } from "../workers/api/routes/toybox";
import { historyRunsRoutes } from "../workers/api/routes/history-runs";
import { D1_WRITE_ROUTES } from "../workers/api/d1-write";
import { jsonWithTextColumn } from "../workers/api/supabase-rest";
import { decideWrite, ownerState, type GateLookups } from "../workers/api/write-gate/decide";
import { supabaseServiceConfig, WORKER_ACTOR_TOKEN, writeActor } from "../workers/api/write-gate/gate";
import { parseWriteFlagRows, resetWriteFlagsForTest, WRITE_FLAGS_SQL, writeModeFor } from "../workers/api/write-flags";

const ORIGIN = "https://testbed.example.workers.dev";
const PROJECT = "http://127.0.0.1:54399";
const ISSUER = `${PROJECT}/auth/v1`;
const USER = "4f1c2a7e-9b3d-4c5e-8f60-1a2b3c4d5e6f";
const OTHER_USER = "9a8b7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d";
const COMMENT = "c1000000-0000-4000-8000-000000000001";

function base64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
const segment = (value: unknown) => base64Url(new TextEncoder().encode(JSON.stringify(value)));

async function makeSigner() {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const publicJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  const jwks = { keys: [{ kty: "EC", crv: "P-256", alg: "ES256", use: "sig", kid: "wiring-kid", x: publicJwk.x, y: publicJwk.y }] };
  async function token(sub = USER) {
    const now = Math.floor(Date.now() / 1000);
    const input = `${segment({ alg: "ES256", kid: "wiring-kid", typ: "JWT" })}.${segment({
      iss: ISSUER, sub, aud: "authenticated", role: "authenticated", exp: now + 3600, iat: now, is_anonymous: true,
    })}`;
    const signature = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, pair.privateKey, new TextEncoder().encode(input)));
    return `${input}.${base64Url(signature)}`;
  }
  return { jwks, token };
}

class FlagsD1 implements D1Database {
  writeRows = new Map<string, string>();
  writeReads = 0;
  failing = false;
  prepare(query: string): D1PreparedStatement {
    const statement: D1PreparedStatement = {
      bind: () => statement,
      all: (async () => {
        if (this.failing) throw new Error("D1 down");
        if (query === FLAGS_SQL) return { success: true, results: API_SURFACE_GROUPS.map((group) => ({ key: pathFlagKey(group), value: "api" })) };
        if (query === WRITE_FLAGS_SQL) {
          this.writeReads += 1;
          return { success: true, results: [...this.writeRows].map(([key, value]) => ({ key, value })) };
        }
        throw new Error(`unexpected SQL: ${query}`);
      }) as D1PreparedStatement["all"],
      first: (async () => null) as D1PreparedStatement["first"],
      run: (async () => ({ success: true, results: [] })) as D1PreparedStatement["run"],
    };
    return statement;
  }
  async batch<T>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
    return Promise.all(statements.map((statement) => statement.all<T>()));
  }
}

type Call = { method: string; path: string; params: [string, string][]; apikey: string | null; authorization: string | null; prefer: string | null; body: unknown };

class FakeSupabase {
  calls: Call[] = [];
  jwks: unknown = { keys: [] };
  async handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/auth/v1/.well-known/jwks.json") return Response.json(this.jwks);
    const text = request.method === "GET" || request.method === "HEAD" ? "" : await request.text();
    this.calls.push({
      method: request.method,
      path: url.pathname.replace("/rest/v1/", ""),
      params: [...url.searchParams],
      apikey: request.headers.get("apikey"),
      authorization: request.headers.get("authorization"),
      prefer: request.headers.get("prefer"),
      body: text ? JSON.parse(text) : undefined,
    });
    if (request.method === "POST" && url.pathname.endsWith("/runs")) {
      const rows = JSON.parse(text) as { id: string }[];
      return Response.json(rows.filter((row) => row.id !== "r-already").map((row) => ({ id: row.id })), { status: 201 });
    }
    if (request.method === "HEAD") return new Response(null, { status: 200, headers: { "content-range": "0-0/1" } });
    if (request.method === "GET") return Response.json([]);
    if (request.method === "POST" && url.pathname.endsWith("/comments")) {
      return Response.json([{ id: COMMENT, story_id: "k", nickname: "닉", content: "hello there", created_at: "2026-11-08T00:00:00Z" }], { status: 201 });
    }
    if (request.method === "DELETE") return Response.json([{ id: COMMENT }]);
    return new Response(null, { status: 201 });
  }
  writes() {
    return this.calls.filter((call) => call.method !== "GET" && call.method !== "HEAD");
  }
}

const ctx = { waitUntil() {} };

async function writeFlagChecks() {
  assert.deepEqual(
    [...parseWriteFlagRows([
      { key: "write.comments", value: "worker" },
      { key: "write.contact", value: "rls" },
      { key: "write.stories", value: "paused" },
      { key: "write.nav", value: "worker" },
      { key: "path.comments", value: "api" },
    ])],
    [["comments", "worker"], ["contact", "rls"]],
    "only known groups and modes count",
  );
  assert.deepEqual(WRITE_FLAG_GROUPS.map(writeFlagKey), ["write.comments", "write.toybox-feed", "write.stories", "write.history-runs", "write.puzzlebox", "write.profile", "write.contact"]);

  const db = new FlagsD1();
  resetWriteFlagsForTest();
  assert.equal(await writeModeFor({ DB: db }, ctx, "comments"), "rls", "no row: rls");
  assert.equal(await writeModeFor({ DB: db, API_WRITE_MODE_DEFAULT: "worker" }, ctx, "comments"), "worker", "no row: the env default");
  assert.equal(await writeModeFor({ DB: db, API_WRITE_MODE_DEFAULT: "WORKER" }, ctx, "comments"), "rls", "the default is exact");
  assert.equal(await writeModeFor({ DB: db, API_WRITE_MODE_DEFAULT: "worker" }, ctx, "nav"), "rls", "groups without writes stay rls");
  assert.equal(db.writeReads, 1, "one read per 30 s");

  resetWriteFlagsForTest();
  db.writeRows.set("write.comments", "worker");
  db.writeRows.set("write.contact", "rls");
  assert.equal(await writeModeFor({ DB: db, API_WRITE_MODE_DEFAULT: "worker" }, ctx, "contact"), "rls", "a row beats the default");
  assert.equal(await writeModeFor({ DB: db }, ctx, "comments"), "worker");
  assert.equal(await writeModeFor({ DB: db }, ctx, "stories"), "rls");
  db.writeRows.set("write.comments", "rls");
  assert.equal(await writeModeFor({ DB: db }, ctx, "comments", Date.now() + 29_000), "worker", "cached for 30 s");
  assert.equal(await writeModeFor({ DB: db }, ctx, "comments", Date.now() + 31_000), "rls", "read again after 30 s");

  resetWriteFlagsForTest();
  db.failing = true;
  assert.equal(await writeModeFor({ DB: db }, ctx, "comments"), "rls", "a failed read: the default");
  assert.equal(await writeModeFor({ DB: db, API_WRITE_MODE_DEFAULT: "worker" }, ctx, "comments"), "worker", "a failed read: the default");
  assert.equal(await writeModeFor({}, ctx, "comments"), "rls", "no D1: the default");
  console.log("write flags: ok");
}

function decisionChecks() {
  const base = { url: PROJECT, key: "sb_publishable_x", dataEnv: "development" as const };
  assert.equal(supabaseServiceConfig({ API_SUPABASE_SECRET_KEY: "sb_secret_abc" }, base)?.key, "sb_secret_abc");
  assert.equal(supabaseServiceConfig({ API_SUPABASE_SECRET_KEY: "sb_publishable_abc" }, base), null, "never a publishable key");
  assert.equal(supabaseServiceConfig({ API_SUPABASE_SECRET_KEY: "eyJhbGciOi.legacy.jwt" }, base), null, "never a legacy JWT key");
  assert.equal(supabaseServiceConfig({}, base), null);

  assert.equal(ownerState(USER, USER), "match");
  assert.equal(ownerState(USER.toUpperCase(), USER), "match");
  assert.equal(ownerState(`{${USER.replace(/-/g, "")}}`, USER), "match", "Postgres uuid input forms");
  assert.equal(ownerState(OTHER_USER, USER), "other");
  assert.equal(ownerState(null, USER), "other", "NULL never equals auth.uid()");
  assert.equal(ownerState(undefined, USER), "other");
  assert.equal(ownerState("nope", USER), "invalid");
  assert.equal(ownerState(`{${USER}`, USER), "invalid", "a brace needs its pair");
  assert.equal(ownerState(`${USER}}`, USER), "invalid", "a brace needs its pair");
  assert.equal(ownerState(USER.replace("-", "--"), USER), "invalid", "one hyphen at a time");
  assert.equal(ownerState(`-${USER}`, USER), "invalid", "no leading hyphen");
  assert.equal(ownerState(`${USER}-`, USER), "invalid", "no trailing hyphen");
  assert.equal(ownerState(`${USER.slice(0, 7)}-${USER.slice(7)}`, USER), "invalid", "hyphens only after a group of four digits");
  assert.equal(ownerState(USER.replace(/-/g, "").replace(/(.{4})/g, "$1-").replace(/-$/, ""), USER), "match", "a hyphen after any group of four digits");
  assert.equal(ownerState(12, USER), "invalid");
}

async function unsupportedChecks() {
  const lookups: GateLookups = {
    rows: async () => assert.fail("no lookup"),
    count: async () => assert.fail("no lookup"),
  };
  const write = (method: "GET" | "POST" | "PATCH" | "DELETE", path: string, body?: unknown, query = new URLSearchParams()) => ({ method, path, query, prefer: [], body });
  for (const [label, request] of [
    ["a read with the user's identity", write("GET", "comments")],
    ["an unknown table", write("POST", "nav_indicators", {})],
    ["an rpc without an actor wrapper", write("POST", "rpc/get_my_profile_activity", {})],
    ["a logical filter", write("DELETE", "comments", undefined, new URLSearchParams({ or: "(id.eq.1)" }))],
    ["a columns parameter", write("POST", "comments", {}, new URLSearchParams({ columns: "id" }))],
    ["an upsert without a resolution", write("POST", "runs", {}, new URLSearchParams({ on_conflict: "id,env" }))],
  ] as const) {
    assert.deepEqual(await decideWrite(request, USER, lookups), { kind: "reject", status: 500, code: "gate_unsupported" }, label);
  }
  const rpc = await decideWrite(write("POST", "rpc/submit_puzzlebox_run", { p_env: "development", p_game: "connections" }), USER, lookups);
  assert.deepEqual(rpc, { kind: "send", write: { ...write("POST", "rpc/worker_submit_puzzlebox_run", { p_env: "development", p_game: "connections", p_actor: USER }) } });
  console.log("gate decisions: ok");
}

async function routerChecks() {
  const supabase = new FakeSupabase();
  const signer = await makeSigner();
  supabase.jwks = signer.jwks;
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: Request | string | URL, init?: RequestInit) => supabase.handle(new Request(input, init))) as typeof fetch;
  resetFlagsForTest();
  resetJwtCachesForTest();

  const db = new FlagsD1();
  const env = { API_RUNTIME_FLAGS: "d1", API_SUPABASE_URL: PROJECT, API_SUPABASE_KEY: "sb_publishable_test", API_DATA_ENV: "development", DB: db };
  const routes = [...commentsRoutes, ...contactRoutes, ...toyboxRoutes];
  const router = createApiRouter(routes);
  const token = await signer.token();
  const otherToken = await signer.token(OTHER_USER);
  const send = (path: string, init: { method: string; body?: unknown; bearer?: string | false }, environment: Record<string, unknown> = env) => {
    const headers: Record<string, string> = { "sec-fetch-site": "same-origin" };
    if (init.bearer !== false) headers.authorization = `Bearer ${init.bearer ?? token}`;
    if (init.body !== undefined) headers["content-type"] = "application/json";
    return router.handle(new Request(`${ORIGIN}${path}`, { method: init.method, headers, body: init.body === undefined ? undefined : JSON.stringify(init.body) }), environment as never, ctx);
  };
  const comment = { threadKey: "sts2-codex:card:BASH", nickname: "닉", content: "hello there" };

  // rls (no write rows, no default): today's request, the user's token.
  resetWriteFlagsForTest();
  assert.equal((await send("/api/write/comments", { method: "POST", body: comment })).status, 201);
  let [write] = supabase.writes();
  assert.equal(write.authorization, `Bearer ${token}`);
  assert.equal(write.apikey, "sb_publishable_test");
  assert.equal((write.body as { user_id: string }).user_id, USER);

  // worker mode without the service key: still rls, and the write flags are not even read.
  supabase.calls = [];
  resetWriteFlagsForTest();
  db.writeRows.set("write.comments", "worker");
  const readsBefore = db.writeReads;
  assert.equal((await send("/api/write/comments", { method: "POST", body: comment })).status, 201);
  assert.equal(supabase.writes()[0].authorization, `Bearer ${token}`, "no service key: the token path");
  assert.equal(db.writeReads, readsBefore, "no service key: no write flag read");

  // worker mode: the service key, no Authorization, the owner from the identity.
  const workerEnv = { ...env, API_SUPABASE_SECRET_KEY: "sb_secret_test" };
  supabase.calls = [];
  const created = await send("/api/write/comments", { method: "POST", body: comment }, workerEnv);
  assert.equal(created.status, 201);
  [write] = supabase.writes();
  assert.equal(write.apikey, "sb_secret_test");
  assert.equal(write.authorization, null, "the user's token is never forwarded");
  assert.equal((write.body as { user_id: string }).user_id, USER);

  supabase.calls = [];
  assert.equal((await send(`/api/write/comments?id=${COMMENT}`, { method: "DELETE" }, workerEnv)).status, 200);
  [write] = supabase.writes();
  assert.deepEqual(write.params.filter(([key]) => key === "user_id"), [["user_id", `eq.${USER}`], ["user_id", `eq.${USER}`]], "the gate adds the owner filter itself");

  // The count after a like is a public read: publishable key, no token, not gated.
  supabase.calls = [];
  assert.equal((await send(`/api/write/comment-likes?id=${COMMENT}`, { method: "PUT" }, workerEnv)).status, 200);
  const head = supabase.calls.find((call) => call.method === "HEAD");
  assert.equal(head?.apikey, "sb_publishable_test");
  assert.equal(head?.authorization, null);

  // The owner is always the identity the router resolved (writeActor), whoever's token it is.
  assert.equal(writeActor({ userId: OTHER_USER }), OTHER_USER);
  supabase.calls = [];
  assert.equal((await send("/api/write/comments", { method: "POST", body: comment, bearer: otherToken }, workerEnv)).status, 201);
  [write] = supabase.writes();
  assert.equal((write.body as { user_id: string }).user_id, OTHER_USER);
  // Neither the user's token nor the placeholder handlers get in worker mode ever leaves the Worker.
  assert.ok(supabase.calls.every((call) => call.authorization === null), "worker mode sends no Authorization at all");
  assert.ok(supabase.calls.every((call) => !JSON.stringify(call).includes(WORKER_ACTOR_TOKEN)));
  // Worker mode still needs an identity: no token or a bad one is refused before anything is sent.
  supabase.calls = [];
  assert.equal((await send("/api/write/comments", { method: "POST", body: comment, bearer: false }, workerEnv)).status, 401, "no identity at all");
  assert.equal((await send("/api/write/comments", { method: "POST", body: comment, bearer: "not.a.token" }, workerEnv)).status, 401, "a bad token");
  assert.equal(supabase.calls.length, 0);

  // Personal reads are not writes: they keep the user's token in worker mode.
  supabase.calls = [];
  db.writeRows.set("write.contact", "worker");
  resetWriteFlagsForTest();
  assert.equal((await send("/api/me/mailbox", { method: "GET" }, workerEnv)).status, 200);
  assert.equal(supabase.calls[0].authorization, `Bearer ${token}`);

  // A passed-through upload that is not JSON: PostgREST's answer, nothing sent.
  supabase.calls = [];
  db.writeRows.set("write.toybox-feed", "worker");
  resetWriteFlagsForTest();
  const garbage = await router.handle(new Request(`${ORIGIN}/api/write/toybox-post?service=combo`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "sec-fetch-site": "same-origin", "content-type": "application/json", "content-length": "5" },
    body: "{oops",
  }), workerEnv as never, ctx);
  assert.equal(garbage.status, 400);
  assert.equal(supabase.writes().length, 0);

  globalThis.fetch = realFetch;
  console.log("router wiring: ok");
}

/** One run per request in worker mode (STEP4_WRITE_GATE 9.5): the batch routes refuse, the share route writes. */
async function historyRunShareChecks() {
  assert.equal(jsonWithTextColumn([{ id: "r1" }], "raw", "{\"a\":\"b\\\"\"}"), "[{\"id\":\"r1\",\"raw\":\"{\\\"a\\\":\\\"b\\\\\\\"\\\"}\"}]");
  assert.equal(jsonWithTextColumn({}, "raw", "x"), "{\"raw\":\"x\"}");
  assert.throws(() => jsonWithTextColumn([{}, {}], "raw", "x"), "one row only");
  assert.throws(() => jsonWithTextColumn({ raw: "y" }, "raw", "x"), "never a second raw key");

  const supabase = new FakeSupabase();
  const signer = await makeSigner();
  supabase.jwks = signer.jwks;
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: Request | string | URL, init?: RequestInit) => supabase.handle(new Request(input, init))) as typeof fetch;
  resetFlagsForTest();
  resetJwtCachesForTest();
  const db = new FlagsD1();
  const env = { API_RUNTIME_FLAGS: "d1", API_SUPABASE_URL: PROJECT, API_SUPABASE_KEY: "sb_publishable_test", API_DATA_ENV: "development", DB: db };
  const workerEnv = { ...env, API_SUPABASE_SECRET_KEY: "sb_secret_test" };
  const router = createApiRouter([...historyRunsRoutes, ...D1_WRITE_ROUTES]);
  const token = await signer.token();
  const raw = JSON.stringify({ seed: "S", players: [{ character: "CHARACTER.IRONCLAD" }], note: "quote \" and \\ and 한글" }, null, 2);
  const row = (overrides: Record<string, unknown> = {}) => ({
    id: "r-share", seed: "S", build: "v0.1", character: "IRONCLAD", ascension: 0, win: true, acts_count: 3, total_floors: 40,
    donor_user_id: USER, donor_nickname: "닉", env: "development", badges: [], cover_spec: null,
    characters: ["IRONCLAD"], game_mode: "standard", game_elements: [], list_facts: {}, summary_version: 1, ...overrides,
  });
  const upload = (path: string, text: string, environment: Record<string, unknown>, headers: Record<string, string> = {}) =>
    router.handle(new Request(`${ORIGIN}${path}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`, "sec-fetch-site": "same-origin", "content-type": "application/json",
        "content-length": String(Buffer.byteLength(text)), ...headers,
      },
      body: text,
    }), environment as never, ctx);
  const share = (rowValue: unknown, environment: Record<string, unknown>, length?: number) => {
    const rowText = JSON.stringify(rowValue);
    return upload("/api/write/history-runs/share", `[${rowText},${raw}]`, environment, { "x-slseoun-row-length": String(length ?? rowText.length) });
  };

  // rls (today): the batch as before; the share route is unavailable, so the client keeps the batch.
  resetWriteFlagsForTest();
  db.writeRows.set("write.history-runs", "rls");
  const rlsShare = await share(row(), workerEnv);
  assert.deepEqual([rlsShare.status, await rlsShare.json()], [409, { error: "single_run_unavailable" }]);
  assert.equal(supabase.writes().length, 0);

  // worker: both step 1 uploads answer single_run_required and send nothing.
  db.writeRows.set("write.history-runs", "worker");
  resetWriteFlagsForTest();
  for (const [path, body] of [["/api/write/history-runs/batch", [{ ...row(), raw }]], ["/api/write/history-runs", { ...row(), raw }]] as const) {
    const refused = await upload(path, JSON.stringify(body), workerEnv);
    assert.deepEqual([refused.status, await refused.json()], [409, { error: "single_run_required" }], path);
  }
  assert.equal(supabase.calls.length, 0, "a refused upload reads and sends nothing");

  // worker: one run, the row decided by the gate, the raw spliced in unparsed, the service key.
  const shared = await share(row(), workerEnv);
  assert.deepEqual([shared.status, await shared.json()], [201, { v: 1, env: "development", inserted: ["r-share"] }]);
  const [write] = supabase.writes();
  assert.equal(write.apikey, "sb_secret_test");
  assert.equal(write.authorization, null, "no user token, no placeholder");
  assert.deepEqual(write.params, [["on_conflict", "id,env"], ["select", "id"]]);
  assert.equal(write.prefer, "resolution=ignore-duplicates,return=representation");
  const sent = (write.body as Record<string, unknown>[])[0];
  assert.equal(sent.raw, raw, "the raw file arrives byte for byte as a string");
  for (const column of ["characters", "game_mode", "game_elements", "list_facts", "summary_version"]) {
    assert.equal(column in sent, false, `${column} is D1's list summary, not a runs column`);
  }
  assert.equal(sent.donor_user_id, USER);

  supabase.calls = [];
  const again = await share(row({ id: "r-already" }), workerEnv);
  assert.deepEqual(await again.json(), { v: 1, env: "development", inserted: [] }, "already shared: nothing inserted");

  supabase.calls = [];
  const forged = await share(row({ donor_user_id: OTHER_USER }), workerEnv);
  assert.equal(forged.status, 403, "another user's run is refused like the batch");
  assert.equal(supabase.writes().length, 0);
  for (const [label, response] of [
    ["a wrong row length", await share(row(), workerEnv, 5)],
    ["a row that is no object", await share(["r-share"], workerEnv)],
  ] as const) {
    assert.equal(response.status, 400, label);
  }
  assert.equal(supabase.writes().length, 0);

  globalThis.fetch = realFetch;
  console.log("history-runs one-run share: ok");
}

async function main() {
  await writeFlagChecks();
  decisionChecks();
  await unsupportedChecks();
  await routerChecks();
  await historyRunShareChecks();
  console.log("write-gate spec passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
