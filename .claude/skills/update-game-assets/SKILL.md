# update-game-assets

Extract and update STS2 game assets — card/relic images AND structured
entity data (monsters, encounters, enchantments) — directly from the local
game install.

This skill should be used when:
- "게임 에셋 업데이트", "카드 이미지 업데이트", "아트 추출", "PCK 추출"
- "몬스터 데이터 동기화", "인카운터 동기화", "인챈트 추출"
- "update game assets", "extract card art", "update card images"
- "sync monster data", "refresh encounter data"
- After a new game patch to refresh portraits AND text data
- When verifying past patch content (new enchantments, monsters, encounters) is reflected

## What gets updated

Two asset families, each with its own script:

### 1. Images (portraits, nav icons, map UI)
Extracted from the PCK file as PNG/WebP.
- `scripts/extract-card-portraits.py` → `public/images/sts2/cards/`, `cards-beta/`
- `scripts/extract-nav-icons.py` → `public/images/sts2/nav/`
- `scripts/extract-map-assets.py` → `public/images/sts2/map/`

### 2. Entity text/structural data (JSON)
Parsed from PCK localization + decompiled `sts2.dll`:
- `scripts/parse-enchantments.py` → `data/sts2/{eng,kor}/enchantments.json`
- `scripts/parse-monsters.py`    → `data/sts2/{eng,kor}/monsters.json`
- `scripts/parse-encounters.py`  → `data/sts2/{eng,kor}/encounters.json`
- `scripts/parse-entity-vars.py` → injects `vars` (default DynamicVar
  values) into `data/sts2/{eng,kor}/{relics,potions,powers}.json`

Each parser uses DLL C# as source of truth for gameplay numbers
(HP, damage, room type, monster composition, default `{Var}` template
values) and the PCK localization tables for Korean/English display
strings.

## Prerequisites

- STS2 installed via Steam (PCK auto-detected on macOS/Windows/Linux)
- Python 3.10+ with Pillow (`pip3 install Pillow`) — image scripts only
- **ILSpy CLI** for entity parsers. Install once:
  ```bash
  dotnet tool install -g ilspycmd
  export PATH="$HOME/.dotnet/tools:$PATH"
  ```

## Typical workflow after a new patch

```bash
# 1. Decompile the current sts2.dll (full project, ~25s)
DLL=~/Library/Application\ Support/Steam/steamapps/common/Slay\ the\ Spire\ 2/SlayTheSpire2.app/Contents/Resources/data_sts2_macos_arm64/sts2.dll
ilspycmd -p -o /tmp/sts2-src "$DLL"

# 2. Refresh card art (official + beta)
python3 scripts/extract-card-portraits.py --force

# 2.5 Refresh map UI assets (node icons, outlines, act backgrounds, markers)
python3 scripts/extract-map-assets.py --force

# 3. Refresh entity data (names, HP, moves, damage, room types, etc.)
python3 scripts/parse-enchantments.py
python3 scripts/parse-monsters.py
python3 scripts/parse-encounters.py

# 3.5 Refresh default {Var} values for relics/potions/powers
python3 scripts/parse-entity-vars.py

# 4. Dry-run first if you want to review the diff:
python3 scripts/parse-monsters.py --dry-run
python3 scripts/parse-entity-vars.py --dry-run
```

Each parser prints added/removed IDs vs the current repo data; review
the diff before committing.

## Options (entity parsers)

| Flag | Description |
|------|-------------|
| `--pck PATH` | Custom PCK file path (auto-detected by default) |
| `--source PATH` | Decompiled DLL source root (default `/tmp/sts2-src`) |
| `--dry-run` | Print summary only; no files written |

## Options (card portraits)

| Flag | Description |
|------|-------------|
| `--pck PATH` | Custom PCK file path |
| `--output DIR` | Official art output dir (default: `public/images/sts2/cards/`) |
| `--beta-output DIR` | Beta art output dir (default: `public/images/sts2/cards-beta/`) |
| `--dry-run` | List files without extracting |
| `--diff-only` | Only extract changed files |
| `--force` | Overwrite existing files |
| `--character NAME` | Filter by character (ironclad, silent, defect, necrobinder, regent, colorless, curse, event, status, token, quest) |

