alter table public.transfigure_posts
  drop constraint if exists transfigure_posts_content_card_keywords_check,
  drop constraint if exists transfigure_posts_upgraded_card_keywords_check,
  drop column if exists content_includes_card_keywords,
  drop column if exists upgraded_content_includes_card_keywords;
