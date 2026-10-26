# 미배포 기능 대장

마지막 정기 배포 이후의 기능 기대치와 열린 worktree를 기록한다.
작성·관리 규칙: [../RELEASE_PROCESS.md](../RELEASE_PROCESS.md).

기준점: 마지막 성공 프로덕션 실행 `1ebb819f`(2026-10-17). 범위는 `1ebb819f..main`.

## 열린 worktree

| 이름 | 브랜치 | 목적 | 상태 |
|---|---|---|---|
| domain-migration-c54d7b | claude/domain-migration-c54d7b | 도메인 이전(레거시 호스트 안내, 리다이렉트, robots/sitemap) | 11커밋, main보다 122 뒤처짐. 2026-10-26 배포에서 제외 |
| recursing-hopper-6b84b3 (경로 shorts-capture-power-epoch-c9df8d) | claude/recursing-hopper-6b84b3 | 정적 백과사전 상세·목록 서버 렌더와 청크 분할 | 8커밋, main보다 122 뒤처짐. 2026-10-26 배포에서 제외 |
| wizardly-brattain-bb7f93 | claude/wizardly-brattain-bb7f93 | ko/en canonical·hreflang 정책과 정적 오류 셸 현지화 | 6커밋, main보다 122 뒤처짐. 2026-10-26 배포에서 제외 |

## 긴급 배포로 QA 없이 나간 범위

## 기능 기대치

### card-render-card-tscn
- Feature: STS2 카드(그림·테두리·유형 표식·제목·배너·설명)와 고대의 존재 카드를 card.tscn 기준 배치로, STS1 카드를 AbstractCard 기준 배치로 다시 그림. 패치노트 카드 미리보기도 같은 설명 맞춤을 씀.
- Expect: 카드 설명이 라벨 박스 안에 들어가고 제목이 박스 안에서 줄어들며, 유형 표식이 카드 폭에 맞춰 늘어난다. 고대의 존재 카드는 틀·리본·글자가 깨지지 않는다. STS1 카드는 설명 줄이 가운데 정렬이고 제목이 잘리지 않는다.
- QA: /compendium/cards(STS2·STS1), 고대의 존재 카드 상세, /patches 최신 패치노트의 카드 미리보기. 한국어·영어, 데스크톱·모바일
- Commits: ee15e6bd e00ea086 5c3c1030 bb8712c8 fab78bbc 5bc660ab

### version-text-history
- Feature: 이전 버전을 고르면 언어별로 그 버전의 게임 텍스트를 보여 주고, v0.104.0 이전에 해당 언어 텍스트가 없으면 표시한다. 몬스터(잠행 군체, 문을 만드는 자 등) 버전별 변경 이력과 행동별 정지 그림을 추가한다.
- Expect: 버전 선택기에서 v0.104.0 이전을 고르면 안내가 뜨고 해당 카드에 모서리 표식이 보인다. 잠행 군체·문을 만드는 자 상세에서 버전별 변경과 행동 그림이 보인다.
- QA: /compendium/cards, /compendium/monsters(잠행 군체·문을 만드는 자), 한국어·영어
- Commits: 9eb10237 98f7141b 993ec8ed 2c018882 0a908bf0 51eb583d 0d5abe61

### editor-links-and-popup
- Feature: 편집기에서 링크 클릭이 바로 이동하지 않고 말풍선으로 새 탭 열기를 제공, 사이트 안 링크는 aqua·바깥 링크는 blue, 추천 목록이 키보드를 피함, 서류 폭풍 커스텀 키워드 `표시{키워드}` 유지.
- Expect: 서류 폭풍·댓글 편집기에서 링크를 누르면 커서만 놓이고 말풍선에 새 탭 열기가 뜬다. 수정키+클릭은 바로 열린다. `크크루빙봉{빙봉}`을 치면 앞의 글이 남는다.
- QA: /toybox 서류 폭풍 편집기, 댓글 편집기, /dev/editors, 모바일 폭
- Commits: 7d9723dc 2c759a16 15765a6e e59445f0 0088ef17 70075b1f

### combo-dcinside-link
- Feature: 코오오옴보에서 디시인사이드 링크를 붙여 넣으면 제목이 표시되고, 유튜브 링크는 oEmbed로 제목·썸네일을 받는다.
- Expect: 붙여 넣은 링크가 로딩 후 글 제목으로 바뀐다. 유튜브 링크가 제목과 썸네일을 갖는다.
- QA: /combo 편집기와 뷰어, 로컬 링크 미리보기 API
- Commits: 357012b2 cd606bcc e4bfe260

### toybox-menu-markers
- Feature: 장난감 상자 메뉴를 압축하고, 서비스 목록만 열어도 새 글 점이 지워짐. 다채로운 철학자들의 다음 주 토론 슬롯이 비면 개발 메뉴에 표시.
- Expect: 서비스 인덱스를 열면 해당 서비스 점이 사라지고 패치노트·니오우스레터 점은 글을 읽어야 사라진다.
- QA: 장난감 상자 드롭다운, 패치 내비
- Commits: ee653d59 faa73d97 6fb288f1 f0d8af36

### byrdispatch-2026-10-26
- Feature: 2026-10-26 섀소식(한/영) 게시.
- Expect: /byrdispatch와 /en/byrdispatch 맨 위가 2026-10-26이고, aqua·blue 태그가 렌더되며 백과사전 항목 아래 하위 불릿 2개가 보인다.
- QA: /byrdispatch, /en/byrdispatch, 데스크톱·모바일
- Commits: d34aead8
