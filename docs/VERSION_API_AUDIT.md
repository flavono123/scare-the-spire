# 버전 API 전수 조사 (구 빌드 정답 대조)

2026-10-19. 과거 모든 macOS 빌드(0.98.0 ~ 0.111.0, 26개 + 0.96.1/테스트 빌드 2개)를 `~/sts2-builds`에 받고([STS2_DEPOT_MANIFESTS.md](STS2_DEPOT_MANIFESTS.md)), 각 빌드의 dll/PCK에서 뽑은 값(`scripts/sts2_canonical_extract.py`)을 `getVersionedEntities` 결과와 항목 단위로 대조했다 (`scripts/audit-version-api-canonical.ts`). 회귀 테스트는 `pnpm test:version-canonical`이며, 지금 드리프트는 `scripts/versioned-canonical-baseline.json`(2,945건)에 고정돼 있어 **새 드리프트만** 실패한다 (아카이브가 없으면 건너뜀).

대조 항목: 카드(비용·종류·희귀도·변수·강화량·키워드), 유물/포션(희귀도·변수), 파워(변수), 몬스터(HP·피해/방어 수치·행동 ID·행동 그래프), 그리고 카드/유물/포션/파워/몬스터의 이름과 설명 템플릿(게임 자체 로컬라이제이션, eng/kor).

## 한눈에 보기

- 몬스터 수치는 대체로 정확하다: 비텍스트 불일치가 있는 몬스터는 22종뿐이고 대부분 행동 ID 개명/그래프 미기록이다.
- **카드·유물 수치**: 현재(0.111.0)는 빌드와 일치한다 (A, 수정함). 0.100.0 이전 빌드의 옛 값도 되돌림 diff로 복원된다.
- **설명/이름 텍스트**는 0.98.0에서 카드 99장·유물 36개가 빌드 원문과 다르고 최신 버전으로 갈수록 줄어 0.111.0에서는 카드·유물 모두 0건이다. 기존 `LOCALE_TEXT_PINNED_FROM = 0.104.0` 이전은 저작된 diff에 의존해서 생기는 차이다. 아카이브로 0.98.0부터 고정할 수 있다 (D).
- **존재 여부**(출시 전 카드가 보임, 삭제된 카드가 계속 보임)는 카드에 대해 고쳤다 (B, 수정함). 파워·유물 쪽은 남아 있다.

## A. 현재(0.111.0) 데이터가 게임과 달랐던 곳 — 수정함 (2026-10-19)

값은 빌드의 `CanonicalVars`/`OnUpgrade`(`~/sts2-builds/<버전>/src`, `canonical/*.json`)에서 확인했다. 아래 카드는 `data/sts2/{kor,eng}/cards.json`이 0.100.0 이전 값을 그대로 갖고 있었다 (카드 JSON 값 → 게임 값):

| 카드 | 항목 | 수정 전 | 게임 |
|---|---|---|---|
| 박살 (BREAK) | 강화 피해 | +5 | +10 |
| 잿불 (CINDER) | 강화 피해 | +5 | +6 |
| 대단원의 막 (GRAND_FINALE) | 강화 피해 | +10 | +15 |
| 왕의 발차기 (KINGLY_KICK) | 강화 피해 | +6 | +8 |
| 정밀 사격 (PINPOINT) | 강화 피해 | +5 | +4 |
| 왕의 주먹 (KINGLY_PUNCH) | 강화 피해 | 없음 | +2 (강화 증가량 +2는 그대로) |
| 덤벼라! (FIGHT_ME) | 힘 | 2 | 3 |
| 죽음의 무도 (DANSE_MACABRE) | 파워 수치 / 강화 | 3 / +1 | 4 / +2 |
| 영원의 갑옷 (ETERNAL_ARMOR) | 판금 / 강화 | 7 / +2 | 9 / +3 |
| 전장의 생존자 (WROUGHT_IN_WAR) | 제련 | 5 | 7 |

개별 확인한 카드:

