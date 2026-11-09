/**
 * Step 4 signed-cookie identity in the Worker (docs/SUPABASE_EXIT_PLAN.md 5.3):
 * the cookie, POST /api/auth/claim (existing and new users against a fake
 * Supabase Auth), request identity resolution behind identity.mode, and the
 * flag-off path staying as today. D1 and Supabase are in-memory stubs.
 * Usage: tsx scripts/api-identity.spec.ts
 */
import assert from "node:assert/strict";

import type { D1Database, D1PreparedStatement, D1Result } from "../workers/api/d1";
import { FLAGS_SQL, resetFlagsForTest } from "../workers/api/flags";
import { jsonResponse } from "../workers/api/http";
import { CLAIM_WINDOW_SECONDS } from "../workers/api/identity/claim";
import { defaultIdentityMode } from "../workers/api/identity/mode";
import {
  IDENTITY_COOKIE_MAX_AGE_SECONDS,
  IDENTITY_COOKIE_RENEW_AFTER_SECONDS,
  identityCookieHeader,
  identityModeCookieHeader,
  identitySecret,
  signIdentityCookie,
  verifyIdentityCookie,
} from "../workers/api/identity/cookie";
import { resetJwtCachesForTest } from "../workers/api/jwt";
import { resetVerificationKeysForTest, VERIFICATION_KEYS_SQL } from "../workers/api/verification-keys";
import { createApiRouter, type ApiRoute, type UserRouteContext } from "../workers/api/router";
import mainWorker from "../workers/main-worker";

const ORIGIN = "https://testbed.example.workers.dev";
const PROJECT = "https://abcdefghijklmnopqrst.supabase.co";
const ISSUER = `${PROJECT}/auth/v1`;
const SECRET = "spec-identity-secret-0123456789abcdef";
const LEGACY_SECRET = "spec-legacy-jwt-secret";
const USER = "4f1c2a7e-9b3d-4c5e-8f60-1a2b3c4d5e6f";
const OTHER = "0a0b0c0d-1111-4222-8333-444455556666";
const NEW_USER = "9d8c7b6a-5f4e-4d3c-8b2a-112233445566";

// --- Token signing ------------------------------------------------------------

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const segment = (value: unknown) => base64Url(new TextEncoder().encode(JSON.stringify(value)));

function claims(overrides: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now() / 1000);
  return {
    iss: ISSUER,
    sub: USER,
    aud: "authenticated",
    role: "authenticated",
    exp: now + 3600,
    iat: now,
    is_anonymous: true,
    ...overrides,
  };
}

async function makeSigner() {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const publicJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  const jwks = { keys: [{ kty: "EC", crv: "P-256", alg: "ES256", use: "sig", kid: "spec-kid", x: publicJwk.x, y: publicJwk.y }] };
  const es256 = async (overrides: Record<string, unknown> = {}) => {
    const input = `${segment({ alg: "ES256", kid: "spec-kid", typ: "JWT" })}.${segment(claims(overrides))}`;
    const signature = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, pair.privateKey, new TextEncoder().encode(input)));
    return `${input}.${base64Url(signature)}`;
  };
  const hs256 = async (secret: string, overrides: Record<string, unknown> = {}) => {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const input = `${segment({ alg: "HS256", typ: "JWT" })}.${segment(claims(overrides))}`;
    const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(input)));
    return `${input}.${base64Url(signature)}`;
  };
  return { jwks, es256, hs256 };
}

// --- Fakes ----------------------------------------------------------------------

class FakeD1 implements D1Database {
  flags = new Map<string, string>();
  /** True: the flags read fails like a D1 outage. */
  failFlags = false;
  queries: string[] = [];
  /** Rows of api_verification_keys; null answers like a database without the table. */
  keys: Record<string, unknown>[] | null = null;

  prepare(query: string): D1PreparedStatement {
    const exec = async (): Promise<D1Result<Record<string, unknown>>> => {
      this.queries.push(query);
      if (query === FLAGS_SQL) {
        if (this.failFlags) throw new Error("D1 unavailable");
        return { success: true, results: [...this.flags].map(([key, value]) => ({ key, value })) };
      }
      if (query === VERIFICATION_KEYS_SQL && this.keys) return { success: true, results: this.keys };
      throw new Error(`unexpected SQL: ${query}`);
    };
    const statement: D1PreparedStatement = {
      bind: () => statement,
      all: exec as D1PreparedStatement["all"],
      first: async () => ((await exec()).results[0] ?? null) as never,
      run: exec as D1PreparedStatement["run"],
    };
    return statement;
  }

  async batch<T>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
    return Promise.all(statements.map((statement) => statement.all<T>()));
  }
}

class Limiter {
  keys: string[] = [];
  allow = true;
  async limit({ key }: { key: string }) {
    this.keys.push(key);
    return { success: this.allow };
  }
}

type SignupMode = "ok" | "http_500" | "http_429" | "network" | "garbage";

