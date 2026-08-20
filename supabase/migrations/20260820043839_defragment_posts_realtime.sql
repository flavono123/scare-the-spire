-- Enable Realtime for native 조각모음 rows on the mixed board.
-- DB-first additive: old app never subscribes to defragment_posts.
-- Grants match other Toy Box post tables' default public access.

grant select, insert, update, delete
  on public.defragment_posts
  to anon, authenticated;

do $$
begin
  alter publication supabase_realtime add table public.defragment_posts;
exception
  when duplicate_object then
    null;
end $$;
