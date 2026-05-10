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
- Repo output: `data/sts2/**`, `public/images/sts2/**`, `data/sts2/meta.json`
- Legacy source skill: `.claude/skills/update-game-assets/SKILL.md` if deeper parser notes are needed.

## Required Workflow

1. Confirm the local game install has updated to the target patch version by reading `release_info.json`.
2. Decompile the current DLL:
   ```bash
   DLL=~/Library/Application\ Support/Steam/steamapps/common/Slay\ the\ Spire\ 2/SlayTheSpire2.app/Contents/Resources/data_sts2_macos_arm64/sts2.dll
   rm -rf /tmp/sts2-src
   PATH="$HOME/.dotnet/tools:$PATH" ilspycmd -p -o /tmp/sts2-src "$DLL"
   ```
3. Refresh extracted assets and parsed structural data:
   ```bash
   python3 scripts/extract-card-portraits.py --force
   env PYTHONPATH=. python3.12 scripts/extract-map-assets.py --force
   env PYTHONPATH=. python3.12 scripts/extract-boss-icons.py --force
   python3 scripts/parse-enchantments.py
   python3 scripts/parse-monsters.py
   python3 scripts/parse-encounters.py
   python3 scripts/parse-entity-vars.py
   ```
4. Apply incremental Codex entity diffs for patch-note changes that scripts cannot infer:
   - Cards: `data/sts2/{eng,kor}/cards.json`
   - Relics: `data/sts2/{eng,kor}/relics.json`
   - Potions: `data/sts2/{eng,kor}/potions.json`
   - Powers: `data/sts2/{eng,kor}/powers.json`
   - Events/enchantments/monsters/encounters when patch notes mention changes not covered by parsers
5. Update `data/sts2/meta.json` to the extracted game version and current extraction date.
6. Review diffs before each commit. Commit after each meaningful edit, matching `AGENTS.md`.

## Regression Guards

- Do not generate final rich patch notes against stale Codex data. If the target version is newer than `data/sts2/meta.json`, run this skill first.
- Always run `python3 scripts/parse-entity-vars.py` after DLL decompile. Literal `{Var}` leaks in relic/potion/power descriptions mean the patch is not ready.
- If parser coverage drops sharply, inspect new `MegaCrit.Sts2.Core.Localization.DynamicVars` or `MegaCrit.Sts2.Core.Models.*` directories in `/tmp/sts2-src` and update scripts plus this skill in the same commit.
- Newly added cards/relics/potions must have both English and Korean names from PCK localization before patch-note entity linking is considered valid.
- For patch-note-only balance changes, record machine-applicable diffs in `data/sts2-entity-versions.json` or `data/sts2-changes.json` following the existing schema.

## Verification

Run the narrow checks that match the modified files:

```bash
pnpm codex:validate
pnpm lint
```

For visual asset or tooltip-sensitive updates, start the dev server and inspect the affected Codex and patch pages in the browser.
