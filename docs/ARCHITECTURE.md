# 아키텍처

## 시스템 개요

정적 생성(SSG) 기반 웹사이트. 빌드 타임에 JSON 데이터를 읽어 HTML 생성.

```
data/*.json (English)  →  Next.js SSG Build  →  Static HTML/JS (Korean UI)  →  Vercel CDN
```

## 언어 정책

- **데이터 레이어**: 영어 (게임 원문). name, description, summary, displayName
- **표현 레이어**: 한국어 우선. UI 라벨, 이야기 문장은 한국어
- **카드/유물**: `name`(영어) + `nameKo`(한국어 공식 번역)
- **향후**: 영어 서비스 UI 지원 시 i18n 도입

## 데이터 구조

```
data/
├── cards.json      # 전체 카드 (~200장)
├── relics.json     # 전체 유물 (~180개)
├── changes.json    # 변경 이력
└── stories.json    # 이야기 (큐레이션)
```

## 디렉토리 구조 (계획)

```
scare-the-spire/
├── data/                   # JSON 데이터
├── src/
│   ├── app/                # Next.js App Router 페이지
│   ├── components/         # React 컴포넌트
│   └── lib/                # 유틸리티, 타입, 데이터 로딩
├── public/                 # 정적 에셋
├── prompts/                # 기획 문서
├── docs/                   # 설계 문서
├── tasks/                  # 작업 태스크
└── CLAUDE.md
```

## 배포

- **플랫폼**: Vercel
- **빌드**: `pnpm build` (Next.js SSG)
- **트리거**: main 브랜치 push 시 자동 배포
