-- Supabase exit step 2 (D1 shadow copy), design 4.5: profile nickname pools, contact inquiries,
-- 짜증나는 퍼즐상자 and 다채로운 철학자들.
-- Generated from docs/supabase-exit/d1-schema/schema.src.sql by gen_schema.py: edit the source
-- and regenerate (check.py fails when they differ). Once applied to a remote database, never
-- change this file; add a new migration section to the source instead.

-- Random-nickname pools per character and locale. The Supabase table has no env column, so every
-- environment's database holds the same rows. Written only by the local admin script.
CREATE TABLE IF NOT EXISTS profile_character_nickname_pools (
  character_id TEXT NOT NULL CHECK (character_id IN ('IRONCLAD', 'SILENT', 'REGENT', 'NECROBINDER', 'DEFECT')),
  locale TEXT NOT NULL CHECK (locale IN ('ko', 'en')),
  -- Display-only array. Per-element rules (1..20 chars, trimmed, unique) are the script's.
  nicknames TEXT NOT NULL CHECK (json_valid(nicknames) AND json_type(nicknames) = 'array'
    AND json_array_length(nicknames) BETWEEN 1 AND 50),
  updated_at TEXT NOT NULL CHECK ((substr(updated_at, 1, 10) GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND substr(updated_at, 11, 9) GLOB 'T[0-9][0-9]:[0-9][0-9]:[0-9][0-9]' AND substr(updated_at, 20) GLOB '.[0-9][0-9][0-9][0-9][0-9][0-9]Z')),
  PRIMARY KEY (character_id, locale)
) STRICT, WITHOUT ROWID;

-- Contact inquiries. user_id and reply_email are private: no browser answer ever selects them.
-- reply_seen_at is client-writable in Supabase (no guard, none added); an odd value follows the
-- crafted-value rule (design 3.1).
-- Not ported: env, viewport_width, viewport_height (write-only).
CREATE TABLE IF NOT EXISTS contact_inquiries (
  id TEXT NOT NULL PRIMARY KEY CHECK ((id GLOB '????????-????-????-????-????????????' AND id NOT GLOB '*[^0-9a-f-]*' AND length(replace(id, '-', '')) = 32)),
  user_id TEXT CHECK ((user_id GLOB '????????-????-????-????-????????????' AND user_id NOT GLOB '*[^0-9a-f-]*' AND length(replace(user_id, '-', '')) = 32)),
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
  created_at TEXT NOT NULL CHECK ((substr(created_at, 1, 10) GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND substr(created_at, 11, 9) GLOB 'T[0-9][0-9]:[0-9][0-9]:[0-9][0-9]' AND substr(created_at, 20) GLOB '.[0-9][0-9][0-9][0-9][0-9][0-9]Z')),
  admin_response TEXT,
  responded_at TEXT CHECK ((substr(responded_at, 1, 10) GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND substr(responded_at, 11, 9) GLOB 'T[0-9][0-9]:[0-9][0-9]:[0-9][0-9]' AND substr(responded_at, 20) GLOB '.[0-9][0-9][0-9][0-9][0-9][0-9]Z')),
  reply_seen_at TEXT CHECK ((substr(reply_seen_at, 1, 10) GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND substr(reply_seen_at, 11, 9) GLOB 'T[0-9][0-9]:[0-9][0-9]:[0-9][0-9]' AND substr(reply_seen_at, 20) GLOB '.[0-9][0-9][0-9][0-9][0-9][0-9]Z')),
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
  user_id TEXT NOT NULL CHECK ((user_id GLOB '????????-????-????-????-????????????' AND user_id NOT GLOB '*[^0-9a-f-]*' AND length(replace(user_id, '-', '')) = 32)),
  attempt INTEGER NOT NULL CHECK (attempt >= 1),
  score INTEGER NOT NULL,
  perfect INTEGER NOT NULL CHECK (perfect IN (0, 1)),
  -- Normalized replay the scorer returned ({guesses, rocks, rocksLeft, shown} or {questions, answers}).
  run TEXT NOT NULL CHECK (json_valid(run) AND json_type(run) = 'object' AND length(CAST(run AS BLOB)) <= 1048576),
  created_at TEXT NOT NULL CHECK ((substr(created_at, 1, 10) GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND substr(created_at, 11, 9) GLOB 'T[0-9][0-9]:[0-9][0-9]:[0-9][0-9]' AND substr(created_at, 20) GLOB '.[0-9][0-9][0-9][0-9][0-9][0-9]Z'))
) STRICT;
-- X1 3-second burst check and 500-per-day cap: this user's runs by time.
CREATE INDEX IF NOT EXISTS puzzlebox_runs_user_created ON puzzlebox_runs (user_id, created_at);

