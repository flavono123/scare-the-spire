# Supabase 사용 지도(1단계 기준)

관련 문서:

- [Supabase 탈출 계획](../SUPABASE_EXIT_PLAN.md) 7.2절, 7.3절 1단계와 4단계
- [이관 중 병렬 작업 유의사항](../SUPABASE_EXIT_PARALLEL_WORK.md)
- [배포 절차](../RELEASE_PROCESS.md)
- [운영 알려진 문제](../../tasks/010-production-known-issues.md)

## 상태와 읽는 법

2026-11-05: 1단계(같은 출처 API)를 만드는 사람이 기준으로 쓸 지도다. 읽기 전용 조사 결과를 합쳤다. 영역별
조사 7개(댓글, 패치 페이지, 네비·피드, 장난감 상자 A·B, 역사 강의서·퍼즐상자, 신원·프로필·관리), 인프라 보고,
DB 보고, 누락 검토다. 조사하면서 코드와 DB는 바꾸지 않았고 Supabase에 요청하지 않았다.

표기:

- 경로는 저장소 루트 기준이고 `파일:줄`로 적는다. 3절에서는 파일 제목이 링크다.
- `schema:N`은 0단계 백업 `~/slseoun-backups/supabase/20261105-2048/public-schema.sql`의 N행이다(운영 DDL dump).
  `pub`는 같은 폴더의 `publications.csv`다. 행 수는 같은 dump의 테이블별 행 수다(두 env 합계).
- `plan:N`은 [SUPABASE_EXIT_PLAN.md](../SUPABASE_EXIT_PLAN.md)의 N행이다.
- **[추가]**: 누락 검토가 보탠 항목이다.
- **[충돌]**: 조사 결과끼리 다른 곳이다. 8.1절에 모았다.
- **정한 것**: 이 문서가 1단계용으로 고른 안이다. 바꿀 수 있다.
- 같은 호출을 영역마다 몇 줄 다르게 적은 곳이 있다(함수 시작 줄과 체인 줄). 표에는 한 줄을 적고 다른 줄은
  괄호에 둔다. 예: `56 (59)`.

## 1. 요약

### 1.1 작업 수

3절 표의 행을 센 값이다. 영역 사이에 겹치는 호출은 한 번만 셌다. 한 행이 요청 여러 건을 낼 수 있다. 예를 들어
`nav-seen.ts:303`은 한 행이지만 테이블 8개에 8건을 보낸다.

| 종류 | 수 | 설명 |
|---|---|---|
| select | 87 | PostgREST 테이블·뷰 읽기 |
| insert | 24 | |
| update | 13 | |
| delete | 27 | |
| upsert | 6 | |
| rpc | 13 | 호출 위치 수. 부르는 함수는 12개(7.3절) |
| realtime | 2 | 채널 구독 |
| auth | 10 | 세션 읽기, 익명 가입, 토큰 갱신(로컬만 읽는 것 포함) |
| rest | 2 | 직접 `fetch`하는 헬퍼(패치 정적 클라이언트, Worker OG) |
| other | 5 | 설정 굽기·읽기, 빌드 정책, 죽은 반응 코드 묶음 |
| 합계 | 189 | 이 밖에 다른 헬퍼를 부르기만 하는 호출부 5곳(종류 `call`) |

상태별:

| 상태 | 수 | 뜻 |
|---|---|---|
| 운영 | 128 | 운영 화면에서 돈다(로컬 세션 읽기 포함) |
| 대체 경로 | 19 | 열·RPC가 없을 때(11), 또는 패치 rich 번들이 차지하지 않은 루트에서만 돈다(8: 번들 실패, 빌드 뒤 새 주의 대체 릴 카드) |
| 죽은 코드 | 9 | 부르는 곳이 없거나 닿을 수 없다 |
| dev 전용 | 25 | `next dev`나 dev 도구 빌드에서만 돈다 |
| 빌드 | 7 | `next build`, `patch:build` 때 돈다 |
| 운영 꺼짐 | 1 | Worker 변수가 없어 운영·testbed에서 동작하지 않는다 |

### 1.2 화면과 플래그 그룹(정한 것)

2절에 화면 32개를 적었다. 그중 28개가 플래그 9개 가운데 하나를 따른다. 나머지 4개(신원, 상세 셸 OG, 빌드,
dev 관리)는 1단계 플래그가 없다. 플래그 이름은 plan 7.2절(plan:349-350)의 묶음을 따랐고
`colorful-philosophers`를 더했다.

| 플래그 | 덮는 화면(2절 번호) | 엔드포인트 | 고른 이유 |
|---|---|---|---|
| `nav` | 1 네비 새 글 표시, 2 댓글 배달부 | `GET /api/read/nav` | 모든 페이지에 붙는 공개 데이터 둘을 한 번에 받는다. 사용자와 무관해 60초 공개 캐시가 된다 |
| `comments` | 5 공용 댓글, 6 백과사전 상세 묶음, 7 좋아요, 8 리소스 반응, 9 목록 참여 수 | `/api/read/thread`, `/api/read/codex-thread`, `/api/read/engagement-counts`, `/api/write/comments`, `comment-likes`, `likes`, `reactions` | plan의 "댓글·좋아요·반응". 백과사전, 패치, 장난감 상자 댓글을 함께 바꾼다(병렬 작업 문서 5번) |
| `toybox-feed` | 11~18 장난감 상자 목록·상세·쓰기, 이거 vs 저거 좋아요·투표, 서류 폭풍, 조각모음 | `/api/read/toybox-feed`, `toybox-post`, `defragment-*`, `pagestorm-index`, `/api/write/toybox-posts` 등 | `useToyboxFeed`와 insert 헬퍼를 6개 서비스와 조각모음 쓰기 판이 같이 쓴다 |
| `colorful-philosophers` | 19 주간 목록, 20 글 상세, 10의 셸 패치 릴 | `/api/read/colorful-philosophers/*` | 장난감 상자도 백과사전도 아닌 별도 화면. 반응 쓰기는 `comments` |
| `stories` | 21 이야기 목록·작성(10의 패치 줄 이야기 포함) | `/api/read/stories`, `/api/write/stories` | plan의 "이야기" |
| `history-runs` | 22~25 런 목록·업로드·상세·고르기 | `/api/read/history-runs`, `history-run`, `/api/me/history-runs`, `/api/write/history-runs*` | plan의 "역사 강의서 런" |
| `puzzlebox` | 26 플레이, 27 순위표 | `/api/me/puzzlebox/standings`, `/api/read/puzzlebox/leaderboard`, `/api/write/puzzlebox/runs` | plan의 "짜증나는 퍼즐상자" |
| `profile` | 28 프로필 | `/api/me/profile`, `/api/write/profile/inquiries-seen` | plan의 "프로필 활동" |
| `contact` | 29 문의 쓰기, 3 메일함 점 | `/api/write/contact-inquiries`, `/api/me/mailbox` | 같은 테이블이고 JWT가 필요하다. `nav` 응답을 공개 캐시로 두려고 메일함 점을 여기로 뺐다 |

플래그 규칙(정한 것):

- 값은 `legacy` 또는 `api`다. 플래그가 없거나 읽지 못하면 `legacy`다. 패치 Worker의 workers.dev 주소처럼 main
  Worker를 거치지 않는 페이지도 `legacy`가 된다.
- 1단계는 그룹마다 키 하나다. 쓰기만 따로 끄는 키(`<그룹>.write`)는 열린 질문으로 남긴다(8.4절).
- 한 화면이 플래그 둘을 쓰면 플래그마다 한 번씩 부른다. 장난감 상자 상세는 글(`toybox-feed`)과 댓글(`comments`)로
  최대 2건이다. plan 7.3절의 "화면당 1~2건"(plan:410-411) 안이다.
- 엔드포인트 이름은 plan 5절의 `/api/read/*`·`/api/me/*`·`/api/write/*` 규칙(plan:155-157)에 맞췄다. 영역 조사가
  제안한 이름(`/api/codex-thread`, `/api/toybox/feed`, `/api/profile` 등)과 다르다.
- ~~공개 읽기에 `Authorization`을 같이 보내면 같은 응답에 `likedByMe` 같은 개인 필드를 붙이고
  `Cache-Control: private, no-store`로 낸다.~~ [STEP1_DESIGN.md](STEP1_DESIGN.md) 9절로 바꿨다: 공개 읽기에는
  개인 필드가 없고, 개인 필드는 그룹마다 `/api/me/<그룹>` 덧칠 한 번으로 준다.

### 1.3 페이지 한 번 볼 때의 요청 수

지금 값은 브라우저가 Supabase로 보내는 요청이다. CORS preflight는 세지 않았다(plan:81-82). 목표는 그 화면의
플래그가 모두 `api`일 때 Worker로 가는 요청이다.

| 페이지 | 지금: 화면 자체 | 지금: 공통 | 1단계 목표 | 근거 |
|---|---|---|---|---|
| 모든 Next 페이지(공통) | - | 네비 0 또는 9, 배달부 0~1, 메일함 0~1(세션), 토큰 갱신 0~1. 최대 12 | `/api/read/nav` 0~1(60초 캐시), `/api/me/mailbox` 0~1(세션). 토큰 갱신은 그대로 | `nav-seen.ts:282-326`, `comment-courier.tsx:249-260`, `use-mailbox-reply.ts:42-63`, `supabase.ts:20` |
| 모든 패치 Worker 페이지(공통) | - | 네비 9(캐시 없음), 배달부 1, 변형 릴 1 = 11. 토큰 갱신 0~1 | `/api/read/nav` 1. 변형 릴은 부르지 않는다 | `patch-nav-indicators-client.ts:25-33`, `patch-comments-client.js:1239,1498` |
| 백과사전 상세 | 익명 4~5 + 2N, 세션 7~8 + 3N. N은 그 자원의 다채로운 철학자들 글 수(≤20). 최대 45, 68 | Next 공통 | `/api/read/codex-thread` 1 | `resource-thread.tsx:63-69,26,98` |
| 몬스터·도감 목록 | `get_engagement_counts` 1. 카드 목록은 통계를 켤 때마다 1 | Next 공통 | `/api/read/engagement-counts` 1 | `monster-library.tsx:138`, `card-library.tsx:266-268` |
| 이거 vs 저거 목록 | 익명 3, 세션 5, WebSocket 1. 스크롤마다 3~5 더 | Next 공통. 장난감 상자 화면은 네비 캐시가 늘 깨져 9 | `/api/read/toybox-feed` 1(스크롤마다 1) | `use-this-or-that-likes.ts:31-96`, `use-this-or-that-votes.ts:57-136`, `nav-seen.ts:151-177` |
| 코오오옴보 목록 | 피드 1, 런 표지 최대 40(각각 raw 포함), WebSocket 1 | 같음 | 1 | `combo-history-run-reference.tsx:44-50,93-110` |
| 변형·케미컬X·어려운 결정 목록 | 피드 1, WebSocket 1 | 같음 | 1 | `use-toybox-feed.ts:70,103` |
| 이아저? 월드컵 목록 | 피드 1, 기본 대회 1, WebSocket 1 | 같음 | 1(기본 대회는 토글할 때 1) | `use-favorite-tournament-posts.ts:134` |
| 장난감 상자 상세 | 글 1, 댓글 1~3, 이거 vs 저거는 2~4 더, 좋아요 수 0~1 | 같음 | 글 1 + 댓글 1 | 2절 12번 |
| 다채로운 철학자들 목록 | 2 + 글마다 1(익명) 또는 2(세션). 글 25개면 27, 52 | Next 공통 | 1 | `index-engagement.tsx:31-32`, `use-resource-reactions.ts:125,155` |
| 패치 상세(일반) | 패치 스레드 1~3, 줄 이야기 1(200행), WebSocket 1 | 패치 공통 11 | `/api/read/patch-page` 1 | `patch-rich-comments-client.tsx:59,186` |
| 패치 상세(셸 2개: 2026-09-11, 2026-11-12) | 릴 2, 릴 카드 스레드 최대 4 × 1~3, 패치 스레드 1~3 | 패치 공통 11 | 1 | `patch-comments-client.js:1426,1463`, `patch-rich-comments-client.tsx:199-200` |
| 니오우스레터 상세 | (claim 수 + 1) × 1~3. 2026-10호는 루트 42개라 42~126 | 패치 공통 11 | 1 | `neowsletter-detail-page.tsx:159-171`, `patch-rich-comments-client.tsx:216-237` |
| `/patches/changes` | 이야기 1000행 1, WebSocket 1. 자원을 고르면 백과사전 묶음과 머리 중복(좋아요 수·내 것, 반응 수·내 것이 각 2번) | 패치 공통 11 | `/api/read/patch-page` 1 + 자원을 고를 때 `/api/read/codex-thread` 1 | `resource-patch-index-explorer.tsx:658-671,705` |
| 역사 강의서 목록 | 런 100개(7.9 MB) 1, 내 id 0~1, 참여 수 2~4, 닉네임 동기화 쓰기 0~1. 업로드 뒤 다시 | Next 공통 | `/api/read/history-runs` 1 + `/api/me/history-runs` 0~1 | `history-course-run-index.tsx:155-191,243` |
| 프로필 | 닉네임 풀 1, 통계 1, 활동 1, 문의 1(대체 경로면 2), 읽음 표시 0~1. 최대 6 | Next 공통(메일함 포함) | `/api/me/profile` 1 + 읽음 표시 0~1 | 2절 28번 |

세 줄 요약:

- 가장 큰 곱셈은 네비(페이지마다 9건, 패치 페이지는 캐시 없음), 백과사전 상세의 N+1(최대 60건 추가),
  니오우스레터의 claim별 스레드(최대 126건)다.
- 1단계 목표는 페이지마다 공통 1건(`/api/read/nav`)과 화면 1~2건이다. plan의 하루 약 5만 건 이하(plan:411)와 맞다.
- WebSocket은 이벤트를 하나도 받지 못한다(5.1절). 요청 수에는 들어가지 않지만 Supabase Realtime 연결을 쓴다.

## 2. 화면(surface)별 정리

### 2.0 스레드 키

`comments.story_id`와 `likes.story_id`는 같은 문자열 키를 쓴다. 키를 만드는 곳은
[comment-threads.ts](../../src/lib/comment-threads.ts)다.

| 키 | 만드는 곳 | 카운터 트리거 |
|---|---|---|
| `sts2-patch:<version>` | `comment-threads.ts:28-30` | 없음 |
| `neowsletter:<YYYY-MM>:<claimId>`, `neowsletter:<issue>:page` | `comment-threads.ts:32-34` | 없음 |
| `sts2-codex:<type>:<id>` | `comment-threads.ts:36-38`. type은 card, relic, potion, power, monster, event, ancient, enchantment 또는 affliction, encounter, epoch, keyword, modifier, character, badge, ascension | 없음(uuid 변환 실패로 지나감) |
| `sts1-codex:<type>:<slug>` | `comment-threads.ts:40-45` | 없음 |
| `byrdispatch` | `comment-threads.ts:47-49` | 없음 |
| `c-c-c-combo:`, `transfigure:`, `this-or-that:`, `chemical-x:`, `defragment:`, `decisions-decisions:`, `favorite-tournament:`, `pagestorm:` + 글 id | `comment-threads.ts:51-81` | 글 테이블의 like_count·comment_count(schema:253-367). this-or-that은 댓글만 |
| `history-course:<runId>` | `comment-threads.ts:83-85` | runs 카운터(schema:276-286) |
| `beta-art:<artKey>` | `comment-threads.ts:88-90` | 없음 |
| `colorful-philosophers:<postId>` | `colorful-philosophers.ts:52-54` | 없음 |
| `community:<id>`, `story:<id>` | `comment-courier.tsx:128` | 없음 |

- 자원 페이지의 좋아요는 그 댓글 스레드와 같은 키다(`comment-section.tsx:172-173`). `CommentSection`은 키에서
  `/^sts2-codex:([^:]+):(.+)$/`로 type과 id를 꺼낸다(`comment-section.tsx:165`).
- `commentThreadService`(`comment-threads.ts:111-125`)는 DB의 `admin_story_service`와 맞아야 한다.
  `commentThreadHref`(`comment-threads.ts:151-191`)는 배달부가 링크를 만들 때 쓴다.
- `comment_likes`는 `comment_id`로만 묶이고 env가 없다(schema:2664-2669). 리소스 반응은 자기 키
  `(env, resource_type, resource_id, game_version, user_id)`를 쓴다(schema:3702).
- 브라우저 저장 키: localStorage `sts-resource-reaction:<type>:<id>:<version>`(`use-resource-reactions.ts:22-24`),
  `sts-comment-draft:<threadKey>`(`comment-section.tsx:45-47`), `sts-courier-enabled`(`comment-courier.tsx:26`),
  `sts-nav-seen:<env>`·`sts-nav-menu-seen:<env>`·`sts-nav-force-v2:<env>`(`nav-seen.ts:22-28`),
  `sts-user-profile`(`user-profile.ts:26`), `sb-<project-ref>-auth-token`. sessionStorage
  `sts-mailbox-reply:<env>:<uid>`(`use-mailbox-reply.ts:13-15`), `sts-nav-unread:<env>`, `sts-puzzlebox-rank:`
  (`use-puzzlebox-scores.ts:70-103`).

### 2.1 화면 목록

| 번호 | 화면 | 플래그 | 화면 로드 때 부르는 것 | 신원 |
|---|---|---|---|---|
| 1 | 네비 새 글 표시 | `nav` | `GET /api/read/nav` | 없음 |
| 2 | 댓글 배달부 | `nav` | 1과 같은 응답 | 없음 |
| 3 | 네비 메일함 점 | `contact` | `GET /api/me/mailbox`(세션 있을 때) | JWT |
| 4 | 익명 신원과 세션 | 없음 | Supabase Auth 직접(그대로) | - |
| 5 | 공용 댓글 스레드 | `comments` | `GET /api/read/thread?key=` | 읽기 없음, 쓰기 JWT |
| 6 | 백과사전 상세 묶음 | `comments` | `GET /api/read/codex-thread?type=&id=` | 읽기 없음, 쓰기 JWT |
| 7 | 좋아요 단추 | `comments` | 각 화면 응답 안 | 쓰기 JWT |
| 8 | 리소스 반응(버프·너프·리워크) | `comments` | 각 화면 응답 안 | 쓰기 JWT(authenticated) |
| 9 | 백과사전 목록 참여 수 | `comments` | `GET /api/read/engagement-counts?prefix=` | 없음 |
| 10 | 패치 페이지 묶음 | 부분별 | `GET /api/read/patch-page?...&include=` | 읽기 없음 |
| 11 | 장난감 상자 목록 피드 | `toybox-feed` | `GET /api/read/toybox-feed` | 없음(viewer는 JWT) |
| 12 | 장난감 상자 상세 | `toybox-feed` | `GET /api/read/toybox-post` + 댓글 | 없음(viewer는 JWT) |
| 13 | 장난감 상자 쓰기·수정·삭제 | `toybox-feed` | 쓰기만 | JWT |
| 14 | 이거 vs 저거 좋아요·투표 | `toybox-feed` | 11·12 응답 안 | JWT |
| 15 | 서류 폭풍 목록·임시 저장·게시 | `toybox-feed` | `GET /api/read/pagestorm-index` | 목록 없음, 임시 저장 JWT |
| 16 | 조각모음 게시판·쓰기 판 | `toybox-feed` | `GET /api/read/defragment-feed` | 없음 |
| 17 | 조각모음 상세(고유 글, 다른 서비스 원글) | `toybox-feed` | `GET /api/read/defragment-post` 또는 `defragment-federated` | 없음 |
| 18 | 서류 폭풍의 장난감 상자 고르기 | `toybox-feed` | 모달 열 때 `defragment-feed`, 고를 때 `toybox-snapshot` | 없음 |
| 19 | 다채로운 철학자들 주간 목록 | `colorful-philosophers` | `GET /api/read/colorful-philosophers/week` | 없음 |
| 20 | 다채로운 철학자들 글 상세 | `colorful-philosophers` | `GET /api/read/colorful-philosophers/post` + 댓글 | 없음 |
| 21 | 이야기 목록·작성 | `stories` | `GET /api/read/stories` | 쓰기 JWT |
| 22 | 역사 강의서 런 목록 | `history-runs` | `GET /api/read/history-runs` + `/api/me/history-runs` | 내 것 JWT |
| 23 | 런 업로드·공유 | `history-runs` | 쓰기만 | JWT |
| 24 | 런 상세와 기증 패널 | `history-runs` | `GET /api/read/history-run` | 내 것 JWT |
| 25 | 콤보 런 고르기 | `history-runs` | 창 열 때 `GET /api/read/history-runs?fields=reference` | 없음 |
| 26 | 퍼즐상자 플레이 | `puzzlebox` | `GET /api/me/puzzlebox/standings`(세션 있을 때) | JWT |
| 27 | 퍼즐상자 순위표 | `puzzlebox` | `GET /api/read/puzzlebox/leaderboard` | 없음(내 순위는 JWT) |
| 28 | 프로필 | `profile` | `GET /api/me/profile` | JWT |
| 29 | 문의 쓰기 | `contact` | 쓰기만 | JWT |
| 30 | 상세 셸 OG(Worker) | 없음 | Worker 안 | 없음 |
| 31 | 빌드 시점 굽기 | 없음 | 빌드 | 없음 |
| 32 | dev 관리 화면 | 없음 | 배포되지 않음 | service 키 |

### 2.2 화면별 상세

아래 표의 응답 가운데 JWT로 고르는 개인 필드(`likedByMe`, `mine`, `myLikes`, `viewer`, `viewerKind(s)`, `is_me`,
`me`, around_me)는 `/api/read/*` 응답에서 빼고 `/api/me/<그룹>` 덧칠로 옮긴다. 오류 코드와 legacy 신호도
[STEP1_DESIGN.md](STEP1_DESIGN.md) 4절이 우선한다.

#### 1. 네비 새 글 표시

| 항목 | 내용 |
|---|---|
| 페이지 | 모든 Next 페이지(`src/app/layout.tsx:79` → `site-navbar.tsx:777`). 모든 패치 Worker 페이지(`/_patches/patch-nav-indicators.js`, `build-patch-worker.tsx:87-90,656,711`). dev에서는 `patch-section-tabs.tsx:25`, `nav-indicators-dev-page.tsx:40`도 마운트해 두 번 돈다 |
| 읽기 | 8개 테이블(combo, transfigure, this_or_that, favorite_tournament, chemical, decisions_decisions, pagestorm, runs)의 `created_at > since` 1행(`nav-seen.ts:303-311`). `colorful_philosopher_posts` 최신 `week_start`(`nav-seen.ts:284-293`). 패치 노트·니오우스레터는 번들 JSON이라 요청이 없다(`nav-seen.ts:14-15,271-275`) |
| 쓰기 | 없음. 본 시각은 localStorage·sessionStorage에만 있다(`nav-seen.ts:22-29`) |
| Realtime | 없음 |
| 엔드포인트 | `GET /api/read/nav`. 2번 배달부와 한 응답이다. 사용자와 무관하므로 `Cache-Control: public, max-age=60`과 인스턴스 메모리 60초 |
| 응답 | `{ env, generatedAt, latest: { combo, transfigure, "this-or-that", "favorite-tournament", "chemical-x", "decisions-decisions", pagestorm, "history-course", "colorful-philosophers" }, courier: [...] }`. 값은 ISO-Z 문자열 또는 null. 철학자는 최신 주 월요일 00:00 KST. 점은 지금처럼 클라이언트가 `latest > menuUnreadSince[id]`로 계산한다(`nav-seen.ts:16-18,139-148`) |
| 신원 | 필요 없다. 8개 테이블 읽기 정책이 모두 `USING (true)`다(schema:4793, 5440, 5413, 5069, 4719, 4948, 5177, 5323, 4732) |
| 메모 | 지금 쿼리는 브라우저마다 다른 `since`가 들어가 공유 캐시가 안 된다(`nav-seen.ts:309`). 시각은 `toISOString()`으로 맞춘다. 클라이언트는 문자열로 비교하고 PostgREST는 `+00:00`과 마이크로초를 돌려준다. Worker는 Supabase에 9건을 나눠 보내거나(subrequest) 추가 RPC를 둔다(8.4절). Next 쪽은 탭마다 60초 sessionStorage 캐시가 있지만 장난감 상자 화면을 볼 때마다 깨진다(`nav-seen.ts:29,151-177,242-269`). 패치 쪽은 캐시가 없다 |

#### 2. 댓글 배달부

| 항목 | 내용 |
|---|---|
| 페이지 | 모든 Next 페이지(`layout.tsx:82`). 모든 패치 Worker 페이지와 404(`patch-comments-client.js:1198-1296`) |
| 읽기 | 최근 14일 댓글 12개, `id, story_id, content, created_at`(`comment-courier.tsx:162-167`, `patch-comments-client.js:1239`) |
| 쓰기 | 없음. 켜기·끄기는 localStorage(`comment-courier.tsx:26,117-125`) |
| Realtime | 없음 |
| 엔드포인트 | `GET /api/read/nav`의 `courier` 필드. 14일 기준 시각을 분 단위로 잘라 캐시 키가 되풀이되게 한다. 본문 자르기(`courierCommentText`)는 Worker가 한다 |
| 응답 | `[{ id, storyId, text, createdAt }]` 12개 이하. href와 출처 이름은 클라이언트가 storyId로 만든다(`comment-courier.tsx:127-152`). 최악 약 72 KB, 보통 3 KB 미만 |
| 신원 | 필요 없다(schema:4854) |
| 메모 | 정한 것: `nav`. 댓글 영역은 `nav`, 패치 영역은 `comments`나 별도 플래그를 제안했다. (env, created_at) 색인이 없어 스캔 후 정렬이다(schema:3855-3869). 끄면 요청이 없다(`patch-comments-client.js:1202`) |

#### 3. 네비 메일함 점

| 항목 | 내용 |
|---|---|
| 페이지 | 모든 Next 페이지, 세션이 있는 사용자만(`site-navbar.tsx:792,876,913`). 패치 페이지에는 없다 |
| 읽기 | 답변이 있고 아직 안 본 문의 1행(`contact-inquiries.ts:157-166`, 부분 색인 schema:3911). sessionStorage 60초(`use-mailbox-reply.ts:9,13-27,49-63`) |
| 쓰기 | 없음. 읽음 표시는 28번 |
| 엔드포인트 | `GET /api/me/mailbox`. 세션이 있을 때만 부른다. `private, no-store` |
| 응답 | `{ mailboxUnseen: true, false 또는 null }`. null은 모름이고 이전 점을 유지한다 |
| 신원 | JWT 필수. `contact_inquiries_select_owner TO authenticated`(schema:4901), 열 권한(schema:5784-5889). anon에는 권한이 없다 |
| 메모 | 정한 것: `contact`. 신원 영역은 `nav`, 댓글 영역은 `contact`를 제안했다. 프로필의 읽음 표시와 경합해 점이 되살아날 수 있다(`profile-activity.tsx:171`) |

