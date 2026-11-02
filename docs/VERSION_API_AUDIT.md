# 버전 API 전수 조사 (구 빌드 정답 대조)

2026-10-19. 과거 모든 macOS 빌드(0.98.0 ~ 0.111.0, 26개 + 0.96.1/테스트 빌드 2개)를 `~/sts2-builds`에 받고([STS2_DEPOT_MANIFESTS.md](STS2_DEPOT_MANIFESTS.md)), 각 빌드의 dll/PCK에서 뽑은 값(`scripts/sts2_canonical_extract.py`)을 `getVersionedEntities` 결과와 항목 단위로 대조했다 (`scripts/audit-version-api-canonical.ts`). 회귀 테스트는 `pnpm test:version-canonical`이며, 지금 드리프트는 `scripts/versioned-canonical-baseline.json`(1,270건)에 고정돼 있어 **새 드리프트만** 실패한다 (아카이브가 없으면 건너뜀).

대조 항목: 카드(비용·종류·희귀도·변수·강화량·키워드), 유물/포션(희귀도·변수), 파워(변수), 몬스터(HP·피해/방어 수치·행동 ID·행동 그래프), 그리고 카드/유물/포션/파워/몬스터의 이름과 설명 템플릿(게임 자체 로컬라이제이션, eng/kor).

## 한눈에 보기

- 몬스터 수치는 대체로 정확하다: 비텍스트 불일치가 있는 몬스터는 22종뿐이고 대부분 행동 ID 개명/그래프 미기록이다.
- **카드·유물 수치**: 현재(0.111.0)는 빌드와 일치한다 (A, 수정함). 0.100.0 이전 빌드의 옛 값도 되돌림 diff로 복원된다.
- **설명/이름 텍스트**는 이제 0.98.0부터 모든 아카이브 빌드에서 게임 원문과 같다 (D, 수정함). 남은 텍스트 불일치는 패치 항목이 없는 핫픽스 빌드 0.103.3의 `SUMMON_FORTH` 2건뿐이다.
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

## D. 텍스트 — 수정함 (2026-10-19)

`LOCALE_TEXT_PINNED_FROM`이 0.104.0이던 때는 그 이전 버전이 게임 원문이 아니라 저작된 diff로 복원돼서, 0.98.0 기준 카드 99장·유물 36개·포션 일부의 설명/이름이 빌드 원문과 달랐다 (예: ARSENAL 설명, BLADE_OF_INK이 0.100.0에서 후속 리워크 문구를 보임, `등반가의 골칫거리`가 `등반자…`로 보임).

이제 `scripts/generate-localization-history.ts`가 git 이력 대신 빌드 아카이브(`~/sts2-builds/<버전>/canonical/loc/<로케일>/<표>.json`)를 읽는다. `scripts/sts2_canonical_extract.py`가 eng/kor는 모든 표를, 나머지 로케일은 카드·유물·포션·인챈트 표를 PCK에서 뽑아 둔다 (`--kinds loc`로 다시 뽑는다). `data/sts2/localization-history.json`은 0.98.0부터 패치 목록의 모든 버전(24개)을 고정한다. 결과:

- `pnpm audit:version-locales`는 이제 아카이브를 정답으로 쓰고 14개 로케일 × 24개 패치 모두 0건이다.
- 카드·유물·포션·인챈트의 이름·설명 템플릿에 더해 몬스터 이름(kor/eng)도 빌드 표를 따른다 (`EYE_WITH_TEETH`가 0.105.0에 `With` → `with`로 바뀐 것).
- 로케일과 상관없이 엔티티가 싣고 있는 영어 `nameEn`/`descriptionRawEn`도 영어 이력을 따라 되돌아가고, 템플릿이 바뀌었으면 `descriptionEn`을 다시 굽는다. 이전에는 저작된 `descriptionRawEn` 되돌림 diff를 손으로 넣어야 했다 (A의 영어 문구 수정). 고정 구간에서는 그 diff 대신 이력이 쓰인다.
- 표에서 키가 사라진 카드(`FOLLOW_THROUGH`, `GRAPPLE`, `SCARE`, 한국어 설명 키가 빠진 `ROCKET_PUNCH`)는 키가 있던 빌드의 문구를 쓰고, 처음 없어진 빌드부터는 사이트 문구를 둔다.
- 0.100.0 빌드는 `PREPARED`를 `PREPARE`라는 ID로 가졌다 (0.101.0에서 되돌림). 생성기의 `BUILD_ID_ALIASES`가 이를 잇는다. 이 카드의 0.100.0 `vars`에는 `Cards: 2`가 빠져 있어 채웠다 (템플릿이 `{Cards}`를 쓴다).
- 생성기가 저작된 한국어 설명에서 옛 수치를 되살리는 `varDiffs`는 저작 문구가 새 문구에 옛 수치를 섞은 경우(`PRECARIOUS_SHEARS` 13 → 16)를 한 건 더 찾는다.

