-- Undoes close_direct_writes.sql: recreates the 50 INSERT, UPDATE and DELETE policies of anon and
-- authenticated exactly as the repo's migrations define them (scripts/direct-writes-policies.spec.ts
-- checks they match, and match a public schema dump when one is given), and gives EXECUTE on the two
-- write RPCs back. Safe to run twice. Run it before turning any write.<group> flag back to rls: the rls
-- path forwards the user's token and needs these policies.
-- Run with: supabase db query --linked -f docs/release/step4-direct-writes/restore_direct_writes.sql
begin;

select pg_catalog.set_config('lock_timeout', '3s', true);

-- chemical_posts
drop policy if exists chemical_posts_delete on public.chemical_posts;
create policy chemical_posts_delete on public.chemical_posts as permissive for delete to public using ((auth.uid() = user_id));
drop policy if exists chemical_posts_insert on public.chemical_posts;
create policy chemical_posts_insert on public.chemical_posts as permissive for insert to public with check ((auth.uid() = user_id));
-- colorful_philosopher_reactions
drop policy if exists colorful_philosopher_reactions_delete on public.colorful_philosopher_reactions;
create policy colorful_philosopher_reactions_delete on public.colorful_philosopher_reactions as permissive for delete to authenticated using ((( SELECT auth.uid() AS uid) = user_id));
drop policy if exists colorful_philosopher_reactions_insert on public.colorful_philosopher_reactions;
create policy colorful_philosopher_reactions_insert on public.colorful_philosopher_reactions as permissive for insert to authenticated with check ((( SELECT auth.uid() AS uid) = user_id));
drop policy if exists colorful_philosopher_reactions_update on public.colorful_philosopher_reactions;
create policy colorful_philosopher_reactions_update on public.colorful_philosopher_reactions as permissive for update to authenticated using ((( SELECT auth.uid() AS uid) = user_id)) with check ((( SELECT auth.uid() AS uid) = user_id));
-- combo_posts
drop policy if exists combo_posts_delete on public.combo_posts;
create policy combo_posts_delete on public.combo_posts as permissive for delete to public using ((auth.uid() = user_id));
drop policy if exists combo_posts_insert on public.combo_posts;
create policy combo_posts_insert on public.combo_posts as permissive for insert to public with check ((auth.uid() = user_id));
drop policy if exists combo_posts_update on public.combo_posts;
create policy combo_posts_update on public.combo_posts as permissive for update to public using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));
-- comment_likes
drop policy if exists comment_likes_delete on public.comment_likes;
create policy comment_likes_delete on public.comment_likes as permissive for delete to public using ((auth.uid() = user_id));
drop policy if exists comment_likes_insert on public.comment_likes;
create policy comment_likes_insert on public.comment_likes as permissive for insert to public with check ((auth.uid() = user_id));
-- comments
drop policy if exists comments_delete on public.comments;
create policy comments_delete on public.comments as permissive for delete to public using ((auth.uid() = user_id));
drop policy if exists comments_insert on public.comments;
create policy comments_insert on public.comments as permissive for insert to public with check ((auth.uid() = user_id));
-- community_stories
drop policy if exists community_stories_delete on public.community_stories;
create policy community_stories_delete on public.community_stories as permissive for delete to public using ((auth.uid() = user_id));
drop policy if exists community_stories_insert on public.community_stories;
create policy community_stories_insert on public.community_stories as permissive for insert to public with check ((auth.uid() = user_id));
-- contact_inquiries
drop policy if exists contact_inquiries_insert_owner on public.contact_inquiries;
create policy contact_inquiries_insert_owner on public.contact_inquiries as permissive for insert to authenticated with check (((( SELECT auth.uid() AS uid) = user_id) AND (status = 'new'::text)));
drop policy if exists contact_inquiries_update_reply_seen on public.contact_inquiries;
create policy contact_inquiries_update_reply_seen on public.contact_inquiries as permissive for update to authenticated using ((( SELECT auth.uid() AS uid) = user_id)) with check ((( SELECT auth.uid() AS uid) = user_id));
-- decisions_decisions_posts
drop policy if exists decisions_decisions_posts_delete on public.decisions_decisions_posts;
create policy decisions_decisions_posts_delete on public.decisions_decisions_posts as permissive for delete to public using ((auth.uid() = user_id));
drop policy if exists decisions_decisions_posts_insert on public.decisions_decisions_posts;
create policy decisions_decisions_posts_insert on public.decisions_decisions_posts as permissive for insert to public with check ((auth.uid() = user_id));
drop policy if exists decisions_decisions_posts_update on public.decisions_decisions_posts;
create policy decisions_decisions_posts_update on public.decisions_decisions_posts as permissive for update to public using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));
-- defragment_bodies
drop policy if exists defragment_bodies_delete on public.defragment_bodies;
create policy defragment_bodies_delete on public.defragment_bodies as permissive for delete to public using ((auth.uid() = user_id));
drop policy if exists defragment_bodies_insert on public.defragment_bodies;
create policy defragment_bodies_insert on public.defragment_bodies as permissive for insert to authenticated with check (((( SELECT auth.uid() AS uid) = user_id) AND public.defragment_source_owned(source_service, source_id, env)));
drop policy if exists defragment_bodies_update on public.defragment_bodies;
create policy defragment_bodies_update on public.defragment_bodies as permissive for update to authenticated using ((( SELECT auth.uid() AS uid) = user_id)) with check (((( SELECT auth.uid() AS uid) = user_id) AND public.defragment_source_owned(source_service, source_id, env)));
-- defragment_posts
drop policy if exists defragment_posts_delete on public.defragment_posts;
create policy defragment_posts_delete on public.defragment_posts as permissive for delete to public using ((auth.uid() = user_id));
drop policy if exists defragment_posts_insert on public.defragment_posts;
create policy defragment_posts_insert on public.defragment_posts as permissive for insert to public with check ((auth.uid() = user_id));
drop policy if exists defragment_posts_update on public.defragment_posts;
create policy defragment_posts_update on public.defragment_posts as permissive for update to public using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));
-- favorite_tournament_posts
drop policy if exists favorite_tournament_posts_delete on public.favorite_tournament_posts;
create policy favorite_tournament_posts_delete on public.favorite_tournament_posts as permissive for delete to public using ((auth.uid() = user_id));
drop policy if exists favorite_tournament_posts_insert on public.favorite_tournament_posts;
create policy favorite_tournament_posts_insert on public.favorite_tournament_posts as permissive for insert to public with check (((auth.uid() = user_id) AND (preset_key !~~ 'builtin:%'::text)));
-- likes
drop policy if exists likes_delete on public.likes;
create policy likes_delete on public.likes as permissive for delete to public using ((auth.uid() = user_id));
drop policy if exists likes_insert on public.likes;
create policy likes_insert on public.likes as permissive for insert to public with check ((auth.uid() = user_id));
-- pagestorm_drafts
drop policy if exists pagestorm_drafts_delete on public.pagestorm_drafts;
create policy pagestorm_drafts_delete on public.pagestorm_drafts as permissive for delete to public using ((auth.uid() = user_id));
drop policy if exists pagestorm_drafts_insert on public.pagestorm_drafts;
create policy pagestorm_drafts_insert on public.pagestorm_drafts as permissive for insert to public with check ((auth.uid() = user_id));
drop policy if exists pagestorm_drafts_update on public.pagestorm_drafts;
create policy pagestorm_drafts_update on public.pagestorm_drafts as permissive for update to public using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));
-- pagestorm_posts
drop policy if exists pagestorm_posts_delete on public.pagestorm_posts;
create policy pagestorm_posts_delete on public.pagestorm_posts as permissive for delete to public using ((auth.uid() = user_id));
drop policy if exists pagestorm_posts_insert on public.pagestorm_posts;
create policy pagestorm_posts_insert on public.pagestorm_posts as permissive for insert to public with check ((auth.uid() = user_id));
drop policy if exists pagestorm_posts_update on public.pagestorm_posts;
create policy pagestorm_posts_update on public.pagestorm_posts as permissive for update to public using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));
-- resource_reactions
drop policy if exists resource_reactions_delete on public.resource_reactions;
create policy resource_reactions_delete on public.resource_reactions as permissive for delete to public using ((auth.uid() = user_id));
drop policy if exists resource_reactions_insert on public.resource_reactions;
create policy resource_reactions_insert on public.resource_reactions as permissive for insert to public with check ((auth.uid() = user_id));
drop policy if exists resource_reactions_update on public.resource_reactions;
create policy resource_reactions_update on public.resource_reactions as permissive for update to authenticated using ((( SELECT auth.uid() AS uid) = user_id)) with check ((( SELECT auth.uid() AS uid) = user_id));
-- runs
drop policy if exists runs_delete on public.runs;
create policy runs_delete on public.runs as permissive for delete to public using ((auth.uid() = donor_user_id));
drop policy if exists runs_insert on public.runs;
create policy runs_insert on public.runs as permissive for insert to public with check ((auth.uid() = donor_user_id));
drop policy if exists runs_update on public.runs;
create policy runs_update on public.runs as permissive for update to public using ((auth.uid() = donor_user_id)) with check ((auth.uid() = donor_user_id));
-- this_or_that_post_likes
drop policy if exists this_or_that_post_likes_delete_owner on public.this_or_that_post_likes;
create policy this_or_that_post_likes_delete_owner on public.this_or_that_post_likes as permissive for delete to public using ((auth.uid() = user_id));
drop policy if exists this_or_that_post_likes_insert_owner on public.this_or_that_post_likes;
create policy this_or_that_post_likes_insert_owner on public.this_or_that_post_likes as permissive for insert to public with check ((auth.uid() = user_id));
-- this_or_that_post_votes
drop policy if exists this_or_that_post_votes_delete_owner on public.this_or_that_post_votes;
create policy this_or_that_post_votes_delete_owner on public.this_or_that_post_votes as permissive for delete to public using ((( SELECT auth.uid() AS uid) = user_id));
drop policy if exists this_or_that_post_votes_insert_owner on public.this_or_that_post_votes;
create policy this_or_that_post_votes_insert_owner on public.this_or_that_post_votes as permissive for insert to public with check (((( SELECT auth.uid() AS uid) = user_id) AND (EXISTS ( SELECT 1
   FROM public.this_or_that_posts posts
  WHERE ((posts.id = this_or_that_post_votes.post_id) AND (posts.env = this_or_that_post_votes.env))))));
-- this_or_that_posts
drop policy if exists this_or_that_posts_delete on public.this_or_that_posts;
create policy this_or_that_posts_delete on public.this_or_that_posts as permissive for delete to public using ((auth.uid() = user_id));
drop policy if exists this_or_that_posts_insert on public.this_or_that_posts;
create policy this_or_that_posts_insert on public.this_or_that_posts as permissive for insert to public with check ((auth.uid() = user_id));
-- transfigure_posts
drop policy if exists transfigure_posts_delete on public.transfigure_posts;
create policy transfigure_posts_delete on public.transfigure_posts as permissive for delete to public using ((auth.uid() = user_id));
drop policy if exists transfigure_posts_insert on public.transfigure_posts;
create policy transfigure_posts_insert on public.transfigure_posts as permissive for insert to public with check ((auth.uid() = user_id));
drop policy if exists transfigure_posts_update on public.transfigure_posts;
create policy transfigure_posts_update on public.transfigure_posts as permissive for update to public using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));

grant execute on function public.complete_favorite_tournament_play(uuid, text, integer, text, text, jsonb) to anon, authenticated;
grant execute on function public.submit_puzzlebox_run(text, text, text, jsonb, jsonb) to authenticated;

commit;
