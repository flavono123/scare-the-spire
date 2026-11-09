import { ApiError, apiFetch, ApiUnavailableError, type ApiFetchInit } from "@/lib/api-client";
import { ensureClaimedIdentity } from "@/lib/api-identity";
import type { ApiSurfaceGroup } from "@/lib/api-surfaces";

/**
 * Calls a /api/me or /api/write endpoint as this browser's user. Since step 6
 * (docs/supabase-exit/STEP6_PLAN.md WP-A 2) the signed HttpOnly cookie is the only
 * identity: the browser claims once (api-identity.ts) and never sends a bearer token.
 *
 * - `identity_required` (the cookie is missing or expired): claim again and retry
 *   once. The handler did not run, so nothing is sent twice.
 * - `token_invalid`/`token_expired` from the Worker: it is on the token path
 *   (identity.mode token, or no cookie secret), which the step 6 browser cannot
 *   take. An outage, like every other legacy answer.
 */

function tokenPathAsOutage(error: unknown): unknown {
  if (
    error instanceof ApiError
    && !(error instanceof ApiUnavailableError)
    && (error.code === "token_invalid" || error.code === "token_expired")
  ) {
    return new ApiUnavailableError(error.status, "unavailable");
  }
  return error;
}

export async function apiFetchAsUser<T>(
  group: ApiSurfaceGroup,
  path: string,
  init: Omit<ApiFetchInit, "token"> = {},
): Promise<T> {
  await ensureClaimedIdentity();
  try {
    return await apiFetch<T>(group, path, init);
  } catch (error) {
    if (!(error instanceof ApiError) || error.code !== "identity_required") throw tokenPathAsOutage(error);
  }
  await ensureClaimedIdentity({ force: true });
  try {
    return await apiFetch<T>(group, path, init);
  } catch (error) {
    throw tokenPathAsOutage(error);
  }
}
