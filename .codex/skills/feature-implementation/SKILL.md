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
Transfigure, This or That, Chemical X, History Course, Stories, and comments.

### Index-card engagement

- Index cards that have a detail page with `#comments` must show comment and like
  aggregates on the card.
- Comment control navigates to the detail `#comments` anchor (composer focus).
- Like control toggles immediately on the index when the shared `likes` table or
  a service-specific like table already exists. Do not invent a new Worker RPC.
- Prefer `useEngagementCounts` (existing `get_engagement_counts` RPC) plus
  `LikeButton` / `IndexCardEngagement` for thread keys from
  `src/lib/comment-threads.ts`.
- Do not add request-time Worker Supabase reads or full-table joins for these
  counts. Keep aggregation client-side against the existing bounded RPC.
- Codex library tile overlays are a separate surface; do not casually change
  them when updating community index cards.

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

When adding a new composer service, resolve `defaultNickname` with the
title/token set. Put the string in the service dictionary and record
whether it is exact game text, adapted game text, or an intentional
service-owned exception.

### Action icons (community surfaces)

- **Like only** uses the game token via `SpireLikeIcon` in
  `src/components/spire-icon.tsx`: `necro_mastery_power.webp` (강령의 극의).
  Idle = ghost wax; hover/active = spire-gold (`#d4a843`).
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
  `hover_tip.png` 9-slice, gold bold text, below the control (`top-full`).
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
