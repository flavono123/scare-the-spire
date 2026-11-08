> Working notes from the 2026-11-08 D1 schema survey. [D1_SCHEMA_DESIGN.md](../../D1_SCHEMA_DESIGN.md) takes precedence
> where they differ. Paths under `scratchpad/` were temporary and are not kept.

# D1 step 2 inventory: Toy Box posts and their satellites

Input for the D1 schema designers (Supabase exit step 2, `docs/SUPABASE_EXIT_PLAN.md` 5.5, 5.6, 7). This file only
records what exists today and what reads and writes it. It does not decide the D1 schema. Where a fact bears directly
on one of the user's decisions (common `posts` table, `threads` counters, run summaries, author snapshot, query-derived
indexes) it is marked **→ decision N**.

## 0. Sources and conventions

- `schema:N` is line N of `/Users/flavono123/slseoun-backups/supabase/20261105-2048/public-schema.sql` (pg_dump of
  production, 2026-11-05, schema only).
- Code paths are relative to the worktree `/Users/flavono123/P/scare-the-spire/.claude/worktrees/supabase-exit`
  at `b0c5c521` (step 1 in production, pre-gate cleanup merged).
- Catalog stats come from the 2026-11-07 JSON files in `scratchpad/audit/` (`tstats.json`, `istats.json`,
  `cols.json`, `checks.json`, `policies.json`, `fndefs.json`, `stmts.json`). The statistics window starts at
  2026-06-02 13:43 UTC (Postgres start, never reset), so it is about **158 days**. "Per day" figures below divide by 158.
- `n_live_tup` is an estimate and counts **both envs** (`production` and `development` rows live in the same table).
  The per-env split is not in the catalog files.
- `stmts.json` holds only the **top 50 statements by total time**, query text cut at 500 characters. A query that is
  absent there is cheap, not necessarily rare.
- Column, CHECK, PK, UNIQUE, FK and index text in the "Facts" blocks is generated from `cols.json`, `checks.json`
  and `istats.json` (verbatim `format_type`, `pg_get_expr`, `pg_get_constraintdef`, `pg_get_indexdef`). I compared
  them against the dump: same columns, same 28 functions, same 81 policies. The catalog is 2 days newer than the dump
  and nothing in this domain changed in between.
- Every policy below applies to role `{public}` unless it says `TO authenticated` or `TO authenticated, anon`.
  All in-scope tables have `GRANT ALL ... TO anon, authenticated` (schema:5707-6118), so **RLS is the only guard**
  against direct browser writes.

## 1. Scope at a glance

| table | live rows 11-07 (11-05 est.) | ins / upd / del since 06-02 | status | service id (API, feed) | thread key prefix | nav surface id | detail page |
|---|---|---|---|---|---|---|---|
| `chemical_posts` | 54 (54) | 39 / 50 / 12 | live | `chemical_x` | `chemical-x:` | `chemical-x` | `/chemical-x/<id>` |
| `combo_posts` | 86 (86) | 97 / 94 / 11 | live | `combo` | `c-c-c-combo:` | `combo` | `/c-c-c-combo/<id>` |
| `transfigure_posts` | 85 (85) | 118 / 285 / 33 | live | `transfigure` | `transfigure:` | `transfigure` | `/transfigure/<id>` |
| `this_or_that_posts` | 23 (23) | 36 / 1178 / 13 | live | `this_or_that` | `this-or-that:` | `this-or-that` | `/this-or-that/<id>` |
| `favorite_tournament_posts` | 47 (47) | 50 / 151 / 3 | live | `favorite_tournament` | `favorite-tournament:` | `favorite-tournament` | `/this-or-that/tournament/<id>` |
| `decisions_decisions_posts` | 19 (19) | 25 / 66 / 6 | live | `decisions_decisions` | `decisions-decisions:` | `decisions-decisions` | `/decisions-decisions/<id>` |
| `pagestorm_posts` | 14 (14) | 25 / 45 / 11 | live | `pagestorm` | `pagestorm:` | `pagestorm` | `/pagestorm/<id>` |
| `defragment_posts` | 0 (0) | 0 / 0 / 0 | **dead** (CLEANUP_AUDIT 3.1) | `defragment` | `defragment:` | none | `/defragment/<id>` (kept until step 7) |
| `this_or_that_post_votes` | 1506 (1487) | 1604 / 0 / 96 | live | | | | |
| `this_or_that_post_likes` | 10 (10) | 26 / 0 / 16 | live | | | | |
| `this_or_that_post_like_counts` (view) | n/a | n/a | live, redundant | | | | |
| `favorite_tournament_candidate_stats` | 632 (632) | 637 / 2870 / 5 | live | | | | |
| `favorite_tournament_plays` | 68 (68) | 70 / 0 / 2 | live; "decide whether to keep in D1" (3.1) | | | | |
| `pagestorm_drafts` | 3 (3) | 9 / 6 / 6 | live | | | | |
| `defragment_bodies` | 9 (9) | 10 / 0 / 0 | live | | | | `/defragment/<service>/<id>` |
| `runs` (Defragment slice only) | 687 (687) | 680 / 699 / 75 | live (History Course domain) | `history_course` | `history-course:` | `history-course` | `/history-course/<id>` |

Service names differ by layer. The full map, which the designers will need for a `posts.service` value and a
`threads.thread_key` parser:

| layer | combo | transfigure | this or that | chemical X | decisions | tournament | pagestorm | defragment (dead) | history course |
|---|---|---|---|---|---|---|---|---|---|
| feed/API `service` (`src/lib/toybox-api-rules.ts:7-16`, `get_toybox_feed` schema:1935-1944) | `combo` | `transfigure` | `this_or_that` | `chemical_x` | `decisions_decisions` | `favorite_tournament` | `pagestorm` | `defragment` | `history_course` |
| thread key prefix (`src/lib/comment-threads.ts:51-85`) | `c-c-c-combo:` | `transfigure:` | `this-or-that:` | `chemical-x:` | `decisions-decisions:` | `favorite-tournament:` | `pagestorm:` | `defragment:` | `history-course:` |
| `admin_story_service` (schema:42-62) | `combo` | `transfigure` | `this_or_that` | `chemical_x` | `decisions_decisions` | `favorite_tournament` | `pagestorm` | `defragment` | **`other`** (no branch) |
| nav surface (`src/lib/nav-surfaces.ts:7-16`) | `combo` | `transfigure` | `this-or-that` | `chemical-x` | `decisions-decisions` | `favorite-tournament` | `pagestorm` | none | `history-course` |
| `defragment_bodies.source_service` CHECK | `combo` | `transfigure` | `this_or_that` | `chemical_x` | `decisions_decisions` | `favorite_tournament` | `pagestorm` | not allowed | not allowed |

## 2. What the 8 post tables share

### 2.1 Common columns

| column | chemical | combo | transfigure | this_or_that | tournament | decisions | pagestorm | defragment |
|---|---|---|---|---|---|---|---|---|
| `id uuid NOT NULL DEFAULT gen_random_uuid()` PK | yes | yes | yes | yes | yes | yes | yes | yes |
| `user_id uuid` FK `auth.users(id) ON DELETE CASCADE` | NOT NULL | NOT NULL | NOT NULL | NOT NULL | **nullable** (builtins) | NOT NULL | NOT NULL | NOT NULL |
| `nickname text NOT NULL` CHECK 1..20 chars | yes | yes | yes | yes | yes | yes | yes | yes |
| `avatar_id text`, `avatar_kind text`, `palette_id text` (nullable) | yes | yes | yes | yes | yes | yes | yes | yes |
| `palette_swapped boolean DEFAULT false` (**nullable**) | yes | yes | yes | yes | yes | yes | yes | yes |
| `author_token_size_check` | yes | yes | yes | yes | yes | yes | yes | yes |
| `env text NOT NULL DEFAULT 'production'` CHECK in (production, development) | yes | yes | yes | yes | yes | yes | yes | yes |
| `created_at timestamptz DEFAULT now()` | **nullable** | NOT NULL | NOT NULL | NOT NULL | NOT NULL | NOT NULL | NOT NULL | NOT NULL |
| `like_count integer NOT NULL DEFAULT 0` | yes | yes | yes | yes | yes | yes | yes | yes |
| `comment_count integer NOT NULL DEFAULT 0` | yes | yes | yes | yes | yes | yes | yes | yes |
| extra counters | | | | `left_vote_count`, `right_vote_count`, generated `vote_rate_bps` | `play_count` | | | |
| `title` | | | nullable, 1..80 after btrim | | NOT NULL 1..80 | NOT NULL 1..80 | NOT NULL 1..80 | NOT NULL 1..80 |
| `content jsonb` + `content_text text` | any (no type CHECK), 2..30 chars | array, >=2 chars | array, >=2 chars | | | | **object**, 1..8000 | any, 2..8000 |

The author snapshot CHECK, verbatim in every table:

```sql
CHECK ((((COALESCE(octet_length(avatar_id), 0) + COALESCE(octet_length(avatar_kind), 0)) + COALESCE(octet_length(palette_id), 0)) <= 1024))
```

### 2.2 Author snapshot (**→ decision 5**)

- The browser sends `nickname`, `avatar_id`, `avatar_kind`, `palette_id`, `palette_swapped` with every insert
  (`currentAuthorProfileToken()`, `src/lib/user-profile.ts:118-152`). `avatar_kind` is `"character" | "boss" | null`
  (`src/lib/user-profile.ts:11`). With no stored profile the token is `null, null, null, false`.
- The snapshot is frozen at insert **and refreshed on every edit**: the update patches of combo, transfigure, decisions
  and pagestorm include the nickname and the four token fields (`src/hooks/use-combo-posts.ts:129-141`,
  `use-transfigure-posts.ts:363-374`, `use-decisions-decisions-posts.ts:108-122`, `use-pagestorm-posts.ts:121-130`).
- Builtin tournaments have `user_id NULL` and nickname `세 번째 손` (`src/lib/favorite-tournament.ts:42`), avatar
  columns NULL.
- `pagestorm_drafts` keeps the same 5 columns. `defragment_bodies` keeps only `nickname`.
- Readers: every list card and detail page shows nickname + avatar + palette; `isOwner` compares `user_id` with the
  session user.

### 2.3 RLS, by table

