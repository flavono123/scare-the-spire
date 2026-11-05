-- Runtime switches the Worker reads (cached 30 s per isolate). Keys are
-- `<axis>.<surface group>`; step 1 uses `path.<group>` = legacy | api.
-- Change them only with scripts/runtime-flags.ts, which also logs the change.
CREATE TABLE IF NOT EXISTS runtime_flags (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS runtime_flag_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  at TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT ''
);
