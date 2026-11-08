> Working notes from the 2026-11-08 D1 schema survey. [D1_SCHEMA_DESIGN.md](../../D1_SCHEMA_DESIGN.md) takes precedence
> where they differ. Paths under `scratchpad/` were temporary and are not kept.

# D1 step 2 design: runs, profile, contact, puzzlebox, colorful philosophers

> Superseded where it differs by `D1_SCHEMA_DESIGN.md` (2026-11-08 review: sections 3.1, 3.4, 5.1-5.5 and "검토 기록").

Domain designer: runs-profile. Inputs: `inventory-runs-profile.md` (cited as INV-R), `inventory-engagement.md`
(INV-E), `inventory-toybox.md` (INV-T), plan 5.5/5.6/7, the 2026-11-05 schema dump. Line references follow the
inventories.

## 0. Decisions taken here, assumptions on shared objects, facts checked

### 0.1 Facts checked offline against the 2026-11-05 data dump (aggregates only, no row data printed)

Read with `pg_restore --data-only -t <table> -f - ~/slseoun-backups/supabase/20261105-2048/public.dump` piped to an
aggregate-only script (`scratchpad/d1/runs-check/agg.py`). This answers INV-R open checks 10.1, 10.2, 10.4 (partly),
10.7 and 10.8 for the dump date:

| check | result (prod / dev) | consequence |
|---|---|---|
| `runs.created_at IS NULL` | 0 / 0 | D1 `posts.created_at NOT NULL` is safe; the NULLS FIRST/LAST difference never shows. Converter fails loudly on a NULL. |
| `runs.start_time IS NULL` | 0 / 0 | picker order equal in both stores today |
| `runs.id` shape | all 687 are 16 chars of `[0-9a-z]` | byte order = any collation order for run ids; keyset on `id` is safe |
| `runs.total_floors = 0` | 1 / 0 | backfill recomputes it |
| `runs.cover_spec IS NULL` | 149 / 0 | backfill fills auto covers |
| `cover_spec.auto` | true 405, false 30 / true 102, false 1 | 30 manual covers must be kept as stored |
| `runs.badges = '[]'` | 227 / 37 | backfill recomputes (`mergePartyBadges`) |
| runs `like_count > 0`, `comment_count > 0` | 0, 0 / 0, 2 | prod counters all 0 |
| `likes`/`comments` rows on `history-course:` | 0 / 4 comments on 2 threads | prod counters agree with rows; no drift today |
| `runs.raw` bytes max | 277,292 | well under the D1 2 MB value limit |
| `created_at` fraction digits (pg_dump text) | 6: 612, 5: 71, 4: 4; all end `+00` | the converter must pad to 6 digits |
| `colorful_philosopher_posts.week_start` weekday | all 28 are Mondays | a Monday CHECK is safe |
| `colorful_philosopher_posts` dead counts non-zero | 2 rows | D1 cannot emit them; comparator ignores them (section 5) |
| `puzzlebox_*` | dump predates production use (2 dev runs, ids 1-2) | production ids are small Supabase identity values |
| `contact_inquiries.user_id IS NULL` | 0 | every row has an owner |

### 0.2 Decisions taken in this design (not reopened elsewhere)

1. **A shared run is a `posts` row with `service = 'history_course'`**, and `runs` is its per-service table
   (decision 2's pattern). Reasons: the run already behaves as a Toy Box post everywhere it is listed (the API
   service id `history_course`, the defragment board, the nav surface, the profile activity, `like_count` /
   `comment_count` and thread key `history-course:<id>`). Putting it in `posts` gives the unfiltered defragment
   board, nav latest and profile one table and one set of indexes instead of a union branch. The run-only data
   (summary, cover, file) stays typed in `runs` / `run_files`. Fallback if the integrator rejects this: section 0.4.
2. **The raw file is `run_files(run_id, raw)`** (decision 4), 1:1 with `runs`, cascaded. No list query touches it.
3. **List summary columns are browser-computed and stored** (decision 4): `characters`, `badges`, `game_mode`,
   `game_elements`, `cover_phrases`, plus the already-stored `seed, build, character, ascension, win, start_time,
   run_time, acts_count, total_floors, cover_spec`. `summary_version` records which extractor wrote them.
   During steps 2-4 Supabase is the source, so these columns are added to Supabase `runs` too (section 3.2) and the
   client sends them with every upload; a backfill script fills existing rows; sync copies them.
4. **`game_elements` stays JSON TEXT**, not a child table: no server query filters or joins runs by element (the
   filter runs in the browser over the 100 listed runs, INV-R 3.8), and a child table costs about 62,500 prod rows,
   150-220k rows written for one first copy (over the 100k/day free write limit) and again on every D1 refill in steps
   2-4. If a server-side element filter is ever wanted, add `run_game_elements` then (schemas only grow).