크기: `localization-history.json`은 357 KB(gzip 56 KB)에서 1.36 MB(gzip 189 KB)로 늘었다. 이 파일은 Worker 번들에 들어가지 않고(런타임에 `fs`로 읽는 데이터) 업로드 크기는 그대로다. 대신 라이브러리 페이지가 `versionDiffs`를 통째로 싣기 때문에 로케일마다 페이지 하나에 실리는 diff가 약 50~200 KB 늘었다.

남은 한계: 0.103.3과 0.110.1은 `data/sts2-patches.json`에 패치 항목이 없는 핫픽스 빌드라서(되돌림은 패치 항목을 기준으로 한다) 그 빌드에서만 바뀐 문구는 다음 패치로 합쳐진다. 지금은 0.103.3의 `SUMMON_FORTH`(Forge와 군주의 칼날 문장 순서, 0.104.0에 합쳐짐)가 이에 해당한다. 해당 핫픽스를 패치 목록에 넣으면 사라진다.

## E. 추출기의 한계 (불일치로 세어지지만 API 오류가 아닌 것)

- ILSpy가 배열 초기화 값을 버려서 `CanonicalKeywords`가 3개 이상이면 키워드를 알 수 없다 (`null`로 두고 대조 생략).
- 카드 변수의 파워 별칭(`Vulnerable` ↔ `VulnerablePower`) 규칙은 카드에만 적용된다. 파워 ID는 `_POWER` 접미사를 뗀다.
- `MAD_SCIENCE*` 변형 카드, 테스트 몬스터(`ONE_HP_MONSTER` 등)는 제외한다.
- 구 빌드의 async 메서드는 상태 기계로 디컴파일돼 `parse-monsters.py`가 파워 적용(힘 획득 등)을 읽지 못한다 (몬스터 대조는 HP/피해/방어/행동/그래프로 한정).
- 이번 조사 중 `parse-monsters.py`가 ILSpy의 `[CompilerGenerated] () => decimal.op_Implicit(X)` 람다를 읽지 못해 `THE_FORGOTTEN`의 Dread 피해가 0.100 이후 갱신되지 않던 문제를 고쳤다.

## F. 타일 문구 전수 대조 — 수정함 (2026-11-02)

감사가 이제 카드·유물·포션의 구워진 문구를 모든 로케일(14개)에서, 카드의 강화 문구와 강화 효과 전체를 양방향으로 빌드와 맞춘다. 공백은 비교하지 않는다.

- **계산 수치.** 게임의 `CalculatedVar`는 전투 밖에서 배수가 0이라 `CalculationBase`만 보인다 (0.98.0부터 같은 코드). 데이터에 기본값+추가값으로 들어 있던 완벽한 타격 8→6 같은 카드와, 값이 없어 X로 나오던 쥐어뜯기·재성형를 `withLibraryCalculatedVars`로 고쳤다. 이 값은 저장값이 아니라 파생값이므로 `vars.Calculated*` 되돌림 diff를 지웠다. 초승달 창 0.104.0은 이제 6이다.
- **`{IsTargeting:...}`.** 도감에는 대상이 없으므로 때가 되었다의 `(피해를 X 줍니다)` 줄을 숨긴다.
- **추출기 구멍.** `DynamicVars["X"].UpgradeValueBy`와 접두어 없는 `AddKeyword`/`RemoveKeyword`를 못 읽어 강화의 약 절반을 비교하지 못했다. `CalculationBaseVar`·`CalculationExtraVar`도 추가했다. 빌드별 `canonical/cards.json`은 `--kinds cards`로 다시 뽑아야 한다.
- **현재 데이터.** 게임에 없는 강화 효과를 지웠다: 핫픽스의 밀집 +1, 화력 증폭의 비용 0, 계산/골골이 카드의 `damage` 키. 스피드스터 `innate`는 `add_innate`로 바꿨다.
- **과거 데이터.** 강화·희귀도·키워드·변수 되돌림을 채웠다 (예측, 무기고, 잉크 칼날, 연명, 불가피한 충돌, 날뛰기, 악의, 화력 증폭, 범접 불가, 공허의 형상, 생산, 시듦 0.105.0, 착암기, 아름다운 팔찌, 기품 있는 망토).
- **개행.** 게임은 0.100.0에서 한국어 문구에 손으로 개행을 넣었다. 문구가 같으면 옛 버전도 가장 최신 개행을 쓴다 (`keepNewestLineBreaks`, 의도적으로 빌드와 다름). 타일은 쓰인 개행이 없는 한국어를 음절이 아니라 단어 사이에서 줄바꿈한다.

