alter table public.transfigure_posts
  add column if not exists upgraded_content jsonb,
  add column if not exists upgraded_content_text text,
  add column if not exists transformed_upgrade_cost text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'transfigure_posts_upgraded_content_array_check'
      and conrelid = 'public.transfigure_posts'::regclass
  ) then
    alter table public.transfigure_posts
      add constraint transfigure_posts_upgraded_content_array_check
      check (
        upgraded_content is null
        or jsonb_typeof(upgraded_content) = 'array'
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'transfigure_posts_upgraded_content_pair_check'
      and conrelid = 'public.transfigure_posts'::regclass
  ) then
    alter table public.transfigure_posts
      add constraint transfigure_posts_upgraded_content_pair_check
      check (
        (upgraded_content is null and upgraded_content_text is null)
        or (
          upgraded_content is not null
          and upgraded_content_text is not null
          and char_length(btrim(upgraded_content_text)) >= 2
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'transfigure_posts_transformed_upgrade_cost_check'
      and conrelid = 'public.transfigure_posts'::regclass
  ) then
    alter table public.transfigure_posts
      add constraint transfigure_posts_transformed_upgrade_cost_check
      check (
        transformed_upgrade_cost is null
        or (
          upgraded_content is not null
          and btrim(transformed_upgrade_cost) ~ '^(X|[0-9]{1,2})$'
        )
      );
  end if;
end
$$;
