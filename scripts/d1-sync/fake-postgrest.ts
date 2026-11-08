/**
 * An in-memory PostgREST for the step-2 sync specs: Supabase tables with env, and a d1_change_log
 * written the way the d1_log_change() trigger writes it (supabase/migrations/*_d1_change_log.sql):
 * I = whole row, U = changed columns with the whole old row, D = old row, runs.raw left out with
 * heavy_changed, row_bytes = the two images' JSON bytes, comment_likes taking the comment's env.
 * It answers the filters the sync and read-after-write send (eq, neq, gt, gte, lt, lte, in, not.in,
 * is.null, or=(...), select, order, limit, Accept: text/plain) and counts every call.
 */
import type { Fetcher } from "../../workers/api/supabase-rest";
import { canonicalTs } from "../../src/lib/d1-time";

export type Row = Record<string, unknown>;

export type LogRow = {
  id: number;
  env: string | null;
  table_name: string;
  op: "I" | "U" | "D";
  new_row: Row | null;
  old_row: Row | null;
  heavy_changed: boolean;
  row_bytes: number;
  changed_at: string;
};

export type Call = { method: string; table: string; query: URLSearchParams; accept: string; apikey: string };

const HEAVY: Record<string, string[]> = { runs: ["raw"] };

/** Key columns per Supabase table (for update/delete helpers). */
const KEYS: Record<string, string[]> = {
  comment_likes: ["comment_id", "user_id"],
  likes: ["story_id", "user_id", "env"],
  resource_reactions: ["resource_id", "resource_type", "game_version", "user_id", "env"],
  resource_reaction_counts: ["resource_id", "resource_type", "game_version", "env"],
  this_or_that_post_votes: ["post_id", "user_id", "env"],
  this_or_that_post_likes: ["post_id", "user_id", "env"],
  favorite_tournament_candidate_stats: ["tournament_id", "resource_type", "resource_id", "env"],
  defragment_bodies: ["source_service", "source_id", "env"],
  profile_character_nickname_pools: ["character_id", "locale"],
  puzzlebox_players: ["user_id"],
  puzzlebox_best: ["game", "board", "user_id", "env"],
  puzzlebox_board_stats: ["game", "board", "env"],
};

function clone<T>(value: T): T {
  return value === undefined ? value : JSON.parse(JSON.stringify(value));
}

