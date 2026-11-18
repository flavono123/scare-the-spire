# STS1 백과사전 상세 페이지를 별도 Worker로 서비스하기

*   **Author:** flavono123
*   **Status:** Approved (개요·목표, 기술 계획은 작성자 승인. 대안과 구현 계획은 작성자 지시로 자가 승인, 2026-11-13)
*   **Date:** 2026-11-13

--------------------------------------------------------------------------------

## Overview

STS1 백과사전 상세 페이지(ko·en)를 새 Cloudflare Worker `scare-the-spire-sts1`에서 다시 서비스한다.
상세 HTML·RSC는 main과 같은 `next build`가 이미 만들고 있으므로, 새로 그리는 것은 없고 새 Worker의 애셋으로 복사한다.
다만 빌드의 정리 단계가 STS1 상세가 쓰는 `_next/static` 파일을 main에서 지우지 않게 해야 한다(기술 계획 3).
main Worker는 STS1 상세 요청을 서비스 바인딩으로 이 Worker에 넘긴다.
그리고 8cd3f7eb가 넣은 임시 조치(상세 주소를 목록 모달로 308, 링크·사이트맵·검사 변경)를 되돌린다.

## The Problem

main Worker는 Workers Free라서 버전당 정적 파일이 20,000개까지이고, 자체 예산은 19,500개다.
v0.113.0 백필을 넣을 자리를 만들려고 8cd3f7eb가 STS1 상세 페이지 3,817개를 main에서 내렸다.
지금 main은 16,071개다. 상세를 main에 되돌리면 약 19,888개가 되어 예산을 넘는다.

상세를 내린 뒤로 사용자에게 이런 일이 생겼다.

- STS1 항목마다 있던 고유 주소가 없어졌다. `https://scare-the-spire.flavono123.workers.dev/compendium/sts1/cards/strike-r`처럼
  공유되거나 검색에 걸린 주소는 308로 목록(`?card=strike-r`)에 가서 모달로 열린다.
- 사이트맵에서 STS1 상세 약 1,900개 주소(ko·en)가 빠졌다. 상세 단위의 검색 노출과 링크 미리보기(항목 제목·그림)가 없다.
- 댓글 링크와 목록 타일의 href도 목록 모달 주소를 가리킨다.
- 상세 페이지는 지금도 빌드는 되지만, 그 canonical이 목록 모달 주소를 가리킨다(`sts1DetailPath()`를 쓰기 때문).
- 8cd3f7eb 뒤로 `cf:smoke`의 `/cards/bash` 두 케이스(200·`legacy`를 기대)가 운영 응답(308)과 맞지 않는다.

**지켜야 할 조건**

- 무료 한도 안에서 한다. 새 Worker도 버전당 20,000개를 넘지 않고, 하루 Worker 요청 100,000에 부담을 더하지 않는다.
  하루 요청은 2026-11-12에 39,342였다.
- 라우팅·Worker·배포를 바꾸는 큰 작업이라 worktree(`.claude/worktrees/sts1-worker`, `refactor/sts1-worker`)에서 한다.
  같은 체크아웃의 `main`에서는 다른 세션이 작업 중이다.
- `workers/main-worker.ts`와 `wrangler.jsonc`는 `docs/SUPABASE_EXIT_PARALLEL_WORK.md` 2항이 피하라고 한 파일이다.
  지금 `refactor/supabase-exit`는 merge-base 이후 이 두 파일을 바꾸지 않았다. 문서대로 병합 전에 이관과 순서를 맞출지 묻는다.
- 운영 배포와 운영 Cloudflare 리소스 생성은 사용자 승인 뒤에 한다. testbed QA는 `pnpm cf:testbed -- --remote` 절차로 하고,
  브라우저 QA는 Supabase를 막고 한다.

## Goals

1.  ko·en STS1 상세 주소(6종: cards, characters, monsters, potions, powers, relics)가 상세 페이지를 200으로 돌려준다.
    문서 요청은 `text/html`, RSC 요청은 `text/x-component`로 답하고, `x-cf-static-page`는 8cd3f7eb 전과 같은 `compendium`이다.
2.  옛 별칭 `/cards/<slug>`는 8cd3f7eb 전처럼 그 주소에서 상세를 200으로 돌려준다(`x-cf-static-page: legacy`).
3.  게임 전용 로케일(ja 등 12개)은 지금 동작 그대로다. 목록은 200이고, 상세 문서 요청은 목록 모달로 308이다.
4.  링크가 다시 상세를 가리킨다. 대상은 `sts1DetailPath()`, 목록 타일 href, 댓글 링크(`/compendium/sts1/<type>/<slug>#comments`),
    상세의 canonical·OG url이다. 사이트맵에도 ko·en 상세가 다시 들어간다.
