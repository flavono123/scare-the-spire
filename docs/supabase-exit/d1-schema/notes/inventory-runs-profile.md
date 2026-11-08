> Working notes from the 2026-11-08 D1 schema survey. [D1_SCHEMA_DESIGN.md](../../D1_SCHEMA_DESIGN.md) takes precedence
> where they differ. Paths under `scratchpad/` were temporary and are not kept.

# D1 step 2 inventory: runs, profile, contact, puzzlebox, colorful philosophers

Domain: History Course runs (역사 강의서), profile (nickname pools and the two activity RPCs), contact inquiries,
the four puzzlebox tables and their five functions, colorful philosopher posts (다채로운 철학자들), and the
user-identity assumptions these tables make.

## 0. How to read this

- `schema:N` is a line in `/Users/flavono123/slseoun-backups/supabase/20261105-2048/public-schema.sql` (pg_dump of
  production, 2026-11-05). Constraint and policy text is quoted from it verbatim.
- File references (`file:line`) are to the `refactor/supabase-exit` worktree at `b0c5c521`
  (`/Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit`). SURFACE_MAP line numbers are from before the
  2026-11-08 cleanup and are often off by 10-20 lines; the numbers below were re-read from the current files.
- Row counts are `n_live_tup` from `tstats.json` (2026-11-07), both envs together. Index scans are `idx_scan` from
  `istats.json`. The statistics window started 2026-06-02 (Postgres never restarted), about 5 months. Puzzlebox
  shipped 2026-11-04, so its numbers cover 3 days.
- `stmts.json` holds only the top 50 statements by total time (query text cut at 500 chars). Calls are given where a
  statement matches; "not in top 50" means the query is real but cheap.
- "Worker" = step-1 `/api` Worker (`workers/api/routes/*.ts`, PostgREST). "legacy" = browser supabase-js path still in the
  bundle behind the per-group flag. "dev only" = runs only under `next dev` or dev-tools builds, never in production.
- Dead objects follow CLEANUP_AUDIT 3.1; section 9 lists what this domain drops.

## 1. Summary

| Table | Rows | env column | PK today | Written by | Read by | Dead parts (CLEANUP 3.1) |
|---|---|---|---|---|---|---|
| `runs` | 687 (584 production per plan 6.1) | yes, in PK | `(id, env)` | donor via PostgREST (RLS), like/comment counter trigger | anon, everyone | columns `badges`, `highlight_card`, `highlight_relic`, `note_blocks` (write-only); indexes `idx_runs_build`, `idx_runs_character`, `idx_runs_env` |
| `profile_character_nickname_pools` | 10 | **no** (shared by all envs) | `(character_id, locale)` | dev admin page (service key) | anon | none |
| `contact_inquiries` | 11 | yes | `id` | authenticated owner insert; owner updates `reply_seen_at`; admin (service) updates reply | owner (subset of columns), admin | columns `viewport_width`, `viewport_height` (write-only) |
| `puzzlebox_runs` | 23 | yes | `id` (bigint identity, **no env**) | `submit_puzzlebox_run` only | nobody (policy exists, no reader) | policy `puzzlebox_runs_read_own`; "some columns only the RPC writes" |
| `puzzlebox_best` | 21 | in PK only, no CHECK | `(env, game, board, user_id)` | `submit_puzzlebox_run` only | the three RPCs | - |
| `puzzlebox_players` | 8 | **no** (shared by all envs) | `user_id` | `submit_puzzlebox_run` only (upsert every run) | the three RPCs | - |
| `puzzlebox_board_stats` | 14 | in PK only, no CHECK | `(env, game, board)` | `submit_puzzlebox_run` only | `get_puzzlebox_leaderboard` | not named by CLEANUP; `rocks_sum`, `speed_sum` are written but never shown (6.5) |
| `colorful_philosopher_posts` | 28 (25 production per plan 6.1) | yes | `id` (+ UNIQUE `(env, week_start, slot)`) | dev admin page (service key) | anon | columns `buff_count`, `nerf_count`, `rework_count`; child table `colorful_philosopher_reactions` (whole table) |

Functions in scope: `guard_post_server_columns` (runs branch), `apply_toybox_thread_engagement_delta` (runs branch),
`get_defragment_feed_v2` (runs branch), `get_my_profile_activity`, `get_my_profile_activity_stats`,
`profile_nickname_list_is_valid`, `clear_contact_inquiry_reply_seen`, `enforce_contact_inquiry_rate_limit`,
`submit_puzzlebox_run`, `puzzlebox_score_run`, `puzzlebox_run_display`, `get_puzzlebox_leaderboard`,
`get_my_puzzlebox_standings`, `get_rls_activity_metrics` (admin, reads runs and contact_inquiries).

## 2. Cross-cutting facts

### 2.1 User identity

- Every user column is a Supabase Auth uid (`uuid`). FKs to `auth.users(id)`:
  - `runs.donor_user_id` ON DELETE SET NULL (schema:4643-4644). Column is nullable, so ownerless runs are legal.
  - `contact_inquiries.user_id` ON DELETE SET NULL (schema:4515-4516). Nullable.
  - `puzzlebox_runs.user_id`, `puzzlebox_best.user_id`, `puzzlebox_players.user_id` ON DELETE CASCADE
    (schema:4612, 4620, 4628). NOT NULL.
  - `colorful_philosopher_reactions.user_id` ON DELETE CASCADE (dead table).
- `auth.users` has 3,808 rows, all anonymous (plan 7.3, step 0). Users are never deleted by the app, so the ON DELETE
  actions have never fired from app code. D1 has no `auth.users`; until step 4 the uid is the Supabase JWT `sub`.
  The Worker lower-cases it (`workers/api/jwt.ts:243`), which matches Postgres uuid text output.
- Ownership checks today are RLS `auth.uid() = <col>`. Policies without `TO` apply to `public`, i.e. anon too, but
  anon has no `sub`, so they only ever pass for `authenticated` (which includes anonymous sign-ins).
- `auth.uid()` is read inside RPCs and one trigger: the SECURITY DEFINER `submit_puzzlebox_run` (actor),
  `get_puzzlebox_leaderboard` (`is_me`, `me`, `around_me`) and `get_my_puzzlebox_standings`; the caller-rights
  `get_my_profile_activity` and `get_my_profile_activity_stats`; and the SECURITY DEFINER trigger
  `enforce_contact_inquiry_rate_limit`. In D1 these become a Worker-supplied user id parameter.
- Two different "author" models live in this domain (decision 5 says keep today's behaviour):
  - `runs.donor_nickname` is **not frozen**: the donor's browser rewrites it to the current profile nickname on every
    mount of the History Course index and the defragment board (`syncDonatedRunNicknames`, section 3.7 W11/L13). There
    is no avatar or palette on runs.
  - `puzzlebox_players` keeps **one latest** nickname/avatar/palette per user, overwritten on every submitted run
    (shared across envs, see 2.3). Rankings show that latest token plus `tag = left(md5(user_id::text), 4)`.
  - `contact_inquiries` and `colorful_philosopher_posts` have no author snapshot.

### 2.2 Timestamps, dates and ordering

- Column kinds in scope: `timestamptz` (`runs.created_at` nullable; `contact_inquiries.created_at`, `responded_at`,
  `reply_seen_at`; `puzzlebox_runs.created_at`; `puzzlebox_best.achieved_at`; `puzzlebox_players.updated_at`;
  `profile_character_nickname_pools.updated_at`; `colorful_philosopher_posts.created_at`), `date`
  (`colorful_philosopher_posts.week_start`), unix-seconds `bigint` (`runs.start_time`, nullable) and seconds `integer`
  (`runs.run_time`, nullable).
- What clients see today:
  - PostgREST serialises `timestamptz` through Postgres JSON output: `2026-11-05T11:48:12.123456+00:00` (`T`, session
    zone UTC so `+00:00`, fractional seconds up to 6 digits with trailing zeros dropped: `…:12.12+00:00`, `…:12+00:00`).
    The run list, run detail and defragment run rows are streamed byte-for-byte from PostgREST to the browser
    (`history-runs.ts:44-56`, `toybox.ts:132`), so these exact strings reach the client.
  - `date` comes out as `2026-11-02`. Callers `slice(0, 10)` anyway (`src/lib/colorful-philosophers.ts:151`, `workers/api/routes/nav.ts:174`).
  - pg_dump text (the first-copy source) prints `2026-11-05 11:48:12.123456+00` (space, `+00`): a different string
    from what PostgREST returns. The conversion script must normalise.
  - Values the app writes are JS `toISOString()` (`…T11:48:12.123Z`, millisecond, `Z`): `reply_seen_at`
    (`workers/api/routes/profile.ts:107`, `src/lib/contact-inquiries.ts:217`), `responded_at` (`admin-dev-page.tsx:705`), pools `updated_at` (`admin-dev-page.tsx:635`). Postgres re-serialises
    them, so today readers never see the JS form. In D1 the stored text is whatever was written.
  - SQLite `strftime('%Y-%m-%dT%H:%M:%fZ','now')` has millisecond precision only; Postgres `now()` has microseconds.
    Rows created in the same millisecond tie in D1 but not in Postgres, which changes `(created_at, id)` order inside
    that millisecond and the `achieved_at` tie-break in puzzlebox ranks.
- Lexicographic order of the PostgREST form happens to equal time order while every value ends in `+00:00`, because
  `+` (0x2B) < `.` (0x2E) < digits: `…:12+00:00` < `…:12.25+00:00` < `…:12.5+00:00`. Mixing in `Z` (0x5A) breaks it
  (`…:12Z` sorts after `…:12.5Z`), and so does mixing the dump's space form. A fixed-width form (always 6 fractional
  digits, one suffix) avoids the trap.
- Cursor inputs: the browser echoes `created_at` from a feed row as the cursor. The Worker accepts
  `/^\d{4}-\d{2}-\d{2}[T ][0-9:.]{8,15}(?:Z|[+-]\d{2}(?::?\d{2})?)?$/` (`src/lib/toybox-api-rules.ts:39`), i.e. any of the
  forms above, and today Postgres parses it to a real timestamp before comparing. A TEXT comparison in D1 needs the
  cursor normalised to the stored canonical form first.
- NULL ordering differs: Postgres `ORDER BY x DESC` puts NULLs **first**, SQLite puts them **last** (SQLite treats NULL
  as smallest). Affected queries in this domain: run list `order=created_at.desc` (W1, `runs.created_at` nullable), combo
  picker `order=start_time.desc` (W2, `runs.start_time` nullable), defragment run feed (W13) and the `runs` branch of
  `get_defragment_feed_v2`. The nav query already says `created_at.desc.nullslast` and `created_at=not.is.null`
  (`nav.ts:150-157`). Whether any production run has NULL `created_at` or `start_time` is not known from the
  available stats (open check 10.1).
- Ties without a tie-breaker: colorful philosopher lists order by `week_start.desc` only, and each week holds up to
  three rows (one per slot), so the order inside a week is whatever Postgres returns (W15, W17-W19, L17, L20-L22, B1). Shadow
  comparison must compare those as sets or the D1 query must add `slot` and the comparator sort the same way.

### 2.3 env handling (decision 1: one D1 per env, no env column)

- `profile_character_nickname_pools` and `puzzlebox_players` have **no env column**: one row set is shared by
  production, testbed and local dev today. Under decision 1 each D1 gets its own copy:
  - nickname pools: the same 10 rows go to both prod and testbed D1; the change-log sync must fan one Supabase change
    out to both DBs (or treat pools as config loaded by script).
  - puzzlebox players: a player's latest nickname/token is shared across envs today. After the split, a testbed run
    no longer overwrites the production player row. The 3-second burst check is per env
    (`env = p_env and game and board`), but the **500-runs-per-day limit counts across all envs**
    (`where user_id = actor and created_at > v_now - interval '1 day'`, schema:2396-2399). Per-env D1 makes it per env.