#### 4. 익명 신원과 세션

| 항목 | 내용 |
|---|---|
| 페이지 | 모든 페이지. `useAuth` 호출 42곳(41개 파일) |
| 읽기 | localStorage `sb-<ref>-auth-token`(`use-auth.ts:17,53`, `patch-comments-client.js:388-400`) |
| 쓰기 | `/auth/v1/signup`(`use-auth.ts:29-31`, `patch-comments-client.js:477`). `/auth/v1/token` 갱신(`supabase.ts:20`의 자동 갱신, `patch-comments-client.js:463`) |
| Realtime | 없음. `onAuthStateChange`는 로컬과 BroadcastChannel이다 |
| 엔드포인트 | 1단계에는 없다. Auth는 브라우저에서 Supabase로 바로 간다. `/api/write/*`는 `Authorization: Bearer <access_token>`을 받는다. 토큰은 호출 직전에 `supabase.auth.getSession()`에서 꺼낸다. Worker는 검증만 하고 갱신하지 않는다. 401이면 클라이언트가 supabase-js로 갱신하고 한 번 다시 보낸다. 4단계에 `/api/auth/claim`이 생긴다 |
| 신원 | - |
| 메모 | `useAuth`는 공유 상태가 없다. 인스턴스마다 `getSession`과 구독을 따로 한다. 세션을 갱신하는 곳이 둘이라(supabase-js와 `patch-comments-client.js:434-485`) refresh token 회전이 겹칠 수 있다. 패치 클라이언트는 갱신이 실패하면 새로 가입해 uid를 덮어쓴다(`patch-comments-client.js:472-483`). 동시에 `ensureUser`를 부르면 익명 가입이 둘 생길 수 있다(`run-donation.ts:366-370` 주석) |

#### 5. 공용 댓글 스레드

| 항목 | 내용 |
|---|---|
| 페이지 | 장난감 상자 상세 9곳(`chemicalx/post-view.tsx:215`, `combo-post-view.tsx:237`, `transfigure-post-view.tsx:358`, `this-or-that/post-view.tsx:266`, `favorite-tournament-post-view.tsx:298`, `decisions-decisions-post-view.tsx:225`, `defragment-post-view.tsx:249`, `defragment-federated-post-view.tsx:201`, `pagestorm-post-view.tsx:248`). 이야기(`story-feed.tsx:936`). `/byrdispatch`(`page-content.tsx:1097`). 패치 노트(`patch-detail-page.tsx:931-933,1333-1335`, `deferred-comment-section.tsx:26-76`). 니오우스레터 claim(`neowsletter-claim-thread.tsx:36-43`). 역사 강의서(`history-course-comments.tsx:91`). 베타 아트(`beta-art-engagement.tsx:98`). 다채로운 철학자들 글(`colorful-philosophers/post-view.tsx:132`). STS1(`sts1/comments-rail.tsx:34`). 셸 패치 릴 카드 |
| 읽기 | `comments` by story_id(`use-comments.ts:56`). `comment_likes` 합계와 내 것(`use-comment-likes.ts:20,34`). 패치 정적 대체 경로는 `patch-comments-client.js:873-889` |
| 쓰기 | 댓글 insert·delete(`use-comments.ts:118,145`, `patch-comments-client.js:954,1005`). 댓글 좋아요 insert·delete(`use-comment-likes.ts:62,50`, `patch-comments-client.js:993,988`) |
| Realtime | 없음 |
| 엔드포인트 | `GET /api/read/thread?key=<threadKey>`. 묶음 읽기는 `?keys=k1,k2,...`(약 64개 상한) 또는 `?prefix=neowsletter:<issue>:`(LIKE가 아니라 `story_id >= p AND < p+1` 범위). 쓰기는 `POST /api/write/comments`, `DELETE /api/write/comments/:id`, `PUT`·`DELETE /api/write/comment-likes/:commentId`. 쓰기 응답은 새 스레드 상태를 돌려줘 다시 읽지 않게 한다 |
| 응답 | `{ threadKey, comments: [{ id, userId, nickname, content, contentBlocks, createdAt, avatarId, avatarKind, paletteId, paletteSwapped, likeCount, likedByMe? }], truncated? }` |
| 신원 | 읽기는 anon(schema:4854, 4827). `likedByMe`는 JWT sub. 쓰기는 JWT(4절) |
| 메모 | `select('*')`에 limit이 없고 `content_blocks`·`meta`가 행마다 128 KB까지 된다(schema:2694). 열을 정하고 상한이나 페이지를 둔다. 지금 최대는 12행 5.7 KB(plan:285). `meta`·`parent_id`는 지금 아무 클라이언트도 읽지 않는다 [충돌]: 패치 영역의 응답안에는 `parent_id`가 들어 있다. 패치 페이지에는 클라이언트가 둘(rich React, 정적 js)이라 둘 다 api 분기가 필요하다. `ReplyLines`(`resource-thread.tsx:26`)도 같은 훅이다 |

#### 6. 백과사전 상세 묶음

| 항목 | 내용 |
|---|---|
| 페이지 | `/compendium/{cards, relics, potions, powers, monsters, events, ancients, enchantments, encounters, epochs, keywords, modifiers, characters, badges, ascensions}/[id]`와 `/[gameLocale]` 판(`card-detail.tsx:851` 등). 목록의 상세 모달(`card-library.tsx:921-925`, `monster-library.tsx:504`). `/patches/changes`의 자원 스레드(`resource-patch-index-explorer.tsx:1013`) |
| 읽기 | 5번 읽기, 좋아요 HEAD 수와 내 것(`use-likes.ts:51,76`), 반응 합계와 내 것(`use-resource-reactions.ts:125,155`, 버전은 `sts2Meta.version`, `colorful-philosophers.ts:14`), 그 자원의 철학자 글 20개(`resource-thread.tsx:63`), 글마다 답글 스레드(`resource-thread.tsx:26`)와 읽기 전용 반응 막대(`resource-thread.tsx:98-103`) |
| 쓰기 | 5번 쓰기, 7번 좋아요, 8번 반응. 첫 쓰기 때 익명 가입이 먼저 날 수 있다 |
| Realtime | 없음 |
| 엔드포인트 | `GET /api/read/codex-thread?type=card&id=X`. Worker 안에서 세 번에 나눠 약 7~8개 subrequest를 보낸다. 1차는 글·댓글·좋아요 수·반응 합계, 2차는 철학자 글 스레드와 내 것, 3차는 comment_likes다. Workers 요청은 1건이고 Free subrequest 한도 50 안이다 |
| 응답 | `{ threadKey, comments: [5번과 같음], like: { count, likedByMe? }, reactions: { gameVersion, buff, nerf, rework, mine? }, philosophers: [{ id, weekStart, slot, resourceType, resourceId, nameKo, nameEn, imageUrl, body, gameVersion, reactions: { buff, nerf, rework }, replies: [{ id, nickname, content, contentBlocks, createdAt }] }] }` |
| 신원 | 읽기 anon. `*Me`·`mine`은 JWT sub |
| 메모 | 지금 익명 4~5 + 2N, 세션 7~8 + 3N건이다. 같은 쿼리가 되풀이된다. 철학자 글의 버전이 지금 버전과 같으면 머리 쿼리를 다시 하고, `/patches/changes`는 머리 단추와 `CommentSection`이 같은 키를 두 번 읽는다(`resource-patch-index-explorer.tsx:658-671`). 읽기 전용 막대도 내 반응을 읽지만 보여 주지 않는다. 댓글 수는 클라이언트가 `comments.length`로 센다(`comment-section.tsx:112-118`). `CommentCount`(`comment-section.tsx:400-407`)는 부르는 곳이 없다 |

#### 7. 좋아요 단추

| 항목 | 내용 |
|---|---|
| 페이지 | eager: 백과사전 상세 머리(`comment-section.tsx:172-178`), `/patches/changes` 머리(`resource-patch-index-explorer.tsx:658-665`), 장난감 상자 상세(`decisions-decisions-post-view.tsx:206`, `defragment-post-view.tsx:209`, `defragment-federated-post-view.tsx:181`, `pagestorm-post-view.tsx:229`, `favorite-tournament-post-view.tsx:182`). lazy: 목록 카드(`index-card-engagement.tsx:87-99`), 몬스터 타일(`monster-library.tsx:647-655`), 이야기 줄(`story-feed.tsx:767,903`), 런 카드(`run-card.tsx:237`), 베타 아트 |
| 읽기 | HEAD 수(`initialCount`가 없을 때만, `use-likes.ts:51`). 내 것(eager `:76`, lazy는 첫 클릭 전에 `:101`) |
| 쓰기 | `likes` insert(`:154`), delete(`:134`) |
| Realtime | 없음 |
| 엔드포인트 | `PUT /api/write/likes` `{ storyId }`, `DELETE /api/write/likes` `{ storyId }`. 멱등이다. 응답이 상태를 돌려줘 lazy 모드의 먼저 읽기가 없어진다. 읽기는 각 화면 응답의 `like` 필드다 |
| 응답 | `{ liked, count }` |
| 신원 | JWT(schema:5096, 5089) |
| 메모 | 글 테이블과 runs의 like_count는 트리거가 유지한다(schema:4387, 333-362). 백과사전 키는 uuid가 아니라 카운터가 없다. `reaction_type`(기본 thumb_up, schema:2995)은 쓰지 않는다 |

#### 8. 리소스 반응(버프·너프·리워크)

| 항목 | 내용 |
|---|---|
| 페이지 | 백과사전 상세 머리('icons', `comment-section.tsx:179-185`). `/patches/changes` 머리(`resource-patch-index-explorer.tsx:666-671`). 철학자 목록(`index-engagement.tsx:32`)과 상세(`post-view.tsx:67`). 셸 패치 릴(정적 js). 철학자 글의 읽기 전용 막대(읽기만) |
| 읽기 | 합계(`use-resource-reactions.ts:125`), 내 것(`:155`) |
| 쓰기 | `choose`의 delete·update·insert(`:199-202`). 정적 `applyStaticReaction`(`patch-comments-client.js:1553-1557`). React 릴의 `saveResourceReaction`(`:86-89`)은 운영에서 닿지 않는다 [충돌] |
| Realtime | 없음 |
| 엔드포인트 | `PUT /api/write/reactions` `{ resourceType, resourceId, gameVersion, kind }`. kind는 buff, nerf, rework 또는 null. Worker가 DB를 보고 delete나 upsert를 고른다. 읽기는 화면 응답 안이다 |
| 응답 | `{ kind, counts: { buff, nerf, rework } }` |
| 신원 | JWT. update 정책이 `TO authenticated`이고 열 권한이 `UPDATE(kind)`뿐이다(schema:5296, 6064). 그래서 upsert는 충돌 때 kind만 바꾼다 |
| 메모 | 지금은 localStorage의 이전 kind로 쓰기를 고른다(`use-resource-reactions.ts:22-34,176-209`, `patch-comments-client.js:1546-1549`). 그래서 PK 충돌(schema:3702)이나 0행 update가 난다. 상세는 userId를 넘기지 않아 DB의 kind를 읽지 않는다(`post-view.tsx:67`). 합계는 트리거가 유지한다(schema:4401, 114-166) |

#### 9. 백과사전 목록 참여 수

| 항목 | 내용 |
|---|---|
| 페이지 | `/compendium/cards`(통계를 켜거나 참여 정렬일 때, `card-library.tsx:266-268,394-404,893-899`). `/compendium/monsters`, `/compendium/bestiary`(늘, `monster-library.tsx:138`, `bestiary-library.tsx:137`). 이야기 피드(`story-feed.tsx:1022`). 베타 아트(`beta-art-client.tsx:179`) |
| 읽기 | `rpc get_engagement_counts(p_env)`(`use-engagement-counts.ts:29`) |
| 쓰기 | 몬스터 타일 좋아요(7번) |
| Realtime | 없음 |
| 엔드포인트 | `GET /api/read/engagement-counts?prefix=sts2-codex:monster:`. Worker가 RPC를 한 번 부르고 접두사로 거른다. 모두에게 같은 키라 메모리 캐시가 맞을 수 있다. JWT가 있으면 그 접두사의 내 좋아요도 준다 |
| 응답 | `{ likes: {storyId: n}, comments: {storyId: n}, myLikes? }` |
| 신원 | anon(schema:5565) |
| 메모 | env 전체를 GROUP BY한다(schema:1137-1155). 지금 271행 24 KB(plan:286)이고 스레드마다 커진다. PostgREST max-rows에 잘릴 수 있다. 모듈 캐시가 없어 마운트마다, 카드 통계를 다시 켤 때마다 부른다. 접두사 거르기는 이야기·베타 아트 호출에는 동작이 바뀐다(8.4절) |

#### 10. 패치 페이지 묶음

| 항목 | 내용 |
|---|---|
| 페이지 | 모든 패치 Worker HTML: `/patches`, `/patches/changes`, `/patches/<version>`, `/patches/neowsletters`, `/patches/neowsletters/<issue>`, 각각 ko와 13개 로케일 접두사, 패치 404 |
| 읽기 | 패치 스레드 `sts2-patch:<v>`. 니오우스레터의 claim 스레드 전부(인라인 루트는 숨어 있어도 바로 마운트, `patch-rich-comments-client.tsx:199-200`. 댓글이 있는 claim은 자동으로 펼침, `:216-237`). 패치 줄 이야기 `source=patchId` 200행(`patch-rich-comments-client.tsx:59` → `use-community-stories.ts:139-144`). 셸 패치 릴(철학자 글 12개와 반응 합계, `patch-comments-client.js:1426,1463`). 변형 릴(`:1498`, 보이는 효과 없음) |
| 쓰기 | 5번 댓글, 21번 이야기, 8번 반응 |
| Realtime | 이야기 채널(이벤트 없음, 5.1절) |
| 엔드포인트 | `GET /api/read/patch-page?kind=patch&version=...` 또는 `kind=neowsletter&issue=...` 또는 `kind=list`, 그리고 `&include=threads,stories,reel`. `include`에는 플래그가 `api`인 부분만 넣고, 모두 `legacy`면 부르지 않는다. 이름에 `/api/patches`를 쓰지 않는다(`main-worker.ts:59` 정규식, 6.9절) |
| 플래그 | 부분별: `threads`는 `comments`, `stories`는 `stories`, `reel`은 `colorful-philosophers`. 네비·배달부는 1·2번 |
| 응답 | `{ threads?: {threadKey: 5번 응답}, stories?: [21번 행], reel?: { weekStart, posts: [{ id, slot, resourceType, resourceId, nameKo, nameEn, imageUrl, body, gameVersion, counts: { buff, nerf, rework } }] } }`. 릴은 약 1~2 KB |
| 신원 | 읽기 anon. 개인 필드는 JWT |
| 메모 | 패치 페이지는 하이드레이션하지 않는다(`backstab-colorful-philosophers-section.tsx:56-60` 주석). 실제로 도는 코드는 `patch-comments-client.js`와 빌드가 만드는 번들 셋이다. `patch-rich-comments.js`, `patch-nav-indicators.js`, `resource-patch-index.js`(`build-patch-worker.tsx:731-741`) **[추가]**. 모두 빌드 때 구운 설정만 읽는다(`build-patch-worker.tsx:652-656,686-695`). 플래그 전달은 6.3절. 니오우스레터 묶음 응답도 상한이 없으니 상한이나 요약(닫힌 claim은 수만)이 필요하다. 변형 릴은 api 경로에서 부르지 않는다. 다시 넣는다면 카드 렌더 열만 쓴다(`select *`는 행마다 MB, schema:3435) |

#### 11. 장난감 상자 목록 피드

| 항목 | 내용 |
|---|---|
| 페이지 | `/c-c-c-combo`, `/transfigure`, `/this-or-that`, `/this-or-that/tournament`, `/chemical-x`, `/decisions-decisions`와 로케일 판 |
| 읽기 | `get_toybox_feed` 20행(`toybox-feed.ts:314`). RPC가 없을 때의 대체 select(`:274`). 이거 vs 저거는 좋아요 수 뷰와 내 좋아요(`use-this-or-that-likes.ts:43,52`), 투표 요약과 내 투표(`use-this-or-that-votes.ts:65,74`)를 쌓인 id 전부로 더 보기마다 다시 읽는다. 월드컵은 기본 대회 전부(`use-favorite-tournament-posts.ts:134`). 콤보는 런 표지(`run-donation.ts:566`) |
| 쓰기 | 7번 좋아요, 14번 이거 vs 저거, 13번 작성 |
| Realtime | `${table}_feed`(`use-toybox-feed.ts:103`). 이벤트는 없고 실패하면 화면이 unavailable이 된다(`:128-132`) |
| 엔드포인트 | `GET /api/read/toybox-feed?service=&sort=&cursor=<score>~<createdAt>~<id>`. service는 combo, transfigure, chemical_x, decisions_decisions, this_or_that, favorite_tournament. sort는 latest, recommended, comments, vote_rate_high, vote_rate_low(이거 vs 저거만), play_count(월드컵만)(`toybox-feed.ts:58-64`). 월드컵 기본 대회는 `&presets=1`로, 토글을 켤 때만 부른다. 로드, 정렬 변경, 더 보기마다 1건 |
| 응답 | `{ items: [{ id, created_at, like_count, comment_count, recommend_score, post }], hasMore, nextCursor: { score, createdAt, id } 또는 null, viewer?: { likedIds, votes: {id: "left" 또는 "right"} }, coversByRunId?: {runId: CoverSpec} }`. RPC 행 모양을 유지해 `parseToyboxFeedRow`(`toybox-feed.ts:165-195`)와 서비스별 정규화 함수를 그대로 쓴다. 다음 커서는 서버가 `cursorFromFeedItem` 규칙(`:229-252`)으로 만든다. viewer는 그 페이지 id만이다 |
| 신원 | anon(schema:5648, SECURITY INVOKER라 테이블 읽기 정책). viewer는 JWT sub. 이거 vs 저거 좋아요는 anon으로도 남의 것이 보이고(schema:5357), 투표는 자기 것만 보인다(schema:5386) |
| 메모 | Worker는 service·sort 허용 목록과 커서 형식(정수, ISO, uuid)을 검사한다. 지금 keyset 문자열은 큰따옴표만 지운다(`toybox-feed-keyset.ts:11-14`). RPC 대체 경로는 옮기지 않는다(운영에 RPC가 있다, schema:1916). 이거 vs 저거의 좋아요 수·투표 요약은 행의 카운터 열과 같은 값이라 따로 읽지 않는다(schema:4415, 4422, 1995-2001). 콤보 표지는 정한 것: 피드 응답 안에 넣는다. `post`를 줄일지는 서비스마다 정한다(어려운 결정 목록은 `placements`를 쓴다, `decisions-decisions-client.tsx:158`) |

#### 12. 장난감 상자 상세

| 항목 | 내용 |
|---|---|
| 페이지 | `/transfigure/<id>`, `/c-c-c-combo/<id>`, `/chemical-x/<id>`, `/decisions-decisions/<id>`, `/this-or-that/<id>`, `/this-or-that/tournament/<id>`, `/pagestorm/<id>`와 로케일 판. 모두 `StaticDetailShell`이 경로에서 id를 꺼낸다(`static-detail-shell.tsx:31-46`). 조각모음 상세 안의 임베드도 같다 |
| 읽기 | 행 하나 `select *`(`use-transfigure-posts.ts:529`, `use-combo-posts.ts:246`, `chemicalx/post-view.tsx:58`, `use-decisions-decisions-posts.ts:172`, `use-this-or-that-posts.ts:179`, `use-pagestorm-posts.ts:303`). 월드컵은 글과 후보 통계를 병렬로(`use-favorite-tournament-posts.ts:180,189`). 이거 vs 저거는 좋아요·투표 2~4건 더. 콤보는 참조마다 런 표지(`combo-history-run-reference.tsx:196`). 5번 댓글. `initialCount`가 없는 상세의 좋아요 HEAD 수 |
| 쓰기 | 13번 수정·삭제. 월드컵 플레이 RPC(`use-favorite-tournament-posts.ts:246`)와 이어지는 통계 다시 읽기(`:271`). 7번 좋아요, 14번 이거 vs 저거 |
| Realtime | 없음 |
| 엔드포인트 | `GET /api/read/toybox-post?service=&id=`. like_count를 같이 줘서 좋아요 단추가 수를 따로 읽지 않게 한다. 댓글은 5번 엔드포인트로 따로 1건(`comments` 플래그). 월드컵 플레이는 `POST /api/write/favorite-tournament/:id/plays`. Worker가 RPC 뒤 통계를 다시 읽어 `{ play_count, stats }`를 돌려준다 |
| 응답 | `{ post, likeCount, commentCount, viewer?: { liked, choice }, stats?: [{ resource_type, resource_id, match_appearances, match_wins, championships, current_rank, rank_history }], covers?: {runId: CoverSpec} }`. 없으면 404 `{ notFound: true }`, 장애면 503. 둘을 나눈다(케미컬X는 지금 장애 때 '없음'을 보여 준다) |
| 신원 | anon. viewer는 JWT. 플레이는 JWT 필수 |
| 메모 | 좋아요 단추는 어려운 결정 상세에만 있다(변형·콤보·케미컬X 상세에는 없다). 후보 통계는 102행 28 KB를 쟀고(plan:287) `rank_history`가 플레이마다 자란다. 서류 폭풍 글 하나도 1 MB(압축)까지 된다 |

#### 13. 장난감 상자 쓰기·수정·삭제

| 항목 | 내용 |
|---|---|
| 페이지 | 각 목록의 작성기. `/defragment` 쓰기 판(`defragment-write-panel.tsx:295,301,314,335,345,351,360`). 각 상세의 수정·삭제 |
| 읽기 | 없음 |
| 쓰기 | insert: transfigure `use-transfigure-posts.ts:391`, combo `use-combo-posts.ts:81`, chemical `use-chemical-posts.ts:54`, decisions `use-decisions-decisions-posts.ts:58`, this_or_that `use-this-or-that-posts.ts:68`, favorite_tournament `use-favorite-tournament-posts.ts:63`, pagestorm `use-pagestorm-posts.ts:56`. update: transfigure `:360`, combo `:117`, decisions `:93`, pagestorm `:87`, defragment `use-defragment-posts.ts:116`. delete: transfigure `:576`, combo `:294`, chemical `chemicalx/post-view.tsx:81`, decisions `:207`, this_or_that `:208`, favorite_tournament `:224`, pagestorm `:338`, defragment `use-defragment-posts.ts:145` |
| Realtime | 없음 |
| 엔드포인트 | `POST /api/write/toybox-posts?service=`(본문은 지금 클라이언트가 만드는 insert 값), `PATCH /api/write/toybox-posts/:service/:id`, `DELETE /api/write/toybox-posts/:service/:id`. `Prefer: return=representation`으로 보내 0행이면 404나 403을 낸다 |
| 응답 | 201 `{ post }`. 422와 code 23514(작성기를 열어 두고 화면을 unavailable로 바꾸지 않는다). 401. 503 |
| 신원 | JWT. 정책과 트리거는 4절 |
| 메모 | 쓰기 판이 같은 insert 헬퍼를 쓰므로(`defragment-write-panel.tsx:10-25`) 같은 플래그를 따른다. 죽은 경로는 옮기지 않는다: 목록의 `remove`(`use-combo-posts.ts:205`, `use-chemical-posts.ts:118`, `use-decisions-decisions-posts.ts:145`, `use-this-or-that-posts.ts:139`, `use-favorite-tournament-posts.ts:112`), 닿지 않는 목록 수정·삭제(`use-transfigure-posts.ts:458,483`, `use-combo-posts.ts:181`; `editingPost`가 늘 null, `transfigure-client.tsx:96,109,139`, `combo-client.tsx:92,96,120`), `insertDefragmentPost`(`use-defragment-posts.ts:84`) |

#### 14. 이거 vs 저거 좋아요·투표

| 항목 | 내용 |
|---|---|
| 페이지 | `/this-or-that` 목록(`this-or-that-client.tsx:74-75`), 상세(`post-view.tsx:67-68`), 조각모음 게시판의 이거 vs 저거 항목(`defragment-client.tsx:150`) |
| 읽기 | 11·12번 응답의 viewer |
| 쓰기 | 좋아요 insert(`use-this-or-that-likes.ts:120-122`) **[추가]**, delete(`:115`). 투표 insert(`use-this-or-that-votes.ts:159`), delete(`:206`) |
| Realtime | 없음 |
| 엔드포인트 | `PUT`·`DELETE /api/write/this-or-that/:id/like`. `PUT`·`DELETE /api/write/this-or-that/:id/vote` `{ choice, surface }` |
| 응답 | 좋아요 `{ liked, likeCount }`. 투표 `{ choice, left, right }` |
| 신원 | JWT. 투표 insert는 같은 env의 원글이 있어야 한다(schema:5377-5379) |
| 메모 | 정한 것: `toybox-feed`. 장난감 상자 B 영역은 쓰기를 `comments`로 제안했다. 전용 테이블이라 화면과 같은 플래그로 둔다. 투표 요약 RPC는 id가 50개를 넘으면 오류를 낸다(schema:1873-1875). 목록이 3페이지를 넘으면 투표가 막힌다(8.3절) |

#### 15. 서류 폭풍 목록·임시 저장·게시

| 항목 | 내용 |
|---|---|
| 페이지 | `/pagestorm`, `/pagestorm/write`, `/pagestorm/write?draft=<uuid>`와 로케일 판 |
| 읽기 | 글 50개를 문서 전체와 함께(`use-pagestorm-posts.ts:264`). 세션이 있으면 내 임시 저장 20개(`:226`). `?draft=`면 그 임시 저장(`:189`) |
| 쓰기 | 게시(`:56`) 뒤 임시 저장 삭제(`:169`)를 연달아. 임시 저장 insert·update·delete(`:133,151,169`) |
| Realtime | 없음 |
| 엔드포인트 | `GET /api/read/pagestorm-index`. 글과, JWT가 있으면 임시 저장을 한 번에 준다. Worker가 썸네일과 요약을 만들고 문서는 빼서 응답을 줄인다. `GET /api/me/pagestorm-drafts/:id`. `POST /api/write/pagestorm-drafts`, `PATCH`·`DELETE /api/write/pagestorm-drafts/:id`. 게시는 `POST /api/write/toybox-posts?service=pagestorm` `{ ..., fromDraftId? }`로 게시와 임시 저장 삭제를 한 번에 |
| 응답 | 목록 `{ posts: [{ id, user_id, nickname, title, snippet, created_at, 작성자 토큰, thumbnailUrl, thumbnailKind }], drafts?: [같은 모양] }`. 임시 저장 `{ id, title, nickname, content, content_text, updated_at }`. 게시 `{ post: { id } }` |
| 신원 | 글은 anon(schema:5177). 임시 저장은 JWT(schema:5143). anon이면 오류 없이 빈 결과라 토큰이 없는 것과 데이터가 없는 것이 구별되지 않는다 |
| 메모 | 50개 문서는 약 180 KB로 추정한다(20행 72 KB 실측, plan:283). 실측이 필요하다. 썸네일 계산은 `pagestorm.ts:167-186` |

