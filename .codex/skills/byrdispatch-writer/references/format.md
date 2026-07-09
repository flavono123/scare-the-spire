# 섀소식 Format Reference

## Canonical Markdown

```md
# 2026-06-09

## 공지
- 곧 사이트 주소가 [새 주소](https://example.com)로 옮겨질 예정이다

## 섀소식 (new)
- 홈에 [gold]섀소식[/gold] 진입점을 추가했다
- 섀소식은 패치노트와 별도의 서비스 업데이트 알림판으로 분리했다

## 역사 강의서
- 공유 런 목록을 더 쉽게 확인할 수 있게 정리했다

## 백과사전

### 캐릭터 (new)
- 캐릭터 정보를 볼 수 있는 페이지를 추가했다
```

Rules:

- The H1 is exactly the deployment date in `YYYY-MM-DD`.
- H2 headings are service areas.
- `## 공지` is optional, but when present it must be the first H2 section.
- The renderer treats `## 공지` as a pink highlighted notice block above regular sections.
- Use `## 서비스명` for top-level services.
- Use `### 하위 서비스명` for child services inside a top-level service.
- A top-level service H2 may have no bullets when it only groups child service H3 sections; keep the H2 visible.
- Append `(new)`, `(개발 중)`, or `(버그)` to headings or bullets only when that status is true.
- Bullets are one line each.
- Preserve one nested bullet level (`  -`) when the user provides child examples/details or explicitly asks for nested bullets.
- No intro paragraph.
- Do not add nested bullets on your own.
- No empty child sections. Parent H2 grouping sections are allowed without bullets.
- When the user says to keep wording exactly, preserve visible text verbatim, including spacing choices such as `안보이던`, bracket notes, and parenthetical notes.

## Route and Service Naming

- Public route: `/byrdispatch`
- English service name: `byrdispatch`
- Korean service name: `섀소식`
- Data files remain under `data/byrdispatch/YYYY-MM-DD.md`.

## Rendered Styling Contract

Codex writes plain markdown with status markers; the app renderer owns visual styling.

- `## 공지`: pink text/border treatment and the Signal Boost power token before the heading.
- Service headings: aqua links to the service route without underline styling, plus a leading token/icon asset.
- Child service headings: same aqua no-underline link treatment, but use the child service icon from navigation/dropdown assets.
- Service references inside bullets use a literal `(서비스)` marker, e.g. `패치노트(서비스)` or `케미컬X(서비스)`. The renderer preserves the full text and turns the marked phrase into an aqua service link.
- Individual game resources inside bullets: patch-note rich reference behavior with gold styling, game hover tip, link, and active game locale label.
- Epoch beta-art updates should use typed `[gold:epoch]...[/gold]` references; byrdispatch renders those hover tips in beta-art mode.
- Beta-art mode shows the beta art instead of the official art. It must not render both images together.
- `(new)`: render a New Leaf relic token after the heading or bullet.
- `(개발 중)`: render a Hammer Time power token after the heading or bullet.
- `(버그)`: render an Infested power token after the heading or bullet.
- Status tokens expose hover tooltips: `새로운 기능`, `아직 개발 중`, `버그 수정`.

Token/icon asset anchors:

- Notice: `public/images/sts2/powers/signal_boost_power.webp`
- New service/status: `public/images/sts2/relics/new_leaf.webp`
- In progress: `public/images/sts2/powers/hammer_time_power.webp`
- Bug fix: `public/images/sts2/powers/infested_power.webp`
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
- `역사 강의서`
- `백과사전`
- `케미컬X`
- `이거 아님 저거?`
- `프로필`
- `댓글`
- `개발/운영`

Use `기타` only when no section fits.

## User Prompt Template

```md
섀소식 작성해줘.

배포일: 2026-06-09

원문:
공지
- 곧 사이트가 Cloudflare 새 주소로 이동함

공통
- 홈에 섀소식 진입점 만듦
- byrdpip 아이콘 쓰고 패치노트랑 분리되게 함

역사 강의서
- 공유 런 목록 개선
- 개발용 런 조회 API 추가

규칙:
- 최종 결과는 data/byrdispatch/2026-06-09.md
- # 2026-06-09
- 공지가 있으면 ## 공지 를 첫 섹션으로 둠
- 서비스는 ## 서비스명, 하위 서비스는 ### 하위 서비스명
- 새 서비스/하위 서비스는 제목 뒤에 (new)
- 진행 중 변경은 제목이나 bullet 뒤에 (개발 중)
- 버그 수정은 제목이나 bullet 뒤에 (버그)
- bullet은 한 줄
- 필요한 게임/서비스 항목은 기존 rich patch 문법으로 링크/툴팁 처리
- 서비스 본문 참조는 `패치노트(서비스)`처럼 `(서비스)`를 붙이면 아쿠아 서비스 링크로 렌더됨
- 사용자가 원문 유지 지시를 주면 문장 표현을 바꾸지 않음
- 사용자가 2단계 bullet을 주면 그대로 보존
- 확실하지 않은 레퍼런스는 태그를 만들지 말고 평문으로 둬
```

## Rich Reference Examples

Use typed tags only when verified:

```md
- [gold:relic]역사 강의서[/gold] 화면에 공유 런 목록을 추가했다
- [gold:card]광기[/gold]와 [gold:potion]광기의 포션[/gold]을 함께 보여주는 이야기를 추가했다
- [gold:monster]섀도니스[/gold] 관련 소식을 홈에서 구분해 볼 수 있게 했다
- [gold:monster]영겁의 모래시계[/gold] 노드 이미지를 추가했다
```

Do not gold-tag services. Services are rendered as aqua links by heading:

```md
## 섀소식 (new)
## 백과사전
### 카드
```

Keep plain text when uncertain:

```md
- 개발용 런 조회 API를 추가했다
```

## Media Metadata

Default:

```md
미디어:
- 필요 없음
```

Screenshot request:

```md
미디어:
- 홈 섀소식 진입점 모바일 스크린샷
- route: /
- viewport: iPhone 13 mini
- output: /images/byrdispatch/2026-06-09/home-entry-mobile.png
```

Markdown reference:

```md
![홈 섀소식 진입점](/images/byrdispatch/2026-06-09/home-entry-mobile.png)
```

Compact reaction palette media:

```md
- 좋아요 기능에 기존 룬십이면체 대신 멀티플레이어 감정 표현을 적용합니다. (이미지)
  - 사용성이 괜찮으면 댓글, 케미컬X(서비스) 전체의 좋아요 기능으로 확장합니다.

![](/images/byrdispatch/2026-07-09/story-reaction-palette.png)
```

The renderer keeps this palette image centered and may render it at about half the normal media width when requested.

## Normalization Examples

Input:

```md
공통
- byrdispatch 만들었음
- 패치노트랑 헷갈리지 않게 함
```

Output:

```md
## 공통
- 홈에 [gold]섀소식[/gold] 진입점을 추가했다
- 섀소식을 패치노트와 별도의 서비스 업데이트 알림판으로 구분했다
```
