-- Expand comments.content so 200-character visible comments can store
-- mention/keyword encoding. Application visible cap is 200; this column
-- check is storage headroom, not the editor counter.
--
-- Rollout: DB-first loosening. Old app still writes short comments.
-- New app + old DB can reject encoded content if the live check is 30.

do $$
declare
  constraint_name text;
begin
  if exists (
    select 1
    from public.comments
    where char_length(content) < 1
       or char_length(content) > 2000
  ) then
    raise exception 'comments.content has rows outside 1..2000';
  end if;

  for constraint_name in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'comments'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ~* 'char_length\(\s*content\s*\)'
  loop
    execute format('alter table public.comments drop constraint %I', constraint_name);
  end loop;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'comments_content_length_check'
      and conrelid = 'public.comments'::regclass
  ) then
    alter table public.comments
      add constraint comments_content_length_check
      check (char_length(content) between 1 and 2000);
  end if;
end
$$;
