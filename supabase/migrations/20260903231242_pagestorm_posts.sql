-- 서류 폭풍 posts.
-- DB-first additive: table is unused until the local/new app writes.
-- Do not expand `get_toybox_feed` or `get_defragment_feed` here — production
-- 조각모음 still indexes an exhaustive service map and would crash on a new
-- discriminator. Pagestorm lists from this table directly.

create table if not exists public.pagestorm_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 20),
  title text not null check (char_length(title) between 1 and 80),
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  content_text text not null check (char_length(content_text) between 1 and 8000),
  env text not null default 'production',
  like_count integer not null default 0,
  comment_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_pagestorm_posts_env_created
  on public.pagestorm_posts (env, created_at desc, id desc);
create index if not exists idx_pagestorm_posts_env_user_created
  on public.pagestorm_posts (env, user_id, created_at desc);

alter table public.pagestorm_posts enable row level security;

drop policy if exists "pagestorm_posts_read" on public.pagestorm_posts;
create policy "pagestorm_posts_read" on public.pagestorm_posts
  for select using (true);

drop policy if exists "pagestorm_posts_insert" on public.pagestorm_posts;
create policy "pagestorm_posts_insert" on public.pagestorm_posts
  for insert with check (auth.uid() = user_id);

drop policy if exists "pagestorm_posts_update" on public.pagestorm_posts;
create policy "pagestorm_posts_update" on public.pagestorm_posts
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "pagestorm_posts_delete" on public.pagestorm_posts;
create policy "pagestorm_posts_delete" on public.pagestorm_posts
  for delete using (auth.uid() = user_id);

grant select, insert, update, delete
  on public.pagestorm_posts
  to anon, authenticated;
