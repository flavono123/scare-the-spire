-- Migration 005: Add rich chemical-x-style content blocks to comments
-- Keep legacy plain-text comments untouched and render them via fallback.

alter table comments
  add column if not exists content_blocks jsonb;

comment on column comments.content_blocks is
  'Optional rich content block array for chemical-x style comment rendering.';
