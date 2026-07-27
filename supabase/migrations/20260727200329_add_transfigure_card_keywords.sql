alter table public.transfigure_posts
  add column if not exists card_top_keywords text[] not null default '{}'::text[],
  add column if not exists card_bottom_keywords text[] not null default '{}'::text[],
  add column if not exists upgraded_card_top_keywords text[] not null default '{}'::text[],
  add column if not exists upgraded_card_bottom_keywords text[] not null default '{}'::text[];

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'transfigure_posts_card_keyword_count_check'
      and conrelid = 'public.transfigure_posts'::regclass
  ) then
    alter table public.transfigure_posts
      add constraint transfigure_posts_card_keyword_count_check
      check (
        cardinality(card_top_keywords) <= 5
        and cardinality(card_bottom_keywords) <= 2
        and cardinality(upgraded_card_top_keywords) <= 5
        and cardinality(upgraded_card_bottom_keywords) <= 2
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'transfigure_posts_card_keywords_resource_check'
      and conrelid = 'public.transfigure_posts'::regclass
  ) then
    alter table public.transfigure_posts
      add constraint transfigure_posts_card_keywords_resource_check
      check (
        resource_type = 'card'
        or (
          cardinality(card_top_keywords) = 0
          and cardinality(card_bottom_keywords) = 0
          and cardinality(upgraded_card_top_keywords) = 0
          and cardinality(upgraded_card_bottom_keywords) = 0
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'transfigure_posts_upgraded_card_keywords_content_check'
      and conrelid = 'public.transfigure_posts'::regclass
  ) then
    alter table public.transfigure_posts
      add constraint transfigure_posts_upgraded_card_keywords_content_check
      check (
        upgraded_content is not null
        or (
          cardinality(upgraded_card_top_keywords) = 0
          and cardinality(upgraded_card_bottom_keywords) = 0
        )
      );
  end if;
end
$$;
