> Working notes from the 2026-11-08 D1 schema survey. [D1_SCHEMA_DESIGN.md](../../D1_SCHEMA_DESIGN.md) takes precedence
> where they differ. Paths under `scratchpad/` were temporary and are not kept.

# D1 step 2 design: engagement domain and the shared conventions

> Superseded where it differs by `D1_SCHEMA_DESIGN.md` (2026-11-08 review: sections 3.1, 3.4, 5.1-5.5 and "검토 기록").

Domain: `comments`, `comment_likes`, `likes`, `resource_reactions`, `resource_reaction_counts`, `community_stories`
(이야기), the thread-key scheme and every like/comment count, the nav "latest" reads and the courier (배달원), the
existing D1 tables `runtime_flags`, `runtime_flag_events`, `api_cache`, and the sync bookkeeping (Supabase change
log, cursor, step-5 outbox, daily checks, shadow-read stats).

Inputs: `inventory-engagement.md` (cited as **IE §n**), `inventory-toybox.md` (**IT §n**),
`inventory-runs-profile.md` (**IR §n**), plan 5.5/5.6/7, CLEANUP_AUDIT 2/3.1/5, `workers/api/routes/*.ts` at
`b0c5c521`. Nothing here was run against Supabase, Cloudflare or production.

---

## 0. Shared conventions (the toybox and runs/profile designs use these)

### 0.1 One database per env

- `slseoun-prod` holds Supabase `env='production'` rows, `slseoun-testbed` holds `env='development'` rows, local
  `wrangler dev` D1 holds whatever a local seed script loads (never synced, never mirrored). No table has an `env`
  column; no index starts with env (decision 1).
- Rows of Supabase tables that have **no** env column (`comment_likes`, `profile_character_nickname_pools`,
  `puzzlebox_players`) get their env from their parent (`comment_likes` -> its comment) or go to **both** DBs.
- Responses that carry `env` today (`STORY_COLUMNS`, `select *`, `to_jsonb(p.*)`) get `env: API_DATA_ENV` added by the
  D1 adapter, so the JSON shape does not change.

### 0.2 Timestamps: one canonical text form

**Canonical form: `YYYY-MM-DDTHH:MM:SS.ffffffZ`**, always UTC, always exactly 6 fractional digits, always `Z`,
always 27 characters. Every timestamp column (`created_at`, `updated_at`, `achieved_at`, ...) stores this and only
this, enforced by the same cheap CHECK everywhere:

```text
<col> GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9][0-9][0-9][0-9]Z'
```

(A GLOB without `*`/`?` matches only strings of exactly that length.)

Why this form:
- Lossless for every Postgres `timestamptz` (microseconds), so a D1 value converts back to the exact PostgREST string
  and the shadow comparison can be string-equal.
- Fixed width, so SQLite BINARY text order is time order. Variable-width forms break this (`...:12Z` sorts after
  `...:12.5Z`, IE §11, IT §8). `(created_at, id)` keysets and `ORDER BY created_at` work on the text directly, and
  an index on the column is a time index.
- Starts with `YYYY-MM-DDTHH:MM:SS` like `toISOString()`, so the clients' string read-mark comparison
  (`publishedAt > seenAt`, `nav-seen.ts:21-23`) keeps working if a canonical value ever reaches a browser.

Relation to what PostgREST returns today: PostgREST renders `2026-11-05T11:48:12.3456+00:00` (fraction trimmed of
trailing zeros, no fraction on whole seconds, `+00:00`). Three pure functions in an import-free
`src/lib/d1-time.ts`, shared by the Worker, the conversion script, the sync and the checks:

| function | input | output |
|---|---|---|
| `canonicalTs(text)` | any form the Worker accepts today (`toybox-api-rules.ts:39` regex: `T` or space, 0-6 fraction digits, `Z`, `+00`, `+00:00`, `+0900`, any offset) and pg_dump's `2026-11-05 11:48:12.123456+00` | canonical, or `null` when invalid. Pads the fraction to 6 digits; applies the offset with integer arithmetic on the seconds part (never `Date.parse`, which drops microseconds) |
| `postgrestTs(canonical)` | canonical | exactly PostgREST's string: strip trailing zeros of the fraction, drop `.` if nothing is left, `Z` -> `+00:00` |
| `nowTs()` | | `new Date().toISOString()` with `000` inserted before `Z` (ms precision padded to 6 digits) |

Rules:
- **Stored**: canonical. **Emitted by the D1 adapter**: `postgrestTs(...)`, so step-3 responses are byte-identical to
  today's for every timestamp field. The nav snapshot keeps applying its own `isoOrNull` to that string (same code
  path as today, `nav.ts:85-89`).
- **Cursors**: every incoming `created_at` cursor goes through `canonicalTs` before it is bound; invalid -> 400.
  Comparison is then plain text: `(created_at, id) < (?1, ?2)` (SQLite row values), which uses the index.
- **Worker-generated times** (step 4/5 writes): `nowTs()`. Two rows in the same millisecond tie on `created_at`;
  every list orders by `(created_at, id)`, so the order is still total. The step-5 mirror sends the canonical value;
  Postgres stores it exactly; PostgREST then renders `...12.345+00:00`. No round-trip loss.
- **Never** use SQLite `datetime('now')`/`strftime` to produce a stored value (millisecond, other format).
- **NULL**: data timestamps are `NOT NULL` in D1. Supabase allows NULL `created_at` on `comments`, `likes`,
  `comment_likes`, `chemical_posts`, `runs`; nothing in the app writes NULL (default `now()`, guard triggers). The
  first-copy script counts NULLs per table and **stops** if it finds any (they would also sort differently: Postgres
  NULLS FIRST in DESC, SQLite NULLS LAST). The runs and toybox designs may choose a nullable column if their check
  finds real NULL rows; then they own the ordering rule.
- **Dates** (`colorful_philosopher_posts.week_start`): `YYYY-MM-DD` TEXT,
  `GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'`.
- **Bookkeeping times** that never leave D1 and are never compared with Supabase (leases, attempts, sync runs):
  INTEGER Unix milliseconds, like the existing `api_cache`. The existing `runtime_flags.updated_at` /
  `runtime_flag_events.at` stay `toISOString()` text (schemas only grow; nothing sorts them against data).

### 0.3 Ids

- **uuid**: TEXT, lowercase, hyphenated, 36 chars, CHECK
  `id GLOB '[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]'`
  (written `UUID_GLOB` in the prose below; the DDL spells it out). Supabase ids are kept exactly (PostgREST and
  pg_dump print lowercase). New ids in step 5: `crypto.randomUUID()` (lowercase v4). The Worker lowercases every id it
  receives (it already does, `comments.ts:550,585`, `stories.ts:79`). BINARY order of lowercase hex text equals
  Postgres uuid order (IE §11), so `id DESC` tie-breaks match.
- **User ids** (`user_id`, `donor_user_id`): the same uuid TEXT, **no FK**. D1 has no `auth.users`; the 3,808
  anonymous users are never deleted by the app (IR §2.1), so `ON DELETE CASCADE/SET NULL` has never fired. Adding an
  FK later would need a table rebuild, which "schemas only grow" forbids, so user ids stay FK-free for good; if step 4
  adds a `users` table it is referenced by the Worker, not by FKs.
- **Run ids**: TEXT `^[A-Za-z0-9_-]{1,64}$` (runs design). One D1 per env makes `id` alone unique.
- **Integer surrogate keys** only in bookkeeping tables (`outbox.seq`, `runtime_flag_events.id`).
- **Natural keys instead of unused uuids**: `likes.id` and `comment_likes.id` (0 index scans, never read) are not
  ported; the D1 key is the existing unique pair. The step-5 mirror lets Supabase default its `id`.

### 0.4 Other types

- Boolean: `INTEGER` 0/1, `CHECK (<col> IN (0, 1))`; a nullable Postgres boolean stays nullable (`NULL` passes the
  CHECK). The adapter maps 0/1/NULL back to `false`/`true`/`null`.
- JSON: TEXT, `CHECK (json_valid(<col>))`, plus a byte backstop `length(CAST(<col> AS BLOB)) <= N`. D1 stores
  **compact JSON as `JSON.stringify(JSON.parse(pgText))` produces it** (the first copy re-serializes pg_dump's jsonb
  text; the sync receives parsed JSON from PostgREST and stringifies it). jsonb's key order (by key length, then
  bytes) survives that round trip, so D1 text equals what the step-1 Worker produces when it re-serializes a PostgREST
  answer.
- Arrays: per decision 2 (child table when filtered/joined by element, JSON TEXT when only displayed). In this domain
  every array is display-only (`tags`, `linked_entities`, `content_blocks`).
- No `STRICT` tables (the existing migrations do not use them); column affinity plus CHECKs is enough.
- Collation: default BINARY everywhere.

### 0.5 CHECK policy (applies to all three designs)

