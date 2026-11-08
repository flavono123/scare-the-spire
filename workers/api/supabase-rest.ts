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
  /**
   * Step 4 worker write mode (workers/api/write-gate): calls that carry a user
   * token go to the gate, which checks them and writes with the service key.
   * Unset on the rls path, so those calls go out exactly as before.
   */
  writeGate?: WriteGateHook;
};

export type WriteGateHook = {
  postgrest(request: RestRequest): Promise<RestResult<unknown>>;
  stream(request: StreamRequest): Promise<StreamResult>;
};

export type Fetcher = (input: Request | string | URL, init?: RequestInit) => Promise<Response>;

export function supabaseApiConfig(env: SupabaseApiEnv): SupabaseApiConfig | null {
  const url = (env.API_SUPABASE_URL ?? "").trim().replace(/\/+$/, "");
  const key = (env.API_SUPABASE_KEY ?? "").trim();
  const dataEnv = (env.API_DATA_ENV ?? "").trim();
  // A project URL, or a local stub server in specs and `wrangler dev`.
  if (!/^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(url) && !/^http:\/\/(?:127\.0\.0\.1|localhost):\d+$/.test(url)) {
    return null;
  }
  // Only the publishable key: a secret key would bypass RLS.
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) return null;
  if (dataEnv !== "production" && dataEnv !== "development") return null;
  return { url, key, dataEnv };
}

export function supabaseIssuer(config: SupabaseApiConfig): string {
  return `${config.url}/auth/v1`;
}

export type RestSuccess<T> = { ok: true; status: number; data: T; contentRange: string | null };
/**
 * PostgREST/Postgres `code` (e.g. 42501, 23514, PGRST116), or timeout, network,
 * bad_response, http_<status>. PostgREST's message/details/hint are dropped on
 * purpose: they carry row content (nicknames, comment text, user ids).
 */
export type RestFailure = {
  ok: false;
  status: number;
  code: string;
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
  /**
   * Epoch ms by which the whole endpoint must be done. The call gets at most
   * the time left, and is not sent at all when less than MIN_CALL_MS is left.
   */
  deadline?: number;
  /** Largest response body read; past it the call fails with `too_large`. */
  maxBytes?: number;
  fetcher?: Fetcher;
};

export const READ_TIMEOUT_MS = 4000;
export const WRITE_TIMEOUT_MS = 6000;
export const MIN_CALL_MS = 150;
/** Default body cap: every step 1 response is far smaller (comments rows are at most 128 KB each). */
export const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;

/** Reads a body counting bytes as they arrive; null when it passes `maxBytes`. */
async function readCapped(response: Response, maxBytes: number): Promise<string | null> {
  const declared = Number(response.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > maxBytes) {
    void response.body?.cancel().catch(() => undefined);
    return null;
  }
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      void reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

const PATH = /^(?:rpc\/)?[a-z_][a-z0-9_]*$/;

/** PostgREST select lists carry no whitespace (supabase-js strips it the same way). */
function compactQuery(query: URLSearchParams | undefined): string {
  if (!query) return "";
  const copy = new URLSearchParams(query);
  const select = copy.get("select");
  if (select !== null) copy.set("select", select.replace(/\s+/g, ""));
  return copy.toString();
}

export async function postgrest<T>(config: SupabaseApiConfig, request: RestRequest): Promise<RestResult<T>> {
  if (!PATH.test(request.path)) throw new Error(`invalid PostgREST path: ${request.path}`);
  if (config.writeGate && request.token) return config.writeGate.postgrest(request) as Promise<RestResult<T>>;
  const method = request.method ?? "GET";
  const url = new URL(`${config.url}/rest/v1/${request.path}`);
  if (request.query) url.search = compactQuery(request.query);

  const headers = new Headers({ apikey: config.key, Accept: "application/json" });
  // The publishable key is not a JWT; only a user token goes in Authorization.
  if (request.token) headers.set("Authorization", `Bearer ${request.token}`);
  if (request.prefer?.length) headers.set("Prefer", request.prefer.join(","));
  let body: string | undefined;
  if (request.body !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(request.body);
  }

  let timeoutMs = request.timeoutMs ?? (method === "GET" || method === "HEAD" ? READ_TIMEOUT_MS : WRITE_TIMEOUT_MS);
  if (request.deadline !== undefined) {
    const left = request.deadline - Date.now();
    if (left < MIN_CALL_MS) return { ok: false, status: 0, code: "timeout" };
    timeoutMs = Math.min(timeoutMs, left);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const fetcher: Fetcher = request.fetcher ?? ((input, init) => fetch(input, init));

  let response: Response;
  try {
    response = await fetcher(url.toString(), { method, headers, body, signal: controller.signal });
  } catch (error) {
    clearTimeout(timer);
    void error;
    return { ok: false, status: 0, code: controller.signal.aborted ? "timeout" : "network" };
  }

  try {
    const text = method === "HEAD" ? "" : await readCapped(response, request.maxBytes ?? DEFAULT_MAX_BYTES);
    clearTimeout(timer);
    if (text === null) return { ok: false, status: response.status, code: "too_large" };
    let parsed: unknown = null;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        return { ok: false, status: response.status, code: "bad_response" };
      }
    }
    if (!response.ok) {
      const error = (parsed && typeof parsed === "object" ? parsed : {}) as { code?: unknown };
      return {
        ok: false,
        status: response.status,
        code: typeof error.code === "string" && /^[A-Z0-9]{1,16}$/.test(error.code) ? error.code : `http_${response.status}`,
      };
    }
    return { ok: true, status: response.status, data: parsed as T, contentRange: response.headers.get("content-range") };
  } catch {
    clearTimeout(timer);
    return { ok: false, status: response.status, code: controller.signal.aborted ? "timeout" : "network" };
  }
}

