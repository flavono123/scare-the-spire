import { API_MARKER_HEADER, API_TIMEOUT_MS, ApiError, ApiUnavailableError } from "@/lib/api-client";
import {
  IDENTITY_CLAIM_PATH,
  IDENTITY_MARKER_STORAGE_KEY,
  IDENTITY_MODE_COOKIE_NAME,
  IDENTITY_MODE_COOKIE_VALUE,
  type ClaimResponse,
} from "@/lib/identity-cookies";

/**
 * Browser side of the step 4 signed-cookie identity (docs/SUPABASE_EXIT_PLAN.md 5.3).
 * Inert unless the Worker set `slseoun_idm=cookie` (runtime flag identity.mode).
 *
 * The browser claims once: it posts the Supabase access token supabase-js keeps
 * in localStorage (expired is fine) to /api/auth/claim, and the Worker answers
 * with the HttpOnly cookie for the same uid. The token stays in localStorage
 * (until step 7) so a rollback finds the same Supabase identity. The cookie is
 * unreadable here, so the claimed uid is remembered in localStorage.
 *
 * No supabase-js import: this keeps working after step 6 removes it.
 */

/** The Worker answered the claim as a legacy path: identity.mode is token (again). */
export class IdentityLegacyError extends Error {
  constructor() {
    super("identity legacy");
    this.name = "IdentityLegacyError";
  }
}

function cookieValue(name: string): string | null {
  if (typeof document === "undefined") return null;
  for (const part of document.cookie.split(";")) {
    const index = part.indexOf("=");
    if (index >= 0 && part.slice(0, index).trim() === name) return part.slice(index + 1).trim();
  }
  return null;
}

/** Read on every call, like surfacePath, so a newer page in another tab moves this one too. */
export function identityCookieMode(): boolean {
  return cookieValue(IDENTITY_MODE_COOKIE_NAME) === IDENTITY_MODE_COOKIE_VALUE;
}

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage ?? null;
  } catch {
    return null;
  }
}

const SUPABASE_AUTH_KEY = /^sb-[a-z0-9]+-auth-token$/;

function supabaseAuthKey(store: Storage): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (url) {
    try {
      return `sb-${new URL(url).hostname.split(".")[0]}-auth-token`;
    } catch {
      // Fall back to the stored key below.
    }
  }
  for (let index = 0; index < store.length; index += 1) {
    const key = store.key(index);
    if (key && SUPABASE_AUTH_KEY.test(key)) return key;
  }
  return null;
}

function jwtSubject(token: string): string | null {
  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const parsed = JSON.parse(atob(payload + "=".repeat((4 - (payload.length % 4)) % 4))) as { sub?: unknown };
    return typeof parsed.sub === "string" ? parsed.sub.toLowerCase() : null;
  } catch {
    return null;
  }
}

/** The Supabase session supabase-js stored, as `{ accessToken, uid }`, or null. */
export function storedSupabaseIdentity(): { accessToken: string; uid: string | null } | null {
  const store = storage();
  if (!store) return null;
  try {
    const key = supabaseAuthKey(store);
    const raw = key ? store.getItem(key) : null;
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const session = (parsed.currentSession ?? parsed.session ?? parsed) as { access_token?: unknown; user?: { id?: unknown } };
    if (typeof session.access_token !== "string" || session.access_token.length === 0) return null;
    const uid = typeof session.user?.id === "string" ? session.user.id.toLowerCase() : jwtSubject(session.access_token);
    return { accessToken: session.access_token, uid };
  } catch {
    return null;
  }
}

/** The uid this browser claimed, or null. */
export function claimedUid(): string | null {
  try {
    const raw = storage()?.getItem(IDENTITY_MARKER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { uid?: unknown };
    return typeof parsed.uid === "string" ? parsed.uid : null;
  } catch {
    return null;
  }
}

function rememberClaim(uid: string): void {
  try {
    storage()?.setItem(IDENTITY_MARKER_STORAGE_KEY, JSON.stringify({ uid, at: new Date().toISOString() }));
  } catch {
    // The cookie still works; the next call claims again.
  }
}

function forgetClaim(): void {
  try {
    storage()?.removeItem(IDENTITY_MARKER_STORAGE_KEY);
  } catch {
    // Nothing to forget.
  }
}

/** The uid to show as "me" in cookie mode when supabase-js has no session; null otherwise. */
export function cookieModeFallbackUid(): string | null {
  return identityCookieMode() ? claimedUid() : null;
}

let inflight: Promise<ClaimResponse> | null = null;

async function postClaim(accessToken: string | null): Promise<ClaimResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    let response: Response;
    try {
      response = await fetch(IDENTITY_CLAIM_PATH, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify(accessToken ? { access_token: accessToken } : {}),
        credentials: "same-origin",
        signal: controller.signal,
      });
    } catch {
      throw new ApiUnavailableError(0, controller.signal.aborted ? "timeout" : "unavailable");
    }
    if (response.headers.get(API_MARKER_HEADER) !== "1") {
      void response.body?.cancel().catch(() => undefined);
      throw new IdentityLegacyError();
    }
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new ApiUnavailableError(response.status, controller.signal.aborted ? "timeout" : "bad_response");
    }
    const code = typeof (body as { error?: unknown })?.error === "string" ? (body as { error: string }).error : `http_${response.status}`;
    if (response.status === 409 && code === "surface_legacy") throw new IdentityLegacyError();
    if (response.status >= 500) throw new ApiUnavailableError(response.status, code);
    if (!response.ok) throw new ApiError(response.status, code);
    const claimed = body as ClaimResponse;
    if (claimed?.v !== 1 || typeof claimed.uid !== "string") throw new ApiUnavailableError(response.status, "bad_response");
    rememberClaim(claimed.uid);
    return claimed;
  } finally {
    clearTimeout(timer);
  }
}

/** One claim at a time per page: concurrent callers share it. */
function claimOnce(accessToken: string | null): Promise<ClaimResponse> {
  inflight ??= postClaim(accessToken).finally(() => {
    inflight = null;
  });
  return inflight;
}

/**
 * The claimed uid, claiming first when this browser has not claimed its
 * current Supabase identity. `force` claims again (the Worker said the cookie
 * is missing or expired). Throws ApiError, ApiUnavailableError or
 * IdentityLegacyError. Never signs up a new user: useAuth's ensureUser does.
 */
export async function ensureClaimedIdentity({ force = false }: { force?: boolean } = {}): Promise<string> {
  const stored = storedSupabaseIdentity();
  const marker = claimedUid();
  if (!force && marker && (!stored?.uid || stored.uid === marker)) return marker;
  if (!stored) {
    // Nothing to claim with. A forced claim means the cookie is gone: the next
    // ensureUser then asks the Worker for an identity.
    if (force) forgetClaim();
    throw new ApiError(401, force ? "identity_required" : "token_invalid");
  }
  return (await claimOnce(stored.accessToken)).uid;
}

/**
 * For a browser with no Supabase session in cookie mode (useAuth's ensureUser):
 * the Worker keeps a valid cookie's uid, or signs up on Supabase and returns
 * that session. Throws IdentityLegacyError when identity.mode is token.
 */
export function claimNewIdentity(): Promise<ClaimResponse> {
  return claimOnce(null);
}