- `puzzlebox_best` and `puzzlebox_board_stats` carry env only in their PKs (no CHECK on env).
- `runs` PK is `(id, env)`: the same content-hash run id can exist once per env. In per-env D1, `id` alone is unique.
- Legacy profile inquiry history has **no env filter** (`contact-inquiries.ts:151-158`), so a user who used both
  production and testbed sees both envs' rows on the legacy path; the Worker filters by env (`profile.ts:80-87`).
  The `env` column is selected and returned (`CONTACT_INQUIRY_HISTORY_COLUMNS`) but the profile UI never displays it
  (`profile-activity.tsx:211-240`).
- Dev-only code reads production on purpose: `src/app/api/dev/history-course-runs/route.ts:49-56` and
  `[runId]/route.ts:58-64` (`env = 'production'`), `runReadEnvs()` in dev tools reads `[ownEnv, 'production']`
  (`run-donation.ts:138-143`), `useColorfulPhilosophersNextWeekOpen` reads `env = 'production'`
  (`use-colorful-philosopher-posts.ts:128-131`), and the philosopher dev page writes either env (`actions.ts:85-96`).

### 2.4 Id generation

- `runs.id`: client-supplied content hash, `<hash version digit><base36 hash>` (`src/lib/sts2-run-hash.ts:59-75`),
  validated `^[A-Za-z0-9_-]{1,64}$` (`history-runs-api-rules.ts:16`). The same run uploaded by two people collides:
  the first donor wins, the second gets 23505 / "already shared".
- `contact_inquiries.id`, `colorful_philosopher_posts.id`: `gen_random_uuid()` defaults. In D1 the Worker or script
  must generate them (no default function for uuids).
- `puzzlebox_runs.id`: `bigint GENERATED ALWAYS AS IDENTITY` (schema:3187-3194), PK is `id` alone (no env), and
  `puzzlebox_best.run_id` references it (schema:4603-4604, ON DELETE CASCADE). Step 2 sync can insert the Supabase ids
  explicitly. **Step 5 problem:** prod D1 and testbed D1 would each assign their own next ids, and both mirror into the
  single Supabase table whose PK has no env, so mirrored ids collide; Supabase also refuses explicit ids on a
  `GENERATED ALWAYS` column without `OVERRIDING SYSTEM VALUE`. The designers need an id scheme for this table (for
  example a per-env id range, or a uuid/text id) before step 5.

### 2.5 D1 limits that bite in this domain

- Rows written count index writes too (one extra row per index touched). Free tier: 100k rows written per day.
- Free tier: 50 queries per Worker invocation (each `batch()` statement counts), 100 bound parameters per statement,
  100 KB SQL text, 2 MB per row/string. Worker CPU 10 ms per request.
- These shape the run upload (section 3.10) and the `game_elements` choice (section 3.8).

## 3. `runs` (History Course)

### 3.1 Statistics

- 687 live rows; ins 680, upd 699, del 75 (unshare / delete), hot upd 33. seq_scan 4,602 (1.83M tuples read),
  idx_scan 88,952.
- Size 7.88 MB total, heap 1.07 MB, TOAST 6.24 MB (almost all `raw`). Raw file median 57 KB, max 277 KB (CLEANUP 1);
  plan 6.1: production raw 584 files, 42.8 MB as JSON, average 64 KB.
- Updates come from: the counter trigger (likes/comments on `history-course:<id>` threads), cover saves, donor
  nickname sync, and past backfills.

### 3.2 Columns (schema:3238-3268)

| # | Column | Type | Null | Default | Notes |
|---|---|---|---|---|---|
| 1 | `id` | text | NOT NULL | - | content-hash run id (2.4) |
| 2 | `raw` | text | NOT NULL | - | the whole `.run` JSON file as text (decision 4: own table) |
| 3 | `seed` | text | NOT NULL | - | displayed; feed/profile title fallback |
| 4 | `build` | text | NOT NULL | - | game build id, e.g. `v0.98.x`; search tokens |
| 5 | `character` | text | NOT NULL | - | first player's character, `CHARACTER.IRONCLAD` |
| 6 | `ascension` | integer | NOT NULL | - | |
| 7 | `win` | boolean | NOT NULL | - | |
| 8 | `start_time` | bigint | null | - | unix seconds; combo picker sort key |
| 9 | `run_time` | integer | null | - | seconds |
| 10 | `acts_count` | integer | NOT NULL | - | not displayed by the list |
| 11 | `donor_user_id` | uuid | null | - | owner; FK auth.users SET NULL |
| 12 | `created_at` | timestamptz | **null** | `now()` | share time; guard forces `now()` on insert |
| 13 | `total_floors` | integer | NOT NULL | `0` | pre-extracted at insert |
| 14 | `env` | text | NOT NULL | `'production'::text` | dropped in D1 |
| 15 | `badges` | jsonb | NOT NULL | `'[]'::jsonb` | written, never selected (dead today, see 3.8) |
| 16 | `highlight_card` | jsonb | null | - | written, never selected (comment: "Deterministic final-deck card highlight for History Course index cards.") |
| 17 | `highlight_relic` | jsonb | null | - | written, never selected |
| 18 | `note_blocks` | jsonb | null | - | always written as `null` (`run-donation.ts:94`), never selected |
| 19 | `cover_spec` | jsonb | null | - | `CoverSpec` (comment: "YouTube-style cover: background, phrase, elements (1-3). See CoverSpec.") |
| 20 | `like_count` | integer | NOT NULL | `0` | counter trigger |
| 21 | `comment_count` | integer | NOT NULL | `0` | counter trigger |
| 22 | `donor_nickname` | text | NOT NULL | `'닉'::text` | synced to current nickname (2.1) |

`CoverSpec` shape (`src/lib/run-cover-types.ts`): `{ background: {kind:"character"} | {kind:"card-beta", cardId},
phrase, titlePhrase?, elements: [{kind:"card"|"relic"|"potion", id, copies?}] (1-3), auto: boolean, suggestSeed }`.
Measured 175-337 bytes (3.8). `auto: false` means a manual cover.

### 3.3 Constraints and indexes

CHECK constraints, verbatim (schema:3261-3267):

- `runs_badges_is_array CHECK ((jsonb_typeof(badges) = 'array'::text))`
- `runs_donor_nickname_len CHECK (((char_length(btrim(donor_nickname)) >= 1) AND (char_length(btrim(donor_nickname)) <= 20)))`
- `runs_env_check CHECK ((env = ANY (ARRAY['production'::text, 'development'::text])))`
- `runs_key_size_check CHECK (((octet_length(id) <= 1024) AND (octet_length(seed) <= 1024) AND (octet_length(build) <= 1024) AND (octet_length("character") <= 1024) AND (octet_length(donor_nickname) <= 1024)))`
- `runs_meta_size_check CHECK (((pg_column_size(note_blocks) <= 1048576) AND (pg_column_size(cover_spec) <= 1048576) AND (pg_column_size(badges) <= 131072) AND (pg_column_size(highlight_card) <= 131072) AND (pg_column_size(highlight_relic) <= 131072)))`
- `runs_note_blocks_is_array CHECK (((note_blocks IS NULL) OR (jsonb_typeof(note_blocks) = 'array'::text)))`
- `runs_raw_size_check CHECK ((octet_length(raw) <= 8388608))`

No CHECK validates `cover_spec` shape; the Worker caps it at 16 KB (`history-runs.ts:33`) and the client checks
`isCoverSpec`. `pg_column_size` is the compressed size; SQLite has no equivalent (use `length(CAST(x AS BLOB))`).
The raw cap (8 MiB) is above the D1 row limit (2 MB); real max is 277 KB; the Worker accepts up to 24 MB per upload
batch (`history-runs.ts:31`) and its comment says raw files up to 2 MB.

PK `runs_pkey PRIMARY KEY (id, env)` (schema:3709-3710). No UNIQUE. FK `runs_donor_user_id_fkey FOREIGN KEY
(donor_user_id) REFERENCES auth.users(id) ON DELETE SET NULL` (schema:4643-4644). Nothing references `runs`
(comments/likes point at it only through the text thread key `history-course:<id>`; deleting a run leaves its likes and
comments).

Indexes (istats.json, scans since 2026-06-02):

| Index | Definition | Scans | Notes |
|---|---|---|---|
| `runs_pkey` | `UNIQUE (id, env)` | 2,883 | detail, meta, cover, upsert conflicts, counter trigger |
| `idx_runs_created` | `(created_at DESC)` | 40,687 | legacy nav-seen `created_at > since` and the list (planner picks it, then filters env) |
| `idx_runs_env_created_desc` | `(env, created_at DESC)` | 35,502 | list, nav, defragment latest |
| `idx_runs_env` | `(env)` | 5,238 | dead per CLEANUP (prefix of the others) |
| `idx_runs_env_donor` | `(env, donor_user_id)` | 4,628 | own runs, nickname sync, profile activity |
| `idx_runs_env_comment_created` | `(env, comment_count DESC, created_at DESC, id DESC)` | 8 | defragment `comments` sort |
| `idx_runs_env_like_created` | `(env, like_count DESC, created_at DESC, id DESC)` | 4 | defragment `recommended` sort |
| `idx_runs_build` | `(build)` | 1 | dead |
| `idx_runs_character` | `("character")` | 1 | dead |

There is no `(env, start_time)` index for the combo picker (W2/L3).

### 3.4 Triggers

1. `runs_guard_server_columns BEFORE INSERT OR UPDATE ON public.runs FOR EACH ROW WHEN ((CURRENT_USER = ANY
   (ARRAY['anon'::name, 'authenticated'::name]))) EXECUTE FUNCTION public.guard_post_server_columns()` (schema:4408;
   function schema:2042-2073). For browser roles only (service role, SECURITY DEFINER and backfills bypass it):
   - INSERT: forces `like_count := 0`, `comment_count := 0`, `created_at := now()`. `env` and `donor_user_id` are
     taken from the client row (step 1 streams the upload body unparsed, so the client sets both; RLS checks the donor).
   - UPDATE: forces `id`, `env`, `like_count`, `comment_count`, `created_at` back to their old values. Every other
     column (including `raw`, `seed`, `build`, `character`, `win` ...) may be changed by the donor; the app only ever
     updates `cover_spec` and `donor_nickname`.
2. Counter trigger on another table: `likes_toybox_engagement_delta AFTER INSERT OR DELETE ON public.likes ... ('like')`
   (schema:4387) and `comments_toybox_engagement_delta AFTER INSERT OR DELETE ON public.comments ... ('comment')`
   (schema:4338) call `apply_toybox_thread_engagement_delta` (schema:253-370, SECURITY DEFINER). For
   `split_part(story_id, ':', 1) = 'history-course'` it takes `run_id := split_part(story_id, ':', 2)` and runs
   `update public.runs set comment_count = greatest(0, comment_count + delta) where id = run_id and env = rec.env`
   (or `like_count`), delta +1 on insert, -1 on delete, updates ignored (schema:276-287). Floors at 0.
   - Consequence: a run that is unshared (deleted) and shared again restarts at 0 while its likes/comments rows remain,
     so the counter undercounts. The History Course index does not use these counters (it counts rows, W3/L6); the
     defragment board does (W13/L15, `get_defragment_feed_v2`). STEP1_DESIGN 9.6 defers switching the index to the
     counters until they are checked. A `threads` table keyed by thread key (decision 3) survives run deletion.

No rate-limit trigger on runs. Write limits are the Worker's (`API_WRITE_LIMITER`).

### 3.5 RLS and grants (schema:5303-5330, 6071-6073)