function bytes(value: unknown): number {
  return value === null || value === undefined ? 0 : Buffer.byteLength(JSON.stringify(value));
}

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Splits a PostgREST list `(a,b,"c,d")` into values. */
function listValues(text: string): string[] {
  const inner = text.replace(/^\(/, "").replace(/\)$/, "");
  const out: string[] = [];
  let current = "";
  let quoted = false;
  for (const ch of inner) {
    if (ch === '"') {
      quoted = !quoted;
      continue;
    }
    if (ch === "," && !quoted) {
      out.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  if (inner.length > 0) out.push(current);
  return out;
}

function compare(a: unknown, b: string, column: string): number {
  if (column.endsWith("_at") && typeof a === "string") {
    const left = Date.parse(`${(canonicalTs(a) ?? a).slice(0, 23)}Z`);
    const right = Date.parse(b);
    return left - right;
  }
  if (typeof a === "number") return a - Number(b);
  return String(a) < b ? -1 : String(a) > b ? 1 : 0;
}

function matches(row: Row, column: string, filter: string): boolean {
  const value = row[column];
  if (filter.startsWith("not.")) return !matches(row, column, filter.slice(4));
  const dot = filter.indexOf(".");
  const op = filter.slice(0, dot);
  const operand = filter.slice(dot + 1);
  switch (op) {
    case "eq":
      return value !== null && value !== undefined && String(value) === operand;
    case "neq":
      return value !== null && value !== undefined && String(value) !== operand;
    case "gt":
      return value !== null && value !== undefined && compare(value, operand, column) > 0;
    case "gte":
      return value !== null && value !== undefined && compare(value, operand, column) >= 0;
    case "lt":
      return value !== null && value !== undefined && compare(value, operand, column) < 0;
    case "lte":
      return value !== null && value !== undefined && compare(value, operand, column) <= 0;
    case "in":
      return value !== null && value !== undefined && listValues(operand).includes(String(value));
    case "is":
      return operand === "null" ? value === null || value === undefined : String(value) === operand;
    default:
      throw new Error(`fake PostgREST: unsupported filter ${column}=${filter}`);
  }
}

function orMatches(row: Row, expression: string): boolean {
  return listValues(expression).some((part) => {
    const [column, ...rest] = part.split(".");
    return matches(row, column, rest.join("."));
  });
}

/** Whether a row passes every filter of a PostgREST query string. */
export function rowMatchesQuery(row: Row, params: URLSearchParams): boolean {
  for (const [column, filter] of params) {
    if (["select", "order", "limit", "on_conflict"].includes(column)) continue;
    if (column === "or") {
      if (!orMatches(row, filter)) return false;
      continue;
    }
    if (!matches(row, column, filter)) return false;
  }
  return true;
}

export class FakePostgrest {
  tables = new Map<string, Row[]>();
  log: LogRow[] = [];
  calls: Call[] = [];
  /** Log ids not visible yet (a transaction that has not committed). */
  hidden = new Set<number>();
  /** Unix ms the next log rows get as changed_at. */
  clock = Date.parse("2026-11-08T03:00:00.000Z");
  /** Answers a call instead of the store (fault injection). */
  intercept: ((call: Call) => Response | null) | null = null;
  /** Supabase's PostgREST answers Accept: text/plain on a table with 406 PGRST107 (testbed 2026-11-09). */
  textPlain = false;
  private nextId = 1;

  table(name: string): Row[] {
    let rows = this.tables.get(name);
    if (!rows) {
      rows = [];
      this.tables.set(name, rows);
    }
    return rows;
  }

  changedAt(): string {
    return new Date(this.clock).toISOString().replace("Z", "000+00:00");
  }

  private envOf(table: string, image: Row | null, other: Row | null): string | null {
    if (table === "comment_likes") {
      const commentId = (image ?? other)?.comment_id;
      const comment = this.table("comments").find((row) => row.id === commentId);
      return typeof comment?.env === "string" ? comment.env : null;
    }
    const env = image?.env ?? other?.env;
    return typeof env === "string" ? env : null;
  }

  private append(table: string, op: LogRow["op"], newRow: Row | null, oldRow: Row | null): LogRow | null {
    let heavy = false;
    const strip = (image: Row | null) => {
      if (!image) return image;
      const copy = { ...image };
      for (const column of HEAVY[table] ?? []) delete copy[column];
      return copy;
    };
    for (const column of HEAVY[table] ?? []) if (newRow && column in newRow) heavy = true;
    const env = this.envOf(table, newRow, oldRow);
    const entry: LogRow = {
      id: this.nextId++,
      env,
      table_name: table,
      op,
      new_row: strip(clone(newRow)),
      old_row: strip(clone(oldRow)),
      heavy_changed: heavy,
      row_bytes: 0,
      changed_at: this.changedAt(),
    };
    entry.row_bytes = bytes(entry.new_row) + bytes(entry.old_row);
    this.log.push(entry);
    return entry;
  }

  insert(table: string, row: Row): LogRow | null {
    this.table(table).push(clone(row));
    return this.append(table, "I", row, null);
  }

  private find(table: string, match: Row): Row | undefined {
    return this.table(table).find((row) => Object.entries(match).every(([column, value]) => sameJson(row[column], value)));
  }

  update(table: string, match: Row, patch: Row): LogRow | null {
    const row = this.find(table, match);
    if (!row) throw new Error(`fake PostgREST: no ${table} row ${JSON.stringify(match)}`);
    const old = clone(row);
    const changed: Row = {};
    for (const [column, value] of Object.entries(patch)) {
      if (!sameJson(row[column], value)) changed[column] = clone(value);
      row[column] = clone(value);
    }
    if (Object.keys(changed).length === 0) return null;
    return this.append(table, "U", changed, old);
  }

  delete(table: string, match: Row): LogRow | null {
    const rows = this.table(table);
    const index = rows.findIndex((row) => Object.entries(match).every(([column, value]) => sameJson(row[column], value)));
    if (index < 0) return null;
    const [old] = rows.splice(index, 1);
    return this.append(table, "D", null, old);
  }

  keyOf(table: string, row: Row): Row {
    const columns = KEYS[table] ?? ["id", ...(row.env !== undefined ? ["env"] : [])];
    return Object.fromEntries(columns.map((column) => [column, row[column]]));
  }

  fetcher: Fetcher = async (input, init) => {
    const request = new Request(input as RequestInfo, init);
    const url = new URL(request.url);
    const table = url.pathname.replace(/^\/rest\/v1\//, "");
    const call: Call = {
      method: request.method,
      table,
      query: url.searchParams,
      accept: request.headers.get("accept") ?? "",
      apikey: request.headers.get("apikey") ?? "",
    };
    this.calls.push(call);
    const injected = this.intercept?.(call);
    if (injected) return injected;
    const source = table === "d1_change_log"
      ? (this.log.filter((row) => !this.hidden.has(row.id)) as unknown as Row[])
      : this.table(table);
    let rows = source.filter((row) => rowMatchesQuery(row, url.searchParams));
    if (request.method === "DELETE") {
      const remove = new Set(rows);
      if (table === "d1_change_log") this.log = this.log.filter((row) => !remove.has(row as unknown as Row));
      else this.tables.set(table, source.filter((row) => !remove.has(row)));
      return new Response(null, { status: 204 });
    }
    const order = url.searchParams.get("order");
    if (order) {
      const keys = order.split(",").map((part) => part.split("."));
      rows = [...rows].sort((a, b) => {
        for (const [column, direction] of keys) {
          const left = a[column] as string | number;
          const right = b[column] as string | number;
          if (left === right) continue;
          const sign = left < right ? -1 : 1;
          return direction === "desc" ? -sign : sign;
        }
        return 0;
      });
    }
    const limit = url.searchParams.get("limit");
    if (limit) rows = rows.slice(0, Number(limit));
    const select = url.searchParams.get("select") ?? "*";
    const projected = select === "*"
      ? rows.map((row) => clone(row))
      : rows.map((row) => Object.fromEntries(select.split(",").map((column) => [column, clone(row[column] ?? null)])));
    if (call.accept === "text/plain") {
      if (!this.textPlain) return Response.json({ code: "PGRST107" }, { status: 406 });
      const columns = select.split(",");
      if (columns.length !== 1) return Response.json({ code: "PGRST107" }, { status: 406 });
      const text = projected.map((row) => String(row[columns[0]] ?? "")).join("");
      return new Response(text, { headers: { "content-type": "text/plain; charset=utf-8" } });
    }
    return Response.json(projected);
  };

  /** Calls by table (d1_change_log reads, re-reads, raw fetches). */
  count(filter: (call: Call) => boolean = () => true): number {
    return this.calls.filter(filter).length;
  }
}
