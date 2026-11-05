/**
 * The step 1 storage adapter: plain `fetch` calls to Supabase PostgREST (no
 * supabase-js, to keep the Worker small). Every call is scoped to the Worker's
 * own data env; endpoints never take `env` or a user id from the client.
 */

export type ApiDataEnv = "production" | "development";

export type SupabaseApiEnv = {
  API_SUPABASE_URL?: string;
  API_SUPABASE_KEY?: string;
  API_DATA_ENV?: string;
};

export type SupabaseApiConfig = {
  url: string;
  key: string;
  dataEnv: ApiDataEnv;
};

export type Fetcher = (input: Request | string | URL, init?: RequestInit) => Promise<Response>;

export function supabaseApiConfig(env: SupabaseApiEnv): SupabaseApiConfig | null {
  const url = (env.API_SUPABASE_URL ?? "").trim().replace(/\/+$/, "");
  const key = (env.API_SUPABASE_KEY ?? "").trim();
  const dataEnv = (env.API_DATA_ENV ?? "").trim();
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url) && !/^http:\/\/(?:127\.0\.0\.1|localhost):\d+$/.test(url)) {
    return null;
  }
  if (!key) return null;
  if (dataEnv !== "production" && dataEnv !== "development") return null;
  return { url, key, dataEnv };
}

export function supabaseIssuer(config: SupabaseApiConfig): string {
  return `${config.url}/auth/v1`;
}

export type RestSuccess<T> = { ok: true; status: number; data: T; contentRange: string | null };
export type RestFailure = {
  ok: false;
  status: number;
  /** PostgREST/Postgres code (e.g. 42501, 23514, PGRST116), or timeout, network, bad_response, http_<status>. */
  code: string;
  message: string;
};
export type RestResult<T> = RestSuccess<T> | RestFailure;

export type RestRequest = {
  method?: "GET" | "HEAD" | "POST" | "PATCH" | "DELETE";
  /** `table` or `rpc/function`. */
  path: string;
  query?: URLSearchParams;
  body?: unknown;
  /** A verified user access token; omitted for public reads. */
  token?: string | null;
  prefer?: string[];
  timeoutMs?: number;
  fetcher?: Fetcher;
};

export const READ_TIMEOUT_MS = 4000;
export const WRITE_TIMEOUT_MS = 6000;

const PATH = /^(?:rpc\/)?[a-z_][a-z0-9_]*$/;

export async function postgrest<T>(config: SupabaseApiConfig, request: RestRequest): Promise<RestResult<T>> {
  if (!PATH.test(request.path)) throw new Error(`invalid PostgREST path: ${request.path}`);
  const method = request.method ?? "GET";
  const url = new URL(`${config.url}/rest/v1/${request.path}`);
  if (request.query) url.search = request.query.toString();

  const headers = new Headers({ apikey: config.key, Accept: "application/json" });
  // The publishable key is not a JWT; only a user token goes in Authorization.
  if (request.token) headers.set("Authorization", `Bearer ${request.token}`);
  if (request.prefer?.length) headers.set("Prefer", request.prefer.join(","));
  let body: string | undefined;
  if (request.body !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(request.body);
  }

  const timeoutMs = request.timeoutMs ?? (method === "GET" || method === "HEAD" ? READ_TIMEOUT_MS : WRITE_TIMEOUT_MS);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const fetcher: Fetcher = request.fetcher ?? ((input, init) => fetch(input, init));

  let response: Response;
  try {
    response = await fetcher(url.toString(), { method, headers, body, signal: controller.signal });
  } catch (error) {
    clearTimeout(timer);
    const aborted = controller.signal.aborted;
    return {
      ok: false,
      status: 0,
      code: aborted ? "timeout" : "network",
      message: aborted ? `timed out after ${timeoutMs} ms` : String((error as Error)?.message ?? error),
    };
  }

  try {
    const text = method === "HEAD" ? "" : await response.text();
    clearTimeout(timer);
    let parsed: unknown = null;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        return { ok: false, status: response.status, code: "bad_response", message: "response was not JSON" };
      }
    }
    if (!response.ok) {
      const error = (parsed && typeof parsed === "object" ? parsed : {}) as { code?: unknown; message?: unknown };
      return {
        ok: false,
        status: response.status,
        code: typeof error.code === "string" && error.code ? error.code : `http_${response.status}`,
        message: typeof error.message === "string" ? error.message : "",
      };
    }
    return { ok: true, status: response.status, data: parsed as T, contentRange: response.headers.get("content-range") };
  } catch (error) {
    clearTimeout(timer);
    const aborted = controller.signal.aborted;
    return {
      ok: false,
      status: response.status,
      code: aborted ? "timeout" : "network",
      message: String((error as Error)?.message ?? error),
    };
  }
}

/** True when Supabase itself is unhealthy, as opposed to rejecting the request. */
export function isUpstreamFailure(result: RestFailure): boolean {
  return result.status === 0 || result.status >= 500 || result.code === "bad_response";
}
