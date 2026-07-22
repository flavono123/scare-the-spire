# Cloudflare Worker Bundle Size Reduction Plan

## Status

2026-07-22 기준 메인 Worker의 gzip 업로드 크기는 3006.95 KiB로,
Cloudflare Workers Free의 3 MiB(3072 KiB) 한도까지 65.05 KiB만 남아 있다.
기능을 삭제하지 않고 우선 Next.js 빌드를 Turbopack에서 Webpack으로 전환해
중복된 서버 청크를 줄이고, 이후
[OpenNext Runtime Exit Plan](./OPENNEXT_EXIT_PLAN.md)에 따라 요청 경로에서
OpenNext를 제거한다.

이 문서는 단기적인 번들 여유 확보 계획이다. 최종 목표 아키텍처와 정적
라우팅 전환은 OpenNext exit 문서를 따른다.

## 결론

- 단기 조치로 Webpack 전환이 가장 효과가 크다. 같은 기능을 포함한 실험
  빌드에서 gzip 업로드 크기가 3006.95 KiB에서 1821.46 KiB로 1185.49
  KiB(39.4%) 감소했다.
- Webpack 전환과 OpenNext exit의 효과는 누적되지만 단순 합산할 수는 없다.
  Webpack은 OpenNext 서버 번들이 남아 있는 동안 그 번들의 중복을 줄인다.
  OpenNext exit는 나중에 그 서버 런타임 자체를 메인 Worker에서 제거한다.
- 따라서 Webpack 전환 후 OpenNext exit를 완료하면 1821.46 KiB보다 더 작아질
  가능성이 높다. 목표 구조는 정적 자산 경로 분기, locale redirect, patch
  Worker binding, 정적 shell rewrite, 정적 404만 담당하는 얇은 Worker다.
- 다만 최종 크기는 새 정적 자산 수집기와 라우팅 코드가 정해진 뒤 같은
  커밋에서 측정해야 한다. 지금 단계에서 수십 KiB 같은 수치를 완료 조건으로
  약속하지 않는다.
- OpenNext가 완전히 제거된 뒤에는 Webpack의 **Worker 코드 크기** 절감 효과는
  대부분 의미가 없어진다. Next 서버 번들 자체가 더 이상 Worker에 들어가지
  않기 때문이다. 그 전까지는 배포 차단 위험을 낮추는 실용적인 중간 단계다.

## 기준 측정

| 항목 | Turbopack 기준 | Webpack 실험 | 차이 |
| --- | ---: | ---: | ---: |
| Wrangler gzip 업로드 | 3006.95 KiB | 1821.46 KiB | -1185.49 KiB (-39.4%) |
| 3 MiB 한도까지 여유 | 65.05 KiB | 1250.54 KiB | +1185.49 KiB |
| handler raw 크기 | 15,102,747 B | 13,466,918 B | -1,635,829 B |
| handler gzip-9 | 2,957,716 B | 1,748,533 B | -1,209,183 B |
| handler metafile inputs | 820 | 482 | -338 |

Turbopack 결과에는 약 129 KiB짜리 유사한 Codex UI 서버 청크가 10개
포함되어 있었다. `monster-move-visuals.tsx`, `patch-note-renderer.tsx`,
`card-tile.tsx` 같은 공통 코드가 각 청크에 반복된 것이 가장 큰 제거 후보다.
Webpack 실험은 이 중복을 크게 줄였다.

위 두 결과는 동시에 진행 중이던 다른 변경 때문에 정확히 같은 Git 커밋에서
생성되지는 않았다. 차이가 Free 한도의 약 38.6%에 달해 방향성은 충분히
강하지만, 실제 전환 전에는 반드시 같은 커밋에서 두 빌드를 다시 비교한다.

## 범위와 비범위

이 계획은 다음 기능을 그대로 유지한다.

