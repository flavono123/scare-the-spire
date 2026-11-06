# 미배포 기능 대장

마지막 정기 배포 이후의 기능 기대치와 열린 worktree를 기록한다.
작성·관리 규칙: [../RELEASE_PROCESS.md](../RELEASE_PROCESS.md).

기준점: 마지막 성공 프로덕션 실행 `106d8811`(2026-11-05). 범위는 `106d8811..main`.

## 열린 worktree

| 이름 | 브랜치 | 목적 | 상태 |
|---|---|---|---|
| domain-migration-c54d7b | claude/domain-migration-c54d7b | 도메인 이전(레거시 호스트 안내, 리다이렉트, robots/sitemap) | 11커밋, main보다 332 뒤처짐. 2026-10-26 정기 배포에서 제외 |
| supabase-exit | refactor/supabase-exit | Supabase → D1 이관 1단계(같은 출처 API). 계획은 [SUPABASE_EXIT_PLAN.md](../SUPABASE_EXIT_PLAN.md) 7절 | 2026-11-05 시작. 단계가 끝날 때마다 main에 병합해 정기 배포로 낸다 |

## Supabase 마이그레이션

| 파일 | Rollout | Order | 적용 | 확인 |
|---|---|---|---|---|

## D1 마이그레이션

`d1/migrations/`. D1 절차는 아직 RELEASE_PROCESS.md에 없다. 운영 DB는 `API_RUNTIME_FLAGS`를 `d1`로 바꾸는 배포 전에
적용한다(`pnpm exec wrangler d1 migrations apply DB --remote`, 사용자 승인).

| 파일 | testbed(`slseoun-testbed`) | 운영(`slseoun-prod`) |
|---|---|---|
| 0001_runtime_flags.sql | 2026-11-05 적용 | 미적용(스위치 off 동안 읽지 않음) |
| 0002_api_cache.sql | 2026-11-05 적용 | 미적용 |

## 긴급 배포로 QA 없이 나간 범위

없음.

## 기능 기대치

### supabase-exit-step1-foundation
- Feature: Supabase 이관 1단계 기반. `/api/read|me|write/*` 라우터, D1 런타임 플래그(`path.<그룹>`), 플래그 쿠키
  `slseoun_rf`, 네비 새 글 표시·댓글 배달부의 api 경로(`/api/read/nav`, D1 스냅샷 공유 캐시). 설계는
  [STEP1_DESIGN.md](../supabase-exit/STEP1_DESIGN.md)
- Expect: 운영은 `API_RUNTIME_FLAGS=off`라 기존 URL의 상태·헤더·본문이 그대로이고 D1을 읽지 않는다. 바뀌는 것은
  `/api/read|me|write/*`가 HTML 404 대신 JSON 409 `surface_legacy`를 주는 것뿐이다. testbed에서 `path.nav=api`면
  Next·패치 페이지의 네비 점과 배달부가 legacy와 같고, 페이지마다 Supabase 9~10건 대신 30초에 한 번 이하
  `/api/read/nav` 1건이다
- QA: 운영 배포 뒤 `pnpm cf:smoke -- --origin <운영>`(API 라우터 확인 포함). testbed에서 `path.nav` legacy와 api를
  번갈아 켜고 홈, `/compendium/cards`, `/patches/<최신>`의 점·배달부 비교, 쿠키 지우기, 409 되돌리기 확인
- Commits: worktree `refactor/supabase-exit`

### supabase-exit-step1-comments
- Feature: 댓글 그룹의 api 경로. 공개 읽기 `/api/read/engagement`(스레드·좋아요 수·반응 합계·철학자 글을 한 요청에
  모음), 개인 덧칠 `/api/me/engagement`, 쓰기 `/api/write/comments`·`comment-likes`·`likes`·`reactions`, 목록 참여 수
  `/api/read/engagement-counts`. rate limit binding `API_READ_LIMITER`·`API_WRITE_LIMITER`(운영 namespace 1101·1102,
  testbed 1201·1202). 설계는 [STEP1_DESIGN.md](../supabase-exit/STEP1_DESIGN.md) 9.1절
- Expect: `path.comments=legacy`(운영 기본)에서는 화면과 요청이 그대로다. api면 백과사전 상세가 Supabase 4~5+2N건 대신
  Worker 1~2건, 니오우스레터가 claim별 스레드 대신 몇 건으로 줄고, 쓰기는 응답으로 화면을 고친다(다시 읽지 않음).
  testbed 패치 페이지는 api 경로에서 development 행을 읽고 쓴다
- 상태: 2026-11-06 로컬 QA 36/36, testbed QA 35/36(남은 1개는 testbed 패치 페이지의 네비 env 차이). testbed D1은
  `path.nav`·`path.comments`가 `api`다
- QA: testbed에서 `path.comments`를 api로 켜고 백과사전 상세(댓글·답글·좋아요·반응 쓰기와 되돌리기), 패치 셸 릴 반응,
  니오우스레터 claim 스레드, 몬스터 목록 참여 수를 legacy와 비교. `Authorization: Bearer x.y.z`로 쓰기 401과 로그에
  헤더가 남지 않는지(설계 4.5절)
- Commits: worktree `refactor/supabase-exit`

### supabase-exit-step1-colorful-philosophers · contact · profile · puzzlebox · history-runs
- Feature: 나머지 그룹의 api 경로(설계 9.2~9.6). 철학자 주간 목록·글·셸 패치 릴, 메일함 점·문의 쓰기, 프로필(닉네임 풀,
  활동 통계·목록, 내 문의, 읽음 표시), 퍼즐상자(순위표, 내 순위, 판 제출), 역사 강의서 런(목록·상세·참여 수·내 런,
  공유·묶음 공유·표지·닉네임·삭제). 런 원문이 든 읽기와 쓰기는 Worker가 파싱하지 않고 그대로 흘려보낸다
- Expect: 각 그룹이 `legacy`(운영 기본)면 그대로다. api면 같은 화면이 Worker를 거친다. 바뀌는 것: 내 문의 목록은 이
  env만, 퍼즐상자 순위표는 세션이 있으면 `/api/me`, 런 공유 본문의 env는 Worker가 강제하지 못한다(RLS가 기증자 확인)
- 상태: 2026-11-06 로컬 QA 15/15·42/42, testbed 42/42·14/15(남은 1개는 testbed 네비 env 차이). testbed D1은 7개
  그룹이 `api`다. `toybox-feed`·`stories`는 Realtime 결정 대기
- QA: testbed에서 그룹별로 api와 legacy를 번갈아 켜고 철학자 목록·글·셸 릴, 프로필, 퍼즐상자 순위표, 역사 강의서 목록·
  상세·공유를 비교. 지울 수 없는 쓰기(문의, 퍼즐상자 제출)는 운영 확인 때 사용자와 정한다
- Commits: worktree `refactor/supabase-exit`

<!--
### <항목-id>
- Feature:
- Expect:
- QA:
- Commits:
-->