/**
 * Runs tasks at most `limit` at a time. Workers keep only six connections
 * waiting for headers per invocation and queue the rest while their timers
 * run, so endpoints send PostgREST calls in waves of five.
 */
export async function inWaves<T>(tasks: readonly (() => Promise<T>)[], limit = 5): Promise<T[]> {
  const results = new Array<T>(tasks.length);
  let next = 0;
  async function worker() {
    while (next < tasks.length) {
      const index = next;
      next += 1;
      results[index] = await tasks[index]();
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
}

/** True when Supabase itself is unhealthy, as opposed to rejecting the request. */
export function isUpstreamFailure(result: RestFailure): boolean {
  return result.status === 0 || result.status >= 500 || result.code === "bad_response";
}

export type StreamRequest = Omit<RestRequest, "maxBytes"> & {
  /** A JSON body passed through without parsing (run uploads carry raw run files). */
  bodyStream?: ReadableStream<Uint8Array> | null;
  /** Accept header; default application/json (the step-2 sync reads one run raw as text/plain). */
  accept?: string;
};

export type StreamResult = { ok: true; status: number; response: Response } | RestFailure;

/**
 * A PostgREST call whose response body is handed back unread, for answers too
 * big to parse inside the Worker's CPU budget (run lists with raw run files,
 * STEP1_DESIGN 9.6). The timeout covers the headers only; the client's own
 * timeout covers a stalled body. Failures are read (they are small) and mapped
 * like `postgrest`.
 */
export async function postgrestStream(config: SupabaseApiConfig, request: StreamRequest): Promise<StreamResult> {
  if (!PATH.test(request.path)) throw new Error(`invalid PostgREST path: ${request.path}`);
  if (config.writeGate && request.token) return config.writeGate.stream(request);
  const method = request.method ?? "GET";
  const url = new URL(`${config.url}/rest/v1/${request.path}`);
  if (request.query) url.search = compactQuery(request.query);
  const headers = new Headers({ apikey: config.key, Accept: request.accept ?? "application/json" });
  if (request.token) headers.set("Authorization", `Bearer ${request.token}`);
  if (request.prefer?.length) headers.set("Prefer", request.prefer.join(","));
  const textBody = request.bodyStream ? undefined : request.body !== undefined ? JSON.stringify(request.body) : undefined;
  if (request.bodyStream || textBody !== undefined) headers.set("Content-Type", "application/json");

  let timeoutMs = request.timeoutMs ?? (method === "GET" || method === "HEAD" ? READ_TIMEOUT_MS : WRITE_TIMEOUT_MS);
  if (request.deadline !== undefined) {
    const left = request.deadline - Date.now();
    if (left < MIN_CALL_MS) return { ok: false, status: 0, code: "timeout" };
    timeoutMs = Math.min(timeoutMs, left);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const fetcher: Fetcher = request.fetcher ?? ((input, init) => fetch(input, init));
  let response: Response;
  try {
    response = await fetcher(url.toString(), {
      method,
      headers,
      body: request.bodyStream ?? textBody,
      signal: controller.signal,
      // Node and Workers both need this for a streamed request body.
      ...(request.bodyStream ? { duplex: "half" } : {}),
    } as RequestInit);
  } catch {
    clearTimeout(timer);
    return { ok: false, status: 0, code: controller.signal.aborted ? "timeout" : "network" };
  }
  clearTimeout(timer);
  if (response.ok) return { ok: true, status: response.status, response };
  const text = await readCapped(response, 64 * 1024).catch(() => null);
  let code = `http_${response.status}`;
  try {
    const parsed = text ? JSON.parse(text) as { code?: unknown } : null;
    if (typeof parsed?.code === "string" && /^[A-Z0-9]{1,16}$/.test(parsed.code)) code = parsed.code;
  } catch {
    // Not JSON: keep http_<status>.
  }
  return { ok: false, status: response.status, code };
}
