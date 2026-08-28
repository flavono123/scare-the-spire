-- Favorite Tournament (이상형 월드컵) posts, candidate stats, and completed plays.
-- DB-first additive: unused until the new app writes.
-- Do not expand get_defragment_feed or defragment_bodies — 조각모음 stays closed.

create table if not exists public.favorite_tournament_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 20),
  title text not null check (char_length(title) between 1 and 80),
  note text not null default '' check (char_length(note) <= 500),
  preset_key text not null check (char_length(preset_key) between 1 and 64),
  game_version text not null check (char_length(game_version) between 1 and 32),
  pool jsonb not null check (jsonb_typeof(pool) = 'array'),
  env text not null default 'production',
  like_count integer not null default 0,
  comment_count integer not null default 0,
  play_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_favorite_tournament_posts_env_created
  on public.favorite_tournament_posts (env, created_at desc, id desc);
create index if not exists idx_favorite_tournament_posts_env_user_created
  on public.favorite_tournament_posts (env, user_id, created_at desc);
create index if not exists idx_favorite_tournament_posts_env_comment_created
  on public.favorite_tournament_posts (env, comment_count desc, created_at desc, id desc);
create index if not exists idx_favorite_tournament_posts_env_recommend_created
  on public.favorite_tournament_posts (
    env,
    ((like_count * 4) + (comment_count * 6)) desc,
    created_at desc,
    id desc
  );
create index if not exists idx_favorite_tournament_posts_env_play_created
  on public.favorite_tournament_posts (env, play_count desc, created_at desc, id desc);

alter table public.favorite_tournament_posts enable row level security;

drop policy if exists "favorite_tournament_posts_read" on public.favorite_tournament_posts;
create policy "favorite_tournament_posts_read" on public.favorite_tournament_posts
  for select using (true);

drop policy if exists "favorite_tournament_posts_insert" on public.favorite_tournament_posts;
create policy "favorite_tournament_posts_insert" on public.favorite_tournament_posts
  for insert with check (auth.uid() = user_id);

drop policy if exists "favorite_tournament_posts_delete" on public.favorite_tournament_posts;
create policy "favorite_tournament_posts_delete" on public.favorite_tournament_posts
  for delete using (auth.uid() = user_id);

grant select, insert, delete
  on public.favorite_tournament_posts
  to anon, authenticated;

create table if not exists public.favorite_tournament_candidate_stats (
  tournament_id uuid not null references public.favorite_tournament_posts(id) on delete cascade,
  env text not null default 'production',
  resource_type text not null,
  resource_id text not null,
  match_appearances integer not null default 0,
  match_wins integer not null default 0,
  championships integer not null default 0,
  current_rank integer,
  rank_history jsonb not null default '[]'::jsonb,
  primary key (tournament_id, env, resource_type, resource_id)
);

create index if not exists idx_favorite_tournament_stats_rank
  on public.favorite_tournament_candidate_stats (
    tournament_id,
    env,
    championships desc,
    match_wins desc
  );

alter table public.favorite_tournament_candidate_stats enable row level security;

drop policy if exists "favorite_tournament_stats_read"
  on public.favorite_tournament_candidate_stats;
create policy "favorite_tournament_stats_read"
  on public.favorite_tournament_candidate_stats
  for select using (true);

grant select on public.favorite_tournament_candidate_stats to anon, authenticated;

create table if not exists public.favorite_tournament_plays (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.favorite_tournament_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  env text not null default 'production',
  starting_size integer not null check (starting_size >= 2),
  champion_type text not null,
  champion_id text not null,
  matches jsonb not null check (jsonb_typeof(matches) = 'array'),
  created_at timestamptz not null default now()
);

create index if not exists idx_favorite_tournament_plays_tournament_created
  on public.favorite_tournament_plays (tournament_id, env, created_at desc);

alter table public.favorite_tournament_plays enable row level security;

drop policy if exists "favorite_tournament_plays_read" on public.favorite_tournament_plays;
create policy "favorite_tournament_plays_read" on public.favorite_tournament_plays
  for select using (true);

grant select on public.favorite_tournament_plays to anon, authenticated;

create or replace function public.apply_toybox_thread_engagement_delta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
  delta integer;
  prefix text;
  post_id uuid;
  kind text := tg_argv[0];
begin
  if tg_op = 'INSERT' then
    rec := new;
    delta := 1;
  elsif tg_op = 'DELETE' then
    rec := old;
    delta := -1;
  else
    return coalesce(new, old);
  end if;

  prefix := split_part(rec.story_id, ':', 1);
  begin
    post_id := split_part(rec.story_id, ':', 2)::uuid;
  exception
    when invalid_text_representation then
      return rec;
    when data_exception then
      return rec;
  end;

  if kind = 'comment' then
    if prefix = 'c-c-c-combo' then
      update public.combo_posts
        set comment_count = greatest(0, comment_count + delta)
        where id = post_id and env = rec.env;
    elsif prefix = 'transfigure' then
      update public.transfigure_posts
        set comment_count = greatest(0, comment_count + delta)
        where id = post_id and env = rec.env;
    elsif prefix = 'this-or-that' then
      update public.this_or_that_posts
        set comment_count = greatest(0, comment_count + delta)
        where id = post_id and env = rec.env;
    elsif prefix = 'chemical-x' then
      update public.chemical_posts
        set comment_count = greatest(0, comment_count + delta)
        where id = post_id and env = rec.env;
    elsif prefix = 'defragment' then
      update public.defragment_posts
        set comment_count = greatest(0, comment_count + delta)
        where id = post_id and env = rec.env;
    elsif prefix = 'decisions-decisions' then
      update public.decisions_decisions_posts
        set comment_count = greatest(0, comment_count + delta)
        where id = post_id and env = rec.env;
    elsif prefix = 'favorite-tournament' then
      update public.favorite_tournament_posts
        set comment_count = greatest(0, comment_count + delta)
        where id = post_id and env = rec.env;
    end if;
  elsif kind = 'like' then
    if prefix = 'c-c-c-combo' then
      update public.combo_posts
        set like_count = greatest(0, like_count + delta)
        where id = post_id and env = rec.env;
    elsif prefix = 'transfigure' then
      update public.transfigure_posts
        set like_count = greatest(0, like_count + delta)
        where id = post_id and env = rec.env;
    elsif prefix = 'chemical-x' then
      update public.chemical_posts
        set like_count = greatest(0, like_count + delta)
        where id = post_id and env = rec.env;
    elsif prefix = 'defragment' then
      update public.defragment_posts
        set like_count = greatest(0, like_count + delta)
        where id = post_id and env = rec.env;
    elsif prefix = 'decisions-decisions' then
      update public.decisions_decisions_posts
        set like_count = greatest(0, like_count + delta)
        where id = post_id and env = rec.env;
    elsif prefix = 'favorite-tournament' then
      update public.favorite_tournament_posts
        set like_count = greatest(0, like_count + delta)
        where id = post_id and env = rec.env;
    end if;
  end if;

  return rec;
