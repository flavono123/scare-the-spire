-- Community-written Slseoun stories.
-- Rendered story ids are prefixed client-side as `community:<id>` so they do
-- not collide with static JSON story ids used by comments and reactions.

create table if not exists public.community_stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 20),
  sentence text not null check (char_length(sentence) between 2 and 120),
  game text not null default 'sts2' check (game in ('sts1', 'sts2')),
  env text not null default 'production',
  created_at timestamptz not null default now()
);

create index if not exists idx_community_stories_env_created
  on public.community_stories(env, created_at desc);

create index if not exists idx_community_stories_env_sentence
  on public.community_stories using gin (to_tsvector('simple', sentence));

alter table public.community_stories enable row level security;

drop policy if exists "community_stories_read" on public.community_stories;
create policy "community_stories_read" on public.community_stories
  for select using (true);

drop policy if exists "community_stories_insert" on public.community_stories;
create policy "community_stories_insert" on public.community_stories
  for insert with check (auth.uid() = user_id);

drop policy if exists "community_stories_delete" on public.community_stories;
create policy "community_stories_delete" on public.community_stories
  for delete using (auth.uid() = user_id);