#### 16. 조각모음 게시판·쓰기 판

| 항목 | 내용 |
|---|---|
| 페이지 | `/defragment`와 로케일 판(`DefragmentClient`) |
| 읽기 | `get_defragment_feed_v2`(`defragment-feed.ts:254`). 종류를 고르면 `get_toybox_feed`(`:148`)나 runs(`:175`). 이거 vs 저거 좋아요 2건(`defragment-client.tsx:150`). 세션이 있으면 그 전에 runs 닉네임 동기화 쓰기를 기다린다(`defragment-client.tsx:74-86,102` → `run-donation.ts:664`) |
| 쓰기 | 13번 insert, 이어서 `defragment_bodies` upsert(`use-defragment-bodies.ts:116`, `defragment-write-panel.tsx:190`, `defragment-submit.ts:20-56`), 덧글 본문 다시 시도(`defragment-write-panel.tsx:264`), 14번 좋아요 |
| Realtime | 없음. `defragment_posts_feed` 채널은 커밋 e42cb181(2026-08-20)에서 지워졌다 |
| 엔드포인트 | `GET /api/read/defragment-feed?sort=&service=&cursor=`. JWT가 있으면 그 페이지의 이거 vs 저거 내 좋아요를 같이 준다. `POST /api/write/defragment-posts` `{ service, fields, overlayBlocks? }`는 원글 insert 뒤 본문 upsert를 하고 `{ post, overlay: "saved", "failed" 또는 "rejected" }`를 돌려준다(지금의 부분 실패 결과를 유지). `PUT /api/write/defragment-bodies/:service/:sourceId`(다시 시도) |
| 응답 | `{ items: [{ id, service, title(120자 이하), nickname, user_id, avatar_id, avatar_kind, palette_id, palette_swapped, created_at, like_count, comment_count, recommend_score, history_meta? }], hasMore, nextCursor, viewer?: { totLikedIds } }`. v2 RPC 행과 같아 `parseDefragmentFeedRow`(`defragment-feed.ts:64-99`)를 그대로 쓴다 |
| 신원 | 읽기 anon(schema:5556). 본문 upsert는 JWT와 authenticated 역할, `defragment_source_owned`(schema:4975, 4989, 5530-5532) |
| 메모 | v2는 8갈래 UNION이라 한 페이지에 최대 160행을 읽는다(schema:911-1118). 게시판은 고유 글(`defragment_posts`)을 보여 주지 않는다. 닉네임 동기화를 화면 GET에서 뺄지는 8.4절 |

#### 17. 조각모음 상세

| 항목 | 내용 |
|---|---|
| 페이지 | `/defragment/[id]`(고유 글, 직접 링크로만 닿음). `/defragment/[service]/[postId]`(다른 서비스 원글과 덧글 본문)와 로케일 판 |
| 읽기 | 고유 글 `select *`(`use-defragment-posts.ts:162`). 덧글 본문(`use-defragment-bodies.ts:83`)과 임베드한 원글 화면의 읽기(12번). `initialCount` 없는 좋아요 HEAD 수(`defragment-federated-post-view.tsx:153-163`). 5번 댓글 |
| 쓰기 | 고유 글 수정·삭제(`use-defragment-posts.ts:116,145`). 임베드의 쓰기(삭제는 임베드에서 숨김) |
| Realtime | 없음. 다만 `defragment_posts`는 publication에 든 유일한 테이블이라 수정·삭제와 카운터 갱신이 WAL로 나간다(schema:317-319, 347-349) |
| 엔드포인트 | `GET /api/read/defragment-post?id=`. `GET /api/read/defragment-federated?service=&id=`는 `{ overlay, source }`를 주고 source는 12번 응답과 같다. `PATCH`·`DELETE /api/write/toybox-posts/defragment/:id` |
| 응답 | 고유 글 `{ post: { id, user_id, nickname, title, content, content_text, created_at, avatar_id, avatar_kind, palette_id, palette_swapped, like_count, comment_count } }` 또는 404. 임베드 `{ overlay: { nickname, user_id, content, content_text, updated_at } 또는 null, source }` |
| 신원 | 읽기 anon. 쓰기 JWT |
| 메모 | 지금 고유 글 읽기는 PostgREST 오류를 모두 '없음'으로 바꾼다(`use-defragment-posts.ts:155-169`). 고유 글의 수정·삭제 엔드포인트가 필요한지는 8.4절 |

#### 18. 서류 폭풍의 장난감 상자 고르기

| 항목 | 내용 |
|---|---|
| 페이지 | `/pagestorm` 편집기 모달(`pickers.tsx:135-195`, `pagestorm-editor.tsx:690`) |
| 읽기 | `useDefragmentFeed('latest', service)`(`use-pagestorm-toybox.ts:40`). 서비스를 고르면 전체 post를 받고 요약만 남긴다(`defragment-feed.ts:149-162`). 고르면 그 행을 `select *`로 다시 읽는다(`use-pagestorm-toybox.ts:62-71`) |
| 쓰기 | 없음 |
| Realtime | 없음 |
| 엔드포인트 | 목록은 `GET /api/read/defragment-feed?service=<transfigure, this_or_that 또는 decisions_decisions>&sort=latest`(요약만). 고르기는 `GET /api/read/toybox-snapshot?service=&id=` |
| 응답 | `{ row: { loadPagestormToyboxSnapshot이 쓰는 필드 } 또는 null }` |
| 신원 | anon |
| 메모 | 어려운 결정 행 하나는 rows·placements가 각각 1 MB까지 된다(schema:2839) |

#### 19. 다채로운 철학자들 주간 목록

| 항목 | 내용 |
|---|---|
| 페이지 | `/colorful-philosophers`와 로케일 판(`index-view.tsx:42`) |
| 읽기 | 글 100개(`use-colorful-philosopher-posts.ts:41`). 댓글 행을 받아 세기(`:238`, limit 1000). 카드마다 반응 합계(`use-resource-reactions.ts:125`)와, 세션이 있으면 내 반응(`:155`) |
| 쓰기 | 8번 반응 |
| Realtime | 없음 |
| 엔드포인트 | `GET /api/read/colorful-philosophers/week`. 글, 댓글 수(GROUP BY), 반응 합계, JWT가 있으면 내 반응을 한 번에 |
| 응답 | `{ posts: [{ id, weekStart, slot, resourceType, resourceId, nameKo, nameEn, imageUrl, body, gameVersion }], commentCounts: {postId: n}, reactionCounts: {"type:id:version": { buff, nerf, rework }}, viewerKinds? }`. 약 10 KB(plan:288) |
| 신원 | anon(schema:4732). viewerKinds는 JWT |
| 메모 | 정한 것: 별도 플래그. 장난감 상자 A 영역은 별도 또는 `toybox-feed`를 제안했다. 지금 글 25개에 약 52건이다. 미래 주 예약(최대 8주)이 모두에게 가고 클라이언트에서만 숨긴다(`index-view.tsx:44-47`). 묶음 읽기 함수 `fetchResourceReactionCounts`(`use-resource-reactions.ts:37`)가 이미 있는데 목록이 쓰지 않는다. 댓글 수는 1000을 넘으면 적게 센다 |

#### 20. 다채로운 철학자들 글 상세

| 항목 | 내용 |
|---|---|
| 페이지 | `/colorful-philosophers/<id>`(`post-view.tsx:60-67`) |
| 읽기 | 글(`use-colorful-philosopher-posts.ts:117`), 반응 합계(`use-resource-reactions.ts:125`), 5번 댓글 |
| 쓰기 | 8번 반응 |
| Realtime | 없음 |
| 엔드포인트 | `GET /api/read/colorful-philosophers/post?id=`. 댓글은 5번 |
| 응답 | `{ post, reactionCounts: { buff, nerf, rework }, viewerKind? }` |
| 신원 | anon. viewerKind는 JWT |
| 메모 | 지금 상세는 DB의 내 반응을 읽지 않는다. viewerKind를 주면 PK 충돌 문제가 풀린다. Worker OG에는 이 경로가 없다 |

#### 21. 이야기 목록·작성

| 항목 | 내용 |
|---|---|
| 페이지 | `/`(`StoryFeed`, `story-feed.tsx:1021`). `/byrdispatch`(작성 단추만, `byrdispatch-story-composer-button.tsx:26,53,60`). 패치 상세(`patch-rich-comments-client.tsx:59,158,168`, source=patchId, 200행). `/patches/changes`(`resource-patch-index-explorer.tsx:705,1040,1049`, 1000행). 작성 모달 `story-composer-modal.tsx:173-193`. dev의 `patch-note-with-story-actions.tsx:301,380,390` |
| 읽기 | `community_stories` 19열, env, 선택적 source, 최신순, limit 100·200·1000(`use-community-stories.ts:137-144`) |
| 쓰기 | insert(`:207`), delete(`:248`), 정적 작성기 insert(`patch-comments-client.js:663`, rich 번들이 실패할 때만) |
| Realtime | `community_stories` INSERT 채널(`use-community-stories.ts:163-179`). 이벤트 없음 |
| 엔드포인트 | `GET /api/read/stories?source=&limit=`(200 이하). `POST /api/write/stories`. `DELETE /api/write/stories/:id`는 `{ deleted: 0 또는 1 }` |
| 응답 | `{ rows: [rowToStory가 읽는 19열] }`(`use-community-stories.ts:17-37,94-115`). POST는 `{ row }` |
| 신원 | 읽기 anon(schema:4881). 쓰기 JWT |
| 메모 | `/byrdispatch`는 `.add`만 쓰는데 100행 읽기와 채널을 연다. `/patches/changes`의 1000행은 128 KB를 넘을 수 있다(행마다 `tags`·`linked_entities` 128 KB까지, schema:2740). 줄별 수 엔드포인트를 검토한다. (env, source, created_at) 색인이 없다. 작성 모달의 `supabaseEnabled` 검사(`story-composer-modal.tsx:41,171,329-349`)도 플래그를 알아야 한다 |

#### 22. 역사 강의서 런 목록

| 항목 | 내용 |
|---|---|
| 페이지 | `/history-course`와 로케일 판(`history-course-landing.tsx:68` → `history-course-run-index.tsx:163`) |
| 읽기 | 런 100개, raw 포함(`run-donation.ts:230`). 세션이 있으면 내가 기증한 id(`:648`). 참여 수 likes·comments(`use-history-course-engagement.ts:41,50`). IndexedDB의 내 런 |
| 쓰기 | 세션이 있으면 닉네임 동기화(`run-donation.ts:664`). 공유(`:305`), 공유 취소·삭제(`:711`), 표지 저장(`:485`) |
| Realtime | 없음 |
| 엔드포인트 | `GET /api/read/history-runs?limit=100&sort=latest, likes 또는 comments&cursor=`(색인 schema:4142, 4156, 4135). `GET /api/me/history-runs`는 JWT sub로 내 id를 준다. `POST /api/write/history-runs`, `DELETE /api/write/history-runs/:id`(`{ deleted }`), `PATCH /api/write/history-runs/:id/cover` |
| 응답 | `{ runs: [{ id, seed, build, character, characters, ascension, win, start_time, run_time, total_floors, badges, cover_spec, like_count, comment_count, created_at }], next_cursor }`. `/api/me`는 `{ ids }` |
| 신원 | 목록 anon(schema:5323). 내 것은 JWT sub. 쓰기 JWT |
| 메모 | raw를 빼려면 raw에서 꺼내던 값의 대안이 먼저 있어야 한다: 파티 캐릭터(`run-donation.ts:159`), 배지(`:144`), 하이라이트(`:145-146`), 자동 표지 다시 고르기(`:126-132`), 검색 요소와 game_mode(`history-course-search.ts:168-187`), 소유자 표지 편집기(`history-course-run-index.tsx:394-405,548`). 새 열(`characters`, `game_elements`)과 기존 687행 backfill은 운영 DB 쓰기라 승인이 필요하다. backfill 전에는 raw를 빼면 옛 행이 달라진다. 그 전에 켜려면 raw를 그대로 흘려보내야 하고, Worker가 7.9 MB를 파싱하면 CPU 한도를 넘는다(plan:289). raw를 뺀 목록은 약 54 KB(plan:290), 배지와 캐릭터를 넣으면 70~80 KB로 본다. 참여 수는 runs의 트리거 카운터(schema:276-286)로 바꾼다(일치 확인 필요). 공개 목록이 `donor_user_id`를 내보낸다. 업로드 뒤 목록을 다시 받는 대신 낙관적으로 합친다 |

#### 23. 런 업로드·공유

| 항목 | 내용 |
|---|---|
| 페이지 | `/history-course`의 `RunUploadZone`(`history-course-landing.tsx:43`, `run-upload-zone.tsx:136-204`) |
| 읽기 | IndexedDB만 |
| 쓰기 | 묶음 upsert(`run-donation.ts:409`, 열이 없을 때 다시 시도 `:418-421`, `:429-432` **[추가]**). 수동 표지가 바뀐 런마다 표지 update를 차례로(`run-upload-zone.tsx:193-204`). 세션이 없으면 익명 가입 |
| Realtime | 없음 |
| 엔드포인트 | `POST /api/write/history-runs/batch` `{ runs: [{ id, raw, seed, build, character, characters, ascension, win, start_time, run_time, acts_count, total_floors, badges, highlight_card, highlight_relic, cover_spec, game_elements }] }`. 수동 표지 갱신도 같은 호출에서 처리한다. 클라이언트가 약 1 MB로 나눈다 |
| 응답 | `{ inserted: [], existing: [], coverUpdated: [], failed?: [{ id, reason }] }` |
| 신원 | JWT(schema:5316) |
| 메모 | 1단계 Worker는 본문을 JSON.parse하지 않고 흘려보낸다. JWT 서명과 Content-Length만 본다. RLS가 `donor_user_id = sub`를 검사한다. raw 상한 2 MB를 지금 API에 둔다. D1 행 한도가 2 MB인데 Postgres는 8 MB까지 받는다(schema:3267). 8초 타임아웃이 이미 커밋된 묶음을 실패로 알릴 수 있다(`run-donation.ts:413`). '이미 있음'은 보낸 수에서 돌아온 수를 뺀 값이라 다른 사람이 기증한 행도 센다(`:453-460`) |

#### 24. 런 상세와 기증 패널

| 항목 | 내용 |
|---|---|
| 페이지 | `/history-course/[runId]`와 로케일 판(`page-content.tsx:81`, `deferred-run-detail-loader.tsx:7`). `/defragment/[id]/[postId]`의 history_course(`defragment-federated-post-view.tsx:177`) |
| 읽기 | IndexedDB에 없으면 런 하나(raw 포함, 최대 293 KB, `run-donation.ts:194`). IDB 사본에 표지가 없으면 `getDonatedRunOgFields`(`:521`). 기증 패널의 `isRunDonated`(`:607`), `isOwnDonation`(`:627`) |
| 쓰기 | 공유(`:305`), 공유 취소(`:711`) |
| Realtime | 없음 |
| 엔드포인트 | `GET /api/read/history-run?id=`는 `{ run: { id, raw, cover_spec, character } 또는 null }`(gzip, HTML에 넣지 않는다). `?fields=meta`는 `{ exists, character, cover_spec }`(IDB에 있을 때. `getDonatedRunOgFields`와 `isRunDonated`를 대신한다). 소유는 22번의 `/api/me/history-runs` |
| 응답 | 위와 같음 |
| 신원 | anon. 소유는 JWT sub |
| 메모 | 로더는 raw와 cover_spec만 쓴다(`run-detail-loader.tsx:138-151`). 나머지 열은 raw에서 다시 만든다. Supabase 장애와 '없는 런'이 같은 빈 화면이다(`run-detail-loader.tsx:154-159`). IDB 'donation-cache' 사본(`run-store.ts:15-20`)이 다시 받기를 막는다 |

#### 25. 콤보 런 고르기

| 항목 | 내용 |
|---|---|
| 페이지 | `/c-c-c-combo` 작성 모달(`combo-composer-modal.tsx:52`), `/c-c-c-combo/<id>` 수정, `/defragment` 쓰기 판(`defragment-write-panel.tsx:436`). 모두 `ComboHistoryRunPicker`(`combo-history-run-picker.tsx:62-104`) |
| 읽기 | 런 30개, raw 포함 3.1 MB(`run-donation.ts:268`). IndexedDB |
| 쓰기 | 공유하지 않은 내 런을 고르면 기증(`combo-history-run-picker.tsx:155`) |
| Realtime | 없음 |
| 엔드포인트 | `GET /api/read/history-runs?sort=start_time&limit=30&fields=reference`. 기증은 `POST /api/write/history-runs` |
| 응답 | `{ runs: [{ id, character, characters, start_time, ascension, win, total_floors, run_time, build, seed, cover_spec }] }`. 약 15 KB로 본다 |
| 신원 | anon. 기증 JWT |
| 메모 | 함수 주석은 raw를 받지 않는다고 하지만 받는다(`run-donation.ts:688-693` vs `:101`). raw는 자동 표지 다시 고르기에만 쓴다(`history-run-reference.ts:66-73`). (env, start_time) 색인이 없다 |

#### 26. 퍼즐상자 플레이

| 항목 | 내용 |
|---|---|
| 페이지 | `/vexing-puzzlebox`(`connections-client.tsx:258`), `/vexing-puzzlebox/beta-art`(`beta-art-quiz.tsx:187`)와 로케일 판 |
| 읽기 | 세션이 있으면 내 순위(`use-puzzlebox-scores.ts:242`), 5분 sessionStorage |
| 쓰기 | 판이 끝나면 제출(`:133`), 이어서 내 순위 다시 읽기(`connections-client.tsx:475`, `beta-art-quiz.tsx:269`) |
| Realtime | 없음 |
| 엔드포인트 | `GET /api/me/puzzlebox/standings?game=`(세션이 없으면 부르지 않는다). `POST /api/write/puzzlebox/runs` `{ game, board, run, player }`는 결과와 그 게임의 내 순위를 함께 준다 |
| 응답 | `{ result: { score, perfect, attempt, improved, best, best_perfect, rank, players }, standings: [{ board, score, perfect, rank, players }] }` |
| 신원 | JWT, authenticated만(schema:5593, 5698-5700) |
| 메모 | 판별 최고 점수 지도(`p_boards`)를 클라이언트가 만든다(`connections-client.tsx:254-257`, `beta-art-quiz.tsx:183-186`). Worker가 정적 데이터로 만들 수 있다. 제출 오류는 '너무 많은 판'(54000)까지 모두 숨긴다(`use-puzzlebox-scores.ts:141-146`) |

#### 27. 퍼즐상자 순위표

| 항목 | 내용 |
|---|---|
| 페이지 | `/vexing-puzzlebox/rankings`와 로케일 판(`rankings-client.tsx:366`) |
| 읽기 | `get_puzzlebox_leaderboard`(`use-puzzlebox-scores.ts:194`), 10행과 내 것, 통계. 키마다 5분 sessionStorage |
| 쓰기 | 없음 |
| Realtime | 없음 |
| 엔드포인트 | `GET /api/read/puzzlebox/leaderboard?game=&board=total 또는 N&offset=&around_me=0 또는 1`. 토큰이 없으면 키별로 캐시할 수 있다. 있으면 전달하고 개인 응답이다 |
| 응답 | `{ players, offset, rows: [{ rank, score, perfect, perfect_count, boards, attempts, achieved_at, nickname, tag, avatar_id, avatar_kind, palette_id, palette_swapped, is_me }], me, stats }` |
| 신원 | anon(schema:5602). `is_me`·`me`·around_me는 JWT(schema:1467, 1473, 1477) |
| 메모 | 호출마다 모든 선수를 합산하고 순위를 매긴다(schema:1433-1451, 1482) |

#### 28. 프로필

| 항목 | 내용 |
|---|---|
| 페이지 | `/profile`, `/[gameLocale]/profile`(`profile-page.tsx:89,289`) |
| 읽기 | 닉네임 풀(`use-profile-character-nicknames.ts:17`, 세션과 무관). 세션이 있으면 활동 통계(`use-profile-activity.ts:108`), 활동 목록(`:151`, 더 보기 `:192`), 내 문의(`contact-inquiries.ts:123`, 대체 `:132`) |
| 쓰기 | 답변을 아직 안 본 문의가 있으면 읽음 표시(`contact-inquiries.ts:180`, `profile-activity.tsx:165-172`) |
| Realtime | 없음 |
| 엔드포인트 | `GET /api/me/profile?category=all&sort=latest`. 토큰이 없으면 닉네임 풀만 준다. `GET /api/me/profile/activity?category=&sort=&offset=`(필터·정렬·더 보기). `POST /api/write/profile/inquiries-seen`(GET 응답에 안 본 답변이 있을 때만) |
| 응답 | `{ nicknamePools: { ko, en } 또는 null, stats?: {category: { postCount, likeCount }}, activity?: { items: [{ activityId, category, content, contentBlocks, targetKey, createdAt, likeCount }], totalCount }, inquiries?: [{ id, category, message, status, adminResponse, replySeenAt, createdAt }] }` |
| 신원 | JWT. 활동 RPC는 authenticated만 실행한다(schema:5574-5576, 5583-5585) |
| 메모 | 지금 최대 6건(문의가 대체 경로면 7건). 활동 한 페이지가 128 KB를 넘을 수 있다. chemical·combo `content`가 행마다 1 MB(압축)까지다(schema:2574, 2650). 문의 목록은 env 필터가 없어 두 env 행을 다 준다(`contact-inquiries.ts:123-130`). 읽음 표시의 타임아웃은 catch하지 않는다(`profile-activity.tsx:171`). 닉네임 풀은 env가 없고 10행 이하라 정적 JSON으로 뺄 수 있다(8.4절) |

#### 29. 문의 쓰기

| 항목 | 내용 |
|---|---|
| 페이지 | `/contact`, `/[gameLocale]/contact`(`contact-page.tsx`) |
| 읽기 | 없음 |
| 쓰기 | `contact_inquiries` insert(`contact-inquiries.ts:97`). 먼저 `ensureUser`(`contact-page.tsx:88`) |
| Realtime | 없음 |
| 엔드포인트 | `POST /api/write/contact-inquiries` `{ category, message, replyEmail, pagePath, serviceLocale, gameLocale, viewportWidth, viewportHeight }`. Worker가 user_id를 JWT sub로, env를 자기 값으로 넣고 pagePath를 다시 정리한다. `Prefer: return=minimal`로 보낸다 |
| 응답 | 201 `{}`. 429 `{ error: "rate_limited" }`(P0001 `contact_inquiry_rate_limited`). 400 `{ error: "invalid" }`(23514). 401·403(42501). 503 |
| 신원 | JWT, authenticated만(schema:4894). authenticated는 `reply_email`·`user_id`·viewport 열을 SELECT할 수 없어 return=representation은 실패한다 |
| 메모 | 트리거가 같은 사용자·env로 1시간 3건까지 받는다(schema:605-613) |

#### 30. 상세 셸 OG(Worker)

| 항목 | 내용 |
|---|---|
| 페이지 | 장난감 상자 상세 HTML, 런 상세 HTML, `/defragment/<service>/<id>`. RSC 요청에는 적용하지 않는다(`main-worker.ts:301`) |
| 읽기 | Worker의 PostgREST 1행 GET(`detail-shell-og.ts:223-252`). 대상: runs(`:285-288`), combo(`:311-316`), chemical(`:337-341`), this_or_that(`:358-367`, 월드컵도 이 테이블로), transfigure(`:384-397`), pagestorm(`:413-419`), defragment(`:434-440`), decisions_posts(`:456-460`). colorful-philosophers, defragment-favorite_tournament, defragment-history_course는 null로 떨어진다(`:103-123,477`) |
| 쓰기 | 없음 |
| Realtime | 없음 |
| 엔드포인트 | 없음. 6단계에 D1 binding으로 바꾼다(plan:469) |
| 신원 | Worker env의 anon 키 |
| 메모 | Worker에 Supabase 변수가 없어 운영과 testbed에서 꺼져 있다(`tasks/010-production-known-issues.md:139-141`). Cloudflare에서 직접 확인하지는 않았다. 성공만 1시간 캐시하고(`detail-shell-og.ts:622-633`) Cache API는 workers.dev에서 효과가 없다. 테이블 오류 두 건은 8.3절 |

#### 31. 빌드 시점 굽기

| 항목 | 내용 |
|---|---|
| 페이지 | 셸 패치 2개의 HTML(`patch-detail-page.tsx:843-849`). `patch:build`(`build-patch-worker.tsx:919,939`)와 `next build`(`src/app/(main)/patches/[version]/page.tsx:28`, `src/app/[gameLocale]/patches/[version]/page.tsx:34`) |
| 읽기 | `transfigure_posts` 15개(`transfigure-data.ts:35`, `:52` **[추가]**). `colorful_philosopher_posts` 12개(`colorful-philosophers-gallery.ts:43`). 반응 합계(`:76`) |
| 엔드포인트 | 없음. 3단계에 HTML 주입으로 바꾸고 6단계에 지운다(plan:257-258) |
| 메모 | 5.2절 |

#### 32. dev 관리 화면

| 항목 | 내용 |
|---|---|
| 페이지 | `/dev/admin`(`admin-dev-page.tsx`), `/dev/colorful-philosophers`(`actions.ts`), `/api/dev/history-course-runs`(`ProdRunsDevSection`), 네비 dev 메뉴의 다음 주 점(`use-colorful-philosopher-posts.ts:83`) |
| 읽기·쓰기 | 3절 마지막 표 |
| 엔드포인트 | Worker에는 없다. 정적 전용 main Worker는 `/dev`를 내보내지 않고, 배포는 dev 도구 빌드를 거부한다(`build-record.mjs:221-226`) |
| 신원 | service 키(`SUPABASE_SECRET_KEY`), 일부는 anon |
| 메모 | 개발자 PC에서 운영 행을 쓸 수 있다(철학자 env 토글, 닉네임 풀, 문의 답변). 5단계 뒤에는 D1 우선 쓰기와 outbox를 우회하게 되니 경로를 바꿔야 한다 |

