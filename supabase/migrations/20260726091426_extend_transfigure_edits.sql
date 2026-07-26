alter table public.transfigure_posts
  add column if not exists transformed_name text,
  add column if not exists transformed_cost text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'transfigure_posts_transformed_name_length_check'
      and conrelid = 'public.transfigure_posts'::regclass
  ) then
    alter table public.transfigure_posts
      add constraint transfigure_posts_transformed_name_length_check
      check (
        transformed_name is null
        or char_length(btrim(transformed_name)) between 1 and 80
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'transfigure_posts_transformed_cost_check'
      and conrelid = 'public.transfigure_posts'::regclass
  ) then
    alter table public.transfigure_posts
      add constraint transfigure_posts_transformed_cost_check
      check (
        transformed_cost is null
        or btrim(transformed_cost) ~ '^(X|[0-9]{1,2})$'
      );
  end if;
end
$$;

drop policy if exists "transfigure_posts_update" on public.transfigure_posts;
create policy "transfigure_posts_update" on public.transfigure_posts
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
