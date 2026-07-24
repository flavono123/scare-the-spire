# Cloudflare Worker Bundle Size Reduction Plan

## Status

2026-07-22 Phase 1-4의 local 구현과 기능 보존 QA를 완료했다. 최신 검증
artifact의 메인 Worker gzip 업로드 크기는 1,823.88 KiB로, Cloudflare Workers
Free의 3 MiB(3,072 KiB) 한도까지 1,248.12 KiB 여유가 있다. 같은 작업의
Phase 1 Turbopack 기준선은 3,180.71 KiB로 한도를 108.71 KiB 초과했다.

production push/deploy와 Phase 4.1은 실행하지 않았다. 이후 구조 변경은 별도
요청을 받아
[OpenNext Runtime Exit Plan](./OPENNEXT_EXIT_PLAN.md)에 따라 요청 경로에서
OpenNext를 제거한다.

이 문서는 단기적인 번들 여유 확보 계획이다. 최종 목표 아키텍처와 정적
라우팅 전환은 OpenNext exit 문서를 따른다.

## 2026-07-22 실행 기록

### Phase 1 기준선

- source HEAD: `fbdc4a4b64d2e1f2213dd64b7d9cb9b49c410f66`
- dirty 입력: `public/generated/sts2-patch-lines.json` 1,231,698 B,
  SHA-256 `0fe6142cc5fd8c3086d0c0216111df2ba5f6a5e5342a26b0729dfcce7c91e6f0`
- build 환경: Node 25.8.0, pnpm 10.21.0, Next.js 16.2.6,
  `@opennextjs/cloudflare` 1.19.11, Wrangler 4.100.0, macOS arm64
- `.env.local` SHA-256:
  `bcd19f28ed1d74a9c5e16c46f8bb5bcf20ed37861507b2ca6fc76331c2f6e9d8`.
  공개 build 입력은 `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_ENV`이며 원문 값은
  기록하지 않았다.
- 기본 Turbopack `pnpm cf:build` 성공. build 전후 dirty 입력과 환경 파일의
  SHA-256은 동일했다.
- handler: raw 15,448,643 B, gzip-9 3,133,393 B, metafile input 833개
- filesystem asset: 12,669개, 최대 10.82 MiB
  (`fonts/GyeonggiCheonnyeonBatangBold.ttf`)
- Wrangler upload asset: 12,983개
- Wrangler upload: raw 16,635.14 KiB, gzip 3,180.71 KiB. Free 3 MiB 한도를
  108.71 KiB 초과해 예상대로 `pnpm cf:size`가 실패했다.

Phase 2의 제어된 A/B는 helper 이동이 끝난 한 source snapshot에서 같은
`.env.local`, generated data bytes, 고정 `NEXT_BUILD_ID`, OpenNext standalone
환경을 사용해 다시 측정한다. 이 Phase 1 값은 현재 초과 상태의 재현
기준선이며 A/B 완료 판정값은 아니다.

### Phase 2 route export 정리와 제어된 A/B

- A/B source HEAD: `636ab5afa5852d7e4012861cbcc01c28c4d058e4`
- 12개 base route의 사용자 정의 export 23개를 route별 인접
  `page-content.tsx`로 이동했다. base와 locale route entry에는 Next.js 허용
  export만 남겼다.
- History Course run의 `force-dynamic`과 base/locale Bestiary의
  `force-static`은 route entry에 유지했다.
- generated data: 65개, 31,131,064 B, aggregate SHA-256
  `aae7a7126fa2a2ce287e8eb908072f43c498eccbe2f45ddbbde223241c15e2cb`
- 두 빌드 모두 `.env.local` SHA-256과 dirty 입력 SHA-256이 Phase 1 기록과
  같았고, `NEXT_BUILD_ID=cf-phase2-ab-636ab5af` 및 동일한 OpenNext standalone
  환경을 사용했다.
- 두 `next build` 모두 4,364개 정적 페이지를 생성했고 route의
  Static/SSG/Dynamic 분류가 일치했다. Webpack은 검증 우회 없이 성공했다.
- 각 `.next`에 같은 trace 후처리를 적용한 뒤 `opennextjs-cloudflare build
  --skipNextBuild`, 정적 페이지 복사, `pnpm cf:assets`, `pnpm cf:size`를
  순서대로 실행했다.

