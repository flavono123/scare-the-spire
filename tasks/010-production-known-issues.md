# Task 010: 운영에도 있는 기존 문제 모음

## 상태: TODO (대규모 리팩토링 묶음이 모두 끝난 뒤 착수)

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
