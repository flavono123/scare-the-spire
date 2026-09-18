-- Add author profile token snapshot columns across comments and Toy Box / community post tables.
-- This persists the author's avatar and duotone palette at the time of writing (Plan A)
-- so that every user sees the author's exact profile token instead of falling back to '?'.

-- 1. Comments
alter table public.comments
  add column if not exists avatar_id text,
  add column if not exists avatar_kind text,
  add column if not exists palette_id text,
  add column if not exists palette_swapped boolean default false;

-- 2. Community Stories
alter table public.community_stories
  add column if not exists avatar_id text,
  add column if not exists avatar_kind text,
  add column if not exists palette_id text,
  add column if not exists palette_swapped boolean default false;

-- 3. Toy Box Post Tables
alter table public.combo_posts
  add column if not exists avatar_id text,
  add column if not exists avatar_kind text,
  add column if not exists palette_id text,
  add column if not exists palette_swapped boolean default false;

alter table public.transfigure_posts
  add column if not exists avatar_id text,
  add column if not exists avatar_kind text,
  add column if not exists palette_id text,
  add column if not exists palette_swapped boolean default false;

alter table public.this_or_that_posts
  add column if not exists avatar_id text,
  add column if not exists avatar_kind text,
  add column if not exists palette_id text,
  add column if not exists palette_swapped boolean default false;

alter table public.chemical_posts
  add column if not exists avatar_id text,
  add column if not exists avatar_kind text,
  add column if not exists palette_id text,
  add column if not exists palette_swapped boolean default false;

alter table public.decisions_decisions_posts
  add column if not exists avatar_id text,
  add column if not exists avatar_kind text,
  add column if not exists palette_id text,
  add column if not exists palette_swapped boolean default false;

alter table public.favorite_tournament_posts
  add column if not exists avatar_id text,
  add column if not exists avatar_kind text,
  add column if not exists palette_id text,
  add column if not exists palette_swapped boolean default false;

alter table public.defragment_posts
  add column if not exists avatar_id text,
  add column if not exists avatar_kind text,
  add column if not exists palette_id text,
  add column if not exists palette_swapped boolean default false;

alter table public.pagestorm_posts
  add column if not exists avatar_id text,
  add column if not exists avatar_kind text,
  add column if not exists palette_id text,
  add column if not exists palette_swapped boolean default false;

-- 4. Recreate get_defragment_feed to return author profile token columns for 조각모음 board index
drop function if exists public.get_defragment_feed(
  text, text, integer, bigint, timestamptz, uuid
);

create function public.get_defragment_feed(
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
  title text,
  nickname text,
  user_id uuid,
  avatar_id text,
  avatar_kind text,
  palette_id text,
  palette_swapped boolean
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
        s.title,
        s.nickname,
        s.user_id,
        s.avatar_id,
        s.avatar_kind,
        s.palette_id,
        s.palette_swapped
      from (
        (
          select
            p.id,
            p.created_at,
            p.like_count,
            p.comment_count,
            p.like_count::bigint as recommend_score,
            'combo'::text as service,
            left(btrim(p.content_text), 120) as title,
            p.nickname,
            p.user_id,
            p.avatar_id,
            p.avatar_kind,
            p.palette_id,
            p.palette_swapped
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
            ) as title,
            p.nickname,
            p.user_id,
            p.avatar_id,
            p.avatar_kind,
            p.palette_id,
            p.palette_swapped
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
            left(btrim(p.reason), 120) as title,
            p.nickname,
            p.user_id,
            p.avatar_id,
            p.avatar_kind,
            p.palette_id,
            p.palette_swapped
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
            left(btrim(p.content_text), 120) as title,
            p.nickname,
            p.user_id,
            p.avatar_id,
            p.avatar_kind,
            p.palette_id,
            p.palette_swapped
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
            ) as title,
            p.nickname,
            p.user_id,
            p.avatar_id,
            p.avatar_kind,
            p.palette_id,
            p.palette_swapped
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
            ) as title,
            p.nickname,
            p.user_id,
            p.avatar_id,
            p.avatar_kind,
            p.palette_id,
            p.palette_swapped
          from public.favorite_tournament_posts p
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
            'pagestorm'::text as service,
            left(
              btrim(coalesce(nullif(p.title, ''), p.content_text)),
              120
            ) as title,
            p.nickname,
            p.user_id,
            p.avatar_id,
            p.avatar_kind,
            p.palette_id,
            p.palette_swapped
          from public.pagestorm_posts p
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
) to anon, authenticated, service_role;
