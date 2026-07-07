-- Extend community stories so seed stories and user-written stories can point
-- at one STS2 rich patch-note line.

alter table public.community_stories
  alter column user_id drop not null;

alter table public.community_stories
  add column if not exists static_story_id text,
  add column if not exists entity_type text,
  add column if not exists entity_id text,
  add column if not exists change_id text,
  add column if not exists patch_line_id text,
  add column if not exists source text,
  add column if not exists tags jsonb not null default '[]'::jsonb,
  add column if not exists linked_entities jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'community_stories_env_static_story_key'
  ) then
    alter table public.community_stories
      add constraint community_stories_env_static_story_key
      unique (env, static_story_id);
  end if;
end $$;

create index if not exists idx_community_stories_env_patch_line
  on public.community_stories(env, patch_line_id)
  where patch_line_id is not null;

insert into public.community_stories (
  static_story_id,
  user_id,
  nickname,
  sentence,
  game,
  env,
  created_at,
  entity_type,
  entity_id,
  change_id,
  patch_line_id,
  source,
  tags,
  linked_entities
) values
  (
    'sts2-doormaker-removed',
    null,
    '슬서운이야기',
    '문을 만드는 자가 있었다',
    'sts2',
    'production',
    '2026-05-08T00:00:00Z',
    'monster',
    'DOORMAKER',
    'doormaker-v105-replaced',
    'v0.105.0:line-002-monster-doormaker-monster-aeonglass',
    'v0.105.0',
    '["삭제","보스","3막"]'::jsonb,
    '[{"entityType":"monster","entityId":"AEONGLASS","label":"대체"}]'::jsonb
  ),
  (
    'sts2-infested-prism-energy-vending-machine',
    null,
    '슬서운이야기',
    '프리즘은 원래 때리면 1코 주는 자판기였다',
    'sts2',
    'production',
    '2026-06-05T00:00:00Z',
    'monster',
    'INFESTED_PRISM',
    'infested-prism-v106-rework',
    'v0.106.0:line-032-monster-infested-prism',
    'v0.106.0',
    '["리워크","적"]'::jsonb,
    '[]'::jsonb
  ),
  (
    'sts2-wither-int-max-upgrades',
    null,
    '슬서운이야기',
    '침체는 플레이어가 2147483647 번 강화시킬 수 있었다',
    'sts2',
    'production',
    '2026-06-05T00:00:00Z',
    'card',
    'WITHER',
    'wither-v1061-upgrade-fix',
    'v0.106.1:line-002-card-wither',
    'v0.106.1',
    '["버그수정","상태이상"]'::jsonb,
    '[{"entityType":"monster","entityId":"AEONGLASS","label":"생성"}]'::jsonb
  ),
  (
    'sts2-accelerant-catalyst-wordplay',
    null,
    '슬서운이야기',
    '촉진제에서 진제를 매로 바꾸면 촉매다',
    'sts2',
    'production',
    '2026-06-05T00:00:00Z',
    'card',
    'ACCELERANT',
    null,
    null,
    null,
    '["STS1","사일런트","카드"]'::jsonb,
    '[{"game":"sts1","entityType":"card","entityId":"catalyst"}]'::jsonb
  ),
  (
    'sts2-touch-of-insanity-madness-card',
    null,
    '슬서운이야기',
    '광기의 포션은 원래 무색 카드였다',
    'sts2',
    'production',
    '2026-06-05T00:00:00Z',
    'potion',
    'TOUCH_OF_INSANITY',
    null,
    null,
    null,
    '["STS1","무색","포션"]'::jsonb,
    '[{"game":"sts1","entityType":"card","entityId":"madness"}]'::jsonb
  )
on conflict on constraint community_stories_env_static_story_key do update
set
  nickname = excluded.nickname,
  sentence = excluded.sentence,
  game = excluded.game,
  created_at = excluded.created_at,
  entity_type = excluded.entity_type,
  entity_id = excluded.entity_id,
  change_id = excluded.change_id,
  patch_line_id = excluded.patch_line_id,
  source = excluded.source,
  tags = excluded.tags,
  linked_entities = excluded.linked_entities;
