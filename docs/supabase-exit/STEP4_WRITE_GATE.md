# 4단계 설계: Worker 쓰기 검증(뒤는 여전히 Supabase)

관련 문서: [Supabase 탈출 계획](../SUPABASE_EXIT_PLAN.md) 5.2·7.3(4단계)·7.4절, [1단계 설계](STEP1_DESIGN.md),
[D1 스키마 설계](D1_SCHEMA_DESIGN.md) 5.5절, [Supabase 사용 지도](SURFACE_MAP.md) 4절.

## 상태

2026-11-08: 구현과 로컬 검증을 마쳤다. 모두 꺼져 있다. 운영은 `API_RUNTIME_FLAGS=off`라 라우터에 닿지 않고,
testbed도 `write.<group>` 행이 없으면 지금(rls)과 같다. Supabase 마이그레이션과 직접 쓰기 닫기 스크립트는
적용하지 않았다. 서명 쿠키 신원(plan 5.3)은 다른 작업이 만들고, 여기서는 꽂을 자리만 둔다(4.2절).

2026-11-09(`step4/prereqs`): 운영에서 켜기 전에 필요한 것 넷을 만들었다. 경로 플래그 env 기본값(7절), D1 키 목록과
폐기(STEP1_DESIGN 6), Supabase 원본의 런 하나씩 공유(9절 5번), 쿠키만 있는 신원의 개인 읽기(10.1). testbed 결과는
11절.

## 1. 바꾸는 것

계획 7.3절 4단계의 "Worker가 길이, 허용 값, 소유권을 직접 검사하고 service 키로 Supabase에 쓴다"와 "모든 화면이
`api` 경로로 옮겨진 뒤 브라우저(anon, authenticated)의 직접 쓰기 정책을 닫는다"를 맡는다.

- 쓰기 그룹마다 `write.<group>` 런타임 플래그를 둔다. `rls`는 지금이다. Worker가 사용자의 Supabase 토큰을 넘기고
  RLS, 보호 트리거, 권한이 판단한다. `worker`는 Worker가 그 판단을 직접 하고 service 키로 쓴다.
- 1단계 쓰기 핸들러는 바꾸지 않는다. 핸들러가 만드는 PostgREST 호출 가운데 사용자 신원을 실은 호출만 게이트가
  가로챈다(4절). 그래서 응답 모양과 오류 대응이 1단계와 그대로 같다.
- 판단 기준은 오늘 Supabase가 같은 사용자의 토큰으로 받는 것과 받지 않는 것 전부다. 기준 fixture는 지금의 RLS
  정책, 트리거, 권한이고, 같은 요청을 양쪽에 보내 결과를 대조한다(6절).

## 2. 쓰기 전수 목록

"API"는 1단계 경로(`workers/api/routes`), "브라우저"는 `legacy` 경로의 supabase-js·REST 직접 쓰기다. 관리 화면의
service 키 쓰기(문의 답변, 닉네임 풀, 철학자 글)는 브라우저 경로가 아니라 범위 밖이다(5단계에서 D1로).

