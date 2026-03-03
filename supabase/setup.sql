-- Supabase setup for scare-the-spire engagement system
-- Run this in Supabase Dashboard > SQL Editor

-- 1. Likes table
create table likes (
  id uuid primary key default gen_random_uuid(),
  story_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  unique(story_id, user_id)
);

create index idx_likes_story on likes(story_id);

-- 2. Comments table
create table comments (
  id uuid primary key default gen_random_uuid(),
  story_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 20),
  content text not null check (char_length(content) between 1 and 500),
  created_at timestamptz default now()
);

create index idx_comments_story on comments(story_id, created_at);

-- 3. RLS: Likes
alter table likes enable row level security;

create policy "likes_read" on likes
  for select using (true);

create policy "likes_insert" on likes
  for insert with check (auth.uid() = user_id);

create policy "likes_delete" on likes
  for delete using (auth.uid() = user_id);

-- 4. RLS: Comments
alter table comments enable row level security;

create policy "comments_read" on comments
  for select using (true);

create policy "comments_insert" on comments
  for insert with check (auth.uid() = user_id);

create policy "comments_delete" on comments
  for delete using (auth.uid() = user_id);
