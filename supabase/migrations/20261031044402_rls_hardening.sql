-- Close the 2026-10 security review items on write paths.
-- Rollout: db-first-additive. Order: before-push. No app change.
-- Every write the deployed app sends keeps its result: clients never send the
-- columns this file locks down. Only writes the app never makes start failing.
-- The file runs as one transaction: any failed check rolls back everything.

-- Fail fast instead of queueing the API behind this migration.
select pg_catalog.set_config('lock_timeout', '3s', true);

-- Take every table up front in the order sessions do (view, then its base table;
-- engagement row, then the post whose counter its trigger updates; tournament
-- post, then plays and stats) so this file cannot deadlock with a like-count
-- read, comment, like, or play in progress.
lock table
  public.this_or_that_post_like_counts,
  public.likes,
  public.comments,
  public.community_stories,
  public.this_or_that_post_likes,
  public.this_or_that_post_votes,
  public.resource_reactions,
  public.resource_reaction_counts,
  public.colorful_philosopher_reactions,
  public.defragment_bodies,
  public.pagestorm_drafts,
  public.combo_posts,
  public.transfigure_posts,
  public.this_or_that_posts,
  public.chemical_posts,
  public.defragment_posts,
  public.decisions_decisions_posts,
  public.pagestorm_posts,
  public.runs,
  public.favorite_tournament_posts,
  public.favorite_tournament_plays,
  public.favorite_tournament_candidate_stats
  in access exclusive mode;

-- 1. Server-managed columns.
-- Clients cannot choose counters or created_at on INSERT, or move them, id, or
-- env on UPDATE. The WHEN clause on each trigger limits this to client roles:
-- counter triggers and RPCs run as their SECURITY DEFINER owner, and seeds and
-- admin run as postgres or service_role, so those paths never enter PL/pgSQL.
-- The bodies assign fields only: no table access, serialization, or detoasting.
-- Owners cannot change user_id: the update policies pin it to auth.uid().
create or replace function public.guard_post_server_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.like_count := 0;
    new.comment_count := 0;
    new.created_at := now();
    if tg_table_name = 'this_or_that_posts' then
      new.left_vote_count := 0;
      new.right_vote_count := 0;
    elsif tg_table_name = 'favorite_tournament_posts' then
      new.play_count := 0;
    end if;
    return new;
  end if;

  new.id := old.id;
  new.env := old.env;
  new.like_count := old.like_count;
  new.comment_count := old.comment_count;
  new.created_at := old.created_at;
  if tg_table_name = 'this_or_that_posts' then
    new.left_vote_count := old.left_vote_count;
    new.right_vote_count := old.right_vote_count;
  elsif tg_table_name = 'favorite_tournament_posts' then
    new.play_count := old.play_count;
  end if;
  return new;
end;
$$;

revoke all on function public.guard_post_server_columns() from public, anon, authenticated;

-- Tables without an update policy get the same guard, so a later policy cannot
-- reopen the counters.
do $$
declare
  t text;
begin
  foreach t in array array[
    'combo_posts',
    'transfigure_posts',
    'this_or_that_posts',
    'chemical_posts',
    'defragment_posts',
    'decisions_decisions_posts',
    'pagestorm_posts',
    'favorite_tournament_posts',
    'runs'
  ] loop
    execute format('drop trigger if exists %I on public.%I', t || '_guard_server_columns', t);
    execute format(
      'create trigger %I before insert or update on public.%I for each row '
      || 'when (current_user in (''anon'', ''authenticated'')) '
      || 'execute function public.guard_post_server_columns()',
      t || '_guard_server_columns',
      t
    );
  end loop;
end
$$;

-- Comments and community stories have no client updates. Their timestamp orders
-- threads and feeds, and static_story_id renders a row as an official story.
create or replace function public.guard_insert_server_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.created_at := now();
  if tg_table_name = 'community_stories' then
    new.static_story_id := null;
  end if;
  return new;
end;
$$;

