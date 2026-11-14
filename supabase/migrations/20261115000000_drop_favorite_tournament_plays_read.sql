-- tasks/010 #67: favorite_tournament_plays_read was `for select using (true)` with select granted to anon,
-- so anyone holding the public anon key could read every play (user_id, matches, champion). No client reads
-- this table: plays are written by complete_favorite_tournament_play (SECURITY DEFINER) and read only by
-- the SECURITY DEFINER admin metrics RPCs and the service key. Dropping the policy and the grant changes
-- nothing for any deployed app version.
-- Rollback: docs/release/favorite-plays-read/rollback_favorite_tournament_plays_read.sql.

drop policy if exists "favorite_tournament_plays_read" on public.favorite_tournament_plays;
revoke select on public.favorite_tournament_plays from anon, authenticated;
