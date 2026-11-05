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

<!--
### <항목-id>
- Feature:
- Expect:
- QA:
- Commits:
-->
