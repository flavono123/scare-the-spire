-- Supabase exit step 2 (D1 shadow copy), design 4.3 and 4.4: Toy Box posts and History Course runs.
-- One posts row per post, one post_<service> row with the service's typed columns, child tables for
-- arrays filtered or joined by element.
-- Generated from docs/supabase-exit/d1-schema/schema.src.sql by gen_schema.py: edit the source
-- and regenerate (check.py fails when they differ). Once applied to a remote database, never
-- change this file; add a new migration section to the source instead.

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
  user_id TEXT CHECK ((user_id GLOB '????????-????-????-????-????????????' AND user_id NOT GLOB '*[^0-9a-f-]*' AND length(replace(user_id, '-', '')) = 32)),
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
  created_at TEXT NOT NULL CHECK ((substr(created_at, 1, 10) GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND substr(created_at, 11, 9) GLOB 'T[0-9][0-9]:[0-9][0-9]:[0-9][0-9]' AND substr(created_at, 20) GLOB '.[0-9][0-9][0-9][0-9][0-9][0-9]Z')),
  -- Toy Box ids are Postgres uuid; runs.id is text with octet_length <= 1024 only (runs_key_size_check).
  CHECK (CASE WHEN service = 'history_course' THEN length(CAST(id AS BLOB)) <= 1024
              ELSE (id GLOB '????????-????-????-????-????????????' AND id NOT GLOB '*[^0-9a-f-]*' AND length(replace(id, '-', '')) = 32) END),
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
  user_id TEXT NOT NULL CHECK ((user_id GLOB '????????-????-????-????-????????????' AND user_id NOT GLOB '*[^0-9a-f-]*' AND length(replace(user_id, '-', '')) = 32)),
  choice TEXT NOT NULL CHECK (choice IN ('left', 'right')),
  created_at TEXT NOT NULL CHECK ((substr(created_at, 1, 10) GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND substr(created_at, 11, 9) GLOB 'T[0-9][0-9]:[0-9][0-9]:[0-9][0-9]' AND substr(created_at, 20) GLOB '.[0-9][0-9][0-9][0-9][0-9][0-9]Z')),
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
  user_id TEXT NOT NULL CHECK ((user_id GLOB '????????-????-????-????-????????????' AND user_id NOT GLOB '*[^0-9a-f-]*' AND length(replace(user_id, '-', '')) = 32)),
  created_at TEXT NOT NULL CHECK ((substr(created_at, 1, 10) GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND substr(created_at, 11, 9) GLOB 'T[0-9][0-9]:[0-9][0-9]:[0-9][0-9]' AND substr(created_at, 20) GLOB '.[0-9][0-9][0-9][0-9][0-9][0-9]Z')),
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
  id TEXT NOT NULL PRIMARY KEY CHECK ((id GLOB '????????-????-????-????-????????????' AND id NOT GLOB '*[^0-9a-f-]*' AND length(replace(id, '-', '')) = 32)),
  service TEXT NOT NULL DEFAULT 'favorite_tournament' CHECK (service = 'favorite_tournament'),
  tournament_id TEXT NOT NULL,
  user_id TEXT NOT NULL CHECK ((user_id GLOB '????????-????-????-????-????????????' AND user_id NOT GLOB '*[^0-9a-f-]*' AND length(replace(user_id, '-', '')) = 32)),
  starting_size INTEGER NOT NULL CHECK (starting_size >= 2),
  champion_type TEXT NOT NULL,
  champion_id TEXT NOT NULL,
  -- [{left_type, left_id, right_type, right_id, winner}], iterated once at write.
  matches TEXT NOT NULL CHECK (json_valid(matches) AND json_type(matches) = 'array'
    AND json_array_length(matches) = starting_size - 1),
  created_at TEXT NOT NULL CHECK ((substr(created_at, 1, 10) GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND substr(created_at, 11, 9) GLOB 'T[0-9][0-9]:[0-9][0-9]:[0-9][0-9]' AND substr(created_at, 20) GLOB '.[0-9][0-9][0-9][0-9][0-9][0-9]Z')),
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
  id TEXT NOT NULL PRIMARY KEY CHECK ((id GLOB '????????-????-????-????-????????????' AND id NOT GLOB '*[^0-9a-f-]*' AND length(replace(id, '-', '')) = 32)),
  user_id TEXT NOT NULL CHECK ((user_id GLOB '????????-????-????-????-????????????' AND user_id NOT GLOB '*[^0-9a-f-]*' AND length(replace(user_id, '-', '')) = 32)),
  nickname TEXT NOT NULL CHECK (length(nickname) BETWEEN 1 AND 20),
  avatar_id TEXT,
  avatar_kind TEXT,
  palette_id TEXT,
  palette_swapped INTEGER DEFAULT 0 CHECK (palette_swapped IN (0, 1)),
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 80),
  content TEXT NOT NULL CHECK (json_valid(content) AND json_type(content) = 'object'),
  content_text TEXT NOT NULL CHECK (length(content_text) BETWEEN 1 AND 8000),
  created_at TEXT NOT NULL CHECK ((substr(created_at, 1, 10) GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND substr(created_at, 11, 9) GLOB 'T[0-9][0-9]:[0-9][0-9]:[0-9][0-9]' AND substr(created_at, 20) GLOB '.[0-9][0-9][0-9][0-9][0-9][0-9]Z')),
  updated_at TEXT NOT NULL CHECK ((substr(updated_at, 1, 10) GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND substr(updated_at, 11, 9) GLOB 'T[0-9][0-9]:[0-9][0-9]:[0-9][0-9]' AND substr(updated_at, 20) GLOB '.[0-9][0-9][0-9][0-9][0-9][0-9]Z')),
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
  user_id TEXT NOT NULL CHECK ((user_id GLOB '????????-????-????-????-????????????' AND user_id NOT GLOB '*[^0-9a-f-]*' AND length(replace(user_id, '-', '')) = 32)),
  nickname TEXT NOT NULL CHECK (length(nickname) BETWEEN 1 AND 20),   -- its only snapshot column
  content TEXT NOT NULL CHECK (json_valid(content)),                 -- PostBlock[]
  content_text TEXT NOT NULL CHECK (length(content_text) BETWEEN 2 AND 8000),
  created_at TEXT NOT NULL CHECK ((substr(created_at, 1, 10) GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND substr(created_at, 11, 9) GLOB 'T[0-9][0-9]:[0-9][0-9]:[0-9][0-9]' AND substr(created_at, 20) GLOB '.[0-9][0-9][0-9][0-9][0-9][0-9]Z')),
  updated_at TEXT NOT NULL CHECK ((substr(updated_at, 1, 10) GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND substr(updated_at, 11, 9) GLOB 'T[0-9][0-9]:[0-9][0-9]:[0-9][0-9]' AND substr(updated_at, 20) GLOB '.[0-9][0-9][0-9][0-9][0-9][0-9]Z')),
  PRIMARY KEY (service, post_id),
  FOREIGN KEY (service, post_id) REFERENCES posts (service, id) ON DELETE CASCADE
) STRICT;

