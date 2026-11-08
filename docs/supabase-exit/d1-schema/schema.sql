-- =====================================================================================================
-- D1 schema draft for the Supabase exit, step 2 (docs/supabase-exit/D1_SCHEMA_DESIGN.md).
-- Applies after the existing d1/migrations 0001_runtime_flags.sql and 0002_api_cache.sql, which are
-- unchanged. Split into migrations at the "-- migration:" markers.
--
-- Conventions (design section "공통 규칙"):
--   * One D1 database per environment (slseoun-prod, slseoun-testbed, local dev). No env column, and no
--     index starts with env.
--   * Every new table is STRICT. Small-row tables are WITHOUT ROWID; tables holding documents keep rowids.
--   * Data timestamps: TEXT 'YYYY-MM-DDTHH:MM:SS.ffffffZ' (UTC, exactly 6 fraction digits, 27 chars).
--     Fixed width, so BINARY text order is time order and (created_at, id) keysets compare text.
--     Bookkeeping times that never leave D1: INTEGER Unix milliseconds (like api_cache).
--   * uuid: lowercase hyphenated TEXT, the exact Supabase id. Run ids: TEXT, octet_length <= 1024 (Postgres runs_key_size_check).
--   * Boolean: INTEGER 0/1 (NULL where Postgres is nullable). A NULL passes a CHECK, as in Postgres.
--   * JSON: TEXT with json_valid(); arrays filtered or joined by element are child tables.
--   * user_id columns have no FK: D1 has no users table, and an FK cannot be added later without a
--     table rebuild.
--   * CHECKs accept every row Supabase accepts (Postgres bounds); the Worker keeps its stricter rules.
--   * No SQLite triggers: derived values are explicit statements in the Worker's batch (step 5) and
--     Supabase's copied values in steps 2-4.
--   * Ported columns keep their Supabase names; tables born from the posts split are posts,
--     post_<service> (1:1) and post_<service>_<children>.
--   * posts is keyed by (service, id). Every per-service and child table carries a stored constant
--     service column (DEFAULT and CHECK = its service) and references its parent by (service, post_id).
--     A VIRTUAL generated column could be an FK child column but cannot be in a PRIMARY KEY, and a parent
--     key must be a PRIMARY KEY or UNIQUE, so the stored column is the cheapest form that works for every
--     table: a few bytes per row, no extra index or row write.
-- =====================================================================================================


-- =====================================================================================================
-- migration: 0003_sync_bookkeeping.sql
-- Shared by every domain. Times here are INTEGER Unix ms.
-- =====================================================================================================

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


-- =====================================================================================================
-- migration: 0004_engagement.sql
-- Comments, likes, reactions, stories, and the thread counters.
-- =====================================================================================================

-- Comments on any thread key. No UPDATE path for users, as in Postgres.
-- Not ported: env, parent_id and its self FK, meta (CLEANUP_AUDIT 3.1).
CREATE TABLE IF NOT EXISTS comments (
  id TEXT NOT NULL PRIMARY KEY CHECK (id GLOB '[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]'),
  -- Thread key (same column name as Supabase). Free string, no FK: orphans are kept, as today.
  -- Postgres checks only octet_length <= 1024, so '' is accepted here too (no lower bound).
  story_id TEXT NOT NULL CHECK (length(CAST(story_id AS BLOB)) <= 1024),
  user_id TEXT NOT NULL CHECK (user_id GLOB '[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]'),
  -- Author snapshot, frozen at insert.
  nickname TEXT NOT NULL CHECK (length(nickname) BETWEEN 1 AND 20),
  avatar_id TEXT,
  avatar_kind TEXT,
  palette_id TEXT,
  palette_swapped INTEGER DEFAULT 0 CHECK (palette_swapped IN (0, 1)),
  -- Postgres allows 1 character; the Worker requires trim >= 2 for new comments.
  content TEXT NOT NULL CHECK (length(content) BETWEEN 1 AND 2000),
  -- Rich block array, display only. Worker cap 128 KiB; this is a row backstop.
  content_blocks TEXT CHECK (json_valid(content_blocks) AND length(CAST(content_blocks AS BLOB)) <= 1048576),
  -- Count of comment_likes rows, set by recount in the same batch (no Supabase column).
  like_count INTEGER NOT NULL DEFAULT 0 CHECK (like_count >= 0),
  created_at TEXT NOT NULL CHECK (created_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9][0-9][0-9][0-9]Z'),
  CHECK (coalesce(length(CAST(avatar_id AS BLOB)), 0) + coalesce(length(CAST(avatar_kind AS BLOB)), 0)
         + coalesce(length(CAST(palette_id AS BLOB)), 0) <= 1024)
) STRICT;
-- E1 thread read, E2 my-liked overlay, E13 recount (covering: id and max(created_at) from the index).
CREATE INDEX IF NOT EXISTS comments_thread ON comments (story_id, created_at, id);
-- E8 courier: newest comments.
CREATE INDEX IF NOT EXISTS comments_recent ON comments (created_at, id);
-- P2 / P3 profile activity: my comments by time.
CREATE INDEX IF NOT EXISTS comments_user ON comments (user_id, created_at, id);

-- Who liked which comment. Not ported: id (never read). Key = the old unique pair.
-- created_at is nullable in Postgres, but the app never writes NULL (the column default fills it). A
-- NULL or odd created_at that only a hand-crafted request can create is not changed in Supabase: the
-- sync parks that row in sync_rejects ('bad_timestamp') for a human (design 3.1).
CREATE TABLE IF NOT EXISTS comment_likes (
  comment_id TEXT NOT NULL REFERENCES comments (id) ON DELETE CASCADE,
  user_id TEXT NOT NULL CHECK (user_id GLOB '[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]'),
  created_at TEXT NOT NULL CHECK (created_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9][0-9][0-9][0-9]Z'),
  PRIMARY KEY (comment_id, user_id)
) STRICT, WITHOUT ROWID;

-- Likes on a thread key (Supabase likes). Not ported: id, env, reaction_type (always 'thumb_up').
-- No FK: the key is a thread key, not a post id, and Supabase has none either. The this-or-that
-- likes are their own table (this_or_that_post_likes, 0005); a 'this-or-that:' row in Supabase likes
-- is copied here as an ordinary like on that thread key, as today.
-- created_at: same crafted-value rule as comment_likes.
CREATE TABLE IF NOT EXISTS likes (
  story_id TEXT NOT NULL CHECK (length(CAST(story_id AS BLOB)) <= 1024),
  user_id TEXT NOT NULL CHECK (user_id GLOB '[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]'),
  created_at TEXT NOT NULL CHECK (created_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9][0-9][0-9][0-9]Z'),
  PRIMARY KEY (story_id, user_id)
) STRICT, WITHOUT ROWID;

