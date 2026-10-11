-- Author-only Pagestorm drafts. The public post table and feed stay unchanged.
-- Old app never reads this table. New inserts default to a private row.

create table if not exists public.pagestorm_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 20),
  title text not null check (char_length(title) between 1 and 80),
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  content_text text not null check (char_length(content_text) between 1 and 8000),
  env text not null default 'production',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  avatar_id text,
  avatar_kind text,
  palette_id text,
  palette_swapped boolean default false
);

create index if not exists idx_pagestorm_drafts_env_user_updated
  on public.pagestorm_drafts (env, user_id, updated_at desc);

alter table public.pagestorm_drafts enable row level security;

drop policy if exists "pagestorm_drafts_read" on public.pagestorm_drafts;
create policy "pagestorm_drafts_read" on public.pagestorm_drafts
  for select using (auth.uid() = user_id);

drop policy if exists "pagestorm_drafts_insert" on public.pagestorm_drafts;
create policy "pagestorm_drafts_insert" on public.pagestorm_drafts
  for insert with check (auth.uid() = user_id);

drop policy if exists "pagestorm_drafts_update" on public.pagestorm_drafts;
create policy "pagestorm_drafts_update" on public.pagestorm_drafts
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "pagestorm_drafts_delete" on public.pagestorm_drafts;
create policy "pagestorm_drafts_delete" on public.pagestorm_drafts
  for delete using (auth.uid() = user_id);

grant select, insert, update, delete
  on public.pagestorm_drafts
  to authenticated;
