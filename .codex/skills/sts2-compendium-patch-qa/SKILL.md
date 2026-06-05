---
name: sts2-compendium-patch-qa
description: Verify that a Slay the Spire 2 patch has been applied correctly to Compendium resources, structured field diffs, lifecycle/deprecated rendering, patch-note hover links, and patch-history rails. Use after sts2-compendium-patch-sync, slseoun-patch, update-game-assets, STS2 data/versioning changes, deprecated resource changes, or rich patch pages that touch Codex resources.
---

# STS2 Compendium Patch QA

## Overview

Run this as the focused regression pass for STS2 patch work that changes Compendium data or rich patch pages. It checks that patch prose, extracted game data, structured version history, and UI rendering agree with each other.

Always start by reading `docs/I18N.md`, then tailor the checks to the touched resource types.

## Static Checks

1. Identify the patch version and changed files from `git status --short`, recent commits, and `git diff --name-only`.
2. Re-read `docs/I18N.md` and note whether the change touches service locale, game locale, rich patch prose, or game-origin text.
3. Run:

```bash
pnpm i18n:validate
pnpm codex:validate
pnpm codex:validate-references
```

4. Run `pnpm lint` when TypeScript, React, CSS, scripts, generated data handling, or rich-rendering behavior changed.
5. Run `pnpm tsc --noEmit` or `pnpm build` when the work touched routes, metadata, server/client boundaries, shared data loading, or Compendium versioning code.

## Data Integrity Checks

For every patch-touched resource:

- Confirm `data/sts2/meta.json` matches the extracted game version expected for the patch.
- Confirm the resource exists in both `data/sts2/eng/**` and `data/sts2/kor/**` when it must remain visible historically.
- Confirm `data/sts2-changes.json` has a same-patch `STS2Change` record with `entityType`, `entityId`, `summary`, `summaryKo`, visible `diffs`, and complete `fieldDiffs`.
- Confirm monster behavior changes include concrete fields such as HP, damage/block values, moves, bestiary moves, initial powers, or encounter data instead of only prose.
- Confirm `visualDiff` records, such as monster-pattern diffs, are backed by `fieldDiffs`.
- Confirm no manual `data/sts2-entity-versions.json` edits or one-off component reconstruction were added.
- For changed art, confirm official and beta/placeholder assets are not collapsed into one file. Epoch official art must live in `public/images/sts2/epochs/`; epoch beta/placeholder art must live in `public/images/sts2/epochs-beta/`, including restored pre-patch beta art when the current PCK no longer ships it.

## Deprecated Resource Checks

For each resource that becomes deprecated in the patch:

- Both locale JSON files include `deprecated: true` and `deprecatedInPatch: "vX.Y.Z"`.
- `data/sts2-changes.json` includes `fieldDiffs` for `deprecated` false to true and `deprecatedInPatch` null to the patch version.
- The data loader still includes the resource for historical pages even if current game localization removed its title.
- Current/deprecated version rendering is muted: grayscale, desaturated, and opacity-reduced where the design uses that treatment.
- Versions from the resource's first appearance through the patch immediately before deprecation render the normal colored asset.
- Links remain valid from historical patch notes, patch-history rails, related-resource rails, detail pages, modals, and hover previews.

Check at least these surfaces when they exist for the resource type:

- Compendium index tile
- Resource detail page
- Resource modal
- Game hover tip or patch-note preview
- Main asset inside the detail/modal preview
- Patch-history rail

## Patch Page Checks

Inspect the target patch route in the browser:

- Korean service route, such as `/patches/0.107.0`.
- English service/game route, such as `/en/patches/0.107.0`.
- Patch index route `/patches` when patch metadata, representative art, status, or cache-busting data changed.

When locale cookies affect the route, set:

- `sts-service-locale=ko`
- `sts-game-locale=kor`

Verify:

- Rich keywords with type hints open the intended card, relic, potion, power, event, monster, encounter, or ancient.
- Ambiguous names do not link to the wrong resource. Monster move mentions should use the parent monster preview when the move is not a standalone power.
- Unknown gold terms render as styled text without broken modal links.
- Buff and nerf labels use the project text-effect contract: green+sine for buffs, red+jitter for nerfs.
- Deprecated resource previews match the patch/version context: grayscale from the deprecation patch onward, colored before it.
- Changed STS2 art URLs include the current `?v=vX.Y.Z` cache-busting query parameter, either from `StaticImage` or `cacheBustSts2ImageUrl()`.

For Compendium epoch art changes, also verify:

- `/compendium/epochs` shows the normal official art by default.
- `?beta=true` or the beta-art toggle shows `epochs-beta` art when available.
- `/compendium/epochs/{id}?beta=true` uses the beta-art asset in the detail hero and metadata path.
- Newly official epoch art from the patch still has its old beta/placeholder art available when historical art existed.

## Browser And Mobile Coverage

Use a local dev server when the changed route needs Next.js rendering. Prefer `http://127.0.0.1:3000` and stop/restart it only as needed for clean type checks.

Run `.codex/skills/mobile-viewport-qa/SKILL.md` when patch pages, Compendium pages, modals, rails, hover surfaces, or responsive layout changed.

Run `.codex/skills/animation-playback-qa/SKILL.md` when monster pattern diffs, SpinePlayer, VFX, canvas, or replay behavior changed.

## Reporting

Report:

- Commands run and whether they passed.
- Browser routes and version selections inspected.
- Resource IDs checked, especially deprecated IDs.
- Any skipped check with a concrete reason.
- Any fix made during QA, with its commit if the repository requires speculative commits.