-- Per-thread counters (decision 3). One row per key that ever had a like or comment; never deleted
-- (zeros stay). Set from source rows by recount, never incremented. No FK to any post. Not mirrored.
-- like_count counts likes rows only, like get_engagement_counts; the this-or-that like count is
-- recounted from this_or_that_post_likes into posts.like_count (E13c).
CREATE TABLE IF NOT EXISTS threads (
  thread_key TEXT NOT NULL PRIMARY KEY CHECK (length(CAST(thread_key AS BLOB)) <= 1024),
  like_count INTEGER NOT NULL DEFAULT 0 CHECK (like_count >= 0),        -- rows in likes
  comment_count INTEGER NOT NULL DEFAULT 0 CHECK (comment_count >= 0),  -- rows in comments
  last_comment_at TEXT CHECK (last_comment_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9][0-9][0-9][0-9]Z'),               -- max(comments.created_at)
  updated_at INTEGER NOT NULL DEFAULT 0                                 -- Unix ms of the last recount
) STRICT, WITHOUT ROWID;

-- Buff / nerf / rework per user per resource version. Key reordered so resource_id leads (every
-- read filters by it).
CREATE TABLE IF NOT EXISTS resource_reactions (
  resource_id TEXT NOT NULL CHECK (length(resource_id) <= 128),
  resource_type TEXT NOT NULL CHECK (length(resource_type) <= 32),
  game_version TEXT NOT NULL CHECK (length(game_version) <= 32),
  user_id TEXT NOT NULL CHECK (user_id GLOB '[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]'),
  kind TEXT NOT NULL CHECK (kind IN ('buff', 'nerf', 'rework')),
  PRIMARY KEY (resource_id, resource_type, game_version, user_id)
) STRICT, WITHOUT ROWID;

-- Totals per resource version. Steps 2-4: copied from Supabase. Step 5+: recount in the reaction
-- batch. Created on the first reaction, never deleted. Not mirrored.
CREATE TABLE IF NOT EXISTS resource_reaction_counts (
  resource_id TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  game_version TEXT NOT NULL,
  buff_count INTEGER NOT NULL DEFAULT 0 CHECK (buff_count >= 0),
  nerf_count INTEGER NOT NULL DEFAULT 0 CHECK (nerf_count >= 0),
  rework_count INTEGER NOT NULL DEFAULT 0 CHECK (rework_count >= 0),
  PRIMARY KEY (resource_id, resource_type, game_version)
) STRICT, WITHOUT ROWID;

-- 이야기. Not a posts row: not a Toy Box service, no counter columns, no count sort, no nav surface,
-- and official stories use a bare thread key.
CREATE TABLE IF NOT EXISTS community_stories (
  id TEXT NOT NULL PRIMARY KEY CHECK (id GLOB '[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]'),
  user_id TEXT CHECK (user_id GLOB '[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]'),                 -- NULL for official (seed) stories
  -- Seed id; non-null makes the row official and its thread key the bare id. Admin scripts and the
  -- sync write it, users never do.
  static_story_id TEXT UNIQUE CHECK (length(CAST(static_story_id AS BLOB)) <= 1024),
  nickname TEXT NOT NULL CHECK (length(nickname) BETWEEN 1 AND 20),
  avatar_id TEXT,
  avatar_kind TEXT,
  palette_id TEXT,
  palette_swapped INTEGER DEFAULT 0 CHECK (palette_swapped IN (0, 1)),
  sentence TEXT NOT NULL CHECK (length(sentence) BETWEEN 2 AND 120),
  game TEXT NOT NULL DEFAULT 'sts2' CHECK (game IN ('sts1', 'sts2')),
  entity_type TEXT CHECK (length(CAST(entity_type AS BLOB)) <= 1024),
  entity_id TEXT CHECK (length(CAST(entity_id AS BLOB)) <= 1024),
  change_id TEXT CHECK (length(CAST(change_id AS BLOB)) <= 1024),
  patch_line_id TEXT CHECK (length(CAST(patch_line_id AS BLOB)) <= 1024),
  source TEXT CHECK (length(CAST(source AS BLOB)) <= 1024),  -- patch id; feed filter of patch pages
  -- Display-only arrays: JSON TEXT.
  tags TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(tags) AND length(CAST(tags AS BLOB)) <= 1048576),
  linked_entities TEXT NOT NULL DEFAULT '[]'
    CHECK (json_valid(linked_entities) AND length(CAST(linked_entities AS BLOB)) <= 1048576),
  created_at TEXT NOT NULL CHECK (created_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9][0-9][0-9][0-9]Z'),
  CHECK (coalesce(length(CAST(avatar_id AS BLOB)), 0) + coalesce(length(CAST(avatar_kind AS BLOB)), 0)
         + coalesce(length(CAST(palette_id AS BLOB)), 0) <= 1024)
) STRICT;
-- E10 story feed, newest first.
CREATE INDEX IF NOT EXISTS community_stories_recent ON community_stories (created_at, id);
-- E10b story feed of one patch.
CREATE INDEX IF NOT EXISTS community_stories_source ON community_stories (source, created_at, id);
-- P2 profile activity: my stories (official rows have no owner).
CREATE INDEX IF NOT EXISTS community_stories_user ON community_stories (user_id, created_at, id)
  WHERE user_id IS NOT NULL;


-- =====================================================================================================
-- migration: 0005_posts.sql
-- Toy Box posts and History Course runs: one posts row per post, one post_<service> row with the
-- service's typed columns, child tables for arrays filtered or joined by element.
-- =====================================================================================================

