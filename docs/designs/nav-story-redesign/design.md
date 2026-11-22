# 상단바·메뉴·통합검색·슬서운 이야기 개편

*   **Author:** flavono123
*   **Status:** Approved (2026-11-22, 구현 전)
*   **Date:** 2026-11-22

--------------------------------------------------------------------------------

## Overview

상단바를 브랜드, 패치노트, 메뉴, 검색, 프로필 다섯 칸으로 줄인다. 나머지 서비스는 메뉴 패널 하나에 모은다. 메뉴 패널은 백과사전(슬더스2·슬더스1), 짜증나는 퍼즐상자(짜퍼), 장난감 상자를 한 줄씩 보여 준다. 줄마다 들어가는 만큼만 보이고, 나머지는 각 영역의 인덱스 페이지로 넘긴다.

짜퍼는 장난감 상자와 같은 높이의 게임 브랜드가 된다. `/vexing-puzzlebox`는 게임 모음 허브가 되고, 커넥션스와 베타 아트(퀴즈·감상·갤러리 포함)가 그 아래 게임이 된다. 앞으로 생길 게임(`docs/designs/vexing-puzzlebox-*`에 설계가 있는 lethal puzzle, sort puzzle, twenty questions 등)은 등록부 항목 하나와 게임 페이지만으로 메뉴, 인덱스, 검색에 나와야 한다.

통합검색은 정확히 같은 이름을 맨 위에 둔다. 서비스와 인덱스 페이지, STS1 요소도 찾는다.

슬서운 이야기 홈은 이야기가 참조하는 게임 요소의 그림으로 미리보기 릴과 목록을 보여 준다. 이야기 상세는 `/#id` 모달 대신 별도 경로가 된다.

시안: [mockup/home-first-screen.html](mockup/home-first-screen.html). 시안은 HTML 한 파일이라 `#/compendium` 같은 해시로 화면을 바꾼다. 실제로는 `/compendium`, `/vexing-puzzlebox`, `/toybox` 경로다.
근거 자료: [concepts_brief.md](concepts_brief.md), [usage_metrics.md](usage_metrics.md).

## The Problem

1. **상단바에 더 넣을 자리가 없다.** 지금 바는 10칸이다: 브랜드, 패치노트, 장난감 상자, dev, 검색, 언어, STS2 백과사전, STS1, 우편함, 프로필. 짜퍼에 게임을 계속 붙일 계획인데 놓을 곳이 없다. 짜퍼는 열린 지 30일 만에 장난감 상자 방문의 57%를 차지했다(page load 2,296, 플레이 659건, 73명).
2. **같은 장소 목록이 일곱 군데에 흩어져 있다.** 서비스 하나를 더하면 다음을 모두 손으로 고쳐야 한다:
   - 네비 항목(`src/lib/site-nav-items.ts`)
   - 새 글 표시(`src/lib/nav-seen.ts`)
   - 검색 서비스 항목(`src/lib/search-index-data.ts`)과 검색 종류(`src/lib/global-search.ts`)
   - 백과사전 인덱스(`src/app/(codex)/_codex/page.tsx`)
   - 짜퍼 탭(`vexing-puzzlebox-shell.tsx`)
   - Worker 라우트(`workers/static-page-routing.ts`)
   - 복사 스크립트(`scripts/copy-cf-static-pages.mjs`)

   패치 Worker는 상단바(`scripts/build-patch-worker.tsx`의 `StaticPatchHeader`)와 검색 순위(`patch-global-search-client.ts`)를 따로 복사해 쓰고 있고, 이미 서로 어긋났다.
3. **백과사전 인덱스에 들어갈 길이 없다.** STS2 `/compendium`은 있지만 상단바에서 링크하지 않는다. STS1 인덱스는 없다.
4. **검색에서 정확히 같은 이름이 밀린다.** 정확 일치와 앞부분 일치가 같은 점수(1700)다. 상위 40개를 자른 뒤 "패치 → 이야기 → …" 고정 순서로 묶어서 보여 준다. 그래서 맨 위는 점수가 아니라 묶음 순서가 정한다. 서비스는 일부만 검색되고(케미컬X, 코오오옴보, 조각모음, 변형 없음), STS1 요소는 아예 없다.
5. **홈의 이야기가 주소를 갖지 않는다.** 이야기는 `/#id` 모달이고, 해시는 처음 열 때 한 번만 읽는다. 뒤로 가기가 어색하고, 홈에 있을 때 검색으로 고른 이야기는 열리지 않을 수 있다. 홈은 30일 방문이 줄어든 유일한 영역이다(−43%). 이야기에는 그림이 없다.

## Goals

*   **상단바:** 처음부터 보이는 것은 브랜드, 패치노트, 메뉴, 검색, 프로필뿐이다.
    *   둥근 알약 테두리는 쓰지 않는다. 아이콘과 글자만 둔다.
    *   패치노트와 메뉴는 모든 화면 폭에서 글자 라벨을 항상 보인다(판단 2).
    *   언어 선택은 프로필 메뉴 안으로 옮긴다.
    *   우편함은 PC에서도 오른쪽 아래에 떠 있는 버튼이 된다.
*   **PC 마우스 동작(판단 1):**
    *   **패치노트:** 가리키면 패치노트, 니오우스레터, 슬서운변경 드롭다운이 열린다. 누르면 패치노트 목록(`/patches`)으로 바로 간다.
    *   **메뉴:** 가리키면 메뉴 패널이 열린다. 누르면 사이트 전체 목록 페이지로 간다. 이 페이지는 상세 글을 뺀 모든 목록·서비스 페이지를 보여 준다.
    *   **터치 기기:** 패치노트를 탭하면 `/patches`로 간다. 메뉴를 탭하면 패널이 열리고, 패널 안에 사이트 전체 목록 링크가 있다.
*   **메뉴 패널:** 영역마다 한 줄이다: 슬더스2 백과사전, 슬더스1 백과사전, 짜퍼, 장난감 상자.
    *   한 줄에 들어가는 만큼만 보이고, 나머지는 "+N 더보기"로 그 영역의 인덱스 페이지에 연결한다.
    *   보이는 순서: 새 기능 또는 새 글 → 그 브라우저의 방문 수 → 기본 순서. 접는 서비스(코오오옴보, 케미컬X)는 늘 맨 뒤다.
    *   **방문 수는 바로 반영한다(2026-11-22 작성자 결정).** 메뉴를 누르면 다른 페이지로 이동해서 패널이 닫히므로, 바뀐 순서는 다음에 패널을 열 때 보인다. 시안에서 어색했던 건 누른 뒤에도 패널이 그 자리에 남아 정렬이 클릭 반응처럼 보였기 때문이다.
        *   localStorage 키 하나에 항목별 방문 수를 쌓는다.
        *   서버, DB, 요청이 늘지 않고 코드는 열 줄 안팎이다. 처음 온 사람은 기본 순서를 본다.
    *   **표시:** 새 기능은 상단바 메뉴 버튼에서만 초록 점으로 보인다. 메뉴 패널과 인덱스 페이지의 각 항목에서는 "NEW" 글자로 보인다.
    *   소개 문구와 2단 제목은 쓰지 않는다.
*   **인덱스 페이지:**
    *   `/compendium`: 두 게임의 모든 요소 종류를 보여 준다.
    *   `/vexing-puzzlebox`: 게임 모음 허브다. 지금 같은 큰 배너는 두지 않고 다른 인덱스와 같은 제목 형식을 쓴다.
    *   `/toybox`: 새 페이지다. 접힌 서비스를 포함한 모든 서비스를 보여 준다. 조각모음 타일 안에는 조각모음이 모으는 모든 서비스(케미컬X, 코오오옴보 포함)의 토큰이 들어간다.
    *   사이트 전체 목록 페이지: 새 페이지다. 위 셋을 포함한다.
