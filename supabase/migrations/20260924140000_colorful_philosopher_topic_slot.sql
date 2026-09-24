alter table public.colorful_philosopher_posts
  drop constraint if exists colorful_philosopher_posts_slot_check;

alter table public.colorful_philosopher_posts
  add constraint colorful_philosopher_posts_slot_check
  check (slot in ('topic', 'card', 'relic', 'power'));

alter table public.colorful_philosopher_posts
  drop constraint if exists colorful_philosopher_posts_type_check;

alter table public.colorful_philosopher_posts
  add constraint colorful_philosopher_posts_type_check
  check (
    (slot = 'topic' and resource_type <> 'topic')
    or resource_type = slot
  );
