-- Fixtures for check.db: representative rows for every table (including FK children), then bulk rows
-- so the plans are checked on non-trivial tables, then a cascade test that fails loudly.
-- Run with PRAGMA foreign_keys = ON (prepended by build/check.py).

-- Users: u1 '11111111-1111-4111-8111-111111111111', u2 '22222222-2222-4222-8222-222222222222'.

-- ---------------------------------------------------------------- bookkeeping
INSERT INTO sync_state (name, low_watermark, high_seen) VALUES ('supabase_in', 0, 0), ('outbox_out', 0, 0);
INSERT INTO sync_rejects (direction, ref, table_name, d1_table, row_key, op, reason, payload, error, first_at, last_at)
VALUES ('in', 41, 'comments', 'comments', '{"id":"c0000000-0000-4000-8000-000000000041"}', 'I', 'check',
        '{"id":"x"}', 'CHECK constraint failed', 1762560000000, 1762560000000);
INSERT INTO sync_pending_raw (post_id, queued_at) VALUES ('r00000000000000f', 1762560000000);
INSERT INTO outbox (table_name, op, match_key, payload, created_at)
VALUES ('comments', 'insert', '{"id":"c0000000-0000-4000-8000-000000000001"}', '{"content":"hi"}', 1762560000000),
       ('likes', 'delete', '{"story_id":"sts2-codex:card:bash","user_id":"11111111-1111-4111-8111-111111111111"}', NULL, 1762560000001),
       ('mirror_favorite_tournament_play', 'rpc', '{"p_play_id":"f0000000-0000-4000-8000-000000000001"}', '{"p_starting_size":2}', 1762560000002);
INSERT INTO sync_checks (check_date, source_table, d1_table, kind, d1_rows, supabase_rows, d1_hash, supabase_hash, diff_count, checked_at)
VALUES ('2026-11-08', 'comments', 'comments', 'rows', 385, 385, 'ab', 'ab', 0, 1762560000000),
       ('2026-11-08', 'chemical_posts', 'posts', 'rows', 12, 12, 'cd', 'cd', 0, 1762560000000),
       ('2026-11-08', 'combo_posts', 'posts', 'rows', 30, 30, 'ef', 'ef', 0, 1762560000000);
INSERT INTO shadow_stats (day, route_id, compared, differed) VALUES ('2026-11-08', 'read.engagement', 10, 0);
INSERT INTO shadow_diffs (day, route_id, diff_hash, first_at, sample)
VALUES ('2026-11-08', 'read.stories', 'h1', 1762560000000, '{"path":"$[0].tags"}');

-- ---------------------------------------------------------------- engagement
INSERT INTO comments (id, story_id, user_id, nickname, avatar_id, avatar_kind, palette_id, palette_swapped,
                      content, content_blocks, created_at) VALUES
('c0000000-0000-4000-8000-000000000001', 'sts2-codex:card:bash', '11111111-1111-4111-8111-111111111111',
 '아이언클래드', 'IRONCLAD', 'character', 'red', 0, '강타 좋다', NULL, '2026-11-05T11:48:12.345600Z'),
('c0000000-0000-4000-8000-000000000002', 'sts2-codex:card:bash', '22222222-2222-4222-8222-222222222222',
 '사일런트', NULL, NULL, NULL, NULL, 'x', '[{"type":"text","text":"x"}]', '2026-11-05T11:48:12.345600Z'),
('c0000000-0000-4000-8000-000000000003', 'c-c-c-combo:a0000000-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222',
 '사일런트', NULL, NULL, NULL, 1, '콤보 댓글', NULL, '2026-11-06T00:00:00.000000Z'),
('c0000000-0000-4000-8000-000000000004', 'history-course:0a1b2c3d4e5f6g7h', '11111111-1111-4111-8111-111111111111',
 '아이언클래드', NULL, NULL, NULL, 0, '런 댓글', NULL, '2026-11-06T01:00:00.000000Z'),
('c0000000-0000-4000-8000-000000000005', 'colorful-philosophers:d0000000-0000-4000-8000-000000000001',
 '11111111-1111-4111-8111-111111111111', '아이언클래드', NULL, NULL, NULL, 0, '철학자 답글', NULL, '2026-11-06T02:00:00.000000Z');
INSERT INTO comment_likes (comment_id, user_id, created_at) VALUES
('c0000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', '2026-11-05T12:00:00.000000Z'),
('c0000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', '2026-11-05T12:00:01.000000Z');
INSERT INTO likes (story_id, user_id, created_at) VALUES
('sts2-codex:card:bash', '11111111-1111-4111-8111-111111111111', '2026-11-05T12:00:00.000000Z'),
('community:e0000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', '2026-11-05T12:00:00.000000Z'),
('c-c-c-combo:a0000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', '2026-11-05T12:00:00.000000Z');
INSERT INTO resource_reactions (resource_id, resource_type, game_version, user_id, kind) VALUES
('bash', 'card', '0.107.1', '11111111-1111-4111-8111-111111111111', 'buff'),
('bash', 'card', '0.107.1', '22222222-2222-4222-8222-222222222222', 'nerf'),
('burning_blood', 'relic', '0.107.1', '11111111-1111-4111-8111-111111111111', 'rework');
INSERT INTO resource_reaction_counts (resource_id, resource_type, game_version, buff_count, nerf_count, rework_count) VALUES
('bash', 'card', '0.107.1', 1, 1, 0), ('burning_blood', 'relic', '0.107.1', 0, 0, 1);
INSERT INTO community_stories (id, user_id, static_story_id, nickname, sentence, game, entity_type, entity_id,
                               change_id, patch_line_id, source, tags, linked_entities, created_at) VALUES
