-- Every query the Worker (and the sync, the mirror and the local scripts) runs on the D1 schema.
-- Format, read by check.py: a header line
--   -- @ <id> | expect=<alias>:<plan token>,... | allow=<exceptions> | params=<JSON array>
-- followed by one statement. expect: a plan line for that alias must contain the token (an index
-- name, PRIMARY KEY, or an autoindex). allow: scan:<alias> (a full table scan is intended),
-- tempsort / tempgroup (a temp B-tree is intended), walk (an ordered index walk without LIMIT is
-- intended). Without allow, a plain SCAN, a temp B-tree for ORDER BY, or a full index walk without
-- LIMIT fails the check. Lists are bound as one JSON array and expanded with json_each(?n).
-- Write statements are executed inside a savepoint and rolled back.

-- =============================================================================== engagement (E)

-- @ E1 thread read, read.engagement?threads= (<= 64 keys) | expect=comments:comments_thread | allow= | params=["[\"sts2-codex:card:c4\",\"sts2-codex:card:c8\",\"c-c-c-combo:00000009-0000-4000-8000-000000000009\"]"]
SELECT id, story_id, user_id, nickname, content, content_blocks, created_at, avatar_id, avatar_kind, palette_id,
       palette_swapped, like_count
FROM comments WHERE story_id IN (SELECT value FROM json_each(?1))
ORDER BY story_id, created_at, id LIMIT 1000;

-- @ E2 my liked comments, me.engagement?threads= | expect=c:comments_thread,l:PK | allow= | params=["[\"sts2-codex:card:c4\",\"sts2-codex:card:c8\"]","00000001-1111-4111-8111-111111111111"]
SELECT c.story_id, c.id FROM comments c
WHERE c.story_id IN (SELECT value FROM json_each(?1))
  AND EXISTS (SELECT 1 FROM comment_likes l WHERE l.comment_id = c.id AND l.user_id = ?2);

-- @ E3 thread counts of listed keys (likes=, run cards, philosopher replies, <= 100 keys) | expect=threads:PK | allow= | params=["[\"sts2-codex:card:c4\",\"history-course:r00000000000000f\",\"colorful-philosophers:d0000000-0000-4000-8000-000000000001\"]"]
SELECT thread_key, like_count, comment_count FROM threads WHERE thread_key IN (SELECT value FROM json_each(?1));

-- @ E4 my likes among listed keys, me.engagement?likes= | expect=likes:PK | allow= | params=["[\"sts2-codex:card:c3\",\"sts2-codex:card:c6\"]","00000003-1111-4111-8111-111111111111"]
SELECT story_id FROM likes WHERE story_id IN (SELECT value FROM json_each(?1)) AND user_id = ?2;

-- @ E5 reaction totals, read.engagement?reactions= | expect=resource_reaction_counts:PK | allow= | params=["[\"bash\",\"c7\"]"]
SELECT resource_type, resource_id, game_version, buff_count, nerf_count, rework_count
FROM resource_reaction_counts WHERE resource_id IN (SELECT value FROM json_each(?1));

-- @ E6 my reactions, me.engagement?reactions= | expect=resource_reactions:PK | allow= | params=["[\"bash\",\"c7\"]","11111111-1111-4111-8111-111111111111"]
SELECT resource_type, resource_id, game_version, kind
FROM resource_reactions WHERE resource_id IN (SELECT value FROM json_each(?1)) AND user_id = ?2;

-- @ E7 engagement map, read.engagement-counts (the whole map is the answer) | expect= | allow=scan:threads | params=[]
SELECT thread_key, like_count, comment_count FROM threads WHERE like_count > 0 OR comment_count > 0;

-- @ E7s engagement map, step-3 scope=codex (PK range) | expect=threads:PK | allow= | params=[]
SELECT thread_key, like_count, comment_count FROM threads
WHERE thread_key >= 'sts2-codex:' AND thread_key < 'sts2-codex;' AND (like_count > 0 OR comment_count > 0);

-- @ E7t engagement map, step-3 scope=stories (community range + official ids) | expect=threads:PK | allow= | params=["[\"sts2-doormaker-removed\"]"]
SELECT thread_key, like_count, comment_count FROM threads
WHERE thread_key >= 'community:' AND thread_key < 'community;' AND (like_count > 0 OR comment_count > 0)
UNION ALL
SELECT thread_key, like_count, comment_count FROM threads
WHERE thread_key IN (SELECT value FROM json_each(?1)) AND (like_count > 0 OR comment_count > 0);

-- @ E8 courier (nav snapshot refresh): newest comments of the last 14 days | expect=comments:comments_recent | allow= | params=["2026-10-25T00:00:00.000000Z"]
SELECT id, story_id, content, created_at FROM comments
WHERE created_at >= ?1 ORDER BY created_at DESC, id DESC LIMIT 12;

-- @ E9 nav latest of one surface (x8: 7 Toy Box services + history_course) | expect=posts:posts_service_created | allow= | params=["history_course"]
SELECT created_at FROM posts WHERE service = ?1 ORDER BY created_at DESC, id DESC LIMIT 1;

-- @ E10 story feed, read.stories?limit= | expect=community_stories:community_stories_recent | allow= | params=[100]
SELECT id, user_id, static_story_id, nickname, avatar_id, avatar_kind, palette_id, palette_swapped, sentence, game,
       entity_type, entity_id, change_id, patch_line_id, source, tags, linked_entities, created_at
FROM community_stories ORDER BY created_at DESC, id DESC LIMIT ?1;

-- @ E10b story feed of one patch, read.stories?source= | expect=community_stories:community_stories_source | allow= | params=[200,"v0.103.0"]
SELECT id, user_id, static_story_id, nickname, avatar_id, avatar_kind, palette_id, palette_swapped, sentence, game,
       entity_type, entity_id, change_id, patch_line_id, source, tags, linked_entities, created_at
FROM community_stories WHERE source = ?2 ORDER BY created_at DESC, id DESC LIMIT ?1;

-- @ E11 one story's counts | expect=threads:PK | allow= | params=["e0000000-0000-4000-8000-000000000001"]
SELECT like_count, comment_count FROM threads WHERE thread_key = 'community:' || ?1;

-- @ E13a recount, comment side of a thread (comment insert/delete, sync apply) | expect=comments:comments_thread | allow= | params=["sts2-codex:card:c4",1762560000000]
INSERT INTO threads (thread_key, comment_count, last_comment_at, updated_at)
SELECT ?1, count(*), max(created_at), ?2 FROM comments WHERE story_id = ?1
ON CONFLICT (thread_key) DO UPDATE SET comment_count = excluded.comment_count,
  last_comment_at = excluded.last_comment_at, updated_at = excluded.updated_at
  WHERE threads.comment_count IS NOT excluded.comment_count OR threads.last_comment_at IS NOT excluded.last_comment_at
RETURNING comment_count;

-- @ E13b recount, like side of a thread (like put/delete, sync apply) | expect=likes:PK | allow= | params=["sts2-codex:card:c3",1762560000000]
INSERT INTO threads (thread_key, like_count, updated_at)
SELECT ?1, count(*), ?2 FROM likes WHERE story_id = ?1
ON CONFLICT (thread_key) DO UPDATE SET like_count = excluded.like_count, updated_at = excluded.updated_at
  WHERE threads.like_count IS NOT excluded.like_count
RETURNING like_count;

-- @ E13c owner copy, step 5+ (posts and runs alike; threadOwner(key) gave service and id; a this_or_that post's like_count is its this_or_that_post_likes rows, as Supabase's this_or_that_posts.like_count) | expect=posts:PK,threads:PK,this_or_that_post_likes:PK | allow= | params=["this-or-that:0000000b-0000-4000-8000-00000000000b","0000000b-0000-4000-8000-00000000000b","this_or_that"]
UPDATE posts SET
  like_count = CASE WHEN service = 'this_or_that'
    THEN (SELECT count(*) FROM this_or_that_post_likes WHERE service = 'this_or_that' AND post_id = ?2)
    ELSE coalesce((SELECT like_count FROM threads WHERE thread_key = ?1), 0) END,
  comment_count = coalesce((SELECT comment_count FROM threads WHERE thread_key = ?1), 0)
WHERE service = ?3 AND id = ?2;

-- @ E14 comment-like recount | expect=comment_likes:PK,comments:PK | allow= | params=["c0000003-0000-4000-8000-000000000003"]
UPDATE comments SET like_count = (SELECT count(*) FROM comment_likes WHERE comment_id = ?1) WHERE id = ?1
RETURNING like_count;

-- @ E15 reaction totals recount, step 5+ | expect=resource_reactions:PK | allow= | params=["bash","card","0.107.1"]
INSERT INTO resource_reaction_counts (resource_id, resource_type, game_version, buff_count, nerf_count, rework_count)
SELECT ?1, ?2, ?3, coalesce(sum(kind = 'buff'), 0), coalesce(sum(kind = 'nerf'), 0), coalesce(sum(kind = 'rework'), 0)
  FROM resource_reactions WHERE resource_id = ?1 AND resource_type = ?2 AND game_version = ?3
ON CONFLICT (resource_id, resource_type, game_version) DO UPDATE SET buff_count = excluded.buff_count,
  nerf_count = excluded.nerf_count, rework_count = excluded.rework_count
RETURNING buff_count, nerf_count, rework_count;

-- @ E16a comment insert (Worker builds id, user_id, created_at) | expect= | allow= | params=["c9999999-0000-4000-8000-000000000001","sts2-codex:card:bash","11111111-1111-4111-8111-111111111111","아이언클래드","좋은 카드","2026-11-08T01:02:03.456000Z"]
INSERT INTO comments (id, story_id, user_id, nickname, avatar_id, avatar_kind, palette_id, palette_swapped,
                      content, content_blocks, created_at)
