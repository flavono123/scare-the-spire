create table if not exists public.this_or_that_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 20),
  left_type text not null,
  left_id text not null,
  right_type text not null,
  right_id text not null,
  reason text not null check (char_length(reason) between 2 and 500),
  env text not null default 'production',
  created_at timestamptz not null default now(),
  constraint this_or_that_posts_distinct_resources
    check (left_type <> right_type or left_id <> right_id)
);

create index if not exists idx_this_or_that_posts_env_created
  on public.this_or_that_posts(env, created_at desc);

alter table public.this_or_that_posts enable row level security;

drop policy if exists "this_or_that_posts_read" on public.this_or_that_posts;
create policy "this_or_that_posts_read" on public.this_or_that_posts
  for select using (true);

drop policy if exists "this_or_that_posts_insert" on public.this_or_that_posts;
create policy "this_or_that_posts_insert" on public.this_or_that_posts
  for insert with check (auth.uid() = user_id);

drop policy if exists "this_or_that_posts_delete" on public.this_or_that_posts;
create policy "this_or_that_posts_delete" on public.this_or_that_posts
  for delete using (auth.uid() = user_id);
