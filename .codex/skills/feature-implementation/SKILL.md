---
name: feature-implementation
description: Implement or change scare-the-spire service features with Cloudflare Free/static-first constraints and Slay the Spire 2 game-first product design. Use for new features, existing feature changes, new service surfaces, UI/workflow additions, data-backed interactions, or service concepts that must feel native to STS2.
---

# feature-implementation

Use this before implementing a new service feature or changing existing feature
behavior. Pair it with narrower domain skills when the feature touches Codex
resources, rich patch notes, mobile layout, animation, or QA.

## First Pass

1. Load `.codex/skills/cf-guardrails/SKILL.md` first.
2. Decide how the feature stays Cloudflare-friendly:
   - Prefer static data, generated files, static assets, and bounded client-side
     interaction.
   - Keep Workers thin; avoid request-time rendering, full-data scans, and
     unbounded server joins.
   - Treat dynamic APIs as exceptions that need explicit bounded cost.
3. Identify the game source of truth:
   - Prioritize extracted game assets in `public/images/sts2/**`.
   - Prioritize extracted game locale and terminology in `data/sts2/**`.
   - Do not invent game names, labels, or translations when game locale exists.
4. If the feature changes Supabase schema, tables, RLS policies, RPCs, indexes,
   or migration SQL, load `.codex/skills/supabase-migrations/SKILL.md`.
   Historical Supabase SQL through migration 014 was applied manually; new
   schema changes after 014 must use CLI migrations under `supabase/migrations/`.

## Current Architecture Invariants

- Preserve `package.json`'s `next build --webpack` default. Do not revert it to
  bare `next build` during feature work.
- Keep shared render and metadata helpers in the adjacent `page-content.tsx`
  modules introduced for Chemical X, Combo, This or That, home, Byrdispatch,
  profile, History Course, and Compendium Bestiary routes. Keep `page.tsx`
  limited to Next.js-supported route exports and required route config; have
  base and `[gameLocale]` route entries import the shared module.
- Preserve Combo's locale URLs and metadata. Read `/c-c-c-combo/[id]` records from
  Supabase in the browser; do not add request-time Worker Supabase reads, full
  Compendium joins, or large JSON parsing for them.
- Keep `/patches*` and `/_patches*` owned by the separate static patch Worker.
  Generate patch HTML, CSS, JavaScript, and resource indexes ahead of time
  instead of moving patch work into the main OpenNext request path.
- Keep the public resource change-history explorer and its patch tabs in the
  static patch Worker. Production patch builds must emit `/patches/changes`
  route HTML and its client bundle ahead of time. Continue generating
  `/generated/sts2-resource-patch-index.json` at build time for the explorer and
  Compendium resource-detail history rails.
- Keep pending Compendium references hover-only when the deployed resource
  manifest does not contain the target; do not turn them into links that 404.
- Treat OpenNext as still present in the main Worker fallback. Do not implement
  static detail shells, Worker rewrites, or fallback removal as incidental
  feature work; those belong to the separate OpenNext exit plan.

## Game-First Product Rules

- If the feature has an in-game reference, mirror the game concept as closely
  as practical, then add only small service convenience. Example: a card
  collection should feel like an STS collection, not a generic SaaS table.
- If the feature has no direct in-game reference, still build from game assets,
  game locale, colors, and interaction metaphors so a Slay the Spire player can
  understand it without explanatory copy.
- Reduce cognitive load. Prefer familiar game tokens, hover previews, concise
  labels, and direct affordances over service jargon.
- New services need a token asset, title, and functional subtitle before
  implementation:
  - Token asset comes from relic, potion, power, badge, Ancient, or other
    **small icon-like** game art that stays legible in the navbar and page
    header. Do **not** use card portraits as the service token. Card art may
    still be used as a page background or OG image.
  - Title should follow service language policy: Korean first, English fallback
    only when appropriate. Prefer an exact game-localized name.
  - Functional subtitle names what the service does. It is service-owned, not a
    game-locale quote. See Toy Box title, subtitle, and hero.