- `ALTER TABLE public.runs ENABLE ROW LEVEL SECURITY`. `GRANT ALL ON TABLE public.runs TO anon / authenticated /
  service_role`, so RLS is the only gate.
- `runs_read FOR SELECT USING (true)` (role public): anyone, anon included, reads every row and every column,
  including `raw` and `donor_user_id`.
- `runs_insert FOR INSERT WITH CHECK ((auth.uid() = donor_user_id))`: only a signed-in user, only as themselves.
- `runs_update FOR UPDATE USING ((auth.uid() = donor_user_id)) WITH CHECK ((auth.uid() = donor_user_id))`: donor only;
  cannot hand the row to someone else.
- `runs_delete FOR DELETE USING ((auth.uid() = donor_user_id))`: donor only. The legacy delete sends only `id` and
  `env` (`run-donation.ts:726-731`); RLS turns someone else's delete into 0 rows with no error, and the UI treats
  "no error" as success.
- Upsert with `return=representation` relies on `runs_read` to return the inserted ids.

### 3.6 Functions that touch runs

| Function | What it does with runs |
|---|---|
| `guard_post_server_columns` | 3.4 |
| `apply_toybox_thread_engagement_delta` | 3.4 |
| `get_defragment_feed_v2(p_env, p_sort, p_limit, p_cursor_score, p_cursor_created_at, p_cursor_id text)` (schema:872-1125) | One branch of the federated board union (schema:1093-1113): `select p.id::text, p.created_at, p.like_count, p.comment_count, p.like_count::bigint, 'history_course', left(btrim(coalesce(nullif(p.seed, ''), p.id)), 120), p.donor_nickname, p.donor_user_id::text, null, null, null, null, jsonb_build_object('cover_spec', p.cover_spec, 'win', p.win, 'ascension', p.ascension, 'total_floors', p.total_floors) from public.runs p where p.env = $1 <cursor> order by <inner> limit $2`. Sorts: latest `p.created_at desc, p.id::text desc`; comments `p.comment_count desc, p.created_at desc, p.id::text desc`; recommended `p.like_count desc, ...`. Keyset: `(p.created_at, p.id::text) < ($4, $5)` or `(p.<count>::bigint, p.created_at, p.id::text) < ($3, $4, $5)` (schema:900-906). Page limit clamped 1..20. Each branch takes 20 then the outer query re-sorts and takes 20. 730 anon calls, mean 177 ms (stmts; the retired v1 `get_defragment_feed`, which has no runs branch, shows 732 + 752 authenticated calls). Called by the defragment board with no service filter (`defragment-feed.ts:273-291`, Worker `toybox.ts:89-107`). |
| `get_my_profile_activity` | `history_course` category (schema:1251-1261): `runs.id::text, 'history_course', runs.seed as content, null, runs.id::text as target_key, runs.created_at, 0 as like_count from public.runs where runs.env = p_env and runs.donor_user_id = (select auth.uid())`. Likes are always 0 even though `runs.like_count` exists. Section 4. |
| `get_my_profile_activity_stats` | same filter, counts rows, likes 0 (schema:1358-1364). Section 4. |
| `get_rls_activity_metrics` (admin, service role, 262 calls, mean 456 ms) | `select runs.donor_user_id, runs.created_at, 'history_course' from public.runs where runs.env = req.env_key and runs.donor_user_id is not null` (schema:1562-1566), aggregated into per-day active-user metrics in Asia/Seoul. Dev admin only (`admin-dev-page.tsx`, `readRlsActivityMetrics`). Note `admin_story_service()` maps `history-course:%` thread keys to `'other'` (schema:42-64), so run comments/likes count as "other" service in this metric. |

### 3.7 Every query against runs

W = Worker (production path when the `history-runs` / `toybox-feed` / `nav` group is `api`), L = legacy browser path,
D = dev only, B = build time, R = RPC body.

| # | Where | Op | Columns | Filter | Order / limit / cursor | Calls (stmts) | Used for |
|---|---|---|---|---|---|---|---|
| W1 | `workers/api/routes/history-runs.ts:74-81` (`view=recent`), via `streamSelect` `:58-72` | GET stream | `RUN_SUMMARY_COLUMNS` = `id,raw,seed,build,character,ascension,win,start_time,run_time,acts_count,total_floors,cover_spec,donor_user_id,created_at` (`history-runs-api-rules.ts:8-9`) | `env=eq.<env>` | `created_at.desc`, limit 100, no cursor, no pagination | 1,028 anon + 985 authenticated (mean 267 ms) for this column list, + 201 anon for an older list without `cover_spec`, + 5,183 anon for an even older list without `raw` | History Course index (7.9 MB per call in production) |
| W2 | `history-runs.ts:80` (`view=reference`) | GET stream | same 14 columns incl. `raw` | env | `start_time.desc`, limit 30 | not in top 50 | combo / defragment run picker (3.1 MB) |
| W3 | `history-runs.ts:102-132` | GET x2 | `likes.story_id`, `comments.story_id` | `env`, `story_id in ("history-course:<id>", ...)` up to 100 ids | limit 1000 each; Worker counts per id | not in top 50 | like/comment numbers on index cards |
| W4 | `history-runs.ts:83-100` `view=detail` | GET stream | `RUN_DETAIL_COLUMNS` = `id,raw,seed,build,character,ascension,win,start_time,run_time,acts_count,cover_spec,created_at` | `id=eq`, env | limit 1 | - | run detail when not in IndexedDB (up to 293 KB) |
| W5 | `history-runs.ts:91` `view=cover` | GET stream | `id,raw,cover_spec` | id, env | limit 1 | - | combo reference thumbnails whose snapshot has no cover (raw needed only to re-pick an auto cover) |
| W6 | `history-runs.ts:92-99` `view=meta` | GET | `id,character,cover_spec` | id, env | limit 1 | - | detail-page OG fields; "is it shared" |
| W7 | `history-runs.ts:134-151` `/api/me/history-runs[?id=]` | GET (user token) | `id` | env, `donor_user_id=eq.<sub>`, optional `id` | none, no limit | - | mark own cards shared; owner check |
| W8 | `history-runs.ts:154-178` POST `/api/write/history-runs` | INSERT stream (`return=minimal`) | whole client row (3.8 "write payload") | RLS | - | - | share one run (index, donation panel, combo picker) |
| W9 | `history-runs.ts:154-178` POST `/batch` | UPSERT stream `on_conflict=id,env`, `resolution=ignore-duplicates`, `return=representation`, `select=id` | array of client rows | RLS | - | - | upload-and-share many runs; answer = newly inserted ids |
| W10 | `history-runs.ts:180-199` PATCH `/cover?id=` | UPDATE | `cover_spec` | `id`, env, `donor_user_id=eq.<sub>`, `select=id` | - | - | save cover; also the follow-up after batch share and after a duplicate share |
| W11 | `history-runs.ts:201-218` POST `/nicknames` | UPDATE | `donor_nickname` | env, `donor_user_id=eq.<sub>`, `donor_nickname=neq.<nick>` | - | - | nickname sync on every index / defragment mount |
| W12 | `history-runs.ts:220-235` DELETE `?id=` | DELETE | `select=id` | id, env, `donor_user_id=eq.<sub>` | - | - | unshare |
| W13 | `workers/api/routes/toybox.ts:110-133` `/api/read/defragment-runs` | GET stream | `DEFRAGMENT_RUN_COLUMNS` = `id,created_at,like_count,comment_count,seed,donor_user_id,donor_nickname,cover_spec,win,ascension,total_floors` (`:39`) | env | latest: `created_at.desc,id.desc`; comments/recommended: `<count>.desc,created_at.desc,id.desc`; limit 20; keyset `or=(created_at.lt."c",and(created_at.eq."c",id.lt."i"))` or the 3-key form with the count | - (idx 8 + 4 scans on the count indexes) | defragment board filtered to History Course |
| W14 | `workers/api/routes/nav.ts:151-157` | GET | `created_at` | env, `created_at=not.is.null` | `created_at.desc.nullslast`, limit 1 | (Worker cache) | nav "new" dot for History Course |
| W15 | `get_defragment_feed_v2` runs branch (R, 3.6) via `toybox.ts:89-107` | RPC | 3.6 | env | 3.6 | 730 anon (v2) | unfiltered defragment board |
| L1 | `src/lib/run-donation.ts:210-218` (`selectDonatedRunForEnv`) | select maybeSingle | `RUN_DETAIL_COLUMNS` | id, env | - | - | = W4 |
| L2 | `run-donation.ts:238-245` | select | `RUN_SUMMARY_COLUMNS` | env | `created_at desc`, limit 100 | = W1 numbers | = W1 |
| L3 | `run-donation.ts:265-272` | select | `RUN_SUMMARY_COLUMNS` | env | `start_time desc`, limit 30 | - | = W2 |
| L4 | `run-donation.ts:292-295` | insert | client row | - | - | - | = W8 |
| L5 | `run-donation.ts:401-407` | upsert `onConflict: "id,env", ignoreDuplicates: true` `.select("id")` | rows | - | - | - | = W9 |
| L6 | `src/hooks/use-history-course-engagement.ts:55-73` | select x2 | `story_id` from likes / comments | env, `story_id in (...)` | limit 1000 | - | = W3 |
| L7 | `run-donation.ts:467-476` | update `.select("id")` | `cover_spec` | id, env, `donor_user_id = <uid from page>` | - | - | = W10 |
| L8 | `run-donation.ts:513-521` | select maybeSingle | `character, cover_spec` | id, env | - | - | = W6 (OG) |
| L9 | `run-donation.ts:553-561` | select maybeSingle | `id, raw, cover_spec` | id, env | - | - | = W5 |
| L10 | `run-donation.ts:584-592` | select maybeSingle | `id` | id, env | - | - | `isRunDonated` |
| L11 | `run-donation.ts:616-625` | select maybeSingle | `id` | id, env, `donor_user_id = <uid from page>` | - | - | `isOwnDonation` |
| L12 | `run-donation.ts:646-652` | select | `id` | env, `donor_user_id` | no limit | - | `listMyDonatedRunIds` |
| L13 | `run-donation.ts:670-678` | update | `donor_nickname` | env, `donor_user_id`, `donor_nickname <> nick` | - | - | = W11 |
| L14 | `run-donation.ts:724-731` | delete | - | id, env (no donor filter) | - | - | = W12 |
| L15 | `src/lib/defragment-feed.ts:186-209` | select | same 11 columns as W13 | env | same orders, `buildLatestFeedKeysetFilter` (`src/lib/toybox-feed-keyset.ts:8-15`) | - | = W13 |
| L16 | `src/lib/nav-seen.ts:312-327` | select | `created_at` | env, `created_at > since` | `created_at desc`, limit 1 | **29,101 anon + 5,325 authenticated** (mean 6-9 ms) | legacy nav dot |
| D1 | `workers/detail-shell-og.ts:284-288` (`fetchSupabaseRestSingleRow`, `:223-252`) | REST GET | `character, cover_spec` | `id=eq`, `env=eq`, limit 1 | - | off in prod and testbed (no Supabase vars) | detail HTML OG; plan moves it to a D1 binding |
| D2 | `src/app/(main)/dev/admin/admin-dev-page.tsx:507-525` | select count exact | `id, donor_user_id, character, ascension, win, created_at` | env | `created_at desc`, limit `ROW_LIMIT` | 3,640 anon (mean 20 ms) | dev admin service list |
| D3 | `src/app/api/dev/history-course-runs/route.ts:46-57` | select count exact | `id, seed, build, character, ascension, win, start_time, run_time, acts_count, total_floors, created_at` | `env = 'production'` | `created_at desc`, limit 100 | - | dev "import production runs" |
| D4 | `src/app/api/dev/history-course-runs/[runId]/route.ts:56-64` | select | same + `raw` | production, id | - | - | dev import one run |
| B1 | `src/app/(main)/history-course/[runId]/page-content.tsx:40` | `getDonatedRunOgFields` | - | - | - | - | build-time metadata only for the static shell id, which has no record (`metadataRecordId`), so no DB read in `next build`; real ids only under `next dev` |
| R1 | `get_my_profile_activity`, `_stats`, `get_rls_activity_metrics`, `get_defragment_feed_v2` | 3.6 | | | | | |