- 한국어, 영어, game-only locale의 문서 및 RSC 탐색
- Compendium 목록과 상세, hover preview, 검색
- Chemical X, Combo(코오오옴보), History Course, This or That의 index와 동적
  ID 상세
- Supabase 저장소 사용 가능/불가 상태와 IndexedDB-only 흐름
- locale redirect, not-found, canonical metadata
- `/patches*` 및 `/_patches*`의 patch Worker service binding
- `/patches/changes` 변경 이력 index와
  `/generated/sts2-resource-patch-index.json` 정적 데이터

이 계획에서는 UI, 데이터, locale, 댓글, 검색, 패치 기능을 크기 절감을 위해
삭제하지 않는다. Lucide와 Radix 정리는 별도의 의존성 단순화 작업이며,
Worker 3 MiB 문제의 주 해결책으로 취급하지 않는다.

## 전환을 막는 현재 코드

일반적인 `next build --webpack`은 App Router `page.tsx`의 허용되지 않은
사용자 정의 export 때문에 실패한다. 예를 들어 Chemical X 상세 페이지는
route entry에서 metadata/page helper를 직접 export하고 locale wrapper가 이를
import한다. 아래 route entry의 사용자 정의 helper를 공유 모듈로 옮겨야 한다.

- `src/app/chemical-x/[id]/page.tsx`
- `src/app/chemical-x/page.tsx`
- `src/app/combo/[id]/page.tsx`
- `src/app/combo/page.tsx`
- `src/app/this-or-that/[id]/page.tsx`
- `src/app/this-or-that/page.tsx`
- `src/app/(main)/byrdispatch/page.tsx`
- `src/app/(main)/page.tsx`
- `src/app/(main)/profile/page.tsx`
- `src/app/(main)/history-course/page.tsx`
- `src/app/(main)/history-course/[runId]/page.tsx`
- `src/app/(codex)/compendium/bestiary/page.tsx`

helper 이동은 공개 route export만 Next.js 규칙에 맞추는 구조 변경이다. 화면과
데이터 흐름은 바꾸지 않는다.

## 실행 단계

### Phase 1: 같은 커밋 기준선 고정

1. 깨끗한 동일 커밋에서 현재 `pnpm cf:build`와 `pnpm cf:size`를 실행한다.
2. gzip 업로드 크기, handler raw/gzip 크기, metafile input 수, 정적 asset 수를
   기록한다.
3. 비교 빌드에 같은 공개 환경 변수와 생성 데이터를 사용한다.

완료 조건: Turbopack과 Webpack을 코드·데이터 차이 없이 비교할 수 있다.

### Phase 2: Webpack 정식 빌드가 통과하도록 route export 정리

1. 위 route entry의 사용자 정의 helper를 인접한 공유 모듈로 이동한다.
2. locale wrapper와 route entry가 같은 공유 모듈을 import하게 한다.
3. 임시 `compile`/`generate` 분리나 export 검증 무시는 사용하지 않는다.
4. 일반 `next build --webpack`이 성공해야 한다.

완료 조건: route 동작과 metadata 결과가 동일하고 표준 Webpack 빌드가
우회 옵션 없이 통과한다.

### Phase 3: Cloudflare 빌드 기본값 전환

1. `package.json`의 `build`를 `next build --webpack`으로 변경한다.
2. OpenNext가 프로젝트의 build script를 통해 Webpack 결과를 사용하게 한다.
3. `pnpm cf:build`와 `pnpm cf:size`로 실제 Wrangler upload를 다시 측정한다.
4. 빌드 중 발견된 `options` 중복 object-key 경고가 런타임 동작에 영향을 주는지
   확인한다. 경고는 floating-ui/Radix 계열 생성 코드에서 관찰되었다.

완료 조건: 동일 커밋에서 gzip 크기가 안전 예산 아래이며 OpenNext artifact가
정상 생성된다.

### Phase 4: 기능 보존 QA

