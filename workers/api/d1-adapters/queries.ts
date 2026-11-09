/**
 * The read statements of the D1 adapters and the shadow ledger, copied verbatim from
 * docs/supabase-exit/d1-schema/queries.sql (validated plans, D1_SCHEMA_DESIGN 9). Change a statement
 * there first: scripts/d1-shadow-reads.spec.ts fails when a constant and its queries.sql statement
 * differ. Feed variants of other services and sorts are built from these templates in toybox.ts.
 */

/** E1: thread read, read.engagement?threads= (<= 64 keys) */
export const Q_E1 = `SELECT id, story_id, user_id, nickname, content, content_blocks, created_at, avatar_id, avatar_kind, palette_id,
       palette_swapped, like_count
FROM comments WHERE story_id IN (SELECT value FROM json_each(?1))
ORDER BY story_id, created_at, id LIMIT 1000`;

/** E2: my liked comments, me.engagement?threads= */
export const Q_E2 = `SELECT c.story_id, c.id FROM comments c
WHERE c.story_id IN (SELECT value FROM json_each(?1))
  AND EXISTS (SELECT 1 FROM comment_likes l WHERE l.comment_id = c.id AND l.user_id = ?2)`;

/** E3: thread counts of listed keys (likes=, run cards, philosopher replies, <= 100 keys) */
export const Q_E3 = `SELECT thread_key, like_count, comment_count FROM threads WHERE thread_key IN (SELECT value FROM json_each(?1))`;

/** E4: my likes among listed keys, me.engagement?likes= */
export const Q_E4 = `SELECT story_id FROM likes WHERE story_id IN (SELECT value FROM json_each(?1)) AND user_id = ?2`;

/** E5: reaction totals, read.engagement?reactions= */
export const Q_E5 = `SELECT resource_type, resource_id, game_version, buff_count, nerf_count, rework_count
FROM resource_reaction_counts WHERE resource_id IN (SELECT value FROM json_each(?1))`;

/** E6: my reactions, me.engagement?reactions= */
export const Q_E6 = `SELECT resource_type, resource_id, game_version, kind
FROM resource_reactions WHERE resource_id IN (SELECT value FROM json_each(?1)) AND user_id = ?2`;

/** E7: engagement map, read.engagement-counts (the whole map is the answer) */
export const Q_E7 = `SELECT thread_key, like_count, comment_count FROM threads WHERE like_count > 0 OR comment_count > 0`;

/** E8: courier (nav snapshot refresh): newest comments of the last 14 days */
export const Q_E8 = `SELECT id, story_id, content, created_at FROM comments
WHERE created_at >= ?1 ORDER BY created_at DESC, id DESC LIMIT 12`;

/** E9: nav latest of one surface (x8: 7 Toy Box services + history_course) */
export const Q_E9 = `SELECT created_at FROM posts WHERE service = ?1 ORDER BY created_at DESC, id DESC LIMIT 1`;

/** E10: story feed, read.stories?limit= */
export const Q_E10 = `SELECT id, user_id, static_story_id, nickname, avatar_id, avatar_kind, palette_id, palette_swapped, sentence, game,
       entity_type, entity_id, change_id, patch_line_id, source, tags, linked_entities, created_at
FROM community_stories ORDER BY created_at DESC, id DESC LIMIT ?1`;

/** E10b: story feed of one patch, read.stories?source= */
export const Q_E10b = `SELECT id, user_id, static_story_id, nickname, avatar_id, avatar_kind, palette_id, palette_swapped, sentence, game,
       entity_type, entity_id, change_id, patch_line_id, source, tags, linked_entities, created_at
FROM community_stories WHERE source = ?2 ORDER BY created_at DESC, id DESC LIMIT ?1`;

