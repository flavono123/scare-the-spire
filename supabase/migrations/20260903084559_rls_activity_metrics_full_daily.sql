-- Expand daily series from first write day (not last 28) and add write counts.
-- Extra JSON keys are ignored by older admin parsers. Site/service aggregates
-- keep the same shape.

create or replace function public.get_rls_activity_metrics(p_env text default 'production')
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with req as (
    select case
      when p_env in ('production', 'development') then p_env
      else 'production'
    end as env_key,
    (timezone('Asia/Seoul', now()))::date as today
  ),
  events as (
    select community_stories.user_id, community_stories.created_at, 'stories'::text as service
    from public.community_stories
    cross join req
    where community_stories.env = req.env_key
      and community_stories.user_id is not null
      and community_stories.static_story_id is null

    union all
    select chemical_posts.user_id, chemical_posts.created_at, 'chemical_x'
    from public.chemical_posts
    cross join req
    where chemical_posts.env = req.env_key

    union all
    select combo_posts.user_id, combo_posts.created_at, 'combo'
    from public.combo_posts
    cross join req
    where combo_posts.env = req.env_key

    union all
    select transfigure_posts.user_id, transfigure_posts.created_at, 'transfigure'
    from public.transfigure_posts
    cross join req
    where transfigure_posts.env = req.env_key

    union all
    select this_or_that_posts.user_id, this_or_that_posts.created_at, 'this_or_that'
    from public.this_or_that_posts
    cross join req
    where this_or_that_posts.env = req.env_key

    union all
    select decisions_decisions_posts.user_id, decisions_decisions_posts.created_at, 'decisions_decisions'
    from public.decisions_decisions_posts
    cross join req
    where decisions_decisions_posts.env = req.env_key

    union all
    select favorite_tournament_posts.user_id, favorite_tournament_posts.created_at, 'favorite_tournament'
    from public.favorite_tournament_posts
    cross join req
    where favorite_tournament_posts.env = req.env_key
      and favorite_tournament_posts.user_id is not null

    union all
    select runs.donor_user_id, runs.created_at, 'history_course'
    from public.runs
    cross join req
    where runs.env = req.env_key
      and runs.donor_user_id is not null

    union all
    select comments.user_id, comments.created_at, public.admin_story_service(comments.story_id)
    from public.comments
    cross join req
    where comments.env = req.env_key

    union all
    select likes.user_id, likes.created_at, public.admin_story_service(likes.story_id)
    from public.likes
    cross join req
    where likes.env = req.env_key
      and likes.created_at is not null

    union all
    select comment_likes.user_id,
      coalesce(comment_likes.created_at, comments.created_at),
      public.admin_story_service(comments.story_id)
    from public.comment_likes
    join public.comments on comments.id = comment_likes.comment_id
    cross join req
    where comments.env = req.env_key

    union all
    select this_or_that_post_likes.user_id, this_or_that_post_likes.created_at, 'this_or_that'
    from public.this_or_that_post_likes
    cross join req
    where this_or_that_post_likes.env = req.env_key

    union all
    select this_or_that_post_votes.user_id, this_or_that_post_votes.created_at, 'this_or_that'
    from public.this_or_that_post_votes
    cross join req
    where this_or_that_post_votes.env = req.env_key

    union all
    select favorite_tournament_plays.user_id, favorite_tournament_plays.created_at, 'favorite_tournament'
    from public.favorite_tournament_plays
    cross join req
    where favorite_tournament_plays.env = req.env_key

    union all
    select contact_inquiries.user_id, contact_inquiries.created_at, 'contact'
    from public.contact_inquiries
    cross join req
    where contact_inquiries.env = req.env_key
      and contact_inquiries.user_id is not null
  ),
  user_days as (
    select distinct
      events.user_id,
      events.service,
      (events.created_at at time zone 'Asia/Seoul')::date as day
    from events
    where events.user_id is not null
      and events.created_at is not null
  ),
  user_first as (
    select user_days.user_id, min(user_days.day) as first_day
    from user_days
    group by user_days.user_id
  ),
  user_summary as (
    select
      user_days.user_id,
      count(distinct user_days.day) as day_count,
      bool_or(user_days.day >= (select today from req) - 7) as in_7d,
      bool_or(user_days.day >= (select today from req) - 30) as in_30d
    from user_days
    group by user_days.user_id
  ),
  d1_retained_users as (
    select distinct user_first.user_id
    from user_first
    join user_days
      on user_days.user_id = user_first.user_id
      and user_days.day = user_first.first_day + 1
    where user_first.first_day <= (select today from req) - 1
  ),
  d7_retained_users as (
    select distinct user_first.user_id
    from user_first
    join user_days
      on user_days.user_id = user_first.user_id
      and user_days.day = user_first.first_day + 7
    where user_first.first_day <= (select today from req) - 7
  ),
  site_users as (
    select
      count(*)::bigint as identified_users,
      count(*) filter (where user_summary.in_7d)::bigint as users_7d,
      count(*) filter (where user_summary.in_30d)::bigint as users_30d,
      count(*) filter (where user_summary.day_count >= 2)::bigint as users_2plus_days,
      count(*) filter (where user_summary.day_count = 1)::bigint as single_day_users,
      count(*) filter (
        where user_first.first_day <= (select today from req) - 1
      )::bigint as d1_cohort,
      count(*) filter (
        where d1_retained_users.user_id is not null
      )::bigint as d1_retained,
      count(*) filter (
        where user_first.first_day <= (select today from req) - 7
      )::bigint as d7_cohort,
      count(*) filter (
        where d7_retained_users.user_id is not null
      )::bigint as d7_retained
    from user_summary
    join user_first on user_first.user_id = user_summary.user_id
    left join d1_retained_users on d1_retained_users.user_id = user_summary.user_id
    left join d7_retained_users on d7_retained_users.user_id = user_summary.user_id
  ),
  auth_stats as (
    select
      count(*)::bigint as auth_users,
      count(*) filter (
        where (
          coalesce(users.last_sign_in_at, users.created_at) at time zone 'Asia/Seoul'
        )::date
        > (users.created_at at time zone 'Asia/Seoul')::date
      )::bigint as auth_returned
    from auth.users as users
    where exists (
      select 1 from user_first where user_first.user_id = users.id
    )
  ),
  service_keys as (
    select unnest(array[
      'stories',
      'combo',
      'transfigure',
      'this_or_that',
      'chemical_x',
      'decisions_decisions',
      'favorite_tournament',
      'history_course',
      'patches',
      'compendium',
      'byrdispatch',
      'defragment',
      'contact',
      'other'
    ]::text[]) as service
  ),
  service_user_summary as (
    select
      user_days.service,
      user_days.user_id,
      count(distinct user_days.day) as day_count,
      bool_or(user_days.day >= (select today from req) - 7) as in_7d,
      bool_or(user_days.day >= (select today from req) - 30) as in_30d
    from user_days
    group by user_days.service, user_days.user_id
  ),
  service_users as (
    select
      service_keys.service,
      count(service_user_summary.user_id)::bigint as users_all,
      count(service_user_summary.user_id) filter (
        where service_user_summary.in_7d
      )::bigint as users_7d,
      count(service_user_summary.user_id) filter (
        where service_user_summary.in_30d
      )::bigint as users_30d,
      count(service_user_summary.user_id) filter (
        where service_user_summary.day_count >= 2
      )::bigint as users_2plus_days
    from service_keys
    left join service_user_summary
      on service_user_summary.service = service_keys.service
    group by service_keys.service
  ),
  days as (
    select generate_series(
      coalesce((select min(user_first.first_day) from user_first), (select today from req)),
      (select today from req),
      interval '1 day'
    )::date as day
  ),
  write_days as (
    select
      (events.created_at at time zone 'Asia/Seoul')::date as day,
      count(*)::bigint as writes
    from events
    where events.user_id is not null
      and events.created_at is not null
    group by 1
  ),
  daily as (
    select
      days.day::text as day,
      count(distinct user_days.user_id)::bigint as users,
      count(distinct user_first.user_id) filter (
        where user_first.first_day = days.day
      )::bigint as new_users,
      coalesce(max(write_days.writes), 0)::bigint as writes
    from days
    left join user_days on user_days.day = days.day
    left join user_first on user_first.user_id = user_days.user_id
    left join write_days on write_days.day = days.day
    group by days.day
  )
  select jsonb_build_object(
    'site', jsonb_build_object(
      'identified_users', coalesce(site_users.identified_users, 0),
      'users_7d', coalesce(site_users.users_7d, 0),
      'users_30d', coalesce(site_users.users_30d, 0),
      'users_2plus_days', coalesce(site_users.users_2plus_days, 0),
      'single_day_users', coalesce(site_users.single_day_users, 0),
      'activity_return_rate', case
        when coalesce(site_users.identified_users, 0) > 0
          then site_users.users_2plus_days::numeric / site_users.identified_users
        else null
      end,
      'd1_cohort', coalesce(site_users.d1_cohort, 0),
      'd1_retained', coalesce(site_users.d1_retained, 0),
      'd1_rate', case
        when coalesce(site_users.d1_cohort, 0) > 0
          then site_users.d1_retained::numeric / site_users.d1_cohort
        else null
      end,
      'd7_cohort', coalesce(site_users.d7_cohort, 0),
      'd7_retained', coalesce(site_users.d7_retained, 0),
      'd7_rate', case
        when coalesce(site_users.d7_cohort, 0) > 0
          then site_users.d7_retained::numeric / site_users.d7_cohort
        else null
      end,
      'auth_users', coalesce(auth_stats.auth_users, 0),
      'auth_returned', coalesce(auth_stats.auth_returned, 0),
      'auth_return_rate', case
        when coalesce(auth_stats.auth_users, 0) > 0
          then auth_stats.auth_returned::numeric / auth_stats.auth_users
        else null
      end
    ),
    'services', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'service', service_users.service,
          'users_all', service_users.users_all,
          'users_7d', service_users.users_7d,
          'users_30d', service_users.users_30d,
          'share_30d', case
            when coalesce(site_users.users_30d, 0) > 0
              then service_users.users_30d::numeric / site_users.users_30d
            else null
          end,
          'users_2plus_days', service_users.users_2plus_days,
          'return_rate', case
            when service_users.users_all > 0
              then service_users.users_2plus_days::numeric / service_users.users_all
            else null
          end
        )
        order by service_users.users_30d desc, service_users.users_all desc, service_users.service
      )
      from service_users
    ), '[]'::jsonb),
    'daily', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'day', daily.day,
          'users', daily.users,
          'new_users', daily.new_users,
          'writes', daily.writes
        )
        order by daily.day
      )
      from daily
    ), '[]'::jsonb)
  )
  from site_users
  cross join auth_stats;
$$;

revoke all on function public.get_rls_activity_metrics(text) from public, anon, authenticated;
grant execute on function public.get_rls_activity_metrics(text) to service_role;
