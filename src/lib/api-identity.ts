import { API_MARKER_HEADER, API_TIMEOUT_MS, ApiError, ApiUnavailableError } from "@/lib/api-client";
import {
  IDENTITY_CLAIM_PATH,
  IDENTITY_MARKER_STORAGE_KEY,
  type ClaimRequest,
  type ClaimResponse,
  type ClaimSession,
} from "@/lib/identity-cookies";

/**
 * Browser side of the signed-cookie identity (docs/SUPABASE_EXIT_PLAN.md 5.3), the
 * only identity of the step 6 browser (docs/supabase-exit/STEP6_PLAN.md WP-A).
 *
 * The browser claims once: it posts the Supabase session stored under
 * `sb-<ref>-auth-token` (the access token, expired is fine, and its refresh token)
 * to /api/auth/claim, and the Worker answers with the HttpOnly cookie for the same
 * uid, refreshing the session on Supabase Auth when the access token can no longer
 * be claimed. A browser with no stored session claims `{}`: the Worker keeps a
 * valid cookie's uid or signs up a new user. A session the Worker answers (a new
 * user, a refreshed session) is stored under the same key in supabase-js v2's shape;
 * nothing here removes that key (plan 5.3: until step 7), so a rollback finds the
 * same Supabase identity. The cookie is unreadable here, so the claimed uid is
 * remembered in localStorage too.
 *
 * No supabase-js, no bearer token, and no `slseoun_idm` read: the Worker keeps
 * sending that signal only for an older client after a rollback. A claim the
 * Worker answers as a legacy path is an outage (ApiUnavailableError).
 */

/**
 * Window event after this page stored a claimed uid or a session. `storage` events
 * reach other tabs only; useAuth listens to both, as it did to supabase-js's
 * onAuthStateChange, which fired in this tab and the others.
 */
export const IDENTITY_CHANGE_EVENT = "slseoun-identity-change";

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage ?? null;
  } catch {
    return null;
  }
}

const SUPABASE_AUTH_KEY = /^sb-[a-z0-9]+-auth-token$/;

/** True for the localStorage keys that name this browser's identity (the claim marker, the Supabase session). */
export function isIdentityStorageKey(key: string): boolean {
  return key === IDENTITY_MARKER_STORAGE_KEY || SUPABASE_AUTH_KEY.test(key);
}

/** The key supabase-js stored the session under; the origin holds one project's. */
function existingAuthKey(store: Storage): string | null {
  for (let index = 0; index < store.length; index += 1) {
    const key = store.key(index);
    if (key && SUPABASE_AUTH_KEY.test(key)) return key;
  }
  return null;
}

