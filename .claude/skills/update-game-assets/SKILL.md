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

### 1. Images (portraits, nav icons)
Extracted from the PCK file as PNG/WebP.
- `scripts/extract-card-portraits.py` → `public/images/sts2/cards/`, `cards-beta/`
- `scripts/extract-nav-icons.py` → `public/images/sts2/nav/`

### 2. Entity text/structural data (JSON)
Parsed from PCK localization + decompiled `sts2.dll`:
- `scripts/parse-enchantments.py` → `data/sts2/{eng,kor}/enchantments.json`
- `scripts/parse-monsters.py`    → `data/sts2/{eng,kor}/monsters.json`
- `scripts/parse-encounters.py`  → `data/sts2/{eng,kor}/encounters.json`

Each parser uses DLL C# as source of truth for gameplay numbers
(HP, damage, room type, monster composition) and the PCK localization
tables for Korean/English display strings.

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

# 3. Refresh entity data (names, HP, moves, damage, room types, etc.)
python3 scripts/parse-enchantments.py
python3 scripts/parse-monsters.py
python3 scripts/parse-encounters.py

# 4. Dry-run first if you want to review the diff:
python3 scripts/parse-monsters.py --dry-run
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

## Shared library

`scripts/lib/pck.py` exposes `PCKReader` (Godot 4.x v2/v3 format) and
`group_loc_by_id()`. New parsers should import from it rather than
re-implementing the PCK format.

## Notes

- The PCK contains ~588 official + ~265 beta card portraits; some use
  Spine-rendered art and are not available as static images.
- Enchantment/monster/encounter parsers skip `DEPRECATED_*` and `MOCK_*`
  prefixes (test/legacy entries).
- Some locale IDs (e.g. `HATCHLING`, `THE_ARM`, `THE_BELL`) exist only in
  localization with no corresponding C# class — parsers keep the name but
  leave structural fields (HP, moves, composition) null.
- Monster move IDs in the DLL often carry a `_MOVE` suffix
  (`PECK_MOVE`); parsers strip it for the canonical `moves[].id`.
- Damage/block property names in the DLL are like `FooDamage` /
  `FooBlock`; parsers strip the suffix so the JSON key is just `Foo`.
