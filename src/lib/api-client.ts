import type { ApiSurfaceGroup } from "@/lib/api-surfaces";
import { demoteSurface } from "@/lib/runtime-flags";

/**
 * Browser client for the same-origin Worker API (docs/supabase-exit/STEP1_DESIGN.md 4.3, 7).
 *
 * Legacy signals: 409 surface_legacy, or any /api response without the router
 * marker header (a Worker rolled back to before step 1 answers /api with an
 * HTML 404). Both demote the group for this page and throw SurfaceLegacyError;
 * callers then redo the call on the legacy path. Outages are not legacy
 * signals: the legacy path would only ask the same Supabase again.
 */

export const API_MARKER_HEADER = "X-Slseoun-Api";

export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string) {
    super(`api ${status} ${code}`);
    this.name = "ApiError";
  }
}

/**
 * The Worker cannot serve this call: use the legacy path. `processed` is false
 * when the request certainly did nothing, so a write may be resent on legacy.
 */
export class SurfaceLegacyError extends ApiError {
  constructor(status: number, readonly processed: boolean) {
    super(status, "surface_legacy");
    this.name = "SurfaceLegacyError";
  }
}

/** Network failure, timeout, or a 5xx from the router. */
export class ApiUnavailableError extends ApiError {
  constructor(status: number, code = "unavailable") {
    super(status, code);
    this.name = "ApiUnavailableError";
  }
}

export const API_TIMEOUT_MS = 8000;

export type ApiFetchInit = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  /** Supabase access token for writes and /api/me reads. */
  token?: string | null;
  timeoutMs?: number;
  signal?: AbortSignal;
};

export async function apiFetch<T>(group: ApiSurfaceGroup, path: string, init: ApiFetchInit = {}): Promise<T> {
  if (!path.startsWith("/api/")) throw new Error(`api path must be absolute: ${path}`);
  const method = init.method ?? "GET";
  const headers: Record<string, string> = { Accept: "application/json" };
  if (init.body !== undefined) headers["Content-Type"] = "application/json";
  if (init.token) headers.Authorization = `Bearer ${init.token}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), init.timeoutMs ?? API_TIMEOUT_MS);
  const abortFromCaller = () => controller.abort();
  init.signal?.addEventListener("abort", abortFromCaller, { once: true });

  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      credentials: "same-origin",
      signal: controller.signal,
    });
  } catch {
    throw new ApiUnavailableError(0);
  } finally {
    clearTimeout(timeout);
    init.signal?.removeEventListener("abort", abortFromCaller);
  }

  if (response.headers.get(API_MARKER_HEADER) !== "1") {
    // No router answered. A 404/405 from an old Worker certainly did nothing;
    // after a Cloudflare 5xx a write may have run, so it is not resent.
    const processed = method !== "GET" && !(response.status === 404 || response.status === 405);
    demoteSurface(group);
    throw new SurfaceLegacyError(response.status, processed);
  }

  if (response.status === 204) return undefined as T;
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    throw new ApiUnavailableError(response.status, "bad_response");
  }

  if (response.ok) return payload as T;
  const code = typeof (payload as { error?: unknown })?.error === "string"
    ? (payload as { error: string }).error
    : `http_${response.status}`;
  if (response.status === 409 && code === "surface_legacy") {
    demoteSurface(group);
    throw new SurfaceLegacyError(409, false);
  }
  if (response.status >= 500) throw new ApiUnavailableError(response.status, code);
  throw new ApiError(response.status, code);
}
