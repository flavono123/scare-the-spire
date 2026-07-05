---
name: update-game-assets
description: Use after every Slay the Spire 2 game patch, before patch-note enrichment, to extract the local PCK/DLL and refresh STS2 Codex assets, localization, structural data, and baked vars. Trigger for game asset updates, PCK extraction, card art refresh, monster/enchantment/encounter sync, or new patch data prep.
---

# update-game-assets

Extract current STS2 game files and refresh Codex data from the local Steam install. This is a required dependency for `slseoun-patch` whenever the patch changes gameplay text, numbers, images, monsters, encounters, enchantments, relics, potions, powers, cards, or localization.

## Source Of Truth

- PCK: `~/Library/Application Support/Steam/steamapps/common/Slay the Spire 2/SlayTheSpire2.app/Contents/Resources/Slay the Spire 2.pck`
- DLL: `~/Library/Application Support/Steam/steamapps/common/Slay the Spire 2/SlayTheSpire2.app/Contents/Resources/data_sts2_macos_arm64/sts2.dll`
- Version: `.../Resources/release_info.json`
- Repo output: `data/sts2/**`, `public/images/sts2/**`, `public/spine/sts2/**`, `data/sts2/meta.json`
- Legacy source skill: `.claude/skills/update-game-assets/SKILL.md` if deeper parser notes are needed.

## Fast Patch Workflow

1. Confirm the local game install has updated to the target patch version by reading `release_info.json`.
2. Decompile the current DLL:
   ```bash
   DLL=~/Library/Application\ Support/Steam/steamapps/common/Slay\ the\ Spire\ 2/SlayTheSpire2.app/Contents/Resources/data_sts2_macos_arm64/sts2.dll
   rm -rf /tmp/sts2-src
   PATH="$HOME/.dotnet/tools:$PATH" ilspycmd -p -o /tmp/sts2-src "$DLL"
   ```
3. Refresh localization and structural data first. This is the minimum path for
   fast rich patch work:
   ```bash
   pnpm i18n:sync
   python3 scripts/parse-enchantments.py
   python3 scripts/parse-monsters.py
   python3 scripts/parse-encounters.py
   python3 scripts/parse-entity-vars.py
   ```
4. Refresh only the likely affected assets. Do not pass `--force` by default:
   ```bash
   python3 scripts/extract-card-portraits.py
   env PYTHONPATH=/tmp/sts2-spine-deps:. PYTHONDONTWRITEBYTECODE=1 python3 scripts/extract-epoch-portraits.py
   env PYTHONPATH=. python3.12 scripts/extract-map-assets.py
   env PYTHONPATH=. python3.12 scripts/extract-boss-icons.py
   env PYTHONPATH=. python3.12 scripts/extract-sts2-ancient-assets.py
   ```
   Use `python3 scripts/extract-card-portraits.py --diff-only` only when a
   patch may have replaced existing card art. Use `--force` only for a targeted
   full rebuild or after confirming changed existing assets. If any asset
   command writes files, run `pnpm sts2:index-images` after the asset pass.
5. Run Spine extraction only when monsters, ancients, VFX, bestiary rendering,
   or Spine assets may have changed:
   ```bash
   PYTHONPATH=/tmp/sts2-spine-deps PYTHONDONTWRITEBYTECODE=1 python3 scripts/extract-sts2-spine-assets.py
   PYTHONPATH=/tmp/sts2-spine-deps PYTHONDONTWRITEBYTECODE=1 python3 scripts/extract-sts2-spine-assets.py --kind ancients
   node scripts/build-sts2-spine-index.mjs
   pnpm sts2:index-images
   ```
   Use the `sts2-spine-assets` skill for dependency setup, coverage review,
   fallback policy, and VFX-specific notes.
   `scripts/extract-epoch-portraits.py` must keep timeline art split by source:
   official portraits go to `public/images/sts2/epochs/`, while placeholder/beta
   portraits go to `public/images/sts2/epochs-beta/`. When a patch promotes an
   epoch from beta/placeholder art to official art and the new PCK no longer
   ships its placeholder file, restore the old placeholder from the pre-patch
   commit into `epochs-beta/` instead of losing it.
   After event data changes, compare each `AncientEventModel.AllPossibleOptions`
   in `/tmp/sts2-src/MegaCrit.Sts2.Core.Models.Events/*.cs` against the
   corresponding `data/sts2/{eng,kor}/events.json` `relics` array. Ancient
   relics not listed there will disappear from the relic index's Ancient
   subgroups.
