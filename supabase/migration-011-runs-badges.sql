-- Store per-player run badges for History Course listing cards.
-- Older run files and older rows naturally have an empty badge list.

alter table runs
  add column if not exists badges jsonb not null default '[]'::jsonb;

alter table runs
  add constraint runs_badges_is_array
  check (jsonb_typeof(badges) = 'array');
