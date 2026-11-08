import { stmt, type D1Statement, type D1Value } from "./db";
import { matchKey, mirrorTable } from "./tables";

/**
 * Outbox rows (docs/supabase-exit/D1_SCHEMA_DESIGN.md 4.1, 5.5), written in the same D1 batch as the
 * change they mirror. Payloads never carry a document: an upsert names the D1 table to read at send
 * time ({"read": ...}), so the mirror sends the current state of that key and an escaped copy of a
 * run raw or a post document can never push an outbox row past D1's 2 MB row limit. Request-only
 * Supabase columns D1 does not keep (design 7) ride along in `extra`.
 *
 * op: insert (ignore duplicates), upsert (merge), update (PATCH `columns`), delete (match only,
 * owner included), rpc (a Supabase function fed from the read).
 */

export type OutboxOp = "insert" | "upsert" | "update" | "delete" | "rpc";

export type OutboxPayload = {
  read?: string;
  /** update: the columns to send from the read row. */
  columns?: string[];
  /** Supabase columns D1 does not keep, sent as given. */
  extra?: Record<string, unknown>;
  /** rpc: the function name. */
  fn?: string;
};

export type OutboxRow = {
  table: string;
  op: OutboxOp;
  match: Record<string, D1Value>;
  payload: OutboxPayload | null;
};

/**
 * INSERT one outbox row. `guard` (with its own params after the five fixed ones, numbered from ?6)
 * makes the row conditional on the batch's outcome, like R14d's EXISTS: no row when the change did
 * not happen, so a refused write leaves nothing to mirror.
 */
export function outboxStatement(row: OutboxRow, nowMs: number, guard?: { sql: string; params: D1Value[] }): D1Statement {
  mirrorTable(row.table);
  const match = JSON.stringify(matchKey(row.table, row.match));
  const payload = row.payload === null ? null : JSON.stringify(row.payload);
  const where = guard ? ` WHERE ${guard.sql}` : "";
  return stmt(
    `INSERT INTO outbox (table_name, op, match_key, payload, created_at) SELECT ?1, ?2, ?3, ?4, ?5${where}`,
    row.table,
    row.op,
    match,
    payload,
    nowMs,
    ...(guard?.params ?? []),
  );
}

export function readPayload(d1Table: string, extra?: Record<string, unknown>): OutboxPayload {
  return extra && Object.keys(extra).length ? { read: d1Table, extra } : { read: d1Table };
}