**A D1 CHECK must accept every row Supabase accepts**, otherwise the first copy or the 1-minute sync rejects a row
that Supabase stored and steps 2-4 diverge. So D1 CHECKs copy the Postgres bounds (lengths, enums, sizes), and the
stricter rules the step-1 Worker already applies to its own writes (regexes, trims, smaller JSON caps) stay Worker
validation. Where Postgres measures compressed jsonb (`pg_column_size`), D1 uses a generous text-byte backstop
(1 MiB, half of D1's ~2 MB row limit) and the first-copy script reports the measured maximum per column.

### 0.6 Author snapshot (decision 5)

Every row that freezes its author today keeps these typed columns, same names, same CHECKs, in this order:

```text
nickname        TEXT NOT NULL CHECK (length(nickname) BETWEEN 1 AND 20)
avatar_id       TEXT
avatar_kind     TEXT                       -- "character" | "boss" | NULL in practice; not checked (Postgres does not)
palette_id      TEXT
palette_swapped INTEGER DEFAULT 0 CHECK (palette_swapped IN (0, 1))   -- nullable, like Postgres
CHECK (coalesce(length(CAST(avatar_id AS BLOB)), 0) + coalesce(length(CAST(avatar_kind AS BLOB)), 0)
       + coalesce(length(CAST(palette_id AS BLOB)), 0) <= 1024)
```

SQLite `length()` on TEXT counts characters like Postgres `char_length`. The Worker keeps its stricter rules (trim,
each field <= 64 chars, `paletteSwapped` boolean or null). Behaviour is unchanged: frozen at insert, refreshed on
edit for the editable toybox services (IT §2.2), `runs.donor_nickname` not frozen (IR §2.1).

### 0.7 Thread keys and the `threads` counter table (decision 3)

- A thread key is the string in `comments.story_id` / `likes.story_id`. Key format as today: case-sensitive,
  `^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$` for Worker writes; D1 CHECK = the Postgres bound (1..1024 bytes).
- `threads(thread_key)` holds, for **every** key that has ever had a like or comment: `like_count` = rows in `likes`
  with that key, `comment_count` = rows in `comments`, `last_comment_at` = their max `created_at`. No FK to any post:
  orphan threads (deleted posts, IE §7) keep their counts and rows, as today.
- `this_or_that_post_likes` is **not** counted in `threads` (exactly like Postgres: the generic like trigger has no
  `this-or-that` branch and `get_engagement_counts` counts only `likes`). Its count belongs to the toybox design.
- Counts are **set from the source rows, never incremented**: every batch that changes `likes`/`comments` for key K
  ends with the recount statements of §4.1 for K (rows read = rows of that thread). This is idempotent under sync
  replays and retries and cannot drift.
- **Owner counters** (decision 3, the sort question): `posts.like_count/comment_count` and
  `runs.like_count/comment_count` stay as denormalized columns, because the toybox feeds and the defragment board
  sort by them with a keyset (IT §4.1, §4.2; IE §8.6). An index `(service, like_count DESC, created_at DESC, id DESC)`
  answers a 20-row page by reading ~20 index entries; a sort through `threads` would read every post of the service
  plus one `threads` probe each, on every page, growing with the table. The cost is one extra `UPDATE` (+2 index
  entries) per like/comment on a post, a few rows a day. From step 5 the owner column is **copied from `threads` in
  the same batch** (`UPDATE posts SET like_count = (SELECT like_count FROM threads WHERE thread_key = ?)`), so the two
  can never differ. In steps 2-4 the owner columns are copies of Supabase's values (plan: "파생 값은 Supabase의 값을
  그대로 복사").
- Owner resolution, one import-free TS function `threadOwner(key)` in `src/lib/engagement-keys.ts`, mirroring
  `apply_toybox_thread_engagement_delta` exactly (schema:253-370):

  | `split_part(key, ':', 1)` | owner row | counts copied | `posts.service` value |
  |---|---|---|---|
  | `c-c-c-combo` | `posts` | like + comment | `combo` |
  | `transfigure` | `posts` | like + comment | `transfigure` |
  | `this-or-that` | `posts` | **comment only** | `this_or_that` |
  | `chemical-x` | `posts` | like + comment | `chemical_x` |
  | `decisions-decisions` | `posts` | like + comment | `decisions_decisions` |
  | `favorite-tournament` | `posts` | like + comment | `favorite_tournament` |
  | `pagestorm` | `posts` | like + comment | `pagestorm` |
  | `history-course` | `runs` (id = segment 2, as text) | like + comment | — |
  | anything else (`sts2-codex`, `sts1-codex`, `sts2-patch`, `neowsletter`, `byrdispatch`, `beta-art`, `community`, `colorful-philosophers`, bare static story ids, `defragment`) | none | — | — |

  Segment 2 is `split_part(key, ':', 2)` (anything after a second `:` is ignored, IE §8.1). For `posts` it must parse
  as a Postgres uuid (hyphenated or 32 hex, any case) and is normalized to lowercase hyphenated; otherwise there is no
  owner (Postgres swallows the cast error). `posts.service` uses the feed/API service ids (IT §1); the toybox design
  is asked to use exactly these values.
- Story threads: a user story's key is `community:<uuid>`, an official story's key is its bare `static_story_id`
  (IE §6.4). Kept as is.

### 0.8 Sync bookkeeping (defined in §1 DDL, mechanics in §3)

`sync_state` (cursor + lease per loop), `sync_rejects` (rows either direction could not apply), `outbox` (step 5),
`sync_checks` (daily comparison results), `shadow_stats` / `shadow_diffs` (step-2 shadow reads). Each design supplies,
per Supabase source table, a **sync mapper** (§3.1) with the same shape; the shared loop does the rest.

### 0.9 Migration files

`d1/migrations/0003_sync_bookkeeping.sql` and `0004_engagement.sql` hold §1 (split at the marked line); the toybox and
runs/profile designs continue at `0005_*`. `0001`/`0002` stay as they are.

---

## 1. SQLite DDL

```sql
-- ===================================================================================
-- 0003_sync_bookkeeping.sql
-- Shared by every domain. Bookkeeping times are INTEGER Unix ms (never compared with
-- Supabase data); data timestamps elsewhere are canonical TEXT (design 0.2).
-- ===================================================================================

-- One row per sync loop. 'supabase_in' = step 2-4 change-log apply (Supabase -> D1),
-- 'outbox_out' = step 5-7 mirror (D1 -> Supabase). A run takes the lease with a
-- conditional upsert (same pattern as api_cache), so overlapping cron runs and the
-- step-5 cutover script never apply concurrently.
CREATE TABLE IF NOT EXISTS sync_state (
  name TEXT PRIMARY KEY CHECK (name IN ('supabase_in', 'outbox_out')),
  -- supabase_in: every change-log id <= low_watermark is applied (design 3.2).
  low_watermark INTEGER NOT NULL DEFAULT 0,
  -- supabase_in: ids above low_watermark that are already applied (JSON array of integers,
  -- at most the last ~5 minutes of changes), so late-committed lower ids are still applied
  -- and nothing is applied twice.
  applied_above TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(applied_above) AND json_type(applied_above) = 'array'),
  lease_until INTEGER NOT NULL DEFAULT 0,
  last_run_at INTEGER NOT NULL DEFAULT 0,
  -- Time of the last run that applied or sent anything.
  last_applied_at INTEGER NOT NULL DEFAULT 0,
  -- supabase_in: largest (apply time - changed_at) seen in the last run, for the "lag < 2 min" gate.
  last_lag_ms INTEGER NOT NULL DEFAULT 0,
  fail_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT NOT NULL DEFAULT ''
) WITHOUT ROWID;

-- A change the loop could not apply (CHECK/FK failure in D1, or a Supabase refusal on
-- the mirror). The loop retries open rejects on each run up to 10 attempts; the daily
-- check lists every open reject and a reject blocks the step gate.
CREATE TABLE IF NOT EXISTS sync_rejects (
  direction TEXT NOT NULL CHECK (direction IN ('in', 'out')),
  ref INTEGER NOT NULL,                  -- change-log id (in) or outbox seq (out)
  table_name TEXT NOT NULL,              -- Supabase table name
  op TEXT NOT NULL,
  payload TEXT NOT NULL CHECK (json_valid(payload)),
  error TEXT NOT NULL,
  first_at INTEGER NOT NULL,
  last_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 1 CHECK (attempts >= 1),
  resolved_at INTEGER,                   -- set when a retry succeeds or an operator closes it
  PRIMARY KEY (direction, ref)
);

-- Step 5: one row per source-row change, written in the same D1 batch as the change.
-- The mirror sends rows in seq order and deletes them once Supabase accepted them, so
-- "outbox is empty" is the health signal. Only source rows go here (never threads,
-- counters, resource_reaction_counts): Supabase triggers recompute derived values.
CREATE TABLE IF NOT EXISTS outbox (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name TEXT NOT NULL,              -- Supabase table name
  op TEXT NOT NULL CHECK (op IN ('insert', 'upsert', 'delete')),
  -- Supabase match columns without env, e.g. {"id": "...", "user_id": "..."}; the mirror adds env.
  match TEXT NOT NULL CHECK (json_valid(match) AND json_type(match) = 'object'),
  -- Columns to send (insert/upsert) without env and without derived columns; NULL for delete.
  row TEXT CHECK (row IS NULL OR (json_valid(row) AND json_type(row) = 'object')),
  created_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at INTEGER NOT NULL DEFAULT 0,
  last_error TEXT NOT NULL DEFAULT ''
);

-- Daily comparison (GitHub Actions job, design 3.5), one row per table per kind per day.
-- 'rows' = source/copied columns of every row; 'derived' = counters recomputed from rows.
CREATE TABLE IF NOT EXISTS sync_checks (
  check_date TEXT NOT NULL CHECK (check_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),  -- UTC date
  table_name TEXT NOT NULL,              -- D1 table name
  kind TEXT NOT NULL CHECK (kind IN ('rows', 'derived')),
  d1_rows INTEGER NOT NULL,
  supabase_rows INTEGER NOT NULL,
  d1_hash TEXT NOT NULL,                 -- sha-256 hex of the canonical row lines
  supabase_hash TEXT NOT NULL,
  diff_count INTEGER NOT NULL,
  -- Up to 20 differing keys with a short reason each; plus known-drift classes (design 3.5).
  diff_sample TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(diff_sample)),
  checked_at INTEGER NOT NULL,
  PRIMARY KEY (check_date, table_name, kind)
);

-- Step 2 shadow reads: counters per day and route, plus one sample per distinct difference.
CREATE TABLE IF NOT EXISTS shadow_stats (
  day TEXT NOT NULL CHECK (day GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  route_id TEXT NOT NULL,                -- ApiRoute.id, e.g. 'read.engagement'
  compared INTEGER NOT NULL DEFAULT 0,
  differed INTEGER NOT NULL DEFAULT 0,
  skipped INTEGER NOT NULL DEFAULT 0,    -- not comparable (a side unavailable, Supabase row cap hit, CPU guard)
  PRIMARY KEY (day, route_id)
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS shadow_diffs (
  day TEXT NOT NULL,
  route_id TEXT NOT NULL,
  diff_hash TEXT NOT NULL,               -- hash of the normalized difference, so repeats collapse into one row
  first_at INTEGER NOT NULL,
  hits INTEGER NOT NULL DEFAULT 1,
  sample TEXT NOT NULL CHECK (json_valid(sample) AND length(CAST(sample AS BLOB)) <= 8192),
  PRIMARY KEY (day, route_id, diff_hash)
);

-- ===================================================================================
-- 0004_engagement.sql
-- Comments, likes, reactions, stories, and the thread counters. No env column (one DB
-- per env). CHECKs copy the Postgres bounds (design 0.5); stricter rules are Worker
-- validation (design 4.4).
-- ===================================================================================

-- Comments on any thread key. Immutable for users (no UPDATE path), like Postgres.
-- Dropped from Postgres: env (decision 1), parent_id + its self FK, meta (CLEANUP 3.1).
CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY CHECK (id GLOB '[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]'),
  -- Thread key (design 0.7). Free string, no FK to any post (orphans are kept, as today).
  story_id TEXT NOT NULL CHECK (length(CAST(story_id AS BLOB)) BETWEEN 1 AND 1024),
  user_id TEXT NOT NULL CHECK (user_id GLOB '[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]'),
  -- Author snapshot (design 0.6).
  nickname TEXT NOT NULL CHECK (length(nickname) BETWEEN 1 AND 20),
  avatar_id TEXT,
  avatar_kind TEXT,
  palette_id TEXT,
  palette_swapped INTEGER DEFAULT 0 CHECK (palette_swapped IN (0, 1)),
  -- Text with card-con/text-con/emote markers. Postgres allows 1 char; the Worker requires trim >= 2.
  content TEXT NOT NULL CHECK (length(content) BETWEEN 1 AND 2000),
  -- Rich block array, display only. Worker cap 128 KiB; this is the row backstop (design 0.5).
  content_blocks TEXT CHECK (content_blocks IS NULL OR (json_valid(content_blocks) AND length(CAST(content_blocks AS BLOB)) <= 1048576)),
  -- Denormalized count of comment_likes rows, set by recount in the same batch (design 4.1).
  like_count INTEGER NOT NULL DEFAULT 0 CHECK (like_count >= 0),
  created_at TEXT NOT NULL CHECK (created_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9][0-9][0-9][0-9]Z'),
  CHECK (coalesce(length(CAST(avatar_id AS BLOB)), 0) + coalesce(length(CAST(avatar_kind AS BLOB)), 0)
         + coalesce(length(CAST(palette_id AS BLOB)), 0) <= 1024)
);

-- Q1 thread read, Q2 comment-like overlay, recounts of comment_count / last_comment_at.
-- Covers (story_id, created_at, id), so Q2 and the recounts never touch the table.
CREATE INDEX IF NOT EXISTS comments_thread ON comments (story_id, created_at, id);
-- Q8 courier: newest comments of the last 14 days.
CREATE INDEX IF NOT EXISTS comments_recent ON comments (created_at, id);
-- Q12 profile activity: my comments by time.
CREATE INDEX IF NOT EXISTS comments_user ON comments (user_id, created_at, id);

-- Who liked which comment. Dropped: id (never read, 0 scans). Key = the old unique pair.
-- Deleting a comment deletes its likes (same as Postgres ON DELETE CASCADE).
CREATE TABLE IF NOT EXISTS comment_likes (
  comment_id TEXT NOT NULL REFERENCES comments (id) ON DELETE CASCADE,
  user_id TEXT NOT NULL CHECK (user_id GLOB '[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]'),
  -- Read only by local admin metrics scripts (plan 5.7).
  created_at TEXT NOT NULL CHECK (created_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9][0-9][0-9][0-9]Z'),
  PRIMARY KEY (comment_id, user_id)
) WITHOUT ROWID;

-- Likes on a thread key. Dropped: id (0 scans), env, reaction_type (always 'thumb_up',
-- CLEANUP 3.1). Key = the old UNIQUE (story_id, user_id, env) without env.
CREATE TABLE IF NOT EXISTS likes (
  story_id TEXT NOT NULL CHECK (length(CAST(story_id AS BLOB)) BETWEEN 1 AND 1024),
  user_id TEXT NOT NULL CHECK (user_id GLOB '[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]'),
  created_at TEXT NOT NULL CHECK (created_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9][0-9][0-9][0-9]Z'),
  PRIMARY KEY (story_id, user_id)
) WITHOUT ROWID;

-- Per-thread counters (decision 3). One row per key that ever had a like or comment;
-- rows are never deleted (zeros stay, like resource_reaction_counts). Set from source
-- rows by recount (design 4.1), never incremented. Not mirrored to Supabase.
CREATE TABLE IF NOT EXISTS threads (
  thread_key TEXT PRIMARY KEY CHECK (length(CAST(thread_key AS BLOB)) BETWEEN 1 AND 1024),
  like_count INTEGER NOT NULL DEFAULT 0 CHECK (like_count >= 0),       -- rows in likes
  comment_count INTEGER NOT NULL DEFAULT 0 CHECK (comment_count >= 0), -- rows in comments
  last_comment_at TEXT CHECK (last_comment_at IS NULL OR last_comment_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9][0-9][0-9][0-9]Z'),
  updated_at INTEGER NOT NULL DEFAULT 0  -- Unix ms of the last recount (bookkeeping)
) WITHOUT ROWID;

-- Buff / nerf / rework per user per resource version. Dropped: env. Key reordered so
-- resource_id leads: every read filters by resource_id (Q5, Q6) and the recount by the
-- full target; writes match the full key.
CREATE TABLE IF NOT EXISTS resource_reactions (
  resource_id TEXT NOT NULL CHECK (length(resource_id) <= 128),
  resource_type TEXT NOT NULL CHECK (length(resource_type) <= 32),
  game_version TEXT NOT NULL CHECK (length(game_version) <= 32),
  user_id TEXT NOT NULL CHECK (user_id GLOB '[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]'),
  kind TEXT NOT NULL CHECK (kind IN ('buff', 'nerf', 'rework')),
  PRIMARY KEY (resource_id, resource_type, game_version, user_id)
) WITHOUT ROWID;

-- Totals per resource version. Steps 2-4: copied from Supabase as is (its trigger keeps
-- them). Step 5+: set by recount in the reaction batch. A row is created on the first
-- reaction and never deleted (all-zero rows stay, as in Postgres). Not mirrored.
CREATE TABLE IF NOT EXISTS resource_reaction_counts (
  resource_id TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  game_version TEXT NOT NULL,
  buff_count INTEGER NOT NULL DEFAULT 0 CHECK (buff_count >= 0),
  nerf_count INTEGER NOT NULL DEFAULT 0 CHECK (nerf_count >= 0),
  rework_count INTEGER NOT NULL DEFAULT 0 CHECK (rework_count >= 0),
  PRIMARY KEY (resource_id, resource_type, game_version)
) WITHOUT ROWID;

-- 이야기. Not folded into posts: it is not a Toy Box service, has no counter columns,
-- no feed sort by count, no nav surface, and its thread key rule differs (design 0.7).
-- Dropped: env, the GIN sentence index and the patch_line index (0 scans).
CREATE TABLE IF NOT EXISTS community_stories (
  id TEXT PRIMARY KEY CHECK (id GLOB '[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]'),
  -- NULL for official (seed) stories.
  user_id TEXT CHECK (user_id IS NULL OR user_id GLOB '[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]'),
  -- Seed id (e.g. sts2-doormaker-removed); non-null makes the row official and its thread
  -- key the bare id. Written only by admin scripts and the sync, never by users.
  static_story_id TEXT UNIQUE CHECK (static_story_id IS NULL OR length(CAST(static_story_id AS BLOB)) <= 1024),
  -- Author snapshot (design 0.6).
  nickname TEXT NOT NULL CHECK (length(nickname) BETWEEN 1 AND 20),
  avatar_id TEXT,
  avatar_kind TEXT,
  palette_id TEXT,
  palette_swapped INTEGER DEFAULT 0 CHECK (palette_swapped IN (0, 1)),
  sentence TEXT NOT NULL CHECK (length(sentence) BETWEEN 2 AND 120),
  game TEXT NOT NULL DEFAULT 'sts2' CHECK (game IN ('sts1', 'sts2')),
  entity_type TEXT CHECK (entity_type IS NULL OR length(CAST(entity_type AS BLOB)) <= 1024),
  entity_id TEXT CHECK (entity_id IS NULL OR length(CAST(entity_id AS BLOB)) <= 1024),
  change_id TEXT CHECK (change_id IS NULL OR length(CAST(change_id AS BLOB)) <= 1024),
  patch_line_id TEXT CHECK (patch_line_id IS NULL OR length(CAST(patch_line_id AS BLOB)) <= 1024),
  -- Patch id; the feed filter of patch pages (Q10b).
  source TEXT CHECK (source IS NULL OR length(CAST(source AS BLOB)) <= 1024),
  -- Display-only arrays (decision 2): JSON TEXT. Worker cap 128 KiB; row backstop 1 MiB.
  tags TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(tags) AND length(CAST(tags AS BLOB)) <= 1048576),
  linked_entities TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(linked_entities) AND length(CAST(linked_entities AS BLOB)) <= 1048576),
  created_at TEXT NOT NULL CHECK (created_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9][0-9][0-9][0-9]Z'),
  CHECK (coalesce(length(CAST(avatar_id AS BLOB)), 0) + coalesce(length(CAST(avatar_kind AS BLOB)), 0)
         + coalesce(length(CAST(palette_id AS BLOB)), 0) <= 1024)
);

-- Q10 story feed, newest first.
CREATE INDEX IF NOT EXISTS community_stories_recent ON community_stories (created_at, id);
-- Q10b story feed of one patch (patch detail pages).
CREATE INDEX IF NOT EXISTS community_stories_source ON community_stories (source, created_at, id);
-- Q12 profile activity: my stories by time (official rows have NULL user_id and are skipped).
CREATE INDEX IF NOT EXISTS community_stories_user ON community_stories (user_id, created_at, id) WHERE user_id IS NOT NULL;

-- Existing tables runtime_flags, runtime_flag_events (0001) and api_cache (0002) are
-- unchanged. New runtime_flags keys (rows, not DDL): see design 4.5.
```

Not created: `surface_latest` (see §2.3), any SQLite trigger (see §4.2).

---

## 2. Indexes and queries

Row estimates use today's sizes (both envs together, so production is a bit smaller): `comments` 385, `likes` 301,
`comment_likes` 58, `threads` ~372 (272 in production), `resource_reactions` 76, `resource_reaction_counts` 25,
`community_stories` 26. "Rows read" counts index entries plus table rows visited; a lookup through a secondary index
into a rowid table is about 2 per hit. Lists of keys are bound as one JSON array (`IN (SELECT value FROM
json_each(?1))`), which keeps every statement far below D1's 100 bound parameters (the run list sends 100 keys) and
still drives one PK/index seek per value.

### 2.1 Every query the Worker runs in this domain

| # | serves (today's route / caller) | D1 SQL (shape) | index | expected rows read |
|---|---|---|---|---|
| Q1 | thread read, `read.engagement?threads=` (≤64 keys; codex, neowsletter, toybox detail, patch pages, philosopher replies) | `SELECT id, story_id, user_id, nickname, content, content_blocks, created_at, avatar_id, avatar_kind, palette_id, palette_swapped, like_count FROM comments WHERE story_id IN (…) ORDER BY story_id, created_at, id LIMIT 1000` | `comments_thread` | 2 × comments in those threads (~1.4 per thread on average today; a busy codex page with 64 keys ≈ 100) |
| Q2 | my liked comments, `me.engagement?threads=` | `SELECT c.story_id, c.id FROM comments c WHERE c.story_id IN (…) AND EXISTS (SELECT 1 FROM comment_likes l WHERE l.comment_id = c.id AND l.user_id = ?2)` | `comments_thread` (covering) + `comment_likes` PK probe | comments in those threads + one probe each (≈ Q1/2 + same) |
| Q3 | like count of ≤16 keys, `read.engagement?likes=`; also run counts (`read.history-runs.engagement`, ≤100) and philosopher reply counts (≤100) | `SELECT thread_key, like_count, comment_count FROM threads WHERE thread_key IN (…)` | `threads` PK | ≤ number of keys |
| Q4 | my likes among ≤16 keys, `me.engagement?likes=` | `SELECT story_id FROM likes WHERE story_id IN (…) AND user_id = ?2` | `likes` PK (story_id, user_id) | ≤ 16 probes |
| Q5 | reaction totals, `read.engagement?reactions=` (+ philosopher resource ids), after a reaction write | `SELECT resource_type, resource_id, game_version, buff_count, nerf_count, rework_count FROM resource_reaction_counts WHERE resource_id IN (…)` | `resource_reaction_counts` PK prefix | versions of those ids (1-3 each) |
| Q6 | my reactions, `me.engagement?reactions=` | `SELECT resource_type, resource_id, game_version, kind FROM resource_reactions WHERE resource_id IN (…) AND user_id = ?2` | `resource_reactions` PK prefix | every reaction on those ids, all users (≤ 76 today) |
| Q7 | engagement map, `read.engagement-counts` (story feed, card library, monster tiles, beta art) | `SELECT thread_key, like_count, comment_count FROM threads WHERE like_count > 0 OR comment_count > 0` | none (full read of `threads`) | all threads, ~272 in production (today's RPC reads every like and comment row, ~686, and aggregates) |
| Q7s | step 3, optional scope (§4.3): codex / beta art / stories | `… WHERE thread_key >= 'sts2-codex:' AND thread_key < 'sts2-codex;'`; stories: `community:` range `UNION ALL` `IN (static ids)` | `threads` PK range | threads of that scope only |
| Q8 | courier (nav snapshot refresh) | `SELECT id, story_id, content, created_at FROM comments WHERE created_at >= ?1 ORDER BY created_at DESC, id DESC LIMIT 12` | `comments_recent` (backward scan) | ≤ 24 |
| Q9 | nav latest per surface (nav snapshot refresh) | `SELECT created_at FROM posts WHERE service = ?1 ORDER BY created_at DESC LIMIT 1` × 7; `SELECT created_at FROM runs ORDER BY created_at DESC LIMIT 1`; weekly: `SELECT week_start FROM colorful_philosopher_posts WHERE week_start <= ?1 ORDER BY week_start DESC LIMIT 1` | toybox design's `(service, created_at, id)` on `posts`, runs design's `(created_at, id)` on `runs`, runs/profile design's `UNIQUE (week_start, slot)` | 2 each, 18 in all |
| Q10 | story feed, `read.stories?limit=100\|200\|1000` | `SELECT <19 story columns> FROM community_stories ORDER BY created_at DESC, id DESC LIMIT ?1` | `community_stories_recent` | 2 × min(limit, rows) = 52 today |
| Q10b | story feed of a patch, `read.stories?source=` | `… WHERE source = ?2 ORDER BY created_at DESC, id DESC LIMIT ?1` | `community_stories_source` | 2 × stories of that patch |
| Q11 | one story's like/comment count for the profile list | `SELECT like_count FROM threads WHERE thread_key = 'community:' \|\| ?1` | `threads` PK | 1 |
| Q12 | profile activity / stats, comments and stories parts (profile design composes the union; offset paging) | `SELECT id, content, content_blocks, story_id, created_at, like_count FROM comments WHERE user_id = ?1 ORDER BY created_at DESC, id DESC LIMIT ?2` (`?2` = offset + 20); stories the same over `community_stories` + Q11 per row; stats: `SELECT count(*), sum(like_count) FROM comments WHERE user_id = ?1` | `comments_user`, `community_stories_user` | 2 × (offset + 20) per source, capped by the user's own rows (a few) |
| Q13 | thread recounts (every like/comment write, every sync apply) | §4.1 | `likes` PK prefix, `comments_thread` (covering, `max(created_at)` is one seek) | rows of that thread + 1 |
| Q14 | comment-like recount | `UPDATE comments SET like_count = (SELECT count(*) FROM comment_likes WHERE comment_id = ?1) WHERE id = ?1 RETURNING like_count` | `comment_likes` PK prefix, `comments` PK | likes on that comment + 2 |
| Q15 | reaction totals recount (step 5) | §4.1 | `resource_reactions` PK prefix | reactions on that target + 1 |
| Q16 | writes: comment insert / delete-by-owner, like and comment-like put/delete, reaction put/delete, story insert / delete-by-owner | `INSERT … ON CONFLICT DO NOTHING`, `DELETE … WHERE id = ? AND user_id = ? RETURNING …`, upserts | PKs | 1-2 each |
| Q17 | sync, outbox, shadow bookkeeping | `sync_state` by name; `SELECT … FROM outbox ORDER BY seq LIMIT 50`; `DELETE FROM outbox WHERE seq <= ?`; `shadow_stats` upsert | PKs (outbox rowid order) | 1 / ≤ 50 / 1 |

Not served by the Worker (no index on purpose): dev admin lists and `get_rls_activity_metrics` (plan 5.7 moves them to
local `wrangler d1 execute` scripts; full scans of a few hundred rows), legacy-only queries (`select *`, Q-CL4,
Q-R2) which stay on Supabase until step 6, `get_story_reaction_counts` (dead).

### 2.2 Why each index, and why no smaller set

| index | queries | why it is needed / why nothing smaller works |
|---|---|---|
| `comments` PK (`id`, autoindex) | Q14, Q16 delete-by-owner, `comment_likes` FK target | Required for the FK and for id lookups. |
| `comments_thread (story_id, created_at, id)` | Q1, Q2, Q13 | The only per-thread access path. `created_at, id` give the thread order without a sort and make Q2/Q13 index-only (`id` and `max(created_at)` are read from the index). A plain `(story_id)` index would need a sort and table reads for Q2/Q13. |
| `comments_recent (created_at, id)` | Q8 | The courier is the most expensive app query today because no such index exists (IE §1.6, 861 s total). Without it Q8 reads every comment each refresh (~1,440 refreshes/day worst case). `comments_thread` cannot serve a global time order. |
| `comments_user (user_id, created_at, id)` | Q12 | Profile reads ~5/day today; without it each one scans all comments. One index entry per comment write (a few a day) is cheaper than the scans as the table grows. |
| `comment_likes` PK `(comment_id, user_id)` | Q2 probe, Q14, Q16, FK cascade | No secondary index: "my liked comments" is driven from the thread side (Q2), whose size the public read already pays, instead of a `(user_id, …)` index. |
| `likes` PK `(story_id, user_id)` | Q4, Q13, Q16 | Serves both the per-key count (prefix range) and the per-user probe with one structure; no other index. Counts are read from `threads`, so no count index. |
| `threads` PK `(thread_key)` | Q3, Q7s, Q11, Q13 | Point and prefix-range reads. Q7 (full map) reads the table itself; an index would not shrink it. |
| `resource_reactions` PK `(resource_id, resource_type, game_version, user_id)` | Q6, Q15, Q16 | One index for every access. A user-leading key would make Q6 read only my rows but needs a second index for Q15; reactions per resource are few (76 rows in total), so the second index is not worth its writes yet. |
| `resource_reaction_counts` PK `(resource_id, resource_type, game_version)` | Q5, Q15 | `resource_id` leads because every read is by resource id (IE §5.4), some across all versions. |
| `community_stories` PK, UNIQUE `static_story_id` | Q16, sync | PK for id; the unique keeps "one official row per static id" (Postgres `UNIQUE (env, static_story_id)`). |
| `community_stories_recent (created_at, id)` | Q10 | Home feed (limit 100) and `/patches/changes` (1000). Today the table is smaller than the limit, but it grows; without the index every feed read is a full scan plus sort. |
| `community_stories_source (source, created_at, id)` | Q10b | Patch pages read one patch's stories; `community_stories_recent` would read stories of every patch until 200 matches. |
| `community_stories_user (…) WHERE user_id IS NOT NULL` | Q12 | Same reason as `comments_user`; partial because official rows have no owner. |

### 2.3 Nav "latest": no `surface_latest` table

Plan 5.1 proposes a `surface_latest` table. With one `posts` table (decision 2) the 8 table surfaces are 8 one-row
index seeks (Q9) on indexes the toybox and runs feeds need anyway, so a table would save nothing (8-9 rows read either
way, IE §9.3) and add work: every post/run insert and delete would have to maintain it, and deleting the newest post
must move it **down**, which needs the same index seek. The weekly surface is time-dependent and cannot be written at
insert time at all. The single "one read per HTML" the plan wants already exists: the `api_cache` row `nav` (one row
read, served from isolate memory for 30 s). From step 3 the lease-holder refreshes that snapshot from D1 (Q8 + Q9,
~42 rows read, at most once a minute) instead of from Supabase. Worst case 1,440 refreshes/day ≈ 60k rows read/day.

### 2.4 Daily read budget of this domain (production call rates, IE §13)

Thread reads ~440/day × ~6 ≈ 3k; like counts ~185 × 1; reaction totals ~155 × 2; engagement map ~120 × 272 ≈ 33k;
nav refresh ≤ 1,440 × 42 ≈ 60k; story feed ~200 × 52 ≈ 10k; overlays and profile < 5k. **≈ 110k rows read/day worst
case, about 2% of the 5M free tier.** The engagement map is the term that grows with the site; §4.3 scopes it in
step 3. Writes: a comment is ~5 rows (table + 4 index entries) + 1 thread + 1-3 owner rows; likes 1 + 1 + owner;
dozens of writes a day ≈ < 1k rows written/day, plus the sync's own `sync_state` lease (1,440/day per DB).

---

## 3. Mapping and sync

### 3.1 The shared sync mechanism

**Supabase side (one migration in step 2, plus a removal script):**

```postgresql
-- Change log for the D1 shadow (plan 7.3 step 2). Service role only.
create table if not exists public.d1_change_log (
  id bigint generated always as identity primary key,
  env text,                                  -- 'production' | 'development' | null = every env
  table_name text not null,
  op char(1) not null check (op in ('I', 'U', 'D')),
  new_row jsonb,                             -- I: whole row; U: changed columns only
  old_row jsonb,                             -- U, D: whole old row minus the trigger's omitted columns
  changed_at timestamptz not null default clock_timestamp()
);
alter table public.d1_change_log enable row level security;  -- no policy: anon/authenticated see nothing
revoke all on public.d1_change_log from anon, authenticated;
create index if not exists d1_change_log_changed_at on public.d1_change_log (changed_at);  -- purge

create or replace function public.d1_log_change() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_new jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  v_old jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_env text := coalesce(v_new ->> 'env', v_old ->> 'env');
  v_col text;
begin
  -- Large documents (e.g. runs.raw) are not repeated in old rows; trigger args name them.
  if tg_nargs > 0 then
    foreach v_col in array tg_argv loop v_old := v_old - v_col; end loop;
  end if;
  if tg_table_name = 'comment_likes' then
    -- No env column: take the parent's. A cascaded delete finds no parent: null = every env.
    select c.env into v_env from public.comments c
     where c.id = (coalesce(v_new, v_old) ->> 'comment_id')::uuid;
  end if;
  if tg_op = 'UPDATE' then
    select coalesce(jsonb_object_agg(n.key, n.value), '{}'::jsonb) into v_new
      from jsonb_each(to_jsonb(new)) n
     where n.value is distinct from (to_jsonb(old) -> n.key);
    if v_new = '{}'::jsonb then return null; end if;  -- no-op update
  end if;
  insert into public.d1_change_log (env, table_name, op, new_row, old_row)
  values (v_env, tg_table_name, left(tg_op, 1), v_new, v_old);
  return null;
end $$;
revoke execute on function public.d1_log_change() from public, anon, authenticated;

-- One trigger per copied table (this domain's six; the other designs add theirs), e.g.:
create trigger d1_change_log after insert or update or delete on public.comments
  for each row execute function public.d1_log_change();
-- ... comment_likes, likes, resource_reactions, resource_reaction_counts, community_stories
-- runs: execute function public.d1_log_change('raw')
```

Trigger order does not matter: Postgres fires AFTER row triggers by name, so the counter trigger
(`comments_toybox_engagement_delta`) runs first and its post-row UPDATE is logged before the comment insert; the two
entries touch different D1 rows.

**D1 side, the cron loop (`scheduled`, every minute, both Workers, lease in `sync_state('supabase_in')`):**

1. Read `GET d1_change_log?select=*&id=gt.<low_watermark>&or=(env.eq.<API_DATA_ENV>,env.is.null)&order=id.asc&limit=100`
   (service key, deadline 20 s). Skip ids in `applied_above`.
2. Collapse by (table, D1 key) in id order: `I` -> full row; `U` -> merge columns onto what is known (or a partial
   `UPDATE` when the base row is not in the batch); `D` -> delete marker; `I` after `D` -> full row. A row that ends in
   `D` is only deleted, so a stale insert of a child whose parent was deleted later never hits the FK.
3. For each collapsed change call the table's **mapper** (below) to get statements; add the recount statements for
   every touched thread key / comment id (§4.1); run them in one `db.batch()`. If the batch fails, apply change by
   change; a change that still fails goes to `sync_rejects('in', id)` and the loop continues.
4. Advance: `low_watermark` = the largest fetched id such that every fetched id at or below it was applied **and** its
   `changed_at` is older than 5 minutes; ids applied above it go to `applied_above`. Rationale: identity values are
   allocated before commit, so a lower id can become visible after a higher one; our transactions are single
   statements, so 5 minutes is far beyond any real commit delay, and the daily check catches anything slower.
   Re-applying is idempotent anyway (upserts with `WHERE … IS NOT excluded…` write nothing when nothing changed).
5. Record `last_run_at`, `last_applied_at`, `last_lag_ms` (max of apply time − `changed_at`).
6. Once a day the loop deletes `d1_change_log` rows older than 7 days whose id ≤ both Workers' watermarks (the GHA
   check passes the testbed watermark; or simply older than 7 days).

**Mapper contract** (each design implements one per Supabase table, in `workers/api/sync/<table>.ts`):

```ts
type SyncMapper = {
  supabaseTable: string;
  d1Table: string;
  /** D1 key of a Supabase row (new or old); also the outbox match minus env. */
  key(row: Record<string, unknown>): Record<string, string | number>;
  /** Supabase row (env dropped) -> D1 column values: canonicalTs, 0/1, JSON text, dropped columns removed. */
  toD1(row: Record<string, unknown>): Record<string, unknown>;
  /** D1 row -> the Supabase columns the step-5 mirror sends (source columns only, no env, no derived). */
  toSupabase?(row: Record<string, unknown>): Record<string, unknown>;
  /** Derived rows to recompute after the change (thread keys, comment ids, reaction targets, owner rows). */
  touched(change: CollapsedChange): Touched;
};
```

**First copy** (one script, `scripts/d1-first-copy.ts`, testbed first):
1. Apply the Supabase change-log migration; note `max(id)` of `d1_change_log` (`W0`).
2. `pg_dump --data-only` the copied tables (one consistent snapshot).
3. Convert with the same mappers' `toD1` (rows split by env; `comment_likes` by its comment's env), check NULLs and the
   measured JSON maxima, write `INSERT` files in FK order (`comments` before `comment_likes`), load with
   `wrangler d1 execute --remote --file` after wiping the domain's tables (allowed until step 5, plan 7.2).
