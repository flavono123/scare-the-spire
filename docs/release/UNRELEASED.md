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
- 후속 수정(묶음 1 QA): 크롤러(Googlebot·Yeti 등)는 ko 페이지에서 `/en` 자동 전환을 하지 않음(`4b7d4340`). Toy Box 기록 셸은 hydration 뒤에도 canonical·hreflang·og:url이 한 벌, `/ja` 기록은 `/en` canonical, 게임 로케일 셸 OG 문구는 영어(`e4bcb93b`). 패치 description이 단어 중간에서 잘리지 않음(`311114f5`). modifiers·ascensions 상세에 canonical·hreflang(`e58d7556`). 게임 로케일 목록의 승천·모디파이어·배지 타일이 404 상세 대신 목록 모달 URL로(`3e02cb1b`, `471420ce`, `9d8b3217`). 게임 로케일 패치 페이지·탐색기·백과사전 패치 이력 링크가 `/en` 대신 그 로케일로(`ea1ac8f6`, `e26d34c2`, `22bd242e`). `build-23478716` 패치 줄 링크 404 수정(`8024759b`, `b7f7c4ab`).
  - Expect: en-US Googlebot UA로 ko URL을 렌더해도 canonical이 ko. `/ja/this-or-that/<id>` hydration 뒤 canonical 1개(`/en/this-or-that/<id>`). `/ja/patches/*`에 `/en/` 링크 0개. `/ja/compendium/{ascensions,modifiers,badges}`에서 404 prefetch 없음.
  - QA: `tsx scripts/check-search-canonical.ts`, `tsx scripts/detail-shell-og.spec.ts`, `qa:cf:testbed`(Googlebot canonical, 셸 canonical 1개).
- 후속 수정(묶음 1 QA 2차): Cubot 휴대폰을 크롤러로 보지 않음(`a0e6c694`). 언어 메뉴·브라우저 언어 감지·저장된 언어가 게임 전용 로케일로 보낼 때, 없는 `/<로케일>/compendium/<type>/<id>` 상세 대신 그 목록의 모달 URL로 보냄(`b1df0d7b`, `2c1bb192`를 `fe059153`로 되돌림).
  - Expect: ja-JP 브라우저로 `/compendium/cards/bash`를 열면 `/ja/compendium/cards?card=bash`(404 없음, 모달 열림). `/compendium/enchantments/bound`는 `/ja/compendium/enchantments?enchantment=bound`로 가고 束縛 모달이 열림. 언어 메뉴의 게임 전용 언어 링크 12개가 모두 목록 모달 URL이고 `?version=`을 유지. Cubot UA에 ja-JP면 `/ja`로 전환, Googlebot·Yeti는 그대로.
  - QA: `tsx scripts/compendium-locale-detail-fallback.spec.ts`, `tsx scripts/check-search-canonical.ts`. 수동: 위 Expect.

### static-compendium-detail
- Feature: 백과사전 상세가 사실 항목·효과 텍스트·관련 링크·변경 이력을 서버 HTML로 먼저 내고 hydration한다. 상세 payload를 `/generated/compendium-data/<locale>/<resource>.json` 141개 chunk로 나눈다. 목록은 그리드용 행만 보내고 모달·호버·이력은 chunk에서 불러온다. 목록 끝에 전체 항목 링크 색인(크롤러·키보드용, 포커스가 닿기 전에는 보이지 않음). ko/en 정적 패치 페이지의 게임 요소 링크가 `/compendium/<type>/<id>`. 카드·유물·포션 상세의 캐릭터 항목이 캐릭터 페이지로 링크.
- Expect: 상세(ko/en, 모바일) 정적 화면에서 폰트 로드로 인한 레이아웃 이동 없음(CLS≈0). 정적 화면→상호작용 화면은 운영의 로딩 화면처럼 통째로 교체되지만 컨테이너 폭·뒤로가기 위치가 같음. 정적 라벨이 상호작용 화면 라벨과 같아 hydration 때 글자가 바뀌지 않음. chunk 실패 시 정적 본문 유지. 목록 호버 팁·모달·버전 선택 정상. 도감 몬스터의 문을 만드는 자·잠행 군체 타일이 chunk 도착 뒤 정상. 역사 강의서·커버 카드 정상.
- QA: `static:data`가 1.5 MB 미만 chunk 141개 기록, `cf:smoke --scope all`(`/generated/compendium-data/kor/cards.json`), `qa:cf:testbed` relic 모달. 수동: 위 Expect 항목.
- Commits: `3741dec8`(merge of claude/recursing-hopper-6b84b3: 33876a10..1fba341f). 충돌은 `patch-note-renderer.tsx` 한 곳, main의 `entityCompendiumHref()` 위에 상세 링크 변환을 얹음.
- 후속 수정(묶음 1 QA): 정적 상세 라벨을 상호작용 화면 라벨·게임 문자열과 맞춤(인챈트 카드 유형 한국어, 캐릭터가 아닌 분류는 '캐릭터' 항목에서 뺌, en 'Actions', 서사 텍스트에 '효과' 제목 없음)(`8b1c021c`, `76bebf90`, `a4851731`, `cf4b71db`, `c931a954`). 헤더 이미지 고정 96px 상자, 상호작용 화면과 같은 컨테이너(`f7b69ccb`, `60fabce9`). 목록 링크 색인 때문에 목록이 46px 스크롤되던 문제(`b864612d`). chunk 도착 전 몬스터·조우·키워드 모달은 '불러오는 중'(`379376c4`, `8fe92e68`). 영어 몬스터 행동의 '기절함'을 게임 문자열로(`1e5499d7`, `5b3453fc`).
  - Expect: 390px에서 정적 상세 가로 스크롤 없음. 목록 페이지 휠 스크롤 시 제목 줄이 가려지지 않음. 데이터 도착 전 몬스터 모달에 '검색 결과가 없습니다'가 뜨지 않음. `/en/compendium/monsters/ceremonial_beast` 행동에 '기절함' 없음.
  - QA: `qa:cf:testbed`, 수동: 위 Expect.