/** T1: service feed, sort=latest, first page (combo, with resources; step-1 row = id, created_at, counts, recommend_score, post) */
export const Q_T1 = `SELECT p.id, p.created_at, p.like_count, p.comment_count, p.like_count AS recommend_score, p.user_id, p.nickname,
       p.avatar_id, p.avatar_kind, p.palette_id, p.palette_swapped, s.content, s.content_text,
       (SELECT json_group_array(json_object('type', r.resource_type, 'id', r.resource_id))
          FROM post_combo_resources r WHERE r.service = p.service AND r.post_id = p.id) AS resources
FROM posts p CROSS JOIN post_combo s ON s.service = p.service AND s.post_id = p.id
WHERE p.service = 'combo' ORDER BY p.created_at DESC, p.id DESC LIMIT 20`;

/** T1c: service feed, sort=latest, next page (keyset) */
export const Q_T1c = `SELECT p.id, p.created_at, p.like_count, p.comment_count, p.like_count AS recommend_score, p.user_id, p.nickname,
       p.avatar_id, p.avatar_kind, p.palette_id, p.palette_swapped, s.content, s.content_text
FROM posts p CROSS JOIN post_chemical_x s ON s.service = p.service AND s.post_id = p.id
WHERE p.service = 'chemical_x' AND (p.created_at, p.id) < (?1, ?2)
ORDER BY p.created_at DESC, p.id DESC LIMIT 20`;

/** T2: service feed, sort=recommended (like_count), next page; every transfigure column of to_jsonb(p.*) */
export const Q_T2 = `SELECT p.id, p.created_at, p.like_count, p.comment_count, p.like_count AS recommend_score, p.user_id, p.nickname,
       p.avatar_id, p.avatar_kind, p.palette_id, p.palette_swapped, p.title,
       s.resource_type, s.resource_id, s.source_text, s.content, s.content_text, s.transformed_name, s.transformed_cost,
       s.transformed_star_cost, s.upgraded_content, s.upgraded_content_text, s.transformed_upgrade_cost,
       s.transformed_upgrade_star_cost, s.show_upgrade, s.omit_energy_cost, s.card_top_keywords, s.card_bottom_keywords,
       s.upgraded_card_top_keywords, s.upgraded_card_bottom_keywords, s.transformed_card_type, s.transformed_card_rarity,
       s.transformed_card_color, s.token_color, s.token_wax, s.extra_variants
FROM posts p CROSS JOIN post_transfigure s ON s.service = p.service AND s.post_id = p.id
WHERE p.service = 'transfigure' AND (p.like_count, p.created_at, p.id) < (?1, ?2, ?3)
ORDER BY p.like_count DESC, p.created_at DESC, p.id DESC LIMIT 20`;

/** T3: service feed, sort=comments, first page */
export const Q_T3 = `SELECT p.id, p.created_at, p.like_count, p.comment_count, p.like_count AS recommend_score, p.user_id, p.nickname,
       p.avatar_id, p.avatar_kind, p.palette_id, p.palette_swapped, p.title, s.note, s.preset_key, s.game_version,
       s."rows", s.placements, s.extra_ids
FROM posts p CROSS JOIN post_decisions_decisions s ON s.service = p.service AND s.post_id = p.id
WHERE p.service = 'decisions_decisions' ORDER BY p.comment_count DESC, p.created_at DESC, p.id DESC LIMIT 20`;

/** T4: this_or_that vote_rate_high (= total ballots; 0-vote posts excluded): no sort index by design, reads the whole service */
export const Q_T4 = `SELECT p.id, p.created_at, p.like_count, p.comment_count, p.like_count AS recommend_score, p.user_id, p.nickname,
       p.avatar_id, p.avatar_kind, p.palette_id, p.palette_swapped, t.left_type, t.left_id, t.right_type, t.right_id,
       t.reason, t.left_vote_count, t.right_vote_count
FROM posts p JOIN post_this_or_that t ON t.service = p.service AND t.post_id = p.id
WHERE p.service = 'this_or_that' AND t.left_vote_count + t.right_vote_count > 0
  AND (t.left_vote_count + t.right_vote_count, p.created_at, p.id) < (?1, ?2, ?3)
ORDER BY t.left_vote_count + t.right_vote_count DESC, p.created_at DESC, p.id DESC LIMIT 20`;

