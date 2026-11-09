# Task 010: 운영에도 있는 기존 문제 모음

## 상태: 수정 완료 후 사용자 검수 대기 (2026-11-02, 미배포)

- 고침: #1~20, #22, #24~31, #33~37, #39~41, #43, #44, #46~59, #61.
- 이미 고쳐짐: #19, #21, #38. 재현 안 됨: #23(동시 4회 전부 200, 드문 500이 사라졌다고 단정은 못 함).
- 결정 대기: #32(기록별 OG, 요청마다 Supabase 조회), #42(Realtime publication), #45(DB 낮은 항목), #60(Free 인스턴스, Pro 사용 안 함).
- 아래 목록은 기록으로 남긴다. 수정 내용은 `docs/release/UNRELEASED.md`의 known-issues-fixes에 있다.

## 분류

여러 화면에 걸친 작은 버그 모음. 리팩토링 묶음(1·2b·2·3)의 QA가 운영과 비교하다 찾은 것 중
**운영에서도 똑같이 재현되는 것**만 모은다. 리팩토링은 "운영과 같은 화면"을 회귀 기준으로 삼기
때문에 묶음 안에서는 고치지 않았다. 모든 묶음이 끝나면 같은 세션에서 이 목록을 고친다.

## 기록 규칙

- 이후 묶음의 QA에서 운영에도 있는 문제가 나오면 여기에 덧붙인다.
- 항목마다 운영 전체 URL, 증상, QA가 짚은 원인을 남긴다. 리팩토링이 새로 만든 문제는 넣지 않는다
  (그건 `docs/release/UNRELEASED.md`의 해당 기능 "알려진 차이"에 둔다).
- 운영 호스트: `https://scare-the-spire.flavono123.workers.dev`

## 목록

### 백과사전

1. **몬스터 이름 자리표시자**: 관련 몬스터 목록에 '실험체 #C{Count}' / 'Test Subject #C{Count}'가 그대로 보인다.
   - https://scare-the-spire.flavono123.workers.dev/compendium/powers/vulnerable ,
     https://scare-the-spire.flavono123.workers.dev/en/compendium/powers/strength
   - 원인: 게임 이름 템플릿의 `{Count}`를 백과사전이 치환하지 않는다.
2. **게임 전용 언어 모달의 관련 링크가 `/en`으로 감**.
   - https://scare-the-spire.flavono123.workers.dev/ja/compendium/cards?card=bash
   - 원인: 모달·타일 링크를 게임 로케일이 아닌 서비스 로케일(en)로 만든다(예: `card-detail.tsx`의 `localizeHref('/compendium/cards', serviceLocale)`).
3. **`/en` 포션 모달의 이벤트 선택지 카드가 한국어**.
   - https://scare-the-spire.flavono123.workers.dev/en/compendium/potions?potion=cunning_potion
   - 원인: 미조사.
4. **en 몬스터 상세의 파워 수치 링크가 ko 주소**(예: 힘 '3' → `/compendium/powers/strength`).
   - https://scare-the-spire.flavono123.workers.dev/en/compendium/monsters/doormaker
   - 원인: 몬스터 행동·의도의 파워 링크가 접두사 없는 href를 만든다.
5. **문을 만드는 자 '움켜잡기' 행동의 힘 아이콘을 눌러도 반응 없음**.
   - https://scare-the-spire.flavono123.workers.dev/en/compendium/monsters/doormaker
   - 원인 추정: `touch-none` 컨테이너가 포인터를 가져가(드래그·팬 처리) 클릭이 컨테이너로 간다.
6. **패치 이력의 긴 'Steam Build 23478716' 라벨이 본문과 겹침**(ja 카드 모달, 1440px).
   - https://scare-the-spire.flavono123.workers.dev/ja/compendium/cards?card=armaments
   - 원인: `PatchMetaReferenceLink`가 `whitespace-nowrap`이고, 좁은 두 열 이력 레이아웃이 긴 빌드 라벨 폭을 비워 두지 않는다.
7. **포션 상세가 같은 이미지를 두 번 받음**(`?v=` 없는 주소로 한 번 더, 약 62 KB).
   - https://scare-the-spire.flavono123.workers.dev/compendium/potions/ambergris
   - 원인: 상호작용 포션 상세의 하위 컴포넌트가 에셋 버전 쿼리 없이 이미지 URL을 만든다.
8. **일부 페이지 유형에 og:url 없음**.
   - https://scare-the-spire.flavono123.workers.dev/compendium/cards
   - 원인: `getCodexMetadata`와 서비스 목록 메타데이터에 openGraph가 없어서 og:url이 붙지 않는다.

### 패치노트

9. **`/patches/changes`에서 React #418 hydration 오류**(ko·en·ja).
   - https://scare-the-spire.flavono123.workers.dev/patches/changes
   - 원인: patch Worker의 resource-patch-index 정적 HTML이 클라이언트 첫 렌더와 다르다(인덱스 토큰 바를 클라이언트에서만 렌더).
