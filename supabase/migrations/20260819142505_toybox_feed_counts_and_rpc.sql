-- Denormalized toy-box feed counters plus a bounded keyset RPC.
-- DB-first additive: old app ignores unused columns and does not call the RPC.
-- Triggers keep counts in sync for likes/comments the old app already writes.

alter table public.combo_posts
  add column if not exists like_count integer not null default 0,
  add column if not exists comment_count integer not null default 0;

alter table public.transfigure_posts
  add column if not exists like_count integer not null default 0,
  add column if not exists comment_count integer not null default 0;

alter table public.this_or_that_posts
  add column if not exists like_count integer not null default 0,
  add column if not exists comment_count integer not null default 0;

alter table public.chemical_posts
  add column if not exists like_count integer not null default 0,
  add column if not exists comment_count integer not null default 0;

create index if not exists idx_combo_posts_env_comment_created
  on public.combo_posts (env, comment_count desc, created_at desc, id desc);
create index if not exists idx_combo_posts_env_recommend_created
  on public.combo_posts (
    env,
    ((like_count * 4) + (comment_count * 6)) desc,
    created_at desc,
    id desc
  );

create index if not exists idx_transfigure_posts_env_comment_created
  on public.transfigure_posts (env, comment_count desc, created_at desc, id desc);
create index if not exists idx_transfigure_posts_env_recommend_created
  on public.transfigure_posts (
    env,
    ((like_count * 4) + (comment_count * 6)) desc,
    created_at desc,
    id desc
  );

create index if not exists idx_this_or_that_posts_env_created
  on public.this_or_that_posts (env, created_at desc, id desc);
create index if not exists idx_this_or_that_posts_env_comment_created
  on public.this_or_that_posts (env, comment_count desc, created_at desc, id desc);
create index if not exists idx_this_or_that_posts_env_recommend_created
  on public.this_or_that_posts (
    env,
    ((like_count * 4) + (comment_count * 6)) desc,
    created_at desc,
    id desc
  );

create index if not exists idx_chemical_posts_env_created
  on public.chemical_posts (env, created_at desc, id desc);
create index if not exists idx_chemical_posts_env_comment_created
  on public.chemical_posts (env, comment_count desc, created_at desc, id desc);
create index if not exists idx_chemical_posts_env_recommend_created
  on public.chemical_posts (
    env,
    ((like_count * 4) + (comment_count * 6)) desc,
    created_at desc,
    id desc
  );

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
    end if;
  end if;

  return rec;
end;
$$;

create or replace function public.apply_this_or_that_like_count_delta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
  delta integer;
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

  update public.this_or_that_posts
    set like_count = greatest(0, like_count + delta)
    where id = rec.post_id and env = rec.env;

  return rec;
end;
$$;

drop trigger if exists comments_toybox_engagement_delta on public.comments;
create trigger comments_toybox_engagement_delta
  after insert or delete on public.comments
  for each row
  execute function public.apply_toybox_thread_engagement_delta('comment');

drop trigger if exists likes_toybox_engagement_delta on public.likes;
create trigger likes_toybox_engagement_delta
  after insert or delete on public.likes
  for each row
  execute function public.apply_toybox_thread_engagement_delta('like');

drop trigger if exists this_or_that_post_likes_count_delta on public.this_or_that_post_likes;
create trigger this_or_that_post_likes_count_delta
  after insert or delete on public.this_or_that_post_likes
  for each row
  execute function public.apply_this_or_that_like_count_delta();

revoke all on function public.apply_toybox_thread_engagement_delta() from public, anon, authenticated;
revoke all on function public.apply_this_or_that_like_count_delta() from public, anon, authenticated;

update public.combo_posts as posts
set
  like_count = (
    select count(*)::integer
    from public.likes
    where likes.env = posts.env
      and likes.story_id = 'c-c-c-combo:' || posts.id::text
  ),
  comment_count = (
    select count(*)::integer
    from public.comments
    where comments.env = posts.env
      and comments.story_id = 'c-c-c-combo:' || posts.id::text
  );

update public.transfigure_posts as posts
set
  like_count = (
    select count(*)::integer
    from public.likes
    where likes.env = posts.env
      and likes.story_id = 'transfigure:' || posts.id::text
  ),
  comment_count = (
    select count(*)::integer
    from public.comments
    where comments.env = posts.env
      and comments.story_id = 'transfigure:' || posts.id::text
  );

update public.this_or_that_posts as posts
set
  like_count = (
    select count(*)::integer
    from public.this_or_that_post_likes
    where this_or_that_post_likes.env = posts.env
      and this_or_that_post_likes.post_id = posts.id
  ),
  comment_count = (
    select count(*)::integer
    from public.comments
    where comments.env = posts.env
      and comments.story_id = 'this-or-that:' || posts.id::text
  );

update public.chemical_posts as posts
set
  like_count = (
    select count(*)::integer
    from public.likes
    where likes.env = posts.env
      and likes.story_id = 'chemical-x:' || posts.id::text
  ),
  comment_count = (
    select count(*)::integer
    from public.comments
    where comments.env = posts.env
      and comments.story_id = 'chemical-x:' || posts.id::text
  );

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
    else 'latest'
  end;
  table_name text;
  order_sql text;
  cursor_sql text := '';
begin
  table_name := case p_service
    when 'combo' then 'combo_posts'
    when 'transfigure' then 'transfigure_posts'
    when 'this_or_that' then 'this_or_that_posts'
    when 'chemical_x' then 'chemical_posts'
    else null
  end;
  if table_name is null then
    return;
  end if;

  order_sql := case sort_key
    when 'comments' then 'p.comment_count desc, p.created_at desc, p.id desc'
    when 'recommended' then
      '(p.like_count * 4 + p.comment_count * 6) desc, p.created_at desc, p.id desc'
    else 'p.created_at desc, p.id desc'
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
        p.id,
        p.created_at,
        p.like_count,
        p.comment_count,
        (p.like_count::bigint * 4 + p.comment_count::bigint * 6) as recommend_score,
        to_jsonb(p.*) as post
      from public.%I p
      where p.env = $1
        %s
      order by %s
      limit $2
    $q$,
    table_name,
    cursor_sql,
    order_sql
  )
  using p_env, page_limit, p_cursor_score, p_cursor_created_at, p_cursor_id;
end;
$$;

grant execute on function public.get_toybox_feed(
  text, text, text, integer, bigint, timestamptz, uuid
) to anon, authenticated;
