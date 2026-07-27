alter table public.transfigure_posts
  add column if not exists show_upgrade boolean not null default false;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'transfigure_posts_show_upgrade_card_check'
      and conrelid = 'public.transfigure_posts'::regclass
  ) then
    alter table public.transfigure_posts
      add constraint transfigure_posts_show_upgrade_card_check
      check (not show_upgrade or resource_type = 'card');
  end if;
end
$$;
