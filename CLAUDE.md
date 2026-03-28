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