/** T5: favorite_tournament sort=play_count: no sort index by design; pools are built after sort and LIMIT (<= 20 pool lookups) */
export const Q_T5 = `SELECT q.*, (SELECT json_group_array(json_object('type', o.resource_type, 'id', o.resource_id))
               FROM post_favorite_tournament_pool o WHERE o.service = 'favorite_tournament' AND o.post_id = q.id) AS pool
FROM (SELECT p.id, p.created_at, p.like_count, p.comment_count, p.like_count AS recommend_score, p.user_id,
             p.nickname, p.avatar_id, p.avatar_kind, p.palette_id, p.palette_swapped, p.title, f.note, f.preset_key,
             f.play_count
      FROM posts p JOIN post_favorite_tournament f ON f.service = p.service AND f.post_id = p.id
      WHERE p.service = 'favorite_tournament' ORDER BY f.play_count DESC, p.created_at DESC, p.id DESC LIMIT 20) q
ORDER BY q.play_count DESC, q.created_at DESC, q.id DESC`;

/** T6a: 조각모음 board, sort=latest, all services incl. runs (history_meta from the runs join) */
export const Q_T6a = `SELECT p.id, p.created_at, p.like_count, p.comment_count, p.like_count AS recommend_score, p.service,
       p.summary AS title, p.nickname, p.user_id, p.avatar_id, p.avatar_kind, p.palette_id, p.palette_swapped,
       h.cover_spec, h.win, h.ascension, h.total_floors
FROM posts p LEFT JOIN post_history_course h ON h.service = p.service AND h.post_id = p.id
WHERE (p.created_at, p.id) < (?1, ?2) ORDER BY p.created_at DESC, p.id DESC LIMIT 20`;

/** T6b: 조각모음 board, sort=recommended */
export const Q_T6b = `SELECT p.id, p.created_at, p.like_count, p.comment_count, p.like_count AS recommend_score, p.service,
       p.summary AS title, p.nickname, p.user_id, p.avatar_id, p.avatar_kind, p.palette_id, p.palette_swapped,
       h.cover_spec, h.win, h.ascension, h.total_floors
FROM posts p LEFT JOIN post_history_course h ON h.service = p.service AND h.post_id = p.id
WHERE (p.like_count, p.created_at, p.id) < (?1, ?2, ?3) ORDER BY p.like_count DESC, p.created_at DESC, p.id DESC LIMIT 20`;

/** T6c: 조각모음 board, sort=comments, first page */
export const Q_T6c = `SELECT p.id, p.created_at, p.like_count, p.comment_count, p.like_count AS recommend_score, p.service,
       p.summary AS title, p.nickname, p.user_id, p.avatar_id, p.avatar_kind, p.palette_id, p.palette_swapped,
       h.cover_spec, h.win, h.ascension, h.total_floors
FROM posts p LEFT JOIN post_history_course h ON h.service = p.service AND h.post_id = p.id
ORDER BY p.comment_count DESC, p.created_at DESC, p.id DESC LIMIT 20`;

/** T7: 조각모음 board, filter history_course (defragment-runs, 11 columns), sort=comments */
export const Q_T7 = `SELECT p.id, p.created_at, p.like_count, p.comment_count, h.seed, p.user_id AS donor_user_id,
       p.nickname AS donor_nickname, h.cover_spec, h.win, h.ascension, h.total_floors
FROM posts p CROSS JOIN post_history_course h ON h.service = p.service AND h.post_id = p.id
WHERE p.service = 'history_course' AND (p.comment_count, p.created_at, p.id) < (?1, ?2, ?3)
ORDER BY p.comment_count DESC, p.created_at DESC, p.id DESC LIMIT 20`;

/** T8: one post (detail, embeds, OG), transfigure */
export const Q_T8 = `SELECT p.*, s.* FROM posts p CROSS JOIN post_transfigure s ON s.service = p.service AND s.post_id = p.id WHERE p.service = ?2 AND p.id = ?1`;