| 항목 | Turbopack | Webpack | 차이 |
| --- | ---: | ---: | ---: |
| Wrangler gzip upload | 3,180.68 KiB | 1,823.76 KiB | -1,356.92 KiB (-42.7%) |
| 3 MiB 한도까지 여유 | -108.68 KiB | 1,248.24 KiB | +1,356.92 KiB |
| Wrangler raw upload | 16,634.91 KiB | 14,908.27 KiB | -1,726.64 KiB |
| handler raw | 15,448,594 B | 13,586,762 B | -1,861,832 B |
| handler gzip-9 | 3,133,601 B | 1,765,982 B | -1,367,619 B |
| handler metafile inputs | 833 | 485 | -348 |
| filesystem assets | 12,669 | 12,767 | +98 |
| Wrangler upload assets | 12,983 | 13,190 | +207 |
| copied static page assets | 8,026 | 8,026 | 0 |
| largest asset | 10.82 MiB | 10.82 MiB | 0 |

Webpack artifact의 Wrangler minify에서 `options` 중복 object-key 경고 6건이
발생했다. 이는 `@floating-ui/react-dom` 2.1.7이 core middleware object를
spread한 뒤 React dependency 비교용 `[options, deps]` tuple로 `options`를
의도적으로 덮어쓰는 코드가 Webpack에서 인라인된 결과다. 마지막 key가 원본
wrapper와 같은 값을 유지하므로 구조상 의미 변화는 없으며, Phase 4 browser
QA에서 Popper focus, keyboard, tab 동작을 확인한다.

### Phase 3 Webpack 기본값 전환

- build script 전환 commit: `f804f49c5a3ab8117dcaee2b0a171544f67fb7d1`
- `package.json`의 `build`가 `next build --webpack`을 사용하도록 변경했다.
- 별도 bundler 인자나 수동 패키징 없이 표준 `pnpm cf:build`가 Webpack
  Next.js build, trace 후처리, OpenNext bundle, 정적 페이지 복사와 asset
  검사를 모두 성공했다.
- handler: raw 13,586,709 B, gzip-9 1,765,875 B, metafile input 485개
- filesystem asset 12,767개, Wrangler upload asset 13,190개, 최대 asset
  10.82 MiB, copied static page asset 8,026개
- Wrangler upload: raw 14,908.30 KiB, gzip 1,823.68 KiB. Free 3 MiB 한도까지
  1,248.32 KiB 여유가 있어 `pnpm cf:size`가 성공했다.
- build 전후 `.env.local`과 dirty 입력 SHA-256은 Phase 1 기록과 동일했다.
- Wrangler의 `options` 중복 key warning 6건은 Phase 2와 같은
  `@floating-ui/react-dom` source pattern에서 발생했다. 새 warning은 없었다.

### Phase 4 기능 보존 QA

- main artifact build source commit은
  `d4808f8a367aee196611dafd9084ab3908306479`, 최종 QA harness commit은
  `b48e7c9139ec4e55dbd1481e5b60dc695e49bc26`이다. 실제 Cloudflare 검증을
  기본값으로 만든 후속 commit은 `b6f5c8b3`, `7cabead6`, `88a9d25c`,
  `f8a055c1`이며, 격리 환경·검증 실행기·크기 검사만 바꾸고 애플리케이션
  route 동작은 바꾸지 않는다.
- `pnpm i18n:validate`는 game localization 644개와 borrowed phrase fixture
  5개를 검증했고, `pnpm lint`와 `pnpm patch:test`가 성공했다.
- 실제 Cloudflare의 격리된 `phase4` main/patch Worker와 service binding에서
  route smoke 53개가 모두 성공했다. 한국어·영어·중국어 home/index/detail의 document/RSC,
  Chemical X·Combo·History Course·This or That의 유효 상세와 invalid nested
  404 document/RSC, 정적 검색/Compendium data, patch index/상세/변경 이력과
  patch asset을 포함한다.
- Playwright 8개가 모두 성공했다. locale ownership, redirect와 public
  canonical, 동적 상세 direct refresh, client navigation, 공통 Supabase
  unavailable UI, IndexedDB-only History Course run, 모바일 overflow와 36 px
  hit target, 두 검색 UI의 focus·Tab·Shift+Tab·Escape 상태를 확인했다.
