/**
 * Fakes for the reconcile spec (and local dry runs over a backup): a PostgREST endpoint over
 * in-memory Supabase row images (GET only, plus rpc/get_engagement_counts), a D1 HTTP API endpoint
 * over a node:sqlite copy of the D1 schema, and the first copy (design 5.2) of one env into it.
 * No network.
 */
import {
  mapRow,
  mergeTouched,
  recountStatements,
  rowEnv,
  runSummaryFillStatement,
  SUPABASE_TABLES,
  type RowImage,
  type Touched,
} from "../../src/lib/d1-sync/row-mapper";
import type { D1Statement, D1Value } from "../../src/lib/d1-sync/statements";
import { extractRunListSummary } from "../../src/lib/run-list-summary";
import type { FetchLike, FetchResponseLike } from "./d1-http-client";
import { applyBatch, type SqliteDb } from "./test-db";

export function response(status: number, body: unknown): FetchResponseLike {
  const text = JSON.stringify(body);
  return { ok: status < 400, status, text: async () => text };
}

// ------------------------------------------------------------------------------------------- fake PostgREST

export class FakeSupabase {
  requests: Array<{ method: string; path: string }> = [];
  maxRows = 1000;
  constructor(
    readonly data: Record<string, RowImage[]>,
    readonly url: string,
    readonly serviceKey: string,
  ) {}

  private engagement(env: string) {
    const counts = new Map<string, { like_count: number; comment_count: number }>();
    const slot = (key: string) => counts.get(key) ?? counts.set(key, { like_count: 0, comment_count: 0 }).get(key)!;
    for (const like of this.data.likes) if (like.env === env) slot(String(like.story_id)).like_count += 1;
    for (const comment of this.data.comments) if (comment.env === env) slot(String(comment.story_id)).comment_count += 1;
    return [...counts].map(([story_id, value]) => ({ story_id, ...value }));
  }

  private select(table: string, params: URLSearchParams): Array<Record<string, unknown>> {
    const select = params.get("select") ?? "*";
    const embed = /(\w+)!inner\((\w+)\)/.exec(select);
    let out: Array<Record<string, unknown>> = (this.data[table] ?? []).map((row) => ({ ...row }));
    if (embed) {
      const parentTable = embed[1];
      const fk = parentTable === "comments" ? "comment_id" : "post_id";
      out = out.flatMap((row) => {
        const parent = this.data[parentTable].find((candidate) => candidate.id === row[fk]);
        return parent ? [{ ...row, [parentTable]: { env: parent.env } }] : [];
      });
    }
    for (const [name, value] of params) {
      if (["select", "order", "limit", "offset"].includes(name)) continue;
      const [op, ...rest] = value.split(".");
      const expected = rest.join(".");
      const [head, tail] = name.split(".");
      out = out.filter((row) => {
        const actual = tail ? (row[head] as Record<string, unknown> | undefined)?.[tail] : row[head];
        if (op === "eq") return actual === expected;
        if (op === "neq") return actual !== expected;
        throw new Error(`fake PostgREST: unsupported filter ${name}=${value}`);
      });
    }
    const columns = select.split(",").filter((part) => !part.includes("!"));
    if (!columns.includes("*")) {
      const keep = [...columns, ...(embed ? [embed[1]] : [])];
      out = out.map((row) => Object.fromEntries(keep.map((column) => [column, row[column]])));
    }
    return out;
  }