/** T9: tournament presets (builtins with pools; select=* of favorite_tournament_posts) */
export const Q_T9 = `SELECT p.id, p.user_id, p.nickname, p.avatar_id, p.avatar_kind, p.palette_id, p.palette_swapped, p.title, f.note,
       f.preset_key, f.play_count, p.like_count, p.comment_count, p.created_at,
       (SELECT json_group_array(json_object('type', o.resource_type, 'id', o.resource_id))
          FROM post_favorite_tournament_pool o WHERE o.service = p.service AND o.post_id = p.id) AS pool
FROM post_favorite_tournament f CROSS JOIN posts p ON p.service = f.service AND p.id = f.post_id
WHERE substr(f.preset_key, 1, 8) = 'builtin:' ORDER BY p.created_at, p.id`;

/** T10: tournament stats */
export const Q_T10 = `SELECT resource_type, resource_id, match_appearances, match_wins, championships, current_rank, rank_history
FROM favorite_tournament_candidate_stats WHERE service = 'favorite_tournament' AND tournament_id = ?1`;

/** T11: 서류 폭풍 index (50 latest; PAGESTORM_LIST_COLUMNS) */
export const Q_T11 = `SELECT p.id, p.user_id, p.nickname, p.title, s.content, s.content_text, p.created_at, p.avatar_id, p.avatar_kind,
       p.palette_id, p.palette_swapped
FROM posts p CROSS JOIN post_pagestorm s ON s.service = p.service AND s.post_id = p.id
WHERE p.service = 'pagestorm' ORDER BY p.created_at DESC, p.id DESC LIMIT 50`;

/** T12: my 서류 폭풍 drafts (PAGESTORM_LIST_COLUMNS: no updated_at in the answer) */
export const Q_T12 = `SELECT id, user_id, nickname, title, content, content_text, created_at, avatar_id, avatar_kind, palette_id,
       palette_swapped
FROM pagestorm_drafts WHERE user_id = ?1 ORDER BY updated_at DESC, id DESC LIMIT 20`;

/** T13: one draft */
export const Q_T13 = `SELECT * FROM pagestorm_drafts WHERE id = ?1 AND user_id = ?2`;

/** T14: 조각모음 body of a post (the body row carries source_service itself) */
export const Q_T14 = `SELECT post_id AS source_id, service AS source_service, user_id, nickname, content, content_text, created_at, updated_at
FROM defragment_bodies WHERE service = ?2 AND post_id = ?1`;

/** T15: this-or-that like counts (<= 100 ids; the view this_or_that_post_like_counts: rows per post, no zero rows) */
export const Q_T15 = `SELECT post_id, count(*) AS like_count FROM this_or_that_post_likes
WHERE service = 'this_or_that' AND post_id IN (SELECT value FROM json_each(?1)) GROUP BY post_id`;

/** T16: my this-or-that likes */
export const Q_T16 = `SELECT post_id FROM this_or_that_post_likes
WHERE service = 'this_or_that' AND user_id = ?1 AND post_id IN (SELECT value FROM json_each(?2))`;

/** T17: vote summaries (<= 50 ids) */
export const Q_T17 = `SELECT post_id, left_vote_count AS left_count, right_vote_count AS right_count,
       left_vote_count + right_vote_count AS total_count
FROM post_this_or_that WHERE service = 'this_or_that' AND post_id IN (SELECT value FROM json_each(?1)) AND left_vote_count + right_vote_count > 0`;

/** T18: my votes (<= 100 ids) */
export const Q_T18 = `SELECT post_id, choice FROM this_or_that_post_votes
WHERE service = 'this_or_that' AND user_id = ?1 AND post_id IN (SELECT value FROM json_each(?2))`;