- 싸움 준비 (`EXPECT_A_FIGHT`): 값은 맞고, 강화가 올리는 변수가 `CalculationBase`다. 데이터의 `upgrade.block`을 계산 카드 관례대로 `calculationbase`로 바꿨다 (렌더는 `CARD_UPGRADE_FALLBACKS`가 `calculatedblock`으로 이어 준다).
- 광채 (`GLOW`): 0.100.0부터 `Cards`가 1이다. 데이터는 2였다. 0.109.0에 2로 올랐다는 되돌림 diff는 패치노트에도 빌드에도 없어 지웠다.
- 스피드스터 (`SPEEDSTER`), 검성 (`SWORD_SAGE`), 벼락 (`THUNDER`): 빌드가 정의하는 별칭 변수(`Speedster` 2, `SwordSage` 1, `Thunder` 8)가 낡았거나 없었다.
- 영어 파일은 위 카드의 `vars`·비용·설명이 한국어 파일보다 더 낡아 있었다 (예: BREAK 비용 2, 잿불·대단원의 막·왕의 발차기·정밀 사격의 `vars.Damage`, 왕의 주먹 `Increase` 3). 최상위 `damage`와 `powers_applied` 수치, 굽은 `description`도 함께 맞췄다.
- 죽음의 무도 한국어 `vars`에 있던 `Block`은 게임에 없는 변수라 지웠고, 0.100.0 되돌림 diff는 `DanseMacabrePower`/`DanseMacabre`/강화로 바로잡았다.
- 유물 영어 설명 10개 (`ALCHEMICAL_COFFER`, `BELT_BUCKLE`, `CAULDRON`, `DELICATE_FROND`, `DIAMOND_DIADEM`, `PHIAL_HOLSTER`, `SILKEN_TRESS`, `SOZU`, `TINY_MAILBOX`, `WHITE_BEAST_STATUE`)와 카드 `BLADE_SYMPHONY`, `HELIX_DRILL`의 영어 설명을 빌드의 문구로 바꿨다. `[gold]Potions[/gold]` 키워드 태그가 없던 8개 외에 `DIAMOND_DIADEM`은 0.110.0의 "2nd turn", `SILKEN_TRESS`는 0.108.0의 "your first", `BLADE_SYMPHONY`는 0.110.0의 "players'", `HELIX_DRILL`은 0.108.0의 "spent on other cards"가 빠져 있었다.

kor 로케일 API는 영어 설명(`descriptionRawEn`)을 고정 필드로 내보내므로, 바꾼 문구마다 그 문구가 들어온 패치에 `descriptionEn`/`descriptionRawEn` 되돌림 diff를 넣었다 (검증기가 카드·유물에도 두 필드를 허용한다). 이 되돌림 없이는 이전 빌드에서 새 드리프트가 생긴다.

### 아직 고치지 않은 것

위 목록 밖에서, 영어 파일(`data/sts2/eng/cards.json`)의 `vars`/비용이 한국어 파일·빌드보다 낡은 카드가 14장 더 있다: `BANSHEES_CRY`(비용 6/9, 강화 비용), `BUNDLE_OF_JOY`(비용), `GATHER_LIGHT`, `HEIRLOOM_HAMMER`, `HEMOKINESIS`, `I_AM_INVINCIBLE`, `MINION_DIVE_BOMB`(비용), `MINION_STRIKE`, `SCULPTING_STRIKE`, `SEANCE`(비용, 강화 비용), `SEEKER_STRIKE`, `SKEWER`, `SOLAR_STRIKE`, `TREMBLE`. 이 중 `GATHER_LIGHT`·`HEIRLOOM_HAMMER`·`HEMOKINESIS`·`I_AM_INVINCIBLE`·`MINION_STRIKE`·`SCULPTING_STRIKE`·`SEEKER_STRIKE`·`SKEWER`·`SOLAR_STRIKE`는 한국어 파일의 최상위 `damage`/`block`도 `vars`와 다르다. 영어 UI의 `descriptionEn`이 이 `vars`로 구워지므로 영어 설명에 옛 수치가 나온다. 감사는 kor 로케일만 비교하므로 baseline에는 없다.

## B. 버전별 존재 여부(수명 주기) — 수정함 (2026-10-19)

