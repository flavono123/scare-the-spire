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

### known-issues-fixes
- Feature: `tasks/010`의 운영 버그 수정(백과사전, 패치·byrdispatch·홈, Toy Box·조각모음·작성창, Worker·공통·빌드). 항목별 Feature·Expect·QA는 각 커밋 본문에 있다.
- Expect: 게임 전용 언어의 링크·이름이 그 언어를 유지하고, 없는 페이지가 사이트 404를 보이며, 조각모음 저장 실패가 글을 잃지 않는다. 운영 빌드는 Supabase를 못 읽으면 실패한다(`ALLOW_BUILD_WITHOUT_SUPABASE=1`로 우회, `docs/RELEASE_PROCESS.md`). 그 경우 main Worker만 먼저 나갈 수 있다.
- QA: 게이트 15개, testbed(main `36699b7d`, patch `eba2aadf`) `cf:smoke --scope all` 186개, `qa:cf:testbed` 12개, Supabase 차단 브라우저 확인(#2, #9, #18, #24, #33, #34, #36, #61). 쓰기 흐름은 가짜 응답으로만 확인했다. 실제 쓰기는 사용자 검수에서 본다.
- 범위 주의: 공용 `service-modal-frame.tsx` 배경 닫기 조건, `codex-filter-drawer.tsx` 초점, ko 외 댓글이 게임 언어·한국어 그래프를 둘 다 받아 첫 전송량이 늘어남, 언어별 검색 색인 12개(약 740 KB).
- Commits: `1eefa3a8..main`의 `Merge tasks/010 fixes` 4개와 후속 커밋

<!--
### <항목-id>
- Feature:
- Expect:
- QA:
- Commits:
-->