## 3. 작업(operation) 전체 목록

파일별로 모았다. 종류 열의 `call`은 직접 호출이 아니라 다른 헬퍼를 부르는 자리다. 언제 열 앞의 "대체 경로:",
"죽은 코드:", "dev 전용:", "빌드:", "운영 꺼짐:"은 1.1절 상태별 수에 쓴다. 아무것도 없으면 운영이다.

신원 열: `anon`은 anon 키만으로 된다는 뜻이다(세션이 있으면 supabase-js가 사용자 JWT를 붙이지만 결과는 같다).
`JWT`는 사용자 JWT가 있어야 한다. `JWT·auth`는 authenticated 역할까지 필요하다. 정책 번호는 schema 줄이다.

### 3.1 댓글·좋아요·반응

[src/hooks/use-comments.ts](../../src/hooks/use-comments.ts) — 부르는 곳: `CommentSection`(`comment-section.tsx:103`), `ReplyLines`(`resource-thread.tsx:26`). 8초 타임아웃(`supabase-timeout.ts:1,11-26`), 재시도 없음(`supabase.ts:18`).

| 줄 | 함수 | 종류 | 대상 | 내용 | 신원 | 언제 |
|---|---|---|---|---|---|---|
| 56 (59) | useComments | select | comments | `select('*')` story_id·env, created_at 오름차순, limit 없음. 안 쓰는 parent_id·meta도 온다 | anon(4854) | 마운트, storyId가 바뀔 때(`:80`). userId가 바뀌어도 다시 읽지 않는다 |
| 118 | add | insert | comments | 본문 `:103-115`. env와 작성자 토큰을 클라이언트가 정한다. 보이는 글자 2~200, 저장 2000 이하(`:92-100`) | JWT(4847) | 작성 제출(`comment-section.tsx:133-156`) |
| 145 | remove | delete | comments | `eq('id')`만. 0행이어도 화면에서 지운다(`:149-153`) | JWT(4840) | 휴지통, 작성자만 보임 |

[src/hooks/use-comment-likes.ts](../../src/hooks/use-comment-likes.ts) — 부르는 곳: `CommentSection`(`comment-section.tsx:128`). 타임아웃 없음.

| 줄 | 함수 | 종류 | 대상 | 내용 | 신원 | 언제 |
|---|---|---|---|---|---|---|
| 20 (21) | effect | select | comment_likes | `select('comment_id').in(ids)`. 클라이언트가 행을 세어 합계를 낸다(`:24-29`). max-rows에 잘림 | anon(4827) | id 목록이나 userId가 바뀔 때(`:43`). 내 작성·삭제 뒤, 로그인 뒤에도 |
| 34 (35) | effect | select | comment_likes | 내 좋아요 `eq('user_id')`. 오류는 무시 | anon으로도 된다. API는 JWT sub | 같은 effect, 세션이 있을 때 |
| 50 | toggle | delete | comment_likes | 결과를 보지 않는다. 낙관적 반영만 | JWT(4813) | 댓글 좋아요 클릭 |
| 62 | toggle | insert | comment_likes | 결과를 보지 않는다. UNIQUE(3510) 위반도 좋아요로 보인다 | JWT(4820) | 댓글 좋아요 클릭 |

[src/hooks/use-likes.ts](../../src/hooks/use-likes.ts) — 부르는 곳: `LikeButton`(`like-button.tsx:32`), `IndexCardEngagement`, 몬스터 타일. 8초 타임아웃.

| 줄 | 함수 | 종류 | 대상 | 내용 | 신원 | 언제 |
|---|---|---|---|---|---|---|
| 51 (54) | count effect | select | likes | HEAD `count=exact`. initialCount가 있으면 건너뛴다 | anon(5103) | 마운트 |
| 76 | eager status | select | likes | 내 좋아요 maybeSingle | anon으로도 된다. API는 JWT sub | 마운트, userId 변화(익명 가입 직후 포함) |
| 101 | resolveUserStatus | select | likes | lazy 모드가 첫 쓰기 전에 읽는다 | 같음 | 첫 클릭 |
| 134 (137) | toggle | delete | likes | story_id·user_id·env. 오류면 되돌림 | JWT(5089) | 좋아요 클릭 |
| 154 (157) | toggle | insert | likes | reaction_type은 기본값 thumb_up | JWT(5096), UNIQUE 3622 | 좋아요 클릭 |

[src/hooks/use-resource-reactions.ts](../../src/hooks/use-resource-reactions.ts) — 부르는 곳: `ResourceReactionBar`(`resource-reaction-bar.tsx:50`), `index-engagement.tsx:32`, `colorful-philosophers/post-view.tsx:67`, `backstab-colorful-philosophers-section.tsx:186,246`. 타임아웃 없음.

| 줄 | 함수 | 종류 | 대상 | 내용 | 신원 | 언제 |
|---|---|---|---|---|---|---|
| 42 | fetchResourceReactionCounts | select | resource_reaction_counts | `in('resource_id')`. 종류·버전 필터가 없어 클라이언트가 거른다 | anon(5262) | dev 전용: 패치 React 릴(`backstab-…:186`). [충돌] 댓글 영역은 패치 상세마다 1건으로 봤다 |
| 86 | saveResourceReaction | delete | resource_reactions | 이전 kind는 localStorage(`:22-34`) | JWT(5275) | dev 전용: 패치 React 릴 클릭(`backstab-…:246`) |
| 88 | saveResourceReaction | update | resource_reactions | `update({kind})`. 다른 기기면 0행이어도 성공 | JWT·auth(5296, 6064) | dev 전용: 같음 |
| 89 | saveResourceReaction | insert | resource_reactions | localStorage가 비면 PK 충돌 | JWT(5282), PK 3702 | dev 전용: 같음 |
| 125 | counts effect | select | resource_reaction_counts | PK 조회 maybeSingle | anon(5262) | 마운트: 백과사전 머리, 철학자 글마다, `/patches/changes`, 철학자 목록 카드마다·상세 |
| 155 | user-kind effect | select | resource_reactions | 결과를 localStorage에 쓴다. 읽기 전용 막대도 읽는다 | anon으로도 된다(5289). API는 JWT sub | 마운트, userId 변화 |
| 199 | choose | delete | resource_reactions | 같은 kind를 다시 누름 | JWT(5275) | 반응 클릭(`resource-reaction-bar.tsx:77-83,123-129`) |
| 201 | choose | update | resource_reactions | kind 바꿈. 0행이어도 성공 | JWT·auth(5296, 6064) | 반응 클릭 |
| 202 | choose | insert | resource_reactions | 처음 누름. 오류면 되돌림(`:212-218`) | JWT(5282) | 반응 클릭 |

[src/hooks/use-engagement-counts.ts](../../src/hooks/use-engagement-counts.ts) — 부르는 곳: `card-library.tsx:266-268`, `monster-library.tsx:138`, `bestiary-library.tsx:137`, `story-feed.tsx:1022`, `beta-art-client.tsx:179`.

| 줄 | 함수 | 종류 | 대상 | 내용 | 신원 | 언제 |
|---|---|---|---|---|---|---|
| 29 (31) | effect | rpc | get_engagement_counts | env의 모든 story 키를 GROUP BY(schema:1134-1156). 모듈 캐시 없음 | anon(5565) | 마운트, `enabled`가 켜질 때마다 |

[src/hooks/use-history-course-engagement.ts](../../src/hooks/use-history-course-engagement.ts) — 부르는 곳: `history-course-run-index.tsx:243`.

| 줄 | 함수 | 종류 | 대상 | 내용 | 신원 | 언제 |
|---|---|---|---|---|---|---|
| 41 (44) | hook | select | likes | `history-course:<runId>` 키 in, limit 1000. 클라이언트가 센다(`:64-75`) | anon(5103) | 정렬된 run-id 키가 바뀔 때(보통 2번) |
| 50 (53) | hook | select | comments | 같음. likes와 병렬(`:40`) | anon(4854) | 같음 |

[src/components/colorful-philosophers/resource-thread.tsx](../../src/components/colorful-philosophers/resource-thread.tsx) — 부르는 곳: `CommentSection`(`comment-section.tsx:165,169-191`). 타임아웃 없음, 오류는 무시.

| 줄 | 함수 | 종류 | 대상 | 내용 | 신원 | 언제 |
|---|---|---|---|---|---|---|
| 63 | ColorfulPhilosopherResourceThread | select | colorful_philosopher_posts | 그 자원의 글 limit 20. (env, resource_type, resource_id) 색인 없음(3757만 있음) | anon(4732) | 마운트. 글마다 `ReplyLines`와 읽기 전용 반응 막대가 따라 붙는다 |

[src/components/comment-courier.tsx](../../src/components/comment-courier.tsx) — 부르는 곳: `src/app/layout.tsx:82`. 타임아웃 없음.

| 줄 | 함수 | 종류 | 대상 | 내용 | 신원 | 언제 |
|---|---|---|---|---|---|---|
| 162 | loadCourierSession | select | comments | 최근 14일 12개. 모듈 캐시(`:37-39`)는 soft navigation에서만 남는다 | anon(4854) | 하드 로드마다, 켜져 있을 때(`:249-260`) |

[src/lib/contact-inquiries.ts](../../src/lib/contact-inquiries.ts) — 부르는 곳: `contact-page.tsx:95-106`, `profile-activity.tsx:143-172`, `use-mailbox-reply.ts:59`(네비). 8초 타임아웃.

| 줄 | 함수 | 종류 | 대상 | 내용 | 신원 | 언제 |
|---|---|---|---|---|---|---|
| 97 (96) | submitContactInquiry | insert | contact_inquiries | select 없음(return=minimal). 메시지에 `contact_inquiry_rate_limited`가 있으면 전용 오류(`:111-115`) | JWT·auth(4894) | 문의 제출 |
| 123 | listOwnContactInquiries | select | contact_inquiries | 8열, 최신순 limit 50. env 필터 없음 | JWT·auth(4901), 열 권한 | 프로필 마운트, 세션이 있을 때 |
| 132 | listOwnContactInquiries | select | contact_inquiries | reply_seen_at 없이 다시. 열이 없을 때만(`:57-63`). 운영에는 열이 있다(2767) | JWT·auth | 대체 경로: 열 없음 오류 뒤 |
| 157 (158) | hasUnseenContactReply | select | contact_inquiries | `select('id')` env, 답변 있음, 안 봄, limit 1 | JWT·auth(4901) | 네비 마운트, 세션 있고 60초 캐시가 비었을 때 |
| 180 (182) | markOwnContactRepliesSeen | update | contact_inquiries | `reply_seen_at = now`. 반환 없음 | JWT·auth(4908, 5889) | 프로필에서 안 본 답변이 있을 때(`profile-activity.tsx:171`) |

### 3.2 신원과 클라이언트

[src/lib/supabase.ts](../../src/lib/supabase.ts) — 51개 파일이 import한다. `supabaseEnv`(`:8`), 재시도 끔(`:18`), `isCheckViolation`(`:11-13`).

| 줄 | 함수 | 종류 | 대상 | 내용 | 신원 | 언제 |
|---|---|---|---|---|---|---|
| 20 | 모듈 범위 createClient | auth | /auth/v1/token(refresh) | 만들 때 GoTrue initialize가 돈다. 토큰이 90초 안에 끝나면 갱신하고, 탭이 보이는 동안 30초 ticker가 돈다(auth-js GoTrueClient.js:294-299, 4081, 4126-4129, 4463) | refresh token | import할 때(네비 import 사슬로 모든 페이지). 보통 0건, 만료 뒤 1건 |

[src/hooks/use-auth.ts](../../src/hooks/use-auth.ts) — 42곳에서 부른다. 8초 auth 타임아웃(`supabase-timeout.ts:2`).

| 줄 | 함수 | 종류 | 대상 | 내용 | 신원 | 언제 |
|---|---|---|---|---|---|---|
| 17 | ensureUser | auth | getSession | 로컬 읽기. 만료가 가까우면 갱신 | 로컬 | 첫 쓰기 때. userId가 있으면 건너뜀(`:14`) |
| 29-31 | ensureUser | auth | /auth/v1/signup | `signInAnonymously`. 모든 `onAuthStateChange` 구독이 userId를 바꿔 개인 읽기가 한꺼번에 다시 돈다 | anon | 세션 없는 첫 쓰기(댓글, 좋아요, 반응, 문의, 런, 퍼즐 등) |
| 53 (55) | mount effect | auth | getSession | 인스턴스마다. 세션이 없어도 로그인하지 않는다(`:65-66`) | 로컬 | 마운트 |
| 78 | mount effect | auth | onAuthStateChange | 로컬 구독, 네트워크 없음 | - | 마운트 |

[src/hooks/use-community-stories.ts](../../src/hooks/use-community-stories.ts) — 부르는 곳: `story-feed.tsx:1021`, `byrdispatch-story-composer-button.tsx:26`, `patch-rich-comments-client.tsx:59`, `resource-patch-index-explorer.tsx:705`, `patch-note-with-story-actions.tsx:301`(dev).

| 줄 | 함수 | 종류 | 대상 | 내용 | 신원 | 언제 |
|---|---|---|---|---|---|---|
| 139 | effect | select | community_stories | 19열, env, 선택적 source, 최신순, limit 100(기본, `:15`)·200·1000 | anon(4881) | 마운트, limit·source 변화 |
| 163 (164) | effect | realtime | community_stories INSERT | publication에 없어 이벤트가 오지 않는다. `.subscribe()`에 콜백 없음 | anon(+토큰) | 마운트. 해제는 `:183` |
| 207 (211) | add | insert | community_stories | 19열 select single. 결과를 앞에 붙임 | JWT(4874) | 이야기 작성 |
| 248 (252) | remove | delete | community_stories | id·user_id·env. count 없음 | JWT(4867) | 삭제(`story-feed.tsx:1219`) |

### 3.3 패치 페이지

[src/components/patches/patch-comments-client.js](../../src/components/patches/patch-comments-client.js) — import 없음. 묶지 않고 `/_patches/patch-comments.js`로 복사된다(`build-patch-worker.tsx:665`). 모든 패치 Worker 페이지가 `main()`(`:1035`)을 돈다.