-- posts is the parent of about 16 tables with ON DELETE CASCADE. Never DROP or rebuild it alone: D1
-- cannot turn foreign keys off, so DROP TABLE runs an implicit DELETE that cascades into every child
-- (design 3.7). Hence no enum-like list here: a new service is a new post_<service> table only.
CREATE TABLE IF NOT EXISTS posts (
  -- API / feed service id. Thread key prefix, nav id and the Supabase table are derived in TypeScript,
  -- which also holds the list of known services. Shape check only, so adding a service needs no
  -- rebuild (grow-only rule).
  service TEXT NOT NULL CHECK (length(service) BETWEEN 1 AND 32 AND service NOT GLOB '*[^a-z_]*'),
  -- uuid for the Toy Box services; the content-hash run id for history_course. The key is
  -- (service, id) because Supabase keeps a primary key per post table (and runs): the same id in two
  -- tables is two rows here too, so a row never changes service.
  id TEXT NOT NULL,
  -- Owner. NULL only for builtin tournaments (preset_key 'builtin:*') and for a run whose donor was
  -- removed (Postgres ON DELETE SET NULL).
  user_id TEXT CHECK (user_id GLOB '[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]'),
  -- Author snapshot (decision 5): frozen at insert, refreshed by edits of the 4 editable services.
  -- For history_course this is the donor nickname, rewritten by the donor's nickname sync; the token
  -- columns are NULL.
  nickname TEXT NOT NULL,
  avatar_id TEXT,
  avatar_kind TEXT,
  palette_id TEXT,
  palette_swapped INTEGER DEFAULT 0 CHECK (palette_swapped IN (0, 1)),
  -- The service's own title (transfigure, favorite_tournament, decisions_decisions, pagestorm).
  title TEXT,
  -- Board (조각모음) title: left(btrim(<service expression>), 120), computed in the write statement.
  summary TEXT NOT NULL CHECK (length(summary) <= 120),
  -- Denormalized counts for the count sorts (decision 3). Steps 2-4: copied from Supabase. Step 5+:
  -- copied from threads('<prefix>:<id>') in the like/comment batch (E13c), except this_or_that:
  -- like_count is recounted from this_or_that_post_likes (E13c, design 2.2).
  like_count INTEGER NOT NULL DEFAULT 0 CHECK (like_count >= 0),
  comment_count INTEGER NOT NULL DEFAULT 0 CHECK (comment_count >= 0),
  created_at TEXT NOT NULL CHECK (created_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9][0-9][0-9][0-9]Z'),
  -- Toy Box ids are Postgres uuid; runs.id is text with octet_length <= 1024 only (runs_key_size_check).
  CHECK (CASE WHEN service = 'history_course' THEN length(CAST(id AS BLOB)) <= 1024
              ELSE id GLOB '[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]' END),
  CHECK (CASE WHEN service = 'history_course'
              THEN length(trim(nickname)) BETWEEN 1 AND 20 AND length(CAST(nickname AS BLOB)) <= 1024
              ELSE length(nickname) BETWEEN 1 AND 20 END),
  CHECK (user_id IS NOT NULL OR service IN ('favorite_tournament', 'history_course')),
  CHECK (coalesce(length(CAST(avatar_id AS BLOB)), 0) + coalesce(length(CAST(avatar_kind AS BLOB)), 0)
         + coalesce(length(CAST(palette_id AS BLOB)), 0) <= 1024),
  -- Per-service title rules for the known services only; a future service gets the loose ELSE.
  CHECK (CASE
    WHEN service = 'transfigure' THEN title IS NULL
      OR (length(trim(title)) BETWEEN 1 AND 80 AND length(CAST(title AS BLOB)) <= 1024)
    WHEN service IN ('favorite_tournament', 'decisions_decisions', 'pagestorm')
      THEN title IS NOT NULL AND length(title) BETWEEN 1 AND 80
    WHEN service IN ('combo', 'this_or_that', 'chemical_x', 'history_course') THEN title IS NULL
    ELSE title IS NULL OR length(title) BETWEEN 1 AND 80 END),
  PRIMARY KEY (service, id)
) STRICT, WITHOUT ROWID;
-- T1 service feed latest, T11 Pagestorm index, R1 History Course list, T7 board run filter (sort=latest),
-- E9 nav latest.
CREATE INDEX IF NOT EXISTS posts_service_created ON posts (service, created_at, id);
-- T2 / T3 service feed by likes / comments, T7 board run filter (sort=likes / comments).
CREATE INDEX IF NOT EXISTS posts_service_likes ON posts (service, like_count, created_at, id);
CREATE INDEX IF NOT EXISTS posts_service_comments ON posts (service, comment_count, created_at, id);
-- T6 조각모음 board across all services (runs included).
CREATE INDEX IF NOT EXISTS posts_created ON posts (created_at, id);
CREATE INDEX IF NOT EXISTS posts_likes ON posts (like_count, created_at, id);
CREATE INDEX IF NOT EXISTS posts_comments ON posts (comment_count, created_at, id);
-- P2 / P3 profile activity, R7 own run ids, R12 donor nickname sync, local admin metrics. service is
-- second so "my rows of one service" (R7, R12) is an equality seek and never loses to the PK's
-- service prefix.
CREATE INDEX IF NOT EXISTS posts_user ON posts (user_id, service, created_at, id);

-- Per-service tables, keyed (service, post_id) with a constant service column (header). Upserts into
-- posts use ON CONFLICT DO UPDATE, never INSERT OR REPLACE: REPLACE deletes the row first and would
-- cascade into every table below. post_combo,
-- post_this_or_that, post_favorite_tournament and post_history_course are cascade parents too (as is
-- comments): never DROP them alone either. Enum-like CHECKs copied from Postgres stay only on leaf
-- tables (post_transfigure, contact_inquiries), which can be rebuilt (new, copy, drop, rename) before
-- Supabase widens the same CHECK.

-- 케미컬X: one-line rich post. Supabase has no array CHECK on content.
CREATE TABLE IF NOT EXISTS post_chemical_x (
  service TEXT NOT NULL DEFAULT 'chemical_x' CHECK (service = 'chemical_x'),
  post_id TEXT NOT NULL,
  content TEXT NOT NULL CHECK (json_valid(content)),       -- PostBlock[] document, display only
  content_text TEXT NOT NULL CHECK (length(content_text) BETWEEN 2 AND 30),
  PRIMARY KEY (service, post_id),
  FOREIGN KEY (service, post_id) REFERENCES posts (service, id) ON DELETE CASCADE
) STRICT;

-- 코오오옴보.
CREATE TABLE IF NOT EXISTS post_combo (
  service TEXT NOT NULL DEFAULT 'combo' CHECK (service = 'combo'),
  post_id TEXT NOT NULL,
  content TEXT NOT NULL CHECK (json_valid(content) AND json_type(content) = 'array'),
  content_text TEXT NOT NULL CHECK (length(content_text) >= 2 AND length(CAST(content_text AS BLOB)) <= 65536),
  PRIMARY KEY (service, post_id),
  FOREIGN KEY (service, post_id) REFERENCES posts (service, id) ON DELETE CASCADE
) STRICT;

-- combo_posts.resources: the post's game elements, filtered and ranked by element (decision 2).
-- The app writes every element as {"type": string, "id": string}. An element without them (only a
-- hand-crafted request can write one; Supabase has no CHECK and gets none) is never dropped or
-- reshaped: the sync parks the post in sync_rejects ('bad_element') for a human (design 3.1).
-- ord keeps the array order. No element index yet: no server query filters by element; add
-- (resource_type, resource_id, post_id) when one does.
CREATE TABLE IF NOT EXISTS post_combo_resources (
  service TEXT NOT NULL DEFAULT 'combo' CHECK (service = 'combo'),
  post_id TEXT NOT NULL,
  ord INTEGER NOT NULL CHECK (ord >= 0),
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  PRIMARY KEY (service, post_id, ord),
  FOREIGN KEY (service, post_id) REFERENCES post_combo (service, post_id) ON DELETE CASCADE
) STRICT, WITHOUT ROWID;