5.  main 정적 파일에 STS1 상세는 0개다. main은 STS1 상세만 쓰는 `_next/static` 파일만큼만 는다(로컬 빌드 기준 17개).
    STS1 Worker의 정적 파일은 19,500개 아래다(STS1 상세 약 3,817개 + `_next/static` 전체, 로컬 빌드 399개 = 약 4,200개).
6.  main과 STS1 Worker가 같은 빌드면, STS1 상세와 다른 페이지 사이를 새로고침 없이 이동한다(RSC 요청이 200 `text/x-component`).
7.  두 Worker의 빌드가 어긋난 동안에도 STS1 상세 문서가 CSS·JS 404 없이 뜬다.
    어긋나는 경우는 두 배포 사이, 한쪽 배포 실패, 한쪽만 롤백이다. 이때 다른 페이지로 가는 이동은 새로고침이 되어도 된다.
8.  하루 Worker 요청 수가 이 작업으로 늘지 않는다. STS1 상세 한 번에 main 호출은 1번이고, 바인딩 호출은 세지 않는다.
9.  CI는 main을 배포하는 모든 실행에서 같은 빌드로 STS1 Worker를 배포하고 스모크한다.
    `cf:assets`의 두 검사(`check-cloudflare-static-assets`, `check-cloudflare-route-coverage`)와 `cf:smoke`가 새 구성을 검증한다.

## Non-Goals

*   **STS1 이미지(약 2,500개) 옮기기:** 옮긴 이미지 요청은 main 애셋에 없으므로 매번 main 스크립트를 부른다.
    그러면 하루 요청 한도를 쓰게 된다. 이 작업 뒤에도 main은 예산까지 약 3,400개가 남는다.
*   **게임 전용 로케일의 STS1 상세 페이지:** 지금처럼 목록 모달을 쓴다.
*   **커스텀 도메인에서 경로별로 Worker에 직접 보내기:** 도메인이 아직 없다.
    도메인을 붙일 때 `docs/CLOUDFLARE_CUSTOM_DOMAIN_ROUTING.md`의 목표 형태에 STS1 경로를 더한다.
*   **patch Worker의 이동 지연 고치기:** 원인이 다르다(RSC가 없는 별도 빌드).
*   **STS1 상세의 내용·디자인 변경, Workers Paid 전환.**

## Open Questions

없음. 초안에서 열려 있던 질문은 이렇게 정했다.

*   **배포 순서:** 바인딩 대상 Worker가 없으면 main 배포가 실패한다(Cloudflare 문서). 그래서 STS1 Worker를 먼저 배포한다.
*   **testbed:** testbed에도 STS1 Worker(`scare-the-spire-sts1-testbed`)와 바인딩을 둔다.
    기술 계획 승인 때는 "testbed에는 바인딩 없음"이었지만, 사용자가 2026-11-13에 testbed QA 전부를 요청해서 바꿨다.
    testbed QA가 이 기능을 확인하려면 testbed에도 STS1 Worker가 있어야 한다.
*   **빌드가 어긋날 때 막는 장치:** 작성자가 `_next/static` 대체 경로를 골랐다(2026-11-13).

## Critical User Journeys (CUJs)

### CUJ 1: 공유·검색 주소로 STS1 상세에 바로 들어온다

*   **Given**: 운영에 main과 STS1 Worker가 같은 빌드로 배포되어 있다.
*   **When**: 브라우저가 `https://scare-the-spire.flavono123.workers.dev/compendium/sts1/cards/strike-r`를 연다.
*   **Then**: 308 없이 200 상세 페이지가 뜬다. 응답 헤더는 `x-cf-static-page: compendium`이고, canonical은 상세 주소이며, 아래에 댓글 영역이 있다.

### CUJ 2: 영어 상세와 옛 별칭

*   **Given**: CUJ 1과 같다.
*   **When**: `https://scare-the-spire.flavono123.workers.dev/en/compendium/sts1/relics/burning-blood`와
    `https://scare-the-spire.flavono123.workers.dev/cards/bash`를 연다.
*   **Then**: 둘 다 200 상세다. 앞의 것은 `compendium`, 뒤의 것은 `legacy`로 응답한다.

### CUJ 3: 새로고침 없는 이동

*   **Given**: CUJ 1과 같다.
*   **When**: STS1 캐릭터 상세 `https://scare-the-spire.flavono123.workers.dev/compendium/sts1/characters/ironclad`에서 카드 링크를 누른다.
    또는 이야기·댓글의 STS1 댓글 링크를 누른다.
*   **Then**: 문서를 새로 받지 않는다. RSC 요청 한 번(200 `text/x-component`)으로 카드 상세로 이동하고, 댓글 링크는 `#comments`로 내려간다.

### CUJ 4: 게임 전용 로케일은 그대로

