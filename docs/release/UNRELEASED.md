# 미배포 기능 대장

마지막 정기 배포 이후의 기능 기대치와 열린 worktree를 기록한다.
작성·관리 규칙: [../RELEASE_PROCESS.md](../RELEASE_PROCESS.md).

기준점: 마지막 성공 프로덕션 실행 `438e5e86`(2026-11-09). 범위는 `438e5e86..main`.

## 열린 worktree

| 이름 | 브랜치 | 목적 | 상태 |
|---|---|---|---|
| domain-migration-c54d7b | claude/domain-migration-c54d7b | 도메인 이전(레거시 호스트 안내, 리다이렉트, robots/sitemap) | 11커밋, main보다 332 뒤처짐. 2026-10-26 정기 배포에서 제외 |
| step3-reads | step3/reads | Supabase 이관 3단계: 읽기를 D1으로(`read.<group>` 플래그, 역사 강의서 요약 목록·R3r 원문) | testbed 확인 끝(모든 그룹 `read.<group>` = d1로 둠). `refactor/supabase-exit`에 병합 대기 |
| supabase-exit | refactor/supabase-exit | Supabase → D1 이관. 계획은 [SUPABASE_EXIT_PLAN.md](../SUPABASE_EXIT_PLAN.md) 7절 | 2~5단계 코드를 2026-11-09 운영에 냈다(`438e5e86`). 운영은 5단계(모든 `source.<group>` = d1, 동기화 꺼짐, 쿠키 신원, 직접 쓰기 닫힘)다. 6단계 클라이언트 정리는 작업 묶음 WP0~WP-W가 병합됐고 WP-Z(WP-B 패치 릴 포함)는 병합 대기, 배포 전 |
| step6-* | step6/<묶음> | 6단계 작업 묶음([STEP6_PLAN.md](../supabase-exit/STEP6_PLAN.md) 3절). 묶음마다 `.claude/worktrees/step6-<묶음>` | `step6/wp-z`가 마지막(`step6/patch-reels` 병합). `refactor/supabase-exit`에 병합한 뒤 worktree와 브랜치를 지운다 |

## Supabase 마이그레이션

| 파일 | Rollout | Order | 적용 | 확인 |
|---|---|---|---|---|
| `20261109150000_worker_read_actor.sql`(4단계 쿠키만 있는 신원의 개인 읽기: 프로필·퍼즐상자 읽기 RPC 넷의 `worker_*` 래퍼, service_role만. 되돌리기 `worker-read-actor/rollback_worker_read_actor.sql`) | db-first-additive | before-push(어느 env든 `identity.mode = cookie` 전. testbed는 이미 cookie라 그 전까지 프로필 통계·활동과 퍼즐상자 `me` 읽기가 실패) | 적용 안 함(`step4/prereqs`) | 로컬 PGlite `pnpm test:write-gate` 통과(개인 읽기 22가지 동등, 되돌리기 두 번) |

## D1 마이그레이션

`d1/migrations/`. 운영 DB는 그 표를 쓰는 코드가 나가기 전에 적용한다(`npx wrangler d1 migrations apply slseoun-prod --remote`,
사용자 승인).

| 파일 | testbed(`slseoun-testbed`) | 운영(`slseoun-prod`) |
|---|---|---|
| 0007(4단계 전제: 토큰 서명 키 목록과 폐기 `api_verification_keys`, Worker 소유라 첫 복사의 다시 채우기가 건드리지 않음) | testbed 배포 때 적용(`step4/prereqs`) | 적용 안 함. 표가 없어도 지금과 같다(고정 키만, 1분에 한 번 읽기 실패) |

## 긴급 배포로 QA 없이 나간 범위

없음.

## 기능 기대치

### supabase-exit-step3-reads
- Feature: 화면 그룹별 읽기 저장소 플래그 `read.<group>`(supabase | d1). d1이면 GET이 D1에서 답한다. 역사 강의서 목록·상세·표지 편집기·코오오옴보 런 고르기가 두 답 모양을 다 읽는다.
- Expect: 플래그가 없으면(운영 기본) 아무것도 바뀌지 않는다. testbed에서 `read.<group>` = d1이면 화면이 supabase일 때와 같고, 역사 강의서 목록 답이 약 0.5 MB로 줄며(원문 없음), 상세와 표지 편집기가 `/api/read/history-run/raw`로 원문을 받는다.
- QA: testbed `/history-course`, `/en/history-course`, `/history-course/<run id>`, 목록의 표지 편집(주인), 코오오옴보 글쓰기의 도전 이력 참조, 백과사전 카드·유물 상세, 장난감 상자 피드들, 다채로운 철학자들, 퍼즐상자, 프로필, 문의. 모바일 320px ko·en
- Commits: step3/reads

### step4-prereqs
- Feature: Supabase 탈출 4단계를 운영에 켜기 전 필요한 것(`step4/prereqs`, refactor/supabase-exit에 합칠 브랜치).
  경로 플래그 env 기본값(`API_PATH_DEFAULT`, 빌드 `NEXT_PUBLIC_API_PATH_DEFAULT`), D1 토큰 서명 키 목록과 폐기
  (`api_verification_keys`, `scripts/verification-keys.ts`), worker 방식 역사 강의서 런 하나씩 공유(Supabase 원본),
  쿠키만 있는 신원의 개인 읽기(읽기 게이트, `20261109150000_worker_read_actor.sql`).
