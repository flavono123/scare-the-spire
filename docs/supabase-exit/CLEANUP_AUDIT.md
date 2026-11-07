# 이관 전 정리 조사(2026-11-07)

1단계를 운영에 내기 전에 DB 구조의 성능·확장성 문제와 DB·코드에서 필요 없는 것을 조사했다.

## 근거

- **운영 Supabase 통계(읽기 전용 조회):** `pg_stat_statements`, `pg_stat_user_tables`, `pg_stat_user_indexes`, `pg_policies`, 카탈로그를 읽었다. Postgres는 2026-06-02에 시작한 뒤 재시작하지 않았으므로 통계 창은 약 5개월이다.
- **코드:** `refactor/supabase-exit`의 `9aa66d71`을 grep했다. legacy 경로, 1단계 Worker, 스크립트, spec이 대상이다.
- 아래의 "죽음"은 운영·testbed·로컬 어디에서도 부르는 곳이 없다는 뜻이다. 세 환경이 Supabase 하나를 env 열로 나눠 쓰므로, "RPC·열이 없을 때"를 대비한 대체 경로는 어느 환경에서도 돌지 않는다.

## 1. 성능: DB 시간을 쓰는 것

데이터는 작다. public 본체는 2.3 MB이고 TOAST가 6.6 MB인데, 그 대부분은 `runs.raw`다. 가장 큰 표도 687행이다. 그래서 색인·RLS 조정으로 얻을 것이 거의 없다. DB 시간은 아래에 쓰인다.

| 무엇 | 호출 | 누적 시간 | 비고 |
|---|---|---|---|
| PostgREST 스키마 캐시 다시 읽기(`pg_timezone_names`, 타입·관계 조회) | 약 6,770회(하루 약 43회) | 약 98분 | 한 번에 평균 0.7초, 최대 7.6초. Postgres 재시작이 아니라 PostgREST 쪽 일이라 우리 스키마로는 줄일 수 없다 |
| 요청마다의 `set_config` | 72.7만 회 | 약 32분 | PostgREST 요청당 비용. 요청 수를 줄여야 준다 |
| 네비 새 글 표시(테이블 9개의 최신 1행) + 배달원 최근 댓글 | 표마다 약 2.9만~3.4만 회 | 약 48분 | 1단계 `nav` api 경로가 Worker 캐시 한 번으로 바꾼다 |
| 역사 강의서 목록의 `raw` 포함 읽기 | 2,013회 | 약 9분 | 평균 267 ms. 100개 목록이 약 8 MB다(raw 중앙값 57 KB, 최대 277 KB) |
| `get_engagement_counts`(env 전체 집계) | 1.9만 회 | 약 5분 | 스레드 수(운영 272개)에 비례해 커진다 |
| `get_toybox_feed`, `get_defragment_feed_v2` | 6,800회, 1,460회 | 약 6분, 3분 | 동적 SQL과 여러 표의 union |
| 패치 페이지 변형 릴 | 7,096회 | 약 2분 | 화면에 보이는 효과가 없다(3.3절) |

**결론:**
- 지금 Supabase 성능을 가장 크게 바꾸는 일은 1단계를 운영에 내고 `nav`를 켜는 것이다.
- 다음은 쓸데없는 호출을 끊는 것이다(3.3절).
- 색인은 114개, 2.6 MB로 테이블 본체보다 크다. 그중 21개는 한 번도 쓰이지 않았다. 다만 표가 작아 지워도 체감할 이득은 없다.
- RLS 정책 44개가 `auth.uid()`를 감싸지 않고 행마다 부르지만, 이것도 이 크기에서는 무시할 만하다.
- 둘 다 Supabase에서 고치지 말고 D1 설계에서 처음부터 바르게 한다.

## 2. 구조(확장성): D1 스키마에서 정할 것

Supabase 스키마는 7단계까지 늘리기만 한다(plan 7.2절). 구조 개선은 2단계의 D1 DDL에서 처음부터 반영한다. 아래는 결정이 필요한 선택지다.

