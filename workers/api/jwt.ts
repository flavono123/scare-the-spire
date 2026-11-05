import { PINNED_SUPABASE_JWKS, type SupabaseJwk } from "./supabase-jwks";

/**
 * Verifies a Supabase access token (ES256) before the Worker forwards it to
 * PostgREST (docs/supabase-exit/STEP1_DESIGN.md 6). In step 1 PostgREST checks
 * the token again, so this is defense in depth plus a trusted user id for the
 * endpoints. The Worker never refreshes tokens.
 */

export type VerifiedSupabaseUser = {
  userId: string;
  isAnonymous: boolean;
  expiresAt: number;
};

/** expired: refresh once and retry. invalid: do not refresh. unavailable: keys could not be loaded. */
export type TokenRejection = "expired" | "invalid" | "unavailable";

export type TokenCheck =
  | { ok: true; user: VerifiedSupabaseUser }
  | { ok: false; reason: TokenRejection };

export type JwtVerifyOptions = {
  /** `<API_SUPABASE_URL>/auth/v1`. */
  issuer: string;
  /** Unix seconds; tests pin it. */
  now?: number;
  /** Loads the live JWKS when a token names a key that is not pinned. */
  fetchJwks?: () => Promise<readonly SupabaseJwk[]>;
  /** Overrides the pinned keys (tests). */
  pinnedKeys?: readonly SupabaseJwk[];
  /** Keeps a shared JWKS fetch alive when the request that started it ends. */
  waitUntil?: (promise: Promise<unknown>) => void;
};

const MAX_TOKEN_LENGTH = 8192;
const MAX_KID_LENGTH = 128;
// Reject tokens that would expire before PostgREST sees them, so the client refreshes first.
const EXPIRY_MARGIN_SECONDS = 5;
const ISSUED_AT_SKEW_SECONDS = 30;
const BASE64URL = /^[A-Za-z0-9_-]+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// One live JWKS fetch per isolate per minute, whatever kids requests name, so
// random kids cannot turn the Worker into Supabase load.
const LIVE_JWKS_TTL_MS = 10 * 60_000;
const LIVE_JWKS_COOLDOWN_MS = 60_000;
// No request waits longer than this on a fetch another request started.
const LIVE_JWKS_WAIT_MS = 2_000;
// A fetch still pending after this is treated as lost (its request was cancelled).
const LIVE_JWKS_STUCK_MS = 10_000;

type LiveJwks = { keys: readonly SupabaseJwk[]; fetchedAt: number };
let liveJwks: LiveJwks | null = null;
let lastLiveFetchAt = 0;
let lastLiveFetchFailed = false;
let liveFetch: Promise<void> | null = null;
let liveFetchGeneration = 0;
const importedKeys = new Map<string, Promise<CryptoKey>>();

