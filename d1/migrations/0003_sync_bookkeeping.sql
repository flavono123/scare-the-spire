-- Supabase exit step 2 (D1 shadow copy), design 4.1: bookkeeping for the 1-minute sync, the step-5
-- outbox, the daily check and the shadow reads, shared by every domain. Times here are INTEGER Unix ms.
-- Generated from docs/supabase-exit/d1-schema/schema.src.sql by gen_schema.py: edit the source
-- and regenerate (check.py fails when they differ). Once applied to a remote database, never
-- change this file; add a new migration section to the source instead.

-- One row per sync loop. 'supabase_in' = steps 2-4 change-log apply (Supabase -> D1),
-- 'outbox_out' = steps 5-7 mirror (D1 -> Supabase). A run takes the lease with a conditional upsert,
-- the same pattern as api_cache, so overlapping cron runs never apply concurrently. The window state
-- (low_watermark, high_seen, applied_above) is written by the last statement of every applied batch,
-- so committed work is never redone and a later failure cannot pin the window.
CREATE TABLE IF NOT EXISTS sync_state (
  name TEXT NOT NULL PRIMARY KEY CHECK (name IN ('supabase_in', 'outbox_out')),
  -- supabase_in: every change-log id <= low_watermark is applied OR recorded in sync_rejects (an open
  -- reject is owned by sync_rejects and retried there; it never pins the watermark).
  low_watermark INTEGER NOT NULL DEFAULT 0,
  -- supabase_in: largest change-log id read so far. New rows are read with id > high_seen, so a burst
  -- of more than one page never blocks the read.
  high_seen INTEGER NOT NULL DEFAULT 0 CHECK (high_seen >= low_watermark),
  -- supabase_in: ids in (low_watermark, high_seen] that are applied or rejected (JSON array of
  -- integers). The window is re-read once per run with id=not.in.(applied_above), so a late-committed
  -- lower id is still applied and nothing is applied twice. Bounded: at 2,000 ids high_seen stops
  -- moving until the watermark catches up.
  applied_above TEXT NOT NULL DEFAULT '[]'
    CHECK (json_valid(applied_above) AND json_type(applied_above) = 'array'
      AND json_array_length(applied_above) <= 2000),
  lease_until INTEGER NOT NULL DEFAULT 0,
  last_run_at INTEGER NOT NULL DEFAULT 0,
  last_applied_at INTEGER NOT NULL DEFAULT 0,
  -- supabase_in: largest (apply time - changed_at) of the last run, for the "lag < 2 min" gate.
  last_lag_ms INTEGER NOT NULL DEFAULT 0,
  -- Per-invocation budget counters of the last run (design 5.3): D1 statements, subrequests, raw run
  -- bytes fetched, and CPU ms (filled from the tail event's cpuTime; 0 until it arrives).
  last_statements INTEGER NOT NULL DEFAULT 0,
  last_subrequests INTEGER NOT NULL DEFAULT 0,
  last_raw_bytes INTEGER NOT NULL DEFAULT 0,
  last_cpu_ms INTEGER NOT NULL DEFAULT 0,
  fail_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT NOT NULL DEFAULT ''
) STRICT, WITHOUT ROWID;

-- A change one direction could not apply. The reject names the table and the D1 (in) or Supabase
-- (out) key; payload is the logged image kept for diagnosis only and is never replayed. A retry
-- re-reads the current source row by that key and upserts it (or deletes it when it is gone), so an
-- old image can never overwrite a newer one. A re-read that finds the row gone resolves the reject.
-- Only deterministic refusals of the current row stay open for an operator (up to 10 attempts).
-- An open reject blocks the step gate. One open reject per key: later failures of the key update it.
CREATE TABLE IF NOT EXISTS sync_rejects (
  direction TEXT NOT NULL CHECK (direction IN ('in', 'out')),
  ref INTEGER NOT NULL,                   -- first change-log id (in) or outbox seq (out)
  table_name TEXT NOT NULL,               -- Supabase table name (the mapper)
  d1_table TEXT NOT NULL,                 -- D1 table the key belongs to
  -- The D1 key as a JSON object, e.g. {"service": "combo", "id": "..."} or {"story_id": "...", "user_id": "..."}.
  row_key TEXT NOT NULL CHECK (json_valid(row_key) AND json_type(row_key) = 'object'),
  op TEXT NOT NULL,
  -- Short class (free text, leaf table rule, design 3.7). Known kinds closed automatically and only
  -- counted: 'orphan' (a 조각모음 body whose post is gone), 'cross_env' (a this-or-that like on a post
  -- of another env, invisible in Supabase too). Left open for a human: 'bad_timestamp' (canonicalTs gives
  -- null, or NULL where D1 needs a value), 'bad_element' (an array element D1 cannot split into a typed
  -- child row), 'check', 'fk', 'zero_rows', 'raw_fetch', 'supabase_4xx'. Values only a hand-crafted
  -- request can create are never changed in Supabase; they land here (design 3.1).
  reason TEXT NOT NULL DEFAULT 'error' CHECK (length(reason) BETWEEN 1 AND 64),
  payload TEXT NOT NULL CHECK (json_valid(payload)),
  error TEXT NOT NULL,
  first_at INTEGER NOT NULL,
  last_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 1 CHECK (attempts >= 1),
  resolved_at INTEGER,                    -- set when a re-read applies, finds the row gone, or an operator closes it
  PRIMARY KEY (direction, ref)
) STRICT;
-- Open rejects to retry at the start of each run, oldest first (S4). Resolved rows stay for the record.
CREATE INDEX IF NOT EXISTS sync_rejects_open ON sync_rejects (last_at) WHERE resolved_at IS NULL;
-- One open reject per key (S4c upsert target); later changes to a parked key fold into it.
CREATE UNIQUE INDEX IF NOT EXISTS sync_rejects_open_key ON sync_rejects (direction, table_name, row_key)
  WHERE resolved_at IS NULL;

-- Run files the sync has not fetched yet (design 5.3 item 9): a run I or heavy_changed U lands without
-- its raw and queues here; each invocation fetches at most 2 under a byte cap. It never blocks the
-- watermark: the D1 detail adapter falls back to Supabase while post_history_course_file is missing.
-- No FK: a run deleted before its fetch just drops its row here. Runs only, so the run id alone is the
-- key (the service is always history_course).
CREATE TABLE IF NOT EXISTS sync_pending_raw (
  post_id TEXT NOT NULL PRIMARY KEY,
  queued_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT NOT NULL DEFAULT ''
) STRICT, WITHOUT ROWID;
-- S13 next raws to fetch, oldest first.
CREATE INDEX IF NOT EXISTS sync_pending_raw_queued ON sync_pending_raw (queued_at, post_id);

-- Step 5: one row per source-row change, written in the same D1 batch as the change. The mirror sends
-- rows in seq order. A transient failure (5xx, timeout) stops the send in order; a permanent refusal
-- (4xx such as 23503 or 23514) moves that row to sync_rejects('out') and lets later rows continue,
-- unless they share its (table_name, match_key): the same id in two post tables does not block. Rows Supabase accepted are deleted, so "outbox is empty and no
-- open 'out' reject" is the health signal. Only source rows (never threads or counters), except the
-- puzzlebox state rows, the tournament candidate stats and the tournament play RPC (design 5.5).
-- A run row never carries its raw: the mirror reads post_history_course_file at send time.
CREATE TABLE IF NOT EXISTS outbox (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name TEXT NOT NULL,               -- Supabase table (or function, for op = 'rpc')
  op TEXT NOT NULL CHECK (op IN ('insert', 'upsert', 'update', 'delete', 'rpc')),
  -- Supabase match columns without env, e.g. {"id": "..."}; the mirror adds env = API_DATA_ENV. Only
  -- unique together with table_name (two post tables can hold the same id).
  match_key TEXT NOT NULL CHECK (json_valid(match_key) AND json_type(match_key) = 'object'),
  -- Columns (or RPC arguments) to send, without env and without derived columns; NULL for delete.
  -- Never a large document: run raws and post documents are read from their D1 table at send time
  -- (payload {"read": "<d1 table>"}), so an escaped copy cannot push this row past the 2 MB limit.
  payload TEXT CHECK (json_valid(payload) AND json_type(payload) = 'object'),
  created_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at INTEGER NOT NULL DEFAULT 0,
  last_error TEXT NOT NULL DEFAULT ''
) STRICT;

-- Daily comparison (GitHub Actions job), one row per Supabase source table (mapper), D1 table and
-- kind per day: the 7 Supabase Toy Box post tables and runs all map to posts, and runs also maps to
-- post_history_course and post_history_course_file. 'rows' = source and copied columns; 'derived' =
-- counters recomputed from rows.
CREATE TABLE IF NOT EXISTS sync_checks (
  check_date TEXT NOT NULL CHECK (check_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),   -- UTC date
  source_table TEXT NOT NULL,             -- Supabase table (the mapper)
  d1_table TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('rows', 'derived')),
  d1_rows INTEGER NOT NULL,
  supabase_rows INTEGER NOT NULL,
  -- sha-256 hex of the normalized row lines, sorted by byte order in the job (never by ORDER BY:
  -- Postgres and SQLite collations differ).
  d1_hash TEXT NOT NULL,
  supabase_hash TEXT NOT NULL,
  diff_count INTEGER NOT NULL,
  -- Up to 20 differing keys with a short reason each, plus known-drift classes.
  diff_sample TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(diff_sample)),
  checked_at INTEGER NOT NULL,
  PRIMARY KEY (check_date, source_table, d1_table, kind)
) STRICT, WITHOUT ROWID;

-- Step 2 shadow reads: counters per day and route, plus one sample per distinct difference.
CREATE TABLE IF NOT EXISTS shadow_stats (
  day TEXT NOT NULL CHECK (day GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  route_id TEXT NOT NULL,                 -- ApiRoute.id, e.g. 'read.engagement'
  compared INTEGER NOT NULL DEFAULT 0,
  differed INTEGER NOT NULL DEFAULT 0,
  skipped INTEGER NOT NULL DEFAULT 0,     -- not comparable (a side unavailable, row cap hit, CPU guard)
  PRIMARY KEY (day, route_id)
) STRICT, WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS shadow_diffs (
  day TEXT NOT NULL CHECK (day GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  route_id TEXT NOT NULL,
  diff_hash TEXT NOT NULL,                -- hash of the normalized difference; repeats collapse
  first_at INTEGER NOT NULL,
  hits INTEGER NOT NULL DEFAULT 1,
  sample TEXT NOT NULL CHECK (json_valid(sample) AND length(CAST(sample AS BLOB)) <= 8192),
  PRIMARY KEY (day, route_id, diff_hash)
) STRICT;
