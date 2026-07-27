alter table public.transfigure_posts
  add column if not exists content_includes_card_keywords boolean not null default false,
  add column if not exists upgraded_content_includes_card_keywords boolean not null default false;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'transfigure_posts_content_card_keywords_check'
      and conrelid = 'public.transfigure_posts'::regclass
  ) then
    alter table public.transfigure_posts
      add constraint transfigure_posts_content_card_keywords_check
      check (
        not content_includes_card_keywords
        or resource_type = 'card'
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'transfigure_posts_upgraded_card_keywords_check'
      and conrelid = 'public.transfigure_posts'::regclass
  ) then
    alter table public.transfigure_posts
      add constraint transfigure_posts_upgraded_card_keywords_check
      check (
        not upgraded_content_includes_card_keywords
        or (
          resource_type = 'card'
          and upgraded_content is not null
        )
      );
  end if;
end
$$;
