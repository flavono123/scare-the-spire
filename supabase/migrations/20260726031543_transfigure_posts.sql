create table if not exists public.transfigure_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 20),
  resource_type text not null check (
    resource_type in (
      'card',
      'character',
      'keyword',
      'relic',
      'potion',
      'power',
      'enchantment',
      'affliction',
      'event',
      'ancient',
      'epoch'
    )
  ),
  resource_id text not null check (char_length(resource_id) between 1 and 128),
  source_text text not null check (char_length(source_text) >= 1),
  source_game_locale text not null check (char_length(source_game_locale) = 3),
  content jsonb not null check (jsonb_typeof(content) = 'array'),
  content_text text not null check (char_length(content_text) >= 2),
  env text not null default 'production',
  created_at timestamptz not null default now()
);

create index if not exists idx_transfigure_posts_env_created
  on public.transfigure_posts(env, created_at desc);

create index if not exists idx_transfigure_posts_env_user_created
  on public.transfigure_posts(env, user_id, created_at desc);

create index if not exists idx_transfigure_posts_env_resource_created
  on public.transfigure_posts(env, resource_type, resource_id, created_at desc);

alter table public.transfigure_posts enable row level security;

drop policy if exists "transfigure_posts_read" on public.transfigure_posts;
create policy "transfigure_posts_read" on public.transfigure_posts
  for select using (true);

drop policy if exists "transfigure_posts_insert" on public.transfigure_posts;
create policy "transfigure_posts_insert" on public.transfigure_posts
  for insert with check (auth.uid() = user_id);

drop policy if exists "transfigure_posts_delete" on public.transfigure_posts;
create policy "transfigure_posts_delete" on public.transfigure_posts
  for delete using (auth.uid() = user_id);