*   **인덱스 페이지 공통 형식:** 세 인덱스가 같은 규격을 쓴다.
    *   **제목 영역:**
        *   맨 위에 "← 홈" 뒤로 가기 링크를 둔다.
        *   그 아래 영역 토큰과 제목을 둔다. 제목 색은 사이트 텍스트 규칙을 따른다. 기본 강조는 gold(`.sts-text-gold`)다.
        *   제목 영역 뒤에는 그 영역의 아트를 은은하게 깐다. 흐린 정도는 지금 장난감 상자 서비스들이 쓰는 `ServiceBackground`(`src/components/service-background.tsx`)와 같다: 불투명도 30%, 채도 72%, 위아래·좌우 배경색 그라데이션. 백과사전과 장난감 상자도 영역 아트를 하나씩 고른다.
    *   **큰 타일(가로로 넓음):** 홈 미리보기 릴과 같은 구성이다. 왼쪽에 서비스 아트, 오른쪽에 토큰과 이름을 둔다. 조각모음은 큰 타일이고, 이름 아래에 하위 서비스 토큰을 둔다.
    *   **작은 타일:** 역사 강의서 표지(`src/components/history-course/history-course-cover.tsx`)와 비슷한 썸네일이다. 서비스 아트가 배경이고, 그 위에 토큰과 이름을 둔다.
    *   **아트는 서비스마다 하나씩 등록부에 둔다.** 이미 배경 아트가 있는 서비스는 그것을 쓴다: 짜퍼(`fake_merchant`), 조각모음, 서류 폭풍, 다채로운 철학자들, 어려운 결정, 이아저? 월드컵. 커넥션스와 베타 아트는 지금 시안의 카드 그림이 서비스 아트가 아니므로 새로 고른다. 백과사전 종류마다 쓸 아트도 고른다.
    *   **아트를 고르는 방법(2026-11-22 작성자 결정):** 아트가 없는 서비스(변형, 코오오옴보, 이거 아님 저거?, 역사 강의서, 케미컬X, 커넥션스, 베타 아트), 백과사전 종류 32개, 백과사전·장난감 상자 영역 아트마다 게임 애셋 후보를 몇 개씩 낸다. 그중 하나를 시안에 적용해 보고 작성자가 확정한다.
    *   **"NEW" 표시**는 타일 오른쪽 위에 글자로 둔다. 새 글 표시는 지금처럼 노란 점으로 둔다.
*   **장소 등록부 하나:** 데이터만 담는다. 두 상단바(main, 패치 Worker), 메뉴 패널, 인덱스 페이지, 검색의 서비스·인덱스 항목, 새 기능·새 글 표시가 모두 여기서 나온다. 짜퍼 게임 추가는 "등록부 항목 + 게임 페이지"로 끝난다.
*   **검색:**
    *   점수 순서: 정확히 같은 이름 > 앞부분 일치 > (최근 방문 가산) > 중간 일치 > 설명 일치.
    *   결과는 종류별 고정 순서가 아니라 점수 순이다.
    *   같은 이름이 있으면 STS2가 먼저다. STS1에만 있는 이름을 정확히 치면 그 STS1 항목이 맨 위다.
    *   main과 패치 Worker가 같은 순위 함수를 쓴다.
*   **이야기:**
    *   상세는 별도 경로(`/stories/<id>`)가 된다. 옛 `/#id` 링크는 이동 처리를 하지 않는다.
    *   이야기마다 공유 미리보기(OG: 제목, 설명, 그림)가 달린다. 정적 파일은 늘지 않는다.
    *   홈은 시안 A다. 그림이 있는 이야기를 넘기는 미리보기 릴이 있고, 그 아래 썸네일이 붙은 목록이 있다.
    *   그림은 이야기가 참조하는 게임 요소의 기존 그림만 쓴다. 참조 요소가 없으면 패치노트 기본 그림을 쓴다.
    *   이야기 줄에는 요소 종류·이름을 쓰지 않고 패치 버전만 둔다.

## Non-Goals

*   서비스 삭제. 접기만 한다.
*   사용자 이미지 업로드.
*   옛 주소 `/relics`, `/cards`, `/potions`와 옛 `/#id` 링크의 이동 처리.
*   어드민 메뉴 개편.
*   BM25와 의미 검색.
*   메뉴 클릭 기록과 개편 효과 측정. 공급자 주도 개편이다.
*   언어 선택의 별도 대책. OS·기기 언어에 맞춰 이미 내려 준다.
*   사이트 전체를 STS1/STS2로 바꾸는 토글.
*   홈 방문 감소 원인 분석.

## Open Questions

*   **사이트 전체 목록 페이지의 경로와 이름:** 후보는 `/menu`와 `/sitemap`이다. `/sitemap`은 검색엔진용 `sitemap.xml`(`src/app/sitemap.ts`)과 이름이 겹쳐 헷갈릴 수 있다.
*   **패치 페이지에서의 패치노트 드롭다운:** 작성자는 패치 페이지에서는 없어도 된다고 했다. 이 초안은 두 상단바가 같게 동작하도록 그대로 둔다. 패치 페이지 안에 이미 패치노트·니오우스레터·슬서운변경 탭이 있다면 빼도 잃는 것은 없다. 다만 바가 페이지마다 다르게 움직이게 된다.
*   **dev 메뉴의 자리:** 메뉴 패널의 마지막 줄로 옮길지, 프로필 메뉴로 옮길지.
*   **게임만 있는 언어(`/it` 등)에서 패널과 검색이 연결할 곳:** 이 언어들에는 백과사전 상세가 없다.
*   **최근 방문 기록의 범위:** 모든 페이지 방문을 기록할지, 메뉴·검색에서 고른 것만 기록할지. 메뉴 정렬과 검색 가산이 같은 기록을 쓴다.

## Critical User Journeys (CUJs)

### CUJ 1: 새 패치를 바로 읽기

*   **Given**: 어느 페이지에서든 상단바가 보인다.
*   **When**: 패치노트를 한 번 누르거나 탭한다.
*   **Then**: `/patches` 목록이 열린다. PC에서 패치노트를 가리키면 니오우스레터와 슬서운변경도 드롭다운으로 바로 고를 수 있다.

### CUJ 2: 휴대폰에서 백과사전 종류 찾기

*   **Given**: 375px 폭 휴대폰이고, 상단바에 "메뉴" 글자 라벨이 보인다.
*   **When**: 메뉴를 탭한다.
*   **Then**: 전체 화면 시트가 열리고 첫 줄이 슬더스2 백과사전이다. 자주 간 종류가 앞에 있고, "+N 더보기"를 누르면 `/compendium`에서 모든 종류를 본다. 닫기, 바깥 탭, 뒤로 가기로 시트가 닫힌다.

### CUJ 3: 새 짜퍼 게임이 사용자에게 보이기

*   **Given**: 개발자가 등록부에 새 게임 항목 하나를 넣고 게임 페이지를 만들었다. 항목에는 새 기능 표시가 있다.
*   **When**: 빌드하고 배포한다.
*   **Then**: 상단바 메뉴 버튼에 초록 점이 붙고, 새 게임이 메뉴 패널의 짜퍼 줄 맨 앞에 "NEW"와 함께 나온다. `/vexing-puzzlebox` 허브와 사이트 전체 목록에 나오고, 검색에서 이름으로 찾힌다. 다른 파일은 고치지 않는다.

### CUJ 4: 정확한 이름 검색

*   **Given**: 검색을 연다.
*   **When**: 카드 이름 "박살"을 정확히 친다.
*   **Then**: 슬더스2 카드 박살이 첫 결과다. 패치나 이야기가 위로 끼어들지 않는다. STS1에만 있는 이름을 치면 그 STS1 항목이 첫 결과다.

### CUJ 5: 이야기 열고 돌아오기

*   **Given**: 홈의 미리보기 릴이나 목록이 보인다.
*   **When**: 이야기를 누르고, 브라우저 뒤로 가기를 누른다.
*   **Then**: `/stories/<id>` 상세가 열리고, 뒤로 가기로 홈의 같은 위치로 돌아온다. 상세 주소를 공유하면 그 이야기가 바로 열린다.

## Technical Plan (Architecture)

### 0. 전체 그림

