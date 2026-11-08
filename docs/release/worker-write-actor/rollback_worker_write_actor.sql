-- Reverses 20261108160000_worker_write_actor.sql. Prepared for an incident only: it is not a migration
-- file and must stay out of supabase/migrations. Run it only after every write.<group> flag is back to
-- rls (scripts/runtime-flags.ts list): in worker mode the Worker's inquiries would hit the old trigger
-- (42501, auth.uid() is NULL for the service role) and its RPC calls would find no wrapper (PGRST202).
-- No row changed in the migration, so nothing else needs restoring. Afterwards record the revert:
--   supabase migration repair 20261108160000 --status reverted --linked
-- Run with: supabase db query --linked -f docs/release/worker-write-actor/rollback_worker_write_actor.sql
begin;

select pg_catalog.set_config('lock_timeout', '3s', true);

drop function public.worker_complete_favorite_tournament_play(uuid, uuid, text, integer, text, text, jsonb);
drop function public.worker_submit_puzzlebox_run(uuid, text, text, text, jsonb, jsonb);

-- The trigger as public-schema.sql (2026-11-05) has it: no WHEN, every role.
drop trigger contact_inquiries_rate_limit on public.contact_inquiries;
create trigger contact_inquiries_rate_limit
  before insert on public.contact_inquiries
  for each row
  execute function public.enforce_contact_inquiry_rate_limit();

commit;
