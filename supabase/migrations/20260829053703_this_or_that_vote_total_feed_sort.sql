-- This or That vote_rate_high / vote_rate_low keep their chip names but order
-- by total ballots (left_vote_count + right_vote_count) instead of winner-share
-- basis points. Ceiling 1000000000 must match TOYBOX_FEED_VOTE_TOTAL_SCORE_CEILING.
--
-- Row shape is unchanged. Old app + new DB: first page is total-ballot order;
-- load-more keysets that still send winner-share bps can duplicate until the
-- matching client is deployed. New app + old DB: first page stays winner-share
-- and load-more can return empty until this function is applied.

create index if not exists idx_this_or_that_posts_env_vote_total_high
  on public.this_or_that_posts (
    env,
    ((left_vote_count::bigint + right_vote_count::bigint)) desc,
    created_at desc,
    id desc
  )
  where (left_vote_count + right_vote_count) > 0;

create index if not exists idx_this_or_that_posts_env_vote_total_low
  on public.this_or_that_posts (
    env,
    ((1000000000 - (left_vote_count::bigint + right_vote_count::bigint))) desc,
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
        'and ((p.like_count::bigint * 4 + p.comment_count::bigint * 6), p.created_at, p.id) < ($3, $4, $5)'
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