/** Clears module caches between spec cases. */
export function resetJwtCachesForTest(): void {
  liveJwks = null;
  lastLiveFetchAt = 0;
  lastLiveFetchFailed = false;
  liveFetch = null;
  importedKeys.clear();
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function decodeJsonSegment(segment: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(base64UrlToBytes(segment)));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function isUsableJwk(value: unknown): value is SupabaseJwk {
  if (!value || typeof value !== "object") return false;
  const key = value as Record<string, unknown>;
  return key.kty === "EC"
    && key.crv === "P-256"
    && (key.alg === undefined || key.alg === "ES256")
    && (key.use === undefined || key.use === "sig")
    && typeof key.kid === "string"
    && typeof key.x === "string"
    && typeof key.y === "string";
}

/** Parses a JWKS document, keeping only P-256 signing keys. */
export function parseJwks(document: unknown): SupabaseJwk[] {
  if (!document || typeof document !== "object") return [];
  const keys = (document as { keys?: unknown }).keys;
  if (!Array.isArray(keys)) return [];
  return keys.filter(isUsableJwk).map((key) => ({
    kty: "EC",
    crv: "P-256",
    alg: "ES256",
    kid: key.kid,
    x: key.x,
    y: key.y,
  }));
}

function settleWithin(promise: Promise<void>, ms: number): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise,
    new Promise<void>((resolve) => {
      timer = setTimeout(resolve, ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

function liveSetIsStale(nowMs: number): boolean {
  return !liveJwks || nowMs - liveJwks.fetchedAt >= LIVE_JWKS_TTL_MS;
}

async function liveKey(kid: string, options: JwtVerifyOptions): Promise<SupabaseJwk | "unavailable" | null> {
  const nowMs = Date.now();
  if (liveFetch && nowMs - lastLiveFetchAt > LIVE_JWKS_STUCK_MS) liveFetch = null;
  if (liveSetIsStale(nowMs) && options.fetchJwks && !liveFetch && nowMs - lastLiveFetchAt >= LIVE_JWKS_COOLDOWN_MS) {
    lastLiveFetchAt = nowMs;
    const fetchJwks = options.fetchJwks;
    const generation = ++liveFetchGeneration;
    liveFetch = (async () => {
      try {
        const keys = await fetchJwks();
        liveJwks = { keys, fetchedAt: Date.now() };
        lastLiveFetchFailed = false;
      } catch {
        lastLiveFetchFailed = true;
      } finally {
        // A newer fetch may have replaced one that was treated as lost.
        if (liveFetchGeneration === generation) liveFetch = null;
      }
    })();
    options.waitUntil?.(liveFetch);
  }
  if (liveFetch) await settleWithin(liveFetch, LIVE_JWKS_WAIT_MS);
  const found = liveJwks?.keys.find((key) => key.kid === kid);
  if (found) return found;
  // The kid could not be checked against a current key set: not the token's fault.
  if (options.fetchJwks && liveSetIsStale(Date.now()) && (lastLiveFetchFailed || liveFetch)) return "unavailable";
  return null;
}

function importKey(jwk: SupabaseJwk): Promise<CryptoKey> {
  const cacheKey = `${jwk.kid}:${jwk.x}:${jwk.y}`;
  let imported = importedKeys.get(cacheKey);
  if (!imported) {
    imported = crypto.subtle.importKey(
      "jwk",
      { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, ext: true },
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );
    imported.catch(() => importedKeys.delete(cacheKey));
    importedKeys.set(cacheKey, imported);
  }
  return imported;
}

function audienceIncludesAuthenticated(aud: unknown): boolean {
  if (aud === "authenticated") return true;
  return Array.isArray(aud) && aud.includes("authenticated");
}

const invalid: TokenCheck = { ok: false, reason: "invalid" };

/** Checks a token; cheap claim checks run before any key lookup or fetch. */
export async function checkSupabaseAccessToken(token: string, options: JwtVerifyOptions): Promise<TokenCheck> {
  if (!token || token.length > MAX_TOKEN_LENGTH) return invalid;
  const parts = token.split(".");
  if (parts.length !== 3 || !parts.every((part) => BASE64URL.test(part))) return invalid;
  const [headerSegment, payloadSegment, signatureSegment] = parts;

  const header = decodeJsonSegment(headerSegment);
  const payload = decodeJsonSegment(payloadSegment);
  if (!header || !payload) return invalid;
  if (header.alg !== "ES256") return invalid;
  const kid = header.kid;
  if (typeof kid !== "string" || kid.length === 0 || kid.length > MAX_KID_LENGTH) return invalid;

  const now = options.now ?? Math.floor(Date.now() / 1000);
  const exp = payload.exp;
  const sub = payload.sub;
  if (typeof exp !== "number" || !Number.isFinite(exp)) return invalid;
  if (payload.iss !== options.issuer) return invalid;
  if (!audienceIncludesAuthenticated(payload.aud)) return invalid;
  if (payload.role !== "authenticated") return invalid;
  if (typeof sub !== "string" || !UUID.test(sub)) return invalid;
  const iat = payload.iat;
  if (iat !== undefined && (typeof iat !== "number" || iat > now + ISSUED_AT_SKEW_SECONDS)) return invalid;
  const nbf = payload.nbf;
  if (nbf !== undefined && (typeof nbf !== "number" || nbf > now + ISSUED_AT_SKEW_SECONDS)) return invalid;

  let signature: Uint8Array<ArrayBuffer>;
  try {
    signature = base64UrlToBytes(signatureSegment);
  } catch {
    return invalid;
  }
  // JWS ES256 signatures are the raw 64-byte r||s pair WebCrypto expects.
  if (signature.length !== 64) return invalid;

  const pinned = options.pinnedKeys ?? PINNED_SUPABASE_JWKS;
  const jwk = pinned.find((key) => key.kid === kid) ?? await liveKey(kid, options);
  if (jwk === "unavailable") return { ok: false, reason: "unavailable" };
  if (!jwk) return invalid;

  let valid = false;
  try {
    valid = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      await importKey(jwk),
      signature,
      new TextEncoder().encode(`${headerSegment}.${payloadSegment}`),
    );
  } catch {
    return invalid;
  }
  if (!valid) return invalid;

  // Only a correctly signed token is told to refresh.
  if (exp - EXPIRY_MARGIN_SECONDS <= now) return { ok: false, reason: "expired" };

  return {
    ok: true,
    user: { userId: sub.toLowerCase(), isAnonymous: payload.is_anonymous === true, expiresAt: exp },
  };
}

/** Loads the project JWKS with a short timeout and size cap. */
export async function fetchSupabaseJwks(
  authUrl: string,
  fetcher: (input: string, init?: RequestInit) => Promise<Response> = (input, init) => fetch(input, init),
): Promise<SupabaseJwk[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2000);
  try {
    const response = await fetcher(`${authUrl}/.well-known/jwks.json`, { signal: controller.signal });
    if (!response.ok) throw new Error(`jwks ${response.status}`);
    const text = await response.text();
    if (text.length > 16 * 1024) throw new Error("jwks too large");
    return parseJwks(JSON.parse(text));
  } finally {
    clearTimeout(timer);
  }
}

/** The bearer token of a request, or null. Tokens never travel in URLs. */
export function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const match = /^Bearer ([A-Za-z0-9_.-]+)$/.exec(header.trim());
  return match ? match[1] : null;
}