('e0000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', NULL, '사일런트',
 '강타가 너프되었다', 'sts2', 'card', 'bash', NULL, 'v0.107.1:l12', 'v0.107.1', '[]',
 '[{"type":"card","id":"bash"}]', '2026-11-05T09:00:00.000000Z'),
('e0000000-0000-4000-8000-000000000002', NULL, 'sts2-doormaker-removed', '슬서운이야기',
 '문 제작자가 사라졌다', 'sts2', NULL, NULL, NULL, NULL, NULL, '[]', '[]', '2026-05-08T00:00:00.000000Z');

-- ---------------------------------------------------------------- posts (one per service) and children
INSERT INTO posts (id, service, user_id, nickname, avatar_id, avatar_kind, palette_id, palette_swapped, title,
                   summary, like_count, comment_count, created_at) VALUES
('a0000000-0000-4000-8000-000000000001', 'chemical_x', '11111111-1111-4111-8111-111111111111', '아이언클래드',
 'IRONCLAD', 'character', 'red', 0, NULL, '케미컬 한 줄', 0, 0, '2026-11-01T00:00:00.000000Z'),
('a0000000-0000-4000-8000-000000000002', 'combo', '22222222-2222-4222-8222-222222222222', '사일런트',
 NULL, NULL, NULL, NULL, NULL, '콤보 본문', 1, 1, '2026-11-01T00:00:01.000000Z'),
('a0000000-0000-4000-8000-000000000003', 'transfigure', '11111111-1111-4111-8111-111111111111', '아이언클래드',
 NULL, NULL, NULL, 0, '강타 변형', '강타 변형', 0, 0, '2026-11-01T00:00:02.000000Z'),
('a0000000-0000-4000-8000-000000000004', 'this_or_that', '22222222-2222-4222-8222-222222222222', '사일런트',
 NULL, NULL, NULL, 0, NULL, '둘 중 하나', 1, 0, '2026-11-01T00:00:03.000000Z'),
('a0000000-0000-4000-8000-000000000005', 'favorite_tournament', NULL, '세 번째 손',
 NULL, NULL, NULL, 0, '유물 월드컵', '유물 월드컵', 0, 0, '2026-11-01T00:00:04.000000Z'),
('a0000000-0000-4000-8000-000000000006', 'decisions_decisions', '11111111-1111-4111-8111-111111111111', '아이언클래드',
 NULL, NULL, NULL, 0, '티어표', '티어표', 0, 0, '2026-11-01T00:00:05.000000Z'),
('a0000000-0000-4000-8000-000000000007', 'pagestorm', '11111111-1111-4111-8111-111111111111', '아이언클래드',
 NULL, NULL, NULL, 0, '서류', '서류', 0, 0, '2026-11-01T00:00:06.000000Z'),
('0a1b2c3d4e5f6g7h', 'history_course', '11111111-1111-4111-8111-111111111111', '아이언클래드',
 NULL, NULL, NULL, NULL, NULL, 'SEED123', 0, 1, '2026-11-01T00:00:07.123400Z');

INSERT INTO post_chemical_x (post_id, content, content_text) VALUES
('a0000000-0000-4000-8000-000000000001', '[{"type":"text","text":"케미컬 한 줄"}]', '케미컬 한 줄');
INSERT INTO post_combo (post_id, content, content_text) VALUES
('a0000000-0000-4000-8000-000000000002', '[{"type":"text","text":"콤보 본문"}]', '콤보 본문');
INSERT INTO post_combo_resources (post_id, ord, resource_type, resource_id) VALUES
('a0000000-0000-4000-8000-000000000002', 0, 'card', 'bash'),
('a0000000-0000-4000-8000-000000000002', 1, 'relic', 'burning_blood');
INSERT INTO post_transfigure (post_id, resource_type, resource_id, source_text, content, content_text,
  transformed_name, transformed_cost, show_upgrade, card_top_keywords, transformed_card_type) VALUES
('a0000000-0000-4000-8000-000000000003', 'card', 'bash', '강타', '[{"type":"text","text":"피해 9"}]', '피해 9',
 '대강타', ' X ', 0, '["보존"]', '공격');
