-- Step 4 of the Supabase exit: what the Worker needs to write with the service key while Supabase is
-- still the origin (docs/supabase-exit/STEP4_WRITE_GATE.md 5). Nothing changes for anon or authenticated,
-- so the rls write path and old browser tabs behave as before.
-- Rollback: docs/release/worker-write-actor/rollback_worker_write_actor.sql (only after every write.<group>
-- flag is back to rls).

-- 1. The inquiry rate-limit trigger runs only for the browser roles, with the guard triggers' WHEN
--    (docs/supabase-exit/D1_SCHEMA_DESIGN.md 5.5). For the service role auth.uid() is NULL and the trigger
--    would refuse every inquiry (42501); the Worker does its work instead: the user check, btrim and lower,
--    and three an hour per user and env.
-- create or replace keeps the migration idempotent (like 20261108130427_d1_change_log.sql) and swaps
-- the trigger in one statement; the definition is design 5.5's DROP + CREATE.
create or replace trigger contact_inquiries_rate_limit
  before insert on public.contact_inquiries
  for each row
  when (current_user = any (array['anon'::name, 'authenticated'::name]))
  execute function public.enforce_contact_inquiry_rate_limit();

-- 2. The two write RPCs read auth.uid(). These service-only wrappers set the request's sub to the actor the
--    Worker resolved, for this transaction only, and call the RPC unchanged, so its checks, counters and
--    statistics stay exactly today's.
create or replace function public.worker_complete_favorite_tournament_play(
  p_actor uuid,
  p_tournament_id uuid,
  p_env text,
  p_starting_size integer,
  p_champion_type text,
  p_champion_id text,
  p_matches jsonb
) returns jsonb
language plpgsql
set search_path to ''
as $$
begin
  if p_actor is null then
    raise exception 'not authenticated';
  end if;
  perform pg_catalog.set_config('request.jwt.claim.sub', p_actor::text, true);
  return public.complete_favorite_tournament_play(
    p_tournament_id, p_env, p_starting_size, p_champion_type, p_champion_id, p_matches
  );
end;
$$;

create or replace function public.worker_submit_puzzlebox_run(
  p_actor uuid,
  p_env text,
  p_game text,
  p_board text,
  p_run jsonb,
  p_player jsonb
) returns jsonb
language plpgsql
set search_path to ''
as $$
begin
  if p_actor is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  perform pg_catalog.set_config('request.jwt.claim.sub', p_actor::text, true);
  return public.submit_puzzlebox_run(p_env, p_game, p_board, p_run, p_player);
end;
$$;

-- Supabase's default privileges grant new functions to anon and authenticated: take that back.
revoke all on function public.worker_complete_favorite_tournament_play(uuid, uuid, text, integer, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.worker_complete_favorite_tournament_play(uuid, uuid, text, integer, text, text, jsonb)
  to service_role;
revoke all on function public.worker_submit_puzzlebox_run(uuid, text, text, text, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.worker_submit_puzzlebox_run(uuid, text, text, text, jsonb, jsonb)
  to service_role;
