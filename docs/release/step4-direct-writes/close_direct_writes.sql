-- Step 4, last item (docs/SUPABASE_EXIT_PLAN.md 7.3, docs/supabase-exit/STEP4_WRITE_GATE.md 7): closes the
-- browser's direct writes to Supabase, so tabs still running old JS cannot write past the Worker. It drops
-- every INSERT, UPDATE and DELETE policy of anon and authenticated (50; SELECT policies stay) and takes
-- EXECUTE on the two write RPCs from them. The service role bypasses RLS and keeps EXECUTE, so the
-- Worker's worker-mode writes go on.
--
-- Not a migration: it must stay out of supabase/migrations and is applied by hand, with the user's
-- approval, only when all of these hold (in this order):
--   1. supabase/migrations/20261108160000_worker_write_actor.sql is applied.
--   2. Every screen group is on the api path (path.<group> = api) and every write.<group> = worker.
--   3. The deployed Worker has API_SUPABASE_SERVICE_KEY and API_WRITE_MODE_DEFAULT=worker, so a failed
--      flag read falls back to worker mode, not to the token path these policies served.
-- Undo: docs/release/step4-direct-writes/restore_direct_writes.sql (restore first, then flags back to rls).
-- Run with: supabase db query --linked -f docs/release/step4-direct-writes/close_direct_writes.sql
begin;

select pg_catalog.set_config('lock_timeout', '3s', true);

-- chemical_posts
drop policy if exists chemical_posts_delete on public.chemical_posts;
drop policy if exists chemical_posts_insert on public.chemical_posts;
-- colorful_philosopher_reactions
drop policy if exists colorful_philosopher_reactions_delete on public.colorful_philosopher_reactions;
drop policy if exists colorful_philosopher_reactions_insert on public.colorful_philosopher_reactions;
drop policy if exists colorful_philosopher_reactions_update on public.colorful_philosopher_reactions;
-- combo_posts
drop policy if exists combo_posts_delete on public.combo_posts;
drop policy if exists combo_posts_insert on public.combo_posts;
drop policy if exists combo_posts_update on public.combo_posts;
-- comment_likes
drop policy if exists comment_likes_delete on public.comment_likes;
drop policy if exists comment_likes_insert on public.comment_likes;
-- comments
drop policy if exists comments_delete on public.comments;
drop policy if exists comments_insert on public.comments;
-- community_stories
drop policy if exists community_stories_delete on public.community_stories;
drop policy if exists community_stories_insert on public.community_stories;
-- contact_inquiries
drop policy if exists contact_inquiries_insert_owner on public.contact_inquiries;
drop policy if exists contact_inquiries_update_reply_seen on public.contact_inquiries;
-- decisions_decisions_posts
drop policy if exists decisions_decisions_posts_delete on public.decisions_decisions_posts;
drop policy if exists decisions_decisions_posts_insert on public.decisions_decisions_posts;
drop policy if exists decisions_decisions_posts_update on public.decisions_decisions_posts;
-- defragment_bodies
drop policy if exists defragment_bodies_delete on public.defragment_bodies;
drop policy if exists defragment_bodies_insert on public.defragment_bodies;
drop policy if exists defragment_bodies_update on public.defragment_bodies;
-- defragment_posts
drop policy if exists defragment_posts_delete on public.defragment_posts;
drop policy if exists defragment_posts_insert on public.defragment_posts;
drop policy if exists defragment_posts_update on public.defragment_posts;
-- favorite_tournament_posts
drop policy if exists favorite_tournament_posts_delete on public.favorite_tournament_posts;
drop policy if exists favorite_tournament_posts_insert on public.favorite_tournament_posts;
-- likes
drop policy if exists likes_delete on public.likes;
drop policy if exists likes_insert on public.likes;
-- pagestorm_drafts
drop policy if exists pagestorm_drafts_delete on public.pagestorm_drafts;
drop policy if exists pagestorm_drafts_insert on public.pagestorm_drafts;
drop policy if exists pagestorm_drafts_update on public.pagestorm_drafts;
-- pagestorm_posts
drop policy if exists pagestorm_posts_delete on public.pagestorm_posts;
drop policy if exists pagestorm_posts_insert on public.pagestorm_posts;
drop policy if exists pagestorm_posts_update on public.pagestorm_posts;
-- resource_reactions
drop policy if exists resource_reactions_delete on public.resource_reactions;
drop policy if exists resource_reactions_insert on public.resource_reactions;
drop policy if exists resource_reactions_update on public.resource_reactions;
-- runs
drop policy if exists runs_delete on public.runs;
drop policy if exists runs_insert on public.runs;
drop policy if exists runs_update on public.runs;
-- this_or_that_post_likes
drop policy if exists this_or_that_post_likes_delete_owner on public.this_or_that_post_likes;
drop policy if exists this_or_that_post_likes_insert_owner on public.this_or_that_post_likes;
-- this_or_that_post_votes
drop policy if exists this_or_that_post_votes_delete_owner on public.this_or_that_post_votes;
drop policy if exists this_or_that_post_votes_insert_owner on public.this_or_that_post_votes;
-- this_or_that_posts
drop policy if exists this_or_that_posts_delete on public.this_or_that_posts;
drop policy if exists this_or_that_posts_insert on public.this_or_that_posts;
-- transfigure_posts
drop policy if exists transfigure_posts_delete on public.transfigure_posts;
drop policy if exists transfigure_posts_insert on public.transfigure_posts;
drop policy if exists transfigure_posts_update on public.transfigure_posts;

-- The write RPCs: their actor wrappers run as the service role, which keeps EXECUTE.
revoke execute on function public.complete_favorite_tournament_play(uuid, text, integer, text, text, jsonb) from anon, authenticated;
revoke execute on function public.submit_puzzlebox_run(text, text, text, jsonb, jsonb) from authenticated;

commit;
