-- Official worldcups have no owner. user_id stays required for visitor posts.
-- DB-first additive: existing rows all have user_id; old app still inserts with one.

alter table public.favorite_tournament_posts
  alter column user_id drop not null;

alter table public.favorite_tournament_posts
  drop constraint if exists favorite_tournament_posts_user_id_builtin_check;

alter table public.favorite_tournament_posts
  add constraint favorite_tournament_posts_user_id_builtin_check
  check (
    (
      preset_key like 'builtin:%'
      and user_id is null
    )
    or (
      preset_key not like 'builtin:%'
      and user_id is not null
    )
  );