10. **승천 호버 미리보기가 390px 화면보다 넓어 양옆이 잘림**.
    - https://scare-the-spire.flavono123.workers.dev/patches/0.111.0
    - 원인: 미리보기 폭이 고정이고 `showPreview`가 `window.innerWidth - previewRect.width - MARGIN`(음수)으로만 왼쪽을 조정한다.
11. **/en·/ja 패치 페이지의 댓글 카드 언급과 다채로운 철학자들 카드가 한국어 이름·ko 주소**.
    - https://scare-the-spire.flavono123.workers.dev/en/patches/2026-09-11 ,
      https://scare-the-spire.flavono123.workers.dev/ja/patches/2026-09-11 ,
      https://scare-the-spire.flavono123.workers.dev/ja/patches/changes (댓글 영역의 토론 링크 1개가 `/en/`)
    - 원인: 댓글 리치 렌더러와 토론 주간 카드가 저장된 한국어 이름과 기본(ko) href를 쓴다
      (`backstab-colorful-philosophers-section.tsx`의 `post.nameKo`, `colorful-philosophers/resource-thread.tsx`의 `localizeHref(..., serviceLocale)`).
12. **패치 글의 'n일 전'이 빌드 시각에 고정됨**(hydration 뒤에도 갱신 안 됨).
    - https://scare-the-spire.flavono123.workers.dev/patches/2026-09-11
    - 원인: 정적 patch Worker가 빌드 시각 기준으로 상대 시간을 그리고, 클라이언트가 다시 계산하지 않는다.

### byrdispatch·홈

13. **byrdispatch가 390px에서 2px 가로 스크롤**.
    - https://scare-the-spire.flavono123.workers.dev/byrdispatch , https://scare-the-spire.flavono123.workers.dev/en/byrdispatch
    - 원인: 96vw 블록을 `left-1/2 -translate-x-1/2`로 가운데 맞추는데 부모 패딩과 합쳐져 넘친다.
14. **`/en/byrdispatch`가 `/en/relics`를 prefetch해서 404**, 패치 경로 prefetch는 text/html 응답.
    - https://scare-the-spire.flavono123.workers.dev/en/byrdispatch
    - 원인: en 페이지가 없는 옛 `/relics` 링크. 패치 페이지는 patch Worker가 RSC 요청에도 HTML로 답한다.
15. **홈과 byrdispatch에 쓰지 않은 이미지 preload 경고**.
    - https://scare-the-spire.flavono123.workers.dev/ , https://scare-the-spire.flavono123.workers.dev/byrdispatch
    - 원인: 상세가 아닌 페이지 RSC의 React Flight 이미지 hint 행(`copy-cf-static-pages.mjs`는 상세 RSC에서만 지운다).
16. **패치 줄 목록 요청이 한 번 실패하면 세션 내내 실패를 붙잡음**.
    - https://scare-the-spire.flavono123.workers.dev/byrdispatch (이야기 작성), https://scare-the-spire.flavono123.workers.dev/ (이야기 모달)
    - 원인: `byrdispatch-story-composer-button.tsx`와 `story-feed.tsx`의 `fullPatchLinesPromise`가 거부된 `/generated/sts2-patch-lines.json` promise를 캐시한다.

### Toy Box·검색·공통

17. **어려운 결정 기록 상세가 390px에서 긴 URL 설명 때문에 약 680px로 넘침**.
    - https://scare-the-spire.flavono123.workers.dev/decisions-decisions/69a1e90b-8964-431c-a58a-c245eba517d5
    - 원인: 기록 설명 단락에 `overflow-wrap:anywhere`/`break-words`가 없다.
18. **Toy Box 목록이 `/en`으로 자동 전환된 뒤 canonical이 2개**.
    - https://scare-the-spire.flavono123.workers.dev/this-or-that (영어 브라우저)
    - 원인: 정적 목록 셸 head의 canonical이 클라이언트 전환 뒤 Next metadata canonical과 함께 남는다.
19. **Toy Box 기록 셸의 canonical·hreflang이 요청마다 다름**(캐시 MISS면 목록 셸 메타데이터).
    - https://scare-the-spire.flavono123.workers.dev/en/chemical-x/c0789f0e-6842-42b4-bdc8-90e4256a50de
    - 원인: `fetchSupabaseRestSingleRow`의 600ms abort 때문에 MISS일 때 enrich가 실패하고 baseResponse를 돌려준다.
20. **홈 `/`가 Accept-Language가 en이면 크롤러에게도 서버에서 `/en`으로 302**.
    - https://scare-the-spire.flavono123.workers.dev/
    - 원인: `workers/main-worker.ts`의 accept-language 홈 리다이렉트가 `isSearchCrawlerUserAgent`를 보지 않는다(크롤러 예외는 클라이언트에만 있음).
21. **`/debate`가 HTTP 500**.
    - https://scare-the-spire.flavono123.workers.dev/debate
    - 원인 추정: 남은 라우트 디렉터리 또는 Worker 라우팅.
22. **부하 중 `nav-seen` Supabase 시간 초과가 잡히지 않은 오류로 남음**(Uncaught SupabaseTimeoutError 'nav-seen.combo timed out').
    - https://scare-the-spire.flavono123.workers.dev/compendium/cards/bash
    - 원인: `src/lib/nav-seen.ts`의 `surfaceHasNewer`가 `withSupabaseTimeout`을 await하고, `fetchUnreadSurfaceIds`의 `Promise.all` 호출부가 거부를 받지 않는다.
