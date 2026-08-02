create table public.this_or_that_post_votes (
  post_id uuid not null references public.this_or_that_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  choice text not null check (choice in ('left', 'right')),
  created_surface text not null check (created_surface in ('index', 'detail')),
  env text not null default 'production',
  created_at timestamptz not null default now(),
  constraint this_or_that_post_votes_unique_user unique (post_id, user_id, env)
);

create index idx_this_or_that_post_votes_env_post_choice
  on public.this_or_that_post_votes(env, post_id, choice);

alter table public.this_or_that_post_votes enable row level security;

create policy "this_or_that_post_votes_read_owner"
  on public.this_or_that_post_votes
  for select
  using ((select auth.uid()) = user_id);

create policy "this_or_that_post_votes_insert_owner"
  on public.this_or_that_post_votes
  for insert
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.this_or_that_posts as posts
      where posts.id = this_or_that_post_votes.post_id
        and posts.env = this_or_that_post_votes.env
    )
  );

create policy "this_or_that_post_votes_delete_owner"
  on public.this_or_that_post_votes
  for delete
  using ((select auth.uid()) = user_id);

create function public.get_this_or_that_vote_summaries(
  p_post_ids uuid[],
  p_env text default 'production'
)
returns table (
  post_id uuid,
  left_count bigint,
  right_count bigint,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if coalesce(cardinality(p_post_ids), 0) > 50 then
    raise exception 'A maximum of 50 post ids is allowed';
  end if;

  return query
  select
    votes.post_id,
    count(*) filter (where votes.choice = 'left')::bigint,
    count(*) filter (where votes.choice = 'right')::bigint,
    count(*)::bigint
  from public.this_or_that_post_votes as votes
  where votes.env = p_env
    and votes.post_id = any(coalesce(p_post_ids, array[]::uuid[]))
  group by votes.post_id;
end;
$$;

revoke all on function public.get_this_or_that_vote_summaries(uuid[], text) from public;
grant execute on function public.get_this_or_that_vote_summaries(uuid[], text) to anon, authenticated;

create function public.get_this_or_that_vote_totals(
  p_env text default 'production'
)
returns table (
  left_count bigint,
  right_count bigint,
  total_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    count(*) filter (where votes.choice = 'left')::bigint,
    count(*) filter (where votes.choice = 'right')::bigint,
    count(*)::bigint
  from public.this_or_that_post_votes as votes
  where votes.env = p_env;
$$;

revoke all on function public.get_this_or_that_vote_totals(text) from public;
grant execute on function public.get_this_or_that_vote_totals(text) to anon, authenticated;
