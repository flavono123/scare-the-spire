-- Multi-variant transfigure posts.
-- The existing row columns keep holding the representative (first) variant so
-- deployed readers, feed RPCs (`to_jsonb(p.*)`), OG metadata, and pagestorm
-- snapshots stay valid. Variants 2..N live in `extra_variants`, each item using
-- the same field names as the row's variant columns.

alter table public.transfigure_posts
  add column if not exists extra_variants jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'transfigure_posts_extra_variants_shape'
      and conrelid = 'public.transfigure_posts'::regclass
  ) then
    alter table public.transfigure_posts
      add constraint transfigure_posts_extra_variants_shape check (
        jsonb_typeof(extra_variants) = 'array'
        and jsonb_array_length(extra_variants) <= 11
        and octet_length(extra_variants::text) <= 262144
      );
  end if;
end $$;