-- 변형: the representative variant in typed columns, up to 11 more in extra_variants (display only).
-- Not ported: source_game_locale (write-only). title is in posts.
CREATE TABLE IF NOT EXISTS post_transfigure (
  service TEXT NOT NULL DEFAULT 'transfigure' CHECK (service = 'transfigure'),
  post_id TEXT NOT NULL,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('card', 'character', 'keyword', 'relic', 'potion',
    'power', 'enchantment', 'affliction', 'event', 'ancient', 'epoch')),
  resource_id TEXT NOT NULL CHECK (length(resource_id) BETWEEN 1 AND 128),
  source_text TEXT NOT NULL CHECK (length(source_text) >= 1 AND length(CAST(source_text AS BLOB)) <= 65536),
  content TEXT NOT NULL CHECK (json_valid(content) AND json_type(content) = 'array'),
  content_text TEXT NOT NULL CHECK (length(content_text) >= 2 AND length(CAST(content_text AS BLOB)) <= 65536),
  transformed_name TEXT CHECK (transformed_name IS NULL
    OR (length(trim(transformed_name)) BETWEEN 1 AND 80 AND length(CAST(transformed_name AS BLOB)) <= 1024)),
  -- Postgres: btrim(x) ~ '^(X|[0-9]{1,2})$'. GLOB is exact for these three shapes.
  transformed_cost TEXT CHECK (transformed_cost IS NULL OR (length(CAST(transformed_cost AS BLOB)) <= 1024
    AND (trim(transformed_cost) = 'X' OR trim(transformed_cost) GLOB '[0-9]' OR trim(transformed_cost) GLOB '[0-9][0-9]'))),
  transformed_star_cost TEXT CHECK (transformed_star_cost IS NULL OR (length(CAST(transformed_star_cost AS BLOB)) <= 1024
    AND (trim(transformed_star_cost) = 'X' OR trim(transformed_star_cost) GLOB '[0-9]'
         OR trim(transformed_star_cost) GLOB '[0-9][0-9]'))),
  upgraded_content TEXT CHECK (upgraded_content IS NULL
    OR (json_valid(upgraded_content) AND json_type(upgraded_content) = 'array')),
  upgraded_content_text TEXT CHECK (length(CAST(upgraded_content_text AS BLOB)) <= 65536),
  transformed_upgrade_cost TEXT CHECK (transformed_upgrade_cost IS NULL
    OR (length(CAST(transformed_upgrade_cost AS BLOB)) <= 1024 AND (trim(transformed_upgrade_cost) = 'X'
        OR trim(transformed_upgrade_cost) GLOB '[0-9]' OR trim(transformed_upgrade_cost) GLOB '[0-9][0-9]'))),
  transformed_upgrade_star_cost TEXT CHECK (transformed_upgrade_star_cost IS NULL
    OR (length(CAST(transformed_upgrade_star_cost AS BLOB)) <= 1024 AND (trim(transformed_upgrade_star_cost) = 'X'
        OR trim(transformed_upgrade_star_cost) GLOB '[0-9]' OR trim(transformed_upgrade_star_cost) GLOB '[0-9][0-9]'))),
  show_upgrade INTEGER NOT NULL DEFAULT 0 CHECK (show_upgrade IN (0, 1)),
  omit_energy_cost INTEGER DEFAULT 0 CHECK (omit_energy_cost IN (0, 1)),
  -- text[] in Postgres, display only: JSON arrays of strings. pg_column_size limits are Worker rules.
  card_top_keywords TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(card_top_keywords)
    AND json_type(card_top_keywords) = 'array' AND json_array_length(card_top_keywords) <= 5),
  card_bottom_keywords TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(card_bottom_keywords)
    AND json_type(card_bottom_keywords) = 'array' AND json_array_length(card_bottom_keywords) <= 3),
  upgraded_card_top_keywords TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(upgraded_card_top_keywords)
    AND json_type(upgraded_card_top_keywords) = 'array' AND json_array_length(upgraded_card_top_keywords) <= 5),
  upgraded_card_bottom_keywords TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(upgraded_card_bottom_keywords)
    AND json_type(upgraded_card_bottom_keywords) = 'array' AND json_array_length(upgraded_card_bottom_keywords) <= 3),
  -- Game-translation strings, kept byte for byte.
  transformed_card_type TEXT CHECK (transformed_card_type IN ('공격', '스킬', '파워', '저주', '상태이상', '퀘스트')),
  transformed_card_rarity TEXT CHECK (transformed_card_rarity
    IN ('일반', '고급', '희귀', '고대의 존재', '이벤트', '토큰', '저주', '상태이상', '퀘스트')),
  transformed_card_color TEXT CHECK (transformed_card_color IN ('ironclad', 'silent', 'regent', 'necrobinder',
    'defect', 'colorless', 'status', 'curse', 'event', 'quest', 'token')),
  token_color TEXT CHECK (token_color IN ('gold', 'red', 'green', 'orange', 'pink', 'aqua', 'blue', 'purple')),
  token_wax TEXT CHECK (token_wax IN ('wax', 'melted')),
  -- TransfigureVariant[], display only; the variant rules are Worker validation, as today.
  extra_variants TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(extra_variants) AND json_type(extra_variants) = 'array'
    AND json_array_length(extra_variants) <= 11 AND length(CAST(extra_variants AS BLOB)) <= 1048576),
  CHECK (resource_type = 'card' OR (json_array_length(card_top_keywords) = 0 AND json_array_length(card_bottom_keywords) = 0
    AND json_array_length(upgraded_card_top_keywords) = 0 AND json_array_length(upgraded_card_bottom_keywords) = 0)),
  CHECK (show_upgrade = 0 OR resource_type = 'card'),
  CHECK (transformed_card_type IS NULL OR resource_type = 'card'),
  CHECK (transformed_card_rarity IS NULL OR resource_type = 'card'),
  CHECK (transformed_card_color IS NULL OR resource_type = 'card'),
  CHECK (token_color IS NULL OR resource_type IN ('relic', 'potion', 'power', 'enchantment', 'affliction')),
  CHECK (token_wax IS NULL OR resource_type IN ('relic', 'potion', 'power', 'enchantment', 'affliction')),
  CHECK (transformed_upgrade_cost IS NULL OR upgraded_content IS NOT NULL),
  CHECK (upgraded_content IS NOT NULL
    OR (json_array_length(upgraded_card_top_keywords) = 0 AND json_array_length(upgraded_card_bottom_keywords) = 0)),
  CHECK ((upgraded_content IS NULL AND upgraded_content_text IS NULL)
    OR (upgraded_content IS NOT NULL AND upgraded_content_text IS NOT NULL AND length(trim(upgraded_content_text)) >= 2)),
  PRIMARY KEY (service, post_id),
  FOREIGN KEY (service, post_id) REFERENCES posts (service, id) ON DELETE CASCADE
) STRICT;

-- 이거 아님 저거?: two typed sides, a reason, the ballot counters. vote_rate_bps (generated, unread)
-- is not stored; the read adapter computes it while answers must match Supabase.
CREATE TABLE IF NOT EXISTS post_this_or_that (
  service TEXT NOT NULL DEFAULT 'this_or_that' CHECK (service = 'this_or_that'),
  post_id TEXT NOT NULL,
  left_type TEXT NOT NULL CHECK (length(CAST(left_type AS BLOB)) <= 1024),
  left_id TEXT NOT NULL CHECK (length(CAST(left_id AS BLOB)) <= 1024),
  right_type TEXT NOT NULL CHECK (length(CAST(right_type AS BLOB)) <= 1024),
  right_id TEXT NOT NULL CHECK (length(CAST(right_id AS BLOB)) <= 1024),
  reason TEXT NOT NULL CHECK (length(reason) BETWEEN 2 AND 500),
  -- Derived from this_or_that_post_votes. Steps 2-4 copy Supabase; step 5 recounts in the vote batch.
  left_vote_count INTEGER NOT NULL DEFAULT 0 CHECK (left_vote_count >= 0),
  right_vote_count INTEGER NOT NULL DEFAULT 0 CHECK (right_vote_count >= 0),
  CHECK (left_type <> right_type OR left_id <> right_id),
  PRIMARY KEY (service, post_id),
  FOREIGN KEY (service, post_id) REFERENCES posts (service, id) ON DELETE CASCADE
) STRICT, WITHOUT ROWID;

