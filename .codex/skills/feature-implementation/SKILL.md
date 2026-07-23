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
- Preserve Combo's locale URLs and metadata. Read `/combo/[id]` records from
  Supabase in the browser; do not add request-time Worker Supabase reads, full
  Compendium joins, or large JSON parsing for them.
- Keep `/patches*` and `/_patches*` owned by the separate static patch Worker.
  Generate patch HTML, CSS, JavaScript, and resource indexes ahead of time
  instead of moving patch work into the main OpenNext request path.
- Keep the resource change-history explorer and its patch tabs development-only.
  `pnpm dev` opts into `/patches/changes` with `STS_PATCH_CHANGES_DEV=1`;
  production patch builds must not emit that route HTML or its client bundle.
  Continue generating `/generated/sts2-resource-patch-index.json` at build time
  for Compendium resource-detail history rails.
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