- New Toy Box community services nest under 조각모음 in
  `getToyBoxNavItems` (`nestedUnder: "/defragment"`). They also federate
  into the 조각모음 feed, write panel, and detail embed. History Course
  stays a top-level Toy Box item and is not a 조각모음 feed source.
  이아저? 월드컵 is the exception: it is a tab of 이거 아님 저거?
  (`nestedUnder: "/this-or-that"`, `dropdownHidden: true`). Do not add it as
  a Toy Box dropdown row. Its byrdispatch `(new)` attaches NEW to
  이거 아님 저거? instead.
- Avoid visible in-app explanations of the feature *design*. A one-line
  functional subtitle is required so a new visitor can tell the named game
  thing from the site action. Do not add design essays, how-it-works copy, or
  a second explanation of the token.

## Community Surface Conventions

These were missing from the original skill and must stay consistent across Combo,
Transfigure, This or That, Chemical X, 조각모음 (Defragment), History Course,
Stories, and comments.

### Toy Box title, subtitle, and hero

Game-locale flavor does not describe the service. As Toy Box surfaces multiply,
borrowed quotes in the subtitle / OG description slot read as the game resource
talking, not as what the page does. Split identity copy into three layers.

| Layer | Role | Source | Surfaces |
| --- | --- | --- | --- |
| **Title** | Named game thing | Exact game locale, or documented service wordplay | `h1`, navbar, OG/Twitter title |
| **Subtitle** | What the service does | Service-owned verb phrase in the template below | real `h2`, `Metadata.description`, OG/Twitter description |
| **Hero** | Flavor, one step quieter | Exact or minimally adapted `gameLocale` line | index header `<p>` only; never metadata |

**Title.** Keep the current game-backed names (이거 아님 저거?, 이아저? 월드컵, 변형, 조각모음,
어려운 결정, 역사 강의서, 코오오옴보, 케미컬X). OG title stays
`{title} - {brand}` from `getServiceTitle`. Do not put the functional template
in `h1`.

**Subtitle template** (Korean first; English parallel in the `en` dictionary):

```
슬레이 더 스파이어 2 {기능 설명} - 슬서운 이야기
Slay the Spire 2 {function} - Scare the Spire
```

`{기능 설명}` is a short service-owned verb phrase (what the visitor does),
not a card/event quote. Example: This or That uses `게임 요소 투표하기`, so
the metadata line is `슬레이 더 스파이어 2 게임 요소 투표하기 - 슬서운 이야기`.
A collapsed one-liner that must carry the game name too may append
` : {title}`:

```
슬레이 더 스파이어 2 게임 요소 투표하기 - 슬서운 이야기 : 이거 아님 저거?
```

Use the colon form only when a *single* string has to identify both function
and name (rare share/search one-liners). Do not append `: {title}` to OG
description when OG title is already `{title} - {brand}`.

**On-page `h2` vs metadata.** Metadata uses the full template so a Discord /
Google snippet names the game and the brand. The visible `h2` uses only
`{기능 설명}` (`게임 요소 투표하기`). The page already has site chrome and
`h1`; repeating `슬레이 더 스파이어 2` and `슬서운 이야기` under the title is
noise. Do not render the colon form on the page.

Store the phrase and the composed metadata string in `src/messages/service.ts`
(or `getServiceMetadataCopy`). Do not generate this slot from
`borrowed-game-copy` / `gameLocale`.

**Hero.** Demote the current page-only game quote here (Transfigure Morphic
Grove paragraph, This or That whisper, 조각모음 Focus description, 어려운 결정
`selectionScreenPrompt`, History Course Lantern Key parody). Render it as a
`<p>` under the `h2`, `font-game-text`, `text-sm`, muted (`text-zinc-400` /
`text-muted-foreground`), optional `RichText`. Clamp to two lines on small
viewports. It is not a heading. Omit the hero when there is no documented
game line (Chemical X stays on `legacyName` as a tiny aside, not a hero).
Combo may gain an Amalgamator line as hero or stay title+subtitle only.
Do not invent a hero to fill the slot. Never use the hero as
`Metadata.description`.

