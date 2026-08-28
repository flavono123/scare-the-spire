-- Official Favorite Tournament worldcups use preset_key `builtin:*`.
-- One row per (env, key). User inserts cannot squat the prefix; seed later
-- with a service-role / SQL upsert from FAVORITE_TOURNAMENT_BUILTIN_CATALOG.
-- DB-first additive: unused until the first builtin is seeded. Existing
-- custom / leftover named keys are unchanged.

create unique index if not exists idx_favorite_tournament_posts_env_builtin_key
  on public.favorite_tournament_posts (env, preset_key)
  where preset_key like 'builtin:%';

drop policy if exists "favorite_tournament_posts_insert" on public.favorite_tournament_posts;
create policy "favorite_tournament_posts_insert" on public.favorite_tournament_posts
  for insert with check (
    auth.uid() = user_id
    and preset_key not like 'builtin:%'
  );
