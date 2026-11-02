-- Reverses 20261031044402_rls_hardening.sql. Prepared for an incident only: it is
-- not a migration file and must stay out of supabase/migrations. It restores the
-- previous policies, grants, function bodies, and constraints. No row data changed
-- in the migration, so nothing else needs restoring. Afterwards record the revert:
--   supabase migration repair 20261031044402 --status reverted --linked
-- Run with: supabase db query --linked -f docs/release/rls-hardening/rollback_rls_hardening.sql
begin;

select pg_catalog.set_config('lock_timeout', '3s', true);

lock table
  public.this_or_that_post_like_counts,
  public.likes,
  public.comments,
  public.community_stories,
  public.this_or_that_post_likes,
  public.this_or_that_post_votes,
  public.resource_reactions,
  public.resource_reaction_counts,
  public.colorful_philosopher_reactions,
  public.defragment_bodies,
  public.pagestorm_drafts,
  public.combo_posts,
  public.transfigure_posts,
  public.this_or_that_posts,
  public.chemical_posts,
  public.defragment_posts,
  public.decisions_decisions_posts,
  public.pagestorm_posts,
  public.runs,
  public.favorite_tournament_posts,
  public.favorite_tournament_plays,
  public.favorite_tournament_candidate_stats
  in access exclusive mode;

-- Constraints added by the migration, found by name.
do $$
declare
  c record;
begin
  for c in
    select k.conrelid::regclass as tbl, k.conname
    from pg_constraint k
    where k.connamespace = 'public'::regnamespace
      and k.contype = 'c'
      and (
        k.conname in (
          'combo_posts_content_size_check', 'chemical_posts_content_size_check',
          'defragment_posts_content_size_check', 'defragment_bodies_content_size_check',
          'pagestorm_posts_content_size_check', 'pagestorm_drafts_content_size_check',
          'transfigure_posts_content_size_check', 'transfigure_posts_text_size_check',
          'decisions_decisions_posts_layout_size_check', 'favorite_tournament_posts_pool_size_check',
          'favorite_tournament_plays_matches_size_check', 'comments_blocks_size_check',
          'community_stories_refs_size_check', 'runs_raw_size_check', 'runs_meta_size_check',
          'resource_reactions_key_length_check', 'likes_key_size_check', 'comments_key_size_check',
          'community_stories_key_size_check', 'this_or_that_posts_key_size_check',
          'transfigure_posts_key_size_check', 'runs_key_size_check'
        )
        or k.conname like '%\_author\_token\_size\_check'
        or k.conname in (
          'likes_env_check', 'comments_env_check', 'community_stories_env_check',
          'this_or_that_post_likes_env_check', 'this_or_that_post_votes_env_check',
          'resource_reaction_counts_env_check', 'defragment_bodies_env_check',
          'pagestorm_drafts_env_check', 'combo_posts_env_check', 'transfigure_posts_env_check',
          'this_or_that_posts_env_check', 'chemical_posts_env_check', 'defragment_posts_env_check',
          'decisions_decisions_posts_env_check', 'pagestorm_posts_env_check', 'runs_env_check',
          'favorite_tournament_posts_env_check', 'favorite_tournament_plays_env_check',
          'favorite_tournament_candidate_stats_env_check'
        )
      )
  loop
    execute format('alter table %s drop constraint %I', c.tbl, c.conname);
  end loop;
end
$$;

-- Guards.
do $$
declare
  t text;
begin
  foreach t in array array[
    'combo_posts', 'transfigure_posts', 'this_or_that_posts', 'chemical_posts',
    'defragment_posts', 'decisions_decisions_posts', 'pagestorm_posts',
    'favorite_tournament_posts', 'runs', 'comments', 'community_stories'
  ] loop
    execute format('drop trigger if exists %I on public.%I', t || '_guard_server_columns', t);
  end loop;
end
$$;

drop function if exists public.guard_post_server_columns();
drop function if exists public.guard_insert_server_columns();

-- Reactions.
drop policy if exists resource_reactions_update on public.resource_reactions;
create policy resource_reactions_update on public.resource_reactions
  for update using (auth.uid() = user_id);
revoke update (kind) on public.resource_reactions from authenticated;
grant update on public.resource_reactions to anon, authenticated;
revoke update (kind) on public.colorful_philosopher_reactions from authenticated;
grant update on public.colorful_philosopher_reactions to authenticated;

-- Overlays.
drop policy if exists "defragment_bodies_insert" on public.defragment_bodies;
create policy "defragment_bodies_insert" on public.defragment_bodies
  for insert with check (auth.uid() = user_id);
drop policy if exists "defragment_bodies_update" on public.defragment_bodies;
create policy "defragment_bodies_update" on public.defragment_bodies
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
drop function if exists public.defragment_source_owned(text, uuid, text);

