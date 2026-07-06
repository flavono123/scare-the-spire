-- Story reactions backed by the existing likes table.
-- Existing likes become ThumbUp reactions.

alter table public.likes
  add column if not exists reaction_type text not null default 'thumb_up';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'likes_reaction_type_check'
      and conrelid = 'public.likes'::regclass
  ) then
    alter table public.likes
      add constraint likes_reaction_type_check
      check (
        reaction_type in (
          'exclamation',
          'skull',
          'thumb_down',
          'sad_slime',
          'question_mark',
          'heart',
          'thumb_up',
          'happy_cultist'
        )
      );
  end if;
end $$;

create index if not exists idx_likes_env_story_reaction
  on public.likes(env, story_id, reaction_type);

create or replace function public.get_story_reaction_counts(p_env text)
returns table(story_id text, reaction_type text, reaction_count bigint)
language sql
stable
as $$
  select
    likes.story_id,
    likes.reaction_type,
    count(*) as reaction_count
  from public.likes
  where likes.env = p_env
  group by likes.story_id, likes.reaction_type;
$$;

grant execute on function public.get_story_reaction_counts(text) to anon, authenticated;
