-- Stamp History Course authors with the profile nickname.
-- Missing profile visits still get the default profile nickname, 닉.
-- The existing get_defragment_feed contract is unchanged.

alter table public.runs
  add column if not exists donor_nickname text not null default '닉';

alter table public.runs
  drop constraint if exists runs_donor_nickname_len;

alter table public.runs
  add constraint runs_donor_nickname_len
  check (char_length(btrim(donor_nickname)) between 1 and 20);

create or replace function public.get_defragment_feed_v2(
  p_env text,
  p_sort text default 'latest',
  p_limit integer default 20,
  p_cursor_score bigint default null,
  p_cursor_created_at timestamptz default null,
  p_cursor_id text default null
)
returns table (
  id text,
  created_at timestamptz,
  like_count integer,
  comment_count integer,
  recommend_score bigint,
  service text,
  title text,
  nickname text,
  user_id text,
  avatar_id text,
  avatar_kind text,
  palette_id text,
  palette_swapped boolean,
  history_meta jsonb
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
    when 'comments' then 'p.comment_count desc, p.created_at desc, p.id::text desc'
    when 'recommended' then 'p.like_count desc, p.created_at desc, p.id::text desc'
    else 'p.created_at desc, p.id::text desc'
  end;
  outer_order := case sort_key
    when 'comments' then 's.comment_count desc, s.created_at desc, s.id desc'
    when 'recommended' then 's.like_count desc, s.created_at desc, s.id desc'
    else 's.created_at desc, s.id desc'
  end;

  if p_cursor_id is not null and p_cursor_created_at is not null then
    cursor_sql := case sort_key
      when 'comments' then
        'and (p.comment_count::bigint, p.created_at, p.id::text) < ($3, $4, $5)'
      when 'recommended' then
        'and (p.like_count::bigint, p.created_at, p.id::text) < ($3, $4, $5)'
      else
        'and (p.created_at, p.id::text) < ($4, $5)'
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
        s.palette_swapped,
        s.history_meta
      from (
        (
          select
            p.id::text as id,
            p.created_at,
            p.like_count,
            p.comment_count,
            p.like_count::bigint as recommend_score,
            'combo'::text as service,
            left(btrim(p.content_text), 120) as title,
            p.nickname,
            p.user_id::text as user_id,
            p.avatar_id,
            p.avatar_kind,
            p.palette_id,
            p.palette_swapped,
            null::jsonb as history_meta
          from public.combo_posts p
          where p.env = $1
            %1$s
          order by %2$s
          limit $2
        )
        union all
        (
          select
            p.id::text,
            p.created_at,
            p.like_count,
            p.comment_count,
            p.like_count::bigint,
            'transfigure'::text,
            left(btrim(coalesce(nullif(p.title, ''), nullif(p.transformed_name, ''), p.content_text)), 120),
            p.nickname,
            p.user_id::text,
            p.avatar_id,
            p.avatar_kind,
            p.palette_id,
            p.palette_swapped,
            null::jsonb
          from public.transfigure_posts p
          where p.env = $1
            %1$s
          order by %2$s
          limit $2
        )
        union all
        (
          select
            p.id::text,
            p.created_at,
            p.like_count,
            p.comment_count,
            p.like_count::bigint,
            'this_or_that'::text,
            left(btrim(p.reason), 120),
            p.nickname,
            p.user_id::text,
            p.avatar_id,
            p.avatar_kind,
            p.palette_id,
            p.palette_swapped,
            null::jsonb
          from public.this_or_that_posts p
          where p.env = $1
            %1$s
          order by %2$s
          limit $2
        )
        union all
        (
          select
            p.id::text,
            p.created_at,
            p.like_count,
            p.comment_count,
            p.like_count::bigint,
            'chemical_x'::text,
            left(btrim(p.content_text), 120),
            p.nickname,
            p.user_id::text,
            p.avatar_id,
            p.avatar_kind,
            p.palette_id,
            p.palette_swapped,
            null::jsonb
          from public.chemical_posts p
          where p.env = $1
            %1$s
          order by %2$s
          limit $2
        )
        union all
        (
          select
            p.id::text,
            p.created_at,
            p.like_count,
            p.comment_count,
            p.like_count::bigint,
            'decisions_decisions'::text,
            left(btrim(coalesce(nullif(p.title, ''), p.note)), 120),
            p.nickname,
            p.user_id::text,
            p.avatar_id,
            p.avatar_kind,
            p.palette_id,
            p.palette_swapped,
            null::jsonb
          from public.decisions_decisions_posts p
          where p.env = $1
            %1$s
          order by %2$s
          limit $2
        )
        union all
        (
          select
            p.id::text,
            p.created_at,
            p.like_count,
            p.comment_count,
            p.like_count::bigint,
            'favorite_tournament'::text,
            left(btrim(coalesce(nullif(p.title, ''), p.note)), 120),
            p.nickname,
            p.user_id::text,
            p.avatar_id,
            p.avatar_kind,
            p.palette_id,
            p.palette_swapped,
            null::jsonb
          from public.favorite_tournament_posts p
          where p.env = $1
            %1$s
          order by %2$s
          limit $2
        )
        union all
        (
          select
            p.id::text,
            p.created_at,
            p.like_count,
            p.comment_count,
            p.like_count::bigint,
            'pagestorm'::text,
            left(btrim(coalesce(nullif(p.title, ''), p.content_text)), 120),
            p.nickname,
            p.user_id::text,
            p.avatar_id,
            p.avatar_kind,
            p.palette_id,
            p.palette_swapped,
            null::jsonb
          from public.pagestorm_posts p
          where p.env = $1
            %1$s
          order by %2$s
          limit $2
        )
        union all
        (
          select
            p.id::text,
            p.created_at,
            p.like_count,
            p.comment_count,
            p.like_count::bigint,
            'history_course'::text,
            left(btrim(coalesce(nullif(p.seed, ''), p.id)), 120),
            p.donor_nickname,
            p.donor_user_id::text,
            null::text,
            null::text,
            null::text,
            null::boolean,
            jsonb_build_object(
              'cover_spec', p.cover_spec,
              'win', p.win,
              'ascension', p.ascension,
              'total_floors', p.total_floors
            )
          from public.runs p
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

grant execute on function public.get_defragment_feed_v2(
  text, text, integer, bigint, timestamptz, text
) to anon, authenticated, service_role;
