---
name: feature-implementation
description: Implement or change scare-the-spire service features under the static-first Cloudflare Workers Free setup with Slay the Spire 2 game-first design. Use for new features, feature changes, new service surfaces, UI or workflow additions, and data-backed interactions. New Toy Box services also load create-toybox-service.
---

# feature-implementation

`AGENTS.md` rules apply and are not repeated here (Workers Free limits, `__id__`
shells and their registrations, owner-header smoke, `StorageUnavailableNotice`,
naming and language). Pair this with narrower skills: `$create-toybox-service`
for a new Toy Box service or a retitled one, `$compendium-resource-detail`,
`$mobile-viewport-qa`, `$animation-playback-qa`, `$qa`.

## First pass

1. Decide how the feature stays static-first: static data, generated files,
   static assets, bounded client work. A dynamic `/api` route is an exception
   with an explicit bounded cost.
2. Find the game source of truth: `bin/ssy find` for official names, extracted
   assets in `public/images/sts2/**`, locale and structure in `data/sts2/**`.
   Look at the actual images; never choose art from file names. Never invent a
   name, label or translation the game has.
3. Storage: the browser only calls the same-origin `/api`
   (`src/lib/toybox-api.ts`; routes in `workers/api/routes/*.ts`;
   `bin/ssy api` lists the public reads). D1 is the store. Schema changes go in
   `d1/migrations/` (AGENTS.md: applied remotely only with user approval).

## Architecture invariants

- Keep `next build --webpack` in `package.json`; never revert to bare `next build`.
- `page.tsx` holds only Next.js route exports and config. Rendering and metadata
  live in the adjacent `page-content.tsx`, shared by the base and
  `src/app/[gameLocale]/` entries.
- The patch Worker owns `/patches*` and `/_patches*`, including the
  `/patches/changes` explorer. Generate its HTML, JS and indexes
  (`/generated/sts2-resource-patch-index.json`) at build time.
- The main Worker is static-only. An unregistered page 404s in production;
  `pnpm cf:assets` fails on a prerendered route nobody serves.
- New routes are static. Records (UUID posts, runs) load in the browser behind
  the `__id__` shell from AGENTS.md, shipped in the same change; never
  `force-dynamic` or request-time rendering. Shell mechanics:
  `generateStaticParams` helpers and `metadataRecordId()` in
  `src/lib/static-detail-shell.ts`, `StaticDetailShell` in
  `src/components/static-detail-shell.tsx`, generic metadata, canonical from
  `window.location` after mount. Worked example: `src/app/pagestorm/[id]/`.
- The Worker rewrites only a validated one-segment id, for document and RSC;
  extra segments 404. Federated posts also need `/defragment/{service}/{id}`
  (`DEFRAGMENT_FEDERATED_SERVICES` in `workers/static-page-routing.ts`). Never
  prerender a `permanentRedirect` page as a shell; legacy aliases use a bounded
  Worker 308. Prefetch an id URL only once the rewrite covers RSC.
- New service indexes are exact static pages (`x-cf-static-page: service`),
  `/en` included.

## Game-first design

- With an in-game reference, mirror the game concept and add only small
  conveniences (a card collection feels like the STS collection, not a SaaS
  table). Without one, still build from game assets, locale, colors and
  interaction metaphors.
- Prefer game tokens, hover previews, short labels and direct affordances over
  service jargon. No in-app essays about the design; one functional subtitle is
  enough.
- Service-owned strings go in `src/messages/service.ts`. Game-origin text comes
  from extracted locale through `src/lib/borrowed-game-copy.ts`; record any
  adaptation in `data/i18n/borrowed-game-phrases.json`. No hand translation.
- Use existing extracted assets first; author new art only when no game asset
  fits.

## Community surfaces

- Feeds read `/api/read/toybox-feed` and `/api/read/defragment-feed`
  (`workers/api/routes/toybox.ts`). Services, sorts and page size are owned by
  `src/lib/toybox-feed.ts`; add per-service sorts there and reuse
  `FeedSortToggle`. Keyset cursor `(score, created_at, id)`, never `OFFSET`;
  at most 20 rows per page and per 조각모음 source before the merge; never full
  scans, full-table unions, or loading a whole env to sort in the browser.
- Like and comment counts are denormalized on post rows and arrive with the
  feed page. No per-card count requests and no request-time reads into HTML.
- 조각모음 sources live in `src/lib/defragment.ts` (`DEFRAGMENT_FEDERATED_SERVICES`
  for the board, `DEFRAGMENT_WRITE_SERVICES` for the write panel). Rows open
  `/defragment/{service}/{id}`, which embeds the source content with a quiet
  link to the original. Comments and likes use the original thread keys
  (`src/lib/comment-threads.ts`, `defragmentItemThreadKey`). The write panel
  uses standalone insert helpers, not the services' feed hooks; it never
  deletes originals and has no native 조각모음 post type.
- Content widths come only from `src/lib/toybox-layout.ts`; no third max width.
- Don't retouch existing create/submit labels. A new one without a verb-like
  game line uses `등록` / `Register`, never `올리기`.
- Reuse these components instead of a second system:
  - Like and ghost-reveal type tokens: `src/components/spire-icon.tsx`.
  - Icon-only labels: `src/components/game-ui-hover-tip.tsx` (no native `title`).
  - Index card comment/like: `src/components/index-card-engagement.tsx`.
  - Detail actions and delete confirm: `src/components/post-detail-actions.tsx`,
    `src/components/game-confirm-modal.tsx`.
  - Relic inspect: `src/components/codex/relic-inspect-slab.tsx`.
  - Scroll rails: `GameScrollArea` on inner panes and modals only; page and
    index scroll stay native (`docs/DESIGN.md` 스크롤바).

## Verification

- Run what `$qa` selects for the touched scope, with mobile checks when layout,
  cards, rails, hover previews or dense controls change.
- Report the static-first risk considered, the game assets and locale used,
  and for new id routes the document and RSC owner-header smoke result.
  Toy Box identity goes in the `$create-toybox-service` report.