- 후속 수정(묶음 1 QA 2차): 정적 상세 관련 링크를 고정 열 그리드에 한 줄 이름으로 두고 키보드 초점 테두리 여유를 줌(`8bafe076`, `a4f91b6e`). 320px에서 긴 제목이 화면 안에 들어오고 375px 미만은 24px(`8d3855ba`, `917a0212`). 목록 모달 13종(카드·파워·유물·인챈트·고난·캐릭터·고대의 존재·시대·이벤트·포션·몬스터·조우·키워드)은 chunk가 오기 전 '불러오는 중' 대체 화면만 보이고, 온 뒤 전체 상세로 바뀜. 대체 화면의 뒤로가기·닫기 위치는 상세와 같고, chunk를 못 받으면 props로 상세를 그림(`c216eb6a`~`8a6db55f`, `f71ec4d1`). 대체 화면을 보인 모달은 레일 여백을 유지하고 스크롤 레일을 그리기 전에 측정(`6262341f`, `9849f89d`). 고대의 존재 대체 제목을 별칭 위에 두고 로딩 뒤 닫기 버튼에 초점(`12d7d183`, `42372d2d`). `?enchantment=<고난 id>`가 고난 모달을 염(`3d6ff8d0`).
  - Expect: 관련 링크 행에서 폰트 교체 CLS 0. 320px에서 정적 제목이 넘치지 않음. 데이터 도착 전 목록 모달은 뒤로가기·닫기·이름·불러오는 중만 보이고 잘못된 내용이 없으며, 도착 뒤 닫기 버튼이 0px 이동. 데이터를 못 받으면 상세가 props로 뜸(몬스터 행동은 운영처럼 '검색 결과가 없습니다'). 알려진 차이: 데이터 도착 전에 연 짧은 모달은 데스크톱에서 빈 레일 여백이 남아 운영보다 16.8px 왼쪽.
  - QA: 수동: 목록에서 `/generated/compendium-data/**`를 늦춘 채 모달을 열고 풀기. 320px 정적 상세. 정적 상세(JS 차단)에서 Tab으로 관련 링크 초점 테두리.

### rendering-fallbacks
- Feature: 게임 폰트(STS Spectral·Kreon·GC Batang)마다 치수를 맞춘 로컬 대체 폰트를 둬서 웹폰트가 늦게 와도 줄바꿈이 바뀌지 않는다. sine(물결) 텍스트가 띄어쓰기에서 줄바꿈된다. 모든 페이지와 patch Worker 페이지에 적용.
- Expect: 웹폰트 로드 전후 화면 위치가 같음(정적 상세 CLS 0.19→0.0003). 웹폰트 로드 뒤 화면은 이전과 같음. 좁은 화면에서 sine 인용문이 넘치지 않고, 넓은 화면의 sine 문구는 그대로.
- QA: 수동: 느린 네트워크에서 `/en/compendium/characters/ironclad`, `/compendium/powers/vulnerable`. 390px에서 `/compendium/events/dense_vegetation`, `/compendium/epochs/defect3_epoch`. 패치노트 sine 문구(버프/너프 라벨) 데스크톱 비교.
- Commits: `a87120bd`, `41e5bdb1`, `a123c155`

### css-build-guard
- Feature: Tailwind 자동 감지가 `.agents`·`.claude`·`docs`를 훑지 않게 해서 webpack 영속 캐시가 낡은 CSS를 되살리지 않게 한다. CI가 빌드 뒤 `pnpm css:check`로 빠진 클래스를 잡고, Next 캐시 키를 `next-v2-`로 바꿔 오염된 캐시를 버린다.
- Expect: 배포 CSS에 `columns-2`·`sm:columns-3`·`lg:columns-5`·`whitespace-pre-line`·`rich-sine-space`가 있음(`max-h-24`는 `f7b69ccb` 뒤로 쓰는 곳이 없어 빠지는 게 맞음). 첫 CI 빌드는 캐시 없이 돈다.
- QA: CI의 css:check 단계 통과. 로컬은 `rm -rf .next/cache/webpack` 뒤 빌드하고 `pnpm css:check`.
- Commits: `b5bb6e8a`, `bbf3c2a0`

<!--
### <항목-id>
- Feature:
- Expect:
- QA:
- Commits:
-->