/** R1: run list (100 latest) with summary columns, game elements (popular chips and search from page load, as today) and row-true counts */
export const Q_R1 = `SELECT p.id, h.seed, h.build, h."character", h.characters, h.ascension, h.win, h.start_time, h.run_time,
       h.acts_count, h.total_floors, h.badges, h.cover_spec, h.game_mode, h.game_elements, h.list_facts,
       h.summary_version,
       p.user_id AS donor_user_id, p.created_at, coalesce(t.like_count, 0) AS like_count,
       coalesce(t.comment_count, 0) AS comment_count
FROM posts p CROSS JOIN post_history_course h ON h.service = p.service AND h.post_id = p.id
LEFT JOIN threads t ON t.thread_key = 'history-course:' || p.id
WHERE p.service = 'history_course' ORDER BY p.created_at DESC, p.id DESC LIMIT 100`;

/** R2: combo / 조각모음 run picker (30 by start time; RUN_SUMMARY_COLUMNS with summary columns in place of raw) */
export const Q_R2 = `SELECT h.post_id AS id, h.seed, h.build, h."character", h.ascension, h.win, h.start_time, h.run_time, h.acts_count,
       h.total_floors, h.cover_spec, p.user_id AS donor_user_id, p.created_at, h.characters, h.badges, h.game_mode,
       h.game_elements, h.list_facts, h.summary_version
FROM post_history_course h CROSS JOIN posts p ON p.service = h.service AND p.id = h.post_id
ORDER BY h.start_time DESC, h.post_id DESC LIMIT 30`;

/** R1j: R1 as one JSON text per row, keys in the answer's order (step 3 serves it without parsing the JSON columns) */
export const Q_R1j = `SELECT
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
WHERE p.service = 'history_course' ORDER BY p.created_at DESC, p.id DESC LIMIT 100`;

/** R2j: R2 as one JSON text per row, keys in the answer's order (step 3 serves it without parsing the JSON columns) */
export const Q_R2j = `SELECT
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
ORDER BY h.start_time DESC, h.post_id DESC LIMIT 30`;

/** R3: run detail meta (RUN_DETAIL_COLUMNS without raw; the raw is R3r, returned as the response body) */
export const Q_R3 = `SELECT p.id, h.seed, h.build, h."character", h.ascension, h.win, h.start_time, h.run_time, h.acts_count,
       h.cover_spec, p.created_at
FROM posts p JOIN post_history_course h ON h.service = p.service AND h.post_id = p.id
WHERE p.service = 'history_course' AND p.id = ?1`;

/** R4: cover view: combo thumbs re-pick a non-manual cover from list_facts and the phrase columns as they do from the raw today (summary_version 0: from R3r); the editor's raw is R3r */
export const Q_R4 = `SELECT post_id AS id, cover_spec, list_facts, win, ascension, total_floors, summary_version
FROM post_history_course WHERE service = 'history_course' AND post_id = ?1`;

/** R3r: run raw for detail and cover editor (the stored text is the body, never wrapped in JSON) */
export const Q_R3r = `SELECT raw FROM post_history_course_file WHERE service = 'history_course' AND post_id = ?1`;

/** R5: run meta / OG / "is it shared" */
export const Q_R5 = `SELECT post_id AS id, "character", cover_spec FROM post_history_course WHERE service = 'history_course' AND post_id = ?1`;

/** R6: run engagement for listed runs (<= 100) */
export const Q_R6 = `SELECT thread_key, like_count, comment_count FROM threads
WHERE thread_key IN (SELECT 'history-course:' || value FROM json_each(?1))`;

/** R7: my run ids */
export const Q_R7 = `SELECT id FROM posts WHERE user_id = ?1 AND service = 'history_course'`;

/** P1: nickname pools (the whole 10-row table is the answer) */
export const Q_P1 = `SELECT character_id, locale, nicknames FROM profile_character_nickname_pools ORDER BY character_id, locale`;

/** P2: my activity (get_my_profile_activity): union of my rows, offset paging; a this_or_that post's like count is its this_or_that_post_likes rows, as the RPC counts them */
export const Q_P2 = `WITH own AS (
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
LIMIT min(max(?4, 1), 50) OFFSET max(?5, 0)`;