API가 가용하다고 하지만 그 빌드에는 없던 카드는 처음 나온 빌드를 `introducedInPatch`로 기록해 고쳤다 (빌드마다 canonical 카드 표에서 첫 빌드와 연속 존재를 확인):

| 카드 | 처음 나온 빌드 |
|---|---|
| ABUNDANCE, DOWSING | 0.109.0 |
| BLADE_SYMPHONY, BLAZE, CACOPHONY, CONCOCT, CONSTELLATION, FADE, HIBERNATE, IMITATION_LEARNING, MIDNIGHT, ONE_FOR_ALL, OUTRAGE, PLOT, SOULBOUND, THE_BALL, UNDERWORLD | 0.108.0 |
| WITHER | 0.105.0 |

반대로 빌드에서 사라진 `GRAPPLE`(0.103.0부터 없음), `FOLLOW_THROUGH`(0.106.0부터 없음), `SCARE`(0.110.0부터 없음)는 데이터에 이미 `deprecated`와 `deprecatedInPatch`(0.103.0, 0.106.0, 0.110.0)가 맞게 있었다. 감사가 deprecated를 "빌드에 있음"으로 세던 것이 문제여서, 이제 deprecated인 버전의 엔티티는 API에 없는 것으로 대조한다 (파워 쪽 `BLADE_OF_INK`, `DRUM_OF_BATTLE`, `EBB`, `GRAPPLE`, `OUTBREAK`도 같이 해소됐다).

남은 것: 유물 `SEAL_OF_GOLD`는 0.104.0까지 있었지만 데이터에서 삭제돼 과거 버전에서 **렌더할 곳이 없다**. 문을 만드는 자의 단계 파워(`HUNGER`/`SCRUTINY`/`GRASP`, 0.101.0~0.104.0)와 `DOOR_REVIVAL`(~0.99.1), 그리고 0.108.0+에 새로 생긴 카드 파워(`CACOPHONY`, `CONCOCT`, `HIBERNATE`, `IMITATION_LEARNING`, `ONE_FOR_ALL`, `SOULBOUND`, `UNDERWORLD`)와 `BORROWED_TIME`, `NO_ENERGY_GAIN`, `TEMPORARY_*` 파워는 파워 데이터가 없다.

## C. 몬스터

- 행동 ID가 개명된 몬스터는 과거 버전에서 **현재 ID**를 돌려준다 (`BOWLBUG_SILK`: 당시 `TRASH`, 지금 `THRASH` 등). 영향: 행동 이름/아이콘 매핑이 과거 ID로는 안 된다. `CUBEX_CONSTRUCT`, `BYGONE_EFFIGY`, `TUNNELER`, `QUEEN`, `TERROR_EEL` 등 16종.
- 변경 기록이 없는 구조 변화: `AXEBOT`(0.104 리워크의 행동 그래프), `PUNCH_CONSTRUCT`, `TEST_SUBJECT`(그래프), `HAUNTED_SHIP`, `SOUL_FYSH`(피해 수치), `WATERFALL_GIANT`(HP 250→240 시점), `DOOR`(HP).
- 이번 작업으로 잠행 군체·문을 만드는 자·땅굴 2인조·지하 선착장·깨작이·로켓·분쇄자·잊힌 자/사라진 자·조립 전문가 봇·실험체는 정답과 맞췄다.

## D. 텍스트

`LOCALE_TEXT_PINNED_FROM`(0.104.0) 이전은 게임 원문이 아니라 저작된 diff로 복원돼서, 0.98.0 기준 카드 99장·유물 36개·포션 일부의 설명/이름이 빌드 원문과 다르다 (예: ARSENAL 설명, BLADE_OF_INK이 0.100.0에서 후속 리워크 문구를 보임, `등반가의 골칫거리`가 `등반자…`로 보임). 아카이브의 PCK가 있으므로 `data/sts2/localization-history.json`을 0.98.0부터 다시 만들 수 있다 (`scripts/generate-localization-history.ts`는 git 이력 스냅샷을 쓰므로 아카이브를 입력으로 바꾸는 작업이 필요).

## E. 추출기의 한계 (불일치로 세어지지만 API 오류가 아닌 것)