| 표·RPC | 작업 | API | 브라우저 | 오늘 Supabase가 보는 것 |
|---|---|---|---|---|
| comments | insert, delete | `write.comments.create`, `.delete` | `use-comments.ts:187,233`, `patch-comments-client.js:1075,1172` | I·D 정책 uid, U 정책 없음. `guard_insert_server_columns`(created_at) |
| comment_likes | insert, delete | `write.comment-likes.put`, `.delete` | `use-comment-likes.ts:160,157`, `patch-comments-client.js:1160,1155` | I·D 정책 uid |
| likes | insert, delete | `write.likes.put`, `.delete` | `use-likes.ts:230,210` | I·D 정책 uid |
| resource_reactions | update(kind), insert, delete | `write.reactions` | `use-resource-reactions.ts:96-99,287-290`, `patch-comments-client.js:1906-1910` | I·D 정책 uid, U 정책 TO authenticated uid, `GRANT UPDATE(kind)`만 |
| community_stories | insert, delete | `write.stories.create`, `.delete` | `use-community-stories.ts:272,328`, `patch-comments-client.js:703` | I·D 정책 uid. `guard_insert_server_columns`(created_at, static_story_id = null) |
| combo·transfigure·decisions·pagestorm·defragment 글 | insert, update, delete | `write.toybox-post.create`, `.update`, `.delete` | `use-combo-posts.ts:108,154,305`, `use-transfigure-posts.ts:432,389,582`, `use-decisions-decisions-posts.ts:92,136,245`, `use-pagestorm-posts.ts:92,142,499`, `use-defragment-posts.ts:109,147` | I·U·D 정책 uid. `guard_post_server_columns` |
| chemical·this_or_that 글 | insert, delete | 위와 같음 | `use-chemical-posts.ts:77`, `chemicalx/post-view.tsx:106`, `use-this-or-that-posts.ts:101,230` | I·D 정책 uid, U 정책 없음. guard(이거 vs 저거는 투표 수도) |
| favorite_tournament_posts | insert, delete | 위와 같음 | `use-favorite-tournament-posts.ts:98,267` | I 정책 uid와 `preset_key NOT LIKE 'builtin:%'`, D uid. guard(play_count도) |
| pagestorm_drafts | insert, update, delete | `write.pagestorm.drafts.*` | `use-pagestorm-posts.ts:195,222,249` | 네 정책 모두 uid. 트리거 없음 |
| defragment_bodies | upsert | `write.defragment-body` | `use-defragment-bodies.ts:142` | I·U 정책 TO authenticated uid와 `defragment_source_owned`, D uid. 트리거 없음 |
| this_or_that_post_likes | insert, delete | `write.this-or-that.like.*` | `use-this-or-that-likes.ts:152,146` | I·D 정책 uid |
| this_or_that_post_votes | insert, delete | `write.this-or-that.vote.*` | `use-this-or-that-votes.ts:196,253` | I 정책 uid와 같은 env의 글, D uid, U 정책 없음, 읽기는 자기 것 |
| runs | insert, upsert(중복 무시), update(cover_spec, donor_nickname), delete | `write.history-runs.*` | `run-donation.ts:192,303,369,572,626` | 정책 `donor_user_id` = uid. `guard_post_server_columns` |
| contact_inquiries | insert, update(reply_seen_at) | `write.contact-inquiries`, `write.profile.inquiries-seen` | `contact-inquiries.ts:100,217` | TO authenticated I(uid, status 'new')·U·R 정책, 열 단위 권한, DELETE 권한 없음. `contact_inquiries_rate_limit`(uid 확인, trim·소문자, 시간당 3건) |
| rpc complete_favorite_tournament_play | 호출 | `write.favorite-tournament.play` | `use-favorite-tournament-posts.ts:310` | SECURITY DEFINER, `auth.uid()` 필요, anon·authenticated 실행 |
| rpc submit_puzzlebox_run | 호출 | `write.puzzlebox.runs` | `use-puzzlebox-scores.ts:152` | SECURITY DEFINER, `auth.uid()` 필요, authenticated 실행 |
| colorful_philosopher_reactions | 없음 | 없음 | 죽은 코드(SURFACE_MAP 4.1) | TO authenticated I·U·D. 7절에서 닫기만 한다 |

`write.<group>` 그룹: comments(댓글·좋아요·반응), stories, toybox-feed(글·임시 저장·덧글 본문·이거 vs 저거·월드컵),
history-runs, puzzlebox, contact, profile(문의 읽음). nav와 colorful-philosophers는 쓰기 경로가 없다.

## 3. 규칙

`workers/api/write-gate/rules.ts`(표별 데이터)와 `decide.ts`(판단)에 있다. service 역할이 건너뛰는 것만 옮긴다.

- **옮기는 것**: RLS 정책(소유 열 = uid, 추가 조건 셋), 역할 조건이 붙은 BEFORE 트리거(`WHEN (CURRENT_USER = ANY
  ('anon','authenticated'))`), 권한(열 단위 GRANT, DELETE 권한 없음), 문의 트리거(5절에서 역할 조건을 단다),
  `auth.uid()`를 읽는 RPC 둘.
- **Supabase에 남는 것**: 열 CHECK, NOT NULL, 유일·외래 키, 카운터 트리거(SECURITY DEFINER, 역할 조건 없음), RPC
  본문. service 역할 쓰기에도 그대로 돌기 때문에 Worker가 베끼지 않는다. 베끼면 Worker가 더 엄격하거나 느슨해질
  수 있다. 계획 5.2절의 "길이, 허용 값" 검사는 1단계 핸들러의 입력 검사(`parseCommentInput`, `storyInsertRow`,
  `contactInquiryRow` 등)와 Supabase의 CHECK가 지금처럼 맡고, D1이 원본이 되는 5단계에는 D1 CHECK(0003~0006)가 맡는다.
- **판단 순서**는 Postgres와 같다: 권한 → BEFORE 트리거(문의) → 정책의 WITH CHECK → (Supabase의) CHECK.
- **insert**: 소유 열이 uid가 아니면(빠짐, NULL, 다른 uuid) 42501. uuid로 읽을 수 없는 값은 Postgres가 정책보다 먼저
  22P02로 거절하므로 그대로 보낸다. uuid로 읽는 규칙은 Postgres uuid 입력과 같다(대소문자, 한 쌍의 중괄호, 네 자리마다 하이픈 하나까지). 추가 조건:
  `not_builtin_preset`(대소문자 구분, 문자열이 아닌 값은 그 JSON 텍스트로), `vote_post_same_env`(service로 글을 읽음), `defragment_source_owned`(service로
  원글을 읽음). 보호 트리거가 정하는 열(카운터, created_at, static_story_id)은 본문에서 뺀다. 열 기본값이 트리거가
  넣는 값과 같다(0, now(), NULL).