남은 카드·유물 불일치는 전부 오류가 아니다: `MAD_SCIENCE`/`PREPARE` id 차이, 데이터에서 삭제된 `SEAL_OF_GOLD`, 패치 항목이 없는 0.103.3의 `SUMMON_FORTH`.

## 생성 표

<!-- AUDIT:BEGIN -->
Generated by `pnpm tsx scripts/audit-version-api-canonical.ts --md docs/VERSION_API_AUDIT.md` over 26 archived builds (0.98.0 .. 0.111.0).

### Mismatches per version

| version | card | relic | potion | power | monster | total |
|---|---:|---:|---:|---:|---:|---:|
| 0.98.0 | 4 | 1 | 0 | 11 | 53 | 69 |
| 0.98.1 | 4 | 1 | 0 | 11 | 53 | 69 |
| 0.98.2 | 4 | 1 | 0 | 11 | 53 | 69 |
| 0.98.3 | 4 | 1 | 0 | 11 | 53 | 69 |
| 0.99.0 | 4 | 1 | 0 | 11 | 53 | 69 |
| 0.99.1 | 4 | 1 | 0 | 11 | 53 | 69 |
| 0.100.0 | 6 | 1 | 0 | 12 | 47 | 66 |
| 0.101.0 | 4 | 1 | 0 | 14 | 44 | 63 |
| 0.102.0 | 4 | 1 | 0 | 15 | 44 | 64 |
| 0.103.0 | 4 | 1 | 0 | 16 | 44 | 65 |
| 0.103.1 | 4 | 1 | 0 | 16 | 44 | 65 |
| 0.103.2 | 4 | 1 | 0 | 16 | 44 | 65 |
| 0.103.3 | 20 | 1 | 0 | 16 | 44 | 81 |
| 0.104.0 | 4 | 1 | 0 | 14 | 10 | 29 |
| 0.105.0 | 4 | 0 | 0 | 10 | 7 | 21 |
| 0.105.1 | 4 | 0 | 0 | 10 | 7 | 21 |
| 0.106.0 | 4 | 0 | 0 | 7 | 2 | 13 |
| 0.106.1 | 4 | 0 | 0 | 7 | 2 | 13 |
| 0.107.0 | 4 | 0 | 0 | 7 | 2 | 13 |
| 0.107.1 | 4 | 0 | 0 | 7 | 2 | 13 |
| 0.108.0 | 4 | 0 | 0 | 14 | 2 | 20 |
| 0.109.0 | 4 | 0 | 0 | 12 | 2 | 18 |
| 0.109.1 | 4 | 0 | 0 | 12 | 2 | 18 |
| 0.110.0 | 4 | 0 | 0 | 12 | 2 | 18 |
| 0.110.1 | 4 | 0 | 0 | 12 | 2 | 18 |
| 0.111.0 | 4 | 0 | 0 | 12 | 2 | 18 |

### Mismatches per field family (all versions)

