alter table public.contact_inquiries
  add column if not exists admin_response text,
  add column if not exists responded_at timestamptz;

alter table public.contact_inquiries
  drop constraint if exists contact_inquiries_response_pair;

alter table public.contact_inquiries
  add constraint contact_inquiries_response_pair check (
    (admin_response is null and responded_at is null)
    or (
      admin_response is not null
      and responded_at is not null
      and char_length(admin_response) between 1 and 8000
      and admin_response = btrim(admin_response)
    )
  );

drop policy if exists "contact_inquiries_select_owner" on public.contact_inquiries;
create policy "contact_inquiries_select_owner"
  on public.contact_inquiries
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

grant select (
  id,
  category,
  message,
  page_path,
  service_locale,
  game_locale,
  env,
  status,
  admin_response,
  created_at,
  responded_at
) on table public.contact_inquiries to authenticated;
