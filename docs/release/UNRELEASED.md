# 미배포 기능 대장

마지막 정기 배포 이후의 기능 기대치와 열린 worktree를 기록한다.
작성·관리 규칙: [../RELEASE_PROCESS.md](../RELEASE_PROCESS.md).

기준점: 마지막 성공 프로덕션 실행 `438e5e86`(2026-11-09). 범위는 `438e5e86..main`.

## 열린 worktree

| 이름 | 브랜치 | 목적 | 상태 |
|---|---|---|---|
| domain-migration-c54d7b | claude/domain-migration-c54d7b | 도메인 이전(레거시 호스트 안내, 리다이렉트, robots/sitemap) | 11커밋, main보다 332 뒤처짐. 2026-10-26 정기 배포에서 제외 |
| supabase-exit | refactor/supabase-exit | Supabase → D1 이관. 계획은 [SUPABASE_EXIT_PLAN.md](../SUPABASE_EXIT_PLAN.md) 7절 | 2~5단계 코드를 2026-11-09 운영에 냈다(`438e5e86`). 운영은 1단계 화면 전환(전 그룹 api)과 2단계 동기화·그림자가 켜져 있다. 3단계부터 계속한다 |

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

<!--
### <항목-id>
- Feature:
- Expect:
- QA:
- Commits:
-->
