# 슬서운 이야기 (scare-the-spire)

슬레이 더 스파이어 1/2 정보 사이트. STS2 백과사전(Codex)이 메인, STS1 밸런스 변경 이력은 레거시.

## Speculative Commits

All task instructions must be followed by an immediate speculative commit after each modification. Do not batch changes — commit after every meaningful edit.

## 기술 스택

- **Framework**: Next.js 15 (App Router, TypeScript strict)
- **UI**: shadcn/ui + Tailwind CSS v4
- **Data**: JSON files in `data/`
- **Package Manager**: pnpm
- **Deploy**: Vercel (SSG)

## 프로젝트 구조

- `data/` - STS1 정적 JSON 데이터 (카드, 유물, 변경이력, 이야기)
- `src/app/(main)/` - STS1 메인 페이지 (레거시, 네비에서 숨겨짐)
- `src/app/(codex)/codex/` - STS2 백과사전 (카드/유물/포션/에인션트)
- `src/components/` - React 컴포넌트
- `src/components/codex/` - STS2 Codex 전용 컴포넌트
- `src/lib/` - 유틸리티, 타입 정의, 데이터 로딩
- `public/images/spire-codex/` - STS2 게임 에셋 이미지 (cards, relics, potions, ancients 등)
- `prompts/` - 기획 문서 (PLAN.md, SPEC.md)
- `docs/` - 설계 문서 (DESIGN.md, ARCHITECTURE.md)
- `tasks/` - 작업 태스크 파일

## 서비스 정체성

**슬서운이야기**는 STS2 패치를 소스로 만들어지는 서비스다.

### 슬서운변경 (Rich Patch Notes)
- Steam 패치노트 원문을 가져와 **rich 패치**로 변환하여 제공
- Rich = 텍스트 효과(색상/애니메이션) + hover 시 해당 요소(카드/유물/보스/포션/이벤트/파워/토큰 등) 렌더 + 클릭 시 해당 리소스 페이지로 이동
- 패치 내역을 소스로 슬서운이야기(커뮤니티 콘텐츠)를 생성하는 구조

### 이야기 & 댓글
- 이야기(story), 변화(diff/change)를 포함해 모든 요소에 대해 댓글로 이야기할 수 있음
- 카드/유물 개별 페이지, 패치노트 등 각 리소스에 댓글 연결

### 언어 정책
- 서비스의 일급시민 언어는 **한국어**
- 게임 내 요소는 **게임 내 번역을 우선시** — `hello world`, `null` 같은 카드는 영어 표기
- 게임 내 직접적인 i18n 요소가 아니더라도 게임에서 유래한 용어는 게임 번역을 따름
- Rich 패치에서 hover → link를 통해 모든 게임 요소가 연결되는 구조

### 텍스트 효과 & 색상 체계
- 기본 엔티티 강조(카드, 유물, 파워, 토큰 등): **gold**
- 캐릭터 색상 (주로 타이틀/섹션):
  - 아이언클래드: **red**
  - 사일런트: **green**
  - 리젠트: **orange**
  - 네크로바인더: **pink**
  - 디펙트: **aqua**
- 고대의 존재(Ancient): **blue**
- 버프/너프 표현 (인게임 애니메이션 기반):
  - 버프: **green + sine**
  - 너프: **red + jitter**

## 코드 컨벤션

- 데이터 JSON은 영어 (게임 원문 기준)
- 서비스 UI는 한국어 우선, 영어 2순위
- 카드/유물: `name`(영어 canonical), `nameKo`(한국어 공식 번역)
- 서비스에서 "엔티티"라는 용어 사용하지 않음. "카드", "유물"로 직접 명시
- 컴포넌트: kebab-case 파일명, PascalCase export
- 코드/주석은 영어

## 데이터

### STS1 (레거시)
- 전체 카드 (~200장) + 전체 유물 (~180개) in `data/`
- 변경 이력 없는 카드/유물도 데이터에 포함

### STS2 (메인)
- 카드 612장, 유물 314개, 포션 63개, 에인션트 8개
- 이미지: `public/images/spire-codex/` (spire-codex.com에서 추출)
- 데이터: `src/lib/codex-data.ts`, `src/lib/codex-types.ts`
- 한국어 이름은 게임 공식 번역 사용
