/**
 * The Worker's D1 binding (workers/api/d1.ts) over a local SQLite copy of the D1 schema
 * (openD1TestDb), for specs that run Worker code against real tables, CHECKs and FKs.
 * batch() is one transaction that rolls back on any error, as D1's is; meta.changes is SQLite's.
 */
import type { D1Database, D1PreparedStatement, D1Result } from "../../workers/api/d1";
import type { D1Value } from "../../src/lib/d1-sync/statements";
import { openD1TestDb, type SqliteDb } from "./test-db";

function toParam(value: unknown): D1Value {
  if (value === undefined) throw new Error("D1_TYPE_ERROR: undefined is not a bindable value");
  if (typeof value === "boolean") return value ? 1 : 0;
  if (value === null || typeof value === "number" || typeof value === "string") return value;
  throw new Error(`D1_TYPE_ERROR: unsupported value ${typeof value}`);
}

export class SqliteD1 implements D1Database {
  readonly sqlite: SqliteDb;
  /** Every SQL text run, in order (prepared statements and batch members alike). */
  readonly log: string[] = [];
  /** Statement count per batch() call. */
  readonly batches: number[] = [];
  failNext: string | null = null;

  constructor(sqlite: SqliteDb = openD1TestDb()) {
    this.sqlite = sqlite;
  }

  private exec(sql: string, params: D1Value[]): D1Result<Record<string, unknown>> {
    this.log.push(sql);
    if (this.failNext) {
      const message = this.failNext;
      this.failNext = null;
      throw new Error(message);
    }
    const statement = this.sqlite.prepare(sql);
    const isRead = /^\s*(SELECT|WITH)\b/i.test(sql);
    const results = (statement.all(...params) as Record<string, unknown>[]).map((row) => ({ ...row }));
    const changes = isRead ? 0 : Number((this.sqlite.prepare("SELECT changes() AS c").get() as { c: number }).c);
    return { success: true, results, meta: { changes } };
  }

  prepare(sql: string): D1PreparedStatement {
    let params: D1Value[] = [];
    const statement: D1PreparedStatement & { sql: string; params: () => D1Value[] } = {
      sql,
      params: () => params,
      bind: (...values: unknown[]) => {
        params = values.map(toParam);
        return statement;
      },
      all: async <T>() => this.exec(sql, params) as unknown as D1Result<T>,
      first: async <T>() => (this.exec(sql, params).results[0] ?? null) as T | null,
      run: async () => this.exec(sql, params) as D1Result<unknown>,
    };
    return statement;
  }

  async batch<T>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
    this.batches.push(statements.length);
    this.sqlite.exec("BEGIN");
    try {
      const out = statements.map((entry) => {
        const { sql, params } = entry as unknown as { sql: string; params: () => D1Value[] };
        return this.exec(sql, params()) as unknown as D1Result<T>;
      });
      this.sqlite.exec("COMMIT");
      return out;
    } catch (error) {
      this.sqlite.exec("ROLLBACK");
      throw new Error(`D1_ERROR: ${(error as Error).message}`);
    }
  }

  rows(sql: string, ...params: D1Value[]): Array<Record<string, unknown>> {
    return (this.sqlite.prepare(sql).all(...params) as Array<Record<string, unknown>>).map((row) => ({ ...row }));
  }

  one(sql: string, ...params: D1Value[]): Record<string, unknown> | undefined {
    return this.rows(sql, ...params)[0];
  }

  run(sql: string, ...params: D1Value[]): void {
    this.sqlite.prepare(sql).run(...params);
  }
}
