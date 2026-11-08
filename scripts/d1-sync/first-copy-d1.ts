/**
 * D1 targets of the first copy (docs/supabase-exit/D1_SCHEMA_DESIGN.md 5.2): a local SQLite rehearsal
 * (node:sqlite), local D1 (wrangler's local state through getPlatformProxy) and remote D1 (the
 * Cloudflare D1 HTTP API). Every target takes the same wire statements: values inlined as SQL
 * literals except large strings (run raws), which stay bound, so no statement text nears D1's 100 KB
 * limit. Remote writes go in bounded batches under a rows-written budget (the account's free daily
 * write limit is 100,000 rows).
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { sqlLiteral, type D1Statement, type D1Value } from "../../src/lib/d1-sync/statements";
import { openD1TestDb, type SqliteDb } from "./test-db";

export const ROOT = join(__dirname, "..", "..");

// ------------------------------------------------------------------------------------------- schema

export interface MigrationFile {
  name: string;
  text: string;
}

/** The step-2 migrations: every d1/migrations file from 0003 on, in name order (today 0003..0006). */
export function stepTwoMigrations(dir = join(ROOT, "d1/migrations")): MigrationFile[] {
  return readdirSync(dir)
    .filter((name) => /^\d{4}_.*\.sql$/.test(name) && Number(name.slice(0, 4)) >= 3)
    .sort()
    .map((name) => ({ name, text: readFileSync(join(dir, name), "utf8") }));
}

/** Tables the step-2 migrations create, in file order. */
export function stepTwoTables(files = stepTwoMigrations()): string[] {
  const out: string[] = [];
  for (const file of files) {
    for (const match of file.text.matchAll(/^CREATE TABLE IF NOT EXISTS (\w+) \(/gm)) out.push(match[1]);
  }
  return out;
}

/**
 * Leaf-first drop order (design 3.7, 5.2 "다시 채우기"): a table is dropped only after every table
 * that references it, so no DROP runs the implicit DELETE that would cascade.
 */
export function dropOrder(tables: readonly string[], db: SqliteDb = openD1TestDb()): string[] {
  const parents = new Map<string, Set<string>>();
  for (const table of tables) {
    const rows = db.prepare('SELECT DISTINCT "table" AS parent FROM pragma_foreign_key_list(?1)').all(table) as Array<{ parent: string }>;
    parents.set(table, new Set(rows.map((row) => row.parent).filter((parent) => parent !== table)));
  }
  const out: string[] = [];
  const left = new Set(tables);
  while (left.size > 0) {
    // Drop the tables no remaining table points at, latest-created first.
    const leaves = [...left].reverse().filter((table) => ![...left].some((other) => parents.get(other)!.has(table)));
    if (leaves.length === 0) throw new Error(`FK cycle among ${[...left].join(", ")}`);
    for (const table of leaves) {
      out.push(table);
      left.delete(table);
    }
  }
  return out;
}

/** A migration file -> its statements (no trailing ';'), comments kept inside statements, comment-only parts dropped. */
export function splitSqlScript(text: string): string[] {
  if (/\bCREATE\s+TRIGGER\b/i.test(text)) throw new Error("splitSqlScript does not split trigger bodies");
  const out: string[] = [];
  let start = 0;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === "'" || ch === '"') {
      const end = text.indexOf(ch, i + 1);
      if (end < 0) throw new Error("unterminated quote in SQL script");
      i = end + 1;
    } else if (text.startsWith("--", i)) {
      const end = text.indexOf("\n", i);
      i = end < 0 ? text.length : end + 1;
    } else if (text.startsWith("/*", i)) {
      const end = text.indexOf("*/", i + 2);
      if (end < 0) throw new Error("unterminated comment in SQL script");
      i = end + 2;
    } else if (ch === ";") {
      out.push(text.slice(start, i));
      i += 1;
      start = i;
    } else {
      i += 1;
    }
  }
  out.push(text.slice(start));
  const hasCode = (part: string) => part.replace(/--[^\n]*|\/\*[\s\S]*?\*\//g, "").trim() !== "";
  return out.filter(hasCode).map((part) => part.trim());
}

// ------------------------------------------------------------------------------------------- wire form

/** D1 refuses statement text over 100,000 bytes (SQLITE_TOOBIG); stay well under it. */
export const MAX_STATEMENT_BYTES = 90_000;

export interface WireStatement {
  sql: string;
  /** Only large strings stay bound (the D1 HTTP API takes string params). */
  params: string[];
  bytes: number;
}

function utf8(text: string): number {
  return Buffer.byteLength(text, "utf8");
}

