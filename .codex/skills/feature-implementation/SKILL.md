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
