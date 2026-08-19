-- Additive nullable token appearance for Transfigure relic/potion/power posts.
-- DB-first safe: old app ignores unused columns; writers leave them null.

alter table public.transfigure_posts
  add column if not exists token_color text,
  add column if not exists token_wax text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'transfigure_posts_token_color_check'
      and conrelid = 'public.transfigure_posts'::regclass
  ) then
    alter table public.transfigure_posts
      add constraint transfigure_posts_token_color_check
      check (
        token_color is null
        or (
          resource_type in ('relic', 'potion', 'power', 'enchantment', 'affliction')
          and token_color in (
            'gold', 'red', 'green', 'orange', 'pink', 'aqua', 'blue', 'purple'
          )
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'transfigure_posts_token_wax_check'
      and conrelid = 'public.transfigure_posts'::regclass
  ) then
    alter table public.transfigure_posts
      add constraint transfigure_posts_token_wax_check
      check (
        token_wax is null
        or (
          resource_type in ('relic', 'potion', 'power', 'enchantment', 'affliction')
          and token_wax in ('wax', 'melted')
        )
      );
  end if;
end
$$;
