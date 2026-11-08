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

  console.log("api-jwt spec passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