```text
                      ┌────────────────────────────┐
                      │  장소 등록부 (place registry) │  ← JSON (결정 A: A2)
                      │  서비스·게임·백과사전 종류·    │
                      │  경로, 토큰, 아트, 표시 규칙   │
                      └──────────────┬─────────────┘
        ┌──────────────┬─────────────┼───────────────┬──────────────────┐
        ▼              ▼             ▼               ▼                  ▼
  SiteTopBar      메뉴 패널        인덱스 페이지      검색 색인 빌드       정적 라우팅 목록
  (main: React,   (줄당 N개,      /compendium      (서비스·인덱스·      (Worker 정확 경로,
   패치 Worker:    NEW/노란 점,     /vexing-puzzlebox STS1 요소 항목)     복사 스크립트,
   renderToStatic  방문순)           /toybox /menu                       상세 셸 목록)
   Markup)
        │
        ▼
  top-bar-controller (순수 TS, 가리키기·탭·키보드·뒤로 가기)
   main: React effect에서 호출 / 패치 Worker: esbuild 클라이언트 번들에서 호출
```

### 1. 장소 등록부

**넣는 것:**
- 지금 `src/lib/site-nav-items.ts`의 `TOY_BOX_SERVICE_DEFINITIONS`, `sts2NavItems`, `sts1NavItems`.
- `src/lib/vexing-puzzlebox.ts`의 짜퍼 탭 상수.
- `src/app/(codex)/_codex/page.tsx`의 손으로 쓴 `categories`.

항목 하나는 다음 값을 가진다.

| 값 | 뜻 |
|---|---|
| `id` | 고정 키. 방문 수, 새 글 표시, 검색 항목의 키로 쓴다 |
| `area` | `sts2` · `sts1` · `zzapper` · `toybox` |
| `href` | 경로. 언어 접두어는 붙이지 않는다 |
| `label` | 사이트가 정한 이름은 언어별 맵(`{"ko": ..., "en": ...}`). 게임 공식 번역에서 빌린 이름(조각모음, 변형, 어려운 결정, 서류 폭풍, 짜증나는 퍼즐상자, 다채로운 철학자들)은 `{"game": "defragment"}`처럼 `src/generated/borrowed-game-copy.json`을 가리키는 참조. 게임 업데이트로 번역이 바뀌어도 등록부가 옛 이름으로 남지 않게 하려는 것 |
| `token` | 아이콘 경로 |
| `art` | 배경 아트 경로. 없으면 영역 아트 |
| `parent` | 조각모음 하위 같은 묶음. 지금 `nestedUnder` |
| `fold` | 늘 맨 뒤(코오오옴보, 케미컬X) |
| `newThrough` / `byrdispatchSectionTitle` | 새 기능 판정. 지금 `toyBoxServiceIsNew` 규칙 그대로 |
| `seenSurface` | 새 글 판정에 쓰는 `NAV_SEEN_SURFACES`의 키 |
| `kind` | `page`(정확 경로 하나) 또는 `game`(짜퍼 하위 게임) |

**등록부가 결정하는 것:**
- **정적 라우팅 목록:** `STATIC_EXACT_SERVICE_PAGES`(`workers/static-page-routing.ts:311`)와 `staticExactServicePages`(`scripts/copy-cf-static-pages.mjs:79`)가 등록부에서 나온다.
- **새 글 표면:** `NAV_SEEN_SURFACES`(`src/lib/nav-seen.ts:60`)는 그대로 두고, 등록부가 각 표면 키를 가리킨다. 새 글 판정 로직(`/api/read/nav` 스냅샷)은 바꾸지 않는다.
- **검색 서비스 항목:** `search-index-data.ts:462-539`의 손으로 쓴 서비스 항목을 지우고, 등록부를 돌며 만든다.

**등록부 형식: JSON (결정 A에서 작성자가 A2를 고름).** 맨 아래 "결정 A"를 본다.

### 2. 상단바: main과 패치 Worker가 같은 컴포넌트를 쓴다

**지금 상태:** 패치 Worker의 `StaticPatchHeader`(`scripts/build-patch-worker.tsx:365-493`)는 `renderToStaticMarkup`으로 `src/` 컴포넌트를 이미 그린다. 상호작용은 esbuild로 묶은 순수 클라이언트 번들(`patch-global-search-client.ts`, `patch-nav-indicators-client.ts`)이 맡는다. 다만 브랜드, 패치, 우편함, 프로필, 언어, 검색 트리거는 따로 복사해 쓰고 있다.

**바꾸는 것:**
- **`SiteTopBar`(새 컴포넌트):** 브랜드, 패치노트, 메뉴, 검색 트리거, 프로필을 그린다.
  - 훅 없이 props만 받는 표시용 컴포넌트다. 그래서 main(React)과 패치 Worker(`renderToStaticMarkup`) 양쪽에서 그대로 쓴다.
  - 패치노트 드롭다운과 메뉴 패널의 HTML도 여기서 같이 그린다. 처음에는 닫힌 상태다.
- **`top-bar-controller.ts`(새, 순수 TS, React 없음):** 동작만 붙인다.
  - **PC:** `(hover: hover) and (pointer: fine)`일 때 가리킨 뒤 약 150 ms에 열고, 떠난 뒤 약 300 ms에 닫는다. 누르면 링크의 기본 이동을 그대로 둔다.
  - **터치:** 메뉴 탭은 이동을 막고 전체 화면 시트를 연다. 연 순간 `history.pushState`로 기록을 하나 남겨, 뒤로 가기가 시트를 닫게 한다. 검색 오버레이와 같은 기록 한 칸을 함께 쓴다.
  - **키보드:** Enter는 이동이고, 아래 화살표는 열기, Esc는 닫기다. 포커스만으로는 열지 않는다.
  - **방문 수:** 아래 4절의 기록을 맡는다.
  - **연결:** main은 `SiteTopBar`를 감싼 작은 클라이언트 컴포넌트의 effect에서 컨트롤러를 붙인다. 패치 Worker는 새 번들 하나로 붙인다(`build-patch-worker.tsx`의 클라이언트 목록 :85-111에 추가).
- **패치노트 드롭다운:** 패치노트(`/patches`), 니오우스레터(`/patches/neowsletters`), 슬서운변경(`/patches/changes`). 누르면 `/patches`로 간다.
- **언어:** `LanguageDropdown`(`site-navbar.tsx:245-363`)의 목록을 프로필 팝오버 안으로 옮긴다. 패치 Worker의 `StaticLanguageDropdown`(:296)은 지운다.
- **우편함:** 떠 있는 버튼(`site-navbar.tsx:938-955`)에서 `xl:hidden`을 빼고, 데스크톱 링크(:907-918)를 지운다. 패치 Worker의 우편함 링크도 같은 버튼으로 바꾼다.
- **dev 메뉴:** 자리를 정할 때까지(Open Questions) 지금 dev 드롭다운을 상단바 끝에 그대로 둔다. dev 전용이라 운영 사용자에게는 보이지 않는다.
- **표시:**
  - 메뉴 버튼의 점은 지금 `NavAttentionDot`의 tone 규칙을 그대로 쓴다. 새 기능은 초록(`new-service`), 새 글은 노랑(`unread`)이다.
  - 패널과 인덱스 항목에서는 새 기능이 "NEW" 글자이고, 새 글은 노란 점 그대로다.
- **`no-script-site-header.tsx`:** 링크를 패치노트, 백과사전, 장난감 상자, 짜퍼, 메뉴 페이지로 바꾼다.

### 3. 메뉴 패널

- 줄 순서: 슬더스2 백과사전, 슬더스1 백과사전, 짜퍼, 장난감 상자. 줄 제목은 그 영역의 인덱스로 간다. 슬더스1은 `/compendium#sts1`이다.
- **한 줄에 넣는 개수:** 컨트롤러가 패널을 열 때 줄 너비를 재서 `floor(너비 / 항목 폭) − 1`개를 보인다. 남은 칸은 "+N 더보기"다. 휴대폰은 3개 + 더보기로 고정한다.
- **정렬:** `fold` 맨 뒤 → 새 기능·새 글 → 방문 수 → 등록부 순서. 패널을 열 때마다 저장된 수로 다시 정렬하고, 열려 있는 동안에는 순서를 바꾸지 않는다.
  - 정적 HTML에는 등록부 순서로 그려 두고, 패널을 처음 열 때 다시 정렬한다. 패널은 닫힌 채로 시작하므로 정렬 때문에 보이는 화면이 밀리지 않는다.
- **링크 미리 받기:** 패널 안 링크 40개 이상은 `prefetch={false}`로 둔다.

### 4. 방문 수 기록

- **키 하나(localStorage), 데이터 환경 접미어는 `nav-seen`과 같다:**
  - `sts-nav-visits:<env>` = `{ [id]: n }`