- ILSpy가 배열 초기화 값을 버려서 `CanonicalKeywords`가 3개 이상이면 키워드를 알 수 없다 (`null`로 두고 대조 생략).
- 카드 변수의 파워 별칭(`Vulnerable` ↔ `VulnerablePower`) 규칙은 카드에만 적용된다. 파워 ID는 `_POWER` 접미사를 뗀다.
- `MAD_SCIENCE*` 변형 카드, 테스트 몬스터(`ONE_HP_MONSTER` 등)는 제외한다.
- 구 빌드의 async 메서드는 상태 기계로 디컴파일돼 `parse-monsters.py`가 파워 적용(힘 획득 등)을 읽지 못한다 (몬스터 대조는 HP/피해/방어/행동/그래프로 한정).
- 이번 조사 중 `parse-monsters.py`가 ILSpy의 `[CompilerGenerated] () => decimal.op_Implicit(X)` 람다를 읽지 못해 `THE_FORGOTTEN`의 Dread 피해가 0.100 이후 갱신되지 않던 문제를 고쳤다.

## 생성 표

<!-- AUDIT:BEGIN -->
Generated by `pnpm tsx scripts/audit-version-api-canonical.ts --md docs/VERSION_API_AUDIT.md` over 26 archived builds (0.98.0 .. 0.111.0).

### Mismatches per version

| version | card | relic | potion | power | monster | total |
|---|---:|---:|---:|---:|---:|---:|
| 0.98.0 | 140 | 49 | 6 | 11 | 54 | 260 |
| 0.98.1 | 140 | 49 | 6 | 11 | 54 | 260 |
| 0.98.2 | 136 | 45 | 6 | 11 | 54 | 252 |
| 0.98.3 | 136 | 45 | 6 | 11 | 54 | 252 |
| 0.99.0 | 130 | 40 | 6 | 11 | 54 | 241 |
| 0.99.1 | 130 | 40 | 6 | 11 | 54 | 241 |
| 0.100.0 | 85 | 29 | 4 | 12 | 48 | 178 |
| 0.101.0 | 61 | 23 | 3 | 14 | 45 | 146 |
| 0.102.0 | 53 | 23 | 0 | 15 | 45 | 136 |
| 0.103.0 | 42 | 20 | 0 | 16 | 45 | 123 |
| 0.103.1 | 42 | 20 | 0 | 16 | 45 | 123 |
| 0.103.2 | 42 | 20 | 0 | 16 | 45 | 123 |
| 0.103.3 | 40 | 20 | 0 | 16 | 45 | 121 |
| 0.104.0 | 25 | 15 | 0 | 14 | 11 | 65 |
| 0.105.0 | 24 | 13 | 0 | 10 | 7 | 54 |
| 0.105.1 | 24 | 13 | 0 | 10 | 7 | 54 |
| 0.106.0 | 18 | 9 | 0 | 7 | 2 | 36 |
| 0.106.1 | 18 | 9 | 0 | 7 | 2 | 36 |
| 0.107.0 | 18 | 9 | 0 | 7 | 2 | 36 |
| 0.107.1 | 18 | 9 | 0 | 7 | 2 | 36 |
| 0.108.0 | 15 | 9 | 0 | 14 | 2 | 40 |
| 0.109.0 | 15 | 4 | 0 | 12 | 2 | 33 |
| 0.109.1 | 15 | 4 | 0 | 12 | 2 | 33 |
| 0.110.0 | 8 | 2 | 0 | 12 | 2 | 24 |
| 0.110.1 | 8 | 2 | 0 | 12 | 2 | 24 |
| 0.111.0 | 4 | 0 | 0 | 12 | 2 | 18 |

### Mismatches per field family (all versions)

