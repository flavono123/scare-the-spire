alter table public.transfigure_posts
  add column if not exists title text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'transfigure_posts_title_length_check'
      and conrelid = 'public.transfigure_posts'::regclass
  ) then
    alter table public.transfigure_posts
      add constraint transfigure_posts_title_length_check
      check (
        title is null
        or char_length(btrim(title)) between 1 and 80
      );
  end if;
end
$$;