## Data source layout

- **PCK location (macOS):** `~/Library/Application Support/Steam/steamapps/common/Slay the Spire 2/SlayTheSpire2.app/Contents/Resources/Slay the Spire 2.pck`
- **DLL location (macOS arm64):** `.../Resources/data_sts2_macos_arm64/sts2.dll`
- **Game version:** `.../Resources/release_info.json` (tracked in `data/sts2/meta.json`)
- **PCK localization tables:** `localization/{lang}/{table}.json` (e.g. `localization/kor/monsters.json`)
- **PCK images:** `images/packed/card_portraits/{character}/{name}.png` → `.godot/imported/{name}.png-{hash}.ctex`
- **Map UI atlases:** `images/atlases/ui_atlas_*.png`, `images/atlases/compressed_0.png`, `images/packed/map/map_bgs/...`

## Shared library

`scripts/lib/pck.py` exposes `PCKReader` (Godot 4.x v2/v3 format) and
`group_loc_by_id()`. New parsers should import from it rather than
re-implementing the PCK format.

## Notes

- The PCK contains ~588 official + ~265 beta card portraits; some use
  Spine-rendered art and are not available as static images.
- Map node icons are mostly **AtlasTexture** crops from `ui_atlas` and
  `compressed_0` rather than standalone PNG files. `extract-map-assets.py`
  resolves the `.tres` atlas regions and decodes GPU-compressed `.ctex`
  textures through `scripts/lib/ctex.py`.
- `extract-map-assets.py` requires both **Pillow** and
  **texture2ddecoder** in the Python environment because STS2 ships the
  map atlases/backgrounds as BC7/BC3-compressed `.ctex` textures.
- Enchantment/monster/encounter parsers skip `DEPRECATED_*` and `MOCK_*`
  prefixes (test/legacy entries).
- Some locale IDs (e.g. `HATCHLING`, `THE_ARM`, `THE_BELL`) exist only in
  localization with no corresponding C# class — parsers keep the name but
  leave structural fields (HP, moves, composition) null.
- Monster move IDs in the DLL often carry a `_MOVE` suffix
  (`PECK_MOVE`); parsers strip it for the canonical `moves[].id`.
- Damage/block property names in the DLL are like `FooDamage` /
  `FooBlock`; parsers strip the suffix so the JSON key is just `Foo`.
- `parse-entity-vars.py` walks each entity's `CanonicalVars` override and
  understands the `XxxVar` shorthand surface in
  `MegaCrit.Sts2.Core.Localization.DynamicVars/`. The known shorthands are
  hardcoded in `DEFAULT_NAMES` at the top of the script.

## Self-update rule (read every patch)

The decompiled C# surface drifts patch-to-patch. Before declaring an
extraction "done", verify the parsers still cover what the new build adds
and **update this skill + scripts in the same commit** when they don't:

1. After running parsers, scan the dry-run output for unexpected dips in
   coverage (e.g. relics matched suddenly drops below the JSON ID count).
2. List new `XxxVar` shorthands MegaCrit may have added:
   ```bash
   /bin/ls /tmp/sts2-src/MegaCrit.Sts2.Core.Localization.DynamicVars
   ```
   Cross-check against `DEFAULT_NAMES` in `scripts/parse-entity-vars.py`
   and add any missing ones (read the new class to confirm its
   `defaultName` constant).
3. List new entity model directories:
   ```bash
   /bin/ls /tmp/sts2-src | grep "MegaCrit.Sts2.Core.Models\."
   ```
   If a kind we don't yet parse appears (e.g. `Models.Encounters` did),
   either extend `parse-entity-vars.py` or add a sibling parser, then
   document it in the bullet list above.
4. If the `CanonicalVars` syntax changes (e.g. a new collection helper
   replaces `_003C_003Ez__ReadOnlySingleElementList`), `find_var_calls`
   still works (it scans for `new XxxVar(...)`), but verify with a
   spot-check on a known relic like `DataDisk` (`{FocusPower: 1}`).
5. Rev `data/sts2/meta.json` to the new game version and commit
   parser changes + data refresh together so the diff reads as one
   patch rollup.