- **기록:** 페이지를 열 때 현재 경로가 등록부 항목의 `href`와 같거나 그 아래면 그 항목의 수를 1 올린다. 기록 범위는 Open Questions에 남아 있다. 이 계획은 모든 방문을 기록하는 쪽으로 쓴다.
- **실패 처리:** localStorage를 못 쓰면(사생활 모드 등) 기록하지 않고 등록부 순서를 쓴다.
- **비용:** 서버 요청, DB 쓰기, 정적 파일이 늘지 않는다.

### 5. 인덱스 페이지

| 경로 | 상태 | 내용 | 정적 파일 |
|---|---|---|---|
| `/compendium` | 고침 | 슬더스2 전체 종류 + 슬더스1 전체 종류(`#sts1`). `_codex/page.tsx`의 손으로 쓴 `categories`(:18-235)를 등록부로 바꿈. 카드 수 같은 손으로 적은 숫자는 뺌 | 0 (이미 있음) |
| `/vexing-puzzlebox` | 고침 | 커넥션스 화면에서 게임 모음 허브로 바뀜. 커넥션스는 `/vexing-puzzlebox/connections`로 옮김 | +28 (connections) |
| `/toybox` | 새로 | 장난감 상자 전체. 조각모음 큰 타일에 하위 서비스 토큰 전부 | +28 |
| `/menu` (가칭) | 새로 | 사이트 전체 목록. 위 셋 + 패치노트 3종 + 프로필·문의 | +28 |

- 슬더스1 전용 `/compendium/sts1` 인덱스는 만들지 않는다. `/compendium`에 두 게임을 함께 보이고, 메뉴의 슬더스1 줄은 `/compendium#sts1`로 간다. concepts brief의 "STS1 인덱스 페이지 추가"를 이렇게 바꾼다.
- **공통 컴포넌트:**
  - `IndexPageHeader`: "← 홈", 토큰, gold 제목을 그리고 배경에 `ServiceBackground`를 깐다.
  - `IndexTile`: 큰 타일은 아트 왼쪽, 토큰·이름 오른쪽이다. 작은 타일은 `HistoryCourseCover`처럼 아트 배경 위에 토큰·이름을 둔다.
- **커넥션스 경로 이동:**
  - 지금 `/vexing-puzzlebox`에 있는 커넥션스 화면을 `/vexing-puzzlebox/connections`로 옮긴다.
  - 커넥션스 플레이 기록(`puzzlebox_runs.game = 'connections'`)과 순위는 경로와 무관하므로 그대로다.
  - `/vexing-puzzlebox/beta-art`와 `/vexing-puzzlebox/rankings`는 그대로다.
  - 짜퍼 셸의 탭(`vexing-puzzlebox-shell.tsx:36-56`)은 등록부의 `zzapper` 영역에서 나온다.

### 6. 통합검색

- **점수**(`src/lib/global-search.ts:84-116`): 필드 점수를 단계로 나눈다.
  - 정확히 같음 4000, 앞부분 3000, 중간 2000, 단어 모두 포함 1000, 퍼지 0에 필드 가중치를 더한다.
  - 필드 가중치: 이름 300 > 영문 이름 250 > 종류 이름 100 > 설명·id 0.
  - 한 단계 위의 결과는 가중치와 상관없이 늘 위에 온다.
  - 같은 점수에서는 슬더스2 > 슬더스1이고, 그다음 최근 방문 가산(4절의 합, 최대 +200)이다.
- **보여 주기**(`site-navbar.tsx:639-707`, `patch-global-search-client.ts:64-87`):
  - 40개 자르기와 종류별 고정 묶음을 없앤다.
  - 점수 순 목록 하나로 보이고, 각 줄에 종류 칩을 붙인다.
  - 정렬·자르기를 `global-search.ts`의 `rankSearchResults(items, query, recent)` 하나로 모아 두 곳이 함께 쓴다.
- **색인에 더하는 것**(`src/lib/search-index-data.ts`):
  - 등록부의 서비스·게임·인덱스 페이지 항목(손으로 쓴 :462-539 대체).
  - 슬더스1 요소. 데이터는 `data/` STS1 JSON과 `_sts1` 로더에서 가져온다. 크기 증가는 구현 때 잰다.
  - 이야기 항목의 링크를 `/stories/<id>`로 바꾼다(:459).
- **감시 대상**(`scripts/ensure-search-index.mjs:11-18`): `data/stories.json`, `data/sts2-stories.json`, 슬더스1 데이터, 등록부를 더한다.
- **색인 로드 실패:** 지금처럼 "결과 없음"으로 삼키지 말고 실패 문구를 따로 보인다(`site-navbar.tsx:512-514`).

### 7. 이야기 상세 경로

- **경로 `/stories/<id>`:**
  - 정적 이야기는 slug(`sts2-doormaker-removed`)를 그대로 쓴다.
  - 사용자 이야기는 `community:` 접두어를 뗀 UUID를 쓴다. 둘 다 `RECORD_ID_PATTERN`(`static-page-routing.ts:213`)을 통과한다.
  - 댓글 스레드 키는 지금처럼 전체 id(`community:<uuid>` 또는 slug)로 만들어 댓글이 끊기지 않는다.
- **셸:** `history-course/[runId]`와 같은 방식이다.
  - `generateStaticParams`가 `__id__` 하나를 낸다. `StaticDetailShell idProp="storyId"`가 마지막 경로 조각을 읽는다.
  - Worker가 `/stories/*`를 셸로 다시 쓴다.
  - 추가 정적 파일은 28개다.
  - 목록에 `stories`를 더할 곳:
    - `STATIC_SERVICE_DETAIL_SEGMENTS`(`static-page-routing.ts:188`)
    - `staticServiceDetailSegments`(`copy-cf-static-pages.mjs:89`)
    - `detail-shell-og.ts:106`
    - `workers/path-redaction.ts:4`
    - `scripts/cloudflare-worker-logs.mjs:7`
- **읽기 API:** `GET /api/read/story?id=<slug|uuid>`를 새로 둔다(`workers/api/routes/stories.ts`).
  - UUID는 `community_stories.id`로, slug는 `static_story_id`로 찾는다.
  - slug이고 D1 행이 없으면 404를 돌려준다. 그러면 클라이언트는 번들된 정적 이야기를 쓴다.
  - D1 행이 정적 이야기를 덮어쓰는 지금 규칙(`use-community-stories.ts:97`)을 그대로 따른다.
  - 쓰기는 없다.
- **홈(`story-feed.tsx`):**
  - 해시 읽기·쓰기(:1052-1069)와 `StoryDetailModal`(:786, :1164)을 없앤다.
  - 줄과 릴 항목은 `/stories/<id>` 링크가 된다.
  - 모달 내용은 상세 페이지 컴포넌트로 옮긴다.
- **`/#id`를 만드는 곳을 모두 바꾼다:**
  - `search-index-data.ts:459`
  - `comment-threads.ts:219`
  - `admin-rls-activity.ts:96`
  - `profile-activity.tsx:102`
  - `patch-comments-client.js:1093-1097`

  옛 `/#id` 이동 처리는 하지 않는다(Non-Goals).
- **공유 미리보기(OG, 이번 범위, 2026-11-22 작성자 결정):** 이야기마다 제목·설명·그림 meta를 단다. 역사 강의서 상세와 같은 방식으로, Worker가 셸 HTML을 내보낼 때 그 이야기의 값을 채운다.
  - **어디서:** `detail-shell-og.ts`의 `fetchDetailShellOgData`(:279)에 `stories` 분기를 더한다. `maybeEnrichServiceDetailShell`(:573)의 캐시(1시간, 실패는 캐시하지 않음)를 그대로 쓴다.
  - **이야기 찾기:** UUID는 D1 `community_stories.id`, slug는 `static_story_id`로 찾는다. slug인데 D1 행이 없으면 Worker 번들에 넣은 정적 이야기(`data/sts2-stories.json`, `data/stories.json`)에서 찾는다. 번들에 넣으므로 정적 파일 수는 늘지 않는다.
  - **제목:** `sentence`를 기존 `truncateOgTitle`로 자르고 `- 슬서운 이야기`(영어 경로는 `- Scare the Spire`)를 붙인다.
  - **설명:** 연결된 요소 이름과 패치 버전. 없으면 홈 기본 설명.
  - **그림:** 8절과 같은 순서(`entity_type/entity_id` → `linkedEntities` 첫 항목 → 패치노트 기본 그림)로 고른다. 그림 주소는 `env.ASSETS`로 `element-art.json`을 읽어 찾는다.
  - **못 찾을 때:** 셸 기본 OG를 그대로 둔다(지금 다른 상세 셸과 같음).