INSERT INTO post_this_or_that (post_id, left_type, left_id, right_type, right_id, reason, left_vote_count, right_vote_count)
VALUES ('a0000000-0000-4000-8000-000000000004', 'card', 'bash', 'card', 'strike', '둘 다 좋다', 1, 0);
INSERT INTO this_or_that_post_votes (post_id, user_id, choice, created_at) VALUES
('a0000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111', 'left', '2026-11-02T00:00:00.000000Z');
INSERT INTO this_or_that_post_likes (post_id, user_id, created_at) VALUES
('a0000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111', '2026-11-05T12:00:00.000000Z');
INSERT INTO post_favorite_tournament (post_id, note, preset_key, play_count) VALUES
('a0000000-0000-4000-8000-000000000005', '', 'builtin:relics', 1);
INSERT INTO post_favorite_tournament_pool (post_id, ord, resource_type, resource_id) VALUES
('a0000000-0000-4000-8000-000000000005', 0, 'relic', 'burning_blood'),
('a0000000-0000-4000-8000-000000000005', 1, 'relic', 'anchor');
INSERT INTO favorite_tournament_plays (id, tournament_id, user_id, starting_size, champion_type, champion_id, matches, created_at)
VALUES ('f0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000005',
 '22222222-2222-4222-8222-222222222222', 2, 'relic', 'anchor',
 '[{"left_type":"relic","left_id":"burning_blood","right_type":"relic","right_id":"anchor","winner":"right"}]',
 '2026-11-02T00:00:00.000000Z');
INSERT INTO favorite_tournament_candidate_stats (tournament_id, resource_type, resource_id, match_appearances,
  match_wins, championships, current_rank, rank_history) VALUES
('a0000000-0000-4000-8000-000000000005', 'relic', 'anchor', 1, 1, 1, 1, '[{"at":"2026-11-02 00:00:00.000000","rank":1}]'),
('a0000000-0000-4000-8000-000000000005', 'relic', 'burning_blood', 1, 0, 0, 2, '[{"at":"2026-11-02 00:00:00.000000","rank":2}]');
INSERT INTO post_decisions_decisions (post_id, note, preset_key, game_version, "rows", placements, extra_ids) VALUES
('a0000000-0000-4000-8000-000000000006', '', 'cards', '0.107.1', '[{"id":"s","label":"S"}]', '[]', '[]');
INSERT INTO post_pagestorm (post_id, content, content_text) VALUES
('a0000000-0000-4000-8000-000000000007', '{"type":"doc","content":[]}', '서류');
INSERT INTO pagestorm_drafts (id, user_id, nickname, title, content, content_text, created_at, updated_at) VALUES
('b0000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', '아이언클래드', '초안',
 '{"type":"doc","content":[]}', '초안', '2026-11-03T00:00:00.000000Z', '2026-11-03T00:10:00.000000Z');
INSERT INTO defragment_bodies (service, post_id, user_id, nickname, content, content_text, created_at, updated_at) VALUES
('combo', 'a0000000-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222', '사일런트',
 '[{"type":"text","text":"본문"}]', '조각 본문', '2026-11-03T00:00:00.000000Z', '2026-11-03T00:00:00.000000Z');
INSERT INTO post_history_course (post_id, seed, build, "character", ascension, win, start_time, run_time, acts_count,
  total_floors, cover_spec, summary_version, badges, characters, game_mode, game_elements, cover_phrases) VALUES
('0a1b2c3d4e5f6g7h', 'SEED123', 'v0.107.1', 'CHARACTER.IRONCLAD', 10, 1, 1762300000, 3600, 3, 51,
 '{"auto":true,"elements":[]}', 1, '[{"id":"BADGE.FAST","rarity":"gold"}]', '["CHARACTER.IRONCLAD"]', 'standard',
 '[{"type":"card","id":"bash"}]', '["강타"]');
INSERT INTO post_history_course_file (post_id, raw) VALUES ('0a1b2c3d4e5f6g7h', '{"seed":"SEED123"}');

-- ---------------------------------------------------------------- profile, contact, puzzlebox, philosophers
INSERT INTO profile_character_nickname_pools (character_id, locale, nicknames, updated_at) VALUES
('IRONCLAD', 'ko', '["붉은 전사","철갑"]', '2026-10-01T00:00:00.000000Z'),
('IRONCLAD', 'en', '["Red Warrior"]', '2026-10-01T00:00:00.000000Z');
INSERT INTO contact_inquiries (id, user_id, category, message, reply_email, page_path, service_locale, game_locale,
  status, created_at, admin_response, responded_at, reply_seen_at) VALUES
('90000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'bug', '카드 이미지가 안 보여요.',
 NULL, '/compendium/cards/bash', 'ko', 'kor', 'done', '2026-11-01T00:00:00.000000Z', '고쳤습니다.',
 '2026-11-02T00:00:00.000000Z', NULL),
('90000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'partnership', '같이 일하고 싶습니다.',
 'a@example.com', '/', 'ko', 'kor', 'new', '2026-11-03T00:00:00.000000Z', NULL, NULL, NULL);
