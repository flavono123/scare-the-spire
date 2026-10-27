# 미배포 기능 대장

마지막 정기 배포 이후의 기능 기대치와 열린 worktree를 기록한다.
작성·관리 규칙: [../RELEASE_PROCESS.md](../RELEASE_PROCESS.md).

기준점: 마지막 성공 프로덕션 실행 `411543ff`(2026-10-26). 범위는 `411543ff..main`.

## 열린 worktree

| 이름 | 브랜치 | 목적 | 상태 |
|---|---|---|---|
| domain-migration-c54d7b | claude/domain-migration-c54d7b | 도메인 이전(레거시 호스트 안내, 리다이렉트, robots/sitemap) | 11커밋, main보다 122 뒤처짐. 2026-10-26 정기 배포에서 제외 |
| opennext-exit | refactor/opennext-exit | main Worker에서 OpenNext 런타임 제거(정적 전용 Worker), 정적 파일 수 정리, 클라이언트 중복 제거 | 진행 중(2026-10-27 시작). OpenNext 제거 배치 완료, 원격 testbed 검증과 병합 대기 |

## 긴급 배포로 QA 없이 나간 범위

## 기능 기대치

### search-canonical-policy
- Feature: ko와 en을 각각 자기 canonical로 두고 ko/en/x-default hreflang을 건다. 그 밖의 게임 로케일은 `/en`을 canonical로 한다. sitemap은 ko·en 두 줄과 alternates를 낸다. 접두사 문서에 `lang="en"`. 패치 제목·H1·설명에 "STS2"/"슬더스2" 접두사.
- Expect: `/ja/...` 등의 canonical이 `/en/...`. `/sitemap.xml`에 `/en` 행과 alternates. 패치 상세 제목이 "슬더스2 v…"/"STS2 v…". 정적 오류 셸 28개(`<locale>/compendium/{monsters,encounters}.html`)는 기존처럼 bestiary로 리다이렉트.
- QA: `tsx scripts/check-search-canonical.ts`, `tsx scripts/detail-shell-og.spec.ts`, `qa:cf:testbed`(lang·hreflang 기대값). 수동: sitemap, `/ja` canonical, 패치 제목.
- Commits: `ff7cb925`(merge of claude/wizardly-brattain-bb7f93: 3c62aca5..10d72230)

### static-compendium-detail
- Feature: 백과사전 상세가 사실 항목·효과 텍스트·관련 링크·변경 이력을 서버 HTML로 먼저 내고 hydration한다. 상세 payload를 `/generated/compendium-data/<locale>/<resource>.json` 141개 chunk로 나눈다. 목록은 그리드용 행만 보내고 모달·호버·이력은 chunk에서 불러온다. 목록 끝에 전체 항목 링크 색인. ko/en 정적 패치 페이지의 게임 요소 링크가 `/compendium/<type>/<id>`. 카드·유물·포션 상세의 캐릭터 항목이 캐릭터 페이지로 링크.
- Expect: 상세(ko/en, 모바일)가 정적 화면→상호작용 화면으로 바뀔 때 큰 깜빡임·레이아웃 이동 없음. chunk 실패 시 정적 본문 유지. 목록 호버 팁·모달·버전 선택 정상. 도감 몬스터의 문을 만드는 자·잠행 군체 타일이 chunk 도착 뒤 정상. 역사 강의서·커버 카드 정상.
- QA: `static:data`가 1.5 MB 미만 chunk 141개 기록, `cf:smoke --scope all`(`/generated/compendium-data/kor/cards.json`), `qa:cf:testbed` relic 모달. 수동: 위 Expect 항목.
- Commits: `3741dec8`(merge of claude/recursing-hopper-6b84b3: 33876a10..1fba341f). 충돌은 `patch-note-renderer.tsx` 한 곳, main의 `entityCompendiumHref()` 위에 상세 링크 변환을 얹음.