-- One ballot per user per post. Private: only /api/me reads rows; the public sees the counters.
-- Not ported: created_surface (write-only), env. FK and cascade as in Postgres (post_id -> this_or_that_posts).
CREATE TABLE IF NOT EXISTS this_or_that_post_votes (
  service TEXT NOT NULL DEFAULT 'this_or_that' CHECK (service = 'this_or_that'),
  post_id TEXT NOT NULL,
  user_id TEXT NOT NULL CHECK (user_id GLOB '[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]'),
  choice TEXT NOT NULL CHECK (choice IN ('left', 'right')),
  created_at TEXT NOT NULL CHECK (created_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9][0-9][0-9][0-9]Z'),
  PRIMARY KEY (service, post_id, user_id),
  FOREIGN KEY (service, post_id) REFERENCES post_this_or_that (service, post_id) ON DELETE CASCADE
) STRICT, WITHOUT ROWID;

-- 이거 아님 저거? likes (Supabase this_or_that_post_likes). Key = (service, post_id, user_id): the Supabase
-- UNIQUE (post_id, user_id, env) without env, with the constant service in front; not ported: id (never
-- read), env. Supabase's FK ignores env, so a like can point at a post of the other env (tasks/010
-- #70). Supabase hides such a like everywhere (counts, views and the profile RPC match env); the sync
-- counts it as 'cross_env', skips it and closes the reject (design 2.2). FK and cascade as in Postgres (post_id -> this_or_that_posts ON
-- DELETE CASCADE): a like needs the post, and deleting the post deletes its likes. The source of the
-- post's like_count (recount E13c, step 5+) and of T15, T16, P2, P3, as today's view and RPCs read it.
-- created_at: NOT NULL already in Postgres; an odd client-sent value follows the crafted-value rule.
CREATE TABLE IF NOT EXISTS this_or_that_post_likes (
  service TEXT NOT NULL DEFAULT 'this_or_that' CHECK (service = 'this_or_that'),
  post_id TEXT NOT NULL,
  user_id TEXT NOT NULL CHECK (user_id GLOB '[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]'),
  created_at TEXT NOT NULL CHECK (created_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9][0-9][0-9][0-9]Z'),
  PRIMARY KEY (service, post_id, user_id),
  FOREIGN KEY (service, post_id) REFERENCES post_this_or_that (service, post_id) ON DELETE CASCADE
) STRICT, WITHOUT ROWID;

-- 이아저? 월드컵. Not ported: game_version (write-only for tournaments). title is in posts.
CREATE TABLE IF NOT EXISTS post_favorite_tournament (
  service TEXT NOT NULL DEFAULT 'favorite_tournament' CHECK (service = 'favorite_tournament'),
  post_id TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '' CHECK (length(note) <= 500),
  -- 'custom' for user tournaments, 'builtin:<key>' for seeded ones (posts.user_id NULL).
  preset_key TEXT NOT NULL CHECK (length(preset_key) BETWEEN 1 AND 64),
  -- Derived from favorite_tournament_plays. Steps 2-4 copy Supabase; step 5 the play batch.
  play_count INTEGER NOT NULL DEFAULT 0 CHECK (play_count >= 0),
  PRIMARY KEY (service, post_id),
  FOREIGN KEY (service, post_id) REFERENCES posts (service, id) ON DELETE CASCADE
) STRICT, WITHOUT ROWID;
-- T9 presets and the seed's conflict target: one builtin per key. Postgres LIKE is case sensitive,
-- SQLite LIKE is not, so the predicate is substr(); queries repeat the exact expression.
CREATE UNIQUE INDEX IF NOT EXISTS post_favorite_tournament_builtin
  ON post_favorite_tournament (preset_key) WHERE substr(preset_key, 1, 8) = 'builtin:';

-- favorite_tournament_posts.pool: same element shape and crafted-value rule as combo resources.
-- The candidates, joined by element when a play is checked
-- (decision 2). ord keeps the array order. Builtin pools hold up to about 1,000 entries.
CREATE TABLE IF NOT EXISTS post_favorite_tournament_pool (
  service TEXT NOT NULL DEFAULT 'favorite_tournament' CHECK (service = 'favorite_tournament'),
  post_id TEXT NOT NULL,
  ord INTEGER NOT NULL CHECK (ord >= 0),
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  PRIMARY KEY (service, post_id, ord),
  FOREIGN KEY (service, post_id) REFERENCES post_favorite_tournament (service, post_id) ON DELETE CASCADE
) STRICT, WITHOUT ROWID;

-- Per-candidate aggregates, derived from plays; only the play batch writes them. No FK to the pool:
-- a builtin re-seed can drop a candidate that already has stats, and Supabase keeps those rows.
CREATE TABLE IF NOT EXISTS favorite_tournament_candidate_stats (
  service TEXT NOT NULL DEFAULT 'favorite_tournament' CHECK (service = 'favorite_tournament'),
  tournament_id TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  match_appearances INTEGER NOT NULL DEFAULT 0 CHECK (match_appearances >= 0),
  match_wins INTEGER NOT NULL DEFAULT 0 CHECK (match_wins >= 0),
  championships INTEGER NOT NULL DEFAULT 0 CHECK (championships >= 0),
  current_rank INTEGER,
  -- [{"at": "<Postgres timestamp::text, UTC>", "rank": n}], appended when the rank changes; display only.
  -- Step 5: D1 computes these rows and mirrors them as state upserts (design 5.5), so Supabase never
  -- recomputes them and both sides hold the same bytes.
  rank_history TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(rank_history) AND json_type(rank_history) = 'array'),
  PRIMARY KEY (service, tournament_id, resource_type, resource_id),
  FOREIGN KEY (service, tournament_id) REFERENCES post_favorite_tournament (service, post_id) ON DELETE CASCADE
) STRICT, WITHOUT ROWID;

