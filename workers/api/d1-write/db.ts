import type { D1Statement, D1Value } from "../../../src/lib/d1-sync/statements";
import type { D1Database, D1Result } from "../d1";
import type { ApiErrorCode } from "../http";

/**
 * D1 batch helpers for the step 5 write handlers. One write is one `db.batch()`: D1 runs the
 * statements in one transaction, so the source rows, the recounts (design 2.3) and the outbox row
 * (design 5.5) commit or roll back together.
 */

export type { D1Statement, D1Value };

export function stmt(sql: string, ...params: D1Value[]): D1Statement {
  return { sql, params };
}

export async function runBatch(db: D1Database, statements: readonly D1Statement[]): Promise<D1Result[]> {
  if (statements.length === 0) return [];
  return db.batch(statements.map((statement) => db.prepare(statement.sql).bind(...statement.params)));
}

export async function queryAll<T = Record<string, unknown>>(db: D1Database, statement: D1Statement): Promise<T[]> {
  const result = await db.prepare(statement.sql).bind(...statement.params).all<T>();
  return result.results ?? [];
}

export function changesOf(result: D1Result | undefined): number {
  return Number(result?.meta?.changes ?? 0);
}

export function rowsOf<T = Record<string, unknown>>(result: D1Result | undefined): T[] {
  return (result?.results ?? []) as T[];
}

export type D1FailureKind = "fk" | "check" | "unique" | "other";

/**
 * Classifies a D1 (SQLite) error by its message. D1 wraps SQLite's text, e.g.
 * "D1_ERROR: FOREIGN KEY constraint failed: SQLITE_CONSTRAINT".
 */
export function classifyD1Error(error: unknown): D1FailureKind {
  const message = error instanceof Error ? error.message : String(error);
  if (/FOREIGN KEY constraint failed/i.test(message)) return "fk";
  if (/UNIQUE constraint failed|PRIMARY KEY/i.test(message)) return "unique";
  if (/CHECK constraint failed|NOT NULL constraint failed|cannot store .* value in .* column|datatype mismatch|malformed JSON/i.test(message)) {
    return "check";
  }
  return "other";
}

/**
 * The API error a failed write batch maps to, as today's PostgREST codes map (comments.ts
 * restErrorCode): 23503 -> not_found, 23514 -> check_violation, 23505 -> duplicate, anything else
 * (D1 unreachable, a limit) -> unavailable. `fk` overrides the FK case where today's refusal is a
 * policy (42501 forbidden), e.g. a vote on a missing post.
 */
export function writeFailureCode(error: unknown, overrides: Partial<Record<D1FailureKind, ApiErrorCode>> = {}): ApiErrorCode {
  const kind = classifyD1Error(error);
  if (overrides[kind]) return overrides[kind] as ApiErrorCode;
  if (kind === "fk") return "not_found";
  if (kind === "check") return "check_violation";
  if (kind === "unique") return "duplicate";
  return "unavailable";
}

/** The canonical D1 timestamp (design 3.3) of a Unix ms value: toISOString with 6 fraction digits. */
export function tsFromMs(ms: number): string {
  return new Date(ms).toISOString().replace("Z", "000Z");
}

/** Postgres `timestamp::text` of a UTC instant (rank_history[].at, design 3.3): trailing zeros trimmed. */
export function pgTimestampText(ms: number): string {
  const iso = new Date(ms).toISOString();
  const [date, time] = iso.slice(0, -1).split("T");
  const [whole, fraction = ""] = time.split(".");
  const trimmed = fraction.replace(/0+$/, "");
  return `${date} ${whole}${trimmed ? `.${trimmed}` : ""}`;
}

export function boolOrNull(value: boolean | null | undefined, fallback: 0 | 1 | null): 0 | 1 | null {
  if (value === undefined) return fallback;
  if (value === null) return null;
  return value ? 1 : 0;
}