INSERT INTO puzzlebox_players (user_id, nickname, avatar_id, avatar_kind, palette_id, palette_swapped, hidden, updated_at) VALUES
('11111111-1111-4111-8111-111111111111', '아이언클래드', 'IRONCLAD', 'character', 'red', 1, 0, '2026-11-01T00:00:00.000000Z'),
('22222222-2222-4222-8222-222222222222', '사일런트', NULL, NULL, NULL, 0, 0, '2026-11-01T00:00:00.000000Z');
INSERT INTO puzzlebox_runs (id, game, board, user_id, attempt, score, perfect, run, created_at) VALUES
(1, 'connections', '1', '11111111-1111-4111-8111-111111111111', 1, 4, 1, '{"guesses":[]}', '2026-11-01T00:00:00.000000Z'),
(2, 'connections', '1', '22222222-2222-4222-8222-222222222222', 1, 3, 0, '{"guesses":[]}', '2026-11-01T00:01:00.000000Z');
INSERT INTO puzzlebox_best (game, board, user_id, score, perfect, run_id, achieved_at, attempts) VALUES
('connections', '1', '11111111-1111-4111-8111-111111111111', 4, 1, 1, '2026-11-01T00:00:00.000000Z', 1),
('connections', '1', '22222222-2222-4222-8222-222222222222', 3, 0, 2, '2026-11-01T00:01:00.000000Z', 1);
INSERT INTO puzzlebox_board_stats (game, board, players, cleared, perfect, score_sum) VALUES ('connections', '1', 2, 2, 1, 7);
INSERT INTO colorful_philosopher_posts (id, week_start, slot, resource_type, resource_id, name_ko, name_en, image_url,
  body, game_version, created_at) VALUES
('d0000000-0000-4000-8000-000000000001', '2026-11-02', 'topic', 'card', 'bash', '강타', 'Bash', NULL,
 '강타는 너무 강한가?', '0.107.1', '2026-11-02T00:00:00.000000Z'),
('d0000000-0000-4000-8000-000000000002', '2026-11-02', 'card', 'card', 'strike', '타격', 'Strike', NULL,
 '타격 이야기', '0.107.1', '2026-11-02T00:00:00.000000Z');

-- ---------------------------------------------------------------- bulk rows (plans on non-trivial tables)
WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 800)
INSERT INTO posts (id, service, user_id, nickname, title, summary, like_count, comment_count, created_at)
SELECT CASE WHEN i % 8 = 7 THEN printf('r%015x', i) ELSE printf('%08x-0000-4000-8000-%012x', i, i) END,
       CASE i % 8 WHEN 0 THEN 'chemical_x' WHEN 1 THEN 'combo' WHEN 2 THEN 'transfigure' WHEN 3 THEN 'this_or_that'
                  WHEN 4 THEN 'favorite_tournament' WHEN 5 THEN 'decisions_decisions' WHEN 6 THEN 'pagestorm'
                  ELSE 'history_course' END,
       printf('%08x-1111-4111-8111-111111111111', i % 50), '닉' || (i % 50),
       CASE WHEN i % 8 IN (4, 5, 6) THEN '제목 ' || i END, '요약 ' || i, i % 7, i % 5,
       strftime('%Y-%m-%dT%H:%M:%S', '2026-01-01', '+' || (i * 397) || ' minutes') || printf('.%06dZ', (i * 7919) % 1000000)
FROM n;
INSERT INTO post_chemical_x (post_id, content, content_text) SELECT id, '[]', '한 줄 ' || substr(id, 1, 4) FROM posts WHERE service = 'chemical_x' AND id NOT IN (SELECT post_id FROM post_chemical_x);
INSERT INTO post_combo (post_id, content, content_text) SELECT id, '[]', '콤보 ' || id FROM posts WHERE service = 'combo' AND id NOT IN (SELECT post_id FROM post_combo);
INSERT INTO post_combo_resources (post_id, ord, resource_type, resource_id) SELECT post_id, 0, 'card', 'bash' FROM post_combo WHERE post_id NOT IN (SELECT post_id FROM post_combo_resources);
INSERT INTO post_combo_resources (post_id, ord, resource_type, resource_id) SELECT post_id, 1, 'relic', 'anchor' FROM post_combo WHERE post_id NOT IN (SELECT post_id FROM post_combo_resources WHERE ord = 1);
INSERT INTO post_transfigure (post_id, resource_type, resource_id, source_text, content, content_text)
SELECT id, 'relic', 'anchor', '닻', '[]', '변형 ' || id FROM posts WHERE service = 'transfigure' AND id NOT IN (SELECT post_id FROM post_transfigure);
INSERT INTO post_this_or_that (post_id, left_type, left_id, right_type, right_id, reason, left_vote_count, right_vote_count)
SELECT id, 'card', 'bash', 'card', 'strike', '이유 ' || id, like_count, comment_count FROM posts
WHERE service = 'this_or_that' AND id NOT IN (SELECT post_id FROM post_this_or_that);
INSERT INTO post_favorite_tournament (post_id, note, preset_key, play_count)
SELECT id, '', CASE WHEN rowid_ord % 10 = 0 THEN 'builtin:k' || rowid_ord ELSE 'custom' END, rowid_ord % 9
FROM (SELECT id, row_number() OVER (ORDER BY id) AS rowid_ord FROM posts
      WHERE service = 'favorite_tournament' AND id NOT IN (SELECT post_id FROM post_favorite_tournament));
