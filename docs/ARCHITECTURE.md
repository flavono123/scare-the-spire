# 아키텍처

## 시스템 개요

정적 생성(SSG) 기반 웹사이트. 빌드 타임에 JSON 데이터를 읽어 HTML 생성.

```
data/*.json (English)  →  Next.js SSG Build  →  Static HTML/JS (Korean UI)  →  Vercel CDN
```

## 하위 문서

- [IMAGES.md](./architecture/IMAGES.md) — 이미지 소스, WebP 변환, 파일 구조
- [DEPRECATED.md](./architecture/DEPRECATED.md) — 삭제된 카드/유물, 표현 방식

## 디렉토리 구조

```
scare-the-spire/
├── data/                   # JSON 데이터 (영어)
│   ├── cards.json          # 367 cards
│   ├── relics.json         # 182 relics (incl. 2 deprecated)
│   ├── changes.json        # 127 changes
│   └── stories.json        # curated stories
├── src/
│   ├── app/                # Next.js App Router
│   │   ├── page.tsx        # / — 이야기 피드
│   │   ├── cards/          # /cards — 카드 브라우저
│   │   └── relics/         # /relics — 유물 브라우저
│   ├── components/         # React 컴포넌트
│   └── lib/                # 타입, 데이터 로딩
├── public/images/
│   ├── cards/              # WebP 340w (base, upgraded, beta)
│   └── relics/             # WebP (icon size)
├── prompts/                # 기획 (PLAN.md, SPEC.md)
├── docs/                   # 설계 문서
│   └── architecture/       # 상세 아키텍처 문서
└── tasks/                  # 작업 태스크
```

## 언어 정책

- **데이터**: 영어 (게임 원문)
- **서비스 UI**: 한국어 우선, 영어 2순위
- **카드/유물**: `name`(영어) + `nameKo`(한국어 공식 번역)

## 배포

- **플랫폼**: Vercel (Git Integration, main push 시 자동 배포)
- **빌드**: `pnpm build` (Next.js SSG)
- **이미지**: WebP, git 직접 커밋 (LFS 불필요)
