-- Migration 010: Global ephemeral profile per anonymous RLS identity.
-- Run this in Supabase Dashboard > SQL Editor.

create table if not exists user_profiles (
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

create index if not exists idx_user_profiles_env_user on user_profiles(env, user_id);

create or replace function set_user_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_profiles_set_updated_at on user_profiles;
create trigger user_profiles_set_updated_at
  before update on user_profiles
  for each row
  execute function set_user_profiles_updated_at();

alter table user_profiles enable row level security;

drop policy if exists "user_profiles_read" on user_profiles;
drop policy if exists "user_profiles_insert" on user_profiles;
drop policy if exists "user_profiles_update" on user_profiles;
drop policy if exists "user_profiles_delete" on user_profiles;

create policy "user_profiles_read" on user_profiles
  for select using (true);

create policy "user_profiles_insert" on user_profiles
  for insert with check (auth.uid() = user_id);

create policy "user_profiles_update" on user_profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "user_profiles_delete" on user_profiles
  for delete using (auth.uid() = user_id);
