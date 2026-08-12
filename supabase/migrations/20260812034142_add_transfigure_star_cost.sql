-- Additive nullable Regent star-cost edits for Transfigure posts.
-- DB-first safe: old app ignores unused columns; writers leave them null.

alter table public.transfigure_posts
  add column if not exists transformed_star_cost text,
  add column if not exists transformed_upgrade_star_cost text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'transfigure_posts_transformed_star_cost_check'
      and conrelid = 'public.transfigure_posts'::regclass
  ) then
    alter table public.transfigure_posts
      add constraint transfigure_posts_transformed_star_cost_check
      check (
        transformed_star_cost is null
        or btrim(transformed_star_cost) ~ '^(X|[0-9]{1,2})$'
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'transfigure_posts_transformed_upgrade_star_cost_check'
      and conrelid = 'public.transfigure_posts'::regclass
  ) then
    alter table public.transfigure_posts
      add constraint transfigure_posts_transformed_upgrade_star_cost_check
      check (
        transformed_upgrade_star_cost is null
        or btrim(transformed_upgrade_star_cost) ~ '^(X|[0-9]{1,2})$'
      );
  end if;
end
$$;
