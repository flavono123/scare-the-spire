---
name: sts2-compendium-patch-sync
description: Turn a finished rich patch-note pass into machine-readable Slay the Spire 2 Compendium history (data/sts2-changes.json fieldDiffs and deprecated lifecycle), then QA it. Use after slseoun-patch or update-game-assets when a patch touches cards, relics, potions, powers, enchantments, afflictions, events, monsters, encounters, ancients, epochs, assets, localization, or removed resources.
---

# STS2 Compendium Patch Sync

Steam prose says what changed for players; extracted PCK/DLL data is the truth for names, numbers, assets and lifecycle. If the installed game is newer than `data/sts2/meta.json`, run `update-game-assets` first.

## Sync

1. List every resource the patch touches: `pnpm shorts:changes <version>` and `public/generated/sts2-resource-patch-index.json` (`pnpm sts2:resource-changes`), plus monster moves and power applications the prose describes.
2. Before values come from the build archive `~/sts2-builds/<previous>/canonical/*.json` or the pre-patch commit, never memory or prose. Cards, relics and potions start from `pnpm codex:diff --old <old-sts2-dir> --new data/sts2 --patch vX.Y.Z` (`--write` merges into `sts2-changes.json`); review the result against the prose.
3. One `STS2Change` per changed resource in `data/sts2-changes.json`: `patch`, `entityType`, `entityId`, `character`, `summary`, `summaryKo`, visible `diffs`, complete `fieldDiffs`, `relatedEntities`, and `visualDiff` when a special renderer helps (backed by `fieldDiffs`).
4. `fieldDiffs` are the only way old versions are rebuilt (`src/lib/codex-versioning.ts`). Never hand-author `data/sts2-entity-versions.json` or add one-off reconstruction in components.
5. Monster reworks record concrete fields (`minHp`/`maxHp` and ascension HP, `damageValues`, `blockValues`, `moves`, `bestiaryMoves`, `initialPowerApplications`, encounter membership), even when Steam only says "adjusted moveset".
6. Normalize labels: `enemy` → `monster`, legacy `blessing` → `relic`.
7. Art: official and beta/placeholder stay separate URLs (`epochs/` vs `epochs-beta/`; restore a removed placeholder from the pre-patch commit).

## Deprecated resources

Never delete the row. Keep the last canonical fields in both `data/sts2/{eng,kor}/<type>.json` with `deprecated: true` and `deprecatedInPatch: "vX.Y.Z"`, and add matching `fieldDiffs` (`deprecated` false → true, `deprecatedInPatch` null → version). From that patch on every surface (tile, detail, modal, hover, patch-history rail) renders muted; before it, colored. Links stay live for historical content, and loaders keep it even when current localization lost its title.

## QA

- `pnpm i18n:validate`, `pnpm codex:validate`, `pnpm codex:validate-references`, `pnpm audit:version-api`; `pnpm lint` when code changed. `bin/ssy tags <version>` for patch-note links.
- Browser: `/patches/<version>` and `/en/patches/<version>`; typed keywords open the intended resource, monster moves preview through their monster, unknown gold terms stay plain text. Deprecated resources are muted from the deprecation version and colored before it. Changed art URLs carry the `meta.json` `?v=` cache-buster (`StaticImage` / `cacheBustSts2ImageUrl()`); epoch beta art shows with `?beta=true`.
- `$mobile-viewport-qa` for layout changes, `$animation-playback-qa` for monster pattern diffs or Spine changes.
- Report commands run, routes and versions checked, resource ids (especially deprecated ones) and anything skipped with the reason.
