# 엔티티 상호 참조 (Cross-References)

코덱스/패치노트에서 엔티티끼리 hover 미리보기 + 클릭 링크로 연결되는
관계를 정리한 작업 문서. 패치노트 렌더러(`src/components/patch-note-renderer.tsx`)는
이미 모든 엔티티 타입에 대해 `EntityPreview` + `EntityLookup`을 갖고 있으므로,
나머지 작업은 **detail 패널 안에서도 같은 lookup을 쓰는 것**과 **JSON에 명시되지 않은
관계를 어떻게 SSOT로 가져올지**의 두 축이다.

엔티티 타입: `card`, `relic`, `enchantment`, `potion`, `power`, `event`, `monster`,
`encounter`, `ancient` (`event`의 한 종류).

## 데이터 SSOT

| 소스 | 위치 | 들어 있는 관계 |
|------|------|----------------|
| `data/sts2/{eng,kor}/*.json` | 게임 추출본 | 카드/유물/포션/파워/인챈트/이벤트/몬스터/인카운터/스토리 |
| `CodexAncient.relicIds` | `src/lib/codex-types.ts` | Ancient → 보상 유물 (8개 보스) |
| `CodexEncounter.monsters[]` | 동일 | Encounter → 등장 몬스터 |
| description / description_raw | 모든 엔티티 | `[gold]<term>[/gold]`, `[purple]<enchant>[/purple]` 등 inline 멘션 |
| 게임 PCK + ILSpy 디컴파일 | `update-game-assets` 파이프라인 | 이벤트 보상 테이블, 카드↔파워 적용, 보스 인카운터 트리거 등 (현재 JSON에 안 풀려 있음) |

## 1. 이미 구현된 관계

- **Patch note renderer** — `[gold]<name>[/gold]` 안에서 카드/유물/포션/파워/인챈트/이벤트/몬스터/인카운터를
  자동 매칭, hover 미리보기 + `/codex/<type>` 링크.
- **Relic ↔ Enchantment** *(이번 세션)*
  - 유물 description의 인챈트 이름(`[purple]숙련[/purple]` 등)이 hover/링크.
  - 인챈트 상세에 "이 인챈트를 부여하는 유물" 섹션. description에 인챈트 이름이
    포함되는 유물 자동 수집 (현재 10개 매핑: 목패↔숙련, 영양만점 수프↔테즈카타라의 잉걸불, …).
- **Codex hover preview**
  - 카드/유물/포션/파워/인챈트/이벤트/몬스터/인카운터 각각 미니 카드 툴팁.
- **Ancient → Relics** — `/codex/relics` 도감의 "고대 유물" 섹션이 보스별로 묶음.
  (역참조 — 유물 상세에서 어떤 보스가 주는지는 아직 표시 안 함.)
- **Encounter → Monsters** — `CodexEncounter.monsters[]` 가 데이터에 있고
  patch-note hover 에서만 사용 중.

## 2. JSON에서 바로 도출 가능한 관계 (low-cost)

각 항목 옆 숫자는 JSON description에서 entity name이 매칭된 엔티티 수
(전수조사 결과, [gold] 태그 안 매칭 또는 substring 매칭).

### 이벤트 ↔ X
이벤트 상세 페이지에 다음 섹션을 자동 생성할 수 있다. text-scan 기반으로 SSOT는 description 자체.

| 관계 | 매칭 수 | 예시 |
|------|--------:|------|
| Event → Card | **28 / 66** | `BUGSLAYER` → 멸충, `CRYSTAL_SPHERE` → 빚, `HUNGRY_FOR_MUSHROOMS` → 부상 카드 |
| Event → Relic | 11 | `LOST_WISP` → 길 잃은 도깨비불, `ROOM_FULL_OF_CHEESE` → 선택받은 치즈 |
| Event → Enchantment | 9 | `SAPPHIRE_SEED` → 파종, `STONE_OF_ALL_TIME` → 활기 |
| Event → Power | 8 | `TEA_MASTER` → 힘, `ROUND_TEA_PARTY` → 독, `THE_LEGENDS_WERE_TRUE` → 둔화 |
| Event → Monster | 4 | `BYRDONIS_NEST` → 버르도니스, `PUNCH_OFF` → 펀치 골렘 |
| Event → Potion | 2 | `DROWNING_BEACON` → 발광 포션, `POTION_COURIER` → 악취 포션 |
| Event → Ancient (직접 매핑) | 8 | `events.json`의 `type=Ancient` + `relics[]` 필드. 이미 사용 중. |

> **방향 둘 다 만들 수 있음** — 카드/유물/파워 등 상세에서도 "이 엔티티가 등장하는 이벤트" 섹션이 가능.

### 유물/카드/파워 inline 멘션
| 관계 | 매칭 수 |
|------|--------:|
| Card → Power (`[gold]Vigor[/gold]` 등) | 105 / 577 |
| Card → Card (다른 카드 이름 인용) | 28 / 577 |
| Relic → Power | 32 / 293 |
| Power → Power (관련 파워) | 39 / 260 |

→ **이건 description 안 hover/link만 켜주면 끝.** detail 페이지에 `RichDescription`을
  넘기면 자동 동작 (이번 세션 패턴 그대로).

