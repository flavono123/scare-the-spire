/**
 * A local SQLite stand-in for a D1 database of the step-2 schema: d1/migrations 0001 and 0002, then
 * docs/supabase-exit/d1-schema/schema.sql, with foreign keys on (D1 enforces them by default).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import type { D1Statement } from "../../src/lib/d1-sync/statements";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export function d1SchemaSql(): string {
  return [
    readFileSync(join(ROOT, "d1/migrations/0001_runtime_flags.sql"), "utf8"),
    readFileSync(join(ROOT, "d1/migrations/0002_api_cache.sql"), "utf8"),
    readFileSync(join(ROOT, "docs/supabase-exit/d1-schema/schema.sql"), "utf8"),
  ].join("\n");
}

export function openD1TestDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(d1SchemaSql());
  return db;
}

/**
 * One D1-style batch: a transaction that starts with PRAGMA defer_foreign_keys = ON (as the sync
 * batch does) and rolls back as a whole on any error. Returns the changed-row count per statement.
 */
export function applyBatch(db: DatabaseSync, statements: readonly D1Statement[]): number[] {
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

export function rows(db: DatabaseSync, sql: string, ...params: Array<string | number | null>): Array<Record<string, unknown>> {
  // node:sqlite rows have a null prototype; plain objects compare with deepEqual.
  return (db.prepare(sql).all(...params) as Array<Record<string, unknown>>).map((row) => ({ ...row }));
}

export function count(db: DatabaseSync, table: string): number {
  return Number((db.prepare(`SELECT count(*) AS n FROM ${table}`).get() as { n: number }).n);
}