| family | count | versions | example |
|---|---:|---:|---|
| card:text.descriptionRawEn | 706 | 25 | ARSENAL@0.98.0 api="Whenever you create a card, gain {ArsenalPower:di canonical="Whenever you play a Colorless card, gain {Arsenal |
| card:text.descriptionRaw | 400 | 13 | ADAPTIVE_STRIKE@0.98.0 api="피해를 {Damage:diff()} 줍니다. [gold]버린 카드 더미[/gold]에 이 canonical="피해를 {Damage:diff()} 줍니다. [gold]버린 카드 더미[/gold]에 비 |
| monster:moveGraph | 353 | 16 | AXEBOT@0.98.0 api=["BOOT_UP>HAMMER_UPPERCUT","HAMMER_UPPERCUT>ONE_TW canonical=["BOOT_UP>HAMMER_UPPERCUT","BOOT_UP>ONE_TWO","BOOT |
| relic:text.descriptionRawEn | 339 | 25 | ARCHAIC_TOOTH@0.98.0 api="Upon pickup, [gold]Transform[/gold] {StarterCard. canonical="Upon pickup, [gold]Transform[/gold] {StarterCard. |
| power:(exists) | 281 | 26 | DIAMOND_DIADEM@0.98.0 api=null canonical="present" |
| monster:moveIds | 212 | 16 | BOWLBUG_SILK@0.98.0 api=["THRASH","TOXIC_SPIT"] canonical=["TOXIC_SPIT","TRASH"] |
| card:(exists) | 106 | 26 | MAD_SCIENCE@0.98.0 api=null canonical="present" |
| relic:text.descriptionRaw | 81 | 15 | BRILLIANT_SCARF@0.98.0 api="매 턴마다 손에서 [blue]다섯 번째[/blue]로 내는 카드를 비용 없이 사용합니다. canonical="매 턴마다 [blue]다섯 번째[/blue]로 내는 카드를 비용 없이 사용합니다." |
| card:upgrade | 58 | 14 | ANTICIPATE@0.98.0 api=1 canonical=2 |
| card:text.name | 57 | 13 | ASCENDERS_BANE@0.98.0 api="등반자의 골칫거리" canonical="등반가의 골칫거리" |
| monster:(exists) | 52 | 26 | SINGLE_ATTACK_MOVE_MONSTER@0.98.0 api=null canonical="present" |
| relic:vars | 50 | 23 | BEAUTIFUL_BRACELET@0.98.0 api=2 canonical=3 |
| card:vars | 38 | 15 | ANTICIPATE@0.98.0 api=2 canonical=3 |
| relic:text.name | 37 | 13 | BOOK_OF_FIVE_RINGS@0.98.0 api="오륜서" canonical="다섯 반지의 책" |
| monster:damageValues | 30 | 16 | HAUNTED_SHIP@0.98.0 api=undefined canonical={"normal":10,"ascension":11} |
| power:vars | 26 | 16 | BLADE_OF_INK@0.98.0 api=undefined canonical=0 |
| potion:text.descriptionRawEn | 21 | 8 | FAIRY_IN_A_BOTTLE@0.98.0 api="When your HP would be reduced to [blue]0[/blue],  canonical="When you would die, instead this potion is discar |
| potion:text.descriptionRaw | 14 | 8 | FAIRY_IN_A_BOTTLE@0.98.0 api="체력이 [blue]0[/blue]이 될 때, 그 대신 이 포션이 버려지고 최대 체력의 [ canonical="사망 시, 그 대신 이 포션이 버려지고 최대 체력의 [blue]30%[/blue]만큼 체 |
| monster:text.nameEn | 14 | 14 | EYE_WITH_TEETH@0.98.0 api="Eye with Teeth" canonical="Eye With Teeth" |
| relic:(exists) | 14 | 14 | SEAL_OF_GOLD@0.98.0 api=null canonical="present" |
| monster:minHp | 13 | 7 | DOOR@0.98.0 api=null canonical=155 |
| monster:minHpAscension | 13 | 7 | DOOR@0.98.0 api=null canonical=165 |
| card:rarity | 12 | 6 | RIP_AND_TEAR@0.98.0 api="Event" canonical="Uncommon" |
| potion:text.name | 8 | 8 | SHACKLING_POTION@0.98.0 api="족쇄 포션" canonical="속박 포션" |
| card:keywords | 8 | 8 | STOKE@0.98.0 api=[] canonical=["Exhaust"] |
| card:cost | 2 | 2 | WITHER@0.105.0 api=-1 canonical=1 |
<!-- AUDIT:END -->