revoke all on function public.guard_insert_server_columns() from public, anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['comments', 'community_stories'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_guard_server_columns', t);
    execute format(
      'create trigger %I before insert on public.%I for each row '
      || 'when (current_user in (''anon'', ''authenticated'')) '
      || 'execute function public.guard_insert_server_columns()',
      t || '_guard_server_columns',
      t
    );
  end loop;
end
$$;

-- 2. Reactions: clients only change `kind`, so a row cannot move to another
-- resource or post and inflate the counter there.
revoke update on public.resource_reactions from anon, authenticated;
grant update (kind) on public.resource_reactions to authenticated;

drop policy if exists resource_reactions_update on public.resource_reactions;
create policy resource_reactions_update on public.resource_reactions
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke update on public.colorful_philosopher_reactions from anon, authenticated;
grant update (kind) on public.colorful_philosopher_reactions to authenticated;

-- 3. defragment_bodies: an overlay only for a source post the writer owns.
-- The app writes one right after creating that post. Each branch is a primary
-- key lookup; official tournaments have a null owner, so none can match.
create or replace function public.defragment_source_owned(p_service text, p_source_id uuid, p_env text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select case p_service
    when 'combo' then exists (
      select 1 from public.combo_posts s
      where s.id = p_source_id and s.env = p_env and s.user_id = (select auth.uid()))
    when 'transfigure' then exists (
      select 1 from public.transfigure_posts s
      where s.id = p_source_id and s.env = p_env and s.user_id = (select auth.uid()))
    when 'this_or_that' then exists (
      select 1 from public.this_or_that_posts s
      where s.id = p_source_id and s.env = p_env and s.user_id = (select auth.uid()))
    when 'chemical_x' then exists (
      select 1 from public.chemical_posts s
      where s.id = p_source_id and s.env = p_env and s.user_id = (select auth.uid()))
    when 'decisions_decisions' then exists (
      select 1 from public.decisions_decisions_posts s
      where s.id = p_source_id and s.env = p_env and s.user_id = (select auth.uid()))
    when 'favorite_tournament' then exists (
      select 1 from public.favorite_tournament_posts s
      where s.id = p_source_id and s.env = p_env and s.user_id = (select auth.uid()))
    when 'pagestorm' then exists (
      select 1 from public.pagestorm_posts s
      where s.id = p_source_id and s.env = p_env and s.user_id = (select auth.uid()))
    else false
  end;
$$;

revoke all on function public.defragment_source_owned(text, uuid, text) from public, anon, authenticated;
grant execute on function public.defragment_source_owned(text, uuid, text) to authenticated;

drop policy if exists "defragment_bodies_insert" on public.defragment_bodies;
create policy "defragment_bodies_insert" on public.defragment_bodies
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and public.defragment_source_owned(source_service, source_id, env)
  );

drop policy if exists "defragment_bodies_update" on public.defragment_bodies;
create policy "defragment_bodies_update" on public.defragment_bodies
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and public.defragment_source_owned(source_service, source_id, env)
  );

