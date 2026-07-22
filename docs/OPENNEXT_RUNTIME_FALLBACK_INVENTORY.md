# OpenNext Runtime Fallback Inventory

## Status

2026-07-22 기준 메인 Worker의 OpenNext runtime fallback은 여러 fallback
함수의 모음이 아니라 `workers/main-worker.ts` 마지막의
`openNextWorker.fetch(request, env, ctx)` 한 줄이다. 앞선 정적 분기에서 응답을
찾지 못한 모든 요청이 이 catch-all로 들어간다.

이 문서는 fallback에 유입되는 요청을 기능별로 나누고, 각 유형의 필요 여부와
삭제 선행 조건을 기록한다. 전체 제거 순서는
[OpenNext Runtime Exit Plan](./OPENNEXT_EXIT_PLAN.md)을 따른다.

## Current Boundary

현재 `.next/prerender-manifest.json`에는 4,364개의 prerendered route가 있다.
이번 정적 분기 확장 후 확인한 delivery는 다음과 같다.

| Delivery | Route 수 | 대표 |
| --- | ---: | --- |
| 정적 home | 14 | `/`, `/en`, `/zh` |
| 정적 서비스 index | 84 | `/chemical-x`, `/en/combo`, `/zh/profile` |
| 정적 Compendium | 3,312 | `/compendium`, `/compendium/cards/abrasive`, `/zh/compendium/cards` |
| 정적 STS1 legacy | 603 | `/cards/bash`, `/relics/anchor`, `/potions/fairy-potion` |
| patch Worker binding | 336 | `/patches/0.100.0`, `/en/patches/changes` |
| 아직 분류가 필요한 prerender route | 15 | dev 9, metadata 4, framework error 2 |

정적 route 수는 build manifest의 결과이며 HTML/RSC asset 수는 일반적으로 두
배다. 2026-07-22 `pnpm cf:build`에서 `_cf_static_pages` 8,026개, 전체 asset
12,667/20,000개, 최대 asset 10.82 MiB로 검증했다.

같은 artifact의 `pnpm cf:size`는 Worker gzip 3180.87 KiB로 Free 한도 3072
KiB를 108.87 KiB 초과했다. 정적 asset 수와 별개로 OpenNext runtime import가
여전히 남아 있기 때문이며, 이 결과는 production 배포 차단 상태다.

## Fallback Types and Decisions

### 1. 이미 생성됐지만 복사하지 않았던 공개 정적 페이지

대표:

- STS1 legacy: `/cards`, `/cards/bash`, `/relics/anchor`, `/potions/fairy-potion`
- 서비스 index: `/combo`, `/this-or-that`, `/profile`, `/byrdispatch`와 locale variant
- Compendium root: `/compendium`, `/en/compendium`, `/zh/compendium`

판정: **OpenNext runtime 불필요. 즉시 삭제 가능.**

처리:

- Next가 생성한 HTML/RSC를 `_cf_static_pages`로 복사한다.
- main Worker가 bounded path matcher로 asset을 직접 반환한다.
- `x-cf-static-page`로 `service`, `compendium`, `legacy`를 구분한다.

상태: **코드 반영, build/asset 검증 통과. local route smoke 대기.**

### 2. 무한한 사용자 콘텐츠 ID 상세

대표:

- `/chemical-x/{postId}`
- `/combo/{postId}`
- `/this-or-that/{postId}`
- `/history-course/{runId}`
- 위 route의 `/en`, `/zh` 등 game-locale variant

판정: **공개 기능에는 필요하지만 OpenNext SSR은 불필요. 대체 후 삭제.**

현재 서버가 record 본문을 소유해 렌더하지 않는다. Chemical X, Combo, This or
That은 브라우저에서 Supabase record를 읽고, History Course는 IndexedDB 또는
Supabase에서 run을 읽는다. metadata도 ID별 record 데이터를 사용하지 않는
generic metadata다.

삭제 선행 조건:

1. 서비스·locale별 정적 detail shell을 생성한다.
2. shell이 prop의 placeholder ID가 아니라 현재 URL에서 ID를 읽게 한다.
3. Worker가 허용된 한 segment ID 형태만 shell로 rewrite한다.
4. document와 RSC navigation, direct refresh, invalid nested path를 검증한다.

상태: **fallback 유지. 다음 우선순위.**

### 3. game-only locale Compendium detail

대표:

- `/zh/compendium/cards/abrasive`
- `/ja/compendium/relics/anchor`
- `/de/compendium/monsters/slime_boss`

판정: **locale 기능 계약을 유지하려면 대체 후 삭제.**

한국어 prefixless와 `/en` detail은 정확한 HTML/RSC asset으로 제공한다. 나머지
game-only locale detail을 엔티티별로 모두 복사하면 20,000 asset 한도에
근접하거나 초과하므로 그대로 확장하지 않는다.

삭제 선행 조건:

1. resource type별 공유 detail shell과 locale/resource JSON을 만든다.
2. service UI는 영어, 게임 이름·설명은 선택한 game locale을 사용한다.
3. 유효 resource ID만 허용하고 없는 ID는 정적 404로 보낸다.

상태: **fallback/현재 Next route 계약 확인 필요. OpenNext exit Phase 4에서 처리.**

### 4. patch Worker binding 장애 시 우회

대표:

- `PATCH_WORKER` binding이 없는 `/patches/0.100.0`
- binding이 없는 `/en/patches/changes`

판정: **OpenNext fallback 불필요하며 숨은 이중 구현이므로 삭제.**