1. **env 열**
   - 지금: 모든 표와 모든 색인의 앞자리에 env가 있다.
   - 제안: D1은 env마다 DB가 따로이므로(prod·testbed), 표에서 env를 뺀다. 5단계 outbox가 Supabase로 미러할 때 Worker가 자기 env(`API_DATA_ENV`)를 붙인다.
2. **장난감 상자 글 표 8개**
   - 지금: 8개 표가 열 11개를 똑같이 가진다(id, user_id, 작성자 스냅샷 5개, 좋아요·댓글 수, created_at, env). 서비스 하나를 더하려면 표, 색인 약 6개, 정책 3~4개, guard 트리거, 카운터 트리거 분기, 피드 RPC 두 개, 네비, 스레드 키, `admin_story_service`를 모두 고쳐야 한다.
   - 제안: 공통 `posts` 표(service, id, 작성자, 수, 제목·요약, created_at)에 서비스별 본문을 JSON 한 열로 둔다. 피드·네비·조각모음·카운터가 쿼리 하나로 끝나고, 서비스를 더할 때 DDL이 필요 없다.
   - 대가: 열 단위 CHECK가 Worker 검사로 옮겨간다(4단계에서 어차피 옮긴다). 변형의 고유 열 26개는 JSON이 된다.
3. **참여 카운터**
   - 지금: 문자열 스레드 키의 접두어를 트리거가 해석해 표 9개의 카운터 열을 올리고, 백과사전 같은 나머지는 `get_engagement_counts`가 매번 전체를 센다. 같은 일을 두 곳에서 한다.
   - 제안: `threads` 표(thread_key, like_count, comment_count, 마지막 댓글 시각) 하나로 모은다. 새 서비스에 트리거를 고칠 필요가 없고, 전체 집계도 없어진다.
4. **런 원문**
   - 지금: `runs.raw`를 목록이 통째로 받는다. CHECK는 8 MiB까지 허용하는데 D1 행은 약 2 MB가 한도다.
   - 제안: `raw`를 별도 표로 나누고, 목록은 업로드 때 만든 요약 열만 읽는다. 상한은 지금 최대값(277 KB)에 여유를 둔 값으로 낮춘다.
5. **작성자 스냅샷**
   - 지금: 닉네임·아바타·팔레트 5개 열이 표 12개에 반복된다. 글을 쓴 시점의 모습을 고정하는 동작이다.
   - 제안: 동작은 유지하되 D1에서는 열 하나(JSON)로 줄인다. 프로필을 바꾸면 옛 글도 바뀌게 할지는 별도 결정이다.
6. **색인**
   - 제안: 114개를 옮기지 않는다. 1단계 Worker가 실제로 보내는 쿼리에서 다시 도출한다.
   - D1은 읽은 행 수로 무료 한도를 세므로 색인이 Supabase보다 중요하다.

## 3. 필요 없는 것

표시 규칙: [L-dead]는 legacy 경로 안의 죽은 코드라 지워도 1단계의 되돌리기에 영향이 없다는 뜻이다. [L-live]는 살아 있는 legacy 코드라 두 경로를 함께 바꿔야 한다는 뜻이다.

### 3.1 DB 객체: D1로 옮기지 않고 Supabase에서는 7단계 뒤에 지운다

**테이블**
- `nav_indicators`, `debate_cycles`: 테이블 이름 상수와 그 spec만 남았다.
- `colorful_philosopher_reactions`: 부르는 곳 없는 hook만 쓴다. 행은 `resource_reactions`로 이미 복사됐다(`20260924150000_resource_reactions.sql:108-112`). 트리거, 함수 `apply_colorful_philosopher_reaction_counts`, 정책 4개가 같이 간다.
- `defragment_posts`: 행이 한 번도 없었다(ins 0). 유일한 insert는 부르는 곳이 없다. 정책 4개, 색인 4개, Realtime 등록, 카운터 트리거의 defragment 분기가 같이 간다.
- `favorite_tournament_plays`: RPC만 쓰고 dev 관리 지표만 읽는다. 지우려면 RPC를 고쳐야 하므로 D1에서 둘지 정한다.