function inlineExcept(statement: D1Statement, bind: (value: D1Value) => boolean): WireStatement {
  const { sql, params } = statement;
  const renumber = new Map<number, number>();
  const bound: string[] = [];
  let out = "";
  let quote: string | null = null;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (quote) {
      out += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      out += ch;
      continue;
    }
    if (ch !== "?") {
      out += ch;
      continue;
    }
    const digits = /^\d+/.exec(sql.slice(i + 1));
    if (!digits) throw new Error("only numbered ?N placeholders are supported");
    const index = Number(digits[0]) - 1;
    if (index < 0 || index >= params.length) throw new Error(`placeholder ?${digits[0]} has no value`);
    const value = params[index];
    if (bind(value)) {
      if (!renumber.has(index)) {
        bound.push(value as string);
        renumber.set(index, bound.length);
      }
      out += `?${renumber.get(index)}`;
    } else {
      out += sqlLiteral(value);
    }
    i += digits[0].length;
  }
  return { sql: out, params: bound, bytes: utf8(out) };
}

/** The statement with every value inlined except strings over 16 KB (then over 256 bytes, if still too long). */
export function toWire(statement: D1Statement): WireStatement {
  // No params (DDL, drops): the text goes as written; its comments may hold a '?'.
  if (statement.params.length === 0) {
    const bytes = utf8(statement.sql);
    if (bytes > MAX_STATEMENT_BYTES) throw new Error(`statement on ${statement.sql.slice(0, 40)} is over ${MAX_STATEMENT_BYTES} bytes`);
    return { sql: statement.sql, params: [], bytes };
  }
  for (const threshold of [16_384, 256]) {
    const wire = inlineExcept(statement, (value) => typeof value === "string" && utf8(value) > threshold);
    if (wire.bytes <= MAX_STATEMENT_BYTES) return wire;
  }
  throw new Error(`statement on ${statement.sql.slice(0, 40)} stays over ${MAX_STATEMENT_BYTES} bytes with its strings bound`);
}

// ------------------------------------------------------------------------------------------- budget

export class BudgetStop extends Error {}

/** Rows written so far against a cap; a batch whose estimate would cross the cap is not sent. */
export class WriteBudget {
  used = 0;
  constructor(readonly limit: number) {}

  check(estimate: number) {
    if (this.used + estimate > this.limit) {
      throw new BudgetStop(
        `stopped before the write budget: ${this.used} rows written, the next batch needs about ${estimate}, budget ${this.limit}`,
      );
    }
  }

  add(rowsWritten: number) {
    this.used += rowsWritten;
  }
}

// ------------------------------------------------------------------------------------------- targets

export interface PlannedWrite {
  wire: WireStatement;
  /** Rows written, estimated from the rehearsal (rows changed x (1 + indexes) for INSERT and DELETE). */
  estimate: number;
}

export interface WriteResult {
  rowsWritten: number;
  /** Rows changed per statement, in order. */
  changes: number[];
  requests: number;
}

export interface D1Target {
  readonly label: string;
  readonly remote: boolean;
  /** One read statement. */
  all(sql: string): Promise<Array<Record<string, unknown>>>;
  /** Writes in order, in bounded batches, checking the budget before each batch. */
  write(writes: readonly PlannedWrite[], budget?: WriteBudget): Promise<WriteResult>;
  close(): Promise<void>;
}

/** The rehearsal: an in-memory SQLite copy of the D1 schema, foreign keys on and never deferred. */
export class SqliteTarget implements D1Target {
  readonly label = "rehearsal (in-memory SQLite copy of the D1 schema)";
  readonly remote = false;
  constructor(readonly db: SqliteDb = openD1TestDb()) {}

  async all(sql: string) {
    return (this.db.prepare(sql).all() as Array<Record<string, unknown>>).map((row) => ({ ...row }));
  }

  async write(writes: readonly PlannedWrite[]): Promise<WriteResult> {
    const changes = writes.map(({ wire }) => Number(this.db.prepare(wire.sql).run(...wire.params).changes));
    return { rowsWritten: 0, changes, requests: 0 };
  }

  async close() {
    this.db.close();
  }
}

interface D1Meta {
  changes?: number;
  rows_written?: number;
}

interface D1BindingLike {
  prepare(sql: string): { bind(...values: unknown[]): unknown; all(): Promise<{ results: unknown[] }> };
  batch(statements: unknown[]): Promise<Array<{ meta: D1Meta }>>;
}

const LOCAL_BATCH_STATEMENTS = 100;
const LOCAL_BATCH_BYTES = 2_000_000;