class FakeSupabaseAuth {
  jwks: unknown = { keys: [] };
  signupMode: SignupMode = "ok";
  signups: { apikey: string | null; version: string | null; body: unknown }[] = [];
  other: string[] = [];

  async handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.origin === PROJECT && url.pathname === "/auth/v1/.well-known/jwks.json") return Response.json(this.jwks);
    if (url.origin === PROJECT && url.pathname === "/auth/v1/signup" && request.method === "POST") {
      this.signups.push({
        apikey: request.headers.get("apikey"),
        version: request.headers.get("x-supabase-api-version"),
        body: await request.json(),
      });
      if (this.signupMode === "network") throw new TypeError("fetch failed");
      if (this.signupMode === "http_500") return new Response("{}", { status: 500 });
      if (this.signupMode === "http_429") return Response.json({ code: "over_request_rate_limit" }, { status: 429 });
      if (this.signupMode === "garbage") return new Response("not json", { status: 200 });
      const now = Math.floor(Date.now() / 1000);
      return Response.json({
        access_token: "new.access.token",
        token_type: "bearer",
        expires_in: 3600,
        expires_at: now + 3600,
        refresh_token: "new-refresh",
        user: { id: NEW_USER, aud: "authenticated", role: "authenticated", is_anonymous: true },
      });
    }
    this.other.push(`${request.method} ${url.pathname}`);
    return new Response("unexpected", { status: 599 });
  }
}

const ctx = { waitUntil() {} };

function cookiesOf(response: Response): string[] {
  return response.headers.getSetCookie();
}

function cookieValue(response: Response, name: string): string | null {
  const header = cookiesOf(response).find((cookie) => cookie.startsWith(`${name}=`));
  return header ? header.slice(name.length + 1).split(";")[0] : null;
}