Callers in the UI: `history-course-run-index.tsx` (`:163` list, `:179` nickname sync, `:185` own ids, `:302,325`
cover save, `:357,364,376` delete, `:380` share), `run-upload-zone.tsx:183` (batch) and `:200` (cover follow-up),
`donation-panel.tsx:48,65,86,120`, `run-detail-loader.tsx:113,135`, `combo-history-run-picker.tsx:85,155`,
`combo-history-run-reference.tsx:102`, `defragment-client.tsx:79` (nickname sync blocks the board's first load until
it finishes, `:86`).

### 3.8 What the UI needs (decision 4: browser-computed summary columns)

How the list uses raw today: `listRecentDonatedRuns` -> `normalizeRunSummaryRow` (`run-donation.ts:185-196`) ->
`normalizeRunRow` (`:154-183`) parse `raw` with `parseReplayRun` for every row, then the index parses it again for
search (`history-course-run-index.tsx:262-272`, `parseDonatedReplay` `:645-652`). Field by field:

| Field the list uses | Where | Source today | Needed as server column |
|---|---|---|---|
| `id` | key, links `/history-course/<id>`, thread key `history-course:<id>` | column | yes |
| `seed`, `build`, `ascension`, `win`, `start_time`, `run_time`, `total_floors` | RunCard props (`history-course-run-index.tsx:517-531`), search haystack (`history-course-search.ts:276-305`) | columns (fallback to parsed raw) | yes (already columns) |
| `character` | RunCard, OG, search | column | yes |
| `characters` (party, array of `CHARACTER.*`) | RunCard portrait stack (`:520`), search (`history-course-search.ts:305-312`), combo snapshot | **parsed raw** (`partyCharacters`, `run-donation.ts:191`) | **new**, JSON array, display + client search; measured 20-89 bytes |
| `badges` (`[{id, rarity}]`, best rarity per badge over the party) | RunCard badge strip (`:528`), cover editor meta | **parsed raw** (`mergePartyBadges`, `run-donation.ts:176`); the stored `badges` column is not selected | yes; same function the upload already runs (`run-donation.ts:90`), so the stored column should already hold it (open check 10.5); measured 2-367 bytes |
| `cover_spec` (the cover to display) | RunCard thumbnail + title, search phrases, defragment title, OG | stored column if `auto === false`, else **re-picked from raw on every read**: `pickAlternatingCover(runId, parsedRun)` (`run-donation.ts:157-163`, `run-cover-suggest.ts:549-557`) | yes, server-side (decision 4). The upload stores `suggestDefaultCover(runId, run)` = the same pick (`run-donation.ts:95`), but the pick can drift when the cover algorithm or game data changes, so stored auto covers may differ from what the index shows today; the defragment board already shows the stored one (`defragment-client.tsx:113`). The backfill should recompute auto covers. |
| `donor_user_id` | owner check (`:483-485`), random pick excludes own runs (`random-pick-card.tsx:33-35`) | column | yes (or a boolean "mine" from `/api/me`) |
| `created_at` | sort "latest", tie-break by id (`history-course-index-sort.ts:19-44`) | column | yes |
| like/comment counts | sort "recommended"/"comments" (client-side over the 100), card numbers | W3 row counts | from `threads` (decision 3) |
| `game_elements` (array of `{type, id}`: every character, deck card, enchantment, relic, potion, modifier, and every card/relic/potion/event/ancient/encounter seen in the map history) | game-element filter chips and "popular elements" (`ComboGameElementFilter`, `:429-445`), keyword search (`historyCourseRunMatchesKeyword`) | **parsed raw** (`extractRunGameElements`, `history-course-search.ts:169-187`) | **new**. Filtered by element, but only in the browser over the 100 listed runs today. See sizing below |
| `game_mode` | keyword search (`history-course-search.ts:278`) | parsed raw | small new column, or fold into a search text column |
| cover phrase pool (strings) | keyword search (`history-course-search.ts:341-345`) | `coverPhrasePool(run, cover.elements)` | optional; measured 27-154 bytes |
| `highlight_card`, `highlight_relic` names | keyword search (`history-course-search.ts:348-355`, `:212-227`) | **parsed raw** (`buildRunHighlights`), stored columns not selected | not needed: the card is in the final deck and the relic in the final relics, both already in `game_elements`, and names come from the entity graph |
| `note_blocks` | RunCard note (`:530`) | never selected, always null | no (dead) |
| `raw` | owner cover editor only (`editingDonatedParsed` `:394-405`, `onEditCover` gated on `donated.raw` `:547-549`) | column | no: fetch W4 when the editor opens |
| `acts_count` | not shown by the list | column | keep (detail meta), not needed by the list |

Not shown by the list: `donor_nickname` (the defragment board shows it), `acts_count`, `like_count`/`comment_count`
columns.

Combo picker (`view=reference`) needs `id, character, characters, start_time, ascension, win, total_floors, run_time,
build, seed, cover_spec` (`history-run-reference.ts:63-87`); raw only re-picks auto covers (`:66-73`).
Defragment board needs `id, created_at, like_count, comment_count, seed, donor_user_id, donor_nickname, cover_spec, win,
ascension, total_floors` and sorts by the counts with a keyset (W13): the one place in this domain that sorts runs by a
count on the server (decision 3 input). OG / meta needs `id, character, cover_spec`. Detail needs `raw` and
`cover_spec` only (`run-detail-loader.tsx:135-151`); the other detail columns are recomputed from raw.

Write payload the browser sends today (`run-donation.ts:78-96`, `:310-317`, `:371-381`): `id, raw, donor_user_id,
donor_nickname, env, seed, build, character, ascension, win, start_time, run_time, acts_count, total_floors, badges,
highlight_card, highlight_relic, note_blocks (null), cover_spec`. The browser already parses the run at upload, so
adding `characters`, `game_elements`, `game_mode` costs nothing there.

Sizing (measured on the user's own 161 local run files with the project's code,
a one-off local script, not kept because it reads a personal save folder;
raw median 52 KB, max 277 KB, same max as production):

| Value | min | median | p90 | max | mean |
|---|---|---|---|---|---|
| `game_elements` entries | 30 | 103 | 163 | 397 | 107 |
| `game_elements` JSON bytes | 1,139 | 3,925 | 6,209 | 14,433 | 4,093 |
| distinct element types per run | 5 | 7 | 7 | 7 | 6 |
| `badges` JSON bytes | 2 | 34 | 104 | 367 | 43 |
| `characters` JSON bytes | 20 | 20 | 25 | 89 | 22 |
| display `cover_spec` JSON bytes | 175 | 261 | 305 | 337 | 254 |
| cover phrase pool JSON bytes | 27 | 76 | 115 | 154 | 80 |

Consequences for the designers:
- List payload: about 54 KB for 100 rows without raw (plan 6.1); + characters/badges ~7 KB; + `game_elements` ~410 KB.
  Sending `game_elements` with every list read is 8x the rest; loading it on first use of the filter is the other option
  (SURFACE_MAP open question 31).
- A `run_game_elements(run_id, type, id)` child table would hold about 687 x 107 = 73,500 rows (62,500 in prod D1).
  With its PK plus one lookup index that is roughly 150k-220k rows written for the first copy, over the 100k/day free
  limit, and every "wipe and refill D1" in steps 2-4 (plan 7.2) pays it again. A JSON TEXT column costs one row per run.
  No server query filters runs by element today; the filter runs in the browser over the 100 listed runs.

### 3.9 Dead per CLEANUP_AUDIT 3.1 (runs)

- Columns written but never read: `badges`, `highlight_card`, `highlight_relic`, `note_blocks` (writer in
  `run-donation.ts:78-96`, both paths, [L-live]). Note that `badges` gets a new reader if the list summary adopts it
  (3.8); the values are the same function's output.
- Indexes: `idx_runs_build`, `idx_runs_character` (1 scan each), `idx_runs_env` (prefix overlap).
- Legacy-column retry paths were already removed in the cleanup (`a8151bdb`).

### 3.10 Porting notes (runs)

- Upload limits: a batch share sends every picked run in one request (a comment mentions 42 runs). Splitting `raw`
  into its own table doubles the statements: 42 runs = 84 inserts > 50 queries per invocation (Free). Multi-row
  `INSERT ... VALUES` is capped by 100 bound parameters per statement (about 5 summary rows of ~20 columns, or 50
  `(run_id, raw)` pairs). Parsing a multi-MB upload body in the Worker also risks the 10 ms CPU limit (plan 6.1: 7.9 MB
  parse+serialise 27.7 ms in Node). Step 1 avoided both by streaming the body to PostgREST unparsed; step 5 cannot.
- `INSERT ... ON CONFLICT(id) DO NOTHING RETURNING id` replaces the ignore-duplicates upsert; "already shared" today is
  `sent - inserted` and also counts runs other people shared.
- The guard trigger's server columns (`created_at`, counters, immutable `id`) become Worker rules.
- `created_at` nullable plus Postgres NULLS FIRST: see 2.2.
- Cursor `id` comparisons: run ids are lowercase base36 with a leading digit; the defragment v2 keyset compares
  `p.id::text` with the database collation (not visible in a schema-only dump; open check 10.4).

## 4. Profile

### 4.1 `profile_character_nickname_pools`

- 10 rows (5 characters x 2 locales), ins 10, **upd 100** (admin saves), seq 624, idx 110, 64 KB. No env column.
- Columns (schema:3084-3092): `character_id text NOT NULL`; `locale text NOT NULL`; `nicknames text[] NOT NULL`;
  `updated_at timestamptz NOT NULL DEFAULT now()`.
- CHECKs, verbatim:
  - `profile_character_nickname_pools_character_check CHECK ((character_id = ANY (ARRAY['IRONCLAD'::text, 'SILENT'::text, 'REGENT'::text, 'NECROBINDER'::text, 'DEFECT'::text])))`
  - `profile_character_nickname_pools_locale_check CHECK ((locale = ANY (ARRAY['ko'::text, 'en'::text])))`
  - `profile_character_nickname_pools_nicknames_check CHECK (public.profile_nickname_list_is_valid(nicknames))`
- `profile_nickname_list_is_valid(nicks text[])` (schema:2082-2110, IMMUTABLE): false if null or cardinality < 1 or
  > 50; each element not null, `char_length` 1..20, equal to `btrim(nick)`, and no duplicates. SQLite CHECK cannot
  iterate a JSON array (no subqueries in CHECK, `json_each` is a table-valued function), so only
  `json_valid`/`json_type = 'array'`/`json_array_length BETWEEN 1 AND 50` fit in a CHECK; per-element rules move to the
  admin script/Worker (mirrored in `src/lib/profile-character-nicknames.ts`, limits 1..20 chars, 1..50 entries).
- PK `profile_character_nickname_pools_pkey PRIMARY KEY (character_id, locale)` (schema:3653-3654), 110 scans. No other
  index, no FK, no trigger.
- RLS: `profile_character_nickname_pools_select_public FOR SELECT TO authenticated, anon USING (true)` (schema:5197).
  `GRANT ALL` to anon/authenticated (schema:5995-5997) but there is no write policy, so browser writes are refused; the
  admin page writes with the service key.
- Queries:

