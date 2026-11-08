import { ApiError, apiFetch, type ApiFetchInit } from "@/lib/api-client";
import { ensureClaimedIdentity, identityCookieMode, IdentityLegacyError } from "@/lib/api-identity";
import type { ApiSurfaceGroup } from "@/lib/api-surfaces";
import { supabase } from "@/lib/supabase";
import { SUPABASE_AUTH_TIMEOUT_MS, withSupabaseTimeout } from "@/lib/supabase-timeout";

/**
 * Calls a /api/me or /api/write endpoint with the Supabase access token
 * (docs/supabase-exit/STEP1_DESIGN.md 7). Auth stays on Supabase in step 1:
 * supabase-js keeps and refreshes the session, the Worker only verifies it.
 * `token_expired` refreshes once and retries once; `token_invalid` and 503 do not.
 *
 * Step 4 (docs/SUPABASE_EXIT_PLAN.md 5.3): while the Worker signals cookie
 * mode (`slseoun_idm`), the browser claims once and sends no bearer token; the
 * signed cookie names the user. Without the signal this is the step 1 path.
 */

export async function currentAccessToken(): Promise<string | null> {
  const { data, error } = await withSupabaseTimeout(
    "auth.getSession",
    supabase.auth.getSession(),
    SUPABASE_AUTH_TIMEOUT_MS,
  );
  if (error) return null;
  return data.session?.access_token ?? null;
}

export async function apiFetchAsUser<T>(
  group: ApiSurfaceGroup,
  path: string,
  init: Omit<ApiFetchInit, "token"> = {},
): Promise<T> {
  if (identityCookieMode()) return apiFetchWithCookie<T>(group, path, init);
  return apiFetchWithToken<T>(group, path, init);
}

/**
 * Cookie mode. `identity_required` (cookie missing or expired) claims again and
 * retries once. `token_invalid`/`token_expired` mean the Worker is back on the
 * token path (a rollback) or the route still forwards the token: redo the call
 * on the token path. None of these ran the handler, so nothing is sent twice.
 */
async function apiFetchWithCookie<T>(group: ApiSurfaceGroup, path: string, init: Omit<ApiFetchInit, "token">): Promise<T> {
  try {
    await ensureClaimedIdentity();
  } catch (error) {
    if (error instanceof IdentityLegacyError) return apiFetchWithToken<T>(group, path, init);
    throw error;
  }
  try {
    return await apiFetch<T>(group, path, init);
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    if (error.code === "identity_required") {
      try {
        await ensureClaimedIdentity({ force: true });
      } catch (claimError) {
        if (claimError instanceof IdentityLegacyError) return apiFetchWithToken<T>(group, path, init);
        throw claimError;
      }
      return apiFetch<T>(group, path, init);
    }
    if (error.code === "token_invalid" || error.code === "token_expired") return apiFetchWithToken<T>(group, path, init);
    throw error;
  }
}

async function apiFetchWithToken<T>(group: ApiSurfaceGroup, path: string, init: Omit<ApiFetchInit, "token">): Promise<T> {
  const token = await currentAccessToken().catch(() => null);
  if (!token) throw new ApiError(401, "token_invalid");
  try {
    return await apiFetch<T>(group, path, { ...init, token });
  } catch (error) {
    if (!(error instanceof ApiError) || error.code !== "token_expired") throw error;
    const refreshed = await withSupabaseTimeout(
      "auth.refreshSession",
      supabase.auth.refreshSession(),
      SUPABASE_AUTH_TIMEOUT_MS,
    ).catch(() => null);
    const next = refreshed && !refreshed.error ? refreshed.data.session?.access_token : null;
    if (!next) throw error;
    return apiFetch<T>(group, path, { ...init, token: next });
  }
}
