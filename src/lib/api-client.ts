import type { ApiSurfaceGroup } from "@/lib/api-surfaces";
import { WRITE_PAUSED_ERROR } from "@/lib/write-source-flags";

/**
 * Browser client for the same-origin Worker API (docs/supabase-exit/STEP1_DESIGN.md 4.3, 7).
 *
 * Step 6 (docs/supabase-exit/STEP6_PLAN.md 1.1, WP0): the browser has no legacy
 * path. What used to be a legacy signal is an outage, thrown as ApiUnavailableError
 * so the screen shows its "database is not answering" state:
 * - an /api answer without the router marker header (a platform error page, or a
 *   Worker rolled back to before step 1): code `no_marker`;
 * - 409 surface_legacy (the Worker's flags are off, or the QA cookie): code `surface_legacy`;
 * - a v1-shaped answer of another version (requireApiVersion): code `bad_version`.
 * A write keeps today's code `unavailable` for the first two, as the production
 * build (direct writes closed) already answered. Nothing is resent and no group
 * is demoted. No call carries a bearer token: the identity is the Worker's signed
 * cookie (src/lib/api-session.ts).
 */

export const API_MARKER_HEADER = "X-Slseoun-Api";

export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string) {
    super(`api ${status} ${code}`);
    this.name = "ApiError";
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
 * A v1-shaped answer this client does not understand (docs/supabase-exit/STEP1_DESIGN.md 9)
 * is an outage: ApiUnavailableError `bad_version`. `group` and `processed` (the
 * answer to a write, which ran) no longer change anything; the callers still name
 * them, as they name the group in apiFetch.
 */
export function requireApiVersion(group: ApiSurfaceGroup, body: { v?: unknown } | null | undefined, processed = false): void {
  void group;
  void processed;
  if (body?.v === 1) return;
  throw new ApiUnavailableError(200, "bad_version");
}

export const API_TIMEOUT_MS = 8000;

export type ApiFetchInit = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  /** A body already serialized as JSON text, sent as is (the step 5 run share). */
  rawBody?: string;
  /** Extra request headers. */
  headers?: Record<string, string>;
  timeoutMs?: number;
  signal?: AbortSignal;
  /** "text": a 2xx body is returned as text (the run raw file, R3r); errors are still JSON. */
  responseType?: "json" | "text";
};

/** `group` is the caller's flag group; the Worker routes by path, so it decides nothing here any more. */
export async function apiFetch<T>(group: ApiSurfaceGroup, path: string, init: ApiFetchInit = {}): Promise<T> {
  void group;
  let waited = 0;
  for (;;) {
    try {
      return await apiFetchOnce<T>(path, init);
    } catch (error) {
      if (!(error instanceof WritePausedError) || waited + error.retryAfterMs > WRITE_PAUSE_MAX_WAIT_MS || init.signal?.aborted) {
        throw error;
      }
      waited += error.retryAfterMs;
      await sleep(error.retryAfterMs, init.signal);
    }
  }
}

async function apiFetchOnce<T>(path: string, init: ApiFetchInit): Promise<T> {
  if (!path.startsWith("/api/")) throw new Error(`api path must be absolute: ${path}`);
  const method = init.method ?? "GET";
  const asText = init.responseType === "text";
  const headers: Record<string, string> = { ...(init.headers ?? {}), Accept: asText ? "text/plain" : "application/json" };
  if (init.body !== undefined || init.rawBody !== undefined) headers["Content-Type"] = "application/json";

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
      // No router answered (a platform error page, or a Worker from before step 1). After a
      // Cloudflare 5xx a write may have run, so nothing is resent.
      void response.body?.cancel().catch(() => undefined);
      throw new ApiUnavailableError(response.status, method === "GET" ? "no_marker" : "unavailable");
    }

    if (response.status === 204) return undefined as T;
    // The same deadline covers the body: a stalled body must not hang every caller.
    try {
      payload = asText && response.ok ? await response.text() : await response.json();
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
    throw new ApiUnavailableError(409, method === "GET" ? "surface_legacy" : "unavailable");
  }
  if (response.status === 503 && code === WRITE_PAUSED_ERROR && method !== "GET") {
    throw new WritePausedError(retryAfterMs(response));
  }
  if (response.status >= 500) throw new ApiUnavailableError(response.status, code);
  throw new ApiError(response.status, code);
}