| # | Where | Op | Columns | Filter / order | Calls | Notes |
|---|---|---|---|---|---|---|
| W1 | `workers/api/routes/profile.ts:20-31` `/api/read/profile/nicknames` | GET | `character_id,locale,nicknames` | none | not in top 50 | profile page mount, public |
| L1 | `src/hooks/use-profile-character-nicknames.ts:30-36` | select | same | none | - | |
| D1 | `admin-dev-page.tsx:596-600` | select | all | - | - | dev admin read |
| D2 | `admin-dev-page.tsx:629-640` | upsert `onConflict: "character_id,locale"` | 10 rows | - | - | dev admin save / reset; goes straight to the shared (env-less) table |

- UI: `profile-page.tsx:89` uses the pools to offer random nicknames per character and locale; failure falls back to
  built-in defaults (`DEFAULT_PROFILE_CHARACTER_NICKNAMES`). Read whole; the array is display-only, so JSON TEXT fits
  decision 2. SURFACE_MAP open question 40 suggests a static JSON instead.

### 4.2 `get_my_profile_activity(p_env, p_category default 'all', p_sort default 'latest', p_limit default 20, p_offset default 0)`

Schema:1165-1283. `LANGUAGE sql STABLE`, not SECURITY DEFINER (RLS applies; all source tables are publicly readable).
Granted to authenticated and service_role only (schema:5574-5576). Returns `activity_id text, category text, content
text, content_blocks jsonb, target_key text, created_at timestamptz, like_count bigint, total_count bigint`.

`own_activity` is a UNION ALL of six sources, each filtered by `env = p_env` and the owner column `= (select auth.uid())`:

| category | source | content | content_blocks | target_key | like_count |
|---|---|---|---|---|---|
| `stories` | `community_stories` | `sentence` | null | `'community:' \|\| id` | `count(likes.id)` joined on `likes.env = env and likes.story_id = 'community:' \|\| id` |
| `chemical_x` | `chemical_posts` | `content_text` | `content` | `id` | **0** (the table has a `like_count` column, unused here) |
| `this_or_that` | `this_or_that_posts` | `reason` | null | `id` | `count(this_or_that_post_likes.id)` on `env` and `post_id` |
| `combo` | `combo_posts` | `content_text` | `content` | `id` | **0** |
| `comments` | `comments` | `content` | `content_blocks` | `story_id` | `count(comment_likes.id)` on `comment_id` |
| `history_course` | `runs` (owner `donor_user_id`) | `seed` | null | `id` | **0** |

Transfigure, decisions-decisions, favorite-tournament, pagestorm and defragment posts are **not** part of the profile
today. With a common `posts` table the D1 query must filter to the `chemical_x`, `this_or_that`, `combo` services to
keep this behaviour.

Then `where p_category = 'all' or category = p_category`, `count(*) over () as total_count`, `order by case when p_sort =
'likes' then like_count end desc, created_at desc, activity_id desc`, `limit least(greatest(p_limit, 1), 50) offset
greatest(p_offset, 0)`. Offset paging, not keyset; `total_count` is the full count for the filter.

### 4.3 `get_my_profile_activity_stats(p_env)`

Schema:1292-1372, same six sources and owner filters, returns `category, count(*) as post_count, sum(like_count) as
like_count` grouped by category. Granted to authenticated and service_role (schema:5583-5585). Categories with no rows
are absent; the client fills zeros (`use-profile-activity.ts:113-122`).

### 4.4 Profile queries and UI

| # | Where | Op | Params | Calls (stmts) |
|---|---|---|---|---|
| W2 | `workers/api/routes/profile.ts:33-45` `/api/me/profile/stats` | RPC stats | `p_env` (Worker env) | 329 authenticated, mean 131 ms |
| W3 | `profile.ts:47-71` `/api/me/profile/activity?category=&sort=&offset=` | RPC activity | category in `all` + 6 categories, sort `latest`/`likes`, `p_limit = 20`, offset 0..10,000 (`src/lib/profile-activity-rules.ts:7-37`) | 412 authenticated, mean 97 ms |
| L2 | `src/hooks/use-profile-activity.ts:74-79` | RPC stats | | (same counter) |
| L3 | `use-profile-activity.ts:99-109` | RPC activity | first page and "more" (offset = rows received) | |

UI (`src/components/profile-activity.tsx`): stats tiles per category (post count, like count) `:270-300`; list items show
`content` / `content_blocks` (rich), `created_at`, `like_count`, link built from category and `target_key`
(`:97-110`: stories `/#community:<id>`, chemical `/chemical-x/<id>`, this-or-that `/this-or-that/<id>`, combo
`/c-c-c-combo/<id>`, history `/history-course/<id>`, comments `commentThreadHref(story_id)`). Filter by category, sort
latest/likes, "load more". Page size 20. Activity pages can be large because chemical/combo `content` rows go up to
1 MB each (SURFACE_MAP 28).

D1 shape of the work: per-user lookups by owner and time on each source (posts, comments, stories, runs), plus like
counts per item from `threads` (decision 3) or the like tables. Rows per user are small (the biggest table, runs, has
687 rows in total).

## 5. `contact_inquiries`

### 5.1 Statistics

11 rows, ins 11, upd 37 (admin replies and `reply_seen_at`), del 0, seq 3,326, idx 370, 112 KB.

### 5.2 Columns (schema:2751-2780)

| Column | Type | Null | Default | Browser may INSERT | Browser may SELECT | Browser may UPDATE |
|---|---|---|---|---|---|---|
| `id` | uuid | NOT NULL | `gen_random_uuid()` | - | yes | - |
| `user_id` | uuid | null | - | yes | **no** | - |
| `category` | text | NOT NULL | - | yes | yes | - |
| `message` | text | NOT NULL | - | yes | yes | - |
| `reply_email` | text | null | - | yes | **no** | - |
| `page_path` | text | NOT NULL | - | yes | yes | - |
| `service_locale` | text | NOT NULL | - | yes | yes | - |
| `game_locale` | text | NOT NULL | - | yes | yes | - |
| `viewport_width` | integer | null | - | yes | **no** | - |
| `viewport_height` | integer | null | - | yes | **no** | - |
| `env` | text | NOT NULL | `'production'::text` | yes | yes | - |
| `status` | text | NOT NULL | `'new'::text` | - (policy requires `new`) | yes | - |
| `created_at` | timestamptz | NOT NULL | `now()` | - | yes | - |
| `admin_response` | text | null | - | - | yes | - |
| `responded_at` | timestamptz | null | - | - | yes | - |
| `reply_seen_at` | timestamptz | null | - | - | yes | **yes (only column)** |

Column grants for `authenticated` (schema:5784-5889); `service_role` has ALL (schema:5777); anon has nothing. Private
admin fields: `reply_email`, `user_id`, `viewport_*` are never readable by the browser; `admin_response`/`responded_at`
are readable by the owner (that is the reply).

### 5.3 Constraints, verbatim (schema:2767-2779)

- `contact_inquiries_category_check CHECK ((category = ANY (ARRAY['bug'::text, 'correction'::text, 'feedback'::text, 'report'::text, 'partnership'::text, 'other'::text])))`
- `contact_inquiries_env_check CHECK ((env = ANY (ARRAY['development'::text, 'production'::text])))`
- `contact_inquiries_game_locale_check CHECK ((game_locale = ANY (ARRAY['kor'::text, 'eng'::text, 'zhs'::text, 'jpn'::text, 'deu'::text, 'fra'::text, 'ita'::text, 'spa'::text, 'esp'::text, 'ptb'::text, 'rus'::text, 'pol'::text, 'tha'::text, 'tur'::text])))`
- `contact_inquiries_message_check CHECK ((((char_length(message) >= 10) AND (char_length(message) <= 8000)) AND (message = btrim(message))))`
- `contact_inquiries_page_path_check CHECK ((((char_length(page_path) >= 1) AND (char_length(page_path) <= 512)) AND ("left"(page_path, 1) = '/'::text) AND (POSITION(('?'::text) IN (page_path)) = 0) AND (POSITION(('#'::text) IN (page_path)) = 0)))`
- `contact_inquiries_partnership_email CHECK (((category <> 'partnership'::text) OR (reply_email IS NOT NULL)))`
- `contact_inquiries_reply_email_check CHECK (((reply_email IS NULL) OR (((char_length(reply_email) >= 3) AND (char_length(reply_email) <= 254)) AND (reply_email = btrim(reply_email)) AND (reply_email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'::text))))`
- `contact_inquiries_response_pair CHECK ((((admin_response IS NULL) AND (responded_at IS NULL)) OR ((admin_response IS NOT NULL) AND (responded_at IS NOT NULL) AND ((char_length(admin_response) >= 1) AND (char_length(admin_response) <= 8000)) AND (admin_response = btrim(admin_response)))))`
- `contact_inquiries_service_locale_check CHECK ((service_locale = ANY (ARRAY['ko'::text, 'en'::text])))`
- `contact_inquiries_status_check CHECK ((status = ANY (ARRAY['new'::text, 'reviewing'::text, 'done'::text, 'spam'::text])))`
- `contact_inquiries_viewport_height_check CHECK (((viewport_height IS NULL) OR ((viewport_height >= 1) AND (viewport_height <= 10000))))`
- `contact_inquiries_viewport_width_check CHECK (((viewport_width IS NULL) OR ((viewport_width >= 1) AND (viewport_width <= 10000))))`

SQLite has no `~` regex (D1 has no user functions), so the e-mail regex moves to the Worker (already mirrored in
`src/lib/contact-rules.ts:24`, `EMAIL = /^[^\s@]+@[^\s@]+[.][^\s@]+$/`). `"left"(x,1)` -> `substr(x,1,1)`,
`POSITION(... IN ...)` -> `instr`. `btrim` and SQLite `trim` both trim spaces only.

PK `contact_inquiries_pkey PRIMARY KEY (id)` (schema:3549-3550). FK `user_id -> auth.users(id) ON DELETE SET NULL`.

Indexes:

| Index | Definition | Scans | Serves |
|---|---|---|---|
| `contact_inquiries_pkey` | `UNIQUE (id)` | 16 | admin update by id |
| `idx_contact_inquiries_user_created` | `(user_id, created_at DESC) WHERE (user_id IS NOT NULL)` | 205 | rate-limit count, own history (RLS adds `user_id = uid`) |
| `idx_contact_inquiries_env_status_created` | `(env, status, created_at DESC)` | 149 | admin list, dev "unchecked" count |
| `idx_contact_inquiries_unseen_replies` | `(user_id, env) WHERE ((user_id IS NOT NULL) AND (admin_response IS NOT NULL) AND (reply_seen_at IS NULL))` | **0** | meant for the mailbox dot; the planner never used it at 11 rows |

### 5.4 Triggers

1. `contact_inquiries_rate_limit BEFORE INSERT ... EXECUTE FUNCTION public.enforce_contact_inquiry_rate_limit()`
   (schema:4359; function schema:589-618, SECURITY DEFINER, `search_path ''`):
   - `if new.user_id is distinct from (select auth.uid()) then raise exception 'contact_inquiry_user_mismatch' using
     errcode = '42501'` (service-role inserts have no `auth.uid()`, so they pass only with `user_id` null).
   - Overwrites: `new.message := btrim(new.message)`, `new.reply_email := nullif(lower(btrim(new.reply_email)), '')`.
   - `pg_advisory_xact_lock(hashtextextended(new.user_id::text || ':' || new.env, 0))` to serialise one user's inserts.
   - If `count(*)` of the user's rows in the same env with `created_at > now() - interval '1 hour'` is `>= 3`: raise
     `'contact_inquiry_rate_limited'` errcode `P0001`. The Worker maps P0001 to 429 `rate_limited` (`contact.ts:48-52`);
     the client throws `ContactInquiryRateLimitError`.