/** Wrangler's local D1 (the state `wrangler d1 execute --local --persist-to <dir>` reads). */
export class LocalD1Target implements D1Target {
  readonly remote = false;
  private constructor(
    readonly label: string,
    private readonly db: D1BindingLike,
    private readonly dispose: () => Promise<void>,
  ) {}

  /** persistTo: the --persist-to directory (wrangler keeps D1 under <dir>/v3/d1). */
  static async open(opts: { database: D1Database; persistTo: string; workDir: string }): Promise<LocalD1Target> {
    const configPath = join(opts.workDir, "wrangler.local-d1.json");
    writeFileSync(
      configPath,
      JSON.stringify({
        name: "d1-first-copy-local",
        compatibility_date: "2026-06-15",
        d1_databases: [{ ...opts.database, binding: "DB", migrations_dir: join(ROOT, "d1/migrations") }],
      }),
    );
    const { getPlatformProxy } = await import("wrangler");
    const proxy = await getPlatformProxy<{ DB: D1BindingLike }>({
      configPath,
      envFiles: [],
      persist: { path: join(opts.persistTo, "v3") },
    });
    return new LocalD1Target(
      `local D1 ${opts.database.database_name} (${opts.persistTo})`,
      proxy.env.DB,
      () => proxy.dispose(),
    );
  }

  async all(sql: string) {
    const { results } = await this.db.prepare(sql).all();
    return results as Array<Record<string, unknown>>;
  }

  async write(writes: readonly PlannedWrite[], budget?: WriteBudget): Promise<WriteResult> {
    const result: WriteResult = { rowsWritten: 0, changes: [], requests: 0 };
    for (const batch of batches(writes, LOCAL_BATCH_STATEMENTS, LOCAL_BATCH_BYTES, () => false)) {
      budget?.check(sum(batch.map((w) => w.estimate)));
      const metas = await this.db.batch(batch.map(({ wire }) => this.db.prepare(wire.sql).bind(...wire.params)));
      result.requests += 1;
      for (const { meta } of metas) {
        result.changes.push(meta.changes ?? 0);
        result.rowsWritten += meta.rows_written ?? 0;
        budget?.add(meta.rows_written ?? 0);
      }
    }
    return result;
  }

  async close() {
    await this.dispose();
  }
}

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

/** Consecutive writes in groups of at most `maxStatements` and `maxBytes`; `alone` writes get their own group. */
function* batches(
  writes: readonly PlannedWrite[],
  maxStatements: number,
  maxBytes: number,
  alone: (write: PlannedWrite) => boolean,
): Generator<PlannedWrite[]> {
  let current: PlannedWrite[] = [];
  let bytes = 0;
  for (const write of writes) {
    const size = write.wire.bytes + sum(write.wire.params.map(utf8));
    if (alone(write)) {
      if (current.length) yield current;
      yield [write];
      current = [];
      bytes = 0;
      continue;
    }
    if (current.length && (current.length >= maxStatements || bytes + size > maxBytes)) {
      yield current;
      current = [];
      bytes = 0;
    }
    current.push(write);
    bytes += size;
  }
  if (current.length) yield current;
}

export interface D1Database {
  database_name: string;
  database_id: string;
}

export type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{
  status: number;
  headers: { get(name: string): string | null };
  json(): Promise<unknown>;
}>;

interface D1ApiResponse {
  success?: boolean;
  errors?: Array<{ code?: number; message?: string }>;
  result?: Array<{ results?: unknown[]; success?: boolean; meta?: D1Meta }>;
}

const REMOTE_BATCH_STATEMENTS = 50;
const REMOTE_BATCH_BYTES = 256_000;
const REMOTE_MIN_GAP_MS = 300; // under the API's 1,200 requests per 5 minutes
const REMOTE_ATTEMPTS = 3;

/**
 * Remote D1 through POST /accounts/{account}/d1/database/{id}/query. Statements without params go
 * several to a request (one sql text, statements joined by ';'); a statement with a bound string goes
 * alone with its params. Retries only network errors, 429 and 5xx.
 */
export class RemoteD1Target implements D1Target {
  readonly remote = true;
  private lastRequestAt = 0;
  constructor(
    readonly label: string,
    private readonly opts: {
      accountId: string;
      token: string;
      database: D1Database;
      fetch?: FetchLike;
      sleep?: (ms: number) => Promise<void>;
      minGapMs?: number;
    },
  ) {}