*   **Given**: CUJ 1과 같다.
*   **When**: `https://scare-the-spire.flavono123.workers.dev/ja/compendium/sts1/cards`와 `/ja/compendium/sts1/cards/strike-r`를 연다.
*   **Then**: 목록은 지금처럼 200이다. 상세는 지금처럼 `/ja/compendium/sts1/cards?card=strike-r`로 308이고, 모달이 열린다.

### CUJ 5: 빌드가 어긋난 동안의 상세

*   **Given**: main은 새 빌드로 배포됐고, STS1 Worker는 아직 이전 빌드다(배포 사이, 또는 STS1 배포 실패).
*   **When**: `https://scare-the-spire.flavono123.workers.dev/compendium/sts1/cards/strike-r`를 연다.
*   **Then**: 페이지가 스타일과 동작을 갖춘 채 뜬다(이 페이지의 `/_next/static` CSS·JS 요청이 모두 200).
    여기서 다른 페이지로 가는 이동은 새로고침이 되어도 된다.

## Technical Plan (Architecture)

### 요청 흐름

STS1 상세 요청(문서, 또는 `RSC: 1`):

```text
브라우저  GET /compendium/sts1/cards/strike-r
  │
  ▼
main Worker (scare-the-spire)
  │ 1. 애셋 레이어: 주소와 같은 애셋이 없다 → 스크립트 실행 (지금과 같음, main 호출 1번)
  │ 2. routeRequest
  │    ├─ 게임 전용 로케일, 또는 STS1_WORKER 바인딩이 없는 설정
  │    │     → 308 목록 모달 (지금 동작)
  │    └─ ko·en 상세, 옛 별칭 /cards/<slug>
  │          staticCompendiumAssetPath / staticLegacyPageAssetPath (8cd3f7eb 전부터 있는 경로 계산)
  │          → /_cf_static_pages/{,en/}compendium/sts1/<type>/<slug>.{html,rsc}
  │          → fetchStaticPageAsset: STS1 상세 경로면 STS1_WORKER, 아니면 ASSETS
  │            (Cache-Control, Vary, x-cf-static-page, Content-Type는 지금 코드가 그대로 붙인다)
  ▼ 서비스 바인딩 (같은 서버의 같은 스레드, 요청 수에 들어가지 않음)
STS1 Worker (scare-the-spire-sts1, 공개 주소 없음)
  └─ env.ASSETS.fetch(request) → .sts1-worker/assets/
       ├─ _cf_static_pages/{,en/}compendium/sts1/<type>/<slug>.{html,rsc}   약 3,817
       └─ _next/static/**   같은 빌드의 정리 전 전체 (로컬 빌드 399)
```

`/_next/static` 요청:

```text
브라우저  GET /_next/static/chunks/<name>-<hash>.js
  ├─ main 애셋에 있음 → 애셋 레이어가 바로 응답 (스크립트 안 돎, 요청 수 0)   ← 같은 빌드면 항상 여기
  └─ main 애셋에 없음 → main 스크립트 → STS1_WORKER에 같은 경로를 묻는다
                          200 → Cache-Control: public, max-age=31536000, immutable 로 응답
                          404 → 지금처럼 not-found로 이어간다
```

### 구성 요소

1.  **STS1 Worker(새로 만듦).** `wrangler.sts1.jsonc`와 `workers/sts1-worker.ts`로 만든다. 스크립트는 받은 요청을 `ASSETS`로 넘기기만 한다.
    *   애셋 설정은 `html_handling: "none"`, `not_found_handling: "none"`이다. main이 정확한 파일 경로로 묻기 때문에 리다이렉트를 따라갈 일이 없다.
    *   `workers_dev: false`, `preview_urls: false`로 공개 주소를 만들지 않는다(testbed 환경도 같다). 그러면 같은 페이지가 다른 호스트에 생기지 않고,
        main의 보안 헤더(`withSecurityHeaders`)를 거치지 않고 들어오는 길도 없다. 그래서 STS1 Worker는 보안 헤더를 따로 붙이지 않는다.
2.  **main Worker.**
    *   `wrangler.jsonc`의 `services`에 `STS1_WORKER`를 넣는다. 운영은 `scare-the-spire-sts1`, testbed 환경은 `scare-the-spire-sts1-testbed`다.
        `services`는 환경마다 따로 적는 값이라 상위 설정을 물려받지 않으므로 두 곳에 다 적는다.
    *   `fetchStaticPageAsset`은 애셋 경로가 STS1 상세(`/_cf_static_pages/(en/)?compendium/sts1/<type>/<slug>.(html|rsc)`)면 `STS1_WORKER`에서 읽는다.
        리다이렉트를 따라갈 때도 같은 바인딩을 쓴다. 이 함수 하나만 바꾸면 상세 문서·RSC, 옛 별칭, 405 판정(`staticPageExists`)이 모두 같은 길을 쓴다.
    *   `maybeRedirectLegacyCompendiumDetail`은 STS1 상세 308을 두 경우에만 보낸다. (1) 게임 전용 로케일일 때, (2) `STS1_WORKER`가 없을 때.
        `getSts1DetailRedirectPath()`는 그대로 두고, 부르는 조건만 바꾼다.
    *   `/_next/static/*` 대체 경로를 더한다(위 그림).
