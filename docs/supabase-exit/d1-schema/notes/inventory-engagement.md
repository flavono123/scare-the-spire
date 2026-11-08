> Working notes from the 2026-11-08 D1 schema survey. [D1_SCHEMA_DESIGN.md](../../D1_SCHEMA_DESIGN.md) takes precedence
> where they differ. Paths under `scratchpad/` were temporary and are not kept.

# D1 step 2 inventory: engagement domain

Scope: `comments`, `comment_likes`, `likes`, `resource_reactions`, `resource_reaction_counts`, `community_stories`
(이야기), the thread-key scheme, every place that counts likes and comments, the nav "latest" reads, the courier
(배달원) recent-comments read, and the existing D1 tables `runtime_flags`, `runtime_flag_events`, `api_cache`.

## 0. How to read this

- `schema:N` = line N of `/Users/flavono123/slseoun-backups/supabase/20261105-2048/public-schema.sql` (pg_dump of
  production, 2026-11-05). The 2026-11-07 catalog dumps (`cols.json`, `checks.json`, `policies.json`) match the dump
  for every table in scope; nothing changed in between.
- Paths without a leading `/` are relative to the worktree `/Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit`.
- Stats window: `pg_stat_*` since 2026-06-02 13:43 UTC (no restart) to 2026-11-07, about 158 days. "per day" =
  calls / 158. Row counts (`n_live_tup`) and scans are **both envs together**; the stats have no env split.
- `stmts.json` is only the top 50 statements by total time. A query missing from it had less total time, not
  necessarily fewer calls. Statement numbers below (`#2`) are positions in `stmts.json`.
- "Worker" = the step-1 `/api` Worker (`workers/api/routes/*.ts`), today running on Supabase. "Legacy" = browser
  supabase-js (`src/hooks`, `src/lib`, `src/components`). "Patch client" = the static patch-page script
  `src/components/patches/patch-comments-client.js` (raw PostgREST `fetch`). Production `runtime_flags` has 0 rows, so
  **production traffic today is 100% legacy**; testbed has all 9 groups on `api`.
- Rate limits in this domain exist only in the Worker (no DB trigger rate-limits any table here):
  `API_READ_LIMITER` 600 req / 60 s per `cf-connecting-ip` on routes with `rateLimit: "ip"`
  (`read.engagement`, `read.engagement-counts`, `read.stories`); `API_WRITE_LIMITER` 30 / 60 s per verified sub on
  every write and `/api/me/*` (`workers/api/rate-limit.ts:13-16`, `router.ts:235-250`).

### 0.1 Size and IO at a glance (tstats.json, 2026-11-07)

| table | live rows | ins / upd / del (lifetime) | seq_scan / tuples read | idx_scan | total bytes |
|---|---:|---|---|---:|---:|
| comments | 385 | 397 / 0 / 65 | 97,897 / 23,893,643 | 86,283 | 335,872 |
| likes | 301 | 353 / 0 / 130 | 49,297 / 7,855,988 | 59,597 | 311,296 |
| comment_likes | 58 | 74 / 0 / 14 | 13,421 / 647,022 | 16,222 | 57,344 |
| resource_reaction_counts | 25 | 25 / 191 / 0 | 32,153 / 614,493 | 1,299 | 65,536 |
| community_stories | 26 | 42 / 1 / 16 | 25,825 / 432,243 | 1,904 | 147,456 |
| resource_reactions | 76 | 189 / 25 / 45 | 4,329 / 207,973 | 536 | 65,536 |

871 rows in scope. `comments` is the table with the most sequential tuples read in the whole database (the courier
and `get_engagement_counts`, both without a fitting index). Thread count: 272 distinct thread keys in production
(CLEANUP_AUDIT 1), 271 rows from `get_engagement_counts` on 2026-11-05 (plan 6.1, 24 KB), 372 distinct keys in
`comments` ∪ `likes` across both envs on 2026-11-06 (STEP1_DESIGN 9.1). Per-prefix distribution was not measured.

---

## 1. `comments`

### 1.1 Columns (schema:2678-2702)

| # | column | type | null | default | notes |
|---|---|---|---|---|---|
| 1 | id | uuid | NOT NULL | `gen_random_uuid()` | PK |
| 2 | story_id | text | NOT NULL | | the thread key (§7) |
| 3 | user_id | uuid | NOT NULL | | FK auth.users; public (owner check in UI) |
| 4 | nickname | text | NOT NULL | | author snapshot |
| 5 | content | text | NOT NULL | | text with card-con/text-con/emote markers |
| 6 | created_at | timestamptz | **NULL** | `now()` | nullable; client inserts are forced to `now()` by trigger |
| 7 | env | text | NOT NULL | `'production'::text` | dropped in D1 (decision 1) |
| 8 | content_blocks | jsonb | NULL | | `COMMENT ON COLUMN`: 'Optional rich content block array for chemical-x style comment rendering.' (schema:2708) |
| 9 | avatar_id | text | NULL | | author snapshot |
| 10 | avatar_kind | text | NULL | | author snapshot (`"character" \| "boss"` in `src/lib/user-profile.ts:11`, not checked in DB) |
| 11 | palette_id | text | NULL | | author snapshot |
| 12 | palette_swapped | boolean | NULL | `false` | author snapshot |
| 13 | parent_id | uuid | NULL | | **dead** (CLEANUP_AUDIT 3.1) |
| 14 | meta | jsonb | NULL | | **dead** (CLEANUP_AUDIT 3.1) |

### 1.2 Constraints

- PK `comments_pkey PRIMARY KEY (id)`.
- No UNIQUE besides the PK.
- FK `comments_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.comments(id) ON DELETE CASCADE` (dead column).
- FK `comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE`.
- CHECKs, verbatim:
  - `comments_author_token_size_check CHECK ((((COALESCE(octet_length(avatar_id), 0) + COALESCE(octet_length(avatar_kind), 0)) + COALESCE(octet_length(palette_id), 0)) <= 1024))`
  - `comments_blocks_size_check CHECK (((pg_column_size(content_blocks) <= 131072) AND (pg_column_size(meta) <= 131072)))`
  - `comments_content_length_check CHECK (((char_length(content) >= 1) AND (char_length(content) <= 2000)))`
  - `comments_env_check CHECK ((env = ANY (ARRAY['production'::text, 'development'::text])))`
  - `comments_key_size_check CHECK ((octet_length(story_id) <= 1024))`
  - `comments_nickname_check CHECK (((char_length(nickname) >= 1) AND (char_length(nickname) <= 20)))`
- Conversion notes: `char_length` = SQLite `length()` on TEXT (code points). `octet_length` = `length(CAST(x AS BLOB))`.
  `pg_column_size(jsonb)` is the stored (possibly TOAST-compressed) size, **not** the JSON text length, so a row that
  passes the PG check can be longer than 131072 bytes as JSON text; measure the max `length(content_blocks)` during the
  dump conversion before choosing a byte CHECK.
- No `thread exists` check: `story_id` is a free string (≤ 1024 bytes); there is no FK from comments to any post.

### 1.3 Indexes (istats.json)

| index | definition | idx_scan |
|---|---|---:|
| comments_pkey | `(id)` | 181 |
| idx_comments_story_env | `(story_id, env, created_at)` | 71,307 |
| idx_comments_env_user_created | `(env, user_id, created_at DESC)` | 7,808 |
| idx_comments_env_story | `(env, story_id)` | 6,987 |

There is no `(env, created_at)` index, so the courier (§1.6 Q-C5) sorts after a full scan.

### 1.4 Triggers

- `comments_guard_server_columns BEFORE INSERT ON public.comments FOR EACH ROW WHEN ((CURRENT_USER = ANY (ARRAY['anon'::name, 'authenticated'::name]))) EXECUTE FUNCTION public.guard_insert_server_columns()` (schema:4331).
  `guard_insert_server_columns()` (schema:2022): `new.created_at := now();` and, only when
  `tg_table_name = 'community_stories'`, `new.static_story_id := null;`. So a client cannot choose `created_at`;
  service-role inserts (seeds, restores) keep the supplied value.
- `comments_toybox_engagement_delta AFTER INSERT OR DELETE ON public.comments FOR EACH ROW EXECUTE FUNCTION public.apply_toybox_thread_engagement_delta('comment')` (schema:4338): bumps `comment_count` on the post table the key
  points to (§8.1). UPDATE is ignored (there are no updates anyway).

### 1.5 RLS (enabled, schema:4834) and grants

