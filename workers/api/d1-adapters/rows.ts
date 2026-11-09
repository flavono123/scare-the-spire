import { postgrestTs } from "../../../src/lib/d1-time";
import type { D1Database } from "../d1";
import type { ApiDataEnv } from "../supabase-rest";

/**
 * Shared pieces of the D1 adapters (docs/supabase-exit/D1_SCHEMA_DESIGN.md 6): each adapter answers
 * one step-1 read route from D1 with the JSON the Supabase path returns today. Step 2 runs them as
 * shadow reads; step 3 serves their answers.
 */

export type AdapterContext = {
  db: D1Database;
  dataEnv: ApiDataEnv;
  url: URL;
  /** The verified caller of an /api/me route; null for public reads. */
  userId: string | null;
  now: number;
};

export type D1Adapter = (context: AdapterContext) => Promise<unknown>;

/** The request cannot be answered from D1 (a parameter the step-1 route accepts but D1 cannot bind). */
export class AdapterInputError extends Error {}

/**
 * A JSON column passed on as its stored text. Large documents (run game elements, pagestorm bodies)
 * are never parsed in the Worker (CPU budget, design 6 and 8): answerText() splices the text in,
 * materialize() parses it where a value is needed (the shadow comparison).
 */
export class RawJson {
  constructor(readonly text: string) {}
}

/**
 * An answer that is not JSON: stored text sent as the response body unchanged (the run raw file,
 * R3r, design 4.4). Never parsed or re-encoded in the Worker.
 */
export class TextBody {
  constructor(readonly text: string) {}
}

export type Row = Record<string, unknown>;

export function json(value: unknown): RawJson | null {
  return typeof value === "string" ? new RawJson(value) : null;
}

/** A stored timestamp as PostgREST prints it; a value not in the stored form is passed on as is. */
export function ts(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return postgrestTs(value) ?? (value as string);
}

/** INTEGER 0/1 as a JSON boolean; NULL stays null. */
export function bool(value: unknown): boolean | null {
  if (value === null || value === undefined) return null;
  return value === 1 || value === true;
}

/** RawJson leaves parsed into values; everything else copied. */
export function materialize(value: unknown): unknown {
  if (value instanceof RawJson) return JSON.parse(value.text);
  if (Array.isArray(value)) return value.map(materialize);
  if (value && typeof value === "object") {
    const out: Row = {};
    for (const [key, item] of Object.entries(value)) out[key] = materialize(item);
    return out;
  }
  return value;
}

/** The answer as JSON text, RawJson leaves spliced in unparsed. */
export function answerText(value: unknown): string {
  if (value instanceof RawJson) return value.text;
  if (Array.isArray(value)) return `[${value.map((item) => (item === undefined ? "null" : answerText(item))).join(",")}]`;
  if (value && typeof value === "object") {
    const parts: string[] = [];
    for (const [key, item] of Object.entries(value)) {
      if (item === undefined) continue;
      parts.push(`${JSON.stringify(key)}:${answerText(item)}`);
    }
    return `{${parts.join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

/** Bytes of the RawJson text an answer carries (the shadow's CPU guard). */
export function rawJsonLength(value: unknown): number {
  if (value instanceof RawJson) return value.text.length;
  if (Array.isArray(value)) return value.reduce((sum: number, item) => sum + rawJsonLength(item), 0);
  if (value && typeof value === "object") {
    let sum = 0;
    for (const item of Object.values(value)) sum += rawJsonLength(item);
    return sum;
  }
  return typeof value === "string" ? value.length : 0;
}

export type Query = { sql: string; params: unknown[] };

export function query(sql: string, ...params: unknown[]): Query {
  return { sql, params };
}

/** Runs the queries in one D1 round trip (a batch when there is more than one). */
export async function readAll(db: D1Database, queries: readonly Query[]): Promise<Row[][]> {
  if (queries.length === 0) return [];
  const prepared = queries.map((item) => db.prepare(item.sql).bind(...item.params));
  if (prepared.length === 1) return [((await prepared[0].all<Row>()).results ?? []) as Row[]];
  const results = await db.batch<Row>(prepared);
  return results.map((result) => (result.results ?? []) as Row[]);
}

/** Picks `columns` (a step-1 select list) from a built row, in that order. */
export function pick(row: Row, columns: readonly string[]): Row {
  const out: Row = {};
  for (const name of columns) out[name] = row[name];
  return out;
}

export function columnsOf(select: string): string[] {
  return select.split(",").map((name) => name.trim()).filter(Boolean);
}

export function jsonList(values: readonly string[]): string {
  return JSON.stringify(values);
}
