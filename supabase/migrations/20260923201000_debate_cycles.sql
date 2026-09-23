create table if not exists public.debate_cycles (
  id uuid primary key default gen_random_uuid(),
  env text not null,
  resource_type text not null,
  resource_id text not null,
  name_ko text not null,
  name_en text not null,
  image_url text,
  href text not null,
  game_version text not null,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  constraint debate_cycles_env_check
    check (env in ('production', 'development')),
  constraint debate_cycles_resource_type_check
    check (resource_type in (
      'affliction',
      'ancient',
      'card',
      'character',
      'enchantment',
      'encounter',
      'epoch',
      'event',
      'monster',
      'potion',
      'power',
      'relic'
    )),
  constraint debate_cycles_text_check
    check (
      char_length(resource_id) between 1 and 80
      and char_length(name_ko) between 1 and 120
      and char_length(name_en) between 1 and 120
      and char_length(href) between 1 and 200
      and char_length(game_version) between 1 and 32
    )
);

create unique index if not exists debate_cycles_one_open_per_env
  on public.debate_cycles (env)
  where closed_at is null;

create index if not exists debate_cycles_env_opened_idx
  on public.debate_cycles (env, opened_at desc);

alter table public.debate_cycles enable row level security;

drop policy if exists "debate_cycles_select_public" on public.debate_cycles;
create policy "debate_cycles_select_public"
  on public.debate_cycles
  for select
  to anon, authenticated
  using (true);

revoke all on public.debate_cycles from anon, authenticated;
grant select on public.debate_cycles to anon, authenticated;