### 스칼라 필드 기반
| 관계 | 데이터 |
|------|--------|
| Encounter ↔ Act | `encounters.json::act` |
| Event ↔ Act | `events.json::act` |
| Monster ↔ Encounter (역) | `encounters.json::monsters[]` 의 reverse index |
| Card ↔ Color (캐릭터) | `cards.json::color` |
| Relic ↔ Pool | `relics.json::pool` |
| Relic ↔ Rarity | `rarity` |
| Card ↔ Keyword/Tag | `keywords[]`, `tags[]` (이미 카드 detail에 표시) |

## 3. 게임 코드 마이닝이 필요한 관계 (high-cost, high-value)

JSON에는 description 텍스트만 있고 reward/effect 테이블은 빠져 있다.
`update-game-assets` 파이프라인을 확장해야 한다.

| 관계 | 게임 소스 위치 (예상) | 비고 |
|------|----------------------|------|
| **Event → Reward (Card/Relic/Potion/Curse)** | `src/Core/Models/StoryEvents/<EventName>.cs::Resolve()` | 옵션별 reward 테이블. NEOW/Ancients는 이미 `relics[]`로 풀려있는데, 일반 이벤트는 안 풀림. |
| **Event → Triggered Encounter** | 동일 (e.g. `BYRDONIS_NEST`) | 이벤트 → 강제 전투 매핑 |
| **Card → Power (적용 효과)** | `Cards/<Card>.cs::OnPlay()` | description엔 일부만 노출. 정확한 mapping은 코드 |
| **Card → Card (transform)** | `BloodForBlood`, `Madness` 등 변신 카드 | 코드에서 `Create<Card>()` 호출 추적 |
| **Relic → Card pool 변경** | 특정 카드를 덱에 추가하는 유물 | `OnObtain` / `OnFloorChange` 훅 |
| **Monster → Power (적용 intent)** | `Monsters/<Name>.cs::Intent` 또는 데이터 테이블 | 현재 moves[]는 이름만. 어떤 power를 거는지 코드에 있음 |
| **Boss → Encounter / Act** | 보스 등장 결정 로직 | encounters의 `room_type=Boss` + 위치(act)로 근사 가능 |
| **Card → Orb / Dialed Power 등 특수 메커니즘** | 디펙트/네크로 클래스 | 게임 코드 |
| **Ancient → Card 보상** | Ancient 이벤트에 카드 보상 있는 경우 | events.json에 `cards[]` 같은 필드는 없음 |

게임 코드는 [asset_pipeline](../memory/asset_pipeline.md)에 적힌 GDRE/ILSpy 경로로
디컴파일 가능. 새 파이프라인을 만들어 reward 테이블만 JSON으로 풀어내면 충분.

## 4. 구현 우선순위 제안

티어 0은 이미 끝났음. 1→2→3 순서로 점점 비용이 올라간다.

### Tier 1 — RichDescription 일반화 (즉시)
- ✅ Relic / Enchantment 상세에 `RichDescription` 적용
- ⬜ Card / Power / Potion / Event 상세 동일 적용
  → JSON description에 inline 멘션된 모든 엔티티 자동 hover/link
- ⬜ 자기 자신 매칭 제외(`excludeEntityTerms`)는 이미 helper로 처리

### Tier 2 — 역참조 섹션 (Detail 페이지 + 도감 그루핑)
| Detail 페이지 | 역참조 섹션 |
|--------------|--------------|
| Enchantment | "부여 유물" *(완료)* + "인챈트 가능 카드 N개" 링크 (`canEnchantCard`) |
| Power | "이 파워를 다루는 카드/유물/이벤트" |
| Card | "이 카드를 언급하는 카드/유물" |
| Monster | "등장 인카운터" (encounters.json reverse) |
| Encounter | 이미 monsters[] 있음 → tile UI |
| Event | "보상" / "관련 카드/유물/파워/몬스터" (Tier 1으로 자동 채워짐) |
| Relic | "주는 보스(Ancient)" (Ancient.relicIds reverse) |
| Ancient | "주는 유물" *(이미 도감에 있음)* + "관련 이벤트" |

### Tier 3 — 게임 코드 풀어내기
- 새 추출 작업 1: `events_resolutions.json` — 이벤트 옵션별 보상 (card/relic/potion/curse/maxhp/gold).
- 새 추출 작업 2: `monster_intents.json` — 몬스터 move → 적용 power/damage/block.
- 새 추출 작업 3: `card_effects.json` — 카드 OnPlay → 적용 power/생성 카드/탐지 키워드.
- 위 셋을 풀면 detail 페이지 역참조가 description 텍스트 추측이 아니라 게임 그대로의 SSOT가 됨.

## 5. 구조적 정리

`RichDescription` (이번 세션 도입)을 쓸 때 패턴:

```ts
<RichDescription
  description={entity.description}
  entities={allEntities}                  // loadAllEntities()
  excludeEntityTerms={selfNames}          // 자기 자신 링크 방지
  termDescriptions={extraKeywordTooltips} // 선택
/>
```

역참조 섹션은 다음 일반 helper로 통일 가능:

```ts
// 1. text-scan 기반
function entitiesMentioning(target: EntityInfo, candidates: HasDescription[]): T[];

// 2. 데이터 필드 기반
function ancientsThatDrop(relicId: string, ancients: CodexAncient[]): CodexAncient[];
function encountersWithMonster(monsterId: string, encounters: CodexEncounter[]): CodexEncounter[];
```

각각의 helper를 `src/lib/codex-cross-refs.ts`에 한 곳에 모아두는 것을 권장.
detail 페이지에서는 `getCodex*()` + helper 호출 + 결과 tile 그리드 렌더로 끝.