  fetch: FetchLike = async (url, init) => {
    const parsed = new URL(url);
    this.requests.push({ method: init.method, path: parsed.pathname });
    if (!url.startsWith(`${this.url}/rest/v1/`)) return response(404, { message: "wrong host" });
    if (init.headers.apikey !== this.serviceKey || init.headers.authorization !== `Bearer ${this.serviceKey}`) {
      return response(401, { message: "Invalid API key" });
    }
    const match = /^\/rest\/v1\/(rpc\/)?(\w+)$/.exec(parsed.pathname);
    if (!match) return response(404, { message: "no route" });
    let out: Array<Record<string, unknown>>;
    if (match[1]) {
      if (init.method !== "POST" || match[2] !== "get_engagement_counts") return response(405, { message: "not allowed" });
      out = this.engagement(String((JSON.parse(init.body ?? "{}") as { p_env?: string }).p_env));
    } else {
      if (init.method !== "GET") return response(405, { message: "writes are not allowed" });
      if (!(match[2] in this.data)) return response(404, { code: "42P01", message: `relation ${match[2]} does not exist` });
      out = this.select(match[2], parsed.searchParams);
    }
    const order = (parsed.searchParams.get("order") ?? "").split(",").filter(Boolean);
    out.sort((a, b) => {
      for (const column of order) {
        const x = a[column] as string | number;
        const y = b[column] as string | number;
        if (x < y) return -1;
        if (x > y) return 1;
      }
      return 0;
    });
    const offset = Number(parsed.searchParams.get("offset") ?? 0);
    const limit = Math.min(Number(parsed.searchParams.get("limit") ?? Number.MAX_SAFE_INTEGER), this.maxRows);
    return response(200, out.slice(offset, offset + limit));
  };
}

// ------------------------------------------------------------------------------------------- fake D1 HTTP API

export class FakeD1 {
  queries: string[] = [];
  writes: string[] = [];
  constructor(
    readonly db: SqliteDb,
    readonly account: string,
    readonly databaseId: string,
    readonly token: string,
  ) {}

  fetch: FetchLike = async (url, init) => {
    const path = new URL(url).pathname;
    if (path !== `/client/v4/accounts/${this.account}/d1/database/${this.databaseId}/query` || init.method !== "POST") {
      return response(404, { success: false, errors: [{ code: 7404, message: "no such database" }], result: [] });
    }
    if (init.headers.authorization !== `Bearer ${this.token}`) {
      return response(403, { success: false, errors: [{ code: 10000, message: "Authentication error" }], result: [] });
    }
    const { sql, params } = JSON.parse(init.body ?? "{}") as { sql: string; params: D1Value[] };
    this.queries.push(sql);
    try {
      const statement = this.db.prepare(sql);
      const read = /^\s*(SELECT|WITH|PRAGMA)\b/i.test(sql) || /\bRETURNING\b/i.test(sql);
      let results: Array<Record<string, unknown>> = [];
      let changes = 0;
      if (read) results = (statement.all(...params) as Array<Record<string, unknown>>).map((row) => ({ ...row }));
      else {
        changes = Number(statement.run(...params).changes);
        this.writes.push(sql);
      }
      return response(200, {
        success: true,
        errors: [],
        messages: [],
        result: [{ success: true, results, meta: { changes, rows_read: results.length, rows_written: changes } }],
      });
    } catch (error) {
      return response(400, { success: false, errors: [{ code: 7500, message: (error as Error).message }], result: [] });
    }
  };
}

/** The first copy (design 5.2) of one env into a D1 database: mapper rows, then the derived recounts. */
export function firstCopy(db: SqliteDb, data: Record<string, RowImage[]>, env: string, opts: { fill?: boolean; nowMs?: number } = {}) {
  const nowMs = opts.nowMs ?? 0;
  const commentEnv = new Map(data.comments.map((row) => [row.id, rowEnv(row)]));
  const postEnv = new Map(data.this_or_that_posts.map((row) => [row.id, rowEnv(row)]));
  const statements: D1Statement[] = [];
  const touched: Touched[] = [];
  for (const table of SUPABASE_TABLES) {
    for (const image of data[table]) {
      const rowEnvOf = table === "comment_likes" ? commentEnv.get(image.comment_id) ?? null : rowEnv(image);
      if (rowEnvOf !== null && rowEnvOf !== env) continue;
      if (table === "this_or_that_post_likes" && postEnv.get(image.post_id) !== env) continue; // cross_env
      const result = mapRow(table, image, { nowMs });
      if (!result.ok) throw new Error(`first copy cannot map a ${table} row: ${result.reject.reason}`);
      statements.push(...result.statements);
      touched.push(result.touched);
    }
  }
  statements.push(...recountStatements(mergeTouched(touched), nowMs));
  applyBatch(db, statements);
  if (opts.fill) {
    for (const run of data.runs.filter((image) => image.env === env)) {
      applyBatch(db, [runSummaryFillStatement(String(run.id), extractRunListSummary(String(run.id), String(run.raw)))]);
    }
  }
}
