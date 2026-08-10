-- Additive cover metadata for History Course YouTube-style index thumbs.
-- Nullable jsonb; old clients ignore the column. New clients write on donate
-- and may backfill locally from raw when null.

alter table public.runs
  add column if not exists cover_spec jsonb;

comment on column public.runs.cover_spec is
  'YouTube-style cover: background, phrase, elements (1-3). See CoverSpec.';
