create table if not exists public.this_or_that_post_likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.this_or_that_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  env text not null default 'production',
  created_at timestamptz not null default now(),
  constraint this_or_that_post_likes_unique_user unique (post_id, user_id, env)
);

create index if not exists idx_this_or_that_post_likes_env_post
  on public.this_or_that_post_likes(env, post_id);

create or replace view public.this_or_that_post_like_counts as
select
  post_id,
  env,
  count(*)::integer as like_count
from public.this_or_that_post_likes
group by post_id, env;

alter table public.this_or_that_post_likes enable row level security;

drop policy if exists "this_or_that_post_likes_read_all" on public.this_or_that_post_likes;
create policy "this_or_that_post_likes_read_all"
  on public.this_or_that_post_likes
  for select
  using (true);

drop policy if exists "this_or_that_post_likes_insert_owner" on public.this_or_that_post_likes;
create policy "this_or_that_post_likes_insert_owner"
  on public.this_or_that_post_likes
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "this_or_that_post_likes_delete_owner" on public.this_or_that_post_likes;
create policy "this_or_that_post_likes_delete_owner"
  on public.this_or_that_post_likes
  for delete
  using (auth.uid() = user_id);

grant select on public.this_or_that_post_like_counts to anon, authenticated;
