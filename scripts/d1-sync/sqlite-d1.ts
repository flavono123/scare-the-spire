/**
 * The Worker's D1 binding (workers/api/d1.ts) over a local node:sqlite copy of the step-2 schema,
 * for specs: batches are one transaction rolled back on any error, statements are counted the way
 * D1 counts queries per invocation (each statement of a batch is one), and meta.changes is set.
 */
import type { D1Database, D1PreparedStatement, D1Result } from "../../workers/api/d1";
import type { D1Value } from "../../src/lib/d1-sync/statements";
import { openD1TestDb, type SqliteDb } from "./test-db";

function returnsRows(sql: string): boolean {
  return /^\s*SELECT\b/i.test(sql) || /\bRETURNING\b/i.test(sql) || /^\s*PRAGMA\s+\w+\s*;?\s*$/i.test(sql);
}

export class SqliteD1 implements D1Database {
  /** Every statement executed (prepared .first/.all/.run and each batch member). */
  statements = 0;
  /** SQL texts in execution order. */
  log: string[] = [];
  /** Throws this error for the next batch whose statements match (a fault injection). */
  failBatch: ((sql: string[]) => Error | null) | null = null;

  constructor(readonly sqlite: SqliteDb = openD1TestDb()) {}

  exec(sql: string, params: readonly unknown[]): D1Result<Record<string, unknown>> {
    this.statements += 1;
    this.log.push(sql);
    const statement = this.sqlite.prepare(sql);
    const values = params as D1Value[];
    if (returnsRows(sql)) {
      const rows = (statement.all(...values) as Array<Record<string, unknown>>).map((row) => ({ ...row }));
      const changes = /^\s*SELECT\b/i.test(sql) ? 0 : rows.length;
      return { results: rows, success: true, meta: { changes } };
    }
    const result = statement.run(...values);
    return { results: [], success: true, meta: { changes: Number(result.changes) } };
  }

  prepare(sql: string): D1PreparedStatement {
    let params: unknown[] = [];
    const run = async () => {
      try {
        return this.exec(sql, params);
      } catch (error) {
        throw new Error(`D1_ERROR: ${(error as Error).message}: SQLITE_CONSTRAINT`);
      }
    };
    const statement = {
      sql,
      get params() {
        return params;
      },
      bind(...values: unknown[]) {
        params = values;
        return statement;
      },
      all: run as D1PreparedStatement["all"],
      run: run as D1PreparedStatement["run"],
      async first<T>() {
        const result = await run();
        return (result.results[0] ?? null) as T | null;
      },
    };
    return statement;
  }

  async batch<T = Record<string, unknown>>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
    const members = statements as unknown as Array<{ sql: string; params: unknown[] }>;
    const injected = this.failBatch?.(members.map((member) => member.sql)) ?? null;
    if (injected) {
      this.statements += members.length;
      throw injected;
    }
    this.sqlite.exec("BEGIN");
    try {
      const results = members.map((member) => this.exec(member.sql, member.params));
      this.sqlite.exec("COMMIT");
      return results as D1Result<T>[];
    } catch (error) {
      this.sqlite.exec("ROLLBACK");
      const message = (error as Error).message;
      throw new Error(`D1_ERROR: ${message}${/constraint/i.test(message) ? ": SQLITE_CONSTRAINT" : ""}`);
    }
  }

  rows(sql: string, ...params: D1Value[]): Array<Record<string, unknown>> {
    return (this.sqlite.prepare(sql).all(...params) as Array<Record<string, unknown>>).map((row) => ({ ...row }));
  }

  one(sql: string, ...params: D1Value[]): Record<string, unknown> | undefined {
    return this.rows(sql, ...params)[0];
  }
}