### 8. 이야기 그림

- **빌드 시 만드는 파일 `public/generated/element-art.json`:** `{ "card:BREAK": "/images/sts2/cards/break.webp", … }` 꼴이다.
  - 슬더스2 요소 전체의 그림 주소를 담는다. 검색 색인 빌드가 이미 쓰는 `entitySearchImageUrl`(`search-index-data.ts:330`)을 재사용한다.
  - 사용자 이야기가 어느 요소든 참조할 수 있으므로 정적 이야기만이 아니라 전체를 담는다.
  - 크기는 약 1,900줄로, 압축 전 100 KB 안팎·gzip 20 KB 안팎으로 추정한다. 구현 때 잰다.
  - concepts brief의 "이야기가 참조하는 요소만 담는 작은 표"에서 바뀌었다. 이유는 사용자 이야기가 빌드 뒤에 생기기 때문이다.
- **그림 찾는 순서:** `entityType/entityId` → `linkedEntities` 첫 항목 → 패치노트 기본 그림. `patchLineId`로 요소를 찾는 단계는 패치 줄 데이터에 요소 참조가 있는지 구현 때 확인하고 넣는다.
- **불러오는 시점:** 홈은 처음 그릴 때 이 파일을 한 번 받는다. 받기 전에는 기본 그림을 보인다.
- **릴:** 그림이 있는 이야기 중 최신 4개를 고른다.
  - 슬라이드가 나올 때마다 애니메이션을 처음부터 다시 돈다.
  - 처음 약 1초는 확대·번쩍임으로 크게 움직이고, 그다음 노출 시간이 끝날 때까지 일정한 속도로 천천히 흐른다. 노출 시간이 끝나기 전에 움직임이 멈추지 않는다.
  - 동작 줄이기 설정에서는 자동으로 넘기지 않고 애니메이션도 끈다.

### 9. 정적 파일 예산

| 추가 | 파일 |
|---|---:|
| `/toybox` | 28 |
| `/menu` | 28 |
| `/vexing-puzzlebox/connections` | 28 |
| `/stories/__id__` 셸 | 28 |
| `element-art.json` | 1 |
| 합계 | 약 113 |

2026-11-20 `pnpm cf:limits` 기준 main은 16,464 / 19,500, 남은 수 3,036이다. 서비스 아트로 새 그림 파일을 더하지 않는다. 게임 애셋 중 이미 `public/`에 있는 것만 고른다.

### 결정 A: 등록부 형식 (작성자 결정: A2)

2026-11-22 작성자가 A2를 골랐다. 근거:
- 새 게임을 넣을 때 등록부 JSON 한 줄만 고친다.
- 라벨은 언어별 맵으로 적는다. 게임에서 빌린 이름만 참조로 적어서 A2 단점(간접 단계)이 그 몇 항목으로 줄어든다.
- 배포 절차가 그대로다. GHA 워크플로, `cf:build` 실행 명령, 빌드 순서를 바꾸지 않는다. 형식 검사는 해석기와 spec에서 돌아 오타가 있으면 배포 전에 빌드가 실패한다.
- 정적 파일 수와 CF 한도에는 영향이 없다. 파일 수는 경로 수로만 정해진다.

아래는 비교했던 세 안이다.

등록부는 TS 모듈(Next 페이지, Worker, 패치 빌드)과 `.mjs` 스크립트(`copy-cf-static-pages.mjs`) 양쪽에서 읽혀야 한다.

**A1. TS 모듈 + 일치 테스트**
- **방식:** `src/lib/place-registry.ts` 하나를 둔다. `copy-cf-static-pages.mjs`의 경로 목록은 지금처럼 따로 두고, spec이 두 목록이 등록부와 같은지 검사한다.
- **장점:** 라벨 함수(`getDefragmentNavTitle` 등)를 그대로 쓴다. 빌드 순서를 바꾸지 않는다.
- **단점:** 정확 경로를 새로 갖는 서비스나 게임을 넣을 때마다 `.mjs` 목록도 손으로 고쳐야 한다. "등록부 항목 하나"라는 목표를 테스트로만 지킨다.
- **이럴 때 실패한다:** 게임을 자주 넣을수록 손으로 고칠 곳이 남는다.

**A2. JSON 데이터 + TS 해석기**
- **방식:** `src/data/place-registry.json`에 경로, 토큰, 아트, 표시 규칙, 라벨(언어별 맵 또는 게임 번역 참조)을 둔다. TS는 import로, `.mjs`는 `readFileSync`로 읽는다. `src/lib/place-registry.ts`가 형식을 검사하고 게임 번역 참조를 실제 이름으로 바꾼다.
- **장점:** 진짜로 한 곳만 고친다. 빌드 순서를 바꾸지 않는다.
- **단점:** 라벨이 함수에서 키로 바뀌어 간접 단계가 하나 생긴다. JSON에는 주석과 타입이 없어서 해석기에서 형식을 검사해야 한다.
- **이럴 때 실패한다:** 라벨이 조건 분기(언어별 게임 문구 유무 등)를 많이 필요로 하면 키로 표현하기 어려워진다.

**A3. TS 모듈 + 복사 스크립트를 tsx로**
- **방식:** `src/lib/place-registry.ts` 하나를 두고, `copy-cf-static-pages.mjs`를 `.ts`로 바꿔 `tsx`로 실행한다(`package.json`의 `cf:build`, `cf:preview`).
- **장점:** 한 곳만 고치고, 라벨 함수와 타입을 그대로 쓴다.
- **단점:** 배포 빌드 단계 하나의 실행기가 바뀐다. 스크립트가 `@/` 별칭과 `src/lib`의 의존성을 끌고 온다.
- **이럴 때 실패한다:** `src/lib` 쪽 import가 Next 전용 모듈을 끌어오면 빌드 스크립트가 깨진다.

--------------------------------------------------------------------------------

## Alternatives Considered

**저활동 서비스 삭제**
- 장난감 상자에서 쓰이지 않는 서비스를 지운다.
- **안 고른 이유:** 작성자가 거절했다. 글과 댓글이 남아 있고, 숨기기만 해도 메뉴는 줄어든다. 코오오옴보와 케미컬X는 접어서 늘 맨 뒤에 둔다.

**패널 없이 지금 드롭다운만 줄이기**
- 상단바 칸 수만 줄이고 지금 드롭다운 구조를 유지한다.
- **안 고른 이유:** 짜퍼 하위 게임을 늘릴 자리가 바에 없다. 게임을 쉽게 넣고 보이게 하는 것이 이번 개편의 목적이다.

**검색에 BM25 쓰기**
- 문서 검색용 점수 공식을 쓴다.
- **안 고른 이유:**
  - 짧은 이름 수천 개는 브라우저가 1 ms 안에 다 훑는다.
  - 지금 증상(정확히 같은 이름이 밀림)은 점수 단계와 정렬만 고치면 사라진다.
  - BM25는 드문 단어와 짧은 문서를 우대해서, 오히려 패치 요약이 카드 이름보다 위로 올 수 있다.

**의미 검색(임베딩)**
- 뜻이 비슷한 말도 찾게 한다.
- **안 고른 이유:**
  - 항목당 384차원이면 약 3.8 MB를 더 받아야 한다.
  - Workers AI를 쓰면 검색마다 한도가 있는 요청이 하나 는다.
  - 별명이 필요하면 빌드 때 동의어 표로 넣는다.

**슬더스1 백과사전 인덱스를 따로 두기(`/compendium/sts1`)**
- 게임마다 인덱스 페이지를 하나씩 둔다.
- **안 고른 이유:** 2026-11-22 시안 피드백에서 `/compendium` 한 페이지에 두 게임의 종류를 모두 보이기로 했다. 따로 두면 정적 파일이 28개 더 들고, 상단바에서 들어갈 곳이 둘로 갈린다. 슬더스1은 `/compendium#sts1`로 바로 간다.

