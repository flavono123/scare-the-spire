/**
 * The Worker's Supabase access token check (workers/api/jwt.ts).
 * Usage: tsx scripts/api-jwt.spec.ts
 */
import assert from "node:assert/strict";

import {
  bearerToken,
  checkSupabaseAccessToken,
  fetchSupabaseJwks,
  parseJwks,
  resetJwtCachesForTest,
  type JwtVerifyOptions,
} from "../workers/api/jwt";

async function verifySupabaseAccessToken(token: string, options: JwtVerifyOptions) {
  const result = await checkSupabaseAccessToken(token, options);
  return result.ok ? result.user : null;
}

async function reason(token: string, options: JwtVerifyOptions) {
  const result = await checkSupabaseAccessToken(token, options);
  return result.ok ? "ok" : result.reason;
}
import { PINNED_SUPABASE_JWKS, type SupabaseJwk } from "../workers/api/supabase-jwks";
import { readFileSync } from "node:fs";
import type { D1Database } from "../workers/api/d1";
import { openD1TestDb } from "./d1-sync/test-db";
import {
  effectiveKeys,
  KEYS_READ_INTERVAL_MS,
  resetVerificationKeysForTest,
  VERIFICATION_KEYS_SQL,
  verificationKeys,
} from "../workers/api/verification-keys";
import {
  addStatements,
  bindLiterals,
  KEY_SQL,
  parseJwkArgument,
  revokeStatements,
  unrevokeStatements,
} from "./lib/verification-key-commands";

/** A D1 stub over node:sqlite with the repo's migrations; counts statements and can fail or stall. */
function keysD1() {
  const sqlite = openD1TestDb();
  const state = { statements: 0, failing: false, delayMs: 0 };
  const db = {
    prepare(query: string) {
      return {
        bind: () => { throw new Error("unused"); },
        first: () => { throw new Error("unused"); },
        run: () => { throw new Error("unused"); },
        async all() {
          state.statements += 1;
          if (state.delayMs) await new Promise((resolve) => setTimeout(resolve, state.delayMs));
          if (state.failing) throw new Error("D1 down");
          return { success: true, results: sqlite.prepare(query).all() as never[] };
        },
      };
    },
    batch: () => { throw new Error("unused"); },
  } as unknown as D1Database;
  return { db, sqlite, state };
}

class KeysCtx {
  pending: Promise<unknown>[] = [];
  waitUntil(promise: Promise<unknown>) {
    this.pending.push(promise);
  }
}