**함수:** `get_story_reaction_counts`, `get_this_or_that_vote_totals`(부르는 곳 없음), `get_defragment_feed`(v1, 닿지 않는 대체 경로에서만 부름).

**아무도 읽지 않는 열**
- `comments.parent_id`, `comments.meta`
- `likes.reaction_type`: 늘 기본값이다. `idx_likes_env_story_reaction`의 일은 `idx_likes_env_story`가 넘겨받는다.
- `this_or_that_posts.vote_rate_bps`: 색인 둘(scan 0)이 같이 간다.
- `colorful_philosopher_posts.buff_count`, `nerf_count`, `rework_count`: 값이 굳었고, 화면은 `resource_reaction_counts`를 읽는다. select 7곳에서 먼저 빼야 한다.

**쓰기만 하고 읽지 않는 열** — 쓰는 코드를 먼저 끊어야 한다. 쓰는 코드가 legacy와 api 양쪽에 같은 행을 보내므로 [L-live]다.
- `runs.badges`, `highlight_card`, `highlight_relic`, `note_blocks`(`run-donation.ts:80-97`)
- `this_or_that_post_votes.created_surface`
- `contact_inquiries.viewport_width`, `viewport_height`
- `transfigure_posts.source_game_locale`
- `favorite_tournament_posts.game_version`
- `submit_puzzlebox_run`만 쓰는 퍼즐상자 열 일부: 가치가 낮다.

**색인:** recommend 식 7개(그 식으로 정렬하는 곳이 없다), PK와 같은 `idx_defragment_bodies_source`, scan 0인 GIN `idx_community_stories_env_sentence`·`idx_community_stories_env_patch_line`·`idx_likes_story_env`, 1회씩인 `idx_runs_build`·`idx_runs_character`, 앞부분이 겹치는 `idx_runs_env`.

**정책:** `favorite_tournament_plays_read`(아래 3.4절), 읽는 클라이언트가 없는 `puzzlebox_runs_read_own`, 죽은 표에 열린 `defragment_posts_insert`.

### 3.2 코드: 지금 지울 수 있다(동작 변화 없음)

**통째로 죽은 파일**
- `src/lib/nav-indicators.ts`와 그 spec
- `src/lib/debate-cycle.ts`와 그 spec
- `src/hooks/use-this-or-that-comment-counts.ts`
- `contactReplyIsUnseen`과 그 spec

**죽은 함수** — 모두 [L-dead]다.
- 철학자 반응 hook(`use-colorful-philosopher-posts.ts:220-299`)
- `insertDefragmentPost`, `useDefragmentPostMutations`
- 목록 hook의 수정·삭제: 변형·코오오옴보의 update/remove는 `editingPost`가 늘 null이라 닿지 않는다. 그 밖에 아무도 꺼내 쓰지 않는 remove 다섯이 있다.
- 쓰지 않는 상수·헬퍼: `FAVORITE_TOURNAMENT_PLAYS_TABLE`, `buildComboFeedKeysetFilter` 등

**닿을 수 없는 대체 경로** — 살아 있는 legacy 함수 안의 죽은 분기다. 1차 호출은 남기고 분기만 지우므로 [L-dead]다.
- 피드 RPC가 없을 때 테이블을 직접 읽는 경로(`toybox-feed.ts`)
- 조각모음 피드의 v2→v1 대체와 열 없음 처리(`defragment-feed.ts`)
- 런 열이 없을 때 다시 시도하는 경로(`run-donation.ts`, `RUN_*_COLUMNS_LEGACY`)
- 문의 열이 없을 때 다시 시도하는 경로(`contact-inquiries.ts`, `CONTACT_INQUIRY_HISTORY_COLUMNS_LEGACY`)
- 덧글 본문·철학자·닉네임 후보의 "테이블 없음" 분기
- 1단계 Worker에 같은 이유로 들어간 재시도(`history-runs.ts`, `profile.ts`, `contact.ts`)
- 1단계 Worker의 쓰지 않는 헬퍼 셋(`isGroupOn`, `apiErrorStatus`, `isPhilosopherResource`)