5. **Counts**: run cards on the History Course index read `threads` (row-true counts, like today's W3). The
   defragment board sorts runs by count on the server, so the runs' `posts.like_count` / `comment_count` stay as
   denormalized columns with the toybox count indexes (decision 3; justification in 2.1). In step 2 both are copied:
   `posts` counts from Supabase `runs` columns, `threads` from row counts (engagement design).
6. **No SQLite triggers in this domain.** Step 2 writes Supabase's derived values as they are; a D1 trigger would
   recompute them on every synced row (double counting, or wiping a synced `reply_seen_at`). Every derived write is an
   explicit statement in the Worker's `batch()` (step 5) or in the admin script.
7. **Puzzlebox run ids**: D1 keeps Supabase's identity values in step 2. From step 5 the Worker assigns random
   integers in [2^40, 2^53) (safe JSON integers, above any Supabase sequence value, collision-free between prod and
   testbed in practice), and the step-5 Supabase migration changes the column to `GENERATED BY DEFAULT` so the mirror
   can insert them (section 3.3).
8. **Puzzlebox derived tables are mirrored as state** in step 5 (best, players, board stats are written only by the
   RPC; Supabase has no trigger that recomputes them, so sending them cannot double count).
9. **Player tag** (`left(md5(user_id), 4)`) is computed in the Worker (`crypto.subtle.digest('MD5')`), not stored.
10. **Contact private columns stay in the same table.** D1 has no browser access; privacy is the Worker's fixed
    column lists (a test asserts no Worker statement selects `reply_email` or `user_id` for a browser answer).
11. **Dead objects dropped** (section 0.5). `runs.badges` is kept because decision 4 gives it a reader.

### 0.3 Shared objects this design depends on (owned by others; integrator to reconcile)

| object | owner | what this design needs from it |
|---|---|---|
| timestamp format | engagement | assumed `YYYY-MM-DDTHH:MM:SS.ffffffZ` (UTC, always 6 fraction digits, `Z`). Written in CHECKs below as the GLOB `TS`. |
| `posts` | toybox | columns `id TEXT PK` (no uuid-only CHECK: run ids are 16-char base36), `service` (CHECK includes `'history_course'`), `user_id TEXT NULL`, `nickname TEXT NOT NULL` (1..20 chars after trim, same as `runs_donor_nickname_len`), `avatar_id`, `avatar_kind`, `palette_id`, `palette_swapped` (nullable or emitted as null for runs), `title`, `created_at TEXT NOT NULL`, `like_count`, `comment_count INTEGER NOT NULL DEFAULT 0`. Indexes: `(service, created_at DESC, id DESC)`, `(service, like_count DESC, created_at DESC, id DESC)`, `(service, comment_count DESC, created_at DESC, id DESC)`, the unfiltered-board trio without `service`, and `(user_id, created_at DESC, id DESC)`. |
| `threads` | engagement | `thread_key TEXT PRIMARY KEY`, `like_count`, `comment_count`. Read for `history-course:<id>` and `colorful-philosophers:<id>`. No FK to posts (deleted runs keep their thread, like today). |
| `comments`, `community_stories`, `comment_likes` | engagement | profile activity needs `comments(user_id, created_at DESC)`, `community_stories(user_id, created_at DESC)` and a per-comment like count (counter column or `comment_likes(comment_id)`). |
| chemical / combo / this-or-that per-service tables | toybox | profile activity reads `content_text`, `content` (chemical, combo) and `reason` (this or that) by post id. |
| change log, sync cron, outbox | engagement | per-table rules in section 3; the sync batch must start with `PRAGMA defer_foreign_keys = ON` (FKs below: `runs -> posts`, `run_files -> runs`, `puzzlebox_best -> puzzlebox_runs, puzzlebox_players`). Env-less Supabase tables fan out to every D1 (3.1). |
| nav latest | engagement | the `history-course` surface is `posts` `service = 'history_course'` latest, like the toybox surfaces. If a `surface_latest` table is chosen instead, run insert and delete batches must update it. |

### 0.4 Fallback if runs do not join `posts`

Move `user_id`, `nickname`, `created_at`, `like_count`, `comment_count` into `runs` (named `donor_user_id`,
`donor_nickname` as today), drop the FK to posts, and add `runs(created_at DESC, id DESC)`,
`runs(like_count DESC, created_at DESC, id DESC)`, `runs(comment_count DESC, created_at DESC, id DESC)`,
`runs(donor_user_id, created_at DESC)`. Every query in section 2 keeps its shape with `posts p` replaced by `runs r`;
the unfiltered defragment board then unions `posts` and `runs` (20 + 20 rows per page).

### 0.5 Not ported (CLEANUP_AUDIT 3.1 and INV-R 9)

- Columns `runs.env`, `highlight_card`, `highlight_relic`, `note_blocks`; `contact_inquiries.env`,
  `viewport_width`, `viewport_height`; `colorful_philosopher_posts.env`, `buff_count`, `nerf_count`, `rework_count`;
  `puzzlebox_runs.env`, `puzzlebox_best.env`, `puzzlebox_board_stats.env`.
- Table `colorful_philosopher_reactions`, its trigger, `apply_colorful_philosopher_reaction_counts` and 4 policies.
- Policy `puzzlebox_runs_read_own` (and the equally reader-less `puzzlebox_best_read_own`,
  `puzzlebox_players_read_own`).
- Indexes `idx_runs_build`, `idx_runs_character`, `idx_runs_env`, and every other Postgres index (re-derived in 2).
- The `runs` branch of `guard_post_server_columns` and of `apply_toybox_thread_engagement_delta`, the runs branch of
  `get_defragment_feed_v2`, `clear_contact_inquiry_reply_seen`, `enforce_contact_inquiry_rate_limit`,
  `profile_nickname_list_is_valid`, the five puzzlebox functions, the two profile RPCs and
  `get_rls_activity_metrics`: replaced per section 4.
- Kept although low value: `puzzlebox_board_stats.rocks_sum`, `speed_sum` (returned in the leaderboard `stats`
  object, so shadow equality needs them; CLEANUP calls them low value, not dead).

## 1. DDL

```sql
-- d1/migrations/0004_runs_profile_puzzlebox.sql (number after the shared 0003 tables)
-- Domain: History Course runs, profile nickname pools, contact inquiries, puzzlebox, colorful philosophers.
-- Conventions (shared, see the engagement design):
--   * One database per environment; no env column anywhere.
--   * Timestamps are TEXT 'YYYY-MM-DDTHH:MM:SS.ffffffZ' (UTC, 6 fractional digits, fixed width), so text
--     order is time order. The CHECK below spells this as a GLOB; written by the Worker, never by DEFAULT
--     except as a safety net ('%f' gives milliseconds, padded with '000').
--   * Booleans are INTEGER 0/1; uuids are lower-case TEXT; JSON is TEXT checked with json_valid().
--   * User ids are Supabase Auth uids (JWT sub, lower-cased) until and after step 4. D1 has no users
--     table, so no user FK is declared (users are never deleted by the app).
-- Depends on: posts (toybox design), threads (engagement design).
-- No triggers: step 2 copies Supabase's derived values as they are; derived writes live in Worker batches.

-- History Course: per-service table of posts rows with service = 'history_course'.
-- posts holds id, owner (user_id = donor), donor nickname (NOT a frozen snapshot: the donor's browser
-- rewrites it to the current profile nickname), created_at, title (= seed or id) and the counters.
CREATE TABLE IF NOT EXISTS runs (
  -- Content-hash run id (src/lib/sts2-run-hash.ts), equal to posts.id. Same rule as isRunId().
  id TEXT PRIMARY KEY
    REFERENCES posts(id) ON DELETE CASCADE
    CHECK (length(id) BETWEEN 1 AND 64 AND id NOT GLOB '*[^-A-Za-z0-9_]*'),
  -- Columns the browser extracted at upload in Supabase already (runs_key_size_check).
  seed TEXT NOT NULL CHECK (length(CAST(seed AS BLOB)) <= 1024),
  build TEXT NOT NULL CHECK (length(CAST(build AS BLOB)) <= 1024),
  "character" TEXT NOT NULL CHECK (length(CAST("character" AS BLOB)) <= 1024),
  ascension INTEGER NOT NULL,
  win INTEGER NOT NULL CHECK (win IN (0, 1)),
  start_time INTEGER,                      -- unix seconds; combo picker sort key
  run_time INTEGER,                        -- seconds
  acts_count INTEGER NOT NULL,             -- detail meta only
  total_floors INTEGER NOT NULL DEFAULT 0,
  -- The cover everyone sees. Server-side: an owner's cover change is visible to every viewer.
  -- auto = true covers are stored too (no re-pick from raw on read any more; the backfill re-picks once).
  cover_spec TEXT CHECK (cover_spec IS NULL OR (
    json_valid(cover_spec) AND json_type(cover_spec) = 'object'
    AND length(CAST(cover_spec AS BLOB)) <= 16384)),
  -- Browser-computed list summary (decision 4). summary_version = 0: not computed yet (old upload,
  -- not yet backfilled); N > 0: written by extractor version N (src constant RUN_SUMMARY_VERSION).
  badges TEXT NOT NULL DEFAULT '[]' CHECK (
    json_valid(badges) AND json_type(badges) = 'array' AND length(CAST(badges AS BLOB)) <= 65536),
  summary_version INTEGER NOT NULL DEFAULT 0 CHECK (summary_version >= 0),
  characters TEXT CHECK (characters IS NULL OR (                 -- party, ["CHARACTER.IRONCLAD", ...]
    json_valid(characters) AND json_type(characters) = 'array'
    AND json_array_length(characters) BETWEEN 1 AND 8 AND length(CAST(characters AS BLOB)) <= 1024)),
  game_mode TEXT CHECK (game_mode IS NULL OR length(game_mode) BETWEEN 1 AND 64),
  -- extractRunGameElements(run): [{type, id}], displayed and filtered in the browser only (decision 4 above).
  game_elements TEXT CHECK (game_elements IS NULL OR (
    json_valid(game_elements) AND json_type(game_elements) = 'array'
    AND length(CAST(game_elements AS BLOB)) <= 262144)),
  -- coverPhrasePool(run, cover_spec.elements): search-only strings; rewritten with every cover change.
  cover_phrases TEXT CHECK (cover_phrases IS NULL OR (
    json_valid(cover_phrases) AND json_type(cover_phrases) = 'array'
    AND length(CAST(cover_phrases AS BLOB)) <= 16384)),
  CHECK (summary_version = 0 OR (
    characters IS NOT NULL AND game_mode IS NOT NULL
    AND game_elements IS NOT NULL AND cover_phrases IS NOT NULL))
);

-- Combo / defragment run picker: latest 30 by start_time (W2).
CREATE INDEX IF NOT EXISTS runs_start_time ON runs (start_time DESC, id DESC);

-- The raw .run file, opaque text (not json_valid-checked: it is the game's file, parsed only by the browser).
-- 1.9 MB cap keeps the row under D1's 2 MB value/row limit; the same cap is added to Supabase (section 3.2).
CREATE TABLE IF NOT EXISTS run_files (
  run_id TEXT PRIMARY KEY REFERENCES runs(id) ON DELETE CASCADE,
  raw TEXT NOT NULL CHECK (length(CAST(raw AS BLOB)) BETWEEN 1 AND 1900000)
);

-- Random-nickname pools per character and locale. Same 10 rows in every environment's database
-- (the Supabase table has no env column). Written only by the local admin script.
CREATE TABLE IF NOT EXISTS profile_character_nickname_pools (
  character_id TEXT NOT NULL CHECK (character_id IN ('IRONCLAD', 'SILENT', 'REGENT', 'NECROBINDER', 'DEFECT')),
  locale TEXT NOT NULL CHECK (locale IN ('ko', 'en')),
  -- Display-only array. Per-element rules (1..20 chars, trimmed, no duplicates) are the script's
  -- (profile_nickname_list_is_valid; src/lib/profile-character-nicknames.ts).
  nicknames TEXT NOT NULL CHECK (
    json_valid(nicknames) AND json_type(nicknames) = 'array' AND json_array_length(nicknames) BETWEEN 1 AND 50),
  updated_at TEXT NOT NULL CHECK (updated_at GLOB
    '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9]:[0-6][0-9].[0-9][0-9][0-9][0-9][0-9][0-9]Z'),
  PRIMARY KEY (character_id, locale)
) WITHOUT ROWID;

-- Contact inquiries. user_id, reply_email are private: no browser answer ever selects them.
-- admin_response / responded_at are the reply the owner reads.
CREATE TABLE IF NOT EXISTS contact_inquiries (
  id TEXT PRIMARY KEY CHECK (length(id) = 36),          -- uuid generated by the Worker or script
  user_id TEXT CHECK (user_id IS NULL OR length(user_id) = 36),
  category TEXT NOT NULL CHECK (category IN ('bug', 'correction', 'feedback', 'report', 'partnership', 'other')),
  -- SQLite length() counts characters like char_length(); trim() strips spaces like btrim().
  message TEXT NOT NULL CHECK (length(message) BETWEEN 10 AND 8000 AND message = trim(message)),
  -- The e-mail regex is the Worker's (contact-rules.ts EMAIL); '@' presence is the cheap part kept here.
  reply_email TEXT CHECK (reply_email IS NULL OR (
    length(reply_email) BETWEEN 3 AND 254 AND reply_email = trim(reply_email) AND instr(reply_email, '@') > 1)),
  page_path TEXT NOT NULL CHECK (
    length(page_path) BETWEEN 1 AND 512 AND substr(page_path, 1, 1) = '/'
    AND instr(page_path, '?') = 0 AND instr(page_path, '#') = 0),
  service_locale TEXT NOT NULL CHECK (service_locale IN ('ko', 'en')),
  game_locale TEXT NOT NULL CHECK (game_locale IN (
    'kor', 'eng', 'zhs', 'jpn', 'deu', 'fra', 'ita', 'spa', 'esp', 'ptb', 'rus', 'pol', 'tha', 'tur')),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'done', 'spam')),
  created_at TEXT NOT NULL CHECK (created_at GLOB
    '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9]:[0-6][0-9].[0-9][0-9][0-9][0-9][0-9][0-9]Z'),
  admin_response TEXT,
  responded_at TEXT CHECK (responded_at IS NULL OR responded_at GLOB
    '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9]:[0-6][0-9].[0-9][0-9][0-9][0-9][0-9][0-9]Z'),
  reply_seen_at TEXT CHECK (reply_seen_at IS NULL OR reply_seen_at GLOB
    '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9]:[0-6][0-9].[0-9][0-9][0-9][0-9][0-9][0-9]Z'),
  CHECK (category <> 'partnership' OR reply_email IS NOT NULL),
  CHECK ((admin_response IS NULL AND responded_at IS NULL) OR (
    admin_response IS NOT NULL AND responded_at IS NOT NULL
    AND length(admin_response) BETWEEN 1 AND 8000 AND admin_response = trim(admin_response)))
);

-- Rate limit (3 per hour), own history, mailbox dot, mark seen: all "this user's rows by time".
CREATE INDEX IF NOT EXISTS contact_inquiries_user_created ON contact_inquiries (user_id, created_at DESC, id DESC);

-- Puzzlebox: every finished run (audit trail and the source of attempts / rate limits).
CREATE TABLE IF NOT EXISTS puzzlebox_runs (
  -- Supabase identity value in steps 2-4; random in [2^40, 2^53) when the Worker writes (step 5).
  id INTEGER PRIMARY KEY,
  game TEXT NOT NULL CHECK (game IN ('connections', 'beta-quiz')),
  board TEXT NOT NULL CHECK (board GLOB '[1-9]' OR board GLOB '[1-9][0-9]' OR board GLOB '[1-9][0-9][0-9]'),
  user_id TEXT NOT NULL CHECK (length(user_id) = 36),
  attempt INTEGER NOT NULL CHECK (attempt >= 1),
  score INTEGER NOT NULL,
  perfect INTEGER NOT NULL CHECK (perfect IN (0, 1)),
  -- Normalised replay the scorer returned ({guesses, rocks, rocksLeft, shown} or {questions, answers}).
  run TEXT NOT NULL CHECK (json_valid(run) AND json_type(run) = 'object' AND length(CAST(run AS BLOB)) <= 65536),
  created_at TEXT NOT NULL CHECK (created_at GLOB
    '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9]:[0-6][0-9].[0-9][0-9][0-9][0-9][0-9][0-9]Z')
);

-- 3-second burst check and 500-per-day cap: this user's runs by time.
CREATE INDEX IF NOT EXISTS puzzlebox_runs_user_created ON puzzlebox_runs (user_id, created_at);

-- One latest player token per user (shared by all envs in Supabase, so every D1 gets every row).
-- Same token columns as the posts author snapshot; tokens are overwritten on every submitted run.
CREATE TABLE IF NOT EXISTS puzzlebox_players (
  user_id TEXT PRIMARY KEY CHECK (length(user_id) = 36),
  nickname TEXT NOT NULL CHECK (length(nickname) BETWEEN 1 AND 24),
  -- The RPC's normalisation rules, as CHECKs (cheap GLOBs; every Supabase row already passed them).
  avatar_id TEXT CHECK (avatar_id IS NULL OR (length(avatar_id) BETWEEN 1 AND 40 AND avatar_id NOT GLOB '*[^A-Z0-9_]*')),
  avatar_kind TEXT CHECK (avatar_kind IS NULL OR avatar_kind IN ('character', 'boss')),
  palette_id TEXT CHECK (palette_id IS NULL OR (length(palette_id) BETWEEN 1 AND 40 AND palette_id NOT GLOB '*[^-a-z0-9_]*')),
  palette_swapped INTEGER NOT NULL DEFAULT 0 CHECK (palette_swapped IN (0, 1) AND (palette_swapped = 0 OR palette_id IS NOT NULL)),
  hidden INTEGER NOT NULL DEFAULT 0 CHECK (hidden IN (0, 1)),   -- operator switch: out of every ranking
  updated_at TEXT NOT NULL CHECK (updated_at GLOB
    '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9]:[0-6][0-9].[0-9][0-9][0-9][0-9][0-9][0-9]Z')
) WITHOUT ROWID;

-- Best run per player and board. A later equal score does not replace it (first to reach ranks higher).
CREATE TABLE IF NOT EXISTS puzzlebox_best (
  game TEXT NOT NULL CHECK (game IN ('connections', 'beta-quiz')),
  board TEXT NOT NULL CHECK (board GLOB '[1-9]' OR board GLOB '[1-9][0-9]' OR board GLOB '[1-9][0-9][0-9]'),
  user_id TEXT NOT NULL REFERENCES puzzlebox_players(user_id),
  score INTEGER NOT NULL,
  perfect INTEGER NOT NULL CHECK (perfect IN (0, 1)),
  run_id INTEGER NOT NULL REFERENCES puzzlebox_runs(id) ON DELETE CASCADE,
  achieved_at TEXT NOT NULL CHECK (achieved_at GLOB
    '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9]:[0-6][0-9].[0-9][0-9][0-9][0-9][0-9][0-9]Z'),
  attempts INTEGER NOT NULL CHECK (attempts >= 1),
  -- Clustered by (game, board): rank counts and leaderboard totals read this key range.
  PRIMARY KEY (game, board, user_id)
) WITHOUT ROWID;

-- My standings: my best rows of one game.
CREATE INDEX IF NOT EXISTS puzzlebox_best_user_game ON puzzlebox_best (user_id, game);

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
  -- Display-only integer arrays (decision 2), updated element-wise by one UPDATE (section 4).
  level_solved TEXT NOT NULL DEFAULT '[0,0,0,0]' CHECK (
    json_valid(level_solved) AND json_type(level_solved) = 'array' AND json_array_length(level_solved) = 4),
  question_wrong TEXT NOT NULL DEFAULT '[]' CHECK (
    json_valid(question_wrong) AND json_type(question_wrong) = 'array' AND json_array_length(question_wrong) <= 30),
  wrong_picks TEXT NOT NULL DEFAULT '[]' CHECK (
    json_valid(wrong_picks) AND json_type(wrong_picks) = 'array' AND json_array_length(wrong_picks) <= 120),
  speed_sum INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (game, board)
) WITHOUT ROWID;

-- 다채로운 철학자들: up to three admin posts per KST week (topic, card, relic; 'power' allowed, unused).
CREATE TABLE IF NOT EXISTS colorful_philosopher_posts (
  id TEXT PRIMARY KEY CHECK (length(id) = 36),
  -- Monday of the KST week, 'YYYY-MM-DD'.
  week_start TEXT NOT NULL CHECK (
    week_start GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]' AND strftime('%w', week_start) = '1'),
  slot TEXT NOT NULL CHECK (slot IN ('topic', 'card', 'relic', 'power')),
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL CHECK (length(resource_id) BETWEEN 1 AND 80),
  name_ko TEXT NOT NULL CHECK (length(name_ko) BETWEEN 1 AND 120),
  name_en TEXT NOT NULL CHECK (length(name_en) BETWEEN 1 AND 120),
  image_url TEXT,
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 500),
  game_version TEXT NOT NULL CHECK (length(game_version) BETWEEN 1 AND 32),
  created_at TEXT NOT NULL CHECK (created_at GLOB
    '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9]:[0-6][0-9].[0-9][0-9][0-9][0-9][0-9][0-9]Z'),
  CHECK ((slot = 'topic' AND resource_type <> 'topic') OR resource_type = slot),
  -- One post per slot per week; also the week-ordered access path (week list, reel, nav weekly).
  UNIQUE (week_start, slot)
);

-- Codex detail thread: this resource's posts, newest week first.
CREATE INDEX IF NOT EXISTS colorful_philosopher_posts_resource
  ON colorful_philosopher_posts (resource_type, resource_id, week_start DESC);
```

Checked in local SQLite 3.51 with stub `posts`/`threads` tables (`scratchpad/d1/runs-check/schema.sql`,
`submit.sql`, `lb.sql`): the DDL loads; every CHECK above rejects a bad value and accepts the real shapes; the
section 2 queries use the named indexes (EXPLAIN QUERY PLAN, no temp sort except the leaderboard aggregate); the
4.3 submit batch reproduces attempt, improved, rank (equal score: earlier first), first-run-only stats and array
growth; the share insert is idempotent and seeds counts from `threads`; deleting a `posts` row cascades to `runs`
and `run_files`. D1's SQLite version should be checked once with `SELECT sqlite_version()`.

Optional, integrator's call: to make a wrong-service `posts` row impossible for a run, add
`service TEXT NOT NULL DEFAULT 'history_course' CHECK (service = 'history_course')` to `runs` with
`FOREIGN KEY (id, service) REFERENCES posts(id, service)`; that needs `UNIQUE (id, service)` on `posts`, one more
index row on every post write. Default here: plain FK plus Worker discipline (every run statement filters
`service = 'history_course'`).

### 1.1 CHECKs and RLS that move to Worker (or admin script) validation

| rule today | where it goes |
|---|---|
| `contact_inquiries_reply_email_check` regex | Worker (`contact-rules.ts` `EMAIL`); D1 keeps length, trim, `@` |
| `enforce_contact_inquiry_rate_limit`: owner = caller, `btrim(message)`, `lower(btrim(reply_email))`, 3/hour | Worker sets `user_id` from the session, normalises, and runs the conditional insert (section 4) |
| `contact_inquiries_insert_owner` (`status = 'new'`), `_select_owner` (column grants), `_update_reply_seen` | Worker: `status` is a literal, browser answers use fixed column lists, the only browser UPDATE sets `reply_seen_at` |
| `profile_nickname_list_is_valid` per element | admin script (and `profile-character-nicknames.ts`) |
| `runs_donor_nickname_len` | `posts.nickname` CHECK (toybox) plus the Worker's nickname rule |
| `runs_meta_size_check` (`pg_column_size`, compressed) | text-byte CHECKs above; Worker caps cover at 16 KB as today |
| `runs_raw_size_check` 8 MiB | 1.9 MB everywhere (D1 CHECK, Supabase CHECK added in step 2, Worker/browser pre-check) |
| `runs_insert/update/delete` RLS, `guard_post_server_columns` | Worker: `user_id` = session, `created_at` = Worker now, counters from `threads` or 0, only `cover_spec`/`cover_phrases`/nickname are updatable, every write filters `user_id` |
| run summary contents (browser-computed, untrusted like `seed`/`win` today) | Worker validates shape and size only: arrays of `{type, id}` with id `^[A-Za-z0-9_.-]{1,80}$`, at most 2,000 entries, `summary_version` = the current constant |
| `submit_puzzlebox_run` input checks (env, board regex, player token regexes) | Worker (board 1..999, token rules); D1 CHECKs back them up |
| `puzzlebox_score_run`, `puzzlebox_run_display` | Worker imports `src/lib/vexing-puzzlebox-score.ts` (removes the SQL/TS duplication) |
| `colorful_philosopher_posts_select`, pools select, `puzzlebox_board_stats_read` | public Worker reads |
| service-key writes (admin page) | local scripts with `wrangler d1 execute --remote` (plan 5.7) |

## 2. Queries and indexes

Notation: `?n` are bound parameters; every IN list is passed as one JSON parameter and expanded with
`json_each(?)` (D1 allows 100 bound parameters per statement; the run list sends 100 ids). "Rows" counts rows touched
per table; D1 may bill an index entry and the table row it leads to separately, so double the figure for a safe bound.

### 2.1 Every index and the queries it serves

| index | serves | why no smaller set |
|---|---|---|
| `runs` PK `id` | run by id (detail, cover, meta, OG, cover update, picker join), join from `posts` | required (FK target, 1:1 join) |
| `runs_start_time (start_time DESC, id DESC)` | R2 picker | without it every picker call scans and sorts all 584 runs to return 30; it costs one index row per run insert (writes are 50x scarcer than reads in the free tier, and inserts are ~4/day) |
| `run_files` PK `run_id` | R3/R4 raw by id | required (1:1) |
| (posts indexes, toybox) | R1, R6-R12 | listed in 0.3; runs reuse them, no runs-only copies |
| pools PK | P1 (whole table, 10 rows), admin upsert | required |
| `contact_inquiries` PK | admin reply by id | required |
| `contact_inquiries_user_created (user_id, created_at DESC, id DESC)` | C1 rate limit, C2 mailbox, C3 history, C4 mark seen | one index covers all four (all are "this user's rows", most-recent first); Postgres's partial unseen-replies index never got a scan and is not needed: a user's rows are few. Admin reads scan 11 rows locally. |
| `puzzlebox_runs` PK `id` | FK target of `puzzlebox_best.run_id`, step-5 "this run" lookups | required |
| `puzzlebox_runs_user_created (user_id, created_at)` | X1 burst (3 s) and daily cap (1 day) | the burst check reads this user's last 3 s (game/board filtered in the row, 0-1 rows), so the 5-column Postgres index (0 scans) is not needed |
| `puzzlebox_players` PK | X1 upsert, joins in X2-X4 | required |
| `puzzlebox_best` PK `(game, board, user_id)` | X1 best upsert, X2 per-board counts, X3 per-game totals (prefix `game`) | rank counts need every row of the board anyway (the `players` count), so a `(game, board, score DESC, achieved_at)` rank index would save nothing |
| `puzzlebox_best_user_game (user_id, game)` | X4 my standings | without it "my rows of a game" scans every best row of the game (players x boards) |
| `puzzlebox_board_stats` PK | X1 stats update, X2 `stats` | required |
| `colorful_philosopher_posts` PK `id` | F2 post by id | required |
| UNIQUE `(week_start, slot)` | F1 week list, F3 reel, F4 nav weekly, admin upsert conflict target | the uniqueness rule is needed anyway; scanned backwards it gives `week_start DESC, slot DESC` |
| `colorful_philosopher_posts_resource (resource_type, resource_id, week_start DESC)` | F5 codex detail thread | runs on codex detail pages (crawler traffic): 0-1 rows instead of a scan of every post (25 now, +3 a week) |

**Decision 3 for runs.** The defragment board sorts History Course posts by `like_count` / `comment_count` with a
keyset (W13, and the unfiltered board). With the counts only in `threads`, a page would read every run's thread row
and sort (about 1,200 rows read per page today, growing with runs); with denormalized `posts` counts and the toybox
`(service, <count> DESC, created_at DESC, id DESC)` indexes a page reads 20. The write side is one extra `posts`
UPDATE (plus two index entries) in the like/comment batch that already updates `threads`. Keep them.

### 2.2 Every query (step 3 read path and step 5 write path; step 2 runs the read ones as shadow reads)

History Course (`p` = `posts`, `r` = `runs`, `f` = `run_files`, `t` = `threads`):

| # | replaces | SQL (abridged) | index | rows |
|---|---|---|---|---|
| R1 | W1/L2 list (100 latest) | `SELECT p.id, r.seed, r.build, r."character", r.characters, r.ascension, r.win, r.start_time, r.run_time, r.acts_count, r.total_floors, r.badges, r.cover_spec, r.game_mode, r.cover_phrases, r.summary_version, p.user_id AS donor_user_id, p.created_at, t.like_count, t.comment_count FROM posts p JOIN runs r ON r.id = p.id LEFT JOIN threads t ON t.thread_key = 'history-course:' \|\| p.id WHERE p.service = 'history_course' ORDER BY p.created_at DESC, p.id DESC LIMIT 100` (`r.game_elements` added or served as a separate view, open question 6.2) | posts `(service, created_at DESC, id DESC)`, runs PK, threads PK | 100 + 100 + <=100 |
| R2 | W2/L3 picker (30 by start time) | `SELECT r.id, r."character", r.characters, r.start_time, r.ascension, r.win, r.total_floors, r.run_time, r.build, r.seed, r.cover_spec FROM runs r ORDER BY r.start_time DESC, r.id DESC LIMIT 30` (plus `p.user_id, p.created_at` via PK join when the answer needs them) | `runs_start_time` | 30 (+30) |
| R3 | W4/L1 detail | `SELECT p.id, f.raw, r.seed, r.build, r."character", r.ascension, r.win, r.start_time, r.run_time, r.acts_count, r.cover_spec, p.created_at FROM posts p JOIN runs r ON r.id = p.id JOIN run_files f ON f.run_id = p.id WHERE p.id = ?1 AND p.service = 'history_course'` | three PKs | 3 |
| R4 | W5/L9 cover | `SELECT r.id, f.raw, r.cover_spec FROM runs r JOIN run_files f ON f.run_id = r.id WHERE r.id = ?1` (step 3 can drop `raw`: the cover is stored) | PKs | 2 |
| R5 | W6/L8/L10/D1 meta, OG, "is it shared" | `SELECT id, "character", cover_spec FROM runs WHERE id = ?1` | runs PK | 1 |
| R6 | W3/L6 engagement for <=100 runs | `SELECT thread_key, like_count, comment_count FROM threads WHERE thread_key IN (SELECT 'history-course:' \|\| value FROM json_each(?1))` (folded into R1 in step 3) | threads PK | <=100 |
| R7 | W7/L11/L12 own run ids | `SELECT id FROM posts WHERE user_id = ?1 AND service = 'history_course' [AND id = ?2]` | posts `(user_id, created_at DESC, id DESC)` | my posts (all services; few) |
| R8 | W13/L15 defragment, History Course filter | latest: `SELECT p.id, p.created_at, p.like_count, p.comment_count, r.seed, p.user_id AS donor_user_id, p.nickname AS donor_nickname, r.cover_spec, r.win, r.ascension, r.total_floors FROM posts p JOIN runs r ON r.id = p.id WHERE p.service = 'history_course' AND (p.created_at, p.id) < (?1, ?2) ORDER BY p.created_at DESC, p.id DESC LIMIT 20`; comments/recommended: same with `(p.<count>, p.created_at, p.id) < (?0, ?1, ?2)` and `ORDER BY p.<count> DESC, p.created_at DESC, p.id DESC` | posts service-count indexes, runs PK | 20 + 20 |
| R9 | W15 unfiltered board, runs part | one `posts` keyset scan over all services (toybox design); for `service = 'history_course'` rows, `history_meta` = `{cover_spec, win, ascension, total_floors}` from a runs PK join, title = `posts.title`, author token fields emitted as `null` | posts unfiltered indexes, runs PK | 20 + runs among them |
| R10 | W14 nav latest | `SELECT created_at FROM posts WHERE service = 'history_course' ORDER BY created_at DESC LIMIT 1` | posts `(service, created_at DESC, id DESC)` | 1 |
| R11 | W10/L7 cover save (step 5) | `UPDATE runs SET cover_spec = ?3, cover_phrases = ?4 WHERE id = ?1 AND EXISTS (SELECT 1 FROM posts WHERE id = ?1 AND service = 'history_course' AND user_id = ?2) RETURNING id` | runs PK, posts PK | 2 read, 1 written |
| R12 | W11/L13 donor nickname sync (step 5) | `UPDATE posts SET nickname = ?2 WHERE user_id = ?1 AND service = 'history_course' AND nickname <> ?2` | posts `(user_id, ...)` | my posts; writes only changed rows |
| R13 | W12/L14 unshare (step 5) | `DELETE FROM posts WHERE id = ?1 AND service = 'history_course' AND user_id = ?2 RETURNING id` (cascade to `runs`, `run_files`; `threads` stays like today) | posts PK | 3 rows deleted (+ index entries) |
| R14 | W8/W9/L4/L5 share one / many (step 5) | client splits uploads into <= 20 runs and <= 8 MB per request; summary rows travel as one JSON parameter `?4`, each raw as its own parameter. (a) `INSERT INTO posts (id, service, user_id, nickname, created_at, title, like_count, comment_count) SELECT json_extract(e.value, '$.id'), 'history_course', ?1, ?2, ?3, substr(trim(coalesce(nullif(json_extract(e.value, '$.seed'), ''), json_extract(e.value, '$.id'))), 1, 120), coalesce(t.like_count, 0), coalesce(t.comment_count, 0) FROM json_each(?4) e LEFT JOIN threads t ON t.thread_key = 'history-course:' \|\| json_extract(e.value, '$.id') WHERE true ON CONFLICT(id) DO NOTHING RETURNING id` (counts seeded from `threads`, so a re-share no longer restarts at 0); (b) `INSERT INTO runs (id, seed, ..., cover_phrases, summary_version) SELECT json_extract(e.value, '$.id'), ... FROM json_each(?4) e WHERE true ON CONFLICT(id) DO NOTHING`; (c) per run `INSERT INTO run_files (run_id, raw) VALUES (?1, ?2) ON CONFLICT(run_id) DO NOTHING`. Content-hash ids make the three tables exist together, so per-table DO NOTHING stays consistent. "Already shared" = sent - RETURNING ids, as today | PKs, threads PK | ~3 rows + ~8 index entries written per new run; 2 + n statements per request |
| R15 | profile activity, `history_course` branch | see P2 | | |

Profile:

| # | replaces | SQL (abridged) | index | rows |
|---|---|---|---|---|
| P1 | W1/L1 nickname pools | `SELECT character_id, locale, nicknames FROM profile_character_nickname_pools ORDER BY character_id, locale` | PK | 10 |
| P2 | `get_my_profile_activity` | `WITH own_activity AS (` stories: `SELECT s.id AS activity_id, 'stories' AS category, s.sentence AS content, NULL AS content_blocks, 'community:' \|\| s.id AS target_key, s.created_at, coalesce(t.like_count, 0) AS like_count FROM community_stories s LEFT JOIN threads t ON t.thread_key = 'community:' \|\| s.id WHERE s.user_id = ?1` UNION ALL chemical_x: `posts p JOIN <chemical table> c` -> `c.content_text, c.content, p.id, 0` UNION ALL this_or_that: `<tot table>.reason, NULL, p.id, p.like_count` UNION ALL combo: `content_text, content, p.id, 0` UNION ALL comments: `c.content, c.content_blocks, c.story_id, <comment like count>` UNION ALL history_course: `SELECT p.id, 'history_course', r.seed, NULL, p.id, p.created_at, 0 FROM posts p JOIN runs r ON r.id = p.id WHERE p.user_id = ?1 AND p.service = 'history_course'` `) SELECT *, count(*) OVER () AS total_count FROM own_activity WHERE ?2 = 'all' OR category = ?2 ORDER BY CASE WHEN ?3 = 'likes' THEN like_count END DESC, created_at DESC, activity_id DESC LIMIT min(max(?4, 1), 50) OFFSET max(?5, 0)` (the posts branches are one scan of the user's posts with `service IN ('chemical_x', 'this_or_that', 'combo', 'history_course')`; the 0 like counts reproduce today's RPC exactly) | posts `(user_id, created_at DESC, id DESC)`, `community_stories(user_id, ...)`, `comments(user_id, ...)`, per-service PKs, threads PK | all of the user's activity rows (tens) + per-row PK lookups |
| P3 | `get_my_profile_activity_stats` | same `own_activity` CTE, `SELECT category, count(*) AS post_count, sum(like_count) AS like_count GROUP BY category` (one batch with P2 when both are needed) | same | same |

Contact (`?u` = session user, `?now` = Worker time):

| # | replaces | SQL | index | rows |
|---|---|---|---|---|
| C1 | W1/L1 insert + rate-limit trigger | `INSERT INTO contact_inquiries (id, user_id, category, message, reply_email, page_path, service_locale, game_locale, status, created_at) SELECT ?1, ?u, ?3, ?4, ?5, ?6, ?7, ?8, 'new', ?now WHERE (SELECT count(*) FROM contact_inquiries WHERE user_id = ?u AND created_at > ?hourAgo) < 3`; `meta.changes = 0` -> 429 `rate_limited` | user_created | <= 3 read, 2 written |
| C2 | W2/L3 mailbox dot | `SELECT id FROM contact_inquiries WHERE user_id = ?u AND admin_response IS NOT NULL AND reply_seen_at IS NULL LIMIT 1` | user_created | my rows (few) |
| C3 | W3/L2 history | `SELECT id, category, message, status, admin_response, reply_seen_at, created_at FROM contact_inquiries WHERE user_id = ?u ORDER BY created_at DESC, id DESC LIMIT 50` (Worker adds `env`) | user_created | <= 50 |
| C4 | W4/L4 mark seen | `UPDATE contact_inquiries SET reply_seen_at = ?now WHERE user_id = ?u AND admin_response IS NOT NULL AND reply_seen_at IS NULL` | user_created | my rows |
| C5 | D1-D3 admin inbox, reply, new count (local script) | `SELECT ... ORDER BY created_at DESC LIMIT 100`; `UPDATE contact_inquiries SET admin_response = ?2, responded_at = ?3, status = ?4, reply_seen_at = CASE WHEN admin_response IS ?2 AND responded_at IS ?3 THEN reply_seen_at END WHERE id = ?1` (the reply-seen reset of `clear_contact_inquiry_reply_seen`); `SELECT count(*) WHERE status = 'new'` | PK / full scan | 11 |

Puzzlebox (`?g` game, `?b` board, `?u` user, `?boards` = `{"1": 4, ...}` JSON object of board -> max score):

| # | replaces | SQL | index | rows |
|---|---|---|---|---|
| X1 | `submit_puzzlebox_run` (step 5) | one batch, section 4.3 | runs user_created, PKs | read: burst 0-1 + daily count <= 500 (a normal player: tens) + best 1 + stats 1 + rank 2 x players on the board; written about 6-8 |
| X2 | `get_puzzlebox_leaderboard` | section 4.3 (CTE with `json_each(?boards)`, `row_number() OVER (ORDER BY score DESC, achieved_at, user_id)`), `stats` = `SELECT * FROM puzzlebox_board_stats WHERE game = ?g AND board = ?b` in the same batch | best PK prefix `game` (or `game, board`), players PK, stats PK | every best row of the game on the valid boards + one player lookup each (21 + 21 now; players x boards later) + 1 |
| X3 | (same, total tab) | as X2 without `?b` | same | same |
| X4 | `get_my_puzzlebox_standings` | `mine` from `puzzlebox_best WHERE user_id = ?u AND game = ?g` joined to `json_each(?boards)`, then per mine row two counts over `puzzlebox_best WHERE game = ?g AND board = m.board AND score <= max` joined to non-hidden players | best_user_game, best PK, players PK | my boards + for each, the players on that board (x2 for the join) |

Colorful philosophers:

| # | replaces | SQL | index | rows |
|---|---|---|---|---|
| F1 | W15/L17 week list | `SELECT id, week_start, slot, resource_type, resource_id, name_ko, name_en, image_url, body, game_version FROM colorful_philosopher_posts ORDER BY week_start DESC, slot DESC LIMIT 100` + reply counts `SELECT thread_key, comment_count FROM threads WHERE thread_key IN (SELECT 'colorful-philosophers:' \|\| value FROM json_each(?1))` | UNIQUE (backwards), threads PK | <= 100 (25 now) + <= 100 |
| F2 | W16/L18 one post | `... WHERE id = ?1` | PK | 1 |
| F3 | W17/L20/B1/D5 reel | `... WHERE week_start <= ?1 ORDER BY week_start DESC, slot DESC LIMIT 12` | UNIQUE | 12 |
| F4 | W18/L22 nav weekly | `SELECT week_start FROM colorful_philosopher_posts WHERE week_start <= ?1 ORDER BY week_start DESC LIMIT 1` | UNIQUE | 1 |
| F5 | W19/L21 codex detail | `... WHERE resource_type = ?1 AND resource_id = ?2 ORDER BY week_start DESC LIMIT 20` | `_resource` | matches (0-3) |
| F6 | D6 next week open (dev nav) | `SELECT slot FROM colorful_philosopher_posts WHERE week_start = ?1` | UNIQUE | <= 3 |
| F7 | D7 admin upsert (local script) | `INSERT INTO colorful_philosopher_posts (id, week_start, slot, ...) VALUES (...) ON CONFLICT(week_start, slot) DO UPDATE SET resource_type = excluded.resource_type, ... RETURNING id, week_start, slot, ...` (keeps `id` and `created_at` on conflict, like today) | UNIQUE | 1 |

Daily sense check for this domain (production rates from INV-R): list ~14/day x 300, nav weekly folded into the nav
snapshot, codex thread F5 at crawler rates x 1, profile ~5/day x tens, leaderboards and contact tiny: well under 100k
rows read per day, against today's 7.9 MB per list read from Supabase.

## 3. Mapping

### 3.1 Supabase -> D1 (first copy from the dump, then the step-2 change-log sync)

General rules (shared with the engagement design): rows with `env = 'production'` go to `slseoun-prod`,
`env = 'development'` to `slseoun-testbed`; **tables without env (`profile_character_nickname_pools`,
`puzzlebox_players`) go to every database**, so the sync for those reads change-log entries whose env is null in every
environment's Worker. `timestamptz` -> canonical text (pad the fraction to 6 digits, `+00`/`+00:00` -> `Z`, space ->
`T`; reject other offsets in the converter rather than guess); `date` stays `YYYY-MM-DD`; booleans -> 0/1; `jsonb` ->
its JSON text (keep the Postgres text: same key order); `text[]` / `integer[]` -> JSON arrays. Upserts are by primary
key, so the first copy and the sync are idempotent; deletes are by primary key. Counters and other derived values are
copied as Supabase holds them (plan 7.3, step 2).