async function verificationKeysSpec(signed: { good: string; jwk: SupabaseJwk }) {
  const compiled = PINNED_SUPABASE_JWKS[0];
  const other: SupabaseJwk = { ...signed.jwk, kid: "added-kid" };
  // Effective set: the compiled-in keys are the seed; rows add keys or revoke kids.
  assert.deepEqual(effectiveKeys(null), { pinned: PINNED_SUPABASE_JWKS, revoked: new Set() }, "no read: compiled-in only");
  assert.deepEqual(effectiveKeys([]), { pinned: PINNED_SUPABASE_JWKS, revoked: new Set() }, "empty table: compiled-in only");
  const mixed = effectiveKeys([
    { kid: compiled.kid, x: compiled.x, y: compiled.y, revoked_at: 1 },
    { kid: other.kid, x: other.x, y: other.y, revoked_at: null },
    { kid: "jwks-only", x: null, y: null, revoked_at: 2 },
    { kid: "broken", x: "short", y: other.y, revoked_at: null },
  ]);
  assert.deepEqual(mixed.pinned, [other], "a revoked compiled-in key is gone, an added key counts, a bad row is skipped");
  assert.deepEqual(mixed.revoked, new Set([compiled.kid, "jwks-only"]));
  assert.deepEqual(effectiveKeys([{ kid: other.kid, x: other.x, y: other.y, revoked_at: null }]).pinned, [other, compiled], "added on top of the seed");

  // A revoked kid is refused before any key lookup, so the live JWKS cannot bring it back.
  resetJwtCachesForTest();
  let fetches = 0;
  const revokedOptions = {
    issuer: ISSUER,
    now: NOW,
    pinnedKeys: [signed.jwk],
    revokedKids: new Set([signed.jwk.kid]),
    fetchJwks: async () => {
      fetches += 1;
      return [signed.jwk];
    },
  };
  assert.equal(await reason(signed.good, revokedOptions), "invalid");
  assert.equal(fetches, 0, "no JWKS fetch for a revoked kid");
  assert.equal(await reason(signed.good, { ...revokedOptions, revokedKids: new Set(["someone-else"]) }), "ok");

  // D1 cadence: one statement per isolate per minute whatever the outcome, waits capped near 1 s.
  resetVerificationKeysForTest();
  const ctx = new KeysCtx();
  const { db, sqlite, state } = keysD1();
  const t0 = 10_000_000;
  assert.deepEqual(await verificationKeys({}, ctx, t0), effectiveKeys(null), "no binding: compiled-in");
  assert.equal(state.statements, 0);
  assert.deepEqual(await verificationKeys({ DB: db }, ctx, t0), effectiveKeys([]), "an empty table: compiled-in");
  assert.equal(state.statements, 1);
  for (const statement of revokeStatements(compiled.kid, "spec", t0, PINNED_SUPABASE_JWKS)) sqlite.exec(statement);
  assert.deepEqual((await verificationKeys({ DB: db }, ctx, t0 + KEYS_READ_INTERVAL_MS - 1)).pinned, PINNED_SUPABASE_JWKS, "within the minute: no read");
  assert.equal(state.statements, 1);
  const afterRevoke = await verificationKeys({ DB: db }, ctx, t0 + KEYS_READ_INTERVAL_MS);
  assert.equal(state.statements, 2);
  assert.deepEqual([afterRevoke.pinned, [...afterRevoke.revoked]], [[], [compiled.kid]], "the revocation is read a minute later");
  state.failing = true;
  const down = await verificationKeys({ DB: db }, ctx, t0 + 2 * KEYS_READ_INTERVAL_MS);
  assert.equal(state.statements, 3);
  assert.deepEqual([...down.revoked], [compiled.kid], "a failed read keeps the last good one");
  await verificationKeys({ DB: db }, ctx, t0 + 2 * KEYS_READ_INTERVAL_MS + 1);
  assert.equal(state.statements, 3, "a failure also waits a minute");
  state.failing = false;
  resetVerificationKeysForTest();
  state.failing = true;
  assert.deepEqual(await verificationKeys({ DB: db }, ctx, t0), effectiveKeys(null), "cold and failing: compiled-in, as today");
  state.failing = false;
  resetVerificationKeysForTest();
  state.delayMs = 1_500;
  const started = Date.now();
  assert.deepEqual(await verificationKeys({ DB: db }, ctx, Date.now()), effectiveKeys(null), "a slow read is not waited for past 1 s");
  assert.ok(Date.now() - started < 1_400, "key wait capped near 1 s");
  const statementsBefore = state.statements;
  assert.deepEqual(await verificationKeys({ DB: db }, ctx, Date.now()), effectiveKeys(null), "later requests do not wait again");
  assert.equal(state.statements, statementsBefore);
  await Promise.allSettled(ctx.pending);
  assert.deepEqual([...(await verificationKeys({ DB: db }, ctx, Date.now())).revoked], [compiled.kid], "the slow read lands for later requests");
  state.delayMs = 0;
  assert.equal(VERIFICATION_KEYS_SQL, queriesSql("K1"));

  // CLI statements: queries.sql K2-K5 with literals, run on the 0007 table.
  for (const [id, sql] of [["K2", KEY_SQL.list], ["K3", KEY_SQL.add], ["K4", KEY_SQL.revoke], ["K5a", KEY_SQL.unrevokeBare], ["K5b", KEY_SQL.unrevoke]] as const) {
    assert.equal(sql.replace(/\s+/g, " "), queriesSql(id), `${id} is the queries.sql statement`);
  }
  assert.equal(bindLiterals("SELECT ?1, ?2, ?3", ["it's", 5, null]), "SELECT 'it''s', 5, NULL");
  assert.throws(() => bindLiterals("SELECT ?2", ["a"]));
  assert.deepEqual(parseJwkArgument(JSON.stringify({ ...other, use: "sig", key_ops: ["verify"] })), { ok: true, key: other });
  for (const bad of ["", "[]", JSON.stringify({ ...other, crv: "P-384" }), JSON.stringify({ ...other, alg: "RS256" }), JSON.stringify({ ...other, x: "x" }), JSON.stringify({ ...other, d: "secret" })]) {
    assert.equal(parseJwkArgument(bad).ok, false, bad);
  }
  const cli = keysD1().sqlite;
  const stored = (kid: string) => cli.prepare(bindLiterals(KEY_SQL.one, [kid])).get() as Record<string, unknown> | undefined;
  for (const statement of addStatements(other, "rotated", 100)) cli.exec(statement);
  assert.throws(() => addStatements(other, "again", 101).forEach((statement) => cli.exec(statement)), "add refuses a known kid");
  for (const statement of revokeStatements(other.kid, "leaked", 200, PINNED_SUPABASE_JWKS)) cli.exec(statement);
  for (const statement of revokeStatements(other.kid, "again", 300, PINNED_SUPABASE_JWKS)) cli.exec(statement);
  assert.deepEqual([stored(other.kid)?.revoked_at, stored(other.kid)?.note], [200, "leaked"], "a second revoke keeps the first time");
  for (const statement of revokeStatements(compiled.kid, "seed", 400, PINNED_SUPABASE_JWKS)) cli.exec(statement);
  assert.deepEqual([stored(compiled.kid)?.x, stored(compiled.kid)?.revoked_at], [compiled.x, 400], "the compiled-in key's row keeps its coordinates");
  for (const statement of revokeStatements("jwks-only", "seen live", 500, PINNED_SUPABASE_JWKS)) cli.exec(statement);
  assert.deepEqual([stored("jwks-only")?.x, stored("jwks-only")?.revoked_at], [null, 500]);
  for (const kid of [other.kid, compiled.kid, "jwks-only"]) for (const statement of unrevokeStatements(kid, "undo")) cli.exec(statement);
  assert.deepEqual([stored(other.kid)?.revoked_at, stored(compiled.kid)?.revoked_at, stored("jwks-only")], [null, null, undefined], "unrevoke restores keys, drops bare rows");
}