**운영에서 돌지 않는 Supabase 코드**
- 패치 섹션의 React 효과: 패치 페이지는 하이드레이션하지 않는다.
- `toybox-post-og-fields.ts`: `next dev`에서만 돈다.
- 꺼져 있는 `detail-shell-og.ts`의 Supabase 부분
- 조각모음 고유 글 상세 화면과 Worker의 `service=defragment`(3.1절의 `defragment_posts`)

1단계 라우트는 경로×메서드를 모두 확인했다. 클라이언트가 부르지 않는 라우트는 없다.

### 3.3 쓸데없는 호출

동작 변화 없음:
1. **패치 페이지 변형 릴**(`patch-comments-client.js:1838-1861`): 모든 패치 페이지에서 돈다. 붙인 카드는 끝내 보이지 않는다(회전 스크립트가 처음 로드 때 카드를 한 번만 잡는다). testbed에 남은 유일한 Supabase 요청이다.
2. **legacy Realtime 채널 둘**(`use-toybox-feed.ts`, `use-community-stories.ts`): publication에 그 표가 없어 이벤트가 오지 않는다. join이 실패하면 피드를 "응답 없음"으로 덮는다. 다만 2026-11-06에 "legacy는 그대로 둔다"고 정했으므로 지우려면 결정이 필요하다.

동작이 조금 바뀌므로 결정이 필요한 것:
3. `/byrdispatch` 작성 버튼이 이야기 100행을 읽는다.
4. 조각모음과 역사 강의서가 마운트마다 닉네임 동기화 쓰기를 한다. api 경로에서는 분당 30 쓰기 예산을 쓴다.
5. 이아저? 월드컵 목록이 기본 대회 전부를 늘 받는다.
6. 이거 아님 저거?가 피드 행에 이미 있는 좋아요·투표 수를 다시 읽는다. 50개 상한 버그도 이 경로다.
7. 서류 폭풍 고르기가 같은 글을 두 번 읽는다.

### 3.4 운영 문제

- 이아저? 월드컵 플레이 기록 전체(`user_id`, 대진)가 anon에게 열려 있다(`favorite_tournament_plays_read`, `USING (true)`). 앱은 이 표를 읽지 않는다. `tasks/010` 67번에 적었다.

### 3.5 이전 조사(SURFACE_MAP)의 정정

- `puzzlebox_runs`는 살아 있다. `submit_puzzlebox_run`이 3초 중복 제출과 하루 500회 제한을 이 표로 검사한다.
- 7.7절의 "테이블 31개 모두 `supabase/migrations`에서 만들어진다"는 틀렸다. `likes`, `comments`, `comment_likes`, `runs`, `chemical_posts`, `community_stories`와 `get_engagement_counts`의 DDL은 `supabase/setup.sql`과 `migration-0xx`에만 있다. 2단계 이식에 필요하므로, dump 기반 baseline을 만들기 전에는 이 파일을 지우지 않는다.

## 4. 제안 순서

1. **게이트 전, 이 브랜치에서:** 동작이 바뀌지 않는 정리만 한다. 3.2절 전부, 3.3절 1번, 원하면 2번까지. 그 뒤 로컬·testbed QA를 한 번 돌리고 게이트(운영 D1 마이그레이션, 스위치를 끈 채 병합)로 간다.
2. **Supabase 스키마는 지금 지우지 않는다.** 3.1절은 D1로 옮기지 않는 것으로 처리하고, Supabase에서는 7단계 뒤에 지운다. 예외는 3.4절의 정책이고, 고칠 시점을 정해야 한다.
3. **2단계 시작 전:** 2절의 선택지(env, 공통 posts, threads, 런 원문, 작성자, 색인)를 D1 스키마 설계 문서로 정한다.
4. **결정 뒤 따로 낸다:** 3.3절 3~7번.