function jwtPayload(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const parsed = JSON.parse(atob(payload + "=".repeat((4 - (payload.length % 4)) % 4))) as unknown;
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function jwtSubject(token: string): string | null {
  const sub = jwtPayload(token)?.sub;
  return typeof sub === "string" ? sub.toLowerCase() : null;
}

/**
 * The key supabase-js would use (`sb-<first label of the project host>-auth-token`),
 * from the token's `iss` (`<project URL>/auth/v1`), so the build needs no Supabase URL.
 */
function authKeyFromIssuer(accessToken: string): string | null {
  const issuer = jwtPayload(accessToken)?.iss;
  if (typeof issuer !== "string") return null;
  try {
    const key = `sb-${new URL(issuer).hostname.split(".")[0]}-auth-token`;
    return SUPABASE_AUTH_KEY.test(key) ? key : null;
  } catch {
    return null;
  }
}

export type StoredSupabaseIdentity = { accessToken: string; refreshToken: string | null; uid: string | null };

/**
 * A session a claim answered that localStorage could not keep (no DOM storage, as in
 * a WebView with it turned off, or a refused write): this page holds it in memory, as
 * supabase-js fell back to a memory store, with whether this page's claim was for it.
 * Nothing else falls back to memory, so a later page starts with no session and no
 * claimed uid, as before step 6 (tasks/010-production-known-issues.md #74).
 */
let pageSession: { json: string; uid: string; claimed: boolean } | null = null;

/**
 * The Supabase session stored in localStorage (by supabase-js before step 6, or by a
 * claim), or null. The one this page holds in memory comes first: it exists only
 * after localStorage refused this page's write, so it is the newer one.
 */
export function storedSupabaseIdentity(): StoredSupabaseIdentity | null {
  try {
    let raw = pageSession?.json ?? null;
    if (!raw) {
      const store = storage();
      const key = store ? existingAuthKey(store) : null;
      raw = store && key ? store.getItem(key) : null;
    }
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const session = (parsed.currentSession ?? parsed.session ?? parsed) as {
      access_token?: unknown;
      refresh_token?: unknown;
      user?: { id?: unknown };
    };
    if (typeof session.access_token !== "string" || session.access_token.length === 0) return null;
    const uid = typeof session.user?.id === "string" ? session.user.id.toLowerCase() : jwtSubject(session.access_token);
    const refreshToken = typeof session.refresh_token === "string" && session.refresh_token.length > 0 ? session.refresh_token : null;
    return { accessToken: session.access_token, refreshToken, uid };
  } catch {
    return null;
  }
}

/**
 * Stores a session the claim answered, in supabase-js v2's shape, under the existing
 * `sb-<ref>-auth-token` key or the one its `iss` names. Replaces the stored session
 * (as a supabase-js sign-in did) and never removes one. Without usable localStorage
 * this page keeps it in memory (`pageSession`). False when nothing was kept.
 */
export function storeSupabaseSession(session: ClaimSession): boolean {
  if (typeof session?.access_token !== "string" || session.access_token.length === 0) return false;
  const json = JSON.stringify({
    access_token: session.access_token,
    token_type: session.token_type,
    expires_in: session.expires_in,
    expires_at: session.expires_at,
    refresh_token: session.refresh_token,
    user: session.user,
  });
  const store = storage();
  if (store) {
    try {
      const key = existingAuthKey(store) ?? authKeyFromIssuer(session.access_token);
      if (!key) return false;
      store.setItem(key, json);
      pageSession = null;
      return true;
    } catch {
      // A refused write (quota, blocked storage): this page keeps it below.
    }
  }
  const uid = sessionUid(session);
  if (!uid) return false;
  pageSession = { json, uid, claimed: false };
  return true;
}

/** The uid this browser claimed, or null. */
export function claimedUid(): string | null {
  if (pageSession?.claimed) return pageSession.uid;
  try {
    const raw = storage()?.getItem(IDENTITY_MARKER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { uid?: unknown };
    return typeof parsed.uid === "string" ? parsed.uid : null;
  } catch {
    return null;
  }
}

/** "Me" in this browser: the stored Supabase session's uid, else the uid this browser claimed. */
export function currentIdentityUid(): string | null {
  return storedSupabaseIdentity()?.uid ?? claimedUid();
}

function rememberClaim(uid: string): boolean {
  let kept = false;
  try {
    const store = storage();
    if (store) {
      store.setItem(IDENTITY_MARKER_STORAGE_KEY, JSON.stringify({ uid, at: new Date().toISOString() }));
      kept = true;
    }
  } catch {
    // Refused: remembered below only for the session this page holds in memory.
  }
  // The cookie still works. Otherwise the next call claims again.
  if (pageSession) pageSession.claimed = !kept && pageSession.uid === uid.toLowerCase();
  return kept || pageSession?.claimed === true;
}

function forgetClaim(): void {
  if (pageSession) pageSession.claimed = false;
  try {
    storage()?.removeItem(IDENTITY_MARKER_STORAGE_KEY);
  } catch {
    // Nothing to forget.
  }
}

function notifyIdentityChange(): void {
  try {
    if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") window.dispatchEvent(new Event(IDENTITY_CHANGE_EVENT));
  } catch {
    // Other hooks in this tab learn the uid on their next ensureUser.
  }
}

function sessionUid(session: ClaimSession): string | null {
  const id = (session.user as { id?: unknown } | undefined)?.id;
  return typeof id === "string" ? id.toLowerCase() : jwtSubject(session.access_token);
}

async function postClaim(request: ClaimRequest): Promise<ClaimResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    let response: Response;
    try {
      response = await fetch(IDENTITY_CLAIM_PATH, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify(request),
        credentials: "same-origin",
        signal: controller.signal,
      });
    } catch {
      throw new ApiUnavailableError(0, controller.signal.aborted ? "timeout" : "unavailable");
    }
    if (response.headers.get(API_MARKER_HEADER) !== "1") {
      // No router answered (a platform error page, a Worker from before step 4): an outage.
      void response.body?.cancel().catch(() => undefined);
      throw new ApiUnavailableError(response.status, "unavailable");
    }
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new ApiUnavailableError(response.status, controller.signal.aborted ? "timeout" : "bad_response");
    }
    const code = typeof (body as { error?: unknown })?.error === "string" ? (body as { error: string }).error : `http_${response.status}`;
    // identity.mode is token, the flags are off, or the QA cookie: the step 6 browser has no token path.
    if (response.status === 409 && code === "surface_legacy") throw new ApiUnavailableError(409, "unavailable");
    if (response.status >= 500) throw new ApiUnavailableError(response.status, code);
    if (!response.ok) throw new ApiError(response.status, code);
    const claimed = body as ClaimResponse;
    if (claimed?.v !== 1 || typeof claimed.uid !== "string") throw new ApiUnavailableError(response.status, "bad_response");
    // The session first, so a listener never sees the new marker next to the old session.
    const stored = claimed.session && sessionUid(claimed.session) === claimed.uid.toLowerCase()
      ? storeSupabaseSession(claimed.session)
      : false;
    const remembered = rememberClaim(claimed.uid);
    if (stored || remembered) notifyIdentityChange();
    return claimed;
  } finally {
    clearTimeout(timer);
  }
}

