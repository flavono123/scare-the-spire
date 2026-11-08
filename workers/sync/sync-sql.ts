import type { D1Statement } from "../../src/lib/d1-sync/statements";

/**
 * D1 statements of the 1-minute sync. S1, S4, S4d, S11, S13, S13c and S13d are the validated text of
 * docs/supabase-exit/d1-schema/queries.sql (scripts/d1-sync-cron.spec.ts checks they stay equal); S4c,
 * S13b and the apply statements come from the shared mapper. The few below without an id are new
 * here and run only on sync_state, sync_rejects and sync_pending_raw.
 */

export const S1 =
  "INSERT INTO sync_state (name, lease_until, last_run_at) VALUES (?1, ?2, ?3)\n" +
  "ON CONFLICT (name) DO UPDATE SET lease_until = excluded.lease_until, last_run_at = excluded.last_run_at\n" +
  "  WHERE sync_state.lease_until < excluded.last_run_at\n" +
  "RETURNING low_watermark, high_seen, applied_above;";

export const S4 =
  "SELECT direction, ref, table_name, d1_table, row_key, op, reason, attempts FROM sync_rejects\n" +
  "WHERE resolved_at IS NULL ORDER BY last_at LIMIT 10;";

export const S4D = "UPDATE sync_rejects SET resolved_at = ?3 WHERE direction = ?1 AND ref = ?2 AND resolved_at IS NULL;";

export const S11 =
  "UPDATE sync_state SET low_watermark = ?1, high_seen = ?2, applied_above = ?3, last_applied_at = ?4,\n" +
  "  last_lag_ms = ?5, last_statements = ?6, last_subrequests = ?7, last_raw_bytes = ?8\n" +
  "WHERE name = 'supabase_in' AND lease_until = ?9;";

export const S13 = "SELECT post_id, attempts FROM sync_pending_raw ORDER BY queued_at, post_id LIMIT 2;";

export const S13C =
  "INSERT INTO post_history_course_file (service, post_id, raw)\n" +
  "SELECT 'history_course', ?1, ?2 WHERE EXISTS (SELECT 1 FROM post_history_course WHERE service = 'history_course' AND post_id = ?1)\n" +
  "ON CONFLICT (service, post_id) DO UPDATE SET raw = excluded.raw;";

export const S13D = "DELETE FROM sync_pending_raw WHERE post_id = ?1;";

/** The flag and whether the first copy handed over its watermark (the sync_state row exists). */
export const SYNC_GATE =
  "SELECT (SELECT value FROM runtime_flags WHERE key = 'sync.enabled') AS flag, " +
  "EXISTS (SELECT 1 FROM sync_state WHERE name = 'supabase_in') AS started";

/** Every open 'in' reject key: changes to these keys fold into the reject (design 5.3 item 4). */
export const OPEN_KEYS = "SELECT table_name, row_key FROM sync_rejects WHERE direction = 'in' AND resolved_at IS NULL";

/** A raw fetch that failed: count it and move it to the back of the queue. */
export const RAW_FAIL = "UPDATE sync_pending_raw SET attempts = attempts + 1, last_error = ?2, queued_at = ?3 WHERE post_id = ?1";

/** A run that stopped on an error (lease-owner guarded, like S11). */
export const RUN_FAIL =
  "UPDATE sync_state SET fail_count = fail_count + 1, last_error = ?1 WHERE name = 'supabase_in' AND lease_until = ?2";

/** The D1 story_id of a comment, for the thread recount of a delete whose image has no story_id. */
export const COMMENT_THREAD = "SELECT story_id FROM comments WHERE id = ?1";

export const DEFER_FOREIGN_KEYS: D1Statement = { sql: "PRAGMA defer_foreign_keys = ON", params: [] };

export function s11Statement(window: {
  low: number;
  high: number;
  applied: readonly number[];
  appliedAt: number;
  lagMs: number;
  statements: number;
  subrequests: number;
  rawBytes: number;
  leaseUntil: number;
}): D1Statement {
  return {
    sql: S11,
    params: [
      window.low,
      window.high,
      JSON.stringify(window.applied),
      window.appliedAt,
      window.lagMs,
      window.statements,
      window.subrequests,
      window.rawBytes,
      window.leaseUntil,
    ],
  };
}

export function resolveStatement(ref: number, nowMs: number): D1Statement {
  return { sql: S4D, params: ["in", ref, nowMs] };
}