UPDATE posts SET user_id = NULL WHERE (service, id) IN (SELECT service, post_id FROM post_favorite_tournament WHERE substr(preset_key, 1, 8) = 'builtin:');
INSERT INTO post_favorite_tournament_pool (post_id, ord, resource_type, resource_id) SELECT post_id, 0, 'relic', 'anchor' FROM post_favorite_tournament WHERE post_id NOT IN (SELECT post_id FROM post_favorite_tournament_pool);
INSERT INTO post_favorite_tournament_pool (post_id, ord, resource_type, resource_id) SELECT post_id, 1, 'relic', 'burning_blood' FROM post_favorite_tournament WHERE post_id NOT IN (SELECT post_id FROM post_favorite_tournament_pool WHERE ord = 1);
INSERT INTO post_decisions_decisions (post_id, preset_key, game_version, "rows", placements)
SELECT id, 'cards', '0.107.1', '[]', '[]' FROM posts WHERE service = 'decisions_decisions' AND id NOT IN (SELECT post_id FROM post_decisions_decisions);
INSERT INTO post_pagestorm (post_id, content, content_text) SELECT id, '{}', '서류 ' || id FROM posts WHERE service = 'pagestorm' AND id NOT IN (SELECT post_id FROM post_pagestorm);
INSERT INTO post_history_course (post_id, seed, build, "character", ascension, win, start_time, run_time, acts_count, total_floors)
SELECT id, 'S' || id, 'v0.107.1', 'CHARACTER.SILENT', 5, 0, 1760000000 + length(id) * 1000 + unicode(substr(id, 16)), 1800, 3, 40
FROM posts WHERE service = 'history_course' AND id NOT IN (SELECT post_id FROM post_history_course);
INSERT INTO post_history_course_file (post_id, raw) SELECT post_id, '{"seed":"' || seed || '"}' FROM post_history_course WHERE post_id NOT IN (SELECT post_id FROM post_history_course_file);

WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 1500)
INSERT INTO comments (id, story_id, user_id, nickname, content, created_at)
SELECT printf('c%07x-0000-4000-8000-%012x', i, i),
       CASE i % 4 WHEN 0 THEN 'sts2-codex:card:c' || (i % 120) WHEN 1 THEN 'c-c-c-combo:' || printf('%08x-0000-4000-8000-%012x', 1 + 8 * (i % 90), 1 + 8 * (i % 90))
                  WHEN 2 THEN 'history-course:' || printf('r%015x', 7 + 8 * (i % 90)) ELSE 'community:e0000000-0000-4000-8000-00000000000' || (i % 3) END,
       printf('%08x-1111-4111-8111-111111111111', i % 50), '닉', '댓글 ' || i,
       strftime('%Y-%m-%dT%H:%M:%S', '2026-01-01', '+' || (i * 211) || ' minutes') || printf('.%06dZ', (i * 104729) % 1000000)
FROM n;
WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 1200)
INSERT OR IGNORE INTO likes (story_id, user_id, created_at)
SELECT CASE i % 2 WHEN 0 THEN 'sts2-codex:card:c' || (i % 120)
                  ELSE 'c-c-c-combo:' || printf('%08x-0000-4000-8000-%012x', 1 + 8 * (i % 90), 1 + 8 * (i % 90)) END,
       printf('%08x-1111-4111-8111-111111111111', i % 50), '2026-06-01T00:00:00.000000Z'
FROM n WHERE i % 3 <> 1;
WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 400)
INSERT OR IGNORE INTO this_or_that_post_likes (post_id, user_id, created_at)
SELECT printf('%08x-0000-4000-8000-%012x', 3 + 8 * (i % 90), 3 + 8 * (i % 90)),
       printf('%08x-1111-4111-8111-111111111111', i % 50), '2026-06-01T00:00:00.000000Z'
FROM n;
INSERT OR IGNORE INTO comment_likes (comment_id, user_id, created_at)
SELECT id, printf('%08x-1111-4111-8111-111111111111', (unicode(substr(id, 8)) * 7) % 50), created_at FROM comments WHERE substr(id, 1, 1) = 'c' AND id GLOB 'c*' AND (rowid % 3) = 0;
WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 300)
INSERT INTO community_stories (id, user_id, nickname, sentence, source, created_at)
SELECT printf('e%07x-0000-4000-8000-%012x', i, i), CASE WHEN i % 10 = 0 THEN NULL ELSE printf('%08x-1111-4111-8111-111111111111', i % 50) END,
       '닉', '이야기 문장 ' || i, 'v0.10' || (i % 9) || '.0',
       strftime('%Y-%m-%dT%H:%M:%S', '2026-01-01', '+' || (i * 977) || ' minutes') || '.000000Z'
