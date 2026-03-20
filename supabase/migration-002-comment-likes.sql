-- Migration 002: Add comment likes
-- Run this in Supabase Dashboard > SQL Editor

create table comment_likes (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references comments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  unique(comment_id, user_id)
);

create index idx_comment_likes_comment on comment_likes(comment_id);

alter table comment_likes enable row level security;

create policy "comment_likes_read" on comment_likes
  for select using (true);

create policy "comment_likes_insert" on comment_likes
  for insert with check (auth.uid() = user_id);

create policy "comment_likes_delete" on comment_likes
  for delete using (auth.uid() = user_id);