3.  **빌드(`pnpm cf:build`).**
    *   `copy-cf-static-pages.mjs`는 ko·en STS1 상세 HTML·RSC를 `.sts1-worker/assets/_cf_static_pages/`에 쓴다.
        8cd3f7eb가 지운 `isSts1Detail` 판정을 되살리고 출력 위치만 바꾼다. RSC의 이미지 hint 행을 지우는 규칙은 지금 그대로 쓴다.
        이어서 `.cloudflare/assets/_next/static`을 `.sts1-worker/assets/_next/static`으로 복사한다. 이 시점은 정리 전이라 전체 집합이 복사된다.
    *   `prune-cf-unreferenced-assets.mjs`는 `_next/static` 도달 시작점과 제외 파일 참조 검사에 `.sts1-worker/assets`의 페이지도 넣는다.
        **이 변경이 빠지면 안 된다.** 로컬 빌드로 세어 보니 STS1 상세가 쓰는 `_next/static` 146개 중 17개
        (예: `chunks/app/(codex)/compendium/sts1/cards/[id]/page-*.js`)가 지금 main에서 지워져 있다.
        8cd3f7eb 뒤로 그 파일을 쓰는 페이지가 main에 없어서 정리 단계가 지운 것이다.
        이대로 두면 같은 빌드에서도 STS1 상세가 그 chunk를 매번 대체 경로로 받는다. 첫 방문마다 main 호출이 최대 17번 생긴다.
        시작점에 넣으면 main 파일이 17개 늘고, 대체 경로는 빌드가 어긋날 때만 쓰인다.
        참고로 STS1 상세가 업로드에서 뺀 public 파일을 가리키는 곳은 없다(제외 452개 중 0개).
    *   검사 `check-cloudflare-static-assets.ts`는 네 가지를 본다.
        (1) ko·en STS1 상세가 STS1 Worker 디렉터리에 빠짐없이 있는가, (2) main에는 하나도 없는가,
        (3) STS1 Worker 파일 수가 예산 19,500 아래인가, (4) STS1 상세가 가리키는 `_next/static`이 main에 모두 있는가.
    *   검사 `check-cloudflare-route-coverage.ts`는 `.sts1-worker/assets`를 읽는 가짜 `STS1_WORKER`를 넣는다.
        그리고 ko·en STS1 상세가 200 정적 페이지로 나오는지, main에 없는 `_next/static`이 대체 경로로 나오는지 확인한다.
4.  **링크 원복.** `sts1DetailPath()`가 다시 상세 경로를 돌려준다. 그러면 목록 타일 href, 댓글 링크, 상세 canonical·OG url이 함께 돌아온다.
    사이트맵에도 ko·en 상세를 다시 넣는다. 게임 전용 로케일의 목록 모달은 그대로다(클라이언트의 `getGameOnlyCompendiumDetailFallbackHref`와 Worker의 308).
5.  **CI(`.github/workflows/cloudflare-workers.yml`).**
    *   main을 빌드하는 실행이면 `cf:size` 다음, main 배포 앞에서 STS1 Worker를 배포한다. main 배포처럼 3번까지 다시 시도한다.
        바인딩 대상이 먼저 있어야 하므로 이 순서다. 첫 배포가 운영에 STS1 Worker를 만든다.
    *   배포 범위 판정에서 `wrangler.sts1.jsonc`를 main 쪽으로 분류한다. `workers/sts1-worker.ts`는 이미 `workers/*` 규칙에 걸린다.
    *   main 스모크에 `smoke_static_detail`로 ko·en STS1 상세를 더한다(`x-cf-static-page: compendium`, 문서·RSC).
6.  **testbed(`scripts/run-cloudflare-testbed.mjs`).** 원격은 patch Worker 다음, main 앞에 STS1 testbed Worker를 배포한다.
    로컬은 STS1 Worker도 `wrangler dev`로 띄워 main의 바인딩이 닿게 한다.

### 빌드가 어긋날 때