VALUES (?1, ?2, ?3, ?4, NULL, NULL, NULL, 0, ?5, NULL, ?6) ON CONFLICT (id) DO NOTHING;

-- @ E16b comment delete by owner | expect=comments:PK | allow= | params=["c0000003-0000-4000-8000-000000000003","00000003-1111-4111-8111-111111111111"]
DELETE FROM comments WHERE id = ?1 AND user_id = ?2 RETURNING id, story_id;

-- @ E16c like put (generic thread-key route) | expect= | allow= | params=["sts2-codex:card:bash","22222222-2222-4222-8222-222222222222","2026-11-08T01:02:03.456000Z"]
INSERT INTO likes (story_id, user_id, created_at) VALUES (?1, ?2, ?3) ON CONFLICT DO NOTHING;

-- @ E16d like delete | expect=likes:PK | allow= | params=["sts2-codex:card:bash","11111111-1111-4111-8111-111111111111"]
DELETE FROM likes WHERE story_id = ?1 AND user_id = ?2;

-- @ TL1 this-or-that like put, step 5 (same batch: TL1, E13c, outbox row; the FK rejects a missing post -> not_found and the batch rolls back, as Postgres 23503 today; a repeat like is a no-op success) | expect= | allow= | params=["a0000000-0000-4000-8000-000000000004","22222222-2222-4222-8222-222222222222","2026-11-08T01:02:03.456000Z"]
INSERT INTO this_or_that_post_likes (service, post_id, user_id, created_at) VALUES ('this_or_that', ?1, ?2, ?3)
ON CONFLICT DO NOTHING;

-- @ TL2 this-or-that like delete by owner, step 5 (same batch: TL2, E13c, outbox delete row matching post_id + user_id) | expect=this_or_that_post_likes:PK | allow= | params=["a0000000-0000-4000-8000-000000000004","11111111-1111-4111-8111-111111111111"]
DELETE FROM this_or_that_post_likes WHERE service = 'this_or_that' AND post_id = ?1 AND user_id = ?2;

-- @ E16e comment-like put | expect= | allow= | params=["c0000003-0000-4000-8000-000000000003","22222222-2222-4222-8222-222222222222","2026-11-08T01:02:03.456000Z"]
INSERT INTO comment_likes (comment_id, user_id, created_at) VALUES (?1, ?2, ?3) ON CONFLICT DO NOTHING;

-- @ E16f comment-like delete | expect=comment_likes:PK | allow= | params=["c0000002-0000-4000-8000-000000000002","11111111-1111-4111-8111-111111111111"]
DELETE FROM comment_likes WHERE comment_id = ?1 AND user_id = ?2;

-- @ E16g reaction put (only kind changes on conflict) | expect= | allow= | params=["bash","card","0.107.1","11111111-1111-4111-8111-111111111111","nerf"]
INSERT INTO resource_reactions (resource_id, resource_type, game_version, user_id, kind) VALUES (?1, ?2, ?3, ?4, ?5)
ON CONFLICT (resource_id, resource_type, game_version, user_id) DO UPDATE SET kind = excluded.kind
  WHERE resource_reactions.kind IS NOT excluded.kind;

-- @ E16h reaction delete | expect=resource_reactions:PK | allow= | params=["bash","card","0.107.1","11111111-1111-4111-8111-111111111111"]
DELETE FROM resource_reactions WHERE resource_id = ?1 AND resource_type = ?2 AND game_version = ?3 AND user_id = ?4;

-- @ E16i story insert | expect= | allow= | params=["e9999999-0000-4000-8000-000000000001","11111111-1111-4111-8111-111111111111","아이언클래드","새 이야기 문장","v0.107.1","[]","2026-11-08T01:02:03.456000Z"]
INSERT INTO community_stories (id, user_id, nickname, sentence, game, source, tags, linked_entities, created_at)
VALUES (?1, ?2, ?3, ?4, 'sts2', ?5, '[]', ?6, ?7) ON CONFLICT (id) DO NOTHING;

-- @ E16j story delete by owner | expect=community_stories:PK | allow= | params=["e0000000-0000-4000-8000-000000000001","22222222-2222-4222-8222-222222222222"]
DELETE FROM community_stories WHERE id = ?1 AND user_id = ?2 RETURNING id;

-- =============================================================================== sync and bookkeeping (S)

-- @ S1 take the sync lease (conditional upsert, like api_cache) | expect= | allow= | params=["supabase_in",1762560060000,1762560000000]
INSERT INTO sync_state (name, lease_until, last_run_at) VALUES (?1, ?2, ?3)
ON CONFLICT (name) DO UPDATE SET lease_until = excluded.lease_until, last_run_at = excluded.last_run_at
  WHERE sync_state.lease_until < excluded.last_run_at
RETURNING low_watermark, high_seen, applied_above;

-- @ S2 outbox: next rows to send, in order (the head row's next_attempt_at gates the run) | expect=outbox:PK | allow= | params=[0]
SELECT seq, table_name, op, match_key, payload, attempts, next_attempt_at FROM outbox
WHERE seq > ?1 ORDER BY seq LIMIT 50;

-- @ S3 outbox: drop rows Supabase accepted | expect= | allow= | params=[2]
DELETE FROM outbox WHERE seq <= ?1;

-- @ S4 open rejects to retry at the start of each run (re-read by key, never replay the payload) | expect=sync_rejects:sync_rejects_open | allow= | params=[]
SELECT direction, ref, table_name, d1_table, row_key, op, reason, attempts FROM sync_rejects
WHERE resolved_at IS NULL ORDER BY last_at LIMIT 10;

-- @ S4c record a reject (one open reject per key; a later failure of the same key updates it) | expect= | allow= | params=["in",57,"combo_posts","posts","{\"service\":\"combo\",\"id\":\"00000009-0000-4000-8000-000000000009\"}","U","check","{}","CHECK constraint failed",1762560000000]
INSERT INTO sync_rejects (direction, ref, table_name, d1_table, row_key, op, reason, payload, error, first_at, last_at)
VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?10)
ON CONFLICT (direction, table_name, row_key) WHERE resolved_at IS NULL DO UPDATE SET
  op = excluded.op, reason = excluded.reason, payload = excluded.payload, error = excluded.error,
  last_at = excluded.last_at, attempts = sync_rejects.attempts + 1;

-- @ S4d resolve a reject after its re-read applied or found the row gone | expect=sync_rejects:PK | allow= | params=["in",41,1762560000000]
UPDATE sync_rejects SET resolved_at = ?3 WHERE direction = ?1 AND ref = ?2 AND resolved_at IS NULL;

-- @ S5 shadow counters | expect= | allow= | params=["2026-11-08","read.engagement",1,0,0]
INSERT INTO shadow_stats (day, route_id, compared, differed, skipped) VALUES (?1, ?2, ?3, ?4, ?5)
ON CONFLICT (day, route_id) DO UPDATE SET compared = compared + excluded.compared,
  differed = differed + excluded.differed, skipped = skipped + excluded.skipped;

-- @ S6 shadow difference sample | expect= | allow= | params=["2026-11-08","read.stories","h1",1762560000000,"{}"]
INSERT INTO shadow_diffs (day, route_id, diff_hash, first_at, sample) VALUES (?1, ?2, ?3, ?4, ?5)
ON CONFLICT (day, route_id, diff_hash) DO UPDATE SET hits = hits + 1;

-- @ S7 sync apply: upsert a copied post row by (service, id); the mapper's Supabase table gives the service | expect= | allow= | params=["00000009-0000-4000-8000-000000000009","combo","00000009-1111-4111-8111-111111111111","닉9","콤보","2026-01-03T11:33:00.071271Z",3,1]
INSERT INTO posts (service, id, user_id, nickname, avatar_id, avatar_kind, palette_id, palette_swapped, title, summary,
                   like_count, comment_count, created_at)
VALUES (?2, ?1, ?3, ?4, NULL, NULL, NULL, 0, NULL, ?5, ?7, ?8, ?6)
ON CONFLICT (service, id) DO UPDATE SET user_id = excluded.user_id, nickname = excluded.nickname,
  avatar_id = excluded.avatar_id, avatar_kind = excluded.avatar_kind, palette_id = excluded.palette_id,
  palette_swapped = excluded.palette_swapped, title = excluded.title, summary = excluded.summary,
  like_count = excluded.like_count, comment_count = excluded.comment_count, created_at = excluded.created_at;

-- @ S7b sync apply: service row (FK to posts (service, id); the sync batch defers FKs and puts the parent first) | expect= | allow= | params=["00000009-0000-4000-8000-000000000009","[]","콤보"]
INSERT INTO post_combo (service, post_id, content, content_text) VALUES ('combo', ?1, ?2, ?3)
ON CONFLICT (service, post_id) DO UPDATE SET content = excluded.content, content_text = excluded.content_text;

-- @ S8 sync apply: replace a combo's resources (delete) | expect=post_combo_resources:PK | allow= | params=["00000009-0000-4000-8000-000000000009"]
DELETE FROM post_combo_resources WHERE service = 'combo' AND post_id = ?1;

-- @ S9 sync apply: insert resources from the array, ord = array index | expect= | allow= | params=["00000009-0000-4000-8000-000000000009","[{\"type\":\"card\",\"id\":\"bash\"},{\"type\":\"relic\",\"id\":\"anchor\"},{\"type\":\"potion\",\"id\":\"fire\"}]"]
INSERT INTO post_combo_resources (service, post_id, ord, resource_type, resource_id)
SELECT 'combo', ?1, CAST(key AS INTEGER), json_extract(value, '$.type'), json_extract(value, '$.id') FROM json_each(?2)
WHERE true
ON CONFLICT (service, post_id, ord) DO UPDATE SET resource_type = excluded.resource_type, resource_id = excluded.resource_id;

