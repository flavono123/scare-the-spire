# 미배포 기능 대장

마지막 정기 배포 이후의 기능 기대치와 열린 worktree를 기록한다.
작성·관리 규칙: [../RELEASE_PROCESS.md](../RELEASE_PROCESS.md).

## 열린 worktree

| 이름 | 브랜치 | 목적 | 상태 |
|---|---|---|---|

## Supabase 마이그레이션

| 파일 | Rollout | Order | 적용 | 확인 |
|---|---|---|---|---|

## 긴급 배포로 QA 없이 나간 범위

## 기능 기대치

### editor-input-unification
- Feature: Shared editor behavior across comments, Chemical X, C-C-C-Combo, Defragment, Transfigure and Pagestorm: one suggestion popup, two-step links, unified link colors, Pagestorm display{keyword}, Pagestorm external link titles, compact Toy Box menu, grid dev menu, /dev/editors.
- Expect:
  - Phone: typing `{타격` (or `/`, `#` in their services) opens the menu next to the caret, above the keyboard when there is no room below; tapping a row inserts it with the keyboard still up and the page not jumping.
  - Pagestorm: `강펀치{타격}` and `강펀치{타격` + `}` both leave "강펀치" as the mention text.
  - In editors, clicking a link, keyword or mention never navigates. It shows a bubble (or the Pagestorm link sheet) with "새 탭에서 열기"; ⌘/Ctrl+click opens a new tab. Pagestorm no longer opens a tab on every external link click, and the leave dialog does not appear for these.
  - In-site links are aqua and off-site links blue in viewers and editors alike, including the C-C-C-Combo YouTube chip, Chemical X YouTube links and patch-note links.
  - Pagestorm: pasting a URL becomes a link labelled with the page's Open Graph title (game names inside it stay plain text); typing right after does not extend the link; hovering shows the Open Graph card while editing too.
  - Toy Box menu has no section title and codex-menu density; dev menu lays groups out in columns (phone: full-width sheet).
  - /dev/editors lists every editor (also in the dev menu).
- QA: /pagestorm/write, /chemical-x, /c-c-c-combo, a compendium card page comment box, /patches/<latest>, /byrdispatch, /dev/editors; ko; desktop and phone (iPhone viewport).
- Commits: ee653d59, faa73d97, e59445f0, 15765a6e, 2c759a16, 7d9723dc, e4bfe260, 59a384d8

### combo-titled-links
- Feature: C-C-C-Combo titles pasted DC Inside links, previews off-site links with their Open Graph card, and the dev editor page opens on full-feature samples.
- Expect:
  - Pasting a DC Inside post URL in the combo editor shows "링크 제목을 불러오는 중", then the post title as a blue link chip; the post saves and renders it as a link opening in a new tab.
  - Older combo posts with a bare DC Inside URL in text (e.g. /c-c-c-combo/c05927c9-3729-423d-8b85-5a7522ec3007) show the post title as a link; other bare URLs become links showing the address.
  - Hovering a combo link (editor chip, saved link, bare URL) shows the Open Graph image, title and description, as in Pagestorm.
  - YouTube link previews (Pagestorm hover) show the video title and thumbnail.
  - /dev/editors: every editor starts from a lorem ipsum post using its features; the reset button restores them.
- QA: /c-c-c-combo (write and the post above), /pagestorm/write hover on a YouTube link, /dev/editors; ko; desktop.
- Commits: cd606bcc, 357012b2, 869fb803, 77d53d09

### nav-unread-dots
- Feature: Toy Box menu dots clear from an index visit (patch notes still need a note), Colorful Philosophers lights weekly, forced dev dots are dropped, and the dev menu flags an unreserved next debate week.
- Expect:
  - Opening a Toy Box service index (e.g. /c-c-c-combo, /this-or-that) clears that row's dot and, with no other unread, the Toy Box dot; index titles keep their unread tint until a post is opened. /this-or-that also clears the 월드컵 dot it shows.
  - /patches and /patches/neowsletters indexes do not clear the patch dot; opening a note does.
  - Colorful Philosophers: a browser with no visit since this week's Monday 00:00 KST (or never) sees the row and Toy Box dots; visiting the index or a post clears them until next Monday.
  - Dots forced on from /dev/nav-indicators before this change no longer show.
  - Dev server: the dev menu and 토론 주차 예약 row show a dot when next week's production reservation is missing any of topic, card, relic.
- QA: /, /c-c-c-combo, /this-or-that, /patches, /patches/<latest>, /colorful-philosophers in a fresh browser profile; dev menu on the dev server; ko; desktop.
- Commits: 6fb288f1, f0d8af36, 675a37d3

<!--
### <항목-id>
- Feature:
- Expect:
- QA:
- Commits:
-->