| table | SELECT | INSERT (WITH CHECK) | UPDATE | DELETE |
|---|---|---|---|---|
| `chemical_posts` | `chemical_posts_read` `true` (schema:4719) | `chemical_posts_insert` `(auth.uid() = user_id)` (4712) | **none** | `chemical_posts_delete` `(auth.uid() = user_id)` (4705) |
| `combo_posts` | `combo_posts_read` `true` (4793) | `(auth.uid() = user_id)` (4786) | `combo_posts_update` USING/CHECK `(auth.uid() = user_id)` (4800) | `(auth.uid() = user_id)` (4779) |
| `transfigure_posts` | `true` (5440) | `(auth.uid() = user_id)` (5433) | USING/CHECK `(auth.uid() = user_id)` (5447) | `(auth.uid() = user_id)` (5426) |
| `this_or_that_posts` | `true` (5413) | `(auth.uid() = user_id)` (5406) | **none** | `(auth.uid() = user_id)` (5399) |
| `favorite_tournament_posts` | `true` (5069) | `((auth.uid() = user_id) AND (preset_key !~~ 'builtin:%'::text))` (5062) | **none** | `(auth.uid() = user_id)` (5055); builtins have NULL user_id so nobody can delete them |
| `decisions_decisions_posts` | `true` (4948) | `(auth.uid() = user_id)` (4941) | USING/CHECK `(auth.uid() = user_id)` (4955) | `(auth.uid() = user_id)` (4934) |
| `pagestorm_posts` | `true` (5177) | `(auth.uid() = user_id)` (5170) | USING/CHECK `(auth.uid() = user_id)` (5184) | `(auth.uid() = user_id)` (5163) |
| `defragment_posts` (dead) | `true` (5016) | `(auth.uid() = user_id)` (5009) | USING/CHECK `(auth.uid() = user_id)` (5023) | `(auth.uid() = user_id)` (5002) |
| `this_or_that_post_votes` | `this_or_that_post_votes_read_owner` `(( SELECT auth.uid() AS uid) = user_id)` (5386): **only your own votes** | `this_or_that_post_votes_insert_owner` (5377-5379), see 3.5 | **none** (change = delete + insert) | `(( SELECT auth.uid() AS uid) = user_id)` (5370) |
| `this_or_that_post_likes` | `this_or_that_post_likes_read_all` `true` (5357): all likes with user ids are public | `(auth.uid() = user_id)` (5350) | none | `(auth.uid() = user_id)` (5343) |
| `favorite_tournament_candidate_stats` | `favorite_tournament_stats_read` `true` (5076) | none (only the SECURITY DEFINER RPC writes) | none | none |
| `favorite_tournament_plays` | `favorite_tournament_plays_read` `true` (5042): every play with `user_id` is public (tasks/010 #67, CLEANUP 3.4) | none (RPC only) | none | none |
| `pagestorm_drafts` | `pagestorm_drafts_read` `(auth.uid() = user_id)` (5143): own only | `(auth.uid() = user_id)` (5136) | USING/CHECK `(auth.uid() = user_id)` (5150) | `(auth.uid() = user_id)` (5129) |
| `defragment_bodies` | `true` (4982) | `TO authenticated` `((( SELECT auth.uid() AS uid) = user_id) AND public.defragment_source_owned(source_service, source_id, env))` (4975) | `TO authenticated` USING `(( SELECT auth.uid() AS uid) = user_id)` CHECK same as insert (4989) | `(auth.uid() = user_id)` (4968), no client deletes |
| `runs` | `true` (5323) | `(auth.uid() = donor_user_id)` (5316) | USING/CHECK `(auth.uid() = donor_user_id)` (5330) | `(auth.uid() = donor_user_id)` (5309) |

Plain words: every post, satellite count and tournament stat is world-readable; drafts and individual this-or-that
votes are private to their owner; a user can create, edit (where an update policy exists) and delete only rows whose
`user_id` is their own `auth.uid()`. Nothing in RLS stops a user from writing a row with the **other** env (accepted
step-1 risk, STEP1_DESIGN 9.8). `TOYBOX_UPDATABLE_SERVICES` (`src/lib/toybox-api-rules.ts:21`) mirrors the update
policies: combo, transfigure, decisions_decisions, pagestorm, defragment.

### 2.4 Guard triggers (server columns)

`guard_post_server_columns()` (schema:2042-2076), `BEFORE INSERT OR UPDATE ... FOR EACH ROW WHEN
((CURRENT_USER = ANY (ARRAY['anon'::name, 'authenticated'::name])))`, attached to all 8 post tables and to `runs`
(schema:4310-4436: `chemical_posts_guard_server_columns`, `combo_...`, `decisions_decisions_...`, `defragment_...`,
`favorite_tournament_...`, `pagestorm_...`, `runs_...`, `this_or_that_...`, `transfigure_...`):

- INSERT: `like_count := 0`, `comment_count := 0`, `created_at := now()`; for `this_or_that_posts` also
  `left_vote_count := 0`, `right_vote_count := 0`; for `favorite_tournament_posts` also `play_count := 0`.
- UPDATE: restores `id`, `env`, `like_count`, `comment_count`, `created_at` from OLD; plus the vote counts
  (`this_or_that_posts`) or `play_count` (`favorite_tournament_posts`). `user_id` is not restored (the update policy's
  WITH CHECK keeps it equal to `auth.uid()`). Service columns such as `preset_key`, `game_version`, `resource_*` stay
  editable.
- Not attached to `pagestorm_drafts`, `defragment_bodies`, `this_or_that_post_votes`, `this_or_that_post_likes`,
  `favorite_tournament_*`: their `created_at` / `updated_at` are client-settable (drafts and bodies send
  `updated_at: new Date().toISOString()`, `use-pagestorm-posts.ts:163-177`, `use-defragment-bodies.ts:131,150`).
- The `WHEN` clause means **service-role and owner writes bypass the guard**: the builtin seed
  (`scripts/seed-favorite-tournament-builtins.ts:76-118`, sets `created_at`), a step-4 Worker writing with the service
  key, and the step-5 outbox mirror. A Worker that writes through the service key must set counters and `created_at`
  itself; the mirror can carry D1's `created_at` unchanged.

`guard_insert_server_columns()` (schema:2022-2034) is **not** attached to any table in this domain. It runs on
`comments` and `community_stories` inserts (schema:4331, 4345, same `WHEN`): `created_at := now()` and, for
`community_stories`, `static_story_id := null`. It matters here only because comments on toybox posts drive
`comment_count` (2.5).

### 2.5 Counter maintenance today (**→ decision 3**)

| counter | maintained by | source rows |
|---|---|---|
| `<post>.comment_count` for combo, transfigure, this_or_that, chemical, defragment, decisions, tournament, pagestorm | `apply_toybox_thread_engagement_delta('comment')` AFTER INSERT OR DELETE ON `comments` (schema:253-374, trigger 4338) | `comments.story_id = '<prefix>:<uuid>'` |
| `<post>.like_count` for combo, transfigure, chemical, defragment, decisions, tournament, pagestorm | `apply_toybox_thread_engagement_delta('like')` AFTER INSERT OR DELETE ON `likes` (trigger 4387) | `likes.story_id = '<prefix>:<uuid>'` |
| `this_or_that_posts.like_count` | `apply_this_or_that_like_count_delta()` AFTER INSERT OR DELETE ON `this_or_that_post_likes` (schema:175-200, trigger 4415) | `this_or_that_post_likes` (the generic `likes` branch has **no** `this-or-that` case) |
| `this_or_that_posts.left_vote_count`, `right_vote_count` | `apply_this_or_that_vote_count_delta()` AFTER INSERT OR DELETE ON `this_or_that_post_votes` (schema:208-247, trigger 4422) | votes |
| `runs.like_count`, `runs.comment_count` | the same engagement trigger, `history-course:` branch (schema:276-288) | likes / comments with `history-course:<run id>` |
| `favorite_tournament_posts.play_count`, all of `favorite_tournament_candidate_stats` | **only** `complete_favorite_tournament_play` (RPC, schema:396-543); no trigger | `favorite_tournament_plays` row inserted by the same RPC |

Details that a port must keep or consciously change:

- Every delta is `greatest(0, count + delta)`; counts never go negative even if they drift.
- `UPDATE` on likes/comments/votes is ignored (`return coalesce(new, old)`).
- The engagement trigger parses `split_part(story_id, ':', 2)::uuid` and silently ignores keys that are not uuids
  (`invalid_text_representation`, `data_exception`).
- It matches the row by `id = post_id and env = rec.env`; with one D1 database per env the env term disappears.
- Deleting a post does **not** delete its `likes`/`comments` (string keys, no FK). `this_or_that_post_*` and
  `favorite_tournament_*` cascade through their FKs. `defragment_bodies` has no FK at all and is orphaned.
- The counters are what the feeds sort by (`recommended` = `like_count`, `comments` = `comment_count`,
  `vote_rate_*` = `left_vote_count + right_vote_count`, `play_count`), so a sortable index on them needs the count in
  the posts row or a join; see 6.
- Detail pages do not read the counter columns for likes: they `HEAD`-count `likes` rows for the thread key
  (`workers/api/routes/comments.ts:181-193`), except decisions (`initialCount` from `like_count`) and this or that
  (its own likes). Lists read the counters from the feed rows (`countsFromFeedItems`, `src/lib/toybox-feed.ts:248-258`).
- Today's write rates are tiny: about 10 votes/day (1604 inserts / 158 d), about 7 counter updates/day on
  `this_or_that_posts` (1178 / 158).

## 3. Per table

### 3.1 `chemical_posts` (케미컬X)

One-line rich posts: `content` is a `PostBlock[]` (text, entity and keyword blocks), `content_text` its plain text,
2 to 30 characters (`CHEMICAL_POST_MIN_CHARS`/`MAX_CHARS`, `src/lib/content-limits.ts:11-12`). DDL schema:2559-2581.

Stats (pg_stat_user_tables, 2026-11-07; counters since 2026-06-02): live rows **54**, inserted 39, updated 50, deleted 12, seq scans 34914 (1830444 tuples read), index scans 9684, total size 180224 B (heap 40960 B, TOAST 8192 B).

| # | column | type | NOT NULL | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | yes | `gen_random_uuid()` |
| 2 | `user_id` | `uuid` | yes |  |
| 3 | `nickname` | `text` | yes |  |
| 4 | `content` | `jsonb` | yes |  |
| 5 | `content_text` | `text` | yes |  |
| 6 | `env` | `text` | yes | `'production'::text` |
| 7 | `created_at` | `timestamp with time zone` | no | `now()` |
| 8 | `like_count` | `integer` | yes | `0` |
| 9 | `comment_count` | `integer` | yes | `0` |
| 10 | `avatar_id` | `text` | no |  |
| 11 | `avatar_kind` | `text` | no |  |
| 12 | `palette_id` | `text` | no |  |
| 13 | `palette_swapped` | `boolean` | no | `false` |

Constraints (verbatim `pg_get_constraintdef`):

```sql
-- PRIMARY KEY: chemical_posts_pkey
PRIMARY KEY (id);
-- FOREIGN KEY: chemical_posts_user_id_fkey
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
-- CHECK: chemical_posts_author_token_size_check
CHECK ((((COALESCE(octet_length(avatar_id), 0) + COALESCE(octet_length(avatar_kind), 0)) + COALESCE(octet_length(palette_id), 0)) <= 1024));
-- CHECK: chemical_posts_content_size_check
CHECK ((pg_column_size(content) <= 1048576));
-- CHECK: chemical_posts_content_text_check
CHECK (((char_length(content_text) >= 2) AND (char_length(content_text) <= 30)));
-- CHECK: chemical_posts_env_check
CHECK ((env = ANY (ARRAY['production'::text, 'development'::text])));
-- CHECK: chemical_posts_nickname_check
CHECK (((char_length(nickname) >= 1) AND (char_length(nickname) <= 20)));
```

| index | idx_scan | bytes | definition |
|---|---|---|---|
| `idx_chemical_posts_env_created` | 9428 | 16384 | `USING btree (env, created_at DESC)` |
| `idx_chemical_posts_env_user_created` | 94 | 16384 | `USING btree (env, user_id, created_at DESC)` |
| `idx_chemical_posts_env_recommend_created` | 72 | 16384 | `USING btree (env, (((like_count * 4) + (comment_count * 6))) DESC, created_at DESC, id DESC)` |
| `chemical_posts_pkey (PK)` | 42 | 16384 | `USING btree (id)` |
| `idx_chemical_posts_env_like_created` | 26 | 16384 | `USING btree (env, like_count DESC, created_at DESC, id DESC)` |
| `idx_chemical_posts_env_comment_created` | 22 | 16384 | `USING btree (env, comment_count DESC, created_at DESC, id DESC)` |


- `content` has no `jsonb_typeof` CHECK here (combo and transfigure have one); the client always sends an array.
- `created_at` is the **only nullable `created_at`** among the post tables.
- Triggers: `chemical_posts_guard_server_columns` (2.4). Counters through the engagement trigger (2.5).
- RLS: read all, insert/delete own, **no update policy** (posts cannot be edited).
- Functions: `get_toybox_feed` (service `chemical_x`), `get_defragment_feed_v2` (branch `chemical_x`, title
  `left(btrim(p.content_text), 120)`), `defragment_source_owned`, `get_my_profile_activity(_stats)`,
  `get_rls_activity_metrics`.

Queries:

| where | op | columns | filter | order / limit / cursor | volume |
|---|---|---|---|---|---|
| `src/hooks/use-chemical-posts.ts:101-106` → `useToyboxFeed` → `src/lib/toybox-feed.ts:278` (api) / `:285` (legacy) | feed RPC | RPC row + `post` | service `chemical_x` | 4.1, 20, keyset | part of 6820 |
| `src/hooks/use-chemical-posts.ts:68` (api POST) / `:76` (legacy insert) | insert | `user_id, nickname, content, content_text, env` + author token; returns `*` | | | 39 inserts |
| `src/components/chemicalx/post-view.tsx:63` (api) / `:70` (legacy) | select | `*` | `id`, `env` | `.single()` | |
| `src/components/chemicalx/post-view.tsx:95` (api) / `:105` (legacy) | delete | | `id`, `user_id`, `env` | | 12 deletes |
| `src/lib/nav-seen.ts:319-325` (legacy nav), `workers/api/routes/nav.ts:151-157` (Worker nav) | select | `created_at` | `env`, `created_at > since` / `not.is.null` | `created_at desc[.nullslast]`, 1 | 29 158 anon (mean 13.3 ms) + 5329 authenticated (17.2 ms) |
| `get_my_profile_activity(_stats)` via `workers/api/routes/profile.ts:38,58` | RPC | `id, content_text, content, created_at` | `env`, own `user_id` | `created_at desc, activity_id desc` | |
| Defragment: `get_defragment_feed_v2`, filtered feed, Pagestorm embed (`src/hooks/use-pagestorm-toybox.ts:67/75`) | | see 4.2 | | | |
| Off / dev: `workers/detail-shell-og.ts:341` (`content_text, content`), `src/lib/toybox-post-og-fields.ts:160`, `/dev/admin` (`admin-dev-page.tsx:400-428`) | | | | | |

UI: list card shows the rendered `content`, `nickname` + avatar snapshot, `created_at` (relative time and read mark),
like and comment counts from the feed row (`src/components/chemicalx/post-card.tsx`). Detail adds comments and the
generic like button (thread `chemical-x:<id>`). Sorted by `latest`, `recommended` (likes), `comments`.

Dead: `idx_chemical_posts_env_recommend_created` (CLEANUP 3.1).

### 3.2 `combo_posts` (코오오옴보)

Rich posts that reference at least two game elements. `content` is a `PostBlock[]`, `content_text` its plain text,
`resources` the de-duplicated element references extracted from the blocks (`extractComboResourceRefs`,
`src/lib/combo-types.ts:86-107`). DDL schema:2633-2658.

Stats (pg_stat_user_tables, 2026-11-07; counters since 2026-06-02): live rows **86**, inserted 97, updated 94, deleted 11, seq scans 8366 (594760 tuples read), index scans 49831, total size 303104 B (heap 163840 B, TOAST 8192 B).

| # | column | type | NOT NULL | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | yes | `gen_random_uuid()` |
| 2 | `user_id` | `uuid` | yes |  |
| 3 | `nickname` | `text` | yes |  |
| 4 | `content` | `jsonb` | yes |  |
| 5 | `content_text` | `text` | yes |  |
| 6 | `resources` | `jsonb` | yes |  |
| 7 | `env` | `text` | yes | `'production'::text` |
| 8 | `created_at` | `timestamp with time zone` | yes | `now()` |
| 9 | `like_count` | `integer` | yes | `0` |
| 10 | `comment_count` | `integer` | yes | `0` |
| 11 | `avatar_id` | `text` | no |  |
| 12 | `avatar_kind` | `text` | no |  |
| 13 | `palette_id` | `text` | no |  |
| 14 | `palette_swapped` | `boolean` | no | `false` |

Constraints (verbatim `pg_get_constraintdef`):

```sql
-- PRIMARY KEY: combo_posts_pkey
PRIMARY KEY (id);
-- FOREIGN KEY: combo_posts_user_id_fkey
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
-- CHECK: combo_posts_author_token_size_check
CHECK ((((COALESCE(octet_length(avatar_id), 0) + COALESCE(octet_length(avatar_kind), 0)) + COALESCE(octet_length(palette_id), 0)) <= 1024));
-- CHECK: combo_posts_content_check
CHECK ((jsonb_typeof(content) = 'array'::text));
-- CHECK: combo_posts_content_size_check
CHECK (((pg_column_size(content) <= 1048576) AND (pg_column_size(resources) <= 131072) AND (octet_length(content_text) <= 65536)));
-- CHECK: combo_posts_content_text_check
CHECK ((char_length(content_text) >= 2));
-- CHECK: combo_posts_env_check
CHECK ((env = ANY (ARRAY['production'::text, 'development'::text])));
-- CHECK: combo_posts_nickname_check
CHECK (((char_length(nickname) >= 1) AND (char_length(nickname) <= 20)));
-- CHECK: combo_posts_resources_check
CHECK (((jsonb_typeof(resources) = 'array'::text) AND (jsonb_array_length(resources) >= 2)));
```

| index | idx_scan | bytes | definition |
|---|---|---|---|
| `idx_combo_posts_env_created` | 42874 | 16384 | `USING btree (env, created_at DESC)` |
| `combo_posts_pkey (PK)` | 3298 | 16384 | `USING btree (id)` |
| `idx_combo_posts_env_recommend_created` | 1936 | 16384 | `USING btree (env, (((like_count * 4) + (comment_count * 6))) DESC, created_at DESC, id DESC)` |
| `idx_combo_posts_env_user_created` | 1294 | 16384 | `USING btree (env, user_id, created_at DESC)` |
| `idx_combo_posts_env_like_created` | 403 | 16384 | `USING btree (env, like_count DESC, created_at DESC, id DESC)` |
| `idx_combo_posts_env_comment_created` | 26 | 16384 | `USING btree (env, comment_count DESC, created_at DESC, id DESC)` |


- `resources` is `[{ "type": EntityType, "id": string }]`, unique by `type:id`, at least 2 (CHECK). At most one YouTube
  block (client check, `countComboYouTubeReferences`).
- **`resources` is filtered and aggregated by element** on the index page: the filter chips keep posts that share any
  selected element (`comboPostMatchesAnyGameElement`, `src/lib/combo-types.ts:37-45`, used at
  `src/components/combo/combo-client.tsx:74-79`), and the chip list ranks elements by how many loaded posts mention them
  (`rankPopularComboResources`, `src/lib/combo-types.ts:53-82`). Both run in the browser over the pages loaded so far;
  the server never filters by element today. **→ decision 2** (an array filtered by element becomes a child table).
- Triggers: guard (2.4), counters via engagement trigger (2.5).
- RLS: read all; insert/update/delete own.

Queries:

| where | op | columns | filter | order / limit / cursor | volume |
|---|---|---|---|---|---|
| `src/hooks/use-combo-posts.ts:178-183` → `useToyboxFeed` → `src/lib/toybox-feed.ts:278/285` | feed RPC | row + `post` | service `combo` | 4.1 | part of 6820 |
| `src/hooks/use-combo-posts.ts:99` / `:107` | insert | `user_id, nickname, content, content_text, resources, env` + token; returns `*` | | | 97 inserts |
| `src/hooks/use-combo-posts.ts:143` / `:153` (detail edit only) | update | patch `nickname, content, content_text, resources` + token; returns `*` | `id`, `user_id`, `env` | `.single()` | 94 updates (includes counter updates) |
| `src/hooks/use-combo-posts.ts:232` / `:240` | select | `*` | `id`, `env` | `maybeSingle` | |
| `src/hooks/use-combo-posts.ts:291` / `:304` | delete | | `id`, `user_id`, `env` | | 11 deletes |
| nav (`src/lib/nav-seen.ts:319-325`, `workers/api/routes/nav.ts:151-157`) | select | `created_at` | `env`, `created_at > since` | desc, 1 | 29 190 anon (4.5 ms) + 5295 authenticated (8.4 ms) |
| `get_my_profile_activity(_stats)` | RPC | `id, content_text, content, created_at` | own | | |
| Defragment v2 / filtered / Pagestorm embed | | 4.2 | | | |
| Off / dev: `workers/detail-shell-og.ts:316` (`content_text, content, resources`), `toybox-post-og-fields.ts:70`, `/dev/admin` (`admin-dev-page.tsx:296-324`, no `resources`) | | | | | |

UI: card renders `content` and the referenced elements (`resources` drive the resource gallery and filter),
`nickname` + avatar, `created_at`, like/comment counts (`src/components/combo/combo-post-card.tsx`). Detail: same plus
edit (owner), delete, comments, generic likes.

Dead: `idx_combo_posts_env_recommend_created` (1936 scans, but no ORDER BY uses the expression). The list hook's
`update`/`remove` were deleted in the cleanup (`2cd8ba00`).

### 3.3 `transfigure_posts` (변형)

A user's "transfigured" version of one game element (card, relic, potion, power, ...). The row columns hold the
representative variant; `extra_variants` holds up to 11 more (`TRANSFIGURE_MAX_VARIANTS = 12` including the
representative, `src/lib/transfigure-types.ts:108`). DDL schema:3393-3464. Attribute numbers 19 and 20 are dropped
columns.

Stats (pg_stat_user_tables, 2026-11-07; counters since 2026-06-02): live rows **85**, inserted 118, updated 285, deleted 33, seq scans 5521 (256306 tuples read), index scans 54007, total size 327680 B (heap 122880 B, TOAST 57344 B).

| # | column | type | NOT NULL | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | yes | `gen_random_uuid()` |
| 2 | `user_id` | `uuid` | yes |  |
| 3 | `nickname` | `text` | yes |  |
| 4 | `resource_type` | `text` | yes |  |
| 5 | `resource_id` | `text` | yes |  |
| 6 | `source_text` | `text` | yes |  |
| 7 | `source_game_locale` | `text` | yes |  |
| 8 | `content` | `jsonb` | yes |  |
| 9 | `content_text` | `text` | yes |  |
| 10 | `env` | `text` | yes | `'production'::text` |
| 11 | `created_at` | `timestamp with time zone` | yes | `now()` |
| 12 | `title` | `text` | no |  |
| 13 | `transformed_name` | `text` | no |  |
| 14 | `transformed_cost` | `text` | no |  |
| 15 | `upgraded_content` | `jsonb` | no |  |
| 16 | `upgraded_content_text` | `text` | no |  |
| 17 | `transformed_upgrade_cost` | `text` | no |  |
| 18 | `show_upgrade` | `boolean` | yes | `false` |
| 21 | `card_top_keywords` | `text[]` | yes | `'{}'::text[]` |
| 22 | `card_bottom_keywords` | `text[]` | yes | `'{}'::text[]` |
| 23 | `upgraded_card_top_keywords` | `text[]` | yes | `'{}'::text[]` |
| 24 | `upgraded_card_bottom_keywords` | `text[]` | yes | `'{}'::text[]` |
| 25 | `transformed_card_type` | `text` | no |  |
| 26 | `transformed_card_rarity` | `text` | no |  |
| 27 | `transformed_star_cost` | `text` | no |  |
| 28 | `transformed_upgrade_star_cost` | `text` | no |  |
| 29 | `token_color` | `text` | no |  |
| 30 | `token_wax` | `text` | no |  |
| 31 | `like_count` | `integer` | yes | `0` |
| 32 | `comment_count` | `integer` | yes | `0` |
| 33 | `transformed_card_color` | `text` | no |  |
| 34 | `omit_energy_cost` | `boolean` | no | `false` |
| 35 | `avatar_id` | `text` | no |  |
| 36 | `avatar_kind` | `text` | no |  |
| 37 | `palette_id` | `text` | no |  |
| 38 | `palette_swapped` | `boolean` | no | `false` |
| 39 | `extra_variants` | `jsonb` | yes | `'[]'::jsonb` |

Constraints (verbatim `pg_get_constraintdef`):

```sql
-- PRIMARY KEY: transfigure_posts_pkey
PRIMARY KEY (id);
-- FOREIGN KEY: transfigure_posts_user_id_fkey
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
-- CHECK: transfigure_posts_author_token_size_check
CHECK ((((COALESCE(octet_length(avatar_id), 0) + COALESCE(octet_length(avatar_kind), 0)) + COALESCE(octet_length(palette_id), 0)) <= 1024));
-- CHECK: transfigure_posts_card_keyword_count_check
CHECK (((cardinality(card_top_keywords) <= 5) AND (cardinality(card_bottom_keywords) <= 3) AND (cardinality(upgraded_card_top_keywords) <= 5) AND (cardinality(upgraded_card_bottom_keywords) <= 3)));
-- CHECK: transfigure_posts_card_keywords_resource_check
CHECK (((resource_type = 'card'::text) OR ((cardinality(card_top_keywords) = 0) AND (cardinality(card_bottom_keywords) = 0) AND (cardinality(upgraded_card_top_keywords) = 0) AND (cardinality(upgraded_card_bottom_keywords) = 0))));
-- CHECK: transfigure_posts_content_check
CHECK ((jsonb_typeof(content) = 'array'::text));
-- CHECK: transfigure_posts_content_size_check
CHECK (((pg_column_size(content) <= 1048576) AND (pg_column_size(upgraded_content) <= 1048576)));
-- CHECK: transfigure_posts_content_text_check
CHECK ((char_length(content_text) >= 2));
-- CHECK: transfigure_posts_env_check
CHECK ((env = ANY (ARRAY['production'::text, 'development'::text])));
-- CHECK: transfigure_posts_extra_variants_shape
CHECK (((jsonb_typeof(extra_variants) = 'array'::text) AND (jsonb_array_length(extra_variants) <= 11) AND (octet_length((extra_variants)::text) <= 262144)));
-- CHECK: transfigure_posts_key_size_check
CHECK (((octet_length(title) <= 1024) AND (octet_length(transformed_name) <= 1024) AND (octet_length(transformed_cost) <= 1024) AND (octet_length(transformed_star_cost) <= 1024) AND (octet_length(transformed_upgrade_cost) <= 1024) AND (octet_length(transformed_upgrade_star_cost) <= 1024) AND (pg_column_size(card_top_keywords) <= 1024) AND (pg_column_size(card_bottom_keywords) <= 1024) AND (pg_column_size(upgraded_card_top_keywords) <= 1024) AND (pg_column_size(upgraded_card_bottom_keywords) <= 1024)));
-- CHECK: transfigure_posts_nickname_check
CHECK (((char_length(nickname) >= 1) AND (char_length(nickname) <= 20)));
-- CHECK: transfigure_posts_resource_id_check
CHECK (((char_length(resource_id) >= 1) AND (char_length(resource_id) <= 128)));
-- CHECK: transfigure_posts_resource_type_check
CHECK ((resource_type = ANY (ARRAY['card'::text, 'character'::text, 'keyword'::text, 'relic'::text, 'potion'::text, 'power'::text, 'enchantment'::text, 'affliction'::text, 'event'::text, 'ancient'::text, 'epoch'::text])));
-- CHECK: transfigure_posts_show_upgrade_card_check
CHECK (((NOT show_upgrade) OR (resource_type = 'card'::text)));
-- CHECK: transfigure_posts_source_game_locale_check
CHECK ((char_length(source_game_locale) = 3));
-- CHECK: transfigure_posts_source_text_check
CHECK ((char_length(source_text) >= 1));
-- CHECK: transfigure_posts_text_size_check
CHECK (((octet_length(source_text) <= 65536) AND (octet_length(content_text) <= 65536) AND (octet_length(upgraded_content_text) <= 65536)));
-- CHECK: transfigure_posts_title_length_check
CHECK (((title IS NULL) OR ((char_length(btrim(title)) >= 1) AND (char_length(btrim(title)) <= 80))));
-- CHECK: transfigure_posts_token_color_check
CHECK (((token_color IS NULL) OR ((resource_type = ANY (ARRAY['relic'::text, 'potion'::text, 'power'::text, 'enchantment'::text, 'affliction'::text])) AND (token_color = ANY (ARRAY['gold'::text, 'red'::text, 'green'::text, 'orange'::text, 'pink'::text, 'aqua'::text, 'blue'::text, 'purple'::text])))));
-- CHECK: transfigure_posts_token_wax_check
CHECK (((token_wax IS NULL) OR ((resource_type = ANY (ARRAY['relic'::text, 'potion'::text, 'power'::text, 'enchantment'::text, 'affliction'::text])) AND (token_wax = ANY (ARRAY['wax'::text, 'melted'::text])))));
-- CHECK: transfigure_posts_transformed_card_color_check
CHECK (((transformed_card_color IS NULL) OR ((resource_type = 'card'::text) AND (transformed_card_color = ANY (ARRAY['ironclad'::text, 'silent'::text, 'regent'::text, 'necrobinder'::text, 'defect'::text, 'colorless'::text, 'status'::text, 'curse'::text, 'event'::text, 'quest'::text, 'token'::text])))));
-- CHECK: transfigure_posts_transformed_card_rarity_check
CHECK (((transformed_card_rarity IS NULL) OR ((resource_type = 'card'::text) AND (transformed_card_rarity = ANY (ARRAY['일반'::text, '고급'::text, '희귀'::text, '고대의 존재'::text, '이벤트'::text, '토큰'::text, '저주'::text, '상태이상'::text, '퀘스트'::text])))));
-- CHECK: transfigure_posts_transformed_card_type_check
CHECK (((transformed_card_type IS NULL) OR ((resource_type = 'card'::text) AND (transformed_card_type = ANY (ARRAY['공격'::text, '스킬'::text, '파워'::text, '저주'::text, '상태이상'::text, '퀘스트'::text])))));
-- CHECK: transfigure_posts_transformed_cost_check
CHECK (((transformed_cost IS NULL) OR (btrim(transformed_cost) ~ '^(X|[0-9]{1,2})$'::text)));
-- CHECK: transfigure_posts_transformed_name_length_check
CHECK (((transformed_name IS NULL) OR ((char_length(btrim(transformed_name)) >= 1) AND (char_length(btrim(transformed_name)) <= 80))));
-- CHECK: transfigure_posts_transformed_star_cost_check
CHECK (((transformed_star_cost IS NULL) OR (btrim(transformed_star_cost) ~ '^(X|[0-9]{1,2})$'::text)));
-- CHECK: transfigure_posts_transformed_upgrade_cost_check
CHECK (((transformed_upgrade_cost IS NULL) OR ((upgraded_content IS NOT NULL) AND (btrim(transformed_upgrade_cost) ~ '^(X|[0-9]{1,2})$'::text))));
-- CHECK: transfigure_posts_transformed_upgrade_star_cost_check
CHECK (((transformed_upgrade_star_cost IS NULL) OR (btrim(transformed_upgrade_star_cost) ~ '^(X|[0-9]{1,2})$'::text)));
-- CHECK: transfigure_posts_upgraded_card_keywords_content_check
CHECK (((upgraded_content IS NOT NULL) OR ((cardinality(upgraded_card_top_keywords) = 0) AND (cardinality(upgraded_card_bottom_keywords) = 0))));
-- CHECK: transfigure_posts_upgraded_content_array_check
CHECK (((upgraded_content IS NULL) OR (jsonb_typeof(upgraded_content) = 'array'::text)));
-- CHECK: transfigure_posts_upgraded_content_pair_check
CHECK ((((upgraded_content IS NULL) AND (upgraded_content_text IS NULL)) OR ((upgraded_content IS NOT NULL) AND (upgraded_content_text IS NOT NULL) AND (char_length(btrim(upgraded_content_text)) >= 2))));
```

| index | idx_scan | bytes | definition |
|---|---|---|---|
| `idx_transfigure_posts_env_created` | 47529 | 16384 | `USING btree (env, created_at DESC)` |
| `transfigure_posts_pkey (PK)` | 4360 | 16384 | `USING btree (id)` |
| `idx_transfigure_posts_env_like_created` | 1305 | 16384 | `USING btree (env, like_count DESC, created_at DESC, id DESC)` |
| `idx_transfigure_posts_env_resource_created` | 343 | 16384 | `USING btree (env, resource_type, resource_id, created_at DESC)` |
| `idx_transfigure_posts_env_recommend_created` | 246 | 16384 | `USING btree (env, (((like_count * 4) + (comment_count * 6))) DESC, created_at DESC, id DESC)` |
| `idx_transfigure_posts_env_user_created` | 193 | 16384 | `USING btree (env, user_id, created_at DESC)` |
| `idx_transfigure_posts_env_comment_created` | 31 | 16384 | `USING btree (env, comment_count DESC, created_at DESC, id DESC)` |


- Every `extra_variants` element has the shape of `TransfigureVariant` (`src/lib/transfigure-types.ts:111-135`):
  `resource_type, resource_id, source_text, transformed_name, transformed_cost, transformed_star_cost,
  transformed_card_type, transformed_card_rarity, transformed_card_color, omit_energy_cost, card_top_keywords,
  card_bottom_keywords, upgraded_content, upgraded_content_text, transformed_upgrade_cost, transformed_upgrade_star_cost,
  upgraded_card_top_keywords, upgraded_card_bottom_keywords, show_upgrade, token_color, token_wax, content,
  content_text`. The per-column CHECKs above are **not** applied to the variants inside `extra_variants`; the client
  validates them (`validateVariantInput`, `src/hooks/use-transfigure-posts.ts:119-321`).
- So one post can reference up to 12 elements (one in typed columns, 11 inside JSON). Only the representative's
  `(resource_type, resource_id)` is indexed (`idx_transfigure_posts_env_resource_created`, 343 scans); no current query
  filters on it. Variants are displayed (card reel), never filtered.
- `title` is nullable in the table but the client requires 1..80 (`validateSaveInput`, `use-transfigure-posts.ts:323-350`).
- The 4 keyword arrays are `text[]`, display only, CHECKed only when `resource_type = 'card'`.
- Korean enum values in CHECKs (`'일반'`, `'공격'`, ...) are game-translation strings; D1 CHECKs must keep them
  byte-for-byte.
- `source_game_locale`: written once at insert (`use-transfigure-posts.ts:410`), never read (CLEANUP 3.1), NOT NULL,
  exactly 3 characters (`GameLocale`).
- `show_upgrade boolean NOT NULL`, `omit_energy_cost boolean` nullable.
- Triggers: guard, counters (2.4, 2.5). RLS: read all; insert/update/delete own.

Queries:

| where | op | columns | filter | order / limit / cursor | volume |
|---|---|---|---|---|---|
| `src/hooks/use-transfigure-posts.ts:456-461` → feed | feed RPC | row + `post` | service `transfigure` | 4.1 | part of 6820 |
| `src/hooks/use-transfigure-posts.ts:423` / `:431` | insert | `user_id, nickname, title, source_game_locale`, representative variant columns, `extra_variants` (only when non-empty or previously set), `env`, token | | | 118 inserts |
| `src/hooks/use-transfigure-posts.ts:378` / `:388` | update | `nickname, title`, variant columns, `extra_variants`, token | `id`, `user_id`, `env` | `.single()` | 285 updates (with counters) |
| `src/hooks/use-transfigure-posts.ts:510` / `:518` | select | `*` | `id`, `env` | `maybeSingle` | |
| `src/hooks/use-transfigure-posts.ts:568` / `:581` | delete | | `id`, `user_id`, `env` | | 33 deletes |
| nav | select | `created_at` | | | 29 172 anon (4.0 ms) + 5305 authenticated (7.2 ms) |
| **build time**: `src/lib/transfigure-data.ts:34-41` via `src/components/patches/patch-detail-page.tsx:848` (`patch:build`) | select | `*` | `env`; a non-production build **falls back to production rows** when its env has none (`:45-57`) | `created_at desc`, 15 | per build |
| patch page reel (removed `34125e9a`, 2026-11-08) | select | `id, title, nickname` | `env` | `created_at desc` | 7096 anon (17.3 ms) until then |
| dev only: `src/components/patches/backstab-transfigure-section.tsx:104-110` | select | `*` | `env` | `created_at desc`, 15 | patch pages do not hydrate in production |
| Defragment v2 (title `coalesce(title, transformed_name, content_text)`), filtered feed, Pagestorm embed | | | | | |
| Off / dev: `workers/detail-shell-og.ts:393` (`title, transformed_name, resource_type, resource_id`), `toybox-post-og-fields.ts:46`, `/dev/admin` (`:330-368`) | | | | | |

UI: the card renders the full transformed card or token for every variant (all variant columns, `extra_variants` for
the reel and the variant count), `title`, `nickname` + avatar, `created_at`, counts
(`src/components/transfigure/transfigure-post-card.tsx`). The list therefore needs every column.

Dead: `source_game_locale` (write-only), `idx_transfigure_posts_env_recommend_created` (246 scans, expression unused).

### 3.4 `this_or_that_posts` (이거 아님 저거?) and the view `this_or_that_post_like_counts`

A two-sided poll between two game elements with a reason. DDL schema:3354-3387.

Stats (pg_stat_user_tables, 2026-11-07; counters since 2026-06-02): live rows **23**, inserted 36, updated 1178, deleted 13, seq scans 48293 (947889 tuples read), index scans 1762, total size 212992 B (heap 8192 B, TOAST 8192 B).

| # | column | type | NOT NULL | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | yes | `gen_random_uuid()` |
| 2 | `user_id` | `uuid` | yes |  |
| 3 | `nickname` | `text` | yes |  |
| 4 | `left_type` | `text` | yes |  |
| 5 | `left_id` | `text` | yes |  |
| 6 | `right_type` | `text` | yes |  |
| 7 | `right_id` | `text` | yes |  |
| 8 | `reason` | `text` | yes |  |
| 9 | `env` | `text` | yes | `'production'::text` |
| 10 | `created_at` | `timestamp with time zone` | yes | `now()` |
| 11 | `like_count` | `integer` | yes | `0` |
| 12 | `comment_count` | `integer` | yes | `0` |
| 13 | `left_vote_count` | `integer` | yes | `0` |
| 14 | `right_vote_count` | `integer` | yes | `0` |
| 15 | `vote_rate_bps` | `integer` | no | GENERATED ALWAYS AS (`CASE WHEN ((left_vote_count + right_vote_count) <= 0) THEN 0 ELSE ((((GREATEST(left_vote_count, right_vote_count))::bigint * 10000) / (left_vote_count + right_vote_count)))::integer END`) STORED |
| 16 | `avatar_id` | `text` | no |  |
| 17 | `avatar_kind` | `text` | no |  |
| 18 | `palette_id` | `text` | no |  |
| 19 | `palette_swapped` | `boolean` | no | `false` |

Constraints (verbatim `pg_get_constraintdef`):

```sql
-- PRIMARY KEY: this_or_that_posts_pkey
PRIMARY KEY (id);
-- FOREIGN KEY: this_or_that_posts_user_id_fkey
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
-- CHECK: this_or_that_posts_author_token_size_check
CHECK ((((COALESCE(octet_length(avatar_id), 0) + COALESCE(octet_length(avatar_kind), 0)) + COALESCE(octet_length(palette_id), 0)) <= 1024));
-- CHECK: this_or_that_posts_distinct_resources
CHECK (((left_type <> right_type) OR (left_id <> right_id)));
-- CHECK: this_or_that_posts_env_check
CHECK ((env = ANY (ARRAY['production'::text, 'development'::text])));
-- CHECK: this_or_that_posts_key_size_check
CHECK (((octet_length(left_type) <= 1024) AND (octet_length(left_id) <= 1024) AND (octet_length(right_type) <= 1024) AND (octet_length(right_id) <= 1024)));
-- CHECK: this_or_that_posts_nickname_check
CHECK (((char_length(nickname) >= 1) AND (char_length(nickname) <= 20)));
-- CHECK: this_or_that_posts_reason_check
CHECK (((char_length(reason) >= 2) AND (char_length(reason) <= 500)));
```

| index | idx_scan | bytes | definition |
|---|---|---|---|
| `idx_this_or_that_posts_env_created` | 1700 | 16384 | `USING btree (env, created_at DESC)` |
| `idx_this_or_that_posts_env_like_created` | 25 | 16384 | `USING btree (env, like_count DESC, created_at DESC, id DESC)` |
| `idx_this_or_that_posts_env_comment_created` | 22 | 16384 | `USING btree (env, comment_count DESC, created_at DESC, id DESC)` |
| `this_or_that_posts_pkey (PK)` | 15 | 16384 | `USING btree (id)` |
| `idx_this_or_that_posts_env_vote_rate_low` | 0 | 16384 | `USING btree (env, ((10000 - vote_rate_bps)) DESC, created_at DESC, id DESC) WHERE ((left_vote_count + right_vote_count) > 0)` |
| `idx_this_or_that_posts_env_vote_total_high` | 0 | 16384 | `USING btree (env, (((left_vote_count)::bigint + (right_vote_count)::bigint)) DESC, created_at DESC, id DESC) WHERE ((left_vote_count + right_vote_count) > 0)` |
| `idx_this_or_that_posts_env_recommend_created` | 0 | 16384 | `USING btree (env, (((like_count * 4) + (comment_count * 6))) DESC, created_at DESC, id DESC)` |
| `idx_this_or_that_posts_env_vote_rate_high` | 0 | 16384 | `USING btree (env, vote_rate_bps DESC, created_at DESC, id DESC) WHERE ((left_vote_count + right_vote_count) > 0)` |
| `idx_this_or_that_posts_env_user_created` | 0 | 16384 | `USING btree (env, user_id, created_at DESC)` |
| `idx_this_or_that_posts_env_vote_total_low` | 0 | 16384 | `USING btree (env, ((1000000000 - ((left_vote_count)::bigint + (right_vote_count)::bigint))) DESC, created_at DESC, id DESC) WHERE ((left_vote_count + right_vote_count) > 0)` |


View, verbatim (schema:3321-3326):

```sql
CREATE VIEW public.this_or_that_post_like_counts WITH (security_invoker='true') AS
 SELECT post_id,
    env,
    (count(*))::integer AS like_count
   FROM public.this_or_that_post_likes
  GROUP BY post_id, env;
```

| # | column | type | NOT NULL | default |
|---|---|---|---|---|
| 1 | `post_id` | `uuid` | no |  |
| 2 | `env` | `text` | no |  |
| 3 | `like_count` | `integer` | no |  |


- Sides are typed scalar columns (`left_type`, `left_id`, `right_type`, `right_id`); resolved to entities in the browser
  (`resolveThisOrThatPost`).
- Four counters: `like_count` (from `this_or_that_post_likes`, not `likes`), `comment_count` (from `comments`),
  `left_vote_count`, `right_vote_count` (from votes). `vote_rate_bps` is generated and unused.
- Triggers: guard (also zeroes / restores the vote counts), the three counter paths in 2.5.
- RLS: read all; insert/delete own; **no update policy**.

Queries:

| where | op | columns | filter | order / limit / cursor | volume |
|---|---|---|---|---|---|
| `src/hooks/use-this-or-that-posts.ts:125-130` → feed | feed RPC | row + `post` | service `this_or_that`; vote sorts add `left+right > 0` | `latest`, `recommended`, `comments`, `vote_rate_high`, `vote_rate_low` | part of 6820 |
| `src/hooks/use-this-or-that-posts.ts:91` / `:100` | insert | `user_id, nickname, left_type, left_id, right_type, right_id, reason, env` + token | | | 36 inserts |
| `src/hooks/use-this-or-that-posts.ts:178` / `:186` | select | `*` | `id`, `env` | `maybeSingle` | |
| `src/hooks/use-this-or-that-posts.ts:220` / `:229` | delete | | `id`, `user_id`, `env` | | 13 deletes |
| nav | select | `created_at` | | | 29 164 anon (3.8 ms); authenticated below top 50 |
| `get_my_profile_activity(_stats)` | RPC | `id, reason, created_at`, `count(this_or_that_post_likes.id)` | own | likes or `created_at desc` | |
| Defragment v2 (title `btrim(reason)`), filtered feed, embed; the board also loads like state for its this-or-that rows (`src/components/defragment/defragment-client.tsx:139-150`) | | | | | |
| Off / dev: `workers/detail-shell-og.ts:367` (`reason, left_type, left_id`), `toybox-post-og-fields.ts:93`, `/dev/admin` (`:370-398`) | | | | | |

UI: card shows both elements, `reason`, `nickname` + avatar, `created_at`, comment count (feed row), like count and my
like (3.6), vote bar with left/right/total and my vote (3.5). The list issues 2-4 extra reads per page for likes and
votes although the counters are already in the feed row (CLEANUP 3.3 #6).

Dead: `vote_rate_bps`, `idx_this_or_that_posts_env_vote_rate_high`, `_vote_rate_low`,
`idx_this_or_that_posts_env_recommend_created`; the view is redundant with `like_count`.

### 3.5 `this_or_that_post_votes`

One vote per user per post. DDL schema:3335-3345.

Stats (pg_stat_user_tables, 2026-11-07; counters since 2026-06-02): live rows **1506**, inserted 1604, updated 0, deleted 96, seq scans 2087 (1475801 tuples read), index scans 4732, total size 417792 B (heap 188416 B, TOAST 8192 B).

| # | column | type | NOT NULL | default |
|---|---|---|---|---|
| 1 | `post_id` | `uuid` | yes |  |
| 2 | `user_id` | `uuid` | yes |  |
| 3 | `choice` | `text` | yes |  |
| 4 | `created_surface` | `text` | yes |  |
| 5 | `env` | `text` | yes | `'production'::text` |
| 6 | `created_at` | `timestamp with time zone` | yes | `now()` |

Constraints (verbatim `pg_get_constraintdef`):

```sql
-- UNIQUE: this_or_that_post_votes_unique_user
UNIQUE (post_id, user_id, env);
-- FOREIGN KEY: this_or_that_post_votes_post_id_fkey
FOREIGN KEY (post_id) REFERENCES this_or_that_posts(id) ON DELETE CASCADE;
-- FOREIGN KEY: this_or_that_post_votes_user_id_fkey
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
-- CHECK: this_or_that_post_votes_choice_check
CHECK ((choice = ANY (ARRAY['left'::text, 'right'::text])));
-- CHECK: this_or_that_post_votes_created_surface_check
CHECK ((created_surface = ANY (ARRAY['index'::text, 'detail'::text])));
-- CHECK: this_or_that_post_votes_env_check
CHECK ((env = ANY (ARRAY['production'::text, 'development'::text])));
```

| index | idx_scan | bytes | definition |
|---|---|---|---|
| `this_or_that_post_votes_unique_user (unique)` | 3933 | 147456 | `USING btree (post_id, user_id, env)` |
| `idx_this_or_that_post_votes_env_post_choice` | 799 | 40960 | `USING btree (env, post_id, choice)` |


- **No primary key**; identity is the UNIQUE `(post_id, user_id, env)`.
- `choice` in `left|right`; `created_surface` in `index|detail` (write-only, CLEANUP 3.1).
- Insert policy, verbatim (schema:5377-5379):

```sql
CREATE POLICY this_or_that_post_votes_insert_owner ON public.this_or_that_post_votes FOR INSERT WITH CHECK (((( SELECT auth.uid() AS uid) = user_id) AND (EXISTS ( SELECT 1
   FROM public.this_or_that_posts posts
  WHERE ((posts.id = this_or_that_post_votes.post_id) AND (posts.env = this_or_that_post_votes.env))))));
```

- Read policy: own rows only. There is no update policy: changing a vote is delete then insert.
- Trigger `this_or_that_post_votes_count_delta` (2.5). FK `post_id` → `this_or_that_posts(id) ON DELETE CASCADE`.

Queries:

| where | op | columns | filter | order / limit | volume |
|---|---|---|---|---|---|
| `src/hooks/use-this-or-that-votes.ts:78` (api) / `:88` (legacy) | `get_this_or_that_vote_summaries` | left/right/total per post | `post_id` in the loaded ids (≤ 50 or it fails) | | 1966 (35 ms) |
| `src/hooks/use-this-or-that-votes.ts:79` / `:97` | select | `post_id, choice` | `env`, own `user_id`, `post_id in` | | |
| `src/hooks/use-this-or-that-votes.ts:186` / `:196` | insert | `post_id, user_id, choice, created_surface, env` | | | **1601 authenticated (29 ms)**, 1604 inserts |
| `src/hooks/use-this-or-that-votes.ts:243` / `:252` | delete | | `post_id`, `user_id`, `env` | | 96 deletes |
| `get_rls_activity_metrics` | select | `user_id, created_at` | `env` | | admin |

UI: vote bar (left, right, total; percentages computed in the browser), my choice, pending state; list and detail.

### 3.6 `this_or_that_post_likes`

This-or-that's own like table (the other services use the generic `likes`). DDL schema:3305-3315.

Stats (pg_stat_user_tables, 2026-11-07; counters since 2026-06-02): live rows **10**, inserted 26, updated 0, deleted 16, seq scans 25 (211 tuples read), index scans 8082, total size 65536 B (heap 8192 B, TOAST 8192 B).

| # | column | type | NOT NULL | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | yes | `gen_random_uuid()` |
| 2 | `post_id` | `uuid` | yes |  |
| 3 | `user_id` | `uuid` | yes |  |
| 4 | `env` | `text` | yes | `'production'::text` |
| 5 | `created_at` | `timestamp with time zone` | yes | `now()` |

Constraints (verbatim `pg_get_constraintdef`):

```sql
-- PRIMARY KEY: this_or_that_post_likes_pkey
PRIMARY KEY (id);
-- UNIQUE: this_or_that_post_likes_unique_user
UNIQUE (post_id, user_id, env);
-- FOREIGN KEY: this_or_that_post_likes_post_id_fkey
FOREIGN KEY (post_id) REFERENCES this_or_that_posts(id) ON DELETE CASCADE;
-- FOREIGN KEY: this_or_that_post_likes_user_id_fkey
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
-- CHECK: this_or_that_post_likes_env_check
CHECK ((env = ANY (ARRAY['production'::text, 'development'::text])));
```

| index | idx_scan | bytes | definition |
|---|---|---|---|
| `idx_this_or_that_post_likes_env_post` | 8069 | 16384 | `USING btree (env, post_id)` |
| `this_or_that_post_likes_unique_user (unique)` | 13 | 16384 | `USING btree (post_id, user_id, env)` |
| `this_or_that_post_likes_pkey (PK)` | 0 | 16384 | `USING btree (id)` |


- The surrogate `id` is never read (PK 0 scans); the natural key is UNIQUE `(post_id, user_id, env)`.
- `created_at` is client-settable (no guard), only read by the admin metrics.
- Trigger `this_or_that_post_likes_count_delta` (2.5). FK `post_id` CASCADE.
- RLS: read all (user ids public), insert/delete own.

Queries:

| where | op | columns | filter | volume |
|---|---|---|---|---|
| `src/hooks/use-this-or-that-likes.ts:58` (api, `readInChunks` of 100) / `:69` (legacy view) | select view | `post_id, like_count` | `env`, `post_id in` (all loaded ids) | below top 50 |
| `src/hooks/use-this-or-that-likes.ts:59` / `:78` | select | `post_id` | `env`, own `user_id`, `post_id in` | |
| `src/hooks/use-this-or-that-likes.ts:158` (api PUT/DELETE) / `:151` insert, `:145` delete (legacy) | insert / delete | `post_id, user_id, env` | | 26 inserts, 16 deletes |
| `get_my_profile_activity(_stats)` | join count | `id` | `post_id`, `env` | |
| `get_rls_activity_metrics` | select | `user_id, created_at` | `env` | admin |

Callers: `src/components/this-or-that/this-or-that-client.tsx:74`, `src/components/this-or-that/post-view.tsx:67`,
`src/components/defragment/defragment-client.tsx:150`.

UI: like count and "liked" state on the card, detail and Defragment row.

### 3.7 `favorite_tournament_posts` (이아저? 월드컵)

A bracket ("world cup") over a pool of game elements. User-made (`preset_key = 'custom'`) or builtin (`preset_key LIKE
'builtin:%'`, `user_id NULL`, seeded by `scripts/seed-favorite-tournament-builtins.ts`). DDL schema:2952-2983.

Stats (pg_stat_user_tables, 2026-11-07; counters since 2026-06-02): live rows **47**, inserted 50, updated 151, deleted 3, seq scans 1037 (46263 tuples read), index scans 42143, total size 352256 B (heap 114688 B, TOAST 73728 B).

| # | column | type | NOT NULL | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | yes | `gen_random_uuid()` |
| 2 | `user_id` | `uuid` | no |  |
| 3 | `nickname` | `text` | yes |  |
| 4 | `title` | `text` | yes |  |
| 5 | `note` | `text` | yes | `''::text` |
| 6 | `preset_key` | `text` | yes |  |
| 7 | `game_version` | `text` | yes |  |
| 8 | `pool` | `jsonb` | yes |  |
| 9 | `env` | `text` | yes | `'production'::text` |
| 10 | `like_count` | `integer` | yes | `0` |
| 11 | `comment_count` | `integer` | yes | `0` |
| 12 | `play_count` | `integer` | yes | `0` |
| 13 | `created_at` | `timestamp with time zone` | yes | `now()` |
| 14 | `avatar_id` | `text` | no |  |
| 15 | `avatar_kind` | `text` | no |  |
| 16 | `palette_id` | `text` | no |  |
| 17 | `palette_swapped` | `boolean` | no | `false` |

Constraints (verbatim `pg_get_constraintdef`):

```sql
-- PRIMARY KEY: favorite_tournament_posts_pkey
PRIMARY KEY (id);
-- FOREIGN KEY: favorite_tournament_posts_user_id_fkey
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
-- CHECK: favorite_tournament_posts_author_token_size_check
CHECK ((((COALESCE(octet_length(avatar_id), 0) + COALESCE(octet_length(avatar_kind), 0)) + COALESCE(octet_length(palette_id), 0)) <= 1024));
-- CHECK: favorite_tournament_posts_env_check
CHECK ((env = ANY (ARRAY['production'::text, 'development'::text])));
-- CHECK: favorite_tournament_posts_game_version_check
CHECK (((char_length(game_version) >= 1) AND (char_length(game_version) <= 32)));
-- CHECK: favorite_tournament_posts_nickname_check
CHECK (((char_length(nickname) >= 1) AND (char_length(nickname) <= 20)));
-- CHECK: favorite_tournament_posts_note_check
CHECK ((char_length(note) <= 500));
-- CHECK: favorite_tournament_posts_pool_check
CHECK ((jsonb_typeof(pool) = 'array'::text));
-- CHECK: favorite_tournament_posts_pool_size_check
CHECK ((pg_column_size(pool) <= 1048576));
-- CHECK: favorite_tournament_posts_preset_key_check
CHECK (((char_length(preset_key) >= 1) AND (char_length(preset_key) <= 64)));
-- CHECK: favorite_tournament_posts_title_check
CHECK (((char_length(title) >= 1) AND (char_length(title) <= 80)));
-- CHECK: favorite_tournament_posts_user_id_builtin_check
CHECK ((((preset_key ~~ 'builtin:%'::text) AND (user_id IS NULL)) OR ((preset_key !~~ 'builtin:%'::text) AND (user_id IS NOT NULL))));
```

| index | idx_scan | bytes | definition |
|---|---|---|---|
| `idx_favorite_tournament_posts_env_created` | 37580 | 16384 | `USING btree (env, created_at DESC, id DESC)` |
| `favorite_tournament_posts_pkey (PK)` | 3468 | 16384 | `USING btree (id)` |
| `idx_favorite_tournament_posts_env_builtin_key (unique)` | 577 | 16384 | `USING btree (env, preset_key) WHERE (preset_key ~~ 'builtin:%'::text)` |
| `idx_favorite_tournament_posts_env_user_created` | 269 | 16384 | `USING btree (env, user_id, created_at DESC)` |
| `idx_favorite_tournament_posts_env_like_created` | 231 | 16384 | `USING btree (env, like_count DESC, created_at DESC, id DESC)` |
| `idx_favorite_tournament_posts_env_comment_created` | 16 | 16384 | `USING btree (env, comment_count DESC, created_at DESC, id DESC)` |
| `idx_favorite_tournament_posts_env_play_created` | 2 | 16384 | `USING btree (env, play_count DESC, created_at DESC, id DESC)` |
| `idx_favorite_tournament_posts_env_recommend_created` | 0 | 16384 | `USING btree (env, (((like_count * 4) + (comment_count * 6))) DESC, created_at DESC, id DESC)` |


- `pool` is `[{ "type", "id" }]` (`FavoriteTournamentResourceRef`). Builtin pools hold whole catalogs (the relic
  preset has 298 entries; "every card and relic" is about 1000, STEP1_DESIGN 9.8). The pool is **joined by element** in
  `complete_favorite_tournament_play` (candidate check) and otherwise displayed (size, sorted images).
- `user_id` nullable only for builtins (CHECK `favorite_tournament_posts_user_id_builtin_check`); the insert policy
  forbids users from writing `builtin:` keys.
- Partial UNIQUE `idx_favorite_tournament_posts_env_builtin_key (env, preset_key) WHERE (preset_key ~~
  'builtin:%'::text)` backs the seed's `ON CONFLICT ... DO UPDATE SET nickname, title, note, pool, game_version`.
- `play_count` is changed only by the RPC (4.3) and guarded like the other counters.
- `game_version`: written (`FAVORITE_TOURNAMENT_GAME_VERSION`), never displayed (CLEANUP 3.1), NOT NULL 1..32.
- `note` NOT NULL default `''`, ≤ 500; the client requires 1..500 for user posts (`FAVORITE_TOURNAMENT_NOTE_MIN_CHARS`).
- RLS: read all; insert own non-builtin; delete own; **no update policy**.

Queries:

| where | op | columns | filter | order / limit / cursor | volume |
|---|---|---|---|---|---|
| `src/hooks/use-favorite-tournament-posts.ts:108-113` → feed | feed RPC | row + `post` (incl. `pool`) | service `favorite_tournament` (builtins included) | `latest`, `recommended`, `comments`, `play_count`; 20; keyset | part of 6820 |
| `src/hooks/use-favorite-tournament-posts.ts:139` (api `/presets`) / `:147` | select | `*` | `env`, `preset_key like 'builtin:%'` | `created_at asc`, **no limit** | always on list mount (CLEANUP 3.3 #5) |
| `src/hooks/use-favorite-tournament-posts.ts:88` / `:97` | insert | `user_id, nickname, title, note, preset_key='custom', game_version, pool, env` + token | | | 50 inserts |
| `src/hooks/use-favorite-tournament-posts.ts:196` / `:208` | select | `*` | `id`, `env` | `maybeSingle` | |
| `src/hooks/use-favorite-tournament-posts.ts:257` / `:266` | delete | | `id`, `user_id`, `env` | | 3 deletes |
| `src/hooks/use-favorite-tournament-posts.ts:296` / `:310` | RPC `complete_favorite_tournament_play` | | | | 70 plays |
| seed (service role, `supabase db query`) | upsert | builtins | `ON CONFLICT (env, preset_key) WHERE preset_key LIKE 'builtin:%'` | | manual |
| nav | select | `created_at` | | | 29 137 anon (3.7 ms) |
| Defragment v2 (title `coalesce(title, note)`), filtered feed, embed | | | | | |
| `get_rls_activity_metrics` (`user_id is not null`), `/dev/admin` (`:460-488`) | | `user_id, created_at` / list | | | admin |

UI: card shows `title`, `nickname` + avatar, `created_at`, preset accent and lead (`preset_key`), round label from
`pool.length`, pool images, `play_count`, like/comment counts
(`src/components/this-or-that/favorite-tournament-post-card.tsx:74-177`). The "presets only" toggle shows the builtins
list (`favorite-tournament-client.tsx:70-75`). Detail adds the play UI over `pool`, the ranking table (3.8), generic
likes and comments.

Dead: `game_version` (write-only), `idx_favorite_tournament_posts_env_recommend_created` (0 scans).

### 3.8 `favorite_tournament_candidate_stats`

Per-tournament, per-candidate aggregates written only by `complete_favorite_tournament_play`. DDL schema:2909-2920.

Stats (pg_stat_user_tables, 2026-11-07; counters since 2026-06-02): live rows **632**, inserted 637, updated 2870, deleted 5, seq scans 447 (54448 tuples read), index scans 3505, total size 376832 B (heap 188416 B, TOAST 8192 B).

| # | column | type | NOT NULL | default |
|---|---|---|---|---|
| 1 | `tournament_id` | `uuid` | yes |  |
| 2 | `env` | `text` | yes | `'production'::text` |
| 3 | `resource_type` | `text` | yes |  |
| 4 | `resource_id` | `text` | yes |  |
| 5 | `match_appearances` | `integer` | yes | `0` |
| 6 | `match_wins` | `integer` | yes | `0` |
| 7 | `championships` | `integer` | yes | `0` |
| 8 | `current_rank` | `integer` | no |  |
| 9 | `rank_history` | `jsonb` | yes | `'[]'::jsonb` |

Constraints (verbatim `pg_get_constraintdef`):

```sql
-- PRIMARY KEY: favorite_tournament_candidate_stats_pkey
PRIMARY KEY (tournament_id, env, resource_type, resource_id);
-- FOREIGN KEY: favorite_tournament_candidate_stats_tournament_id_fkey
FOREIGN KEY (tournament_id) REFERENCES favorite_tournament_posts(id) ON DELETE CASCADE;
-- CHECK: favorite_tournament_candidate_stats_env_check
CHECK ((env = ANY (ARRAY['production'::text, 'development'::text])));
```

| index | idx_scan | bytes | definition |
|---|---|---|---|
| `favorite_tournament_candidate_stats_pkey (PK)` | 3111 | 106496 | `USING btree (tournament_id, env, resource_type, resource_id)` |
| `idx_favorite_tournament_stats_rank` | 394 | 40960 | `USING btree (tournament_id, env, championships DESC, match_wins DESC)` |


- No CHECKs on the counts (non-negative is implicit; the RPC only adds).
- `rank_history` is `[{ "at": "<utc text>", "rank": n }]`, appended when the rank changes, unbounded; the UI shows the
  last 6 ranks (`src/components/this-or-that/favorite-tournament-ranking.tsx:66-69`).
- `current_rank` is rewritten on every row of the tournament on every play.
- `idx_favorite_tournament_stats_rank (tournament_id, env, championships DESC, match_wins DESC)` (394 scans) serves the
  RPC's re-rank scan; the client re-sorts anyway.
- RLS: read all; no write policies (RPC is SECURITY DEFINER).

Queries:

| where | op | columns | filter | order | volume |
|---|---|---|---|---|---|
| `workers/api/routes/toybox.ts:219-228`; `src/hooks/use-favorite-tournament-posts.ts:197` / `:217` (detail), `:329` / `:337` (reload after a play) | select | `*` | `tournament_id`, `env` | none (client `rankedCandidateStats`, `src/lib/favorite-tournament.ts:366-389`) | below top 50 |
| `complete_favorite_tournament_play` | upsert, select, update | all | `tournament_id`, `env` | 4.3 | 637 inserts, 2870 updates |

UI: ranking table: candidate entity, championship rate = `championships / post.play_count`, match win rate =
`match_wins / match_appearances`, trend = last 6 `rank_history` ranks, else `current_rank` or the row index.

### 3.9 `favorite_tournament_plays`

One row per finished bracket. DDL schema:2929-2939.

Stats (pg_stat_user_tables, 2026-11-07; counters since 2026-06-02): live rows **68**, inserted 70, updated 0, deleted 2, seq scans 278 (14490 tuples read), index scans 5, total size 204800 B (heap 90112 B, TOAST 57344 B).

| # | column | type | NOT NULL | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | yes | `gen_random_uuid()` |
| 2 | `tournament_id` | `uuid` | yes |  |
| 3 | `user_id` | `uuid` | yes |  |
| 4 | `env` | `text` | yes | `'production'::text` |
| 5 | `starting_size` | `integer` | yes |  |
| 6 | `champion_type` | `text` | yes |  |
| 7 | `champion_id` | `text` | yes |  |
| 8 | `matches` | `jsonb` | yes |  |
| 9 | `created_at` | `timestamp with time zone` | yes | `now()` |

Constraints (verbatim `pg_get_constraintdef`):

```sql
-- PRIMARY KEY: favorite_tournament_plays_pkey
PRIMARY KEY (id);
-- FOREIGN KEY: favorite_tournament_plays_tournament_id_fkey
FOREIGN KEY (tournament_id) REFERENCES favorite_tournament_posts(id) ON DELETE CASCADE;
-- FOREIGN KEY: favorite_tournament_plays_user_id_fkey
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
-- CHECK: favorite_tournament_plays_env_check
CHECK ((env = ANY (ARRAY['production'::text, 'development'::text])));
-- CHECK: favorite_tournament_plays_matches_check
CHECK ((jsonb_typeof(matches) = 'array'::text));
-- CHECK: favorite_tournament_plays_matches_size_check
CHECK ((pg_column_size(matches) <= 1048576));
-- CHECK: favorite_tournament_plays_starting_size_check
CHECK ((starting_size >= 2));
```

| index | idx_scan | bytes | definition |
|---|---|---|---|
| `idx_favorite_tournament_plays_tournament_created` | 5 | 16384 | `USING btree (tournament_id, env, created_at DESC)` |
| `favorite_tournament_plays_pkey (PK)` | 0 | 16384 | `USING btree (id)` |


- `matches` is `[{ "left_type", "left_id", "right_type", "right_id", "winner": "left" | "right" }]`, length =
  `starting_size - 1` (RPC check).
- Writer: only the RPC. Readers: only `get_rls_activity_metrics` (`user_id, created_at`). The app never reads it.
- RLS: `favorite_tournament_plays_read` `USING (true)` makes every play, with `user_id` and bracket, public (tasks/010
  #67, CLEANUP 3.4). Dead per CLEANUP 3.1 as a policy.
- `idx_favorite_tournament_plays_tournament_created` 5 scans, PK 0 scans.
- CLEANUP 3.1 leaves "keep it in D1 or not" open; see section 11, item 4: it is the only source row of every tournament counter.

### 3.10 `decisions_decisions_posts` (어려운 결정)

A tier list over a preset pool of game elements. DDL schema:2816-2849.

Stats (pg_stat_user_tables, 2026-11-07; counters since 2026-06-02): live rows **19**, inserted 25, updated 66, deleted 6, seq scans 11388 (167747 tuples read), index scans 28573, total size 270336 B (heap 57344 B, TOAST 81920 B).

| # | column | type | NOT NULL | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | yes | `gen_random_uuid()` |
| 2 | `user_id` | `uuid` | yes |  |
| 3 | `nickname` | `text` | yes |  |
| 4 | `title` | `text` | yes |  |
| 5 | `note` | `text` | yes | `''::text` |
| 6 | `preset_key` | `text` | yes |  |
| 7 | `game_version` | `text` | yes |  |
| 8 | `rows` | `jsonb` | yes |  |
| 9 | `placements` | `jsonb` | yes |  |
| 10 | `extra_ids` | `jsonb` | yes | `'[]'::jsonb` |
| 11 | `env` | `text` | yes | `'production'::text` |
| 12 | `like_count` | `integer` | yes | `0` |
| 13 | `comment_count` | `integer` | yes | `0` |
| 14 | `created_at` | `timestamp with time zone` | yes | `now()` |
| 15 | `avatar_id` | `text` | no |  |
| 16 | `avatar_kind` | `text` | no |  |
| 17 | `palette_id` | `text` | no |  |
| 18 | `palette_swapped` | `boolean` | no | `false` |

Constraints (verbatim `pg_get_constraintdef`):

```sql
-- PRIMARY KEY: decisions_decisions_posts_pkey
PRIMARY KEY (id);
-- FOREIGN KEY: decisions_decisions_posts_user_id_fkey
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
-- CHECK: decisions_decisions_posts_author_token_size_check
CHECK ((((COALESCE(octet_length(avatar_id), 0) + COALESCE(octet_length(avatar_kind), 0)) + COALESCE(octet_length(palette_id), 0)) <= 1024));
-- CHECK: decisions_decisions_posts_env_check
CHECK ((env = ANY (ARRAY['production'::text, 'development'::text])));
-- CHECK: decisions_decisions_posts_extra_ids_check
CHECK ((jsonb_typeof(extra_ids) = 'array'::text));
-- CHECK: decisions_decisions_posts_game_version_check
CHECK (((char_length(game_version) >= 1) AND (char_length(game_version) <= 32)));
-- CHECK: decisions_decisions_posts_layout_size_check
CHECK (((pg_column_size(rows) <= 1048576) AND (pg_column_size(placements) <= 1048576) AND (pg_column_size(extra_ids) <= 131072)));
-- CHECK: decisions_decisions_posts_nickname_check
CHECK (((char_length(nickname) >= 1) AND (char_length(nickname) <= 20)));
-- CHECK: decisions_decisions_posts_note_check
CHECK ((char_length(note) <= 500));
-- CHECK: decisions_decisions_posts_placements_check
CHECK ((jsonb_typeof(placements) = 'array'::text));
-- CHECK: decisions_decisions_posts_preset_key_check
CHECK (((char_length(preset_key) >= 1) AND (char_length(preset_key) <= 64)));
-- CHECK: decisions_decisions_posts_rows_check
CHECK ((jsonb_typeof(rows) = 'array'::text));
-- CHECK: decisions_decisions_posts_title_check
CHECK (((char_length(title) >= 1) AND (char_length(title) <= 80)));
```

| index | idx_scan | bytes | definition |
|---|---|---|---|
| `idx_decisions_decisions_posts_env_created` | 28364 | 16384 | `USING btree (env, created_at DESC, id DESC)` |
| `idx_decisions_decisions_posts_env_recommend_created` | 89 | 16384 | `USING btree (env, (((like_count * 4) + (comment_count * 6))) DESC, created_at DESC, id DESC)` |
| `idx_decisions_decisions_posts_env_like_created` | 70 | 16384 | `USING btree (env, like_count DESC, created_at DESC, id DESC)` |
| `idx_decisions_decisions_posts_env_user_created` | 33 | 16384 | `USING btree (env, user_id, created_at DESC)` |
| `idx_decisions_decisions_posts_env_comment_created` | 17 | 16384 | `USING btree (env, comment_count DESC, created_at DESC, id DESC)` |
| `decisions_decisions_posts_pkey (PK)` | 0 | 16384 | `USING btree (id)` |


- `rows`: `[{ "id", "label", "color" }]` (`TierRow`); `placements`: `[{ "type", "id", "rowId", "sort" }]`
  (`TierPlacement`); `extra_ids`: `[{ "type", "id" }]` (`DecisionsDecisionsResourceRef`), `src/lib/decisions-decisions.ts:100-123`.
  Display only: the list card and the detail render the whole board; `placedPool(post.placements)` derives the pool in
  the browser.
- `preset_key` (1..64) picks the preset pool and label; `game_version` (1..32, `DECISIONS_DECISIONS_GAME_VERSION`) is
  **displayed** on the detail page (`decisions-decisions-post-view.tsx:146`), unlike the tournament's.
- Updates may change `preset_key`, `game_version`, `rows`, `placements`, `extra_ids`, `title`, `note`, author snapshot.
- RLS: read all; insert/update/delete own.

Queries:

| where | op | columns | filter | order / limit / cursor | volume |
|---|---|---|---|---|---|
| `src/hooks/use-decisions-decisions-posts.ts:149-154` → feed | feed RPC | row + `post` (incl. `rows`, `placements`) | service `decisions_decisions` | 4.1 | part of 6820 |
| `src/hooks/use-decisions-decisions-posts.ts:83` / `:91` | insert | `user_id, nickname, title, note, preset_key, game_version, rows, placements, extra_ids, env` + token | | | 25 inserts |
| `src/hooks/use-decisions-decisions-posts.ts:124` / `:135` | update | same minus `user_id`, `env` | `id`, `user_id`, `env` | `.single()` | 66 updates (with counters) |
| `src/hooks/use-decisions-decisions-posts.ts:185` / `:193` | select | `*` | `id`, `env` | `maybeSingle` | |
| `src/hooks/use-decisions-decisions-posts.ts:231` / `:244` | delete | | `id`, `user_id`, `env` | | 6 deletes |
| nav | select | `created_at` | | | 29 132 anon (7.4 ms) + 5322 authenticated (17.1 ms) |
| Defragment v2 (title `coalesce(title, note)`), filtered feed, embed | | | | | |
| `/dev/admin` (`:430-458`, no JSON columns); `get_rls_activity_metrics` | | | | | admin |
| Off: `workers/detail-shell-og.ts:460` reads **`decisions_posts`** (`title, situation_character`), a table and column that do not exist; the OG path is off in production, so the bug is latent | | | | | |

UI: card: `title`, `nickname` + avatar, `created_at`, full tier board (`rows`, `placements`), counts. Detail adds
`note`, `game_version`, image export, generic likes (`initialCount` = `like_count`), comments, edit/delete.

Dead: `idx_decisions_decisions_posts_env_recommend_created`.

### 3.11 `pagestorm_posts` (서류 폭풍)

Long-form documents: `content` is a rich-editor document object (`jsonb_typeof = 'object'`), `content_text` its plain
text (1..8000). DDL schema:3053-3078.

Stats (pg_stat_user_tables, 2026-11-07; counters since 2026-06-02): live rows **14**, inserted 25, updated 45, deleted 11, seq scans 37614 (463216 tuples read), index scans 1321, total size 237568 B (heap 24576 B, TOAST 106496 B).

| # | column | type | NOT NULL | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | yes | `gen_random_uuid()` |
| 2 | `user_id` | `uuid` | yes |  |
| 3 | `nickname` | `text` | yes |  |
| 4 | `title` | `text` | yes |  |
| 5 | `content` | `jsonb` | yes |  |
| 6 | `content_text` | `text` | yes |  |
| 7 | `env` | `text` | yes | `'production'::text` |
| 8 | `like_count` | `integer` | yes | `0` |
| 9 | `comment_count` | `integer` | yes | `0` |
| 10 | `created_at` | `timestamp with time zone` | yes | `now()` |
| 11 | `avatar_id` | `text` | no |  |
| 12 | `avatar_kind` | `text` | no |  |
| 13 | `palette_id` | `text` | no |  |
| 14 | `palette_swapped` | `boolean` | no | `false` |

Constraints (verbatim `pg_get_constraintdef`):

```sql
-- PRIMARY KEY: pagestorm_posts_pkey
PRIMARY KEY (id);
-- FOREIGN KEY: pagestorm_posts_user_id_fkey
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
-- CHECK: pagestorm_posts_author_token_size_check
CHECK ((((COALESCE(octet_length(avatar_id), 0) + COALESCE(octet_length(avatar_kind), 0)) + COALESCE(octet_length(palette_id), 0)) <= 1024));
-- CHECK: pagestorm_posts_content_check
CHECK ((jsonb_typeof(content) = 'object'::text));
-- CHECK: pagestorm_posts_content_size_check
CHECK ((pg_column_size(content) <= 1048576));
-- CHECK: pagestorm_posts_content_text_check
CHECK (((char_length(content_text) >= 1) AND (char_length(content_text) <= 8000)));
-- CHECK: pagestorm_posts_env_check
CHECK ((env = ANY (ARRAY['production'::text, 'development'::text])));
-- CHECK: pagestorm_posts_nickname_check
CHECK (((char_length(nickname) >= 1) AND (char_length(nickname) <= 20)));
-- CHECK: pagestorm_posts_title_check
CHECK (((char_length(title) >= 1) AND (char_length(title) <= 80)));
```

| index | idx_scan | bytes | definition |
|---|---|---|---|
| `idx_pagestorm_posts_env_created` | 1223 | 16384 | `USING btree (env, created_at DESC, id DESC)` |
| `idx_pagestorm_posts_env_user_created` | 54 | 16384 | `USING btree (env, user_id, created_at DESC)` |
| `pagestorm_posts_pkey (PK)` | 34 | 16384 | `USING btree (id)` |
| `idx_pagestorm_posts_env_like_created` | 8 | 16384 | `USING btree (env, like_count DESC, created_at DESC, id DESC)` |
| `idx_pagestorm_posts_env_comment_created` | 2 | 16384 | `USING btree (env, comment_count DESC, created_at DESC, id DESC)` |


- `content` is the only post document that is an **object**, not a block array; it can embed other toybox posts
  (`src/hooks/use-pagestorm-toybox.ts`).
- The index page does not use the toybox feed: it reads the latest 50 with the full `content` only to compute a
  thumbnail (`normalizePagestormPostCard`, `src/lib/pagestorm.ts:167-188`), no paging, no counts, no sort options.
- RLS: read all; insert/update/delete own.

Queries:

| where | op | columns | filter | order / limit | volume |
|---|---|---|---|---|---|
| `src/hooks/use-pagestorm-posts.ts:402` (api `/pagestorm/posts`) / `:388` | select | `id, user_id, nickname, title, content, content_text, env, created_at, avatar_id, avatar_kind, palette_id, palette_swapped` | `env` | `created_at desc`, 50 | below top 50 |
| `src/hooks/use-pagestorm-posts.ts:71` / `:91` | insert | `user_id, nickname, title, content, content_text, env` + token | | | 25 inserts |
| `src/hooks/use-pagestorm-posts.ts:121` / `:141` | update | `nickname, title, content, content_text` + token | `id`, `user_id`, `env` | `.single()` | 45 updates (with counters) |
| `src/hooks/use-pagestorm-posts.ts:458` / `:444` | select | `*` | `id`, `env` | `maybeSingle` | |
| `src/hooks/use-pagestorm-posts.ts:485` / `:498` | delete | | `id`, `user_id`, `env` | | 11 deletes |
| feed RPC (service `pagestorm`) | | | | | only through the Defragment filter and the Pagestorm toybox picker (`use-pagestorm-toybox.ts:42` uses `useDefragmentFeed("latest", service)`) |
| nav | select | `created_at` | | | 29 096 anon (9.9 ms) + 5323 authenticated (11.0 ms) |
| Defragment v2 (title `coalesce(title, content_text)`), embed | | | | | |
| Off / dev: `workers/detail-shell-og.ts:419` (`title, content_text, content`), `toybox-post-og-fields.ts:116`, `/dev/admin` (`:490-514`, no `content`) | | | | | |

UI: index gallery/list: `title`, `nickname` + avatar, `created_at`, thumbnail (from `content`), `content_text`
(excerpt). Detail: full document, generic likes, comments, edit/delete. Not in profile activity or admin metrics.

### 3.12 `pagestorm_drafts`

Private drafts of Pagestorm documents, same document columns as the post, no counters. DDL schema:3023-3046.

Stats (pg_stat_user_tables, 2026-11-07; counters since 2026-06-02): live rows **3**, inserted 9, updated 6, deleted 6, seq scans 15 (39 tuples read), index scans 189, total size 106496 B (heap 8192 B, TOAST 65536 B).

| # | column | type | NOT NULL | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | yes | `gen_random_uuid()` |
| 2 | `user_id` | `uuid` | yes |  |
| 3 | `nickname` | `text` | yes |  |
| 4 | `title` | `text` | yes |  |
| 5 | `content` | `jsonb` | yes |  |
| 6 | `content_text` | `text` | yes |  |
| 7 | `env` | `text` | yes | `'production'::text` |
| 8 | `created_at` | `timestamp with time zone` | yes | `now()` |
| 9 | `updated_at` | `timestamp with time zone` | yes | `now()` |
| 10 | `avatar_id` | `text` | no |  |
| 11 | `avatar_kind` | `text` | no |  |
| 12 | `palette_id` | `text` | no |  |
| 13 | `palette_swapped` | `boolean` | no | `false` |

Constraints (verbatim `pg_get_constraintdef`):

```sql
-- PRIMARY KEY: pagestorm_drafts_pkey
PRIMARY KEY (id);
-- FOREIGN KEY: pagestorm_drafts_user_id_fkey
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
-- CHECK: pagestorm_drafts_author_token_size_check
CHECK ((((COALESCE(octet_length(avatar_id), 0) + COALESCE(octet_length(avatar_kind), 0)) + COALESCE(octet_length(palette_id), 0)) <= 1024));
-- CHECK: pagestorm_drafts_content_check
CHECK ((jsonb_typeof(content) = 'object'::text));
-- CHECK: pagestorm_drafts_content_size_check
CHECK ((pg_column_size(content) <= 1048576));
-- CHECK: pagestorm_drafts_content_text_check
CHECK (((char_length(content_text) >= 1) AND (char_length(content_text) <= 8000)));
-- CHECK: pagestorm_drafts_env_check
CHECK ((env = ANY (ARRAY['production'::text, 'development'::text])));
-- CHECK: pagestorm_drafts_nickname_check
CHECK (((char_length(nickname) >= 1) AND (char_length(nickname) <= 20)));
-- CHECK: pagestorm_drafts_title_check
CHECK (((char_length(title) >= 1) AND (char_length(title) <= 80)));
```

| index | idx_scan | bytes | definition |
|---|---|---|---|
| `idx_pagestorm_drafts_env_user_updated` | 169 | 16384 | `USING btree (env, user_id, updated_at DESC)` |
| `pagestorm_drafts_pkey (PK)` | 20 | 16384 | `USING btree (id)` |


- No guard trigger: `created_at` defaults to `now()`, `updated_at` is sent by the client (`new Date().toISOString()`,
  `src/hooks/use-pagestorm-posts.ts:163-177`).
- RLS: own rows only for every operation.
- The list orders by `updated_at` but does not select it (list columns are the post list's 12 columns).
- A draft is deleted after it is published (`pagestorm-client.tsx`, SURFACE_MAP 3.5).

Queries:

| where | op | columns | filter | order / limit | volume |
|---|---|---|---|---|---|
| `src/hooks/use-pagestorm-posts.ts:347` (api `/api/me/pagestorm/drafts`) / `:333` | select | 12 list columns | `env`, own `user_id` | `updated_at desc`, 20 | |
| `src/hooks/use-pagestorm-posts.ts:292` / `:279` | select | `*` | `id`, `env` (legacy relies on RLS for the owner; Worker adds `user_id`) | 1 | |
| `src/hooks/use-pagestorm-posts.ts:186` / `:194` | insert | `user_id, nickname, title, content, content_text, env, updated_at` + token | | | 9 inserts |
| `src/hooks/use-pagestorm-posts.ts:211` / `:221` | update | same | `id`, `user_id`, `env` | | 6 updates |
| `src/hooks/use-pagestorm-posts.ts:239` / `:248` | delete | | `id`, `user_id`, `env` | | 6 deletes |

UI: drafts list on the Pagestorm index (title, thumbnail), editor load by `?draft=<id>`.

### 3.13 `defragment_bodies` (조각모음 덧글 본문)

An optional overlay text attached to one post of another service when it is written from the Defragment board.
DDL schema:2855-2869.

Stats (pg_stat_user_tables, 2026-11-07; counters since 2026-06-02): live rows **9**, inserted 10, updated 0, deleted 0, seq scans 16 (42 tuples read), index scans 791, total size 49152 B (heap 8192 B, TOAST 8192 B).

| # | column | type | NOT NULL | default |
|---|---|---|---|---|
| 1 | `env` | `text` | yes |  |
| 2 | `source_service` | `text` | yes |  |
| 3 | `source_id` | `uuid` | yes |  |
| 4 | `user_id` | `uuid` | yes |  |
| 5 | `nickname` | `text` | yes |  |
| 6 | `content` | `jsonb` | yes |  |
| 7 | `content_text` | `text` | yes |  |
| 8 | `created_at` | `timestamp with time zone` | yes | `now()` |
| 9 | `updated_at` | `timestamp with time zone` | yes | `now()` |

Constraints (verbatim `pg_get_constraintdef`):

```sql
-- PRIMARY KEY: defragment_bodies_pkey
PRIMARY KEY (env, source_service, source_id);
-- FOREIGN KEY: defragment_bodies_user_id_fkey
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
-- CHECK: defragment_bodies_content_size_check
CHECK ((pg_column_size(content) <= 1048576));
-- CHECK: defragment_bodies_content_text_check
CHECK (((char_length(content_text) >= 2) AND (char_length(content_text) <= 8000)));
-- CHECK: defragment_bodies_env_check
CHECK ((env = ANY (ARRAY['production'::text, 'development'::text])));
-- CHECK: defragment_bodies_nickname_check
CHECK (((char_length(nickname) >= 1) AND (char_length(nickname) <= 20)));
-- CHECK: defragment_bodies_source_service_check
CHECK ((source_service = ANY (ARRAY['combo'::text, 'transfigure'::text, 'this_or_that'::text, 'chemical_x'::text, 'decisions_decisions'::text, 'favorite_tournament'::text, 'pagestorm'::text])));
```

| index | idx_scan | bytes | definition |
|---|---|---|---|
| `idx_defragment_bodies_source` | 781 | 16384 | `USING btree (env, source_service, source_id)` |
| `defragment_bodies_pkey (PK)` | 10 | 16384 | `USING btree (env, source_service, source_id)` |


- Key `(env, source_service, source_id)`: in effect a 1:1 optional extension of one post, owned by that post's author
  (`defragment_source_owned`). **No FK** to the post, so deleting the post leaves the body.
- `source_id` is `uuid`, and the CHECK excludes `history_course`, so a body for a run cannot exist.
- `content` is a `PostBlock[]` (no type CHECK); `content_text` 2..8000 (the client limit is 2..2000 visible
  characters, stored up to 8000: `DEFRAGMENT_BODY_MIN_CHARS`, `MAX_CHARS`, `STORAGE_MAX_CHARS`,
  `src/lib/content-limits.ts:16-22`).
- Only `nickname` is kept as author snapshot (no avatar columns).
- No guard: `created_at` defaults, `updated_at` comes from the client (`src/hooks/use-defragment-bodies.ts:131,150`).

Queries:

| where | op | columns | filter | volume |
|---|---|---|---|---|
| `workers/api/routes/toybox.ts:323-333`; `src/hooks/use-defragment-bodies.ts:86` / `:94`, called by `src/components/defragment/defragment-federated-post-view.tsx:72` (every federated detail, also for `history_course`, which fails and is swallowed) | select | `*` | `env`, `source_service`, `source_id` | 791 index scans in total |
| `workers/api/routes/toybox.ts:335-351`; `src/hooks/use-defragment-bodies.ts:123` / `:141`, called by `defragment-write-panel.tsx:190` (after the post insert) and on retry | upsert | `env, source_service, source_id, user_id, nickname, content, content_text, updated_at` | `on_conflict=env,source_service,source_id` | 10 inserts, 0 updates |

UI: the overlay body block on `/defragment/<service>/<id>`.

Dead: `idx_defragment_bodies_source` (duplicate of the PK).

### 3.14 `defragment_posts` (dead)

Defragment's own posts, replaced by federated posts in `e42cb181`. Zero rows ever (`n_tup_ins` 0). DDL schema:2879-2903.

Stats (pg_stat_user_tables, 2026-11-07; counters since 2026-06-02): live rows **0**, inserted 0, updated 0, deleted 0, seq scans 18 (0 tuples read), index scans 94, total size 40960 B (heap 0 B, TOAST 8192 B).

| # | column | type | NOT NULL | default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | yes | `gen_random_uuid()` |
| 2 | `user_id` | `uuid` | yes |  |
| 3 | `nickname` | `text` | yes |  |
| 4 | `title` | `text` | yes |  |
| 5 | `content` | `jsonb` | yes |  |
| 6 | `content_text` | `text` | yes |  |
| 7 | `env` | `text` | yes | `'production'::text` |
| 8 | `like_count` | `integer` | yes | `0` |
| 9 | `comment_count` | `integer` | yes | `0` |
| 10 | `created_at` | `timestamp with time zone` | yes | `now()` |
| 11 | `avatar_id` | `text` | no |  |
| 12 | `avatar_kind` | `text` | no |  |
| 13 | `palette_id` | `text` | no |  |
| 14 | `palette_swapped` | `boolean` | no | `false` |

Constraints (verbatim `pg_get_constraintdef`):

```sql
-- PRIMARY KEY: defragment_posts_pkey
PRIMARY KEY (id);
-- FOREIGN KEY: defragment_posts_user_id_fkey
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
-- CHECK: defragment_posts_author_token_size_check
CHECK ((((COALESCE(octet_length(avatar_id), 0) + COALESCE(octet_length(avatar_kind), 0)) + COALESCE(octet_length(palette_id), 0)) <= 1024));
-- CHECK: defragment_posts_content_size_check
CHECK ((pg_column_size(content) <= 1048576));
-- CHECK: defragment_posts_content_text_check
CHECK (((char_length(content_text) >= 2) AND (char_length(content_text) <= 8000)));
-- CHECK: defragment_posts_env_check
CHECK ((env = ANY (ARRAY['production'::text, 'development'::text])));
-- CHECK: defragment_posts_nickname_check
CHECK (((char_length(nickname) >= 1) AND (char_length(nickname) <= 20)));
-- CHECK: defragment_posts_title_check
CHECK (((char_length(title) >= 1) AND (char_length(title) <= 80)));
```

| index | idx_scan | bytes | definition |
|---|---|---|---|
| `idx_defragment_posts_env_recommend_created` | 80 | 8192 | `USING btree (env, (((like_count * 4) + (comment_count * 6))) DESC, created_at DESC, id DESC)` |
| `idx_defragment_posts_env_created` | 14 | 8192 | `USING btree (env, created_at DESC, id DESC)` |
| `defragment_posts_pkey (PK)` | 0 | 8192 | `USING btree (id)` |
| `idx_defragment_posts_env_comment_created` | 0 | 8192 | `USING btree (env, comment_count DESC, created_at DESC, id DESC)` |


Still referenced (all to be removed with the table at step 7, nothing to port): `src/hooks/use-defragment-posts.ts:87`
/ `:108` (update), `:137` / `:146` (delete), `:162` / `:173` (detail for `/defragment/[id]`); `TOYBOX_POST_TABLES.defragment`
and `TOYBOX_UPDATABLE_SERVICES` (`src/lib/toybox-api-rules.ts:15,21`), so the Worker's `/api/read/toybox-post?service=defragment`
still queries it; `workers/detail-shell-og.ts:440`; `src/lib/toybox-post-og-fields.ts:139`; the `defragment` branches
of `apply_toybox_thread_engagement_delta`; its guard trigger; the only entry in the `supabase_realtime` publication.
Neither feed RPC reads it.

### 3.15 `runs`: only what the Defragment board reads

`runs` belongs to the History Course inventory (raw file, summary columns, cover, **→ decision 4**). The full catalog
facts are below for reference; this section covers only the Defragment use. DDL schema:3238-3266.

Stats (pg_stat_user_tables, 2026-11-07; counters since 2026-06-02): live rows **687**, inserted 680, updated 699, deleted 75, seq scans 4602 (1830549 tuples read), index scans 88952, total size 7880704 B (heap 1073152 B, TOAST 6242304 B).

| # | column | type | NOT NULL | default |
|---|---|---|---|---|
| 1 | `id` | `text` | yes |  |
| 2 | `raw` | `text` | yes |  |
| 3 | `seed` | `text` | yes |  |
| 4 | `build` | `text` | yes |  |
| 5 | `character` | `text` | yes |  |
| 6 | `ascension` | `integer` | yes |  |
| 7 | `win` | `boolean` | yes |  |
| 8 | `start_time` | `bigint` | no |  |
| 9 | `run_time` | `integer` | no |  |
| 10 | `acts_count` | `integer` | yes |  |
| 11 | `donor_user_id` | `uuid` | no |  |
| 12 | `created_at` | `timestamp with time zone` | no | `now()` |
| 13 | `total_floors` | `integer` | yes | `0` |
| 14 | `env` | `text` | yes | `'production'::text` |
| 15 | `badges` | `jsonb` | yes | `'[]'::jsonb` |
| 16 | `highlight_card` | `jsonb` | no |  |
| 17 | `highlight_relic` | `jsonb` | no |  |
| 18 | `note_blocks` | `jsonb` | no |  |
| 19 | `cover_spec` | `jsonb` | no |  |
| 20 | `like_count` | `integer` | yes | `0` |
| 21 | `comment_count` | `integer` | yes | `0` |
| 22 | `donor_nickname` | `text` | yes | `'닉'::text` |

Constraints (verbatim `pg_get_constraintdef`):

```sql
-- PRIMARY KEY: runs_pkey
PRIMARY KEY (id, env);
-- FOREIGN KEY: runs_donor_user_id_fkey
FOREIGN KEY (donor_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
-- CHECK: runs_badges_is_array
CHECK ((jsonb_typeof(badges) = 'array'::text));
-- CHECK: runs_donor_nickname_len
CHECK (((char_length(btrim(donor_nickname)) >= 1) AND (char_length(btrim(donor_nickname)) <= 20)));
-- CHECK: runs_env_check
CHECK ((env = ANY (ARRAY['production'::text, 'development'::text])));
-- CHECK: runs_key_size_check
CHECK (((octet_length(id) <= 1024) AND (octet_length(seed) <= 1024) AND (octet_length(build) <= 1024) AND (octet_length("character") <= 1024) AND (octet_length(donor_nickname) <= 1024)));
-- CHECK: runs_meta_size_check
CHECK (((pg_column_size(note_blocks) <= 1048576) AND (pg_column_size(cover_spec) <= 1048576) AND (pg_column_size(badges) <= 131072) AND (pg_column_size(highlight_card) <= 131072) AND (pg_column_size(highlight_relic) <= 131072)));
-- CHECK: runs_note_blocks_is_array
CHECK (((note_blocks IS NULL) OR (jsonb_typeof(note_blocks) = 'array'::text)));
-- CHECK: runs_raw_size_check
CHECK ((octet_length(raw) <= 8388608));
```

| index | idx_scan | bytes | definition |
|---|---|---|---|
| `idx_runs_created` | 40687 | 40960 | `USING btree (created_at DESC)` |
| `idx_runs_env_created_desc` | 35502 | 49152 | `USING btree (env, created_at DESC)` |
| `idx_runs_env` | 5238 | 32768 | `USING btree (env)` |
| `idx_runs_env_donor` | 4628 | 40960 | `USING btree (env, donor_user_id)` |
| `runs_pkey (PK)` | 2883 | 90112 | `USING btree (id, env)` |
| `idx_runs_env_comment_created` | 8 | 106496 | `USING btree (env, comment_count DESC, created_at DESC, id DESC)` |
| `idx_runs_env_like_created` | 4 | 106496 | `USING btree (env, like_count DESC, created_at DESC, id DESC)` |
| `idx_runs_build` | 1 | 32768 | `USING btree (build)` |
| `idx_runs_character` | 1 | 32768 | `USING btree ("character")` |


What Defragment needs from a run (and nothing from `raw`):

| field | column | use |
|---|---|---|
| `id` | `id` (text, unique per env) | row id, link `/history-course/<id>`, thread `history-course:<id>`, keyset tie-break (as text) |
| `created_at` | `created_at` (**nullable**) | order, keyset, relative time, read mark |
| `like_count`, `comment_count` | same | order (`recommended`, `comments`), counts (trigger `history-course:` branch) |
| title | `seed` (fallback `id`) | v2: `left(btrim(coalesce(nullif(seed, ''), id)), 120)`; Worker/legacy runs page: `seed.trim() ? seed : id` (`src/lib/defragment-feed.ts:226-228`); the client then replaces it with a lockup title from `cover_spec` when present (`defragment-client.tsx:109-125`) |
| nickname | `donor_nickname` (NOT NULL, default `'닉'`) | author label; empty → default profile nickname |
| user | `donor_user_id` (nullable, FK `ON DELETE SET NULL`) | `isOwner` |
| `history_meta` | `cover_spec`, `win`, `ascension`, `total_floors` | cover thumbnail and lockup title |

Queries:

| where | op | filter | order | limit / cursor | volume |
|---|---|---|---|---|---|
| `get_defragment_feed_v2` `runs` branch (schema:1088-1114) | select | `env` | `created_at desc, id::text desc` / `like_count desc, ...` / `comment_count desc, ...` | 20, keyset with text id | in R2 |
| `workers/api/routes/toybox.ts:110-133`; `src/lib/defragment-feed.ts:182` (api) / `:188-209` (legacy) | select 11 columns (`DEFRAGMENT_RUN_COLUMNS`) | `env` | `created_at.desc,id.desc` or `<count>.desc,created_at.desc,id.desc` | 20; the api path is skipped when the cursor id does not match `ROW_ID` (`apiCursorOk`, `defragment-feed.ts:139-141`) | below top 50 |
| `workers/detail-shell-og.ts:288` (off) | select `character, cover_spec` | `id`, `env` | | 1 | |

Indexes it uses today: `idx_runs_env_created_desc (env, created_at DESC)` 35 502 scans (shared with the History Course
list), `idx_runs_env_like_created` 4, `idx_runs_env_comment_created` 8.


## 4. Functions and RPCs

### 4.1 `get_toybox_feed(p_env, p_service, p_sort, p_limit, p_cursor_score, p_cursor_created_at, p_cursor_id uuid)` (schema:1916-2015)

`LANGUAGE plpgsql STABLE`, invoker rights, granted to anon/authenticated. Returns
`(id uuid, created_at timestamptz, like_count int, comment_count int, recommend_score bigint, post jsonb)`.

1. `page_limit := least(greatest(coalesce(p_limit, 20), 1), 20)`; the Worker always sends 20.
2. `sort_key`: `comments`, `recommended`, `vote_rate_high`, `vote_rate_low`, `play_count`, anything else → `latest`.
3. `p_service` → table (`combo_posts`, `transfigure_posts`, `this_or_that_posts`, `chemical_posts`,
   `decisions_decisions_posts`, `favorite_tournament_posts`, `pagestorm_posts`); unknown → empty result
   (`defragment` is not a feed service).
4. `vote_rate_high|low` on any service but `this_or_that` → empty; on `this_or_that` adds
   `and (p.left_vote_count + p.right_vote_count) > 0` (posts with no votes are **excluded** from these two sorts).
   `play_count` on any service but `favorite_tournament` → empty.
5. ORDER BY (all DESC):

| sort | ORDER BY | keyset (only when `p_cursor_id` and `p_cursor_created_at` are both non-null) |
|---|---|---|
| `latest` | `p.created_at desc, p.id desc` | `(p.created_at, p.id) < ($4, $5)` |
| `recommended` | `p.like_count desc, p.created_at desc, p.id desc` | `(p.like_count::bigint, p.created_at, p.id) < ($3, $4, $5)` |
| `comments` | `p.comment_count desc, p.created_at desc, p.id desc` | `(p.comment_count::bigint, p.created_at, p.id) < ($3, $4, $5)` |
| `vote_rate_high` | `(p.left_vote_count::bigint + p.right_vote_count::bigint) desc, p.created_at desc, p.id desc` | `((left+right), p.created_at, p.id) < ($3, $4, $5)` |
| `vote_rate_low` | `(1000000000 - (left+right)) desc, p.created_at desc, p.id desc` | `((1000000000 - (left+right)), p.created_at, p.id) < ($3, $4, $5)` |
| `play_count` | `p.play_count desc, p.created_at desc, p.id desc` | `(p.play_count::bigint, p.created_at, p.id) < ($3, $4, $5)` |

6. `recommend_score` is `p.like_count::bigint` (no weighting). `post` is `to_jsonb(p.*)`: every column, including
   `env`, `user_id`, generated `vote_rate_bps`, text arrays as JSON arrays, timestamps in ISO form (section 8).

Notes:
- **"Recommended" is plain `like_count`**, and **"vote rate high/low" is total ballots** (participation), not the winner
  share. UI labels say `투표율 높은 순` / `투표율 낮은 순` (`src/messages/service.ts:391-392`). `vote_rate_bps` (winner
  share) and the 7 `(like_count * 4) + (comment_count * 6)` indexes match no ORDER BY.
- `vote_rate_low` keeps the descending keyset by inverting the score with the ceiling `1000000000`
  (`TOYBOX_FEED_VOTE_TOTAL_SCORE_CEILING`, `src/lib/toybox-feed.ts:57`): it is `total ASC, created_at DESC, id DESC`.
- The client computes the next cursor from the last row (`toyboxFeedCursorScore`, `cursorFromFeedItem`, `src/lib/toybox-feed.ts:208-229`):
  `score` = comment_count / like_count / total / `1e9 - total` / play_count, `createdAt` = the row's `created_at`
  string as returned, `id` = row id. `hasMore` is `items.length >= 20` (no look-ahead row).
- If a score cursor arrived with `p_cursor_score` NULL, the row comparison would be NULL and return nothing; the
  Worker always sends all three fields or none (`workers/api/routes/toybox.ts:53-61`).
- Rows with NULL `created_at` (possible only in `chemical_posts`) sort first under Postgres DESC and are excluded from
  every later page by the row comparison.
- Volume: 3525 anon + 3295 authenticated = **6820 calls, about 43/day**, mean 52-54 ms (stmts.json). Index use is
  hidden behind dynamic SQL; the small tables are mostly seq-scanned (see each table's `seq_scan`).

### 4.2 `get_defragment_feed_v2(p_env, p_sort, p_limit, p_cursor_score, p_cursor_created_at, p_cursor_id text)` (schema:872-1127)

The Defragment board's unfiltered feed. Returns
`(id text, created_at, like_count, comment_count, recommend_score bigint, service text, title text, nickname text,
user_id text, avatar_id, avatar_kind, palette_id, palette_swapped boolean, history_meta jsonb)`.

- `page_limit` as above (max 20). `sort_key`: `comments`, `recommended`, else `latest` (the vote/play sorts do not
  exist here).
- It is a `UNION ALL` of 8 branches, **each** `WHERE p.env = $1 <cursor> ORDER BY <inner> LIMIT $2`, then an outer
  `ORDER BY <outer> LIMIT $2`. So one page reads up to 8 × 20 rows.
- Inner order: `latest` `p.created_at desc, p.id::text desc`; `recommended` `p.like_count desc, p.created_at desc,
  p.id::text desc`; `comments` `p.comment_count desc, p.created_at desc, p.id::text desc`. Outer order uses `s.*` the same
  way. Keyset: `(p.created_at, p.id::text) < ($4, $5)` or `(p.<count>::bigint, p.created_at, p.id::text) < ($3, $4, $5)`.
  Ids are compared **as text** (uuid text and free-text run ids in one order) under the database collation; ties need
  the same `created_at` to the microsecond.
- `recommend_score` = `like_count` everywhere.
- Per-branch `service` and `title` (exact expressions, the source of a common `posts.title/summary` column,
  **→ decision 2**):

| branch | service | title | nickname | user_id | avatar/palette | history_meta |
|---|---|---|---|---|---|---|
| `combo_posts` | `combo` | `left(btrim(p.content_text), 120)` | `p.nickname` | `p.user_id::text` | columns | `null` |
| `transfigure_posts` | `transfigure` | `left(btrim(coalesce(nullif(p.title, ''), nullif(p.transformed_name, ''), p.content_text)), 120)` | same | same | columns | `null` |
| `this_or_that_posts` | `this_or_that` | `left(btrim(p.reason), 120)` | same | same | columns | `null` |
| `chemical_posts` | `chemical_x` | `left(btrim(p.content_text), 120)` | same | same | columns | `null` |
| `decisions_decisions_posts` | `decisions_decisions` | `left(btrim(coalesce(nullif(p.title, ''), p.note)), 120)` | same | same | columns | `null` |
| `favorite_tournament_posts` | `favorite_tournament` | `left(btrim(coalesce(nullif(p.title, ''), p.note)), 120)` | same | same | columns | `null` |
| `pagestorm_posts` | `pagestorm` | `left(btrim(coalesce(nullif(p.title, ''), p.content_text)), 120)` | same | same | columns | `null` |
| `runs` | `history_course` | `left(btrim(coalesce(nullif(p.seed, ''), p.id)), 120)` | `p.donor_nickname` | `p.donor_user_id::text` | all `null` | `jsonb_build_object('cover_spec', p.cover_spec, 'win', p.win, 'ascension', p.ascension, 'total_floors', p.total_floors)` |

- `btrim` with one argument trims **spaces only**. The client's own title for filtered pages
  (`feedItemFromPost`, `src/lib/defragment.ts:165-204`) collapses all whitespace (`/\s+/g`), uses JS `trim()` and
  `slice(0, 120)` (UTF-16 units, not characters). The two differ on newlines and astral characters.
- Volume: 730 anon calls in the top 50 (mean 177 ms, the slowest toybox statement); the authenticated entry is below
  the top 50. CLEANUP_AUDIT 1 counts about 1460 in total.

`get_defragment_feed` (v1, schema:626-866) is the same without the `runs` branch, with `p_cursor_id uuid` and uuid
ordering. **Dead** (CLEANUP_AUDIT 3.1; the v2→v1 fallback was deleted in `2cd8ba00`). Its 752 + 732 authenticated
calls in stmts.json predate the cleanup.

### 4.3 `complete_favorite_tournament_play(p_tournament_id uuid, p_env text, p_starting_size int, p_champion_type text, p_champion_id text, p_matches jsonb)` (schema:396-543)

`plpgsql SECURITY DEFINER`, `search_path public, pg_temp`, granted to anon, authenticated, service_role. Steps:

1. `actor := auth.uid()`; NULL → `raise 'not authenticated'`.
2. Validates `p_starting_size >= 2`, `jsonb_typeof(p_matches) = 'array'`, `jsonb_array_length(p_matches) =
   p_starting_size - 1`.
3. Loads `pool` of the tournament in `p_env` (`'tournament not found'`), requires `p_starting_size <=
   jsonb_array_length(v_pool)`.
4. Every match side `(left_type,left_id)` / `(right_type,right_id)` must exist in the pool (`p.value->>'type'`,
   `p.value->>'id'`), else `'match candidate outside pool'` (**the pool is joined by element here**).
5. The champion must equal the final match's winner side (`v_final->>((v_final->>'winner') || '_type')`).
6. `INSERT INTO favorite_tournament_plays (tournament_id, user_id, env, starting_size, champion_type, champion_id,
   matches)`.
7. `UPDATE favorite_tournament_posts SET play_count = play_count + 1`.
8. For each match: rejects NULL ids (`'invalid match'`) and winners other than `left`/`right` (`'invalid winner'`), then
   two upserts `ON CONFLICT (tournament_id, env, resource_type, resource_id)`: `match_appearances + 1`,
   `match_wins + (winner side ? 1 : 0)`.
9. Champion upsert: `championships + 1`.
10. Re-ranks **every** stats row of the tournament: `ORDER BY championships desc, (match_wins::numeric /
    match_appearances, 0 when no appearances) desc, match_appearances desc, resource_type, resource_id`; sets
    `current_rank = rank_i` on every row and appends `{"at": timezone('utc', now())::text, "rank": rank_i}` to
    `rank_history` only when the rank changed.
11. Returns `{"ok": true}`.

Not checked: that the matches form a real bracket, duplicates, or how often one user plays (no rate limit; the step-1
Worker caps the body at 256 KB, `workers/api/routes/toybox.ts:476`). Write cost per play: 1 play insert + 1 post
update + up to `2 × (n-1) + 1` stats upserts + one UPDATE per existing stats row of that tournament. For the built-in
298-relic bracket (297 matches, STEP1_DESIGN 9.8) that is about 595 upserts and 298 rank updates, before D1 counts
index rows (D1 bills one extra written row per index touched). Today: 70 plays, 637 stats inserts, 2870 stats updates.

### 4.4 `get_this_or_that_vote_summaries(p_post_ids uuid[], p_env text DEFAULT 'production')` (schema:1868-1891)

`plpgsql STABLE SECURITY DEFINER`, `search_path ''`. Raises `'A maximum of 50 post ids is allowed'` above 50 ids.
`SELECT post_id, count(*) filter (where choice = 'left'), count(*) filter (where choice = 'right'), count(*) FROM
this_or_that_post_votes WHERE env = p_env AND post_id = any(p_post_ids) GROUP BY post_id`. Posts without votes
return no row. The result equals `left_vote_count`, `right_vote_count`, their sum on the post row, as long as the
trigger counters have not drifted. SECURITY DEFINER is what lets anon aggregate votes that RLS hides row by row.
Volume: 1039 authenticated + 927 anon = 1966 calls (about 12/day), mean 35 ms. Probably served by
`idx_this_or_that_post_votes_env_post_choice` (799 scans).

`get_this_or_that_vote_totals(p_env)` (schema:1897-1910): env-wide left/right/total. **Dead** (CLEANUP_AUDIT 3.1).

### 4.5 `defragment_source_owned(p_service text, p_source_id uuid, p_env text)` (schema:552-583)

`sql STABLE`, `search_path ''`, executable by authenticated and service_role only. `CASE p_service` over the 7 write
services: `exists (select 1 from public.<table> s where s.id = p_source_id and s.env = p_env and s.user_id = (select
auth.uid()))`; any other service → `false`. Used only by the `defragment_bodies` insert/update policies: you may
attach a body only to a post you own, in the same env.

### 4.6 `admin_story_service(p_story_id text)` (schema:42-62)

`sql IMMUTABLE PARALLEL SAFE`, service_role only. Maps a thread key prefix to a service name (table in section 1).
Only `get_rls_activity_metrics` calls it. `src/lib/comment-threads.ts:110-125` (`commentThreadService`) is the
TypeScript twin ("Keep in sync"). Neither maps `history-course:`, `neowsletter:` or `beta-art:` (they fall to
`other`).

### 4.7 Trigger functions

`guard_post_server_columns`, `guard_insert_server_columns`: 2.4. `apply_toybox_thread_engagement_delta`,
`apply_this_or_that_like_count_delta`, `apply_this_or_that_vote_count_delta`: 2.5. All three counter functions are
`SECURITY DEFINER` and fire for every role (no `WHEN`), so in step 5 a mirrored like/comment/vote row recomputes
Supabase's counters by itself (as plan 7.3 step 5 expects). The tournament counters are the exception (4.3).

### 4.8 Other functions that read these tables (other domains)

- `get_my_profile_activity(p_env, p_category, p_sort, p_limit, p_offset)` (schema:1165-1286) and
  `get_my_profile_activity_stats(p_env)` (schema:1292-1375), called by `workers/api/routes/profile.ts:38,58`: own
  `chemical_posts` (`content_text`, `content`, `created_at`, like 0), own `this_or_that_posts` (`reason`, with
  `count(this_or_that_post_likes.id)` as likes), own `combo_posts` (`content_text`, `content`, like 0), plus stories,
  comments and runs. Filter `env = p_env AND user_id = auth.uid()`; order `like_count desc` (sort `likes`) then
  `created_at desc, activity_id desc`; `LIMIT least(greatest(p_limit,1),50) OFFSET`. Transfigure, decisions,
  tournament and pagestorm posts are **not** in the profile. Needs `(user_id, created_at)` on those three services.
- `get_rls_activity_metrics(p_env)` (schema:1505-1843, service role, `/dev/admin`): `user_id, created_at` of every
  post table except pagestorm (tournament: `user_id is not null`), runs, comments and likes via
  `admin_story_service`, `this_or_that_post_likes`, `this_or_that_post_votes`, `favorite_tournament_plays`. Plan 5.7
  moves admin metrics to local `wrangler d1 execute` scripts.
- `get_engagement_counts(p_env)` (schema:1134-1159) counts all `likes`/`comments` per `story_id`; the toybox lists do
  not use it (they read the counter columns), the threads domain does.

## 5. Step-1 Worker: `workers/api/routes/toybox.ts`

All routes are group `toybox-feed`. `p_env` / `env=eq.` is always the Worker's `config.dataEnv` (`API_DATA_ENV`).
Responses marked "passthrough" stream PostgREST's JSON array unparsed (`passthroughJson`), so today's response shape is
exactly PostgREST's. `TOYBOX_PAGE_SIZE = 20`.

| route (line) | access, limit | upstream call | filters / order / limit | response |
|---|---|---|---|---|
| `GET /api/read/toybox-feed?service&sort[&score&created_at&cursor_id]` (67-87, 467) | public, IP | `rpc/get_toybox_feed` | as 4.1 | passthrough |
| `GET /api/read/defragment-feed?sort[&cursor]` (89-107, 468) | public, IP | `rpc/get_defragment_feed_v2` | as 4.2 | passthrough |
| `GET /api/read/defragment-runs?sort=latest\|recommended\|comments[&cursor]` (110-133, 469) | public, IP | `GET runs` | `select=id,created_at,like_count,comment_count,seed,donor_user_id,donor_nickname,cover_spec,win,ascension,total_floors`, `env=eq`, order `created_at.desc,id.desc` or `<like_count\|comment_count>.desc,created_at.desc,id.desc`, `limit=20`, keyset `or=(created_at.lt."c",and(created_at.eq."c",id.lt."i"))` or `or=(s.lt.N,and(s.eq.N,created_at.lt."c"),and(s.eq.N,created_at.eq."c",id.lt."i"))` | passthrough |
| `GET /api/read/toybox-post?service&id` (137-147, 470) | public, IP | `GET <table>` | `select=*`, `id=eq.<lowercased uuid>`, `env=eq`, `limit=1` | passthrough (`[]` if none) |
| `POST /api/write/toybox-post?service` (149-166, 471) | write, raw body ≤ 8 MB | `POST <table>` with the user's JWT | body streamed unparsed (client sends `user_id`, `env`); `select=*`, `return=representation` | 201 passthrough |
| `PATCH /api/write/toybox-post?service&id` (168-185, 472) | write, ≤ 8 MB, only updatable services | `PATCH <table>` | `id=eq`, `user_id=eq.<JWT sub>`, `env=eq`, `select=*` | passthrough (`[]` if no row) |
| `DELETE /api/write/toybox-post?service&id` (187-206, 473) | write | `DELETE <table>` | `id=eq`, `user_id=eq.<sub>`, `env=eq`, `select=id` | `{v, env, deleted}` |
| `GET /api/read/favorite-tournament/presets` (210-217, 474) | public, IP | `GET favorite_tournament_posts` | `select=*`, `env=eq`, `preset_key=like.builtin:*`, `order=created_at.asc`, **no limit** | passthrough |
| `GET /api/read/favorite-tournament/stats?id` (219-228, 475) | public, IP | `GET favorite_tournament_candidate_stats` | `select=*`, `tournament_id=eq`, `env=eq`, no order, no limit | passthrough |
| `POST /api/write/favorite-tournament/play` (230-256, 476) | write, JSON ≤ 256 KB | `rpc/complete_favorite_tournament_play` | shape check only; RPC validates | `{v, env, result}` |
| `GET /api/read/pagestorm/posts` (260-267, 477) | public, IP | `GET pagestorm_posts` | `select=id,user_id,nickname,title,content,content_text,env,created_at,avatar_id,avatar_kind,palette_id,palette_swapped`, `env=eq`, `order=created_at.desc`, `limit=50` | passthrough |
| `GET /api/me/pagestorm/drafts[?id]` (269-278, 478) | me | `GET pagestorm_drafts` with JWT | one: `select=*`, `id=eq`, `user_id=eq`, `env=eq`, `limit=1`; list: same 12 columns, `env=eq`, `user_id=eq`, `order=updated_at.desc`, `limit=20` | passthrough |
| `POST /api/write/pagestorm/drafts` (280-295, 479) | write, ≤ 4 MB | `POST pagestorm_drafts` | body unparsed, `return=representation` | 201 passthrough |
| `PATCH /api/write/pagestorm/drafts?id` (297-313, 480) | write, ≤ 4 MB | `PATCH pagestorm_drafts` | `id`, `user_id`, `env` | passthrough |
| `DELETE /api/write/pagestorm/drafts?id` (315-319, 481) | write | `DELETE pagestorm_drafts` | `id`, `user_id`, `env` | `{v, env, deleted}` |
| `GET /api/read/defragment-body?service&id` (323-333, 482) | public, IP | `GET defragment_bodies` | `select=*`, `env=eq`, `source_service=eq`, `source_id=eq`, `limit=1` | passthrough |
| `PUT /api/write/defragment-body` (335-351, 483) | write, ≤ 8 MB | `POST defragment_bodies` upsert | `on_conflict=env,source_service,source_id`, `resolution=merge-duplicates`, body unparsed | passthrough |
| `GET /api/read/this-or-that/like-counts?ids` (363-371, 484) | public, IP, ≤ 100 uuids | `GET this_or_that_post_like_counts` (view) | `select=post_id,like_count`, `env=eq`, `post_id=in.(...)` | `{v, env, rows}` |
| `GET /api/me/this-or-that/likes?ids` (373-381, 485) | me, IP | `GET this_or_that_post_likes` | `select=post_id`, `env`, `user_id=eq.<sub>`, `post_id=in` | `{v, env, rows}` |
| `PUT`/`DELETE /api/write/this-or-that/like?id` (383-393, 486-487) | write, IP budget | `POST` `{post_id, user_id, env}` / `DELETE post_id,user_id,env` | duplicate (23505) on PUT counts as success | `{v, env, liked}` |
| `GET /api/read/this-or-that/vote-summaries?ids` (395-408, 488) | public, IP, ≤ 50 | `rpc/get_this_or_that_vote_summaries` | | `{v, env, rows}` |
| `GET /api/me/this-or-that/votes?ids` (410-418, 489) | me, IP, ≤ 100 | `GET this_or_that_post_votes` | `select=post_id,choice`, `env`, `user_id`, `post_id=in` | `{v, env, rows}` |
| `PUT /api/write/this-or-that/vote?id` `{choice, surface}` (420-439, 490) | write, IP, JSON ≤ 1 KB | `POST this_or_that_post_votes` `{post_id, user_id, choice, created_surface, env}` | `choice` in left/right, `surface` in index/detail | 201 `{v, env, choice}` |
| `DELETE /api/write/this-or-that/vote?id` (441-455, 491) | write, IP | `DELETE this_or_that_post_votes` | `post_id`, `user_id`, `env` | `{v, env, choice: null}` |

Validation helpers (`src/lib/toybox-api-rules.ts`): uuid `/^[0-9a-f]{8}-...-[0-9a-f]{12}$/i` (ids are lowercased
before use), run/row id `/^[A-Za-z0-9_-]{1,64}$/`, score `/^-?\d{1,12}$/`, created_at
`/^\d{4}-\d{2}-\d{2}[T ][0-9:.]{8,15}(?:Z|[+-]\d{2}(?::?\d{2})?)?$/`, source service `/^[a-z_]{1,32}$/`, id lists
unique, ≤ 100 (`TOYBOX_IDS_MAX`) or ≤ 50 (`THIS_OR_THAT_SUMMARY_IDS`).

## 6. Read catalogue for deriving D1 indexes (**→ decision 6**)

Every read the Worker serves for this domain, in the shape it will have once the D1 adapter answers it. "Today" is the
Postgres path that serves it. Volume is the legacy path (stmts.json); the step-1 Worker has run in production only since
2026-11-08, so it has no history yet. Row counts are tiny, so the question for each query is "how many index rows does
it touch per call", not latency.

| # | read | filter | order | limit / cursor | today | volume |
|---|---|---|---|---|---|---|
| R1 | Service feed (`/api/read/toybox-feed`), 7 services × 3 core sorts + `vote_rate_high`, `vote_rate_low` (this or that) + `play_count` (tournament) | service; vote sorts add `left+right > 0` | 4.1 table | 20, keyset `(score?, created_at, id) <` | `get_toybox_feed`, per-table `(env, <count> DESC, created_at DESC, id DESC)` and `(env, created_at DESC)` indexes or seq scans | 6820 calls / 158 d (≈ 43/day) |
| R2 | Defragment board, all services (`/api/read/defragment-feed`) | none (env only) | `latest`, `recommended` (like_count), `comments`, ids as text | 20 over the union of 7 post tables + `runs`, keyset with text id | `get_defragment_feed_v2`, 8 sub-queries × 20 | ≈ 1460 / 158 d (≈ 9/day) |
| R3 | Defragment board filtered to one post service | service | `latest` / `recommended` / `comments` | 20, keyset | same as R1 (client calls `get_toybox_feed`, `src/lib/defragment-feed.ts:150-169`) | in R1 |
| R4 | Defragment board filtered to History Course (`/api/read/defragment-runs`) | runs of env | same 3 sorts | 20, keyset `(score?, created_at, id)` | `idx_runs_env_created_desc` 35 502 scans (shared with the History Course list), `idx_runs_env_like_created` 4, `idx_runs_env_comment_created` 8 | below top 50 |
| R5 | One post (`/api/read/toybox-post`), detail pages, Defragment embeds, Pagestorm embed snapshot (`src/hooks/use-pagestorm-toybox.ts:59-84`) | service + id | | 1 | PK of each table | below top 50 |
| R6 | Tournament presets (`/presets`) | `preset_key LIKE 'builtin:%'` | `created_at ASC` | **all builtins, every column incl. pools** | `idx_favorite_tournament_posts_env_builtin_key` 577 scans | below top 50 |
| R7 | Tournament stats (`/stats?id`) | `tournament_id` | none (client sorts, `rankedCandidateStats`, `src/lib/favorite-tournament.ts:366-389`) | all rows of the tournament | PK prefix (3111 scans) | below top 50 |
| R8 | Pagestorm index (`/api/read/pagestorm/posts`) | env | `created_at DESC` | 50, no paging, no counts | `idx_pagestorm_posts_env_created` 1223 | below top 50 |
| R9 | My drafts list / one draft (`/api/me/pagestorm/drafts`) | `user_id` (+ `id`) | `updated_at DESC` | 20 / 1 | `idx_pagestorm_drafts_env_user_updated` 169 | below top 50 |
| R10 | Defragment body (`/api/read/defragment-body`) | `source_service`, `source_id` | | 1 | PK / duplicate index (791 scans together) | below top 50 |
| R11 | This-or-that like counts by ids (`/like-counts`) | `post_id IN (≤100)` | | | view = `count(*) GROUP BY post_id, env` over likes; same value as `this_or_that_posts.like_count` | below top 50 |
| R12 | My this-or-that likes by ids (`/api/me/this-or-that/likes`) | `user_id`, `post_id IN (≤100)` | | | `idx_this_or_that_post_likes_env_post` 8069 | below top 50 |
| R13 | Vote summaries by ids (`/vote-summaries`) | `post_id IN (≤50)` | | | RPC 4.4; equals the post's vote counters | 1966 (≈ 12/day) |
| R14 | My votes by ids (`/api/me/this-or-that/votes`) | `user_id`, `post_id IN (≤100)` | | | `this_or_that_post_votes_unique_user (post_id, user_id, env)` 3933 | below top 50 |
| R15 | Nav "new post" dot (Worker `workers/api/routes/nav.ts:150-157`; legacy `src/lib/nav-seen.ts:315-327`) | per service, `created_at IS NOT NULL` (Worker) or `created_at > since` (legacy) | `created_at DESC NULLS LAST` | 1 | `idx_*_env_created` (combo 42 874, transfigure 47 529, tournament 37 580, decisions 28 364, chemical 9428, this_or_that 1700, pagestorm 1223 scans) | legacy: ≈ 29.1k anon + ≈ 5.3k authenticated **per table** (≈ 218/day/table), the largest toybox load; plan 5.1 replaces it with `surface_latest` written on post insert |
| R16 | Profile activity (other domain) | `user_id` | `created_at DESC, id DESC` (or likes) | ≤ 50 OFFSET | `idx_*_env_user_created` (combo 1294, chemical 94, this_or_that 0 scans) | below top 50 |
| R17 | Detail OG (`workers/detail-shell-og.ts:316,341,367,393,419,440`, off in production) and `src/lib/toybox-post-og-fields.ts` (`next dev` only) | id | | 1 | PK | none in production |
| R18 | Build time: `getRecentTransfigurePosts(15)` (`src/lib/transfigure-data.ts:34-41`, called by `src/components/patches/patch-detail-page.tsx:844-850` during `patch:build`) | env | `created_at DESC` | 15, `select *` | `idx_transfigure_posts_env_created` | per build; plan 5.7 removes build-time DB reads |
| R19 | Dev-only: `/dev/admin` lists (`src/app/(main)/dev/admin/admin-dev-page.tsx:296-530`), `count: exact`, `order created_at desc`, `ROW_LIMIT`; `backstab-transfigure-section.tsx:104-110` (dev hydration only) | env | `created_at DESC` | small | | dev only |

Scan counts that no live query explains: `idx_*_env_user_created` on transfigure (193), tournament (269), decisions (33),
pagestorm (54), and the recommend-expression indexes (combo 1936, transfigure 246, chemical 72, decisions 89,
defragment 80). Those tables are not in the profile activity RPC and nothing orders by the expression; the planner
probably picked them as `env`-prefix scans (for example the RLS-filtered deletes by `id, user_id, env`, the admin
metrics, or the nav query). They are not evidence of a needed index.

## 7. Write catalogue (what a step-4/5 Worker batch must reproduce)

| # | write | today's checks (RLS / CHECK / trigger) | derived values today | notes |
|---|---|---|---|---|
| W1 | Create post (7 services, `/api/write/toybox-post` POST; `src/hooks/use-*-posts.ts` insert paths; Defragment write panel `src/components/defragment/defragment-write-panel.tsx:200-215` then W6) | `user_id = auth.uid()`; tournament `preset_key NOT LIKE 'builtin:%'`; all CHECKs of 3.x; guard sets counters 0 and `created_at = now()` | none | client sends `env` and `user_id`; returns the full row |
| W2 | Edit own post (combo, transfigure, decisions, pagestorm; defragment dead) | update policy; guard restores `id, env, counters, created_at` | none | patch refreshes author snapshot; returns row; 0 rows → client error |
| W3 | Delete own post (all 8) | delete policy | FK cascades: tot votes/likes, tournament stats/plays | likes, comments (thread keys) and `defragment_bodies` stay orphaned |
| W4 | Tournament play | RPC 4.3 | `play_count`, all candidate stats, `current_rank`, `rank_history` | only the RPC computes them; the play row is the only source row |
| W5 | Draft create / update / delete | own rows; CHECKs | none | `updated_at` from the client clock |
| W6 | Body upsert | authenticated, own `user_id`, `defragment_source_owned` | none | PK `(env, source_service, source_id)`; `updated_at` from client |
| W7 | This-or-that like put/delete | own `user_id` (no post-exists check beyond FK) | `this_or_that_posts.like_count ± 1` | duplicate put is success on the Worker path |
| W8 | This-or-that vote put/delete | own `user_id` and the post exists in the same env (5377-5379); UNIQUE `(post_id, user_id, env)` | `left_vote_count` / `right_vote_count ± 1` | no update; re-vote = delete + insert; `created_surface` stored, never read |
| W9 | Comments / likes on toybox thread keys (threads domain) | comments guard sets `created_at` | `<post>.comment_count` / `like_count ± 1`, `runs` counters for `history-course:` | the engagement trigger; **→ decision 3** |

D1 write budget: every counter column that is part of an index costs an extra written row per index on each delta
(D1 bills index rows). Today's volume (about 10 votes, 1 post, a few likes/comments per day) is far below 100 000.
The tournament re-rank (4.3) is the only write that scales with data size.

## 8. Timestamps

What exists today:

- All `created_at` / `updated_at` are `timestamptz` (microsecond precision). Supabase's PostgREST session runs in UTC.
- PostgREST renders them as ISO 8601 with `T`, the fraction **with trailing zeros dropped** (0 to 6 digits) and a
  `+00:00` offset, for example `2026-11-05T00:00:00+00:00` (repo fixtures) or `2026-11-05T11:48:12.3456+00:00`. The same
  text appears in the RPC's `created_at` column and inside `to_jsonb(p.*)`, so a `get_toybox_feed` row carries the same
  string twice (`created_at` and `post.created_at`). STEP1_DESIGN 8.1 records the same fact ("PostgREST는 마이크로초와
  `+00:00`을 주고").
- Values written by the browser are ms-precision `Date.toISOString()` (`...T..:..:..sssZ`): `pagestorm_drafts.updated_at`,
  `defragment_bodies.updated_at`; they read back in the `+00:00` form. The builtin seed writes
  `2026-08-28T00:00:0N.000Z` (`scripts/seed-favorite-tournament-builtins.ts:65`); presets are ordered by it.
- `favorite_tournament_candidate_stats.rank_history[].at` is `timezone('utc', now())::text`, i.e.
  `2026-11-05 11:48:12.345678` (space, no zone), inside JSON, never compared or displayed.
- Nullable `created_at`: `chemical_posts` and `runs` (no NOT NULL; default `now()` and the guard fill it for browser
  writes). The Worker's nav query filters `created_at=not.is.null` because Postgres DESC puts NULL first
  (`workers/api/routes/nav.ts:150-156`). Whether NULL rows actually exist is not in the catalog; check at import:
  `select count(*) from public.chemical_posts where created_at is null;` (and the same on `runs`).

Where strings are compared or round-tripped:

- **Keyset cursors**: the client sends back the last row's `created_at` string unchanged (`cursorFromFeedItem`,
  `cursorFromDefragmentItem`). The Worker checks it against the ISO regex in 5 and today passes it either as a
  `timestamptz` RPC argument or inside a PostgREST `or=` filter, where Postgres parses it, so any ISO form works. Once
  D1 compares TEXT, the Worker must normalize the incoming cursor to the stored canonical form before binding it.
- **Read marks**: `contentIsNewerThanSeen(publishedAt, seenAt)` is `publishedAt > seenAt` on strings
  (`src/lib/nav-seen.ts:21-23`), used by the nav and by every index row (`indexItemIsRead(item.created_at, seenAt)`,
  `src/hooks/use-index-read.tsx:36-39`, `src/components/defragment/defragment-index-row.tsx:162`). `seenAt` is
  `new Date().toISOString()` (`...Z`, ms). This works only because both sides start with `YYYY-MM-DDTHH:MM:SS`; a D1 form
  with a space separator would mark every same-day post as read (`' '` < `'T'`). The Worker nav snapshot normalizes with
  `new Date(x).toISOString()` (STEP1_DESIGN 8.1).

Ordering facts the canonical format must respect:

- Postgres orders by instant. SQLite TEXT orders by bytes. Variable-width fractions do not sort by time once the suffix is
  `Z`: `...:12Z` sorts after `...:12.5Z` because `'Z'` (0x5A) > `'.'` (0x2E). With the `+00:00` suffix it happens to
  work (`'+'` 0x2B sorts below `'.'` and the digits). A fixed-width fraction removes the problem; 6 digits keeps every
  Supabase value exact, which the shadow comparison and the `(created_at, id)` keyset need (ties are broken by id
  only when the full microsecond value matches).
- Rows created by the Worker in step 5 get ms from `Date`; they need zero padding to the same width.
- SQLite puts NULL last in DESC (first in ASC); Postgres puts NULL first in DESC. Shadow reads of a feed with a NULL
  `created_at` row would differ in position (only `chemical_posts`, `runs`).
- Shadow comparison has to compare instants (parse both), not strings, because Supabase answers in its trimmed
  `+00:00` form.

## 9. Type and shape notes for the port and the shadow reads

- **JSON responses carry `env`.** `select *`, `to_jsonb(p.*)` and `return=representation` include `env`; post types
  declare it (`ComboPost.env`, `ThisOrThatPost.env`, `src/lib/combo-types.ts:21`, `src/lib/this-or-that.ts:23`), and the
  legacy Realtime handler checks it (`src/hooks/use-toybox-feed.ts:109`). A D1 adapter without the column must add
  `env = API_DATA_ENV` to keep the response identical, or the shadow comparator must ignore it.
- **Booleans**: `palette_swapped` (all posts, drafts; nullable, default false), `transfigure_posts.show_upgrade`
  (NOT NULL), `transfigure_posts.omit_energy_cost` (nullable, default false), `runs.win` (NOT NULL), `history_meta.win`,
  `palette_swapped` in the v2 feed (NULL for runs). D1 0/1 must be turned back into `true`/`false`/`null`.
- **Text arrays**: `transfigure_posts.card_top_keywords`, `card_bottom_keywords`, `upgraded_card_top_keywords`,
  `upgraded_card_bottom_keywords` (`text[] NOT NULL DEFAULT '{}'`, ≤ 5 / ≤ 3, card only). Display only.
- **jsonb**: returned as nested JSON, not strings. D1 JSON TEXT must be parsed before it is re-emitted.
- **Generated column**: `this_or_that_posts.vote_rate_bps` appears in every `select *` and feed `post` object, but no
  code reads it (`ThisOrThatPost.vote_rate_bps?` is typed, never used). Dead per CLEANUP_AUDIT 3.1; the comparator must
  ignore it if D1 drops it.
- **Numbers**: counters are `integer`; `recommend_score` is `bigint` but small, emitted as a JSON number.
- **Sizes vs D1**: the jsonb size CHECKs use `pg_column_size`, the **compressed** size, so a value that passes
  `<= 1048576` can be larger as text. D1's limit is about 2 MB per row/value, and the Worker accepts post bodies up to
  8 MB (drafts 4 MB). The heaviest documents: decisions `rows`/`placements` (1 MB each by CHECK), pagestorm `content`
  (TOAST 106 KB today for 14 rows), tournament `pool` (builtins hold every card or relic, about 1000 entries), runs `raw`
  (max 277 KB). Any D1 CHECK should use `length(CAST(x AS BLOB))` or `octet_length` on the TEXT.
- **UUID case**: PostgREST emits lowercase uuids and the Worker lowercases incoming ids. Postgres `uuid` ordering equals
  byte order of the lowercase hex text, so SQLite BINARY order on lowercase TEXT keeps the `id DESC` tie-break.
- **Id uniqueness across tables**: each post table has its own uuid PK. A common `posts(id)` (**→ decision 2**) needs a
  collision check across the 7 live tables at import (gen_random_uuid, so expected zero):
  `select id from (select id from public.combo_posts union all select id from public.transfigure_posts union all
  select id from public.this_or_that_posts union all select id from public.chemical_posts union all select id from
  public.decisions_decisions_posts union all select id from public.favorite_tournament_posts union all select id from
  public.pagestorm_posts) x group by id having count(*) > 1;`. `runs` ids are text and only unique per env
  (`runs_pkey (id, env)`), fine with one D1 database per env.
- **`user_id` FKs** point at `auth.users(id) ON DELETE CASCADE` (`runs.donor_user_id ON DELETE SET NULL`). D1 has no
  users table in this domain; D1 enforces FKs by default, so either the identity domain provides one or these FKs are
  not declared.
- **Builtin uniqueness**: `idx_favorite_tournament_posts_env_builtin_key` is `UNIQUE (env, preset_key) WHERE
  (preset_key ~~ 'builtin:%')` and the seed relies on it (`on conflict (env, preset_key) where (preset_key like
  'builtin:%')`). Postgres `~~` is case-sensitive; SQLite `LIKE` is not (ASCII), so a SQLite partial index predicate
  should use `GLOB 'builtin:*'` or `substr(preset_key, 1, 8) = 'builtin:'`.

## 10. Dead or unused (CLEANUP_AUDIT 3.1 plus what this inventory found)

From CLEANUP_AUDIT 3.1, in this domain (not to be ported):

- Table `defragment_posts` (never had a row) with its 4 policies (`defragment_posts_delete`, `_insert`, `_read`,
  `_update`), its indexes (`idx_defragment_posts_env_comment_created`, `_env_created`, `_env_recommend_created`), its
  guard trigger, the `defragment` branches of `apply_toybox_thread_engagement_delta` and its Realtime publication entry
  (the only table in `supabase_realtime`, `publications.csv`). The `/defragment/[id]` page and the Worker's
  `service=defragment` stay until step 7 (they answer "not found").
- Functions `get_this_or_that_vote_totals`, `get_defragment_feed` (v1).
- Column `this_or_that_posts.vote_rate_bps` and its indexes `idx_this_or_that_posts_env_vote_rate_high`,
  `_vote_rate_low` (0 scans).
- Write-only columns: `this_or_that_post_votes.created_surface`, `transfigure_posts.source_game_locale`,
  `favorite_tournament_posts.game_version` (and `runs.badges`, `highlight_card`, `highlight_relic`, `note_blocks` in the
  runs domain). All three toybox ones are **NOT NULL with a CHECK** in Supabase (`created_surface` in `index|detail`,
  `source_game_locale` exactly 3 chars, `game_version` 1..32 chars). If D1 does not store them, the step-5 mirror must
  still supply a value for each insert, or Supabase needs a default first.
- Indexes: the 7 `(like_count * 4) + (comment_count * 6)` expression indexes (chemical, combo, decisions, defragment,
  tournament, this or that, transfigure); `idx_defragment_bodies_source` (same columns as the PK); in runs
  `idx_runs_build`, `idx_runs_character`, `idx_runs_env`.
- Policies: `favorite_tournament_plays_read` (USING true, privacy issue), `defragment_posts_insert`.
- `favorite_tournament_plays`: "RPC만 쓰고 dev 관리 지표만 읽는다 ... D1에서 둘지 정한다". See section 11, item 4 before dropping it.

Also found here:

- View `this_or_that_post_like_counts` duplicates `this_or_that_posts.like_count` (same trigger-maintained value).
- `get_this_or_that_vote_summaries` duplicates `left_vote_count` / `right_vote_count`.
- `recommend_score` in both feeds is just `like_count`.
- `idx_this_or_that_posts_env_vote_total_high`, `_vote_total_low`, `_env_user_created`, `_env_recommend_created` have 0
  scans (the sorts are live, the table is small and seq-scanned).
- `defragment_bodies` for `history_course` cannot exist (uuid `source_id`, CHECK, `defragment_source_owned` has no
  branch), yet the federated History Course detail still requests one (`defragment-federated-post-view.tsx:70-82`
  → `fetchDefragmentBody('history_course', <run id>)`), which fails on the uuid cast and is swallowed.
- `defragment_bodies.created_at` is selected but no UI shows it.

## 11. Surprises and open points for the designers

1. **Sort names do not mean what they say.** `recommended` = `like_count` only; `vote_rate_high` / `vote_rate_low` = total
   ballots (posts with 0 votes excluded). The weighted recommend formula and the winner-share column are dead.
2. **This-or-that likes are separate.** They live in `this_or_that_post_likes`, not in `likes`, and the generic like
   trigger has no `this-or-that` branch; comments on this-or-that posts do use `comments`. A `threads` table keyed by
   thread key would cover comments for all services and likes for all but this or that, unless this-or-that likes move
   into the common likes path.
3. **Thread key, service id, nav id and table name are four spellings** of one service (section 1). `admin_story_service`
   and `commentThreadService` do not know `history-course:`.
4. **Tournament counters exist only inside the RPC.** `play_count` and every stats column are computed by
   `complete_favorite_tournament_play`, not by triggers. In step 5 a mirror that sends only "source rows" (plan 7.3) would
   insert a `favorite_tournament_plays` row into Supabase and leave Supabase's `play_count` and stats stale, unless the
   mirror calls the RPC or also sends the derived rows. Dropping `favorite_tournament_plays` from D1 (CLEANUP 3.1 open
   question) would remove the only source row a mirror or a recount could use.
5. **The re-rank writes every stats row of the tournament on every play** (4.3), about 900 row writes for the built-in
   298-relic bracket before index rows. That is the only write in the domain that can approach the 100k/day D1 budget.
6. **Write-only NOT NULL columns** (10) cannot simply be left out of D1 without a plan for the step-5 mirror.
7. **`defragment_bodies` is a 1:1 optional extension of a post** (`source_service`, `source_id` = the post), owned by the
   post's author, but it has no FK, so deleted posts leave orphans. It keeps its own `nickname` and `updated_at`.
8. **Guard triggers only fire for `anon`/`authenticated`.** Service-key writes (step 4) and the mirror bypass them.
9. **Post deletes leave likes and comments behind** (string keys); a `threads` row for a deleted post would survive
   unless the delete batch removes it.
10. **Builtin tournaments are posts without an author** (`user_id NULL`, CHECK `favorite_tournament_posts_user_id_builtin_check`),
    appear in the tournament feed and in Defragment, and the presets endpoint ships all of them with full pools, no limit
    (CLEANUP 3.3 #5). The list card needs only `pool.length` and the sorted pool images.
11. **Lists that ship whole documents to show a little**: the Pagestorm index and drafts list read 50 / 20 full `content`
    documents to compute one thumbnail (`normalizePagestormPostCard`, `src/lib/pagestorm.ts:167-188`); the tournament
    feed ships pools to show a size. These are the same kind of "summary column computed at write" as decision 4. The
    decisions list does render the whole tier board (`rows` + `placements`) on every card.
12. **Arrays, by use** (**→ decision 2**):
    - `combo_posts.resources` (jsonb array of `{type, id}`, CHECK `jsonb_array_length(resources) >= 2`) **is filtered by
      element** (game-element filter chips and popularity ranking, `src/lib/combo-types.ts:37-82`,
      `src/components/combo/combo-client.tsx:74-79`), today on the client over the loaded pages only.
    - `favorite_tournament_posts.pool` (`[{type, id}]`) **is joined by element** in the play RPC (candidate check) and
      otherwise displayed.
    - `favorite_tournament_plays.matches` is iterated once at write; `rank_history` is displayed (last 6 ranks);
      `decisions_decisions_posts.rows`, `placements`, `extra_ids`, `transfigure_posts.extra_variants`, the 4 keyword
      arrays and every `content` / `upgraded_content` block list are displayed only.
    - Service columns that are filtered server-side today: only `favorite_tournament_posts.preset_key` (`LIKE
      'builtin:%'`). `transfigure_posts (resource_type, resource_id)` has an index (343 scans) but no current query
      filters on it.
13. **The 50-id cap of the vote summary RPC** breaks the this-or-that list after the third page (CLEANUP 3.3 #6); the
    same numbers are already on the feed rows.
14. **The Defragment board title has two definitions** (RPC `btrim/left` vs client `/\s+/` collapse and UTF-16
    `slice`), and History Course titles are further replaced on the client from `cover_spec`
    (`historyCourseLockupTitle`, `src/components/defragment/defragment-client.tsx:109-125`).
15. **Privacy that the Worker must keep**: individual this-or-that votes are private (only the aggregate is public);
    drafts are private; tournament plays are public today but should not be (tasks/010 #67); this-or-that likes are
    public with user ids.
16. **Edit refreshes the author snapshot**, so "the nickname at the time of the post" is really "at the time of the last
    edit" for the 4 editable services.