- **upsert**: `merge-duplicates`면 기존 행이 update 정책의 USING을 통과해야 한다(아니면 42501). `ignore-duplicates`도
  건너뛸 행까지 insert 정책을 먼저 본다. PGlite에서 확인했다: 남의 런이 섞인 묶음 공유는 지금도 전체가 403이다.
- **update**: 소유 필터(`owner=eq.uid`)를 덧붙인다. 정책이 없는 표는 행이 없는 결과다. 본문이 소유자를 남으로
  바꾸면, 보이는 행이 있을 때만 42501이고 없으면 빈 결과다(service로 확인). 보호 트리거가 되돌리는 열(id, env,
  카운터, created_at)은 뺀다. 그런 열만 있던 본문은 `{owner: uid}`로 바꿔 지금처럼 행이 "고쳐져" 돌아오게 한다.
- **delete**: 소유 필터를 덧붙인다. 정책이 없으면 빈 결과, DELETE 권한이 없으면(문의) 42501.
- **열 단위 권한**: 반응 update는 `kind`만, 문의 insert는 10개 열만, 문의 update는 `reply_seen_at`만. 문의는 필터와
  돌려받는 열에도 SELECT 권한이 있어야 한다(`user_id`, `reply_email`, 화면 크기 열은 없다).
- **문의**: 다른 사용자면 42501, `message`는 btrim(공백만), `reply_email`은 btrim·소문자·빈 값은 NULL, 그리고 service로
  같은 사용자·env의 최근 1시간 행을 세어 3건 이상이면 P0001(지금처럼 429 `rate_limited`).
- **RPC**: `complete_favorite_tournament_play`, `submit_puzzlebox_run`은 service 전용 래퍼
  `worker_complete_favorite_tournament_play`, `worker_submit_puzzlebox_run`으로 보내고 `p_actor = uid`를 붙인다(5절).
  본문에 이미 `p_actor`가 있으면 지금 PostgREST처럼 PGRST202(404)다.
- **모르는 요청**(표·RPC·메서드, 논리 필터 `or`, `columns`, 해결 방식 없는 `on_conflict`, 사용자 신원으로 읽기)은
  보내지 않고 500 `gate_unsupported`(API는 503 `unavailable`)로 답하고 로그를 남긴다.

## 4. 동작

### 4.1 경로

1. 라우터(`workers/api/router.ts`)는 지금처럼 신원(오늘은 사용자 토큰의 ES256 검증), 속도 제한, 본문 읽기를 한다.
2. 그다음 `access: "write"` 경로에서 `workerWriteContext`가 본다. Worker에 `API_SUPABASE_SECRET_KEY`(`sb_secret_…`)가
   없으면 플래그도 읽지 않고 `null`이다(지금 운영처럼 키가 없으면 D1 읽기가 하나도 늘지 않는다). 키가 있고 그 그룹의
   쓰기 방식이 `worker`이면 worker 방식, 아니면 `null`이라 핸들러는 지금 코드 그대로다.
3. worker 방식이면 핸들러에 넘기는 `config`에 게이트를 달고(`withWriteGate`), `token`을 자리표시 `worker-actor`로
   바꾼다. `postgrest`·`postgrestStream`은 `token`이 있는 호출만 게이트로 보낸다(`supabase-rest.ts`에 두 줄). 공개
   읽기(좋아요 수, 반응 합계)는 지금처럼 publishable 키로 간다.
4. 게이트는 흘려보내던 업로드 본문(글, 임시 저장, 덧글 본문, 런)을 읽어 파싱하고(24 MiB 상한), `decideWrite`로 판단한
   뒤 service 키로 보낸다. 사용자 토큰은 보내지 않는다. 조회(소유 확인, 원글 확인, 문의 수)도 service 키다.
5. `me` 경로(개인 읽기)는 요청에 그 uid의 사용자 토큰이 있으면 지금처럼 토큰이다. 서명 쿠키만 있는 신원(쿠키 방식의
   브라우저는 토큰을 보내지 않는다)은 읽기 게이트(`write-gate/me-read.ts`)를 거쳐 service 키로 읽는다(10.1).

### 4.2 신원

게이트는 신원을 따로 풀지 않는다. 라우터가 푼 신원의 uid를 `writeActor(user)`(`write-gate/gate.ts`) 한 곳에서
받아 소유 열과 `p_actor`로 쓴다. 오늘은 rls 경로와 같은 토큰 검증의 `sub`다. 서명 쿠키 신원(plan 5.3, 다른 작업의
`resolveRequestIdentity`, `context.user`)을 합칠 때는 라우터의 `check.user` 자리만 그 신원으로 바꾸면 된다. 쿠키
신원에 토큰이 없어도 worker 방식의 핸들러는 자리표시 `worker-actor`를 받으므로 게이트가 가로챈다. 자리표시와 사용자
토큰은 밖으로 나가지 않는다(spec이 본다).

