# Encounter Render Drift Audit

This is a deferred-work record. It does not authorize render changes by itself.

## Audit baseline

- Audited on 2026-07-16 against local game version `v0.108.0` (`58694f64`).
- Scope: all 92 encounter records, including the 90 encounters with scene data and 96 unique encounter monster actors.
- Compared PCK creature `Bounds`, accumulated `Visuals.position/scale`, encounter camera and slot data, and the browser Spine player's idle animation viewport.
- The DLL placement reference is `NCombatRoom.PositionEnemies`; browser placement is implemented in `src/components/codex/encounter-scene-stage.tsx`.
- `FLYCONID_WEAK` and `OVERGROWTH_WILDLIFE` are localization-only empty records, so they have no scene actor to audit.

Repeated monsters in the game can receive an additional HP-dependent scale variation of roughly 10-15%. Treat differences near that range as review candidates rather than automatic fixes.

## User visual triage

When the measured differences below are sorted from largest to smallest, only the range from 산란비충 through 살아있는 안개, inclusive, currently looks visibly wrong to the user:

1. 산란비충 (`OVICOPTER`)
2. 영사자 (`THE_OBSCURA`)
3. 조립 전문가 (`FABRICATOR`)
4. 두꼬리쥐 (`TWO_TAILED_RAT`)
5. 사라진 자 (`THE_LOST`)
6. 살아있는 안개 (`LIVING_FOG`)

The player character also appears too small alongside the monsters in these encounter scenes. Audit the shared character render scale before applying monster-only corrections.

## High-confidence measured drift

Negative scale differences mean the browser actor is smaller than the game transform; positive differences mean it is larger. Position differences use the game's 1920x1080 combat coordinate space.

| Encounter | Actor | Measured drift |
| --- | --- | --- |
| 산란비충 | `OVICOPTER` | 35% smaller |
| 영사자 | `THE_OBSCURA` | 34% smaller; 44 px right and 50 px down |
| 조립 전문가 | `FABRICATOR` | 34% smaller; 31 px left and 70 px down |
| 두꼬리쥐들 | `TWO_TAILED_RAT` | 30% smaller |
| 사라진 자와 잊힌 자 | `THE_LOST` | 29% smaller; 73 px left and 53 px down |
| 살아있는 안개 | `LIVING_FOG` | 24% smaller; 24 px left and 95 px down |
| 사냥꾼 살해자 | `HUNTER_KILLER` | 22% smaller |
| 개구리 기사 | `FROG_KNIGHT` | 21% smaller; 39 px down |
| 사라진 자와 잊힌 자 | `THE_FORGOTTEN` | 20% smaller; 70 px left |
| 오물팽이 | `SLUDGE_SPINNER` | 19% smaller; 42 px right |
| 지하 선착장 야생동물 / 불량 해초 | `SEAPUNK` | 18% smaller |
| 기계 기사 | `MECHA_KNIGHT` | 16% smaller; 44 px down |
| 버섯과 슬라임 / 과성장 식물 | `FLYCONID` | 18% larger |
| 버섯과 슬라임 / 슬라임 무리 / 슬라임 집단 / 교살마와 친구 | `LEAF_SLIME_M` | 20% larger |
| 슬라임 무리 / 슬라임 집단 / 교살마와 친구 | `LEAF_SLIME_S` | 39% larger |
| 아키텍트 | `ARCHITECT` | 22% larger; 62 px right and 83 px up |
| 전투로 손상된 훈련 인형 V1 | `BATTLE_FRIEND_V1` | Scale matches; 53 px right |
| 그릇벌레 무리 / 그릇벌레들 | `BOWLBUG_EGG` | 15% larger; the attached `Tough Egg` secondary Spine actor is missing |

## Review candidates

- Smaller by 10-14%: `AXEBOT`, `DEVOTED_SCULPTOR`, `SHRINKER_BEETLE`, `GREMLIN_MERC`, `MAWLER`, `THIEVING_HOPPER`.
- Larger by 10-14%: `FAKE_MERCHANT_MONSTER`, `KIN_FOLLOWER`, `TWIG_SLIME_S`.
- Position-only candidates: `SPECTRAL_KNIGHT` (about 39 px), `LAGAVULIN_MATRIARCH` (about 42 px), `HAUNTED_SHIP` (about 41 px).

## Verified or excluded

- Existing game-bounds corrections remain visually acceptable: `VANTOM`, `SOUL_NEXUS`, `THE_INSATIABLE`, and `AEONGLASS`.
- The special combined renderers for `KAISER_CRAB_BOSS` and `DECIMILLIPEDE_ELITE` remain acceptable.
- `TEST_SUBJECT` is not a drift candidate. Its apparent extreme mismatch disappears after including the PCK parent `CanvasGroup` scale of `0.15`; the remaining scale difference is about 3%.

## Validation at audit time

- All 96 Spine assets loaded without browser runtime errors during bounds collection.
- `pnpm i18n:validate` passed.
- `pnpm exec tsx scripts/encounter-compositions.spec.ts` passed.
