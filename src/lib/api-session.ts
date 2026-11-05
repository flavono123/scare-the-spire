import { ApiError, apiFetch, type ApiFetchInit } from "@/lib/api-client";
import type { ApiSurfaceGroup } from "@/lib/api-surfaces";
import { supabase } from "@/lib/supabase";
import { SUPABASE_AUTH_TIMEOUT_MS, withSupabaseTimeout } from "@/lib/supabase-timeout";

/**
 * Calls a /api/me or /api/write endpoint with the Supabase access token
 * (docs/supabase-exit/STEP1_DESIGN.md 7). Auth stays on Supabase in step 1:
 * supabase-js keeps and refreshes the session, the Worker only verifies it.
 * `token_expired` refreshes once and retries once; `token_invalid` and 503 do not.
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