-- One latest player token per user. The Supabase table has no env column, so every database holds
-- every row. Tokens are overwritten on every submitted run.
CREATE TABLE IF NOT EXISTS puzzlebox_players (
  user_id TEXT NOT NULL PRIMARY KEY CHECK ((user_id GLOB '????????-????-????-????-????????????' AND user_id NOT GLOB '*[^0-9a-f-]*' AND length(replace(user_id, '-', '')) = 32)),
  nickname TEXT NOT NULL CHECK (length(nickname) BETWEEN 1 AND 24),
  avatar_id TEXT CHECK (length(avatar_id) BETWEEN 1 AND 40 AND avatar_id NOT GLOB '*[^A-Z0-9_]*'),
  avatar_kind TEXT CHECK (avatar_kind IN ('character', 'boss')),
  palette_id TEXT CHECK (length(palette_id) BETWEEN 1 AND 40 AND palette_id NOT GLOB '*[^-a-z0-9_]*'),
  palette_swapped INTEGER NOT NULL DEFAULT 0
    CHECK (palette_swapped IN (0, 1) AND (palette_swapped = 0 OR palette_id IS NOT NULL)),
  hidden INTEGER NOT NULL DEFAULT 0 CHECK (hidden IN (0, 1)),   -- operator switch: out of every ranking
  updated_at TEXT NOT NULL CHECK ((substr(updated_at, 1, 10) GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND substr(updated_at, 11, 9) GLOB 'T[0-9][0-9]:[0-9][0-9]:[0-9][0-9]' AND substr(updated_at, 20) GLOB '.[0-9][0-9][0-9][0-9][0-9][0-9]Z'))
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
  achieved_at TEXT NOT NULL CHECK ((substr(achieved_at, 1, 10) GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND substr(achieved_at, 11, 9) GLOB 'T[0-9][0-9]:[0-9][0-9]:[0-9][0-9]' AND substr(achieved_at, 20) GLOB '.[0-9][0-9][0-9][0-9][0-9][0-9]Z')),
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
  id TEXT NOT NULL PRIMARY KEY CHECK ((id GLOB '????????-????-????-????-????????????' AND id NOT GLOB '*[^0-9a-f-]*' AND length(replace(id, '-', '')) = 32)),
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
  created_at TEXT NOT NULL CHECK ((substr(created_at, 1, 10) GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND substr(created_at, 11, 9) GLOB 'T[0-9][0-9]:[0-9][0-9]:[0-9][0-9]' AND substr(created_at, 20) GLOB '.[0-9][0-9][0-9][0-9][0-9][0-9]Z')),
  CHECK ((slot = 'topic' AND resource_type <> 'topic') OR resource_type = slot),
  -- One post per slot per week; also the week-ordered access path (F1, F3, F4, F6, F7).
  UNIQUE (week_start, slot)
) STRICT;
-- F5 codex detail thread: this resource's posts, newest week first.
CREATE INDEX IF NOT EXISTS colorful_philosopher_posts_resource
  ON colorful_philosopher_posts (resource_type, resource_id, week_start);