-- @ S10 sync apply: delete a post by (service, id) (cascades the service row and children) | expect=posts:PK | allow= | params=["00000009-0000-4000-8000-000000000009","combo"]
DELETE FROM posts WHERE service = ?2 AND id = ?1;

-- @ S11 sync apply: commit the window, last statement of every applied batch (lease-owner guarded) | expect=sync_state:PK | allow= | params=[120,140,"[131,133]",1762560000000,2400,37,3,0,1762560060000]
UPDATE sync_state SET low_watermark = ?1, high_seen = ?2, applied_above = ?3, last_applied_at = ?4,
  last_lag_ms = ?5, last_statements = ?6, last_subrequests = ?7, last_raw_bytes = ?8
WHERE name = 'supabase_in' AND lease_until = ?9;

-- @ S12 sync apply: 조각모음 body, only under an existing post (0 rows -> re-read Supabase; still no post -> orphan, counted and closed) | expect=posts:PK | allow= | params=["00000009-0000-4000-8000-000000000009","combo","00000009-1111-4111-8111-111111111111","닉9","[]","조각 본문","2026-11-03T00:00:00.000000Z","2026-11-03T00:00:00.000000Z"]
INSERT INTO defragment_bodies (service, post_id, user_id, nickname, content, content_text, created_at, updated_at)
SELECT ?2, ?1, ?3, ?4, ?5, ?6, ?7, ?8 WHERE EXISTS (SELECT 1 FROM posts WHERE service = ?2 AND id = ?1)
ON CONFLICT (service, post_id) DO UPDATE SET user_id = excluded.user_id, nickname = excluded.nickname,
  content = excluded.content, content_text = excluded.content_text, created_at = excluded.created_at,
  updated_at = excluded.updated_at;

-- @ S13 run raws to fetch this invocation (at most 2, under a byte cap) | expect=sync_pending_raw:sync_pending_raw_queued | allow= | params=[]
SELECT post_id, attempts FROM sync_pending_raw ORDER BY queued_at, post_id LIMIT 2;

-- @ S13b queue a run raw (run I or heavy_changed U, same batch as the run rows) | expect= | allow= | params=["r00000000000000f",1762560000000]
INSERT INTO sync_pending_raw (post_id, queued_at) VALUES (?1, ?2)
ON CONFLICT (post_id) DO UPDATE SET queued_at = min(sync_pending_raw.queued_at, excluded.queued_at);

-- @ S13c store a fetched raw (bound from res.text(), no JSON.parse) and drop it from the queue | expect=post_history_course:PK | allow= | params=["r00000000000000f","{\"seed\":\"S\"}"]
INSERT INTO post_history_course_file (service, post_id, raw)
SELECT 'history_course', ?1, ?2 WHERE EXISTS (SELECT 1 FROM post_history_course WHERE service = 'history_course' AND post_id = ?1)
ON CONFLICT (service, post_id) DO UPDATE SET raw = excluded.raw;

-- @ S13d drop a queued raw (stored, or the run is gone) | expect=sync_pending_raw:PK | allow= | params=["r00000000000000f"]
DELETE FROM sync_pending_raw WHERE post_id = ?1;

-- @ S14 mirror, step 5: read a run at send time (raw from its table, never from the outbox; no row -> send only the delete) | expect=p:PK,h:PK,f:PK | allow= | params=["r00000000000000f"]
SELECT p.id, p.user_id AS donor_user_id, p.nickname AS donor_nickname, p.created_at, h.seed, h.build, h."character",
       h.ascension, h.win, h.start_time, h.run_time, h.acts_count, h.total_floors, h.cover_spec, h.summary_version,
       h.badges, h.characters, h.game_mode, h.game_elements, h.list_facts, f.raw
FROM posts p JOIN post_history_course h ON h.service = p.service AND h.post_id = p.id
JOIN post_history_course_file f ON f.service = p.service AND f.post_id = p.id
WHERE p.service = 'history_course' AND p.id = ?1;

-- @ S15 mirror, step 5: tournament candidate stats as state upserts after a play (B: Supabase never recomputes them) | expect=favorite_tournament_candidate_stats:PK | allow= | params=["a0000000-0000-4000-8000-000000000005"]
SELECT tournament_id, resource_type, resource_id, match_appearances, match_wins, championships, current_rank, rank_history
FROM favorite_tournament_candidate_stats WHERE service = 'favorite_tournament' AND tournament_id = ?1;

-- @ T1 service feed, sort=latest, first page (combo, with resources; step-1 row = id, created_at, counts, recommend_score, post) | expect=p:posts_service_created,s:PK,r:PK | allow= | params=[]
SELECT p.id, p.created_at, p.like_count, p.comment_count, p.like_count AS recommend_score, p.user_id, p.nickname,
       p.avatar_id, p.avatar_kind, p.palette_id, p.palette_swapped, s.content, s.content_text,
       (SELECT json_group_array(json_object('type', r.resource_type, 'id', r.resource_id))
          FROM post_combo_resources r WHERE r.service = p.service AND r.post_id = p.id) AS resources
FROM posts p CROSS JOIN post_combo s ON s.service = p.service AND s.post_id = p.id
WHERE p.service = 'combo' ORDER BY p.created_at DESC, p.id DESC LIMIT 20;

-- @ T1c service feed, sort=latest, next page (keyset) | expect=p:posts_service_created,s:PK | allow= | params=["2026-05-01T00:00:00.000000Z","ffffffff-0000-4000-8000-000000000000"]
SELECT p.id, p.created_at, p.like_count, p.comment_count, p.like_count AS recommend_score, p.user_id, p.nickname,
       p.avatar_id, p.avatar_kind, p.palette_id, p.palette_swapped, s.content, s.content_text
FROM posts p CROSS JOIN post_chemical_x s ON s.service = p.service AND s.post_id = p.id
WHERE p.service = 'chemical_x' AND (p.created_at, p.id) < (?1, ?2)
ORDER BY p.created_at DESC, p.id DESC LIMIT 20;

-- @ T2 service feed, sort=recommended (like_count), next page; every transfigure column of to_jsonb(p.*) | expect=p:posts_service_likes,s:PK | allow= | params=[4,"2026-05-01T00:00:00.000000Z","ffffffff-0000-4000-8000-000000000000"]
SELECT p.id, p.created_at, p.like_count, p.comment_count, p.like_count AS recommend_score, p.user_id, p.nickname,
       p.avatar_id, p.avatar_kind, p.palette_id, p.palette_swapped, p.title,
       s.resource_type, s.resource_id, s.source_text, s.content, s.content_text, s.transformed_name, s.transformed_cost,
       s.transformed_star_cost, s.upgraded_content, s.upgraded_content_text, s.transformed_upgrade_cost,
       s.transformed_upgrade_star_cost, s.show_upgrade, s.omit_energy_cost, s.card_top_keywords, s.card_bottom_keywords,
       s.upgraded_card_top_keywords, s.upgraded_card_bottom_keywords, s.transformed_card_type, s.transformed_card_rarity,
       s.transformed_card_color, s.token_color, s.token_wax, s.extra_variants
FROM posts p CROSS JOIN post_transfigure s ON s.service = p.service AND s.post_id = p.id
WHERE p.service = 'transfigure' AND (p.like_count, p.created_at, p.id) < (?1, ?2, ?3)
ORDER BY p.like_count DESC, p.created_at DESC, p.id DESC LIMIT 20;

-- @ T3 service feed, sort=comments, first page | expect=p:posts_service_comments,s:PK | allow= | params=[]
SELECT p.id, p.created_at, p.like_count, p.comment_count, p.like_count AS recommend_score, p.user_id, p.nickname,
       p.avatar_id, p.avatar_kind, p.palette_id, p.palette_swapped, p.title, s.note, s.preset_key, s.game_version,
       s."rows", s.placements, s.extra_ids
FROM posts p CROSS JOIN post_decisions_decisions s ON s.service = p.service AND s.post_id = p.id
WHERE p.service = 'decisions_decisions' ORDER BY p.comment_count DESC, p.created_at DESC, p.id DESC LIMIT 20;

-- @ T4 this_or_that vote_rate_high (= total ballots; 0-vote posts excluded): no sort index by design, reads the whole service | expect= | allow=tempsort,walk,scan:t,svcrange:t | params=[1000000000,"9999-12-31T00:00:00.000000Z","ffffffff-ffff-4fff-8fff-ffffffffffff"]
SELECT p.id, p.created_at, p.like_count, p.comment_count, p.like_count AS recommend_score, p.user_id, p.nickname,
       p.avatar_id, p.avatar_kind, p.palette_id, p.palette_swapped, t.left_type, t.left_id, t.right_type, t.right_id,
       t.reason, t.left_vote_count, t.right_vote_count
FROM posts p JOIN post_this_or_that t ON t.service = p.service AND t.post_id = p.id
WHERE p.service = 'this_or_that' AND t.left_vote_count + t.right_vote_count > 0
  AND (t.left_vote_count + t.right_vote_count, p.created_at, p.id) < (?1, ?2, ?3)
ORDER BY t.left_vote_count + t.right_vote_count DESC, p.created_at DESC, p.id DESC LIMIT 20;

-- @ T5 favorite_tournament sort=play_count: no sort index by design; pools are built after sort and LIMIT (<= 20 pool lookups) | expect=p:PK,f:PK,o:PK | allow=tempsort,walk,svcrange:p,svcrange:f | params=[]
SELECT q.*, (SELECT json_group_array(json_object('type', o.resource_type, 'id', o.resource_id))
               FROM post_favorite_tournament_pool o WHERE o.service = 'favorite_tournament' AND o.post_id = q.id) AS pool