async function main() {
  const realFetch = globalThis.fetch;
  const auth = new FakeSupabaseAuth();
  const signer = await makeSigner();
  auth.jwks = signer.jwks;
  globalThis.fetch = (async (input: Request | string | URL, init?: RequestInit) => auth.handle(new Request(input, init))) as typeof fetch;
  const now = () => Math.floor(Date.now() / 1000);

  // --- 1. Cookie sign / verify / expiry / tamper ---------------------------------
  {
    const t = 1_800_000_000;
    const value = await signIdentityCookie(SECRET, USER.toUpperCase(), t);
    assert.match(value, /^v1\.[0-9a-f-]{36}\.\d+\.[A-Za-z0-9_-]{43}$/);
    assert.deepEqual(await verifyIdentityCookie(SECRET, value, t), {
      ok: true, uid: USER, issuedAt: t, expiresAt: t + IDENTITY_COOKIE_MAX_AGE_SECONDS, renew: false,
    }, "uid is stored lower case");

    const [version, uid, issued, signature] = value.split(".");
    const flip = (text: string, index: number) => text.slice(0, index) + (text[index] === "a" ? "b" : "a") + text.slice(index + 1);
    assert.deepEqual(await verifyIdentityCookie(SECRET, [version, OTHER, issued, signature].join("."), t), { ok: false, reason: "bad_signature" }, "other uid");
    assert.deepEqual(await verifyIdentityCookie(SECRET, [version, uid, String(t + 1), signature].join("."), t), { ok: false, reason: "bad_signature" }, "other issue time");
    assert.deepEqual(await verifyIdentityCookie(SECRET, [version, uid, issued, flip(signature, 5)].join("."), t), { ok: false, reason: "bad_signature" }, "flipped signature");
    assert.deepEqual(await verifyIdentityCookie(`${SECRET}x`, value, t), { ok: false, reason: "bad_signature" }, "other secret");
    assert.deepEqual(await verifyIdentityCookie(SECRET, null, t), { ok: false, reason: "missing" });
    for (const bad of ["", "garbage", `v2.${uid}.${issued}.${signature}`, `v1.${uid.toUpperCase()}.${issued}.${signature}`, `v1.${uid}.-1.${signature}`, `v1.${uid}.${issued}.${signature}.x`, `v1.${uid}.${issued}.${signature.slice(0, 20)}`]) {
      const result = await verifyIdentityCookie(SECRET, bad, t);
      assert.equal(result.ok, false, bad);
    }

    const renewAt = t + IDENTITY_COOKIE_RENEW_AFTER_SECONDS;
    assert.equal((await verifyIdentityCookie(SECRET, value, renewAt - 1) as { renew: boolean }).renew, false);
    assert.equal((await verifyIdentityCookie(SECRET, value, renewAt) as { renew: boolean }).renew, true, "renewed after 7 days");
    assert.equal((await verifyIdentityCookie(SECRET, value, t + IDENTITY_COOKIE_MAX_AGE_SECONDS - 1)).ok, true);
    assert.deepEqual(await verifyIdentityCookie(SECRET, value, t + IDENTITY_COOKIE_MAX_AGE_SECONDS), { ok: false, reason: "expired" }, "400 days");
    assert.equal((await verifyIdentityCookie(SECRET, await signIdentityCookie(SECRET, USER, t + 299), t)).ok, true, "clock skew");
    assert.deepEqual(await verifyIdentityCookie(SECRET, await signIdentityCookie(SECRET, USER, t + 301), t), { ok: false, reason: "expired" }, "issued in the future");
    await assert.rejects(() => signIdentityCookie(SECRET, "not-a-uuid", t));

    assert.equal(identitySecret({}), null);
    assert.equal(identitySecret({ API_IDENTITY_SECRET: "short" }), null, "a short secret keeps identity on tokens");
    assert.equal(identitySecret({ API_IDENTITY_SECRET: SECRET }), SECRET);

    assert.equal(identityCookieHeader("v", true), `slseoun_id=v; Path=/api/; Max-Age=${IDENTITY_COOKIE_MAX_AGE_SECONDS}; HttpOnly; SameSite=Lax; Secure`);
    assert.equal(identityCookieHeader("v", false), `slseoun_id=v; Path=/api/; Max-Age=${IDENTITY_COOKIE_MAX_AGE_SECONDS}; HttpOnly; SameSite=Lax`);
    assert.equal(identityModeCookieHeader(null, "cookie", true), "slseoun_idm=cookie; Max-Age=86400; Path=/; SameSite=Lax; Secure");
    assert.equal(identityModeCookieHeader("cookie", "cookie", true), null, "unchanged signal is not resent");
    assert.equal(identityModeCookieHeader(null, "token", true), null, "token mode adds nothing");
    assert.equal(identityModeCookieHeader("cookie", "token", false), "slseoun_idm=; Max-Age=0; Path=/; SameSite=Lax");
  }

  // --- Shared env ---------------------------------------------------------------
  const db = new FakeD1();
  const writeLimiter = new Limiter();
  const baseEnv = {
    API_RUNTIME_FLAGS: "d1",
    API_SUPABASE_URL: PROJECT,
    API_SUPABASE_KEY: "sb_publishable_test",
    API_DATA_ENV: "development",
    DB: db,
    API_WRITE_LIMITER: writeLimiter,
    API_IDENTITY_SECRET: SECRET,
    ASSETS: { fetch: async () => new Response("<!DOCTYPE html><html><head></head><body>page</body></html>", { headers: { "content-type": "text/html; charset=utf-8" } }) },
    PATCH_WORKER: { fetch: async () => new Response("patch") },
  };
  const setMode = (mode: string | null) => {
    if (mode === null) db.flags.delete("identity.mode");
    else db.flags.set("identity.mode", mode);
    db.flags.set("path.comments", "api");
    resetFlagsForTest();
  };
  const claimRequest = (body: unknown, headers: Record<string, string> = {}) => new Request(`${ORIGIN}/api/auth/claim`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: ORIGIN, "sec-fetch-site": "same-origin", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  const claim = async (body: unknown, headers: Record<string, string> = {}, env: Record<string, unknown> = baseEnv) => {
    const response = await mainWorker.fetch(claimRequest(body, headers), env as never, ctx);
    return { response, status: response.status, body: await response.json() as Record<string, unknown> };
  };
  const cookieUid = async (response: Response) => {
    const result = await verifyIdentityCookie(SECRET, cookieValue(response, "slseoun_id"), now());
    return result.ok ? result.uid : null;
  };

  // --- 2. Claim: existing users ---------------------------------------------------
  setMode("cookie");
  resetJwtCachesForTest();
  {
    const token = await signer.es256();
    const first = await claim({ access_token: token });
    assert.equal(first.status, 200);
    assert.deepEqual(first.body, { v: 1, uid: USER, created: false, session: null });
    assert.equal(await cookieUid(first.response), USER, "cookie carries the token's uid");
    assert.equal(first.response.headers.get("cache-control"), "private, no-store");
    assert.equal(first.response.headers.get("x-slseoun-api"), "1");
    const setCookies = cookiesOf(first.response);
    assert.ok(setCookies.some((cookie) => /^slseoun_id=[^;]+; Path=\/api\/; Max-Age=\d+; HttpOnly; SameSite=Lax; Secure$/.test(cookie)), "HttpOnly Lax Secure, /api only");
    assert.ok(setCookies.includes("slseoun_idm=cookie; Max-Age=86400; Path=/; SameSite=Lax; Secure"));
    assert.ok(first.response.headers.get("content-security-policy-report-only"), "security headers like every router answer");

    const again = await claim({ access_token: token }, { cookie: `slseoun_id=${cookieValue(first.response, "slseoun_id")}; slseoun_idm=cookie` });
    assert.equal(again.status, 200);
    assert.equal(again.body.uid, USER, "claiming again is idempotent");
    assert.equal(await cookieUid(again.response), USER);
    assert.equal(cookieValue(again.response, "slseoun_idm"), null, "signal already set");

    const expired = await claim({ access_token: await signer.es256({ exp: now() - 3600, iat: now() - 7200 }) });
    assert.equal(expired.status, 200, "expiry is ignored (plan 5.3)");
    assert.equal(expired.body.uid, USER);

    const pastWindow = await claim({ access_token: await signer.es256({ exp: now() - CLAIM_WINDOW_SECONDS - 60, iat: now() - CLAIM_WINDOW_SECONDS - 3660 }) });
    assert.deepEqual([pastWindow.status, pastWindow.body.error], [401, "token_invalid"], "claim deadline: 180 days after exp");
    assert.equal(cookiesOf(pastWindow.response).length, 0);

    const wrongIssuer = await claim({ access_token: await signer.es256({ iss: "https://zzzzzzzzzzzzzzzzzzzz.supabase.co/auth/v1" }) });
    assert.deepEqual([wrongIssuer.status, wrongIssuer.body.error], [401, "token_invalid"], "wrong issuer");
    assert.equal(cookiesOf(wrongIssuer.response).length, 0, "no cookie on a refused claim");

    const tampered = token.slice(0, -4) + (token.endsWith("AAAA") ? "BBBB" : "AAAA");
    assert.deepEqual([(await claim({ access_token: tampered })).status], [401], "bad signature");
    const otherSub = await signer.es256({ sub: OTHER });
    const forged = `${otherSub.split(".").slice(0, 2).join(".")}.${token.split(".")[2]}`;
    assert.equal((await claim({ access_token: forged })).status, 401, "signature of another payload");
    assert.equal((await claim({ access_token: await signer.es256({ role: "anon" }) })).status, 401);
    const notAnonymous = await claim({ access_token: await signer.es256({ is_anonymous: false }) });
    assert.deepEqual([notAnonymous.status, notAnonymous.body.error], [403, "forbidden"], "only anonymous identities are claimed");

    const legacyToken = await signer.hs256(LEGACY_SECRET, { exp: now() - 86_400 });
    const legacyRefused = await claim({ access_token: legacyToken });
    assert.equal(legacyRefused.status, 401, "HS256 without the legacy secret");
    const legacyEnv = { ...baseEnv, API_SUPABASE_LEGACY_JWT_SECRET: LEGACY_SECRET };
    const legacyClaim = await claim({ access_token: legacyToken }, {}, legacyEnv);
    assert.deepEqual([legacyClaim.status, legacyClaim.body.uid], [200, USER], "HS256 with the legacy secret");
    assert.equal((await claim({ access_token: await signer.hs256("wrong-secret") }, {}, legacyEnv)).status, 401);

    // Request checks.
    assert.deepEqual([(await claim({ access_token: token }, { "sec-fetch-site": "cross-site" })).body.error], ["cross_site"]);
    assert.deepEqual([(await claim({ access_token: token }, { origin: "https://evil.example" })).body.error], ["cross_site"]);
    const get = await mainWorker.fetch(new Request(`${ORIGIN}/api/auth/claim`), baseEnv as never, ctx);
    assert.deepEqual([get.status, get.headers.get("allow")], [405, "OPTIONS, POST"]);
    const options = await mainWorker.fetch(new Request(`${ORIGIN}/api/auth/claim`, { method: "OPTIONS" }), baseEnv as never, ctx);
    assert.equal(options.status, 204);
    assert.equal((await claim({ access_token: token }, { "content-type": "text/plain" })).body.error, "invalid");
    assert.equal((await claim({ access_token: token, uid: OTHER })).body.error, "invalid", "only access_token is accepted");
    assert.equal((await claim({ access_token: 1 })).body.error, "invalid");
    assert.equal((await claim("[]")).body.error, "invalid");
    assert.equal((await claim("{")).body.error, "invalid");
    assert.equal((await claim({ access_token: "x".repeat(10_000) })).status, 413);

    writeLimiter.keys.length = 0;
    writeLimiter.allow = false;
    const limited = await claim({ access_token: token }, { "cf-connecting-ip": "203.0.113.9" });
    assert.deepEqual([limited.status, limited.response.headers.get("retry-after")], [429, "30"]);
    assert.deepEqual(writeLimiter.keys, ["user:claim:203.0.113.9"], "counted per client IP");
    writeLimiter.allow = true;
  }

  // --- 3. Claim: new users against a fake Supabase Auth ----------------------------
  {
    auth.signups.length = 0;
    auth.signupMode = "ok";
    const created = await claim({});
    assert.equal(created.status, 200);
    assert.equal(created.body.uid, NEW_USER);
    assert.equal(created.body.created, true);
    const session = created.body.session as Record<string, unknown>;
    assert.equal(session.access_token, "new.access.token");
    assert.equal(session.refresh_token, "new-refresh");
    assert.equal((session.user as { id: string }).id, NEW_USER, "supabase-js gets the same uid");
    assert.equal(await cookieUid(created.response), NEW_USER, "cookie and Supabase hold the same uid");
    assert.equal(auth.signups.length, 1);
    assert.deepEqual(auth.signups[0], {
      apikey: "sb_publishable_test",
      version: "2024-01-01",
      body: { data: {}, gotrue_meta_security: {} },
    }, "the same request supabase-js signInAnonymously sends");

    const kept = await claim({}, { cookie: `slseoun_id=${cookieValue(created.response, "slseoun_id")}` });
    assert.deepEqual([kept.status, kept.body.uid, kept.body.created, kept.body.session], [200, NEW_USER, false, null], "a valid cookie is kept");
    assert.equal(auth.signups.length, 1, "no second sign-up");

    const bad = await claim({}, { cookie: "slseoun_id=v1.garbage" });
    assert.equal(bad.body.uid, NEW_USER, "an invalid cookie means a new user");
    assert.equal(auth.signups.length, 2);

    // A failed sign-up is a failed sign-in as today: 503, no Worker-made uid, no cookie.
    for (const mode of ["http_500", "http_429", "network", "garbage"] as const) {
      auth.signupMode = mode;
      const failed = await claim({});
      assert.deepEqual([failed.status, failed.body], [503, { error: "auth_unavailable" }], mode);
      assert.equal(cookieValue(failed.response, "slseoun_id"), null, `${mode}: no identity cookie`);
      assert.equal(failed.response.headers.get("x-slseoun-api"), "1", `${mode}: a router answer, not a legacy signal`);
    }
    auth.signupMode = "ok";
  }

  // --- 4. Claim is inert unless every switch is on ----------------------------------
  {
    const token = await signer.es256();
    setMode(null);
    assert.deepEqual((await claim({ access_token: token })).body, { error: "surface_legacy", reason: "flag" }, "identity.mode defaults to token");
    setMode("token");
    assert.deepEqual((await claim({ access_token: token })).body, { error: "surface_legacy", reason: "flag" });
    setMode("bogus");
    assert.equal((await claim({ access_token: token })).body.reason, "flag", "unknown values mean token");
    setMode("cookie");
    const noSecret = { ...baseEnv, API_IDENTITY_SECRET: undefined };
    assert.equal((await claim({ access_token: token }, {}, noSecret)).body.reason, "not_configured");
    assert.equal((await claim({ access_token: token }, {}, { ...baseEnv, API_IDENTITY_SECRET: "short" })).body.reason, "not_configured");
    assert.equal((await claim({ access_token: token }, { cookie: "slseoun_qa=no-supabase" })).body.reason, "qa");
    const production = { ...baseEnv, API_RUNTIME_FLAGS: "off", API_DATA_ENV: "production" };
    const off = await claim({}, {}, production);
    assert.deepEqual([off.status, off.body.reason], [409, "off"], "production (flags off) never claims");
    assert.equal(cookiesOf(off.response).length, 0);
    assert.equal(auth.signups.length, 6, "no sign-up while inert");
  }

  // --- 4b. API_IDENTITY_MODE_DEFAULT: a missing row or a failed read (STEP6_PLAN P12) ---
  {
    assert.equal(defaultIdentityMode({}), "token", "unset: token, as before step 6");
    assert.equal(defaultIdentityMode({ API_IDENTITY_MODE_DEFAULT: "cookie" }), "cookie");
    assert.equal(defaultIdentityMode({ API_IDENTITY_MODE_DEFAULT: "Cookie" }), "token", "exactly cookie");
    const token = await signer.es256();
    const cookieDefault = { ...baseEnv, API_IDENTITY_MODE_DEFAULT: "cookie" };
    setMode(null);
    assert.equal((await claim({ access_token: token }, {}, cookieDefault)).status, 200, "no row: the env default");
    setMode("bogus");
    assert.equal((await claim({ access_token: token }, {}, cookieDefault)).status, 200, "a value that is neither mode: the env default");
    setMode("token");
    assert.equal((await claim({ access_token: token }, {}, cookieDefault)).body.reason, "flag", "a token row still wins over the default");
    setMode("cookie");
    assert.equal((await claim({ access_token: token }, {}, { ...cookieDefault, API_IDENTITY_SECRET: undefined })).body.reason, "not_configured", "no secret: token whatever the default");
    assert.equal((await claim({ access_token: token }, { cookie: "slseoun_qa=no-supabase" }, cookieDefault)).body.reason, "qa", "QA no-supabase: token whatever the default");
    assert.equal((await claim({}, {}, { ...cookieDefault, API_RUNTIME_FLAGS: "off" })).body.reason, "off", "kill switch: token whatever the default");

    db.failFlags = true;
    resetFlagsForTest();
    assert.equal((await claim({ access_token: token })).body.reason, "flag", "a failed read without the default: token");
    resetFlagsForTest();
    assert.equal((await claim({ access_token: token }, {}, cookieDefault)).status, 200, "a failed read: the env default");
    db.failFlags = false;
    setMode("cookie");
    assert.equal(auth.signups.length, 6, "token claims sign nobody up");
  }

  // --- 5. Request identity resolution (router) --------------------------------------
  const echo = async (context: UserRouteContext) => jsonResponse({ uid: context.user.userId, token: context.token, source: context.identitySource });
  const routes: ApiRoute[] = [
    { id: "spec.write", path: "/api/write/spec-echo", group: "comments", method: "POST", access: "write", handle: echo },
    { id: "spec.me", path: "/api/me/spec-echo", group: "comments", method: "GET", access: "me", rateLimit: "none", handle: echo },
  ];
  const router = createApiRouter(routes);
  const call = async (path: string, headers: Record<string, string> = {}, env: Record<string, unknown> = baseEnv) => {
    const response = await router.handle(new Request(`${ORIGIN}${path}`, {
      method: path.includes("/write/") ? "POST" : "GET",
      headers: { origin: ORIGIN, ...headers },
    }), env as never, ctx);
    return { response, status: response.status, body: await response.json() as Record<string, unknown> };
  };
  const goodCookie = `slseoun_id=${await signIdentityCookie(SECRET, USER)}`;
  {
    // Token mode: the step 1 path, the cookie ignored.
    setMode(null);
    const token = await signer.es256();
    const viaToken = await call("/api/write/spec-echo", { authorization: `Bearer ${token}`, cookie: `slseoun_id=${await signIdentityCookie(SECRET, OTHER)}` });
    assert.deepEqual([viaToken.status, viaToken.body], [200, { uid: USER, token, source: "token" }]);
    assert.equal(cookiesOf(viaToken.response).length, 0, "token mode adds no cookie");
    assert.deepEqual((await call("/api/write/spec-echo", { cookie: goodCookie })).body, { error: "token_invalid" }, "a cookie alone is not an identity in token mode");
    assert.deepEqual((await call("/api/write/spec-echo", { authorization: `Bearer ${await signer.es256({ exp: now() - 60 })}` })).body, { error: "token_expired" });
    const stale = await call("/api/write/spec-echo", { authorization: `Bearer ${token}`, cookie: "slseoun_idm=cookie" });
    assert.ok(cookiesOf(stale.response).includes("slseoun_idm=; Max-Age=0; Path=/; SameSite=Lax; Secure"), "a rollback clears the signal on the next call");
    const staleRefused = await call("/api/write/spec-echo", { cookie: "slseoun_idm=cookie" });
    assert.deepEqual([staleRefused.status, staleRefused.body.error], [401, "token_invalid"]);
    assert.equal(cookiesOf(staleRefused.response).length, 1, "the refusal clears the signal too, so the browser goes back to tokens");

    // Cookie mode wanted but no secret: still the token path.
    setMode("cookie");
    assert.deepEqual((await call("/api/write/spec-echo", { cookie: goodCookie }, { ...baseEnv, API_IDENTITY_SECRET: undefined })).body, { error: "token_invalid" });
    assert.equal((await call("/api/write/spec-echo", { authorization: `Bearer ${token}` }, { ...baseEnv, API_IDENTITY_SECRET: undefined })).body.source, "token");

    // Cookie mode.
    writeLimiter.keys.length = 0;
    const viaCookie = await call("/api/write/spec-echo", { cookie: goodCookie });
    assert.deepEqual([viaCookie.status, viaCookie.body], [200, { uid: USER, token: "", source: "cookie" }], "no bearer token needed");
    assert.deepEqual(writeLimiter.keys, [`user:${USER}`], "rate limit counts the cookie's uid");
    assert.ok(cookiesOf(viaCookie.response).includes("slseoun_idm=cookie; Max-Age=86400; Path=/; SameSite=Lax; Secure"));
    assert.equal(cookieValue(viaCookie.response, "slseoun_id"), null, "a fresh cookie is not re-issued");
    const sameToken = await call("/api/me/spec-echo", { cookie: goodCookie, authorization: `Bearer ${token}` });
    assert.deepEqual(sameToken.body, { uid: USER, token, source: "cookie" }, "an old tab's token for the same uid is handed on");
    const otherToken = await call("/api/me/spec-echo", { cookie: goodCookie, authorization: `Bearer ${await signer.es256({ sub: OTHER })}` });
    assert.deepEqual(otherToken.body, { uid: USER, token: "", source: "cookie" }, "the cookie wins; another uid's token is dropped");
    // No cookie yet (no signal on the page, or JS from before step 4): the bearer token still names the user.
    const unclaimed = await call("/api/write/spec-echo", { authorization: `Bearer ${token}` });
    assert.deepEqual([unclaimed.status, unclaimed.body], [200, { uid: USER, token, source: "token" }], "an unclaimed tab keeps writing with its token");
    assert.ok(cookiesOf(unclaimed.response).some((cookie) => cookie.startsWith("slseoun_idm=cookie")), "and is told to claim");
    assert.equal(cookieValue(unclaimed.response, "slseoun_id"), null, "a bearer call issues no identity cookie");
    const unclaimedExpired = await call("/api/write/spec-echo", { authorization: `Bearer ${await signer.es256({ exp: now() - 60 })}` });
    assert.deepEqual([unclaimedExpired.status, unclaimedExpired.body.error], [401, "token_expired"], "an expired token is refreshed as today");
    assert.equal((await call("/api/write/spec-echo", { authorization: "Bearer x.y.z" })).body.error, "token_invalid");
    // The legacy HS256 secret and the ignored expiry are for claims only: a bearer is checked as in step 1.
    const withLegacy = { ...baseEnv, API_SUPABASE_LEGACY_JWT_SECRET: LEGACY_SECRET };
    for (const mode of ["token", "cookie"]) {
      setMode(mode);
      const hs256Bearer = await call("/api/write/spec-echo", { authorization: `Bearer ${await signer.hs256(LEGACY_SECRET)}` }, withLegacy);
      assert.deepEqual([hs256Bearer.status, hs256Bearer.body.error], [401, "token_invalid"], `${mode} mode: an HS256 bearer is refused as today`);
    }
    setMode("cookie");
    assert.equal((await call("/api/write/spec-echo", { cookie: "slseoun_id=v1.garbage", authorization: `Bearer ${token}` })).body.source, "token", "a bad cookie falls back to the token too");
    setMode(null);
    assert.deepEqual((await call("/api/write/spec-echo", { cookie: goodCookie }, { ...baseEnv, API_IDENTITY_MODE_DEFAULT: "cookie" })).body, { uid: USER, token: "", source: "cookie" }, "no row with the cookie default: the cookie names the user");
    setMode("cookie");
    const missing = await call("/api/write/spec-echo");
    assert.deepEqual([missing.status, missing.body.error], [401, "identity_required"], "neither cookie nor token");
    assert.ok(cookiesOf(missing.response).some((cookie) => cookie.startsWith("slseoun_idm=cookie")));
    const tampered = goodCookie.replace(USER, OTHER);
    assert.equal((await call("/api/write/spec-echo", { cookie: tampered })).body.error, "identity_required");
    const old = `slseoun_id=${await signIdentityCookie(SECRET, USER, now() - IDENTITY_COOKIE_RENEW_AFTER_SECONDS - 10)}`;
    const renewed = await call("/api/me/spec-echo", { cookie: old });
    assert.equal(renewed.body.uid, USER);
    const renewedCookie = await verifyIdentityCookie(SECRET, cookieValue(renewed.response, "slseoun_id"), now());
    assert.ok(renewedCookie.ok && renewedCookie.uid === USER && !renewedCookie.renew, "an old cookie is re-issued");
    const expired = `slseoun_id=${await signIdentityCookie(SECRET, USER, now() - IDENTITY_COOKIE_MAX_AGE_SECONDS - 10)}`;
    assert.equal((await call("/api/me/spec-echo", { cookie: expired })).body.error, "identity_required");
    assert.equal((await call("/api/write/spec-echo", { cookie: goodCookie, "sec-fetch-site": "cross-site" })).body.error, "cross_site", "cross-site writes are refused before identity");
    assert.equal((await call("/api/write/spec-echo", { cookie: `${goodCookie}; slseoun_qa=no-supabase` })).body.reason, "qa");
  }

  // --- 5b. Revoked signing keys (D1 api_verification_keys, STEP1_DESIGN 6) ----------------
  {
    setMode("cookie");
    const token = await signer.es256();
    const revokeSpecKid = (revoked: boolean) => {
      // A revocation of a kid only the live JWKS has (no coordinates), or an empty table.
      db.keys = revoked ? [{ kid: "spec-kid", x: null, y: null, revoked_at: 1 }] : [];
      resetVerificationKeysForTest();
      resetJwtCachesForTest();
    };
    revokeSpecKid(true);
    const refused = await claim({ access_token: token });
    assert.deepEqual([refused.status, refused.body.error], [401, "token_invalid"], "a revoked kid cannot claim, though the live JWKS lists it");
    assert.equal(cookiesOf(refused.response).filter((cookie) => cookie.startsWith("slseoun_id=")).length, 0);
    const bearer = await call("/api/write/spec-echo", { authorization: `Bearer ${token}` });
    assert.deepEqual(bearer.body, { error: "token_invalid" }, "nor name a user by bearer token");
    assert.deepEqual((await call("/api/write/spec-echo", { cookie: goodCookie })).body, { uid: USER, token: "", source: "cookie" }, "a claimed cookie is not a token");
    revokeSpecKid(false);
    assert.equal((await claim({ access_token: token })).status, 200, "an empty table: today's keys");
    db.keys = null;
    resetVerificationKeysForTest();
    assert.equal((await claim({ access_token: token })).status, 200, "no table (D1 error): today's keys");
  }

  // --- 6. Flag off: production is unchanged --------------------------------------------
  {
    setMode("cookie");
    const production = { ...baseEnv, API_RUNTIME_FLAGS: "off", API_DATA_ENV: "production" };
    const write = await call("/api/write/spec-echo", { cookie: goodCookie }, production);
    assert.deepEqual([write.status, write.body], [409, { error: "surface_legacy", reason: "off" }]);
    assert.equal(cookiesOf(write.response).length, 0);
    const page = await mainWorker.fetch(new Request(`${ORIGIN}/compendium/cards`, { headers: { cookie: goodCookie } }), production as never, ctx);
    assert.equal(page.status, 200);
    assert.equal(cookiesOf(page).length, 0, "flags off: pages set no cookie at all");
    const queriesBefore = db.queries.length;
    await mainWorker.fetch(new Request(`${ORIGIN}/compendium/cards`), production as never, ctx);
    assert.equal(db.queries.length, queriesBefore, "flags off: D1 is not read");
    assert.equal((await claim({}, {}, production)).status, 409);
    assert.ok(auth.other.length === 0, `no unexpected Supabase calls: ${auth.other.join(", ")}`);
  }

  // --- 7. Page responses signal the mode --------------------------------------------
  {
    setMode("cookie");
    const pageCtx = { pending: [] as Promise<unknown>[], waitUntil(promise: Promise<unknown>) { this.pending.push(promise); } };
    const first = await mainWorker.fetch(new Request(`${ORIGIN}/compendium/cards`), baseEnv as never, pageCtx);
    assert.equal(cookieValue(first, "slseoun_idm"), null, "unknown flags leave the signal alone");
    await Promise.allSettled(pageCtx.pending);
    const known = await mainWorker.fetch(new Request(`${ORIGIN}/compendium/cards`), baseEnv as never, pageCtx);
    assert.equal(cookieValue(known, "slseoun_idm"), "cookie", "cookie mode is signalled on pages");
    assert.equal(cookieValue(known, "slseoun_id"), null, "pages never carry the identity cookie");
    const already = await mainWorker.fetch(new Request(`${ORIGIN}/compendium/cards`, { headers: { cookie: "slseoun_idm=cookie" } }), baseEnv as never, pageCtx);
    assert.equal(cookieValue(already, "slseoun_idm"), null);
    const asset = await mainWorker.fetch(new Request(`${ORIGIN}/images/x.webp`), baseEnv as never, pageCtx);
    assert.equal(cookieValue(asset, "slseoun_idm"), null, "files get no signal");

    setMode("token");
    await mainWorker.fetch(new Request(`${ORIGIN}/compendium/cards`), baseEnv as never, pageCtx);
    await Promise.allSettled(pageCtx.pending);
    const rolledBack = await mainWorker.fetch(new Request(`${ORIGIN}/compendium/cards`, { headers: { cookie: "slseoun_idm=cookie" } }), baseEnv as never, pageCtx);
    assert.ok(cookiesOf(rolledBack).includes("slseoun_idm=; Max-Age=0; Path=/; SameSite=Lax; Secure"), "token mode clears the signal");
    const quiet = await mainWorker.fetch(new Request(`${ORIGIN}/compendium/cards`), baseEnv as never, pageCtx);
    assert.equal(cookieValue(quiet, "slseoun_idm"), null);

    // With the cookie default an isolate that has not read the flags yet signals cookie (like API_PATH_DEFAULT=api).
    setMode("cookie");
    const coldCtx = { pending: [] as Promise<unknown>[], waitUntil(promise: Promise<unknown>) { this.pending.push(promise); } };
    const cookieDefault = { ...baseEnv, API_IDENTITY_MODE_DEFAULT: "cookie" };
    const cold = await mainWorker.fetch(new Request(`${ORIGIN}/compendium/cards`), cookieDefault as never, coldCtx);
    assert.equal(cookieValue(cold, "slseoun_idm"), "cookie", "unknown flags with the cookie default: cookie");
    await Promise.allSettled(coldCtx.pending);
    setMode("token");
    await mainWorker.fetch(new Request(`${ORIGIN}/compendium/cards`), cookieDefault as never, coldCtx);
    await Promise.allSettled(coldCtx.pending);
    const tokenRow = await mainWorker.fetch(new Request(`${ORIGIN}/compendium/cards`, { headers: { cookie: "slseoun_idm=cookie" } }), cookieDefault as never, coldCtx);
    assert.ok(cookiesOf(tokenRow).includes("slseoun_idm=; Max-Age=0; Path=/; SameSite=Lax; Secure"), "a known token row still clears the signal");
  }

  globalThis.fetch = realFetch;
  console.log("api-identity spec passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
