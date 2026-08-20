# 섀소식 Format Reference

Published entries the user already corrected (`2026-07-09`, `2026-08-04`, `2026-08-12`) are the style source. Prefer those over older examples in this file.

## Locale Files

Every deployment date has a paired service-locale source:

- `data/byrdispatch/YYYY-MM-DD.md` — canonical Korean service copy.
- `data/byrdispatch/YYYY-MM-DD.en.md` — authored English service copy.

The user can provide only Korean instructions. Keep Korean as the content source,
then write concise natural English without asking for a separate translation.
Both files keep the same date, section order, bullet structure, URLs, media paths,
rich-reference types, and status meaning. Renderer-only control tokens remain
unchanged when no documented English form exists.

## Canonical Markdown

```md
# 2026-08-12

## 장난감 상자
- 좋아요·댓글·수정·삭제의 아이콘 디자인과 위치 기능을 통일했습니다.

## 역사 강의서
- 역사 강의서 개편이 세 단계로 릴리즈 됩니다.
  - 목록에서 보고 싶은 썸네일 표시 (new)
  - 리플레이를 통한 복기 기능 (예정)
  - 보는 재미가 있는 리플레이 (예정)

## 백과사전

### 카드
- 충분한 공간이 있다면 카드 설명의 키워드 툴팁을 보여줍니다. (new)
```

Rules:

- The H1 is exactly the deployment date in `YYYY-MM-DD`.
- The renderer presents the H1 date as each entry's visual title, not muted metadata: keep the larger title scale and apply only the Byrdispatch teaser's purple text color, without chip background, border, rounded corners, padding, or shadow.
- The newest dated entry uses a borderless purple background container. Keep visible spacing between dates and do not use entry borders as separators.
- H2 headings are service areas.
- `## 공지` / `## Notice` is optional, but when present it must be the first H2 section.
- The renderer treats `## 공지` / `## Notice` as a pink highlighted notice block above regular sections.
- Use `## 서비스명` for top-level services.
- Use `### 하위 서비스명` for child services inside a top-level service.
- A top-level service H2 may have no bullets when it only groups child service H3 sections; keep the H2 visible.
- Korean status markers: `(new)`, `(적용됨)`, `(예정)`, `(개발 중)`, `(버그)`, `(제보 감사)`.
- English status markers: `(new)`, `(already)`, `(planned)`, `(in progress)`, `(bug)`, `(thanks for the report)`.
- `(적용됨)` / `(already)` and `(예정)` / `(planned)` belong on nested staged-release rows. Do not write `- 완성` / `- done`.
- `(개발 중)` is WIP. `(예정)` is a future release the user asked to announce.
- Append a marker to headings or bullets only when that status is true.
- Bullets are one line each.
- Preserve one nested bullet level (`  -`) when the user provides child examples/details or explicitly asks for nested bullets.
- Convert user numbered lists (`1. 2. 3.`) to nested `-` bullets. The parser only accepts `-`.
- `<details>` / `<summary>` is allowed for long expandable lists. Put `<details>` then `<summary>표시 문구</summary>`, then `-` bullets, then `</details>`. Version rows should be markdown links to `/patches/vX.Y.Z`.
- `[character-low-hp-idle]` or `[character-low-hp-idle:v0.111.0]` inserts the same all-character low HP idle render used in patch notes. Use it as a standalone line, like images, not as a screenshot.
- Indent an image by the same two spaces when it belongs to a nested example; the renderer keeps that media aligned at the nested depth.
- Place each image immediately before the bullet it illustrates.
- No intro paragraph.
- Do not add nested bullets on your own.
- No empty child sections. Parent H2 grouping sections are allowed without bullets.
- When the user supplies copy, that wording is the SSOT. Format only. Do not rewrite spacing, phrasing, status labels, or parenthetical notes.
- When drafting without user copy, use `합니다` / `했습니다`. Do not use `했다`.
- Do not mention implementation names in user copy.

## Route and Service Naming

- Public route: `/byrdispatch`
- English service references named `byrdispatch` link directly to `/en/byrdispatch`, even from Korean or game-only locale pages.
- English service name: `byrdispatch`
- Korean service name: `섀소식`
- Data files remain under `data/byrdispatch/YYYY-MM-DD.md`.

## Rendered Styling Contract

Codex writes plain markdown with status markers; the app renderer owns visual styling.

