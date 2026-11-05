-- Disposable caches shared by every isolate (step 1: the nav snapshot). The
-- source of the data stays Supabase; deleting a row only costs a refresh.
-- Times are Unix milliseconds. A refresh first takes the lease with a
-- conditional upsert, so one isolate at a time calls Supabase.
CREATE TABLE IF NOT EXISTS api_cache (
  key TEXT PRIMARY KEY,
  body TEXT NOT NULL,
  fetched_at INTEGER NOT NULL DEFAULT 0,
  lease_until INTEGER NOT NULL DEFAULT 0,
  fail_count INTEGER NOT NULL DEFAULT 0,
  fail_until INTEGER NOT NULL DEFAULT 0
);