-- Previous RPC, verbatim from 20260828041652_favorite_tournament.sql.
create or replace function public.complete_favorite_tournament_play(
  p_tournament_id uuid,
  p_env text,
  p_starting_size integer,
  p_champion_type text,
  p_champion_id text,
  p_matches jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  match_item jsonb;
  left_type text;
  left_id text;
  right_type text;
  right_id text;
  winner text;
  ranked record;
  rank_i integer := 0;
  snapshot jsonb;
begin
  if actor is null then
    raise exception 'not authenticated';
  end if;
  if p_starting_size is null or p_starting_size < 2 then
    raise exception 'invalid starting size';
  end if;
  if jsonb_typeof(p_matches) is distinct from 'array' then
    raise exception 'invalid matches';
  end if;
  if jsonb_array_length(p_matches) <> (p_starting_size - 1) then
    raise exception 'match count must be starting size minus one';
  end if;

  if not exists (
    select 1
    from public.favorite_tournament_posts
    where id = p_tournament_id and env = p_env
  ) then
    raise exception 'tournament not found';
  end if;

  insert into public.favorite_tournament_plays (
    tournament_id, user_id, env, starting_size, champion_type, champion_id, matches
  ) values (
    p_tournament_id, actor, p_env, p_starting_size, p_champion_type, p_champion_id, p_matches
  );

  update public.favorite_tournament_posts
    set play_count = play_count + 1
    where id = p_tournament_id and env = p_env;

  for match_item in select value from jsonb_array_elements(p_matches)
  loop
    left_type := match_item->>'left_type';
    left_id := match_item->>'left_id';
    right_type := match_item->>'right_type';
    right_id := match_item->>'right_id';
    winner := match_item->>'winner';
    if left_type is null or left_id is null or right_type is null or right_id is null then
      raise exception 'invalid match';
    end if;
    if winner is distinct from 'left' and winner is distinct from 'right' then
      raise exception 'invalid winner';
    end if;

    insert into public.favorite_tournament_candidate_stats (
      tournament_id, env, resource_type, resource_id, match_appearances, match_wins
    ) values (
      p_tournament_id, p_env, left_type, left_id, 1, case when winner = 'left' then 1 else 0 end
    )
    on conflict (tournament_id, env, resource_type, resource_id)
    do update set
      match_appearances = public.favorite_tournament_candidate_stats.match_appearances + 1,
      match_wins = public.favorite_tournament_candidate_stats.match_wins
        + case when winner = 'left' then 1 else 0 end;

    insert into public.favorite_tournament_candidate_stats (
      tournament_id, env, resource_type, resource_id, match_appearances, match_wins
    ) values (
      p_tournament_id, p_env, right_type, right_id, 1, case when winner = 'right' then 1 else 0 end
    )
    on conflict (tournament_id, env, resource_type, resource_id)
    do update set
      match_appearances = public.favorite_tournament_candidate_stats.match_appearances + 1,
      match_wins = public.favorite_tournament_candidate_stats.match_wins
        + case when winner = 'right' then 1 else 0 end;
  end loop;

  insert into public.favorite_tournament_candidate_stats (
    tournament_id, env, resource_type, resource_id, championships
  ) values (
    p_tournament_id, p_env, p_champion_type, p_champion_id, 1
  )
  on conflict (tournament_id, env, resource_type, resource_id)
  do update set
    championships = public.favorite_tournament_candidate_stats.championships + 1;

  snapshot := jsonb_build_object('at', timezone('utc', now())::text);

  for ranked in
    select resource_type, resource_id, current_rank
    from public.favorite_tournament_candidate_stats
    where tournament_id = p_tournament_id and env = p_env
    order by
      championships desc,
      case when match_appearances > 0 then match_wins::numeric / match_appearances else 0 end desc,
      match_appearances desc,
      resource_type,
      resource_id
  loop
    rank_i := rank_i + 1;
    update public.favorite_tournament_candidate_stats
      set
        current_rank = rank_i,
        rank_history = case
          when ranked.current_rank is distinct from rank_i then
            rank_history || (snapshot || jsonb_build_object('rank', rank_i))
          else rank_history
        end
      where tournament_id = p_tournament_id
        and env = p_env
        and resource_type = ranked.resource_type
        and resource_id = ranked.resource_id;
  end loop;

  return jsonb_build_object('ok', true);
end;
$$;

alter view public.this_or_that_post_like_counts reset (security_invoker);

alter function public.apply_colorful_philosopher_reaction_counts() set search_path = public;
alter function public.apply_resource_reaction_counts() set search_path = public;
grant execute on function public.apply_colorful_philosopher_reaction_counts() to public, anon, authenticated;
grant execute on function public.apply_resource_reaction_counts() to public, anon, authenticated;
alter function public.apply_this_or_that_like_count_delta() set search_path = public;
alter function public.apply_this_or_that_vote_count_delta() set search_path = public;
alter function public.apply_toybox_thread_engagement_delta() set search_path = public;

commit;