/** One statement of queries.sql by id, whitespace collapsed (check.py runs the same text). */
function queriesSql(id: string): string {
  const text = readFileSync("docs/supabase-exit/d1-schema/queries.sql", "utf8");
  const block = text.split(/^-- @ /m).find((part) => part.startsWith(`${id} `));
  assert.ok(block, `queries.sql has ${id}`);
  return block.split("\n").slice(1).filter((line) => !line.startsWith("--")).join("\n").trim().replace(/;$/, "").replace(/\s+/g, " ");
}

const ISSUER = "https://project.supabase.co/auth/v1";
const NOW = 1_800_000_000;
const USER = "4f1c2a7e-9b3d-4c5e-8f60-1a2b3c4d5e6f";

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function jsonSegment(value: unknown): string {
  return base64Url(new TextEncoder().encode(JSON.stringify(value)));
}

async function keyPair(kid: string) {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const publicJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  const jwk: SupabaseJwk = { kty: "EC", crv: "P-256", alg: "ES256", kid, x: publicJwk.x!, y: publicJwk.y! };
  return { privateKey: pair.privateKey, jwk };
}

async function sign(privateKey: CryptoKey, header: Record<string, unknown>, payload: Record<string, unknown>) {
  const signingInput = `${jsonSegment(header)}.${jsonSegment(payload)}`;
  const signature = new Uint8Array(await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    new TextEncoder().encode(signingInput),
  ));
  return `${signingInput}.${base64Url(signature)}`;
}

function claims(overrides: Record<string, unknown> = {}) {
  return {
    iss: ISSUER,
    sub: USER,
    aud: "authenticated",
    role: "authenticated",
    exp: NOW + 3600,
    iat: NOW,
    is_anonymous: true,
    session_id: "11111111-2222-4333-8444-555555555555",
    ...overrides,
  };
}

