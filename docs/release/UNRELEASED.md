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

## 긴급 배포로 QA 없이 나간 범위

없음.

## 진행 중 배포 (2026-11-06)

- 범위: `106d8811..main`. 2026-11-04 정기 배포의 후속 배포(섀소식 없음).
- push 전 운영 버전(롤백 대상): main `909ace41-5271-4906-8ebe-2e220567bdde`, patch `eda70b80-b1ec-4d50-a915-69156a4473cc`.

## 기능 기대치

<!--
### <항목-id>
- Feature:
- Expect:
- QA:
- Commits:
-->

### nav-patch-dot-future-shell
- Feature: 상단바 패치노트 점이 읽을 것이 없는데도 항상 켜지던 버그 수정. 11월 12일자 「포석」 패치 껍데기가 모든 방문 시각보다 늦어 점이 꺼지지 않았다. 시각이 지난 글만 센다.
- Expect: 패치노트·니오우스레터를 모두 읽은 브라우저는 상단바 패치노트 점이 꺼진다. 읽지 않은 실제 패치가 있으면 켜진다. 2026-11-12 12:00 UTC가 지나면 「포석」으로 다시 켜진다.
- QA: 운영(수정 전)과 testbed를 헤드리스로 비교. 운영은 "모두 읽음"에서도 점 켜짐, testbed는 꺼짐. "9/11 패치 안 읽음"은 둘 다 켜짐.
- Commits: `df30437c`

### toy-box-new-service
- Feature: 새 서비스 알림. 장난감 상자 아이콘에 금색(새 글)과 다른 에메랄드 물결 점, 메뉴의 짜증나는 퍼즐상자 행에 NEW. `announceNewThrough: "2026-11-04"`라 2026-11-04 다음 섀소식이 나오는 정기 배포에서 자동으로 꺼진다. 일찍 끄려면 `src/lib/site-nav-items.ts`에서 그 줄을 지운다.
- Expect: ko·/en·/ja 메인 페이지와 패치 페이지 상단바에서 장난감 상자에 에메랄드 점, 메뉴에 NEW. reduced-motion이면 점이 멈춘다.
- QA: testbed `mobile-viewport-qa` 320px~480px 전 프리셋 × 메뉴 연 상태 × ko·/en·/ja 메인 OK. 패치 페이지는 숨은 메뉴 링크를 "화면 밖"으로 세는 오탐이 운영과 같은 160건(기존). reduced-motion 확인.
- Commits: `5fa46021`, `65ae3e03`

### dev-mailbox-inbox-pip
- Feature: dev 전용. `/dev/admin`에 "접수" 상태 문의가 있으면 우편함(상단바, 휴대폰 런처)에 금색보다 크고 빠른 빨간 점. 운영 빌드는 요청하지 않는다.
- Expect: 운영 화면 변화 없음, `/api/dev/contact-inbox` 요청 없음.
- QA: dev에서 캐시 주입으로 빨간 점 확인. testbed에서 요청 0건 확인.
- Commits: `61e70414`

### dev-force-marks-cleared
- Feature: dev 상단바 안 읽음 강제 표시 저장 키를 v3로 올려 테스트용 강제 표시를 모두 끔.
- Expect: 실제 안 읽은 글만 점이 켜진다.
- QA: `nav-seen.spec` 통과.
- Commits: `5cc4ab80`