FROM n;
WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 400)
INSERT OR IGNORE INTO resource_reactions (resource_id, resource_type, game_version, user_id, kind)
SELECT 'c' || (i % 120), 'card', '0.10' || (i % 3) || '.0', printf('%08x-1111-4111-8111-111111111111', i % 50),
       CASE i % 3 WHEN 0 THEN 'buff' WHEN 1 THEN 'nerf' ELSE 'rework' END FROM n;
INSERT OR IGNORE INTO resource_reaction_counts (resource_id, resource_type, game_version, buff_count, nerf_count, rework_count)
SELECT resource_id, resource_type, game_version, sum(kind = 'buff'), sum(kind = 'nerf'), sum(kind = 'rework')
FROM resource_reactions GROUP BY 1, 2, 3;
WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 200)
INSERT INTO this_or_that_post_votes (post_id, user_id, choice, created_at)
SELECT post_id, printf('%08x-1111-4111-8111-111111111111', n.i % 50), CASE n.i % 2 WHEN 0 THEN 'left' ELSE 'right' END,
       '2026-06-01T00:00:00.000000Z'
FROM n JOIN (SELECT post_id, row_number() OVER (ORDER BY post_id) AS k FROM post_this_or_that) t ON t.k = 1 + n.i % 100
WHERE true ON CONFLICT DO NOTHING;
WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 60)
INSERT INTO contact_inquiries (id, user_id, category, message, page_path, service_locale, game_locale, created_at)
SELECT printf('9%07x-0000-4000-8000-%012x', i, i), printf('%08x-1111-4111-8111-111111111111', i % 20), 'feedback',
       '의견을 남깁니다 ' || i, '/', 'ko', 'kor', strftime('%Y-%m-%dT%H:%M:%S', '2026-01-01', '+' || (i * 1777) || ' minutes') || '.000000Z'
FROM n;
WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 50)
INSERT OR IGNORE INTO puzzlebox_players (user_id, nickname, updated_at)
SELECT printf('%08x-1111-4111-8111-111111111111', i), '닉' || i, '2026-06-01T00:00:00.000000Z' FROM n;
WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 600)
INSERT INTO puzzlebox_runs (id, game, board, user_id, attempt, score, perfect, run, created_at)
SELECT 100 + i, CASE WHEN i % 4 = 0 THEN 'beta-quiz' ELSE 'connections' END, CAST(1 + i % 12 AS TEXT),
       printf('%08x-1111-4111-8111-111111111111', 1 + i % 50), 1, i % 5, (i % 5 = 4), '{}',
       strftime('%Y-%m-%dT%H:%M:%S', '2026-01-01', '+' || (i * 101) || ' minutes') || '.000000Z'
FROM n;
INSERT INTO puzzlebox_best (game, board, user_id, score, perfect, run_id, achieved_at, attempts)
SELECT game, board, user_id, score, perfect, id, created_at, 1 FROM puzzlebox_runs WHERE id >= 100
ON CONFLICT (game, board, user_id) DO NOTHING;
INSERT OR IGNORE INTO puzzlebox_board_stats (game, board) SELECT DISTINCT game, board FROM puzzlebox_best;
WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 60)
INSERT INTO colorful_philosopher_posts (id, week_start, slot, resource_type, resource_id, name_ko, name_en, body,
  game_version, created_at)
SELECT printf('d%07x-0000-4000-8000-%012x', i, i), date('2024-11-04', '+' || (7 * i) || ' days'),
       CASE i % 2 WHEN 0 THEN 'card' ELSE 'relic' END, CASE i % 2 WHEN 0 THEN 'card' ELSE 'relic' END,
       'r' || (i % 20), '이름', 'Name', '본문', '0.107.1', date('2024-11-04', '+' || (7 * i) || ' days') || 'T00:00:00.000000Z'
FROM n;

-- Derived fill, as the first copy does it: threads from likes and comments, comments.like_count.
INSERT INTO threads (thread_key, like_count, comment_count, last_comment_at, updated_at)
SELECT k, sum(l), sum(c), max(m), 1762560000000 FROM (
  SELECT story_id AS k, count(*) AS l, 0 AS c, NULL AS m FROM likes GROUP BY story_id
  UNION ALL
  SELECT story_id, 0, count(*), max(created_at) FROM comments GROUP BY story_id
) WHERE true GROUP BY k;
UPDATE comments SET like_count = (SELECT count(*) FROM comment_likes l WHERE l.comment_id = comments.id);