| 상태 | STS1 상세 문서 | 그 페이지의 CSS·JS | STS1 상세와 다른 페이지 사이 이동 |
|---|---|---|---|
| 같은 빌드(평소) | STS1 Worker | main 애셋(스크립트 안 돎) | 새로고침 없음 |
| STS1만 새 빌드(main 배포 중, main 배포 실패) | 새 빌드 | 바뀐 파일은 대체 경로로 STS1 Worker | 새로고침(빌드 ID가 다름) |
| main만 새 빌드(STS1 배포 실패, STS1만 롤백) | 이전 빌드 | 바뀐 파일은 대체 경로로 STS1 Worker | 새로고침 |
| main만 롤백 | 새 빌드 | 바뀐 파일은 대체 경로로 STS1 Worker | 새로고침 |
| 바인딩이 없는 설정(이 변경 전의 main 코드 등) | 308 목록 모달 | 해당 없음 | 해당 없음 |

## Alternatives Considered

### 대안 A: main 안의 STS1 상세 셸(`__id__` 방식)

*   **Pros**: main에 약 20개만 더한다. 새 Worker도, 배포 결합도 없다. Toy Box 기록 셸이라는 선례가 있다.
*   **Cons**: 첫 HTML에 항목 내용이 없어서 JS를 돌리지 않는 크롤러와 링크 미리보기에는 빈 셸이 보인다. 첫 화면이 JS와 데이터를 받은 뒤에 그려진다.
    지금 서버에서 그리는 상세 5종을 브라우저 렌더로 바꾸는 리팩터가 필요하고, OG를 넣으려면 Worker 번들에 STS1 이름표가 들어간다.
*   **Reason for Rejection**: Rejected by author(2026-11-13 방식 선택에서 별도 Worker를 골랐다).
    별도 Worker는 정적 HTML을 그대로 쓰므로 렌더링을 바꾸지 않는다.

### 대안 B: main에 STS1 상세 HTML만 되돌리기(RSC 제외)

*   **Pros**: 새 인프라가 없다. 정적 HTML이 남는다.
*   **Cons**: main에 약 1,909개가 늘어 예산까지 약 1,520개만 남는다. v0.113.0 백필이 약 1,000개였으니 큰 패치 한두 번이면 다시 부족하다.
    STS1 상세로 가는 이동은 전부 전체 새로고침이다(RSC 404 → Next가 새로고침으로 연다).
*   **Reason for Rejection**: Rejected by author(같은 선택). 예산 문제를 미룰 뿐이고, 이동이 patch Worker처럼 새로고침이 된다.

### 대안 C: 기존 patch Worker에 STS1 상세 싣기

*   **Pros**: 여유가 17,989개라 넉넉하다. 새 Cloudflare 리소스가 없다.
*   **Cons**: patch Worker는 `next build` 전에 먼저 배포한다(patch-first). Worker 버전은 애셋 전체를 갈아 끼우므로, 그 배포에 STS1 페이지가 없으면 상세가 사라진다.
    빌드를 기다리면 `docs/PATCH_WORKER_DEPLOY_CONTRACT.md`가 금지한 patch 공개 지연이 생긴다.
*   **Reason for Rejection**: Rejected by author(같은 선택). patch-first 배포 계약과 맞지 않는다.

### 대안 D: 지금 상태 유지(목록 모달)

*   **Pros**: 비용이 없다.
*   **Cons**: 상세 주소, 사이트맵, 상세 단위 검색 노출이 없다.
*   **Reason for Rejection**: Rejected by author. 백필이 끝나면 STS1 전용 Worker로 상세를 되살리기로 이미 정했다.

### 대안 E: STS1 이미지(약 2,500개)도 옮기기

*   **Pros**: main 예산이 약 2,500개 더 생긴다.
*   **Cons**: 옮긴 이미지 요청은 main 애셋에 없으니 매번 main 스크립트를 부른다. STS1 카드 목록 한 번에 이미지 수백 건이 하루 100,000 요청에 들어간다.
*   **Reason for Rejection**: Rejected by author(비목표). 이 작업 뒤에도 main에 약 3,400개가 남아 지금은 필요 없다.

### 대안 F: Workers Paid(월 5달러)

*   **Pros**: 버전당 100,000개라 코드를 바꿀 필요가 없다.
*   **Cons**: 유료다.
*   **Reason for Rejection**: Rejected by author. 이 작업은 무료 한도 안에서 하는 것이 전제다.

### 대안 G: 빌드 어긋남에 다른 장치 쓰기

*   **versions 동시 전환:** `wrangler versions upload`로 두 Worker를 올린 뒤 `versions deploy`를 연달아 실행한다. 어긋나는 시간이 초 단위로 준다.
    하지만 main 배포 명령을 바꿔야 하고, 한쪽만 롤백하거나 두 번째 전환이 실패하면 깨진다.
