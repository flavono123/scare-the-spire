-- Classify STS1 encyclopedia comment threads as compendium.
-- Additive prefix only; the returned discriminator stays `compendium`.
-- Safe with the currently deployed app: it never writes `sts1-codex:` rows.

create or replace function public.admin_story_service(p_story_id text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case
    when p_story_id like 'sts2-patch:%' then 'patches'
    when p_story_id like 'sts2-codex:%' then 'compendium'
    when p_story_id like 'sts1-codex:%' then 'compendium'
    when p_story_id = 'byrdispatch' then 'byrdispatch'
    when p_story_id like 'c-c-c-combo:%' then 'combo'
    when p_story_id like 'transfigure:%' then 'transfigure'
    when p_story_id like 'this-or-that:%' then 'this_or_that'
    when p_story_id like 'chemical-x:%' then 'chemical_x'
    when p_story_id like 'defragment:%' then 'defragment'
    when p_story_id like 'decisions-decisions:%' then 'decisions_decisions'
    when p_story_id like 'favorite-tournament:%' then 'favorite_tournament'
    when p_story_id like 'pagestorm:%' then 'pagestorm'
    when p_story_id like 'community:%' then 'stories'
    else 'other'
  end;
$$;

revoke all on function public.admin_story_service(text) from public, anon, authenticated;
