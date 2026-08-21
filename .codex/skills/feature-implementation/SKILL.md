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
- New services need a token asset plus title before implementation:
  - Token asset usually comes from relic, potion, power, card, Ancient, or other
    small icon-like game art.
  - Title should follow service language policy: Korean first, English fallback
    only when appropriate.
- Avoid visible in-app explanations of the feature design. The UI should be
  legible from the chosen token, title, layout, and game-like interaction.

## Community Surface Conventions

These were missing from the original skill and must stay consistent across Combo,
Transfigure, This or That, Chemical X, 조각모음 (Defragment), History Course,
Stories, and comments.

### Index-card engagement

- Index cards that have a detail page with `#comments` must show comment and like
  aggregates on the card.
- Comment control navigates to the detail `#comments` anchor (composer focus).
- Like control toggles immediately on the index when the shared `likes` table or
  a service-specific like table already exists. Do not invent a new Worker RPC.
- Toy Box indexes (Combo, Transfigure, This or That, Chemical X, 조각모음) read
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
  (`vote_rate_high`, `vote_rate_low`) sorts by winner share
  (`max(left, right) / total`, basis points). Posts with 0 votes are
  excluded. 조각모음 and Stories stay on the core three.
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
  `combo`, `transfigure`, `this_or_that`, `chemical_x`. The RPC reads one table
  and returns at most 20 rows plus a `post` jsonb blob.
- 조각모음's mixed board calls `get_defragment_feed` with the same sort, limit,
  and cursor arguments. That RPC unions Combo, Transfigure, This or That, and
  Chemical X. It takes **at most 20 rows from each source**, then merges and
  returns at most 20. Do not `UNION` full tables and do not issue four unbounded
  browser queries. There is no native title+body 조각모음 post type; optional
  overlay bodies live on `defragment_bodies`.
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
  renderer). A quiet `{name}에서` / `In {name}` link reaches the original page.
  Do not add a required extra hop through the original detail to read or vote.
- Comments and likes on 조각모음 use the original thread keys
  (`defragmentItemThreadKey`) so they stay in sync with Combo / Transfigure /
  This or That / Chemical X.
- Write from 조각모음: pick Combo / Transfigure / This or That / Chemical X and
  get that service's matching composer, plus an optional 조각모음-only overlay
  body (`defragment_bodies`, keyed by env + source_service + source_id). Do not
  offer a native title+body 조각모음 type. Do not change Combo / Transfigure /
  This or That / Chemical X own compose or index UX. Additive editor props such
  as `hideNickname` / `draftKey` are allowed. Do not call those services' feed
  hooks from the 조각모음 write panel; use standalone insert helpers. Do not
  delete original posts from 조각모음.
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

### Borrowed game-locale CTAs

- Primary create/submit labels should borrow short game-locale phrases when a
  clear in-game match exists, not invent SaaS verbs like "만들기".
- Current examples:
  - Combo create: Korean `결합이다!` from Amalgamator (`AMALGAMATOR`); English
    `COMBINING!` from the same event line.
  - Transfigure create/submit: Korean `변형하기` from card title `변형`
    (`TRANSFIGURE`); English `Transfigure`.
  - This or That create: Korean `이거... 아님 저거?` / English
    `This... or That?` from `THIS_OR_THAT.pages.INITIAL.description`
    whisper line. Vote prompts stay on Knowledge Demon `선택하라.` /
    `Make your choice.`
  - 조각모음 header create: adapted `cards.DEFRAGMENT.description` → Korean
    `밀집을 얻습니다` / English `Gain Focus.` Type submit labels stay that
    type's own CTA (`결합이다!`, `변형하기`, …). Title stays `조각모음` /
    `Defragment` and must not be reused as nick or CTA.
- Put service shell strings in `src/messages/service.ts`. Keep game-origin
  phrases sourced from extracted locale / borrowed-game-copy, not hand
  translation.

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
  nickname; that encounter is only for the vote CTA.
- 조각모음: exact `FOCUS_POWER.title` → Korean `밀집` / English `Focus`.
  Do not reuse the service title as the nickname.

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

- Compendium relic detail and Transfigure relic preview/editor assemble the
  inspect relic from `RelicInspectSlab` (`src/components/codex/relic-inspect-slab.tsx`).
- Size the slab from extracted `reward_panel.webp` (1128×1435) and the
  ornamental ring from `relic_inspect_frame.webp` (408×408) via
  `src/lib/relic-inspect-assets.ts`. Do not force `aspect-square` on the panel.
- Do not invent a second slab layout for Transfigure.

## Implementation Defaults

- Use existing components and data loaders before adding new abstractions.
- Keep data schemas generated or derived from game/source data where possible.
- Keep service-owned UI strings in typed service dictionaries when the surface
  is localized.
- Use game-origin text from extracted localization instead of hand translation.
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
  - The token asset and title chosen for any new service surface.
