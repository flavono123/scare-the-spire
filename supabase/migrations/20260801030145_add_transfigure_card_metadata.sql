alter table public.transfigure_posts
  add column if not exists transformed_card_type text,
  add column if not exists transformed_card_rarity text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'transfigure_posts_transformed_card_type_check'
      and conrelid = 'public.transfigure_posts'::regclass
  ) then
    alter table public.transfigure_posts
      add constraint transfigure_posts_transformed_card_type_check
      check (
        transformed_card_type is null
        or (
          resource_type = 'card'
          and transformed_card_type in ('공격', '스킬', '파워')
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'transfigure_posts_transformed_card_rarity_check'
      and conrelid = 'public.transfigure_posts'::regclass
  ) then
    alter table public.transfigure_posts
      add constraint transfigure_posts_transformed_card_rarity_check
      check (
        transformed_card_rarity is null
        or (
          resource_type = 'card'
          and transformed_card_rarity in ('일반', '고급', '희귀')
        )
      );
  end if;
end
$$;