Patch route의 production owner는 정적 `scare-the-spire-patches` Worker다. binding
누락을 메인 OpenNext route가 대신 처리하면 배포 설정 오류를 숨기고 release
직후 CPU 위험을 다시 만든다.

처리: binding이 없으면 `503`, `Retry-After: 60`, `Cache-Control: no-store`로
명시적으로 실패한다.

상태: **코드 반영. Wrangler가 binding `local [connected]`까지 확인했지만 local
runtime 시작 전 Miniflare `spawn EBADF`로 종료되어 route smoke 대기.**

### 5. 개발 전용 page와 API

대표:

- `/dev/admin`, `/dev/reference`, `/dev/og-images`, `/dev/monsters/{id}`
- `/api/dev/history-course-runs`
- `/api/dev/history-course-runs/{runId}`

판정: **production에는 불필요하지만 local/Cloudflare preview에는 필요. 분리 후
production fallback에서 삭제.**

Production build에서는 `devToolsEnabled()`가 404를 반환하지만 route module은
OpenNext artifact에 남을 수 있다. `cf:preview`는
`NEXT_PUBLIC_ENABLE_DEV_TOOLS=1`로 이 기능을 의도적으로 켠다.

삭제 선행 조건:

1. dev route를 production artifact에서 제외하거나 별도 dev Worker로 한정한다.
2. `pnpm dev`와 새 production-shaped preview의 역할을 분리한다.
3. dev page와 API parity smoke를 별도 preview 명령에 유지한다.

상태: **fallback 유지. production/dev artifact 분리 필요.**

### 6. Metadata route와 고정 파일

대표:

- `/robots.txt`
- `/sitemap.xml`
- `/favicon.ico`
- `/apple-icon.png`

판정: **runtime 불필요. asset delivery 확인 후 삭제.**

Next build는 sitemap/robots body와 icon route output을 생성한다. OpenNext가 이를
Cloudflare asset directory의 정확한 공개 경로에 두는지 preview에서 확인하고,
누락된 파일만 asset collector가 복사한다.

상태: **실제 OpenNext artifact와 response header 확인 대기.**

### 7. Framework error와 미등록 URL

대표:

- `/_not-found`, `/_global-error`
- `/does-not-exist`
- `/compendium/cards/not-a-real-card`
- 허용된 route보다 깊은 `/chemical-x/id/extra`

판정: **오류 응답은 필요하지만 OpenNext runtime은 불필요. 정적 404 대체 후
삭제.**

삭제 선행 조건:

1. 서비스 locale별 정적 404 HTML을 만든다.
2. RSC navigation에서 사용하는 not-found RSC 응답 계약을 고정한다.
3. 알려진 모든 route matcher가 fail closed하는지 검사한다.
4. error route 자체가 public route로 노출되지 않게 한다.

상태: **fallback 유지. 모든 공개 route가 분류된 뒤 마지막에 교체.**

### 8. 지원하지 않는 method와 Next protocol 요청

대표:

- page에 대한 `POST`, `PUT`, `DELETE`
- `next-action` header가 있는 요청
- 잘못된 RSC query/header 조합

판정: **현재 공개 server action은 없으므로 일반 page mutation fallback은
불필요. protocol audit 후 405/400으로 삭제.**

단, RSC document navigation은 실제 기능이므로 method만 보고 일괄 차단하지
않는다. 현재 코드의 `rsc: 1` header와 `_rsc` query 양쪽을 smoke해야 한다.

상태: **fallback 유지. server action 0건 재검증 및 method matrix 필요.**

## Deletion Order

1. 정적으로 생성된 공개 page를 직접 asset으로 제공한다. **진행 중**
2. patch route의 binding-missing OpenNext 우회를 제거한다. **진행 중**
3. metadata route를 정확한 static asset으로 고정한다.
4. 사용자 콘텐츠 dynamic-ID shell을 만든다.
5. game-only locale Compendium detail shell을 만든다.
6. dev-only route/API를 production artifact에서 분리한다.
7. unsupported method를 명시적으로 거부한다.
8. 정적 404 HTML/RSC를 추가하고 unknown/error fallback을 제거한다.
9. fallback 관찰 기간 후 `openNextWorker.fetch`와 import를 삭제한다.
10. 마지막으로 OpenNext build dependency와 asset collector를 교체한다.

앞 단계에서 fallback 유입이 줄어도 `openNextWorker` import가 남아 있는 동안
bundle 크기는 크게 줄지 않는다. 실제 크기 절감은 9단계에서 runtime import를
제거할 때 확정된다.

## Release Gates

- 모든 공개 route family에 `static`, `shell`, `patch`, `dev-only`, `404` 중 하나의
  owner가 있다.
- 한국어, 영어, game-only locale 대표 route가 document/RSC 양쪽에서 기대한
  `x-cf-static-page` 또는 shell 분류 header를 반환한다.
- direct refresh와 client navigation 결과가 같다.
- patch route는 binding을 통해서만 성공한다.
- dev route는 production에서 404이며 dev-enabled preview에서만 동작한다.
- asset 수가 현재 20,000 한도의 90% 미만이고 개별 asset이 25 MiB 미만이다.
- main Worker gzip이 CI 안전 예산을 통과한다.
- 예상 public route가 OpenNext fallback을 사용하는 횟수가 0이다.

## Related Documents

- [OpenNext Runtime Exit Plan](./OPENNEXT_EXIT_PLAN.md)
- [Cloudflare Worker Bundle Size Reduction Plan](./CLOUDFLARE_WORKER_SIZE_PLAN.md)
- [Cloudflare custom-domain routing](./CLOUDFLARE_CUSTOM_DOMAIN_ROUTING.md)