/** P3: my activity stats (get_my_profile_activity_stats) */
export const Q_P3 = `WITH own AS (
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
SELECT category, count(*) AS post_count, sum(like_count) AS like_count FROM own GROUP BY category`;

/** C2: mailbox dot */
export const Q_C2 = `SELECT id FROM contact_inquiries WHERE user_id = ?1 AND admin_response IS NOT NULL AND reply_seen_at IS NULL LIMIT 1`;

/** C3: my inquiry history */
export const Q_C3 = `SELECT id, category, message, status, admin_response, reply_seen_at, created_at FROM contact_inquiries
WHERE user_id = ?1 ORDER BY created_at DESC, id DESC LIMIT 50`;

/** X2: leaderboard of one board or all boards (valid boards drive PK seeks; t and r are CTE results) */
export const Q_X2 = `WITH valid AS (
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
ORDER BY r.rank`;

/** X2s: leaderboard: board stats */
export const Q_X2s = `SELECT * FROM puzzlebox_board_stats WHERE game = ?1 AND board = ?2`;

/** X4: my standings (valid boards drive exact PK seeks of my best rows) */
export const Q_X4 = `SELECT m.board, m.score, m.perfect, m.attempts, m.achieved_at,
  (SELECT count(*) FROM puzzlebox_best o JOIN puzzlebox_players p ON p.user_id = o.user_id AND p.hidden = 0
   WHERE o.game = m.game AND o.board = m.board AND o.score <= v.max_score) AS players,
  1 + (SELECT count(*) FROM puzzlebox_best o JOIN puzzlebox_players p ON p.user_id = o.user_id AND p.hidden = 0
       WHERE o.game = m.game AND o.board = m.board AND o.score <= v.max_score
         AND (o.score > m.score OR (o.score = m.score AND o.achieved_at < m.achieved_at))) AS rank
FROM (SELECT key AS board, CAST(value AS INTEGER) AS max_score FROM json_each(?3)) v
CROSS JOIN puzzlebox_best m ON m.game = ?2 AND m.board = v.board AND m.user_id = ?1 AND m.score <= v.max_score`;

/** F1: week list (100) */
export const Q_F1 = `SELECT id, week_start, slot, resource_type, resource_id, name_ko, name_en, image_url, body, game_version
FROM colorful_philosopher_posts ORDER BY week_start DESC, slot DESC LIMIT 100`;

/** F2: one post */
export const Q_F2 = `SELECT id, week_start, slot, resource_type, resource_id, name_ko, name_en, image_url, body, game_version
FROM colorful_philosopher_posts WHERE id = ?1`;

/** F3: reel (12 up to this week) */
export const Q_F3 = `SELECT id, week_start, slot, resource_type, resource_id, name_ko, name_en, image_url, body, game_version
FROM colorful_philosopher_posts WHERE week_start <= ?1 ORDER BY week_start DESC, slot DESC LIMIT 12`;

/** F4: nav weekly */
export const Q_F4 = `SELECT week_start FROM colorful_philosopher_posts WHERE week_start <= ?1 ORDER BY week_start DESC LIMIT 1`;

/** F5: codex detail thread of one resource */
export const Q_F5 = `SELECT id, week_start, slot, resource_type, resource_id, name_ko, name_en, image_url, body, game_version
FROM colorful_philosopher_posts WHERE resource_type = ?1 AND resource_id = ?2 ORDER BY week_start DESC LIMIT 20`;

/** S5: shadow counters */
export const Q_S5 = `INSERT INTO shadow_stats (day, route_id, compared, differed, skipped) VALUES (?1, ?2, ?3, ?4, ?5)
ON CONFLICT (day, route_id) DO UPDATE SET compared = compared + excluded.compared,
  differed = differed + excluded.differed, skipped = skipped + excluded.skipped`;

/** S6: shadow difference sample */
export const Q_S6 = `INSERT INTO shadow_diffs (day, route_id, diff_hash, first_at, sample) VALUES (?1, ?2, ?3, ?4, ?5)
ON CONFLICT (day, route_id, diff_hash) DO UPDATE SET hits = hits + 1`;