| 줄 | 함수 | 종류 | 대상 | 내용 | 신원 | 언제 |
|---|---|---|---|---|---|---|
| 77 | readConfig | other | #sts-patch-comments-config | 빌드 때 구운 URL·키·env. 없으면 null(`:83`) | - | 로드 |
| 393 | readStoredSession, writeStoredSession | auth | localStorage sb-<ref>-auth-token | supabase-js와 같은 키와 모양(`:388-408`) | 세션 | 쓰기 전, loadState |
| 434 | authRequest | auth | /auth/v1/* 헬퍼 | anon 키, 8초 AbortController(`:380-386`) | anon | ensureSession이 부름 |
| 463 | ensureSession | auth | /auth/v1/token(refresh) | 만료 60초 전(`:457`) | refresh token | 쓰기 클릭(`:941,979,643,1543`) |
| 477 | ensureSession | auth | /auth/v1/signup | 갱신이 어떤 이유로든 실패해도 가입해 세션을 덮어쓴다(`:472-483`) | anon | 쓰기 클릭 |
| 487 | restRequest | rest | /rest/v1/* 헬퍼 | 8초. 이 파일의 REST는 모두 여기를 거친다 | anon 또는 토큰 | 아래 행 |
| 663 | openStoryComposer | insert | community_stories | 정적 작성기. rich 번들이 있으면 덮개를 지운다(`patch-rich-comments-client.tsx:113-120`) | JWT(4874) | 대체 경로: rich 번들이 실패했을 때 |
| 873 | loadState | select | comments | `select=*` limit 없음 | anon(4854) | 대체 경로: rich가 차지하지 않은 루트, 새 주의 대체 릴 카드(`:1065-1076,1415`) |
| 881 | loadState | select | comment_likes | 좋아요 행 전부 | anon(4827) | 대체 경로: 같음 |
| 887 | loadState | select | comment_likes | 내 것. 만료를 보지 않고 토큰을 보내 401이 날 수 있다(`:874`) | 토큰 | 대체 경로: 같음 |
| 954 | mountRoot submit | insert | comments | return=representation, 이어서 reload 2~3건(`:967`) | JWT(4847) | 대체 경로: 제출 |
| 988 | mountRoot | delete | comment_likes | 이어서 reload(`:1011`) | JWT(4813) | 대체 경로: 클릭 |
| 993 | mountRoot | insert | comment_likes | 이어서 reload | JWT(4820) | 대체 경로: 클릭 |
| 1005 | mountRoot | delete | comments | 남의 것은 204·0행 | JWT(4840) | 대체 경로: 클릭 |
| 1239 | mountCourier | select | comments | 배달부. 메인 사이트와 같은 쿼리 | anon(4854) | 모든 패치 페이지 로드(꺼져 있으면 없음, `:1202`) |
| 1426 | refreshReelWeek | select | colorful_philosopher_posts | 최신 주 limit 12. 스택이 없으면 보내지 않는다(`:1424`) | anon(4732) | 셸 패치 로드 |
| 1463 | refreshReelCounts | select | resource_reaction_counts | `in(ids)` 뒤 type:id:version으로 맞춤 | anon(5262) | 셸 패치 로드 |
| 1498 | refreshLiveReels | select | transfigure_posts | id·title·nickname limit 15. 스택 확인 전에 보낸다. 보이는 효과 없음(`:1509-1514`, `backstab-transfigure-section.tsx:256`) | anon(5440) | 모든 패치 페이지 로드(404 포함) |
| 1553 | applyStaticReaction | delete | resource_reactions | 이전 kind는 localStorage만 | JWT(5275) | 셸 릴 반응 클릭(`:1522-1534`) |
| 1555 | applyStaticReaction | update | resource_reactions | DB에 행이 없으면 0행인데 성공으로 보임 | JWT·auth(5296, 6064) | 셸 릴 반응 클릭 |
| 1557 | applyStaticReaction | insert | resource_reactions | 409면 조용히 끝. `:1543`의 ensureSession은 try 밖 | JWT(5282) | 셸 릴 반응 클릭 |

[src/components/patches/backstab-colorful-philosophers-section.tsx](../../src/components/patches/backstab-colorful-philosophers-section.tsx)

| 줄 | 함수 | 종류 | 대상 | 내용 | 신원 | 언제 |
|---|---|---|---|---|---|---|
| 169 | useEffect | select | colorful_philosopher_posts | limit 12, 이어서 `:186` 합계, `:246` 쓰기 | anon(4732) | dev 전용: 하이드레이션 때만. `/dev/patch-types`(`patch-types-dev-page.tsx:135-136`)에서만 닿는다 |

[src/components/patches/backstab-transfigure-section.tsx](../../src/components/patches/backstab-transfigure-section.tsx)

| 줄 | 함수 | 종류 | 대상 | 내용 | 신원 | 언제 |
|---|---|---|---|---|---|---|
| 105 | useEffect | select | transfigure_posts | `select('*')` limit 15. content·upgraded_content가 각 1 MB까지 | anon(5440) | dev 전용: 하이드레이션 때만 |

[src/components/patches/patch-rich-comments-client.tsx](../../src/components/patches/patch-rich-comments-client.tsx) — `patch-rich-comments.js`로 묶인다. 정적 클라이언트보다 먼저 돌아 모든 루트를 차지한다(`:186-193`).

| 줄 | 함수 | 종류 | 대상 | 내용 | 신원 | 언제 |
|---|---|---|---|---|---|---|
| 186 | mountRichPatchComments | call | CommentSection 경유 comments, comment_likes | 인라인 루트(니오우스레터 claim, 릴 카드)는 숨어 있어도 바로, 기본 루트는 화면 320px 안에서. claim 수·자동 펼침이 이 즉시 로드에 기댄다(`:216-237`). `:59`의 PatchStorySurface는 `useCommunityStories` | anon, 쓰기 JWT | 로드, 근접 |

[src/components/patches/patch-nav-indicators-client.ts](../../src/components/patches/patch-nav-indicators-client.ts) — `/_patches/patch-nav-indicators.js`(`build-patch-worker.tsx:87-90,711`). nav-seen과 supabase-js를 같이 묶는다.

| 줄 | 함수 | 종류 | 대상 | 내용 | 신원 | 언제 |
|---|---|---|---|---|---|---|
| 27 | sync | call | fetchUnreadSurfaceIds 9건 | sessionStorage 캐시 없이 `readMenuUnreadSince`로 부른다(`:25-30`) | anon | 스크립트 로드(`:32`), NAV_SEEN_EVENT(`:33`) |

[scripts/build-patch-worker.tsx](../../scripts/build-patch-worker.tsx)

| 줄 | 함수 | 종류 | 대상 | 내용 | 신원 | 언제 |
|---|---|---|---|---|---|---|
| 652 | renderShell | other | 설정 JSON과 `/_patches/*.js` 태그 | URL·anon 키·env를 모든 페이지 HTML에 굽는다(`:652-656`). 묶음 번들에는 esbuild define(`:686-695`). `resource-patch-index.js`(`:731-741`) **[추가]**. 런타임에 HTML을 고치는 곳은 없다 | anon 키를 모두에게 공개 | 빌드: `patch:build` |

[workers/patch-worker.ts](../../workers/patch-worker.ts)

| 줄 | 함수 | 종류 | 대상 | 내용 | 신원 | 언제 |
|---|---|---|---|---|---|---|
| 53 | fetch | other | ASSETS | Supabase도 HTMLRewriter도 없다. 없는 페이지는 로케일 404, no-store, ETag 지움(`:35-49`). main Worker의 PATCH_WORKER binding으로만 들어온다 | - | 모든 패치 경로 요청 |

[src/lib/transfigure-data.ts](../../src/lib/transfigure-data.ts) — 부르는 곳: `patch-detail-page.tsx:848`.

| 줄 | 함수 | 종류 | 대상 | 내용 | 신원 | 언제 |
|---|---|---|---|---|---|---|
| 35 | queryPosts | select | transfigure_posts | 새 클라이언트(`:12`), `select('*')` limit 15, 30초 abort. 프로세스마다 promise 캐시(`:21-31`) | anon(빌드 env) | 빌드: 셸 패치 2개, `patch:build`와 `next build` |
| 52 | queryPosts 두 번째 | select | transfigure_posts | production이 아닌 빌드에서 0행이면 production 행을 다시 읽는다(`:46-56`) **[추가]** | anon | 빌드: 같음 |

[src/lib/colorful-philosophers-gallery.ts](../../src/lib/colorful-philosophers-gallery.ts) — 부르는 곳: `patch-detail-page.tsx:849,864`, `patch-types-dev-page.tsx:136`.

| 줄 | 함수 | 종류 | 대상 | 내용 | 신원 | 언제 |
|---|---|---|---|---|---|---|
| 43 | fetchGalleryPosts | select | colorful_philosopher_posts | 옛 카운터 열 포함, 이번 주 이하 limit 12, 30초 | anon(4732) | 빌드 |
| 76 | withResourceReactionCounts | select | resource_reaction_counts | 실패하면 옛 카운터로(`:97-99`) | anon(5262) | 빌드 |

[src/lib/build-supabase-read.ts](../../src/lib/build-supabase-read.ts)

| 줄 | 함수 | 종류 | 대상 | 내용 | 신원 | 언제 |
|---|---|---|---|---|---|---|
| 12 | buildQuerySignal, reportBuildDataFailure | other | 빌드 읽기 정책 | `BUILD_SUPABASE_TIMEOUT_MS` 기본 30초(`:12-15`). env=production이고 `ALLOW_BUILD_WITHOUT_SUPABASE≠1`이면 throw(`:31-37`). `build-supabase-read.spec.ts`가 시험 | - | 빌드 |

### 3.4 네비와 피드

[src/lib/nav-seen.ts](../../src/lib/nav-seen.ts) — 부르는 곳: `useNavSeen`(`use-nav-seen.ts:26-56`) ← `site-navbar.tsx:777`. `patch-nav-indicators-client.ts:27`. `fetchUnreadSurfaceIds`(`:317-326`)가 9건을 `Promise.all`로 보낸다.

| 줄 | 함수 | 종류 | 대상 | 내용 | 신원 | 언제 |
|---|---|---|---|---|---|---|
| 284 | weeklyHasNewer | select | colorful_philosopher_posts | `week_start <= 이번 주` 최신 1행. 처음 보는 브라우저는 늘 점(`:69`) | anon(4732) | 9건 가운데 1건 |
| 303 | surfaceHasNewer | select | combo, transfigure, this_or_that, favorite_tournament, chemical, decisions_decisions, pagestorm 글, runs | 테이블마다 `created_at > since` limit 1(`:304-311`). 8건. 색인 있음 | anon | 마운트·경로 변경·NAV_SEEN_EVENT, 60초 캐시가 빌 때 |

[src/lib/toybox-feed.ts](../../src/lib/toybox-feed.ts) — 부르는 곳: `use-toybox-feed.ts:70,148`, `defragment-feed.ts:148`.

| 줄 | 함수 | 종류 | 대상 | 내용 | 신원 | 언제 |
|---|---|---|---|---|---|---|
| 312 (314) | fetchToyboxFeedPage | rpc | get_toybox_feed | p_env, p_service, p_sort, p_limit 20, 커서 셋. post = `to_jsonb(p.*)`. 첫 페이지 13~79 KB | anon(5648) | 마운트, 정렬 변경, 더 보기 |
| 274 | fetchLatestTablePage | select | 서비스 테이블 | `select *` latest만, 정렬 무시 | anon | 대체 경로: PGRST202·42703(`:131-141,333-335`) |

[src/hooks/use-toybox-feed.ts](../../src/hooks/use-toybox-feed.ts) — 부르는 곳: `use-combo-posts.ts:155`, `use-transfigure-posts.ts:432`, `use-this-or-that-posts.ts:109`, `use-favorite-tournament-posts.ts:90`, `use-chemical-posts.ts:92`, `use-decisions-decisions-posts.ts:123`.

| 줄 | 함수 | 종류 | 대상 | 내용 | 신원 | 언제 |
|---|---|---|---|---|---|---|
| 70 | useToyboxFeed | call | fetchToyboxFeedPage | 첫 페이지. 오류면 unavailable, 목록 비움(`:88-94`) | anon | 마운트, service·sort·table 변화 |
| 148 | loadMore | call | fetchToyboxFeedPage | 마지막 항목 커서, id로 중복 제거 | anon | 스크롤 |
| 103 | realtime effect | realtime | `${table}_feed` UPDATE·DELETE | 이벤트 없음. CHANNEL_ERROR·TIMED_OUT이면 unavailable(`:128-132`, join 10초). 해제 `:135` | anon(+토큰) | 마운트 |

[src/lib/defragment-feed.ts](../../src/lib/defragment-feed.ts) — 부르는 곳: `use-defragment-feed.ts:60,92` ← `defragment-client.tsx:102`, `use-pagestorm-toybox.ts:40`.

| 줄 | 함수 | 종류 | 대상 | 내용 | 신원 | 언제 |
|---|---|---|---|---|---|---|
| 252 (254) | fetchDefragmentFeedPage | rpc | get_defragment_feed_v2 | 7개 글 테이블 + runs UNION, 요약 행, 커서 id는 text. 종류를 고르면 `:148`에서 get_toybox_feed | anon(5556) | 마운트(닉네임 동기화 뒤), 정렬·종류 변경, 더 보기 |
| 268 | fetchDefragmentFeedPage | rpc | get_defragment_feed | v1, uuid 커서. 둘 다 없으면 빈 페이지(`:286`) | anon(5547) | 대체 경로: v2가 없을 때 |
| 175 | fetchHistoryCourseDefragmentPage | select | runs | raw 제외 11열, keyset or() 문자열(`:183-192`) | anon(5323) | 종류 필터 history_course |

[src/hooks/use-pagestorm-toybox.ts](../../src/hooks/use-pagestorm-toybox.ts) — 부르는 곳: `pickers.tsx:162-163,183`.

| 줄 | 함수 | 종류 | 대상 | 내용 | 신원 | 언제 |
|---|---|---|---|---|---|---|
| 40 | usePagestormToyboxPicker | call | 조각모음·장난감 상자 피드 RPC | 전체 post를 받고 요약만 남김(`defragment-feed.ts:101-129,149-162`) | anon | 모달 열기, 서비스 바꾸기, 더 보기 |
| 62 | fetchToyboxRow | select | transfigure, this_or_that, decisions_decisions 글 | `select *` id·env maybeSingle. 목록에 있던 행을 다시 읽는다 | anon | 글 고르기 |

[src/hooks/use-colorful-philosopher-posts.ts](../../src/hooks/use-colorful-philosopher-posts.ts) — 부르는 곳: `index-view.tsx:42,49`, `post-view.tsx:64`, `site-navbar.tsx:783-786`, `colorful-philosophers-dev-page.tsx:133`.

| 줄 | 함수 | 종류 | 대상 | 내용 | 신원 | 언제 |
|---|---|---|---|---|---|---|
| 41 | useColorfulPhilosopherWeek | select | colorful_philosopher_posts | 13열(`:20`), limit 100. 미래 예약 포함 | anon(4732) | 목록 마운트, dev 편집기 env 바꿈·저장 뒤 |
| 81 (83) | useColorfulPhilosophersNextWeekOpen | select | colorful_philosopher_posts | env='production' 고정, 다음 주 slot | anon | dev 전용: 네비 dev 메뉴가 있을 때 경로마다(`site-nav-items.ts:205,451-454`) |
| 117 | useColorfulPhilosopherPost | select | colorful_philosopher_posts | id maybeSingle | anon | 상세 마운트 |
| 166 | save…/useColorfulPhilosopherReaction | other | colorful_philosopher_reactions | delete `:166`, update `:169`, insert `:171`, select `:195`. 정책은 TO authenticated(4745, 4752, 4766) | - | 죽은 코드: 부르는 곳 없음 |
| 238 | useColorfulPhilosopherCommentCounts | select | comments | `colorful-philosophers:<id>` 키 in, limit 1000, 클라이언트가 셈 | anon(4854) | 목록에서 글을 받은 뒤 |

### 3.5 장난감 상자 글

[src/hooks/use-transfigure-posts.ts](../../src/hooks/use-transfigure-posts.ts) — 부르는 곳: `transfigure-client.tsx:85-106`, `transfigure-post-view.tsx:88,94`, `defragment-write-panel.tsx:335`.

| 줄 | 함수 | 종류 | 대상 | 내용 | 신원 | 언제 |
|---|---|---|---|---|---|---|
| 391 | insertTransfigurePost | insert | transfigure_posts | 대표 변형 열, extra_variants, 작성자 토큰. select single. 23514 말고는 unavailable | JWT(5433) | 작성, 조각모음 쓰기 판 |
| 360 | persistTransfigurePostUpdate | update | transfigure_posts | id·user_id·env. 0행이면 PGRST116에서 화면 전체 unavailable | JWT(5447) | 상세 수정 저장(`:553`) |
| 483 | useTransfigurePosts.remove | delete | transfigure_posts | 목록 작성기의 삭제 | JWT(5426) | 죽은 코드: editingPost가 늘 null |
| 529 | useTransfigurePost | select | transfigure_posts | `select *` 한 행 | anon(5440) | 상세 마운트, 조각모음 임베드(`defragment-federated-post-view.tsx:135-139`) |
| 576 | useTransfigurePost.remove | delete | transfigure_posts | 0행이어도 성공 | JWT(5426) | 상세 삭제 |

[src/hooks/use-combo-posts.ts](../../src/hooks/use-combo-posts.ts) — 부르는 곳: `combo-client.tsx:85-89`, `combo-post-view.tsx:74,79`, `defragment-write-panel.tsx:295`.

| 줄 | 함수 | 종류 | 대상 | 내용 | 신원 | 언제 |
|---|---|---|---|---|---|---|
| 81 | insertComboPost | insert | combo_posts | content, content_text, resources(2개 이상, YouTube 1개 이하) | JWT(4786) | 작성, 쓰기 판 |
| 117 | persistComboPostUpdate | update | combo_posts | 0행이면 PGRST116 | JWT(4800) | 상세 수정 |
| 205 | useComboPosts.remove | delete | combo_posts | `eq('id')`만 | JWT(4779) | 죽은 코드: 부르는 곳 없음 |
| 246 | useComboPost | select | combo_posts | `select *` | anon(4793) | 상세, 조각모음 임베드 |
| 294 | useComboPost.remove | delete | combo_posts | 0행이어도 성공 | JWT(4779) | 상세 삭제 |

[src/hooks/use-chemical-posts.ts](../../src/hooks/use-chemical-posts.ts) — 부르는 곳: `chemicalx-client.tsx:69-71`, `defragment-write-panel.tsx:301`.

| 줄 | 함수 | 종류 | 대상 | 내용 | 신원 | 언제 |
|---|---|---|---|---|---|---|
| 54 | insertChemicalPost | insert | chemical_posts | content_text 2~30자(schema:2576). 어떤 오류든 unavailable | JWT(4712) | 작성, 쓰기 판 |
| 118 | useChemicalPosts.remove | delete | chemical_posts | `eq('id')`만 | JWT(4705) | 죽은 코드: 부르는 곳 없음 |

[src/components/chemicalx/post-view.tsx](../../src/components/chemicalx/post-view.tsx)

| 줄 | 함수 | 종류 | 대상 | 내용 | 신원 | 언제 |
|---|---|---|---|---|---|---|
| 58 | ChemicalXPostView effect | select | chemical_posts | `.single()`. 타임아웃·오류 분기·취소 없음. 장애면 '없음', 멈추면 영원히 로딩 | anon(4719) | 상세, 조각모음 임베드 |
| 81 | handleDelete | delete | chemical_posts | 오류면 조용히 끝(`:88`). update 정책 없음 | JWT(4705) | 상세 삭제 |

[src/hooks/use-decisions-decisions-posts.ts](../../src/hooks/use-decisions-decisions-posts.ts) — 부르는 곳: `decisions-decisions-client.tsx:67-69`, `decisions-decisions-post-view.tsx:85,166-168`, `defragment-write-panel.tsx:345`.

| 줄 | 함수 | 종류 | 대상 | 내용 | 신원 | 언제 |
|---|---|---|---|---|---|---|
| 58 | insertDecisionsDecisionsPost | insert | decisions_decisions_posts | rows·placements 각 1 MB, extra_ids 128 KB까지 | JWT(4941) | 작성, 쓰기 판 |
| 93 | updateDecisionsDecisionsPost | update | decisions_decisions_posts | catch 없이 작성기로 throw | JWT(4955) | 상세 수정 |
| 145 | useDecisionsDecisionsPosts.remove | delete | decisions_decisions_posts | `eq('id')`만 | JWT(4934) | 죽은 코드: 부르는 곳 없음 |
| 172 | useDecisionsDecisionsPost | select | decisions_decisions_posts | `select *`. like_count를 LikeButton initialCount로 | anon(4948) | 상세, 조각모음 임베드 |
| 207 | useDecisionsDecisionsPost.remove | delete | decisions_decisions_posts | 0행이어도 성공 | JWT(4934) | 상세 삭제 |

[src/hooks/use-defragment-posts.ts](../../src/hooks/use-defragment-posts.ts) — 부르는 곳: `defragment-post-view.tsx:70-89,104,120`.

| 줄 | 함수 | 종류 | 대상 | 내용 | 신원 | 언제 |
|---|---|---|---|---|---|---|
| 84 | insertDefragmentPost | insert | defragment_posts | 고유 글 쓰기는 e42cb181에서 없어졌다 | JWT(5009) | 죽은 코드: 부르는 곳 없음 |
| 116 | updateDefragmentPost | update | defragment_posts | id·user_id·env select single. publication에 든 테이블 | JWT(5023) | 상세 수정 |
| 145 | deleteDefragmentPost | delete | defragment_posts | count 없음, 늘 true | JWT(5002) | 상세 삭제 |
| 162 | fetchDefragmentPost | select | defragment_posts | `select *` single. 오류를 null('없음')로 바꾼다 | anon(5016) | `/defragment/[id]` 마운트 |

[src/hooks/use-defragment-bodies.ts](../../src/hooks/use-defragment-bodies.ts) — 부르는 곳: `defragment-federated-post-view.tsx:70-82`, `defragment-write-panel.tsx:190,264`.

| 줄 | 함수 | 종류 | 대상 | 내용 | 신원 | 언제 |
|---|---|---|---|---|---|---|
| 83 | fetchDefragmentBody | select | defragment_bodies | PK maybeSingle. 테이블이 없으면 null | anon(4982) | federated 상세 마운트 |
| 116 | upsertDefragmentBody | upsert | defragment_bodies | onConflict env,source_service,source_id. updated_at은 클라이언트 값 | JWT·auth + source_owned(4975, 4989) | 쓰기 판 제출(원글 insert 다음), 다시 시도 |

[src/hooks/use-pagestorm-posts.ts](../../src/hooks/use-pagestorm-posts.ts) — 부르는 곳: `pagestorm-client.tsx:188-189,356,415-479`, `pagestorm-post-view.tsx:61,102,116`, `defragment-write-panel.tsx:360`.

| 줄 | 함수 | 종류 | 대상 | 내용 | 신원 | 언제 |
|---|---|---|---|---|---|---|
| 56 | insertPagestormPost | insert | pagestorm_posts | doc JSONB | JWT(5170) | 게시(`pagestorm-client.tsx:415`), 쓰기 판 |
| 87 | updatePagestormPost | update | pagestorm_posts | id·user_id·env | JWT(5184) | 상세 수정(`:327`) |
| 133 | insertPagestormDraft | insert | pagestorm_drafts | 처음 저장 | JWT(5136) | 임시 저장(`pagestorm-client.tsx:447`) |
| 151 | updatePagestormDraft | update | pagestorm_drafts | `?draft=`가 있을 때 | JWT(5150) | 임시 저장(`:446`) |
| 169 | deletePagestormDraft | delete | pagestorm_drafts | count 없음 | JWT(5129) | 게시 뒤(`:423`), 직접 삭제(`:479`) |
| 189 | usePagestormDraft | select | pagestorm_drafts | user_id 필터 없이 RLS가 거름 | JWT(5143) | `/pagestorm/write?draft=` 마운트 |
| 226 | usePagestormDrafts | select | pagestorm_drafts | 20개, 문서 전체(썸네일용) | JWT(5143) | `/pagestorm` 마운트, 세션이 있을 때 |
| 264 | usePagestormPosts | select | pagestorm_posts | 50개, 문서 전체, 페이지 없음 | anon(5177) | `/pagestorm` 마운트 |
| 303 | usePagestormPost | select | pagestorm_posts | `select *` | anon(5177) | 상세, 조각모음 임베드 |
| 338 | usePagestormPost.remove | delete | pagestorm_posts | count 없음 | JWT(5163) | 상세 삭제 |

[src/hooks/use-favorite-tournament-posts.ts](../../src/hooks/use-favorite-tournament-posts.ts) — 부르는 곳: `favorite-tournament-client.tsx:59-75,87`, `favorite-tournament-post-view.tsx:59,84,97`, `defragment-write-panel.tsx:351`.

| 줄 | 함수 | 종류 | 대상 | 내용 | 신원 | 언제 |
|---|---|---|---|---|---|---|
| 63 | insertFavoriteTournamentPost | insert | favorite_tournament_posts | preset_key 'custom', pool JSONB 1 MB까지 | JWT(5062) | 작성, 쓰기 판 |
| 112 | useFavoriteTournamentPosts.remove | delete | favorite_tournament_posts | `eq('id')`만 | JWT(5055) | 죽은 코드: 부르는 곳 없음 |
| 134 | useFavoriteTournamentBuiltins | select | favorite_tournament_posts | `like 'builtin:%'` `select *` limit 없음 | anon(5069) | 목록 마운트, 늘(숨겨 있어도) |
| 180 | useFavoriteTournamentPost | select | favorite_tournament_posts | `select *` maybeSingle, 통계와 병렬 | anon(5069) | 상세, 조각모음 임베드 |
| 189 | useFavoriteTournamentPost | select | favorite_tournament_candidate_stats | `select *`, rank_history 포함 | anon(5076) | 상세 |
| 224 | useFavoriteTournamentPost.remove | delete | favorite_tournament_posts | builtin은 user_id가 null이라 아무도 못 지움 | JWT(5055) | 상세 삭제 |
| 246 | completePlay | rpc | complete_favorite_tournament_play | SECURITY DEFINER. 타임아웃 rejection을 catch하지 않음 | JWT(uid가 없으면 오류) | 대진이 끝날 때 |
| 271 | completePlay | select | favorite_tournament_candidate_stats | RPC 직후 다시 읽음, 오류는 삼킴 | anon(5076) | 플레이 뒤 |

[src/hooks/use-this-or-that-posts.ts](../../src/hooks/use-this-or-that-posts.ts) — 부르는 곳: `this-or-that-client.tsx:92`, `post-view.tsx:61,86`, `defragment-write-panel.tsx:314`.

| 줄 | 함수 | 종류 | 대상 | 내용 | 신원 | 언제 |
|---|---|---|---|---|---|---|
| 68 | insertThisOrThatPost | insert | this_or_that_posts | 좌우 type·id, reason | JWT(5406) | 작성, 쓰기 판 |
| 139 | useThisOrThatPosts.remove | delete | this_or_that_posts | `eq('id')`만 | JWT(5399) | 죽은 코드: 부르는 곳 없음 |
| 179 | useThisOrThatPost | select | this_or_that_posts | `select *`. 카운터 열 넷이 이미 있다 | anon(5413) | 상세, 조각모음 임베드 |
| 208 | useThisOrThatPost.remove | delete | this_or_that_posts | id·user_id·env | JWT(5399) | 상세 삭제 |

[src/hooks/use-this-or-that-likes.ts](../../src/hooks/use-this-or-that-likes.ts) — 부르는 곳: `this-or-that-client.tsx:74,109`, `post-view.tsx:67,78`, `defragment-client.tsx:150,155`.

| 줄 | 함수 | 종류 | 대상 | 내용 | 신원 | 언제 |
|---|---|---|---|---|---|---|
| 43 | effect | select | this_or_that_post_like_counts(뷰) | post_id in 전부. like_count 열과 같은 값 | anon(5357) | id 키·userId 변화. 목록은 더 보기마다 쌓인 id 전부로 |
| 52 | effect | select | this_or_that_post_likes | 내 것 | anon으로도 된다. API는 JWT sub | 같은 effect, 세션이 있을 때 |
| 115 | toggle | delete | this_or_that_post_likes | 낙관적, 오류면 되돌림 | JWT(5343) | 좋아요 끄기 |
| 120-122 | toggle | insert | this_or_that_post_likes | `{post_id, user_id, env}`, 8초(`:124-127`) **[추가]** | JWT(5350), UNIQUE 3726 | 좋아요 켜기 |

[src/hooks/use-this-or-that-votes.ts](../../src/hooks/use-this-or-that-votes.ts) — 부르는 곳: `this-or-that-client.tsx:75,220-221`, `post-view.tsx:68,201,230,254`.

| 줄 | 함수 | 종류 | 대상 | 내용 | 신원 | 언제 |
|---|---|---|---|---|---|---|
| 65 | effect | rpc | get_this_or_that_vote_summaries | id 전부. 50개를 넘으면 오류(schema:1873-1875) | anon(5629) | id 키·userId 변화, 더 보기마다 |
| 74 | effect | select | this_or_that_post_votes | 내 투표. anon이면 빈 결과 | JWT(5386) | 같은 effect, 세션이 있을 때 |
| 159 | vote | insert | this_or_that_post_votes | choice, created_surface | JWT(5377-5379), UNIQUE 3734 | 투표 |
| 206 | cancel | delete | this_or_that_post_votes | | JWT(5370) | 투표 취소 |

[src/hooks/use-this-or-that-comment-counts.ts](../../src/hooks/use-this-or-that-comment-counts.ts)

| 줄 | 함수 | 종류 | 대상 | 내용 | 신원 | 언제 |
|---|---|---|---|---|---|---|
| 50 | useThisOrThatCommentCounts | select | comments | 댓글 행을 모두 받아 셈 | anon | 죽은 코드: import하는 곳 없음 |

[src/lib/toybox-post-og-fields.ts](../../src/lib/toybox-post-og-fields.ts) — 부르는 곳: 장난감 상자·조각모음 `[id]/page-content.tsx`의 generateMetadata 7곳.

| 줄 | 함수 | 종류 | 대상 | 내용 | 신원 | 언제 |
|---|---|---|---|---|---|---|
| 23 | selectToyBoxOgRow | select | transfigure, combo, this_or_that, pagestorm, defragment, chemical 글 | OG 열 maybeSingle. 셸은 `__id__`만 미리 만들고 그 id는 건너뛴다(`static-detail-shell.ts:11-18`) | anon | 빌드: 사실상 0건(`next dev`에서만) |

[workers/detail-shell-og.ts](../../workers/detail-shell-og.ts) — 부르는 곳: `maybeEnrichServiceDetailShell`(`:590-639`) ← `main-worker.ts:305`.

| 줄 | 함수 | 종류 | 대상 | 내용 | 신원 | 언제 |
|---|---|---|---|---|---|---|
| 231 (236) | fetchSupabaseRestSingleRow | rest | runs, combo, chemical, this_or_that, transfigure, pagestorm, defragment, decisions_posts | `?id=eq&env=eq&select&limit=1`, 600 ms. 성공만 캐시 | anon(Worker env) | 운영 꺼짐: Worker에 변수가 없다(`tasks/010…:139-141`) |

### 3.6 역사 강의서와 퍼즐상자

[src/lib/run-donation.ts](../../src/lib/run-donation.ts) — 부르는 곳: `history-course-run-index.tsx`, `run-upload-zone.tsx:183,200`, `donation-panel.tsx:44-73,86,120`, `run-detail-loader.tsx:106-159`, `combo-history-run-picker.tsx:85,155`, `combo-history-run-reference.tsx:102`, `defragment-client.tsx:79`. dev 도구가 켜지고 env가 production이 아니면 두 env를 차례로 읽는다(`runReadEnvs`, `:106-111`).

| 줄 | 함수 | 종류 | 대상 | 내용 | 신원 | 언제 |
|---|---|---|---|---|---|---|
| 194 | selectDonatedRunForEnv | select | runs | raw 포함 12열 1행, 최대 293 KB | anon(5323) | 런 상세, IndexedDB에 없을 때 |
| 211 | selectDonatedRunForEnv | select | runs | cover_spec 없는 열 목록 | anon | 대체 경로: cover_spec 열 없음 |
| 230 | selectRecentDonatedRunsForEnv | select | runs | raw 포함 14열, 최신 100. 7.9 MB. raw를 행마다 두 번 파싱 | anon(5323) | 목록 마운트, 업로드 뒤 |
| 249 | selectRecentDonatedRunsForEnv | select | runs | cover_spec 없이 | anon | 대체 경로: 열 없음 |
| 268 (267) | selectHistoryRunReferencesForEnv | select | runs | raw 포함, start_time 최신 30. 3.1 MB | anon(5323) | 콤보 런 고르기 창을 처음 열 때 |
| 287 | selectHistoryRunReferencesForEnv | select | runs | cover_spec 없이 | anon | 대체 경로: 열 없음 |
| 305 | insertDonatedRunRow | insert | runs | returning 없음. 본문에 raw | JWT(5316) | 공유 클릭(목록, 기증 패널, 고르기) |
| 314 | insertDonatedRunRow | insert | runs | cover_spec 빼고 다시 | JWT | 대체 경로: 열 없음 |
| 409 | donateRunsBatch | upsert | runs | onConflict id,env, ignoreDuplicates, `.select('id')`. 본문 크기 제한 없음 | JWT(5316) | 업로드하며 공유 |
| 418-421 | donateRunsBatch | upsert | runs | donor_nickname 빼고 다시 **[추가]** | JWT | 대체 경로: 열 없음 |
| 429-432 | donateRunsBatch | upsert | runs | cover_spec·donor_nickname 빼고 다시 **[추가]** | JWT | 대체 경로: 열 없음 |
| 485 | updateDonatedRunCoverSpec | update | runs | id·env·donor_user_id, `.select('id')`. 실패는 모두 무시 | JWT(5330) | 표지 저장, 업로드 후속, 중복 공유 |
| 521 | getDonatedRunOgFields | select | runs | character, cover_spec | anon | IDB 사본에 표지가 없는 런 상세 |
| 531-536 | getDonatedRunOgFields | select | runs | character만 **[추가]** | anon | 대체 경로: 열 없음 |
| 566 (567) | getRunCoverSpec | select | runs | id, raw, cover_spec. raw로 자동 표지 계산 | anon | 콤보 런 참조마다(표지 없는 옛 블록) |
| 576-581 | getRunCoverSpec | select | runs | id, raw **[추가]** | anon | 대체 경로: 열 없음 |
| 607 | isRunDonated | select | runs | id | anon | 기증 패널, 로컬 런일 때 |
| 627 | isOwnDonation | select | runs | 클라이언트가 준 donor_user_id | anon | 기증 패널, 기증·userId 변화 |
| 648 | listMyDonatedRunIds | select | runs | 클라이언트가 준 uid, limit 없음 | anon | 목록, 세션이 있을 때, 업로드 뒤 |
| 664 (663) | syncDonatedRunNicknames | update | runs | 닉네임이 다른 내 런. 보통 0행, 결과 무시 | JWT(5330) | 세션이 있으면 목록·조각모음 마운트마다 |
| 711 | deleteDonatedRun | delete | runs | id·env만, donor 필터·count 없음 | JWT(5309) | 공유 취소, 공유한 로컬 런 삭제 |

[src/hooks/use-puzzlebox-scores.ts](../../src/hooks/use-puzzlebox-scores.ts) — 부르는 곳: `connections-client.tsx:253-258,461-477`, `beta-art-quiz.tsx:173-187,255-271`, `rankings-client.tsx:366`.

| 줄 | 함수 | 종류 | 대상 | 내용 | 신원 | 언제 |
|---|---|---|---|---|---|---|
| 133 | submitPuzzleboxRun | rpc | submit_puzzlebox_run | 서버 채점, 3초·하루 500판 제한. 모든 오류를 null로 | JWT·auth(5698-5700) | 판이 끝날 때 |
| 153 | hasSession | auth | getSession | 로컬, 만료면 갱신 | 로컬 | 내 순위 읽기 전 |
| 194 | usePuzzleboxLeaderboard | rpc | get_puzzlebox_leaderboard | p_boards 지도는 클라이언트가 만듦. 5분 캐시 | anon(5602), 토큰이 있으면 is_me | 순위표 마운트, 판·쪽 바꿈 |
| 242 | useMyPuzzleboxStandings | rpc | get_my_puzzlebox_standings | 세션이 없으면 건너뜀(`:237`) | JWT·auth(5593) | 마운트, 제출 뒤 |

[src/app/api/dev/history-course-runs/route.ts](../../src/app/api/dev/history-course-runs/route.ts), [\[runId\]/route.ts](<../../src/app/api/dev/history-course-runs/[runId]/route.ts>) — 부르는 곳: `prod-runs-dev-section.tsx:78,121`.

| 줄 | 함수 | 종류 | 대상 | 내용 | 신원 | 언제 |
|---|---|---|---|---|---|---|
| 49 | GET(목록) | select | runs | env='production' 고정, count exact, limit 100 | anon | dev 전용: `next dev` |
| 58 | GET(\[runId\]) | select | runs | raw 포함 한 행 | anon | dev 전용: 가져오기 클릭 |

### 3.7 프로필과 관리

[src/hooks/use-profile-activity.ts](../../src/hooks/use-profile-activity.ts) — 부르는 곳: `profile-activity.tsx:131`.

| 줄 | 함수 | 종류 | 대상 | 내용 | 신원 | 언제 |
|---|---|---|---|---|---|---|
| 108 | stats effect | rpc | get_my_profile_activity_stats | 6행 이하 | JWT·auth(5583-5585) | 마운트, userId 변화 |
| 151 | list effect | rpc | get_my_profile_activity | 20행, content_blocks 포함 | JWT·auth(5574-5576) | 마운트, 필터·정렬 클릭 |
| 192 | loadMore | rpc | get_my_profile_activity | offset = 받은 수 | JWT·auth | 더 보기 클릭 |

[src/hooks/use-profile-character-nicknames.ts](../../src/hooks/use-profile-character-nicknames.ts) — 부르는 곳: `profile-page.tsx:89`.

| 줄 | 함수 | 종류 | 대상 | 내용 | 신원 | 언제 |
|---|---|---|---|---|---|---|
| 17 | fetchProfileCharacterNicknamePools | select | profile_character_nickname_pools | 필터 없이 10행 이하, env 없음. 실패하면 기본값 | anon(5197) | 프로필 마운트 |

[src/app/(main)/dev/admin/admin-dev-page.tsx](<../../src/app/(main)/dev/admin/admin-dev-page.tsx>) — `next dev`나 dev 도구 빌드에서만 그린다(`page.tsx:21,49`).

| 줄 | 함수 | 종류 | 대상 | 내용 | 신원 | 언제 |
|---|---|---|---|---|---|---|
| 176 | readContactInquiries | select | contact_inquiries | 관리 열 전부, count exact, limit 100, 두 env | service | dev 전용 |
| 188 | readComments | select | comments | env='production' 고정, limit 50, story_id 필터 | anon | dev 전용 |
| 267 | readOneServicePosts | select | community_stories | static_story_id null | anon | dev 전용 |
| 298 | readOneServicePosts | select | combo_posts | content 포함 | anon | dev 전용 |
| 332 | readOneServicePosts | select | transfigure_posts | | anon | dev 전용 |
| 372 | readOneServicePosts | select | this_or_that_posts | | anon | dev 전용 |
| 402 | readOneServicePosts | select | chemical_posts | | anon | dev 전용 |
| 432 | readOneServicePosts | select | decisions_decisions_posts | | anon | dev 전용 |
| 462 | readOneServicePosts | select | favorite_tournament_posts | | anon | dev 전용 |
| 492 | readOneServicePosts | select | pagestorm_posts | | anon | dev 전용 |
| 518 | readOneServicePosts | select | runs | 목록에 history_course가 두 번 들어가 두 번 읽는다(`admin-rls-activity.ts:15-19`, `defragment.ts:38`) | anon | dev 전용 |
| 549 | readRlsActivityMetrics | rpc | get_rls_activity_metrics | 20초 | service(5611-5612) | dev 전용 |
| 598 | readNicknamePools | select | profile_character_nickname_pools | | service | dev 전용 |
| 633 | writeNicknamePools | upsert | profile_character_nickname_pools | 10행, env가 없어 운영에 바로 반영 | service | dev 전용: 저장(`:646`)·초기화(`:667`) |
| 704 | respondToContactInquiry | update | contact_inquiries | admin_response, responded_at, status. 바뀌면 사용자의 점이 다시 켜진다 | service | dev 전용: 답변 저장 |

[src/app/(main)/dev/colorful-philosophers/actions.ts](<../../src/app/(main)/dev/colorful-philosophers/actions.ts>)

| 줄 | 함수 | 종류 | 대상 | 내용 | 신원 | 언제 |
|---|---|---|---|---|---|---|
| 85 (87) | saveColorfulPhilosopherPost | upsert | colorful_philosopher_posts | onConflict env,week_start,slot. 고른 env 어디든 | service | dev 전용: 저장(NODE_ENV=development, `:58-60`) |

## 4. 쓰기와 권한

### 4.1 쓰기별 정리

"JWT 전달로 그대로인가"는 1단계처럼 Worker가 사용자 토큰을 PostgREST에 그대로 넘길 때 지금과 같은 검사가 되는지다.
guard 트리거는 `current_user`가 anon이나 authenticated일 때만 도는데(schema:4310 등), 사용자 토큰을 넘기면
authenticated라서 돈다.

| 쓰기 | 호출 위치 | 정책·검사 | 트리거 | JWT 전달로 그대로인가 | API가 더 할 일 |
|---|---|---|---|---|---|
| comments insert | `use-comments.ts:118`, `patch-comments-client.js:954` | `comments_insert` uid = user_id(4847). CHECK: content 1~2000, nickname 1~20, content_blocks·meta 128 KB, story_id 1 KB(2693-2698) | `guard_insert` created_at(4331), 참여 카운터(4338) | 그렇다 | user_id는 JWT sub, env는 Worker 값. 보이는 글자 2~200 검사. 응답 열을 정한다 |
| comments delete | `use-comments.ts:145`, `patch-comments-client.js:1005` | `comments_delete` uid(4840) | comment_likes CASCADE(4476), 답글 CASCADE(4492), 지워지는 행마다 카운터(4338) | 그렇다 | return=representation으로 0행이면 403이나 404 |
| comment_likes insert·delete | `use-comment-likes.ts:62,50`, `patch-comments-client.js:993,988` | insert(4820), delete(4813), UNIQUE(3510) | 없음 | 그렇다 | 멱등 PUT·DELETE, 결과를 확인 |
| likes insert·delete | `use-likes.ts:154,134` | insert(5096), delete(5089), UNIQUE(story_id, user_id, env)(3622) | 카운터(4387) | 그렇다 | 멱등. `{ liked, count }` |
| resource_reactions insert·update·delete | `use-resource-reactions.ts:199-202`, `patch-comments-client.js:1553-1557`(그리고 dev의 `:86-89`) | insert PUBLIC uid(5282), update **TO authenticated** uid(5296)와 열 권한 UPDATE(kind)(6064), delete uid(5275), PK(3702), CHECK(3227-3228) | 합계 테이블(4401, SECURITY DEFINER 114-166) | 그렇다. 익명 사용자도 authenticated 역할이다 | 이전 kind를 DB로 판단. upsert는 충돌 때 kind만 |
| community_stories insert·delete | `use-community-stories.ts:207,248`, `patch-comments-client.js:663` | insert(4874), delete(4867). CHECK sentence 2~120(2736-2743) | `guard_insert` created_at, 클라이언트 행이면 static_story_id = null(4345, 2028-2030) | 그렇다 | 삭제 수를 돌려준다 |
| 장난감 상자 글 insert | 13번 화면 | 각 `_insert` uid: transfigure 5433, combo 4786, chemical 4712, decisions 4941, pagestorm 5170, this_or_that 5406, favorite_tournament 5062(그리고 preset_key NOT LIKE 'builtin:%'), defragment 5009 | `guard_post`: like·comment·vote·play 카운터 0, created_at = now, id·env 고정(4310, 4324, 4366, 4373, 4380, 4394, 4429, 4436, 2042-2073) | 그렇다 | 23514를 422로 |
| 장난감 상자 글 update | transfigure, combo, decisions, pagestorm, defragment | 5447, 4800, 4955, 5184, 5023. chemical·this_or_that·favorite_tournament에는 update 정책이 없다 | `guard_post` | 그렇다 | 0행(PGRST116)을 404나 403으로 |
| 장난감 상자 글 delete | 8종 | 5426, 4779, 4705, 4934, 5163, 5399, 5055, 5002. builtin 대회는 user_id가 null이라 지울 수 없다 | 카운터 없음 | 그렇다 | return=representation으로 0행 구별 |
| pagestorm_drafts insert·update·delete | `use-pagestorm-posts.ts:133,151,169` | 5136, 5150, 5129 | **없음**. env·created_at·updated_at을 클라이언트가 바꿀 수 있다 | 그렇다 | env·시각을 Worker가 정한다 |
| defragment_bodies upsert | `use-defragment-bodies.ts:116` | insert·update **TO authenticated** uid와 `defragment_source_owned`(4975, 4989). 이 함수는 authenticated만 실행(5530-5532). delete uid(4968) | **없음**. updated_at은 클라이언트 값 | 그렇다. anon 키로는 42501 | 원글 insert와 묶을 때 부분 실패 결과를 유지 |
| runs insert·upsert·update·delete | `run-donation.ts:305,409,485,664,711` | insert uid = donor_user_id(5316), update(5330), delete(5309). upsert RETURNING은 읽기 정책(5323)에 기댄다 | `guard_post`(4408): id·env·카운터·created_at 고정 | 그렇다 | raw 2 MB 상한, 삭제 수, 묶음 본문 크기 |
| this_or_that_post_likes insert·delete | `use-this-or-that-likes.ts:120-122` **[추가]**, `:115` | insert(5350), delete(5343), UNIQUE(3726) | 좋아요 카운터(4415) | 그렇다 | `{ liked, likeCount }` |
| this_or_that_post_votes insert·delete | `use-this-or-that-votes.ts:159,206` | insert uid와 같은 env의 원글(5377-5379), delete(5370), UNIQUE(3734) | 투표 카운터(4422) | 그렇다 | `{ choice, left, right }` |
| contact_inquiries insert | `contact-inquiries.ts:97` | **TO authenticated** uid = user_id이고 status = 'new'(4894). 열 단위 INSERT 권한(5791-5854). anon 권한 없음 | rate limit(4359, SECURITY DEFINER 589-618): user_id ≠ uid면 42501, trim·소문자, advisory lock, 1시간 3건(P0001) | 그렇다 | **return=minimal 필수**. authenticated는 reply_email·user_id·viewport를 SELECT할 수 없다 |
| contact_inquiries update | `contact-inquiries.ts:180` | **TO authenticated** uid(4908), UPDATE(reply_seen_at)만(5889) | `clear_reply_seen`(4352)은 관리자 답변이 바뀔 때만 | 그렇다 | - |
| rpc complete_favorite_tournament_play | `use-favorite-tournament-posts.ts:246` | SECURITY DEFINER. uid가 null이면 'not authenticated'(415-417). EXECUTE anon·authenticated(5520-5523). 크기·대진·후보 검사(396-543) | 안에서 plays insert, play_count +1, 통계 upsert, 순위 다시 계산 | 그렇다(JWT 필수) | 통계를 다시 읽어 함께 돌려준다 |
| rpc submit_puzzlebox_run | `use-puzzlebox-scores.ts:133` | SECURITY DEFINER. authenticated·service_role만(5698-5700). uid가 null이면 42501(2374-2376). 3초·하루 500판(2391-2401, 54000) | 안에서 players·runs·best·board_stats | 그렇다(JWT 필수) | 내 순위를 함께 돌려준다 |
| 관리 쓰기(문의 답변, 닉네임 풀, 철학자 글) | `admin-dev-page.tsx:704,633`, `actions.ts:85` | service_role, RLS 우회 | 문의 답변은 clear_reply_seen | 해당 없음(Worker 경로 없음) | 5단계에 D1 경로로 |
| colorful_philosopher_reactions | `use-colorful-philosopher-posts.ts:166-171` | TO authenticated(4745, 4752, 4766), UPDATE(kind)(5734) | 카운터(4317) | - | 죽은 코드라 옮기지 않는다 |

### 4.2 모든 쓰기에 공통인 규칙(1단계)

- Worker는 토큰 서명을 먼저 확인하고(6.8절) `Authorization: Bearer <사용자 토큰>`과 `apikey: <publishable 키>`를
  PostgREST에 넘긴다. RLS가 최종 판단을 한다.
- user_id는 JWT sub로 넣는다. 정책이 `auth.uid() = user_id`를 보지만 클라이언트 값을 받을 이유가 없다.
- env는 Worker 값으로 넣는다. RLS는 env를 보지 않고 CHECK도 두 값을 다 허용한다(schema:2696, 2996, 3226). 지금은
  testbed 빌드가 운영 행을 쓸 수 있다. 다만 testbed 패치 페이지는 env=production으로 빌드된다(6.5절, 8.4절).
- delete·update는 `Prefer: return=representation`으로 보내 0행을 403이나 404로 구별한다. 지금은 0행 delete가
  성공으로 보이고, 0행 update는 PGRST116으로 화면 전체가 unavailable이 된다.
- 클라이언트가 기대는 오류 계약을 지킨다: 42501(`defragment-submit.ts:4`), 23514(`supabase.ts:12`),
  23505(`run-donation.ts:343`), `contact_inquiry_rate_limited`(`contact-inquiries.ts:111`), 54000, 22023.
- 401이면 클라이언트가 supabase-js로 갱신하고 한 번 다시 보낸다. Worker는 토큰을 갱신하지 않는다.

### 4.3 읽기에도 JWT가 필요한 곳

사용자끼리 같이 쓰는 메모리 캐시에 넣으면 안 된다.

- `get_my_profile_activity`, `get_my_profile_activity_stats`(authenticated만)
- `get_my_puzzlebox_standings`(authenticated만), `get_puzzlebox_leaderboard`의 is_me·around_me
- 내 문의(`contact-inquiries.ts:123,132,157`)
- 서류 폭풍 임시 저장(`use-pagestorm-posts.ts:189,226`)
- 이거 vs 저거 내 투표(`use-this-or-that-votes.ts:74`)

anon 키로 남의 것이 보이는 읽기도 있다. likes, comment_likes, this_or_that_post_likes, resource_reactions,
colorful_philosopher_reactions, favorite_tournament_plays는 user_id까지 누구나 읽는다(schema:5103, 4827, 5357,
5289, 4759, 5042). runs 공개 목록은 donor_user_id를 준다. API는 이 노출을 넓히지 않는다. 개인 필드는 쿼리
문자열이 아니라 JWT sub로만 고른다.

### 4.4 4단계(service 키)에 미치는 영향

- service 키로 쓰면 RLS를 건너뛰고, guard 트리거가 돌지 않고, `auth.uid()`가 null이 된다.
- 그래서 Worker가 guard를 다시 구현해야 한다: 카운터 0, created_at = now, id·env 고정, static_story_id = null.
- uid에 기대는 곳은 사용자 JWT로 계속 부르거나, actor를 인자로 받는 service 전용 판을 두거나, Worker로 옮긴다:
  `complete_favorite_tournament_play`, `submit_puzzlebox_run`, `get_my_*`, `get_puzzlebox_leaderboard`,
  `defragment_source_owned`, 문의 rate limit 트리거.

## 5. Realtime, 빌드 시점 읽기, 스크립트 전용

### 5.1 Realtime

| 채널 | 위치 | 대상 | 상태 |
|---|---|---|---|
| `${table}_feed` | `use-toybox-feed.ts:103-135` | combo, transfigure, chemical, decisions_decisions, this_or_that, favorite_tournament 글의 UPDATE·DELETE | 이 테이블들은 publication에 없다(pub:2). 이벤트가 오지 않는다. 그래도 장난감 상자 목록마다 WebSocket을 열고, join이 실패하거나 10초를 넘기면 이미 받은 피드를 unavailable로 덮는다(`:128-132`, realtime-js constants.js:10) |
| `community_stories` | `use-community-stories.ts:163-183` | INSERT | publication에 없다. 홈, `/byrdispatch`, 패치 상세, `/patches/changes`에서 연다. 같은 topic 채널은 하나를 같이 쓰므로 한쪽이 정리하면 다른 쪽도 끊긴다(RealtimeClient.js:338-349) |
| (없음) | - | `defragment_posts` | publication에 든 유일한 테이블이다(pub:2, `supabase/migrations/20260820043839_defragment_posts_realtime.sql:9-15`). 구독하던 채널은 e42cb181(2026-08-20)에서 지워졌다. 피드 RPC도 이 테이블을 읽지 않는다 |

- 해제는 `use-community-stories.ts:183`, `use-toybox-feed.ts:135`의 `removeChannel`이다. HTTP 요청은 없다 **[추가]**.
- 정리: 지금의 Realtime은 연결만 쓰고 아무것도 갱신하지 않는다. plan은 1단계에 그대로 두고(plan:409) 3단계에
  60초 polling으로 바꾼다(plan:434). polling은 지금 없는 갱신과 요청을 새로 더한다. 이 문서는 `api` 모드에서
  채널을 열지 않는 안을 권하지만 plan을 바꾸는 일이라 결정이 필요하다(8.4절). 채널을 남기면 `api` 화면도 Realtime
  장애 때 unavailable이 된다.

### 5.2 빌드 시점 읽기

| 무엇 | 위치 | 언제 | 실패하면 |
|---|---|---|---|
| 변형 글 15개 | `transfigure-data.ts:35`, `:52` **[추가]** | 셸 패치 2개를 그릴 때(`patch-detail-page.tsx:843-849`). `patch:build`(`build-patch-worker.tsx:919,939`)와 `next build`(`src/app/(main)/patches/[version]/page.tsx:28`, `src/app/[gameLocale]/patches/[version]/page.tsx:34`) | production 빌드면 throw, 아니면 표본 글(`build-supabase-read.ts:31-37`, `transfigure-builtins.ts`) |
| 철학자 글 12개와 반응 합계 | `colorful-philosophers-gallery.ts:43,76` | 같음 | 글은 throw, 합계는 옛 카운터로 |
| 패치 HTML 설정 굽기 | `build-patch-worker.tsx:652-656,686-695` | `patch:build` | 값이 비면 정적 클라이언트가 '응답 없음'(`patch-comments-client.js:1054-1058`) |
| OG 필드 | `toybox-post-og-fields.ts:23`, `run-donation.ts:521`(`history-course/[runId]/page-content.tsx:40`) | generateMetadata. 셸 id라 건너뛴다(`static-detail-shell.ts:11-14`) | 요청 없음 |

- `next build`가 미리 만드는 `/patches/[version]` 결과는 내보내지 않는다. 모든 `/patches*`가 패치 Worker로 간다
  (`main-worker.ts:474-475`). 그런데도 이 읽기가 실패하면 main 배포 빌드가 멈춘다(CI env=production,
  `.github/workflows/cloudflare-workers.yml:31,158`). production이 아닌 빌드에서 0행이면 운영 행을 읽는다.
- 모듈 캐시가 프로세스마다라서 static generation 워커 수만큼 읽는다(`transfigure-data.ts:21`,
  `colorful-philosophers-gallery.ts:14`).
- `src/lib/supabase.ts:20`은 Node에서 import될 때도 클라이언트를 만든다. 쓰기 전에는 요청이 없다.

### 5.3 스크립트·테스트 전용

| 무엇 | 위치 | 내용 |
|---|---|---|
| 월드컵 기본 대회 심기 | `scripts/seed-favorite-tournament-builtins.ts:119-121` **[추가]** | `supabase db query --linked -f seed.sql`. linked DB 자격이라 RLS를 우회한다. builtin을 upsert(SQL `:75-113`), env는 production과 development(`--env=`, `:18-24`), `--dry-run`은 `:72`에서 멈춤. `package.json:72` `worldcup:seed` |
| dev 런 가져오기 | `src/app/api/dev/history-course-runs/*` | 3.6절. 로컬에서 운영 행을 읽는다 |
| `/dev/admin`, `/dev/colorful-philosophers` | 3.7절 | service 키 |
| contact 테스트 | `scripts/contact.spec.ts:19-29,117-118,153-154` | `/auth/v1/signup`과 `/rest/v1/contact_inquiries`를 mock, 가짜 HS256 세션. contact가 `api`가 되면 깨진다 **[추가]** |
| testbed 테스트 | `scripts/cloudflare-testbed.spec.ts:81-83`(`blockSupabase`), `:347,397,407,453,478` | `*.supabase.co`를 abort. `:396`은 공용 unavailable 화면을 본다. `api` 모드에서는 Worker가 Supabase를 부르므로 이 차단이 장애를 흉내 내지도, DB를 보호하지도 못한다 **[추가]** |
| Playwright DNS 차단 | `playwright.config.ts:29-34`, `run-cloudflare-testbed.mjs:218` | `PLAYWRIGHT_BLOCK_SUPABASE=1` |
| 모바일 QA 차단 | `.codex/skills/mobile-viewport-qa/scripts/check-mobile-route.mjs:42,64` | 기본 차단, `--allow-supabase` |
| Worker OG 테스트 | `scripts/detail-shell-og.spec.ts:305-328` | fetch stub, `stub.supabase.co`. CI에 없다 |
| 빌드 읽기 테스트 | `scripts/build-supabase-read.spec.ts:26-35,48` | 응답하지 않는 로컬 서버 |
| 경로 범위 확인 | `scripts/check-cloudflare-route-coverage.ts:126-151` | Supabase env를 지우고 fetch를 거부한 채 Worker가 asset만으로 응답하는지 |
| 네트워크 없는 spec | `defragment-feed.spec.ts`, `toybox-feed.spec.ts`, `nav-seen.spec.ts`, `contact-reply-notice.spec.ts`, `nav-indicators.spec.ts` | 순수 함수만. `supabaseEnabled`가 false |

## 6. 인프라 요약

### 6.1 지금의 요청 흐름

- 정적 asset: `wrangler.jsonc:8-11`에 `run_worker_first`가 없다. `.cloudflare/assets`의 파일(`public/**`,
  `/_next/static/**`, `/generated/**`)과 맞으면 Worker 없이 나간다. 페이지는 `/_cf_static_pages/` 아래라 페이지
  URL은 Worker를 부른다. 그래서 HTML 주입은 호출을 늘리지 않는다. `/api` 아래에는 asset이 없다
  (`generate-static-api-data.ts:461`가 옛 `api/search-index`를 지운다). 모든 `/api/*`는 Worker로 온다.
- `mainWorker.fetch`가 `routeRequest`를 `withSecurityHeaders`로 감싼다(`main-worker.ts:505-508`). `routeRequest`
  (`:460-503`) 순서:
  1. `/` 문서 요청은 Accept-Language로 302(크롤러 제외, `:138-149`)
  2. 옛 compendium 쿼리 URL 308(`:151-170`), 옛 worldcup 308(`:191-208`)
  3. 정적 asset 별칭 308, `/api/search-index` 포함(`:172-189`, `static-asset-aliases.ts:6-16`)
  4. 패치 경로는 `env.PATCH_WORKER.fetch(request)`를 그대로 돌려준다. binding이 없으면 503(`:474-485`, 판정
     `:51-61`)
  5. 홈(`:487`), 서비스(`:490`), 상세 셸과 OG(`:493`), STS1(`:496`), compendium(`:499`)
  6. `serveUnmatchedRequest`(`:441-458`): `nextRoutingResponse`(`next-routing-parity.ts:86-95`), `/api/link-preview`
     (`:445`), 미리 만든 redirect(`:447`), 서비스 페이지(`:450`), 있는 페이지에 GET·HEAD가 아니면 405(`:453-455`),
     나머지는 정적 404(`:457`)
- `fetchStaticPageAsset`(`:231-270`)은 조건부 헤더를 포함해 요청을 ASSETS에 넘기고, ETag를 유지한 채
  `Cache-Control: public, max-age=0, s-maxage=31536000, stale-while-revalidate=86400`(`:256`)을 붙인다. 304도
  그대로 지나간다.
- 패치 Worker(`patch-worker.ts:51-62`)도 원래 요청을 넘겨 304가 지나간다. 없는 페이지는 no-store에 ETag를 지운다.

### 6.2 `/api` 라우터 위치

- `routeRequest`의 맨 위, URL을 파싱한 직후(`main-worker.ts:461`)이고 `isPatchWorkerPath`(`:474`)보다 앞이다.
  그렇지 않으면 `/api/patches...`가 `/^\/[^/]+\/patches(?:\/|$)/`(`:59`)에 걸려 패치 Worker로 가서 404가 된다.
  `dev-patch-proxy.mjs:308`도 같다.
- 정확히 `/api/` 접두사만 받고, 라우터가 자기 JSON 404와 405를 낸다. HEAD는 본문 없는 GET이다(`:380` 패턴).
  OPTIONS는 204와 Allow(`:372-374`). 같은 출처 fetch는 preflight가 없다.
- 기존 것과 겹치지 않게 한다: `/api/search-index`(별칭), `/api/link-preview`(`:445`), `/api/dev/*`(Next dev 경로).
- 교차 사이트 검사는 `link-preview-handler.ts:107-110` 패턴을 쓴다. 응답은 그대로 `withSecurityHeaders`를 지난다.

### 6.3 플래그 주입 위치

- HTML이 나가는 길은 넷이다: `fetchStaticPageAsset`, `serveStaticNotFound`(404.html을 새 Request로 다시 받아
  304가 없다, `:420-425`), PATCH_WORKER 그대로 통과(`:475`), 상세 셸(이미 `HTMLRewriter`, `detail-shell-og.ts:514-588`).
- 넷을 다 덮는 한 곳은 `mainWorker.fetch` 감싸개(`main-worker.ts:505-508`)다. content type이 text/html이고 본문이
  있을 때만 넣는다(HEAD·304는 본문이 null, `document-locale.ts:38` 방식).
- 패치 페이지는 자기 설정 스크립트를 읽으므로(`build-patch-worker.tsx:652`, `patch-comments-client.js:77-88`) 그
  JSON을 고치거나 패치 클라이언트가 읽을 두 번째 스크립트를 더한다. 묶음 번들 셋(rich, nav-indicators,
  resource-patch-index)도 같은 값을 읽어야 한다.
- head에 붙여도 하이드레이션 뒤 남는다는 선례가 있다(`detail-shell-og.ts:582-586`, `cloudflare-testbed.spec.ts:346-380`).
- RSC 요청(`RSC: 1` 또는 `_rsc`, `main-worker.ts:79-81`)에는 넣을 수 없다. 플래그는 문서를 받을 때 정해진다.
- ETag와 304: 플래그가 바뀌어도 asset ETag는 그대로라 브라우저가 304를 받고 옛 플래그를 계속 쓴다. 고치는 방법은
  둘이다. A안은 HTML 요청에서 If-None-Match·If-Modified-Since를 지우고 ETag를 빼서 늘 200을 낸다(`patch-worker.ts:47`
  방식). B안은 `W/"<asset>-f<flagsVersion>"` 합성 ETag다. 어느 쪽이든 바뀐 본문에 asset의 강한 ETag를 남기지
  않는다. `stale-while-revalidate=86400`은 플래그가 든 HTML에서 빼는 것을 검토한다(브라우저 동작 확인 필요).
- 다른 운반 수단(plan에는 없다): HttpOnly가 아닌 쿠키를 모든 HTML·RSC 응답에 붙인다. 304와 RSC에도 적용되지만
  요청마다 쿠키 바이트가 붙는다.
- 서버 쪽 강제: 각 `/api` 처리기도 같은 플래그를 읽고, 그 화면이 꺼져 있으면 정해진 "legacy를 쓰라" 응답을 낸다.
  열어 둔 탭도 되돌리기가 닿게 하려는 것이다.
- 차가운 isolate에서 D1 플래그 읽기가 HTML을 늦춘다. 짧은 시간 제한을 두고 넘으면 `legacy`다.

### 6.4 env, binding, secret

- 지금 main Worker: ASSETS(`wrangler.jsonc:8-11`), PATCH_WORKER → scare-the-spire-patches(`:12-17`),
  LINK_PREVIEW_LIMITER(`:18-24`), nodejs_compat(`:7`), 호환 날짜 2026-06-15(`:6`), observability(`:44-46`). vars,
  D1, KV, secret은 없다. testbed는 workers_dev·preview_urls(`:27-28`), PATCH_WORKER → …-testbed(`:29-34`),
  limiter 1002(`:35-41`). 패치 Worker는 ASSETS만(`wrangler.patch.jsonc:7-18`).
- 런타임 변수는 운영·testbed 모두 없다고 기록돼 있다(`tasks/010…:139-141`, `docs/release/history/2026-11-02.md:103`).
  CI는 `NEXT_PUBLIC_SUPABASE_*`를 빌드에만 넘긴다(`cloudflare-workers.yml:26-33,150-160`). Cloudflare에서 직접
  확인하지는 않았다. `--keep-vars`(`package.json:19,21,23`, `run-cloudflare-testbed.mjs:290,305`)는 대시보드에서
  넣은 값을 남긴다.
- `detail-shell-og.ts`는 `NEXT_PUBLIC_SUPABASE_URL` → `SUPABASE_URL` → `process.env` 순서로 읽고 env 기본값은
  production이다(`:197-221`). testbed에는 `SUPABASE_ENV=development`를 꼭 넣어야 운영 행을 읽지 않는다.
- 로컬 `wrangler dev`: wrangler 4.156.0은 `.dev.vars`가 없으면 `.env`와 `.env.local`을 Worker 변수로 읽는다
  (wrangler-dist/cli.js:192423-192508, 25396-25399). 메인 checkout의 `.env.local`에는 URL, anon 키,
  `NEXT_PUBLIC_SUPABASE_ENV=development`, `SUPABASE_SECRET_KEY`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`,
  `SUPABASE_PROJECT_REF`가 있다. 그래서 메인 checkout의 `cf:preview`·`cf:testbed:local`은 OG 보강이 공유 Supabase로
  켜진다. 이 worktree에는 `.env.local`이 없다. `secrets.required`를 두면 그 이름만 읽고, `.dev.vars`가 있으면
  `.env`를 읽지 않는다(cli.js:192486-192517).
- 더하는 법:
  - 공개 값(SUPABASE_URL, SUPABASE_ENV, publishable 키, JWKS JSON, 플래그 기본값)은 최상위 `vars`와 `env.testbed`에
    둘 다 둔다. vars, secrets, d1_databases는 named env가 물려받지 않는다(cli.js:26796-26815, 26953-26962).
  - D1은 env마다 `database_id`를 적는다. 숨은 옵션 `experimental-auto-create`가 기본 true라서 id가 없으면
    `wrangler deploy`가 새 DB를 만든다(cli.js:241872-241878). `wrangler d1 create --location apac`와 읽기 복제
    켜기는 계정 변경이라 사용자 승인이 필요하다. 읽기 복제본은 Sessions API(`withSession`)로만 읽힌다(문서 확인
    필요).
  - secret: `wrangler secret put`은 바로 새 버전을 배포한다. CI 밖 운영 변경이라 승인이 필요하다. CI 대안은
    `secrets.required`와 `wrangler deploy --keep-vars --secrets-file <file>`이다(cli.js:241862-241866,
    177380-177412). testbed는 `run-cloudflare-testbed.mjs:283-306`에 같은 옵션을 더한다.
  - 1단계에는 secret이 필요 없다. URL과 publishable 키는 이미 클라이언트 번들에 있고(`supabase.ts:3-4`), JWKS는
    공개이고, 쓰기는 사용자 토큰을 넘긴다. service 키, 쿠키 HMAC 키, 레거시 HS256 secret은 4단계에 온다.
- 타입: Env가 두 곳에 있다(`main-worker.ts:9-19`, `detail-shell-og.ts:55-68`). workers-types가 없어 HTMLRewriter를
  직접 선언했다(`detail-shell-og.ts:32-53`, `document-locale.ts:3-20`). D1 타입도 같은 식이거나 `wrangler types`
  (`package.json:30`). `tsc`는 pre-push 훅에서만 돈다(`.githooks/pre-push:12-13`).
- 크기: Worker 예산 256 KiB(`check-cloudflare-worker-size.mjs:10`). Supabase 어댑터는 supabase-js가 아니라
  `detail-shell-og.ts:223-252`처럼 raw fetch로 쓴다.

### 6.5 testbed와 CI

- `pnpm cf:testbed`(`package.json:17`) 순서: cf:build(`run-cloudflare-testbed.mjs:265`), env=production으로
  patch:build(`:266-271`), 결과물 신선도(`:274`), patch:test·cf:size(`:275-276`), 패치 Worker 다음 main Worker를
  `--env testbed --keep-vars`로 배포(`:279-308`), 홈과 `/patches` 200 대기(`:223-261`), cf:smoke 3번(`:313`),
  `PLAYWRIGHT_BLOCK_SUPABASE=1`로 Playwright(`:210-220`).
- 로컬 판: 패치 8788, main 8787, `wrangler dev --local`, dev registry로 binding(`:10-11,135-165,343-361`).
- testbed가 쓰는 Supabase env: main 페이지는 checkout의 Next env(메인 checkout은 `.env.local`의 development), 패치
  페이지는 production 고정(`:270`). Worker 런타임에는 변수가 없다. 그래서 testbed 패치 댓글·반응은 지금도 운영
  행을 읽고 쓴다.
- 이 worktree에서 testbed를 돌리면: `.env.local`이 없어 클라이언트가 Supabase 꺼짐으로 빌드되고, patch:build는
  production 빌드에서 Supabase가 없어 throw한다(`transfigure-data.ts:62`, `colorful-philosophers-gallery.ts:38` →
  `build-supabase-read.ts:32-37`). `ALLOW_BUILD_WITHOUT_SUPABASE=1`이나 `.env.local`이 필요하다.
- testbed 요청도 계정 하루 10만에 든다(plan:110-119).
- CI(`ci.yml`, push·PR, Supabase env 없음): i18n:validate, patch:test, story-patch-line spec, codex:validate,
  test:version-api, test:security-headers, link-preview spec, worker-routing spec, build-supabase-read spec,
  encounter-compositions spec, lint, cf:build(cf:assets 포함), css:check, cf:size(`:30-63`). Playwright와
  detail-shell-og spec은 CI에 없다.
- 배포(`cloudflare-workers.yml`, main push): `workers/*`는 main만(`:101-105`), security-headers·`_headers`는 둘 다
  (`:80-84`), package.json·scripts·wrangler.jsonc는 둘 다(`:96-100`). 스모크는 `/`, `/compendium/cards`, 정적 상세
  HTML·RSC, 생성 JSON(`:301-362`). `/api` 스모크는 없다. 넣으려면 `cloudflare-route-smoke.mjs`(link-preview 선례
  `:307-321`)이고, 읽기 스모크는 Supabase를 부른다.
- Supabase 마이그레이션(예: 화면 하나를 한 번에 읽는 RPC)은 dry-run, `db push` 전 승인, Rollout·Order 줄이 필요하다
  (`RELEASE_PROCESS.md:39-47,118-152`). D1은 아직 절차가 없다(plan:354-356).

### 6.6 테스트

- Worker spec은 tsx 스크립트다. `node:assert/strict`, `main()`, 실패하면 `process.exit(1)`(`worker-routing.spec.ts:1-80`,
  `security-headers.spec.ts:55-115`). `mainWorker.fetch(new Request(...), { ASSETS, PATCH_WORKER }, { waitUntil(){} })`로
  부른다. HTMLRewriter(`detail-shell-og.spec.ts:205-218`)와 fetch(`:304-328`)를 stub한다. spec은 `ci.yml:34-48`이나
  `package.json`의 `test:*`(`:50-57`)에 손으로 등록한다.
- 모든 HTML에 주입하면 깨지는 spec: `worker-routing.spec.ts`(`:56-58`)와 `security-headers.spec.ts`(`:78`)는
  HTMLRewriter 없이 200 HTML을 받는다. `typeof HTMLRewriter`로 막거나 stub한다. 경로 범위 확인
  (`check-cloudflare-route-coverage.ts:130,146-151,171-189`)은 새 binding 없이 돌고 fetch를 거부하니, 플래그 코드는
  예외 없이 기본값으로 떨어지고 상태와 `x-cf-static-page`를 바꾸지 않아야 한다.
- 새 `/api` 코드는 `(request, env, ctx)` 처리기로 쓰고 fetch와 D1을 주입한다. PostgREST 가짜로 URL, apikey, 넘긴
  Authorization, env 필터를 확인한다. JWT는 Node 22 `crypto.subtle`로 ES256 키쌍을 만들어 시험한다. Miniflare와
  vitest-pool-workers는 없다(`package.json:104-127`).
- Playwright는 `playwright.config.ts:5-24` testMatch에 넣어야 한다. `*.supabase.co` route mock은 같은 출처 `/api`를
  보지 못한다. `api` 경로 시험은 `/api/*`를 mock한다. 서명을 확인하는 Worker는 가짜 HS256 토큰을 거절한다.
- `pnpm dev`는 Worker가 없다(3000 프록시 → `next dev` 3001, `dev-patch-proxy.mjs:11-12,299-350,445-450`). `/api`도
  주입도 없다. Next route handler로 흉내 내거나(`src/app/api/link-preview/route.ts:1-10`) `/api`를 `wrangler dev`로
  넘긴다. 클라이언트는 플래그가 없으면 `legacy`다.

### 6.7 CSP

- `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://cloudflareinsights.com https://www.youtube.com`
  (`security-headers.ts:21`, `public/_headers:6`), Report-Only(`security-headers.ts:36`). main(`main-worker.ts:507`)과
  패치(`patch-worker.ts:59,61`) 둘 다.
- 같은 출처 `/api`는 `'self'`라 1단계에 바꿀 것이 없다. Supabase 항목은 6단계까지 남긴다(plan:469). Realtime을
  남기면 wss도 남는다.
- 나중에 바꿀 때 두 파일이 같아야 한다(`security-headers.spec.ts:31-37`, CI·cf:assets·patch:build가 확인). 배포는
  두 Worker 모두다. testbed spec은 CSP 위반이 있으면 실패한다(`cloudflare-testbed.spec.ts:48-71`).

### 6.8 JWT 검증

- 지금 검증 코드는 없다. 저장소에 jwks·ES256·HS256·jose가 나오는 곳은 `contact.spec.ts:22`의 가짜 토큰뿐이다.
- "ES256 사용 중, HS256 이전 사용"은 2026-11-04 API 확인을 plan에 적은 것이다(plan:217-219). 코드로는 알 수 없다
  [충돌]. 코드와 설정으로 보이는 것: anon 키가 `sb_` 접두사(새 API 키), GoTrue v2.195.0(메인 checkout의
  `supabase/.temp/gotrue-version`), 프로젝트 ref vhscirjiywwmwlafkhjh(plan:207, `patch-comments-client.js:389-390`).
- Worker가 쓸 값: `SUPABASE_URL`을 env별 공개 var로 더한다. JWKS `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`,
  iss `${SUPABASE_URL}/auth/v1`, aud `authenticated`.
- 검증 순서: 헤더의 alg·kid → `crypto.subtle.importKey("jwk", key, {name:"ECDSA", namedCurve:"P-256"}, false, ["verify"])`
  → `verify({name:"ECDSA", hash:"SHA-256"}, ...)`. JWS 서명은 r‖s 64바이트라 WebCrypto 형식과 같다. CryptoKey는
  isolate마다 캐시한다. JWKS는 var에 고정하고(plan:210의 "미리 저장해 둔 공개키"와 같다), 모르는 kid면 다시 받는
  것을 선택으로 둔다. 1단계는 exp를 확인한다. exp를 무시하는 것은 4단계 claim뿐이다.
- 토큰 수명은 저장소에 없다. HS256은 4단계 claim에만 필요하다(레거시 secret을 Worker secret으로).
- 토큰을 URL에 넣지 않는다. observability가 켜져 있다(`wrangler.jsonc:44-46`). Workers Logs가 Authorization
  헤더를 남기지 않는지, Free 로그 한도가 얼마인지 확인한다.

### 6.9 `/api`가 깨뜨리거나 두 번 세는 것

- 끝 슬래시: `/api/`는 redirect하지 않는다(`next-routing-parity.ts:42`). 라우터가 정리하지 않으면 `/api/x/`는 404다.
- 로케일 접두사: `/en/api/x`는 영어 HTML 404, `/ko/api/x`는 메서드를 유지한 308(`next-routing-parity.ts:52-56`),
  `/EN/...`은 소문자 308. 클라이언트는 절대 경로 `/api/...`로만 부른다. 상대 경로면 404와 재시도로 두 번 센다.
- 모르는 경로에 GET·HEAD가 아닌 요청은 HEAD로 확인한 뒤 HTML 404다(`main-worker.ts:349-368,453-457`).
- `isDocumentRequest`는 fetch 기본값 `Accept: */*`를 문서로 본다(`:92-97`). 라우터가 앞이면 문제없다.
- `logStaticNotFound`는 HTML·RSC만 남긴다(`:404-407`). API 404는 라우터가 남긴다.
- 셈: `/api` 호출 하나가 Workers 요청 하나다. 안에서 보내는 PostgREST는 subrequest(Free 50, `DEPLOY.md:129-131`).
  JS를 실행하는 크롤러도 `/api`를 부른다. `isSearchCrawlerUserAgent`(`main-worker.ts:27,141`)는 이름을 밝힌 크롤러만
  거른다. 서비스 binding 호출(main → 패치)이 따로 세어지는지는 모른다(8.4절).
- `caches.default`에 기대지 않는다(workers.dev에서 효과 없음).
- Worker에서 나가는 요청은 모두 Cloudflare IP라 Supabase의 IP별 Auth 한도를 같이 쓴다. 1단계 동안 `/auth/v1`은
  브라우저에 둔다.

### 6.10 클라이언트 쪽 연결점

- `api` 경로는 `supabase.ts`를 바로 import하지 않는다. 지금은 네비 import 사슬(`site-navbar.tsx:16` →
  `use-nav-seen.ts:4` → `nav-seen.ts:9` → `supabase.ts`)로 모든 페이지가 클라이언트를 만들고 토큰 갱신을 시작한다.
  legacy 경로를 dynamic import로 두어야 `api` 화면이 Supabase Auth를 덜 부른다. 다만 쓰기 토큰은 여전히
  supabase-js가 준다.
- 플래그가 없으면(스크립트 없음, `pnpm dev`, 패치 Worker 직접 접근) `legacy`다.
- `supabaseEnabled` 조건도 플래그를 알아야 한다 **[추가]**: `contact-page.tsx:65`, `combo-history-run-picker.tsx:141`,
  `defragment-post-view.tsx:56-70`, `donation-panel.tsx:73`, `history-course-run-index.tsx:156,183,299,371,469,510`,
  `run-upload-zone.tsx:147,336`, `profile-activity.tsx:143,163`, `story-composer-modal.tsx:171-349`,
  `use-defragment-feed.ts:35-84`.
- 공용 헬퍼: `withSupabaseTimeout`(`supabase-timeout.ts`, 31개 파일)은 시간만 재고 fetch를 끊지 않는다. 새 API
  클라이언트는 AbortController를 쓰고, Worker의 Supabase subrequest 시간 제한을 클라이언트 8초보다 짧게 둔다.
- `useAuth`(42곳)에 `accessToken()` 헬퍼를 둘 자리다. 작성자 토큰(`currentAuthorProfileToken`, `user-profile.ts:118`)은
  localStorage만 쓴다.

## 7. DB 요약

### 7.1 전역 규칙

- 테이블 31개, 함수 28개, 트리거 19개, 정책 81개, 뷰 1개(`this_or_that_post_like_counts`, schema:3321). 31개 모두
  RLS가 켜져 있다(schema:4699-5420). 행은 모두 4,152개다.
- `TO`가 없는 정책은 PUBLIC이라 anon과 authenticated 둘 다다. JWT sub가 없으면 `auth.uid() = user_id`가 늘 실패한다.
  익명 로그인 사용자의 역할은 authenticated다.
- 대부분 `GRANT ALL TO anon, authenticated`라서 RLS만이 관문이다(schema:5707-6118). 권한을 좁힌 곳:
  colorful_philosopher_posts, debate_cycles, nav_indicators, puzzlebox_*, contact_inquiries, resource_reactions,
  colorful_philosopher_reactions.
- guard 트리거는 모두 `WHEN (CURRENT_USER = ANY ('anon','authenticated'))`다. service_role과 SECURITY DEFINER 안에서는
  돌지 않는다. 카운터 트리거가 카운터를 바꿀 수 있는 이유다(`supabase/migrations/20261031044402_rls_hardening.sql:48-54`).

### 7.2 테이블

정책 칸의 R·I·U·D는 select·insert·update·delete다. `uid`는 `auth.uid() = user_id`(runs는 donor_user_id).

| 테이블 | 행 | env | 소유 열 | 정책 | 트리거·파생 값 | 메모 |
|---|---|---|---|---|---|---|
| chemical_posts | 54 | 있음 | user_id CASCADE(4443) | R true(4719), I uid(4712), D uid(4705), U 없음 | guard_post(4310). like·comment_count | 색인 3778-3806 |
| colorful_philosopher_posts | 28 | 있음, 기본값 없음 | 없음 | R anon·auth(4732), SELECT 권한만(5716-5718) | buff·nerf·rework_count(반응 트리거가 씀) | 쓰기는 service만. UNIQUE(env, week_start, slot)(3757) |
| colorful_philosopher_reactions | 2 | 있음, PK(post_id, user_id)에는 없음(3493) | user_id CASCADE | R true(4759), I·U·D TO authenticated(4752, 4766, 4745), UPDATE(kind)(5725-5734) | 4317 | 쓰는 코드 없음 |
| combo_posts | 86 | 있음 | user_id CASCADE(4467) | R true(4793), I(4786), U(4800), D(4779) | guard_post(4324) | 색인 3813-3841 |
| comment_likes | 58 | **없음** | user_id CASCADE(4483) | R true(4827), I(4820), D(4813) | - | UNIQUE(comment_id, user_id)(3509), comments CASCADE(4475) |
| comments | 384 | 있음 | user_id CASCADE(4499) | R true(4854), I(4847), D(4840), U 없음 | guard_insert(4331), 참여 카운터(4338) | parent_id 자기참조 CASCADE(4491). 색인 3855, 3862, 3869 |
| community_stories | 25 | 있음 | user_id(공식 행은 null) CASCADE(4507) | R true(4881), I(4874), D(4867) | guard_insert(4345), static_story_id = null | UNIQUE(env, static_story_id)(3533). GIN 전문 검색(3890)은 쓰지 않음 |
| contact_inquiries | 11 | 있음 | user_id SET NULL(4515) | R TO authenticated uid(4901), I TO authenticated uid·status new(4894), U TO authenticated(4908), D 없음. 열 단위 권한(5784-5889), anon 없음 | rate limit(4359), clear_reply_seen(4352) | CHECK 2751-2780 |
| debate_cycles | 3 | 있음 | - | R anon·auth(4921), SELECT만 | - | 쓰지 않는다(`debate-cycle.ts:4` 상수만) |
| decisions_decisions_posts | 19 | 있음 | user_id CASCADE(4523) | R(4948), I(4941), U(4955), D(4934) | guard_post(4366) | rows·placements 1 MB |
| defragment_bodies | 9 | PK(env, source_service, source_id)(3574) | user_id CASCADE(4531) | R true(4982), I·U TO authenticated uid + source_owned(4975, 4989), D uid(4968) | **없음** | 색인 3960이 PK와 같다 |
| defragment_posts | 0 | 있음 | user_id(4539) | R(5016), I(5009), U(5023), D(5002) | guard_post(4373) | publication에 든 유일한 테이블 |
| favorite_tournament_candidate_stats | 632 | PK(tournament_id, env, type, id)(3590) | - | R true(5076). 쓰기는 RPC만 | RPC가 씀 | posts CASCADE(4547) |
| favorite_tournament_plays | 68 | 있음 | user_id CASCADE(4563) | R true(5042). 쓰기는 RPC만 | - | 클라이언트는 읽지 않음(`favorite-tournament.ts:23` 상수만) |
| favorite_tournament_posts | 47 | 있음 | user_id(builtin은 null, 2979) | R true(5069), I uid·NOT builtin(5062), D uid(5055), U 없음 | guard_post + play_count(4380) | 부분 UNIQUE(env, preset_key)(3995) |
| likes | 300 | 있음 | user_id CASCADE(4579) | R true(5103), I(5096), D(5089) | 참여 카운터(4387) | UNIQUE(story_id, user_id, env)(3621). 반응 8종, 기본 thumb_up |
| nav_indicators | 2 | PK env(3630) | - | R anon·auth(5116) | - | 쓰지 않는다(`nav-indicators.ts:1` 상수만) |
| pagestorm_drafts | 3 | 있음 | user_id CASCADE(4587) | R uid(5143), I(5136), U(5150), D(5129) | **없음** | 색인 4072 |
| pagestorm_posts | 14 | 있음 | user_id | R(5177), I(5170), U(5184), D(5163) | guard_post(4394) | 색인 4079-4100 |
| profile_character_nickname_pools | 10 | **없음** | - | R anon·auth(5197). GRANT ALL인데 쓰기 정책이 없어 막힌다 | - | CHECK 함수(3091). 쓰기는 관리 화면만 |
| puzzlebox_best | 2 | PK에 있음, CHECK 없음(3662) | user_id | R TO authenticated 자기 것(5210) | RPC가 씀 | 순위 색인 4282 |
| puzzlebox_board_stats | 1 | PK(3670) | - | R true(5223) | RPC가 씀 | integer[] 셋 |
| puzzlebox_players | 2 | **없음** | user_id PK(3678) | R 자기 것(5236) | RPC가 씀 | - |
| puzzlebox_runs | 2 | 있음 | user_id | R 자기 것(5249) | RPC가 씀 | id IDENTITY(3187-3194) |
| resource_reaction_counts | 24 | PK(3694) | - | R true(5262). 쓰기 정책 없음 | 반응 트리거가 씀 | GRANT ALL to anon(6046) |
| resource_reactions | 76 | PK(3702) | user_id | R true(5289), I uid(5282), U TO authenticated(5296) + UPDATE(kind)(6064), D uid(5275) | 합계(4401) | - |
| runs | 687 | PK(id text, env)(3709) | donor_user_id SET NULL(4643) | R true(5323), I(5316), U(5330), D(5309) | guard_post(4408). like·comment_count | raw 8 MiB까지(3267). 색인 4107-4156 |
| this_or_that_post_likes | 10 | 있음 | user_id(4659) | R true(5357), I(5350), D(5343) | 좋아요 카운터(4415) | UNIQUE(3726) |
| this_or_that_post_votes | 1485 | 있음 | user_id(4675) | R 자기 것(5386), I uid·같은 env 원글(5377-5379), D(5370) | 투표 카운터(4422) | PK 없음, UNIQUE(post_id, user_id, env)(3734) |
| this_or_that_posts | 23 | 있음 | user_id | R(5413), I(5406), D(5399), U 없음 | guard_post + 투표 카운터(4429) | vote_rate_bps 생성 열(3369). 색인 4177-4233 |
| transfigure_posts | 85 | 있음 | user_id | R(5440), I(5433), U(5447), D(5426) | guard_post(4436) | 37열, text[] 넷, 정규식·한국어 enum CHECK(3393-3461) |

### 7.3 함수

| 함수 | 종류·보안 | 권한 | 부르는 곳 |
|---|---|---|---|
| admin_story_service | IMMUTABLE(42-62) | service_role(5464) | 없음(관리) |
| apply_colorful_philosopher_reaction_counts | 트리거, DEFINER(71-105) | service_role | 4317 |
| apply_resource_reaction_counts | 트리거, DEFINER(114-166) | service_role | 4401 |
| apply_this_or_that_like_count_delta | 트리거, DEFINER(175-199) | service_role | 4415 |
| apply_this_or_that_vote_count_delta | 트리거, DEFINER(208-244) | service_role | 4422 |
| apply_toybox_thread_engagement_delta | 트리거, DEFINER(253-367). story_id를 `:`로 나눠 고름 | service_role | 4338, 4387 |
| clear_contact_inquiry_reply_seen | 트리거, INVOKER(376-387) | - | 4352 |
| complete_favorite_tournament_play | DEFINER(396-543) | anon·authenticated(5520-5523) | `use-favorite-tournament-posts.ts:246` |
| defragment_source_owned | SQL STABLE INVOKER(552-580) | authenticated(5530-5532) | 정책 4975, 4989 |
| enforce_contact_inquiry_rate_limit | 트리거, DEFINER(589-617) | - | 4359 |
| get_defragment_feed | INVOKER(626-863), v1 | anon(5547) | `defragment-feed.ts:268`(대체 경로) |
| get_defragment_feed_v2 | INVOKER(872-1125) | anon(5556) | `defragment-feed.ts:254` |
| get_engagement_counts | SQL STABLE INVOKER, search_path 없음(1134-1156) | anon(5565) | `use-engagement-counts.ts:29` |
| get_my_profile_activity | SQL STABLE INVOKER(1165-1283), limit 50 | authenticated(5574-5576) | `use-profile-activity.ts:151,192` |
| get_my_profile_activity_stats | INVOKER(1292-1372) | authenticated(5583-5585) | `use-profile-activity.ts:108` |
| get_my_puzzlebox_standings | DEFINER(1381-1414) | authenticated(5592-5594) | `use-puzzlebox-scores.ts:242` |
| get_puzzlebox_leaderboard | DEFINER(1423-1496) | anon·authenticated(5601-5604) | `use-puzzlebox-scores.ts:194` |
| get_rls_activity_metrics | DEFINER(1505-1840) | service_role(5611-5612) | `admin-dev-page.tsx:549` |
| get_story_reaction_counts | INVOKER(1849-1859) | - | **없음** |
| get_this_or_that_vote_summaries | DEFINER(1868-1888), id 50개 상한 | anon(5629) | `use-this-or-that-votes.ts:65` |
| get_this_or_that_vote_totals | DEFINER(1897-1907) | - | **없음** |
| get_toybox_feed | plpgsql STABLE INVOKER(1916-2013), 동적 SQL | anon(5648) | `toybox-feed.ts:314` |
| guard_insert_server_columns | 트리거, INVOKER(2022-2033) | - | 4331, 4345 |
| guard_post_server_columns | 트리거, INVOKER(2042-2073) | - | 9곳 |
| profile_nickname_list_is_valid | IMMUTABLE(2082-2110) | PUBLIC(5673-5675) | CHECK(3091) |
| puzzlebox_run_display | IMMUTABLE | service_role(5682-5691) | RPC 안 |
| puzzlebox_score_run | IMMUTABLE(2144-2338) | service_role | RPC 안. TS 판 `vexing-puzzlebox-score.ts`와 같아야 한다 |
| submit_puzzlebox_run | DEFINER(2344-2546) | authenticated·service_role(5698-5700) | `use-puzzlebox-scores.ts:133` |

클라이언트가 부르는 RPC는 12개다(관리용 `get_rls_activity_metrics`와 대체 경로 v1 포함). plan 1절의 "함수 31개,
트리거 8개 이상"(plan:40)은 0단계 결과의 "함수 28개, 트리거 19개"(plan:392)보다 먼저 적은 값이다 [충돌].

### 7.4 트리거와 RPC가 유지하는 파생 값

| 값 | 누가 | 근거 |
|---|---|---|
| comment_count(글 테이블 8개, runs) | comments 트리거, story_id 접두사로 고름 | schema:276-286, 299-332 |
| like_count(combo, transfigure, chemical, defragment, decisions, favorite, pagestorm, runs) | likes 트리거 | schema:333-362 |
| this_or_that like_count | this_or_that_post_likes 트리거 | schema:193-195 |
| left·right_vote_count, 생성 열 vote_rate_bps | 투표 트리거 | schema:236-240, 3369 |
| colorful buff·nerf·rework_count | 철학자 반응 트리거 | schema:77-101 |
| resource_reaction_counts | 리소스 반응 트리거 | schema:142-159 |
| play_count, candidate_stats(등장, 승, 우승, current_rank, rank_history) | 대회 RPC | schema:463-539 |
| puzzlebox_best, board_stats, runs.attempt | 퍼즐 RPC | schema:2435-2521 |
| created_at = now, 새 글 카운터 0 | guard 트리거 | schema:2027, 2048-2056 |
| 문의 trim·소문자, reply_seen_at 초기화 | 문의 트리거 | schema:598-599, 383 |

수를 세는 방식이 여섯 가지다. 2단계 "파생 값 복사"와 5단계 "원본 행만 미러"에서 대조할 때 쓴다.

1. 클라이언트 `comments.length`(`comment-section.tsx:112-118`)
2. likes HEAD `count=exact`(`use-likes.ts:51-57`)
3. 클라이언트 행 세기: comment_likes(`use-comment-likes.ts:24-29`), 역사 강의서(`use-history-course-engagement.ts:64-75`),
   이거 vs 저거 댓글(`use-this-or-that-comment-counts.ts:47-65`), 철학자 댓글(`use-colorful-philosopher-posts.ts:236-250`)
4. 서버 GROUP BY(`get_engagement_counts`, schema:1137-1155)
5. 트리거가 유지하는 `resource_reaction_counts`(schema:114-166)
6. 트리거가 유지하는 글 테이블·runs 카운터(schema:253-340)

같은 값을 두 곳에서 따로 계산하는 곳: 이거 vs 저거 좋아요 수(뷰와 열), runs 참여 수(클라이언트 세기와 열),
철학자 글의 옛 카운터(selected, 화면은 `resource_reaction_counts`, `resource-thread.tsx:64`). 카운터는
`greatest(0, …)`로 아래를 막아 한 번 틀어지면 실제 수와 다시 맞지 않을 수 있다.

### 7.5 Postgres에만 있는 기능(D1·Worker로 옮길 때)

- uuid 기본값 `gen_random_uuid()`. Worker는 `crypto.randomUUID()`. story_id 안에 들어가니 소문자 TEXT로 둔다.
- IDENTITY(`puzzlebox_runs.id`, 3187)를 `puzzlebox_best.run_id`가 참조한다. SQLite는 INTEGER PRIMARY KEY.
- `now()`와 timestamptz. keyset 튜플 비교(schema:1976-1986)가 맞으려면 ISO 문자열 형식을 하나로. created_at이
  nullable인 테이블이 다섯이다(2566, 2684, 2668, 2993, 3250).
- jsonb 20개 넘음. CHECK의 `jsonb_typeof`·`jsonb_array_length`는 `json_type`·`json_array_length`로. `pg_column_size`
  상한은 TEXT 바이트 길이와 뜻이 다르다. RPC의 `jsonb_array_elements`, `jsonb_each_text`, LATERAL, `jsonb_agg`,
  `to_jsonb(row)`, `||`.
- 배열: text[] 넷과 cardinality CHECK(3412-3415, 3432-3433), 닉네임 배열과 plpgsql CHECK, integer[] 1부터
  인덱스와 `array_fill`(2483-2503), uuid[] 인자(1868).
- 생성 열 STORED(3369). SQLite는 ALTER TABLE로 STORED 생성 열을 더할 수 없다.
- GIN 전문 검색(3890). 쓰는 곳이 없다.
- 정규식 `~`(CHECK 2774, 3175, 3453-3457, RPC 1388, 2380, 2412, 2416). D1에 REGEXP가 없어 Worker가 검사한다.
- LIKE 대소문자: Postgres는 구분하고 SQLite는 ASCII를 구분하지 않는다. `'builtin:%'`(2979, 3995, 5062),
  `admin_story_service`, 클라이언트 `.like`(`use-favorite-tournament-posts.ts:137`). GLOB이나 substr로.
- 동적 SQL `format('%I')`, EXECUTE(665, 1990).
- `pg_advisory_xact_lock`(601, 2385), `FOR UPDATE`(2437, 2466). D1은 잠금이 없어 batch 하나나 조건부 upsert로.
- `timezone('Asia/Seoul')`, `generate_series(interval)`(1514, 1619, 1739), `auth.users` 읽기(1687).
- `md5`: 순위표 tag(1462)가 지금 값과 같아야 한다.
- 쓰기 증폭: 플레이 한 번에 그 대회의 후보 통계 전체를 다시 쓴다(515-539).
- 전체 스캔 집계: `get_engagement_counts`, `get_my_profile_activity`의 OFFSET과 `count(*) over()`(1275-1282).
- 연쇄 삭제와 트리거: 답글 CASCADE마다 카운터(4491, 4338). likes·comments는 FK가 없어 원글을 지워도 남는다.
- `auth.users` FK(4443-4692)는 D1에서 뜻이 없어진다.
- env 없는 테이블(comment_likes, puzzlebox_players, profile_character_nickname_pools)은 D1을 env별로 나눌 때 규칙이
  필요하다. comment_likes는 `comment_id → comments.env`로 정한다.
- 크기: raw 8 MiB 허용, D1 행은 약 2 MB(문서 확인 필요). 지금 가장 큰 값은 84 KB 런, 34 KB 문서다
  (`rls_hardening.sql:443-446`). 여러 런을 한 문장으로 upsert하면 바인딩 100개 한도를 넘을 수 있다.
- 오류 코드 계약(4.2절).

### 7.6 쓰이지 않는 것

- 테이블: nav_indicators(204cb63f에서 읽기 제거), debate_cycles(73af87f0), defragment_posts(쓰기·상세만 남음, 피드
  RPC에서 빠짐, `supabase/migrations/20260820074851_defragment_feed_drop_native.sql`), favorite_tournament_plays(RPC와
  관리 지표만), puzzlebox_runs(RPC 안 감사 기록).
- 함수: get_story_reaction_counts, get_this_or_that_vote_totals(부르는 곳 없음), get_defragment_feed v1(대체 경로).
- 열·색인: vote_rate_bps와 색인 둘(4212, 4219). recommend 식 색인 7개(3799, 3834, 3946, 3981, 4030, 4198, 4261.
  지금 recommended 정렬은 like_count만, 1962-1963). PK와 같은 색인(3960). GIN(3890). likes의 겹치는 색인(4051, 4058,
  4065와 3621). idx_runs_env(4128).
- 스키마는 늘리기만 하므로 지우는 것은 7단계 뒤다(plan:354-356).

### 7.7 저장소와 운영 dump의 차이

- 정정(2026-11-07, [CLEANUP_AUDIT.md](CLEANUP_AUDIT.md) 3.5절): 아래 첫 줄은 틀렸다. `likes`, `comments`,
  `comment_likes`, `runs`, `chemical_posts`, `community_stories`와 `get_engagement_counts`의 DDL은 `supabase/setup.sql`과
  `migration-0xx`에만 있다. 7.6절의 `puzzlebox_runs`도 쓰이는 표다.
- 테이블 31개와 함수 28개는 모두 저장소 마이그레이션에서 만들어진다. 정책 이름 81개가 같다.
- 이름으로 찾을 수 없는 트리거 11개는 `rls_hardening.sql:93-153`의 `format()`으로 만들어진다.
- 저장소에만 있는 색인 셋은 나중에 지워졌다(`supabase/migrate-env.sql:13,15`, `20260923223000_debate_cycle_weeks.sql:70`).
- 번호만 있는 옛 파일(`supabase/setup.sql`, `migrate-env.sql`, `migration-002`~`014`)은 `supabase/migrations/` 밖이라
  CLI가 적용하지 않는다.
- 함수 본문은 guard, complete_play, defragment_source_owned만 `rls_hardening.sql:55-384`와 같음을 확인했다. 나머지는
  한 줄씩 비교하지 않았다.

## 8. 위험과 열린 질문

### 8.1 조사 결과끼리 다른 곳

| 무엇 | 한쪽 | 다른 쪽 | 이 문서의 판단 |
|---|---|---|---|
| 네비 요청 수 | plan: 페이지마다 "최신 1행 쿼리 10개"(plan:81, 282) | 네비·피드 영역과 DB 보고: nav-seen이 보내는 것은 9건(8 테이블 + 철학자, `nav-seen.ts:282-326`). 10번째는 메일함 점일 것 | 9건 + 메일함 0~1건으로 적었다 |
| React 철학자 릴과 `fetchResourceReactionCounts` | 댓글 영역: 패치 상세마다 1건 | 패치 영역: 운영에서 돌지 않는다. 패치 페이지는 하이드레이션하지 않고 `/patches*`는 RSC까지 패치 Worker로 간다(`main-worker.ts:474-475`, `patch-worker.ts:24-31`) | 패치 영역 근거가 더 구체적이다. dev 전용으로 적었다 |
| 상세 셸 OG의 Supabase 부하 | 장난감 상자 A·B 영역: 어려운 결정·월드컵 상세 HTML마다 실패하는 요청 1건 | 인프라 보고, 누락 검토: Worker에 변수가 없어 OG 보강 전체가 꺼져 있다(`tasks/010…:139-141`) | 지금은 꺼져 있다. 켜는 순간 그 부하가 생긴다. Cloudflare 실제 값은 확인하지 않았다 |
| 메일함 점 플래그 | 신원 영역: `nav` | 댓글 영역: `contact` | `contact`(1.2절) |
| 배달부 플래그 | 댓글 영역: `nav` | 패치 영역: `comments`나 별도 | `nav`(1.2절) |
| 이거 vs 저거 좋아요·투표 쓰기 플래그 | 장난감 상자 B 영역: 쓰기는 `comments` | - | `toybox-feed`(2절 14번) |
| 콤보 런 표지 플래그 | 역사 강의서 영역: `toybox-feed`나 `history-runs` | 장난감 상자 A 영역: 피드에 넣음 | `toybox-feed` 응답 안(2절 11번) |
| JWT 서명 방식 | plan: 2026-11-04 API 확인으로 ES256 사용 중, HS256 이전 사용(plan:217-219) | 신원 영역: 저장소로는 알 수 없다 | plan 값을 쓰되 구현 전에 JWKS로 확인한다 |
| Realtime | plan: 1단계 그대로, 3단계 polling(plan:409, 434) | 모든 영역: 이벤트가 오지 않는다(pub:2) | 결정 필요(8.4절) |
| 댓글 응답의 parent_id | 댓글 영역: meta·parent_id 빼기 | 패치 영역의 응답안: parent_id 포함 | 지금 읽는 클라이언트가 없다. 결정 필요 |
| 엔드포인트 이름 | 영역마다 다름(`/api/codex-thread`, `/api/read/comments`, `/api/toybox/feed` 등) | plan 5절 `/api/read`·`/api/me`·`/api/write` | plan 규칙으로 통일(1.2절) |
| 함수·트리거 수 | plan 1절: 함수 31, 트리거 8 이상(plan:40) | dump와 plan 0단계 결과: 함수 28, 트리거 19(plan:392) | dump 값 |
| testbed main 페이지의 env | 신원 영역: 모른다(`run-cloudflare-testbed.mjs:270`은 패치만 production) | 인프라 보고: checkout의 `.env.local`을 따른다. 메인 checkout은 development | 인프라 보고 값 |

### 8.2 위험

**요청 수와 Workers 한도**

- 네비가 가장 큰 곱셈이다. 페이지마다 9건, 패치 페이지는 캐시가 없다. 지금 쿼리는 사용자별 `since`를 넣어 공유
  캐시가 안 된다. 사용자와 무관한 최신 시각 지도로 바꾸고 클라이언트가 비교한다.
- `/api/read/nav`는 두 Worker의 페이지마다 Workers 요청 1건을 더한다(main 하루 1만~1.7만 페이지, plan:266).
  `Cache-Control: public, max-age=60`이면 브라우저 캐시가 탭과 soft navigation의 반복을 흡수한다. Worker 안의
  Supabase 9건은 메모리 캐시가 맞거나 합계 RPC를 더하지 않으면 그대로다.
- N+1: 백과사전 상세(철학자 글마다 2~3건, 최대 60건), 니오우스레터(claim마다 1~3건), 철학자 목록(카드마다 1~2건),
  콤보 목록(런 참조마다 raw 포함 1건, 최대 40건).
- 같은 화면 안의 되풀이: 이거 vs 저거 좋아요·투표가 더 보기마다 쌓인 id 전부로 다시 읽는다. 댓글 좋아요는 id 목록이나
  userId가 바뀔 때마다 다시 읽는다. 익명 가입 직후 모든 `useAuth`가 개인 읽기를 한꺼번에 다시 돈다. lazy 좋아요는
  첫 클릭에 2건이다. 패치 정적 클라이언트는 쓸 때마다 2~3건을 다시 읽는다. 쓰기 응답이 새 상태를 돌려주면 없어진다.
- 대체 경로의 두 번 호출: 피드 RPC → 테이블, v2 → v1, 열 없음 재시도, dev의 두 env 읽기. 운영에 RPC와 열이 있으니
  Worker는 옮기지 않는다.
- 쓸데없는 호출: 모든 패치 페이지의 변형 릴 읽기, `/byrdispatch`의 이야기 100행과 채널, 서류 폭풍 고르기의 전체
  post와 다시 읽기, 늘 받는 기본 대회, 조각모음·역사 강의서마다의 닉네임 동기화 쓰기, 공유하지 않은 런의 표지 저장이
  익명 계정을 만드는 것(`history-course-run-index.tsx:297-311`).
- JS를 실행하는 크롤러도 `/api`를 부른다.

**응답 크기(첫 데이터 128 KB 상한, plan:190-191)**

- 댓글 `select *` limit 없음, content_blocks·meta 각 128 KB. 쓰기 본문도 content_blocks로 128 KB에 가까울 수 있다
  (클라이언트는 보이는 길이만 본다).
- `get_toybox_feed`는 행 전체를 준다. 지금 최대 79 KB지만 CHECK 상한은 행마다 MB다(schema:2650, 2839, 2976, 3070,
  3435, 3438).
- 서류 폭풍 목록 50개 문서(약 180 KB 추정), 임시 저장 20개 문서, 기본 대회 전부(미측정).
- 런 목록 7.9 MB, 고르기 3.1 MB, 상세 293 KB, 표지 하나 260 KB.
- 이야기 1000행(`/patches/changes`), 프로필 활동의 content_blocks, 내 문의 최악 약 2.4 MB.
- `get_engagement_counts`는 env 전체라 계속 커지고 max-rows(Supabase 기본 1000)에서 조용히 잘린다. 클라이언트 행
  세기(limit 1000)도 같다.

**신원과 권한**

- 개인 읽기가 클라이언트가 준 user_id로 거르고 읽기 정책은 `USING (true)`라 누구의 좋아요·반응이든 읽힌다. API는
  JWT sub만 쓴다.
- env를 클라이언트가 고르고 RLS는 env를 보지 않는다.
- 0행 delete가 성공으로 보이고, 0행 update는 화면 전체를 unavailable로 만든다.
- 반응 쓰기가 localStorage의 이전 값에 기댄다.
- 갱신하는 곳이 둘이라 refresh token 회전이 겹친다. Worker가 갱신하면 회전 재사용 감지로 세션이 끊길 수 있다.
  Worker는 검증하고 넘기기만 한다.
- 패치 클라이언트는 갱신이 어떤 이유로든 실패하면 새로 가입해 uid를 잃는다. 4단계 claim이 기대는 토큰도 함께 사라진다.
- 패치 클라이언트는 만료된 토큰으로 공개 읽기를 보내 401을 받고 '응답 없음'을 띄운다. api 경로는 신선한 토큰만 보내고
  Worker는 공개 읽기에서 잘못된 토큰을 무시한다.
- Auth가 1단계에도 브라우저 직접이라 Supabase Auth 장애는 `api` 화면의 첫 쓰기도 막는다. CSP의 supabase.co와
  supabase-js는 4·6단계까지 남는다.
- `supabase.ts`를 모듈 범위에서 만들어 `api` 화면에서도 토큰 갱신이 돈다. legacy를 dynamic import로 둔다.
- 여러 `useAuth` 인스턴스가 동시에 `ensureUser`를 부르면 익명 가입이 둘 생길 수 있다.
- JWT 검증은 ES256 JWKS를 전제로 한다. 저장소로는 확인할 수 없다.

**Worker와 인프라**

- 라우터 순서와 이름 충돌(6.2절, 6.9절).
- 플래그가 패치 페이지에 닿지 않을 수 있다. 패치 응답은 그대로 돌려주고 번들은 빌드 때 구운 설정만 읽는다.
- 304와 stale-while-revalidate로 옛 플래그가 남는다. 열어 둔 탭은 새로고침 전까지 옛 플래그다.
- 모든 HTML에 HTMLRewriter를 거는 CPU(큰 compendium 페이지). testbed에서 지금 P50 0.8~1.4 ms(plan:267)와 비교한다.
- HTMLRewriter가 없는 spec 두 개가 깨진다.
- 차가운 isolate의 D1 플래그 읽기가 HTML을 늦춘다.
- `wrangler d1 create`와 `wrangler secret put`은 CI 밖 운영 변경이라 승인이 필요하다. `database_id`가 없으면 deploy가
  DB를 만든다.
- 브라우저 QA 차단은 Worker → Supabase를 막지 못한다. `api` 화면이 생기면 testbed와 로컬 QA가 Worker를 통해 공유
  Supabase를 부른다. Worker 쪽 kill switch나 testbed 기본값 `legacy`가 필요하다.
- testbed env 불일치: 패치 페이지는 production으로 빌드되고 testbed Worker var는 development일 것이라 같은 testbed
  패치 페이지에서 legacy와 api가 다른 행을 읽는다.
- Workers Logs의 Authorization 기록, Free 로그 한도, `--keep-vars`가 남기는 옛 변수.
- 빌드 결합: 내보내지 않는 `next build`의 패치 미리 만들기가 Supabase 장애 때 main 배포를 멈춘다.

**D1 이식(2단계 이후)**: 7.5절.

### 8.3 운영에도 있는 버그

메모리 규칙에 따라 [tasks/010](../../tasks/010-production-known-issues.md)에 기록하고 리팩토링 묶음 뒤에 고칠
대상이다. 이 문서는 읽기 전용 조사라 기록하지 않았다.

| 버그 | 근거 | 지금 드러나나 |
|---|---|---|
| 어려운 결정 상세 OG가 없는 테이블 `decisions_posts`와 없는 열 `situation_character`를 읽는다. 실제는 `decisions_decisions_posts`(schema:2816) | `detail-shell-og.ts:456-460` | 아니다. OG 보강 전체가 꺼져 있다(032번과 연결) |
| 월드컵 상세 OG가 `this_or_that_posts`를 읽는다. `defragment-favorite_tournament`는 분기가 없다 | `detail-shell-og.ts:358-367` | 같음 |
| 이거 vs 저거 목록이 3페이지(60개)를 넘으면 투표 요약 RPC가 오류를 내고 모든 카드의 투표가 막힌다 | `this-or-that-client.tsx:73-75`, schema:1873-1875, `use-this-or-that-votes.ts:127-131` | 운영 env 글이 50개를 넘을 때. 지금 행은 두 env 합 23개라 아직은 아니다 |
| 케미컬X 상세가 장애 때 '없음'을 보이고, 요청이 멈추면 로딩이 끝나지 않는다 | `chemicalx/post-view.tsx:55-66,105-116` | 장애 때 |
| 답변 읽음 표시의 타임아웃을 catch하지 않아 unhandled rejection이 나고 점이 남는다 | `profile-activity.tsx:171` | 장애 때 |
| Realtime join 실패가 이미 받은 장난감 상자 피드를 unavailable로 덮는다 | `use-toybox-feed.ts:128-132`, `this-or-that-client.tsx:112,174-178` | Realtime 장애 때 |
| 댓글 좋아요가 쓰기 결과를 보지 않아 실패해도 눌린 것으로 보인다 | `use-comment-likes.ts:50,62` | 실패 때 |
| 런 공유 취소가 0행이어도 성공으로 보여 공개된 채 남을 수 있다 | `run-donation.ts:706-716` | 세션을 지운 뒤 |
| 공유하지 않은 런의 표지 저장이 원격 동기화를 시도하며 익명 계정을 새로 만들 수 있다(0행 update) | `history-course-run-index.tsx:297-311`, `history-course-share-state.ts:41-43` | 세션이 없을 때 |
| dev 전용: 관리 화면이 runs를 두 번 읽어 중복 행과 두 배 수를 보인다 | `admin-rls-activity.ts:15-19`, `defragment.ts:38` | dev만 |

### 8.4 열린 질문

신원·인프라

1. JWKS를 var에 고정할지 런타임에 받을지, 키가 돌면 누가 바꿀지. ES256 사용 여부와 토큰 수명을 구현 전에 확인한다.
2. 플래그 운반: HTML 스크립트(plan) 또는 쿠키. ETag는 A안(늘 200)이나 B안(합성 ETag).
3. 패치 페이지 플래그: main Worker가 패치 응답에 HTMLRewriter를 걸지, 패치 Worker가 D1 binding을 가질지.
4. testbed 패치 페이지가 쓸 Supabase env.
5. 운영·testbed Worker에 정말 vars·secrets가 없는지(`wrangler deployments status`나 대시보드).
6. 운영 패치 Worker의 workers.dev 주소가 켜져 있는지(`wrangler.patch.jsonc`는 testbed만 켠다, `:15`).
7. 서비스 binding 호출(main → 패치)이 Workers 하루 10만에 따로 세어지는지.
8. D1 DB 만들기(apac, 읽기 복제)와 `database_id` 커밋 승인.
9. 이 worktree에서 testbed 돌리기: `.env.local` 연결이나 `ALLOW_BUILD_WITHOUT_SUPABASE`.
10. `next build`의 타입 검사가 `workers/`를 덮는지.
11. 공개 읽기의 개인 필드: anon 키로 읽고 JWT sub로 거를지, 사용자 JWT를 넘길지. 읽기 정책이 `USING (true)`라 결과는 같다.
12. env를 Worker 값으로 고정할지. 교차 env 쓰기는 막지만 운영 Worker를 가리키는 testbed 빌드의 동작이 바뀐다.

호출 수와 응답 모양

13. 백과사전 묶음을 subrequest 3라운드(7~8개)로 할지, 화면 RPC(`get_codex_thread`)를 더할지. RPC는 운영 마이그레이션 승인이 필요하다.
14. `/api/read/nav`를 9개 subrequest로 할지, 합계 RPC(`get_nav_latest`)를 더할지.
15. Realtime: `api` 모드에서 채널을 열지 않을지(plan 변경). `defragment_posts`를 publication에서 뺄지(운영 DB 변경, 승인).
16. 그룹별 쓰기 전용 플래그(`<그룹>.write`)를 둘지.
17. 장난감 상자 피드의 `post`를 그대로 둘지, 서비스별로 줄일지.
18. 댓글 스레드 상한과 페이지(예: 200개나 바이트 예산). `meta`·`parent_id`를 줄지.
19. 참여 수를 접두사로 거르고 메모리 캐시할지.
20. 니오우스레터를 claim별 즉시 로드(묶음 1건)로 둘지, 수만 주고 본문은 나중에 받을지.
21. 변형 릴 실시간 읽기를 1단계에 지울지(legacy 경로 변경), 6단계까지 플래그 뒤에 둘지.
22. `/patches/changes`의 이야기 1000행을 줄별 수 엔드포인트로 바꿀지.
23. `/byrdispatch` 작성기에 쓰기 전용 모드를 줄지.
24. 읽기 전용 반응 막대가 내 반응을 계속 읽을지.
25. 반응 쓰기를 서버 판단(delete 또는 upsert)으로 바꿀지. localStorage가 낡았을 때 동작이 바뀐다.
26. 미래 주 철학자 예약을 서버에서 거를지.
27. 서류 폭풍 목록, 임시 저장, 기본 대회 응답 크기를 0단계 dump로 오프라인 측정.
28. 이거 vs 저거 50개 상한 버그를 언제 고칠지. 글은 지금 두 env 합 23개(0단계 dump)라 아직 상한에 닿지 않는다.
29. 조각모음 고유 글에 수정·삭제 엔드포인트가 필요한지.
30. 닉네임 동기화를 화면 GET에서 빼서 프로필 저장으로 옮길지(역사 강의서, 조각모음).

역사 강의서·퍼즐상자·프로필

31. 런마다 `game_elements` 크기를 0단계 dump로 오프라인 측정. 목록에 넣을지, 처음 거를 때 받을지, 서버에서 거를지.
32. 687행 backfill(characters, badges, cover_spec, game_elements)을 누가 어떻게 돌릴지. 운영 DB 쓰기라 승인이 필요하다. 그 전에 `history-runs`를 켤 수 있는지.
33. 공개 런 목록에서 `donor_user_id`를 1단계에 뺄지(`random-pick-card.tsx:33-35`, `history-course-run-index.tsx:483-485`가 쓴다).
34. 콤보 고르기가 created_at 순 목록을 써도 되는지, start_time 순을 지키려면 색인을 더할지.
35. 업로드 묶음을 1 MB 단위로 나눌지, 표지 후속까지 한 RPC(`donate_runs`)로 할지.
36. 옛 콤보 블록의 런 표지를 Worker가 계산할지, `combo_posts`의 snapshot.coverSpec을 한 번 backfill할지.
37. 역사 강의서 참여 수를 runs 카운터로 바꿔도 되는지(카운터가 생기기 전 행과 일치하는지 확인).
38. 4단계 퍼즐 RPC: `p_actor`를 받는 service 전용 판을 둘지, 5단계까지 사용자 토큰을 넘길지. 판별 최고 점수 지도를 Worker가 가질지.
39. 프로필 문의 목록을 두 env 그대로 둘지, Worker env로 고정할지.
40. 닉네임 풀을 빌드 JSON이나 HTML 주입으로 옮길지.
41. 8.3절 버그를 지금 tasks/010에 적을지, 1단계에서 그 파일을 고칠 때 함께 고칠지.
