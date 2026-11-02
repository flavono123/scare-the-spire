-- Pre-checks for 20261031044402_rls_hardening.sql. One read-only statement, so
-- `supabase db query --linked -f` returns every row. Tables are small (under
-- 1,000 rows on 2026-10-31). Run it once, right before the push.
--
-- verdict:
--   ok     nothing to do
--   BLOCK  the migration would fail, or would break a live path. Stop.
--   INFO   no effect on the migration. Read it and decide.
--
-- A BLOCK cannot leave a partial state: the migration runs as one transaction.

with
caps(tbl, col, cap, measured) as (
  select * from (values
    ('combo_posts', 'content', 1048576, (select max(pg_column_size(content)) from public.combo_posts)),
    ('combo_posts', 'resources', 131072, (select max(pg_column_size(resources)) from public.combo_posts)),
    ('combo_posts', 'content_text', 65536, (select max(octet_length(content_text)) from public.combo_posts)),
    ('chemical_posts', 'content', 1048576, (select max(pg_column_size(content)) from public.chemical_posts)),
    ('defragment_posts', 'content', 1048576, (select max(pg_column_size(content)) from public.defragment_posts)),
    ('defragment_bodies', 'content', 1048576, (select max(pg_column_size(content)) from public.defragment_bodies)),
    ('pagestorm_posts', 'content', 1048576, (select max(pg_column_size(content)) from public.pagestorm_posts)),
    ('pagestorm_drafts', 'content', 1048576, (select max(pg_column_size(content)) from public.pagestorm_drafts)),
    ('transfigure_posts', 'content', 1048576, (select max(pg_column_size(content)) from public.transfigure_posts)),
    ('transfigure_posts', 'upgraded_content', 1048576, (select max(pg_column_size(upgraded_content)) from public.transfigure_posts)),
    ('transfigure_posts', 'source_text', 65536, (select max(octet_length(source_text)) from public.transfigure_posts)),
    ('transfigure_posts', 'content_text', 65536, (select max(octet_length(content_text)) from public.transfigure_posts)),
    ('transfigure_posts', 'upgraded_content_text', 65536, (select max(octet_length(upgraded_content_text)) from public.transfigure_posts)),
    ('decisions_decisions_posts', 'rows', 1048576, (select max(pg_column_size("rows")) from public.decisions_decisions_posts)),
    ('decisions_decisions_posts', 'placements', 1048576, (select max(pg_column_size(placements)) from public.decisions_decisions_posts)),
    ('decisions_decisions_posts', 'extra_ids', 131072, (select max(pg_column_size(extra_ids)) from public.decisions_decisions_posts)),
    ('favorite_tournament_posts', 'pool', 1048576, (select max(pg_column_size(pool)) from public.favorite_tournament_posts)),
    ('favorite_tournament_plays', 'matches', 1048576, (select max(pg_column_size(matches)) from public.favorite_tournament_plays)),
    ('comments', 'content_blocks', 131072, (select max(pg_column_size(content_blocks)) from public.comments)),
    ('comments', 'meta', 131072, (select max(pg_column_size(meta)) from public.comments)),
    ('community_stories', 'tags', 131072, (select max(pg_column_size(tags)) from public.community_stories)),
    ('community_stories', 'linked_entities', 131072, (select max(pg_column_size(linked_entities)) from public.community_stories)),
    ('runs', 'raw', 8388608, (select max(octet_length(raw)) from public.runs)),
    ('runs', 'note_blocks', 1048576, (select max(pg_column_size(note_blocks)) from public.runs)),
    ('runs', 'cover_spec', 1048576, (select max(pg_column_size(cover_spec)) from public.runs)),
    ('runs', 'badges', 131072, (select max(pg_column_size(badges)) from public.runs)),
    ('runs', 'highlight_card', 131072, (select max(pg_column_size(highlight_card)) from public.runs)),
    ('runs', 'highlight_relic', 131072, (select max(pg_column_size(highlight_relic)) from public.runs)),
    ('resource_reactions', 'resource_id (chars)', 128, (select max(char_length(resource_id)) from public.resource_reactions)),
    ('resource_reactions', 'resource_type (chars)', 32, (select max(char_length(resource_type)) from public.resource_reactions)),
    ('resource_reactions', 'game_version (chars)', 32, (select max(char_length(game_version)) from public.resource_reactions)),
    ('likes', 'story_id', 1024, (select max(octet_length(story_id)) from public.likes)),
    ('comments', 'story_id', 1024, (select max(octet_length(story_id)) from public.comments)),
    ('community_stories', 'entity_type', 1024, (select max(octet_length(entity_type)) from public.community_stories)),
    ('community_stories', 'entity_id', 1024, (select max(octet_length(entity_id)) from public.community_stories)),
    ('community_stories', 'change_id', 1024, (select max(octet_length(change_id)) from public.community_stories)),
    ('community_stories', 'patch_line_id', 1024, (select max(octet_length(patch_line_id)) from public.community_stories)),
    ('community_stories', 'source', 1024, (select max(octet_length(source)) from public.community_stories)),
    ('community_stories', 'static_story_id', 1024, (select max(octet_length(static_story_id)) from public.community_stories)),
    ('this_or_that_posts', 'left_type', 1024, (select max(octet_length(left_type)) from public.this_or_that_posts)),
    ('this_or_that_posts', 'left_id', 1024, (select max(octet_length(left_id)) from public.this_or_that_posts)),
    ('this_or_that_posts', 'right_type', 1024, (select max(octet_length(right_type)) from public.this_or_that_posts)),
    ('this_or_that_posts', 'right_id', 1024, (select max(octet_length(right_id)) from public.this_or_that_posts)),
    ('transfigure_posts', 'title', 1024, (select max(octet_length(title)) from public.transfigure_posts)),
    ('transfigure_posts', 'transformed_name', 1024, (select max(octet_length(transformed_name)) from public.transfigure_posts)),
    ('transfigure_posts', 'transformed_cost', 1024, (select max(octet_length(transformed_cost)) from public.transfigure_posts)),
    ('transfigure_posts', 'transformed_star_cost', 1024, (select max(octet_length(transformed_star_cost)) from public.transfigure_posts)),
    ('transfigure_posts', 'transformed_upgrade_cost', 1024, (select max(octet_length(transformed_upgrade_cost)) from public.transfigure_posts)),
    ('transfigure_posts', 'transformed_upgrade_star_cost', 1024, (select max(octet_length(transformed_upgrade_star_cost)) from public.transfigure_posts)),
    ('transfigure_posts', 'card_top_keywords', 1024, (select max(pg_column_size(card_top_keywords)) from public.transfigure_posts)),
    ('transfigure_posts', 'card_bottom_keywords', 1024, (select max(pg_column_size(card_bottom_keywords)) from public.transfigure_posts)),
    ('transfigure_posts', 'upgraded_card_top_keywords', 1024, (select max(pg_column_size(upgraded_card_top_keywords)) from public.transfigure_posts)),
    ('transfigure_posts', 'upgraded_card_bottom_keywords', 1024, (select max(pg_column_size(upgraded_card_bottom_keywords)) from public.transfigure_posts)),
    ('runs', 'id', 1024, (select max(octet_length(id)) from public.runs)),
    ('runs', 'seed', 1024, (select max(octet_length(seed)) from public.runs)),
    ('runs', 'build', 1024, (select max(octet_length(build)) from public.runs)),
    ('runs', 'character', 1024, (select max(octet_length("character")) from public.runs)),
    ('runs', 'donor_nickname', 1024, (select max(octet_length(donor_nickname)) from public.runs))
  ) as v(tbl, col, cap, measured)
),
tokens(tbl, measured) as (
  select * from (values
    ('comments', (select max(coalesce(octet_length(avatar_id), 0) + coalesce(octet_length(avatar_kind), 0) + coalesce(octet_length(palette_id), 0)) from public.comments)),
    ('community_stories', (select max(coalesce(octet_length(avatar_id), 0) + coalesce(octet_length(avatar_kind), 0) + coalesce(octet_length(palette_id), 0)) from public.community_stories)),
    ('combo_posts', (select max(coalesce(octet_length(avatar_id), 0) + coalesce(octet_length(avatar_kind), 0) + coalesce(octet_length(palette_id), 0)) from public.combo_posts)),
    ('transfigure_posts', (select max(coalesce(octet_length(avatar_id), 0) + coalesce(octet_length(avatar_kind), 0) + coalesce(octet_length(palette_id), 0)) from public.transfigure_posts)),
    ('this_or_that_posts', (select max(coalesce(octet_length(avatar_id), 0) + coalesce(octet_length(avatar_kind), 0) + coalesce(octet_length(palette_id), 0)) from public.this_or_that_posts)),
    ('chemical_posts', (select max(coalesce(octet_length(avatar_id), 0) + coalesce(octet_length(avatar_kind), 0) + coalesce(octet_length(palette_id), 0)) from public.chemical_posts)),
    ('defragment_posts', (select max(coalesce(octet_length(avatar_id), 0) + coalesce(octet_length(avatar_kind), 0) + coalesce(octet_length(palette_id), 0)) from public.defragment_posts)),
    ('decisions_decisions_posts', (select max(coalesce(octet_length(avatar_id), 0) + coalesce(octet_length(avatar_kind), 0) + coalesce(octet_length(palette_id), 0)) from public.decisions_decisions_posts)),
    ('pagestorm_posts', (select max(coalesce(octet_length(avatar_id), 0) + coalesce(octet_length(avatar_kind), 0) + coalesce(octet_length(palette_id), 0)) from public.pagestorm_posts)),
    ('pagestorm_drafts', (select max(coalesce(octet_length(avatar_id), 0) + coalesce(octet_length(avatar_kind), 0) + coalesce(octet_length(palette_id), 0)) from public.pagestorm_drafts)),
    ('favorite_tournament_posts', (select max(coalesce(octet_length(avatar_id), 0) + coalesce(octet_length(avatar_kind), 0) + coalesce(octet_length(palette_id), 0)) from public.favorite_tournament_posts))
  ) as v(tbl, measured)
),
envs(tbl, outside) as (
  select 'likes', count(*) filter (where env not in ('production', 'development')) from public.likes
  union all select 'comments', count(*) filter (where env not in ('production', 'development')) from public.comments
  union all select 'community_stories', count(*) filter (where env not in ('production', 'development')) from public.community_stories
  union all select 'this_or_that_post_likes', count(*) filter (where env not in ('production', 'development')) from public.this_or_that_post_likes
  union all select 'this_or_that_post_votes', count(*) filter (where env not in ('production', 'development')) from public.this_or_that_post_votes
  union all select 'resource_reaction_counts', count(*) filter (where env not in ('production', 'development')) from public.resource_reaction_counts
  union all select 'defragment_bodies', count(*) filter (where env not in ('production', 'development')) from public.defragment_bodies
  union all select 'pagestorm_drafts', count(*) filter (where env not in ('production', 'development')) from public.pagestorm_drafts
  union all select 'combo_posts', count(*) filter (where env not in ('production', 'development')) from public.combo_posts
  union all select 'transfigure_posts', count(*) filter (where env not in ('production', 'development')) from public.transfigure_posts
  union all select 'this_or_that_posts', count(*) filter (where env not in ('production', 'development')) from public.this_or_that_posts
  union all select 'chemical_posts', count(*) filter (where env not in ('production', 'development')) from public.chemical_posts
  union all select 'defragment_posts', count(*) filter (where env not in ('production', 'development')) from public.defragment_posts
  union all select 'decisions_decisions_posts', count(*) filter (where env not in ('production', 'development')) from public.decisions_decisions_posts
  union all select 'pagestorm_posts', count(*) filter (where env not in ('production', 'development')) from public.pagestorm_posts
  union all select 'runs', count(*) filter (where env not in ('production', 'development')) from public.runs
  union all select 'favorite_tournament_posts', count(*) filter (where env not in ('production', 'development')) from public.favorite_tournament_posts
  union all select 'favorite_tournament_plays', count(*) filter (where env not in ('production', 'development')) from public.favorite_tournament_plays
  union all select 'favorite_tournament_candidate_stats', count(*) filter (where env not in ('production', 'development')) from public.favorite_tournament_candidate_stats
),
required_columns(tbl, col) as (
  select * from (values
    ('comments', 'parent_id'), ('comments', 'meta'), ('comments', 'avatar_id'),
    ('community_stories', 'static_story_id'), ('community_stories', 'linked_entities'),
    ('runs', 'like_count'), ('runs', 'comment_count'), ('runs', 'highlight_card'),
    ('runs', 'highlight_relic'), ('runs', 'cover_spec'), ('runs', 'note_blocks'), ('runs', 'badges'),
    ('this_or_that_posts', 'left_vote_count'), ('this_or_that_posts', 'right_vote_count'),
    ('favorite_tournament_posts', 'play_count'), ('pagestorm_drafts', 'avatar_id'),
    ('transfigure_posts', 'upgraded_content_text'), ('resource_reactions', 'game_version')
  ) as v(tbl, col)
),
foreign_overlays(n) as (
  select count(*)
  from public.defragment_bodies b
  where not exists (
    select 1 from (
      select 'combo' as service, id, env, user_id from public.combo_posts
      union all select 'transfigure', id, env, user_id from public.transfigure_posts
      union all select 'this_or_that', id, env, user_id from public.this_or_that_posts
      union all select 'chemical_x', id, env, user_id from public.chemical_posts
      union all select 'decisions_decisions', id, env, user_id from public.decisions_decisions_posts
      union all select 'favorite_tournament', id, env, user_id from public.favorite_tournament_posts
      union all select 'pagestorm', id, env, user_id from public.pagestorm_posts
    ) s
    where s.service = b.source_service and s.id = b.source_id and s.env = b.env and s.user_id = b.user_id
  )
),
bad_plays(n) as (
  select count(*)
  from public.favorite_tournament_plays p
  join public.favorite_tournament_posts t on t.id = p.tournament_id and t.env = p.env
  where p.starting_size > jsonb_array_length(t.pool)
    or p.champion_id is distinct from (p.matches -> -1) ->> (((p.matches -> -1) ->> 'winner') || '_id')
    or p.champion_type is distinct from (p.matches -> -1) ->> (((p.matches -> -1) ->> 'winner') || '_type')
    or exists (
      select 1
      from jsonb_array_elements(p.matches) as m(value)
      cross join lateral (values
        (m.value->>'left_type', m.value->>'left_id'),
        (m.value->>'right_type', m.value->>'right_id')
      ) as side(resource_type, resource_id)
      where not exists (
        select 1 from jsonb_array_elements(t.pool) as e(value)
        where e.value->>'type' = side.resource_type and e.value->>'id' = side.resource_id
      )
    )
),
like_drift(tbl, drifted, max_abs) as (
  select v.tbl, count(*) filter (where v.stored <> v.actual), coalesce(max(abs(v.stored - v.actual)), 0)
  from (
    select 'combo_posts' as tbl, p.like_count as stored, (select count(*) from public.likes l where l.env = p.env and l.story_id = 'c-c-c-combo:' || p.id) as actual from public.combo_posts p
    union all select 'transfigure_posts', p.like_count, (select count(*) from public.likes l where l.env = p.env and l.story_id = 'transfigure:' || p.id) from public.transfigure_posts p
    union all select 'chemical_posts', p.like_count, (select count(*) from public.likes l where l.env = p.env and l.story_id = 'chemical-x:' || p.id) from public.chemical_posts p
    union all select 'defragment_posts', p.like_count, (select count(*) from public.likes l where l.env = p.env and l.story_id = 'defragment:' || p.id) from public.defragment_posts p
    union all select 'decisions_decisions_posts', p.like_count, (select count(*) from public.likes l where l.env = p.env and l.story_id = 'decisions-decisions:' || p.id) from public.decisions_decisions_posts p
    union all select 'favorite_tournament_posts', p.like_count, (select count(*) from public.likes l where l.env = p.env and l.story_id = 'favorite-tournament:' || p.id) from public.favorite_tournament_posts p
    union all select 'pagestorm_posts', p.like_count, (select count(*) from public.likes l where l.env = p.env and l.story_id = 'pagestorm:' || p.id) from public.pagestorm_posts p
    union all select 'runs', p.like_count, (select count(*) from public.likes l where l.env = p.env and l.story_id = 'history-course:' || p.id) from public.runs p
    union all select 'this_or_that_posts', p.like_count, (select count(*) from public.this_or_that_post_likes l where l.env = p.env and l.post_id = p.id) from public.this_or_that_posts p
  ) v
  group by v.tbl
),
comment_drift(tbl, drifted, max_abs) as (
  select v.tbl, count(*) filter (where v.stored <> v.actual), coalesce(max(abs(v.stored - v.actual)), 0)
  from (
    select 'combo_posts' as tbl, p.comment_count as stored, (select count(*) from public.comments c where c.env = p.env and c.story_id = 'c-c-c-combo:' || p.id) as actual from public.combo_posts p
    union all select 'transfigure_posts', p.comment_count, (select count(*) from public.comments c where c.env = p.env and c.story_id = 'transfigure:' || p.id) from public.transfigure_posts p
    union all select 'this_or_that_posts', p.comment_count, (select count(*) from public.comments c where c.env = p.env and c.story_id = 'this-or-that:' || p.id) from public.this_or_that_posts p
    union all select 'chemical_posts', p.comment_count, (select count(*) from public.comments c where c.env = p.env and c.story_id = 'chemical-x:' || p.id) from public.chemical_posts p
    union all select 'defragment_posts', p.comment_count, (select count(*) from public.comments c where c.env = p.env and c.story_id = 'defragment:' || p.id) from public.defragment_posts p
    union all select 'decisions_decisions_posts', p.comment_count, (select count(*) from public.comments c where c.env = p.env and c.story_id = 'decisions-decisions:' || p.id) from public.decisions_decisions_posts p
    union all select 'favorite_tournament_posts', p.comment_count, (select count(*) from public.comments c where c.env = p.env and c.story_id = 'favorite-tournament:' || p.id) from public.favorite_tournament_posts p
    union all select 'pagestorm_posts', p.comment_count, (select count(*) from public.comments c where c.env = p.env and c.story_id = 'pagestorm:' || p.id) from public.pagestorm_posts p
    union all select 'runs', p.comment_count, (select count(*) from public.comments c where c.env = p.env and c.story_id = 'history-course:' || p.id) from public.runs p
  ) v
  group by v.tbl
),
checks(ord, verdict, name, detail) as (
  -- 1. Things the migration needs from the server.
  select 1, case when current_setting('server_version_num')::int >= 150000 then 'ok' else 'BLOCK' end,
    'postgres >= 15 (security_invoker)', current_setting('server_version')
  union all
  select 2, case when count(*) = 0 then 'ok' else 'BLOCK' end,
    'tables not owned by postgres', coalesce(string_agg(c.relname, ', '), '')
  from pg_class c
  where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'v')
    and pg_get_userbyid(c.relowner) <> 'postgres'
  union all
  select 3, case when count(*) = 0 then 'ok' else 'BLOCK' end,
    'definer functions owned by a client role (the guard would reset their counter writes)',
    coalesce(string_agg(p.proname, ', '), '')
  from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.prosecdef
    and pg_get_userbyid(p.proowner) in ('anon', 'authenticated')
  union all
  select 4, case when count(*) = 0 then 'ok' else 'BLOCK' end,
    'required columns missing (schema drift against the repo)', coalesce(string_agg(r.tbl || '.' || r.col, ', '), '')
  from required_columns r
  where not exists (
    select 1 from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = r.tbl and c.column_name = r.col
  )
  union all
  select 5, case when has_table_privilege('anon', 'public.this_or_that_post_likes', 'select')
      and has_table_privilege('authenticated', 'public.this_or_that_post_likes', 'select') then 'ok' else 'BLOCK' end,
    'anon and authenticated read the like-count view base table', ''
  union all
  select 6, case when count(*) = 0 then 'ok' else 'BLOCK' end,
    'existing triggers would be replaced by this file', coalesce(string_agg(t.tgname, ', '), '')
  from pg_trigger t
  where not t.tgisinternal and t.tgname like '%_guard_server_columns'
  union all
  select 7, case when count(*) = 0 then 'ok' else 'BLOCK' end,
    'env or size constraint names already taken', coalesce(string_agg(k.conname, ', '), '')
  from pg_constraint k
  where k.connamespace = 'public'::regnamespace
    and (k.conname ~ '_(content|text|layout|pool|matches|blocks|refs|raw|meta|key|author_token)_size_check$'
      or k.conname = 'resource_reactions_key_length_check'
      or k.conname in (select e.tbl || '_env_check' from envs e))
  union all
  select 8, case when count(*) = 0 then 'ok' else 'INFO' end,
    'client transactions older than 5 s (lock_timeout aborts the push after 3 s if one holds a lock)',
    coalesce(string_agg(pid::text || ' ' || coalesce(usename::text, ''), ', '), '')
  from pg_stat_activity
  where datname = current_database()
    and pid <> pg_backend_pid()
    and backend_type = 'client backend'
    and state is distinct from 'idle'
    and xact_start < now() - interval '5 seconds'
  -- 2. Existing rows against the new checks. Anything here aborts the migration.
  union all
  select 10, case when coalesce(sum(outside), 0) = 0 then 'ok' else 'BLOCK' end,
    'rows with env outside production/development',
    coalesce(string_agg(tbl || '=' || outside, ', ') filter (where outside > 0), '')
  from envs
  union all
  select 11, case when count(*) filter (where measured > cap) = 0 then 'ok' else 'BLOCK' end,
    'capped columns over their cap',
    coalesce(string_agg(tbl || '.' || col || '=' || measured, ', ') filter (where measured > cap), '')
  from caps
  union all
  select 12, 'INFO', 'largest values against caps (top 8 by share of cap)',
    (select string_agg(x.tbl || '.' || x.col || ' ' || x.measured || '/' || x.cap, ', ')
     from (select * from caps where measured is not null order by measured::numeric / cap desc limit 8) x)
  union all
  select 13, case when count(*) filter (where measured > 1024) = 0 then 'ok' else 'BLOCK' end,
    'author token snapshots over 1024 bytes',
    coalesce(string_agg(tbl || '=' || measured, ', ') filter (where measured > 1024), '')
  from tokens
  -- 3. Facts to read. None of these block.
  union all
  select 20, 'INFO', 'overlays not owned by their source post author (stay readable, become uneditable)', n::text
  from foreign_overlays
  union all
  select 21, 'INFO', 'past plays that the new RPC rules would refuse (kept, stats unchanged)', n::text
  from bad_plays
  union all
  select 22, 'INFO', 'posts whose like_count differs from likes rows (not corrected by this file)',
    coalesce(string_agg(tbl || ': ' || drifted || ' rows, max off by ' || max_abs, '; ') filter (where drifted > 0), 'none')
  from like_drift
  union all
  select 23, 'INFO', 'posts whose comment_count differs from comments rows (not corrected by this file)',
    coalesce(string_agg(tbl || ': ' || drifted || ' rows, max off by ' || max_abs, '; ') filter (where drifted > 0), 'none')
  from comment_drift
  union all
  select 24, 'INFO', 'rows with a future created_at (spoofed, not corrected by this file)',
    (select (
      (select count(*) from public.combo_posts where created_at > now())
      + (select count(*) from public.transfigure_posts where created_at > now())
      + (select count(*) from public.this_or_that_posts where created_at > now())
      + (select count(*) from public.chemical_posts where created_at > now())
      + (select count(*) from public.defragment_posts where created_at > now())
      + (select count(*) from public.decisions_decisions_posts where created_at > now())
      + (select count(*) from public.pagestorm_posts where created_at > now())
      + (select count(*) from public.favorite_tournament_posts where created_at > now())
      + (select count(*) from public.runs where created_at > now())
      + (select count(*) from public.comments where created_at > now())
      + (select count(*) from public.community_stories where created_at > now())
    )::text)
  union all
  select 25, 'INFO', 'community stories with static_story_id and a user_id (a client claimed an official id)',
    (select count(*)::text from public.community_stories where static_story_id is not null and user_id is not null)
)
select verdict, name, detail
from checks
order by ord;
