alter table public.transfigure_posts
  drop constraint if exists transfigure_posts_card_keyword_count_check;

alter table public.transfigure_posts
  add constraint transfigure_posts_card_keyword_count_check
  check (
    cardinality(card_top_keywords) <= 5
    and cardinality(card_bottom_keywords) <= 3
    and cardinality(upgraded_card_top_keywords) <= 5
    and cardinality(upgraded_card_bottom_keywords) <= 3
  );
