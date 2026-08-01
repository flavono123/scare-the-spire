drop policy if exists "combo_posts_update" on public.combo_posts;
create policy "combo_posts_update" on public.combo_posts
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