**Heading outline.** `h1` = title, `h2` = functional subtitle, hero = `<p>`.
Index create CTA stays on the title row, not beside the hero. Shared chrome is
`ToyBoxIndexHeading`. Index OG/Twitter description is
`composeToyBoxIndexOgDescription(serviceLocale, subtitle)`.

**Existing services (`{기능 설명}` in `src/messages/service.ts`):**

| Service | `{기능 설명}` (ko) | Current quote → hero |
| --- | --- | --- |
| This or That | 게임 요소 투표하기 | event whisper / `prompt` |
| 이아저? 월드컵 | 게임 요소 토너먼트하기 | same This or That `prompt`; tab under `/this-or-that`, URL `/this-or-that/tournament` |
| Combo | 게임 요소 조합 공유하기 | none today; optional Amalgamator line |
| Transfigure | 게임 요소 설명 다시 쓰기 | Morphic Grove paragraph |
| Chemical X | 게임 요소로 짧은 글 쓰기 | no game hero; keep `legacyName` |
| 조각모음 | 커뮤니티 | `FOCUS_POWER.description` |
| 어려운 결정 | 게임 요소 티어 만들기 | `selectionScreenPrompt` |
| History Course | 도전 이력 다시 보기 | Lantern Key parody `heroQuote` |

`$create-toybox-service` must resolve title, functional subtitle, optional
hero, token, and background as one set. Hero is the old "page subtitle"
identity field.

### Index-card engagement

- Index cards that have a detail page with `#comments` must show comment and like
  aggregates on the card.
- Comment control navigates to the detail `#comments` anchor (composer focus).
- Like control toggles immediately on the index when the shared `likes` table or
  a service-specific like table already exists. Do not invent a new Worker RPC.
- Toy Box indexes (Combo, Transfigure, This or That, Chemical X, 어려운 결정,
  조각모음) read
  denormalized `like_count` / `comment_count` from the feed page and pass those
  into `LikeButton` / `IndexCardEngagement` (or This or That's own like button).
  Thread keys stay in `src/lib/comment-threads.ts`.
- Do not call `get_engagement_counts` or `count(*)` to hydrate a Toy Box index.
  That RPC is for bounded Codex tile overlays and similar non-feed surfaces.
- Do not add request-time Worker Supabase reads or full-table joins for these
  counts.
- Codex library tile overlays are a separate surface; do not casually change
  them when updating community index cards.

### Toy Box index sort, keyset, and bounded RPCs

Toy Box community indexes share one sort contract. Do not invent a second
hottest/trending key or an offset page. Stories (슬서운 이야기) uses the same
button order and default via `FeedSortToggle`; it still sorts the already-loaded
client list and does not call `get_toybox_feed`.

- Core sort keys and **button order** are **최신 / 추천 / 댓글**
  (`latest`, `recommended`, `comments` in `TOYBOX_FEED_CORE_SORTS` /
  `TOYBOX_FEED_SORT_OPTIONS`). `FeedSortToggle` defaults to that list.
  Per-service extras append after the core three via
  `TOYBOX_FEED_EXTRA_SORTS` + `TOYBOX_FEED_EXTRA_SORTS_BY_SERVICE`, then
  pass `service` into `FeedSortToggle`. Do not fork a second toggle or
  invent an ad-hoc sort row for one Toy Box index.
- Default selected sort is **최신** (`DEFAULT_TOYBOX_FEED_SORT`).
- Current extra: This or That **투표율 높은 순 / 투표율 낮은 순**
  (`vote_rate_high`, `vote_rate_low`) sorts by total ballots
  (`left_vote_count + right_vote_count`), high then reverse. Keep the
  chip names; do not sort by winner share. Posts with 0 votes are
  excluded. 이아저? 월드컵 **인기** (`play_count`) sorts by
  `play_count`. 조각모음 and Stories stay on the core three.
- Recommend score is `like_count * 4 + comment_count * 6`.
- Page size is 20 (`TOYBOX_FEED_PAGE_SIZE`). Paginate with a keyset cursor
  `(score, created_at, id)`, never `OFFSET`.
- Counts live on the post tables (`like_count`, `comment_count`). Triggers on
  `comments` / `likes` (and `this_or_that_post_likes` for This or That) keep
  them in sync. This or That also denormalizes `left_vote_count` /
  `right_vote_count` from `this_or_that_post_votes` for extra vote-rate
  sorts. Do not scan `comments`, `likes`, or votes to build an index page.
- Per-service indexes call `get_toybox_feed(p_env, p_service, p_sort, p_limit,
  p_cursor_score, p_cursor_created_at, p_cursor_id)`. `p_service` is one of
  `combo`, `transfigure`, `this_or_that`, `chemical_x`,
  `decisions_decisions`, `favorite_tournament`.
  The RPC reads one table and returns at most 20 rows plus a `post` jsonb blob.
- 조각모음's mixed board calls `get_defragment_feed` with the same sort, limit,
  and cursor arguments. That RPC unions Combo, Transfigure, This or That,
  Chemical X, 어려운 결정, and 이아저? 월드컵. It takes **at most 20 rows from
  each source**,
  then merges and returns at most 20. Do not `UNION` full tables and do not
  issue unbounded browser queries per source. There is no native title+body
  조각모음 post type; optional overlay bodies live on `defragment_bodies`.
- 조각모음 index is a dense mixed board (유형 / 제목 / 추천 · 댓글), not gapped
  per-row cards and not a DC/Zeroboard clone. Type uses a narrow token with no
  raised or inset chip box; long names may truncate on phone widths. Idle type
  tokens use `SpireIcon` ghost wax; row hover/focus reveals original asset
  colors via `SpireGhostRevealIcon` (not a spire-* tint). Do not add a left
  accent bar / vertical accent rail on the list. Other Toy Box indexes keep
  their card layouts until they are explicitly redesigned.
- Index rows open **조각모음 detail**, not the original service URL:
  `/defragment/{service}/{id}`. Detail embeds that type's content (combo
  renderer/gallery, transfigure preview, This or That full vote UI, Chemical X
  renderer, 어려운 결정 board, 이아저? 월드컵 play). A quiet `{name}에서` / `In {name}` link
  reaches the original page.
  Do not add a required extra hop through the original detail to read or vote.
