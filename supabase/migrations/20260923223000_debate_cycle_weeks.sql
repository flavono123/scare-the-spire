alter table public.debate_cycles
  add column if not exists week_start date,
  add column if not exists pool text;

do $$
declare
  rec record;
  start_date date;
  pool_name text;
  idx integer;
  pools text[] := array['card', 'relic', 'monster', 'power', 'mixed'];
  epoch date := date '2026-09-21';
begin
  for rec in
    select id, resource_type, opened_at
    from public.debate_cycles
    where week_start is null
  loop
    start_date := (date_trunc('week', timezone('Asia/Seoul', rec.opened_at)))::date;
    for step in 0..4 loop
      idx := ((start_date - epoch) / 7)::integer;
      pool_name := pools[1 + ((idx % 5 + 5) % 5)];
      if (
        pool_name = 'mixed'
        and rec.resource_type in ('character', 'ancient', 'enchantment', 'affliction')
      ) or pool_name = rec.resource_type then
        update public.debate_cycles
        set week_start = start_date, pool = pool_name
        where id = rec.id;
        exit;
      end if;
      start_date := start_date + 7;
    end loop;
  end loop;
end $$;

alter table public.debate_cycles
  alter column week_start set not null,
  alter column pool set not null;

alter table public.debate_cycles
  drop constraint if exists debate_cycles_resource_type_check;

alter table public.debate_cycles
  add constraint debate_cycles_resource_type_check
    check (resource_type in (
      'card',
      'relic',
      'monster',
      'power',
      'character',
      'ancient',
      'enchantment',
      'affliction'
    ));

alter table public.debate_cycles
  drop constraint if exists debate_cycles_pool_check;

alter table public.debate_cycles
  add constraint debate_cycles_pool_check
    check (
      pool in ('card', 'relic', 'monster', 'power', 'mixed')
      and (
        (pool = 'mixed' and resource_type in ('character', 'ancient', 'enchantment', 'affliction'))
        or (pool <> 'mixed' and resource_type = pool)
      )
    );

drop index if exists public.debate_cycles_one_open_per_env;

create unique index if not exists debate_cycles_env_week_start
  on public.debate_cycles (env, week_start);