4. Run the derived fills of §3.2.
5. Set `sync_state('supabase_in').low_watermark = W0` and start the cron. Changes between `W0` and the dump are
   re-applied idempotently.

Rows written for this domain's first copy ≈ comments 385 × 5 + likes 301 + comment_likes 58 + reactions 76 + counts 25
+ stories 26 × 5 + threads ~372 ≈ 3k per both DBs, far below 100k/day.

### 3.2 Per source table (Supabase -> D1, first copy and step-2 sync)

| Supabase table | D1 rows | columns | deletes | derived after apply |
|---|---|---|---|---|
| `comments` | `comments` 1:1 (env picks the DB) | drop `env`, `parent_id`, `meta`; `created_at` -> `canonicalTs`; `palette_swapped` -> 0/1/NULL; `content_blocks` jsonb -> compact JSON text (SQL NULL stays NULL; a jsonb `null` becomes the text `null`, emitted the same) ; `like_count` not in Supabase (filled by Q14) | `D` -> `DELETE FROM comments WHERE id = ?`; FK cascades its `comment_likes` (Supabase logs the cascaded child deletes too; they are no-ops by then) | Q13 comment recount for `story_id` (old and new key on `U`) |
| `comment_likes` | `comment_likes` 1:1; env from the parent comment (`env null` on cascaded deletes -> applied in both DBs, a no-op where absent) | drop `id`; `created_at` -> canonical | `D` -> `DELETE … WHERE comment_id = ? AND user_id = ?` | Q14 for `comment_id` |
| `likes` | `likes` 1:1 | drop `id`, `env`, `reaction_type` | `D` -> by `(story_id, user_id)` | Q13 like recount for `story_id`; owner counters are **not** touched (copied from Supabase via the post/run rows' own change-log entries) |
| `resource_reactions` | `resource_reactions` 1:1 | drop `env`; key reordered | by full key | none: `resource_reaction_counts` arrives as its own change-log entries |
| `resource_reaction_counts` | `resource_reaction_counts` 1:1 (copied as is) | drop `env` | none happen (never deleted); mapped anyway | — |
| `community_stories` | `community_stories` 1:1 | drop `env`; `tags`, `linked_entities` -> compact JSON; `created_at` -> canonical; `static_story_id` kept | by `id` | none (story counts live in `threads` under its key) |
| (none) | `threads` | **no Supabase column for most keys**: first copy fills it from D1's own rows; afterwards each sync batch recounts touched keys | never deleted | — |

First-copy derived fill (D1 SQL, after the source rows are loaded):

```sql
-- threads: every key with a like or a comment, counts from D1's own rows.
INSERT INTO threads (thread_key, like_count, comment_count, last_comment_at, updated_at)
SELECT k, sum(l), sum(c), max(m), ?1 FROM (
  SELECT story_id AS k, count(*) AS l, 0 AS c, NULL AS m FROM likes GROUP BY story_id
  UNION ALL
  SELECT story_id, 0, count(*), max(created_at) FROM comments GROUP BY story_id
) WHERE true GROUP BY k;
-- comments.like_count from comment_likes.
UPDATE comments SET like_count = (SELECT count(*) FROM comment_likes l WHERE l.comment_id = comments.id);
```

What "copy Supabase's counter values as-is" means per counter:

| counter | Supabase source | D1 value in steps 2-4 |
|---|---|---|
| `posts.like_count/comment_count`, `runs.like_count/comment_count` | trigger-maintained columns | copied (their change-log `U` entries) |
| `resource_reaction_counts.*` | trigger-maintained table | copied |
| `threads.*` | none (Supabase computes `get_engagement_counts` per call, and the Worker counts rows) | recomputed from D1's copied rows (= what Supabase would compute from the same rows) |
| `comments.like_count` | none (embed `comment_likes(count)`) | recomputed from D1's copied rows |

So every value a step-1 route returns today is reproducible in D1: the trigger-maintained ones are copies, the
computed-per-read ones are computed from identical rows.

### 3.3 Read-your-write in steps 2-4

Plan 7.3 asks the Worker to apply its own successful Supabase write to D1 at once. For this domain the step-1 routes
change additively so the write already returns the committed row (no extra read):

| route | Supabase call change | D1 batch right after |
|---|---|---|
| `POST /api/write/comments` | none (`return=representation`, `COMMENT_COLUMNS`) | upsert comment + Q13 |
| `DELETE /api/write/comments` | `select=id,story_id` instead of `select=id` | delete by id + Q13 |
| `PUT/DELETE comment-likes` | PUT: `return=representation&select=comment_id,user_id,created_at` (on 23505 skip) | insert-or-ignore / delete + Q14 |
| `PUT/DELETE likes` | PUT: `return=representation&select=story_id,user_id,created_at` | insert-or-ignore / delete + Q13 |
| `PUT reactions` | none | upsert/delete reaction; upsert the counts row from the totals the route already reads |
| `POST/DELETE stories` | DELETE: `select=id` (unchanged) | upsert / delete |

Owner counters (`posts`/`runs`) are not refreshed here; their change-log entry arrives within 1-2 minutes. The
change-log entry of the same write is re-applied later as a no-op.

### 3.4 Step 5: D1 -> Supabase outbox (source rows only)

Each write batch appends its `outbox` rows (same batch, so a write and its mirror row commit together). The mirror
(`ctx.waitUntil` after the write, plus the 1-minute cron under `sync_state('outbox_out')`) sends in `seq` order with
the service key, adds `env = API_DATA_ENV`, stops at the first failure (order preserved), and deletes sent rows.

| D1 change | outbox row | Supabase call | Supabase-side effect |
|---|---|---|---|
| comment insert | `comments` insert, row = all columns except `like_count`, `created_at` canonical | `POST comments?on_conflict=id` `Prefer: resolution=ignore-duplicates` | guard trigger skipped (service role), so D1's `created_at` is kept; counter trigger bumps the post/run `comment_count` once; a resend is ignored (no trigger) |
| comment delete | `comments` delete, match `{id, user_id}` | `DELETE comments?id=eq&user_id=eq&env=eq` | cascades `comment_likes`; counter trigger; a resend or a non-owner attempt deletes 0 rows |
| comment like put / delete | `comment_likes` insert `{comment_id, user_id, created_at}` / delete match `{comment_id, user_id}` | `POST … on_conflict=comment_id,user_id` ignore-duplicates / `DELETE` | Supabase defaults `id`; no counters exist |
| like put / delete | `likes` insert `{story_id, user_id, created_at}` / delete `{story_id, user_id}` | `POST … on_conflict=story_id,user_id,env` ignore-duplicates / `DELETE` | `reaction_type` defaults to `thumb_up`; counter trigger once |
| reaction put / delete | `resource_reactions` upsert `{resource_type, resource_id, game_version, user_id, kind}` / delete by key | `POST … on_conflict=env,resource_type,resource_id,game_version,user_id` `resolution=merge-duplicates` / `DELETE` | insert or kind update fires `apply_resource_reaction_counts` once; a resend with the same kind moves nothing |
| story insert / delete | `community_stories` insert (all columns) / delete `{id, user_id}` | `POST … on_conflict=id` ignore-duplicates / `DELETE` | none |
| `threads`, `comments.like_count`, `resource_reaction_counts`, owner counters | **never** | — | recomputed by Supabase triggers / embeds (plan 7.3: sending them would count twice) |

Every mirror call is idempotent (insert-ignore, delete-by-key, upsert to the same value), so resends after a timeout
never double-count. Deletes always carry the owner in the match, so the always-written outbox row of a refused delete
cannot delete someone else's row in Supabase.

Rollback from step 5 (plan): pause writes, drain the outbox, flip the source flag, then set
`sync_state('supabase_in').low_watermark` to the current `max(id)` of `d1_change_log` before resuming the step-2 loop
(the change-log triggers keep logging the mirror's writes during step 5; those rows are already in D1).

### 3.5 Daily check (GitHub Actions, `scripts/d1-daily-check.ts`)

- Per table in the mapper registry: read every Supabase row of the env through PostgREST (service key, ordered by the
  D1 key, paged) and every D1 row (`wrangler d1 execute --remote --json`, ordered the same). Normalize both sides with
  one function: drop env and dead columns, timestamps through `canonicalTs`, booleans to `true/false/null`, JSON
  columns parsed and re-serialized with sorted keys. One line per row, sha-256 over the lines. Write `sync_checks`
  (`kind = 'rows'`) with counts, hashes and up to 20 differing keys.
- Derived (`kind = 'derived'`), this domain:
  - `threads` vs a recount over D1's own rows (internal consistency) and vs `rpc/get_engagement_counts(env)` (must be
    equal: same definition, same rows);
  - `comments.like_count` vs recount; `resource_reaction_counts` copied rows vs Supabase (in `rows`);
  - **informational, does not block the gate**: owner counters (`posts`, `runs`, copied from Supabase) vs `threads`.
    These differ wherever Supabase's delta triggers drifted (runs unshared and re-shared, IR §3.4); the list is the
    input for the step-5 question in §6.
- Open `sync_rejects` rows are listed; any open reject or row difference fails the day.
- Rows read: every D1 row once a day (~4k in this domain), negligible.

---

## 4. Replacing triggers, RPCs and RLS

### 4.1 Recount statements (used by Worker writes from step 5, by the sync and by read-your-write)

```sql
-- Comment side of a thread (comment insert/delete).
INSERT INTO threads (thread_key, comment_count, last_comment_at, updated_at)
SELECT ?1, count(*), max(created_at), ?2 FROM comments WHERE story_id = ?1
ON CONFLICT (thread_key) DO UPDATE SET comment_count = excluded.comment_count,
  last_comment_at = excluded.last_comment_at, updated_at = excluded.updated_at
  WHERE threads.comment_count IS NOT excluded.comment_count OR threads.last_comment_at IS NOT excluded.last_comment_at
RETURNING comment_count;

-- Like side of a thread (like put/delete). RETURNING gives the route its `count`.
INSERT INTO threads (thread_key, like_count, updated_at)
SELECT ?1, count(*), ?2 FROM likes WHERE story_id = ?1
ON CONFLICT (thread_key) DO UPDATE SET like_count = excluded.like_count, updated_at = excluded.updated_at
  WHERE threads.like_count IS NOT excluded.like_count
RETURNING like_count;

-- Owner copy, step 5+ only (threadOwner(key) gave service/id; likes skipped for this_or_that).
UPDATE posts SET comment_count = (SELECT comment_count FROM threads WHERE thread_key = ?1)
 WHERE id = ?2 AND service = ?3;
UPDATE runs SET like_count = (SELECT like_count FROM threads WHERE thread_key = ?1) WHERE id = ?2;

-- Reaction totals of one target (step 5+). RETURNING gives the route its `counts`.
INSERT INTO resource_reaction_counts (resource_id, resource_type, game_version, buff_count, nerf_count, rework_count)
SELECT ?1, ?2, ?3, coalesce(sum(kind = 'buff'), 0), coalesce(sum(kind = 'nerf'), 0), coalesce(sum(kind = 'rework'), 0)
  FROM resource_reactions WHERE resource_id = ?1 AND resource_type = ?2 AND game_version = ?3
ON CONFLICT (resource_id, resource_type, game_version) DO UPDATE SET buff_count = excluded.buff_count,
  nerf_count = excluded.nerf_count, rework_count = excluded.rework_count
RETURNING buff_count, nerf_count, rework_count;
```

(`INSERT … SELECT … ON CONFLICT` needs a `WHERE` on the SELECT in SQLite; each has one.) The `RETURNING` of an upsert
whose `DO UPDATE … WHERE` skipped the row returns nothing; the route then reads `threads` by PK (1 row).

### 4.2 Triggers

| Postgres trigger | D1 replacement | why |
|---|---|---|
| `comments_guard_server_columns` / `community_stories_guard_server_columns` (`guard_insert_server_columns`: `created_at := now()`, `static_story_id := null`) | Worker builds the row: `created_at = nowTs()`, `static_story_id` never taken from a client; admin scripts may set both | The Worker is the only writer from step 5; the guard existed because browsers wrote directly |
| `comments_toybox_engagement_delta`, `likes_toybox_engagement_delta` (`apply_toybox_thread_engagement_delta`) | Q13 recount of `threads` + owner copy (§4.1), same batch | Recount is idempotent (sync replays, retries), needs no clamp, and covers every key, not only posts; owner parsing (`threadOwner`) is TS shared with the client |
| `resource_reactions_counts` (`apply_resource_reaction_counts`) | §4.1 reaction recount, same batch (step 5); copied in steps 2-4 | Same; keeps "row created on first reaction, never deleted" |
| (none) comment like counts | Q14 in the comment-like batch | Replaces the per-read embed `comment_likes(count)` and HEAD counts |

**No SQLite triggers.** D1 supports them, but: (a) in steps 2-4 owner counters must be Supabase's copies, and a trigger
recomputing them would race the copied values; (b) the sync applies collapsed upserts, and SQLite fires
INSERT vs UPDATE triggers differently on the upsert paths, which would make delta triggers replay-unsafe; (c) plan
5.5 chose explicit statements in the batch. One TS helper (`engagementRecounts(keys, commentIds, targets)`) is the
single place every write path calls, so no path can forget it.

### 4.3 RPCs and computed counts

| today | D1 |
|---|---|
| `get_engagement_counts(p_env)` (full aggregation of `likes` + `comments`) | Q7 over `threads` (one row per thread instead of one per like/comment, no aggregation). Step 3 adds an optional `scope=codex\|beta-art\|stories` parameter (additive; old clients keep the full map) so the card library, monster tiles and beta art read a PK range and the story feed reads `community:` + the static ids it renders (Q7s). The shadow comparison compares the full map in step 2 |
| HEAD `count=exact` on `likes` per key (Q-L1, after Q-L4) | `threads.like_count` (Q3, or `RETURNING` in the write batch) |
| embed `comment_likes(count)` / HEAD on `comment_likes` | `comments.like_count` (Q1 column, Q14 `RETURNING`) |
| run thread counts (Q-C7/Q-L5), philosopher reply counts (Q-C6): rows counted in JS, capped at 1000 rows | Q3 over `threads` (exact, no cap) |
| `get_my_profile_activity(_stats)` like counts (`count(likes.id)` on `'community:'||id`, `count(comment_likes.id)`) | Q11 and `comments.like_count`; the profile design composes the union and offset paging |
| `get_story_reaction_counts` | dropped (dead) |
| `admin_story_service` / `commentThreadService` | unchanged TS (`comment-threads.ts`); used only by local admin scripts |

### 4.4 RLS policies and CHECKs

| Postgres rule | D1 / Worker |
|---|---|
| `*_read USING (true)` on all six tables | Public read routes; the Worker chooses the columns (today's column lists, `user_id` stays public as today) |
| `comments_insert`, `comment_likes_insert`, `likes_insert`, `community_stories_insert`, `resource_reactions_insert` `(auth.uid() = user_id)` | Worker sets `user_id` = verified identity (step 4: signed cookie; step 1-3: JWT `sub`); clients never send it |
| `*_delete (auth.uid() = user_id)` | `DELETE … WHERE <key> AND user_id = ?`; 0 rows -> 404 (comments) / `deleted: false` (stories), as today |
| `resource_reactions_update` + `GRANT UPDATE(kind)` | the reaction upsert changes only `kind` |
| `resource_reaction_counts_read`, no write policy | only the recount writes it |
| any env, any thread key (accepted step-1 risk) | env is the database; keys validated by the Worker regex |
| `comment_likes → comments` FK (23503 -> 404) | D1 FK; a `FOREIGN KEY constraint failed` from the batch maps to 404 |

CHECKs that stay in D1 (cheap, accept everything Supabase accepts): nickname 1..20, content 1..2000, sentence 2..120,
`game` enum, `kind` enum, reaction key lengths (32/128/32), key/ref byte sizes (≤ 1024), author token ≤ 1024 bytes,
`json_valid`, JSON byte backstops, 0/1 booleans, canonical timestamps, uuid format, non-negative counters.

Moved to Worker validation only (already in the step-1 Worker): thread key regex `^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$`;
comment `trim().length >= 2`, nickname trimmed; `contentBlocks` array ≤ 128 KiB; author fields ≤ 64 chars,
`paletteSwapped` boolean/null; story `patchLineId`/`source`/entity REF regexes, `linkedEntities` shape ≤ 128 KiB,
`tags = []`, `game = 'sts2'`; reaction type/id/version regexes. Replaced by the D1 byte backstop:
`pg_column_size(...) <= 131072` (compressed size cannot be checked in SQLite).

### 4.5 Runtime flags (rows in the existing `runtime_flags`, no DDL)

`sync.supabase_in` = `on|off` (cron loop), `shadow.<group>` = sample rate `0`..`1` (step 2, e.g. `0.1` for
`comments`, `stories`, `nav`), `read.<group>` = `supabase|d1` (step 3, reserved in STEP1 3.1), `write.source` =
`supabase|paused|d1` (step 5). Missing or unreadable -> the safe value of the current step (off / 0 / supabase).

---

## 5. Rebuilding the step-1 answers and comparing them

General rules for the D1 adapter: same keys in the same order as today's object; timestamps through `postgrestTs`;
booleans back to `true/false/null`; JSON columns `JSON.parse`d; `env` injected where today's row has it; dead columns
(`buff_count`… on philosopher rows) left out. The step-1 Worker already re-serializes most Supabase answers with
`JSON.stringify`, so for those routes the comparison can be **byte-equal after one normalization**: within a group
of rows with the same sort value, sort both sides by `id`; sort the keys of map objects (`likes`, `comments`,
`threads`). Passthrough routes (PostgREST bytes streamed unparsed) are compared **field-equal** (parse both).

| route | rebuilt from | comparison |
|---|---|---|
| `read.engagement` `threads` | Q1 grouped per key in key order; row = the 11 `COMMENT_COLUMNS` + `like_count` (column) | byte-equal after tie sort (Postgres orders by `created_at` only). Skip when either side is `unavailable` (Supabase's 1 MiB stream cap or 1000-row cap cannot be reproduced exactly; D1 applies the same 1000-row rule and an approximate byte rule) |
| `read.engagement` `likes` | Q3 | byte-equal |
| `read.engagement` `reactions` | Q5 (+ philosopher ids), zeros for missing | byte-equal |
| `read.engagement` `philosophers` | runs/profile design's table, `week_start DESC` | field-equal ignoring `buff_count/nerf_count/rework_count` (not ported, frozen values in Supabase); ties inside a week compared as a set |
| `me.engagement` | Q2 (lists per key), Q4, Q6 | `commentLikes` lists compared as sets; the rest byte-equal |
| `read.engagement-counts` | Q7, zero counts omitted as today | map-equal (key order is arbitrary on both sides). Supabase's PostgREST `max-rows` (1000) would cut the RPC once threads exceed 1000: compare only while it returned < 1000 rows |
| `read.history-runs.engagement`, `colorful-philosophers` reply counts | Q3 | map-equal; skip when Supabase hit its 1000-row read cap |
| `read.stories` (passthrough) | Q10/Q10b, 19 `STORY_COLUMNS` incl. injected `env` | field-equal: Supabase bytes carry jsonb's spaced text for `tags`/`linked_entities` (`{"a": 1}`), D1 emits compact JSON, so bytes differ while values are equal. Order `created_at DESC` without a tiebreak: rows strictly newer than the last row's `created_at` must match exactly; the tie group at the limit boundary is compared by count. CPU guard: shadow only when the Supabase body is ≤ 256 KB (else `skipped`) |
| `read.nav` | Q8 + Q9 + weekly, same `courierCommentText`, `truncate`, `isoOrNull` code on the `postgrestTs` strings | field-equal excluding `fetchedAt`; courier compared like the story feed (boundary ties) |
| write routes | not shadowed in step 2 (the write goes to Supabase; §3.3 applies it to D1) | from step 4, testbed fixtures compare `{comment}`, `{liked, count}`, `{kind, counts}`, `{row}` between adapters |

Fields that cannot be reproduced byte-for-byte, and how they are compared:
1. **jsonb text formatting** inside passthrough bodies (spacing; numbers like `1.50` that JS prints as `1.5`): compare
   parsed values (deep-equal, key order ignored).
2. **Order inside equal sort values**: Postgres lists have no tiebreak; D1 adds `id`. Compare tie groups as sets;
   at a `LIMIT` boundary compare the tie group by count.
3. **`env`**: injected, equal by construction.
4. **Response caps** that depend on PostgREST's byte stream (1 MiB thread batch) or its row caps (1000): skipped,
   counted in `shadow_stats.skipped`.
5. **Rows written in the last ~2 minutes** (sync lag): a difference whose rows have `created_at` newer than
   `now − 2 min` is retried once after 2 minutes before it counts as `differed`.

Shadow mechanics: on a sampled `api` request the Worker answers from Supabase as today, and in `ctx.waitUntil` runs
the D1 adapter, normalizes both, and upserts `shadow_stats` (+ `shadow_diffs` with the normalized difference, capped
at 8 KB). One extra D1 batch per sampled request (~5-50 rows read, 1-2 rows written).

---

## 6. Open questions for the user

1. **Owner counters at the step-5 cutover.** Supabase's delta-maintained `posts`/`runs` like and comment counts have
   drifted where runs were unshared and shared again (IR §3.4; the history-course list already shows true row counts,
   the defragment board shows the drifted column). From step 5 D1 sets those columns from `threads` (true counts). Should
   the cutover script reset both sides to the true counts at once (defragment numbers change to match the list; the
   bug goes on the tasks/010 ledger as fixed by the cutover), or keep Supabase's values and let D1 copy them until the
   refactoring bundle's bug-fix pass? Recommended: reset at cutover. The daily check's informational drift list
   (§3.5) will show exactly which rows change.

Everything else above is decided; notably: no `surface_latest` table (§2.3), no SQLite triggers (§4.2), this-or-that
likes stay outside `threads` (§0.7), D1 CHECKs accept every Supabase row and the Worker keeps the stricter rules (§0.5).

## 7. Dropped (not ported)

| object | reason |
|---|---|
| every `env` column, `*_env_check`, env-leading index | decision 1 |
| `comments.parent_id` + `comments_parent_id_fkey`, `comments.meta` (+ its half of `comments_blocks_size_check`) | CLEANUP 3.1, read by nobody |
| `likes.reaction_type` + `likes_reaction_type_check` + `idx_likes_env_story_reaction` | CLEANUP 3.1, always the default |
| `likes.id`, `comment_likes.id` | never read (0 scans); natural keys suffice; Supabase defaults them on mirror |
| `idx_likes_story_env`, `idx_community_stories_env_sentence` (GIN), `idx_community_stories_env_patch_line` | 0 scans |
| all other 114 Postgres indexes of these tables | re-derived from queries (§2) |
| `get_story_reaction_counts`, `get_engagement_counts`, `apply_toybox_thread_engagement_delta`, `apply_resource_reaction_counts`, `guard_insert_server_columns` and their triggers | dead / replaced by §4 |
| `colorful_philosopher_reactions` + `apply_colorful_philosopher_reaction_counts` + trigger + 4 policies | CLEANUP 3.1, rows already in `resource_reactions` |
| `nav_indicators`, `debate_cycles` | CLEANUP 3.1 |
| `defragment_posts`, its policies, indexes and the `defragment` branches of the counter trigger (`threadOwner` has no `defragment` owner) | CLEANUP 3.1, never had a row |
| Realtime channel on `community_stories` | never fired; api path opens none (plan 5.4) |
| `surface_latest` (plan 5.1) | superseded by index seeks + the existing `api_cache` nav snapshot (§2.3) |