- Comments and likes on 조각모음 use the original thread keys
  (`defragmentItemThreadKey`) so they stay in sync with Combo / Transfigure /
  This or That / Chemical X / 어려운 결정 / 이아저? 월드컵.
- Write from 조각모음: pick Combo / Transfigure / This or That / Chemical X /
  어려운 결정 / 이아저? 월드컵 and get that service's matching composer, plus an optional
  조각모음-only overlay body (`defragment_bodies`, keyed by env +
  source_service + source_id). Do not offer a native title+body 조각모음 type.
  Do not change Combo / Transfigure / This or That / Chemical X / 어려운 결정 /
  이아저? 월드컵 own compose or index UX. Additive editor props such as `hideNickname` /
  `draftKey` are allowed. Do not call those services' feed hooks from the
  조각모음 write panel; use standalone insert helpers. Do not delete original
  posts from 조각모음.
- History Course is not a feed source or 조각모음 write type.
- If the RPC is missing (`PGRST202`), fall back to a latest-only keyset on that
  service's own table. Do not emulate recommended/comments sort in the browser
  by loading the whole env. 조각모음 has no single-table fallback; a missing
  `get_defragment_feed` returns an empty page instead of native `defragment_posts`.
- Keep these RPCs browser → Supabase. Do not add request-time Worker reads,
  markdown rendering, or full Compendium joins for the feeds.

### Toy Box content widths

Two content max-widths only, from `src/lib/toybox-layout.ts`:

- **Wide** (`max-w-6xl` / 72rem): History Course, Transfigure index, This or
  That index and detail, 조각모음 index and federated detail, byrdispatch,
  Patch Notes list and detail.
- **Narrow** (`max-w-2xl` / 42rem): Combo, Chemical X, Transfigure detail,
  leftover native 조각모음 detail.

조각모음 index uses the wide max with tighter horizontal padding
(`TOYBOX_WIDE_BOARD_SHELL_CLASS`). Do not invent a third content max-width.

### Create / submit CTAs