### 4.3 플래그

- 키: `write.comments`, `write.toybox-feed`, `write.stories`, `write.history-runs`, `write.puzzlebox`, `write.profile`,
  `write.contact`. 값: `rls` | `worker`. `scripts/runtime-flags.ts set write.<group> …`로만 바꾼다.
- `path.<group> = api`인 쓰기 요청에서, Worker에 secret 키가 있을 때만 읽는다. D1 `runtime_flags`를 `key GLOB 'write.*'`로 읽고 isolate에 30초 둔다.
- 행이 없거나, 모르는 값이거나, 읽기가 실패하거나 1초를 넘으면 Worker env `API_WRITE_MODE_DEFAULT`를 쓴다. 이 값은
  `worker`일 때만 worker이고 그 밖에는 rls다. 7절의 직접 쓰기를 닫은 뒤에는 안전한 쪽이 worker가 되므로 그때 이 값을
  `worker`로 배포한다(plan 7.2절: 플래그를 못 읽으면 그 단계의 안전한 쪽인 env 기본값).

## 5. Supabase 마이그레이션(적용 안 함)

`supabase/migrations/20261108160000_worker_write_actor.sql`, `db-first-additive`, `before-push`. 되돌리기는
`docs/release/worker-write-actor/rollback_worker_write_actor.sql`(모든 `write.<group>`이 rls로 돌아간 뒤에만).

1. `contact_inquiries_rate_limit`에 보호 트리거와 같은 `WHEN`을 단다. D1 설계 5.5절이 "4단계 Worker 쓰기 전"으로 정한
   것과 같은 문장이다. anon·authenticated에는 그대로 돈다.
2. `worker_complete_favorite_tournament_play(p_actor, …)`, `worker_submit_puzzlebox_run(p_actor, …)`: 그 트랜잭션에만
   `request.jwt.claim.sub`를 actor로 두고 원래 RPC를 그대로 부른다. SECURITY INVOKER, `search_path` 빈 값, 실행 권한은
   service_role만(Supabase 기본 권한이 주는 anon·authenticated 실행을 거둔다). 그래서 대진·크기·후보 검사, 3초·하루
   500판 제한, 통계와 순위가 지금과 같다. D1 설계 5.5절의 `mirror_favorite_tournament_play`(5단계)와는 별개다.

3. (2026-11-09 추가, 적용 안 함) `supabase/migrations/20261109150000_worker_read_actor.sql`, `db-first-additive`,
   `before-push`(어느 env든 `identity.mode = cookie`를 켜기 전). 되돌리기는
   `docs/release/worker-read-actor/rollback_worker_read_actor.sql`(`identity.mode`가 token으로 돌아간 뒤에만). 개인 읽기
   RPC 넷(`get_my_profile_activity_stats`, `get_my_profile_activity`, `get_puzzlebox_leaderboard`,
   `get_my_puzzlebox_standings`)의 `worker_*` 래퍼다. 2번과 같은 모양(트랜잭션 동안만 sub, service_role만 실행, 원래 RPC를
   그대로). 프로필 RPC는 SECURITY INVOKER라 service 역할로 RLS를 지나 읽지만, 읽는 행이 모두 그 사용자의 것(auth.uid()로
   거름)이거나 모두가 읽는 표라 답이 같다(동등성 spec).

Supabase 프로젝트는 testbed와 운영이 하나를 같이 쓴다. 이 마이그레이션을 올리면 둘 다에 적용되지만 브라우저
역할에는 바뀌는 것이 없다. `d1-change-log.spec.ts`를 `SUPABASE_PUBLIC_SCHEMA`(2026-11-05 백업)로 돌리면 이 파일 때문에
`contact_inquiries` 트리거 정의 하나가 덤프와 다르다고 나온다. 적용한 뒤의 새 덤프와는 같아진다.

## 6. 검증

`pnpm test:write-gate`가 셋을 돌린다.