FROM (SELECT p.id, p.created_at, p.like_count, p.comment_count, p.like_count AS recommend_score, p.user_id,
             p.nickname, p.avatar_id, p.avatar_kind, p.palette_id, p.palette_swapped, p.title, f.note, f.preset_key,
             f.play_count
      FROM posts p JOIN post_favorite_tournament f ON f.service = p.service AND f.post_id = p.id
      WHERE p.service = 'favorite_tournament' ORDER BY f.play_count DESC, p.created_at DESC, p.id DESC LIMIT 20) q
ORDER BY q.play_count DESC, q.created_at DESC, q.id DESC;

-- @ T6a 조각모음 board, sort=latest, all services incl. runs (history_meta from the runs join) | expect=p:posts_created,h:PK | allow= | params=["2026-09-01T00:00:00.000000Z","ffffffff-0000-4000-8000-000000000000"]
SELECT p.id, p.created_at, p.like_count, p.comment_count, p.like_count AS recommend_score, p.service,
       p.summary AS title, p.nickname, p.user_id, p.avatar_id, p.avatar_kind, p.palette_id, p.palette_swapped,
       h.cover_spec, h.win, h.ascension, h.total_floors
FROM posts p LEFT JOIN post_history_course h ON h.service = p.service AND h.post_id = p.id
WHERE (p.created_at, p.id) < (?1, ?2) ORDER BY p.created_at DESC, p.id DESC LIMIT 20;

-- @ T6b 조각모음 board, sort=recommended | expect=p:posts_likes,h:PK | allow= | params=[3,"2026-09-01T00:00:00.000000Z","ffffffff-0000-4000-8000-000000000000"]
SELECT p.id, p.created_at, p.like_count, p.comment_count, p.like_count AS recommend_score, p.service,
       p.summary AS title, p.nickname, p.user_id, p.avatar_id, p.avatar_kind, p.palette_id, p.palette_swapped,
       h.cover_spec, h.win, h.ascension, h.total_floors
FROM posts p LEFT JOIN post_history_course h ON h.service = p.service AND h.post_id = p.id
WHERE (p.like_count, p.created_at, p.id) < (?1, ?2, ?3) ORDER BY p.like_count DESC, p.created_at DESC, p.id DESC LIMIT 20;

-- @ T6c 조각모음 board, sort=comments, first page | expect=p:posts_comments,h:PK | allow= | params=[]
SELECT p.id, p.created_at, p.like_count, p.comment_count, p.like_count AS recommend_score, p.service,
       p.summary AS title, p.nickname, p.user_id, p.avatar_id, p.avatar_kind, p.palette_id, p.palette_swapped,
       h.cover_spec, h.win, h.ascension, h.total_floors
FROM posts p LEFT JOIN post_history_course h ON h.service = p.service AND h.post_id = p.id
ORDER BY p.comment_count DESC, p.created_at DESC, p.id DESC LIMIT 20;

-- @ T7 조각모음 board, filter history_course (defragment-runs, 11 columns), sort=comments | expect=p:posts_service_comments,h:PK | allow= | params=[3,"2026-09-01T00:00:00.000000Z","zzzz"]
SELECT p.id, p.created_at, p.like_count, p.comment_count, h.seed, p.user_id AS donor_user_id,
       p.nickname AS donor_nickname, h.cover_spec, h.win, h.ascension, h.total_floors
FROM posts p CROSS JOIN post_history_course h ON h.service = p.service AND h.post_id = p.id
WHERE p.service = 'history_course' AND (p.comment_count, p.created_at, p.id) < (?1, ?2, ?3)
ORDER BY p.comment_count DESC, p.created_at DESC, p.id DESC LIMIT 20;

-- @ T8 one post (detail, embeds, OG), transfigure | expect=p:PK,s:PK | allow= | params=["a0000000-0000-4000-8000-000000000003","transfigure"]
SELECT p.*, s.* FROM posts p CROSS JOIN post_transfigure s ON s.service = p.service AND s.post_id = p.id WHERE p.service = ?2 AND p.id = ?1;

-- @ T9 tournament presets (builtins with pools; select=* of favorite_tournament_posts) | expect=f:post_favorite_tournament_builtin,p:PK,o:PK | allow=tempsort,walk | params=[]
SELECT p.id, p.user_id, p.nickname, p.avatar_id, p.avatar_kind, p.palette_id, p.palette_swapped, p.title, f.note,
       f.preset_key, f.play_count, p.like_count, p.comment_count, p.created_at,
       (SELECT json_group_array(json_object('type', o.resource_type, 'id', o.resource_id))
          FROM post_favorite_tournament_pool o WHERE o.service = p.service AND o.post_id = p.id) AS pool
FROM post_favorite_tournament f CROSS JOIN posts p ON p.service = f.service AND p.id = f.post_id
WHERE substr(f.preset_key, 1, 8) = 'builtin:' ORDER BY p.created_at, p.id;

-- @ T10 tournament stats | expect=favorite_tournament_candidate_stats:PK | allow= | params=["a0000000-0000-4000-8000-000000000005"]
SELECT resource_type, resource_id, match_appearances, match_wins, championships, current_rank, rank_history
FROM favorite_tournament_candidate_stats WHERE service = 'favorite_tournament' AND tournament_id = ?1;

-- @ T11 서류 폭풍 index (50 latest; PAGESTORM_LIST_COLUMNS) | expect=p:posts_service_created,s:PK | allow= | params=[]
SELECT p.id, p.user_id, p.nickname, p.title, s.content, s.content_text, p.created_at, p.avatar_id, p.avatar_kind,
       p.palette_id, p.palette_swapped
FROM posts p CROSS JOIN post_pagestorm s ON s.service = p.service AND s.post_id = p.id
WHERE p.service = 'pagestorm' ORDER BY p.created_at DESC, p.id DESC LIMIT 50;

-- @ T12 my 서류 폭풍 drafts (PAGESTORM_LIST_COLUMNS: no updated_at in the answer) | expect=pagestorm_drafts:pagestorm_drafts_user_updated | allow= | params=["11111111-1111-4111-8111-111111111111"]
SELECT id, user_id, nickname, title, content, content_text, created_at, avatar_id, avatar_kind, palette_id,
       palette_swapped
FROM pagestorm_drafts WHERE user_id = ?1 ORDER BY updated_at DESC, id DESC LIMIT 20;

-- @ T13 one draft | expect=pagestorm_drafts:PK | allow= | params=["b0000000-0000-4000-8000-000000000001","11111111-1111-4111-8111-111111111111"]
SELECT * FROM pagestorm_drafts WHERE id = ?1 AND user_id = ?2;

-- @ T14 조각모음 body of a post (the body row carries source_service itself) | expect=defragment_bodies:PK | allow= | params=["00000009-0000-4000-8000-000000000009","combo"]
SELECT post_id AS source_id, service AS source_service, user_id, nickname, content, content_text, created_at, updated_at
FROM defragment_bodies WHERE service = ?2 AND post_id = ?1;

-- @ T15 this-or-that like counts (<= 100 ids; the view this_or_that_post_like_counts: rows per post, no zero rows) | expect=this_or_that_post_likes:PK | allow= | params=["[\"0000000b-0000-4000-8000-00000000000b\",\"00000013-0000-4000-8000-000000000013\"]"]
SELECT post_id, count(*) AS like_count FROM this_or_that_post_likes
WHERE service = 'this_or_that' AND post_id IN (SELECT value FROM json_each(?1)) GROUP BY post_id;

-- @ T16 my this-or-that likes | expect=this_or_that_post_likes:PK | allow= | params=["00000002-1111-4111-8111-111111111111","[\"0000000b-0000-4000-8000-00000000000b\",\"00000013-0000-4000-8000-000000000013\"]"]
SELECT post_id FROM this_or_that_post_likes
WHERE service = 'this_or_that' AND user_id = ?1 AND post_id IN (SELECT value FROM json_each(?2));

-- @ T17 vote summaries (<= 50 ids) | expect=post_this_or_that:PK | allow= | params=["[\"0000000b-0000-4000-8000-00000000000b\",\"00000013-0000-4000-8000-000000000013\"]"]
SELECT post_id, left_vote_count AS left_count, right_vote_count AS right_count,
       left_vote_count + right_vote_count AS total_count
FROM post_this_or_that WHERE service = 'this_or_that' AND post_id IN (SELECT value FROM json_each(?1)) AND left_vote_count + right_vote_count > 0;

-- @ T18 my votes (<= 100 ids) | expect=this_or_that_post_votes:PK | allow= | params=["00000002-1111-4111-8111-111111111111","[\"0000000b-0000-4000-8000-00000000000b\",\"00000013-0000-4000-8000-000000000013\"]"]
SELECT post_id, choice FROM this_or_that_post_votes
WHERE service = 'this_or_that' AND user_id = ?1 AND post_id IN (SELECT value FROM json_each(?2));

-- @ T21 ownership check (body write, edit and delete guards) | expect=posts:PK | allow= | params=["00000009-0000-4000-8000-000000000009","combo","00000009-1111-4111-8111-111111111111"]
SELECT 1 FROM posts WHERE service = ?2 AND id = ?1 AND user_id = ?3;

-- @ T22 play validation: the tournament's pool | expect=post_favorite_tournament_pool:PK | allow= | params=["a0000000-0000-4000-8000-000000000005"]
SELECT resource_type, resource_id FROM post_favorite_tournament_pool WHERE service = 'favorite_tournament' AND post_id = ?1;

