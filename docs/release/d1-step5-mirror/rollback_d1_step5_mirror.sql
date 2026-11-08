-- Rollback of supabase/migrations/20261109010000_d1_step5_mirror.sql (Supabase exit step 5).
-- Run only after the write source is back on Supabase and the outbox is empty (no open 'out'
-- reject): nothing calls the mirror functions then. puzzlebox_runs keeps the rows the mirror
-- inserted; their ids ([2^40, 2^53)) are above the identity sequence, so new Supabase ids never meet
-- them.

drop function if exists public.mirror_run(text);
drop function if exists public.mirror_favorite_tournament_play(text, jsonb, jsonb);
alter table public.puzzlebox_runs alter column id set generated always;
