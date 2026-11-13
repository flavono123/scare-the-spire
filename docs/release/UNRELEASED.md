# 미배포 기능 대장

마지막 정기 배포 이후의 기능 기대치와 열린 worktree를 기록한다.
작성·관리 규칙: [../RELEASE_PROCESS.md](../RELEASE_PROCESS.md).

기준점: 마지막 성공 프로덕션 실행 `438e5e86`(2026-11-09). 범위는 `438e5e86..main`.

## 열린 worktree

| 이름 | 브랜치 | 목적 | 상태 |
|---|---|---|---|
| domain-migration-c54d7b | claude/domain-migration-c54d7b | 도메인 이전(레거시 호스트 안내, 리다이렉트, robots/sitemap) | 11커밋, main보다 332 뒤처짐. 2026-10-26 정기 배포에서 제외 |
| step3-reads | step3/reads | Supabase 이관 3단계: 읽기를 D1으로(`read.<group>` 플래그, 역사 강의서 요약 목록·R3r 원문) | testbed 확인 끝(모든 그룹 `read.<group>` = d1로 둠). `refactor/supabase-exit`에 병합 대기 |
| supabase-exit | refactor/supabase-exit | Supabase → D1 이관. 계획은 [SUPABASE_EXIT_PLAN.md](../SUPABASE_EXIT_PLAN.md) 7절 | 2~5단계 코드를 2026-11-09 운영에 냈다(`438e5e86`). 운영은 1단계 화면 전환(전 그룹 api)과 2단계 동기화·그림자가 켜져 있다. 3단계부터 계속한다 |
| sts1-worker | refactor/sts1-worker | STS1 백과사전 상세(ko·en)를 별도 Worker `scare-the-spire-sts1`로 다시 서비스(8cd3f7eb 되돌리기). 설계는 브랜치의 `docs/designs/sts1-compendium-worker.md` | 2026-11-13 시작. 구현과 testbed QA를 마치고 병합 전에 사용자에게 보고. `workers/main-worker.ts`·`wrangler.jsonc`를 고치므로 병합 전에 Supabase 이관과 순서를 맞출지 묻는다 |

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

- 2026-11-13 v0.113.0 패치노트 긴급 배포(작업 도구 `7d2f9a2a`)에 다른 세션 커밋이 같이 나감: `88fcf932`·`e9cec30e`(문의함 화면, dev 전용), `f2abe1a4`(`pnpm cf:limits` 스크립트), `97ec500b`·`d00b2be3`(/dev/admin CF 한도 탭, dev 전용), `7bdd202b`(문서). 운영 화면 영향 없음.

## 기능 기대치

### v0113-codex-backfill
- Feature: v0.113.0 백과사전 백필(worktree `v0113-codex-backfill`을 `a822bf5c`로 병합). 새 캐릭터 풀(6번째 캐릭터: 타입·카드 타일 프레임·에너지 아이콘·필터·`[fool]` 색·캐릭터 페이지), 신규 카드 121·유물 17·포션 3·파워 39·이벤트 5·에포크 9·몬스터 2, 기존 카드 43장 갱신, 변경 기록(카드·유물·몬스터·이벤트·포션·파워), 베타 그림만 있는 유물·파워·에포크의 그림 표시, 티어 리스트·페이지스톰의 노랑/풀 색, 영문 짧은 이름 Fool, 패치 줄 생성과 옛 패치노트 공식 개명 반영, 패치 이력 인덱스 재검증(no-cache). 드레드 모드 값을 걸러 내도록 몬스터·조우 파서 수정.
- Expect: /compendium/characters에 풀이 6번째로 나오고 /compendium/characters/fool이 체력 77·골드 99·시작 덱을 보인다. /compendium/cards?card=FOOLISH_SHOT 모달이 풀 프레임으로 뜬다. /compendium/relics?relic=bath_robes가 베타 그림으로 뜬다. /patches/0.113.0의 새 이름이 모두 링크된다. /compendium/monsters/infested_prism 패치 이력에 v0.113.0이 있다. 옛 버전 선택 시 새 카드·유물이 보이지 않는다. 정적 파일은 약 16,000개.
- QA: 위 경로들(브라우저로 확인함: 캐릭터 목록·상세, 카드 상세·모달, 유물 모달, 패치노트 링크, 몬스터 이력). 확인 못 함: 영문 페이지 전체, 모바일 폭, 옛 버전 선택기, 티어 리스트·페이지스톰 색 선택기.
- Commits: `8cd3f7eb`(STS1 상세 내리기, 이미 배포)부터 `a822bf5c`까지.

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

<!--
### <항목-id>
- Feature:
- Expect:
- QA:
- Commits:
-->