| Supabase table | D1 rows | notes |
|---|---|---|
| `runs` (id, env) | `posts` (id, `service = 'history_course'`, `user_id = donor_user_id`, `nickname = donor_nickname`, avatar/palette fields null, `created_at`, `title = left(btrim(coalesce(nullif(seed, ''), id)), 120)`, `like_count`, `comment_count` as is) + `runs` (seed, build, character, ascension, win, start_time, run_time, acts_count, total_floors, cover_spec, badges, and the new summary columns from 3.2; `summary_version = 0` while Supabase has none) + `run_files` (raw verbatim) | Change log for `runs` records the row **without raw** (`to_jsonb(new) - 'raw'`) plus `raw_changed boolean`; the sync fetches raw only on INSERT or `raw_changed` (one row per request; 277 KB max). Delete -> `DELETE FROM posts WHERE id = ? AND service = 'history_course'` (cascades). `highlight_*`, `note_blocks`, `env` dropped. Counter-trigger updates on Supabase arrive as ordinary `runs` UPDATE entries and update `posts` counts. Read-after-write in step 2-3: after a Worker upload the Worker re-reads the inserted ids from Supabase **without raw** and upserts `posts` + `runs` at once; `run_files` follows with the 1-minute sync, and the D1 detail adapter falls back to Supabase while a run has no `run_files` row. |
| `likes` / `comments` on `history-course:<id>`, `colorful-philosophers:<id>` | `threads` rows (engagement design) | counts that have no Supabase column: computed from rows at first copy and kept by the sync (recounting the touched key is drift-proof). Runs' `posts` counts and the `threads` counts are allowed to differ in step 2 because Supabase's do (re-share undercount); both are compared to their own Supabase source. |
| `profile_character_nickname_pools` | same row in every D1 | `nicknames` text[] -> JSON array, order kept |
| `contact_inquiries` | same row, minus `env`, `viewport_*` | all columns including the private ones |
| `puzzlebox_runs` | same row, same `id`, minus `env` | inserts only (no app updates or deletes) |
| `puzzlebox_best` (env, game, board, user_id) | same row minus env | copied as is (derived by the RPC) |
| `puzzlebox_players` | same row in every D1 | a testbed run overwrites the shared Supabase row, and both D1s get the new token: that is today's behaviour |
| `puzzlebox_board_stats` | same row minus env | arrays -> JSON |
| `colorful_philosopher_posts` | same row minus env and the three dead counts | |

