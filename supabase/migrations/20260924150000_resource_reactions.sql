create table if not exists public.resource_reaction_counts (
  env text not null,
  resource_type text not null,
  resource_id text not null,
  game_version text not null,
  buff_count integer not null default 0,
  nerf_count integer not null default 0,
  rework_count integer not null default 0,
  primary key (env, resource_type, resource_id, game_version)
);

create table if not exists public.resource_reactions (
  env text not null,
  resource_type text not null,
  resource_id text not null,
  game_version text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  primary key (env, resource_type, resource_id, game_version, user_id),
  constraint resource_reactions_kind_check check (kind in ('buff', 'nerf', 'rework')),
  constraint resource_reactions_env_check check (env in ('production', 'development'))
);

alter table public.resource_reaction_counts enable row level security;
alter table public.resource_reactions enable row level security;

drop policy if exists resource_reaction_counts_read on public.resource_reaction_counts;
create policy resource_reaction_counts_read on public.resource_reaction_counts
  for select using (true);

drop policy if exists resource_reactions_read on public.resource_reactions;
create policy resource_reactions_read on public.resource_reactions
  for select using (true);

drop policy if exists resource_reactions_insert on public.resource_reactions;
create policy resource_reactions_insert on public.resource_reactions
  for insert with check (auth.uid() = user_id);

drop policy if exists resource_reactions_update on public.resource_reactions;
create policy resource_reactions_update on public.resource_reactions
  for update using (auth.uid() = user_id);

drop policy if exists resource_reactions_delete on public.resource_reactions;
create policy resource_reactions_delete on public.resource_reactions
  for delete using (auth.uid() = user_id);

create or replace function public.apply_resource_reaction_counts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  row_env text;
  row_type text;
  row_id text;
  row_version text;
  old_kind text;
  new_kind text;
begin
  if tg_op = 'DELETE' then
    row_env := old.env;
    row_type := old.resource_type;
    row_id := old.resource_id;
    row_version := old.game_version;
    old_kind := old.kind;
    new_kind := null;
  else
    row_env := new.env;
    row_type := new.resource_type;
    row_id := new.resource_id;
    row_version := new.game_version;
    new_kind := new.kind;
    old_kind := case when tg_op = 'UPDATE' then old.kind else null end;
  end if;

  insert into public.resource_reaction_counts (env, resource_type, resource_id, game_version)
  values (row_env, row_type, row_id, row_version)
  on conflict (env, resource_type, resource_id, game_version) do nothing;

  update public.resource_reaction_counts
  set buff_count = greatest(0, buff_count
        - case when old_kind = 'buff' then 1 else 0 end
        + case when new_kind = 'buff' then 1 else 0 end),
      nerf_count = greatest(0, nerf_count
        - case when old_kind = 'nerf' then 1 else 0 end
        + case when new_kind = 'nerf' then 1 else 0 end),
      rework_count = greatest(0, rework_count
        - case when old_kind = 'rework' then 1 else 0 end
        + case when new_kind = 'rework' then 1 else 0 end)
  where env = row_env
    and resource_type = row_type
    and resource_id = row_id
    and game_version = row_version;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists resource_reactions_counts on public.resource_reactions;
create trigger resource_reactions_counts
  after insert or update or delete on public.resource_reactions
  for each row execute function public.apply_resource_reaction_counts();

insert into public.resource_reactions (env, resource_type, resource_id, game_version, user_id, kind)
select posts.env, posts.resource_type, posts.resource_id, posts.game_version, reactions.user_id, reactions.kind
from public.colorful_philosopher_reactions reactions
join public.colorful_philosopher_posts posts on posts.id = reactions.post_id
on conflict (env, resource_type, resource_id, game_version, user_id) do nothing;

alter table public.comments
  add column if not exists parent_id uuid references public.comments (id) on delete cascade;

alter table public.comments
  add column if not exists meta jsonb;
