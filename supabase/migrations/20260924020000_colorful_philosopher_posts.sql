create table if not exists public.colorful_philosopher_posts (
  id uuid primary key default gen_random_uuid(),
  env text not null,
  week_start date not null,
  slot text not null,
  resource_type text not null,
  resource_id text not null,
  name_ko text not null,
  name_en text not null,
  image_url text,
  body text not null,
  game_version text not null,
  buff_count integer not null default 0,
  nerf_count integer not null default 0,
  rework_count integer not null default 0,
  created_at timestamptz not null default now(),
  constraint colorful_philosopher_posts_env_check
    check (env in ('production', 'development')),
  constraint colorful_philosopher_posts_slot_check
    check (slot in ('card', 'relic', 'power')),
  constraint colorful_philosopher_posts_type_check
    check (resource_type = slot),
  constraint colorful_philosopher_posts_text_check
    check (
      char_length(resource_id) between 1 and 80
      and char_length(name_ko) between 1 and 120
      and char_length(name_en) between 1 and 120
      and char_length(body) between 1 and 500
      and char_length(game_version) between 1 and 32
    )
);

create unique index if not exists colorful_philosopher_posts_env_week_slot
  on public.colorful_philosopher_posts (env, week_start, slot);

create table if not exists public.colorful_philosopher_reactions (
  post_id uuid not null references public.colorful_philosopher_posts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  env text not null,
  kind text not null,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id),
  constraint colorful_philosopher_reactions_kind_check
    check (kind in ('buff', 'nerf', 'rework')),
  constraint colorful_philosopher_reactions_env_check
    check (env in ('production', 'development'))
);

create or replace function public.apply_colorful_philosopher_reaction_counts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.colorful_philosopher_posts
    set buff_count = buff_count + case when new.kind = 'buff' then 1 else 0 end,
        nerf_count = nerf_count + case when new.kind = 'nerf' then 1 else 0 end,
        rework_count = rework_count + case when new.kind = 'rework' then 1 else 0 end
    where id = new.post_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.colorful_philosopher_posts
    set buff_count = greatest(0, buff_count - case when old.kind = 'buff' then 1 else 0 end),
        nerf_count = greatest(0, nerf_count - case when old.kind = 'nerf' then 1 else 0 end),
        rework_count = greatest(0, rework_count - case when old.kind = 'rework' then 1 else 0 end)
    where id = old.post_id;
    return old;
  elsif tg_op = 'UPDATE' and new.kind is distinct from old.kind then
    update public.colorful_philosopher_posts
    set buff_count = greatest(0, buff_count
          - case when old.kind = 'buff' then 1 else 0 end
          + case when new.kind = 'buff' then 1 else 0 end),
        nerf_count = greatest(0, nerf_count
          - case when old.kind = 'nerf' then 1 else 0 end
          + case when new.kind = 'nerf' then 1 else 0 end),
        rework_count = greatest(0, rework_count
          - case when old.kind = 'rework' then 1 else 0 end
          + case when new.kind = 'rework' then 1 else 0 end)
    where id = new.post_id;
    return new;
  end if;
  return null;
end $$;

drop trigger if exists colorful_philosopher_reactions_counts
  on public.colorful_philosopher_reactions;
create trigger colorful_philosopher_reactions_counts
  after insert or update or delete on public.colorful_philosopher_reactions
  for each row execute function public.apply_colorful_philosopher_reaction_counts();

alter table public.colorful_philosopher_posts enable row level security;
alter table public.colorful_philosopher_reactions enable row level security;

drop policy if exists "colorful_philosopher_posts_select" on public.colorful_philosopher_posts;
create policy "colorful_philosopher_posts_select"
  on public.colorful_philosopher_posts
  for select to anon, authenticated
  using (true);

drop policy if exists "colorful_philosopher_reactions_select" on public.colorful_philosopher_reactions;
create policy "colorful_philosopher_reactions_select"
  on public.colorful_philosopher_reactions
  for select to anon, authenticated
  using (true);

drop policy if exists "colorful_philosopher_reactions_insert" on public.colorful_philosopher_reactions;
create policy "colorful_philosopher_reactions_insert"
  on public.colorful_philosopher_reactions
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "colorful_philosopher_reactions_update" on public.colorful_philosopher_reactions;
create policy "colorful_philosopher_reactions_update"
  on public.colorful_philosopher_reactions
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "colorful_philosopher_reactions_delete" on public.colorful_philosopher_reactions;
create policy "colorful_philosopher_reactions_delete"
  on public.colorful_philosopher_reactions
  for delete to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.colorful_philosopher_posts from anon, authenticated;
grant select on public.colorful_philosopher_posts to anon, authenticated;
revoke all on public.colorful_philosopher_reactions from anon, authenticated;
grant select, insert, update, delete on public.colorful_philosopher_reactions to authenticated;
grant select on public.colorful_philosopher_reactions to anon;