*   **장치 없음:** 코드는 늘지 않는다. 하지만 코드·CSS가 바뀐 배포마다 몇 분씩 STS1 상세가 스타일 없이 뜨고, 한쪽만 실패하면 다음 성공 배포까지 그대로다.
*   **Reason for Rejection**: Rejected by author(2026-11-13 장치 선택에서 `_next/static` 대체 경로를 골랐다).

--------------------------------------------------------------------------------

## Non-Functional Requirements

*   **요청 수:** 평소 STS1 상세 한 번에 main 호출 1번, 바인딩 호출 1번(세지 않음)이 든다. 8cd3f7eb 전과 같고, 지금(308 + 목록 = main 2번)보다 적다.
    `_next/static`은 같은 빌드면 main 애셋이 바로 응답한다(0번). 빌드가 어긋난 동안 STS1 상세를 처음 여는 브라우저만, 바뀐 파일 수만큼 main 호출이 생긴다.
*   **지연:** 바인딩 한 번이 늘리는 지연은 운영 측정에서 구분되지 않았다(TTFB 중앙값 약 0.28초로 같음).
*   **업로드:** 빌드 ID가 바뀔 때마다 STS1 Worker는 페이지 약 3,817개(166 MiB)를 다시 올린다. 8cd3f7eb 전 main이 함께 올리던 양이다.
    `_next/static`은 이름(해시)이 같으면 다시 올리지 않는다.
*   **배포·롤백:** 배포 순서는 STS1 Worker 다음 main이다. 한쪽만 실패하거나 한쪽만 되돌려도 STS1 상세는 뜬다(위 표).
    릴리스 기록에는 두 Worker의 버전을 함께 적는다. main을 이 기능 전 버전으로 되돌리면 바인딩이 없는 코드라 STS1 상세는 다시 308이 되고,
    STS1 Worker는 남아 있어도 쓰이지 않는다.
*   **보안:** STS1 Worker는 공개 주소가 없다. 모든 응답은 main을 거치므로 main의 보안 헤더가 붙는다.

--------------------------------------------------------------------------------

### Additional Resources

