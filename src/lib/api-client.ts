import type { ApiSurfaceGroup } from "@/lib/api-surfaces";
import { demoteSurface } from "@/lib/runtime-flags";

/**
 * Browser client for the same-origin Worker API (docs/supabase-exit/STEP1_DESIGN.md 7).
 * Only a 409 surface_legacy answer sends a caller back to the legacy path; on
 * outages the legacy path would only ask the same Supabase again, so callers
 * show their unavailable state instead.
 */

export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string) {
    super(`api ${status} ${code}`);
    this.name = "ApiError";
  }
}

/** The Worker turned this group back to the legacy path. */
export class SurfaceLegacyError extends ApiError {
  constructor() {
    super(409, "surface_legacy");
    this.name = "SurfaceLegacyError";
  }
}

/** Network failure, timeout, or a 5xx from the Worker. */
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
      method: init.method ?? "GET",
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

  if (response.status === 204) return undefined as T;
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    if (response.ok) throw new ApiUnavailableError(response.status, "bad_response");
  }

  if (response.ok) return payload as T;
  const code = typeof (payload as { error?: unknown })?.error === "string"
    ? (payload as { error: string }).error
    : `http_${response.status}`;
  if (response.status === 409 && code === "surface_legacy") {
    demoteSurface(group);
    throw new SurfaceLegacyError();
  }
  if (response.status >= 500) throw new ApiUnavailableError(response.status, code);
  throw new ApiError(response.status, code);
}
