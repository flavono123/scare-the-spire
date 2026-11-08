import type { ApiSurfaceGroup } from "@/lib/api-surfaces";
import { demoteSurface } from "@/lib/runtime-flags";
import { WRITE_PAUSED_ERROR } from "@/lib/write-source-flags";

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

/**
 * 503 write_paused: the step 5 cutover holds writes for a few seconds (at most about a minute) and
 * the write certainly did nothing, so it is sent again after Retry-After. Thrown only when the
 * total wait would pass WRITE_PAUSE_MAX_WAIT_MS.
 */
export class WritePausedError extends ApiUnavailableError {
  constructor(readonly retryAfterMs: number) {
    super(503, WRITE_PAUSED_ERROR);
    this.name = "WritePausedError";
  }
}

export const WRITE_PAUSE_MAX_WAIT_MS = 90_000;

function retryAfterMs(response: Response): number {
  const seconds = Number(response.headers.get("retry-after") ?? "");
  return Math.min(10, Math.max(1, Number.isFinite(seconds) ? seconds : 3)) * 1000;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new ApiUnavailableError(0, "timeout"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * A v1-shaped answer this client does not understand is a legacy signal
 * (docs/supabase-exit/STEP1_DESIGN.md 9): demote the group for the page and
 * throw so the caller redoes its legacy query. Pass `processed` for the answer
 * to a write: the router answered 2xx, so the write ran and must not be resent.
 */
export function requireApiVersion(group: ApiSurfaceGroup, body: { v?: unknown } | null | undefined, processed = false): void {
  if (body?.v === 1) return;
  demoteSurface(group);
  throw new SurfaceLegacyError(200, processed);
}

/** True when a failed api call should be redone on the legacy path. */
export function shouldUseLegacy(error: unknown): boolean {
  return error instanceof SurfaceLegacyError;
}

/** True when a failed api write certainly did nothing, so legacy may send it once. */
export function writeMayGoLegacy(error: unknown): boolean {
  return error instanceof SurfaceLegacyError && !error.processed;
}

export const API_TIMEOUT_MS = 8000;

export type ApiFetchInit = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  /** A body already serialized as JSON text, sent as is (the step 5 run share). */
  rawBody?: string;
  /** Extra request headers. */
  headers?: Record<string, string>;
  /** Supabase access token for writes and /api/me reads. */
  token?: string | null;
  timeoutMs?: number;
  signal?: AbortSignal;
};

export async function apiFetch<T>(group: ApiSurfaceGroup, path: string, init: ApiFetchInit = {}): Promise<T> {
  let waited = 0;
  for (;;) {
    try {
      return await apiFetchOnce<T>(group, path, init);
    } catch (error) {
      if (!(error instanceof WritePausedError) || waited + error.retryAfterMs > WRITE_PAUSE_MAX_WAIT_MS || init.signal?.aborted) {
        throw error;
      }
      waited += error.retryAfterMs;
      await sleep(error.retryAfterMs, init.signal);
    }
  }
}

async function apiFetchOnce<T>(group: ApiSurfaceGroup, path: string, init: ApiFetchInit): Promise<T> {
  if (!path.startsWith("/api/")) throw new Error(`api path must be absolute: ${path}`);
  const method = init.method ?? "GET";
  const headers: Record<string, string> = { ...(init.headers ?? {}), Accept: "application/json" };
  if (init.body !== undefined || init.rawBody !== undefined) headers["Content-Type"] = "application/json";
  if (init.token) headers.Authorization = `Bearer ${init.token}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), init.timeoutMs ?? API_TIMEOUT_MS);
  const abortFromCaller = () => controller.abort();
  init.signal?.addEventListener("abort", abortFromCaller, { once: true });

  let response: Response;
  let payload: unknown = null;
  try {
    try {
      response = await fetch(path, {
        method,
        headers,
        body: init.rawBody ?? (init.body === undefined ? undefined : JSON.stringify(init.body)),
        credentials: "same-origin",
        signal: controller.signal,
      });
    } catch {
      throw new ApiUnavailableError(0, controller.signal.aborted ? "timeout" : "unavailable");
    }

    if (response.headers.get(API_MARKER_HEADER) !== "1") {
      // No router answered. A 404/405 from an old Worker certainly did nothing;
      // after a Cloudflare 5xx a write may have run, so it is not resent.
      const processed = method !== "GET" && !(response.status === 404 || response.status === 405);
      demoteSurface(group);
      void response.body?.cancel().catch(() => undefined);
      throw new SurfaceLegacyError(response.status, processed);
    }

    if (response.status === 204) return undefined as T;
    // The same deadline covers the body: a stalled body must not hang every caller.
    try {
      payload = await response.json();
    } catch {
      throw new ApiUnavailableError(response.status, controller.signal.aborted ? "timeout" : "bad_response");
    }
  } finally {
    clearTimeout(timeout);
    init.signal?.removeEventListener("abort", abortFromCaller);
  }

  if (response.ok) return payload as T;
  const code = typeof (payload as { error?: unknown })?.error === "string"
    ? (payload as { error: string }).error
    : `http_${response.status}`;
  if (response.status === 409 && code === "surface_legacy") {
    demoteSurface(group);
    throw new SurfaceLegacyError(409, false);
  }
  if (response.status === 503 && code === WRITE_PAUSED_ERROR && method !== "GET") {
    throw new WritePausedError(retryAfterMs(response));
  }
  if (response.status >= 500) throw new ApiUnavailableError(response.status, code);
  throw new ApiError(response.status, code);
}