-- @ TW1a post insert (combo, step 5): posts row | expect= | allow= | params=["a9999999-0000-4000-8000-000000000001","11111111-1111-4111-8111-111111111111","아이언클래드","새 콤보 본문","2026-11-08T01:02:03.456000Z"]
INSERT INTO posts (service, id, user_id, nickname, avatar_id, avatar_kind, palette_id, palette_swapped, title, summary,
                   like_count, comment_count, created_at)
VALUES ('combo', ?1, ?2, ?3, NULL, NULL, NULL, 0, NULL, substr(trim(?4), 1, 120), 0, 0, ?5);

-- @ TW2 post edit (combo): snapshot and summary, owner-guarded | expect=posts:PK | allow= | params=["00000009-0000-4000-8000-000000000009","00000009-1111-4111-8111-111111111111","새 닉","고친 본문"]
UPDATE posts SET nickname = ?3, summary = substr(trim(?4), 1, 120)
WHERE service = 'combo' AND id = ?1 AND user_id = ?2;

-- @ TW2b post edit (combo): service row, owner-guarded by EXISTS | expect=post_combo:PK,posts:PK | allow= | params=["00000009-0000-4000-8000-000000000009","00000009-1111-4111-8111-111111111111","[]","고친 본문"]
UPDATE post_combo SET content = ?3, content_text = ?4
WHERE service = 'combo' AND post_id = ?1
  AND EXISTS (SELECT 1 FROM posts WHERE service = 'combo' AND id = ?1 AND user_id = ?2);

-- @ TW3 post delete by owner (cascades the service row, children, votes, this-or-that likes, stats, plays, body) | expect=posts:PK | allow= | params=["00000009-0000-4000-8000-000000000009","combo","00000009-1111-4111-8111-111111111111"]
DELETE FROM posts WHERE service = ?2 AND id = ?1 AND user_id = ?3 RETURNING id;

-- @ TW4a vote put | expect= | allow= | params=["0000000b-0000-4000-8000-00000000000b","11111111-1111-4111-8111-111111111111","left","2026-11-08T01:02:03.456000Z"]
INSERT INTO this_or_that_post_votes (service, post_id, user_id, choice, created_at)
VALUES ('this_or_that', ?1, ?2, ?3, ?4);

-- @ TW4b vote counters recount (same batch, after the vote row changes) | expect=this_or_that_post_votes:PK,post_this_or_that:PK | allow= | params=["0000000b-0000-4000-8000-00000000000b"]
UPDATE post_this_or_that SET
  left_vote_count = (SELECT count(*) FROM this_or_that_post_votes WHERE service = 'this_or_that' AND post_id = ?1 AND choice = 'left'),
  right_vote_count = (SELECT count(*) FROM this_or_that_post_votes WHERE service = 'this_or_that' AND post_id = ?1 AND choice = 'right')
WHERE service = 'this_or_that' AND post_id = ?1 RETURNING left_vote_count, right_vote_count;

-- @ TW5a tournament play insert | expect= | allow= | params=["f9999999-0000-4000-8000-000000000001","a0000000-0000-4000-8000-000000000005","11111111-1111-4111-8111-111111111111","[{\"left_type\":\"relic\",\"left_id\":\"anchor\",\"right_type\":\"relic\",\"right_id\":\"burning_blood\",\"winner\":\"left\"}]","2026-11-08T01:02:03.456000Z"]
INSERT INTO favorite_tournament_plays (id, service, tournament_id, user_id, starting_size, champion_type, champion_id, matches, created_at)
VALUES (?1, 'favorite_tournament', ?2, ?3, 2, 'relic', 'anchor', ?4, ?5);

-- @ TW5b play_count recount | expect=favorite_tournament_plays:favorite_tournament_plays_tournament,post_favorite_tournament:PK | allow= | params=["a0000000-0000-4000-8000-000000000005"]
UPDATE post_favorite_tournament SET play_count = (SELECT count(*) FROM favorite_tournament_plays
                                    WHERE service = 'favorite_tournament' AND tournament_id = ?1)
WHERE service = 'favorite_tournament' AND post_id = ?1 RETURNING play_count;

-- @ TW5c candidate stats upsert from per-candidate deltas (aggregated in TS) | expect= | allow= | params=["a0000000-0000-4000-8000-000000000005","[{\"type\":\"relic\",\"id\":\"anchor\",\"a\":1,\"w\":1,\"c\":1},{\"type\":\"relic\",\"id\":\"burning_blood\",\"a\":1,\"w\":0,\"c\":0}]"]
INSERT INTO favorite_tournament_candidate_stats (service, tournament_id, resource_type, resource_id, match_appearances, match_wins, championships)
SELECT 'favorite_tournament', ?1, json_extract(value, '$.type'), json_extract(value, '$.id'), json_extract(value, '$.a'),
       json_extract(value, '$.w'), json_extract(value, '$.c') FROM json_each(?2) WHERE true
ON CONFLICT (service, tournament_id, resource_type, resource_id) DO UPDATE SET
  match_appearances = match_appearances + excluded.match_appearances,
  match_wins = match_wins + excluded.match_wins, championships = championships + excluded.championships;

-- @ TW5d re-rank (only rows whose rank changed are written; ?2 is Postgres timestamp::text, UTC) | expect=r:PK | allow=tempsort | params=["a0000000-0000-4000-8000-000000000005","2026-11-08 01:02:03.456"]
UPDATE favorite_tournament_candidate_stats AS s
SET current_rank = r.rnk,
    rank_history = json_insert(s.rank_history, '$[#]', json_object('at', ?2, 'rank', r.rnk))
FROM (SELECT resource_type, resource_id, row_number() OVER (ORDER BY championships DESC,
        CASE WHEN match_appearances > 0 THEN CAST(match_wins AS REAL) / match_appearances ELSE 0 END DESC,
        match_appearances DESC, resource_type, resource_id) AS rnk
      FROM favorite_tournament_candidate_stats r WHERE r.service = 'favorite_tournament' AND r.tournament_id = ?1) AS r
WHERE s.service = 'favorite_tournament' AND s.tournament_id = ?1 AND s.resource_type = r.resource_type AND s.resource_id = r.resource_id
  AND s.current_rank IS NOT r.rnk;

-- @ TW6 조각모음 body upsert, owner of the post only | expect=posts:PK | allow= | params=["a0000000-0000-4000-8000-000000000001","combo","11111111-1111-4111-8111-111111111111","아이언클래드","[]","조각 본문","2026-11-08T01:02:03.456000Z"]
INSERT INTO defragment_bodies (service, post_id, user_id, nickname, content, content_text, created_at, updated_at)
SELECT ?2, ?1, ?3, ?4, ?5, ?6, ?7, ?7
WHERE EXISTS (SELECT 1 FROM posts WHERE service = ?2 AND id = ?1 AND user_id = ?3)
ON CONFLICT (service, post_id) DO UPDATE SET nickname = excluded.nickname, content = excluded.content,
  content_text = excluded.content_text, updated_at = excluded.updated_at
  WHERE defragment_bodies.user_id = excluded.user_id;

-- @ TW7 draft delete by owner | expect=pagestorm_drafts:PK | allow= | params=["b0000000-0000-4000-8000-000000000001","11111111-1111-4111-8111-111111111111"]
DELETE FROM pagestorm_drafts WHERE id = ?1 AND user_id = ?2 RETURNING id;

-- =============================================================================== 역사 강의서 runs (R)

-- @ R1 run list (100 latest) with summary columns, game elements (popular chips and search from page load, as today) and row-true counts | expect=p:posts_service_created,h:PK,t:PK | allow= | params=[]
SELECT p.id, h.seed, h.build, h."character", h.characters, h.ascension, h.win, h.start_time, h.run_time,
       h.acts_count, h.total_floors, h.badges, h.cover_spec, h.game_mode, h.game_elements, h.list_facts,
       h.summary_version,
       p.user_id AS donor_user_id, p.created_at, coalesce(t.like_count, 0) AS like_count,
       coalesce(t.comment_count, 0) AS comment_count
FROM posts p CROSS JOIN post_history_course h ON h.service = p.service AND h.post_id = p.id
LEFT JOIN threads t ON t.thread_key = 'history-course:' || p.id
WHERE p.service = 'history_course' ORDER BY p.created_at DESC, p.id DESC LIMIT 100;

-- @ R2 combo / 조각모음 run picker (30 by start time; RUN_SUMMARY_COLUMNS with summary columns in place of raw) | expect=h:post_history_course_start_time,p:PK | allow= | params=[]
SELECT h.post_id AS id, h.seed, h.build, h."character", h.ascension, h.win, h.start_time, h.run_time, h.acts_count,
       h.total_floors, h.cover_spec, p.user_id AS donor_user_id, p.created_at, h.characters, h.badges, h.game_mode,
       h.game_elements, h.list_facts, h.summary_version
FROM post_history_course h CROSS JOIN posts p ON p.service = h.service AND p.id = h.post_id
ORDER BY h.start_time DESC, h.post_id DESC LIMIT 30;

-- @ R1j R1 as one JSON text per row, keys in the answer's order (step 3 serves it without parsing the JSON columns) | expect=p:posts_service_created,h:PK,t:PK | allow= | params=[]
SELECT
  '{"id":' || json_quote(p.id) || ',"seed":' || json_quote(h.seed) || ',"build":' || json_quote(h.build)
  || ',"character":' || json_quote(h."character") || ',"ascension":' || h.ascension
  || ',"win":' || CASE h.win WHEN 1 THEN 'true' ELSE 'false' END
  || ',"start_time":' || coalesce(h.start_time, 'null') || ',"run_time":' || coalesce(h.run_time, 'null')
  || ',"acts_count":' || h.acts_count || ',"total_floors":' || h.total_floors
  || ',"cover_spec":' || coalesce(h.cover_spec, 'null') || ',"donor_user_id":' || json_quote(p.user_id)
  || ',"created_at":' || json_quote(rtrim(rtrim(substr(p.created_at, 1, 26), '0'), '.') || '+00:00')
  || ',"characters":' || coalesce(h.characters, 'null') || ',"badges":' || h.badges
  || ',"game_mode":' || json_quote(h.game_mode) || ',"game_elements":' || coalesce(h.game_elements, 'null')
  || ',"list_facts":' || coalesce(h.list_facts, 'null') || ',"summary_version":' || h.summary_version
  || ',"like_count":' || coalesce(t.like_count, 0) || ',"comment_count":' || coalesce(t.comment_count, 0) || '}' AS row