-- One row per finished bracket: the source row of play_count and of every stat. No route exposes it
-- (the public read policy is not ported: tasks/010 #67).
CREATE TABLE IF NOT EXISTS favorite_tournament_plays (
  id TEXT NOT NULL PRIMARY KEY CHECK (id GLOB '[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]'),
  service TEXT NOT NULL DEFAULT 'favorite_tournament' CHECK (service = 'favorite_tournament'),
  tournament_id TEXT NOT NULL,
  user_id TEXT NOT NULL CHECK (user_id GLOB '[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]'),
  starting_size INTEGER NOT NULL CHECK (starting_size >= 2),
  champion_type TEXT NOT NULL,
  champion_id TEXT NOT NULL,
  -- [{left_type, left_id, right_type, right_id, winner}], iterated once at write.
  matches TEXT NOT NULL CHECK (json_valid(matches) AND json_type(matches) = 'array'
    AND json_array_length(matches) = starting_size - 1),
  created_at TEXT NOT NULL CHECK (created_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9][0-9][0-9][0-9]Z'),
  FOREIGN KEY (service, tournament_id) REFERENCES post_favorite_tournament (service, post_id) ON DELETE CASCADE
) STRICT;
-- TW5b recount and the cascade from post_favorite_tournament look plays up by (service, tournament_id).
CREATE INDEX IF NOT EXISTS favorite_tournament_plays_tournament ON favorite_tournament_plays (service, tournament_id);

-- 어려운 결정 (tier list). title is in posts. game_version is displayed here, so kept.
CREATE TABLE IF NOT EXISTS post_decisions_decisions (
  service TEXT NOT NULL DEFAULT 'decisions_decisions' CHECK (service = 'decisions_decisions'),
  post_id TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '' CHECK (length(note) <= 500),
  preset_key TEXT NOT NULL CHECK (length(preset_key) BETWEEN 1 AND 64),
  game_version TEXT NOT NULL CHECK (length(game_version) BETWEEN 1 AND 32),
  -- TierRow[], TierPlacement[], ResourceRef[]: rendered whole, never filtered.
  "rows" TEXT NOT NULL CHECK (json_valid("rows") AND json_type("rows") = 'array'),
  placements TEXT NOT NULL CHECK (json_valid(placements) AND json_type(placements) = 'array'),
  extra_ids TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(extra_ids) AND json_type(extra_ids) = 'array'),
  PRIMARY KEY (service, post_id),
  FOREIGN KEY (service, post_id) REFERENCES posts (service, id) ON DELETE CASCADE
) STRICT;

-- 서류 폭풍: the rich-editor document (an object). title is in posts.
CREATE TABLE IF NOT EXISTS post_pagestorm (
  service TEXT NOT NULL DEFAULT 'pagestorm' CHECK (service = 'pagestorm'),
  post_id TEXT NOT NULL,
  content TEXT NOT NULL CHECK (json_valid(content) AND json_type(content) = 'object'),
  content_text TEXT NOT NULL CHECK (length(content_text) BETWEEN 1 AND 8000),
  PRIMARY KEY (service, post_id),
  FOREIGN KEY (service, post_id) REFERENCES posts (service, id) ON DELETE CASCADE
) STRICT;

-- Private 서류 폭풍 drafts. Not posts: no service, counters, feed or thread.
CREATE TABLE IF NOT EXISTS pagestorm_drafts (
  id TEXT NOT NULL PRIMARY KEY CHECK (id GLOB '[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]'),
  user_id TEXT NOT NULL CHECK (user_id GLOB '[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]'),
  nickname TEXT NOT NULL CHECK (length(nickname) BETWEEN 1 AND 20),
  avatar_id TEXT,
  avatar_kind TEXT,
  palette_id TEXT,
  palette_swapped INTEGER DEFAULT 0 CHECK (palette_swapped IN (0, 1)),
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 80),
  content TEXT NOT NULL CHECK (json_valid(content) AND json_type(content) = 'object'),
  content_text TEXT NOT NULL CHECK (length(content_text) BETWEEN 1 AND 8000),
  created_at TEXT NOT NULL CHECK (created_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9][0-9][0-9][0-9]Z'),
  updated_at TEXT NOT NULL CHECK (updated_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9][0-9][0-9][0-9]Z'),
  CHECK (coalesce(length(CAST(avatar_id AS BLOB)), 0) + coalesce(length(CAST(avatar_kind AS BLOB)), 0)
         + coalesce(length(CAST(palette_id AS BLOB)), 0) <= 1024)
) STRICT;
-- T12 my drafts, newest edit first. The id tie-break is new (Supabase orders by updated_at only).
CREATE INDEX IF NOT EXISTS pagestorm_drafts_user_updated ON pagestorm_drafts (user_id, updated_at, id);

-- 조각모음 overlay body: an optional 1:1 extension of a post, owned by the post's author. The Supabase key
-- (env, source_service, source_id) without env: service = source_service, post_id = source_id. Supabase
-- has no FK here; D1 keeps the earlier decision to reference the post: deleting the post deletes the
-- body (Supabase leaves an orphan), and an orphan in Supabase is counted and skipped, not inserted
-- (first copy, S12). No service list CHECK: the FK already limits it to the services of posts.
CREATE TABLE IF NOT EXISTS defragment_bodies (
  service TEXT NOT NULL,                  -- source_service: the post's service
  post_id TEXT NOT NULL,
  user_id TEXT NOT NULL CHECK (user_id GLOB '[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]'),
  nickname TEXT NOT NULL CHECK (length(nickname) BETWEEN 1 AND 20),   -- its only snapshot column
  content TEXT NOT NULL CHECK (json_valid(content)),                 -- PostBlock[]
  content_text TEXT NOT NULL CHECK (length(content_text) BETWEEN 2 AND 8000),
  created_at TEXT NOT NULL CHECK (created_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9][0-9][0-9][0-9]Z'),
  updated_at TEXT NOT NULL CHECK (updated_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9][0-9][0-9][0-9]Z'),
  PRIMARY KEY (service, post_id),
  FOREIGN KEY (service, post_id) REFERENCES posts (service, id) ON DELETE CASCADE
) STRICT;

