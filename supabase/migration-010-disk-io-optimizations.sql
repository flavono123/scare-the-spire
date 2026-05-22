-- Disk IO reduction indexes for public engagement and history-course reads.
-- Safe to rerun from the Supabase SQL Editor.

create or replace function public.get_engagement_counts(p_env text)
returns table(story_id text, like_count bigint, comment_count bigint)
language sql
stable
as $$
  with like_counts as (
    select likes.story_id, count(*) as cnt
    from public.likes
    where likes.env = p_env
    group by likes.story_id
  ),
  comment_counts as (
    select comments.story_id, count(*) as cnt
    from public.comments
    where comments.env = p_env
    group by comments.story_id
  )
  select
    coalesce(like_counts.story_id, comment_counts.story_id) as story_id,
    coalesce(like_counts.cnt, 0) as like_count,
    coalesce(comment_counts.cnt, 0) as comment_count
  from like_counts
  full outer join comment_counts
    on like_counts.story_id = comment_counts.story_id;
$$;

grant execute on function public.get_engagement_counts(text) to anon, authenticated;

create index if not exists idx_likes_env_story
  on public.likes(env, story_id);

create index if not exists idx_comments_env_story
  on public.comments(env, story_id);

create index if not exists idx_comment_likes_user_comment
  on public.comment_likes(user_id, comment_id);

create index if not exists idx_runs_env_created_desc
  on public.runs(env, created_at desc);

create index if not exists idx_runs_env_donor
  on public.runs(env, donor_user_id);