2. `contact_inquiries_clear_reply_seen BEFORE UPDATE ... EXECUTE FUNCTION public.clear_contact_inquiry_reply_seen()`
   (schema:4352; function schema:376-388): if `admin_response` or `responded_at` changed (`is distinct from`), set
   `new.reply_seen_at := null`, so a new or edited admin reply lights the user's mailbox dot again. Users can only
   update `reply_seen_at`, so in practice it fires on admin updates.

D1 port: no advisory lock; a single `INSERT ... SELECT ... WHERE (SELECT count(*) ...) < 3` statement is atomic in
SQLite. The reply-seen reset becomes part of the admin script's UPDATE.

### 5.5 RLS (schema:4888-4908)

- `contact_inquiries_insert_owner FOR INSERT TO authenticated WITH CHECK (((( SELECT auth.uid() AS uid) = user_id) AND (status = 'new'::text)))`
- `contact_inquiries_select_owner FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id))`
- `contact_inquiries_update_reply_seen FOR UPDATE TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id))`
- No DELETE policy; anon has no grants. In words: a signed-in user inserts only their own `new` inquiry, reads only
  their own rows (minus the private columns), and may set only `reply_seen_at` on their own rows (to any value).
  Because the browser cannot read `user_id`/`reply_email`/`viewport_*`, inserts must use `return=minimal`.

### 5.6 Queries

| # | Where | Op | Columns | Filter | Order / limit | Notes |
|---|---|---|---|---|---|---|
| W1 | `workers/api/routes/contact.ts:33-55` `POST /api/write/contact-inquiries` | INSERT `return=minimal` | `category, message, reply_email, page_path, service_locale, game_locale, viewport_width, viewport_height` from `contactInquiryRow` (`src/lib/contact-rules.ts:44-90`) + `user_id = sub`, `env = Worker env` | - | - | body cap 48 KB; Worker re-checks every CHECK rule |
| W2 | `contact.ts:13-31` `GET /api/me/mailbox` | GET | `id` | env, `admin_response=not.is.null`, `reply_seen_at=is.null` (RLS adds owner) | limit 1 | nav mailbox dot (`use-mailbox-reply.ts`) |
| W3 | `workers/api/routes/profile.ts:73-92` `GET /api/me/profile/inquiries` | GET | `CONTACT_INQUIRY_HISTORY_COLUMNS` = `id,category,message,env,status,admin_response,reply_seen_at,created_at` (`profile-activity-rules.ts:39`) | env (RLS owner) | `created_at.desc`, limit 50 | profile inquiry history |
| W4 | `profile.ts:94-111` `POST /api/write/profile/inquiries-seen` | UPDATE `return=minimal` | `reply_seen_at = Worker now (toISOString)` | env, `admin_response=not.is.null`, `reply_seen_at=is.null` (RLS owner) | - | sent when the profile shows an unseen reply (`profile-activity.tsx:165-172`) |
| L1 | `src/lib/contact-inquiries.ts:98-111` | insert | same as W1 plus `user_id` from the page, `env` | - | - | |
| L2 | `contact-inquiries.ts:151-158` | select | history columns | **no env filter** | `created_at desc`, limit 50 | |
| L3 | `contact-inquiries.ts:180-190` | select | `id` | env, `admin_response not null`, `reply_seen_at is null` | limit 1 | |
| L4 | `contact-inquiries.ts:213-221` | update | `reply_seen_at = new Date().toISOString()` (`:217`) | env, admin_response not null, reply_seen_at null | - | |
| D1 | `admin-dev-page.tsx:169-182` | select count exact (service key) | `id,user_id,category,message,reply_email,page_path,service_locale,game_locale,env,status,admin_response,responded_at,created_at` | both envs | `created_at desc`, limit `CONTACT_ROW_LIMIT` (100) | dev admin inbox |
| D2 | `admin-dev-page.tsx:685-715` | update by id (service key) | `admin_response`, `responded_at = now ISO or null`, `status` (`done` if a response) | `id` | - | dev admin reply; trigger 2 resets `reply_seen_at` |
| D3 | `src/app/api/dev/contact-inbox/route.ts:30-35` | head count exact (service key) | `id` | `status = 'new'` (both envs) | - | dev mailbox pip |
| R1 | `enforce_contact_inquiry_rate_limit` | count | - | `user_id`, env, last hour | - | per insert |
| R2 | `get_rls_activity_metrics` (schema:1609-1613) | select | `user_id, created_at, 'contact'` | env, `user_id is not null` | - | admin metric |

No contact statement is in the top 50 by time. Plan 5.7: in D1 the admin inbox, replies and pools move to local scripts
with `wrangler d1 execute --remote`; nothing in the browser keeps a service key.

UI: `/contact` form (`contact-page.tsx`, calls `ensureUser` first); profile history shows `category`, `status`,
`created_at`, `message`, `admin_response` (`profile-activity.tsx:211-240`), the dot logic uses `admin_response` and
`reply_seen_at`. `env` and `responded_at` are not displayed.

### 5.7 Dead (CLEANUP 3.1)

`viewport_width`, `viewport_height`: written by both paths, never read (not even by the admin page select) [L-live].
`contactReplyIsUnseen` (code) was already removed.

## 6. Puzzlebox (짜증나는 퍼즐상자)

Design from the migration header (`supabase/migrations/20261104042911_puzzlebox_scores.sql:1-16`): clients send what
happened in a run, never a score; `submit_puzzlebox_run` replays it with the same numbers as
`src/lib/vexing-puzzlebox-score.ts` (a change there needs a matching change in SQL). Answers ship in the static pages,
so the server only refuses runs that could not have happened; the read RPCs drop scores above each board's maximum,
which the page passes in (`p_boards`). Only SECURITY DEFINER RPCs write. In the Worker the TS scorer can be imported
directly, removing the SQL/TS duplication.

### 6.1 Tables

`puzzlebox_runs` (schema:3164-3178): 23 rows, ins 23, upd 0, seq 7, idx 69.

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | bigint | NOT NULL | identity (`GENERATED ALWAYS`, sequence `puzzlebox_runs_id_seq`) |
| `env` | text | NOT NULL | - |
| `game` | text | NOT NULL | - |
| `board` | text | NOT NULL | - |
| `user_id` | uuid | NOT NULL | - |
| `attempt` | integer | NOT NULL | - |
| `score` | integer | NOT NULL | - |
| `perfect` | boolean | NOT NULL | - |
| `run` | jsonb | NOT NULL | - |
| `created_at` | timestamptz | NOT NULL | `now()` |

CHECKs: `puzzlebox_runs_board_check CHECK ((board ~ '^[1-9][0-9]{0,2}$'::text))`, `puzzlebox_runs_env_check CHECK ((env
= ANY (ARRAY['production'::text, 'development'::text])))`, `puzzlebox_runs_game_check CHECK ((game = ANY
(ARRAY['connections'::text, 'beta-quiz'::text])))`. (SQLite: the board regex can be written with `GLOB '[1-9]' OR GLOB
'[1-9][0-9]' OR GLOB '[1-9][0-9][0-9]'`.) PK `(id)`; FK `user_id -> auth.users ON DELETE CASCADE`. Indexes:
`puzzlebox_runs_user_board_idx (user_id, env, game, board, created_at DESC)` **0 scans**;
`puzzlebox_runs_user_created_idx (user_id, created_at DESC)` 46; pkey 23. `run` is the normalised replay
(`{guesses, rocks, rocksLeft, shown}` or `{questions, answers}`), an audit trail nobody reads.

`puzzlebox_best` (schema:3101-3111): 21 rows, upd 2, idx 331. Columns `env text`, `game text`, `board text`, `user_id
uuid`, `score integer`, `perfect boolean`, `run_id bigint`, `achieved_at timestamptz`, `attempts integer`, all NOT NULL,
no defaults, **no CHECKs**. PK `(env, game, board, user_id)` 234 scans. FKs `run_id -> puzzlebox_runs(id) ON DELETE
CASCADE`, `user_id -> auth.users ON DELETE CASCADE`. Indexes `puzzlebox_best_rank_idx (env, game, board, score DESC,
achieved_at)` 49; `puzzlebox_best_user_idx (user_id, env, game)` 48. One row per player and board: the best run; a
later equal score does not replace it, so reaching a score first ranks higher.

`puzzlebox_players` (schema:3144-3155): 8 rows, upd 15, idx 618. `user_id uuid NOT NULL` (PK), `nickname text NOT NULL`,
`avatar_id text`, `avatar_kind text`, `palette_id text`, `palette_swapped boolean NOT NULL DEFAULT false`, `hidden
boolean NOT NULL DEFAULT false` ("Set by an operator to keep a player out of every ranking"; no code sets it),
`updated_at timestamptz NOT NULL DEFAULT now()`. CHECKs: `puzzlebox_players_avatar_kind_check CHECK (((avatar_kind IS
NULL) OR (avatar_kind = ANY (ARRAY['character'::text, 'boss'::text]))))`, `puzzlebox_players_nickname_check CHECK
(((char_length(nickname) >= 1) AND (char_length(nickname) <= 24)))`. FK `user_id -> auth.users ON DELETE CASCADE`.
No env (2.3).

`puzzlebox_board_stats` (schema:3120-3135): 14 rows, upd 21, idx 175. `env text`, `game text`, `board text` (PK
`(env, game, board)`, no CHECKs), `players integer DEFAULT 0`, `cleared integer DEFAULT 0`, `perfect integer DEFAULT 0`,
`score_sum bigint DEFAULT 0`, `mistakes_sum integer DEFAULT 0`, `rocks_sum integer DEFAULT 0`, `purple_first integer
DEFAULT 0`, `level_solved integer[] DEFAULT '{0,0,0,0}'`, `question_wrong integer[] DEFAULT '{}'`, `wrong_picks
integer[] DEFAULT '{}'`, `speed_sum bigint DEFAULT 0`, all NOT NULL. Arrays are display-only (the rankings page draws
them), so JSON TEXT fits decision 2; they are updated element-wise (`v[i] += 1`), which in SQLite is
`json_set(col, '$[i]', json_extract(col, '$[i]') + 1)` or a Worker read-modify-write inside one batch.

### 6.2 RLS and grants

- `puzzlebox_runs_read_own FOR SELECT TO authenticated USING ((auth.uid() = user_id))` (schema:5249). **Dead**: no
  client reads it (CLEANUP 3.1).
- `puzzlebox_best_read_own FOR SELECT TO authenticated USING ((auth.uid() = user_id))` (schema:5210) and
  `puzzlebox_players_read_own ... USING ((auth.uid() = user_id))` (schema:5236): also no direct client reader (all reads
  go through SECURITY DEFINER RPCs); not listed by CLEANUP 3.1 but in the same state.
- `puzzlebox_board_stats_read FOR SELECT USING (true)` (role public, schema:5223), with SELECT grants to anon and
  authenticated; no direct reader either.
- Grants: service_role ALL on the four tables; authenticated SELECT on runs/best/players/stats; anon SELECT on
  board_stats; sequence ALL to anon/authenticated (schema:6004-6039). No INSERT/UPDATE grants for browsers.
- Function grants: `submit_puzzlebox_run` authenticated + service_role (schema:5698-5700);
  `get_puzzlebox_leaderboard` anon + authenticated (schema:5601-5604); `get_my_puzzlebox_standings` authenticated
  (schema:5592-5594); `puzzlebox_score_run` and `puzzlebox_run_display` service_role only (internal).

### 6.3 Functions

`puzzlebox_run_display(p_shown jsonb) RETURNS boolean[]` (schema:2119-2135, IMMUTABLE): requires an object with three
booleans `token`, `local`, `original` (what was on screen: pictures, game-language names, English names), at least one
true; returns `[token, local, original]`. Errors use errcode `22023`.

