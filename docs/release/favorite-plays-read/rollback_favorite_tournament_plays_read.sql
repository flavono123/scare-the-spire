-- Restores the world cup play log read policy dropped by 20261115000000_drop_favorite_tournament_plays_read.sql.
-- It reopens every play to the public anon key (tasks/010 #67); run it only to roll the app back.

grant select on public.favorite_tournament_plays to anon, authenticated;
drop policy if exists "favorite_tournament_plays_read" on public.favorite_tournament_plays;
create policy "favorite_tournament_plays_read" on public.favorite_tournament_plays
  for select using (true);
