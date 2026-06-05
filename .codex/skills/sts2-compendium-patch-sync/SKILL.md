---
name: sts2-compendium-patch-sync
description: Build Slay the Spire 2 Compendium patch diffs from freshly extracted PCK/DLL data after rich patch-note work, apply them to STS2 resource JSON and data/sts2-changes.json, and enforce versioned lifecycle/deprecated behavior. Use after slseoun-patch or update-game-assets when a patch touches cards, relics, potions, powers, enchantments, afflictions, events, monsters, encounters, ancients, epochs, assets, localization, or removed/deprecated resources.
---

# STS2 Compendium Patch Sync

## Overview

Turn a finished rich patch-note pass into machine-readable Compendium history. Steam prose identifies the player-facing changes; freshly extracted PCK/DLL data is the source of truth for names, descriptions, assets, monster data, and lifecycle.

Run this before declaring an STS2 patch complete whenever the patch mentions a Compendium resource or when `update-game-assets` changed `data/sts2/**`.

## Inputs

- Target patch version, including the leading `v`, such as `v0.107.0`.
- Steam/rich patch prose from `data/sts2-patch-notes/{version}.md` and `.ko.md`.
- Current extracted game data in `data/sts2/{eng,kor}/**` and `data/sts2/meta.json`.
- A previous game-data state from a pre-patch commit, backup directory, or generated old-data snapshot.
- Existing structured history in `data/sts2-changes.json`.

If the current local game version is newer than `data/sts2/meta.json`, run `.codex/skills/update-game-assets/SKILL.md` first.

## Workflow

1. Inventory every patch-note mention that maps to a Compendium resource: card, relic, potion, power, enchantment, affliction, event, monster, encounter, ancient, or epoch. Include monster moves and power applications when the note describes behavior, not only display text.
2. Compare previous and current extracted data. Use `git diff` against the pre-patch commit and, for supported cards/relics/potions, run:

```bash
npx tsx scripts/generate-entity-diffs.ts --old <old-sts2-dir> --new data/sts2 --patch vX.Y.Z
```

3. For unsupported resource types or fields, inspect the extracted JSON directly and author equivalent `fieldDiffs` by hand from source data. Do not infer values from memory or prose when PCK data is available.
4. Add or update one `STS2Change` record per changed resource in `data/sts2-changes.json`. Keep player-facing prose and machine reconstruction together:
   - `patch`, `entityType`, `entityId`, `character`
   - `summary` and `summaryKo`
   - visible `diffs`
   - reconstructable `fieldDiffs`
   - `relatedEntities` for real connected resources
   - `visualDiff` when a specialized renderer is useful
5. Keep `fieldDiffs` complete enough for `src/lib/codex-versioning.ts` to reconstruct previous versions. Do not hand-author `data/sts2-entity-versions.json` or add one-off reconstruction inside detail components.
6. Normalize Steam/game labels to Compendium labels: `enemy` becomes `monster`, and any legacy `blessing` change becomes `relic` when it is a Codex relic.
7. For changed art, keep official and beta/placeholder assets as separate served URLs. For epoch timeline art, official portraits belong under `public/images/sts2/epochs/` and beta/placeholder portraits belong under `public/images/sts2/epochs-beta/`; restore a pre-patch placeholder into `epochs-beta/` when the new PCK removed it.
8. Commit each meaningful data/UI/edit group immediately, following `AGENTS.md`.

## Resource Coverage

Cards, relics, and potions can start from `scripts/generate-entity-diffs.ts`, then must be reviewed against the prose so summaries, Korean summaries, related resources, and visible diffs are not missing.

For powers, enchantments, afflictions, events, monsters, encounters, ancients, and epochs, write `fieldDiffs` from extracted current data and prior extracted data or a pre-patch commit. For monster reworks, include every changed field needed by the bestiary and patch-history views, such as:

- `minHp`, `maxHp`, ascension HP fields
- `damageValues`, `blockValues`
- `moves`, `bestiaryMoves`
- `initialPowerApplications`
- encounter membership or sequencing when the patch changes where the monster appears

When prose says only "adjusted moveset" or similar, do not stop at a visual note. Record the concrete before/after fields so old versions render correctly.

## Deprecated Resources

Deprecated or removed resources must remain versionable and linkable for historical content.

When a resource existed before the patch but is removed from current PCK data or should no longer be active:

1. Keep the resource in both `data/sts2/eng/<type>.json` and `data/sts2/kor/<type>.json` using the last known canonical game fields from extracted data or the pre-patch commit.
2. Add `deprecated: true` and `deprecatedInPatch: "vX.Y.Z"` in both locale files.
3. Add matching `fieldDiffs` in `data/sts2-changes.json`:

```json
[
  { "field": "deprecated", "before": false, "after": true },
  { "field": "deprecatedInPatch", "before": null, "after": "vX.Y.Z" }
]
```

4. Ensure loaders keep the resource available when historical pages need it. If current game localization no longer has a title, the include-deprecated path must still include it.
5. Ensure index tiles, detail pages, modals, hover previews, patch-history rails, and related-resource rails read the versioned entity lifecycle state after `versionCodexEntities()` or `reconstructEntityAtVersion()`.
6. From `deprecatedInPatch` onward, render the main asset grayscale/desaturated/muted. From the resource's introduced version through the patch immediately before deprecation, render the normal colored asset.
7. Do not disable links for historical resources solely because they are deprecated. Patch notes and old-version Compendium pages must still navigate to the resource.

## Patch Note Links

After applying resource diffs, revisit rich patch markup:

- Use type hints for ambiguous names, such as `[gold:power]감쇠[/gold]` versus a monster move named `감쇠`.
- Monster move mentions should link through the parent monster when the target is not a standalone power/card/resource.
- Unknown game terms may stay `[gold]term[/gold]`, but they must not produce broken modal links.
- Use official Korean names from the extracted game data. Do not invent translations or normalize names by memory.

## Validation

Run focused checks after the sync:

```bash
pnpm i18n:validate
pnpm codex:validate
pnpm codex:validate-references
```

Run `pnpm lint` when TypeScript, React, CSS, scripts, or generated-data handling changed. Run `pnpm tsc --noEmit` or `pnpm build` when routing, data loading, metadata, or shared versioning code changed.

For lifecycle/deprecated work, verify in the browser:

- Current/deprecated version: index tile, detail page, modal, hover preview, and main asset are grayscale/desaturated.
- Previous/pre-deprecated version: the same resource is visible, linked, and colored.
- Patch page hover previews match the version context.
- Patch-history rails show the change and do not hide required structured history.

For changed STS2 art, verify cache busting as part of the browser pass. Rendered `<img>` URLs and direct metadata/patch-art URLs must include the current `?v=vX.Y.Z` query parameter by using `StaticImage` or `cacheBustSts2ImageUrl()`.

For a repeatable QA pass, run `.codex/skills/sts2-compendium-patch-qa/SKILL.md` after this skill once that sub-skill exists.