`puzzlebox_score_run(p_game, p_run jsonb) RETURNS jsonb` (schema:2144-2335, IMMUTABLE):
- `connections`: `guesses` array of 1..32 groups, each 4 levels in 0..3; `rocks` 0..3; `rocksLeft` 0..(3 - rocks);
  `shown` via `puzzlebox_run_display`. A guess is solved when all four levels match and the level is not solved yet,
  else a mistake; the run must end with 4 solved or 4 mistakes. Score = sum of `level_points[10,15,20,25]` for solved
  levels; if cleared: `+ mistake_bonus[20,10,5][mistakes+1]`, `+10/+5/+5` for pictures/local/English names hidden,
  `+ rocks_left * 10`; `+5` purple first (first solved = level 3, not reverse rainbow); `+10` reverse rainbow
  (`solved = [3,2,1,0]`). `perfect = cleared and mistakes = 0 and rocks = 0`. Returns `{score, perfect, cleared,
  mistakes, rocks, solved, run: {guesses, rocks, rocksLeft, shown}}`.
- `beta-quiz`: `questions` 1..30; `answers` 1..questions entries `{pick 0..3, correct bool, ms number, shown}`; stops at
  3 wrong. Per correct: 10 + speed (`ms >= 10000` 0, `<= 1000` 10, else `round(10*(10000-ms)/9000)`, ms clamped
  0..600000) + streak bonus (+2 from the 3rd in a row) + display bonus (5/2/2). Score = `correct*10 + speed +
  display_points + streak_points + greatest(0, 3 - wrong) * 5`; `perfect = correct = questions`; `cleared = wrong < 3`.
  Returns `{score, perfect, cleared, mistakes: wrong, rocks: 0, questions, picks, corrects, speed, run: {questions,
  answers}}`.
- Unknown game raises `22023`.

`submit_puzzlebox_run(p_env, p_game, p_board, p_run, p_player) RETURNS jsonb` (schema:2344-2546, SECURITY DEFINER):
1. `actor := auth.uid()`; null -> `42501`. `p_env` must be production/development, `p_board ~ '^[1-9][0-9]{0,2}$'`
   (else `22023`).
2. `pg_advisory_xact_lock(hashtextextended('puzzlebox:' || actor::text, 0))`: one submit at a time per player.
3. Score with `puzzlebox_score_run`.
4. Burst/abuse limit: exists a run by the actor in the same env/game/board with `created_at > now - 3 seconds`, or the
   actor's runs in the last day across **all envs** `>= 500` -> `54000` ('too many runs'; Worker -> 429).
5. Player token: `nickname := left(btrim(coalesce(p_player->>'nickname', '')), 24)` or `'?'`; `avatar_kind` kept only if
   `character`/`boss`; `avatar_id` only if `^[A-Z0-9_]{1,40}$`; `palette_id` only if `^[a-z0-9_-]{1,40}$`;
   `palette_swapped := coalesce(bool, false) and palette_id is not null`. Upsert `puzzlebox_players` on `user_id`
   (every column replaced, `updated_at = now`).
6. `select ... from puzzlebox_best where env, game, board, user_id = actor for update`; `attempt := coalesce(attempts,
   0) + 1`.
7. Insert `puzzlebox_runs (env, game, board, user_id, attempt, score, perfect, run = scored->'run', created_at = now)
   returning id`.
8. Best: insert if none (`attempts = 1`, improved); else if `score > best.score` replace score/perfect/run_id/
   achieved_at/attempts (improved); else only `attempts = v_attempt`.