-- ---------------------------------------------------------------- cascade test (fails loudly)
CREATE TEMP TABLE _assert (name TEXT NOT NULL, ok INTEGER NOT NULL CHECK (ok = 1));
-- Deleting a tournament post removes its service row, pool, stats, plays.
DELETE FROM posts WHERE service = 'favorite_tournament' AND id = 'a0000000-0000-4000-8000-000000000005';
INSERT INTO _assert SELECT 'tournament cascade',
  (SELECT count(*) FROM post_favorite_tournament WHERE post_id = 'a0000000-0000-4000-8000-000000000005') = 0
  AND (SELECT count(*) FROM post_favorite_tournament_pool WHERE post_id = 'a0000000-0000-4000-8000-000000000005') = 0
  AND (SELECT count(*) FROM favorite_tournament_candidate_stats WHERE tournament_id = 'a0000000-0000-4000-8000-000000000005') = 0
  AND (SELECT count(*) FROM favorite_tournament_plays WHERE tournament_id = 'a0000000-0000-4000-8000-000000000005') = 0;
-- Deleting a combo post removes its resources and its 조각모음 body, but keeps its comments and likes
-- (thread keys have no FK, as today) and the threads row.
DELETE FROM posts WHERE service = 'combo' AND id = 'a0000000-0000-4000-8000-000000000002';
INSERT INTO _assert SELECT 'combo cascade',
  (SELECT count(*) FROM post_combo_resources WHERE post_id = 'a0000000-0000-4000-8000-000000000002') = 0
  AND (SELECT count(*) FROM defragment_bodies WHERE post_id = 'a0000000-0000-4000-8000-000000000002') = 0
  AND (SELECT count(*) FROM comments WHERE story_id = 'c-c-c-combo:a0000000-0000-4000-8000-000000000002') = 1
  AND (SELECT count(*) FROM threads WHERE thread_key = 'c-c-c-combo:a0000000-0000-4000-8000-000000000002') = 1;
-- Unsharing a run removes the run summary and the file.
DELETE FROM posts WHERE service = 'history_course' AND id = '0a1b2c3d4e5f6g7h';
INSERT INTO _assert SELECT 'run cascade',
  (SELECT count(*) FROM post_history_course WHERE post_id = '0a1b2c3d4e5f6g7h') = 0
  AND (SELECT count(*) FROM post_history_course_file WHERE post_id = '0a1b2c3d4e5f6g7h') = 0;
-- Deleting a this-or-that post (TW3) removes its votes and its likes by FK cascade, as the Postgres FKs
-- do today. Its thread row (comments, generic likes) stays.
INSERT INTO _assert SELECT 'this-or-that like before delete',
  (SELECT count(*) FROM this_or_that_post_likes WHERE service = 'this_or_that' AND post_id = 'a0000000-0000-4000-8000-000000000004') = 1;
DELETE FROM posts WHERE service = 'this_or_that' AND id = 'a0000000-0000-4000-8000-000000000004'
  AND user_id = '22222222-2222-4222-8222-222222222222';
INSERT INTO _assert SELECT 'this-or-that cascade',
  (SELECT count(*) FROM this_or_that_post_votes WHERE post_id = 'a0000000-0000-4000-8000-000000000004') = 0
  AND (SELECT count(*) FROM this_or_that_post_likes WHERE post_id = 'a0000000-0000-4000-8000-000000000004') = 0;
-- The same id in two services is two rows (Supabase keeps a key per post table): a combo post with the
-- transfigure post's id leaves the transfigure post and its owner alone, and deleting it removes only
-- its own rows.
INSERT INTO posts (service, id, user_id, nickname, avatar_id, avatar_kind, palette_id, palette_swapped, title, summary,
                   like_count, comment_count, created_at)
VALUES ('combo', 'a0000000-0000-4000-8000-000000000003', '22222222-2222-4222-8222-222222222222', '사일런트', NULL, NULL,
        NULL, 0, NULL, '같은 id', 0, 0, '2026-11-08T00:00:00.000000Z')
ON CONFLICT (service, id) DO UPDATE SET user_id = excluded.user_id, nickname = excluded.nickname, summary = excluded.summary;
INSERT INTO post_combo (service, post_id, content, content_text) VALUES ('combo', 'a0000000-0000-4000-8000-000000000003', '[]', '같은 id')
ON CONFLICT (service, post_id) DO UPDATE SET content = excluded.content, content_text = excluded.content_text;
INSERT INTO _assert SELECT 'same id in two services: two rows',
  (SELECT count(*) FROM posts WHERE id = 'a0000000-0000-4000-8000-000000000003') = 2
  AND (SELECT user_id || '|' || nickname FROM posts WHERE service = 'transfigure' AND id = 'a0000000-0000-4000-8000-000000000003')
    = '11111111-1111-4111-8111-111111111111|아이언클래드';
DELETE FROM posts WHERE service = 'combo' AND id = 'a0000000-0000-4000-8000-000000000003';
INSERT INTO _assert SELECT 'same id in two services: delete is per service',
  (SELECT count(*) FROM posts WHERE service = 'transfigure' AND id = 'a0000000-0000-4000-8000-000000000003') = 1
  AND (SELECT count(*) FROM post_transfigure WHERE post_id = 'a0000000-0000-4000-8000-000000000003') = 1
  AND (SELECT count(*) FROM post_combo WHERE post_id = 'a0000000-0000-4000-8000-000000000003') = 0;
