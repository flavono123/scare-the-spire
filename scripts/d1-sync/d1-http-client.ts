/**
 * A small client for the Cloudflare D1 HTTP API (POST /accounts/{account}/d1/database/{id}/query),
 * for Node jobs outside the Worker (the daily reconcile and the run summary fill, design 5.4).
 * One statement per request; `fetch` is injected so specs run against a fake endpoint. The token
 * is only ever sent in the Authorization header, never logged or put in an error message.
 */
import type { D1Value } from "../../src/lib/d1-sync/statements";

export const CLOUDFLARE_API_BASE = "https://api.cloudflare.com/client/v4";

export interface FetchResponseLike {
  ok: boolean;
  status: number;
  text(): Promise<string>;
}

export type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body?: string },
) => Promise<FetchResponseLike>;

export interface D1QueryResult {
  rows: Array<Record<string, unknown>>;
  changes: number;
  rowsRead: number;
  rowsWritten: number;
}

export interface D1Usage {
  queries: number;
  rowsRead: number;
  rowsWritten: number;
}

export interface D1HttpClient {
  query(sql: string, params?: readonly D1Value[]): Promise<D1QueryResult>;
  readonly usage: D1Usage;
}

interface ApiMessage {
  code?: number;
  message?: string;
}

interface ApiBody {
  success?: boolean;
  errors?: ApiMessage[];
  result?: Array<{
    success?: boolean;
    results?: Array<Record<string, unknown>>;
    meta?: { changes?: number; rows_read?: number; rows_written?: number };
    error?: string;
  }>;
}

function describeErrors(body: ApiBody | null): string {
  const messages = (body?.errors ?? []).map((error) => `${error.code ?? ""} ${error.message ?? ""}`.trim());
  return messages.length > 0 ? messages.join("; ") : "no error message";
}

export function d1HttpClient(opts: {
  accountId: string;
  databaseId: string;
  token: string;
  fetch: FetchLike;
  base?: string;
}): D1HttpClient {
  const url =
    `${opts.base ?? CLOUDFLARE_API_BASE}/accounts/${encodeURIComponent(opts.accountId)}` +
    `/d1/database/${encodeURIComponent(opts.databaseId)}/query`;
  const usage: D1Usage = { queries: 0, rowsRead: 0, rowsWritten: 0 };
  return {
    usage,
    async query(sql, params = []) {
      const response = await opts.fetch(url, {
        method: "POST",
        headers: { authorization: `Bearer ${opts.token}`, "content-type": "application/json" },
        body: JSON.stringify({ sql, params }),
      });
      const text = await response.text();
      let body: ApiBody | null = null;
      try {
        body = JSON.parse(text) as ApiBody;
      } catch {
        body = null;
      }
      usage.queries += 1;
      const first = body?.result?.[0];
      if (!response.ok || !body?.success || !first || first.success === false) {
        throw new Error(`D1 HTTP API ${response.status}: ${first?.error ?? describeErrors(body)} (sql: ${sql.slice(0, 80)})`);
      }
      const meta = first.meta ?? {};
      const result: D1QueryResult = {
        rows: first.results ?? [],
        changes: Number(meta.changes ?? 0),
        rowsRead: Number(meta.rows_read ?? 0),
        rowsWritten: Number(meta.rows_written ?? 0),
      };
      usage.rowsRead += result.rowsRead;
      usage.rowsWritten += result.rowsWritten;
      return result;
    },
  };
}
