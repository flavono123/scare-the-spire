import {
  IDENTITY_COOKIE_NAME,
  IDENTITY_COOKIE_PATH,
  IDENTITY_MODE_COOKIE_NAME,
  IDENTITY_MODE_COOKIE_VALUE,
  type IdentityMode,
} from "../../../src/lib/identity-cookies";

/**
 * The signed identity cookie (docs/SUPABASE_EXIT_PLAN.md 5.3): the uid, the
 * issue time and an HMAC-SHA256 over both with the `API_IDENTITY_SECRET`
 * Worker secret. `HttpOnly; SameSite=Lax; Path=/api/`, plus `Secure` on https
 * (like `slseoun_rf`, so `wrangler dev` on http keeps working).
 *
 * Value: `v1.<uid>.<issued-at unix seconds>.<base64url signature>`.
 */

export type IdentityEnv = {
  /** Worker secret: HMAC key of the identity cookie, at least 32 characters. */
  API_IDENTITY_SECRET?: string;
  /** Worker secret, optional: the Supabase legacy JWT secret, so claim accepts old HS256 tokens. */
  API_SUPABASE_LEGACY_JWT_SECRET?: string;
};

const VERSION = "v1";
const MIN_SECRET_LENGTH = 32;
/** Browsers cap cookie lifetimes at 400 days. */
export const IDENTITY_COOKIE_MAX_AGE_SECONDS = 400 * 86_400;
/** A cookie older than this is re-issued on the next /api user call, so active users never expire. */
export const IDENTITY_COOKIE_RENEW_AFTER_SECONDS = 7 * 86_400;
const ISSUED_AT_SKEW_SECONDS = 300;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const BASE64URL = /^[A-Za-z0-9_-]+$/;
const MODE_COOKIE_MAX_AGE_SECONDS = 86_400;

/** The cookie secret, or null when it is missing or too short (identity stays on the token path). */
export function identitySecret(env: IdentityEnv): string | null {
  const secret = env.API_IDENTITY_SECRET ?? "";
  return secret.length >= MIN_SECRET_LENGTH ? secret : null;
}

const keys = new Map<string, Promise<CryptoKey>>();

function hmacKey(secret: string): Promise<CryptoKey> {
  let key = keys.get(secret);
  if (!key) {
    key = crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
    key.catch(() => keys.delete(secret));
    // One secret per Worker; the bound keeps a misbehaving caller from growing the map.
    if (keys.size >= 4) keys.clear();
    keys.set(secret, key);
  }
  return key;
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function signingInput(uid: string, issuedAt: number): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(`${IDENTITY_COOKIE_NAME}.${VERSION}.${uid}.${issuedAt}`);
}

/** The cookie value for `uid` issued at `now` (unix seconds). */
export async function signIdentityCookie(secret: string, uid: string, now = Math.floor(Date.now() / 1000)): Promise<string> {
  const normalized = uid.toLowerCase();
  if (!UUID.test(normalized)) throw new Error("identity uid must be a uuid");
  const issuedAt = Math.floor(now);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(secret), signingInput(normalized, issuedAt)));
  return `${VERSION}.${normalized}.${issuedAt}.${base64Url(signature)}`;
}

export type IdentityCookieCheck =
  | { ok: true; uid: string; issuedAt: number; expiresAt: number; renew: boolean }
  | { ok: false; reason: "missing" | "malformed" | "bad_signature" | "expired" };

/** Checks a cookie value; the signature check is constant time (WebCrypto verify). */
export async function verifyIdentityCookie(
  secret: string,
  value: string | null,
  now = Math.floor(Date.now() / 1000),
): Promise<IdentityCookieCheck> {
  if (!value) return { ok: false, reason: "missing" };
  if (value.length > 160) return { ok: false, reason: "malformed" };
  const parts = value.split(".");
  if (parts.length !== 4) return { ok: false, reason: "malformed" };
  const [version, uid, issued, signature] = parts;
  if (version !== VERSION || !UUID.test(uid) || !/^\d{1,12}$/.test(issued) || !BASE64URL.test(signature)) {
    return { ok: false, reason: "malformed" };
  }
  let signatureBytes: Uint8Array<ArrayBuffer>;
  try {
    signatureBytes = fromBase64Url(signature);
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (signatureBytes.length !== 32) return { ok: false, reason: "malformed" };
  const issuedAt = Number(issued);
  const valid = await crypto.subtle.verify("HMAC", await hmacKey(secret), signatureBytes, signingInput(uid, issuedAt));
  if (!valid) return { ok: false, reason: "bad_signature" };
  const age = now - issuedAt;
  if (age < -ISSUED_AT_SKEW_SECONDS || age >= IDENTITY_COOKIE_MAX_AGE_SECONDS) return { ok: false, reason: "expired" };
  return {
    ok: true,
    uid,
    issuedAt,
    expiresAt: issuedAt + IDENTITY_COOKIE_MAX_AGE_SECONDS,
    renew: age >= IDENTITY_COOKIE_RENEW_AFTER_SECONDS,
  };
}

/** `Set-Cookie` for an identity cookie value. */
export function identityCookieHeader(value: string, secure: boolean): string {
  return `${IDENTITY_COOKIE_NAME}=${value}; Path=${IDENTITY_COOKIE_PATH}; Max-Age=${IDENTITY_COOKIE_MAX_AGE_SECONDS}; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
}

/**
 * `Set-Cookie` that tells the browser the identity mode, or null for no change.
 * Same rules as `slseoun_rf` (STEP1_DESIGN 3.3): sent only when the request's
 * value differs; token mode clears it only when the request carried one.
 */
export function identityModeCookieHeader(current: string | null, mode: IdentityMode, secure: boolean): string | null {
  const suffix = `; Path=/; SameSite=Lax${secure ? "; Secure" : ""}`;
  if (mode === "cookie") {
    return current === IDENTITY_MODE_COOKIE_VALUE
      ? null
      : `${IDENTITY_MODE_COOKIE_NAME}=${IDENTITY_MODE_COOKIE_VALUE}; Max-Age=${MODE_COOKIE_MAX_AGE_SECONDS}${suffix}`;
  }
  return current === null ? null : `${IDENTITY_MODE_COOKIE_NAME}=; Max-Age=0${suffix}`;
}

/** Appends `Set-Cookie` headers, copying first when the response's headers are immutable. */
export function withSetCookies(response: Response, cookies: readonly string[]): Response {
  if (cookies.length === 0) return response;
  let target = response;
  try {
    for (const cookie of cookies) target.headers.append("Set-Cookie", cookie);
  } catch {
    target = new Response(response.body, response);
    for (const cookie of cookies) target.headers.append("Set-Cookie", cookie);
  }
  return target;
}
