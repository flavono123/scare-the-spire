/**
 * A local SQLite stand-in for a D1 database of the step-2 schema: d1/migrations 0001 and 0002, then
 * docs/supabase-exit/d1-schema/schema.sql, with foreign keys on (D1 enforces them by default).
 * Uses Node's built-in node:sqlite (Node 22.13+).
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { D1Statement, D1Value } from "../../src/lib/d1-sync/statements";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

// The repo's @types/node (20) has no node:sqlite declarations, so the few calls used here are typed
// locally instead of with an ambient module that would clash with newer @types/node.
export interface SqliteStatement {
  run(...params: D1Value[]): { changes: number | bigint };
  all(...params: D1Value[]): unknown[];
  get(...params: D1Value[]): unknown;
}

export interface SqliteDb {
  exec(sql: string): void;
  prepare(sql: string): SqliteStatement;
  close(): void;
}

const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as {
  DatabaseSync: new (location: string) => SqliteDb;
};

export function d1SchemaSql(): string {
  return [
    readFileSync(join(ROOT, "d1/migrations/0001_runtime_flags.sql"), "utf8"),
    readFileSync(join(ROOT, "d1/migrations/0002_api_cache.sql"), "utf8"),
    readFileSync(join(ROOT, "docs/supabase-exit/d1-schema/schema.sql"), "utf8"),
  ].join("\n");
}

export function openD1TestDb(): SqliteDb {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(d1SchemaSql());
  return db;
}

/**
 * One D1-style batch: a transaction that starts with PRAGMA defer_foreign_keys = ON (as the sync
 * batch does) and rolls back as a whole on any error. Returns the changed-row count per statement.
 */
export function applyBatch(db: SqliteDb, statements: readonly D1Statement[]): number[] {
  db.exec("BEGIN");
  try {
    db.exec("PRAGMA defer_foreign_keys = ON");
    const changes = statements.map((statement) => Number(db.prepare(statement.sql).run(...statement.params).changes));
    db.exec("COMMIT");
    return changes;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function rows(db: SqliteDb, sql: string, ...params: D1Value[]): Array<Record<string, unknown>> {
  // node:sqlite rows have a null prototype; plain objects compare with deepEqual.
  return (db.prepare(sql).all(...params) as Array<Record<string, unknown>>).map((row) => ({ ...row }));
}

export function count(db: SqliteDb, table: string): number {
  return Number((db.prepare(`SELECT count(*) AS n FROM ${table}`).get() as { n: number }).n);
}
