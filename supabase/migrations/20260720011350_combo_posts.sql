create table if not exists public.combo_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 20),
  content jsonb not null check (jsonb_typeof(content) = 'array'),
  content_text text not null check (char_length(content_text) >= 2),
  resources jsonb not null check (
    jsonb_typeof(resources) = 'array'
    and jsonb_array_length(resources) >= 2
  ),
  env text not null default 'production',
  created_at timestamptz not null default now()
);

create index if not exists idx_combo_posts_env_created
  on public.combo_posts(env, created_at desc);

create index if not exists idx_combo_posts_env_user_created
  on public.combo_posts(env, user_id, created_at desc);

alter table public.combo_posts enable row level security;

drop policy if exists "combo_posts_read" on public.combo_posts;
create policy "combo_posts_read" on public.combo_posts
  for select using (true);

drop policy if exists "combo_posts_insert" on public.combo_posts;
create policy "combo_posts_insert" on public.combo_posts
  for insert with check (auth.uid() = user_id);

drop policy if exists "combo_posts_delete" on public.combo_posts;
create policy "combo_posts_delete" on public.combo_posts
  for delete using (auth.uid() = user_id);