  private async request(sql: string, params: string[]): Promise<NonNullable<D1ApiResponse["result"]>> {
    const fetchImpl = this.opts.fetch ?? (globalThis.fetch as unknown as FetchLike);
    const sleep = this.opts.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
    const url =
      `https://api.cloudflare.com/client/v4/accounts/${this.opts.accountId}` +
      `/d1/database/${this.opts.database.database_id}/query`;
    const body = JSON.stringify(params.length ? { sql, params } : { sql });
    let lastError = "";
    for (let attempt = 1; attempt <= REMOTE_ATTEMPTS; attempt++) {
      const wait = this.lastRequestAt + (this.opts.minGapMs ?? REMOTE_MIN_GAP_MS) - Date.now();
      if (wait > 0) await sleep(wait);
      this.lastRequestAt = Date.now();
      let status = 0;
      let json: D1ApiResponse = {};
      try {
        const res = await fetchImpl(url, {
          method: "POST",
          headers: { Authorization: `Bearer ${this.opts.token}`, "Content-Type": "application/json" },
          body,
        });
        status = res.status;
        json = ((await res.json().catch(() => ({}))) ?? {}) as D1ApiResponse;
        if (status === 429 || status >= 500) {
          lastError = `HTTP ${status} ${apiErrors(json)}`;
          await sleep(Number(res.headers.get("retry-after") ?? 0) * 1000 || 1000 * attempt);
          continue;
        }
      } catch (error) {
        lastError = `network error: ${(error as Error).message}`;
        await sleep(1000 * attempt);
        continue;
      }
      if (status !== 200 || json.success === false || !Array.isArray(json.result) || json.result.some((r) => r.success === false)) {
        throw new Error(`D1 API refused the request (HTTP ${status}): ${apiErrors(json)}`);
      }
      return json.result;
    }
    throw new Error(`D1 API failed ${REMOTE_ATTEMPTS} times: ${lastError}`);
  }

  async all(sql: string) {
    const result = await this.request(sql, []);
    return (result[0]?.results ?? []) as Array<Record<string, unknown>>;
  }

  async write(writes: readonly PlannedWrite[], budget?: WriteBudget): Promise<WriteResult> {
    const result: WriteResult = { rowsWritten: 0, changes: [], requests: 0 };
    for (const batch of batches(writes, REMOTE_BATCH_STATEMENTS, REMOTE_BATCH_BYTES, (w) => w.wire.params.length > 0)) {
      budget?.check(sum(batch.map((w) => w.estimate)));
      const sql = batch.length === 1 ? batch[0].wire.sql : batch.map((w) => w.wire.sql).join(";\n");
      const answers = await this.request(sql, batch.length === 1 ? batch[0].wire.params : []);
      result.requests += 1;
      if (answers.length !== batch.length) {
        throw new Error(`D1 API answered ${answers.length} results for ${batch.length} statements`);
      }
      for (const answer of answers) {
        result.changes.push(answer.meta?.changes ?? 0);
        result.rowsWritten += answer.meta?.rows_written ?? 0;
        budget?.add(answer.meta?.rows_written ?? 0);
      }
    }
    return result;
  }

  async close() {}
}

function apiErrors(json: D1ApiResponse): string {
  const errors = (json.errors ?? []).map((e) => `${e.code ?? ""} ${e.message ?? ""}`.trim()).filter(Boolean);
  return errors.length ? errors.join("; ") : "(no error message)";
}

// ------------------------------------------------------------------------------------------- wrangler config

/** wrangler.jsonc without comments and trailing commas. */
export function readJsonc(text: string): unknown {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      let j = i + 1;
      while (j < text.length && text[j] !== '"') j += text[j] === "\\" ? 2 : 1;
      out += text.slice(i, j + 1);
      i = j;
    } else if (text.startsWith("//", i)) {
      const end = text.indexOf("\n", i);
      i = (end < 0 ? text.length : end) - 1;
    } else if (text.startsWith("/*", i)) {
      i = text.indexOf("*/", i + 2) + 1;
    } else {
      out += ch;
    }
  }
  return JSON.parse(out.replace(/,(\s*[}\]])/g, "$1"));
}

/** The DB binding of wrangler.jsonc: top level for production, env.testbed for testbed. */
export function wranglerDatabase(target: "production" | "testbed", configPath = join(ROOT, "wrangler.jsonc")): D1Database {
  const config = readJsonc(readFileSync(configPath, "utf8")) as {
    d1_databases?: Array<D1Database & { binding: string }>;
    env?: Record<string, { d1_databases?: Array<D1Database & { binding: string }> }>;
  };
  const list = target === "production" ? config.d1_databases : config.env?.[target]?.d1_databases;
  const db = list?.find((entry) => entry.binding === "DB");
  if (!db) throw new Error(`wrangler.jsonc has no DB binding for ${target}`);
  return { database_name: db.database_name, database_id: db.database_id };
}