**짜퍼 루트를 커넥션스로 유지하기**
- `/vexing-puzzlebox`가 지금처럼 커넥션스 게임을 바로 연다.
- **안 고른 이유:** 작성자가 허브로 정했다. 게임이 늘어나면 루트가 한 게임을 차지할 수 없다. 커넥션스는 `/vexing-puzzlebox/connections`로 옮긴다(+28개).

**메뉴 클릭 기록**
- 어느 메뉴로 들어왔는지 서버에 남긴다.
- **안 고른 이유:** 작성자가 거절했다. 개편 효과를 재는 것보다 짜퍼 게임을 늘리는 것이 목적이다. 공급자 주도 개편이다.

**방문 수를 하루 단위로 정렬에 반영하기**
- 오늘 방문은 따로 쌓고, 정렬은 어제까지의 합으로만 한다.
- **안 고른 이유:** 작성자 결정(2026-11-22). 시안에서 어색했던 건 누른 뒤에도 패널이 남아 정렬이 클릭 반응처럼 보였기 때문이다. 실제로는 누르면 이동해서 패널이 닫히므로 바로 반영해도 순서가 눈앞에서 움직이지 않는다. 키도 하나로 줄어든다.

**"+N 더보기"를 그 자리에서 펼치기**
- 더보기를 누르면 패널 줄이 늘어나서 나머지를 보인다.
- **안 고른 이유:** 작성자 피드백. 펼친 뒤에도 더보기가 남는 모양이 어색하다. 더보기는 그 영역의 인덱스 페이지로 이동한다.

**이야기 상세를 해시 모달로 유지하기(`/#id`)**
- 지금 구조를 고쳐서 `hashchange`만 듣게 한다.
- **안 고른 이유:** 해시는 서버에 오지 않아서 이야기마다 공유 미리보기(OG)를 붙일 수 없다. 검색과 뒤로 가기도 홈의 모달 상태에 묶인다. 공유를 추적하지 않으므로 옛 `/#id` 링크는 깨져도 된다(작성자 답).

**이야기마다 정적 HTML을 미리 만들기**
- 검색엔진을 위해 `/stories/<id>`를 이야기 수만큼 빌드한다.
- **안 고른 이유:** 이야기 하나에 정적 파일 28개가 든다. 셸 하나(`__id__`)와 클라이언트 읽기로 두고, 이야기별 OG는 Worker가 셸에 채운다(역사 강의서 상세와 같은 방식). 지금도 개별 이야기는 사이트맵에 없고 `/#id`라 검색엔진에는 홈 한 페이지로만 보이므로, 이 방식이 지금보다 낫다.

**사용자가 이야기에 그림을 올리기**
- **안 고른 이유:** 작성자가 거절했다. 그림은 연결된 게임 요소의 아트에서 가져온다.

**사이트 전체 STS1/STS2 토글**
- **안 고른 이유:** 작성자가 거절했다. 같은 이름은 검색 점수에서 STS2를 먼저 두고, STS1에만 있는 이름을 정확히 치면 그 항목을 맨 위에 둔다.

**등록부를 TS로 두고 복사 스크립트 목록을 따로 두기(A1), 복사 스크립트를 tsx로 바꾸기(A3)**
- **안 고른 이유:** 작성자가 A2(JSON)를 골랐다. 비교는 Technical Plan의 "결정 A"에 있다.

## Detailed Implementation

작업은 아래 순서대로 한다. 단계마다 따로 배포해도 사이트가 깨지지 않는 순서다. 단계마다 speculative commit을 하고, 사용자에게 보이는 변경은 커밋 본문에 `Feature:` / `Expect:` / `QA:`를 적는다. 여러 커밋에 걸친 기능은 `docs/release/UNRELEASED.md`에 적는다. 새 경로를 더하는 단계는 착수 전에 `pnpm cf:limits`로 남은 정적 파일 수를 적는다.

**이 개편이 큰 리팩토링에 해당하는가:** 상단바(공유 렌더링), 경로 트리, 패치 Worker를 함께 건드리고 한 주 배포 주기보다 길다. CLAUDE.md 규칙에 따라 착수할 때 worktree 승인을 받는다.

### 단계 1. 검색 점수 공유 함수

| 파일 | 바꿈 | 이유 |
|---|---|---|
| `src/lib/global-search.ts` | 점수 단계(정확 4000, 앞부분 3000, 중간 2000, 단어 모두 1000, 퍼지 0)와 필드 가중치를 넣는다. `rankSearchResults(items, query, recent)`를 새로 내보낸다. 같은 점수면 STS2 → STS1 → 기존 종류 순서다 | 정확히 같은 이름이 앞부분 일치와 같은 점수(1700)라 밀리는 문제를 고친다 |
| `src/components/site-navbar.tsx` (`GlobalSearch` :639-707) | 자체 정렬·자르기·묶기를 지우고 `rankSearchResults`를 쓴다. 결과는 점수순 한 목록에 종류 칩을 단다. 색인 로드 실패 시 "검색 색인을 불러오지 못했어요" 문구를 보인다 | 묶음 순서가 맨 위를 정하는 문제를 없앤다. 실패가 "결과 없음"으로 삼켜지는 것을 고친다 |
| `src/components/patches/patch-global-search-client.ts` (`rankedResults` :64, `groupResults` :76) | 같은 함수로 바꾼다 | 패치 페이지 검색과 main 검색이 같은 결과를 내게 한다 |
| `scripts/global-search-ranking.spec.ts` (새) | 고정 질의 10개 정도로 순위를 검사한다(조사 붙은 한국어 이름, STS1·STS2 같은 이름, STS1에만 있는 이름의 정확 일치) | 점수 규칙이 다시 틀어지지 않게 한다 |

### 단계 2. 장소 등록부

| 파일 | 바꿈 | 이유 |
|---|---|---|
| `src/data/place-registry.json` (새) | 장소 항목 전체. 라벨은 언어별 맵 또는 `{"game": "<key>"}` | 결정 A(A2). 게임을 넣을 때 고칠 곳이 이 파일 하나다 |
| `src/lib/place-registry.ts` (새) | JSON을 읽어 형식을 검사한다(필수 값, `id` 중복, `area`·`kind` 값, `href` 모양, 아트·토큰 파일이 `public/`에 있는지는 spec에서). 게임 번역 참조를 `borrowed-game-copy`로 바꾼다. 영역별 목록, `toyBoxServiceIsNew` 규칙의 새 기능 판정을 내보낸다 | 타입이 없는 JSON의 오타를 빌드 전에 잡는다 |
| `src/lib/site-nav-items.ts` | `TOY_BOX_SERVICE_DEFINITIONS`(:94-175), `sts2NavItems`(:176), `sts1NavItems`(:197)를 등록부에서 만든다. dev 항목은 그대로 둔다 | 같은 정보를 두 번 적지 않는다 |
| `src/components/vexing-puzzlebox/vexing-puzzlebox-shell.tsx` (:36-56) | 탭을 등록부 `zzapper` 영역에서 만든다 | 게임을 넣으면 탭이 저절로 생긴다 |
| `src/app/(codex)/_codex/page.tsx` (:18-235) | 손으로 쓴 `categories`를 등록부에서 만든다 | 백과사전 종류도 한 곳에서 관리한다 |
| `workers/static-page-routing.ts` (`STATIC_EXACT_SERVICE_PAGES` :311-317) | 등록부 JSON에서 만든다 | Worker 정확 경로를 손으로 고치지 않는다 |
| `scripts/copy-cf-static-pages.mjs` (:79-85) | `readFileSync`로 등록부 JSON을 읽어 `staticExactServicePages`를 만든다 | A2로 고른 이유. 실행 명령은 그대로다 |
| `src/lib/search-index-data.ts` (서비스 :462-539) | 손으로 쓴 서비스 항목을 지우고 등록부를 돌며 서비스·인덱스 항목을 만든다. STS1 카드·유물·포션·파워·몬스터·이벤트 항목을 더한다 | 검색이 메뉴·인덱스·STS1을 찾게 한다 |
| `scripts/ensure-search-index.mjs` (:11-18) | 감시 대상에 `src/data/place-registry.json`, `data/sts2-stories.json`, `data/stories.json`, STS1 데이터를 더한다 | 이들이 바뀌어도 색인이 다시 만들어지게 한다 |
| `scripts/place-registry.spec.ts` (새) | 형식 검사, 모든 토큰·아트 파일이 `public/`에 있는지, 모든 `href`가 Next 경로에 있는지 | 등록부 한 줄 실수로 메뉴가 깨지는 것을 막는다 |
| `scripts/toybox-nav.spec.ts`, `scripts/sts1-nav.spec.ts`, `scripts/worker-routing.spec.ts`, `scripts/next-routing-parity.spec.ts` | 등록부 기준으로 기대값을 맞춘다 | 기존 동작이 그대로인지 확인한다 |