let inflight: Promise<ClaimResponse> | null = null;
/** An access token this page saw refused (and its refresh with it): not posted again. */
let refusedAccessToken: string | null = null;

/** One claim at a time per page: concurrent callers share it. */
function claimOnce(run: () => Promise<ClaimResponse>): Promise<ClaimResponse> {
  inflight ??= run().finally(() => {
    inflight = null;
  });
  return inflight;
}

function isRefusedToken(error: unknown): boolean {
  return error instanceof ApiError && !(error instanceof ApiUnavailableError) && error.status === 401 && error.code === "token_invalid";
}

/**
 * Claims the stored session. When the Worker refuses it (401 token_invalid: past the
 * claim window and the refresh refused too), claims `{}` once: a valid cookie keeps
 * its uid, otherwise the Worker signs up a new user, as supabase-js dropped a session
 * it could not refresh and signed in anonymously again.
 */
async function claimStored(stored: StoredSupabaseIdentity): Promise<ClaimResponse> {
  if (stored.accessToken !== refusedAccessToken) {
    try {
      return await postClaim(stored.refreshToken
        ? { access_token: stored.accessToken, refresh_token: stored.refreshToken }
        : { access_token: stored.accessToken });
    } catch (error) {
      if (!isRefusedToken(error)) throw error;
      refusedAccessToken = stored.accessToken;
    }
  }
  return postClaim({});
}

/**
 * The claimed uid, claiming first when this browser has not claimed its current
 * Supabase identity. `force` claims again (the Worker said the cookie is missing or
 * expired). Throws ApiError or ApiUnavailableError. With no stored session it
 * signs nobody up (useAuth's ensureUser does): 401 token_invalid, or with `force`
 * identity_required after forgetting the claimed uid.
 */
export async function ensureClaimedIdentity({ force = false }: { force?: boolean } = {}): Promise<string> {
  const stored = storedSupabaseIdentity();
  const marker = claimedUid();
  if (!force && marker && (!stored?.uid || stored.uid === marker || stored.accessToken === refusedAccessToken)) return marker;
  if (!stored) {
    // Nothing to claim with. A forced claim means the cookie is gone: the next
    // ensureUser then asks the Worker for an identity.
    if (force) forgetClaim();
    throw new ApiError(401, force ? "identity_required" : "token_invalid");
  }
  return (await claimOnce(() => claimStored(stored))).uid;
}

/**
 * For a browser with no stored Supabase session (useAuth's ensureUser): the Worker
 * keeps a valid cookie's uid, or signs up on Supabase and returns that session,
 * which is stored. Throws ApiError or ApiUnavailableError.
 */
export function claimNewIdentity(): Promise<ClaimResponse> {
  return claimOnce(() => postClaim({}));
}
