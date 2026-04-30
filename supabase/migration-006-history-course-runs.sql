-- History course (역사 강의서) anonymous run donations
--
-- Runs are content-addressed by `id` (the runRouteSlug — HASH_VERSION
-- + 15-char base32 hash). Two donors uploading the same .run file
-- collapse to one row. donor_user_id records who first donated; we
-- reject re-donation by anyone else (unique constraint on id alone).
--
-- The raw .run JSON is stored verbatim so the client can re-parse
-- without depending on our schema. parsed_meta columns let the
-- public listing query without parsing JSON server-side.

create table runs (
  id text primary key,
  raw text not null,
  seed text not null,
  build text not null,
  character text not null,
  ascension int not null,
  win boolean not null,
  start_time bigint,
  run_time int,
  acts_count int not null,
  donor_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

create index idx_runs_created on runs(created_at desc);
create index idx_runs_character on runs(character);
create index idx_runs_build on runs(build);

alter table runs enable row level security;

-- Anyone (logged in or not) can read any donated run.
create policy "runs_read" on runs
  for select using (true);

-- Authenticated user can donate; donor_user_id must equal their uid.
create policy "runs_insert" on runs
  for insert with check (auth.uid() = donor_user_id);

-- Donor can take their own donation back.
create policy "runs_delete" on runs
  for delete using (auth.uid() = donor_user_id);