*   판단 근거(운영 측정, 요청 수, Next 이동 동작): 이 설계 전 단계의 판단 메모(작업 세션의 `discussion_summary.md`, 2026-11-13)
*   `docs/CLOUDFLARE_LIMITS.md`, `docs/PATCH_WORKER_DEPLOY_CONTRACT.md`, `docs/CLOUDFLARE_CUSTOM_DOMAIN_ROUTING.md`, `docs/SUPABASE_EXIT_PARALLEL_WORK.md`
*   Cloudflare 문서: [Service bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/),
    [Limits](https://developers.cloudflare.com/workers/platform/limits/),
    [Static assets billing and limitations](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)
*   되돌리는 커밋: 8cd3f7eb("Take STS1 Compendium detail pages off the main Worker.")

### Future Improvements

*   **`cf:limits`에 STS1 Worker 줄 넣기:** 지금은 빌드 검사가 STS1 Worker 파일 수를 예산으로 막는다. 운영 수치는 배포 로그에서 볼 수 있지만 `cf:limits` 표에는 없다.
*   **커스텀 도메인 직접 라우팅:** 도메인을 붙이면 `/compendium/sts1/*/*`도 STS1 Worker로 바로 보내 main 호출을 없앨 수 있다.
    다만 `_next/static`과 목록 모달 308은 main에 남는다.

--------------------------------------------------------------------------------

## Detailed Implementation Plan

작업 위치는 `.claude/worktrees/sts1-worker`(`refactor/sts1-worker`)다. 수정할 때마다 커밋한다.

### Target Files to Create/Modify

#### 1. `wrangler.sts1.jsonc` (Create)

*   **Type / Scope**: Wrangler 설정
*   **Proposed Changes**: `name: scare-the-spire-sts1`, `main: workers/sts1-worker.ts`, `compatibility_date`는 main과 같게 둔다.
    `assets: { directory: ".sts1-worker/assets", binding: "ASSETS", html_handling: "none", not_found_handling: "none" }`,
    `workers_dev: false`, `preview_urls: false`, `observability.enabled: true`(patch Worker와 같음).
    `env.testbed`에도 `workers_dev: false`, `preview_urls: false`를 둔다(이름은 `scare-the-spire-sts1-testbed`가 된다).

#### 2. `workers/sts1-worker.ts` (Create)

*   **Type / Scope**: Worker 스크립트
*   **Proposed Changes**: `fetch(request, env)`가 `env.ASSETS.fetch(request)`를 그대로 돌려준다. 공개 주소가 없어 main만 부른다.

#### 3. `.gitignore` (Modify)

*   **Proposed Changes**: `/.sts1-worker/`를 더한다(`/.patch-worker/` 옆).

#### 4. `scripts/cloudflare-assets-dir.mjs` (Modify)

*   **Proposed Changes**: `STS1_WORKER_ASSETS_DIR = ".sts1-worker/assets"`를 내보낸다. 복사·정리·검사 스크립트가 같은 값을 쓴다.

#### 5. `scripts/copy-cf-static-pages.mjs` (Modify)

*   **Proposed Changes**: `staticPageRelativePath()`가 STS1 상세(ko·en)를 따로 알려 주게 하고, 그 파일은 `.sts1-worker/assets/_cf_static_pages/`에 쓴다(시작할 때 그 디렉터리를 비운다).
    RSC 변환(이미지 hint 행 제거)은 지금 규칙 그대로다. 페이지 복사 뒤 `.cloudflare/assets/_next/static`을 `.sts1-worker/assets/_next/static`으로 복사한다.
    로그에 STS1 Worker 페이지 수를 더한다.

#### 6. `scripts/prune-cf-unreferenced-assets.mjs` (Modify)

*   **Proposed Changes**: `findUnreachableNextStatic()`과 `findReferencedExcludedAssets()`가 추가 시작 디렉터리(STS1 Worker의 `_cf_static_pages`)를 받는다.
    `main()`이 그 디렉터리를 넘긴다. STS1 Worker의 `_next/static` 사본은 시작점이 아니다(전부 도달로 잡히기 때문).

#### 7. `workers/static-page-routing.ts` (Modify)

*   **Proposed Changes**: `isSts1DetailAssetPath(assetPath)`를 더한다. `/_cf_static_pages/(en/)?compendium/sts1/<type>/<slug>.(html|rsc)`이면 true다.

#### 8. `workers/main-worker.ts` (Modify)

*   **Proposed Changes**:
    *   `Env`에 `STS1_WORKER?: { fetch(request: Request): Promise<Response> }`를 더한다.
    *   `fetchStaticPageAsset()`: 애셋 경로가 STS1 상세면 `env.STS1_WORKER`(없으면 null 반환), 아니면 `env.ASSETS`에서 읽는다. 리다이렉트를 따라갈 때도 같은 바인딩을 쓴다.
    *   `maybeRedirectLegacyCompendiumDetail(request, url, env)`: STS1 경로(옛 별칭 포함)의 308은 `env.STS1_WORKER`가 없거나 `staticCompendiumAssetPath()`가 그 경로에 상세 애셋을 주지 않을 때(게임 전용 로케일)만 보낸다.
    *   `/_next/static/` 경로가 스크립트까지 오면(main 애셋에 없음) GET·HEAD에 한해 `env.STS1_WORKER`에 묻는다. 200이면 `Cache-Control: public, max-age=31536000, immutable`로 돌려주고, 아니면 지금 흐름으로 이어간다.

#### 9. `wrangler.jsonc` (Modify)

*   **Proposed Changes**: 최상위 `services`에 `{ binding: "STS1_WORKER", service: "scare-the-spire-sts1" }`, `env.testbed.services`에 `{ binding: "STS1_WORKER", service: "scare-the-spire-sts1-testbed" }`를 더한다.

#### 10. `src/lib/sts1/paths.ts` (Modify)

*   **Proposed Changes**: `sts1DetailPath()`가 `/compendium/sts1/<type>/<slug>`를 돌려준다(8cd3f7eb 전). `STS1_LIST_SELECTOR_PARAMS`는 게임 전용 로케일 목록 모달에 계속 쓰므로 남기고 주석을 고친다.

#### 11. `src/lib/compendium-resource-links.ts` (Modify)

*   **Proposed Changes**: `getSts1DetailRedirectPath()`의 주석만 고친다. 이제 게임 전용 로케일과 바인딩이 없는 Worker에서만 쓰인다.

#### 12. `src/app/sitemap.ts` (Modify)

*   **Proposed Changes**: 8cd3f7eb가 지운 STS1 상세 경로(`getSts1Cards()` 등 6종)를 되살린다.

#### 13. `scripts/check-cloudflare-static-assets.ts` (Modify)

*   **Proposed Changes**: STS1 상세 검사를 바꾼다. 각 ko·en 상세의 HTML·RSC가 `.sts1-worker/assets`에 있어야 하고, main에는 없어야 한다.
    STS1 Worker 파일 수가 예산 이하인지, STS1 상세 HTML·RSC가 가리키는 `_next/static` 경로가 main 애셋에 모두 있는지 본다. 결과를 한 줄로 출력한다.

#### 14. `scripts/check-cloudflare-route-coverage.ts` (Modify)

*   **Proposed Changes**: `env`에 `.sts1-worker/assets`를 읽는 `STS1_WORKER`를 넣는다. 8cd3f7eb가 넣은 "STS1 상세는 308/404" 분기를 지운다(이제 정적 페이지로 센다).
    main에 없고 STS1 Worker에만 있는 `_next/static` 파일 하나를 골라 대체 경로가 200을 주는지 확인한다.

#### 15. `scripts/cloudflare-route-smoke.mjs` (Modify)

*   **Proposed Changes**: STS1 상세 케이스를 `page(..., "compendium")`로, `/cards/strike-ironclad`를 `page(..., "legacy")`로 되돌린다.
    게임 전용 로케일 확인용으로 `/ja/compendium/sts1/cards/bash` → 308 `/ja/compendium/sts1/cards?card=bash`를 더한다(`sts1DetailRedirect`는 이 용도로 남긴다).

#### 16. `scripts/comment-threads.spec.ts`, `scripts/compendium-locale-detail-fallback.spec.ts` (Modify)

*   **Proposed Changes**: 댓글 링크 기대값을 상세 경로 `#comments`로 되돌린다. 목록 모달 리다이렉트 스펙은 함수가 그대로라 값은 두고 주석만 고친다.

#### 17. `package.json` (Modify)

*   **Proposed Changes**: `"cf:sts1:deploy": "wrangler deploy --config wrangler.sts1.jsonc"`를 더한다.

#### 18. `scripts/run-cloudflare-testbed.mjs` (Modify)

*   **Proposed Changes**: 원격에서는 patch Worker 다음, main 앞에 `wrangler deploy --config wrangler.sts1.jsonc --env testbed`를 실행한다.
    로컬에서는 STS1 Worker를 `wrangler dev`로 띄운다. `--skip-build`의 산출물 확인에 `.sts1-worker/assets`를 더한다.

#### 19. `.github/workflows/cloudflare-workers.yml` (Modify)

*   **Proposed Changes**: 배포 범위 판정에서 `wrangler.sts1.jsonc`를 main 쪽에 넣는다. `cf:size` 다음에 "Deploy STS1 Worker" 단계를 더한다(main 배포와 같은 3회 재시도).
    main 스모크에 `smoke_static_detail "/compendium/sts1/cards/strike-r"`와 `"/en/compendium/sts1/relics/burning-blood"`를 더한다.

#### 20. `scripts/cloudflare-auth.mjs` (구현에서 뺌)

*   **Proposed Changes**: 바꾸지 않는다. `cf:logs`·`cf:metrics`는 `--worker`를 `main|patch|all`로만 받아서,
    `WORKERS`에 넣어도 STS1 Worker를 따로 고를 수 없다. 두 도구까지 고칠 만큼의 이득이 없다.
    STS1 Worker는 요청을 넘기기만 하므로 오류도 main 쪽에 드러난다.

#### 20-1. `scripts/prune-cf-unreferenced-assets.spec.ts` (Modify, 구현에서 더함)

*   **Proposed Changes**: 다른 Worker가 같은 출처에서 서빙하는 페이지(추가 시작 디렉터리)만 가리키는 chunk가 지워지지 않는지 확인하는 경우를 더한다.

#### 21. 문서 (Modify)

*   `docs/CLOUDFLARE_LIMITS.md`: 비용 표의 STS1 상세 줄(STS1 Worker에 4개, main 0개), 출처 표에 STS1 Worker 줄.
*   `docs/DEPLOY.md`: STS1 Worker 절(배포 순서, 롤백, 로컬 실행).
*   `docs/ARCHITECTURE.md`: 구성 요소 목록에 STS1 Worker.
*   `docs/CLOUDFLARE_CUSTOM_DOMAIN_ROUTING.md`: 지금 경로 그림에 STS1 바인딩.

### Verification Plan

*   **Compilation/Build**: `pnpm exec tsc --noEmit`, `pnpm cf:build`(안에서 `cf:assets`의 두 검사와 보안 헤더 스펙), `pnpm cf:size`
*   **Unit Tests**: `pnpm exec tsx scripts/comment-threads.spec.ts`, `pnpm exec tsx scripts/compendium-locale-detail-fallback.spec.ts`
*   **Static Analysis & Linting**: `pnpm lint`, `pnpm i18n:validate`(pre-push 훅과 같음)
*   **E2E/Integration**: `pnpm cf:testbed:local`(로컬 main·patch·STS1 Worker에서 `cf:smoke --scope all`과 `qa:cf:testbed`),
    그다음 `pnpm cf:testbed -- --remote`(testbed에 세 Worker 배포 후 같은 두 묶음).
    testbed에서 CUJ 1~5를 주소별로 확인한다. CUJ 5는 main에 없는 `_next/static` 파일을 직접 요청해 대체 경로를 본다.
    STS1 상세는 모바일 QA(`mobile-viewport-qa`, Supabase 차단)를 ko·`/en`에서 돌린다.

--------------------------------------------------------------------------------

<!-- Provenance: Indicates initial structural drafting via EGM. -->

*Drafted with EGM*
