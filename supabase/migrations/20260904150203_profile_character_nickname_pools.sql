create or replace function public.profile_nickname_list_is_valid(nicks text[])
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  nick text;
  seen text[] := '{}';
begin
  if nicks is null
    or pg_catalog.cardinality(nicks) < 1
    or pg_catalog.cardinality(nicks) > 50
  then
    return false;
  end if;

  foreach nick in array nicks loop
    if nick is null
      or pg_catalog.char_length(nick) not between 1 and 20
      or nick <> pg_catalog.btrim(nick)
      or nick = any(seen)
    then
      return false;
    end if;
    seen := pg_catalog.array_append(seen, nick);
  end loop;

  return true;
end;
$$;

create table if not exists public.profile_character_nickname_pools (
  character_id text not null,
  locale text not null,
  nicknames text[] not null,
  updated_at timestamptz not null default now(),
  primary key (character_id, locale),
  constraint profile_character_nickname_pools_character_check
    check (character_id in ('IRONCLAD', 'SILENT', 'REGENT', 'NECROBINDER', 'DEFECT')),
  constraint profile_character_nickname_pools_locale_check
    check (locale in ('ko', 'en')),
  constraint profile_character_nickname_pools_nicknames_check
    check (public.profile_nickname_list_is_valid(nicknames))
);

alter table public.profile_character_nickname_pools enable row level security;

drop policy if exists "profile_character_nickname_pools_select_public"
  on public.profile_character_nickname_pools;
create policy "profile_character_nickname_pools_select_public"
  on public.profile_character_nickname_pools
  for select
  to anon, authenticated
  using (true);

grant select on public.profile_character_nickname_pools to anon, authenticated;

insert into public.profile_character_nickname_pools (character_id, locale, nicknames)
values
  ('IRONCLAD', 'ko', array['아클단', '아평', '아이언클래스', '아이언클레임', '아이돌클라스', '아장연']),
  ('IRONCLAD', 'en', array['Clad', 'The Clad', 'Ironclad']),
  ('SILENT', 'ko', array['사일단', '사평', '사장연']),
  ('SILENT', 'en', array['Silent', 'The Silent', 'Shiv Silent']),
  ('REGENT', 'ko', array['리황', '리평']),
  ('REGENT', 'en', array['Regent', 'Reggie', 'King Reggie']),
  ('NECROBINDER', 'ko', array['네바', '네크로맨서', '네평', '골골맘', '네크단']),
  ('NECROBINDER', 'en', array['Necro', 'Necrobinder', 'Necro Binder']),
  ('DEFECT', 'ko', array['디평', '디펙터', '디황']),
  ('DEFECT', 'en', array['Defect', 'The Defect', 'Orb Defect'])
on conflict (character_id, locale) do nothing;
