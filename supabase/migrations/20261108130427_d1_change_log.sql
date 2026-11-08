-- Change log for the D1 shadow copy (docs/supabase-exit/D1_SCHEMA_DESIGN.md 5.1).
-- Rollout: db-first-additive. Order: before-push.
-- Adds one table, one trigger function, and an AFTER row trigger on each of the 27
-- tables the step-2 sync copies to D1. No deployed reader or writer touches the new
-- table, and the triggers only append to it: they return nothing, change no row, and
-- run as the owner, so every write the deployed app sends keeps its result and rows.
-- Rollback: docs/release/d1-change-log/rollback_d1_change_log.sql.
--
-- Logged tables (design 4 and 7: every public table except nav_indicators,
-- debate_cycles, colorful_philosopher_reactions and defragment_posts):
--   comments, comment_likes, likes, this_or_that_post_likes, this_or_that_post_votes,
--   favorite_tournament_plays, resource_reactions, resource_reaction_counts, runs,
--   combo_posts, transfigure_posts, this_or_that_posts, chemical_posts,
--   decisions_decisions_posts, favorite_tournament_posts, pagestorm_posts,
--   favorite_tournament_candidate_stats, community_stories, defragment_bodies,
--   pagestorm_drafts, contact_inquiries, colorful_philosopher_posts,
--   profile_character_nickname_pools, puzzlebox_players, puzzlebox_runs,
--   puzzlebox_best, puzzlebox_board_stats.
--
-- One log row per changed row:
--   I: new_row is the whole new row, old_row is null.
--   U: new_row holds only the columns whose value changed (new values); old_row is the
--      whole old row, which carries the key the sync matches on (design 5.3 item 4).
--      An UPDATE that changes no column writes no log row.
--   D: old_row is the whole old row, new_row is null.
-- Columns named as trigger arguments (runs.raw) are removed from both images.
-- heavy_changed is true when one of them was in the new image before removal: a run
-- I, or a U that changed raw. The sync then fetches the raw text by itself (5.3 item 9).
-- row_bytes is octet_length(new_row::text) + octet_length(old_row::text), a missing
-- image counting 0; the sync pages its body reads by it (5.3 item 2).
-- env comes from the row. comment_likes has no env, so it takes the parent comment's;
-- in a cascaded delete the parent is already gone and env is null (every env).
-- profile_character_nickname_pools and puzzlebox_players have no env: null.
--
-- Only the service role reads the log: RLS on with no policy, and anon and
-- authenticated (and public) hold no privilege on the table, its sequence or the
-- function. The function is SECURITY DEFINER so anon and authenticated writers, who
-- reach the logged tables through RLS, still append their log row.
-- No index beyond the identity key: the sync reads id ranges and id lists (5.3 items
-- 2 and 3), and the daily delete of rows older than 7 days (item 12) scans a table
-- that holds about a week of changes. Until the sync cron runs, nothing deletes rows.
--
-- The file runs as one transaction: any failed statement rolls back everything.

-- Fail fast instead of queueing the API behind this migration.
select pg_catalog.set_config('lock_timeout', '3s', true);

create table if not exists public.d1_change_log (
  id bigint generated always as identity primary key,
  env text,
  table_name text not null,
  op text not null,
  new_row jsonb,
  old_row jsonb,
  heavy_changed boolean not null default false,
  row_bytes integer not null,
  changed_at timestamptz not null default clock_timestamp(),
  constraint d1_change_log_op_check check (op in ('I', 'U', 'D'))
);

alter table public.d1_change_log enable row level security;

revoke all on table public.d1_change_log from public, anon, authenticated;
revoke all on sequence public.d1_change_log_id_seq from public, anon, authenticated;

create or replace function public.d1_log_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_new jsonb;
  v_old jsonb;
  v_env text;
  v_heavy boolean := false;
  v_col text;
begin
  if tg_op = 'INSERT' then
    v_new := pg_catalog.to_jsonb(new);
  elsif tg_op = 'DELETE' then
    v_old := pg_catalog.to_jsonb(old);
  else
    v_old := pg_catalog.to_jsonb(old);
    select pg_catalog.jsonb_object_agg(n.key, n.value)
      into v_new
      from pg_catalog.jsonb_each(pg_catalog.to_jsonb(new)) as n (key, value)
     where n.value is distinct from (v_old -> n.key);
    if v_new is null then
      return null;
    end if;
  end if;

  v_env := coalesce(v_new ->> 'env', v_old ->> 'env');
  if tg_table_name = 'comment_likes' then
    select c.env
      into v_env
      from public.comments as c
     where c.id = (coalesce(v_new ->> 'comment_id', v_old ->> 'comment_id'))::uuid;
  end if;

  if tg_nargs > 0 then
    foreach v_col in array tg_argv loop
      v_heavy := v_heavy or coalesce(v_new ? v_col, false);
      v_new := v_new - v_col;
      v_old := v_old - v_col;
    end loop;
  end if;

  insert into public.d1_change_log (env, table_name, op, new_row, old_row, heavy_changed, row_bytes)
  values (
    v_env,
    tg_table_name,
    left(tg_op, 1),
    v_new,
    v_old,
    v_heavy,
    coalesce(octet_length(v_new::text), 0) + coalesce(octet_length(v_old::text), 0)
  );
  return null;