`pnpm cf:preview`에서 다음을 문서 요청과 RSC 요청으로 모두 검증한다.

- prefixless Korean, `/en`, game-only locale 각각의 home, index, detail
- Chemical X, Combo, History Course, This or That의 유효/무효 동적 ID
- Supabase unavailable 공통 UI와 IndexedDB-only History Course run
- redirect, canonical metadata, direct refresh, client navigation, static 404
- patch Worker binding, `/patches/changes` 변경 이력, pending Compendium link의
  fail-closed 동작
- 모바일 viewport의 icon/button hit target 및 주요 상호작용

완료 조건: Turbopack 기준과 기능 차이가 없고 build warning으로 인한 포커스,
키보드, tab 상태 회귀가 없다.

### Phase 4.1: 선택 배포의 production 실기능 smoke

Phase 4가 통과한 artifact를 한 번 production에 배포한 직후, preview 결과가
실제 Cloudflare route, service binding, 정적 asset에서 그대로 유지되는지
확인한다. 이 단계는 **모든 push에서 실행하는 CI gate가 아니다.** Worker
런타임 또는 배포 구조를 바꾼 release를 선택해 운영자가 수동으로 수행하고,
실패 시 해당 배포를 롤백하기 위한 배포 검증이다.

#### 실행 시점 선택

1. 배포 전 `pnpm cf:metrics -- --hours 168 --worker all --hourly`로 최근 7일의
   KST 시간대별 Worker 요청량을 다시 산출한다.
2. Cloudflare Web Analytics의 최근 visits/page views 그래프와 Workers
   dashboard의 requests/errors 그래프를 같은 기간으로 열어, 후보 시간대에
   일회성 유입 급증이나 배포·크롤러 spike가 없는지 확인한다. Web Analytics는
   dashboard-only이므로 이 확인은 API 자동화나 CI 조건으로 대체하지 않는다.
3. 2026-07-22 Workers Analytics 기준 기본 후보는 **06:00–08:00 KST**다.
   최근 7일 평균은 102.1 requests/hour였고, 다음 후보인 05:00–07:00은
   109.6 requests/hour였다. Web Analytics가 다른 패턴을 보이거나 직전 30분에
   트래픽이 급증하면 다음 한산한 창으로 미룬다.

#### 배포 전 기준선

- 대상 commit SHA, Cloudflare deployment version, production origin, 시작 시각을
  기록한다.
- `pnpm cf:metrics -- --hours 24 --worker all` 결과에서 `exceededResources`,
  Error 1102에 해당하는 오류, 503, CPU p99 기준선을 보관한다.
- Phase 4의 local preview 결과와 production에서 비교할 route matrix를 같은
  commit에서 생성한다.

#### production 기능 범위

- prefixless 한국어, `/en`, game-only locale 대표 경로의 home·service index를
  document/RSC 양쪽으로 요청하고 정적 경로에는 올바른 `x-cf-static-page`
  분류를 요구한다.
- 한국어/영어 Compendium index와 detail, 검색 index, resource manifest,
  locale별 detail JSON을 확인한다. 단순한 HTTP 200은 OpenNext fallback도 만들
  수 있으므로 정적 분류와 content type을 함께 검사한다.
- Chemical X, **Combo**, History Course, This or That의 index, 유효한 한-segment
  ID shape, 없는 ID, invalid nested path, direct refresh와 client navigation을
  확인한다.
- Supabase 요청을 브라우저에서 차단했을 때 공통 storage-unavailable UI가
  나오고, History Course의 IndexedDB-only run은 Supabase 없이 열리는지
  확인한다. production 데이터에는 write하지 않는다.
- `/patches`, 최신 한국어/영어 patch, **`/patches/changes`와
  `/en/patches/changes`**, `/_patches/patch.css`,
  `/generated/sts2-resource-patch-index.json`을 같은 production origin에서
  확인한다.