23. **큰 정적 페이지(약 4 MB)를 동시에 요청하면 가끔 빈 본문 HTTP 500**(두 호스트 모두, 재현 드묾).
    - https://scare-the-spire.flavono123.workers.dev/de/byrdispatch
    - 원인 미확인(Worker 자원 한도·시간 초과 추정). 묶음 2b가 이 페이지 용량을 크게 줄이므로 2b 배포 뒤 다시 확인한다.
24. **JavaScript를 끄면 사이트 헤더(내비)가 없음**.
    - https://scare-the-spire.flavono123.workers.dev/compendium/events/dense_vegetation
    - 원인: 레이아웃의 사이트 헤더가 Suspense 경계 안에서 스트리밍된다.

### 묶음 2b 병합 QA에서 추가 (2026-10-30)

25. **byrdispatch 본문의 패치 버전 링크가 `/patches/v0.1xx.0`이라 빈 404**(로케일마다 10개, prefetch 404 콘솔 오류도).
    - https://scare-the-spire.flavono123.workers.dev/byrdispatch
    - 원인: byrdispatch 렌더러가 `patchVersionPath()` 대신 'v'가 붙은 버전 토큰으로 링크를 만든다(`/patches/[version]`에는 'v'가 없음).
26. **/en·/ja 홈 이야기 모달의 댓글 편집기 `{` 제안이 한국어 이름이고, 일본어로 찾으면 결과 없음**.
    - https://scare-the-spire.flavono123.workers.dev/ja#sts2-wither-int-max-upgrades
    - 원인: 홈 이야기 모달의 CommentSection이 아직 `/generated/comment-entities-sts2.json`(한국어 그래프)으로 제안을 만든다. byrdispatch 댓글은 로케일 그래프 + 한국어 별칭을 쓴다.
27. **/en·/ja 홈 이야기 모달의 참조 블록이 한국어 라벨이고 ko 주소로 링크**('↳ 관련 항목', 한국어 섹션 제목, 접두사 없는 백과사전 링크, /ja의 패치 줄 링크가 `/en/patches/...`). 작성기의 선택한 참조도 같음.
    - https://scare-the-spire.flavono123.workers.dev/en
    - 원인: story-feed 참조가 한국어 섹션 제목과 '관련 항목' 라벨을 쓰고, 백과사전 href에 접두사가 없으며, 패치 링크를 서비스 로케일로 만든다.