Do not retouch existing create/submit labels except `올리기` → `등록`
(English `Register`). 어려운 결정 already uses `등록`. Keep Combo
`결합이다!` / `조합 공유`, Transfigure `변형하기`, This or That create
`이거... 아님 저거?`, vote `선택하라.`, 이아저? 월드컵 create
`월드컵 만들기` / `Make a tournament`, 조각모음 `밀집을 얻습니다`,
Chemical X `투입`.

- New services may still borrow a short verb-like game line for create.
  When there is no such line, confirm with `등록` / `Register`. Do not use
  `올리기`.
- Put service shell strings in `src/messages/service.ts`. Keep remaining
  game-origin phrases sourced from extracted locale / borrowed-game-copy, not
  hand translation.

### Service default nicknames

Community composers still need a per-service `defaultNickname` in
`src/messages/service.ts`. Profile character nicknames (`네바`, `아클단`, …)
are suggested only on the profile page and persist only after the user
interacts there (`sts-user-profile` in localStorage). They are not seeded
when a Toy Box page loads.

Each composer calls `useUserProfile` with `{ ...DEFAULT_USER_PROFILE,
nickname: copy.defaultNickname }`. That service string is the real nickname
when localStorage is empty: first visit, never opened profile, iPad/Safari
private browsing or ITP, or a nickname field left blank on submit. Do not
remove the fallback or assume a stored profile exists.

Choose the default from the same game-locale identity as the service: an
exact in-game name, or a minimal documented adaptation of one. Do not invent
SaaS labels like `익명의 ~술사` / `Anonymous combiner`. Keep it ≤ 20
characters (database limit). Comments stay on the generic profile fallback
(`닉` / `Nick`).

Current:

- Combo: exact `AMALGAMATOR.title` → Korean `융합자` / English `Amalgamator`.
- Transfigure: adapted from `TRANSFIGURE.title` `변형` / `Transfigure` →
  Korean `변형체` / English `Transfigured`.
- Chemical X: `익명의 투입터리안` / `Anonymous Insertweetian` is an
  intentional service-owned exception, not game locale.
- This or That: exact phrase from `THIS_OR_THAT.pages.PLAIN.description`
  → Korean `세 번째 손` / English `THIRD hand`. It is event flavor, not a
  named resource. Do not borrow Knowledge Demon (`지식의 악마`) for the
  nickname; that encounter is only for the vote CTA. 이아저? 월드컵 uses
  the same nickname (tab under This or That, not a separate composer identity).
- 조각모음: exact `FOCUS_POWER.title` → Korean `밀집` / English `Focus`.
  Do not reuse the service title as the nickname.
- 어려운 결정: adapted from `DECISIONS_DECISIONS.title` `어려운 결정` /
  `Decisions, Decisions` → Korean `결정` / English `Decision`. Do not reuse
  the service title as the nickname.

When adding a new composer service, resolve `defaultNickname` with the
title/token set. Put the string in the service dictionary and record
whether it is exact game text, adapted game text, or an intentional
service-owned exception.

### Action icons (community surfaces)

- **Like only** uses the game token via `SpireLikeIcon` in
  `src/components/spire-icon.tsx`: `necro_mastery_power.webp` (강령의 극의).
  Idle = ghost wax; hover/active = spire-gold (`#d4a843`).
- **조각모음 type tokens** use `SpireGhostRevealIcon`: idle = ghost wax;
  row hover/focus = original asset colors, not gold.
- **Comment / edit / delete** use unified Lucide icons (`MessageCircle`,
  `Pencil`, `Trash2`). Non-delete accent hover/active color is spire-gold;
  delete stays red.
- Soft `-translate-y` toast-up applies **only on index engagement icons**
  (`INDEX_LUCIDE_ICON_CLASS` / `SpireLikeIcon lift`), never from parent card
  hover and never on detail top-right actions.
- Index cards: comment + like only (no edit, no delete). Own posts show
  read-only `OwnPostMark` (`ownPostLabel`: KO `내 글` / EN `Mine`) next to
  the nickname — ownership is not signaled via a delete control.
- Comment tips via `GameUiHoverTip` (`engagementTips`): 0 → `commentFirst`
  ("첫 댓글 쓰기"), n → `commentCount` ("{count}개의 댓글").
