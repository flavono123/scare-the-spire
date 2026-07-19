drop function if exists public.get_my_profile_activity(text, text, text, integer, integer);

create function public.get_my_profile_activity(
  p_env text,
  p_category text default 'all',
  p_sort text default 'latest',
  p_limit integer default 20,
  p_offset integer default 0
)
returns table(
  activity_id text,
  category text,
  content text,
  content_blocks jsonb,
  target_key text,
  created_at timestamptz,
  like_count bigint,
  total_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with own_activity as (
    select
      community_stories.id::text as activity_id,
      'stories'::text as category,
      community_stories.sentence as content,
      null::jsonb as content_blocks,
      'community:' || community_stories.id::text as target_key,
      community_stories.created_at,
      count(likes.id)::bigint as like_count
    from public.community_stories
    left join public.likes
      on likes.env = community_stories.env
      and likes.story_id = 'community:' || community_stories.id::text
    where community_stories.env = p_env
      and community_stories.user_id = (select auth.uid())
    group by community_stories.id

    union all

    select
      chemical_posts.id::text as activity_id,
      'chemical_x'::text as category,
      chemical_posts.content_text as content,
      chemical_posts.content as content_blocks,
      chemical_posts.id::text as target_key,
      chemical_posts.created_at,
      0::bigint as like_count
    from public.chemical_posts
    where chemical_posts.env = p_env
      and chemical_posts.user_id = (select auth.uid())

    union all

    select
      this_or_that_posts.id::text as activity_id,
      'this_or_that'::text as category,
      this_or_that_posts.reason as content,
      null::jsonb as content_blocks,
      this_or_that_posts.id::text as target_key,
      this_or_that_posts.created_at,
      count(this_or_that_post_likes.id)::bigint as like_count
    from public.this_or_that_posts
    left join public.this_or_that_post_likes
      on this_or_that_post_likes.env = this_or_that_posts.env
      and this_or_that_post_likes.post_id = this_or_that_posts.id
    where this_or_that_posts.env = p_env
      and this_or_that_posts.user_id = (select auth.uid())
    group by this_or_that_posts.id

    union all

    select
      comments.id::text as activity_id,
      'comments'::text as category,
      comments.content as content,
      comments.content_blocks,
      comments.story_id as target_key,
      comments.created_at,
      count(comment_likes.id)::bigint as like_count
    from public.comments
    left join public.comment_likes
      on comment_likes.comment_id = comments.id
    where comments.env = p_env
      and comments.user_id = (select auth.uid())
    group by comments.id
  ), filtered_activity as (
    select own_activity.*
    from own_activity
    where p_category = 'all' or own_activity.category = p_category
  )
  select
    filtered_activity.activity_id,
    filtered_activity.category,
    filtered_activity.content,
    filtered_activity.content_blocks,
    filtered_activity.target_key,
    filtered_activity.created_at,
    filtered_activity.like_count,
    count(*) over ()::bigint as total_count
  from filtered_activity
  order by
    case when p_sort = 'likes' then filtered_activity.like_count end desc,
    filtered_activity.created_at desc,
    filtered_activity.activity_id desc
  limit least(greatest(p_limit, 1), 50)
  offset greatest(p_offset, 0);
$$;

revoke execute on function public.get_my_profile_activity(text, text, text, integer, integer) from public, anon;
grant execute on function public.get_my_profile_activity(text, text, text, integer, integer) to authenticated;