FROM posts p CROSS JOIN post_history_course h ON h.service = p.service AND h.post_id = p.id
LEFT JOIN threads t ON t.thread_key = 'history-course:' || p.id
WHERE p.service = 'history_course' ORDER BY p.created_at DESC, p.id DESC LIMIT 100;

-- @ R2j R2 as one JSON text per row, keys in the answer's order (step 3 serves it without parsing the JSON columns) | expect=h:post_history_course_start_time,p:PK | allow= | params=[]
SELECT
  '{"id":' || json_quote(h.post_id) || ',"seed":' || json_quote(h.seed) || ',"build":' || json_quote(h.build)
  || ',"character":' || json_quote(h."character") || ',"ascension":' || h.ascension
  || ',"win":' || CASE h.win WHEN 1 THEN 'true' ELSE 'false' END
  || ',"start_time":' || coalesce(h.start_time, 'null') || ',"run_time":' || coalesce(h.run_time, 'null')
  || ',"acts_count":' || h.acts_count || ',"total_floors":' || h.total_floors
  || ',"cover_spec":' || coalesce(h.cover_spec, 'null') || ',"donor_user_id":' || json_quote(p.user_id)
  || ',"created_at":' || json_quote(rtrim(rtrim(substr(p.created_at, 1, 26), '0'), '.') || '+00:00')
  || ',"characters":' || coalesce(h.characters, 'null') || ',"badges":' || h.badges
  || ',"game_mode":' || json_quote(h.game_mode) || ',"game_elements":' || coalesce(h.game_elements, 'null')
  || ',"list_facts":' || coalesce(h.list_facts, 'null') || ',"summary_version":' || h.summary_version || '}' AS row
FROM post_history_course h CROSS JOIN posts p ON p.service = h.service AND p.id = h.post_id
ORDER BY h.start_time DESC, h.post_id DESC LIMIT 30;

-- @ R3 run detail meta (RUN_DETAIL_COLUMNS without raw; the raw is R3r, returned as the response body) | expect=p:PK,h:PK | allow= | params=["r00000000000000f"]
SELECT p.id, h.seed, h.build, h."character", h.ascension, h.win, h.start_time, h.run_time, h.acts_count,
       h.cover_spec, p.created_at
FROM posts p JOIN post_history_course h ON h.service = p.service AND h.post_id = p.id
WHERE p.service = 'history_course' AND p.id = ?1;

-- @ R4 cover view: combo thumbs re-pick a non-manual cover from list_facts and the phrase columns as they do from the raw today (summary_version 0: from R3r); the editor's raw is R3r | expect=post_history_course:PK | allow= | params=["r00000000000000f"]
SELECT post_id AS id, cover_spec, list_facts, win, ascension, total_floors, summary_version
FROM post_history_course WHERE service = 'history_course' AND post_id = ?1;

-- @ R3r run raw for detail and cover editor (the stored text is the body, never wrapped in JSON) | expect=post_history_course_file:PK | allow= | params=["r00000000000000f"]
SELECT raw FROM post_history_course_file WHERE service = 'history_course' AND post_id = ?1;

-- @ R5 run meta / OG / "is it shared" | expect=post_history_course:PK | allow= | params=["r00000000000000f"]
SELECT post_id AS id, "character", cover_spec FROM post_history_course WHERE service = 'history_course' AND post_id = ?1;

-- @ R6 run engagement for listed runs (<= 100) | expect=threads:PK | allow= | params=["[\"r00000000000000f\",\"r000000000000017\"]"]
SELECT thread_key, like_count, comment_count FROM threads
WHERE thread_key IN (SELECT 'history-course:' || value FROM json_each(?1));

-- @ R7 my run ids | expect=posts:posts_user | allow= | params=["00000007-1111-4111-8111-111111111111"]
SELECT id FROM posts WHERE user_id = ?1 AND service = 'history_course';

-- @ R11 cover save by owner | expect=post_history_course:PK,posts:PK | allow= | params=["r00000000000000f","0000000f-1111-4111-8111-111111111111","{\"auto\":false}"]
UPDATE post_history_course SET cover_spec = ?3
WHERE service = 'history_course' AND post_id = ?1
  AND EXISTS (SELECT 1 FROM posts WHERE service = 'history_course' AND id = ?1 AND user_id = ?2)
RETURNING post_id;

