# 미배포 기능 대장

마지막 정기 배포 이후의 기능 기대치와 열린 worktree를 기록한다.
작성·관리 규칙: [../RELEASE_PROCESS.md](../RELEASE_PROCESS.md).

기준점: 마지막 성공 프로덕션 실행 `fb9b72b5`(2026-11-02). 범위는 `fb9b72b5..main`.

## 열린 worktree

| 이름 | 브랜치 | 목적 | 상태 |
|---|---|---|---|
| domain-migration-c54d7b | claude/domain-migration-c54d7b | 도메인 이전(레거시 호스트 안내, 리다이렉트, robots/sitemap) | 11커밋, main보다 332 뒤처짐. 2026-10-26 정기 배포에서 제외 |

## Supabase 마이그레이션

| 파일 | Rollout | Order | 적용 | 확인 |
|---|---|---|---|---|

## 긴급 배포로 QA 없이 나간 범위

없음.

## 기능 기대치

<!--
### card-tile-build-match
- Feature: 카드 타일의 수치·강화·문구가 아카이브한 모든 빌드(0.98.0~0.111.0)의 전투 밖 게임 표시와 같고, 같은 문구는 버전이 달라도 개행이 같다.
- Expect: 완벽한 타격 6, 쥐어뜯기 10, 재성형 단조 5, 때가 되었다 괄호 줄 없음. 초승달 창 0.104.0은 6, 0.105.0은 8. 재주넘기 0.99.1과 0.108.0의 줄바꿈이 같다.
- QA: `pnpm test:version-canonical`, `pnpm test:version-api`, `pnpm codex:validate`. 수동: 위 카드의 `/compendium/cards/<id>?version=<버전>` 타일.
- Commits: `c12bb4d2`와 그 후속 커밋

### <항목-id>
- Feature:
- Expect:
- QA:
- Commits:
-->