- `comments_read FOR SELECT USING (true)` (role public): everyone, anon included, reads every row and every column,
  including `user_id`, `parent_id`, `meta`, `env`.
- `comments_insert FOR INSERT WITH CHECK ((auth.uid() = user_id))`: any signed-in (anonymous) user inserts rows owned
  by themself, into either env, on any thread key.
- `comments_delete FOR DELETE USING ((auth.uid() = user_id))`: owner deletes own row.
- No UPDATE policy: comments are immutable for clients (`n_tup_upd` = 0).
- `GRANT ALL ON TABLE public.comments TO anon, authenticated, service_role` (schema:5759-5761): RLS is the only gate.
- Worker input rules (`workers/api/routes/comments.ts:501` `parseCommentInput`), stricter than the DB: thread key
  `^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$`; nickname trimmed, 1–20 code points; content `trim().length >= 2` and
  ≤ 2000 code points (DB allows 1); `contentBlocks` array or null, JSON ≤ 128 KiB; author fields ≤ 64 chars each,
  `paletteSwapped` boolean or null; author omitted ⇒ columns not sent (DB defaults). Client limits:
  `COMMENT_MIN_CHARS = 2`, `COMMENT_MAX_CHARS = 200` (visible plain text), `COMMENT_STORAGE_MAX_CHARS = 2000`
  (`src/lib/content-limits.ts:1-9`).

### 1.6 Every query

| id | where | op | columns | filter | order / limit | volume |
|---|---|---|---|---|---|---|
| Q-C1 | Worker `comments.ts:154` `readThreads` (from `handleEngagement` :264) | GET | `id,story_id,user_id,nickname,content,content_blocks,created_at,avatar_id,avatar_kind,palette_id,palette_swapped,comment_likes(count)` (`COMMENT_COLUMNS` :38) | `env=eq.<env>`, `story_id=in.(k1..k64)` | `created_at.asc`, `limit=1000` (≥ 1000 rows ⇒ part `unavailable`); body ≤ 1 MiB | testbed only today |
| Q-C2 | legacy `src/hooks/use-comments.ts:66-73`; patch client `patch-comments-client.js:527-535` + `:959` | GET | `*` (incl. `env`, `parent_id`, `meta`) | `story_id eq`, `env eq` | `created_at asc`, no limit | `#19` 39,627 calls (3.04 ms) + `#48` 29,895 (1.13 ms) = same text, two plans: ~440/day |
| Q-C3 | Worker `comments.ts:523` `handleCreateComment` | POST, `return=representation`, `select=COMMENT_COLUMNS` | input + `user_id=sub`, `env=<Worker env>` | | | |
| Q-C3 | legacy `use-comments.ts:187` `.insert(basePayload).select().single()`; patch client `:1075` `POST comments?select=*` (sends no `content_blocks`) | POST | | | | 397 inserts lifetime |
| Q-C4 | Worker `comments.ts:542` | DELETE `return=representation` | `select=id` | `id=eq.<id lowercased>`, `user_id=eq.<sub>` (no env) | 0 rows ⇒ 404 | |
| Q-C4 | legacy `use-comments.ts:233` `.delete().eq("id")`; patch `:1172` `DELETE comments?id=eq.` | DELETE | | id only (RLS restricts to owner) | | 65 deletes |
| Q-C5 courier | Worker `nav.ts:148` (inside `fetchNavFromSupabase` :130, under the `api_cache` lease); legacy `src/components/comment-courier.tsx:159-172`; patch `:1493-1500` (`courierItems`) | GET | `id,story_id,content,created_at` | `env=eq`, `created_at=gte.<now − 14 d>` | `created_at.desc`, `limit=12`, no tiebreak | `#2` 34,107 anon calls, 25.25 ms mean, **861 s total (most expensive app query)**; `#30` 2,205 authenticated, 33.78 ms: ~230/day |
| Q-C6 | Worker `colorful-philosophers.ts:25-46` `replyCounts`; legacy `src/hooks/use-colorful-philosopher-posts.ts:230` | GET | `story_id` | `env=eq`, `story_id=in.("colorful-philosophers:<postId>",…)` | `limit=1000`; counted per key in JS | |
| Q-C7 | Worker `history-runs.ts:102-132` (`read.history-runs.engagement`); legacy `src/hooks/use-history-course-engagement.ts:66-73` | GET | `story_id` | `env=eq`, `story_id=in.("history-course:<runId>"…)` ≤ 100 ids | `limit=1000`; counted per run in JS | |
| Q-C8 | `get_engagement_counts(p_env)` | RPC | §8.2 | | | `#11` 14,668 + `#25` 4,407 = ~120/day |
| Q-C9 | `get_my_profile_activity`, `get_my_profile_activity_stats` | RPC | own comments + `count(comment_likes.id)` | `env`, `user_id = auth.uid()` | §8.5 | `#42` 412, `#41` 329 |
| Q-C10 | personal comment likes (`comment_likes … comments!inner(story_id)`) | GET | §2 Q-CL3 | | | |
| Q-C11 | dev admin (service role, dev build only) `src/app/(main)/dev/admin/admin-dev-page.tsx:184-205` | GET `count=exact` | `id, story_id, user_id, nickname, content, content_blocks, env, created_at, avatar_*, palette_*` | `env eq`; `story_id eq` / `like '<prefix>%'` / `neq 'byrdispatch'` + `not like` each other prefix | `created_at desc`, `limit ROW_LIMIT` | plan 5.7 moves admin to local `wrangler d1 execute` scripts |
| Q-C12 | `get_rls_activity_metrics` (admin, service role) | RPC | `user_id, created_at, admin_story_service(story_id)` | `env` | full scan | `#20` 262 calls, 456 ms mean |

Writes go through RLS and the two triggers. After a Worker create, the response row gets `like_count: 0` added.

### 1.7 What the UI needs

- Thread view (`src/components/comment-section.tsx:103-321`): per comment `id` (anchor `history-comment-<id>`),
  `nickname`, `avatar_id`, `avatar_kind`, `palette_id`, `palette_swapped`, `content` + `content_blocks`
  (`resolveRichContentBlocks`), `created_at` (`toLocaleDateString` only, date precision), like count and liked-by-me,
  owner controls when `user_id === me`. Order: `created_at` ascending. The thread's comment count shown on detail
  pages is `comments.length` (`comment-section.tsx:112-118`, `onCountChange`).
- Courier: `id`, `story_id` (source label and link via `commentThreadHref` + `#history-comment-<id>`), plain text of
  `content`, `created_at`.
- Lists never show comments themselves, only counts (§8).

### 1.8 Dead

