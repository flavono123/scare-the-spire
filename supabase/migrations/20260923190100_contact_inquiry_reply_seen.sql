alter table public.contact_inquiries
  add column if not exists reply_seen_at timestamptz;

create index if not exists idx_contact_inquiries_unseen_replies
  on public.contact_inquiries (user_id, env)
  where user_id is not null
    and admin_response is not null
    and reply_seen_at is null;

create or replace function public.clear_contact_inquiry_reply_seen()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.admin_response is distinct from old.admin_response
    or new.responded_at is distinct from old.responded_at then
    new.reply_seen_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists contact_inquiries_clear_reply_seen on public.contact_inquiries;
create trigger contact_inquiries_clear_reply_seen
  before update on public.contact_inquiries
  for each row
  execute function public.clear_contact_inquiry_reply_seen();

revoke all on function public.clear_contact_inquiry_reply_seen() from public, anon, authenticated;

drop policy if exists "contact_inquiries_update_reply_seen" on public.contact_inquiries;
create policy "contact_inquiries_update_reply_seen"
  on public.contact_inquiries
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select (reply_seen_at) on table public.contact_inquiries to authenticated;
grant update (reply_seen_at) on table public.contact_inquiries to authenticated;
