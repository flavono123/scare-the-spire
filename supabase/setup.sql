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
  content_blocks jsonb,
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

-- 5. Global profile table
create table user_profiles (
  user_id uuid not null references auth.users(id) on delete cascade,
  env text not null default 'production',
  nickname text not null check (char_length(nickname) between 1 and 20),
  character_id text not null check (char_length(character_id) between 1 and 64),
  pet_id text not null check (char_length(pet_id) between 1 and 64),
  pet_skin_id text check (pet_skin_id is null or char_length(pet_skin_id) between 1 and 64),
  ancient_id text not null check (char_length(ancient_id) between 1 and 64),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, env)
);

create index idx_user_profiles_env_user on user_profiles(env, user_id);

create or replace function set_user_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger user_profiles_set_updated_at
  before update on user_profiles
  for each row
  execute function set_user_profiles_updated_at();

alter table user_profiles enable row level security;

create policy "user_profiles_read" on user_profiles
  for select using (true);

create policy "user_profiles_insert" on user_profiles
  for insert with check (auth.uid() = user_id);

create policy "user_profiles_update" on user_profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "user_profiles_delete" on user_profiles
  for delete using (auth.uid() = user_id);