async function main() {
  const { privateKey, jwk } = await keyPair("test-kid");
  const options = { issuer: ISSUER, now: NOW, pinnedKeys: [jwk] };
  const header = { alg: "ES256", kid: "test-kid", typ: "JWT" };

  resetJwtCachesForTest();
  const good = await sign(privateKey, header, claims());
  assert.deepEqual(
    await verifySupabaseAccessToken(good, options),
    { userId: USER, isAnonymous: true, expiresAt: NOW + 3600 },
    "valid anonymous token",
  );

  // Uppercase uuid is normalized.
  const upper = await sign(privateKey, header, claims({ sub: USER.toUpperCase() }));
  assert.equal((await verifySupabaseAccessToken(upper, options))?.userId, USER);

  // An array audience that includes authenticated is accepted.
  const arrayAud = await sign(privateKey, header, claims({ aud: ["authenticated", "other"] }));
  assert.ok(await verifySupabaseAccessToken(arrayAud, options));

  // Expiry: a token with under 5 s left is "expired" (refresh), not "invalid".
  assert.ok(await verifySupabaseAccessToken(await sign(privateKey, header, claims({ exp: NOW + 6 })), options));
  assert.equal(await reason(await sign(privateKey, header, claims({ exp: NOW + 5 })), options), "expired");
  assert.equal(await reason(await sign(privateKey, header, claims({ exp: NOW - 600 })), options), "expired");
  assert.equal(await reason(await sign(privateKey, header, claims({ exp: "never" })), options), "invalid");
  assert.equal(await reason(await sign(privateKey, header, claims({ nbf: NOW + 120 })), options), "invalid");
  assert.equal(await reason(await sign(privateKey, header, claims({ iat: NOW + 120 })), options), "invalid");
  // An expired token signed by another key is invalid, not expired.
  const forger = await keyPair("test-kid");
  assert.equal(await reason(await sign(forger.privateKey, header, claims({ exp: NOW - 600 })), options), "invalid");

  // Claims that do not match a Supabase user token.
  for (const [label, override] of [
    ["issuer", { iss: "https://other.supabase.co/auth/v1" }],
    ["audience", { aud: "anon" }],
    ["role", { role: "service_role" }],
    ["anon role", { role: "anon" }],
    ["sub", { sub: "not-a-uuid" }],
    ["missing sub", { sub: undefined }],
  ] as const) {
    const token = await sign(privateKey, header, claims(override));
    assert.equal(await verifySupabaseAccessToken(token, options), null, label);
  }

  // Header checks: other algorithms, missing kid, unknown kid without fetch.
  assert.equal(await verifySupabaseAccessToken(await sign(privateKey, { alg: "HS256", kid: "test-kid" }, claims()), options), null);
  assert.equal(await verifySupabaseAccessToken(await sign(privateKey, { alg: "none", kid: "test-kid" }, claims()), options), null);
  assert.equal(await verifySupabaseAccessToken(await sign(privateKey, { alg: "ES256" }, claims()), options), null);
  assert.equal(await verifySupabaseAccessToken(await sign(privateKey, { alg: "ES256", kid: "other" }, claims()), options), null);

  // A token signed by a different key with the same kid fails.
  assert.equal(await verifySupabaseAccessToken(await sign(forger.privateKey, header, claims()), options), null);

  // Tampered payload fails.
  const [h, , s] = good.split(".");
  assert.equal(await verifySupabaseAccessToken(`${h}.${jsonSegment(claims({ sub: "5f1c2a7e-9b3d-4c5e-8f60-1a2b3c4d5e6f" }))}.${s}`, options), null);

  // Malformed input.
  for (const token of ["", "a.b", "a.b.c.d", `${h}.***.${s}`, "x".repeat(9000)]) {
    assert.equal(await verifySupabaseAccessToken(token, options), null, `malformed ${token.slice(0, 12)}`);
  }

  // Unknown kid: one live JWKS fetch, cached; a second unknown kid within a minute does not refetch.
  resetJwtCachesForTest();
  const rotated = await keyPair("rotated-kid");
  let fetches = 0;
  const liveOptions = {
    issuer: ISSUER,
    now: NOW,
    pinnedKeys: [jwk],
    fetchJwks: async () => {
      fetches += 1;
      return [rotated.jwk];
    },
  };
  const rotatedToken = await sign(rotated.privateKey, { alg: "ES256", kid: "rotated-kid" }, claims());
  assert.ok(await verifySupabaseAccessToken(rotatedToken, liveOptions), "rotated key via live JWKS");
  assert.ok(await verifySupabaseAccessToken(rotatedToken, liveOptions), "rotated key from cache");
  assert.equal(await verifySupabaseAccessToken(await sign(rotated.privateKey, { alg: "ES256", kid: "random" }, claims()), liveOptions), null);
  assert.equal(fetches, 1, "live JWKS fetched once");

  // A failing live fetch reports "unavailable" (no client refresh) and is retried only after the cooldown.
  resetJwtCachesForTest();
  let failing = 0;
  const failingOptions = { ...liveOptions, fetchJwks: async () => { failing += 1; throw new Error("down"); } };
  assert.equal(await reason(rotatedToken, failingOptions), "unavailable");
  assert.equal(await reason(rotatedToken, failingOptions), "unavailable");
  assert.equal(failing, 1, "failed live fetch throttled");

  // Claim checks run before any key lookup: a wrong-issuer token with an unknown kid never fetches.
  resetJwtCachesForTest();
  let precheckFetches = 0;
  const precheckOptions = { ...liveOptions, fetchJwks: async () => { precheckFetches += 1; return []; } };
  assert.equal(await reason(await sign(rotated.privateKey, { alg: "ES256", kid: "x1" }, claims({ iss: "https://evil" })), precheckOptions), "invalid");
  assert.equal(await reason(await sign(rotated.privateKey, { alg: "ES256", kid: "x2" }, claims({ role: "anon" })), precheckOptions), "invalid");
  assert.equal(precheckFetches, 0, "no JWKS fetch for tokens that fail claim checks");

  // Concurrent unknown kids share one fetch.
  resetJwtCachesForTest();
  let shared = 0;
  const sharedOptions = {
    ...liveOptions,
    fetchJwks: async () => {
      shared += 1;
      await new Promise((resolve) => setTimeout(resolve, 20));
      return [rotated.jwk];
    },
  };
  const results = await Promise.all([1, 2, 3].map(() => reason(rotatedToken, sharedOptions)));
  assert.deepEqual(results, ["ok", "ok", "ok"]);
  assert.equal(shared, 1, "single-flight JWKS fetch");

  // After the live set goes stale (10 min), a failed refetch means "unavailable", not "invalid",
  // and the 60 s cooldown (not the TTL) limits refetches for random kids.
  {
    resetJwtCachesForTest();
    const realNow = Date.now;
    let clock = realNow();
    Date.now = () => clock;
    try {
      let calls = 0;
      let fail = false;
      const timedOptions = {
        issuer: ISSUER,
        now: NOW,
        pinnedKeys: [jwk],
        fetchJwks: async () => {
          calls += 1;
          if (fail) throw new Error("auth down");
          return [rotated.jwk];
        },
      };
      const freshKid = await keyPair("fresh-kid");
      const freshToken = await sign(freshKid.privateKey, { alg: "ES256", kid: "fresh-kid" }, claims());
      assert.equal(await reason(rotatedToken, timedOptions), "ok");
      assert.equal(calls, 1);
      clock += 11 * 60_000;
      fail = true;
      assert.equal(await reason(freshToken, timedOptions), "unavailable", "stale set and failed refetch");
      assert.equal(calls, 2);
      fail = false;
      clock += 10_000;
      assert.equal(await reason(freshToken, timedOptions), "unavailable", "cooldown holds after a failure");
      assert.equal(calls, 2, "no refetch within the cooldown");
      clock += 61_000;
      assert.equal(await reason(freshToken, timedOptions), "invalid", "refetched set lacks the kid");
      assert.equal(calls, 3);
      assert.equal(await reason(await sign(freshKid.privateKey, { alg: "ES256", kid: "random-2" }, claims()), timedOptions), "invalid");
      assert.equal(calls, 3, "a fresh set answers random kids without fetching");
    } finally {
      Date.now = realNow;
    }
  }

  // A fetch that never settles (its request was cancelled) does not hang later requests.
  {
    resetJwtCachesForTest();
    const hung = { ...liveOptions, fetchJwks: () => new Promise<never>(() => undefined) };
    const started = Date.now();
    assert.equal(await reason(rotatedToken, hung), "unavailable");
    assert.ok(Date.now() - started < 2600, "wait capped near 2 s");
  }

  // fetchSupabaseJwks: timeout-free happy path, size cap, HTTP errors.
  const jwksBody = JSON.stringify({ keys: [rotated.jwk] });
  assert.deepEqual(await fetchSupabaseJwks("https://p.supabase.co/auth/v1", async (url) => {
    assert.equal(url, "https://p.supabase.co/auth/v1/.well-known/jwks.json");
    return new Response(jwksBody);
  }), [rotated.jwk]);
  await assert.rejects(() => fetchSupabaseJwks("https://p.supabase.co/auth/v1", async () => new Response("x".repeat(17_000))));
  await assert.rejects(() => fetchSupabaseJwks("https://p.supabase.co/auth/v1", async () => new Response("", { status: 500 })));

  // The pinned key is a P-256 key that WebCrypto accepts.
  assert.equal(PINNED_SUPABASE_JWKS.length, 1);
  await crypto.subtle.importKey(
    "jwk",
    { kty: "EC", crv: "P-256", x: PINNED_SUPABASE_JWKS[0].x, y: PINNED_SUPABASE_JWKS[0].y, ext: true },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"],
  );

  // JWKS parsing keeps only usable P-256 keys.
  assert.deepEqual(parseJwks({ keys: [{ kty: "RSA", kid: "r" }, { ...rotated.jwk, use: "sig", key_ops: ["verify"] }] }), [rotated.jwk]);
  assert.deepEqual(parseJwks(null), []);

  // Bearer header parsing.
  assert.equal(bearerToken(new Request("https://x.test", { headers: { Authorization: `Bearer ${good}` } })), good);
  assert.equal(bearerToken(new Request("https://x.test", { headers: { Authorization: "Basic abc" } })), null);
  assert.equal(bearerToken(new Request("https://x.test")), null);

  await verificationKeysSpec({ good, jwk });

  console.log("api-jwt spec passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
