-- Add Transfigure card color/pool overlay (Compendium affiliation).
-- Nullable so existing rows and old writers stay valid. Old app ignores
-- the unused column on read and does not write it.
--
-- Rollout: DB-first additive. Old app + new DB is safe. Apply before
-- the consumer that writes transformed_card_color.

alter table public.transfigure_posts
  add column if not exists transformed_card_color text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'transfigure_posts_transformed_card_color_check'
      and conrelid = 'public.transfigure_posts'::regclass
  ) then
    alter table public.transfigure_posts
      add constraint transfigure_posts_transformed_card_color_check
      check (
        transformed_card_color is null
        or (
          resource_type = 'card'
          and transformed_card_color in (
            'ironclad',
            'silent',
            'regent',
            'necrobinder',
            'defect',
            'colorless',
            'status',
            'curse',
            'event',
            'quest',
            'token'
          )
        )
      );
  end if;
end
$$;