- `scripts/write-gate-equivalence.spec.ts`: PGlite DB 둘을 저장소 SQL로 만든다. "오늘"(이 마이그레이션을 뺀 전부, 2단계
  변경 로그는 포함)과 "4단계"(이 마이그레이션을 더함)다. 덤프로 돌릴 때는 덤프 위에 변경 로그를 올린다. 변경 로그
  `d1_change_log`도 비교하므로(로그 id, 시각, `row_bytes`만 뺀다) worker 방식의 쓰기가 D1 동기화에 같은 변경을 남긴다. 같은 Worker가 오늘 DB에는 rls 방식으로, 4단계 DB에는 worker 방식으로
  붙는다. `scripts/lib/supabase-pglite.ts`의 작은 PostgREST가 요청마다 한 트랜잭션에서 키가 가리키는 역할로 SQL을
  돌린다. 가짜 PostgREST는 Supabase의 `auth.uid()` 정의를 쓰고 PostgREST 12처럼 `request.jwt.claims`만 둔다. API
  사례 114개(29개 쓰기 경로 모두, 글 표 여덟 개마다 고치기·지우기를 자기 것과 남의 것으로, 정직한 요청과 남의 행, 위조한
  카운터·시각·소유자, CHECK 위반, 없는 열, 중복, 다른 env 글, 없는 글, 속도 제한 등)와
  PostgREST 수준 사례 31개(경로가 만들지 않는 위조 소유자, Postgres가 uuid로 읽지 못하는 소유자, 권한, 정책 없는 update,
  문자열이 아닌 월드컵 프리셋 키 등)가 양쪽에서 같은 HTTP 응답을
  내고 쓰는 26개 표와 변경 로그에 같은 행을 남겨야 통과한다. 위조 시각과 새 uuid만 `<now>`, `<uuid>`로 맞춘다. rls 쪽은 service
  키를, worker 쪽은 사용자 토큰을 한 번도 쓰지 않았는지도 본다. 셋째 DB(이 마이그레이션을 두 번 적용)에 rls 방식으로
  같은 사례를 보내 오늘과 같은 답과 행이 나오는지도 본다. 마이그레이션이 브라우저 역할과 옛 탭에 바꾸는 것이 없고 다시
  돌려도 된다는 확인이다. 끝에 오늘 DB에서 사례 이름대로 되었는지(자기 글 고치기의
  보호 열, 남의 글은 그대로, 자기 글 지우기) 확인한다.
  `SUPABASE_PUBLIC_SCHEMA=<덤프>`를 주면 같은 사례를 덤프의 실제 정책·트리거·함수·권한 위에서 돌린다. 2026-11-05
  백업 사본으로 돌려 통과했다(백업은 커밋하지 않는다).
- `scripts/write-gate.spec.ts`: 플래그 읽기·캐시·기본값·실패, 라우터 연결(rls는 토큰, worker는 secret 키와 소유 필터,
  키가 없으면 rls), 소유자는 라우터가 푼 신원의 uid, 사용자 토큰과 자리표시는 나가지 않음, 신원 없으면 401,
  `me` 경로는 토큰 그대로, 모르는 요청은 보내지 않음.
- `scripts/direct-writes-policies.spec.ts`: 7절의 두 스크립트(아래)와 5절 마이그레이션의 되돌리기. 오늘 DB에서 service
  역할의 문의는 42501이고(설계 5.5), 마이그레이션 뒤에는 들어가며 브라우저 역할의 사용자 확인은 그대로다. 되돌리기를 두 번
  돌리면 정책·함수·권한·트리거 정의가 오늘과 같아진다(저장소 SQL과 덤프 둘 다).
- 게이트를 일부러 망가뜨린 6가지(삭제 소유 필터, insert 보호 열, 문의 제한, upsert 기존 행, update 보호 열, 투표 env)
  모두 동등성 spec이 잡았다(로컬 확인, 커밋하지 않은 일회성 확인).

## 7. 브라우저 직접 쓰기 닫기(적용 안 함)

- 닫기: `docs/release/step4-direct-writes/close_direct_writes.sql`. anon·authenticated의 INSERT·UPDATE·DELETE 정책
  50개를 지우고(SELECT 정책은 둔다) 두 쓰기 RPC의 실행 권한을 거둔다. 모든 공개 표는 RLS가 켜져 있고 쓸 수 있는 뷰가
  없어서(spec이 확인) 정책이 유일한 길이다. 오래 열어 둔 탭의 insert는 42501, update·delete는 0행이 된다.
- 되살리기: `restore_direct_writes.sql`. 50개 정책을 저장소 마이그레이션의 정의 그대로 다시 만들고 실행 권한을 돌려준다.
  두 번 돌려도 같다. spec이 닫기 전과 되살린 뒤의 정책·함수 권한·표 권한이 같음을, 덤프를 주면 덤프 위에서도 같음을
  확인한다(2026-11-05 백업 사본으로 통과).
- 마이그레이션이 아니다. `supabase/migrations`에 두지 않는다. 다른 마이그레이션의 `db push`에 섞이면 아직 legacy인
  화면의 쓰기가 끊긴다.
- 닫는 조건(이 순서로): 5절 마이그레이션 적용, testbed와 운영 모두 모든 그룹이 `path.<group> = api`이고
  `write.<group> = worker`, 두 Worker 모두 `API_SUPABASE_SECRET_KEY`와 `API_WRITE_MODE_DEFAULT=worker` 배포.
  Supabase가 하나라서 한 번 닫으면 testbed와 운영이 같이 닫힌다.