`parent_id` (+ self FK and cascade), `meta` (+ its half of `comments_blocks_size_check`), `env` (decision 1). The
Worker already omits `parent_id`/`meta`; legacy `select *` and the patch client still receive them (shadow comparison
must compare the Worker's column list, not `*`).

---

## 2. `comment_likes`

### 2.1 Columns (schema:2664-2669)

| column | type | null | default |
|---|---|---|---|
| id | uuid | NOT NULL | `gen_random_uuid()` |
| comment_id | uuid | NOT NULL | |
| user_id | uuid | NOT NULL | |
| created_at | timestamptz | NULL | `now()` |

**No `env` column** (env comes from the parent comment). No CHECKs. No guard trigger: a client may send its own
`created_at` (nobody does).

### 2.2 Constraints and indexes

| object | definition | idx_scan |
|---|---|---:|
| comment_likes_pkey | `PRIMARY KEY (id)` | 0 |
| comment_likes_comment_id_user_id_key | `UNIQUE (comment_id, user_id)` | 2,743 |
| idx_comment_likes_comment | `(comment_id)` (redundant with the unique's prefix) | 13,479 |
| comment_likes_comment_id_fkey | `FOREIGN KEY (comment_id) REFERENCES public.comments(id) ON DELETE CASCADE` | |
| comment_likes_user_id_fkey | `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE` | |

### 2.3 Triggers, RLS, grants

- No triggers. No counter anywhere: every comment-like count is computed by counting rows.
- RLS (schema:4807): `comment_likes_read FOR SELECT USING (true)` (who liked which comment is public);
  `comment_likes_insert FOR INSERT WITH CHECK ((auth.uid() = user_id))`; `comment_likes_delete FOR DELETE USING ((auth.uid() = user_id))`. No update.
- `GRANT ALL` to anon, authenticated, service_role (schema:5750-5752).

### 2.4 Every query

| id | where | op | detail |
|---|---|---|---|
| Q-CL1 | Worker Q-C1 | embed | `comment_likes(count)` per comment row (one aggregate per row) |
| Q-CL2 | legacy `src/hooks/use-comment-likes.ts:74-89`; patch `patch-comments-client.js:537-544` + `:967` | GET | `select=comment_id`, `comment_id=in.(ids of the thread)`; rows counted per id in JS. Skipped on the api path when rows carry `like_count` |
| Q-CL3 | Worker `comments.ts:381-394` (`/api/me/engagement?threads=`) | GET (user token) | `select=comment_id,comments!inner(story_id)`, `user_id=eq.<sub>`, `comments.story_id=in.(keys)`, `comments.env=eq.<env>`, `limit=1000` ⇒ `{ key: [comment_id…] }` |
| Q-CL4 | legacy `use-comment-likes.ts:57-67`; patch `:973` | GET | `select=comment_id`, `user_id=eq`, `comment_id=in.(ids)` |
| Q-CL5 | Worker `comments.ts:584-605` `PUT/DELETE /api/write/comment-likes?id=` | POST `{comment_id, user_id}` (`23505` = already liked ⇒ ok; `23503` = no comment ⇒ 404) / DELETE `comment_id=eq&user_id=eq`; then HEAD `count=exact` `comment_likes?select=id&comment_id=eq.<id>` ⇒ `{ liked, count }` (count null if that read fails) |
| Q-CL5 | legacy `use-comment-likes.ts:157` delete, `:160` insert; patch `:1155`, `:1160` | | |
| Q-CL6 | `get_my_profile_activity(_stats)` | RPC | `left join comment_likes on comment_likes.comment_id = comments.id`, `count(comment_likes.id)` per own comment |
| Q-CL7 | `get_rls_activity_metrics` | RPC | `comment_likes join comments`, env from `comments.env`, time `coalesce(comment_likes.created_at, comments.created_at)` |

Not in the top 50 statements. UI: heart count and liked state per comment.

### 2.5 Notes for D1

- `id` is never read (0 scans): a `(comment_id, user_id)` key is enough.
- The personal overlay (Q-CL3) filters by user and by thread key through a join. Without env it needs either an index
  on `comment_likes(user_id, …)` plus the join to `comments(story_id)`, or a denormalized thread key on the like row.
- Counts: either a counter column on `comments` (maintained in the same D1 batch as the like) or `COUNT(*)` over the
  `comment_id` index (rows read = likes on that comment; today 58 rows in total).
- `created_at` is read only by the admin metrics RPC; keep it for plan 5.7 admin scripts.

---

## 3. `likes`

### 3.1 Columns (schema:2989-2999)

| column | type | null | default |
|---|---|---|---|
| id | uuid | NOT NULL | `gen_random_uuid()` |
| story_id | text | NOT NULL | thread key (§7) |
| user_id | uuid | NOT NULL | |
| created_at | timestamptz | NULL | `now()` |
| env | text | NOT NULL | `'production'::text` |
| reaction_type | text | NOT NULL | `'thumb_up'::text` (**dead**) |

CHECKs, verbatim:
- `likes_env_check CHECK ((env = ANY (ARRAY['production'::text, 'development'::text])))`
- `likes_key_size_check CHECK ((octet_length(story_id) <= 1024))`
- `likes_reaction_type_check CHECK ((reaction_type = ANY (ARRAY['exclamation'::text, 'skull'::text, 'thumb_down'::text, 'sad_slime'::text, 'question_mark'::text, 'heart'::text, 'thumb_up'::text, 'happy_cultist'::text])))`

### 3.2 Constraints and indexes

| object | definition | idx_scan |
|---|---|---:|
| likes_pkey | `PRIMARY KEY (id)` | 0 |
| likes_story_env_user | `UNIQUE (story_id, user_id, env)` | 138 |
| idx_likes_env_story_reaction | `(env, story_id, reaction_type)` (dead per audit; the planner used it for the count queries) | 52,377 |
| idx_likes_env_story | `(env, story_id)` | 7,082 |
| idx_likes_story_env | `(story_id, env)` (dead) | 0 |
| likes_user_id_fkey | `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE` | |

### 3.3 Triggers, RLS, grants

- `likes_toybox_engagement_delta AFTER INSERT OR DELETE ON public.likes FOR EACH ROW EXECUTE FUNCTION public.apply_toybox_thread_engagement_delta('like')` (schema:4387): bumps `like_count` on the post table (§8.1).
  No guard trigger (client-settable `created_at`).
- RLS (schema:5083): `likes_read FOR SELECT USING (true)`; `likes_insert FOR INSERT WITH CHECK ((auth.uid() = user_id))`;
  `likes_delete FOR DELETE USING ((auth.uid() = user_id))`. No update. `GRANT ALL` to anon/authenticated (schema:5959).

### 3.4 Every query

| id | where | op | detail | volume |
|---|---|---|---|---|
| Q-L1 | Worker `comments.ts:181-197` `readLikeCount` | HEAD `count=exact` | `likes?select=id&story_id=eq.<key>&env=eq.<env>`; one call per key, ≤ 16 keys | |
| Q-L2 | legacy `src/hooks/use-likes.ts:86-94` | HEAD `count=exact` | `select("*", {count:"exact", head:true}).eq("story_id").eq("env")`; only when the caller passes no `initialCount` | `#29` 29,282 calls, 2.87 ms: ~185/day |
| Q-L3 | Worker `comments.ts:405-421` (`/api/me/engagement?likes=`) | GET | `select=story_id&user_id=eq.<sub>&env=eq&story_id=in.(keys)` ⇒ `{ key: bool }` | |
| Q-L3 | legacy `use-likes.ts:26-38` | GET | `select("id").eq(story_id).eq(user_id).eq(env).maybeSingle()` (eager on detail heads, lazy on list cards before the first click) | |
| Q-L4 | Worker `comments.ts:607-628` `PUT/DELETE /api/write/likes?key=` | POST `{story_id, user_id, env}` (23505 ⇒ ok) / DELETE `story_id&user_id&env`; then HEAD count ⇒ `{ liked, count }` | |
| Q-L4 | legacy `use-likes.ts:205-235` | insert `{story_id, user_id, env}` (never sends `reaction_type`) / delete | 353 ins, 130 del |
| Q-L5 | Worker `history-runs.ts:110-120`; legacy `use-history-course-engagement.ts:57-64` | GET | `select=story_id&env=eq&story_id=in.("history-course:<id>"…≤100)&limit=1000`, counted per run | |
| Q-L6 | `get_engagement_counts` (§8.2), `get_my_profile_activity(_stats)` (likes on `'community:' \|\| community_stories.id`), `get_rls_activity_metrics` (`likes.created_at is not null`), `get_story_reaction_counts` (dead) | RPC | | |

Who passes `initialCount` (no count read): list cards via `IndexCardEngagement` (`src/components/index-card-engagement.tsx:87-99`,
value = post row `like_count`), defragment rows, `decisions-decisions-post-view.tsx:209`, `favorite-tournament-post-view.tsx:185`,
`defragment-post-view.tsx:212`. Without it (count read): codex detail head (`comment-section.tsx:171`), `/patches/changes` head,
pagestorm detail, monster tiles, story rows, beta art, run cards.

UI: like count + liked-by-me per thread key; list counts come from post rows or from the engagement map (§8).

Dead: `reaction_type` (+ check, + `idx_likes_env_story_reaction`), `idx_likes_story_env`, `id` (0 scans; D1 key
`(story_id, user_id)` is enough), `env`.

---

## 4. `resource_reactions` (buff / nerf / rework per user per resource version)

### 4.1 Columns (schema:3219-3229)

| column | type | null | default |
|---|---|---|---|
| env | text | NOT NULL | (none) |
| resource_type | text | NOT NULL | e.g. `card`, `relic`, or a philosopher slot as fallback |
| resource_id | text | NOT NULL | game id |
| game_version | text | NOT NULL | e.g. the codex `sts2Meta.version` |
| user_id | uuid | NOT NULL | |
| kind | text | NOT NULL | |

No `id`, no timestamps. CHECKs, verbatim:
- `resource_reactions_env_check CHECK ((env = ANY (ARRAY['production'::text, 'development'::text])))`
- `resource_reactions_key_length_check CHECK (((char_length(resource_type) <= 32) AND (char_length(resource_id) <= 128) AND (char_length(game_version) <= 32)))`
- `resource_reactions_kind_check CHECK ((kind = ANY (ARRAY['buff'::text, 'nerf'::text, 'rework'::text])))`

Worker key rules (`src/lib/engagement-keys.ts:10-12`): type `^[a-z_-]{1,32}$`, id `^[A-Za-z0-9._-]{1,128}$`,
version `^[A-Za-z0-9._-]{1,32}$`; target key `<type>:<id>:<version>`.

### 4.2 Constraints and indexes

- `resource_reactions_pkey PRIMARY KEY (env, resource_type, resource_id, game_version, user_id)` — 536 scans. No other index.
- `resource_reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE`.

### 4.3 Triggers, RLS, grants

- `resource_reactions_counts AFTER INSERT OR DELETE OR UPDATE ON public.resource_reactions FOR EACH ROW EXECUTE FUNCTION public.apply_resource_reaction_counts()` (schema:4401), §5.3.
- RLS (schema:5269): `resource_reactions_read FOR SELECT USING (true)` (who reacted how is public);
  `resource_reactions_insert FOR INSERT WITH CHECK ((auth.uid() = user_id))`; `resource_reactions_delete FOR DELETE USING ((auth.uid() = user_id))`;
  `resource_reactions_update FOR UPDATE TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id))`.
- Grants: anon/authenticated `SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN` (no table UPDATE, schema:6055-6056)
  plus `GRANT UPDATE(kind) ON TABLE public.resource_reactions TO authenticated` (schema:6064): only `kind` can change.
- Rows were copied from `colorful_philosopher_reactions` (`20260924150000_resource_reactions.sql:108-112`).

### 4.4 Every query

| id | where | op | detail |
|---|---|---|---|
| Q-R1 | Worker `comments.ts:429-447` (`/api/me/engagement?reactions=`) | GET | `select=resource_type,resource_id,game_version,kind&user_id=eq.<sub>&env=eq&resource_id=in.(ids)`, then filtered to the asked targets |
| Q-R2 | legacy `src/hooks/use-resource-reactions.ts:200-212` | GET | `select("kind")` eq env, type, id, version, user, `maybeSingle()` |
| Q-R3 | Worker `comments.ts:644-720` `PUT /api/write/reactions` | `kind=null` ⇒ DELETE on the full key; else PATCH `{kind}` (`return=representation`), 0 rows ⇒ POST insert, `23505` ⇒ PATCH again; then Q-RC2 ⇒ `{ kind, counts }` |
| Q-R3 | legacy `use-resource-reactions.ts:282-298` (`choose`), patch `patch-comments-client.js:1906-1910` | delete / update / insert chosen by the **localStorage** previous kind (can hit PK conflict or 0-row update) |
| Q-R4 | dev-only `saveResourceReaction` `use-resource-reactions.ts:77-106` (caller `backstab-colorful-philosophers-section.tsx:246`; patch pages do not hydrate in production) | same as legacy |

Volume: 536 PK scans; 189 ins / 25 upd / 45 del.

UI: reaction bar (codex detail head, `/patches/changes` head, philosopher list and detail, patch shell reel) showing
the three totals and the viewer's own kind; read-only bars under philosopher posts show totals only.

D1 note: Q-R1 filters by `user_id` + `resource_id IN (…)`, which the current key order (`env, type, id, version, user`)
cannot serve without `env`/`type` first; the writes match the full key.

---

## 5. `resource_reaction_counts` (derived totals)

### 5.1 Columns (schema:3201-3210)

| column | type | null | default |
|---|---|---|---|
| env | text | NOT NULL | |
| resource_type | text | NOT NULL | |
| resource_id | text | NOT NULL | |
| game_version | text | NOT NULL | |
| buff_count | integer | NOT NULL | 0 |
| nerf_count | integer | NOT NULL | 0 |
| rework_count | integer | NOT NULL | 0 |

- `resource_reaction_counts_env_check CHECK ((env = ANY (ARRAY['production'::text, 'development'::text])))`.
- `resource_reaction_counts_pkey PRIMARY KEY (env, resource_type, resource_id, game_version)` — 1,299 scans
  (seq_scan 32,153: the table is tiny, so single-target reads went to seq scans). No FK.

### 5.2 RLS and grants

`resource_reaction_counts_read FOR SELECT USING (true)`; no write policy. `GRANT ALL` to anon/authenticated
(schema:6046-6047) but RLS denies every client write; only the SECURITY DEFINER trigger writes.

### 5.3 Maintenance: `apply_resource_reaction_counts()` (schema:114-166, SECURITY DEFINER)

- Picks `row_env/type/id/version` from `old` on DELETE, else `new`; `old_kind` = `old.kind` on UPDATE/DELETE, `new_kind`
  = `new.kind` on INSERT/UPDATE (null on DELETE).
- `insert into public.resource_reaction_counts (env, resource_type, resource_id, game_version) values (…) on conflict (env, resource_type, resource_id, game_version) do nothing;`
- Then one UPDATE per counter: `buff_count = greatest(0, buff_count - case when old_kind = 'buff' then 1 else 0 end + case when new_kind = 'buff' then 1 else 0 end)`, same for nerf and rework.
- Consequences: a counts row is created on the first reaction and never deleted (0 deletes; all-zero rows stay);
  counts are clamped at 0; a kind change moves one vote between counters in one statement. 191 updates lifetime.

### 5.4 Every query

| id | where | detail | volume |
|---|---|---|---|
| Q-RC1 | Worker `comments.ts:199-218` `readReactionCounts` | `select=resource_type,resource_id,game_version,buff_count,nerf_count,rework_count&env=eq&resource_id=in.(ids)`; ids include the philosopher posts' resource ids so each post's own version needs no second read; missing ⇒ zeros | |
| Q-RC2 | Worker `comments.ts:704-716` after a reaction write | `select=buff_count,nerf_count,rework_count` eq env, type, id, version | |
| Q-RC3 | legacy `use-resource-reactions.ts:142-150` | same single-target read, `maybeSingle()` | `#47` 24,513 calls, 1.41 ms: ~155/day |
| Q-RC4 | patch reel `patch-comments-client.js:1800-1803` | `env=eq&resource_id=in.(ids)` (api path uses `/api/read/engagement?reactions=` at `:1790`) | |
| Q-RC5 | build time `src/lib/colorful-philosophers-gallery.ts:66-100` `withResourceReactionCounts` | `env eq`, `resource_id in (ids)`, `abortSignal(buildQuerySignal())` (plan 5.7: builds stop reading the DB) | build only |
| Q-RC6 | dev-only `fetchResourceReactionCounts` `use-resource-reactions.ts:47-74` | `env`, `resource_id in` | dev only |

All reads are by `resource_id` (IN list or equality), sometimes all versions of an id. D1 needs `resource_id` as the
leading key column (or a separate index).

---

## 6. `community_stories` (이야기)

### 6.1 Columns (schema:2715-2744)

| column | type | null | default | notes |
|---|---|---|---|---|
| id | uuid | NOT NULL | `gen_random_uuid()` | PK |
| user_id | uuid | **NULL** | | null for seed ("official") rows |
| nickname | text | NOT NULL | | author snapshot |
| sentence | text | NOT NULL | | |
| game | text | NOT NULL | `'sts2'::text` | Worker always writes `sts2` |
| env | text | NOT NULL | `'production'::text` | dropped |
| created_at | timestamptz | NOT NULL | `now()` | |
| static_story_id | text | NULL | | seed id, e.g. `sts2-doormaker-removed`; makes the row an official story |
| entity_type | text | NULL | | primary patch-line entity ref |
| entity_id | text | NULL | | |
| change_id | text | NULL | | never written by clients |
| patch_line_id | text | NULL | | canonical patch line id (`resolveCanonicalPatchLineId`) |
| source | text | NULL | | patch id; feed filter |
| tags | jsonb | NOT NULL | `'[]'::jsonb` | clients always write `[]`; displayed only |
| linked_entities | jsonb | NOT NULL | `'[]'::jsonb` | `[{entityType, entityId, label?}]`; displayed only |
| avatar_id, avatar_kind, palette_id | text | NULL | | author snapshot |
| palette_swapped | boolean | NULL | `false` | author snapshot |

### 6.2 Constraints and indexes

CHECKs, verbatim:
- `community_stories_author_token_size_check CHECK ((((COALESCE(octet_length(avatar_id), 0) + COALESCE(octet_length(avatar_kind), 0)) + COALESCE(octet_length(palette_id), 0)) <= 1024))`
- `community_stories_env_check CHECK ((env = ANY (ARRAY['production'::text, 'development'::text])))`
- `community_stories_game_check CHECK ((game = ANY (ARRAY['sts1'::text, 'sts2'::text])))`
- `community_stories_key_size_check CHECK (((octet_length(entity_type) <= 1024) AND (octet_length(entity_id) <= 1024) AND (octet_length(change_id) <= 1024) AND (octet_length(patch_line_id) <= 1024) AND (octet_length(source) <= 1024) AND (octet_length(static_story_id) <= 1024)))`
- `community_stories_nickname_check CHECK (((char_length(nickname) >= 1) AND (char_length(nickname) <= 20)))`
- `community_stories_refs_size_check CHECK (((pg_column_size(tags) <= 131072) AND (pg_column_size(linked_entities) <= 131072)))`
- `community_stories_sentence_check CHECK (((char_length(sentence) >= 2) AND (char_length(sentence) <= 120)))`

| object | definition | idx_scan |
|---|---|---:|
| community_stories_pkey | `PRIMARY KEY (id)` | 0 |
| community_stories_env_static_story_key | `UNIQUE (env, static_story_id)` (NULLs repeat; same in SQLite) | 9 |
| idx_community_stories_env_created | `(env, created_at DESC)` | 1,895 |
| idx_community_stories_env_patch_line | `(env, patch_line_id) WHERE (patch_line_id IS NOT NULL)` (dead) | 0 |
| idx_community_stories_env_sentence | `gin (to_tsvector('simple'::regconfig, sentence))` (dead; search is client-side) | 0 |
| idx_community_stories_env_user_created | `(env, user_id, created_at DESC) WHERE (user_id IS NOT NULL)` | 0 |
| community_stories_user_id_fkey | `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE` | |

### 6.3 Triggers, RLS, grants

- `community_stories_guard_server_columns BEFORE INSERT … WHEN ((CURRENT_USER = ANY (ARRAY['anon'::name, 'authenticated'::name]))) EXECUTE FUNCTION public.guard_insert_server_columns()` (schema:4345):
  `created_at := now()`, `static_story_id := null` (only service role can create an official story;
  `supabase/migrations/20261031044402_rls_hardening.sql:121-130`).
- No counter trigger: story likes/comments are counted only by `get_engagement_counts` and the profile RPC.
- RLS (schema:4861): `community_stories_read FOR SELECT USING (true)`; `community_stories_insert FOR INSERT WITH CHECK ((auth.uid() = user_id))`;
  `community_stories_delete FOR DELETE USING ((auth.uid() = user_id))`. No update (`n_tup_upd` 1 = service role).
  `GRANT ALL` to anon/authenticated (schema:5768-5769).
- Seed rows: `supabase/migrations/20260707144217_story_patch_references.sql:33+` inserts official rows with
  `user_id null`, nickname `'슬서운이야기'`, explicit `created_at '2026-05-08T00:00:00Z'` (whole second).
  `data/sts2-stories.json` has 5 such ids, `data/stories.json` 17 STS1 static stories that live only in JSON.

### 6.4 Story identity = thread key

`rowToStory` (`src/hooks/use-community-stories.ts:94-115`): `id = row.static_story_id ?? 'community:' + row.id`,
`community = !row.static_story_id`. That id is the like and comment thread key of the story, so story threads are
either `community:<uuid>` or a **bare static id** (`sts2-doormaker-removed`, `blade-dance-shivs`, …) with no prefix.

### 6.5 Every query

| id | where | op | detail |
|---|---|---|---|
| Q-S1 | Worker `stories.ts:17-47` `GET /api/read/stories?limit=100\|200\|1000[&source=]` | GET, streamed unparsed | `select=STORY_COLUMNS`, `env=eq`, optional `source=eq.<patchId>`, `order=created_at.desc`, `limit` — no tiebreak. `STORY_COLUMNS` = `id,user_id,static_story_id,nickname,sentence,game,entity_type,entity_id,change_id,patch_line_id,source,tags,linked_entities,created_at,env,avatar_id,avatar_kind,palette_id,palette_swapped` (`src/lib/stories-api-rules.ts:7-8`, includes `env`) |
| Q-S1 callers | home `story-feed.tsx:1021` (100); patch detail `patch-rich-comments-client.tsx:60` (`source=patchId`, 200); `/patches/changes` `resource-patch-index-explorer.tsx:705` (1000, to count stories per patch line client-side, `:755`); `/byrdispatch` composer button `byrdispatch-story-composer-button.tsx:26` (100, uses only `add`); dev `patch-note-with-story-actions.tsx:301` | | |
| Q-S2 | legacy `use-community-stories.ts:160-170` | GET | same columns/filters; plus Realtime `INSERT` channel `:176-190` (table not in the publication: never fires) |
| Q-S3 | Worker `stories.ts:49-68` | POST `return=representation`, `select=STORY_COLUMNS` | row from `storyInsertRow` (`stories-api-rules.ts:45-101`) + `user_id=sub`, `env` |
| Q-S3 | legacy `use-community-stories.ts:269-296`; patch static composer `patch-comments-client.js:703-720` (`select=*`) | POST | |
| Q-S4 | Worker `stories.ts:70-84` | DELETE `id=eq&user_id=eq&env=eq&select=id` ⇒ `{ deleted: bool }` | |
| Q-S4 | legacy `use-community-stories.ts:325-333` | DELETE `id`, `user_id`, `env` | |
| Q-S5 | `get_my_profile_activity(_stats)` | RPC | own stories (`user_id = auth.uid()`), like count = `count(likes.id)` on `'community:' \|\| id` |
| Q-S6 | admin `admin-dev-page.tsx:265-275` | GET `count=exact` | `id, user_id, nickname, sentence, created_at, avatar_*, palette_*`, `env eq`, `static_story_id is null`, `created_at desc`, `limit ROW_LIMIT`; `get_rls_activity_metrics` (`user_id not null and static_story_id is null`) |

Volume: nothing in the top 50; 25,825 seq scans + 1,895 index scans (26 rows: every read is effectively a full read).

Worker write rules (`storyInsertRow`): sentence trimmed 2–120 code points; nickname 1–20; `patchLineId` required,
`^[A-Za-z0-9._:-]{1,256}$`; `source` required, `^[A-Za-z0-9._-]{1,64}$`; entity refs optional, same REF pattern;
`linkedEntities` array of `{entityType, entityId, label?}` ≤ 128 KiB; `tags = []`, `game = 'sts2'`.

UI: `sentence`, author snapshot, `created_at` (relative time), entity refs + `linked_entities` (hover/link chips),
`patch_line_id` (resolve the rich patch line), `source` (patch filter), `tags` (static STS1 only), `change_id`, `game`.
Search is client-side over `sentence` + patch line text; sort is client-side by created_at desc then `stableHash(id)`,
or by the like/comment counts from `get_engagement_counts` (`story-feed.tsx:134-155`). Patch pages group and count
stories by patch line client-side.

---

## 7. Thread keys (`comments.story_id`, `likes.story_id`)

Builders: `src/lib/comment-threads.ts` (import-free validators in `src/lib/engagement-keys.ts`). Worker regex
`^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$` (`engagement-keys.ts:8`); every key in both envs on 2026-11-06 matched it.

| key | builder | `admin_story_service` / `commentThreadService` | counter trigger today | read as a count by |
|---|---|---|---|---|
| `sts2-patch:<version>` | `comment-threads.ts:28` | patches | none (uuid cast fails) | `get_engagement_counts` (not displayed) |
| `neowsletter:<YYYY-MM>:<claimId>`, `neowsletter:<issue>:page` | `:32` | other | none | — (threads read in batches of up to 64 keys per page) |
| `sts2-codex:<type>:<id>` | `:36` | compendium | none | `get_engagement_counts` (card library sort/stats, monster/bestiary tiles) |
| `sts1-codex:<type>:<slug>` | `:40` | compendium | none | |
| `byrdispatch` | `:47` | byrdispatch | none | |
| `c-c-c-combo:<uuid>` | `:51` | combo | `combo_posts` like + comment | post row |
| `transfigure:<uuid>` | `:55` | transfigure | `transfigure_posts` like + comment | post row |
| `this-or-that:<uuid>` | `:59` | this_or_that | `this_or_that_posts` **comment only** (likes live in `this_or_that_post_likes`) | post row |
| `chemical-x:<uuid>` | `:63` | chemical_x | `chemical_posts` like + comment | post row |
| `defragment:<uuid>` | `:67` | defragment | `defragment_posts` (dead table, 0 rows) | — |
| `decisions-decisions:<uuid>` | `:71` | decisions_decisions | `decisions_decisions_posts` | post row |
| `favorite-tournament:<uuid>` | `:75` | favorite_tournament | `favorite_tournament_posts` | post row |
| `pagestorm:<uuid>` | `:79` | pagestorm | `pagestorm_posts` | post row |
| `history-course:<runId>` (`^[A-Za-z0-9_-]{1,64}$`) | `:83` | **other** | `runs` like + comment | Q-C7/Q-L5 count rows; `runs` counters read only by the defragment board |
| `beta-art:<artKey>` (`card:CASCADE`) | `:88` | other | none | `get_engagement_counts` (beta art grid) |
| `colorful-philosophers:<postId>` | `src/lib/engagement-keys.ts:99` | other | none | Q-C6 reply counts |
| `community:<uuid>` | `use-community-stories.ts:62` | stories | none | `get_engagement_counts` (story feed) |
| bare static story id | `rowToStory` | other | none | `get_engagement_counts` (story feed) |
| `story:<id>` | only recognised by the courier (`comment-courier.tsx:131`) | other | none | — |

- `commentThreadService` (`comment-threads.ts:111`) must stay equal to `public.admin_story_service` (schema:42); both map
  `history-course:`, `neowsletter:`, `beta-art:`, `colorful-philosophers:` and static story ids to `other`.
- `commentThreadHref` (`comment-threads.ts:151-191`) builds the link for each prefix (courier, profile).
- Defragment federated items reuse the source service's key (`src/lib/defragment.ts:241-261`), so a post has one
  thread whichever board shows it. History-course items on the defragment board show no comments section.
- **No referential integrity**: deleting a post (e.g. 11 combo deletes, 33 transfigure deletes) leaves its comments and
  likes behind. They still count in `get_engagement_counts`, still appear in the courier (link to a missing page), and a
  later delete of such a like/comment updates nothing (the post row is gone).
- Prefix-scoped reads would serve the codex/beta-art callers of `get_engagement_counts`, but the story feed needs
  `community:*` **and** bare static ids, which share no prefix (SURFACE_MAP 8.4 noted this is why step 1 did not filter
  by prefix).

---

## 8. Every place that counts likes or comments

### 8.1 `apply_toybox_thread_engagement_delta()` (schema:253-370, SECURITY DEFINER), trigger arg `'comment'` or `'like'`

```text
INSERT ⇒ delta = +1 (rec = new); DELETE ⇒ delta = -1 (rec = old); UPDATE ⇒ return unchanged.
prefix := split_part(rec.story_id, ':', 1)
if prefix = 'history-course':
    run_id := split_part(rec.story_id, ':', 2)
    comment ⇒ update runs set comment_count = greatest(0, comment_count + delta) where id = run_id and env = rec.env
    like    ⇒ update runs set like_count    = greatest(0, like_count + delta)    where id = run_id and env = rec.env
    return
post_id := split_part(rec.story_id, ':', 2)::uuid   -- invalid_text_representation / data_exception ⇒ return (no-op)
comment: prefix ∈ {c-c-c-combo, transfigure, this-or-that, chemical-x, defragment, decisions-decisions,
                   favorite-tournament, pagestorm} ⇒ update <table> set comment_count = greatest(0, comment_count + delta)
                   where id = post_id and env = rec.env
like:    same list WITHOUT this-or-that ⇒ like_count
```

- Codex, patch, neowsletter, byrdispatch, beta-art keys fail the uuid cast; `community:` and `colorful-philosophers:`
  pass the cast but match no branch: no counter anywhere for them.
- `split_part(…, 2)` ignores anything after a second `:` (`history-course:a:b` counts on run `a`).
- Counters clamp at 0 and only move on INSERT/DELETE. Guard trigger `guard_post_server_columns()` (schema:2042) resets
  `like_count`/`comment_count` to 0 on client INSERT and freezes them on client UPDATE of the post tables, so only these
  triggers move them.
- Related, outside this domain's tables: `apply_this_or_that_like_count_delta()` (schema:175-200) keeps
  `this_or_that_posts.like_count` from `this_or_that_post_likes` (10 rows, own `(post_id, user_id, env)` unique); the
  view `this_or_that_post_like_counts` (schema:3321, `count(*) group by post_id, env`) is what the Worker reads
  (`toybox.ts:368`). this-or-that is the one service whose likes are not in `likes`.
- `defragment` branches are dead (CLEANUP_AUDIT 3.1).

### 8.2 `get_engagement_counts(p_env text)` (schema:1134-1159, `LANGUAGE sql STABLE`)

```sql
with like_counts as (select likes.story_id, count(*) as cnt from public.likes where likes.env = p_env group by likes.story_id),
comment_counts as (select comments.story_id, count(*) as cnt from public.comments where comments.env = p_env group by comments.story_id)
select coalesce(like_counts.story_id, comment_counts.story_id) as story_id,
       coalesce(like_counts.cnt, 0) as like_count, coalesce(comment_counts.cnt, 0) as comment_count
from like_counts full outer join comment_counts on like_counts.story_id = comment_counts.story_id;
```

- Full aggregation of both tables per call; no order, no limit (PostgREST max-rows could cut it).
- Callers: legacy `src/hooks/use-engagement-counts.ts:42`; Worker `comments.ts:722-739` (`GET /api/read/engagement-counts`,
  same `{ v, env, likes, comments }`, zero counts omitted). Consumers: `story-feed.tsx:1022` (sort + row counts),
  `card-library.tsx:266` (only when stats or engagement sort are on; sort at `:394-404`), `monster-library.tsx:138`
  (tiles `:478-479`), `beta-art-client.tsx:179`. No module cache: every mount calls it.
- Volume `#11` 14,668 anon (13.24 ms) + `#25` 4,407 authenticated (23.42 ms) ≈ 120/day, 297 s total. Response 24 KB.

### 8.3 `get_story_reaction_counts(p_env text)` (schema:1849-1862) — dead

`select likes.story_id, likes.reaction_type, count(*) from public.likes where likes.env = p_env group by likes.story_id, likes.reaction_type`.
No caller in `src/`, `workers/` or `scripts/` (CLEANUP_AUDIT 3.1). Not ported.

### 8.4 Counts computed in the Worker or the browser (no SQL aggregate)

| what | where | how |
|---|---|---|
| like count of one key | Q-L1 / Q-L2 | HEAD `count=exact`, one call per key |
| comment like counts | Q-C1 embed / Q-CL2 | embed `comment_likes(count)` / count rows in JS |
| like/comment count after a write | `comments.ts:558-569` `exactCount` (Q-CL5, Q-L4) | HEAD `count=exact` |
| run thread counts | Q-C7, Q-L5 | `select=story_id … in.(≤100 keys) limit 1000`, counted in JS |
| philosopher reply counts | Q-C6 | same pattern |
| thread comment count on detail | `comment-section.tsx:112-118` | `comments.length` |

### 8.5 Profile RPCs (touch this domain; owned by the profile inventory)

`get_my_profile_activity(p_env, p_category, p_sort, p_limit, p_offset)` (schema:1165-1288) unions the caller's
stories (like count = `count(likes.id)` joined on `likes.story_id = 'community:' || community_stories.id::text`),
chemical/combo posts (like count hard-coded 0), this-or-that posts (`count(this_or_that_post_likes.id)`), comments
(`count(comment_likes.id)`), runs (0). Order `case when p_sort = 'likes' then like_count end desc, created_at desc,
activity_id desc`, `limit least(greatest(p_limit, 1), 50) offset greatest(p_offset, 0)`, `count(*) over ()` as
`total_count` — **offset paging, not keyset**. `get_my_profile_activity_stats(p_env)` (schema:1292-1376) groups the same
set per category (`post_count`, `sum(like_count)`). Worker `profile.ts:38-66`; page size 20
(`profile-activity-rules.ts:21`). Volume `#42` 412, `#41` 329. Needed indexes in D1: per-user
`(user_id, created_at)` on comments and stories.

### 8.6 Sorting by counts

| feed | sort | where | today's index use |
|---|---|---|---|
| toybox lists (7 services) | `recommended` = `like_count desc, created_at desc, id desc`; `comments` = `comment_count desc, …`; keyset `(count, created_at, id) < (…)` | `get_toybox_feed` (schema:1916-2016) | `idx_<t>_env_like_created` / `_comment_created` scans: combo 403 / 26, transfigure 1,305 / 31, decisions 70 / 17, favorite 231 / 16, pagestorm 8 / 2, chemical 26 / 22, this-or-that 25 / 22 |
| defragment board | same sorts over the 7 tables + runs (union, ≤ 160 rows read per page) | `get_defragment_feed_v2` (schema:872), runs part `toybox.ts:110-130` | runs like 4 / comment 8 |
| story feed | client-side over the full `get_engagement_counts` map | `story-feed.tsx:134-155` | — |
| card library | client-side | `card-library.tsx:394-404` | — |
| history course list | client-side over Q-C7/Q-L5 counts | `src/lib/history-course-index-sort.ts:40` | — |
| profile activity | `likes` sort, offset | §8.5 | — |

The `recommend` expression indexes (`(like_count * 4) + (comment_count * 6)`) are dead: no query sorts by that
expression (`recommended` sorts by `like_count`). For decision 3: the only server-side sorts by a count are the
toybox and defragment feeds, at low but non-zero volume; they need `(service, like_count, created_at, id)` and
`(service, comment_count, created_at, id)` style indexes, which a count living only in `threads` cannot give without a
join that reads every post of the service. Every other count sort happens in the browser over a full map.

---

## 9. Nav "latest" and the courier

### 9.1 Today's reads

| part | Worker (`workers/api/routes/nav.ts:130-195`, refreshed under the `api_cache` lease) | legacy (`src/lib/nav-seen.ts:295-327`) | volume (legacy, per table) |
|---|---|---|---|
| 8 table surfaces (`NAV_TABLE_SURFACES`, `src/lib/nav-surfaces.ts:7-16`): combo_posts, transfigure_posts, this_or_that_posts, favorite_tournament_posts, chemical_posts, decisions_decisions_posts, pagestorm_posts, runs | `select=created_at&env=eq&created_at=not.is.null&order=created_at.desc.nullslast&limit=1` | `select created_at eq env gt(created_at, <browser's seen time>) order desc limit 1` (per-browser `since`, uncacheable) | anon ~29.1k each (`#5,#7,#10,#13,#16,#21,#23,#24`) + authenticated ~5.3k each (`#26,#27,#34,#38,#39,#44`); ~217/day per table |
| weekly (`colorful_philosopher_posts`) | `select=week_start&env=eq&week_start=lte.<kstWeekStart(now)>&order=week_start.desc&limit=1` | same (`nav-seen.ts:295-310`) | `#22` 19,289 |
| courier | Q-C5 | Q-C5 | `#2` + `#30` |
| patch notes, neowsletters | bundled JSON, no DB | | |

`created_at` is nullable on `chemical_posts`, `runs` and `comments` (cols.json), hence the `not.is.null` filter
(Postgres puts NULL first in DESC).

### 9.2 Output and comparison semantics

- `NavSnapshotBody` (`nav.ts:30-37`): `{ v: 1, env, fetchedAt, latest: { <surface id>: ISO | null }, weekly: { "colorful-philosophers": "YYYY-MM-DD" | null }, courier: [{ id, storyId, text, createdAt }] }`.
- Every time is normalized with `new Date(x).toISOString()` (`isoOrNull`, `nav.ts:85-89`): millisecond precision, `Z`.
- Clients compare strings: `contentIsNewerThanSeen(publishedAt, seenAt)` is `publishedAt > seenAt`
  (`nav-seen.ts:21-23`); weekly uses `weeklyPublishedAt(weekStart)` = Monday 00:00 KST as ISO (`nav-surfaces.ts:35-37`).
- Courier: 14-day window from the Worker's clock (legacy: browser clock), `LIMIT 12` first, then rows whose
  `courierCommentText(content)` (`src/lib/courier-comment-text.ts:13-25`) is empty are dropped (so fewer than 12 can
  show), text cut to 160 code points with `…`.
- Response `Cache-Control: public, max-age=30`; isolate memory 30 s; refresh after 60 s; blocking refill only when
  missing or older than 24 h.

### 9.3 What a `surface_latest` table must reproduce

- One value per surface id per env DB: the max non-null `created_at` of that service's posts (or runs).
- It must go **down** when the newest post is deleted (today it is recomputed from the table). Writers that change it:
  post insert/delete in the 7 toybox services, run donation insert/upsert/delete (`runs` has 699 updates lifetime;
  whether an upsert can move `created_at` belongs to the runs inventory).
- The weekly surface is **time-dependent**: philosopher posts are scheduled ahead and appear on Monday 00:00 KST, so
  "latest week_start ≤ this Monday" cannot be written at insert time; it needs a read-time index seek on
  `(week_start)` (1 row read) or a stored list of week starts.
- If posts become one table (decision 2), the 8 table surfaces are 8 one-row seeks on a `(service, created_at DESC)`
  index (8 rows read), the same rows-read as an 8-row `surface_latest`; the trade-off is write-time maintenance and the
  delete case versus nothing to maintain.
- The courier needs a `(created_at DESC)` index on comments (12 rows read) or its own cache.

---

## 10. Existing D1 tables (`d1/migrations`, applied to prod and testbed on 2026-11-08 / 2026-11-05)

### 10.1 DDL (verbatim)

`d1/migrations/0001_runtime_flags.sql`:
```sql
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
```

`d1/migrations/0002_api_cache.sql`:
```sql
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
```

`migrations_dir` is `d1/migrations` for both bindings (`wrangler.jsonc:20-25, 60-65`; prod `slseoun-prod`, testbed
`slseoun-testbed`); step 2 DDL continues at `0003_*` (plan 7.3 says `migrations/`, the configured directory is
`d1/migrations`). Testbed deploys apply migrations every run (`scripts/run-cloudflare-testbed.mjs:320-325`).

### 10.2 Queries

| table | query | where | rows read / written |
|---|---|---|---|
| runtime_flags | `SELECT key, value FROM runtime_flags` | `workers/api/flags.ts:52`; page requests via `waitUntil` at most every 30 s per isolate, `/api` requests in one `batch()` with the route's prefetch statements (`flags.ts:138-172`, `router.ts:204-217`) | full table: 0 rows in prod, 9 in testbed |
| runtime_flags + events | upsert `INSERT … ON CONFLICT(key) DO UPDATE SET value, updated_at, note` + `INSERT INTO runtime_flag_events (key, value, at, note)`; read-back `SELECT … WHERE key = ?`; list `… ORDER BY key` and `… ORDER BY id DESC LIMIT 10` | `scripts/runtime-flags.ts:85-112` via `wrangler d1 execute` | manual only |
| api_cache | `NAV_SNAPSHOT_SQL` `SELECT body, fetched_at, lease_until, fail_count, fail_until FROM api_cache WHERE key = ?1` (prefetched in the flags batch) | `nav.ts:64-65` | 1 |
| api_cache | `NAV_LEASE_SQL` `INSERT INTO api_cache (key, body, fetched_at, lease_until, fail_count, fail_until) VALUES (?1, '', 0, ?2, 0, 0) ON CONFLICT(key) DO UPDATE SET lease_until = excluded.lease_until WHERE api_cache.lease_until < ?3 AND api_cache.fail_until <= ?3 AND api_cache.fetched_at <= ?4` | `nav.ts:69-72` | 1 written per refresh |
| api_cache | `NAV_SAVE_SQL` `UPDATE api_cache SET body = ?2, fetched_at = ?3, lease_until = 0, fail_count = 0, fail_until = 0 WHERE key = ?1 AND lease_until = ?4` | `nav.ts:74-75` | 1 |
| api_cache | `NAV_FAIL_SQL` `UPDATE api_cache SET lease_until = 0, fail_count = fail_count + 1, fail_until = ?2 WHERE key = ?1 AND lease_until = ?3` | `nav.ts:76-77` | 1 |

Notes: keys today are `path.<group>` for the 9 groups in `src/lib/api-surfaces.ts:8-18`; STEP1 3.1 reserves
`read.<group>` (`supabase`|`d1`) for step 3. Time formats already differ: `runtime_flags.updated_at` and
`runtime_flag_events.at` are `new Date().toISOString()` (ms, `Z`), `api_cache` uses INTEGER Unix ms. Only `key = 'nav'`
exists in `api_cache`. These tables have no env column already (one DB per env). Schemas only grow, so these stay as
they are.

---

## 11. Timestamp and ordering facts for the canonical format

- Postgres keeps microseconds. PostgREST JSON renders `timestamptz` as ISO 8601 with `T` and offset `+00:00`, with
  trailing fractional zeros trimmed and no fraction at all on whole seconds (seed stories:
  `2026-05-08T00:00:00+00:00`). PostgREST strings are therefore **variable width and not safely comparable as text**.
- What clients do with them in this domain: comments show `toLocaleDateString` (date only); nav and courier
  normalize to `toISOString()` (ms) and compare strings; story feed sorts by parsed time. Toybox cursors send
  `created_at` back as text: the Worker accepts `^\d{4}-\d{2}-\d{2}[T ][0-9:.]{8,15}(?:Z|[+-]\d{2}(?::?\d{2})?)?$`
  (`src/lib/toybox-api-rules.ts:39`) and today lets Postgres parse it; a D1 path must canonicalize the cursor before a
  text comparison.
- None of this domain's lists has a tiebreaker: thread `created_at asc`, courier `created_at desc`, stories
  `created_at desc`. Equal timestamps (the dev env has bulk-copied rows with identical `created_at`, STEP1 status
  2026-11-06 11:30) give an arbitrary order in Postgres; D1 should add `id`, and the shadow comparator must treat
  permutations inside equal timestamps as equal (or compare sets per timestamp).
- A fixed-width UTC text with six fractional digits (`YYYY-MM-DDTHH:MM:SS.ffffffZ`) is lossless for Postgres values,
  sorts as text in time order, and converts to the PostgREST form by trimming zeros and writing `+00:00`. Millisecond
  text (`toISOString`) would truncate existing values; a cursor taken at `.120456` then truncated to `.120` would skip
  rows in `[.120000, .120456)` on the next page. Worker-generated times (step 5) have ms precision and can be padded
  with `000`.
- uuids: Postgres compares uuid bytes, which equals the order of the lowercase hex text; ids from `gen_random_uuid()`
  are lowercase and the Worker lowercases ids it receives (`comments.ts:550`, `:585`, `stories.ts:79`). Run ids are text
  (`^[A-Za-z0-9_-]{1,64}$`); Postgres orders text by the database collation (not in the schema dump), SQLite by BINARY.
  Mixed-case or `-`/`_` run ids can order differently in the defragment keyset (`p.id::text`), not in this domain.

---

## 12. Dropped (not ported), per CLEANUP_AUDIT 3.1 and this inventory

| object | why |
|---|---|
| `comments.parent_id` + `comments_parent_id_fkey`, `comments.meta` (+ its half of `comments_blocks_size_check`) | read by nobody |
| `likes.reaction_type` + `likes_reaction_type_check` + `idx_likes_env_story_reaction` | always the default |
| `idx_likes_story_env`, `idx_community_stories_env_sentence` (GIN), `idx_community_stories_env_patch_line` | 0 scans |
| `get_story_reaction_counts` | no caller |
| `colorful_philosopher_reactions` + `apply_colorful_philosopher_reaction_counts` + its trigger and 4 policies | rows already in `resource_reactions` |
| `defragment_posts` and the `defragment` branches of `apply_toybox_thread_engagement_delta` | table never had a row |
| `nav_indicators` (2 rows, `nav_indicators_select_public`) | replaced by the nav snapshot; only constants/specs referred to it |
| every `env` column, `env` CHECK and env-leading index | decision 1 |
| the `recommend` expression indexes on post tables | no query sorts by the expression |
| `comment_likes.id`, `likes.id` (0 scans) | candidates: natural keys suffice; keep only if sync/outbox wants a surrogate |
| `get_engagement_counts`, both counter trigger functions, `guard_insert_server_columns` | replaced by `threads` + Worker batches (decision 3, plan 5.5) |
| Realtime channel on `community_stories` | never fired (table not in the publication) |

Kept although rarely read: `comment_likes.created_at` and `likes.created_at` (admin activity metrics only).

---

## 13. Queries the Worker will run in D1 (index derivation input)

| # | query (no env) | index it needs | rows read per call |
|---|---|---|---|
| 1 | comments of ≤ 64 thread keys, `ORDER BY created_at, id` | `comments(story_id, created_at, id)` | comments in those threads (max today ~12 per thread) |
| 2 | comment like counts for those comments | counter column on comments, or `comment_likes(comment_id)` | 0 or likes on them |
| 3 | my liked comments in ≤ 64 threads | `comment_likes(user_id, …)` + join `comments(id)`, or a thread key on the like row | my likes there |
| 4 | like count of ≤ 16 keys | `threads(thread_key)` | 1 per key |
| 5 | my likes among ≤ 16 keys | `likes(user_id, story_id)` or PK `(story_id, user_id)` with IN | ≤ 16 |
| 6 | reaction totals for `resource_id IN (…)` | counts keyed by `resource_id` first | versions of those ids |
| 7 | my reactions for `resource_id IN (…)` | `resource_reactions(user_id, resource_id, …)` | mine there |
| 8 | courier: last 12 comments in 14 days | `comments(created_at DESC)` | 12 |
| 9 | engagement map for a list (codex cards/monsters, beta art, story feed) | `threads(thread_key)` range per prefix; story feed needs `community:` range + explicit static ids | threads in range (≤ 272 today) |
| 10 | run thread counts for ≤ 100 runs, philosopher reply counts | `threads(thread_key)` IN list | ≤ 100 |
| 11 | story feed `ORDER BY created_at DESC LIMIT 100/200/1000`, optional `source` | `community_stories(created_at)`, `(source, created_at)` | ≤ limit (26 rows today) |
| 12 | profile: my comments / my stories by time, offset paging | `comments(user_id, created_at)`, `community_stories(user_id, created_at)` | offset + page |
| 13 | writes: comment insert/delete, like put/delete, comment-like put/delete, reaction put, story insert/delete | PKs/uniques + counter rows updated in the same `batch()` | 1–3 per write |
| 14 | nav latest per surface + weekly | `posts(service, created_at DESC)` or `surface_latest`; `colorful_philosopher_posts(week_start)` | 9 |

Daily budget sense check (production call rates from §1–§9, all assumed to move to D1): ~440 thread reads × ~5 rows,
~230 courier × 12, ~185 like counts × 1, ~155 reaction totals × 1, ~120 engagement maps × ≤ 272, ~217 × 9 nav rows
≈ 40k rows read/day (index entries scanned can roughly double it) before crawler growth, about 1–2% of the 5M free tier. The full-map engagement read is the largest
term and grows with the number of threads.

---

## 14. Surprises and open points for the designers

1. **Story threads have no common prefix.** Official stories use their bare static id (`sts2-doormaker-removed`,
   and 17 STS1 ids that exist only in `data/stories.json`); user stories use `community:<uuid>`. A prefix-ranged
   `threads` read cannot serve the story feed alone.
2. **this-or-that likes are a separate system** (`this_or_that_post_likes`, its own trigger and a view), and the
   generic delta trigger deliberately skips `this-or-that:` likes. `threads` must either absorb that table or keep the
   exception.
3. **Orphan threads**: thread keys have no FK, posts can be deleted, and their comments/likes stay counted and shown by
   the courier. A `threads` table with an FK to `posts` would not accept these rows from the first copy.
4. **`comment_likes` has no env**; for the dump split, its env must come from the parent comment.
5. **History-course counts are duplicated**: `runs.like_count`/`comment_count` are trigger-maintained but the
   history-course list ignores them and counts rows (Q-C7/Q-L5); only the defragment board reads the columns.
6. **Nav weekly is time-dependent** and cannot be a write-time value; the courier filters empty text after `LIMIT 12`.
7. **The Worker comment check is stricter than the DB** (content trim ≥ 2 vs `char_length >= 1`); converted rows may
   contain 1-character comments, so a D1 CHECK copied from the Worker rule would reject existing data.
8. **`pg_column_size` CHECKs measure compressed bytes**; a JSON text byte CHECK in D1 may reject converted rows unless
   measured first.
9. **Seed stories bypass the guard** (service-role inserts with chosen `created_at` and `user_id null`); D1 needs
   `community_stories.user_id` nullable and a way for the conversion/sync to write `static_story_id` and
   `created_at` while client writes cannot.
10. **FK enforcement in D1**: every user-owned table here references `auth.users(id) ON DELETE CASCADE`, which D1
    does not have; `comment_likes → comments` is the only intra-domain FK, so first-copy order and change-log replay
    order matter (a like replayed before its comment fails unless foreign keys are deferred).
11. **Dead columns are still selected**: the Worker's `PHILOSOPHER_COLUMNS` (`comments.ts:40`) selects the dead
    `colorful_philosopher_posts.buff_count/nerf_count/rework_count`; `STORY_COLUMNS` and legacy `select *` include
    `env`. Shadow comparison must use an explicit column projection.
