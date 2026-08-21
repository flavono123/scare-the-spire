-- Denormalized This or That vote counts plus extra get_toybox_feed sorts.
-- DB-first additive: old app only sends latest/recommended/comments.
-- New p_sort values are unused until the consumer deploys.

alter table public.this_or_that_posts
  add column if not exists left_vote_count integer not null default 0,
  add column if not exists right_vote_count integer not null default 0;

alter table public.this_or_that_posts
  add column if not exists vote_rate_bps integer generated always as (
    case
      when (left_vote_count + right_vote_count) <= 0 then 0
      else (
        (greatest(left_vote_count, right_vote_count)::bigint * 10000)
        / (left_vote_count + right_vote_count)
      )::integer
    end
  ) stored;

create or replace function public.apply_this_or_that_vote_count_delta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
  delta integer;
  left_delta integer := 0;
  right_delta integer := 0;
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

  if rec.choice = 'left' then
    left_delta := delta;
  elsif rec.choice = 'right' then
    right_delta := delta;
  else
    return rec;
  end if;

  update public.this_or_that_posts
    set
      left_vote_count = greatest(0, left_vote_count + left_delta),
      right_vote_count = greatest(0, right_vote_count + right_delta)
    where id = rec.post_id and env = rec.env;

  return rec;
end;
$$;

drop trigger if exists this_or_that_post_votes_count_delta on public.this_or_that_post_votes;
create trigger this_or_that_post_votes_count_delta
  after insert or delete on public.this_or_that_post_votes
  for each row
  execute function public.apply_this_or_that_vote_count_delta();

revoke all on function public.apply_this_or_that_vote_count_delta() from public, anon, authenticated;

update public.this_or_that_posts as posts
set
  left_vote_count = coalesce(counts.left_count, 0),
  right_vote_count = coalesce(counts.right_count, 0)
from (
  select
    votes.post_id,
    votes.env,
    count(*) filter (where votes.choice = 'left')::integer as left_count,
    count(*) filter (where votes.choice = 'right')::integer as right_count
  from public.this_or_that_post_votes as votes
  group by votes.post_id, votes.env
) as counts
where posts.id = counts.post_id
  and posts.env = counts.env;

create index if not exists idx_this_or_that_posts_env_vote_rate_high
  on public.this_or_that_posts (env, vote_rate_bps desc, created_at desc, id desc)
  where (left_vote_count + right_vote_count) > 0;

create index if not exists idx_this_or_that_posts_env_vote_rate_low
  on public.this_or_that_posts (
    env,
    (10000 - vote_rate_bps) desc,
    created_at desc,
    id desc
  )
  where (left_vote_count + right_vote_count) > 0;

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

  order_sql := case sort_key
    when 'comments' then 'p.comment_count desc, p.created_at desc, p.id desc'
    when 'recommended' then
      '(p.like_count * 4 + p.comment_count * 6) desc, p.created_at desc, p.id desc'
    when 'vote_rate_high' then
      'p.vote_rate_bps desc, p.created_at desc, p.id desc'
    when 'vote_rate_low' then
      '(10000 - p.vote_rate_bps) desc, p.created_at desc, p.id desc'
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