### opennext-exit (worktree, 미병합)
- Feature: main Worker가 정적 전용이 된다(런타임 Next/OpenNext 없음, gzip 16.49 KiB). `/decisions-decisions`·`/this-or-that/tournament` 인덱스(14 로케일)를 정적 페이지로 서빙하고, worldcup 인덱스 308·`/dev/pagestorm-editor` 307·`/ko`·`/kor` 308·trailing slash/`//` 308·`/api/link-preview`를 Worker가 예전 응답대로 처리한다. 매칭되지 않는 경로는 Next가 prerender한 not-found 페이지(HTML/RSC, 404, `x-cf-static-page: not-found`)와 `cf-static-404` 로그. 정적 경로의 GET/HEAD 외 메서드는 405. 빌드는 `next build` + `collect-cf-assets.mjs` + `wrangler deploy`. 정적 asset은 닿지 않는 `/_next/static` chunk 64개와 서빙되지 않는 public 파일 53개를 업로드에서 빼고, 낡은 Ancient VFX 텍스처 9개를 지워 18,467개(예산 19,500, 한도 20,000, 예산까지 1,033 남음). STS1 glyph metrics는 페이지 로케일 pack 하나만 받고, 구 STS2 한국어 표는 kor 게임 표를 읽는다(클라이언트 중복 제거 merge).
- Expect: 화면 변화 없음. STS1 페이지·pagestorm STS1 호버의 글자 렌더 동일. `/does-not-exist`처럼 한 단계짜리 없는 경로가 500 대신 404 페이지. worldcup 인덱스·`/ko` 리다이렉트 Location 동일(RSC 요청은 `_rsc` 쿼리 유지). 링크 미리보기 동작 동일(리다이렉트 중간 단계도 공개 URL만 따라감).
- 의도한 응답 차이(OpenNext 대비, 실제 링크는 영향 없음):
  - 렌더러가 요청 시 그리던 비정규 파라미터가 404: 모르는 게임 로케일(`/xx/decisions-decisions`), `.`·`%`가 든 상세 ID(`/transfigure/zz.review`). 게임 로케일 접두사의 대소문자 변형(`/EN/...`, `/En/this-or-that/tournament`)은 소문자 경로로 308(전에는 200 또는 500).
  - `/_next/image`가 404 페이지(전에는 OpenNext 이미지 endpoint가 로컬 이미지를 200으로 전달). `images.unoptimized`가 2026-04-10부터라 Cloudflare 출시(2026-06-16) 뒤 이 origin의 어떤 페이지도 이 URL을 낸 적 없음.
  - GET/HEAD 외 메서드: 있는 정적 페이지는 405, 없는 상세(`/compendium/cards/<없는 id>`)는 GET처럼 404.
  - 정적 페이지 응답에 Next와 같은 `Vary: rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch`.
- 이번 배포 주의: RELEASE_PROCESS 5단계의 배포 전 프로덕션 `cf:smoke --scope main`은 이 브랜치가 추가한 다음 케이스가 옛 앱에서 실패한다(배포 뒤에만 통과). `/decisions-decisions`·`/en/decisions-decisions`·`/this-or-that/tournament`·`/zh/this-or-that/tournament` document/RSC(옛 앱은 `x-cf-static-page` 없음), "Worldcup index redirect RSC"(옛 앱 200), "Not-found document"·"Not-found RSC"(옛 앱 500), "Locale not-found document"(owner 헤더 없음), "POST to a static page". 배포 전 판정은 원격 testbed의 `cf:smoke --scope all`로 하고, 프로덕션 smoke는 배포 뒤에 본다. POST 케이스는 정적 페이지에 본문 없는 요청 하나라 부작용이 없다.
- QA: `pnpm cf:build`(route coverage·asset 예산 포함 `cf:assets`), `tsx scripts/prune-cf-unreferenced-assets.spec.ts`, `tsx scripts/next-routing-parity.spec.ts`, `tsx scripts/link-preview.spec.ts`, `pnpm cf:size`, `pnpm patch:build`(제외 public 파일 참조 검사), `pnpm cf:testbed:local --skip-build`, 원격 testbed(`pnpm cf:testbed`) parity, 배포 후 `pnpm cf:smoke --scope main`과 `pnpm cf:logs -- --not-found`.
- Commits: `788be7ea..` (refactor/opennext-exit)

<!--
### <항목-id>
- Feature:
- Expect:
- QA:
- Commits:
-->