- local preview request origin과 public canonical origin을 분리하도록 QA
  assertion을 고쳤고, prefixless 한국어 기대값과 브라우저 자동 locale 감지의
  경쟁을 없애기 위해 Phase 4 browser locale을 `ko-KR`로 고정했다.
- 마지막 `pnpm cf:size`는 raw 14,908.30 KiB, gzip 1,823.49 KiB로 성공했다.
  handler는 raw 13,586,762 B, gzip-9 1,765,970 B, metafile input 485개다.
  filesystem asset은 12,767개, Wrangler upload asset은 13,190개, copied static
  page asset은 8,026개이며 최대 asset은 11,346,484 B(10.82 MiB)
  `fonts/GyeonggiCheonnyeonBatangBold.ttf`다. OpenNext가 upload 직전에 Workers
  cache asset을 채운 뒤 실제 Cloudflare manifest는 17,636개였고, patch
  Worker manifest는 1,300개였다.
- build/QA 뒤에도 unrelated dirty 입력
  `public/generated/sts2-patch-lines.json`은 1,231,698 B, SHA-256
  `0fe6142cc5fd8c3086d0c0216111df2ba5f6a5e5342a26b0729dfcce7c91e6f0`,
  `.env.local`은 SHA-256
  `bcd19f28ed1d74a9c5e16c46f8bb5bcf20ed37861507b2ca6fc76331c2f6e9d8`로
  유지됐다.

남은 메시지는 기능 실패로 판정하지 않았다. Wrangler minify의 `options` 중복
key warning 6건은 그대로이며 위 focus/keyboard/Tab QA가 통과했다. Wrangler
4.100.0과 4.113.0의 local `dev`는 전체 asset scan에서 macOS `spawn EBADF`로
종료되지만, 이 로컬 제약을 더 이상 Phase 4 완료 근거로 사용하지 않는다.

실제 원격 검증에서 먼저 production main 서비스에 전체 17,636개 manifest를
업로드한 version `503b7642-a3cd-4dea-a312-dbc379e4b66e`를 실행했다. main route
51개는 통과했지만 binding이 이미 배포된 구버전 production patch Worker를
가리켜 `/patches/changes` 한·영 2개가 404였다. 이를 해결하기 위해 Wrangler
`phase4` 환경을 main/patch 양쪽에 만들고 `scare-the-spire-phase4`가
`scare-the-spire-patches-phase4`를 binding하도록 분리했다. 마지막 자동 실행의
patch version은 `36cbf377-4a9f-436e-960f-ab349a3a4bc4`, main version은
`23a9c72a-74b5-4e4e-aacf-b11d27219d20`이며,
`https://scare-the-spire-phase4.flavono123.workers.dev`에서 53개 route와 8개
Playwright가 모두 성공했다. production Worker version, custom domain, route,
traffic은 변경하지 않았다.

## Phase 1-4 실행 계약

이 문서를 지정해 Phase 4까지 진행하라는 작업은 별도 기획 없이 아래 범위를
즉시 실행하라는 뜻이다.

- Phase 1부터 Phase 4까지 순서대로 구현하고 검증한다.
- Phase 4.1 production 배포, push, Phase 5 안전 예산, OpenNext exit, 기능
  완성 작업은 명시적으로 추가 요청받지 않는 한 수행하지 않는다.
- 기존 branch와 worktree를 유지한다. unrelated 변경을 reset, checkout, stash,
  삭제하거나 작업 커밋에 섞지 않는다. 계획 대상 파일과 겹치지 않는 dirty
  파일은 시작 시 경로와 hash를 기록하고 두 비교 빌드에서 같은 bytes로
  유지할 수 있다. 계획 대상 파일과 겹치거나 빌드가 dirty 파일을 변경하면
  임의로 해결하지 말고 blocker로 보고한다.
- 모든 의미 있는 수정 직후 해당 수정만 stage하여 speculative commit을 만든다.
- UI, 데이터, route URL, metadata, locale, Supabase/IndexedDB 흐름을 기능적으로
  바꾸지 않는다. 이번 작업은 route helper 위치와 build bundler만 바꾼다.
- 문서의 기존 크기 숫자를 재현 목표로 삼지 않는다. Phase 1에서 고정한 현재
  source snapshot과 Phase 2 완료 snapshot의 제어된 A/B 측정이 SSOT다.