-- 역사 강의서: the run's typed columns. posts holds id (the run id), owner (donor), donor nickname,
-- created_at, summary (seed or id) and the counters. The list reads these summary columns, computed
-- from the raw in D1 only (design 10.2): by the first copy and the summary backfill job in steps 2-4,
-- sent by the browser at upload from step 5. Supabase runs has no summary columns.
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
  -- List summary (characters, game_elements, game_mode, list_facts, summary_version), computed from
  -- the raw in D1 only. summary_version 0 = not computed yet (a run the 1-minute sync inserted or whose
  -- raw changed, or one uploaded by a tab still on the old JS; the summary backfill job fills it, and
  -- until then the list computes that run from its raw as today); N > 0 = written by extractor version
  -- N (src constant RUN_SUMMARY_VERSION, bumped when the extractor, buildRunHighlights, the list_facts
  -- inputs or the badge rules change).
  summary_version INTEGER NOT NULL DEFAULT 0 CHECK (summary_version >= 0),
  -- [{id, rarity}], party best. Rebuilt from the raw with the summary, never copied from Supabase.
  badges TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(badges) AND json_type(badges) = 'array'
    AND length(CAST(badges AS BLOB)) <= 1048576),
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
-- limit; Supabase runs gets no such CHECK, so a larger raw only a hand-crafted request can make is a
-- sync reject (design 3.1). The raw is never copied into an outbox row (the mirror reads it here).
-- The cap is settled at 1.9 MB (design 10.8); today's largest raw is 277 KB.
CREATE TABLE IF NOT EXISTS post_history_course_file (
  service TEXT NOT NULL DEFAULT 'history_course' CHECK (service = 'history_course'),
  post_id TEXT NOT NULL,
  raw TEXT NOT NULL CHECK (length(CAST(raw AS BLOB)) <= 1900000),
  PRIMARY KEY (service, post_id),
  FOREIGN KEY (service, post_id) REFERENCES post_history_course (service, post_id) ON DELETE CASCADE
) STRICT;
