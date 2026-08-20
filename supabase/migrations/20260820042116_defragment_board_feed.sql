-- Native 조각모음 posts plus a bounded union feed RPC.
-- DB-first additive: new table, new RPC, extra trigger branch.
-- Old app never writes `defragment:` threads or calls get_defragment_feed.
-- get_toybox_feed is unchanged.

create table if not exists public.defragment_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 20),
  title text not null check (char_length(title) between 1 and 80),
  content jsonb not null,
  content_text text not null check (char_length(content_text) between 2 and 8000),
  env text not null default 'production',
  like_count integer not null default 0,
  comment_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_defragment_posts_env_created
  on public.defragment_posts (env, created_at desc, id desc);
create index if not exists idx_defragment_posts_env_comment_created
  on public.defragment_posts (env, comment_count desc, created_at desc, id desc);
create index if not exists idx_defragment_posts_env_recommend_created
  on public.defragment_posts (
    env,
    ((like_count * 4) + (comment_count * 6)) desc,
    created_at desc,
    id desc
  );

alter table public.defragment_posts enable row level security;

drop policy if exists "defragment_posts_read" on public.defragment_posts;
create policy "defragment_posts_read" on public.defragment_posts
  for select using (true);

drop policy if exists "defragment_posts_insert" on public.defragment_posts;
create policy "defragment_posts_insert" on public.defragment_posts
  for insert with check (auth.uid() = user_id);

drop policy if exists "defragment_posts_update" on public.defragment_posts;
create policy "defragment_posts_update" on public.defragment_posts
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "defragment_posts_delete" on public.defragment_posts;
create policy "defragment_posts_delete" on public.defragment_posts
  for delete using (auth.uid() = user_id);

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
    end if;
  end if;

  return rec;
end;
$$;

revoke all on function public.apply_toybox_thread_engagement_delta() from public, anon, authenticated;

-- Mixed 조각모음 index: at most 20 rows per source, then merge to 20.
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
      '(p.like_count * 4 + p.comment_count * 6) desc, p.created_at desc, p.id desc'
    else 'p.created_at desc, p.id desc'
  end;
  outer_order := case sort_key
    when 'comments' then 's.comment_count desc, s.created_at desc, s.id desc'
    when 'recommended' then
      's.recommend_score desc, s.created_at desc, s.id desc'
    else 's.created_at desc, s.id desc'
  end;

  if p_cursor_id is not null and p_cursor_created_at is not null then
    cursor_sql := case sort_key
      when 'comments' then
        'and (p.comment_count::bigint, p.created_at, p.id) < ($3, $4, $5)'
      when 'recommended' then
        'and ((p.like_count::bigint * 4 + p.comment_count::bigint * 6), p.created_at, p.id) < ($3, $4, $5)'
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
            (p.like_count::bigint * 4 + p.comment_count::bigint * 6) as recommend_score,
            'defragment'::text as service,
            left(btrim(p.title), 120) as title
          from public.defragment_posts p
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
            (p.like_count::bigint * 4 + p.comment_count::bigint * 6) as recommend_score,
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
            (p.like_count::bigint * 4 + p.comment_count::bigint * 6) as recommend_score,
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
            (p.like_count::bigint * 4 + p.comment_count::bigint * 6) as recommend_score,
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
            (p.like_count::bigint * 4 + p.comment_count::bigint * 6) as recommend_score,
            'chemical_x'::text as service,
            left(btrim(p.content_text), 120) as title
          from public.chemical_posts p
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