### 단계 3. 인덱스 페이지와 짜퍼 허브

| 파일 | 바꿈 | 이유 |
|---|---|---|
| `src/components/index-page-header.tsx` (새) | "← 홈", 토큰, gold 제목, `ServiceBackground` 배경 | 인덱스 세 곳의 머리를 같게 한다 |
| `src/components/index-tile.tsx` (새) | 큰 타일(아트 왼쪽, 토큰·이름 오른쪽, 하위 토큰 줄)과 작은 타일(아트 배경 위 토큰·이름). 새 기능은 "NEW", 새 글은 노란 점 | 인덱스와 짜퍼 허브가 같은 타일을 쓴다 |
| `src/app/(codex)/_codex/page.tsx`, `src/app/(codex)/compendium/page.tsx`, `src/app/[gameLocale]/compendium/page.tsx` | 슬더스2·슬더스1 두 구역. 슬더스1 구역에 `id="sts1"`. 손으로 적은 숫자는 뺀다 | `/compendium` 하나에 두 게임 |
| `src/app/vexing-puzzlebox/page.tsx`, `page-content.tsx`, `src/app/[gameLocale]/vexing-puzzlebox/page.tsx` | 게임 모음 허브로 바꾼다(배너 없음, 영역 아트 은은하게) | 작성자 결정: 짜퍼 루트는 허브 |
| `src/app/vexing-puzzlebox/connections/page.tsx`, `page-content.tsx`, `src/app/[gameLocale]/vexing-puzzlebox/connections/page.tsx` (새) | 지금 루트의 커넥션스 화면을 옮긴다 | 정적 파일 +28 |
| `src/app/toybox/page.tsx`, `src/app/[gameLocale]/toybox/page.tsx` (새) | 장난감 상자 전체. 조각모음 큰 타일에 하위 서비스 토큰 전부(케미컬X, 코오오옴보 포함) | 정적 파일 +28 |
| `src/app/menu/page.tsx`, `src/app/[gameLocale]/menu/page.tsx` (새) | 사이트 전체 목록. 경로 이름은 Open Questions에서 정한다 | 정적 파일 +28. 자바스크립트 없는 화면의 메뉴 대신이다 |
| `src/messages/service.ts` | 인덱스 제목, "← 홈", "+N 더보기", "NEW" 문구 | 서비스 UI 문구는 한국어 우선, 영어 2순위 |
| `src/app/sitemap.ts` | `/toybox`, `/menu`, `/vexing-puzzlebox/connections`를 더한다 | 새 공개 페이지 |

### 단계 4. 이야기 상세 경로와 OG

| 파일 | 바꿈 | 이유 |
|---|---|---|
| `src/app/stories/[storyId]/page.tsx`, `src/app/[gameLocale]/stories/[storyId]/page.tsx` (새) | `generateStaticParams`가 `__id__` 하나를 낸다. `StaticDetailShell idProp="storyId"` | 역사 강의서 상세와 같은 셸. 정적 파일 +28 |
| `src/components/story-detail.tsx` (새) | `story-feed.tsx`의 모달 내용을 옮긴 상세 화면. 댓글 스레드 키는 전체 id 그대로 | 상세가 모달이 아니라 페이지가 된다 |
| `src/components/story-feed.tsx` | 해시 읽기·쓰기(:1052-1069)와 `StoryDetailModal`(:786, :1164)을 지운다. 줄은 `/stories/<id>` 링크 | `/#id`를 없앤다 |
| `workers/api/routes/stories.ts` | `GET /api/read/story?id=` 추가. UUID는 `community_stories.id`, slug는 `static_story_id`. slug에 행이 없으면 404 | 상세 화면 한 건 읽기 |
| `src/hooks/use-community-stories.ts` | 한 건 읽기 함수. 덮어쓰기 규칙(:97)은 그대로 | 홈과 상세가 같은 규칙을 쓴다 |
| `workers/static-page-routing.ts` (:188), `scripts/copy-cf-static-pages.mjs` (:89), `workers/detail-shell-og.ts` (:106), `workers/path-redaction.ts` (:4), `scripts/cloudflare-worker-logs.mjs` (:7) | 상세 셸 목록에 `stories`를 더한다 | 셸 다시 쓰기, 복사, OG, 로그 가리기가 새 경로를 안다 |
| `workers/detail-shell-og.ts` (`fetchDetailShellOgData` :279) | `stories` 분기. D1 → 번들 정적 이야기 → 없으면 기본 OG. 그림은 `env.ASSETS`로 `element-art.json` | 이야기마다 제목·설명·그림 meta (작성자 결정) |
| `src/lib/search-index-data.ts` (:459), `src/lib/comment-threads.ts` (:219), `src/lib/admin-rls-activity.ts` (:96), `src/components/profile-activity.tsx` (:102), `src/components/patches/patch-comments-client.js` (:1093-1097) | `/#id` 대신 `/stories/<id>` | 이야기로 가는 모든 링크를 새 경로로 바꾼다 |
| `scripts/comment-threads.spec.ts`, `scripts/admin-rls-activity.spec.ts`, `scripts/detail-shell-og.spec.ts`, `scripts/worker-routing.spec.ts` | 새 경로와 OG 기대값 | 링크와 OG를 확인한다 |

### 단계 5. 상단바, 메뉴 패널, 방문 수

| 파일 | 바꿈 | 이유 |
|---|---|---|
| `src/components/site-top-bar.tsx` (새) | 훅 없는 표시 컴포넌트. 브랜드, 패치노트(+드롭다운), 메뉴(+패널), 검색 트리거, 프로필(+언어) | main과 패치 Worker가 같은 HTML을 쓴다 |
| `src/lib/top-bar-controller.ts` (새) | 가리키기 150/300 ms, 터치 시트 + `pushState`, 키보드, 패널 줄 개수 재기, 방문 수 기록, 열 때 정렬 | React 없이 양쪽에서 같은 동작 |
| `src/lib/nav-visits.ts` (새) | localStorage 키 `sts-nav-visits:<env>` 읽기·쓰기, 실패 시 빈 값 | 정렬과 검색 최근 방문 가산(+200까지)이 같이 쓴다 |
| `src/components/site-navbar.tsx` | 바 부분을 `SiteTopBar` + 컨트롤러 연결로 바꾼다. `LanguageDropdown`(:245-363)은 프로필 팝오버 안으로. 데스크톱 우편함 링크(:907-918)를 지우고 떠 있는 우편함(:938-955)의 `xl:hidden`을 뺀다 | 바 칸 수를 줄이고 우편함을 PC에서도 아래에 둔다 |
| `scripts/build-patch-worker.tsx` (`StaticPatchHeader` :365-493, 클라이언트 :85-111) | `SiteTopBar`를 그리고 컨트롤러 번들을 더한다. `StaticLanguageDropdown`(:296)을 지운다 | 패치 페이지 상단바도 같아진다 |
| `src/components/patches/patch-nav-indicators-client.ts` | 점 표시를 메뉴 버튼 하나로 모은다 | 상단바 점은 메뉴 버튼에만 |
| `src/components/no-script-site-header.tsx` | 링크를 패치노트, 백과사전, 장난감 상자, 짜퍼, 메뉴 페이지로 | 자바스크립트 없는 화면 |
| `src/components/encyclopedia-dropdown.tsx` | 지운다 | 아무도 import하지 않는 죽은 코드 |
| `scripts/nav-seen.spec.ts`, `scripts/nav-visits.spec.ts` (새), `scripts/top-bar-controller.spec.ts` (새) | 정렬 순서(접힘 → 새 기능·새 글 → 방문 → 등록부), 열려 있는 동안 순서 고정, localStorage 실패 시 등록부 순서 | 정렬 규칙 확인 |