-- 4. complete_favorite_tournament_play: same signature and result. It now checks
-- the starting size against the pool, that both sides of every match are in the
-- pool, and that the champion won the last match. The client samples from the
-- same stored pool and appends the final last.
create or replace function public.complete_favorite_tournament_play(
  p_tournament_id uuid,
  p_env text,
  p_starting_size integer,
  p_champion_type text,
  p_champion_id text,
  p_matches jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  match_item jsonb;
  left_type text;
  left_id text;
  right_type text;
  right_id text;
  winner text;
  ranked record;
  rank_i integer := 0;
  snapshot jsonb;
  v_pool jsonb;
  v_final jsonb;
begin
  if actor is null then
    raise exception 'not authenticated';
  end if;
  if p_starting_size is null or p_starting_size < 2 then
    raise exception 'invalid starting size';
  end if;
  if jsonb_typeof(p_matches) is distinct from 'array' then
    raise exception 'invalid matches';
  end if;
  if jsonb_array_length(p_matches) <> (p_starting_size - 1) then
    raise exception 'match count must be starting size minus one';
  end if;

  select pool into v_pool
  from public.favorite_tournament_posts
  where id = p_tournament_id and env = p_env;
  if not found then
    raise exception 'tournament not found';
  end if;
  if p_starting_size > jsonb_array_length(v_pool) then
    raise exception 'starting size exceeds pool';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_matches) as m(value)
    cross join lateral (values
      (m.value->>'left_type', m.value->>'left_id'),
      (m.value->>'right_type', m.value->>'right_id')
    ) as side(resource_type, resource_id)
    where not exists (
      select 1 from jsonb_array_elements(v_pool) as p(value)
      where p.value->>'type' = side.resource_type
        and p.value->>'id' = side.resource_id
    )
  ) then
    raise exception 'match candidate outside pool';
  end if;
  v_final := p_matches -> (jsonb_array_length(p_matches) - 1);
  if p_champion_type is distinct from v_final->>((v_final->>'winner') || '_type')
    or p_champion_id is distinct from v_final->>((v_final->>'winner') || '_id') then
    raise exception 'champion must win the final match';
  end if;

  insert into public.favorite_tournament_plays (
    tournament_id, user_id, env, starting_size, champion_type, champion_id, matches
  ) values (
    p_tournament_id, actor, p_env, p_starting_size, p_champion_type, p_champion_id, p_matches
  );

  update public.favorite_tournament_posts
    set play_count = play_count + 1
    where id = p_tournament_id and env = p_env;

  for match_item in select value from jsonb_array_elements(p_matches)
  loop
    left_type := match_item->>'left_type';
    left_id := match_item->>'left_id';
    right_type := match_item->>'right_type';
    right_id := match_item->>'right_id';
    winner := match_item->>'winner';
    if left_type is null or left_id is null or right_type is null or right_id is null then
      raise exception 'invalid match';
    end if;
    if winner is distinct from 'left' and winner is distinct from 'right' then
      raise exception 'invalid winner';
    end if;

    insert into public.favorite_tournament_candidate_stats (
      tournament_id, env, resource_type, resource_id, match_appearances, match_wins
    ) values (
      p_tournament_id, p_env, left_type, left_id, 1, case when winner = 'left' then 1 else 0 end
    )
    on conflict (tournament_id, env, resource_type, resource_id)
    do update set
      match_appearances = public.favorite_tournament_candidate_stats.match_appearances + 1,
      match_wins = public.favorite_tournament_candidate_stats.match_wins
        + case when winner = 'left' then 1 else 0 end;

    insert into public.favorite_tournament_candidate_stats (
      tournament_id, env, resource_type, resource_id, match_appearances, match_wins
    ) values (
      p_tournament_id, p_env, right_type, right_id, 1, case when winner = 'right' then 1 else 0 end
    )
    on conflict (tournament_id, env, resource_type, resource_id)
    do update set
      match_appearances = public.favorite_tournament_candidate_stats.match_appearances + 1,
      match_wins = public.favorite_tournament_candidate_stats.match_wins
        + case when winner = 'right' then 1 else 0 end;
  end loop;

  insert into public.favorite_tournament_candidate_stats (
    tournament_id, env, resource_type, resource_id, championships
  ) values (
    p_tournament_id, p_env, p_champion_type, p_champion_id, 1
  )
  on conflict (tournament_id, env, resource_type, resource_id)
  do update set
    championships = public.favorite_tournament_candidate_stats.championships + 1;

  snapshot := jsonb_build_object('at', timezone('utc', now())::text);

  for ranked in
    select resource_type, resource_id, current_rank
    from public.favorite_tournament_candidate_stats
    where tournament_id = p_tournament_id and env = p_env
    order by
      championships desc,
      case when match_appearances > 0 then match_wins::numeric / match_appearances else 0 end desc,
      match_appearances desc,
      resource_type,
      resource_id
  loop
    rank_i := rank_i + 1;
    update public.favorite_tournament_candidate_stats
      set
        current_rank = rank_i,
        rank_history = case
          when ranked.current_rank is distinct from rank_i then
            rank_history || (snapshot || jsonb_build_object('rank', rank_i))
          else rank_history
        end
      where tournament_id = p_tournament_id
        and env = p_env
        and resource_type = ranked.resource_type
        and resource_id = ranked.resource_id;
  end loop;

  return jsonb_build_object('ok', true);
end;
$$;

-- 5. Run the like-count view as its caller. Anon can read the base table.
alter view public.this_or_that_post_like_counts set (security_invoker = true);

-- 6. Definer functions: temp tables cannot shadow public, and the two reaction
-- functions drop the EXECUTE default privilege the others already dropped.
-- Triggers do not need EXECUTE at fire time.
alter function public.apply_colorful_philosopher_reaction_counts() set search_path = public, pg_temp;
alter function public.apply_resource_reaction_counts() set search_path = public, pg_temp;
alter function public.apply_this_or_that_like_count_delta() set search_path = public, pg_temp;
alter function public.apply_this_or_that_vote_count_delta() set search_path = public, pg_temp;
alter function public.apply_toybox_thread_engagement_delta() set search_path = public, pg_temp;

revoke all on function public.apply_colorful_philosopher_reaction_counts() from public, anon, authenticated;
revoke all on function public.apply_resource_reaction_counts() from public, anon, authenticated;

-- 7. env values. Every env column in public now has this check.
do $$
declare
  t text;
begin
  foreach t in array array[
    'likes',
    'comments',
    'community_stories',
    'this_or_that_post_likes',
    'this_or_that_post_votes',
    'resource_reaction_counts',
    'defragment_bodies',
    'pagestorm_drafts',
    'combo_posts',
    'transfigure_posts',
    'this_or_that_posts',
    'chemical_posts',
    'defragment_posts',
    'decisions_decisions_posts',
    'pagestorm_posts',
    'runs',
    'favorite_tournament_posts',
    'favorite_tournament_plays',
    'favorite_tournament_candidate_stats'
  ] loop
    if not exists (
      select 1
      from pg_constraint
      where conname = t || '_env_check'
        and conrelid = format('public.%I', t)::regclass
    ) then
      execute format(
        'alter table public.%I add constraint %I check (env in (''production'', ''development''))',
        t,
        t || '_env_check'
      );
    end if;
  end loop;
