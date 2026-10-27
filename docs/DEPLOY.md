# 배포 매뉴얼

이 프로젝트의 기본 배포 대상은 Cloudflare Workers Free다. main Worker는
`next build`가 prerender한 정적 페이지와 asset만 서빙하는 정적 전용
Worker이고(런타임에 Next/OpenNext 없음), patch Worker는 미리 생성한 정적
patch 페이지와 patch-local asset을 별도로 서빙한다.

## 사전 조건

- `pnpm` 의존성이 설치되어 있어야 한다.
- Wrangler가 Cloudflare 계정에 인증되어 있어야 한다.
- main Worker와 patch Worker의 기존 환경 변수는 `--keep-vars`로 유지한다.

## Main Worker

로컬 Worker 런타임에서 main Worker를 확인한다.

```bash
pnpm cf:preview
```

프로덕션 main Worker를 배포한다.

```bash
pnpm cf:deploy
```

이 명령은 `pnpm static:data`, `next build --webpack`,
`scripts/collect-cf-assets.mjs`(`public/**`, `.next/static/**`, `BUILD_ID`),
`scripts/copy-cf-static-pages.mjs`, `pnpm cf:assets`, `pnpm cf:size`,
`wrangler deploy --keep-vars` 순서로 실행된다. 결과물은 `.cloudflare/assets`다.
`pnpm cf:assets`는 실제 Worker를 모든 prerender route에 돌려 렌더러가 필요한
route가 있으면 실패한다.

## Patch Worker

patch Worker는 main Worker보다 빨리 패치노트를 공개하기 위한 정적 Worker다.
배포 전 patch HTML, CSS, asset을 생성하고 pending Compendium 링크가 안전하게
닫혀 있는지 확인한다.

```bash
pnpm patch:build
pnpm patch:test
pnpm cf:patch:preview
```

프로덕션 patch Worker를 배포한다.

```bash
pnpm cf:patch:deploy
```

patch-first 배포가 필요하면 `docs/PATCH_WORKER_DEPLOY_CONTRACT.md`를 따른다.
현재 `/patches*`와 `/_patches*`는 main Worker의 `PATCH_WORKER` service
binding을 경유한다. 커스텀 도메인 도입 후 직접 route dispatch 목표는
`docs/CLOUDFLARE_CUSTOM_DOMAIN_ROUTING.md`에 기록되어 있다.

## Free Tier 확인

Cloudflare 런타임이나 배포 설정을 바꾸는 경우, `pnpm cf:build` 뒤
`pnpm cf:size`(Wrangler dry run)로 bundle size와 binding을 확인한다.

```bash
pnpm exec wrangler deploy --dry-run --outdir /tmp/sts-worker-dry-run
```

Workers Free 기준으로 gzip upload size가 3 MiB를 넘으면 배포 차단 이슈로
취급한다. 정적 전용 main Worker는 수십 KiB라 `pnpm cf:size`는 256 KiB
예산(`CLOUDFLARE_WORKER_SIZE_BUDGET_KIB`)을 넘어도 실패한다. 또한 기능 변경 시 request-time CPU 10 ms, 128 MB memory, 50
subrequests/request, 100,000 requests/day 한계에서 `exceededResources`, Error
1102, 503이 날 수 있는지 검토한다.

## 이미지

- 프로덕션 이미지는 Cloudflare 정적 asset으로 직접 서빙한다.
- Next image optimization은 사용하지 않는다.
- 이미지 컴포넌트는 `src/components/ui/static-image.tsx`를 기준으로 유지한다.