- `## 공지`: pink text/border treatment and the Signal Boost power token before the heading.
- Service headings: aqua links to the service route without underline styling, plus a leading token/icon asset.
- Child service headings: same aqua no-underline link treatment, but use the child service icon from navigation/dropdown assets.
- Service references inside bullets are written as visible service names in plain text. The renderer turns recognized service names into aqua links with a leading token asset.
- Do not add `(서비스)` markers. If a service mention has a qualifier, the qualifier stays plain and only the service name is styled, e.g. `슬더스2 패치노트` styles only `패치노트`.
- Individual game resources inside bullets: patch-note rich reference behavior with gold styling, game hover tip, link, and active game locale label.
- Inline code chips: wrap keyboard/editor tokens in backticks, e.g. `` `@` `` or `` `*` ``. The renderer shows them as monospace chips; do not rely on plain `@` / `*` alone.
- Epoch beta-art updates should use typed `[gold:epoch]...[/gold]` references; byrdispatch renders those hover tips in beta-art mode.
- Beta-art mode shows the beta art instead of the official art. It must not render both images together.
- `(new)`: New Leaf token. Tooltip: `이번에 적용됨` / `Shipping in this update`.
- `(적용됨)` / `(already)`: Old Coin token. Tooltip: `이미 적용됨` / `Already shipped`. Nested staged bullets also get muted text.
- `(예정)` / `(planned)`: Mercury Hourglass token. Tooltip: `릴리즈 예정` / `Planned`. Nested staged bullets also get amber text.
- `(개발 중)`: Hammer Time power token. Tooltip: `아직 개발 중`.
- `(버그)`: Infested power token. Tooltip: `버그 수정`.
- `(제보 감사)`: Wongo Customer Appreciation Badge relic token. Tooltip: `제보 감사`.

Top-level `(new)` stays token-only. Nested `(적용됨)` / `(new)` / `(예정)` get text color plus the suffix status token only, with no row container and no extra text chips.

`「내 글」` / `「Mine」` render the same `OwnPostMark` chip used on service indexes. `[새 이야기 쓰기 버튼 노출/링크]` renders the live Story composer button. Parentheticals like `(실제 게임에서 렌더하는 칩 사용)` are instructions, not published copy.

When a later stage ships, retarget the original nested list: previous `(new)` → `(적용됨)`, the stage that just shipped → `(new)`, remaining stages stay `(예정)`. Put the functional change in the new dated entry.

Token/icon asset anchors:

- Notice: `public/images/sts2/powers/signal_boost_power.webp`
- Already shipped: `public/images/sts2/relics/old_coin.webp`
- New / this update: `public/images/sts2/relics/new_leaf.webp`
- Planned: `public/images/sts2/relics/mercury_hourglass.webp`
- In progress: `public/images/sts2/powers/hammer_time_power.webp`
- Bug fix: `public/images/sts2/powers/infested_power.webp`
- Community report thanks: `public/images/sts2/relics/wongo_customer_appreciation_badge.webp`
- Transfigure service: `public/images/sts2/relics/astrolabe.webp`
- Compendium top-level service: use the STS2 desktop/app icon from the top navbar.
- Compendium child services: use the icon token assets already used by the compendium dropdown.

## Allowed Service Sections

Prefer these exact Korean headings:

- `공지` — site-wide operational notices; always place first when used.
- `공통`
- `섀소식`
- `슬서운 이야기`
- `패치 노트`
- `패치노트`
- `장난감 상자`
- `역사 강의서`
- `백과사전`
- `케미컬X`
- `코오오옴보`
- `이거 아님 저거?`
- `변형`
- `프로필`
- `작은 우편함`
- `댓글`
- `개발/운영`

Use `기타` only when no section fits.

Use these established headings in `.en.md` files:

| Korean | English |
| --- | --- |
| `공지` | `Notice` |
| `공통` | `General` |
| `섀소식` | `byrdispatch` |
| `슬서운 이야기` | `Stories` |
| `패치 노트` / `패치노트` | `Patch Notes` |
| `슬서운 변경` | `Patch History` |
| `장난감 상자` | `Toy Box` |
| `역사 강의서` | `History Course` |
| `백과사전` | `Compendium` |
| `케미컬X` | `Chemical X` |
| `코오오옴보` | `C-C-C-Combo` |
| `이거 아님 저거?` | `This or That?` |
| `변형` | `Transfigure` |
| `프로필` | `Profile` |
| `작은 우편함` | `Tiny Mailbox` |
| `댓글` | `Comments` |
| `개발/운영` | `Development / Operations` |
| `기타` | `Other` |

## User Prompt Template

