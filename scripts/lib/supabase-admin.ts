/**
 * Server-only Supabase access of the operator tools, with the secret key the dev admin page has
 * always read from the server environment (.env.local): NEXT_PUBLIC_SUPABASE_URL and
 * SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY). Plain PostgREST over fetch, the requests
 * supabase-js made for these pages, so no supabase-js is needed on the dev server.
 *
 * A new-format key (sb_secret_) goes in apikey only; a legacy JWT key also as the bearer
 * (scripts/d1-sync/postgrest-reader.ts isNewFormatKey). The key is never logged.
 */
import { isNewFormatKey } from "../d1-sync/postgrest-reader";

export type SupabaseAdminConfig = { url: string; key: string };

export function supabaseAdminConfig(env: NodeJS.ProcessEnv = process.env): SupabaseAdminConfig | null {
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/+$/, "");
  const key = env.SUPABASE_SECRET_KEY?.trim() || env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  return { url, key };
}

export type RestFetch = (url: string, init: RequestInit) => Promise<Response>;

export interface RestRequest {
  /** HEAD: a count only (supabase-js `head: true`), read from Content-Range. */
  method: "GET" | "HEAD" | "POST" | "PATCH";
  /** Table or rpc/<function>. */
  path: string;
  query?: Record<string, string>;
  body?: unknown;
  prefer?: string[];
  /** application/vnd.pgrst.object+json for one row (supabase-js .single()). */
  accept?: string;
}

export type RestError = { code?: string; message: string };

export type RestResult =
  | { ok: true; status: number; data: unknown; count: number | null }
  | { ok: false; status: number; error: RestError };

/** supabase-timeout.ts SUPABASE_QUERY_TIMEOUT_MS, the dev pages' timeout. */
export const SUPABASE_ADMIN_TIMEOUT_MS = 8_000;

export function restUrl(config: SupabaseAdminConfig, request: RestRequest): string {
  const url = new URL(`${config.url}/rest/v1/${request.path}`);
  for (const [name, value] of Object.entries(request.query ?? {})) url.searchParams.set(name, value);
  return url.toString();
}

export function restHeaders(config: SupabaseAdminConfig, request: RestRequest): Record<string, string> {
  const headers: Record<string, string> = {
    apikey: config.key,
    accept: request.accept ?? "application/json",
  };
  if (!isNewFormatKey(config.key)) headers.authorization = `Bearer ${config.key}`;
  if (request.body !== undefined) headers["content-type"] = "application/json";
  if (request.prefer?.length) headers.prefer = request.prefer.join(",");
  return headers;
}

function countOf(response: Response): number | null {
  const range = response.headers.get("content-range");
  const total = range?.split("/")[1];
  return total && total !== "*" ? Number(total) : null;
}

/** One PostgREST call. Never throws for an HTTP or network failure: the result says what went wrong. */
export async function supabaseRest(
  config: SupabaseAdminConfig,
  request: RestRequest,
  options: { fetch?: RestFetch; timeoutMs?: number } = {},
): Promise<RestResult> {
  const fetcher: RestFetch = options.fetch ?? ((url, init) => fetch(url, init));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? SUPABASE_ADMIN_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetcher(restUrl(config, request), {
      method: request.method,
      headers: restHeaders(config, request),
      body: request.body === undefined ? undefined : JSON.stringify(request.body),
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timer);
    const message = controller.signal.aborted ? `${request.path} timed out` : (error as Error).message;
    return { ok: false, status: 0, error: { message } };
  }
  clearTimeout(timer);
  const text = await response.text().catch(() => "");
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!response.ok) {
    const body = (data && typeof data === "object" ? data : {}) as { code?: unknown; message?: unknown };
    return {
      ok: false,
      status: response.status,
      error: {
        code: typeof body.code === "string" ? body.code : undefined,
        message: typeof body.message === "string" ? body.message : `Supabase answered ${response.status}`,
      },
    };
  }
  return { ok: true, status: response.status, data, count: countOf(response) };
}