-- 역사 강의서: the run's typed columns. posts holds id (the run id), owner (donor), donor nickname,
-- created_at, summary (seed or id) and the counters. The list reads these summary columns, which the
-- browser computes at upload (decision 4); old rows get them from a one-off backfill.
CREATE TABLE IF NOT EXISTS post_history_course (
  service TEXT NOT NULL DEFAULT 'history_course' CHECK (service = 'history_course'),
  post_id TEXT NOT NULL,
  seed TEXT NOT NULL CHECK (length(CAST(seed AS BLOB)) <= 1024),
  build TEXT NOT NULL CHECK (length(CAST(build AS BLOB)) <= 1024),
  "character" TEXT NOT NULL CHECK (length(CAST("character" AS BLOB)) <= 1024),
  ascension INTEGER NOT NULL,
  win INTEGER NOT NULL CHECK (win IN (0, 1)),
  start_time INTEGER,                     -- unix seconds; picker sort key
  run_time INTEGER,                       -- seconds
  acts_count INTEGER NOT NULL,            -- detail meta only
  total_floors INTEGER NOT NULL DEFAULT 0,
  -- The stored cover (server-side, so an owner's change is visible to all). 조각모음 (history_meta) and
  -- the meta/OG show it as stored. The detail and the cover editor re-pick a non-manual cover from the
  -- R3r raw as they do today. The list and the picker show a manual cover (auto = false) as stored and
  -- re-pick any other one in the browser from list_facts, as they re-pick from the raw today. The
  -- backfill never writes it. Worker cap 16 KiB; this is the row backstop.
  cover_spec TEXT CHECK (json_valid(cover_spec) AND json_type(cover_spec) = 'object'
    AND length(CAST(cover_spec AS BLOB)) <= 1048576),
  -- Browser-computed list summary (characters, game_elements, game_mode, list_facts, summary_version).
  -- summary_version 0 = not computed yet (not backfilled yet, or uploaded by a tab still on the old JS
  -- after the backfill; the first copy and the daily check count these and re-run the backfill on
  -- them); N > 0 = written by extractor version N (src constant RUN_SUMMARY_VERSION, bumped when the
  -- extractor, buildRunHighlights or the list_facts inputs change).
  summary_version INTEGER NOT NULL DEFAULT 0 CHECK (summary_version >= 0),
  badges TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(badges) AND json_type(badges) = 'array'
    AND length(CAST(badges AS BLOB)) <= 1048576),                    -- [{id, rarity}], party best
  characters TEXT CHECK (json_valid(characters) AND json_type(characters) = 'array'
    AND length(CAST(characters AS BLOB)) <= 65536),                  -- ["CHARACTER.IRONCLAD", ...]
  game_mode TEXT CHECK (length(CAST(game_mode AS BLOB)) <= 1024),
  -- [{type, id}] of every element of the run (extractRunGameElements): sent with the list for the
  -- popular-element chips and the search, filtered in the browser only (no server query filters by
  -- element), so JSON TEXT, not a child table.
  game_elements TEXT CHECK (json_valid(game_elements) AND json_type(game_elements) = 'array'
    AND length(CAST(game_elements AS BLOB)) <= 1048576),
  -- What the list read from the raw and no other column holds: the auto cover picker's inputs in its
  -- read order (cards with copies, first floor and upgrade; relics with the acquired flag; potions as
  -- listed; max deck size and relic count) and the highlight card and relic ids. The browser runs the
  -- same pickAlternatingCover, coverPhrasePool and search code on it (design 4.4).
  list_facts TEXT CHECK (json_valid(list_facts) AND json_type(list_facts) = 'object'
    AND length(CAST(list_facts AS BLOB)) <= 1048576),
  CHECK (summary_version = 0 OR (characters IS NOT NULL AND game_mode IS NOT NULL
    AND game_elements IS NOT NULL AND list_facts IS NOT NULL)),
  PRIMARY KEY (service, post_id),
  FOREIGN KEY (service, post_id) REFERENCES posts (service, id) ON DELETE CASCADE
) STRICT;
-- R2 combo / 조각모음 run picker: latest 30 by start time.
CREATE INDEX IF NOT EXISTS post_history_course_start_time ON post_history_course (start_time, post_id);

-- The raw .run file (decision 4: its own table, still in D1). Opaque text, parsed only by the browser,
-- bound and returned by the Worker without JSON.parse. The 1.9 MB cap keeps the row under D1's 2 MB
-- limit; the step-2 Supabase migration adds the same CHECK. The raw is never copied into an outbox
-- row (the mirror reads it here). The cap is settled at 1.9 MB (design 10 D8); today's largest raw is
-- 277 KB.
CREATE TABLE IF NOT EXISTS post_history_course_file (
  service TEXT NOT NULL DEFAULT 'history_course' CHECK (service = 'history_course'),
  post_id TEXT NOT NULL,
  raw TEXT NOT NULL CHECK (length(CAST(raw AS BLOB)) <= 1900000),
  PRIMARY KEY (service, post_id),
  FOREIGN KEY (service, post_id) REFERENCES post_history_course (service, post_id) ON DELETE CASCADE
) STRICT;


-- =====================================================================================================
-- migration: 0006_profile_contact_puzzlebox_philosophers.sql
-- =====================================================================================================

-- Random-nickname pools per character and locale. The Supabase table has no env column, so every
-- environment's database holds the same rows. Written only by the local admin script.
CREATE TABLE IF NOT EXISTS profile_character_nickname_pools (
  character_id TEXT NOT NULL CHECK (character_id IN ('IRONCLAD', 'SILENT', 'REGENT', 'NECROBINDER', 'DEFECT')),
  locale TEXT NOT NULL CHECK (locale IN ('ko', 'en')),
  -- Display-only array. Per-element rules (1..20 chars, trimmed, unique) are the script's.
  nicknames TEXT NOT NULL CHECK (json_valid(nicknames) AND json_type(nicknames) = 'array'
    AND json_array_length(nicknames) BETWEEN 1 AND 50),
  updated_at TEXT NOT NULL CHECK (updated_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9][0-9][0-9][0-9]Z'),
  PRIMARY KEY (character_id, locale)
) STRICT, WITHOUT ROWID;

-- Contact inquiries. user_id and reply_email are private: no browser answer ever selects them.
-- reply_seen_at is client-writable in Supabase (no guard, none added); an odd value follows the
-- crafted-value rule (design 3.1).
-- Not ported: env, viewport_width, viewport_height (write-only).
CREATE TABLE IF NOT EXISTS contact_inquiries (
  id TEXT NOT NULL PRIMARY KEY CHECK (id GLOB '[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]'),
  user_id TEXT CHECK (user_id GLOB '[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]'),
  category TEXT NOT NULL CHECK (category IN ('bug', 'correction', 'feedback', 'report', 'partnership', 'other')),
  message TEXT NOT NULL CHECK (length(message) BETWEEN 10 AND 8000 AND message = trim(message)),
  -- The e-mail regex is the Worker's (contact-rules.ts EMAIL); length, trim and '@' are kept here.
  reply_email TEXT CHECK (length(reply_email) BETWEEN 3 AND 254 AND reply_email = trim(reply_email)
    AND instr(reply_email, '@') > 1),
  page_path TEXT NOT NULL CHECK (length(page_path) BETWEEN 1 AND 512 AND substr(page_path, 1, 1) = '/'
    AND instr(page_path, '?') = 0 AND instr(page_path, '#') = 0),
  service_locale TEXT NOT NULL CHECK (service_locale IN ('ko', 'en')),
  game_locale TEXT NOT NULL CHECK (game_locale IN (
    'kor', 'eng', 'zhs', 'jpn', 'deu', 'fra', 'ita', 'spa', 'esp', 'ptb', 'rus', 'pol', 'tha', 'tur')),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'done', 'spam')),
  created_at TEXT NOT NULL CHECK (created_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9][0-9][0-9][0-9]Z'),
  admin_response TEXT,
  responded_at TEXT CHECK (responded_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9][0-9][0-9][0-9]Z'),
  reply_seen_at TEXT CHECK (reply_seen_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9][0-9][0-9][0-9]Z'),
  CHECK (category <> 'partnership' OR reply_email IS NOT NULL),
  CHECK ((admin_response IS NULL AND responded_at IS NULL) OR (admin_response IS NOT NULL
    AND responded_at IS NOT NULL AND length(admin_response) BETWEEN 1 AND 8000 AND admin_response = trim(admin_response)))
) STRICT;
-- C1 rate limit, C2 mailbox dot, C3 history, C4 mark seen: all "this user's rows by time".
CREATE INDEX IF NOT EXISTS contact_inquiries_user_created ON contact_inquiries (user_id, created_at, id);