end;
$$;

revoke all on function public.apply_toybox_thread_engagement_delta() from public, anon, authenticated;

create or replace function public.get_toybox_feed(
  p_env text,
  p_service text,
  p_sort text default 'latest',
  p_limit integer default 20,
  p_cursor_score bigint default null,
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null
)
returns table (
  id uuid,
  created_at timestamptz,
  like_count integer,
  comment_count integer,
  recommend_score bigint,
  post jsonb
)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  page_limit integer := least(greatest(coalesce(p_limit, 20), 1), 20);
  sort_key text := case p_sort
    when 'comments' then 'comments'
    when 'recommended' then 'recommended'
    when 'vote_rate_high' then 'vote_rate_high'
    when 'vote_rate_low' then 'vote_rate_low'
    when 'play_count' then 'play_count'
    else 'latest'
  end;
  table_name text;
  extra_filter_sql text := '';
  order_sql text;
  cursor_sql text := '';
begin
  table_name := case p_service
    when 'combo' then 'combo_posts'
    when 'transfigure' then 'transfigure_posts'
    when 'this_or_that' then 'this_or_that_posts'
    when 'chemical_x' then 'chemical_posts'
    when 'decisions_decisions' then 'decisions_decisions_posts'
    when 'favorite_tournament' then 'favorite_tournament_posts'
    else null
  end;
  if table_name is null then
    return;
  end if;

  if sort_key in ('vote_rate_high', 'vote_rate_low') then
    if p_service is distinct from 'this_or_that' then
      return;
    end if;
    extra_filter_sql := 'and (p.left_vote_count + p.right_vote_count) > 0';
  end if;

  if sort_key = 'play_count' and p_service is distinct from 'favorite_tournament' then
    return;
  end if;

  order_sql := case sort_key
    when 'comments' then 'p.comment_count desc, p.created_at desc, p.id desc'
    when 'recommended' then
      '(p.like_count * 4 + p.comment_count * 6) desc, p.created_at desc, p.id desc'
    when 'vote_rate_high' then
      'p.vote_rate_bps desc, p.created_at desc, p.id desc'
    when 'vote_rate_low' then
      '(10000 - p.vote_rate_bps) desc, p.created_at desc, p.id desc'
    when 'play_count' then
      'p.play_count desc, p.created_at desc, p.id desc'
    else 'p.created_at desc, p.id desc'
  end;

  if p_cursor_id is not null and p_cursor_created_at is not null then
    cursor_sql := case sort_key
      when 'comments' then
        'and (p.comment_count::bigint, p.created_at, p.id) < ($3, $4, $5)'
      when 'recommended' then
        'and ((p.like_count::bigint * 4 + p.comment_count::bigint * 6), p.created_at, p.id) < ($3, $4, $5)'
      when 'vote_rate_high' then
        'and (p.vote_rate_bps::bigint, p.created_at, p.id) < ($3, $4, $5)'
      when 'vote_rate_low' then
        'and ((10000 - p.vote_rate_bps)::bigint, p.created_at, p.id) < ($3, $4, $5)'
      when 'play_count' then
        'and (p.play_count::bigint, p.created_at, p.id) < ($3, $4, $5)'
      else
        'and (p.created_at, p.id) < ($4, $5)'
    end;
  end if;

  return query execute format(
    $q$
      select
        p.id,
        p.created_at,
        p.like_count,
        p.comment_count,
        (p.like_count::bigint * 4 + p.comment_count::bigint * 6) as recommend_score,
        to_jsonb(p.*) as post
      from public.%I p
      where p.env = $1
        %s
        %s
      order by %s
      limit $2
    $q$,
    table_name,
    extra_filter_sql,
    cursor_sql,
    order_sql
  )
  using p_env, page_limit, p_cursor_score, p_cursor_created_at, p_cursor_id;
end;
$$;

grant execute on function public.get_toybox_feed(
  text, text, text, integer, bigint, timestamptz, uuid
) to anon, authenticated;

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
set search_path = public
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

  if not exists (
    select 1
    from public.favorite_tournament_posts
    where id = p_tournament_id and env = p_env
  ) then
    raise exception 'tournament not found';
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

revoke all on function public.complete_favorite_tournament_play(uuid, text, integer, text, text, jsonb)
  from public;
grant execute on function public.complete_favorite_tournament_play(uuid, text, integer, text, text, jsonb)
  to anon, authenticated;