- Expect: 두 기본값을 넣지 않고 `write.history-runs = rls`, `identity.mode = token`이면 모든 화면이 지금과 같다.
  testbed(쿠키 방식, 모든 `write.<group> = worker`)에서 역사 강의서 업로드·공유가 "N개 공유 · M개 이미 공유됨"을
  지금처럼 보이고 Supabase `runs`에 원문 그대로 들어간다. 프로필·문의함·임시 저장·좋아요 표시 등 개인 읽기가 토큰 없이
  같은 값을 보인다(읽기 RPC 넷은 위 Supabase 마이그레이션 적용 뒤).
- QA: testbed `/history-course` 업로드·공유, `/profile`, 문의함 점, 페이지스톰 임시 저장, 이거 아님 저거? 좋아요·투표 표시,
  퍼즐상자 순위. 운영은 기본값과 마이그레이션을 넣는 배포 때.
- Commits: `step4/prereqs`의 커밋들.

### supabase-exit-step6-client
- Feature: Supabase 이관 6단계 클라이언트 정리. 브라우저에 `@supabase/supabase-js`와 Supabase 직접 경로(legacy 읽기·쓰기,
  Realtime 채널, supabase-js 세션 갱신·익명 가입)가 없다. 모든 데이터 호출은 같은 출처 `/api/read|me|write/*`와
  `/api/auth/claim`이고 신원은 서명 쿠키만 쓴다. CSP `connect-src`에서 `*.supabase.co`를 뺐다. `next build`는 아무것도
  읽지 않고, 패치 빌드는 셸 패치 릴을 배포된 사이트의 `/api`에서 굽는다(결정 D1 B안). CI 빌드에는 Supabase URL·키가
  없다. 플래그 CLI는 `path.<group>` legacy, `identity.mode` token, `write.<group>` rls를 `--old-client` 없이 거절한다.
- Expect: 화면은 지금(5단계 운영)과 같다. DNS로 `*.supabase.co`를 막은 새 브라우저에서 홈, 백과사전 상세 댓글·좋아요·반응,
  패치 노트 줄 댓글, 장난감 상자 피드·상세·쓰기, 조각모음, 역사 강의서, 다채로운 철학자들, 퍼즐상자, 프로필, 문의가
  데이터와 함께 뜨고 쓰기가 된다. `*.supabase.co` 요청 0, `securitypolicyviolation` 0, `/api` 409 0, "데이터베이스가
  응답하지 않습니다" 없음. 기존 supabase-js 세션이 있는 브라우저는 같은 uid로 claim한다(만료된 토큰은 Worker가 refresh).
  Worker가 409 `surface_legacy`를 주거나 표식 헤더가 없으면 legacy로 가지 않고 "데이터베이스가 응답하지 않습니다"를
  보인다. 셸 패치 `/patches/2026-11-12`, `/patches/2026-09-11`(14개 언어)의 변형 릴 15개 순서와 철학자 카드가 사이트
  `/api`의 최신 값과 같다. 미리 그린 HTML은 패치 릴 데이터를 빼고 6단계 전과 같다.
- QA: 병합 뒤 `pnpm cf:testbed` 전체와 공통 브라우저 확인(새 프로필 Chromium, `--host-resolver-rules="MAP *.supabase.co ~NOTFOUND"`,
  `slseoun_qa` 쿠키 없음): https://scare-the-spire-testbed.flavono123.workers.dev/ ,
  https://scare-the-spire-testbed.flavono123.workers.dev/c-c-c-combo ,
  https://scare-the-spire-testbed.flavono123.workers.dev/history-course ,
  https://scare-the-spire-testbed.flavono123.workers.dev/patches/2026-11-12 ,
  https://scare-the-spire-testbed.flavono123.workers.dev/en/patches/2026-11-12 ,
  https://scare-the-spire-testbed.flavono123.workers.dev/patches/2026-09-11 에서 (a) supabase.co 요청 0, (b) CSP 위반 0,
  (c) `/api` 409 0, (d) "응답 없음" 문구 없음. 기존 testbed Supabase 세션을 localStorage에 넣은 두 번째 프로필로 댓글
  하나를 써 uid가 그대로인지 본다. 배포 전 두 Worker의 직전 버전 id를 기록하고, 배포 뒤 운영을 같은 방법으로 확인한다.
  넘어갈 조건은 Supabase 로그에서 운영 referer의 `/rest/v1`, `/auth/v1`, `/realtime` 요청 0건이다.
- Commits: `refactor/supabase-exit`의 6단계 병합(`step6/wp0`, `wp-a`, `wp-p`, `wp-n`, `wp-c`, `wp-d`, `wp-h`, `wp-t1`,
  `wp-t2`, `wp-q`, `wp-w`, `step6/wp-z`(`step6/patch-reels` 포함)). OG D1(`step6/og-d1`)과 관리 도구(`step6/dev-tools`)는
  2026-11-09에 먼저 나갔다.

<!--
### <항목-id>
- Feature:
- Expect:
- QA:
- Commits:
-->
