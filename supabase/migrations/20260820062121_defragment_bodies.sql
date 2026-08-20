-- Optional 조각모음-only body overlay for federated Toy Box posts.
-- DB-first additive: unused by the deployed app. get_defragment_feed is unchanged.
-- Native 조각모음 bodies stay on defragment_posts.

create table if not exists public.defragment_bodies (
  env text not null,
  source_service text not null
    check (source_service in ('combo', 'transfigure', 'this_or_that', 'chemical_x')),
  source_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 20),
  content jsonb not null,
  content_text text not null check (char_length(content_text) between 2 and 8000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (env, source_service, source_id)
);

create index if not exists idx_defragment_bodies_source
  on public.defragment_bodies (env, source_service, source_id);

alter table public.defragment_bodies enable row level security;

drop policy if exists "defragment_bodies_read" on public.defragment_bodies;
create policy "defragment_bodies_read" on public.defragment_bodies
  for select using (true);

drop policy if exists "defragment_bodies_insert" on public.defragment_bodies;
create policy "defragment_bodies_insert" on public.defragment_bodies
  for insert with check (auth.uid() = user_id);

drop policy if exists "defragment_bodies_update" on public.defragment_bodies;
create policy "defragment_bodies_update" on public.defragment_bodies
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "defragment_bodies_delete" on public.defragment_bodies;
create policy "defragment_bodies_delete" on public.defragment_bodies
  for delete using (auth.uid() = user_id);

grant select, insert, update, delete
  on public.defragment_bodies
  to anon, authenticated;