28. **/en·/ja Toy Box 게시물과 byrdispatch 댓글의 호버 팁에 한국어 희귀도·분류·막 라벨**('엘리트', '일반', '1막 — 지하 선착장', '고급', '보스'), 일부 언급 링크는 ko 주소.
    - https://scare-the-spire.flavono123.workers.dev/en/c-c-c-combo , https://scare-the-spire.flavono123.workers.dev/en/chemical-x
    - 원인: 공용 호버 팁이 전체 그래프로 그릴 때 한국어 라벨을 쓰고, 댓글 렌더러와 케미컬X 언급이 기본(ko) href를 쓴다(#11과 같은 부류).
29. **/ja 역사 강의서의 인기 칩과 필터 검색 결과가 영어 이름**(런 커버는 일본어).
    - https://scare-the-spire.flavono123.workers.dev/ja/history-course
    - 원인: 필터 라벨이 게임 로케일(jpn)이 아닌 서비스 로케일(en) 이름을 쓴다.
30. **Supabase가 응답하지 않을 때 숨은 '데이터베이스 응답 없음' 툴팁 때문에 페이지가 화면보다 넓어짐**(390px에서 scrollWidth 409–418).
    - https://scare-the-spire.flavono123.workers.dev/compendium/powers/vulnerable
    - 원인: `src/app/globals.css`의 `.engagement-unavailable-icon__tooltip`이 `position:absolute; width:max-content`로 오른쪽 끝 아이콘 가운데에 놓여, 투명할 때도 레이아웃 폭을 차지한다.
31. **관련 링크의 고대의 존재 호버에 한국어 막 라벨**('3막 — 영광', '2막 — 군락')이 /en·/ja 등 모든 게임 로케일에서 나옴.
    - https://scare-the-spire.flavono123.workers.dev/en/compendium/relics
    - 원인: `src/components/codex/entity-reference-links.tsx`가 `EntityPreview`에 `gameUi`를 넘기지 않아 `patch-note-renderer.tsx`의 `gameUi?.acts[act] ?? EVENT_ACT_CONFIG[act].labelKo`가 한국어로 떨어진다.

### 묶음 2 QA에서 추가 (2026-10-31)

32. **Toy Box 기록 링크의 미리보기(OG)가 기록별 값이 아니라 목록 기본값**(제목·설명·이미지). canonical·hreflang·og:url만 기록 주소.
    - https://scare-the-spire.flavono123.workers.dev/this-or-that/c23e2302-a8da-473d-8205-5078c5aba49e
    - 원인: `workers/detail-shell-og.ts`는 Worker 변수가 있어야 동작하는데 Worker에 `NEXT_PUBLIC_SUPABASE_URL`·`NEXT_PUBLIC_SUPABASE_ANON_KEY`가 없다(CI는 빌드 환경에만 넣음). 켜면 기록 셸 요청마다 공유 Supabase를 조회하므로 부하를 함께 정해야 한다.
    - 덧붙임(2026-11-09, Supabase 이관 6단계): 조회를 Supabase에서 main Worker의 D1(`env.DB`) 1행 읽기로 옮겼다. 켜는 조건은 Worker 변수 `DETAIL_SHELL_OG=d1`과 DB binding이고, `wrangler.jsonc`에는 넣지 않아 여전히 꺼져 있다. 켜면 기록 셸 요청(크롤러 포함)마다 D1을 한 번 읽는다.
33. **게임 전용 언어의 통합 검색이 그 언어 이름을 못 찾고, 결과가 한국어 패치 제목으로 나옴**('強打', '赤べこ', '痛击' 0건, 'Bash'는 'v0.98.2 핫픽스 패치 노트 …').
    - https://scare-the-spire.flavono123.workers.dev/ja
    - 원인 추정: 모든 언어가 `/generated/search-index.json` 하나를 쓰고, 게임 로케일별 이름·제목이 들어 있지 않다(미확인).
34. **없는 페이지가 Next 기본 흰 화면이고 ko에서도 영어 문구, /en·/ja 탭 제목은 '슬서운 이야기'. 패치 경로는 헤더도 없는 빈 화면**.
    - https://scare-the-spire.flavono123.workers.dev/compendium/cards/nope ,
      https://scare-the-spire.flavono123.workers.dev/patches/nope
    - 원인: 직접 만든 not-found 페이지가 없고, patch Worker는 빈 404로 답한다. 묶음 2 뒤에는 한 단계짜리 없는 경로도 500 대신 이 화면을 보이므로 보일 일이 늘어난다.
35. **AEONGLASS 몬스터 행동의 침체 카드 이미지 404**.
    - https://scare-the-spire.flavono123.workers.dev/images/sts2/cards/wither.webp
    - 원인: `src/components/codex/monster-move-visuals.tsx:1819`가 없는 파일명을 하드코딩한다(같은 파일 1805행은 `wither1.webp`).
36. **쉘 페이지의 문의 링크에 `__id__` 자리표시자가 남음**(`/contact?from=%2Fhistory-course%2F__id__`, hydration 뒤에도 그대로).
    - https://scare-the-spire.flavono123.workers.dev/history-course/not_valid
    - 원인 미조사.
37. **Supabase 장애 중 `patch:build`가 54분까지 늘어남**(CI 작업 한도 `timeout-minutes: 60` 근처). 장애 중 배포하면 시간 초과로 실패하거나 패치 페이지가 대체 데이터로 구워질 수 있다.
    - https://scare-the-spire.flavono123.workers.dev/patches/2026-09-11
    - 원인: `src/components/patches/patch-detail-page.tsx:843`의 쉘 패치 경로가 로케일마다 `getColorfulPhilosopherGalleryPosts`를 기다리는데 이 질의에 시간 제한이 없다.
38. **링크 미리보기 방어 보강**(묶음 3의 링크 미리보기 잔여 작업에서 처리).
    - https://scare-the-spire.flavono123.workers.dev/api/link-preview
    - 포트 제한 없음, 192.0.0.0/24·TEST-NET 3개·`.internal` 미차단, 요청 수 제한 없음. 악의적인 128 KB 페이지에서 `readOpenGraph`의 정규식 비용이 제곱으로 늘어남(3초 타이머는 본문 읽기까지만 막음).

### 묶음 3 QA에서 추가 (2026-10-31)

39. **유물 '엄청 뜨거운 코코아' 타일 호버 팁에 `[energy:4]`가 글자 그대로 보임**. 모달 본문은 정상. ko 유물 298개 중 이 1건만 확인(/en은 표본).
    - https://scare-the-spire.flavono123.workers.dev/compendium/relics
    - 원인 추정: 데이터가 `[blue][energy:4][/blue]`처럼 중첩인데 `src/lib/codex-card-description.ts`의 `parseDescription` 정규식이 `[blue]` 안을 다시 파싱하지 않는다(팁 경로는 끝까지 추적하지 않음).
40. **키보드로 목록 모달을 열면 초점이 타일에 남아 모달 안 첫 초점까지 Tab 298회**. Esc는 동작.
    - https://scare-the-spire.flavono123.workers.dev/compendium/relics
    - 원인 추정: 모달이 열릴 때 초점을 옮기지 않는다. 묶음 3의 '다시 시도' 버튼도 같은 이유로 키보드에서 멀다.
41. **링크 미리보기가 U+10FFFF를 넘는 숫자 엔티티(`&#x110000;`) 하나로 페이지 전체 미리보기를 잃음**. 200 빈 미리보기라 표시 문제에 그침.
    - https://scare-the-spire.flavono123.workers.dev/api/link-preview?url=https%3A%2F%2Fhttpbin.org%2Fbase64%2FPHRpdGxlPiYjeDExMDAwMDs8L3RpdGxlPg%3D%3D
    - 원인: `src/lib/link-preview.ts`의 `decodeHtml`이 `String.fromCodePoint` 전에 범위를 보지 않는다.
42. **Toy Box 피드와 이야기의 Realtime 구독을 서버가 거절함**. 구독 응답은 ok지만 곧이어 `Unable to subscribe to changes with given parameters` 시스템 오류가 온다. 다른 사람의 수정·삭제가 실시간으로 반영되지 않는다. 운영(realtime-js 2.98)과 testbed(2.118)가 같은 응답을 받고 안내는 뜨지 않는다.
    - https://scare-the-spire.flavono123.workers.dev/c-c-c-combo
    - 원인 추정: 해당 표가 `supabase_realtime` publication에 없다(저장소 마이그레이션에는 `defragment_posts` 추가만 있음). live DB의 publication은 확인하지 못했다.
    - 덧붙임(2026-11-06, Supabase 이관 조사): 0단계 백업의 publication 목록에도 `defragment_posts` 하나뿐이라 실시간 갱신은 한 번도 동작하지 않았다. 남은 부작용은 채널 join이 실패하거나 10초를 넘기면 이미 받은 피드를 unavailable로 덮는 것이다(`use-toybox-feed.ts:128-132`, Supabase를 막은 브라우저 QA에서도 재현). 결정: 이관 1단계의 api 경로는 채널을 열지 않는다. legacy 경로는 이 목록을 고칠 때 채널을 없애는 쪽으로 정리한다.
43. **`scripts/encounter-compositions.spec.ts`의 기대값이 낡음**(고유 전투 배경 수 11, 기대 17, 16행). 화면 버그는 아니다. CI에 없어 드러나지 않았다.
    - https://scare-the-spire.flavono123.workers.dev/compendium/encounters
    - 원인: `c946b7d3`이 바이트가 같은 배경을 한 파일로 합치면서 고유 배경이 17개에서 11개가 됐고(그림은 그대로) 스펙을 고치지 않았다. 기대값을 11로 바꾸면 나머지 단언은 통과한다.
44. **'데이터베이스가 응답하지 않습니다' 안내에 재시도 수단이 없음**(사용자 제안: 페이지를 새로 고치는 버튼. 조회를 다시 보내는 방식이 아니라 새로 고침을 유도).
    - https://scare-the-spire.flavono123.workers.dev/c-c-c-combo
45. **DB 쪽 남은 낮은 항목**(코드 읽기로 확인, 운영에서 동작을 재현하지는 않음). RLS 마이그레이션 범위 밖이다.
    - https://scare-the-spire.flavono123.workers.dev/this-or-that/tournament
    - `complete_favorite_tournament_play`가 플레이마다 후보 통계 행을 전부 UPDATE한다(순위가 그대로여도 씀).
    - `transfigure_posts_extra_variants_shape` CHECK가 `octet_length(extra_variants::text)`라 좋아요마다 직렬화한다.
    - `comments.parent_id`·`meta`는 앱이 쓰지 않는데 클라이언트가 쓸 수 있다. `parent_id`는 다른 스레드의 댓글도 가리킬 수 있다.
    - likes·votes·리액션의 `created_at`, 글 INSERT의 `id`는 여전히 클라이언트가 정할 수 있다.
46. **목록 모달 데이터 chunk가 응답하지 않으면 '불러오는 중...'에서 끝나지 않음**. 실패 응답이 아니라 무응답이면 묶음 3의 실패 안내와 다시 시도 버튼도 나오지 않는다. Esc, ✕, 뒤로가기, 새로고침으로는 빠져나온다.
    - https://scare-the-spire.flavono123.workers.dev/compendium/relics
    - 원인: `src/lib/compendium-data-chunks.ts`의 `fetchChunk`에 시간 제한이 없고, `chunkPromises`가 끝나지 않은 promise를 계속 들고 있다.
47. **/en 390px에서 조우 탭 미리보기가 2,249px로 화면을 크게 넘고 일부 글자가 한국어임**('일반 전투', '1막 — 과성장', 링크의 aria-label). 조합이 많은 조우에서 보인다.
    - https://scare-the-spire.flavono123.workers.dev/en/compendium/bestiary
    - 원인 추정: 조우 미리보기가 조합 전체를 높이 제한 없이 그리고 라벨이 언어를 받지 않는다(코드는 확인하지 않음).
48. **`CLAUDE.md`와 `AGENTS.md`의 수치가 낡음**. `CLAUDE.md`는 Next.js 15, 두 문서 모두 카드 612·유물 314·포션 63이지만 실제는 Next 16.4와 `data/sts2/kor`의 카드 598·유물 298·포션 64다. 화면과는 무관하다.
49. **조각모음 overlay 저장이 DB에서 거부되면 글은 성공처럼 끝나고 overlay 본문만 조용히 사라짐**. 패널이 닫히고 피드에 글이 생기며 안내가 없다. 다시 올릴 수도 없다.
    - https://scare-the-spire.flavono123.workers.dev/defragment
    - 원인: `src/hooks/use-defragment-bodies.ts`의 `isMissingDefragmentBodiesTable`이 `/defragment_bodies/i`로 메시지를 보므로 표 이름이 든 23514·42501까지 '표 없음'으로 처리하고, `upsertDefragmentBody`가 null을 돌려준다.
50. **조각모음 overlay 초안이 게시 뒤에도 남아 다음 글에 다시 붙음**. 같은 탭에서 패널을 다시 열면 콤보 칸은 비었는데 overlay 칸에 이전 글의 본문이 복원되고, 그대로 게시하면 저장된다.
    - https://scare-the-spire.flavono123.workers.dev/defragment
    - 원인: overlay 편집기는 `hideSubmitButton`에 빈 `onSubmit`이라 `RichContentEditor`의 `clearDraft`가 불리지 않고, 패널의 성공 경로도 `sts-defragment-overlay:*` 키를 지우지 않는다.
51. **글 저장 뒤 overlay가 5xx로 실패하면 새로 고침 뒤 복원된 초안을 올릴 때 같은 글이 두 번 저장됨**. 첫 제출은 글이 이미 저장됐는데 장애 안내로 바뀌고 초안이 남는다.
    - https://scare-the-spire.flavono123.workers.dev/defragment
    - 원인: `src/components/defragment/defragment-write-panel.tsx`의 catch가 글 insert와 `saveOverlay`를 함께 감싸 두 실패를 구분하지 않고, `RichContentEditor`는 어떤 실패든 초안을 남긴다.
52. **조각모음에서 서류 폭풍 글 저장이 거부되면 쓰던 문서가 사라지고 미처리 rejection이 남**. 패널이 장애 안내로 바뀌고 세션 저장소에 초안이 없다. 같은 거부에서 `/pagestorm/write`는 편집기가 남는다. 23514로는 1 MiB 넘는 문서에서만 닿는다. 500과 네트워크 실패에서도 같을 것으로 보지만 재현하지는 않았다.
    - https://scare-the-spire.flavono123.workers.dev/defragment
    - 원인: `handlePagestormSubmit`의 catch가 `onUnavailable`을 부른 뒤 다시 던지고, `PagestormEditor`의 `handleSubmit`은 이를 받지 않는다.
53. **조각모음에서 콤보 밖의 글은 overlay 본문이 1자일 때 이유를 알려 주지 않음**. 변형은 다시 시도하라는 안내가 뜨지만 다시 해도 성공하지 않고, 케미컬X·이거 아님 저거?·어려운 결정·이아저? 월드컵은 무반응, 서류 폭풍은 미처리 rejection이 남는다.
    - https://scare-the-spire.flavono123.workers.dev/defragment
    - 원인: `src/components/defragment/defragment-write-panel.tsx`의 각 submit이 overlay를 검사하고 던지거나 false만 돌려준다.
54. **콤보 작성창에서 본문 글자 위 휠과 터치 드래그로는 창이 스크롤되지 않음**. 저장 버튼 줄 위와 키보드로는 스크롤된다. 긴 글에서는 글자 영역이 화면 대부분을 차지한다.
    - https://scare-the-spire.flavono123.workers.dev/c-c-c-combo
    - 원인 추정: 에디터를 감싼 `GameScrollArea`(`overflow-y-auto overscroll-contain`)가 내용만큼 늘어나 넘침이 없는데도 스크롤 전달을 막는다. Chromium에서만 확인했다.
55. **키워드의 '새 탭에서 열기' 말풍선이 스크롤을 따라가지 않고 제자리에 남음**. 커서가 있던 키워드가 화면 밖으로 나가도 말풍선은 원래 좌표에서 다른 글자 위에 뜬다.
    - https://scare-the-spire.flavono123.workers.dev/c-c-c-combo
56. **모달 뒤로가기 링크의 cmd 클릭이 새 탭을 열지 않고 모달을 닫음**. 가운데 클릭은 새 탭을 열고, 단독 상세 페이지의 뒤로가기는 cmd 클릭도 새 탭을 연다.
    - https://scare-the-spire.flavono123.workers.dev/compendium/relics
    - 원인: 뒤로가기 `onClick`이 `onClose`가 있으면 수식 키를 보지 않고 `preventDefault` 한다(`src/components/codex/*-detail.tsx` 15곳, `src/components/sts1/detail-chrome.tsx`). 타일의 `onClick`은 수식 키를 확인한다.
57. **슬더스1 유물·파워·포션 모달이 Esc로 닫히지 않음**. 카드 모달만 닫힌다.
    - https://scare-the-spire.flavono123.workers.dev/compendium/sts1/relics
    - https://scare-the-spire.flavono123.workers.dev/compendium/sts1/powers
    - https://scare-the-spire.flavono123.workers.dev/compendium/sts1/potions
    - 원인: Escape 처리기가 `src/components/sts1/card-library.tsx`에만 있다.
58. **/ja 카드 모달의 링크가 영어 목록으로 보냄**. 첫 카드 타격 모달의 '병사의 스튜' 링크가 `/en/compendium/potions?potion=soldiers_stew`이고, 누르면 포션 모달이 영어로 열린다. 다른 게임 전용 언어는 재지 않았다.
    - https://scare-the-spire.flavono123.workers.dev/ja/compendium/cards
    - 원인 추정: `src/components/codex/entity-reference-links.tsx`의 `toPreviewEntity`가 `localizeHref`만 써서 게임 언어를 받지 않는다.
59. **Supabase가 멈추면 패치 빌드가 페이지마다 최대 5분씩 멈추고, 실패를 숨긴 채 표본 글로 배포함**. 2026-11-01 01:44~02:35 KST에 `/patches/2026-09-11` 14개 언어 페이지의 빌드 시점 조회가 90~300초씩 멈춰 `patch:build`가 117초에서 3,187초가 됐고, 결과 페이지는 실제 글 없이 61 KB였다(운영 207 KB). 로그에는 아무것도 남지 않는다. CI 배포 작업 제한은 60분이다.
    - https://scare-the-spire.flavono123.workers.dev/patches/2026-09-11
    - 원인: `src/lib/transfigure-data.ts`와 `src/lib/colorful-philosophers-gallery.ts`의 조회에 시간 제한이 없고, `catch`가 로그 없이 표본이나 빈 값으로 대체한다.
60. **Supabase Free 인스턴스가 메모리와 디스크 I/O 부족으로 주기적으로 멈춤**. 로그 기준 구간(KST): 10-28 22:10~10-29 02:30, 10-31 00:20~02:30, 10-31 23:35~11-01 02:55, 11-02 09:47~09:52(5xx 없이 6~24초 지연). 멈춘 동안 시스템 카탈로그 조회도 10~22초 걸렸고, 시작 직전 요청이 5분당 50개 미만인 구간도 있어 요청량이나 특정 앱 쿼리 탓이 아니다. 메모리 428 MB, 스왑 약 480 MB 사용, 부팅 47일간 스왑 인 약 5.3 TB, 디스크 읽기 약 47 TB(DB는 49 MB), iowait 2.18%(CPU steal 0, OOM 0). 원인 판단은 추론이며 EBS 버스트 잔량은 직접 보지 못했다.
    - https://supabase.com/dashboard/project/vhscirjiywwmwlafkhjh

### 2026-11-02 배포 뒤 추가

61. **sitemap의 `lastmod`에 미래 날짜가 나옴**. `/patches`, `/patches/changes`, `/patches/2026-11-12`와 각 영어판 6줄이 빌드 시점보다 뒤인 2026-11-12다.
    - https://scare-the-spire.flavono123.workers.dev/sitemap.xml
    - 원인: `src/app/sitemap.ts`가 `data/sts2-patches.json`의 패치 날짜를 그대로 쓴다.

### 2026-11-02 수정 중 추가 (남은 항목)

62. **몬스터 스킨 이름이 게임 언어로 나오지 않음**. 생성 데이터의 `spineAsset.skinVariants[].label`이 모든 언어에서 '형태 1' 같은 한국어다(30건).
    - https://scare-the-spire.flavono123.workers.dev/en/compendium/bestiary
63. **게임 요소 선택 창을 연 채 Esc를 누르면 작성창까지 닫힘**. 초안은 남는다. 코드 읽기로만 확인했다.
    - https://scare-the-spire.flavono123.workers.dev/c-c-c-combo
64. **JavaScript를 끈 게임 전용 언어 페이지의 간단 헤더가 영어이고 `/en`으로 링크**. 공용 레이아웃이 로케일을 모른다(#24의 남은 부분).
    - https://scare-the-spire.flavono123.workers.dev/ja/compendium/cards
65. **`scripts/contact.spec.ts`의 'submits a private inquiry without requesting a readable row' 1건 실패**. CI에 없는 스펙이고, navbar 변경 전 코드에서도 같았다. 가짜 환경 탓인지 기존 문제인지는 가리지 못했다.
    - https://scare-the-spire.flavono123.workers.dev/contact
66. **관리자 글 서비스 목록에 역사 강의서가 두 번 들어가 React 중복 키 오류가 남**. `Encountered two children with the same key, \`history_course\``가 개발 콘솔에 찍힌다.
    - http://localhost:3001/dev/admin (개발 전용 화면)
    - 원인: `src/lib/admin-rls-activity.ts`의 `ADMIN_POST_SERVICES`가 `DEFRAGMENT_FEDERATED_SERVICES`(이미 `history_course` 포함)를 펼친 뒤 `"history_course"`를 또 붙인다. 운영 코드도 같다.

### 2026-11-07 Supabase 이관 정리 조사에서 추가

67. **이아저? 월드컵 플레이 기록 전체가 누구에게나 열려 있음**. https://scare-the-spire.flavono123.workers.dev/this-or-that/tournament 의 플레이가 쌓이는 `favorite_tournament_plays`의 SELECT 정책 `favorite_tournament_plays_read`가 `TO public USING (true)`라, 공개 anon 키만 있으면 모든 사람의 플레이(`user_id`, 대진 `matches`, 우승 후보)를 읽을 수 있다. 앱은 이 표를 읽지 않는다(쓰기는 RPC `complete_favorite_tournament_play`, 읽기는 dev 관리 지표의 service 키뿐). 고치는 방법은 정책 삭제. 근거: `docs/supabase-exit/CLEANUP_AUDIT.md` 3.4절.
68. **역사 강의서 런을 내렸다 다시 공유하면 좋아요·댓글 수가 0부터 다시 셈**. 공유를 지우고 같은 런을 다시 올리면 `runs.like_count`·`comment_count`가 0으로 시작한다. 그런데 그 런의 좋아요·댓글 행(`history-course:<id>` 스레드)은 남아 있다. 역사 강의서 목록은 행을 직접 세어 맞게 보이지만, 조각모음 게시판의 역사 강의서 항목과 그 정렬(추천순·댓글순)은 어긋난 열을 쓴다. 근거: `docs/supabase-exit/d1-schema/notes/inventory-runs-profile.md`(D1 설계 조사, 화면으로는 확인하지 않음). D1 이관 5단계에 그 런의 좋아요나 댓글이 바뀌면(다시 올린 런은 올릴 때) 행 수로 맞춰진다. 그 뒤 활동이 없는 런에는 복사한 수가 남는다(`D1_SCHEMA_DESIGN.md` 2.3절, 10.1절).
    - https://scare-the-spire.flavono123.workers.dev/defragment
69. **꺼져 있는 상세 OG 코드가 없는 표를 읽음**. `workers/detail-shell-og.ts:460`이 어려운 결정 글을 `decisions_posts`에서 찾는데, 실제 표는 `decisions_decisions_posts`다. 지금은 상세 OG가 꺼져 있어(Worker에 Supabase 변수가 없음) 드러나지 않는다. 켜거나 D1로 옮길 때 같이 고친다.
    - https://scare-the-spire.flavono123.workers.dev/decisions-decisions
    - 덧붙임(2026-11-09, Supabase 이관 6단계): D1으로 옮기면서도 지금과 같게 질의 없이 null로 두었다(`workers/detail-shell-og.ts`의 decisions-decisions 분기). 고칠 때는 D1 `post_decisions_decisions`에서 읽고 이미지 규칙도 새로 정해야 한다. 옛 코드가 쓰던 `situation_character` 열은 실제 표에도 없다.
70. **이거 아님 저거? 좋아요가 다른 env의 글을 가리킬 수 있음**. `this_or_that_post_likes`의 INSERT 정책은 `auth.uid() = user_id`만 보고 FK는 env를 보지 않는다. 그래서 testbed 사용자가 운영 글 id에 단 좋아요(`env = development`)가 들어간다. 수와 화면은 env로 글과 맞추므로 보이지 않는다. 투표 정책에는 같은 env 확인이 있다. 2026-11-05 백업에서는 0행이다. D1 설계는 운영을 바꾸지 않는다. 동기화가 `cross_env`로 세고 넣지 않는다(`docs/supabase-exit/D1_SCHEMA_DESIGN.md` 2.2절, 10.6절).
    - https://scare-the-spire.flavono123.workers.dev/this-or-that

### 2026-11-09 Supabase 이관 6단계(상세 OG) 대조에서 추가

71. **꺼져 있는 상세 OG에서 유튜브가 든 코오오옴보 글의 og:image 주소가 깨짐**. `workers/detail-shell-og.ts`의 코오오옴보 분기는 `comboPostOgImage` 결과 앞에 늘 사이트 주소를 붙인다. 그런데 유튜브 썸네일은 이미 `https://i.ytimg.com/...` 절대 주소라 `https://scare-the-spire.comhttps://i.ytimg.com/vi/<id>/hqdefault.jpg`가 된다. 서류 폭풍 분기는 `startsWith("http")`로 거르지만 이 분기는 거르지 않는다. 지금은 상세 OG가 꺼져 있어(#32) 드러나지 않고, 켤 때 같이 고친다. 근거: 6단계 OG 이관 때 옛 Supabase 조회와 새 D1 조회를 같은 데이터로 대조한 결과(둘 다 같은 깨진 값). 화면으로는 확인하지 않았다.
    - https://scare-the-spire.flavono123.workers.dev/c-c-c-combo

### 2026-11-09 Supabase 이관 6단계(장난감 상자 WP-T1)에서 추가

73. **케미컬 X 글 상세는 읽기에 실패해도 "글을 찾을 수 없습니다"를 보임**. 다른 장난감 상자 상세(코오오옴보, 변형, 어려운 결정)는 읽기에 실패하면 "데이터베이스가 응답하지 않습니다"를 보이는데, 케미컬 X 상세는 Worker 장애나 시간 초과도 글이 없는 것처럼 보인다. 삭제가 실패해도 안내 없이 그 자리에 남는다. 6단계에서도 지금 동작 그대로 옮겼다. 근거: `src/components/chemicalx/post-view.tsx`의 읽기 효과(실패 → `post = null`)와 `handleDelete`(실패 → 그냥 return). 코드로만 확인했고 화면으로는 확인하지 않았다.
    - https://scare-the-spire.flavono123.workers.dev/chemical-x/c0789f0e-6842-42b4-bdc8-90e4256a50de
