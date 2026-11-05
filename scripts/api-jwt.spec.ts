/**
 * The Worker's Supabase access token check (workers/api/jwt.ts).
 * Usage: tsx scripts/api-jwt.spec.ts
 */
import assert from "node:assert/strict";

import {
  bearerToken,
  parseJwks,
  resetJwtCachesForTest,
  verifySupabaseAccessToken,
} from "../workers/api/jwt";
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

  // Within the 30 s skew an expired token still passes; past it, it fails.
  assert.ok(await verifySupabaseAccessToken(await sign(privateKey, header, claims({ exp: NOW - 10 })), options));
  assert.equal(await verifySupabaseAccessToken(await sign(privateKey, header, claims({ exp: NOW - 31 })), options), null);
  assert.equal(await verifySupabaseAccessToken(await sign(privateKey, header, claims({ exp: "never" })), options), null);
  assert.equal(await verifySupabaseAccessToken(await sign(privateKey, header, claims({ nbf: NOW + 120 })), options), null);

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
  const stranger = await keyPair("test-kid");
  assert.equal(await verifySupabaseAccessToken(await sign(stranger.privateKey, header, claims()), options), null);

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

  // A failing live fetch is retried only after the throttle.
  resetJwtCachesForTest();
  let failing = 0;
  const failingOptions = { ...liveOptions, fetchJwks: async () => { failing += 1; throw new Error("down"); } };
  assert.equal(await verifySupabaseAccessToken(rotatedToken, failingOptions), null);
  assert.equal(await verifySupabaseAccessToken(rotatedToken, failingOptions), null);
  assert.equal(failing, 1, "failed live fetch throttled");

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
