# 아키텍처

## 시스템 개요

Cloudflare Workers Free를 기본 목표로 하는 정적 우선 Next.js 사이트.
빌드 타임에 JSON/Markdown 데이터를 읽어 가능한 페이지와 API 데이터를
생성하고, 요청 시 Worker는 정적 asset dispatch 또는 얇은 OpenNext
fallback만 수행한다.

```
data/*.json + data/*.md
  -> Next.js/OpenNext build
  -> .open-next/assets + .open-next/worker.js
  -> scare-the-spire main Worker

data/sts2-patch-notes/*.md
  -> pnpm patch:build
  -> .patch-worker/assets
  -> scare-the-spire-patches static Worker
```

## 하위 문서

- [IMAGES.md](./architecture/IMAGES.md) — 이미지 소스, WebP 변환, 파일 구조
- [DEPRECATED.md](./architecture/DEPRECATED.md) — 삭제된 카드/유물, 표현 방식
- [PATCH_WORKER_DEPLOY_CONTRACT.md](./PATCH_WORKER_DEPLOY_CONTRACT.md) — patch-first 배포 계약
- [CLOUDFLARE_CUSTOM_DOMAIN_ROUTING.md](./CLOUDFLARE_CUSTOM_DOMAIN_ROUTING.md) — 추후 커스텀 도메인 route dispatch 목표
- [OPENNEXT_EXIT_PLAN.md](./OPENNEXT_EXIT_PLAN.md) — 정적 shell 전환과 OpenNext 런타임 제거 계획

## Worker 구조

- `workers/main-worker.ts`: OpenNext Worker wrapper. `/`, locale home,
  서비스 인덱스, 일부 Compendium HTML/RSC는 `_cf_static_pages` asset으로
  먼저 서빙하고, 나머지만 OpenNext fallback으로 넘긴다.
- `workers/patch-worker.ts`: `pnpm patch:build` 결과물을 서빙하는
  asset-first Worker. 런타임에서 patch markdown을 렌더링하지 않는다.
- 현재 `/patches*`와 `/_patches*`는 main Worker의 `PATCH_WORKER`
  service binding을 통해 patch Worker로 전달된다.
- 커스텀 도메인 도입 후 목표는 `/patches*`와 `/_patches/*`를 patch
  Worker에 직접 route dispatch하고, 나머지 경로만 main Worker가 받는
  구조다.

## 디렉토리 구조

```
scare-the-spire/
├── data/                   # STS1 legacy data, STS2 data, rich patch notes
│   ├── sts2/               # Extracted STS2 game data by locale
│   ├── sts2-patch-notes/   # Rich patch markdown
│   └── patches/            # STS1 legacy patch notes
├── src/
│   ├── app/                # Next.js App Router
│   │   ├── (codex)/codex/  # STS2 Compendium
│   │   ├── patches/        # Development/compat patch routes
│   │   └── (main)/         # STS1 legacy pages
│   ├── components/         # React 컴포넌트
│   └── lib/                # 타입, 데이터 로딩
├── public/images/sts2/     # STS2 extracted game assets
├── workers/                # Cloudflare Worker entrypoints
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

- **플랫폼**: Cloudflare Workers Free target
- **Main Worker**: `pnpm cf:deploy` (`@opennextjs/cloudflare`)
- **Patch Worker**: `pnpm cf:patch:deploy` (`pnpm patch:build` + Wrangler)
- **이미지**: WebP/PNG 등 정적 파일 직접 서빙. Next image optimization은 사용하지 않음
- **운영 원칙**: Cloudflare Free 한계 때문에 request-time CPU, 메모리,
  Worker gzip bundle size, subrequest 수를 기능 설계 단계에서 먼저 평가한다.
