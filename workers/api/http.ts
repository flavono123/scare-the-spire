/** Response helpers shared by every /api endpoint. */

export const NO_STORE = "no-store";

export type ApiErrorCode =
  | "invalid"
  | "unauthenticated"
  | "forbidden"
  | "cross_site"
  | "not_found"
  | "method_not_allowed"
  | "surface_legacy"
  | "too_large"
  | "check_violation"
  | "rate_limited"
  | "unavailable"
  | "not_configured";

const ERROR_STATUS: Record<ApiErrorCode, number> = {
  invalid: 400,
  unauthenticated: 401,
  forbidden: 403,
  cross_site: 403,
  not_found: 404,
  method_not_allowed: 405,
  surface_legacy: 409,
  too_large: 413,
  check_violation: 422,
  rate_limited: 429,
  unavailable: 503,
  not_configured: 503,
};

export const RETRY_AFTER_SECONDS = 30;

export function jsonResponse(
  body: unknown,
  init: { status?: number; cacheControl?: string; headers?: Record<string, string> } = {},
): Response {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", init.cacheControl ?? NO_STORE);
  headers.set("X-Robots-Tag", "noindex");
  return new Response(JSON.stringify(body), { status: init.status ?? 200, headers });
}

export function apiError(code: ApiErrorCode, headers: Record<string, string> = {}): Response {
  const status = ERROR_STATUS[code];
  const extra = status === 503 || status === 429
    ? { "Retry-After": String(RETRY_AFTER_SECONDS), ...headers }
    : headers;
  return jsonResponse({ error: code }, { status, headers: extra });
}

export function apiErrorStatus(code: ApiErrorCode): number {
  return ERROR_STATUS[code];
}

/** HEAD answers carry the GET headers without a body. */
export function withoutBody(response: Response): Response {
  return new Response(null, { status: response.status, statusText: response.statusText, headers: response.headers });
}
