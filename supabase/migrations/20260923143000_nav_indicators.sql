create table if not exists public.nav_indicators (
  env text primary key,
  patch_notes boolean not null default false,
  toy_box boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint nav_indicators_env_check
    check (env in ('production', 'development'))
);

alter table public.nav_indicators enable row level security;

drop policy if exists "nav_indicators_select_public" on public.nav_indicators;
create policy "nav_indicators_select_public"
  on public.nav_indicators
  for select
  to anon, authenticated
  using (true);

revoke all on public.nav_indicators from anon, authenticated;
grant select on public.nav_indicators to anon, authenticated;

insert into public.nav_indicators (env, patch_notes, toy_box)
values
  ('production', false, false),
  ('development', false, false)
on conflict (env) do nothing;
