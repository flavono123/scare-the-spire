-- Reverses 20261108130427_d1_change_log.sql. Prepared for an incident only: it is not
-- a migration file and must stay out of supabase/migrations. It drops the 27 triggers,
-- then the function, then the table with every logged change in it. No other row or
-- object changed in the migration, so nothing else needs restoring. The D1 copy is
-- then stale: the step-2 sync stops finding new rows, and a later re-apply needs a new
-- first copy (design 5.2). Afterwards record the revert:
--   supabase migration repair 20261108130427 --status reverted --linked
-- Run with: supabase db query --linked -f docs/release/d1-change-log/rollback_d1_change_log.sql
begin;

select pg_catalog.set_config('lock_timeout', '3s', true);

-- DROP TRIGGER takes ACCESS EXCLUSIVE. Same table order as the migration.
lock table
  public.comments,
  public.comment_likes,
  public.likes,
  public.this_or_that_post_likes,
  public.this_or_that_post_votes,
  public.favorite_tournament_plays,
  public.resource_reactions,
  public.resource_reaction_counts,
  public.runs,
  public.combo_posts,
  public.transfigure_posts,
  public.this_or_that_posts,
  public.chemical_posts,
  public.decisions_decisions_posts,
  public.favorite_tournament_posts,
  public.pagestorm_posts,
  public.favorite_tournament_candidate_stats,
  public.community_stories,
  public.defragment_bodies,
  public.pagestorm_drafts,
  public.contact_inquiries,
  public.colorful_philosopher_posts,
  public.profile_character_nickname_pools,
  public.puzzlebox_players,
  public.puzzlebox_runs,
  public.puzzlebox_best,
  public.puzzlebox_board_stats
  in access exclusive mode;

-- Triggers first: a trigger left on a table whose log is gone would fail every write.
drop trigger if exists d1_change_log on public.comments;
drop trigger if exists d1_change_log on public.comment_likes;
drop trigger if exists d1_change_log on public.likes;
drop trigger if exists d1_change_log on public.this_or_that_post_likes;
drop trigger if exists d1_change_log on public.this_or_that_post_votes;
drop trigger if exists d1_change_log on public.favorite_tournament_plays;
drop trigger if exists d1_change_log on public.resource_reactions;
drop trigger if exists d1_change_log on public.resource_reaction_counts;
drop trigger if exists d1_change_log on public.runs;
drop trigger if exists d1_change_log on public.combo_posts;
drop trigger if exists d1_change_log on public.transfigure_posts;
drop trigger if exists d1_change_log on public.this_or_that_posts;
drop trigger if exists d1_change_log on public.chemical_posts;
drop trigger if exists d1_change_log on public.decisions_decisions_posts;
drop trigger if exists d1_change_log on public.favorite_tournament_posts;
drop trigger if exists d1_change_log on public.pagestorm_posts;
drop trigger if exists d1_change_log on public.favorite_tournament_candidate_stats;
drop trigger if exists d1_change_log on public.community_stories;
drop trigger if exists d1_change_log on public.defragment_bodies;
drop trigger if exists d1_change_log on public.pagestorm_drafts;
drop trigger if exists d1_change_log on public.contact_inquiries;
drop trigger if exists d1_change_log on public.colorful_philosopher_posts;
drop trigger if exists d1_change_log on public.profile_character_nickname_pools;
drop trigger if exists d1_change_log on public.puzzlebox_players;
drop trigger if exists d1_change_log on public.puzzlebox_runs;
drop trigger if exists d1_change_log on public.puzzlebox_best;
drop trigger if exists d1_change_log on public.puzzlebox_board_stats;

-- Without CASCADE: this fails if anything else still uses the function or the table.
drop function if exists public.d1_log_change();
drop table if exists public.d1_change_log;

commit;
