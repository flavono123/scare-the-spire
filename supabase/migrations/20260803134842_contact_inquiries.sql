create table if not exists public.contact_inquiries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  category text not null check (
    category in ('bug', 'correction', 'feedback', 'report', 'partnership', 'other')
  ),
  message text not null check (
    char_length(message) between 10 and 8000
    and message = btrim(message)
  ),
  reply_email text check (
    reply_email is null
    or (
      char_length(reply_email) between 3 and 254
      and reply_email = btrim(reply_email)
      and reply_email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
    )
  ),
  page_path text not null check (
    char_length(page_path) between 1 and 512
    and left(page_path, 1) = '/'
    and position('?' in page_path) = 0
    and position('#' in page_path) = 0
  ),
  service_locale text not null check (service_locale in ('ko', 'en')),
  game_locale text not null check (
    game_locale in (
      'kor', 'eng', 'zhs', 'jpn', 'deu', 'fra', 'ita',
      'spa', 'esp', 'ptb', 'rus', 'pol', 'tha', 'tur'
    )
  ),
  viewport_width integer check (viewport_width is null or viewport_width between 1 and 10000),
  viewport_height integer check (viewport_height is null or viewport_height between 1 and 10000),
  env text not null default 'production' check (env in ('development', 'production')),
  status text not null default 'new' check (status in ('new', 'reviewing', 'done', 'spam')),
  created_at timestamptz not null default now(),
  constraint contact_inquiries_partnership_email check (
    category <> 'partnership' or reply_email is not null
  )
);

create index if not exists idx_contact_inquiries_env_status_created
  on public.contact_inquiries(env, status, created_at desc);

create index if not exists idx_contact_inquiries_user_created
  on public.contact_inquiries(user_id, created_at desc)
  where user_id is not null;

alter table public.contact_inquiries enable row level security;

drop policy if exists "contact_inquiries_insert_owner" on public.contact_inquiries;
create policy "contact_inquiries_insert_owner"
  on public.contact_inquiries
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and status = 'new'
  );

create or replace function public.enforce_contact_inquiry_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_id is distinct from (select auth.uid()) then
    raise exception 'contact_inquiry_user_mismatch' using errcode = '42501';
  end if;

  new.message := btrim(new.message);
  new.reply_email := nullif(lower(btrim(new.reply_email)), '');

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.user_id::text || ':' || new.env, 0)
  );

  if (
    select count(*)
    from public.contact_inquiries as inquiries
    where inquiries.user_id = new.user_id
      and inquiries.env = new.env
      and inquiries.created_at > now() - interval '1 hour'
  ) >= 3 then
    raise exception 'contact_inquiry_rate_limited' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists contact_inquiries_rate_limit on public.contact_inquiries;
create trigger contact_inquiries_rate_limit
  before insert on public.contact_inquiries
  for each row
  execute function public.enforce_contact_inquiry_rate_limit();

revoke all on table public.contact_inquiries from public, anon, authenticated;
grant insert (
  user_id,
  category,
  message,
  reply_email,
  page_path,
  service_locale,
  game_locale,
  viewport_width,
  viewport_height,
  env
) on table public.contact_inquiries to authenticated;

revoke all on function public.enforce_contact_inquiry_rate_limit() from public, anon, authenticated;
