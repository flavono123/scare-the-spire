> Working notes from the 2026-11-08 D1 schema survey. [D1_SCHEMA_DESIGN.md](../../D1_SCHEMA_DESIGN.md) takes precedence
> where they differ. Paths under `scratchpad/` were temporary and are not kept.

# D1 step 2 design: Toy Box posts and their satellites

> Superseded where it differs by `D1_SCHEMA_DESIGN.md` (2026-11-08 review: sections 3.1, 3.4, 5.1-5.5 and "검토 기록").

Scope: the 7 live Toy Box post tables, the dead `defragment_posts`, `this_or_that_post_votes`,
`this_or_that_post_likes`, `favorite_tournament_candidate_stats`, `favorite_tournament_plays`, `pagestorm_drafts`,
`defragment_bodies`, the feed RPCs, the guard triggers, `complete_favorite_tournament_play`,
`get_this_or_that_vote_summaries`, `defragment_source_owned`, `admin_story_service`, the Defragment board's use of
`runs`, and `workers/api/routes/toybox.ts`. Input: `inventory-toybox.md` (cited as `inv:§`), `inventory-engagement.md`
(`eng:§`), `inventory-runs-profile.md` (`runs:§`), the dump, plan 5.5/5.6/7, CLEANUP_AUDIT 2/3.1/5.

## 0. Decisions taken here, and what this design depends on

Taken here (each argued where it is used):

- **One `posts` row per post** (decision 2) holding id, service, author, author snapshot, `title`, `summary` (the
  Defragment board title, computed at write), `like_count`, `comment_count`, `created_at`. Every service has one
  `post_<service>` table 1:1 with typed columns. Two arrays become child tables because they are filtered or joined by
  element: combo `resources` (`post_combo_resources`) and the tournament `pool` (`post_favorite_tournament_pool`).
  Everything else that is only displayed stays JSON TEXT.
- **`posts` keeps `like_count` and `comment_count`** as denormalized copies of the `threads` row, written in the same
  D1 batch (decision 3). The feeds sort by them with keyset cursors; only a column in `posts` lets an index give 20
  rows per page. Joining through `threads` would read every post of the service plus its thread row on every page, and
  the all-service Defragment sort could not use an index at all. The cost is 2 extra index entries per like or comment
  (a few per day).
- **Vote and play counters stay in their service tables** (`post_this_or_that.left/right_vote_count`,
  `post_favorite_tournament.play_count`) and get **no sort index**: those sorts read the whole service (23 and 47 rows
  today) because the keyset tie-break columns live in `posts`. 2.3 has the numbers and when to add an index.
- **this-or-that likes join the common `likes` table** (engagement domain) under the thread key `this-or-that:<uuid>`.
  The separate table, its trigger, the view and its `id` are not ported. Their counts then come from `threads` like
  every other service (eng:§14.2 left this open).
- **`favorite_tournament_plays` stays in D1** (CLEANUP 3.1 left it open). It is the only source row of `play_count` and
  of every candidate stat: the step-5 mirror and any recount need it. No route exposes it. Dropping the public read
  policy fixes tasks/010 #67.
- **`defragment_bodies` becomes a 1:1 optional extension of a post**: `post_id` is the PK and references
  `posts(id) ON DELETE CASCADE`. `source_service` is no longer stored; it is `posts.service`.
- **D1 CHECKs never reject a row that Supabase accepts.** The step-2 sync would stall on such a row. A CHECK is ported
  only when SQLite evaluates it exactly like Postgres (character lengths, byte lengths of TEXT, enums, cardinality,
  GLOB instead of the simple regexes). CHECKs built on `pg_column_size` (a compressed size) move to the Worker. CHECKs
  that cannot be loosened later (SQLite cannot `ALTER` a CHECK without rebuilding the table) are kept at Postgres'
  strength.
- **All tables are `STRICT`**, so a JS number never ends up in a TEXT column or the reverse. Small-row tables are
  `WITHOUT ROWID`. Tables holding documents (up to about 1 MB) keep rowids.
- **No SQLite trigger maintains counters.** Step 2 copies Supabase's counter values as-is. A trigger on
  `threads → posts` would overwrite them with row counts and create shadow differences wherever Supabase has drifted.
  Steps 4-5 use explicit statements in the write batch. The one trigger here, `posts_keys_immutable`, guards the
  columns that keyset cursors and the shadow comparison rely on.

Shared objects this design depends on (owned by the engagement design; the integrator reconciles names):

| object | what this design assumes |
|---|---|
| timestamp format | `YYYY-MM-DDTHH:MM:SS.ffffffZ`: UTC, exactly 6 fraction digits, 27 characters (eng:§11 proposal). Every timestamp CHECK below uses this GLOB. |
| author snapshot | typed columns `nickname`, `avatar_id`, `avatar_kind`, `palette_id`, `palette_swapped` (nullable 0/1) with today's names (decision 5) |
| `threads` | `thread_key TEXT PRIMARY KEY`, `like_count`, `comment_count` (+ the engagement columns). The key of a post is `<prefix>:<id>`, with prefixes from `src/lib/comment-threads.ts` (inv:§1) |
| `likes` | natural key `PRIMARY KEY (story_id, user_id)`, `created_at`; holds `this-or-that:` likes too |
| change log, sync and outbox tables | the Supabase change log identifies a deleted row by the D1 natural key (for `this_or_that_post_likes`: `post_id, user_id`, not its surrogate `id`); the D1 outbox row carries a JSON payload |
| `surface_latest` (plan 5.1) or a nav read | either works: `posts_service_created` answers "latest of a service" with 1 row and recomputes it after a delete |
| `runs` (runs design) | the board needs `id, created_at NOT NULL, like_count, comment_count, seed, donor_user_id, donor_nickname, cover_spec, win, ascension, total_floors` and indexes `(created_at, id)`, `(like_count, created_at, id)`, `(comment_count, created_at, id)`. Like `posts`, runs keeps denormalized counters for this sort (end of the DDL block) |
| users | no `users` table in D1 until step 4, so `user_id` columns have no FK (SQLite cannot add an FK later without rebuilding the table; integrator: decide before 0003 whether step 4 brings a `users` table that these should reference) |
| migration file | `d1/migrations/0003_*` (eng:§10.1; `migrations_dir` is `d1/migrations`) |

## 1. DDL

