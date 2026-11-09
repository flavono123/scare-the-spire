-- Step 4 of the Supabase exit: personal reads (/api/me/*) of a user the Worker knows only by the signed
-- cookie (no Supabase token, docs/SUPABASE_EXIT_PLAN.md 5.3), while Supabase is still the origin
-- (docs/supabase-exit/STEP4_WRITE_GATE.md 10.1). The Worker reads with the service key; the four read
-- RPCs that read auth.uid() get service-only wrappers like the write ones in
-- 20261108160000_worker_write_actor.sql: each sets the request's sub to the actor the Worker resolved,
-- for this transaction only, and calls the RPC unchanged. Nothing changes for anon or authenticated.
-- The SECURITY INVOKER profile RPCs then run as the service role, past RLS; every row they read is the
-- actor's (filtered by auth.uid()) or from a table every user may read, so the answers are today's
-- (scripts/write-gate-equivalence.spec.ts compares them).
-- Rollback: docs/release/worker-read-actor/rollback_worker_read_actor.sql.

create or replace function public.worker_get_my_profile_activity_stats(
  p_actor uuid,
  p_env text
) returns table(category text, post_count bigint, like_count bigint)
language plpgsql
set search_path to ''
as $$
begin
  if p_actor is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  perform pg_catalog.set_config('request.jwt.claim.sub', p_actor::text, true);
  return query select * from public.get_my_profile_activity_stats(p_env);
end;
$$;

create or replace function public.worker_get_my_profile_activity(
  p_actor uuid,
  p_env text,
  p_category text,
  p_sort text,
  p_limit integer,
  p_offset integer
) returns table(
  activity_id text,
  category text,
  content text,
  content_blocks jsonb,
  target_key text,
  created_at timestamptz,
  like_count bigint,
  total_count bigint
)
language plpgsql
set search_path to ''
as $$
begin
  if p_actor is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  perform pg_catalog.set_config('request.jwt.claim.sub', p_actor::text, true);
  return query select * from public.get_my_profile_activity(p_env, p_category, p_sort, p_limit, p_offset);
end;
$$;

create or replace function public.worker_get_puzzlebox_leaderboard(
  p_actor uuid,
  p_env text,
  p_game text,
  p_boards jsonb,
  p_board text,
  p_offset integer,
  p_around_me boolean
) returns jsonb
language plpgsql
set search_path to ''
as $$
begin
  if p_actor is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  perform pg_catalog.set_config('request.jwt.claim.sub', p_actor::text, true);
  return public.get_puzzlebox_leaderboard(p_env, p_game, p_boards, p_board, p_offset, p_around_me);
end;
$$;

create or replace function public.worker_get_my_puzzlebox_standings(
  p_actor uuid,
  p_env text,
  p_game text,
  p_boards jsonb
) returns jsonb
language plpgsql
set search_path to ''
as $$
begin
  if p_actor is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  perform pg_catalog.set_config('request.jwt.claim.sub', p_actor::text, true);
  return public.get_my_puzzlebox_standings(p_env, p_game, p_boards);
end;
$$;

-- Supabase's default privileges grant new functions to anon and authenticated: take that back.
revoke all on function public.worker_get_my_profile_activity_stats(uuid, text) from public, anon, authenticated;
grant execute on function public.worker_get_my_profile_activity_stats(uuid, text) to service_role;
revoke all on function public.worker_get_my_profile_activity(uuid, text, text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.worker_get_my_profile_activity(uuid, text, text, text, integer, integer) to service_role;
revoke all on function public.worker_get_puzzlebox_leaderboard(uuid, text, text, jsonb, text, integer, boolean) from public, anon, authenticated;
grant execute on function public.worker_get_puzzlebox_leaderboard(uuid, text, text, jsonb, text, integer, boolean) to service_role;
revoke all on function public.worker_get_my_puzzlebox_standings(uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.worker_get_my_puzzlebox_standings(uuid, text, text, jsonb) to service_role;