- Detail top-right order via `PostDetailActions`: copy link → edit (author) →
  delete (author). Destructive delete is detail-only and always goes through
  `GameConfirmModal` with game `GENERIC_POPUP` labels (`예`/`아니요`,
  `Yes`/`No`) from `deleteConfirm` in `src/messages/service.ts`.
  Modal chrome uses extracted `popup_vertical` + red/green ribbon buttons
  (`public/images/sts2/ui/confirm/`, via `scripts/extract-confirm-popup-assets.py`);
  hover matches `NPopupYesNoButton` (gold additive outline + outer-pivot scale).

### Icon hover tips

- Icon-only labels use `GameUiHoverTip` (`src/components/game-ui-hover-tip.tsx`):
  `hover_tip.png` 9-slice, gold bold text. The tip portals to `document.body`
  at z-index 400 so dense board rows and overflow-clipped chrome cannot hide
  it. Prefer flipping above the control when there is no room below.
- Site navbar patch notes / contact / profile, and Transfigure image-color-filter
  chips, must share this tip. Pass `delayMs={GAME_UI_HOVER_TIP_NAV_DELAY_MS}`
  (0) so they appear immediately like the navbar.
- Index comment/like tips keep the default delay.
- Do not use native `title`, a black CSS tooltip, or a second hover-tip system
  for these icon labels.

### Shared relic inspect slab

- Compendium relic detail, Transfigure relic preview/editor, patch-note /
  Toy Box `EntityPreview` relic hovers, and This or That relic previews
  assemble the inspect relic from `RelicInspectSlab`
  (`src/components/codex/relic-inspect-slab.tsx`) via `RelicInspectPreview`
  when the caller does not need custom art.
- Size the slab from extracted `reward_panel.webp` (1128×1435) and the
  ornamental ring from `relic_inspect_frame.webp` (408×408) via
  `src/lib/relic-inspect-assets.ts`. Do not force `aspect-square` on the panel.
- Do not invent a second slab layout for Transfigure, patch notes, or Toy Box.
- Relic keyword hovers are the inspect slab plus ExtraHoverTips, not a
  GameHoverTip that restates the relic description. Keep that set in the
  static patch HTML; do not portal it away during `renderToStaticMarkup`.

### Page and index scroll

Game-asset scrollbar rails (`GameScrollArea`, `/images/sts2/ui/scrollbar/`)
belong on **inner panes and modals only**: pickers, `ServiceModalFrame`,
filter sidebars, detail overlays, tournament thumbnail pools. The outermost
page and index scroll is native document overflow. Do not wrap the site
navbar + children in `GamePageScroll`. Do not lock `body` to
`h-dvh overflow-hidden` for a gold train. Compendium library indexes use
native overflow on `CompendiumIndexScroller`; keep `GameScrollArea` on the
filter rail and `CompendiumDetailOverlay`. Mobile still hides the rail below
`md`. See `docs/DESIGN.md` 스크롤바.

## Implementation Defaults

- Use existing components and data loaders before adding new abstractions.
- Keep data schemas generated or derived from game/source data where possible.
- Keep service-owned UI strings in typed service dictionaries when the surface
  is localized. Toy Box functional subtitles and OG descriptions belong here,
  not in borrowed game copy.
- Use game-origin text from extracted localization instead of hand translation.
  On Toy Box indexes that text is the title, optional hero, nickname, and
  remaining verb-like CTAs — not the `h2` / OG description.
- For new routes, choose static generation unless user-specific or live data
  makes that impossible.
- For new public assets, use existing extracted assets first. Generate or author
  new art only when no game asset can represent the service concept.

## Verification

- Run the checks selected by `$qa` for the touched scope.
- For UI work, include mobile verification when layout, cards, detail rails,
  hover previews, patch pages, or dense controls changed.
- In the final report, state:
  - Which `$cf-guardrails` risk was considered.
  - Which game assets/locales informed the design.
  - The token, title, functional subtitle (`{기능 설명}` + metadata template),
    and hero phrase (or explicit omission) for any new or retitled Toy Box
    surface. Confirm the hero was not reused as OG description.
