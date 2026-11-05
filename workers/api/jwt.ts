import { PINNED_SUPABASE_JWKS, type SupabaseJwk } from "./supabase-jwks";

/**
 * Verifies a Supabase access token (ES256) before the Worker forwards it to
 * PostgREST. RLS still decides what the user may do; this check only keeps
 * forged or expired tokens from reaching Supabase and gives the endpoints a
 * trusted user id. The Worker never refreshes tokens.
 */

export type VerifiedSupabaseUser = {
  userId: string;
  isAnonymous: boolean;
  expiresAt: number;
};

export type JwtVerifyOptions = {
  /** `<API_SUPABASE_URL>/auth/v1`. */
  issuer: string;
  /** Unix seconds; tests pin it. */
  now?: number;
  /** Loads the live JWKS when a token names an unknown key. */
  fetchJwks?: () => Promise<readonly SupabaseJwk[]>;
  /** Overrides the pinned keys (tests). */
  pinnedKeys?: readonly SupabaseJwk[];
};

const CLOCK_SKEW_SECONDS = 30;
const MAX_TOKEN_LENGTH = 8192;
const MAX_KID_LENGTH = 128;
const BASE64URL = /^[A-Za-z0-9_-]+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// A live JWKS fetch happens at most once a minute per isolate, whatever kids
// requests name, so random kids cannot turn the Worker into a Supabase load.
const LIVE_JWKS_TTL_MS = 10 * 60_000;
const LIVE_JWKS_RETRY_MS = 60_000;

type LiveJwks = { keys: readonly SupabaseJwk[]; fetchedAt: number };
let liveJwks: LiveJwks | null = null;
let lastLiveFetchAt = 0;
let liveFetch: Promise<void> | null = null;
const importedKeys = new Map<string, Promise<CryptoKey>>();

/** Clears module caches between spec cases. */
export function resetJwtCachesForTest(): void {
  liveJwks = null;
  lastLiveFetchAt = 0;
  liveFetch = null;
  importedKeys.clear();
}

function base64UrlToBytes(value: string): Uint8Array {
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

async function liveKey(kid: string, options: JwtVerifyOptions): Promise<SupabaseJwk | null> {
  const nowMs = Date.now();
  if (liveJwks && nowMs - liveJwks.fetchedAt < LIVE_JWKS_TTL_MS) {
    return liveJwks.keys.find((key) => key.kid === kid) ?? null;
  }
  if (!options.fetchJwks) return null;
  if (!liveFetch && nowMs - lastLiveFetchAt >= LIVE_JWKS_RETRY_MS) {
    lastLiveFetchAt = nowMs;
    const fetchJwks = options.fetchJwks;
    liveFetch = (async () => {
      try {
        const keys = await fetchJwks();
        if (keys.length > 0) liveJwks = { keys, fetchedAt: Date.now() };
      } catch {
        // Keep the pinned keys; the next fetch waits for LIVE_JWKS_RETRY_MS.
      } finally {
        liveFetch = null;
      }
    })();
  }
  if (liveFetch) await liveFetch;
  return liveJwks?.keys.find((key) => key.kid === kid) ?? null;
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

/** Returns the verified user, or null for any token the Worker must not trust. */
export async function verifySupabaseAccessToken(
  token: string,
  options: JwtVerifyOptions,
): Promise<VerifiedSupabaseUser | null> {
  if (!token || token.length > MAX_TOKEN_LENGTH) return null;
  const parts = token.split(".");
  if (parts.length !== 3 || !parts.every((part) => BASE64URL.test(part))) return null;
  const [headerSegment, payloadSegment, signatureSegment] = parts;

  const header = decodeJsonSegment(headerSegment);
  if (!header || header.alg !== "ES256") return null;
  const kid = header.kid;
  if (typeof kid !== "string" || kid.length === 0 || kid.length > MAX_KID_LENGTH) return null;

  const pinned = options.pinnedKeys ?? PINNED_SUPABASE_JWKS;
  const jwk = pinned.find((key) => key.kid === kid) ?? await liveKey(kid, options);
  if (!jwk) return null;

  let signature: Uint8Array;
  try {
    signature = base64UrlToBytes(signatureSegment);
  } catch {
    return null;
  }
  // JWS ES256 signatures are the raw 64-byte r||s pair WebCrypto expects.
  if (signature.length !== 64) return null;

  let valid = false;
  try {
    const key = await importKey(jwk);
    valid = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      signature,
      new TextEncoder().encode(`${headerSegment}.${payloadSegment}`),
    );
  } catch {
    return null;
  }
  if (!valid) return null;

  const payload = decodeJsonSegment(payloadSegment);
  if (!payload) return null;
  const now = options.now ?? Math.floor(Date.now() / 1000);
  const exp = payload.exp;
  if (typeof exp !== "number" || !Number.isFinite(exp) || exp <= now - CLOCK_SKEW_SECONDS) return null;
  const nbf = payload.nbf;
  if (nbf !== undefined && (typeof nbf !== "number" || nbf > now + CLOCK_SKEW_SECONDS)) return null;
  if (payload.iss !== options.issuer) return null;
  if (!audienceIncludesAuthenticated(payload.aud)) return null;
  if (payload.role !== "authenticated") return null;
  const sub = payload.sub;
  if (typeof sub !== "string" || !UUID.test(sub)) return null;

  return {
    userId: sub.toLowerCase(),
    isAnonymous: payload.is_anonymous === true,
    expiresAt: exp,
  };
}

/** The bearer token of a request, or null. Tokens never travel in URLs. */
export function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const match = /^Bearer ([A-Za-z0-9_.-]+)$/.exec(header.trim());
  return match ? match[1] : null;
}