### 단계 6. 이야기 그림과 미리보기 릴

| 파일 | 바꿈 | 이유 |
|---|---|---|
| `scripts/build-element-art.ts` (새) 또는 검색 색인 빌드 안 | `public/generated/element-art.json` 생성. `entitySearchImageUrl`(`search-index-data.ts:330`) 재사용 | 사용자 이야기가 빌드 뒤에 생겨도 그림을 찾는다. 정적 파일 +1 |
| `src/lib/story-art.ts` (새) | 그림 찾는 순서(요소 → 연결 목록 첫 항목 → 패치노트 기본 그림) | 홈, 상세, Worker OG가 같은 규칙 |
| `src/components/story-reel.tsx` (새) | 최신 그림 있는 이야기 4개. 슬라이드마다 애니메이션 재시작, 처음 약 1초 확대·번쩍임 뒤 노출 끝까지 일정 속도로 흐름. 동작 줄이기에서는 자동 넘김과 애니메이션 끔 | 홈 시안 A |
| `src/components/story-feed.tsx` | 릴과 썸네일 목록. 줄에서 요소 종류·이름을 빼고 패치 버전만 | 시안 피드백 |

### 아트 후보 (작성자 확정 필요)

규칙: 이미 `public/`에 있는 게임 그림만 쓴다(정적 파일이 늘지 않는다). 후보마다 하나를 시안에 적용해 본 뒤 작성자가 고른다. 첫 번째가 추천이다.

| 대상 | 후보 1 (추천) | 후보 2 | 후보 3 |
|---|---|---|---|
| 변형 | `cards/transfigure.webp` (같은 이름 카드) | `events/morphic_grove.webp` | `events/spirit_grafter.webp` |
| 코오오옴보 | `badges/ccccombo.webp` (같은 이름 배지) | `events/punch_off.webp` | `events/battleworn_dummy.webp` |
| 이거 아님 저거? | `events/this_or_that.webp` (같은 이름 이벤트) | `events/doors_of_light_and_dark.webp` | `events/reflections.webp` |
| 역사 강의서 | `relics/history_course.webp` (같은 이름 유물) | `events/war_historian_repy.webp` | `events/waterlogged_scriptorium.webp` |
| 케미컬X | `relics/chemical_x.webp` (같은 이름 유물) | `events/the_future_of_potions.webp` | `events/amalgamator.webp` |
| 커넥션스 | `events/tablet_of_truth.webp` | `events/crystal_sphere.webp` | `events/endless_conveyor.webp` |
| 베타 아트 | `events/museum_of_torture.webp` | `events/wood_carvings.webp` | `events/reflections.webp` |
| 백과사전 영역 | `events/waterlogged_scriptorium.webp` | `events/sunken_treasury.webp` | `events/the_legends_were_true.webp` |
| 장난감 상자 영역 | `events/tinker_time.webp` | `events/room_full_of_cheese.webp` | `events/welcome_to_wongos.webp` |

- 유물·배지 그림은 작은 아이콘이라 큰 타일 아트로는 해상도가 모자랄 수 있다. 시안에서 흐려 보이면 이벤트 그림 후보로 바꾼다.
- **백과사전 종류 32개:** 종류마다 그 종류의 대표 요소 그림을 쓴다(카드 → 카드 그림 하나, 몬스터 → 몬스터 그림 하나). 후보 3개씩은 단계 3 착수 때 dev 화면에 한 장으로 모아 보여 주고 작성자가 고른다. 이 문서에는 규칙만 적는다.

## 판단 기록 (작성자 요청으로 이 초안에서 판단함)

### 판단 1: PC에서 가리키면 열리고, 누르면 이동하는 동작

**채택한다. 단, 아래 조건이 모두 갖춰질 때만이다.**

이 방식의 약점부터 적는다.

- **터치에는 가리키기가 없다.** 한 버튼이 PC와 휴대폰에서 다르게 동작한다. PC에서 메뉴를 누르면 사이트 전체 목록 페이지로 가지만, 휴대폰에서 탭하면 패널이 열린다. 휴대폰 사용자가 사이트 전체 목록 페이지에 가려면 패널 안의 링크가 따로 필요하다.
- **스쳐 지나갈 때 열린다.** 브랜드에서 검색창으로 커서를 옮기다 패치노트나 메뉴를 지나치면 드롭다운이 깜박인다.
  - 열기 전 약 150 ms, 닫기 전 약 300 ms를 기다린다.
  - 패널이 버튼 바로 아래 붙어 있어 커서가 내려가는 길에 빈틈이 없어야 한다.
- **빨리 누르면 패널을 못 본다.** 가리킨 뒤 기다리는 시간보다 먼저 누르면 패널을 보지 못하고 바로 이동한다. 메뉴는 사이트 전체 목록 페이지로 가므로 잃는 것은 없다. 패치노트는 가장 많이 찾는 목적지로 바로 가는 것이라 오히려 원하는 결과다.
- **키보드:** Enter는 이동이다. 패널과 드롭다운은 아래 화살표 키나 별도 펼침 버튼으로 연다. 포커스만으로는 열지 않는다. 포커스로 열면 Tab으로 바를 지나갈 때마다 패널이 뜬다.
- **두 상단바:** main과 패치 Worker 상단바에 같은 동작을 두 번 구현해야 한다. 그래서 등록부와 함께 바 컴포넌트도 공유해야 한다(Technical Plan에서 다룸).

**그래도 채택하는 이유:**
- 누르기의 결과는 지금과 같다. 패치노트는 목록으로 바로 가고, 메뉴는 전체 목록으로 간다.
- 가리키기는 덤이다. 사람들이 가리키기를 모르고 누르기만 해도 손해가 없다. 원클릭 목표를 해치지 않는다.
- "두 동작을 다 알아챌까"에 대한 답도 같다. 몰라도 되게 만든다. 가리키기로만 갈 수 있는 곳이 없어야 하고, 드롭다운의 모든 항목은 누른 뒤 도착한 페이지에서도 갈 수 있어야 한다.

**버린 것:** 메뉴를 누르면 패널만 여닫는 방식(시안 1·2차). 이 방식은 PC에서 사이트 전체 목록으로 가는 길이 하나 더 필요하고, 가리키기 패널과 겹친다.

### 판단 2: 상단바 라벨

**글자 라벨을 늘 보인다.** 작성자가 낸 두 방식, 즉 툴팁과 "가리키면 라벨 글자가 애니메이션으로 나타나는 방식"은 둘 다 쓰지 않는다. 아래의 "펼쳐지는 라벨"은 두 번째 방식을 가리킨다.

- **툴팁의 문제:** 가리키기에만 보이므로 휴대폰에서는 보이지 않는다. 처음 온 사람은 아이콘 뜻을 짐작해야 한다. 지금 사이트가 이 상태다.
- **가리키면 펼쳐지는 라벨의 문제:**
  - 툴팁과 같은 문제가 있다. 휴대폰에서는 안 보인다.
  - 라벨이 펼쳐지면서 옆 버튼들이 밀린다. 판단 1의 가리키기 패널과 함께 쓰면, 커서 아래 버튼이 움직여서 패널 대상이 바뀌거나 깜박인다.
  - 애니메이션 비용에 비해 얻는 것이 없다.
- **늘 보이는 라벨은 자리가 된다.** 바에 남는 칸이 둘(패치노트, 메뉴)뿐이라 375px 휴대폰에서도 들어간다. 대략 계산하면 바깥 여백 24 + 브랜드 아이콘 24 + "패치노트" 약 88 + "메뉴" 약 56 + 검색 아이콘 34 + 프로필 30 + 간격 48 = 약 304px로, 375px 안이다. 휴대폰에서는 브랜드 글자 "슬서운 이야기"만 숨긴다.
- **반론:** 라벨이 늘 보이면 바가 덜 깔끔하다. 하지만 둥근 테두리 없이 아이콘 + 글자만 두면 지금 시안의 PC 화면과 같다. 작성자가 싫어한 것은 테두리지 글자가 아니다.

--------------------------------------------------------------------------------

*Drafted with EGM*
