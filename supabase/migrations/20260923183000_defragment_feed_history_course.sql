-- Versioned 조각모음 feed. get_defragment_feed stays uuid-keyed so the
-- deployed app keeps working. v2 adds text ids and history_course runs.
-- Additive columns and the engagement prefix are unused by the old app.

alter table public.runs
  add column if not exists like_count integer not null default 0,
  add column if not exists comment_count integer not null default 0;

create index if not exists idx_runs_env_like_created
  on public.runs (env, like_count desc, created_at desc, id desc);
create index if not exists idx_runs_env_comment_created
  on public.runs (env, comment_count desc, created_at desc, id desc);

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
  run_id text;
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
  if prefix = 'history-course' then
    run_id := split_part(rec.story_id, ':', 2);
    if kind = 'comment' then
      update public.runs
        set comment_count = greatest(0, comment_count + delta)
        where id = run_id and env = rec.env;
    elsif kind = 'like' then
      update public.runs
        set like_count = greatest(0, like_count + delta)
        where id = run_id and env = rec.env;
    end if;
    return rec;
  end if;

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
    elsif prefix = 'pagestorm' then
      update public.pagestorm_posts
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
    elsif prefix = 'pagestorm' then
      update public.pagestorm_posts
        set like_count = greatest(0, like_count + delta)
        where id = post_id and env = rec.env;
    end if;
  end if;

  return rec;
end;
$$;

revoke all on function public.apply_toybox_thread_engagement_delta() from public, anon, authenticated;

update public.runs as posts
set
  like_count = (
    select count(*)::integer
    from public.likes
    where likes.env = posts.env
      and likes.story_id = 'history-course:' || posts.id
  ),
  comment_count = (
    select count(*)::integer
    from public.comments
    where comments.env = posts.env
      and comments.story_id = 'history-course:' || posts.id
  );

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
            ''::text,
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