```sql
-- Toy Box posts for the Supabase exit, step 2 (docs/SUPABASE_EXIT_PLAN.md 5.5, 7.3).
-- One D1 database per environment (slseoun-prod, slseoun-testbed, local dev): no env column, no env-leading index.
-- Conventions shared with the engagement design:
--   * timestamps: TEXT 'YYYY-MM-DDTHH:MM:SS.ffffffZ' (UTC, exactly 6 fraction digits). Fixed width, so text order
--     equals time order and (created_at, id) keyset comparisons are plain text comparisons.
--   * uuids: lowercase TEXT (36 chars), the exact Supabase ids. Booleans: INTEGER 0/1. JSON: TEXT + json_valid.
--   * user_id: the Supabase auth uid as TEXT. No FK: D1 has no users table.
--   * length(x) counts characters like Postgres char_length; length(CAST(x AS BLOB)) is octet_length.
-- CHECKs are never stricter than Supabase's, so the step-2 sync cannot stall on a row Supabase accepted.

-- ---------------------------------------------------------------------------------------------------------------
-- posts: what every Toy Box post has. One row per post of every service.
-- ---------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS posts (
  id TEXT NOT NULL PRIMARY KEY CHECK (length(id) = 36 AND id = lower(id)),
  -- Feed/API service id (src/lib/toybox-api-rules.ts). Thread key prefix, nav id and the old table name are derived
  -- in TypeScript from this value.
  service TEXT NOT NULL CHECK (service IN (
    'combo', 'transfigure', 'this_or_that', 'chemical_x', 'decisions_decisions', 'favorite_tournament', 'pagestorm')),
  -- NULL only for builtin favorite tournaments (preset_key 'builtin:*'); the builtin rule itself is checked by the
  -- Worker and the sync, because preset_key lives in post_favorite_tournament.
  user_id TEXT CHECK (user_id IS NULL OR length(user_id) = 36),
  -- Author snapshot, frozen on the row at insert and refreshed by edits (decision 5, inv:§2.2).
  nickname TEXT NOT NULL CHECK (length(nickname) BETWEEN 1 AND 20),
  avatar_id TEXT,
  avatar_kind TEXT,
  palette_id TEXT,
  palette_swapped INTEGER DEFAULT 0 CHECK (palette_swapped IN (0, 1)),
  -- The service's own title column (transfigure, favorite_tournament, decisions_decisions, pagestorm); NULL for others.
  title TEXT,
  -- Defragment board title: exactly get_defragment_feed_v2's left(btrim(<service expression>), 120), computed in the
  -- write statement (section 4). Stored so the board reads posts alone, without joining 7 service tables.
  summary TEXT NOT NULL CHECK (length(summary) <= 120),
  -- Denormalized copies of threads(<prefix>:<id>).like_count / comment_count for the feed sorts. Step 2 copies
  -- Supabase's post columns; from step 5 the like/comment write batch updates both.
  like_count INTEGER NOT NULL DEFAULT 0 CHECK (like_count >= 0),
  comment_count INTEGER NOT NULL DEFAULT 0 CHECK (comment_count >= 0),
  created_at TEXT NOT NULL CHECK (created_at GLOB
    '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9][0-9][0-9][0-9]Z'),
  CHECK (coalesce(length(CAST(avatar_id AS BLOB)), 0) + coalesce(length(CAST(avatar_kind AS BLOB)), 0)
         + coalesce(length(CAST(palette_id AS BLOB)), 0) <= 1024),
  CHECK (user_id IS NOT NULL OR service = 'favorite_tournament'),
  -- Title rules per service, as in Supabase (transfigure: nullable, 1..80 after trimming spaces; three services:
  -- NOT NULL, 1..80 characters; others: no title column).
  CHECK (CASE service
    WHEN 'transfigure' THEN title IS NULL
      OR (length(trim(title)) BETWEEN 1 AND 80 AND length(CAST(title AS BLOB)) <= 1024)
    WHEN 'favorite_tournament' THEN title IS NOT NULL AND length(title) BETWEEN 1 AND 80
    WHEN 'decisions_decisions' THEN title IS NOT NULL AND length(title) BETWEEN 1 AND 80
    WHEN 'pagestorm' THEN title IS NOT NULL AND length(title) BETWEEN 1 AND 80
    ELSE title IS NULL END)
) STRICT, WITHOUT ROWID;

-- Per-service feeds (R1, R3), Pagestorm index (R8), nav latest per service (R15).
CREATE INDEX IF NOT EXISTS posts_service_created ON posts (service, created_at, id);
CREATE INDEX IF NOT EXISTS posts_service_likes ON posts (service, like_count, created_at, id);
CREATE INDEX IF NOT EXISTS posts_service_comments ON posts (service, comment_count, created_at, id);
-- Defragment board across all services (R2).
CREATE INDEX IF NOT EXISTS posts_created ON posts (created_at, id);
CREATE INDEX IF NOT EXISTS posts_likes ON posts (like_count, created_at, id);
CREATE INDEX IF NOT EXISTS posts_comments ON posts (comment_count, created_at, id);
-- Own posts (profile activity R16; local admin metrics).
CREATE INDEX IF NOT EXISTS posts_user ON posts (user_id, created_at, id);

-- Keyset cursors and shadow comparison assume id, service and created_at never change (the Supabase guard trigger
-- restores them on every client update). Make that structural.
CREATE TRIGGER IF NOT EXISTS posts_keys_immutable
BEFORE UPDATE OF id, service, created_at ON posts
WHEN NEW.id IS NOT OLD.id OR NEW.service IS NOT OLD.service OR NEW.created_at IS NOT OLD.created_at
BEGIN
  SELECT RAISE(ABORT, 'posts: id, service and created_at are immutable');
END;

-- ---------------------------------------------------------------------------------------------------------------
-- Per-service tables (1:1 with posts). Upserts into posts must use ON CONFLICT DO UPDATE, never INSERT OR REPLACE:
-- REPLACE deletes the row first and would cascade into every table below.
-- ---------------------------------------------------------------------------------------------------------------

-- Chemical X: one-line rich post. Supabase has no array CHECK on content (inv:§3.1), so none here either.
CREATE TABLE IF NOT EXISTS post_chemical_x (
  post_id TEXT NOT NULL PRIMARY KEY REFERENCES posts (id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (json_valid(content)),            -- PostBlock[] document, display only
  content_text TEXT NOT NULL CHECK (length(content_text) BETWEEN 2 AND 30)
) STRICT;

-- C-C-C-Combo.
CREATE TABLE IF NOT EXISTS post_combo (
  post_id TEXT NOT NULL PRIMARY KEY REFERENCES posts (id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (json_valid(content) AND json_type(content) = 'array'),
  content_text TEXT NOT NULL CHECK (length(content_text) >= 2 AND length(CAST(content_text AS BLOB)) <= 65536)
) STRICT;

-- combo_posts.resources: the de-duplicated game elements of the post. Filtered and ranked by element
-- (combo-types.ts:37-82), so a child table (decision 2). ord keeps the array order for display and the shadow
-- comparison. No element index: no server query filters by element yet; add (resource_type, resource_id, post_id)
-- when one does.
CREATE TABLE IF NOT EXISTS post_combo_resources (
  post_id TEXT NOT NULL REFERENCES post_combo (post_id) ON DELETE CASCADE,
  ord INTEGER NOT NULL CHECK (ord >= 0),
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  PRIMARY KEY (post_id, ord)
) STRICT, WITHOUT ROWID;

-- Transfigure: the representative variant in typed columns, up to 11 more in extra_variants (display only).
-- Not ported: source_game_locale (write-only, CLEANUP 3.1). title lives in posts.
CREATE TABLE IF NOT EXISTS post_transfigure (
  post_id TEXT NOT NULL PRIMARY KEY REFERENCES posts (id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('card', 'character', 'keyword', 'relic', 'potion', 'power',
    'enchantment', 'affliction', 'event', 'ancient', 'epoch')),
  resource_id TEXT NOT NULL CHECK (length(resource_id) BETWEEN 1 AND 128),
  source_text TEXT NOT NULL CHECK (length(source_text) >= 1 AND length(CAST(source_text AS BLOB)) <= 65536),
  content TEXT NOT NULL CHECK (json_valid(content) AND json_type(content) = 'array'),
  content_text TEXT NOT NULL CHECK (length(content_text) >= 2 AND length(CAST(content_text AS BLOB)) <= 65536),
  transformed_name TEXT CHECK (transformed_name IS NULL
    OR (length(trim(transformed_name)) BETWEEN 1 AND 80 AND length(CAST(transformed_name AS BLOB)) <= 1024)),
  -- Postgres: btrim(x) ~ '^(X|[0-9]{1,2})$'. D1 has no REGEXP; GLOB is exact for these three shapes.
  transformed_cost TEXT CHECK (transformed_cost IS NULL OR (length(CAST(transformed_cost AS BLOB)) <= 1024 AND
    (trim(transformed_cost) = 'X' OR trim(transformed_cost) GLOB '[0-9]' OR trim(transformed_cost) GLOB '[0-9][0-9]'))),
  transformed_star_cost TEXT CHECK (transformed_star_cost IS NULL OR (length(CAST(transformed_star_cost AS BLOB)) <= 1024
    AND (trim(transformed_star_cost) = 'X' OR trim(transformed_star_cost) GLOB '[0-9]'
         OR trim(transformed_star_cost) GLOB '[0-9][0-9]'))),
  upgraded_content TEXT CHECK (upgraded_content IS NULL
    OR (json_valid(upgraded_content) AND json_type(upgraded_content) = 'array')),
  upgraded_content_text TEXT CHECK (upgraded_content_text IS NULL OR length(CAST(upgraded_content_text AS BLOB)) <= 65536),
  transformed_upgrade_cost TEXT CHECK (transformed_upgrade_cost IS NULL
    OR (length(CAST(transformed_upgrade_cost AS BLOB)) <= 1024 AND (trim(transformed_upgrade_cost) = 'X'
        OR trim(transformed_upgrade_cost) GLOB '[0-9]' OR trim(transformed_upgrade_cost) GLOB '[0-9][0-9]'))),
  transformed_upgrade_star_cost TEXT CHECK (transformed_upgrade_star_cost IS NULL
    OR (length(CAST(transformed_upgrade_star_cost AS BLOB)) <= 1024 AND (trim(transformed_upgrade_star_cost) = 'X'
        OR trim(transformed_upgrade_star_cost) GLOB '[0-9]' OR trim(transformed_upgrade_star_cost) GLOB '[0-9][0-9]'))),
  show_upgrade INTEGER NOT NULL DEFAULT 0 CHECK (show_upgrade IN (0, 1)),
  omit_energy_cost INTEGER DEFAULT 0 CHECK (omit_energy_cost IN (0, 1)),
  -- text[] in Postgres, display only: JSON arrays of strings. Size limits (pg_column_size) move to the Worker.
  card_top_keywords TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(card_top_keywords)
    AND json_type(card_top_keywords) = 'array' AND json_array_length(card_top_keywords) <= 5),
  card_bottom_keywords TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(card_bottom_keywords)
    AND json_type(card_bottom_keywords) = 'array' AND json_array_length(card_bottom_keywords) <= 3),
  upgraded_card_top_keywords TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(upgraded_card_top_keywords)
    AND json_type(upgraded_card_top_keywords) = 'array' AND json_array_length(upgraded_card_top_keywords) <= 5),
  upgraded_card_bottom_keywords TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(upgraded_card_bottom_keywords)
    AND json_type(upgraded_card_bottom_keywords) = 'array' AND json_array_length(upgraded_card_bottom_keywords) <= 3),
  -- Game-translation strings: keep byte-for-byte (inv:§3.3).
  transformed_card_type TEXT CHECK (transformed_card_type IS NULL
    OR transformed_card_type IN ('공격', '스킬', '파워', '저주', '상태이상', '퀘스트')),
  transformed_card_rarity TEXT CHECK (transformed_card_rarity IS NULL
    OR transformed_card_rarity IN ('일반', '고급', '희귀', '고대의 존재', '이벤트', '토큰', '저주', '상태이상', '퀘스트')),
  transformed_card_color TEXT CHECK (transformed_card_color IS NULL OR transformed_card_color IN ('ironclad', 'silent',
    'regent', 'necrobinder', 'defect', 'colorless', 'status', 'curse', 'event', 'quest', 'token')),
  token_color TEXT CHECK (token_color IS NULL
    OR token_color IN ('gold', 'red', 'green', 'orange', 'pink', 'aqua', 'blue', 'purple')),
  token_wax TEXT CHECK (token_wax IS NULL OR token_wax IN ('wax', 'melted')),
  -- TransfigureVariant[] (inv:§3.3), display only; the variant rules are Worker validation, as today.
  extra_variants TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(extra_variants) AND json_type(extra_variants) = 'array'
    AND json_array_length(extra_variants) <= 11 AND length(CAST(extra_variants AS BLOB)) <= 262144),
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
    OR (upgraded_content IS NOT NULL AND upgraded_content_text IS NOT NULL AND length(trim(upgraded_content_text)) >= 2))
) STRICT;

-- This or that: two typed sides, a reason, the ballot counters. vote_rate_bps (generated, unused) is not stored;
-- the read adapter computes it while responses must match Supabase (section 5).
CREATE TABLE IF NOT EXISTS post_this_or_that (
  post_id TEXT NOT NULL PRIMARY KEY REFERENCES posts (id) ON DELETE CASCADE,
  left_type TEXT NOT NULL CHECK (length(CAST(left_type AS BLOB)) <= 1024),
  left_id TEXT NOT NULL CHECK (length(CAST(left_id AS BLOB)) <= 1024),
  right_type TEXT NOT NULL CHECK (length(CAST(right_type AS BLOB)) <= 1024),
  right_id TEXT NOT NULL CHECK (length(CAST(right_id AS BLOB)) <= 1024),
  reason TEXT NOT NULL CHECK (length(reason) BETWEEN 2 AND 500),
  -- Derived from this_or_that_post_votes. Step 2 copies Supabase's values; step 5 updates them in the vote batch.
  left_vote_count INTEGER NOT NULL DEFAULT 0 CHECK (left_vote_count >= 0),
  right_vote_count INTEGER NOT NULL DEFAULT 0 CHECK (right_vote_count >= 0),
  CHECK (left_type <> right_type OR left_id <> right_id)
) STRICT, WITHOUT ROWID;

-- One ballot per user per post (private: only /api/me reads rows; the public sees the counters).
-- Not ported: created_surface (write-only, CLEANUP 3.1), env.
CREATE TABLE IF NOT EXISTS this_or_that_post_votes (
  post_id TEXT NOT NULL REFERENCES post_this_or_that (post_id) ON DELETE CASCADE,
  user_id TEXT NOT NULL CHECK (length(user_id) = 36),
  choice TEXT NOT NULL CHECK (choice IN ('left', 'right')),
  created_at TEXT NOT NULL CHECK (created_at GLOB
    '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9][0-9][0-9][0-9]Z'),
  PRIMARY KEY (post_id, user_id)
) STRICT, WITHOUT ROWID;
-- this_or_that_post_likes is not a table here: those likes are rows of the engagement `likes` table with
-- story_id 'this-or-that:<post id>', counted in threads and in posts.like_count.

-- Favorite tournament (world cup). Not ported: game_version (write-only for tournaments, CLEANUP 3.1). title in posts.
CREATE TABLE IF NOT EXISTS post_favorite_tournament (
  post_id TEXT NOT NULL PRIMARY KEY REFERENCES posts (id) ON DELETE CASCADE,
  note TEXT NOT NULL DEFAULT '' CHECK (length(note) <= 500),
  -- 'custom' for user tournaments, 'builtin:<key>' for seeded ones (posts.user_id NULL).
  preset_key TEXT NOT NULL CHECK (length(preset_key) BETWEEN 1 AND 64),
  -- Derived from favorite_tournament_plays. Step 2 copies Supabase's value; step 5 updates it in the play batch.
  play_count INTEGER NOT NULL DEFAULT 0 CHECK (play_count >= 0)
) STRICT, WITHOUT ROWID;

-- One builtin per key (the seed upserts on it) and the presets read (R6). Postgres LIKE 'builtin:%' is case
-- sensitive; SQLite LIKE is not, so the predicate is substr(). Queries must repeat the exact expression to use it.
CREATE UNIQUE INDEX IF NOT EXISTS post_favorite_tournament_builtin
  ON post_favorite_tournament (preset_key) WHERE substr(preset_key, 1, 8) = 'builtin:';

-- favorite_tournament_posts.pool: the candidates. Joined by element when a play is checked, so a child table
-- (decision 2). ord keeps the array order. Builtin pools hold up to about 1,000 entries.
CREATE TABLE IF NOT EXISTS post_favorite_tournament_pool (
  post_id TEXT NOT NULL REFERENCES post_favorite_tournament (post_id) ON DELETE CASCADE,
  ord INTEGER NOT NULL CHECK (ord >= 0),
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  PRIMARY KEY (post_id, ord)
) STRICT, WITHOUT ROWID;

-- Per-candidate aggregates. Derived from plays; only the play batch writes them.
-- No FK to the pool: a builtin re-seed can drop a candidate that already has stats, and Supabase keeps those rows.
CREATE TABLE IF NOT EXISTS favorite_tournament_candidate_stats (
  tournament_id TEXT NOT NULL REFERENCES post_favorite_tournament (post_id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  match_appearances INTEGER NOT NULL DEFAULT 0 CHECK (match_appearances >= 0),
  match_wins INTEGER NOT NULL DEFAULT 0 CHECK (match_wins >= 0),
  championships INTEGER NOT NULL DEFAULT 0 CHECK (championships >= 0),
  current_rank INTEGER,
  -- [{"at": "<YYYY-MM-DD HH:MM:SS.ffffff>", "rank": n}], appended when the rank changes; display only (last 6).
  rank_history TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(rank_history) AND json_type(rank_history) = 'array'),
  PRIMARY KEY (tournament_id, resource_type, resource_id)
) STRICT, WITHOUT ROWID;

-- One row per finished bracket: the source row of play_count and of every stat. Never exposed by a route.
CREATE TABLE IF NOT EXISTS favorite_tournament_plays (
  id TEXT NOT NULL PRIMARY KEY CHECK (length(id) = 36),
  tournament_id TEXT NOT NULL REFERENCES post_favorite_tournament (post_id) ON DELETE CASCADE,
  user_id TEXT NOT NULL CHECK (length(user_id) = 36),
  starting_size INTEGER NOT NULL CHECK (starting_size >= 2),
  champion_type TEXT NOT NULL,
  champion_id TEXT NOT NULL,
  -- [{left_type, left_id, right_type, right_id, winner}], iterated once at write. The RPC always enforced the length.
  matches TEXT NOT NULL CHECK (json_valid(matches) AND json_type(matches) = 'array'
    AND json_array_length(matches) = starting_size - 1),
  created_at TEXT NOT NULL CHECK (created_at GLOB
    '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9][0-9][0-9][0-9]Z')
) STRICT;
-- The ON DELETE CASCADE from post_favorite_tournament looks plays up by tournament_id; without this index every post
-- delete would scan the table.
CREATE INDEX IF NOT EXISTS favorite_tournament_plays_tournament ON favorite_tournament_plays (tournament_id);

-- Decisions decisions (tier list). title in posts. game_version is displayed here (unlike tournaments), so kept.
CREATE TABLE IF NOT EXISTS post_decisions_decisions (
  post_id TEXT NOT NULL PRIMARY KEY REFERENCES posts (id) ON DELETE CASCADE,
  note TEXT NOT NULL DEFAULT '' CHECK (length(note) <= 500),
  preset_key TEXT NOT NULL CHECK (length(preset_key) BETWEEN 1 AND 64),
  game_version TEXT NOT NULL CHECK (length(game_version) BETWEEN 1 AND 32),
  -- TierRow[], TierPlacement[], ResourceRef[]: rendered whole, never filtered: JSON documents.
  "rows" TEXT NOT NULL CHECK (json_valid("rows") AND json_type("rows") = 'array'),
  placements TEXT NOT NULL CHECK (json_valid(placements) AND json_type(placements) = 'array'),
  extra_ids TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(extra_ids) AND json_type(extra_ids) = 'array')
) STRICT;

-- Pagestorm: the rich-editor document (an object). title in posts.
CREATE TABLE IF NOT EXISTS post_pagestorm (
  post_id TEXT NOT NULL PRIMARY KEY REFERENCES posts (id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (json_valid(content) AND json_type(content) = 'object'),
  content_text TEXT NOT NULL CHECK (length(content_text) BETWEEN 1 AND 8000)
) STRICT;

-- Private Pagestorm drafts. Not posts: no service, counters, feed or thread.
CREATE TABLE IF NOT EXISTS pagestorm_drafts (
  id TEXT NOT NULL PRIMARY KEY CHECK (length(id) = 36 AND id = lower(id)),
  user_id TEXT NOT NULL CHECK (length(user_id) = 36),
  nickname TEXT NOT NULL CHECK (length(nickname) BETWEEN 1 AND 20),
  avatar_id TEXT,
  avatar_kind TEXT,
  palette_id TEXT,
  palette_swapped INTEGER DEFAULT 0 CHECK (palette_swapped IN (0, 1)),
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 80),
  content TEXT NOT NULL CHECK (json_valid(content) AND json_type(content) = 'object'),
  content_text TEXT NOT NULL CHECK (length(content_text) BETWEEN 1 AND 8000),
  created_at TEXT NOT NULL CHECK (created_at GLOB
    '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9][0-9][0-9][0-9]Z'),
  updated_at TEXT NOT NULL CHECK (updated_at GLOB
    '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9][0-9][0-9][0-9]Z'),
  CHECK (coalesce(length(CAST(avatar_id AS BLOB)), 0) + coalesce(length(CAST(avatar_kind AS BLOB)), 0)
         + coalesce(length(CAST(palette_id AS BLOB)), 0) <= 1024)
) STRICT;
-- My drafts, newest edit first (R9). The id tie-break is new (Supabase orders by updated_at only).
CREATE INDEX IF NOT EXISTS pagestorm_drafts_user_updated ON pagestorm_drafts (user_id, updated_at, id);

-- Defragment overlay body: an optional 1:1 extension of a post written from the Defragment board, owned by the
-- post's author. Replaces the key (env, source_service, source_id): source_id is post_id, source_service is
-- posts.service. Deleting the post deletes the body (Supabase leaves an orphan; section 3).
CREATE TABLE IF NOT EXISTS defragment_bodies (
  post_id TEXT NOT NULL PRIMARY KEY REFERENCES posts (id) ON DELETE CASCADE,
  user_id TEXT NOT NULL CHECK (length(user_id) = 36),
  nickname TEXT NOT NULL CHECK (length(nickname) BETWEEN 1 AND 20),   -- only snapshot column it ever had
  content TEXT NOT NULL CHECK (json_valid(content)),                 -- PostBlock[]; Supabase has no type CHECK
  content_text TEXT NOT NULL CHECK (length(content_text) BETWEEN 2 AND 8000),
  created_at TEXT NOT NULL CHECK (created_at GLOB
    '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9][0-9][0-9][0-9]Z'),
  updated_at TEXT NOT NULL CHECK (updated_at GLOB
    '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9][0-9][0-9][0-9]Z')
) STRICT;

-- ---------------------------------------------------------------------------------------------------------------
-- Requested from the runs design (not created here): the Defragment board's History Course half (R2, R4).
--   CREATE INDEX IF NOT EXISTS runs_created ON runs (created_at, id);
--   CREATE INDEX IF NOT EXISTS runs_likes ON runs (like_count, created_at, id);
--   CREATE INDEX IF NOT EXISTS runs_comments ON runs (comment_count, created_at, id);
-- with runs.created_at NOT NULL (runs:§10.1 check) and runs.like_count / comment_count kept as denormalized copies
-- of threads('history-course:<id>'), for the same reason as posts. runs_created also serves the History Course list.
-- ---------------------------------------------------------------------------------------------------------------
```

