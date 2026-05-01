-- Add total_floors column to runs table for outcome badge display
-- ("F{N}" for losses, no badge for wins). Pre-computed at insert
-- time so the public listing doesn't have to parse raw JSON.
--
-- Apply via Supabase Dashboard > SQL Editor.

alter table runs add column total_floors int not null default 0;

-- Backfill existing rows by counting node visits across map_point_history.
update runs
set total_floors = coalesce(
  (
    select sum(jsonb_array_length(act))
    from jsonb_array_elements((raw::jsonb) -> 'map_point_history') as act
  ),
  0
);