- Phase 4 검증과 최종 크기 기록까지 마친 뒤 멈추고, production 상태는
  변경하지 않는다.

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

## 역사적 기준 측정

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
강하지만, 실제 전환 전에는 Phase 2가 끝난 같은 source snapshot에서 두 빌드를
다시 비교한다.

## 범위와 비범위

이 계획은 다음 기능을 그대로 유지한다.

- 한국어, 영어, game-only locale의 문서 및 RSC 탐색
- Compendium 목록과 상세, hover preview, 검색
- Chemical X, Combo(코오오옴보), History Course, This or That의 index와 동적
  ID 상세
- Supabase 저장소 사용 가능/불가 상태와 IndexedDB-only 흐름
- locale redirect, not-found, canonical metadata
- `/patches*` 및 `/_patches*`의 patch Worker service binding
- development-only `/patches/changes` 변경 이력 index와
  `/generated/sts2-resource-patch-index.json` 정적 데이터. production patch
  build는 변경 이력 탭, route HTML, 전용 client bundle을 생성하지 않는다.

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

### Phase 1: 현재 source snapshot 기준선 고정

1. 현재 commit SHA, `git status --short`, 공개 build 환경, dirty 파일 hash를
   기록해 재현 가능한 source snapshot을 고정한다.
2. 계획 대상과 겹치지 않는 unrelated dirty 파일은 그대로 보존한다. build가
   해당 파일을 변경하지 않는지 전후 hash로 확인한다.
3. 현재 기본 Turbopack 경로로 `pnpm cf:build`와 `pnpm cf:size`를 실행한다.
4. gzip 업로드 크기, handler raw/gzip 크기, metafile input 수, filesystem 및
   Wrangler upload asset 수, 최대 asset을 기록한다.
5. 이후 비교 빌드에도 같은 공개 환경 변수와 생성 데이터 bytes를 사용한다.

완료 조건: Phase 2 이후 같은 source snapshot에서 Turbopack과 Webpack을
코드·데이터 차이 없이 비교할 수 있는 입력과 초기 기준선이 기록되어 있다.

### Phase 2: Webpack 정식 빌드가 통과하도록 route export 정리

1. 위 route entry의 사용자 정의 helper를 인접한 공유 모듈로 이동한다.
2. locale wrapper와 route entry가 같은 공유 모듈을 import하게 한다.
3. 임시 `compile`/`generate` 분리나 export 검증 무시는 사용하지 않는다.
4. 일반 `next build --webpack`이 성공해야 한다.
5. helper 이동이 끝난 같은 source snapshot에서 제어된 A/B를 다시 수행한다.
   tracked 파일을 임시 수정하지 말고, Turbopack과 `next build --webpack`으로
   각각 `.next`를 생성한 뒤 `opennextjs-cloudflare build --skipNextBuild`로
   패키징한다. 각 패키징 뒤 `scripts/copy-cf-static-pages.mjs`, `pnpm
   cf:assets`, `pnpm cf:size`를 실행하고 다음 빌드 전에 결과를 기록한다.
6. 두 A/B 빌드에서 공개 환경 변수, generated data, commit SHA와 unrelated dirty
   파일 hash가 같아야 한다.

완료 조건: route 동작과 metadata 결과가 동일하고 표준 Webpack 빌드가
우회 옵션 없이 통과하며, 같은 source snapshot의 제어된 크기 비교가 기록되어
있다.

### Phase 3: Cloudflare 빌드 기본값 전환

1. `package.json`의 `build`를 `next build --webpack`으로 변경한다.
2. OpenNext가 프로젝트의 build script를 통해 Webpack 결과를 사용하게 한다.
3. `pnpm cf:build`와 `pnpm cf:size`로 실제 Wrangler upload를 다시 측정한다.
4. 빌드 중 발견된 `options` 중복 object-key 경고가 런타임 동작에 영향을 주는지
   확인한다. 경고는 floating-ui/Radix 계열 생성 코드에서 관찰되었다.

완료 조건: 동일 커밋에서 gzip 크기가 안전 예산 아래이며 OpenNext artifact가
정상 생성된다.

### Phase 4: 기능 보존 QA

