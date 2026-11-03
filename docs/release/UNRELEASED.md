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

### neowsletter-images-patch-only
- Feature: 니오우스레터 이미지 399개를 main Worker 업로드에서 빼고 patch Worker에서만 서빙한다. 정적 asset이 18,101개가 되어 예산까지 1,399개 남는다.
- Expect: 니오우스레터 페이지 이미지가 그대로 나오고 `/images/neowsletters/*`가 1년 캐시 헤더를 유지한다. 베타 아트 표시는 바뀌지 않는다.
- QA: testbed에서 `cf:smoke --scope all` 186개, `qa:cf:testbed` 12개, 니오우스레터 399개와 베타 아트 673개 HTTP 200·원본 해시 일치, 캐시 헤더 확인. 빌드 결과가 참조하는 니오우스레터·베타 URL의 누락 없음. Supabase 차단 브라우저로 니오우스레터 30쪽 깨진 이미지 0개, 베타 아트 토글이 있는 5개 목록과 표본 상세에서 렌더 확인. 운영에서는 main 이전 patch 배포 뒤 같은 이미지 응답을 다시 본다.
- Commits: `a6ae5810`

### vexing-puzzlebox
- Feature: 장난감 상자의 새 서비스 짜증나는 퍼즐상자(`/vexing-puzzlebox`). 토큰·한글·영어 표시를 켜고 끄는 커넥션스 탭(돋보기 호버팁, 프로필 토큰 손 포인터·상인/짭상인 손, 여러 손이 쥐어 옮기는 섞기, 원작식 오답 흔들림, 4개째·제출 때 상인 말풍선·음성, 바쿠 훈수, 전투 버튼 조작부와 에너지 실수 표시)과 베타 아트 탭(감상, 갤러리, 퀴즈). 상인 방 배경음과 게임 효과음. 유물·파워 상세의 `?beta=true`도 함께 고침.
- Expect: 커넥션스를 풀면 묶음별로 그림과 링크가 열리고 결과를 복사할 수 있다. 섞으면 손들이 칸을 쥐고 옮기며, 오답은 빨갛게 흔들리고 상인과 바쿠가 반응한다. 베타 아트 감상은 자동 재생되고 끌면 멈춰 비교되며, 갤러리에서 고른 그림이 감상에서 열린다. 퀴즈는 28세트로 풀린다. Supabase가 멈춰도 게임은 돈다.
- QA: 로컬 브라우저에서 데스크톱·모바일로 커넥션스 완주, 섞기·오답·같은 조합·다시 풀기, 감상 재생·끌기, 갤러리 열기, 퀴즈 1세트 완주, 저장 복원, 배경음·효과음 켜고 끄기. 정기 배포 전 재검수 필요. 소리는 실제 귀로 들어 보지 않았다.
- 배포 전 필수: Connections 나머지 25개 backfill, STS1 현지화(사건·몬스터·블라이트) 추출, STS1 렌더. 지금은 #27만 들어 있다.
- Commits: `39d0c1e1` 이후

### sts1-card-render-speed
- Feature: STS1 카드 목록 렌더 개선. 글자 canvas를 GPU에서 내리고, 42장 단위로 그리며, 바뀌지 않은 타일을 다시 그리지 않는다.
- Expect: 첫 로딩과 필터·검색 전환이 멈추지 않는다. 카드는 스크롤로 이어서 나오고, 목록이 바뀌면 맨 위로 돌아간다. 정적 HTML에는 370장 링크가 모두 남는다.
- QA: 로컬에서 `sts1-card-layout`·`sts1-description` 스펙, Chrome headless로 스크롤·필터·검색·상세 확인, 첫 화면 운영본 대비 픽셀 차이 6개(최대 1). testbed 확인과 다른 언어 화면 확인은 남아 있다.
- Commits: `79997abf`, `8e9a2520`, `8867e0d2`, `7c4f1b94`

### sts1-bestiary
- Feature: STS1 몬스터 도감. 65종 목록·상세·댓글, STS1 메뉴와 조각모음 STS1 선택기에 추가. `Apology Slime`은 게임이 조우 로드 실패 때만 띄우는 대체 몬스터라 뺐다. 상세는 정지 그림을 먼저 깔고 Spine으로 움직이며(육각령·청동 구체는 정지 그림), 행동 202개를 게임 클래스에서 읽어 행동 버튼(의도 토큰·피해량·방어도·파워·카드·소환), 클립과 몸 전체 돌진·뛰기·흔들기 재생, STS2와 따로 저장되는 승천 0–20, 발밑 체력바, 시작 효과를 보인다.
- Expect: `/compendium/sts1/monsters/jaw-worm`에서 물어뜯기를 누르면 입을 벌리고, 승천 17에서 포효가 방어도 9·힘 5가 된다. 화난 그렘린의 할퀴기는 왼쪽으로 돌진한다. 행동 버튼에 호버하면 무대 위에 의도 토큰이 뜬다. 파워·카드 토큰에 호버하면 STS1 미리보기가 뜬다.
- QA: 빌드 결과를 로컬 Worker(`wrangler dev`)로 띄워 65종 ko/en HTML, RSC, 이미지 해시 전수 확인, 게임 전용 언어 목록 6개, 필터, 모달, 모바일 확인(Spine 이전 기준). Spine·행동은 dev 서버에서 턱벌레·화난 그렘린·육각령·수호자·심장·섀·광신자(모달) 확인. `cf:build`(`35bbeb8a`, 정적 18,772/19,500) 결과를 로컬 Worker로 띄워 65종 ko/en 130쪽의 행동 버튼 수·뼈대 참조·`x-cf-static-page`, Spine 파일 189개·의도 아이콘 17개 원본 일치, 63종 뼈대가 사이트 런타임에서 모든 클립까지 읽히는지 확인했다. testbed는 아직 못 올렸으니 배포 전 `cf:smoke --scope all`을 돌린다. 댓글은 Supabase 차단 상태라 입력을 확인하지 못했다.
- 범위 주의: 공용 `monster-ascension.tsx`(저장 키·최대 단계·아이콘 인자, 체력바 표시부 분리), `monster-spine-stage.tsx`(JSON 뼈대), `mention-hover.tsx`(아이콘 자식)를 바꿨다. STS2 도감 기본값은 그대로다.
- Commits: `5d864d13`, `38128626`, `6144c600`, `497ee7ab`와 후속 커밋

<!--
### <항목-id>
- Feature:
- Expect:
- QA:
- Commits:
-->
