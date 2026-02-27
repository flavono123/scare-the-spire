# 슬서운 이야기 - 기술 스펙 (MVP)

## 개요

슬레이 더 스파이어의 과거 밸런스 변경 이력을 "이야기"로 보여주는 정적 웹사이트.
모든 카드/유물 데이터를 갖추고, 변경 이력을 탐색할 수 있다.

### 언어 정책

- **데이터**: 영어 (게임 원문 기준 - 이름, 설명, 변경 이력)
- **서비스 UI**: 한국어 우선, 영어 2순위
- 카드/유물은 `name`(영어 원문)과 `nameKo`(한국어 공식 번역) 필드를 모두 가짐
- 이야기 문장(`sentence`)은 한국어 서비스 콘텐츠

## 기술 스택

| 영역 | 선택 | 이유 |
|------|------|------|
| Framework | Next.js 15 (App Router) | SSG + React, SEO |
| UI | shadcn/ui + Tailwind CSS | 빠른 프로토타이핑 |
| Data | JSON files (`data/`) | 서버 불필요, git 버전 관리 |
| Deploy | Vercel | Next.js 최적화, 무료 tier |
| Package Manager | pnpm | 프로젝트 표준 |
| Language | TypeScript (strict) | 타입 안정성 |

## 데이터 스키마

### 타입 정의

```typescript
type CardClass = 'ironclad' | 'silent' | 'defect' | 'watcher' | 'colorless' | 'curse' | 'status';
type CardType = 'attack' | 'skill' | 'power' | 'status' | 'curse';
type Rarity = 'starter' | 'common' | 'uncommon' | 'rare' | 'boss' | 'shop' | 'event' | 'special';
type DiffType = 'number' | 'text' | 'enum' | 'image';
```

### 카드

```typescript
interface Card {
  id: string;           // slug (e.g. "corruption")
  name: string;         // English canonical (e.g. "Corruption")
  nameKo: string;       // Korean official (e.g. "타락")
  class: CardClass;
  cardType: CardType;
  rarity: Rarity;
  cost: number | 'X' | 'unplayable';
  description: string;  // English
  image?: string;       // current art path (e.g. "/images/cards/corruption.png")
  imageBeta?: string;   // beta art path (if available)
}
```

### 유물

```typescript
interface Relic {
  id: string;
  name: string;         // English
  nameKo: string;       // Korean
  rarity: Rarity;
  characterClass?: CardClass;  // undefined = shared
  description: string;  // English
  image?: string;       // current art path
}
```

### 변경 이력

```typescript
interface AttributeDiff {
  attribute: string;      // e.g. "cost", "damage", "rarity"
  displayName: string;    // English (e.g. "Cost", "Damage", "Rarity")
  before: string | number;
  after: string | number;
  diffType: DiffType;
}

interface Change {
  id: string;
  entityType: 'card' | 'relic';
  entityId: string;       // -> Card.id or Relic.id
  patch: string;          // e.g. "Weekly Patch 25", "V2.0: The Watcher"
  date?: string;          // ISO 8601
  summary?: string;       // English
  diffs: AttributeDiff[];
}
```

### 이야기

```typescript
interface Story {
  id: string;
  sentence: string;       // Korean (e.g. "타락은 원래 고급 카드였다")
  entityType: 'card' | 'relic';
  entityId: string;
  changeId: string;
  tags?: string[];        // e.g. ["너프", "아이언클래드"]
}
```

### JSON 파일 구조

```
data/
├── cards.json            # Card[]
├── relics.json           # Relic[]
├── changes.json          # Change[]
└── stories.json          # Story[]
```

## 페이지 구조

| 경로 | 설명 |
|------|------|
| `/` | 이야기 피드 (메인) |
| `/stories/[id]` | 이야기 상세 + 변경 이력 타임라인 |
| `/cards` | 카드 목록 (캐릭터별 탭, 등급 필터) |
| `/cards/[id]` | 카드 상세 + 변경 이력 |
| `/relics` | 유물 목록 (등급별 필터) |
| `/relics/[id]` | 유물 상세 + 변경 이력 |

참고: 서비스 UI에서 "엔티티"라는 용어는 사용하지 않음. "카드", "유물"로 직접 명시.

## 핵심 컴포넌트

### StoryCard
- 이야기 문장을 카드 형태로 표시
- 클릭 시 상세 페이지로 이동
- 태그 표시

### ChangeTimeline
- 변경 이력을 시간순 타임라인으로 표시
- DiffType별 렌더링 (number, text, enum, image)

### CardItem / RelicItem
- 목록에서 사용하는 아이템
- 이름 + 핵심 속성 + 변경 이력 유무

## MVP 범위

### 포함
- 전체 카드 데이터 (~200장, 4 캐릭터 + 무색 + 저주)
- 전체 유물 데이터 (~180개)
- 위키 기반 변경 이력
- 이야기 피드 + 상세
- 카드/유물 탐색 (필터)
- 반응형 (모바일 우선)
- Vercel 배포

### 제외 (추후)
- 물약/적/이벤트
- 댓글 시스템 (게이머 친화적인 방식 검토)
- 사용자 이야기 제출
- 영어 서비스 UI (i18n)
- 이야기 투표/좋아요
