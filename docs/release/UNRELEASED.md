# 미배포 기능 대장

마지막 정기 배포 이후의 기능 기대치와 열린 worktree를 기록한다.
작성·관리 규칙: [../RELEASE_PROCESS.md](../RELEASE_PROCESS.md).

기준점: 마지막 성공 프로덕션 실행 `411543ff`(2026-10-26). 범위는 `411543ff..main`.

## 열린 worktree

| 이름 | 브랜치 | 목적 | 상태 |
|---|---|---|---|
| domain-migration-c54d7b | claude/domain-migration-c54d7b | 도메인 이전(레거시 호스트 안내, 리다이렉트, robots/sitemap) | 11커밋, main보다 122 뒤처짐. 2026-10-26 정기 배포에서 제외 |
| opennext-exit | refactor/opennext-exit | main Worker에서 OpenNext 런타임 제거(정적 전용 Worker), 정적 파일 수 정리, 클라이언트 중복 제거 | 진행 중(2026-10-27 시작) |

## 긴급 배포로 QA 없이 나간 범위

## 기능 기대치

### search-canonical-policy
- Feature: ko와 en을 각각 자기 canonical로 두고 ko/en/x-default hreflang을 건다. 그 밖의 게임 로케일은 `/en`을 canonical로 한다. sitemap은 ko·en 두 줄과 alternates를 낸다. 접두사 문서에 `lang="en"`. 패치 제목·H1·설명에 "STS2"/"슬더스2" 접두사.
- Expect: `/ja/...` 등의 canonical이 `/en/...`. `/sitemap.xml`에 `/en` 행과 alternates. 패치 상세 제목이 "슬더스2 v…"/"STS2 v…". 정적 오류 셸 28개(`<locale>/compendium/{monsters,encounters}.html`)는 기존처럼 bestiary로 리다이렉트.
- QA: `tsx scripts/check-search-canonical.ts`, `tsx scripts/detail-shell-og.spec.ts`, `qa:cf:testbed`(lang·hreflang 기대값). 수동: sitemap, `/ja` canonical, 패치 제목.
- Commits: `ff7cb925`(merge of claude/wizardly-brattain-bb7f93: 3c62aca5..10d72230)

### static-compendium-detail
- Feature: 백과사전 상세가 사실 항목·효과 텍스트·관련 링크·변경 이력을 서버 HTML로 먼저 내고 hydration한다. 상세 payload를 `/generated/compendium-data/<locale>/<resource>.json` 141개 chunk로 나눈다. 목록은 그리드용 행만 보내고 모달·호버·이력은 chunk에서 불러온다. 목록 끝에 전체 항목 링크 색인. ko/en 정적 패치 페이지의 게임 요소 링크가 `/compendium/<type>/<id>`. 카드·유물·포션 상세의 캐릭터 항목이 캐릭터 페이지로 링크.
- Expect: 상세(ko/en, 모바일)가 정적 화면→상호작용 화면으로 바뀔 때 큰 깜빡임·레이아웃 이동 없음. chunk 실패 시 정적 본문 유지. 목록 호버 팁·모달·버전 선택 정상. 도감 몬스터의 문을 만드는 자·잠행 군체 타일이 chunk 도착 뒤 정상. 역사 강의서·커버 카드 정상.
- QA: `static:data`가 1.5 MB 미만 chunk 141개 기록, `cf:smoke --scope all`(`/generated/compendium-data/kor/cards.json`), `qa:cf:testbed` relic 모달. 수동: 위 Expect 항목.
- Commits: `3741dec8`(merge of claude/recursing-hopper-6b84b3: 33876a10..1fba341f). 충돌은 `patch-note-renderer.tsx` 한 곳, main의 `entityCompendiumHref()` 위에 상세 링크 변환을 얹음.

<!--
### <항목-id>
- Feature:
- Expect:
- QA:
- Commits:
-->