What is **not** ported (CLEANUP 3.1 and this design):

| object | why |
|---|---|
| `defragment_posts` with its 4 policies, 4 indexes, guard trigger, Realtime publication entry, and the `defragment` branches of `apply_toybox_thread_engagement_delta` | never had a row. The Worker's `service=defragment` read answers `[]` from the D1 adapter without a query, the same as Supabase. The route goes away in step 7 |
| `get_defragment_feed` (v1), `get_this_or_that_vote_totals` | no caller |
| `this_or_that_posts.vote_rate_bps` and the `vote_rate_*` indexes | dead. The read adapter computes the value until step 6 (section 5) |
| `this_or_that_post_votes.created_surface`, `transfigure_posts.source_game_locale`, `favorite_tournament_posts.game_version` | write-only. The step-5 mirror still supplies them because Supabase has them NOT NULL (section 3.2) |
| the 7 `(like_count * 4) + (comment_count * 6)` indexes, `idx_defragment_bodies_source`, and every other Postgres index | indexes are re-derived in section 2 |
| `this_or_that_post_likes` as a table (and its `id`), its trigger, the view `this_or_that_post_like_counts` | merged into the common `likes` + `threads` |
| `get_this_or_that_vote_summaries` | answered from the counters (the RPC was SECURITY DEFINER only to aggregate private rows) |
| policies `favorite_tournament_plays_read` (privacy, tasks/010 #67) and `defragment_posts_insert`; RLS as a whole | Worker checks (section 4) |
| `guard_post_server_columns` | Worker statements plus `posts_keys_immutable` (section 4) |
| every `env` column, env CHECK and env-leading index | decision 1 |

## 2. Queries and indexes

Notation: `N_s` = posts of service s (both envs 2026-11-07: combo 86, transfigure 85, chemical 54, tournament 47,
this or that 23, decisions 19, pagestorm 14; 328 in all). "Rows read" counts index entries plus table rows visited
(D1 bills both). A page of 20 joined rows costs about 20 index + 20 `posts` + 20 `post_<s>` = **60**. Bound id
lists go through `json_each(?)`, because D1 allows 100 bound parameters per statement and a 100-id list plus
`user_id` is 101. D1 also allows only 32 arguments per SQL function, so rows are not built with one `json_object` call:
the adapter splices stored JSON text into the response string (section 5). Every "with cursor" form below has a
separate "first page" statement without the keyset term: an `(? IS NULL OR …)` form would defeat the index range scan.

### 2.1 Reads

```sql
-- Q1  R1/R3 service feed, sort=latest (get_toybox_feed).                     index posts_service_created
SELECT <post columns>, <s columns> FROM posts p JOIN post_<s> s ON s.post_id = p.id
WHERE p.service = ?1 AND (p.created_at, p.id) < (?2, ?3)
ORDER BY p.created_at DESC, p.id DESC LIMIT 20;
-- Q2  sort=recommended (= like_count, inv:§4.1).                               index posts_service_likes
--     WHERE p.service = ?1 AND (p.like_count, p.created_at, p.id) < (?2, ?3, ?4)
--     ORDER BY p.like_count DESC, p.created_at DESC, p.id DESC LIMIT 20
-- Q3  sort=comments: the same on comment_count.                                index posts_service_comments
-- Q4  this_or_that vote_rate_high / vote_rate_low (= total ballots, zero-vote posts excluded).   no sort index
SELECT ... FROM posts p JOIN post_this_or_that t ON t.post_id = p.id
WHERE p.service = 'this_or_that' AND t.left_vote_count + t.right_vote_count > 0
  AND (t.left_vote_count + t.right_vote_count, p.created_at, p.id) < (?1, ?2, ?3)       -- high
  -- low: (1000000000 - (t.left_vote_count + t.right_vote_count), p.created_at, p.id) < (?1, ?2, ?3)
ORDER BY t.left_vote_count + t.right_vote_count DESC, p.created_at DESC, p.id DESC LIMIT 20;   -- low: 1e9 - total
-- Q5  favorite_tournament play_count: the same shape on f.play_count.                            no sort index
-- Q1-Q5 child arrays, as correlated subqueries in the same statement (PK order = ord order):
--   combo:      (SELECT json_group_array(json_object('type', r.resource_type, 'id', r.resource_id))
--                FROM post_combo_resources r WHERE r.post_id = p.id) AS resources
--   tournament: the same over post_favorite_tournament_pool AS pool
-- Q6  R2 Defragment board, posts half (get_defragment_feed_v2 branches 1-7).   posts_created / posts_likes / posts_comments
SELECT id, created_at, like_count, comment_count, like_count AS recommend_score, service, summary AS title,
       nickname, user_id, avatar_id, avatar_kind, palette_id, palette_swapped
FROM posts WHERE (like_count, created_at, id) < (?1, ?2, ?3)
ORDER BY like_count DESC, created_at DESC, id DESC LIMIT 20;                 -- latest / comments analogous
-- Q7  R2 board, History Course half (branch 8), same batch as Q6; R4 is Q7 alone with the 11 run columns.
SELECT id, created_at, like_count, comment_count, like_count AS recommend_score, 'history_course' AS service,
       substr(trim(coalesce(nullif(seed, ''), id)), 1, 120) AS title, donor_nickname AS nickname,
       donor_user_id AS user_id, cover_spec, win, ascension, total_floors
FROM runs WHERE (like_count, created_at, id) < (?1, ?2, ?3)
ORDER BY like_count DESC, created_at DESC, id DESC LIMIT 20;                 -- runs_likes / runs_created / runs_comments
--     The Worker merges Q6 + Q7 by (score, created_at, id) DESC (ids compared as JS strings = SQLite BINARY) and
--     keeps 20: the same rows as v2's UNION ALL + outer ORDER BY/LIMIT, because the order is total.
-- Q8  R5/R17 one post (detail, embeds, Pagestorm snapshot, OG).                PKs
SELECT ... FROM posts p JOIN post_<s> s ON s.post_id = p.id WHERE p.id = ?1 AND p.service = ?2;
-- Q9  R6 tournament presets.                                                   post_favorite_tournament_builtin
-- CROSS JOIN pins f as the outer loop: with a plain JOIN, sqlite 3.51 scans posts_created (all posts) instead.
SELECT ... FROM post_favorite_tournament f CROSS JOIN posts p ON p.id = f.post_id
WHERE substr(f.preset_key, 1, 8) = 'builtin:' ORDER BY p.created_at, p.id;  -- + pool subquery
-- Q10 R7 tournament stats.                                                     PK prefix
SELECT * FROM favorite_tournament_candidate_stats WHERE tournament_id = ?1;
-- Q11 R8 Pagestorm index: Q1 with service 'pagestorm', the 12 list columns, LIMIT 50, no cursor.
-- Q12 R9 my drafts.                                                            pagestorm_drafts_user_updated
SELECT <12 list columns> FROM pagestorm_drafts WHERE user_id = ?1 ORDER BY updated_at DESC, id DESC LIMIT 20;
-- Q13 R9 one draft:  SELECT * FROM pagestorm_drafts WHERE id = ?1 AND user_id = ?2;                PK
-- Q14 R10 body:      SELECT b.*, p.service FROM defragment_bodies b JOIN posts p ON p.id = b.post_id
--                    WHERE b.post_id = ?1 AND p.service = ?2;                                       PKs
-- Q15 R11 this-or-that like counts (≤100 ids).                                 threads PK (engagement)
SELECT substr(thread_key, 14) AS post_id, like_count FROM threads
WHERE thread_key IN (SELECT 'this-or-that:' || value FROM json_each(?1)) AND like_count > 0;
-- Q16 R12 my this-or-that likes.                                               likes PK (story_id, user_id)
SELECT substr(story_id, 14) AS post_id FROM likes
WHERE user_id = ?1 AND story_id IN (SELECT 'this-or-that:' || value FROM json_each(?2));
-- Q17 R13 vote summaries (≤50 ids).                                            post_this_or_that PK
SELECT post_id, left_vote_count AS left_count, right_vote_count AS right_count,
       left_vote_count + right_vote_count AS total_count
FROM post_this_or_that WHERE post_id IN (SELECT value FROM json_each(?1)) AND left_vote_count + right_vote_count > 0;
-- Q18 R14 my votes (≤100 ids).                                                 this_or_that_post_votes PK
SELECT post_id, choice FROM this_or_that_post_votes
WHERE user_id = ?1 AND post_id IN (SELECT value FROM json_each(?2));
-- Q19 R15 nav latest of one service (or the surface_latest recompute after a delete).     posts_service_created
SELECT created_at FROM posts WHERE service = ?1 ORDER BY created_at DESC, id DESC LIMIT 1;
-- Q20 R16 own posts for profile activity (chemical, combo, this or that).     posts_user
SELECT ... FROM posts WHERE user_id = ?1 AND service IN ('chemical_x', 'combo', 'this_or_that')
ORDER BY created_at DESC, id DESC;
-- Q21 ownership (body write, defragment_source_owned; post edit/delete guard).  posts PK
SELECT 1 FROM posts WHERE id = ?1 AND service = ?2 AND user_id = ?3;
-- Q22 play validation: SELECT resource_type, resource_id FROM post_favorite_tournament_pool WHERE post_id = ?1;  PK
-- Q23 FK cascade on post delete: post_<s>, children, votes, stats, bodies by PK prefix; plays by
--     favorite_tournament_plays_tournament.
```

### 2.2 Every index: the queries it serves, and why no smaller set would do

| index | serves | why it is needed (what removing it would cost) |
|---|---|---|
| `posts` PK `(id)` | Q8, Q13-Q14 joins, Q21, every write by id, FK parents | identity; 1 row per lookup |
| `posts_service_created` | Q1, Q4/Q5 (scan of the service), Q11, Q19 | busiest read (latest sort ≈ most of 43 feed calls/day, the nav dot 7×/snapshot). Without it each call scans `posts_created` until 20 rows of that service turn up: up to all 328 rows for pagestorm or this or that, and growing |
| `posts_service_likes`, `posts_service_comments` | Q2, Q3 | keyset on `(count, created_at, id)` inside one service; without them, a page reads every post of the service with a lower or equal count and sorts them (up to `N_s` + `N_s`) |
| `posts_created`, `posts_likes`, `posts_comments` | Q6 | the board sorts across services. Without them: 7 per-service seeks of 20, merged (140 rows, today's v2 shape) instead of 20. Cost: one index entry per insert, two per like/comment change. Writes are a few per day; the board is read ≈ 9 times a day |
| `posts_user` | Q20 (profile, 2-3 calls/day), local admin metrics | otherwise every call reads all chemical + combo + this-or-that posts (163 today) to find the caller's; costs 1 entry per insert |
| `posts_keys_immutable` (trigger, not an index) | guards Q1-Q7 cursors | see section 4 |
| per-service PKs `(post_id)` | Q1-Q5/Q8/Q9 joins, FK cascade | 1:1 lookups |
| `post_combo_resources` PK `(post_id, ord)` | Q1/Q8 `resources` subquery, edit replace, cascade | the only access path is "this post's elements in order". No element index until a server query filters by element |
| `post_favorite_tournament_pool` PK `(post_id, ord)` | Q5/Q8/Q9 `pool` subquery, Q22, cascade | same. Q22 reads the pool once (≤ 1,000 rows, about 1 play a day) and checks membership in TS, so a `(post_id, type, id)` UNIQUE index would cost 1 write per pool row for a read that does not need it |
| `post_favorite_tournament_builtin` (partial UNIQUE) | Q9; seed upsert conflict target | constraint the seed depends on; Q9 then reads only the builtins (B rows), not all tournaments |
| `this_or_that_post_votes` PK `(post_id, user_id)` | Q18 (seeks per listed post), vote write conflict, cascade | natural key; Q18 needs no `user_id` index because the id list (≤ 100) drives PK seeks |
| `favorite_tournament_candidate_stats` PK | Q10, play upsert, re-rank scan, cascade | replaces both Postgres indexes: the re-rank orders in SQL over ≤ 1,000 rows (a window function over the PK prefix), so `idx_favorite_tournament_stats_rank` is not needed |
| `favorite_tournament_plays` PK `(id)` | mirror idempotency, step-2 upsert by id | identity |
| `favorite_tournament_plays_tournament` | Q23 cascade lookup | SQLite looks child rows up by the FK column on every parent delete; without it each tournament delete scans all plays |
| `pagestorm_drafts` PK, `pagestorm_drafts_user_updated` | Q13, Q12 | own drafts newest first with LIMIT 20 |
| `defragment_bodies` PK `(post_id)` | Q14, body upsert, cascade | replaces the PK and its duplicate index |

### 2.3 Every query: index used and rows read (today's sizes)

| query | volume (legacy, inv) | index | rows read per call |
|---|---|---|---|
| Q1-Q3 | ≈ 43/day all services | `posts_service_*` | ≈ 60; combo + ~4 resources per post (≈ 80); tournament + pool rows of the 20 tournaments (unknown P, up to ≈ 1,000 per builtin) |
| Q4 vote sorts | small part of Q1 | `posts_service_created` scan + PK join + temp sort | ≈ 2 × 23 = 46 (+ 20 for the page) |
| Q5 play_count | small part of Q1 | same | ≈ 2 × 47 = 94 + pool rows of the page |
| Q6 + Q7 board | ≈ 9/day | `posts_*` + `runs_*` | ≈ 40 + 40 (today: 8 × 20 subqueries) |
| Q8 one post | detail views | PKs | 2 (+ child rows) |
| Q9 presets | every tournament-list mount | partial unique | 3B + all builtin pool rows (import measures; ≈ 3,000 expected) |
| Q10 stats | each tournament detail | PK prefix | C (candidates with stats; ≤ pool size) |
| Q11 Pagestorm index | page view | `posts_service_created` | 3 × min(N, 50) = 42 today |
| Q12 / Q13 drafts | rare | drafts index / PK | ≤ 40 / 1 |
| Q14 body | each federated detail (791 index scans lifetime) | PKs | 2 |
| Q15 / Q16 | per this-or-that list page | threads / likes PK | ≤ 100 seeks, rows = hits |
| Q17 | ≈ 12/day | PK | ≤ 50 (today: every vote row of those posts, ≈ 1,500) |
| Q18 | per list page | PK | ≤ 100 seeks, rows = my votes |
| Q19 | ≈ 7 per nav snapshot refresh or per post delete | covering `posts_service_created` | 1 each |
| Q20 | 2-3/day | `posts_user` | own posts (few) |
| Q21 / Q22 | per write / per play | PK | 1 / P |

Q4 and Q5 have no index on purpose. An index there would need `created_at` copied into the service table, because an
index cannot span tables. That costs 2 index writes per vote (≈ 10 a day) and saves ≈ 46 to 94 rows on a sort that is
a small fraction of 43 calls a day. When `N_s` of this or that or of tournaments passes ≈ 2,000 rows, add a nullable
`created_at` copy (written once; immutable) and `(left_vote_count + right_vote_count, created_at, post_id)` /
`(play_count, created_at, post_id)` indexes. That only grows the schema.

Budget: everything above is well under 100k rows read a day, against the 5M free tier. The largest term is tournament
pools: presets plus feed pages, roughly 10-30 calls a day × ≤ 3,000 rows. The first copy writes about 3,500 rows plus
pool rows plus about 2,600 `posts` index entries: ≈ 10-20k of the 100k/day write limit. A wipe-and-refill (plan 7.2)
can be repeated daily.

## 3. Supabase → D1 (first copy and step-2 sync), D1 → Supabase (step-5 outbox)

General rules:

- **Env routing**: `env='production'` rows go to `slseoun-prod`, `env='development'` rows to `slseoun-testbed`. The
  `env` value is dropped.
- **Timestamps**: normalize every value to the canonical 27-character form. Sources: dump text
  `2026-11-05 11:48:12.1234+00`, PostgREST `…T11:48:12.1234+00:00`, client `…T11:48:12.123Z`. Parse the date, time,
  fraction and offset as strings and right-pad the fraction to 6 digits. Shift non-zero offsets with integer math on
  the seconds part. Never go through JS `Date`, which keeps only milliseconds.
- **JSON**: store the text Supabase emits (canonical jsonb text from the dump or PostgREST) as-is, after `json_valid`.
  Arrays that become child tables are exploded with their index as `ord`.
- **Booleans**: `true/false/null` → `1/0/NULL`. `text[]` → JSON array text.
- **Upsert**: `INSERT … ON CONFLICT(<pk>) DO UPDATE SET <non-key columns>`. Never `INSERT OR REPLACE`, which would
  cascade-delete children. `id`, `service` and `created_at` are left out of the `SET` list (the immutability trigger).
- **Order**: first copy: `PRAGMA defer_foreign_keys = ON` per batch, parents first anyway (`posts` → `post_*` →
  children → satellites). Sync: apply in change-log order. A post's insert commits before its votes, so FKs hold. A
  missing parent (out-of-order failure) stops the batch and leaves the log cursor in place.
- **Derived values in step 2**: copied as Supabase holds them. D1 computes only the values that have no Supabase
  column (below).
- **Read-after-write** (plan 7.3 step 2): after a step-1 write succeeds, the Worker re-reads that Supabase row (and,
  for a vote/like/play, the post row) and applies it as a sync event. Stats rows of a play wait for the 1-minute sync.

### 3.1 Per source table

| Supabase row | becomes in D1 | delete propagates as | derived values |
|---|---|---|---|
| `chemical_posts` | `posts` (service `chemical_x`, title NULL, summary `substr(trim(content_text),1,120)`) + `post_chemical_x` | `DELETE FROM posts WHERE id` (cascade) | `like_count`, `comment_count` copied |
| `combo_posts` | `posts` (summary from `content_text`) + `post_combo` + `post_combo_resources` (delete the post's rows, insert from `resources` with `ord`) | same | copied |
| `transfigure_posts` | `posts` (title; summary `substr(trim(coalesce(nullif(title,''), nullif(transformed_name,''), content_text)),1,120)`) + `post_transfigure` (all columns except `source_game_locale`) | same | copied |
| `this_or_that_posts` | `posts` (summary from `reason`) + `post_this_or_that` (vote counters) | same (cascades votes) | `like_count`, `comment_count`, `left/right_vote_count` copied; `vote_rate_bps` dropped |
| `favorite_tournament_posts` | `posts` (`user_id` NULL for builtins; summary `coalesce(nullif(title,''), note)`) + `post_favorite_tournament` (no `game_version`) + `post_favorite_tournament_pool` (replace) | same (cascades pool, stats, plays) | `like_count`, `comment_count`, `play_count` copied |
| `decisions_decisions_posts` | `posts` (title; summary `coalesce(nullif(title,''), note)`) + `post_decisions_decisions` | same | copied |
| `pagestorm_posts` | `posts` (title; summary `coalesce(nullif(title,''), content_text)`) + `post_pagestorm` | same | copied |
| `defragment_posts` | nothing (0 rows; no change-log trigger installed) | n/a | n/a |
| `this_or_that_post_votes` | `this_or_that_post_votes (post_id, user_id, choice, created_at)` | by `(post_id, user_id)`; cascaded Supabase deletes arrive as row events too and become no-ops | the post row's counter update arrives as its own event |
| `this_or_that_post_likes` | engagement `likes (story_id = 'this-or-that:' ‖ post_id, user_id, created_at)` | by `(story_id, user_id)` (the change log must keep `post_id, user_id` of the old row) | `threads('this-or-that:<id>').like_count` recounted from D1 `likes` for each touched key (the same rows the view counts); `posts.like_count` comes with the post row event |
| `favorite_tournament_candidate_stats` | same table without `env` (`rank_history` text as-is) | by PK | copied (they are the derived rows) |
| `favorite_tournament_plays` | same table without `env` | by `id` | none |
| `pagestorm_drafts` | same table without `env` | by `id` | none |
| `defragment_bodies` | `defragment_bodies` with `post_id = source_id`, only if `posts(id = source_id, service = source_service)` exists; otherwise skipped and counted (orphan) | by `post_id` | none |
| `runs` (board fields) | runs design | runs design | `like_count`, `comment_count` copied |

The summary expressions are SQLite's `substr`/`trim`/`nullif`/`coalesce`. They count and trim exactly like Postgres
`left`/`btrim`/`nullif`/`coalesce` (characters, spaces only), so one SQL expression serves the sync, the first copy and
the step-5 writes.

**Counts with no Supabase column**:

- `threads` rows of toybox keys: counted from D1's `likes`/`comments` rows by the engagement sync. They match what
  detail pages show today (a `HEAD count` of `likes` rows), while `posts.like_count` matches what lists show today (the
  column). Where Supabase has drifted, the two copies differ in D1 exactly as they do in Supabase today; the daily
  check reports `posts.like_count <> threads.like_count`.
- `this-or-that:` like counts in `threads`: counted from rows, equal to today's view.
- `posts.summary`, and `vote_rate_bps` (computed at read time only).

**Import checks** (the first copy stops when one fails; all are offline against the dump):

1. id collisions across the 7 post tables (inv:§9 query); expected 0.
2. `chemical_posts.created_at IS NULL` count; expected 0 (`posts.created_at` is NOT NULL; open question 2).
3. Every `pool` and `resources` element is exactly `{type: string, id: string}` (STRICT TEXT columns).
4. Orphan `defragment_bodies` (no post with that service and id): count and list. They are dropped.
5. `this_or_that_post_likes` rows whose `(post_id, user_id)` already appears in `likes` under
   `this-or-that:<post_id>` (they would collide on the `likes` PK): expected 0.
6. Counter drift: `like_count`/`comment_count` vs `likes`/`comments` rows, `left/right_vote_count` vs vote rows,
   `play_count` vs plays. Report only; open question 1.
7. Largest JSON text per column below the D1 row limit (2 MB), and `extra_variants` ≤ 262,144 bytes as text.

### 3.2 D1 → Supabase, step-5 outbox (source rows only)

The mirror writes with the service key, so the Supabase guard trigger does not fire. D1's `created_at` therefore
survives as written (ms precision from the Worker, padded to `.ffffff` in D1, stored as `.fff000` in Supabase). Both
read back the same instant.

| D1 source change | Supabase write | derived values in Supabase |
|---|---|---|
| post insert (`posts` + `post_<s>` + children) | `INSERT` into `<service table>` with `id, user_id, nickname, avatar/palette, env = API_DATA_ENV, created_at`, the service columns, `resources`/`pool` rebuilt as jsonb arrays in `ord` order, counters 0. Dead NOT NULL columns get the request's value from the outbox payload (`source_game_locale` as the client sent it; `game_version` = `FAVORITE_TOURNAMENT_GAME_VERSION`) | none at insert |
| post edit (4 services) | `PATCH` the editable columns and the snapshot only | counters untouched |
| post delete | `DELETE` the post (Supabase cascades votes, stats, plays) **and** its `defragment_bodies` row (D1 cascaded it; Supabase has no FK) | `likes`/`comments` stay, as today |
| vote insert / delete | `INSERT` / `DELETE this_or_that_post_votes` with `created_surface` from the payload (fallback `'index'`) | Supabase vote trigger recomputes `left/right_vote_count` |
| like with key `this-or-that:<id>` | `INSERT` / `DELETE this_or_that_post_likes (post_id, user_id, env)`, not `likes` | Supabase trigger recomputes `like_count` |
| other likes/comments on toybox keys | engagement mirror | Supabase engagement trigger recomputes `like_count`/`comment_count` |
| tournament play | `rpc/mirror_favorite_tournament_play(p_play_id, p_user_id, p_env, p_tournament_id, p_starting_size, p_champion_type, p_champion_id, p_matches, p_created_at)`: a new service-role-only function (additive migration before step 4) that runs steps 2-10 of `complete_favorite_tournament_play` for an explicit actor and does nothing if the play id exists | that function recomputes `play_count` and stats. No trigger does it in Supabase, so sending only the play row would leave them stale (inv:§11.4). Recomputing there instead of sending derived rows keeps the plan's "source rows only" rule. `rank_history[].at` will differ by the mirror delay |
| draft insert / update / delete | the same row with `env` | none |
| body upsert | `POST defragment_bodies` `on_conflict=env,source_service,source_id` with `source_service = posts.service`, `source_id = post_id` | none |
| builtin re-seed (script) | the seed script writes D1 in step 5 and the mirror carries the row | none |

The same function also fixes step 4, where the Worker writes with the service key and `auth.uid()` is NULL: the step-4
Worker calls it with the verified sub.

## 4. What replaces each trigger, RPC and RLS rule

All writes below are one D1 `batch()` (one transaction) in step 5, built from at most a handful of statements (D1 Free:
50 per invocation). In step 4 the same checks run in the Worker before it writes Supabase with the service key. Every
statement of an edit or delete carries the owner guard (`… AND user_id = :sub`, or `EXISTS (SELECT 1 FROM posts WHERE
id = :id AND service = :s AND user_id = :sub)`), because a batch cannot branch. A batch whose last `SELECT` returns
nothing answers `[]` or `deleted: false`, like PostgREST today.

| Supabase object | replacement | why this form |
|---|---|---|
| `guard_post_server_columns` (insert) | the Worker's INSERT lists `id` (`crypto.randomUUID()`), `created_at` (now, canonical), counters 0 and `user_id = :sub` itself and ignores those fields in the body | client-supplied server columns become impossible by construction (plan 5.2) |
| `guard_post_server_columns` (update) | the UPDATE statements list only editable columns (snapshot, title, summary, service columns). The `posts_keys_immutable` trigger rejects any change of `id`, `service`, `created_at` | the trigger is cheap, also protects the sync, and keeps the keyset invariant even if a future statement is wrong |
| `guard_insert_server_columns` | not in this domain (comments, stories) | |
| `apply_toybox_thread_engagement_delta` (like/comment → post counters) | in the engagement like/comment batch: `UPDATE posts SET like_count = like_count + 1 WHERE id = :post_id AND service = :s AND NOT EXISTS (SELECT 1 FROM likes WHERE story_id = :key AND user_id = :sub)` placed **before** the `INSERT OR IGNORE INTO likes`; delete mirrors it (`max(0, like_count - 1)` with `EXISTS`, before the `DELETE`). Prefix → service map in TS (`comment-threads.ts`) | conditional statements keep "duplicate like = success, no double count" without `RETURNING` between statements. No SQLite trigger: step 2 must copy Supabase values untouched |
| `apply_this_or_that_like_count_delta` | the same path (likes merged) | one like system |
| `apply_this_or_that_vote_count_delta` | vote: `[UPDATE post_this_or_that SET left_vote_count = left_vote_count + (:c = 'left'), right_vote_count = right_vote_count + (:c = 'right') WHERE post_id = :id; INSERT INTO this_or_that_post_votes (…)]`. A duplicate or a missing post fails the INSERT (PK / FK), rolls back the batch, and maps to today's 23505 / not-found answers. Unvote: `UPDATE … SET left_vote_count = max(0, left_vote_count - EXISTS(SELECT 1 … choice = 'left')), …` then `DELETE` | counters move only together with their source row |
| `complete_favorite_tournament_play` | Worker: shape checks; Q22 pool read; membership, size (`2 ≤ size ≤ pool`, `matches = size - 1`), winners in `left/right`, champion = final winner, in TS. Batch: (1) `INSERT` play; (2) `UPDATE post_favorite_tournament SET play_count = play_count + 1`; (3) one `INSERT INTO favorite_tournament_candidate_stats … SELECT … FROM json_each(:deltas) ON CONFLICT DO UPDATE SET match_appearances = match_appearances + excluded.match_appearances, …` with per-candidate deltas aggregated in TS; (4) one `UPDATE … FROM (SELECT …, row_number() OVER (ORDER BY championships DESC, CASE WHEN match_appearances > 0 THEN CAST(match_wins AS REAL) / match_appearances ELSE 0 END DESC, match_appearances DESC, resource_type, resource_id) AS r FROM … WHERE tournament_id = :t) … SET current_rank = r, rank_history = json_insert(rank_history, '$[#]', json_object('at', :at, 'rank', r)) WHERE current_rank IS NOT r` | 4 statements for any bracket size (a 297-match bracket would be about 600 upserts as single statements). Increments are atomic, so concurrent plays cannot lose updates. Only rows whose rank changed are written (Postgres rewrites all; the values are the same). REAL division orders the same as Postgres numeric: different win rates with denominators ≤ 1,000 differ by ≥ 1e-6, and equal rationals give the same double. `:at` keeps today's `YYYY-MM-DD HH:MM:SS.ffffff` text |
| `get_this_or_that_vote_summaries` | Q17 from the counters (keep the 50-id cap until step 6 so answers match) | SECURITY DEFINER existed only to aggregate rows RLS hides; ≈ 50 rows instead of ≈ 1,500 |
| `get_toybox_feed`, `get_defragment_feed_v2` | Q1-Q7 in Worker TS. Sort whitelist as today (unknown → `latest`; vote sorts only for `this_or_that`, `play_count` only for `favorite_tournament`, otherwise `[]`) | |
| `defragment_source_owned` | Q21 inside the body upsert: `INSERT INTO defragment_bodies … SELECT … WHERE EXISTS (SELECT 1 FROM posts WHERE id = :id AND service = :s AND user_id = :sub) ON CONFLICT(post_id) DO UPDATE SET …` | one PK read; with no matching post, the upsert writes nothing and the Worker answers like a refused RLS check |
| `admin_story_service` | `commentThreadService` in TS only (local admin scripts, plan 5.7); toybox metrics group by `posts.service` | no SQL caller remains |
| `get_rls_activity_metrics` toybox parts | local `wrangler d1 execute` scripts (full scans are fine there) | plan 5.7 |
| RLS read `true` on posts, stats, likes | public `/api/read/*` routes. Like rows with user ids are no longer listed publicly; only counts and `/api/me` own likes | |
| RLS insert own (`auth.uid() = user_id`) | `user_id = :sub` set by the Worker; tournament insert rejects `preset_key` starting with `builtin:` (case-sensitive `substr`) and forces `'custom'` | |
| RLS update own (combo, transfigure, decisions, pagestorm) | owner-guarded statements; other services answer `invalid` as today (`TOYBOX_UPDATABLE_SERVICES`) | |
| RLS delete own | `DELETE FROM posts WHERE id = :id AND service = :s AND user_id = :sub RETURNING id`; builtins (`user_id` NULL) never match | |
| votes: read own only, insert own + post exists | `/api/me` reads with `user_id = :sub`; existence by FK | |
| plays: read `true` | dropped; no route | privacy fix (tasks/010 #67) |
| drafts: own only | every statement filters `user_id = :sub` | |
| bodies: insert/update `TO authenticated`, own and source owned | the guarded upsert above; no client delete | |
| env mismatch risk (STEP1 9.8) | gone: one database per env | |

Postgres CHECKs that move to Worker validation (D1 still enforces the 2 MB row limit):

- every `pg_column_size` limit (content ≤ 1 MB, `resources` ≤ 128 KB, `pool`, `rows`/`placements`/`extra_ids`,
  `matches`, the transfigure keyword arrays ≤ 1024). They measure compressed bytes, which TEXT cannot reproduce. Step-5
  upload caps drop from 8 MB/4 MB to below the D1 row limit (about 1.9 MB of JSON per post).
- `combo_posts.resources` array with ≥ 2 elements (now rows); the client's dedupe by `type:id`.
- `favorite_tournament_posts.pool` is an array (now rows); `user_id_builtin_check` (crosses `posts` and
  `post_favorite_tournament`).
- the `extra_variants` element rules (the client already checks them; Postgres never did).
- the `(post_id) exists in the same env` vote policy (FK now).

## 5. Rebuilding the step-1 answers for shadow comparison

The D1 adapter assembles responses as strings. It writes scalars with `JSON.stringify` and splices the stored JSON
TEXT of documents in unparsed, which avoids the 10 ms CPU cost of parsing 1 MB documents. It adds the fields Supabase
has that D1 does not store:

- `env` = `API_DATA_ENV` in every row and `post` object.
- Timestamps are converted to PostgREST's form: `substr(ts,1,19) || (CASE WHEN substr(ts,21,6) = '000000' THEN '' ELSE
  '.' || rtrim(substr(ts,21,6), '0') END) || '+00:00'`. That is byte-equal to PostgREST, so cursors echoed by clients
  keep working and timestamps can be compared as strings.
- Booleans become `true`/`false`/`null`.
- `this_or_that` `vote_rate_bps` = `CASE WHEN l + r <= 0 THEN 0 ELSE (max(l, r) * 10000) / (l + r) END` (integer
  division, as Postgres).
- `title` appears only for the 4 services that have one; `resources` and `pool` are rebuilt from the child rows in
  `ord` order.

| route | D1 source | comparison |
|---|---|---|
| `toybox-feed` | Q1-Q5: `{id, created_at, like_count, comment_count, recommend_score = like_count, post}`; `post` = the Supabase table's columns from `posts` + `post_<s>` (+ `env`, `vote_rate_bps`) | field-equal, order-equal |
| `defragment-feed` | Q6 + Q7 merged; `history_meta` = `{cover_spec, win, ascension, total_floors}` for runs, `null` for posts; `palette_swapped` `null` for runs | field-equal, order-equal |
| `defragment-runs` | Q7 alone, 11 columns (runs design) | field-equal |
| `toybox-post` | Q8 → `[row]` or `[]`; `service=defragment` → `[]` | field-equal |
| `favorite-tournament/presets` | Q9 | order-equal (ties impossible: seed timestamps differ) |
| `favorite-tournament/stats` | Q10 | **as a set** keyed by `(resource_type, resource_id)`: Supabase has no ORDER BY |
| `pagestorm/posts`, `me/pagestorm/drafts` | Q11, Q12/Q13 | field-equal; drafts with equal `updated_at` compared as a set inside the tie |
| `defragment-body` | Q14 with `source_service = p.service`, `source_id = post_id` | field-equal |
| `this-or-that/like-counts`, `me/this-or-that/likes`, `vote-summaries`, `me/this-or-that/votes` | Q15-Q18 inside `{v, env, rows}` | `rows` **as sets** (GROUP BY / IN without ORDER BY) |

Comparator rules: parse both bodies. Compare objects by key regardless of key order (PostgREST `select *` uses column
order, `to_jsonb` uses jsonb key order, D1 uses its own), arrays in order, numbers by value (jsonb `1.50` ≡ `1.5`), and
timestamps as exact strings (they are byte-reproducible, so any difference is a real bug).

Not reproducible, and how to compare:

1. `transfigure_posts.source_game_locale` and `favorite_tournament_posts.game_version` (not stored): the comparator
   drops these two keys from Supabase rows. The client never reads them.
2. Supabase counter drift. `vote-summaries` counts vote rows in Supabase but reads counters in D1, and the same holds
   for `like_count` vs rows anywhere. A difference that the import report (check 6) already lists is classified
   "known drift" until open question 1 is settled; any other difference is a bug.
3. Orphans. A body read for a deleted post returns the row in Supabase and `[]` in D1, and so does a request for a body
   dropped at import. The comparator marks a body difference as expected when the Supabase post with that id does not
   exist.
4. Error paths: `defragment-body?service=history_course&id=<run id>` fails in Supabase (uuid cast, swallowed by the
   client). The D1 adapter returns the same `apiError` code the Supabase adapter maps 22P02 to (it checks
   `isPostUuid`), so no difference arises.
5. Writes are not shadowed. They go to Supabase until step 5.

## 6. Open questions for the user

1. **Counter drift found at import** (check 6): before the shadow gate, recount the drifted Supabase counters once
   with a service-role `UPDATE`, which is a production data write. The alternative is to keep a "known drift"
   exception in the comparator until step 5. Recommendation: recount, so "shadow difference 0" can mean 0.
2. **If `chemical_posts` has rows with `created_at IS NULL`** (expected none): set them in Supabase to a chosen time
   first (production data write), or give D1 a nullable `created_at` (it would sort differently from Postgres:
   SQLite puts NULL last in DESC). Recommendation: the Supabase fix; asked only if check 2 finds any.

Assumptions for the integrator (not user decisions): the canonical timestamp format, the snapshot column names,
`likes` absorbing `this_or_that_post_likes`, the `threads`/`likes` key shapes, the change log keeping natural keys for
deletes, the runs columns and indexes requested above, no FKs on `user_id`, and the new Supabase function
`mirror_favorite_tournament_play` (an additive Supabase migration that follows `docs/RELEASE_PROCESS.md`).

Checked with local sqlite 3.51 (`sqlite3`, not yet `wrangler d1`):

- The whole DDL block loads, and `posts_keys_immutable` rejects a `created_at` change.
- Q2 plans as `SEARCH p USING COVERING INDEX posts_service_likes (service=? AND (like_count,created_at,id)<(?,?,?))`
  and Q6 as `SEARCH posts USING COVERING INDEX posts_created ((created_at,id)<(?,?))`, with no temp B-tree.
- Q18 runs PK seeks driven by `json_each`.
- Q4 is the expected service scan plus a temp sort.
- Q9 needs the `CROSS JOIN` shown above.
- `json_group_array` over the PK scan keeps `ord` order.

Still to check on `wrangler d1` before 0003: the same plans, and `UPDATE … FROM` with a window function.