```md
섀소식 작성해줘.

배포일: 2026-08-14

원문:
백과사전
- 유물 상세를 게임 인스펙트 패널로 보여 줌
- 포션·파워·인챈트에도 같은 키워드 팁

규칙:
- 최종 결과는 data/byrdispatch/2026-08-14.md와 data/byrdispatch/2026-08-14.en.md
- # 2026-08-14
- 공지가 있으면 ## 공지 를 첫 섹션으로 둠
- 서비스는 ## 서비스명, 하위 서비스는 ### 하위 서비스명
- 사용자 원문이 있으면 문장을 다시 쓰지 않음
- 비기능(CI, SEO, gen, QA, 내부 폴리시)은 쓰지 않음
- 캡쳐는 기본 없음. 시각 변경이면 대상/route/crop을 추천하고, 사용자가 적거나 승인한 것만 넣음
- 새 서비스/하위 서비스는 제목 뒤에 (new)
- 이번에 적용된 기능은 bullet 뒤에 (new)
- 다단계 로드맵 자식은 (적용됨) / (new) / (예정)
- 진행 중 변경은 (개발 중)
- 버그 수정은 (버그)
- 제보에 감사하는 변경은 (제보 감사)
- bullet은 한 줄. 번호 목록은 nested `-` 로 바꿈
- 필요한 게임/서비스 항목은 기존 rich patch 문법으로 링크/툴팁 처리
- 서비스 본문 참조는 `패치노트`, `케미컬X`처럼 서비스명을 그대로 쓰고 `(서비스)`를 붙이지 않음
- 편집기 토큰은 `` `@` `` / `` `*` `` 처럼 백틱
- 영어 원문을 따로 주지 않아도 서비스 문구의 영어 버전을 함께 작성
- 영어 파일에서는 영문 서비스명과 영문 상태 마커 사용
```

## Rich Reference Examples

Use typed tags only when verified:

```md
- [gold:relic]역사 강의서[/gold] 화면에 공유 런 목록을 추가했습니다
- [gold:card]광기[/gold]와 [gold:potion]광기의 포션[/gold]을 함께 보여주는 이야기를 추가했습니다
- [gold:monster]섀도니스[/gold] 관련 소식을 홈에서 구분해 볼 수 있게 했습니다
```

Do not gold-tag services. Services are rendered as aqua links by heading:

```md
## 섀소식 (new)
## 백과사전
### 카드
```

Keep plain text when uncertain:

```md
- 공유 런 목록을 더 쉽게 확인할 수 있게 정리했습니다
```

## Staged-release example

User note:

```md
역사 강의서 개편이 세 단계로 릴리즈 됩니다.
1. 목록에서 보고 싶은 썸네일 표시 - 완성
2. 리플레이를 통한 복기 기능
3. 보는 재미가 있는 리플레이
```

Output:

```md
- 역사 강의서 개편이 세 단계로 릴리즈 됩니다.
  - 목록에서 보고 싶은 썸네일 표시 (new)
  - 리플레이를 통한 복기 기능 (예정)
  - 보는 재미가 있는 리플레이 (예정)
```

Later, when replay review ships, keep this list in the original entry and retarget:

```md
  - 목록에서 보고 싶은 썸네일 표시 (적용됨)
  - 리플레이를 통한 복기 기능 (new)
  - 보는 재미가 있는 리플레이 (예정)
```

Write the actual replay feature as a normal bullet in the new dated entry.

## What not to write

Do not include CI, lint, generated files, SEO/canonical, Worker/deploy internals, QA, or internal polish that does not change what a player sees.

Under `패치노트`, include only functional service changes. Do not list publishing or syncing a patch by itself.

## Media

Default: no screenshots.

When the user lists captures (`<캡쳐>`, `(이미지)`), insert only those shots, immediately before the related bullet. Do not invent extra modals or pages.

When the user does not list captures and the change is visual, recommend instead of inserting:

```text
추천 캡쳐:
- 유물 상세 인스펙트 + 키워드 팁
  route: /compendium/relics/philosophers_stone
  frame: inspect panel + keyword tip stack
  crop: content only, no navbar, no meta rail
```

Capture with headless Playwright against a local route that already has the feature. Wait for async detail payload (`상세 정보를 불러오는 중입니다.` gone, feature node visible). If the target 404s or never leaves the loading shell, leave the bullet text-only.

Crop to the feature. Navbar is out except for full-screen confirm modals, cover thumbnails, and editor sheets that are the feature. For a marked-up region, crop to that region only (Combo: the token row).

```md
![글 삭제 예/아니요 확인창](/images/byrdispatch/2026-08-12/toybox-delete-confirm.png)
```

Compact reaction palette media may stay centered at about half width.

## Normalization Examples

User-supplied copy (keep wording):

```md
- 글 삭제는 게임식 예/아니요 확인창이 뜹니다.
```

Drafted without user copy:

```md
## 백과사전
### 유물
- 유물 상세를 게임 인스펙트 패널로 보여 주고, 설명이 있으면 키워드 팁을 옆에 둡니다. (new)
```