6. Apply incremental Codex entity diffs for patch-note changes that scripts cannot infer:
   - Cards: `data/sts2/{eng,kor}/cards.json`
   - Relics: `data/sts2/{eng,kor}/relics.json`
   - Potions: `data/sts2/{eng,kor}/potions.json`
   - Powers: `data/sts2/{eng,kor}/powers.json`
   - Events/enchantments/monsters/encounters when patch notes mention changes not covered by parsers
7. Update `data/sts2/meta.json` to the extracted game version and current extraction date.
8. Review diffs before each commit. Commit after each meaningful edit, matching `AGENTS.md`.

## Asset Extraction Rules

- Card portraits are WebP-first. `scripts/extract-card-portraits.py` uses
  existing `.webp` files as the skip marker and does not write `.png` files
  unless `--write-png` is explicitly passed.
- The repository currently serves/tracks card portrait `.webp` files, not card
  portrait `.png` files. Do not create or commit card PNG intermediates during
  normal patch work.
- Existing non-card PNG files under `public/images/sts2/**` are UI, map,
  run-history, intent, or patch-specific assets. Treat them separately from
  card portrait intermediates.
- The patch Worker copies public assets referenced by generated patch HTML/CSS.
  Do not add unreferenced PNG intermediates to patch pages.
- Omit `--force` on extractors for the first pass. Most asset extractors skip
  existing outputs without `--force`, which is the desired fast path for patch
  notes that mainly change text, numbers, or new resources.
- Use targeted `--force` or script-specific filters only after Steam notes,
  extracted data, or visual QA indicates existing art actually changed.

## Regression Guards

- Do not generate final rich patch notes against stale Codex data. If the target version is newer than `data/sts2/meta.json`, run this skill first.
- Always run `python3 scripts/parse-entity-vars.py` after DLL decompile. Literal `{Var}` leaks in relic/potion/power descriptions mean the patch is not ready.
- If parser coverage drops sharply, inspect new `MegaCrit.Sts2.Core.Localization.DynamicVars` or `MegaCrit.Sts2.Core.Models.*` directories in `/tmp/sts2-src` and update scripts plus this skill in the same commit.
- Newly added cards/relics/potions must have both English and Korean names from PCK localization before patch-note entity linking is considered valid.
- `pnpm codex:validate` must report zero Ancient relic owner coverage errors.
  This guards the relic index against new Ancient/Neow relics that exist in
  `relics.json` but are absent from `events.json` Ancient `relics` mappings.
- For patch-note-only balance changes, record the structured change in `data/sts2-changes.json`. Put machine-applicable diffs in the same record's `fieldDiffs`; do not hand-author `data/sts2-entity-versions.json`.
- When any `public/images/sts2/**` asset changes, make sure rendered UI and metadata either use `src/components/ui/static-image.tsx` or pass direct image URLs through `cacheBustSts2ImageUrl()`. The cache-buster comes from `data/sts2/meta.json`, so update the meta version before validating changed art.

## Verification

Run the narrow checks that match the modified files:

```bash
pnpm codex:validate
pnpm lint
```

For visual asset or tooltip-sensitive updates, start the dev server and inspect the affected Codex and patch pages in the browser.
For changed STS2 art, inspect at least one rendered `<img>` or OG/patch-art URL and confirm it includes the current `?v=vX.Y.Z` query parameter.