9. If `attempt = 1` (each player's first finished run only): insert board_stats row if missing, lock it, add
   `players +1`, `cleared`, `perfect`, `score_sum`, `mistakes_sum`, `rocks_sum`; connections: `purple_first` when
   `solved[1] = 3`, `level_solved[level+1] += 1` for solved levels; beta-quiz: grow `question_wrong` to `questions`
   and `wrong_picks` to `questions * 4`, and for each wrong answer `question_wrong[i] += 1`,
   `wrong_picks[(i-1)*4 + pick + 1] += 1`; `speed_sum += speed`.
10. Rank: re-read best; `rank = count(*) filter (where b.score > best.score or (b.score = best.score and b.achieved_at
    < best.achieved_at)) + 1`, `players = count(*)` over `puzzlebox_best b join puzzlebox_players p on user_id` with
    `b.env = p_env and b.game = p_game and b.board = p_board and not p.hidden`. (Note: the board `players` stat counts
    every first run including hidden players; the rank `players` excludes hidden ones.)
11. Returns `{score, perfect, attempt, improved, best, best_perfect, rank, players}`.

`get_my_puzzlebox_standings(p_env, p_game, p_boards jsonb) RETURNS jsonb` (schema:1381-1414, SECURITY DEFINER, STABLE):
`valid` = entries of `p_boards` (object) whose value matches `^[0-9]{1,6}$` (board -> max score). `mine` = the actor's
best rows for env/game whose board is in `valid` and `score <= max_score`. For each: `better` = count of other best rows
on that board (players not hidden, `score <= max_score`) with higher score or equal score achieved earlier; `players` =
count of such rows. Returns `[{board, score, perfect, rank: better + 1, players}]`.

`get_puzzlebox_leaderboard(p_env, p_game, p_boards jsonb, p_board text default null, p_offset int default 0,
p_around_me bool default false) RETURNS jsonb` (schema:1423-1496, SECURITY DEFINER, STABLE, anon allowed):
- `valid` boards as above, optionally only `p_board`.
- `totals` per user over best rows of env/game on valid boards with `score <= max_score`, players not hidden:
  `score = sum(score)`, `perfect = bool_and(perfect)`, `perfect_count`, `boards = count(*)`, `attempts = sum(attempts)`,
  `achieved_at = max(achieved_at)`.
- `ranked`: `row_number() over (order by score desc, achieved_at asc, user_id)`.
- Each row: `{rank, score, perfect, perfect_count, boards, attempts, achieved_at, nickname, tag: left(md5(user_id::text),
  4), avatar_id, avatar_kind, palette_id, palette_swapped, is_me: user_id = auth.uid()}`.
- Page start: if `p_around_me` and the caller is ranked, `((my rank - 1) / 10) * 10`, else `greatest(0,
  least(p_offset, 100000))`; rows with `rank > start and rank <= start + 10`.
- Returns `{players: count(ranked), offset, rows, me, stats}`; `stats` only when `p_board` is given: the board_stats row
  as JSON minus `env` and `game`.
- Every call aggregates every best row of the game (21 rows now; grows with players x boards). SQLite has no `md5`; the
  Worker computes the tag (Workers' `crypto.subtle.digest` accepts the non-standard `MD5`) or stores it on the player.
  `achieved_at` is returned to the client, so its text format is part of the shadow comparison.

### 6.4 Queries

| # | Where | Op | Params | Calls |
|---|---|---|---|---|
| W1 | `workers/api/routes/puzzlebox.ts:28-51` `/api/read/puzzlebox/leaderboard` (no token) and `/api/me/puzzlebox/leaderboard` (token, `:111-118`) | RPC leaderboard | `game` in connections/beta-quiz; `boards` as `1:4,2:4` up to 500 boards, board 1-4 digits, max 1-6 digits (`src/lib/puzzlebox-api-rules.ts:15-50`); `board` `total` or number; `offset` <= 100,000; `around_me` 0/1 | 3 days of data, not in top 50 |
| W2 | `puzzlebox.ts:53-68` `/api/me/puzzlebox/standings` | RPC standings | game, boards | |
| W3 | `puzzlebox.ts:74-98` `POST /api/write/puzzlebox/runs` `{game, board, run, player}` | RPC submit | body cap 64 KB; board `^\d{1,4}$` (RPC narrows to 1-999) | |
| L1 | `src/hooks/use-puzzlebox-scores.ts:150-158` | RPC submit | after `ensureUser`; any error -> null | |
| L2 | `use-puzzlebox-scores.ts:243-252` | RPC leaderboard | 5-minute sessionStorage cache per key | |
| L3 | `use-puzzlebox-scores.ts:308-315` | RPC standings | only with a session (`hasSession`) | |

Callers: `connections-client.tsx` and `beta-art-quiz.tsx` (submit, standings, `p_boards` built from the page's own
board data), `rankings-client.tsx` (leaderboard). `player` = profile nickname (or the game's default) plus the author
token (`puzzleboxPlayer`, `use-puzzlebox-scores.ts:109-118`).

### 6.5 What the UI needs

- Rankings rows (`rankings-client.tsx`): `rank`, `score`, `perfect`, `perfect_count`, `achieved_at`, `nickname`, `tag`,
  `avatar_id`, `avatar_kind`, `palette_id`, `palette_swapped`, `is_me`; `players`, `offset`, `me`. `boards` and
  `attempts` are returned but not displayed.
- Board stats shown: `players`, `cleared`, `perfect`, `score_sum`, `mistakes_sum`, `purple_first`, `level_solved`,
  `question_wrong`, `wrong_picks`. `rocks_sum` and `speed_sum` are written but never displayed (likely what CLEANUP 3.1
  means by "columns only the RPC writes").
- Standings: `board`, `score`, `perfect`, `rank`, `players` per board in the game lists.
- Submit result: `score`, `perfect`, `attempt`, `improved`, `best`, `best_perfect`, `rank`, `players`.

### 6.6 Query shapes for D1 (no env)

- Burst check: runs by `(user_id, game, board, created_at > now - 3s)`; daily cap: runs by `(user_id, created_at > now -
  1 day)` count up to 500 (rows read up to 500 per submit for a heavy player; a per-user daily counter is the cheaper
  form).
- Best by PK `(game, board, user_id)`; my bests by `(user_id, game)`.
- Rank on a board: best rows by `(game, board)` ordered `score DESC, achieved_at ASC`, joined to players for `hidden`.
- Leaderboard totals: all best rows by `(game)` plus players (full per-game aggregate per call; small today).
- Board stats by PK `(game, board)`.

## 7. `colorful_philosopher_posts` (다채로운 철학자들)

### 7.1 Table

28 rows (25 production), ins 28, upd 63 (reaction-count trigger from the dead reactions table, plus admin edits), seq
50,463 (1.13M tuples, mostly the nav weekly read), idx 174, 48 KB.

Columns (schema:2587-2608):

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | uuid | NOT NULL | `gen_random_uuid()` | post page `/colorful-philosophers/<id>`, reply thread `colorful-philosophers:<id>` |
| `env` | text | NOT NULL | (none) | |
| `week_start` | date | NOT NULL | - | Monday (KST) of the week |
| `slot` | text | NOT NULL | - | `topic`, `card`, `relic` (`power` allowed by CHECK, never written by the admin page) |
| `resource_type` | text | NOT NULL | - | equals slot except for `topic` |
| `resource_id` | text | NOT NULL | - | codex id; reaction target with `game_version` |
| `name_ko`, `name_en` | text | NOT NULL | - | display |
| `image_url` | text | null | - | display |
| `body` | text | NOT NULL | - | 1..500 chars, display |
| `game_version` | text | NOT NULL | - | reaction key part |
| `buff_count`, `nerf_count`, `rework_count` | integer | NOT NULL | `0` | **dead** (frozen; screens read `resource_reaction_counts`) |
| `created_at` | timestamptz | NOT NULL | `now()` | never selected by any reader |

CHECKs, verbatim (schema:2603-2606):
- `colorful_philosopher_posts_env_check CHECK ((env = ANY (ARRAY['production'::text, 'development'::text])))`
- `colorful_philosopher_posts_slot_check CHECK ((slot = ANY (ARRAY['topic'::text, 'card'::text, 'relic'::text, 'power'::text])))`
- `colorful_philosopher_posts_text_check CHECK ((((char_length(resource_id) >= 1) AND (char_length(resource_id) <= 80)) AND ((char_length(name_ko) >= 1) AND (char_length(name_ko) <= 120)) AND ((char_length(name_en) >= 1) AND (char_length(name_en) <= 120)) AND ((char_length(body) >= 1) AND (char_length(body) <= 500)) AND ((char_length(game_version) >= 1) AND (char_length(game_version) <= 32))))`
- `colorful_philosopher_posts_type_check CHECK ((((slot = 'topic'::text) AND (resource_type <> 'topic'::text)) OR (resource_type = slot)))`

PK `colorful_philosopher_posts_pkey (id)` 56 scans. UNIQUE INDEX `colorful_philosopher_posts_env_week_slot ON (env,
week_start, slot)` 118 scans (schema:3757): one post per slot per week; in D1 `UNIQUE (week_start, slot)`. No index on
`(env, resource_type, resource_id)` for the per-resource thread (W16/L21). Referenced by
`colorful_philosopher_reactions.post_id` (dead table). No trigger on this table itself (the dead reactions table's
trigger `apply_colorful_philosopher_reaction_counts`, schema:71-112, updates its counts).

RLS: `colorful_philosopher_posts_select FOR SELECT TO authenticated, anon USING (true)` (schema:4732); grants SELECT to
anon/authenticated, ALL to service_role (schema:5716-5718). Only the dev admin page writes (service key).

### 7.2 Queries

| # | Where | Op | Columns | Filter | Order / limit | Calls |
|---|---|---|---|---|---|---|
| W15 | `workers/api/routes/colorful-philosophers.ts:48-68` `/week` | GET | `PHILOSOPHER_POST_COLUMNS` (`:14-15`) = `id,week_start,slot,resource_type,resource_id,name_ko,name_en,image_url,body,game_version,buff_count,nerf_count,rework_count` | env | `week_start.desc`, limit 100 (includes future reserved weeks; the client hides them, `index-view.tsx:44-47`) | not in top 50 |
| W15b | same, `replyCounts` `:25-46` | GET comments | `story_id` | env, `story_id in ("colorful-philosophers:<id>",...)` | limit 1000; counted in the Worker | |
| W16 | `colorful-philosophers.ts:70-87` `/post?id=` | GET | same 13 columns | env, `id` (lower-cased) | limit 1 | |
| W17 | `colorful-philosophers.ts:89-104` `/reel` | GET | `REEL_COLUMNS` (no counts) | env, `week_start <= kstWeekStart(now)` | `week_start.desc`, limit 12 | |
| W18 | `workers/api/routes/nav.ts:149` | GET | `week_start` | env, `week_start <= this week` | `week_start.desc`, limit 1 | (Worker nav cache) |
| W19 | `workers/api/routes/comments.ts:220-233` (`readPhilosophers`, codex detail engagement) | GET | `PHILOSOPHER_COLUMNS` (`:40-41`, same 13) | env, `resource_type`, `resource_id` | `week_start.desc`, limit 20 (`PHILOSOPHER_POSTS_PER_RESOURCE`, `src/lib/engagement-keys.ts:31`) | |
| L17 | `src/hooks/use-colorful-philosopher-posts.ts:86-91` | select | `POST_COLUMNS` (`:19`, same 13) | env | `week_start desc`, limit 100 | |
| L18 | `use-colorful-philosopher-posts.ts:186-191` | select maybeSingle | same | id, env | - | |
| L19 | `use-colorful-philosopher-posts.ts:228-231` | select comments | `story_id` | env, `story_id in` | limit 1000 | |
| L20 | `src/components/patches/patch-comments-client.js:1729-1750` (`refreshReelWeek`; api `:1736`, REST `:1747`) | GET | 10 reel columns | env, `week_start=lte.<this week>` | `week_start.desc`, limit 12 | shell patch pages |
| L21 | `src/components/colorful-philosophers/resource-thread.tsx:71-79` | select | 13 columns | env, resource_type, resource_id | `week_start desc`, limit 20 | |
| L22 | `src/lib/nav-seen.ts:295-310` | select | `week_start` | env, `week_start <= this week` | desc, limit 1 | **19,289 anon** (mean 6 ms) |
| B1 | `src/lib/colorful-philosophers-gallery.ts:34-63` (build: shell patch HTML) | select | `COLUMNS` (`:12`, 13 columns) | env, `week_start <= currentWeek` | desc, limit 12; then `resource_reaction_counts` by `resource_id in` (`:73-90`) | build only |
| D5 | `src/components/patches/backstab-colorful-philosophers-section.tsx:164-175` | select | 13 columns | env, `week_start <= this week` | desc, limit 12 | dev only (`/dev/patch-types` hydration) |
| D6 | `use-colorful-philosopher-posts.ts:120-145` (`useColorfulPhilosophersNextWeekOpen`) | select | `slot` | `env = 'production'`, `week_start = next Monday` | - | dev nav only |
| D7 | `src/app/(main)/dev/colorful-philosophers/actions.ts:84-97` | upsert `onConflict: "env,week_start,slot"` `.select(13 columns).single()` | `env, week_start, slot, resource_type, resource_id, name_ko, name_en, image_url, body, game_version` | - | - | dev admin save (keeps `id` on conflict) |

UI: weekly list (`index-view.tsx`), post page (`post-view.tsx`), shell patch reel, codex detail threads, nav dot
(published at Monday 00:00 KST, `weeklyPublishedAt`). Displayed: `week_start`, `slot`, `resource_type/id` (links and
reaction target), `name_ko/en`, `image_url`, `body`, `game_version`; reply counts per post. Not displayed:
`created_at`, the three dead counts (the row mapper defaults them to 0 when absent,
`src/lib/colorful-philosophers.ts:170-172`, so omitting them in D1 is safe for clients; the shadow comparator must
ignore them).

### 7.3 Dead (CLEANUP 3.1)

- Table `colorful_philosopher_reactions` (2 rows; PK `(post_id, user_id)`; CHECK `kind IN ('buff','nerf','rework')`;
  FKs to posts and auth.users; trigger `colorful_philosopher_reactions_counts`; function
  `apply_colorful_philosopher_reaction_counts`; policies `_select`, `_insert`, `_update`, `_delete`): not ported. Its
  rows were already copied into `resource_reactions`.
- Columns `buff_count`, `nerf_count`, `rework_count`: not ported; still named in 7 column lists that must stop asking
  for them before Supabase drops them in step 7: `PHILOSOPHER_POST_COLUMNS` (W15/W16), `PHILOSOPHER_COLUMNS` (W19),
  `POST_COLUMNS` (L17/L18), `resource-thread.tsx` (L21), gallery `COLUMNS` (B1), the backstab section (D5) and the
  admin upsert's `.select` (D7).

## 8. Index needs derived from the queries (no env prefix)

Inputs for decision 6; one line per distinct access path. "Rows" is the expected scan size today.

| Table | Access path (queries) | Needed order | Rows |
|---|---|---|---|
| runs | list latest 100 (W1/L2) | `created_at DESC` (+ `id` tie-break, NULL handling 2.2) | 100 |
| runs | combo picker 30 (W2/L3) | `start_time DESC` (no index today) | 30 |
| runs | one run by id (W4-W6, L1, L8-L10, D1, counter updates, cover/delete) | PK `id` | 1 |
| runs | own runs (W7, W10-W12, L11-L13, profile activity/stats) | `donor_user_id` (+ `created_at DESC` for the profile sort) | few |
| runs | defragment history filter, latest (W13/L15) | `(created_at DESC, id DESC)` keyset | 20 |
| runs | defragment history filter by comments / likes (W13/L15) | `(comment_count DESC, created_at DESC, id DESC)` / `(like_count DESC, ...)` keyset, or the same keys on posts/threads if runs join `posts` | 20 |
| runs | unfiltered defragment board branch (`get_defragment_feed_v2`) | same three keysets | 20 per branch |
| runs | nav latest (W14) | `created_at DESC`, non-null | 1 |
| profile pools | all rows (W1/L1) | none (10 rows) | 10 |
| contact | rate limit (trigger) | `(user_id, created_at)` | <= 3 |
| contact | own history (W3/L2) | `(user_id, created_at DESC)` | <= 50 |
| contact | mailbox dot / mark seen (W2/W4) | `(user_id)` with `admin_response IS NOT NULL AND reply_seen_at IS NULL` (partial) | few |
| contact | admin list / new count (D1-D3, local scripts) | full scan acceptable (11 rows) or `(status, created_at)` | 11 |
| puzzlebox_runs | burst check | `(user_id, game, board, created_at)` | few |
| puzzlebox_runs | daily cap | `(user_id, created_at)` | up to 500 |
| puzzlebox_best | own best, upsert | PK `(game, board, user_id)` | 1 |
| puzzlebox_best | rank on a board, standings | `(game, board, score DESC, achieved_at)` | players on board |
| puzzlebox_best | my standings | `(user_id, game)` | my boards |
| puzzlebox_best | leaderboard totals | `(game)` prefix of the rank index | all bests of a game |
| puzzlebox_players | join / upsert | PK `user_id` | 1 per row |
| puzzlebox_board_stats | stats read / update | PK `(game, board)` | 1 |
| philosopher posts | week list, reel, nav weekly (W15, W17, W18, L17, L20, L22, B1) | `week_start DESC` (UNIQUE `(week_start, slot)` covers it) | 1-100 |
| philosopher posts | by id (W16, L18) | PK | 1 |
| philosopher posts | per resource (W19, L21) | `(resource_type, resource_id, week_start DESC)` (missing today) | <= 20 |
| philosopher posts | admin upsert (D7) | UNIQUE `(week_start, slot)` | 1 |

## 9. What this domain does not port (and why)

- `colorful_philosopher_reactions` with its trigger, function and four policies (CLEANUP 3.1, rows already in
  `resource_reactions`).
- Columns `colorful_philosopher_posts.buff_count/nerf_count/rework_count`; `runs.highlight_card`,
  `runs.highlight_relic`, `runs.note_blocks`; `contact_inquiries.viewport_width/viewport_height` (CLEANUP 3.1). `runs.badges`
  is listed dead today, but decision 4 gives it a reader (3.8), so the designers decide whether to keep it as the
  browser-computed summary column.
- Indexes `idx_runs_build`, `idx_runs_character`, `idx_runs_env`; every other Postgres index is re-derived (section 8)
  rather than carried over.
- Policy `puzzlebox_runs_read_own` (no reader). RLS as a whole becomes Worker checks in step 4.
- `env` columns everywhere (decision 1).

## 10. Open checks before writing DDL (all answerable offline from the step-0 dump)

1. Count `runs` rows with `created_at IS NULL` and with `start_time IS NULL` per env (NULL ordering, 2.2).
2. Count `runs` rows with `total_floors = 0` (rows from before the column existed would show 0 floors today and should
   be recomputed by the backfill).
3. For auto covers (`cover_spec->>'auto' <> 'false'` or null), compare the stored `cover_spec` with today's
   `pickAlternatingCover(id, parse(raw))`: how many differ (3.8).
4. Database collation (`datcollate`) and whether any keyset compares text ids under a non-C collation (defragment v2
   compares `p.id::text`).
5. Whether stored `runs.badges` equals `mergePartyBadges(parse(raw))` for all rows (then the backfill can copy it).
6. `game_elements` size on the real 687 runs (the local measurement in 3.8 is from 161 of the user's own runs).
7. How many `history-course:` likes/comments rows exist per run versus `runs.like_count/comment_count` (counter drift
   after unshare/re-share, 3.4).
8. Puzzlebox: max `puzzlebox_runs.id` per env and the id plan for step 5 (2.4).
