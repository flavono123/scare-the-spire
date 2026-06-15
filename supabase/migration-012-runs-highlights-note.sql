-- Store lightweight History Course index highlights and future one-line notes.

alter table runs
  add column if not exists highlight_card jsonb,
  add column if not exists highlight_relic jsonb,
  add column if not exists note_blocks jsonb;

alter table runs
  add constraint runs_note_blocks_is_array
  check (note_blocks is null or jsonb_typeof(note_blocks) = 'array');

comment on column runs.highlight_card is
  'Deterministic final-deck card highlight for History Course index cards.';

comment on column runs.highlight_relic is
  'Deterministic final-relic highlight for History Course index cards.';

comment on column runs.note_blocks is
  'Optional 30-character rich reference note using Chemical X/PostBlock format.';