First-copy order with FKs on: `posts` (runs part, after the toybox part) -> `runs` -> `run_files`;
`puzzlebox_players` -> `puzzlebox_runs` -> `puzzlebox_best`. Or one batch per table group with
`PRAGMA defer_foreign_keys = ON`. Rows written for the prod first copy of this domain: runs about 584 x (posts 1 + ~6
index entries + runs 2 + run_files 1) ~ 6k, everything else < 200. Converter preconditions (fail loudly):
`runs.created_at` not null, every timestamp `+00`, `octet_length(raw) <= 1900000`, every run id matches `isRunId`, and
the uuid/run-id union of all `posts` sources has no duplicate id.

### 3.2 Supabase additions in the step-2 migration (schema grows; needed by decision 4 while Supabase is the source)

- `runs.characters jsonb`, `runs.game_elements jsonb`, `runs.game_mode text`, `runs.cover_phrases jsonb`,
  `runs.summary_version integer NOT NULL DEFAULT 0` (all nullable otherwise). The browser upload payload adds them
  (`run-donation.ts` already parses the run there); the cover save PATCH adds `cover_phrases`. Release order:
  migration first, then the client (PostgREST rejects unknown columns).
- `runs_raw_d1_size_check CHECK (octet_length(raw) <= 1900000)` (all rows are <= 277 KB, so it validates at once).
- One-off backfill script (local, service key): for every row with `summary_version < RUN_SUMMARY_VERSION`, parse
  `raw` with the project code and write `characters`, `badges` (`mergePartyBadges`), `game_elements`, `game_mode`,
  `total_floors`, `cover_phrases`, and for covers with `auto IS DISTINCT FROM false` (or null) the re-picked
  `pickAlternatingCover(id, run)`; manual covers (`auto = false`, 31 rows) are kept. The sync carries the result to D1.
  The same script runs again whenever `RUN_SUMMARY_VERSION` changes (cover algorithm or extractor change) and from the
  daily job for rows an old tab uploaded without a summary.

