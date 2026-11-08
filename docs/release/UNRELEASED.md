# 미배포 기능 대장

마지막 정기 배포 이후의 기능 기대치와 열린 worktree를 기록한다.
작성·관리 규칙: [../RELEASE_PROCESS.md](../RELEASE_PROCESS.md).

기준점: 마지막 성공 프로덕션 실행 `ff3760fa`(2026-11-08). 범위는 `ff3760fa..main`.

## 열린 worktree

| 이름 | 브랜치 | 목적 | 상태 |
|---|---|---|---|
| domain-migration-c54d7b | claude/domain-migration-c54d7b | 도메인 이전(레거시 호스트 안내, 리다이렉트, robots/sitemap) | 11커밋, main보다 332 뒤처짐. 2026-10-26 정기 배포에서 제외 |
| supabase-exit | refactor/supabase-exit | Supabase → D1 이관. 계획은 [SUPABASE_EXIT_PLAN.md](../SUPABASE_EXIT_PLAN.md) 7절 | 1단계를 2026-11-08 운영에 냈다(`ff3760fa`, 스위치 off). 2단계(D1 그림자)부터 계속한다. 단계마다 main에 병합해 정기 배포로 낸다 |

## Supabase 마이그레이션

| 파일 | Rollout | Order | 적용 | 확인 |
|---|---|---|---|---|

## D1 마이그레이션

`d1/migrations/`. D1 절차는 아직 RELEASE_PROCESS.md에 없다. 운영 DB는 `API_RUNTIME_FLAGS`를 `d1`로 바꾸는 배포 전에
적용한다(`pnpm exec wrangler d1 migrations apply DB --remote`, 사용자 승인).

| 파일 | testbed(`slseoun-testbed`) | 운영(`slseoun-prod`) |
|---|---|---|

## 긴급 배포로 QA 없이 나간 범위

없음.

## 기능 기대치

<!--
### <항목-id>
- Feature:
- Expect:
- QA:
- Commits:
-->
