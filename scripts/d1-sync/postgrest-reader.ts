/**
 * Read-only PostgREST access with the Supabase service key, for the daily reconcile (design 5.4):
 * whole tables page by page (limit/offset over a stable order, until an empty page, so a lower
 * server row cap cannot cut a table short) and set-returning RPCs the same way. Only GET, plus POST
 * to /rpc/ for read-only functions. `fetch` is injected so specs run against a fake endpoint; the
 * key is only sent in headers, never logged.
 */
import type { FetchLike } from "./d1-http-client";

export interface PostgrestFilter {
  column: string;
  op: "eq" | "neq";
  value: string;
}

export interface PostgrestUsage {
  requests: number;
  bytes: number;
}

export interface PostgrestReader {
  /** Every row of a table (or a filtered embed), in `order`, `pageSize` rows per request. */
  selectAll(
    table: string,
    query: { select: string; filters: readonly PostgrestFilter[]; order: string; pageSize: number },
  ): Promise<Array<Record<string, unknown>>>;
  /** Every row a read-only set-returning function gives. */
  rpcAll(
    fn: string,
    args: Record<string, unknown>,
    query: { order: string; pageSize: number },
  ): Promise<Array<Record<string, unknown>>>;
  readonly usage: PostgrestUsage;
}

function filterParam(filter: PostgrestFilter): string {
  return `${encodeURIComponent(filter.column)}=${filter.op}.${encodeURIComponent(filter.value)}`;
}

export function postgrestReader(opts: { url: string; serviceKey: string; fetch: FetchLike }): PostgrestReader {
  const base = `${opts.url.replace(/\/+$/, "")}/rest/v1`;
  const usage: PostgrestUsage = { requests: 0, bytes: 0 };
  const headers = (json: boolean): Record<string, string> => ({
    apikey: opts.serviceKey,
    authorization: `Bearer ${opts.serviceKey}`,
    accept: "application/json",
    ...(json ? { "content-type": "application/json" } : {}),
  });

  async function page(url: string, init: { method: string; body?: string }): Promise<Array<Record<string, unknown>>> {
    const response = await opts.fetch(url, { method: init.method, headers: headers(init.body !== undefined), body: init.body });
    const text = await response.text();
    usage.requests += 1;
    usage.bytes += text.length;
    if (!response.ok) {
      let message = "";
      try {
        const body = JSON.parse(text) as { message?: string; code?: string };
        message = `${body.code ?? ""} ${body.message ?? ""}`.trim();
      } catch {
        message = "";
      }
      const path = url.slice(base.length).split("?")[0];
      throw new Error(`PostgREST ${response.status} on ${path}${message ? `: ${message}` : ""}`);
    }
    const rows = JSON.parse(text) as unknown;
    if (!Array.isArray(rows)) throw new Error(`PostgREST answer of ${url.slice(base.length).split("?")[0]} is not an array`);
    return rows as Array<Record<string, unknown>>;
  }

  async function all(build: (offset: number) => string, init: { method: string; body?: string }) {
    const out: Array<Record<string, unknown>> = [];
    for (let offset = 0; ; ) {
      const rows = await page(build(offset), init);
      if (rows.length === 0) return out;
      out.push(...rows);
      offset += rows.length;
    }
  }

  return {
    usage,
    selectAll(table, query) {
      const params = [`select=${encodeURIComponent(query.select)}`, ...query.filters.map(filterParam), `order=${query.order}`];
      return all((offset) => `${base}/${table}?${params.join("&")}&limit=${query.pageSize}&offset=${offset}`, { method: "GET" });
    },
    rpcAll(fn, args, query) {
      return all((offset) => `${base}/rpc/${fn}?order=${query.order}&limit=${query.pageSize}&offset=${offset}`, {
        method: "POST",
        body: JSON.stringify(args),
      });
    },
  };
}