### 3.3 D1 -> Supabase (step-5 outbox mirror; source rows; `env` = the Worker's `API_DATA_ENV`)

| D1 write | outbox row -> Supabase |
|---|---|
| R14 share | upsert `runs` (id, env, raw, seed, build, character, ascension, win, start_time, run_time, acts_count, total_floors, donor_user_id, donor_nickname, created_at (D1's), cover_spec, badges, summary columns; `like_count`/`comment_count` = D1's initial values, consistent with Supabase's own likes/comments rows; dead `highlight_*`, `note_blocks` null) `on_conflict=id,env` ignore duplicates. Service-role writes bypass the guard trigger, so D1's `created_at` is kept. |
| R11 cover | PATCH `runs` `cover_spec`, `cover_phrases` by (id, env) |
| R12 nickname | PATCH `runs` `donor_nickname` by (env, donor_user_id) |
| R13 unshare | DELETE `runs` by (id, env) |
| likes/comments on runs | engagement mirror sends the like/comment rows only; Supabase's counter trigger updates `runs` counts (do not send counts) |
| C1 / C4 / C5 | insert `contact_inquiries` (viewport null; the service-role insert depends on the pre-step-4 migration that adds `WHEN (CURRENT_USER IN (anon, authenticated))` to `contact_inquiries_rate_limit`, D1_SCHEMA_DESIGN 5.5); PATCH `reply_seen_at`; admin reply PATCH (Supabase's `clear_contact_inquiry_reply_seen` resets `reply_seen_at` the same way D1's statement did) |
| X1 submit | insert `puzzlebox_runs` with D1's `id` (needs `ALTER TABLE public.puzzlebox_runs ALTER COLUMN id SET GENERATED BY DEFAULT` in the step-5 migration; PK has no env, random ids keep prod and testbed apart), then upsert the resulting `puzzlebox_players`, `puzzlebox_best` (on env, game, board, user_id) and `puzzlebox_board_stats` (on env, game, board) rows as state. Exception to "source rows only": no Supabase trigger derives these, so state upserts cannot double count, and a rollback to Supabase-as-source needs them. On that rollback, `setval` the sequence is unnecessary (random ids sit above it). |
| F7, pools | the local scripts write D1 and the outbox in one execute; pools are mirrored from both envs to the one Supabase table (idempotent upsert) |

The daily comparison covers derived values (runs counts vs Supabase, puzzlebox state).

## 4. What replaces each trigger, RPC and RLS rule

### 4.1 Table

| today | replacement | why |
|---|---|---|
| `runs_guard_server_columns` (insert: counts 0, `created_at` now; update: freeze id/env/counts/created_at) | Worker R14/R11/R12 statements write only allowed columns; counts seeded from `threads` | plan 5.2: the client cannot write counters or times at all |
| `apply_toybox_thread_engagement_delta`, runs branch | the like/comment batch (engagement design) also runs `UPDATE posts SET like_count = max(0, like_count + ?d) WHERE id = substr(?key, 16) AND service = 'history_course'` for `history-course:` keys (same statement shape as the other services, since runs are posts) | same transaction as the like row; no trigger (0.2 item 6) |
| `get_defragment_feed_v2` runs branch | R8/R9 | one posts index scan |
| `runs_read/insert/update/delete` RLS | public reads; writes filter `user_id = session` and `service = 'history_course'` | |
| `get_my_profile_activity`, `_stats` | P2/P3 SQL in the Worker, `?1` = session user | |
| `get_rls_activity_metrics` | local admin script over `posts`, `comments`, `contact_inquiries` etc. by `created_at` | dev admin only |
| `enforce_contact_inquiry_rate_limit` | C1 (conditional insert; one statement is atomic in SQLite, no advisory lock needed); Worker trims/lower-cases first | |
| `clear_contact_inquiry_reply_seen` | C5's `CASE` in the admin script's UPDATE | a D1 trigger would also fire on synced rows |
| contact RLS and column grants | Worker fixed column lists; `status = 'new'` literal | |
| `profile_nickname_list_is_valid` | admin script check | SQLite CHECK cannot iterate JSON |
| `submit_puzzlebox_run` + `puzzlebox_score_run` + `puzzlebox_run_display` | 4.3 batch; scoring in TS | |
| `get_puzzlebox_leaderboard`, `get_my_puzzlebox_standings` | 4.3 SQL; tag by Worker MD5 | |
| puzzlebox policies | public / me Worker endpoints | |
| `colorful_philosopher_posts` select policy, admin writes | public reads F1-F6; F7 local script | |
| `apply_colorful_philosopher_reaction_counts` | dropped (dead) | |

### 4.2 Identity

User columns hold the Supabase Auth uid as lower-case text (the Worker lowercases `sub`). Step 4 keeps the same uid
through the claim, and Worker-made ids (Supabase Auth outage) are uuids too, so the `length = 36` CHECKs hold. No FK to
a users table: `ON DELETE CASCADE` / `SET NULL` never fired from the app, and adding an FK to an existing SQLite table
later needs a table rebuild, which the grow-only rule forbids until step 7.

### 4.3 Puzzlebox in SQL

Submit (step 5). The Worker validates input, scores the run with `vexing-puzzlebox-score.ts`, normalises the player
token, picks `?id` = random integer in [2^40, 2^53), `?now`, `?t3s` = now - 3 s, `?t1d` = now - 1 day, and sends one
`batch()` (D1 runs a batch as one serialised transaction, which replaces the advisory lock):

```sql
-- 1. Rate rules and the run row. attempt = previous attempts + 1. Inserts nothing when limited.
INSERT INTO puzzlebox_runs (id, game, board, user_id, attempt, score, perfect, run, created_at)
SELECT ?id, ?g, ?b, ?u,
       coalesce((SELECT attempts FROM puzzlebox_best WHERE game = ?g AND board = ?b AND user_id = ?u), 0) + 1,
       ?score, ?perfect, ?run, ?now
WHERE NOT EXISTS (SELECT 1 FROM puzzlebox_runs
                  WHERE user_id = ?u AND created_at > ?t3s AND game = ?g AND board = ?b)
  AND (SELECT count(*) FROM puzzlebox_runs WHERE user_id = ?u AND created_at > ?t1d) < 500;
-- Every later statement is guarded by "the run was inserted": EXISTS (SELECT 1 FROM puzzlebox_runs WHERE id = ?id).
-- 2. Latest player token.
INSERT INTO puzzlebox_players (user_id, nickname, avatar_id, avatar_kind, palette_id, palette_swapped, updated_at)
SELECT ?u, ?nick, ?avatarId, ?avatarKind, ?paletteId, ?swapped, ?now
WHERE EXISTS (SELECT 1 FROM puzzlebox_runs WHERE id = ?id)
ON CONFLICT(user_id) DO UPDATE SET nickname = excluded.nickname, avatar_id = excluded.avatar_id,
  avatar_kind = excluded.avatar_kind, palette_id = excluded.palette_id,
  palette_swapped = excluded.palette_swapped, updated_at = excluded.updated_at;
-- 3. Best: replaced only by a higher score; attempts always advance.
INSERT INTO puzzlebox_best (game, board, user_id, score, perfect, run_id, achieved_at, attempts)
SELECT game, board, user_id, score, perfect, id, created_at, attempt FROM puzzlebox_runs WHERE id = ?id
ON CONFLICT(game, board, user_id) DO UPDATE SET
  attempts = excluded.attempts,
  perfect = CASE WHEN excluded.score > score THEN excluded.perfect ELSE perfect END,
  run_id = CASE WHEN excluded.score > score THEN excluded.run_id ELSE run_id END,
  achieved_at = CASE WHEN excluded.score > score THEN excluded.achieved_at ELSE achieved_at END,
  score = CASE WHEN excluded.score > score THEN excluded.score ELSE score END;
-- 4. Board stats, first finished run of this player only.
INSERT INTO puzzlebox_board_stats (game, board)
SELECT ?g, ?b WHERE EXISTS (SELECT 1 FROM puzzlebox_runs WHERE id = ?id AND attempt = 1)
ON CONFLICT(game, board) DO NOTHING;
UPDATE puzzlebox_board_stats SET
  players = players + 1, cleared = cleared + ?cleared, perfect = perfect + ?perfect,
  score_sum = score_sum + ?score, mistakes_sum = mistakes_sum + ?mistakes, rocks_sum = rocks_sum + ?rocks,
  purple_first = purple_first + ?purpleFirst, speed_sum = speed_sum + ?speed,
  -- ?solved: JSON array of solved level indexes (connections), [] otherwise.
  level_solved = (SELECT json_group_array(v) FROM (
      SELECT CAST(e.value AS INTEGER) + (e.key IN (SELECT value FROM json_each(?solved))) AS v
      FROM json_each(puzzlebox_board_stats.level_solved) e ORDER BY e.key)),
  -- ?slots: constant JSON array of 120 zeros (supplies keys 0..119); ?q: questions (beta-quiz) or 0;
  -- ?wrongQ / ?wrongPick: JSON arrays of 0-based indexes to increment.
  question_wrong = (SELECT json_group_array(v) FROM (
      SELECT coalesce(json_extract(puzzlebox_board_stats.question_wrong, '$[' || s.key || ']'), 0)
             + (SELECT count(*) FROM json_each(?wrongQ) w WHERE w.value = s.key) AS v
      FROM json_each(?slots) s
      WHERE s.key < max(?q, json_array_length(puzzlebox_board_stats.question_wrong)) ORDER BY s.key)),
  wrong_picks = (SELECT json_group_array(v) FROM (
      SELECT coalesce(json_extract(puzzlebox_board_stats.wrong_picks, '$[' || s.key || ']'), 0)
             + (SELECT count(*) FROM json_each(?wrongPick) w WHERE w.value = s.key) AS v
      FROM json_each(?slots) s
      WHERE s.key < max(?q * 4, json_array_length(puzzlebox_board_stats.wrong_picks)) ORDER BY s.key))
WHERE game = ?g AND board = ?b AND EXISTS (SELECT 1 FROM puzzlebox_runs WHERE id = ?id AND attempt = 1);
-- 5. Answer (rank and players over non-hidden players, like the RPC).
SELECT r.attempt, b.score AS best, b.perfect AS best_perfect, (b.run_id = r.id) AS improved,
  1 + (SELECT count(*) FROM puzzlebox_best o JOIN puzzlebox_players p ON p.user_id = o.user_id AND p.hidden = 0
       WHERE o.game = ?g AND o.board = ?b
         AND (o.score > b.score OR (o.score = b.score AND o.achieved_at < b.achieved_at))) AS rank,
  (SELECT count(*) FROM puzzlebox_best o JOIN puzzlebox_players p ON p.user_id = o.user_id AND p.hidden = 0
   WHERE o.game = ?g AND o.board = ?b) AS players
FROM puzzlebox_runs r JOIN puzzlebox_best b ON b.game = r.game AND b.board = r.board AND b.user_id = r.user_id
WHERE r.id = ?id;
```

Statement 1 reporting 0 changes means 429 `rate_limited`. A JSON aggregate's order follows the ordered subquery;
on SQLite >= 3.44 write `json_group_array(v ORDER BY ...)` instead (check `sqlite_version()` on D1), and pin it with a
test either way. Behaviour change accepted from step 5: the 500-a-day cap counts per environment (Supabase counts
across envs).

Leaderboard (X2/X3):

```sql
WITH valid AS (
  SELECT key AS board, CAST(value AS INTEGER) AS max_score FROM json_each(?boards)
  WHERE ?b IS NULL OR key = ?b),
totals AS (
  SELECT b.user_id, sum(b.score) AS score, min(b.perfect) AS perfect, sum(b.perfect) AS perfect_count,
         count(*) AS boards, sum(b.attempts) AS attempts, max(b.achieved_at) AS achieved_at
  FROM puzzlebox_best b
  JOIN valid v ON v.board = b.board AND b.score <= v.max_score
  JOIN puzzlebox_players p ON p.user_id = b.user_id AND p.hidden = 0
  WHERE b.game = ?g GROUP BY b.user_id),
ranked AS (SELECT t.*, row_number() OVER (ORDER BY t.score DESC, t.achieved_at, t.user_id) AS rank FROM totals t),
page AS (SELECT CASE WHEN ?aroundMe = 1 AND EXISTS (SELECT 1 FROM ranked WHERE user_id = ?me)
                     THEN ((SELECT rank FROM ranked WHERE user_id = ?me) - 1) / 10 * 10
                     ELSE max(0, min(?offset, 100000)) END AS start)
SELECT r.*, p.nickname, p.avatar_id, p.avatar_kind, p.palette_id, p.palette_swapped,
       (SELECT count(*) FROM ranked) AS total_players, (SELECT start FROM page) AS start
FROM ranked r JOIN puzzlebox_players p ON p.user_id = r.user_id, page
WHERE (r.rank > page.start AND r.rank <= page.start + 10) OR r.user_id = ?me
ORDER BY r.rank;
```

The Worker builds `{players, offset, rows, me, stats}`, adds `tag` (MD5) and `is_me`, maps 0/1 to booleans.

## 5. Rebuilding the step-1 answers for the step-2 shadow comparison

Field conversions the D1 adapter applies (then most answers are byte-equal to the step-1 JSON):
- **timestamps**: canonical -> PostgREST text: drop trailing zeros of the 6-digit fraction (drop the `.` when all
  zero), replace `Z` with `+00:00`. This is exact for every Supabase-origin value (D1 keeps the microseconds). Inside
  jsonb results (`achieved_at` in the leaderboard) Postgres uses the same text. Cursors sent back by clients are
  normalised to canonical text before binding (string arithmetic, never through `Date`, which drops microseconds).
- **booleans** 0/1 -> `true`/`false`; null stays null.
- **JSON TEXT** is embedded as JSON (not as a string). jsonb key order: Postgres orders keys by length, then bytes;
  stored text from the copy keeps that order, Worker-written text (step 5) does not, so the comparator compares JSON
  values deep and key-order-insensitively.
- **column order** follows the step-1 select list; `env` is added as the constant `API_DATA_ENV` where step 1 returns
  it (contact history).
- **ties**: D1 adds `id DESC` (or `slot DESC`) tie-breakers that Postgres lacks; the comparator compares rows with equal
  sort keys as a set.

| answer | rebuild | comparison |
|---|---|---|
| W1 list, W2 picker, W4 detail, W5 cover (raw-bearing streams) | R1/R2/R3/R4 joined with `run_files` reproduce every field exactly | The Worker cannot afford to build or parse 3-8 MB under 10 ms CPU, so the shadow read runs the **same query without `raw`** against both stores (Supabase `select` minus `raw`) and compares fields; `raw` itself is compared by the daily job (byte equality, or SHA-256 on both sides). The W1 order by `created_at.desc` alone: ties compared as sets. |
| step-3 summary list (new) | R1 | daily job: for every run, parse Supabase `raw` with the project code and compare with D1's summary columns and cover (catches extractor drift and stale `summary_version`) |
| W3 run engagement | R6 | equal counts (threads = row counts) |
| W6 meta | R5 | equal; cover deep-equal |
| W7 own ids | R7 | as a set (no order today) |
| W13 defragment runs | R8 | field-equal; `seed` from runs, `donor_nickname` from posts.nickname |
| W15 unfiltered board, runs rows | R9 | `history_meta` deep-equal; runs' avatar/palette fields must be `null` (not `false`); ties between a uuid post and a run id at the same microsecond may order differently under the Postgres collation (never observed; compare as a set) |
| W14 nav | R10 | equal after the Worker's `toISOString()` |
| profile pools | P1 | rows sorted by (character_id, locale) on both sides |
| profile activity / stats | P2/P3 | field-equal; `like_count` numeric vs integer are the same JSON number; stats compared as a set by category; same-microsecond ties ordered by `activity_id` text may differ under collation (compare ties as sets) |
| contact history W3, mailbox W2 | C3, C2 | equal (`reply_seen_at` written as `toISOString()` reads back as the same instant) |
| leaderboard | X2/X3 | field-equal (`perfect` from min(), `tag` from MD5, `achieved_at` converted); rows ordered by rank; `stats` deep-equal |
| standings | X4 | as a set keyed by `board` (`jsonb_agg` without order today) |
| philosopher week list / post / reel / thread | F1-F5 | ignore `buff_count`, `nerf_count`, `rework_count` (dropped; 2 rows are non-zero); rows within one `week_start` compared as a set (the UI orders by slot itself) |

Fields that cannot be reproduced: the three dead philosopher counts (ignored), the Postgres arbitrary order inside
equal sort keys (compared as sets), and from step 5 only, Worker-written timestamps carry milliseconds (instants still
equal after the mirror).

## 6. Open questions for the user

1. **Supabase migration in step 2 for runs**: add the five summary columns and the 1.9 MB raw CHECK (3.2), and run
   the one-off backfill that re-picks the stored auto covers (405 prod + 102 testbed rows) and fills the 149 prod rows that have none. The covers people see on
   the index do not change (the index already re-picks them on every read), but the stored values do. Approve?
2. **`game_elements` on the step-3 list**: send it with the list (about 410 KB for 100 runs, still far below today's
   7.9 MB) or load it only when the game-element filter opens (list about 60 KB)? The schema supports both. Default
   if not decided: a separate `view=elements` read, so the HTML first-data JSON stays under its 128 KB cap.
3. **`donor_user_id` in public answers**: the list and the defragment board publish the donor's uid to everyone, as
   today. Keep it for step 2-3 equality and replace it with an `is_mine` flag from `/api/me` later, or leave it?
