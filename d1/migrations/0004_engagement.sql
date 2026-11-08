-- Supabase exit step 2 (D1 shadow copy), design 4.2: comments, likes, reactions, stories, and the
-- thread counters.
-- Generated from docs/supabase-exit/d1-schema/schema.src.sql by gen_schema.py: edit the source
-- and regenerate (check.py fails when they differ). Once applied to a remote database, never
-- change this file; add a new migration section to the source instead.

-- Comments on any thread key. No UPDATE path for users, as in Postgres.
-- Not ported: env, parent_id and its self FK, meta (CLEANUP_AUDIT 3.1).
CREATE TABLE IF NOT EXISTS comments (
  id TEXT NOT NULL PRIMARY KEY CHECK ((id GLOB '????????-????-????-????-????????????' AND id NOT GLOB '*[^0-9a-f-]*' AND length(replace(id, '-', '')) = 32)),
  -- Thread key (same column name as Supabase). Free string, no FK: orphans are kept, as today.
  -- Postgres checks only octet_length <= 1024, so '' is accepted here too (no lower bound).
  story_id TEXT NOT NULL CHECK (length(CAST(story_id AS BLOB)) <= 1024),
  user_id TEXT NOT NULL CHECK ((user_id GLOB '????????-????-????-????-????????????' AND user_id NOT GLOB '*[^0-9a-f-]*' AND length(replace(user_id, '-', '')) = 32)),
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
  created_at TEXT NOT NULL CHECK ((substr(created_at, 1, 10) GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND substr(created_at, 11, 9) GLOB 'T[0-9][0-9]:[0-9][0-9]:[0-9][0-9]' AND substr(created_at, 20) GLOB '.[0-9][0-9][0-9][0-9][0-9][0-9]Z')),
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
  user_id TEXT NOT NULL CHECK ((user_id GLOB '????????-????-????-????-????????????' AND user_id NOT GLOB '*[^0-9a-f-]*' AND length(replace(user_id, '-', '')) = 32)),
  created_at TEXT NOT NULL CHECK ((substr(created_at, 1, 10) GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND substr(created_at, 11, 9) GLOB 'T[0-9][0-9]:[0-9][0-9]:[0-9][0-9]' AND substr(created_at, 20) GLOB '.[0-9][0-9][0-9][0-9][0-9][0-9]Z')),
  PRIMARY KEY (comment_id, user_id)
) STRICT, WITHOUT ROWID;

-- Likes on a thread key (Supabase likes). Not ported: id, env, reaction_type (always 'thumb_up').
-- No FK: the key is a thread key, not a post id, and Supabase has none either. The this-or-that
-- likes are their own table (this_or_that_post_likes, 0005); a 'this-or-that:' row in Supabase likes
-- is copied here as an ordinary like on that thread key, as today.
-- created_at: same crafted-value rule as comment_likes.
CREATE TABLE IF NOT EXISTS likes (
  story_id TEXT NOT NULL CHECK (length(CAST(story_id AS BLOB)) <= 1024),
  user_id TEXT NOT NULL CHECK ((user_id GLOB '????????-????-????-????-????????????' AND user_id NOT GLOB '*[^0-9a-f-]*' AND length(replace(user_id, '-', '')) = 32)),
  created_at TEXT NOT NULL CHECK ((substr(created_at, 1, 10) GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND substr(created_at, 11, 9) GLOB 'T[0-9][0-9]:[0-9][0-9]:[0-9][0-9]' AND substr(created_at, 20) GLOB '.[0-9][0-9][0-9][0-9][0-9][0-9]Z')),
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
  last_comment_at TEXT CHECK ((substr(last_comment_at, 1, 10) GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND substr(last_comment_at, 11, 9) GLOB 'T[0-9][0-9]:[0-9][0-9]:[0-9][0-9]' AND substr(last_comment_at, 20) GLOB '.[0-9][0-9][0-9][0-9][0-9][0-9]Z')),               -- max(comments.created_at)
  updated_at INTEGER NOT NULL DEFAULT 0                                 -- Unix ms of the last recount
) STRICT, WITHOUT ROWID;

-- Buff / nerf / rework per user per resource version. Key reordered so resource_id leads (every
-- read filters by it).
CREATE TABLE IF NOT EXISTS resource_reactions (
  resource_id TEXT NOT NULL CHECK (length(resource_id) <= 128),
  resource_type TEXT NOT NULL CHECK (length(resource_type) <= 32),
  game_version TEXT NOT NULL CHECK (length(game_version) <= 32),
  user_id TEXT NOT NULL CHECK ((user_id GLOB '????????-????-????-????-????????????' AND user_id NOT GLOB '*[^0-9a-f-]*' AND length(replace(user_id, '-', '')) = 32)),
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
  id TEXT NOT NULL PRIMARY KEY CHECK ((id GLOB '????????-????-????-????-????????????' AND id NOT GLOB '*[^0-9a-f-]*' AND length(replace(id, '-', '')) = 32)),
  user_id TEXT CHECK ((user_id GLOB '????????-????-????-????-????????????' AND user_id NOT GLOB '*[^0-9a-f-]*' AND length(replace(user_id, '-', '')) = 32)),                 -- NULL for official (seed) stories
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
  created_at TEXT NOT NULL CHECK ((substr(created_at, 1, 10) GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND substr(created_at, 11, 9) GLOB 'T[0-9][0-9]:[0-9][0-9]:[0-9][0-9]' AND substr(created_at, 20) GLOB '.[0-9][0-9][0-9][0-9][0-9][0-9]Z')),
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
