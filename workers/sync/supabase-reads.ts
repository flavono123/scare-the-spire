import { supabaseRowColumns, tableHasEnv, type RowImage } from "../../src/lib/d1-sync/row-mapper";
import type { D1Value } from "../../src/lib/d1-sync/statements";
import {
  postgrest,
  postgrestStream,
  type Fetcher,
  type RestResult,
  type SupabaseApiConfig,
} from "../api/supabase-rest";

/**
 * The Supabase reads of the step-2 sync and read-after-write (docs/supabase-exit/D1_SCHEMA_DESIGN.md
 * 5.3), all with the service key through the step-1 PostgREST helpers. Every read is scoped to the
 * Worker's API_DATA_ENV (or env null for the tables without env).
 */

export type ReadOptions = { deadline?: number; fetcher?: Fetcher };

/** A d1_change_log row without its images (design 5.3 item 2, first pass). */
export type LogHeader = { id: number; table_name: string; op: string; row_bytes: number; changed_at: string };

/** A d1_change_log row with its images (second pass). */
export type LogBody = {
  id: number;
  table_name: string;
  op: string;
  new_row: RowImage | null;
  old_row: RowImage | null;
  heavy_changed: boolean;
  changed_at: string;
};

const LOG = "d1_change_log";

function envOrNull(config: SupabaseApiConfig): string {
  return `(env.eq.${config.dataEnv},env.is.null)`;
}

/** A PostgREST filter value for one key column. */
export function eqFilter(value: D1Value): string {
  return value === null ? "is.null" : `eq.${value}`;
}

/**
 * New and late rows in one read: id > low_watermark and not yet applied (applied_above), oldest
 * first. Late-committed rows of the window (items 3) come first because their ids are lower; rows
 * above high_seen are the new page (item 2). With `upTo` the read stays inside the window
 * (applied_above is nearly full: high_seen stops moving).
 */
export function readLogHeaders(
  config: SupabaseApiConfig,
  window: { low: number; applied: readonly number[]; upTo?: number; limit: number },
  options: ReadOptions = {},
): Promise<RestResult<LogHeader[]>> {
  const query = new URLSearchParams({ select: "id,table_name,op,row_bytes,changed_at" });
  query.append("id", `gt.${window.low}`);
  if (window.applied.length > 0) query.append("id", `not.in.(${window.applied.join(",")})`);
  if (window.upTo !== undefined) query.append("id", `lte.${window.upTo}`);
  query.set("or", envOrNull(config));
  query.set("order", "id.asc");
  query.set("limit", String(window.limit));
  return postgrest<LogHeader[]>(config, { path: LOG, query, ...options });
}

/** The images of the chosen rows, by id (they already passed the env filter). */
export function readLogBodies(
  config: SupabaseApiConfig,
  ids: readonly number[],
  maxBytes: number,
  options: ReadOptions = {},
): Promise<RestResult<LogBody[]>> {
  const query = new URLSearchParams({
    select: "id,table_name,op,new_row,old_row,heavy_changed,changed_at",
    id: `in.(${ids.join(",")})`,
    order: "id.asc",
  });
  return postgrest<LogBody[]>(config, { path: LOG, query, maxBytes, ...options });
}

/**
 * The largest log id in (low, high] whose changed_at is older than `before`, any env: the watermark
 * may pass every id up to it (design 5.3 item 10, the 5-minute rule). null when there is none.
 */
export async function readCutoffId(
  config: SupabaseApiConfig,
  range: { low: number; high: number },
  before: string,
  options: ReadOptions = {},
): Promise<RestResult<number | null>> {
  const query = new URLSearchParams({ select: "id" });
  query.append("id", `gt.${range.low}`);
  query.append("id", `lte.${range.high}`);
  query.set("changed_at", `lt.${before}`);
  query.set("order", "id.desc");
  query.set("limit", "1");
  const result = await postgrest<{ id: number }[]>(config, { path: LOG, query, ...options });
  if (!result.ok) return result;
  const id = result.data?.[0]?.id;
  return { ...result, data: typeof id === "number" ? id : null };
}

/** The current Supabase row of a table by its key (no raw for runs), or null when it is gone. */
export async function readCurrentRow(
  config: SupabaseApiConfig,
  table: string,
  match: Record<string, D1Value>,
  options: ReadOptions = {},
): Promise<RestResult<RowImage | null>> {
  const query = new URLSearchParams({ select: supabaseRowColumns(table).join(",") });
  for (const [column, value] of Object.entries(match)) query.set(column, eqFilter(value));
  if (tableHasEnv(table)) query.set("env", `eq.${config.dataEnv}`);
  query.set("limit", "1");
  const result = await postgrest<RowImage[]>(config, { path: table, query, ...options });
  if (!result.ok) return result;
  return { ...result, data: result.data?.[0] ?? null };
}