- 닫기 전에 더 필요한 것: 경로 플래그를 못 읽으면 라우터와 페이지 쿠키는 `legacy`로 돌려보내고(flags.ts),
  클라이언트는 legacy 경로로 직접 쓴다. 닫은 뒤에는 그 쓰기가 실패해 D1 플래그 읽기 장애가 쓰기 장애가 된다. plan
  7.2절("플래그를 읽지 못하면 그 단계의 안전한 쪽인 Worker env 기본값")대로 경로 플래그에도 env 기본값을 둔다.
  - 2026-11-09 만들었다(`step4/prereqs`). Worker env `API_PATH_DEFAULT`(`legacy`|`api`, 없으면 `legacy` = 지금)를
    `path.<group>` 행이 없거나 값을 모를 때, 그리고 읽기가 실패하거나 1초를 넘을 때 쓴다(라우터와 페이지 쿠키 둘 다,
    `API_WRITE_MODE_DEFAULT`와 같은 규칙). `legacy` 행은 그대로 legacy이고, kill switch(`API_RUNTIME_FLAGS`, 설정 오류)와
    QA 쿠키가 먼저다. `api`이면 차가운 isolate의 페이지 응답도 라우터 표의 모든 그룹을 쿠키에 적는다.
  - 브라우저: 자산에서 바로 나가는 정적 페이지(`run_worker_first`는 `/api/*`뿐)에 처음 온 사람은 `slseoun_rf`가 없어
    legacy였다. 쿠키가 아예 없을 때만(그룹을 강등한 때가 아니라) 빌드 시점 `NEXT_PUBLIC_API_PATH_DEFAULT`(같은 값)를
    따른다(`src/lib/runtime-flags.ts`, 패치 페이지의 esbuild 묶음과 `patch-comments-client.js`는 페이지 설정
    `apiPathDefault`). Worker가 legacy로 답하면 그 페이지에서 그룹을 강등하므로 legacy로 되돌리기는 쿠키 없이도 된다.
  - 배포: GitHub Actions와 `run-cloudflare-testbed.mjs`는 `NEXT_PUBLIC_API_PATH_DEFAULT`를 그대로 넘긴다(없으면 legacy).
    두 값 모두 아직 넣지 않았다. 닫기 전에 Worker `--var API_PATH_DEFAULT:api`와 빌드 변수 `api`를 함께 배포한다.

## 8. 켜는 순서와 되돌리기

켜기(원격 작업은 모두 사용자 승인 뒤, testbed 먼저):

1. 5절 마이그레이션을 `docs/RELEASE_PROCESS.md` 5절대로 올린다.
2. testbed Worker secret `API_SUPABASE_SECRET_KEY`(Supabase secret 키)를 확인한다. 2단계 동기화와 5단계 미러가 같은
   이름의 같은 secret을 쓴다. 아직 없으면 Supabase secret 키를 만들어 넣는다(값은 출력하지 않는다).
3. 이 코드가 든 Worker를 testbed에 배포한다. 플래그 행이 없으면 지금과 같다.
4. testbed에서 그룹 하나씩 `pnpm flags -- set write.<group> worker --env testbed --remote --note "…"`, 그 화면의 쓰기를
   한 번씩 해 보고 Supabase 행을 확인한다. 이상하면 그 그룹을 `rls`로. `history-runs`의 런 하나씩 공유(9절 5번)는
   2026-11-09 합쳤다. 그룹마다 Workers 로그의 CPU 시간도 본다(9절 5번).
5. 운영도 같은 순서(그 그룹의 `path.<group> = api`가 켜진 뒤에만 뜻이 있다).
6. 모든 그룹이 worker가 되고 경로 플래그의 env 기본값(7절 `API_PATH_DEFAULT`, 빌드 `NEXT_PUBLIC_API_PATH_DEFAULT`)이
   `api`로 배포되면 `API_WRITE_MODE_DEFAULT=worker`를 배포하고 7절 닫기 스크립트를 적용한다.

되돌리기: 닫기 뒤라면 `restore_direct_writes.sql` 먼저, 그다음 `write.<group>`을 `rls`로(필요하면
`API_WRITE_MODE_DEFAULT`도 지운다). 마이그레이션 되돌리기는 모든 그룹이 rls가 된 뒤에만. 원본이 Supabase라 데이터는
그대로다.

## 9. 지금과 다른 점(알고 남긴 것)

1. 문의 시간당 3건은 Worker가 센 뒤 쓴다. 트리거의 advisory lock이 없어 동시에 보낸 문의 둘이 모두 들어갈 수 있다(최대
   한 건 더). 시각도 DB의 `now()` 대신 Worker 시각이다.
2. 문의 메일의 소문자 바꾸기는 JS `toLowerCase()`다. Postgres `lower()`는 DB 로캘을 따르므로 ASCII 밖의 글자에서
   다를 수 있다.
3. 보호 열(카운터, created_at)에 형식이 틀린 값(`"like_count": "abc"`)을 보내면 지금은 22P02로 거절되지만, worker
   방식은 그 열을 빼고 받는다. 정직한 클라이언트는 그런 값을 보내지 않는다.
