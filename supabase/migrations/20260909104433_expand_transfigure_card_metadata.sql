-- Expand Transfigure card type/rarity CHECKs with curse, token, status,
-- quest, event, and ancient values. Existing rows stay valid. Old app
-- writers still only send 공격/스킬/파워 and 일반/고급/희귀.
--
-- Rollout: DB-first expand. Old app + new DB is safe. Apply before the
-- consumer that writes the new values.

alter table public.transfigure_posts
  drop constraint if exists transfigure_posts_transformed_card_type_check;

alter table public.transfigure_posts
  add constraint transfigure_posts_transformed_card_type_check
  check (
    transformed_card_type is null
    or (
      resource_type = 'card'
      and transformed_card_type in (
        '공격',
        '스킬',
        '파워',
        '저주',
        '상태이상',
        '퀘스트'
      )
    )
  );

alter table public.transfigure_posts
  drop constraint if exists transfigure_posts_transformed_card_rarity_check;

alter table public.transfigure_posts
  add constraint transfigure_posts_transformed_card_rarity_check
  check (
    transformed_card_rarity is null
    or (
      resource_type = 'card'
      and transformed_card_rarity in (
        '일반',
        '고급',
        '희귀',
        '고대의 존재',
        '이벤트',
        '토큰',
        '저주',
        '상태이상',
        '퀘스트'
      )
    )
  );