| family | count | versions | example |
|---|---:|---:|---|
| monster:moveGraph | 353 | 16 | AXEBOT@0.98.0 api=["BOOT_UP>HAMMER_UPPERCUT","HAMMER_UPPERCUT>ONE_TW canonical=["BOOT_UP>HAMMER_UPPERCUT","BOOT_UP>ONE_TWO","BOOT |
| power:(exists) | 281 | 26 | DIAMOND_DIADEM@0.98.0 api=null canonical="present" |
| monster:moveIds | 212 | 16 | BOWLBUG_SILK@0.98.0 api=["THRASH","TOXIC_SPIT"] canonical=["TOXIC_SPIT","TRASH"] |
| card:(exists) | 106 | 26 | MAD_SCIENCE@0.98.0 api=null canonical="present" |
| monster:(exists) | 52 | 26 | SINGLE_ATTACK_MOVE_MONSTER@0.98.0 api=null canonical="present" |
| monster:damageValues | 30 | 16 | HAUNTED_SHIP@0.98.0 api=undefined canonical={"normal":10,"ascension":11} |
| power:vars | 26 | 16 | BLADE_OF_INK@0.98.0 api=undefined canonical=0 |
| relic:(exists) | 14 | 14 | SEAL_OF_GOLD@0.98.0 api=null canonical="present" |
| monster:minHp | 13 | 7 | DOOR@0.98.0 api=null canonical=155 |
| monster:minHpAscension | 13 | 7 | DOOR@0.98.0 api=null canonical=165 |
| card:text.descriptionRawEn | 1 | 1 | SUMMON_FORTH@0.103.3 api="[gold]Forge[/gold]{Forge:diff()}.Put[gold]Soverei canonical="Put[gold]SovereignBlade[/gold]intoyour[gold]Hand[ |
| card:text.descriptionRaw | 1 | 1 | SUMMON_FORTH@0.103.3 api="[gold]단조[/gold]{Forge:diff()}.어디에있든[gold]군주의칼날[/g canonical="[gold]군주의칼날[/gold]이어디에있든[gold]손[/gold]으로가져옵니다.[go |
| card:text.description | 1 | 1 | SUMMON_FORTH@0.103.3 api="[gold]단조[/gold]8.어디에있든[gold]군주의칼날[/gold]을[gold]손[ canonical="[gold]군주의칼날[/gold]이어디에있든[gold]손[/gold]으로가져옵니다.[go |
| card:text.description.eng | 1 | 1 | SUMMON_FORTH@0.103.3 api="[gold]Forge[/gold]8.Put[gold]SovereignBlade[/gold canonical="Put[gold]SovereignBlade[/gold]intoyour[gold]Hand[ |
| card:text.description.zhs | 1 | 1 | SUMMON_FORTH@0.103.3 api="[gold]铸造[/gold]8。不论何处，将[gold]君王之剑[/gold]放入你的[gold canonical="不论何处，将[gold]君王之剑[/gold]放入你的[gold]手牌[/gold]。[gold] |
| card:text.description.jpn | 1 | 1 | SUMMON_FORTH@0.103.3 api="[gold]鍛造[/gold]8。あらゆる場所から[gold]ソヴリン・ブレード[/gold]を[ canonical="あらゆる場所から[gold]ソヴリン・ブレード[/gold]を[gold]手札[/gold]に加え |
| card:text.description.deu | 1 | 1 | SUMMON_FORTH@0.103.3 api="[gold]Schmiede[/gold]8.Nimm[gold]Hoheitsklinge[/g canonical="Nimm[gold]Hoheitsklinge[/gold]vonirgendwoheraufde |
| card:text.description.fra | 1 | 1 | SUMMON_FORTH@0.103.3 api="[gold]Forgez[/gold]pour8.Placez[gold]Lamesouverai canonical="Placez[gold]Lamesouveraine[/gold]dansvotre[gold]M |
| card:text.description.ita | 1 | 1 | SUMMON_FORTH@0.103.3 api="Applichi8di[gold]Forgiatura[/gold]Mettilacarta[go canonical="Mettilacarta[gold]SpadaSovrana[/gold]nellatua[gol |
| card:text.description.spa | 1 | 1 | SUMMON_FORTH@0.103.3 api="[gold]Forja[/gold]8.Coloca[gold]Espadadelsoberano canonical="Coloca[gold]Espadadelsoberano[/gold]entu[gold]Man |
| card:text.description.esp | 1 | 1 | SUMMON_FORTH@0.103.3 api="Aplicas[gold]forja[/gold]8.Colocas[gold]Espadadel canonical="Colocas[gold]Espadadelsoberano[/gold]entu[gold]ma |
| card:text.description.ptb | 1 | 1 | SUMMON_FORTH@0.103.3 api="[gold]Forje[/gold]8.Coloque[gold]EspadaSoberana[/ canonical="Coloque[gold]EspadaSoberana[/gold]nasua[gold]Mão[ |
| card:text.description.rus | 1 | 1 | SUMMON_FORTH@0.103.3 api="[gold]Закаляет[/gold]8.Выберете[gold]Клинокмонарх canonical="Возвращает[gold]Клинокмонарха[/gold]в[gold]руку[/ |
| card:text.description.pol | 1 | 1 | SUMMON_FORTH@0.103.3 api="[gold]Wykuj[/gold]8.Przenieś[gold]NiebiańskieOstr canonical="Przenieś[gold]NiebiańskieOstrze[/gold]zdowolnegom |
| card:text.description.tha | 1 | 1 | SUMMON_FORTH@0.103.3 api="[gold]หลอมสร้าง[/gold]8นำ[gold]พระแสงอาญาสิทธิ์[/ canonical="นำ[gold]พระแสงอาญาสิทธิ์[/gold]จากที่ไหนก็ได้ขึ้น |
| card:text.description.tur | 1 | 1 | SUMMON_FORTH@0.103.3 api="8[gold]Döv[/gold].[gold]EgemenKılıcı[/gold]'nıher canonical="[gold]EgemenKılıcı[/gold]'nıherhangibirdesteden[g |
<!-- AUDIT:END -->