-- @ R12 donor nickname sync (keys from the covering posts_user seek: without statistics an UPDATE prefers the PK's service prefix) | expect=posts:posts_user,posts:PK | allow= | params=["0000000f-1111-4111-8111-111111111111","새 닉"]
UPDATE posts SET nickname = ?2
WHERE (service, id) IN (SELECT service, id FROM posts WHERE user_id = ?1 AND service = 'history_course')
  AND nickname <> ?2;

-- @ RF1 summary fill: runs whose summary is older than this extractor (fill job in GitHub Actions; ~600 rows, reads the service by design) | expect= | allow=svcrange:post_history_course,scan:post_history_course,walk | params=[1]
SELECT post_id FROM post_history_course WHERE service = 'history_course' AND summary_version < ?1 ORDER BY post_id LIMIT 50;

-- @ RF2 summary fill: write one run's summary and badges (the raw came from R3r; never touches cover_spec) | expect=post_history_course:PK | allow= | params=["r00000000000000f","[\"CHARACTER.SILENT\"]","standard","[]","{}","[]",1]
UPDATE post_history_course
SET characters = ?2, game_mode = ?3, game_elements = ?4, list_facts = ?5, badges = ?6, summary_version = ?7
WHERE service = 'history_course' AND post_id = ?1 AND summary_version < ?7;

-- @ R13 unshare by owner (cascades the run row and the file; threads stay) | expect=posts:PK | allow= | params=["r00000000000000f","0000000f-1111-4111-8111-111111111111"]
DELETE FROM posts WHERE service = 'history_course' AND id = ?1 AND user_id = ?2 RETURNING id;

-- @ R14a share (step 5: one run per request, N = 1): posts row, counts seeded from threads | expect=t:PK | allow= | params=["11111111-1111-4111-8111-111111111111","아이언클래드","2026-11-08T01:02:03.456000Z","[{\"id\":\"z000000000000001\",\"seed\":\"SEEDZ\"}]"]
INSERT INTO posts (service, id, user_id, nickname, created_at, title, summary, like_count, comment_count)
SELECT 'history_course', json_extract(e.value, '$.id'), ?1, ?2, ?3, NULL,
       substr(trim(coalesce(nullif(json_extract(e.value, '$.seed'), ''), json_extract(e.value, '$.id'))), 1, 120),
       coalesce(t.like_count, 0), coalesce(t.comment_count, 0)
FROM json_each(?4) e LEFT JOIN threads t ON t.thread_key = 'history-course:' || json_extract(e.value, '$.id')
WHERE true ON CONFLICT (service, id) DO NOTHING RETURNING id;

-- @ R14b share: run summary row, only under this donor's history_course posts row | expect=p:PK | allow= | params=["[{\"id\":\"r00000000000000f\",\"seed\":\"dup\",\"build\":\"v\",\"character\":\"CHARACTER.SILENT\",\"ascension\":1,\"win\":0,\"acts_count\":3}]","0000000f-1111-4111-8111-111111111111"]
INSERT INTO post_history_course (service, post_id, seed, build, "character", ascension, win, start_time, run_time, acts_count,
  total_floors, cover_spec, summary_version, badges, characters, game_mode, game_elements, list_facts)
SELECT p.service, p.id, json_extract(e.value, '$.seed'), json_extract(e.value, '$.build'),
       json_extract(e.value, '$.character'), json_extract(e.value, '$.ascension'), json_extract(e.value, '$.win'),
       json_extract(e.value, '$.start_time'), json_extract(e.value, '$.run_time'), json_extract(e.value, '$.acts_count'),
       coalesce(json_extract(e.value, '$.total_floors'), 0), json_extract(e.value, '$.cover_spec'),
       coalesce(json_extract(e.value, '$.summary_version'), 0), coalesce(json_extract(e.value, '$.badges'), '[]'),
       json_extract(e.value, '$.characters'), json_extract(e.value, '$.game_mode'), json_extract(e.value, '$.game_elements'),
       json_extract(e.value, '$.list_facts')
FROM json_each(?1) e CROSS JOIN posts p
  ON p.service = 'history_course' AND p.id = json_extract(e.value, '$.id') AND p.user_id = ?2
WHERE true ON CONFLICT (service, post_id) DO NOTHING;

-- @ R14c share: the raw file (the request body text, bound without parsing), same owner guard | expect=posts:PK | allow= | params=["r00000000000000f","{}","0000000f-1111-4111-8111-111111111111"]
INSERT INTO post_history_course_file (service, post_id, raw)
SELECT 'history_course', ?1, ?2
WHERE EXISTS (SELECT 1 FROM posts WHERE service = 'history_course' AND id = ?1 AND user_id = ?3)
ON CONFLICT (service, post_id) DO NOTHING;

-- @ R14d share: outbox row without the raw (the mirror reads it with S14; a repeat share is an idempotent no-op) | expect=posts:PK | allow= | params=["r00000000000000f","0000000f-1111-4111-8111-111111111111",1762560000000]
INSERT INTO outbox (table_name, op, match_key, payload, created_at)
SELECT 'runs', 'upsert', json_object('id', ?1), json_object('read', 'post_history_course'), ?3
WHERE EXISTS (SELECT 1 FROM posts WHERE service = 'history_course' AND id = ?1 AND user_id = ?2);

-- =============================================================================== profile (P)

-- @ P1 nickname pools (the whole 10-row table is the answer) | expect= | allow=scan:profile_character_nickname_pools | params=[]
SELECT character_id, locale, nicknames FROM profile_character_nickname_pools ORDER BY character_id, locale;

-- @ P2 my activity (get_my_profile_activity): union of my rows, offset paging; a this_or_that post's like count is its this_or_that_post_likes rows, as the RPC counts them | expect=s:community_stories_user,p:posts_user,c:comments_user,t:PK,l:PK | allow=tempsort,scan:own | params=["00000001-1111-4111-8111-111111111111","all","latest",20,0]
WITH own AS (
  SELECT s.id AS activity_id, 'stories' AS category, s.sentence AS content, NULL AS content_blocks,
         'community:' || s.id AS target_key, s.created_at, coalesce(t.like_count, 0) AS like_count
  FROM community_stories s LEFT JOIN threads t ON t.thread_key = 'community:' || s.id
  WHERE s.user_id = ?1
  UNION ALL
  SELECT p.id, p.service, coalesce(x.content_text, o.reason, b.content_text, h.seed), coalesce(x.content, b.content),
         p.id, p.created_at,
         CASE WHEN p.service = 'this_or_that' THEN (SELECT count(*) FROM this_or_that_post_likes l
                                                    WHERE l.service = p.service AND l.post_id = p.id) ELSE 0 END
  FROM posts p
  LEFT JOIN post_chemical_x x ON x.service = p.service AND x.post_id = p.id
  LEFT JOIN post_this_or_that o ON o.service = p.service AND o.post_id = p.id
  LEFT JOIN post_combo b ON b.service = p.service AND b.post_id = p.id
  LEFT JOIN post_history_course h ON h.service = p.service AND h.post_id = p.id
  WHERE p.user_id = ?1 AND p.service IN ('chemical_x', 'this_or_that', 'combo', 'history_course')
  UNION ALL
  SELECT c.id, 'comments', c.content, c.content_blocks, c.story_id, c.created_at, c.like_count
  FROM comments c WHERE c.user_id = ?1
)
SELECT *, count(*) OVER () AS total_count FROM own WHERE ?2 = 'all' OR category = ?2
ORDER BY CASE WHEN ?3 = 'likes' THEN like_count END DESC, created_at DESC, activity_id DESC
LIMIT min(max(?4, 1), 50) OFFSET max(?5, 0);

-- @ P3 my activity stats (get_my_profile_activity_stats) | expect=s:community_stories_user,p:posts_user,c:comments_user,l:PK | allow=tempgroup,scan:own | params=["00000001-1111-4111-8111-111111111111"]
WITH own AS (
  SELECT 'stories' AS category, coalesce(t.like_count, 0) AS like_count
  FROM community_stories s LEFT JOIN threads t ON t.thread_key = 'community:' || s.id WHERE s.user_id = ?1
  UNION ALL
  SELECT p.service, CASE WHEN p.service = 'this_or_that' THEN (SELECT count(*) FROM this_or_that_post_likes l
                                                              WHERE l.service = p.service AND l.post_id = p.id) ELSE 0 END
  FROM posts p
  WHERE p.user_id = ?1 AND p.service IN ('chemical_x', 'this_or_that', 'combo', 'history_course')
  UNION ALL
  SELECT 'comments', c.like_count FROM comments c WHERE c.user_id = ?1
)
SELECT category, count(*) AS post_count, sum(like_count) AS like_count FROM own GROUP BY category;

-- @ C1 inquiry insert with the 3-per-hour limit (0 changes -> 429) | expect=contact_inquiries:contact_inquiries_user_created | allow= | params=["91111111-0000-4000-8000-000000000001","11111111-1111-4111-8111-111111111111","bug","버그가 있습니다. 확인 부탁.","/","ko","kor","2026-11-08T01:02:03.456000Z","2026-11-08T00:02:03.456000Z"]
INSERT INTO contact_inquiries (id, user_id, category, message, reply_email, page_path, service_locale, game_locale,
                               status, created_at)
SELECT ?1, ?2, ?3, ?4, NULL, ?5, ?6, ?7, 'new', ?8
WHERE (SELECT count(*) FROM contact_inquiries WHERE user_id = ?2 AND created_at > ?9) < 3;

-- @ C2 mailbox dot | expect=contact_inquiries:contact_inquiries_user_created | allow= | params=["11111111-1111-4111-8111-111111111111"]
SELECT id FROM contact_inquiries WHERE user_id = ?1 AND admin_response IS NOT NULL AND reply_seen_at IS NULL LIMIT 1;

-- @ C3 my inquiry history | expect=contact_inquiries:contact_inquiries_user_created | allow= | params=["11111111-1111-4111-8111-111111111111"]
SELECT id, category, message, status, admin_response, reply_seen_at, created_at FROM contact_inquiries
WHERE user_id = ?1 ORDER BY created_at DESC, id DESC LIMIT 50;

-- @ C4 mark replies seen | expect=contact_inquiries:contact_inquiries_user_created | allow= | params=["11111111-1111-4111-8111-111111111111","2026-11-08T01:02:03.456000Z"]
UPDATE contact_inquiries SET reply_seen_at = ?2
WHERE user_id = ?1 AND admin_response IS NOT NULL AND reply_seen_at IS NULL;

-- @ C5a admin inbox (local script; full scan of a small table is fine) | expect= | allow=scan:contact_inquiries,tempsort | params=[]
SELECT id, user_id, category, message, reply_email, page_path, status, created_at, admin_response, responded_at
FROM contact_inquiries ORDER BY created_at DESC LIMIT 100;

-- @ C5b admin reply (resets reply_seen_at when the reply changes) | expect=contact_inquiries:PK | allow= | params=["90000000-0000-4000-8000-000000000002","답장입니다.","2026-11-08T01:02:03.456000Z","done"]
UPDATE contact_inquiries SET admin_response = ?2, responded_at = ?3, status = ?4,
  reply_seen_at = CASE WHEN admin_response IS ?2 AND responded_at IS ?3 THEN reply_seen_at END
WHERE id = ?1;

-- =============================================================================== 짜증나는 퍼즐상자 (X)

-- @ X1a submit: run row with rate rules (burst 3 s, 500 a day) | expect=puzzlebox_runs:puzzlebox_runs_user_created,puzzlebox_best:PK | allow= | params=[1099511627777,"connections","1","00000001-1111-4111-8111-111111111111",4,1,"{\"guesses\":[]}","2026-11-08T01:02:03.456000Z","2026-11-08T01:02:00.456000Z","2026-11-07T01:02:03.456000Z"]
INSERT INTO puzzlebox_runs (id, game, board, user_id, attempt, score, perfect, run, created_at)
SELECT ?1, ?2, ?3, ?4,
       coalesce((SELECT attempts FROM puzzlebox_best WHERE game = ?2 AND board = ?3 AND user_id = ?4), 0) + 1,
       ?5, ?6, ?7, ?8
WHERE NOT EXISTS (SELECT 1 FROM puzzlebox_runs WHERE user_id = ?4 AND created_at > ?9 AND game = ?2 AND board = ?3)
  AND (SELECT count(*) FROM puzzlebox_runs WHERE user_id = ?4 AND created_at > ?10) < 500;

-- @ X1b submit: latest player token | expect=puzzlebox_runs:PK | allow= | params=["00000001-1111-4111-8111-111111111111","닉1","IRONCLAD","character","red",1,"2026-11-08T01:02:03.456000Z",101]
INSERT INTO puzzlebox_players (user_id, nickname, avatar_id, avatar_kind, palette_id, palette_swapped, updated_at)
SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7 WHERE EXISTS (SELECT 1 FROM puzzlebox_runs WHERE id = ?8)
ON CONFLICT (user_id) DO UPDATE SET nickname = excluded.nickname, avatar_id = excluded.avatar_id,
  avatar_kind = excluded.avatar_kind, palette_id = excluded.palette_id,
  palette_swapped = excluded.palette_swapped, updated_at = excluded.updated_at;

-- @ X1c submit: best (replaced only by a higher score; attempts always advance) | expect=puzzlebox_runs:PK | allow= | params=[101]
INSERT INTO puzzlebox_best (game, board, user_id, score, perfect, run_id, achieved_at, attempts)
SELECT game, board, user_id, score, perfect, id, created_at, attempt FROM puzzlebox_runs WHERE id = ?1
ON CONFLICT (game, board, user_id) DO UPDATE SET
  attempts = excluded.attempts,
  perfect = CASE WHEN excluded.score > score THEN excluded.perfect ELSE perfect END,
  run_id = CASE WHEN excluded.score > score THEN excluded.run_id ELSE run_id END,
  achieved_at = CASE WHEN excluded.score > score THEN excluded.achieved_at ELSE achieved_at END,
  score = CASE WHEN excluded.score > score THEN excluded.score ELSE score END;

-- @ X1d submit: board stats, first finished run of the player only | expect=puzzlebox_board_stats:PK,puzzlebox_runs:PK | allow= | params=["connections","2",101,1,0,3,1,0,0,30]
UPDATE puzzlebox_board_stats SET players = players + 1, cleared = cleared + ?4, perfect = perfect + ?5,
  score_sum = score_sum + ?6, mistakes_sum = mistakes_sum + ?7, rocks_sum = rocks_sum + ?8,
  purple_first = purple_first + ?9, speed_sum = speed_sum + ?10
WHERE game = ?1 AND board = ?2 AND EXISTS (SELECT 1 FROM puzzlebox_runs WHERE id = ?3 AND attempt = 1);

-- @ X1e submit: answer (rank and players over non-hidden players) | expect=r:PK,b:PK,o:PK,p:PK | allow= | params=["connections","2",101]
SELECT r.attempt, b.score AS best, b.perfect AS best_perfect, (b.run_id = r.id) AS improved,
  1 + (SELECT count(*) FROM puzzlebox_best o JOIN puzzlebox_players p ON p.user_id = o.user_id AND p.hidden = 0
       WHERE o.game = ?1 AND o.board = ?2
         AND (o.score > b.score OR (o.score = b.score AND o.achieved_at < b.achieved_at))) AS rank,
  (SELECT count(*) FROM puzzlebox_best o JOIN puzzlebox_players p ON p.user_id = o.user_id AND p.hidden = 0
   WHERE o.game = ?1 AND o.board = ?2) AS players
FROM puzzlebox_runs r JOIN puzzlebox_best b ON b.game = r.game AND b.board = r.board AND b.user_id = r.user_id
WHERE r.id = ?3;

-- @ X2 leaderboard of one board or all boards (valid boards drive PK seeks; t and r are CTE results) | expect=b:PK,p:PK | allow=tempsort,tempgroup,scan:t,scan:r | params=["{\"1\":4,\"2\":4,\"3\":4}","2","connections","00000001-1111-4111-8111-111111111111",0,0]
WITH valid AS (
  SELECT key AS board, CAST(value AS INTEGER) AS max_score FROM json_each(?1) WHERE ?2 IS NULL OR key = ?2),
totals AS (
  SELECT b.user_id, sum(b.score) AS score, min(b.perfect) AS perfect, sum(b.perfect) AS perfect_count,
         count(*) AS boards, sum(b.attempts) AS attempts, max(b.achieved_at) AS achieved_at
  FROM valid v CROSS JOIN puzzlebox_best b ON b.game = ?3 AND b.board = v.board AND b.score <= v.max_score
  JOIN puzzlebox_players p ON p.user_id = b.user_id AND p.hidden = 0
  GROUP BY b.user_id),
ranked AS (SELECT t.*, row_number() OVER (ORDER BY t.score DESC, t.achieved_at, t.user_id) AS rank FROM totals t),
page AS (SELECT CASE WHEN ?5 = 1 AND EXISTS (SELECT 1 FROM ranked WHERE user_id = ?4)
                     THEN ((SELECT rank FROM ranked WHERE user_id = ?4) - 1) / 10 * 10
                     ELSE max(0, min(?6, 100000)) END AS start)
SELECT r.*, p.nickname, p.avatar_id, p.avatar_kind, p.palette_id, p.palette_swapped,
       (SELECT count(*) FROM ranked) AS total_players, (SELECT start FROM page) AS start
FROM ranked r JOIN puzzlebox_players p ON p.user_id = r.user_id, page
WHERE (r.rank > page.start AND r.rank <= page.start + 10) OR r.user_id = ?4
ORDER BY r.rank;

-- @ X2s leaderboard: board stats | expect=puzzlebox_board_stats:PK | allow= | params=["connections","2"]
SELECT * FROM puzzlebox_board_stats WHERE game = ?1 AND board = ?2;

-- @ X4 my standings (valid boards drive exact PK seeks of my best rows) | expect=m:PK,o:PK,p:PK | allow= | params=["00000001-1111-4111-8111-111111111111","connections","{\"1\":4,\"2\":4,\"3\":4,\"4\":4}"]
SELECT m.board, m.score, m.perfect, m.attempts, m.achieved_at,
  (SELECT count(*) FROM puzzlebox_best o JOIN puzzlebox_players p ON p.user_id = o.user_id AND p.hidden = 0
   WHERE o.game = m.game AND o.board = m.board AND o.score <= v.max_score) AS players,
  1 + (SELECT count(*) FROM puzzlebox_best o JOIN puzzlebox_players p ON p.user_id = o.user_id AND p.hidden = 0
       WHERE o.game = m.game AND o.board = m.board AND o.score <= v.max_score
         AND (o.score > m.score OR (o.score = m.score AND o.achieved_at < m.achieved_at))) AS rank
FROM (SELECT key AS board, CAST(value AS INTEGER) AS max_score FROM json_each(?3)) v
CROSS JOIN puzzlebox_best m ON m.game = ?2 AND m.board = v.board AND m.user_id = ?1 AND m.score <= v.max_score;

-- =============================================================================== 다채로운 철학자들 (F)

-- @ F1 week list (100) | expect=colorful_philosopher_posts:PK | allow= | params=[]
SELECT id, week_start, slot, resource_type, resource_id, name_ko, name_en, image_url, body, game_version
FROM colorful_philosopher_posts ORDER BY week_start DESC, slot DESC LIMIT 100;

-- @ F2 one post | expect=colorful_philosopher_posts:PK | allow= | params=["d0000000-0000-4000-8000-000000000001"]
SELECT id, week_start, slot, resource_type, resource_id, name_ko, name_en, image_url, body, game_version
FROM colorful_philosopher_posts WHERE id = ?1;

-- @ F3 reel (12 up to this week) | expect=colorful_philosopher_posts:PK | allow= | params=["2026-11-02"]
SELECT id, week_start, slot, resource_type, resource_id, name_ko, name_en, image_url, body, game_version
FROM colorful_philosopher_posts WHERE week_start <= ?1 ORDER BY week_start DESC, slot DESC LIMIT 12;

-- @ F4 nav weekly | expect=colorful_philosopher_posts:PK | allow= | params=["2026-11-02"]
SELECT week_start FROM colorful_philosopher_posts WHERE week_start <= ?1 ORDER BY week_start DESC LIMIT 1;

-- @ F5 codex detail thread of one resource | expect=colorful_philosopher_posts:colorful_philosopher_posts_resource | allow= | params=["card","r4"]
SELECT id, week_start, slot, resource_type, resource_id, name_ko, name_en, image_url, body, game_version
FROM colorful_philosopher_posts WHERE resource_type = ?1 AND resource_id = ?2 ORDER BY week_start DESC LIMIT 20;

-- @ F6 next week open (dev nav) | expect=colorful_philosopher_posts:PK | allow= | params=["2026-11-09"]
SELECT slot FROM colorful_philosopher_posts WHERE week_start = ?1;

-- @ F7 admin upsert (local script; keeps id and created_at on conflict) | expect= | allow= | params=["d9999999-0000-4000-8000-000000000001","2026-11-09","topic","card","bash","강타","Bash","주제","0.107.1","2026-11-08T01:02:03.456000Z"]
INSERT INTO colorful_philosopher_posts (id, week_start, slot, resource_type, resource_id, name_ko, name_en, image_url,
  body, game_version, created_at)
VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, NULL, ?8, ?9, ?10)
ON CONFLICT (week_start, slot) DO UPDATE SET resource_type = excluded.resource_type, resource_id = excluded.resource_id,
  name_ko = excluded.name_ko, name_en = excluded.name_en, image_url = excluded.image_url, body = excluded.body,
  game_version = excluded.game_version