Phase 4의 권위 있는 production-shaped 검증은 `pnpm cf:phase4`다. 이 명령은
main/patch artifact를 빌드하고 크기·patch 회귀를 검사한 뒤, production과
분리된 Cloudflare `phase4` Worker 둘을 갱신한다. main의 실제 service binding,
전체 asset 전파 준비를 확인하고 route smoke와 Playwright browser QA를
실행한다. 이미 빌드한 artifact를 재사용할 때만 `pnpm cf:phase4 -- --skip-build`를
사용한다. 로컬 Miniflare 경로가 필요한 환경에는 `pnpm cf:phase4:local`을
별도로 남긴다. 다음 순서로 최종 검증한다.

```bash
pnpm i18n:validate
pnpm lint
pnpm cf:phase4
```

`pnpm cf:phase4` 내부의 `pnpm cf:size`는 배포할 정확한 main artifact를
검사한다. 다음을 문서 요청과 RSC 요청으로 모두 검증한다.

- prefixless Korean, `/en`, game-only locale 각각의 home, index, detail
- Chemical X, Combo, History Course, This or That의 유효/무효 동적 ID
- Supabase unavailable 공통 UI와 IndexedDB-only History Course run
- redirect, canonical metadata, direct refresh, client navigation, static 404
- patch Worker binding, 공개 `/patches/changes` 탐색기, pending Compendium
  link의 fail-closed 동작
- 모바일 viewport의 icon/button hit target 및 주요 상호작용

완료 조건: Turbopack 기준과 기능 차이가 없고 build warning으로 인한 포커스,
키보드, tab 상태 회귀가 없으며, `pnpm cf:phase4`, `pnpm patch:test`, 최종
`pnpm cf:size`가 같은 passing artifact에서 성공한다. 결과에는 commit SHA,
Webpack gzip 크기, asset 수/최대 크기, 성공한 route/browser 범위와 남은
warning을 기록한다. 격리된 `phase4` Worker 외의 Phase 4.1 production 배포를
실행하거나 push하지 않고 여기서 멈춘다.

#### Phase 4 이후 기능 작업에 넘길 불변식

- `package.json`의 `next build --webpack` 기본값을 유지한다.
- Phase 2에서 공유 모듈로 옮긴 helper를 `page.tsx`의 비표준 export로 되돌리지
  않는다.
- Combo는 `/c-c-c-combo` locale URL과 metadata를 유지하고, `/c-c-c-combo/[id]` record를
  브라우저에서 Supabase로 읽는다. Worker 요청 시 Supabase 조회, 전체 리소스
  join, 대형 JSON 파싱을 추가하지 않는다.
- 변경 이력 explorer와 이를 포함한 patch 탭은 공개 정적 patch Worker
  표면이다. production patch build가 `/patches/changes` HTML과 전용 client
  bundle을 생성하며, 리소스 상세의 patch 이력 rail이 읽는
  `/generated/sts2-resource-patch-index.json`도 계속 build-time에 생성한다.
- 공개 `/patches*`는 계속 별도 정적 patch Worker가 소유하며 main OpenNext
  runtime으로 옮기지 않는다.
- pending Compendium 링크는 deployed manifest에 없으면 hover-only preview로
  fail closed한다. main과 patch를 함께 바꾸는 후속 배포는 patch -> main ->
  patch 순서를 유지한다.
- 이후 기능 작업은 OpenNext exit이 완료됐다고 가정하지 않는다. 정적 detail
  shell, Worker rewrite, OpenNext fallback 제거는 별도 계획에서만 수행한다.
- main build/shared payload에 영향을 주는 후속 변경은 `pnpm cf:build`와 `pnpm
  cf:size`를, patch Worker 변경은 `pnpm patch:build`와 `pnpm patch:test`를 다시
  검증한다.

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
  `/en/patches/changes`의 404 및 patch index의 변경 이력 탭 부재**,
  `/_patches/patch.css`,
  `/generated/sts2-resource-patch-index.json`을 같은 production origin에서
  확인한다.
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
- Web Analytics에서 smoke 이외의 실제 `/combo` 또는 `/patches`
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

[OpenNext Runtime Exit Plan](./OPENNEXT_EXIT_PLAN.md)의 Phase 1 잔여 작업과
Phase 2~6을 수행한다. 특히 정적 dynamic-ID shell, game-only locale shell,
explicit static 404가 모든 공개 route를 덮은 후 `openNextWorker.fetch`
fallback과 OpenNext build dependency를 순서대로 제거한다.

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
