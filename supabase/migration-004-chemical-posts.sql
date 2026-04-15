-- Chemical X micro-blog posts
create table chemical_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 20),
  content jsonb not null,
  content_text text not null check (char_length(content_text) between 2 and 30),
  env text not null default 'production',
  created_at timestamptz default now()
);

create index idx_chemical_posts_env_created on chemical_posts(env, created_at desc);

alter table chemical_posts enable row level security;

create policy "chemical_posts_read" on chemical_posts
  for select using (true);

create policy "chemical_posts_insert" on chemical_posts
  for insert with check (auth.uid() = user_id);

create policy "chemical_posts_delete" on chemical_posts
  for delete using (auth.uid() = user_id);