end;
$$;

-- Triggers do not need EXECUTE at fire time.
revoke all on function public.d1_log_change() from public, anon, authenticated;

-- CREATE TRIGGER takes SHARE ROW EXCLUSIVE, which waits for writers. Take every table up
-- front in the order writes reach them (engagement row, then the post or run whose
-- counter its trigger updates; tournament play, then the tournament, then its stats;
-- puzzlebox player, run, best, board stats) so this file cannot deadlock with a like,
-- comment, vote, reaction, play or puzzlebox run in progress. A post deleted at the same
-- moment takes the post first, then its likes, votes or plays: that delete or this file
-- may fail and be retried. Reads are never blocked. The CLI sends this file as one
-- pipeline with no BEGIN, and Postgres refuses a top-level LOCK TABLE there (25P01);
-- inside a DO block it runs, and the locks last until the commit.
do $$
begin
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
    in share row exclusive mode;
end
$$;

create or replace trigger d1_change_log
  after insert or update or delete on public.comments
  for each row execute function public.d1_log_change();
create or replace trigger d1_change_log
  after insert or update or delete on public.comment_likes
  for each row execute function public.d1_log_change();
create or replace trigger d1_change_log
  after insert or update or delete on public.likes
  for each row execute function public.d1_log_change();
create or replace trigger d1_change_log
  after insert or update or delete on public.this_or_that_post_likes
  for each row execute function public.d1_log_change();
create or replace trigger d1_change_log
  after insert or update or delete on public.this_or_that_post_votes
  for each row execute function public.d1_log_change();
create or replace trigger d1_change_log
  after insert or update or delete on public.favorite_tournament_plays
  for each row execute function public.d1_log_change();
create or replace trigger d1_change_log
  after insert or update or delete on public.resource_reactions
  for each row execute function public.d1_log_change();
create or replace trigger d1_change_log
  after insert or update or delete on public.resource_reaction_counts
  for each row execute function public.d1_log_change();
-- The run file stays out of the log; heavy_changed says when the sync must fetch it.
create or replace trigger d1_change_log
  after insert or update or delete on public.runs
  for each row execute function public.d1_log_change('raw');
create or replace trigger d1_change_log
  after insert or update or delete on public.combo_posts
  for each row execute function public.d1_log_change();
create or replace trigger d1_change_log
  after insert or update or delete on public.transfigure_posts
  for each row execute function public.d1_log_change();
create or replace trigger d1_change_log
  after insert or update or delete on public.this_or_that_posts
  for each row execute function public.d1_log_change();
create or replace trigger d1_change_log
  after insert or update or delete on public.chemical_posts
  for each row execute function public.d1_log_change();
create or replace trigger d1_change_log
  after insert or update or delete on public.decisions_decisions_posts
  for each row execute function public.d1_log_change();
create or replace trigger d1_change_log
  after insert or update or delete on public.favorite_tournament_posts
  for each row execute function public.d1_log_change();
create or replace trigger d1_change_log
  after insert or update or delete on public.pagestorm_posts
  for each row execute function public.d1_log_change();
create or replace trigger d1_change_log
  after insert or update or delete on public.favorite_tournament_candidate_stats
  for each row execute function public.d1_log_change();
create or replace trigger d1_change_log
  after insert or update or delete on public.community_stories
  for each row execute function public.d1_log_change();
create or replace trigger d1_change_log
  after insert or update or delete on public.defragment_bodies
  for each row execute function public.d1_log_change();
create or replace trigger d1_change_log
  after insert or update or delete on public.pagestorm_drafts
  for each row execute function public.d1_log_change();
create or replace trigger d1_change_log
  after insert or update or delete on public.contact_inquiries
  for each row execute function public.d1_log_change();
create or replace trigger d1_change_log
  after insert or update or delete on public.colorful_philosopher_posts
  for each row execute function public.d1_log_change();
create or replace trigger d1_change_log
  after insert or update or delete on public.profile_character_nickname_pools
  for each row execute function public.d1_log_change();
create or replace trigger d1_change_log
  after insert or update or delete on public.puzzlebox_players
  for each row execute function public.d1_log_change();
create or replace trigger d1_change_log
  after insert or update or delete on public.puzzlebox_runs
  for each row execute function public.d1_log_change();
create or replace trigger d1_change_log
  after insert or update or delete on public.puzzlebox_best
  for each row execute function public.d1_log_change();
create or replace trigger d1_change_log
  after insert or update or delete on public.puzzlebox_board_stats
  for each row execute function public.d1_log_change();
