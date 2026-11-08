/**
 * The Worker's D1 binding (workers/api/d1.ts) over a node:sqlite database of the d1/migrations schema
 * (scripts/d1-sync/test-db.ts), so the adapters and the shadow ledger run their real SQL in the specs.
 */
import type { D1Database, D1PreparedStatement, D1Result } from "../../workers/api/d1";
import type { D1Value } from "../../src/lib/d1-sync/statements";
import type { SqliteDb } from "../d1-sync/test-db";

function bindable(value: unknown): D1Value {
  if (value === undefined || value === null) return null;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "number" || typeof value === "string") return value;
  throw new Error(`D1 cannot bind ${typeof value}`);
}

const READS = /^\s*(SELECT|WITH)\b/i;

export class SqliteD1 implements D1Database {
  /** Every statement run, in order. */
  readonly statements: string[] = [];

  constructor(readonly sqlite: SqliteDb) {}

  private exec(sql: string, params: D1Value[]): D1Result<Record<string, unknown>> {
    this.statements.push(sql);
    const statement = this.sqlite.prepare(sql);
    if (READS.test(sql) || /\bRETURNING\b/i.test(sql)) {
      const results = (statement.all(...params) as Record<string, unknown>[]).map((row) => ({ ...row }));
      return { results, success: true, meta: { changes: 0 } };
    }
    const info = statement.run(...params);
    return { results: [], success: true, meta: { changes: Number(info.changes) } };
  }

  prepare(sql: string): D1PreparedStatement {
    let params: D1Value[] = [];
    const statement: D1PreparedStatement = {
      bind: (...values: unknown[]) => {
        params = values.map(bindable);
        return statement;
      },
      all: async <T>() => this.exec(sql, params) as unknown as D1Result<T>,
      first: async <T>() => (this.exec(sql, params).results[0] ?? null) as T | null,
      run: async () => this.exec(sql, params) as D1Result<unknown>,
    };
    return statement;
  }

  async batch<T>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
    this.sqlite.exec("BEGIN");
    try {
      const results: D1Result<T>[] = [];
      for (const statement of statements) results.push(await statement.all<T>());
      this.sqlite.exec("COMMIT");
      return results;
    } catch (error) {
      this.sqlite.exec("ROLLBACK");
      throw error;
    }
  }
}