end
$$;

-- 8. Payload caps. They bound abuse, not normal use: the largest stored values
-- on 2026-10-31 were 34 KB for a Pagestorm doc, 11 KB for a play, 9 KB for a
-- pool, 6 KB for decisions placements, 3 KB for extra_ids, and 84 KB for the
-- longest sampled run. A CHECK re-runs on every UPDATE, including each counter
-- change, so these read the stored size. pg_column_size and text octet_length
-- never detoast; octet_length(col::text) would serialize the document per like.
do $$
declare
  spec record;
begin
  for spec in
    select *
    from (values
      ('combo_posts', 'combo_posts_content_size_check',
        'pg_column_size(content) <= 1048576 and pg_column_size(resources) <= 131072'),
      ('chemical_posts', 'chemical_posts_content_size_check',
        'pg_column_size(content) <= 1048576'),
      ('defragment_posts', 'defragment_posts_content_size_check',
        'pg_column_size(content) <= 1048576'),
      ('defragment_bodies', 'defragment_bodies_content_size_check',
        'pg_column_size(content) <= 1048576'),
      ('pagestorm_posts', 'pagestorm_posts_content_size_check',
        'pg_column_size(content) <= 1048576'),
      ('pagestorm_drafts', 'pagestorm_drafts_content_size_check',
        'pg_column_size(content) <= 1048576'),
      ('transfigure_posts', 'transfigure_posts_content_size_check',
        'pg_column_size(content) <= 1048576 and pg_column_size(upgraded_content) <= 1048576'),
      ('transfigure_posts', 'transfigure_posts_text_size_check',
        'octet_length(source_text) <= 65536 and octet_length(content_text) <= 65536 and octet_length(upgraded_content_text) <= 65536'),
      ('decisions_decisions_posts', 'decisions_decisions_posts_layout_size_check',
        'pg_column_size("rows") <= 1048576 and pg_column_size(placements) <= 1048576 and pg_column_size(extra_ids) <= 131072'),
      ('favorite_tournament_posts', 'favorite_tournament_posts_pool_size_check',
        'pg_column_size(pool) <= 1048576'),
      ('favorite_tournament_plays', 'favorite_tournament_plays_matches_size_check',
        'pg_column_size(matches) <= 1048576'),
      ('comments', 'comments_blocks_size_check',
        'pg_column_size(content_blocks) <= 131072 and pg_column_size(meta) <= 131072'),
      ('community_stories', 'community_stories_refs_size_check',
        'pg_column_size(tags) <= 131072 and pg_column_size(linked_entities) <= 131072'),
      ('runs', 'runs_raw_size_check',
        'octet_length(raw) <= 8388608'),
      ('runs', 'runs_meta_size_check',
        'pg_column_size(note_blocks) <= 1048576 and pg_column_size(cover_spec) <= 1048576 and pg_column_size(badges) <= 131072 and pg_column_size(highlight_card) <= 131072 and pg_column_size(highlight_relic) <= 131072'),
      ('resource_reactions', 'resource_reactions_key_length_check',
        'char_length(resource_type) <= 32 and char_length(resource_id) <= 128 and char_length(game_version) <= 32')
    ) as v(tbl, con, expr)
  loop
    if not exists (
      select 1
      from pg_constraint
      where conname = spec.con
        and conrelid = format('public.%I', spec.tbl)::regclass
    ) then
      execute format(
        'alter table public.%I add constraint %I check (%s)',
        spec.tbl,
        spec.con,
        spec.expr
      );
    end if;
  end loop;
end
$$;

-- Author token snapshots: short ids from fixed site lists.
do $$
declare
  t text;
begin
  foreach t in array array[
    'comments',
    'community_stories',
    'combo_posts',
    'transfigure_posts',
    'this_or_that_posts',
    'chemical_posts',
    'defragment_posts',
    'decisions_decisions_posts',
    'pagestorm_posts',
    'pagestorm_drafts',
    'favorite_tournament_posts'
  ] loop
    if not exists (
      select 1
      from pg_constraint
      where conname = t || '_author_token_size_check'
        and conrelid = format('public.%I', t)::regclass
    ) then
      execute format(
        'alter table public.%I add constraint %I check ('
        || 'coalesce(octet_length(avatar_id), 0) + coalesce(octet_length(avatar_kind), 0) '
        || '+ coalesce(octet_length(palette_id), 0) <= 1024)',
        t,
        t || '_author_token_size_check'
      );
    end if;
  end loop;
end
$$;