/** The newest row of a table matching `match` by `order` (a write whose key Supabase generated). */
export async function readNewestRow(
  config: SupabaseApiConfig,
  table: string,
  match: Record<string, D1Value>,
  order: string,
  options: ReadOptions = {},
): Promise<RestResult<RowImage | null>> {
  const query = new URLSearchParams({ select: supabaseRowColumns(table).join(",") });
  for (const [column, value] of Object.entries(match)) query.set(column, eqFilter(value));
  if (tableHasEnv(table)) query.set("env", `eq.${config.dataEnv}`);
  query.set("order", order);
  query.set("limit", "1");
  const result = await postgrest<RowImage[]>(config, { path: table, query, ...options });
  if (!result.ok) return result;
  return { ...result, data: result.data?.[0] ?? null };
}

/** Rows of a table by a list of ids (run uploads), this env only. */
export function readRowsByIds(
  config: SupabaseApiConfig,
  table: string,
  ids: readonly string[],
  options: ReadOptions = {},
): Promise<RestResult<RowImage[]>> {
  const query = new URLSearchParams({
    select: supabaseRowColumns(table).join(","),
    id: `in.(${ids.map((id) => `"${id}"`).join(",")})`,
  });
  if (tableHasEnv(table)) query.set("env", `eq.${config.dataEnv}`);
  return postgrest<RowImage[]>(config, { path: table, query, ...options });
}

/**
 * The env of a post in any env (FK children, design 2.2 and 5.3 item 7): a string, or null when the
 * post is in no env at all.
 */
export async function readPostEnv(
  config: SupabaseApiConfig,
  table: string,
  id: string,
  options: ReadOptions = {},
): Promise<RestResult<string | null>> {
  const query = new URLSearchParams({ select: "env", id: `eq.${id}`, limit: "1" });
  const result = await postgrest<{ env: string | null }[]>(config, { path: table, query, ...options });
  if (!result.ok) return result;
  const env = result.data?.[0]?.env;
  return { ...result, data: typeof env === "string" ? env : null };
}

/** Whether a post exists in this env (an orphan 조각모음 body check, design 5.3 item 8). */
export async function postExists(
  config: SupabaseApiConfig,
  table: string,
  id: string,
  options: ReadOptions = {},
): Promise<RestResult<boolean>> {
  const query = new URLSearchParams({ select: "id", id: `eq.${id}`, env: `eq.${config.dataEnv}`, limit: "1" });
  const result = await postgrest<{ id: string }[]>(config, { path: table, query, ...options });
  if (!result.ok) return result;
  return { ...result, data: (result.data ?? []).length > 0 };
}

export type RawText = { ok: true; text: string; bytes: number } | { ok: false; code: string; status: number };

/** Reads a body as UTF-8 text counting bytes; null past `maxBytes`. */
async function readTextCapped(response: Response, maxBytes: number): Promise<{ text: string; bytes: number } | null> {
  const declared = Number(response.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > maxBytes) {
    void response.body?.cancel().catch(() => undefined);
    return null;
  }
  if (!response.body) return { text: "", bytes: 0 };
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
  return { text: new TextDecoder().decode(bytes), bytes: size };
}

/**
 * One run's raw file as text (design 5.3 item 9): one column, Accept: text/plain, the body bound
 * as it arrives (no JSON.parse). An empty body means no such run in this env.
 */
export async function fetchRunRaw(
  config: SupabaseApiConfig,
  id: string,
  maxBytes: number,
  options: ReadOptions = {},
): Promise<RawText> {
  const result = await postgrestStream(config, {
    path: "runs",
    query: new URLSearchParams({ select: "raw", id: `eq.${id}`, env: `eq.${config.dataEnv}` }),
    accept: "text/plain",
    ...options,
  });
  if (!result.ok) return { ok: false, code: result.code, status: result.status };
  try {
    const read = await readTextCapped(result.response, maxBytes);
    if (!read) return { ok: false, code: "too_large", status: result.status };
    return { ok: true, ...read };
  } catch {
    return { ok: false, code: "network", status: result.status };
  }
}

/**
 * The daily cleanup (design 5.3 item 12): this env's rows and the env-less rows older than 7 days,
 * never above this D1's low watermark (a sync that was off keeps its unread rows).
 */
export function deleteOldLogRows(
  config: SupabaseApiConfig,
  upTo: number,
  before: string,
  options: ReadOptions = {},
): Promise<RestResult<null>> {
  const query = new URLSearchParams({ changed_at: `lt.${before}`, id: `lte.${upTo}`, or: envOrNull(config) });
  return postgrest<null>(config, { method: "DELETE", path: LOG, query, prefer: ["return=minimal"], ...options });
}