- `/patches/changes`의 리소스 행 렌더, 모바일 overflow, global search
  열기·포커스·Escape 복귀를 확인한다.
- pending Compendium 리소스가 404 link가 아니라 hover-only preview로
  fail-closed되는지 표본을 확인한다.

자동화된 read-only 검사는 배포 후 운영자 환경에서 다음처럼 실행한다.

```bash
pnpm cf:phase4 -- --origin "$NEXT_PUBLIC_SITE_ORIGIN"
```

#### 판정과 롤백

- 위 기능 중 하나라도 5xx/503, 잘못된 locale, 잘못된 canonical, RSC content
  type 불일치, 정적 분류 누락, client hydration 오류를 보이면 실패다.
- smoke 직후 `pnpm cf:metrics -- --hours 1 --worker all`을 다시 실행한다.
  새 `exceededResources`/Error 1102가 발생하거나 page delivery CPU p99가 5 ms
  조사 기준을 넘으면 route별 원인을 확인하고, 배포가 원인이면 CI를 통해 이전
  정상 version으로 롤백한다.
- Web Analytics에서 smoke 이외의 실제 `/combo` 또는 `/patches/changes`
  page view가 확인되면 Workers dashboard의 같은 시각 오류와 대조한다. 실제
  방문과 함께 5xx/1102가 나타나면 브라우저 재현 후 같은 롤백 기준을 적용한다.
- 결과에는 성공·실패 route, 실행 시각, 전후 Worker metrics, Web Analytics와
  Workers dashboard 캡처, 롤백 여부를 남긴다.

완료 조건: 선택한 production deployment에서 Phase 4와 동일한 보호 기능이
모두 통과하고, smoke 전후 Worker 오류나 CPU 회귀가 없으며, 증거와 롤백 판정이
기록되어 있다. 이 결과는 해당 deployment에만 유효하며 이후 모든 배포를
자동으로 보증하지 않는다.

### Phase 5: 안전 예산 적용

- 기존 `CLOUDFLARE_WORKER_SIZE_LIMIT_KIB` gate는 플랫폼 한도인 3072 KiB가
  아니라 2400 KiB를 CI 예산으로 사용한다.
- 예상 1821.46 KiB 기준 약 578 KiB의 회귀 여유가 생긴다.
- 크기 증가 PR은 handler metafile로 새 입력과 중복 청크를 확인한다.

완료 조건: 플랫폼 한도에 닿기 전에 CI가 의미 있는 회귀를 차단한다.

### Phase 6: OpenNext exit로 최종 축소

[OpenNext Runtime Exit Plan](./OPENNEXT_EXIT_PLAN.md)의 Phase 3~6을 수행한다.
특히 정적 dynamic-ID shell, game-only locale shell, explicit static 404가 모든
공개 route를 덮은 후 `openNextWorker.fetch` fallback과 OpenNext build dependency를
순서대로 제거한다.

완료 조건: 깨끗한 checkout이 OpenNext 없이 build/preview/deploy되고 전체 route
inventory가 통과하며 최종 Worker 크기를 새 기준선으로 기록한다.

## Rollback

- route helper 이동과 build flag 변경을 별도 speculative commit으로 유지한다.
- Webpack preview에서 기능 회귀가 발견되면 build flag를 되돌리고 Turbopack
  artifact로 CI 배포한다.
- OpenNext exit 단계에서는 runtime fallback 제거와 build dependency 제거를
  한 배포에 합치지 않는다.
- production deploy는 계속 main branch CI를 사용하며 ad hoc `wrangler deploy`는
  실행하지 않는다.

## References

- [Cloudflare Workers platform limits](https://developers.cloudflare.com/workers/platform/limits/)
- [OpenNext Cloudflare troubleshooting](https://opennext.js.org/cloudflare/troubleshooting)
- [OpenNext Runtime Exit Plan](./OPENNEXT_EXIT_PLAN.md)