-- Deleting a comment removes its comment likes.
DELETE FROM comments WHERE id = 'c0000000-0000-4000-8000-000000000001';
INSERT INTO _assert SELECT 'comment cascade',
  (SELECT count(*) FROM comment_likes WHERE comment_id = 'c0000000-0000-4000-8000-000000000001') = 0;
-- Put the representative rows back so the queries below have them.
INSERT INTO posts (id, service, user_id, nickname, title, summary, created_at) VALUES
('a0000000-0000-4000-8000-000000000005', 'favorite_tournament', NULL, '세 번째 손', '유물 월드컵', '유물 월드컵', '2026-11-01T00:00:04.000000Z'),
('a0000000-0000-4000-8000-000000000004', 'this_or_that', '22222222-2222-4222-8222-222222222222', '사일런트', NULL, '둘 중 하나', '2026-11-01T00:00:03.000000Z'),
('0a1b2c3d4e5f6g7h', 'history_course', '11111111-1111-4111-8111-111111111111', '아이언클래드', NULL, 'SEED123', '2026-11-01T00:00:07.123400Z');
INSERT INTO post_favorite_tournament (post_id, preset_key) VALUES ('a0000000-0000-4000-8000-000000000005', 'builtin:relics');
INSERT INTO post_favorite_tournament_pool (post_id, ord, resource_type, resource_id) VALUES ('a0000000-0000-4000-8000-000000000005', 0, 'relic', 'anchor'),
  ('a0000000-0000-4000-8000-000000000005', 1, 'relic', 'burning_blood');
INSERT INTO post_this_or_that (post_id, left_type, left_id, right_type, right_id, reason)
VALUES ('a0000000-0000-4000-8000-000000000004', 'card', 'bash', 'card', 'strike', '둘 다 좋다');
INSERT INTO this_or_that_post_likes (post_id, user_id, created_at)
VALUES ('a0000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111', '2026-11-05T12:00:00.000000Z');
INSERT INTO post_history_course (post_id, seed, build, "character", ascension, win, start_time, run_time, acts_count)
VALUES ('0a1b2c3d4e5f6g7h', 'SEED123', 'v0.107.1', 'CHARACTER.IRONCLAD', 10, 1, 1762300000, 3600, 3);
INSERT INTO post_history_course_file (post_id, raw) VALUES ('0a1b2c3d4e5f6g7h', '{"seed":"SEED123"}');
-- Rows that the cascade test removed, on surviving posts, so every table holds a representative row.
INSERT INTO favorite_tournament_plays (id, tournament_id, user_id, starting_size, champion_type, champion_id, matches, created_at)
VALUES ('f0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000005',
 '22222222-2222-4222-8222-222222222222', 2, 'relic', 'anchor',
 '[{"left_type":"relic","left_id":"burning_blood","right_type":"relic","right_id":"anchor","winner":"right"}]',
 '2026-11-02T00:00:00.000000Z');
INSERT INTO favorite_tournament_candidate_stats (tournament_id, resource_type, resource_id, match_appearances,
  match_wins, championships, current_rank, rank_history) VALUES
('a0000000-0000-4000-8000-000000000005', 'relic', 'anchor', 1, 1, 1, 1, '[{"at":"2026-11-02 00:00:00.000000","rank":1}]'),
('a0000000-0000-4000-8000-000000000005', 'relic', 'burning_blood', 1, 0, 0, 2, '[{"at":"2026-11-02 00:00:00.000000","rank":2}]');
INSERT INTO defragment_bodies (service, post_id, user_id, nickname, content, content_text, created_at, updated_at) VALUES
('combo', '00000009-0000-4000-8000-000000000009', '00000009-1111-4111-8111-111111111111', '닉9',
 '[{"type":"text","text":"본문"}]', '조각 본문', '2026-11-03T00:00:00.000000Z', '2026-11-03T00:00:00.000000Z');
INSERT INTO defragment_bodies (service, post_id, user_id, nickname, content, content_text, created_at, updated_at)
SELECT p.service, p.id, p.user_id, p.nickname, '[]', '조각 본문 ' || p.id, p.created_at, p.created_at FROM posts p
WHERE p.service IN ('combo', 'chemical_x') AND p.user_id IS NOT NULL
  AND (p.service, p.id) NOT IN (SELECT service, post_id FROM defragment_bodies);
INSERT INTO runtime_flags (key, value, updated_at, note) VALUES ('sync.supabase_in', 'off', '2026-11-08T00:00:00.000Z', 'fixture');
INSERT INTO runtime_flag_events (key, value, at, note) VALUES ('sync.supabase_in', 'off', '2026-11-08T00:00:00.000Z', 'fixture');
INSERT INTO api_cache (key, body, fetched_at) VALUES ('nav', '{}', 1762560000000);
SELECT name || ': ok' FROM _assert;
