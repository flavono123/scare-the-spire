-- Reverses 20261109150000_worker_read_actor.sql. Prepared for an incident only: it is not a migration
-- file and must stay out of supabase/migrations. Run it only after identity.mode is back to token
-- (scripts/runtime-flags.ts list): in cookie mode the Worker's personal reads of the profile and
-- puzzlebox RPCs would find no wrapper (PGRST202). No row changed in the migration, so nothing else
-- needs restoring; running it twice is harmless (scripts/direct-writes-policies.spec.ts). Afterwards
-- record the revert:
--   supabase migration repair 20261109150000 --status reverted --linked
-- Run with: supabase db query --linked -f docs/release/worker-read-actor/rollback_worker_read_actor.sql
begin;

select pg_catalog.set_config('lock_timeout', '3s', true);

drop function if exists public.worker_get_my_profile_activity_stats(uuid, text);
drop function if exists public.worker_get_my_profile_activity(uuid, text, text, text, integer, integer);
drop function if exists public.worker_get_puzzlebox_leaderboard(uuid, text, text, jsonb, text, integer, boolean);
drop function if exists public.worker_get_my_puzzlebox_standings(uuid, text, text, jsonb);

commit;