RETURNING id, week_start, slot;

-- =============================================================================== verification keys (K)
-- Step 4 prerequisite (docs/supabase-exit/STEP1_DESIGN.md 6, workers/api/verification-keys.ts). The table
-- holds a handful of rows; scripts/verification-keys.ts binds K2-K5 as literals (wrangler --command).

-- @ K1 every key and revocation, read by the Worker at most once a minute per isolate | expect= | allow=scan:api_verification_keys | params=[]
SELECT kid, x, y, revoked_at FROM api_verification_keys;

-- @ K2 list (CLI) | expect= | allow=scan:api_verification_keys,walk | params=[]
SELECT kid, alg, x, y, added_at, revoked_at, note FROM api_verification_keys ORDER BY kid;

-- @ K3 add a key (CLI); an existing kid fails on the primary key | expect= | allow= | params=["k3-new-kid","ql4dh7v6HgNaIWxRerCKKONXztdZgjnfTmv0ORECtKI","rJ8NTkEQGvf8Jg_DSoIOa8Cq6A6If5lXa0iBqpYp_W8",1762646400000,"added"]
INSERT INTO api_verification_keys (kid, alg, x, y, added_at, note) VALUES (?1, 'ES256', ?2, ?3, ?4, ?5);

-- @ K4 revoke a kid (CLI): a new row (coordinates of the compiled-in key, or none) or the stored row; an already revoked row keeps its time | expect= | allow= | params=["k4-kid",null,null,1762646400000,"revoked"]
INSERT INTO api_verification_keys (kid, x, y, added_at, revoked_at, note) VALUES (?1, ?2, ?3, ?4, ?4, ?5)
ON CONFLICT (kid) DO UPDATE SET revoked_at = excluded.revoked_at, note = excluded.note WHERE api_verification_keys.revoked_at IS NULL;

-- @ K5a undo a revocation (CLI): a revoke-only row without coordinates goes away | expect=api_verification_keys:PK | allow= | params=["k4-kid"]
DELETE FROM api_verification_keys WHERE kid = ?1 AND revoked_at IS NOT NULL AND x IS NULL;

-- @ K5b undo a revocation (CLI): a key with coordinates counts again | expect=api_verification_keys:PK | allow= | params=["k4-kid","restored"]
UPDATE api_verification_keys SET revoked_at = NULL, note = ?2 WHERE kid = ?1 AND revoked_at IS NOT NULL AND x IS NOT NULL;