4. 여러 행 요청에서 두 행이 서로 다른 이유로 실패하면 어느 오류 코드가 나오는지가 다를 수 있다(둘 다 거절).
5. 흘려보내던 업로드를 이제 파싱한다. 로컬(Node) 측정으로 파싱과 직렬화가 1 MB 글 약 4 ms, 4 MB 글 약 14 ms였다.
   글 상한 8 MB, 임시 저장 4 MB라 큰 글은 Free 10 ms를 넘을 수 있다. testbed에서 잰다.
   런 묶음(24 MB)은 D1 설계 4.4절 "5단계 공유 요청" 5번과 다르다. 그 절은 4단계 Worker 검증 쓰기도 묶음을 파싱하지 않고
   5단계 요청 모양(요청 하나에 런 하나, 원문은 파싱하지 않음)을 쓰라고 정했다. 그 경로(`/api/write/history-runs/share`,
   묶음 경로의 409 `single_run_required`)와 런마다 보내는 클라이언트(`run-donation.ts`, 둘씩 동시에)는 5단계 작업이
   만들었다. 2026-11-09 Supabase 원본에도 이었다(`step4/prereqs`, `routes/history-runs-share.ts`):
   - worker 방식의 `write.history-runs`에서 런 올리기 두 경로(`POST /api/write/history-runs`, `/batch`)는 본문을 읽지
     않고 409 `single_run_required`로 답한다. 클라이언트는 지금처럼 런마다 공유 경로로 다시 보낸다.
   - 공유 경로(`[<행>,<원문>]`, 행 길이는 `X-Slseoun-Row-Length`)는 행만 파싱한다. D1 목록 요약 열 다섯(`characters`,
     `game_mode`, `game_elements`, `list_facts`, `summary_version`, Supabase `runs`에는 없다)을 뺀 행 하나를 묶음과
     같은 요청(`on_conflict=id,env`, 중복 무시, `select=id`)으로 게이트가 `decideWrite`로 판단하고, 원문은 파싱하지 않고
     JSON 문자열로 이어 붙여(`supabase-rest.ts` `rawText`) service 키로 쓴다. 답은 D1 공유와 같은 `{ v, env, inserted }`다.
   - rls 방식에서는 공유 경로가 지금처럼 409 `single_run_unavailable`이고 클라이언트는 묶음을 쓴다.
   - 동등성 spec이 런 올리기 사례마다 오늘(묶음, rls)과 worker(공유를 런마다)가 사용자에게 같은 결과(공유됨·이미
     공유됨·실패)를 내고 같은 행(원문, 변경 로그 포함)을 남기는지 본다. 다른 점은 10번.
6. 문의를 돌려받는 insert(`return=representation`)는 돌려받는 열마다 SELECT 권한을 본다. PostgREST가 `RETURNING`에
   넣는 열이 `select` 목록과 같다고 보았다. 실제 경로는 `return=minimal`만 쓴다.
7. 흘려보내던 쓰기의 env는 지금처럼 클라이언트 값을 그대로 둔다. 4단계의 기준은 정직한 요청과 손으로 만든 요청 모두
   오늘과 같은 결과다. 정직한 클라이언트는 api 경로에서 Worker와 같은 env를 보낸다. env 열은 5단계 D1에 없다(plan 5.6).
8. 손으로 만든 요청만의 차이(정직한 클라이언트는 보내지 않는다):
   - 배열 본문의 PATCH: 게이트는 400 `PGRST102`로 거절한다. PostgREST 12 소스로는 첫 원소로 고친다(`LIMIT 1`). 가짜
     PostgREST도 배열 PATCH를 받지 않아 spec은 이 차이를 보지 않는다(실제 PostgREST로 확인하지 않았다).
   - 객체나 배열이 아닌 JSON 본문(`5`, `"x"`): 게이트는 400 `PGRST102`. PostgREST 12 소스로는 빈 객체로 읽으므로 소유 열이
     없어 정책이 거절할 것이다(확인하지 않았다).
   - 소유 열 밖의 uuid 열(글 `id`, 덧글 본문 `source_id`)에 uuid로 읽을 수 없는 값: Postgres는 정책보다 먼저 22P02,
     게이트는 정책 판단(42501)이 먼저일 수 있다. 둘 다 거절.
   - 흘려보내던 본문은 게이트가 파싱해 다시 직렬화한다. JS 숫자(배정밀도)로 나타낼 수 없는 수(`12345678901234567890`,
     `1e400`)는 jsonb 열에 오늘과 다른 값으로 들어간다. JS가 만든 JSON은 그대로 돌아온다.
