-- The runs table was created with a singular `id` primary key. Because
-- runId is content-addressable (same .run file = same id), donating
-- the same run on dev and on prod collided on PK and the prod insert
-- was silently dropped by upsert(ignoreDuplicates) — so prod showed
-- '이미 공유됨' but the row stayed env='dev' and never surfaced in
-- prod's list (which filters env='production').
--
-- Fix: drop the singular PK and recompose as (id, env). The same
-- content-addressable runId can now exist independently per
-- environment.
--
-- Apply via Supabase Dashboard > SQL Editor.

alter table runs drop constraint runs_pkey;
alter table runs add constraint runs_pkey primary key (id, env);