-- 짜증나는 퍼즐상자: every finished run (audit trail, source of attempts and rate limits).
CREATE TABLE IF NOT EXISTS puzzlebox_runs (
  -- Supabase identity value in steps 2-4; a random integer in [2^40, 2^53) when the Worker writes.
  id INTEGER PRIMARY KEY,
  game TEXT NOT NULL CHECK (game IN ('connections', 'beta-quiz')),
  board TEXT NOT NULL CHECK (board GLOB '[1-9]' OR board GLOB '[1-9][0-9]' OR board GLOB '[1-9][0-9][0-9]'),
  user_id TEXT NOT NULL CHECK (user_id GLOB '[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]'),
  attempt INTEGER NOT NULL CHECK (attempt >= 1),
  score INTEGER NOT NULL,
  perfect INTEGER NOT NULL CHECK (perfect IN (0, 1)),
  -- Normalized replay the scorer returned ({guesses, rocks, rocksLeft, shown} or {questions, answers}).
  run TEXT NOT NULL CHECK (json_valid(run) AND json_type(run) = 'object' AND length(CAST(run AS BLOB)) <= 1048576),
  created_at TEXT NOT NULL CHECK (created_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9][0-9][0-9][0-9]Z')
) STRICT;
-- X1 3-second burst check and 500-per-day cap: this user's runs by time.
CREATE INDEX IF NOT EXISTS puzzlebox_runs_user_created ON puzzlebox_runs (user_id, created_at);

-- One latest player token per user. The Supabase table has no env column, so every database holds
-- every row. Tokens are overwritten on every submitted run.
CREATE TABLE IF NOT EXISTS puzzlebox_players (
  user_id TEXT NOT NULL PRIMARY KEY CHECK (user_id GLOB '[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]'),
  nickname TEXT NOT NULL CHECK (length(nickname) BETWEEN 1 AND 24),
  avatar_id TEXT CHECK (length(avatar_id) BETWEEN 1 AND 40 AND avatar_id NOT GLOB '*[^A-Z0-9_]*'),
  avatar_kind TEXT CHECK (avatar_kind IN ('character', 'boss')),
  palette_id TEXT CHECK (length(palette_id) BETWEEN 1 AND 40 AND palette_id NOT GLOB '*[^-a-z0-9_]*'),
  palette_swapped INTEGER NOT NULL DEFAULT 0
    CHECK (palette_swapped IN (0, 1) AND (palette_swapped = 0 OR palette_id IS NOT NULL)),
  hidden INTEGER NOT NULL DEFAULT 0 CHECK (hidden IN (0, 1)),   -- operator switch: out of every ranking
  updated_at TEXT NOT NULL CHECK (updated_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9][0-9][0-9][0-9]Z')
) STRICT, WITHOUT ROWID;

-- Best run per player and board. A later equal score does not replace it (first to reach ranks higher).
CREATE TABLE IF NOT EXISTS puzzlebox_best (
  game TEXT NOT NULL CHECK (game IN ('connections', 'beta-quiz')),
  board TEXT NOT NULL CHECK (board GLOB '[1-9]' OR board GLOB '[1-9][0-9]' OR board GLOB '[1-9][0-9][0-9]'),
  user_id TEXT NOT NULL REFERENCES puzzlebox_players (user_id),
  score INTEGER NOT NULL,
  perfect INTEGER NOT NULL CHECK (perfect IN (0, 1)),
  -- No ON DELETE action: puzzlebox runs are never deleted.
  run_id INTEGER NOT NULL REFERENCES puzzlebox_runs (id),
  achieved_at TEXT NOT NULL CHECK (achieved_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9][0-9][0-9][0-9]Z'),
  attempts INTEGER NOT NULL CHECK (attempts >= 1),
  PRIMARY KEY (game, board, user_id)
) STRICT, WITHOUT ROWID;
-- X4 my standings (also the FK child lookup for puzzlebox_players).
CREATE INDEX IF NOT EXISTS puzzlebox_best_user_game ON puzzlebox_best (user_id, game);
-- FK child lookup for puzzlebox_runs: without it SQLite plans a scan of puzzlebox_best for every run
-- insert (run only while a deferred FK violation is pending, but the sync defers FKs per batch).
CREATE INDEX IF NOT EXISTS puzzlebox_best_run ON puzzlebox_best (run_id);

-- Per-board statistics over each player's first finished run.
CREATE TABLE IF NOT EXISTS puzzlebox_board_stats (
  game TEXT NOT NULL CHECK (game IN ('connections', 'beta-quiz')),
  board TEXT NOT NULL CHECK (board GLOB '[1-9]' OR board GLOB '[1-9][0-9]' OR board GLOB '[1-9][0-9][0-9]'),
  players INTEGER NOT NULL DEFAULT 0,
  cleared INTEGER NOT NULL DEFAULT 0,
  perfect INTEGER NOT NULL DEFAULT 0,
  score_sum INTEGER NOT NULL DEFAULT 0,
  mistakes_sum INTEGER NOT NULL DEFAULT 0,
  rocks_sum INTEGER NOT NULL DEFAULT 0,
  purple_first INTEGER NOT NULL DEFAULT 0,
  -- Display-only integer arrays, updated element-wise by one UPDATE.
  level_solved TEXT NOT NULL DEFAULT '[0,0,0,0]' CHECK (json_valid(level_solved)
    AND json_type(level_solved) = 'array' AND json_array_length(level_solved) = 4),
  question_wrong TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(question_wrong)
    AND json_type(question_wrong) = 'array' AND json_array_length(question_wrong) <= 30),
  wrong_picks TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(wrong_picks)
    AND json_type(wrong_picks) = 'array' AND json_array_length(wrong_picks) <= 120),
  speed_sum INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (game, board)
) STRICT, WITHOUT ROWID;

-- 다채로운 철학자들: up to three admin posts per KST week (topic, card, relic; 'power' allowed, unused).
-- Not ported: env, buff_count, nerf_count, rework_count (frozen; the screen reads resource_reaction_counts).
CREATE TABLE IF NOT EXISTS colorful_philosopher_posts (
  id TEXT NOT NULL PRIMARY KEY CHECK (id GLOB '[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]'),
  -- Monday of the KST week.
  week_start TEXT NOT NULL CHECK (week_start GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND strftime('%w', week_start) = '1'),
  slot TEXT NOT NULL CHECK (slot IN ('topic', 'card', 'relic', 'power')),
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL CHECK (length(resource_id) BETWEEN 1 AND 80),
  name_ko TEXT NOT NULL CHECK (length(name_ko) BETWEEN 1 AND 120),
  name_en TEXT NOT NULL CHECK (length(name_en) BETWEEN 1 AND 120),
  image_url TEXT,
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 500),
  game_version TEXT NOT NULL CHECK (length(game_version) BETWEEN 1 AND 32),
  created_at TEXT NOT NULL CHECK (created_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9][0-9][0-9][0-9]Z'),
  CHECK ((slot = 'topic' AND resource_type <> 'topic') OR resource_type = slot),
  -- One post per slot per week; also the week-ordered access path (F1, F3, F4, F6, F7).
  UNIQUE (week_start, slot)
) STRICT;
-- F5 codex detail thread: this resource's posts, newest week first.
CREATE INDEX IF NOT EXISTS colorful_philosopher_posts_resource
  ON colorful_philosopher_posts (resource_type, resource_id, week_start);