9. D1 설계 3.1절·10.6절은 "4단계부터 Worker가 모든 쓰기를 검증해 D1이 받지 못하는 손으로 만든 값이 생기지 않는다"고
   적었다. 이 게이트는 오늘 Supabase와 같은 결과만 낸다(plan 7.3절 4단계의 대조 기준). 그래서 흘려보내는 본문의
   `created_at`·`updated_at`(`'infinity'` 등), 글의 원소 꼴, 다른 env 글의 이거 아님 저거? 좋아요(spec 사례 "this or that like
   on another env's post")는 4단계에도 오늘처럼 Supabase에 들어가고, 1분 동기화에서 3.1절 규칙대로 거절로 남는다.
   직접 쓰기를 닫으면 브라우저 경로만 없어진다.
10. 손으로 만든 런 묶음에 남의 런(`donor_user_id`가 다른 사람)과 새 런을 섞으면 오늘은 묶음 전체가 403이지만, 런마다
   보내면 정직한 런은 들어가고 남의 런만 403이다(동등성 spec 끝의 사례). 클라이언트는 늘 자기 uid를 보낸다.

## 10. 열린 질문

1. 쿠키 신원만 있는 사용자의 `me` 경로(개인 읽기, `get_my_*`): 2026-11-09 같은 게이트 방식으로 옮겼다(`step4/prereqs`).
   쿠키 방식의 브라우저는 토큰을 보내지 않으므로, 신원 작업만으로는 `me` 호출이 anon으로 Supabase에 닿아 RLS가 행을
   숨기고 `get_my_*`는 실행 권한이 없었다.
   - 라우터: `me` 경로에서 풀린 신원에 토큰이 없고(쿠키만) Worker에 secret 키가 있으면 핸들러 config 앞에 읽기
     게이트를 달고 토큰을 자리표시로 바꾼다. 플래그는 따로 없다(토큰이 있으면 지금 그대로, 되돌리기는
     `identity.mode = token`).
   - 읽기 게이트(`decideMeRead`): 표 읽기는 쿼리 그대로 service 키로 보내되, 자기 행만 보이는 SELECT 정책의 표
     (`TABLE_RULES`의 `select: "owner"`: 문의, 임시 저장, 이거 아님 저거? 투표)에는 소유 필터를 붙인다. 열 단위 권한(문의)은
     select·필터·정렬 열에 그대로 적용(42501), 묶어 읽는 표는 모두가 읽는 표만(댓글 좋아요의 댓글). `auth.uid()`를 읽는
     RPC 넷은 5절 3번의 래퍼로 `p_actor`를 붙여 보낸다. 그 밖(쓰기, 논리 필터, 모르는 표·RPC)은 보내지 않고 500
     `gate_unsupported`.
   - 검증: 동등성 spec이 `me` 경로 11개를 22가지로(내 것·남의 것, id 지정) 오늘(토큰, RLS)과 쿠키만(service 키, 4단계
     마이그레이션 둘)에서 같은 답인지 본다. `me.engagement`의 댓글 좋아요(`comments!inner` 묶어 읽기)는 가짜 PostgREST가
     묶어 읽기를 못 해 결정 단위 spec(`write-gate.spec.ts`)으로만 본다.
   - 5절 3번 마이그레이션을 올리기 전에는 쿠키 방식에서 프로필 통계·활동, 퍼즐상자 내 순위·순위표의 `me` 읽기가
     PGRST202다. 이 코드 없이 쿠키 방식이면 anon으로 닿아 앞의 셋은 실행 권한이 없고(42501) 순위표는 "나"가 빠진다.

합칠 때의 메모:

- 5단계 작업의 `write.paused`는 `write.<group>`과 접두사가 같지만 그룹 이름이 아니라서 이 코드는 읽고 버린다.
  `WRITE_FLAG_GROUPS`(`src/lib/api-write-modes.ts`)와 5단계의 `WRITE_GROUPS`는 같은 일곱 그룹이다. 하나로 합쳐도 된다.
- 신원 작업과는 라우터의 `check.user` 한 곳(4.2절)만 맞추면 된다.
- Supabase secret 키는 2단계 동기화(`workers/sync/sync-env.ts`)·5단계 미러와 같은 Worker secret
  `API_SUPABASE_SECRET_KEY`다. `supabaseServiceConfig`가 `write-gate/gate.ts`와 `sync/sync-env.ts` 두 곳에 생기니 하나로
  합쳐도 된다.
- `supabase db push`는 대기 중인 마이그레이션을 모두 올린다. 2단계 변경 로그를 올리기 전에 이 브랜치를 합치면 그 push에
  5절 마이그레이션이 함께 실린다(RELEASE_PROCESS 5절 4번의 dry-run에 둘 다 나온다). 브라우저 역할에 바뀌는 것이 없어
  같이 올려도 되는지, 따로 올릴지는 그때 사용자에게 묻는다.
- 쓰기 경로 안에서 사용자 토큰으로 읽는 호출(GET·HEAD)은 worker 방식에서 500 `gate_unsupported`다. 2단계의
  읽은 직후 반영(`workers/sync/read-after-write.ts`)은 service 키로 따로 읽으므로 걸리지 않는다. 합칠 때 쓰기 핸들러에
  토큰을 실은 읽기가 새로 생기지 않았는지 본다.
