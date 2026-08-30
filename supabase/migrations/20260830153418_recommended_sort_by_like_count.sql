-- Recommended / 추천 sort is like_count desc, matching the 추천 column.
-- Same RPC names, signatures, and columns. `recommend_score` now equals
-- like_count so old clients that keyset on that field stay aligned.
-- Old app + new DB: first page and load-more follow likes. New app + old DB:
-- first page stays on the old composite score until this function is applied.

create index if not exists idx_combo_posts_env_like_created
  on public.combo_posts (env, like_count desc, created_at desc, id desc);
create index if not exists idx_transfigure_posts_env_like_created
  on public.transfigure_posts (env, like_count desc, created_at desc, id desc);
create index if not exists idx_this_or_that_posts_env_like_created
  on public.this_or_that_posts (env, like_count desc, created_at desc, id desc);
create index if not exists idx_chemical_posts_env_like_created
  on public.chemical_posts (env, like_count desc, created_at desc, id desc);
create index if not exists idx_decisions_decisions_posts_env_like_created
  on public.decisions_decisions_posts (env, like_count desc, created_at desc, id desc);
create index if not exists idx_favorite_tournament_posts_env_like_created
  on public.favorite_tournament_posts (env, like_count desc, created_at desc, id desc);

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
      'p.like_count desc, p.created_at desc, p.id desc'
    when 'vote_rate_high' then
      '(p.left_vote_count::bigint + p.right_vote_count::bigint) desc, p.created_at desc, p.id desc'
    when 'vote_rate_low' then
      '(1000000000 - (p.left_vote_count::bigint + p.right_vote_count::bigint)) desc, p.created_at desc, p.id desc'
    when 'play_count' then
      'p.play_count desc, p.created_at desc, p.id desc'
    else 'p.created_at desc, p.id desc'
  end;

  if p_cursor_id is not null and p_cursor_created_at is not null then
    cursor_sql := case sort_key
      when 'comments' then
        'and (p.comment_count::bigint, p.created_at, p.id) < ($3, $4, $5)'
      when 'recommended' then
        'and (p.like_count::bigint, p.created_at, p.id) < ($3, $4, $5)'
      when 'vote_rate_high' then
        'and ((p.left_vote_count::bigint + p.right_vote_count::bigint), p.created_at, p.id) < ($3, $4, $5)'
      when 'vote_rate_low' then
        'and ((1000000000 - (p.left_vote_count::bigint + p.right_vote_count::bigint)), p.created_at, p.id) < ($3, $4, $5)'
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
        p.like_count::bigint as recommend_score,
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

create or replace function public.get_defragment_feed(
  p_env text,
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
  service text,
  title text
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
    else 'latest'
  end;
  inner_order text;
  outer_order text;
  cursor_sql text := '';
begin
  inner_order := case sort_key
    when 'comments' then 'p.comment_count desc, p.created_at desc, p.id desc'
    when 'recommended' then
      'p.like_count desc, p.created_at desc, p.id desc'
    else 'p.created_at desc, p.id desc'
  end;
  outer_order := case sort_key
    when 'comments' then 's.comment_count desc, s.created_at desc, s.id desc'
    when 'recommended' then
      's.like_count desc, s.created_at desc, s.id desc'
    else 's.created_at desc, s.id desc'
  end;

  if p_cursor_id is not null and p_cursor_created_at is not null then
    cursor_sql := case sort_key
      when 'comments' then
        'and (p.comment_count::bigint, p.created_at, p.id) < ($3, $4, $5)'
      when 'recommended' then
        'and (p.like_count::bigint, p.created_at, p.id) < ($3, $4, $5)'
      else
        'and (p.created_at, p.id) < ($4, $5)'
    end;
  end if;

  return query execute format(
    $q$
      select
        s.id,
        s.created_at,
        s.like_count,
        s.comment_count,
        s.recommend_score,
        s.service,
        s.title
      from (
        (
          select
            p.id,
            p.created_at,
            p.like_count,
            p.comment_count,
            p.like_count::bigint as recommend_score,
            'combo'::text as service,
            left(btrim(p.content_text), 120) as title
          from public.combo_posts p
          where p.env = $1
            %1$s
          order by %2$s
          limit $2
        )
        union all
        (
          select
            p.id,
            p.created_at,
            p.like_count,
            p.comment_count,
            p.like_count::bigint as recommend_score,
            'transfigure'::text as service,
            left(
              btrim(
                coalesce(
                  nullif(p.title, ''),
                  nullif(p.transformed_name, ''),
                  p.content_text
                )
              ),
              120
            ) as title
          from public.transfigure_posts p
          where p.env = $1
            %1$s
          order by %2$s
          limit $2
        )
        union all
        (
          select
            p.id,
            p.created_at,
            p.like_count,
            p.comment_count,
            p.like_count::bigint as recommend_score,
            'this_or_that'::text as service,
            left(btrim(p.reason), 120) as title
          from public.this_or_that_posts p
          where p.env = $1
            %1$s
          order by %2$s
          limit $2
        )
        union all
        (
          select
            p.id,
            p.created_at,
            p.like_count,
            p.comment_count,
            p.like_count::bigint as recommend_score,
            'chemical_x'::text as service,
            left(btrim(p.content_text), 120) as title
          from public.chemical_posts p
          where p.env = $1
            %1$s
          order by %2$s
          limit $2
        )
        union all
        (
          select
            p.id,
            p.created_at,
            p.like_count,
            p.comment_count,
            p.like_count::bigint as recommend_score,
            'decisions_decisions'::text as service,
            left(
              btrim(coalesce(nullif(p.title, ''), p.note)),
              120
            ) as title
          from public.decisions_decisions_posts p
          where p.env = $1
            %1$s
          order by %2$s
          limit $2
        )
        union all
        (
          select
            p.id,
            p.created_at,
            p.like_count,
            p.comment_count,
            p.like_count::bigint as recommend_score,
            'favorite_tournament'::text as service,
            left(
              btrim(coalesce(nullif(p.title, ''), p.note)),
              120
            ) as title
          from public.favorite_tournament_posts p
          where p.env = $1
            %1$s
          order by %2$s
          limit $2
        )
      ) s
      order by %3$s
      limit $2
    $q$,
    cursor_sql,
    inner_order,
    outer_order
  )
  using p_env, page_limit, p_cursor_score, p_cursor_created_at, p_cursor_id;
end;
$$;

grant execute on function public.get_defragment_feed(
  text, text, integer, bigint, timestamptz, uuid
) to anon, authenticated;
