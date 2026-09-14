-- Allow author (donor_user_id) to update their own runs (e.g. cover_spec, note_blocks).
drop policy if exists "runs_update" on public.runs;
create policy "runs_update" on public.runs
  for update
  using (auth.uid() = donor_user_id)
  with check (auth.uid() = donor_user_id);
