/** Response helpers shared by every /api endpoint (docs/supabase-exit/STEP1_DESIGN.md 4.2). */

/**
 * Every router response carries this header. A /api response without it came
 * from a Worker with no router (rolled back to before step 1) or a Cloudflare
 * error page, and clients treat it as "use the legacy path".
 */
export const API_MARKER_HEADER = "X-Slseoun-Api";

export const PRIVATE_NO_STORE = "private, no-store";

export type ApiErrorCode =
  | "invalid"
  | "token_expired"
  | "token_invalid"
  | "forbidden"
  | "cross_site"
  | "not_found"
  | "method_not_allowed"
  | "surface_legacy"
  | "too_large"
  | "check_violation"
  | "duplicate"
  | "rate_limited"
  | "unavailable"
  | "auth_unavailable";

/** Why a call was sent back to the legacy path; logged, never acted on by clients. */
export type LegacyReason = "flag" | "no_route" | "not_configured" | "off" | "qa";

const ERROR_STATUS: Record<ApiErrorCode, number> = {
  invalid: 400,
  token_expired: 401,
  token_invalid: 401,
  forbidden: 403,
  cross_site: 403,
  not_found: 404,
  method_not_allowed: 405,
  surface_legacy: 409,
  too_large: 413,
  check_violation: 422,
  duplicate: 422,
  rate_limited: 429,
  unavailable: 503,
  auth_unavailable: 503,
};

export const RETRY_AFTER_SECONDS = 30;

export function jsonResponse(
  body: unknown,
  init: { status?: number; cacheControl?: string; headers?: Record<string, string> } = {},
): Response {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", init.cacheControl ?? PRIVATE_NO_STORE);
  headers.set("X-Robots-Tag", "noindex");
  headers.set(API_MARKER_HEADER, "1");
  return new Response(JSON.stringify(body), { status: init.status ?? 200, headers });
}

export function apiError(code: ApiErrorCode, headers: Record<string, string> = {}): Response {
  const status = ERROR_STATUS[code];
  const extra = status === 503 || status === 429
    ? { "Retry-After": String(RETRY_AFTER_SECONDS), ...headers }
    : headers;
  return jsonResponse({ error: code }, { status, headers: extra });
}

export function legacyResponse(reason: LegacyReason): Response {
  return jsonResponse({ error: "surface_legacy", reason }, { status: 409 });
}

/** HEAD answers carry the GET headers without a body. */
export function withoutBody(response: Response): Response {
  return new Response(null, { status: response.status, statusText: response.statusText, headers: response.headers });
}

/**
 * PostgREST's JSON body handed to the client by the runtime, with no JS
 * touching it: a JS pump over a 5.5 MB body cost 77-204 ms CPU on testbed
 * (STEP1_DESIGN 9.6). The body is PostgREST's array as is.
 */
export function passthroughJson(upstream: Response, env: string, status = 200): Response {
  return new Response(upstream.body, {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": PRIVATE_NO_STORE,
      "X-Robots-Tag": "noindex",
      "X-Slseoun-Api-Env": env,
      [API_MARKER_HEADER]: "1",
    },
  });
}
