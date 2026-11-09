import {
  sourceFlagKey,
  WRITE_GROUPS,
  WRITE_PAUSED_KEY,
  type WriteGroup,
  type WriteSource,
} from "../../../src/lib/write-source-flags";
import { withTimeout, type D1Database } from "../d1";
import { FRESH_MS, STALE_MAX_MS } from "../flags";

/**
 * The step 5 write gate (docs/SUPABASE_EXIT_PLAN.md 7.3 step 5): which store a write group writes
 * to, and whether writes are paused for the cutover. Read from D1 runtime_flags beside the step 1
 * path flags, kept in isolate memory like them (a value older than FRESH_MS is re-read).
 *
 * When the flags cannot be read and no value younger than STALE_MAX_MS is in memory, readWriteGate
 * returns null and the hook (index.ts fallbackGate) uses the Worker var API_WRITE_SOURCE_DEFAULT
 * (supabase unless it says d1), never paused. That keeps today's behaviour while no flag is set;
 * once D1 is the source, set API_WRITE_SOURCE_DEFAULT=d1 at the next deploy so an unreadable gate
 * cannot send a write to Supabase. (The router's own path flags fail the same way: a request only
 * gets here when they were read within STALE_MAX_MS, or on a failed read with API_PATH_DEFAULT=api.)
 */

export type WriteGate = {
  paused: boolean;
  sources: Readonly<Record<WriteGroup, WriteSource>>;
};

export const GATE_SQL =
  "SELECT key, value FROM runtime_flags WHERE key = ?1 OR (key >= 'source.' AND key < 'source/')";
export const GATE_WAIT_MS = 1_000;

let memory: { gate: WriteGate; readAt: number } | null = null;

export function resetWriteGateForTest(): void {
  memory = null;
}

/** Flag rows -> gate. Unknown values fall back to today's behaviour (supabase, not paused). */
export function parseGateRows(rows: readonly { key?: unknown; value?: unknown }[]): WriteGate {
  const byKey = new Map(rows.map((row) => [row.key, row.value]));
  const sources = Object.fromEntries(
    WRITE_GROUPS.map((group) => [group, byKey.get(sourceFlagKey(group)) === "d1" ? "d1" : "supabase"]),
  ) as Record<WriteGroup, WriteSource>;
  return { paused: byKey.get(WRITE_PAUSED_KEY) === "on", sources };
}

export async function readWriteGate(db: D1Database | undefined, now = Date.now()): Promise<WriteGate | null> {
  if (memory && now - memory.readAt < FRESH_MS) return memory.gate;
  if (!db) return null;
  try {
    const result = await withTimeout(db.prepare(GATE_SQL).bind(WRITE_PAUSED_KEY).all<{ key: string; value: string }>(), GATE_WAIT_MS);
    const gate = parseGateRows(result.results ?? []);
    memory = { gate, readAt: Date.now() };
    return gate;
  } catch {
    if (memory && now - memory.readAt < STALE_MAX_MS) return memory.gate;
    return null;
  }
}

/** True when every write group writes to Supabase: only then may the step 2 sync apply Supabase changes to D1. */
export function supabaseInSyncAllowed(gate: WriteGate | null): boolean {
  return gate !== null && WRITE_GROUPS.every((group) => gate.sources[group] === "supabase");
}

/** True when some group writes to D1 (the outbox mirror has work to do). */
export function anyD1Source(gate: WriteGate | null): boolean {
  return gate !== null && WRITE_GROUPS.some((group) => gate.sources[group] === "d1");
}
