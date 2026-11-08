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

## D1 마이그레이션

`d1/migrations/`. 운영 DB는 그 표를 쓰는 코드가 나가기 전에 적용한다(`npx wrangler d1 migrations apply slseoun-prod --remote`,
사용자 승인).

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
