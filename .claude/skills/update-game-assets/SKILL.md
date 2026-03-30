# update-game-assets

Extract and update card/relic images from the local STS2 game installation.

This skill should be used when:
- "게임 에셋 업데이트", "카드 이미지 업데이트", "아트 추출", "PCK 추출"
- "update game assets", "extract card art", "update card images"
- After a new game patch to refresh card portraits
- When checking for beta→official art transitions

## How it works

The skill extracts card portrait images directly from the STS2 Godot PCK file:
1. Parses the PCK v3 format (no GDRE Tools needed)
2. Reads `.import` → `.ctex` mappings for card portraits
3. Extracts WebP data from GST2 compressed textures
4. Converts to PNG via Pillow

## Prerequisites

- STS2 installed via Steam (auto-detected on macOS/Windows/Linux)
- Python 3 with Pillow (`pip3 install Pillow`)

## Usage

Run the extraction script:

```bash
python3 scripts/extract-card-portraits.py [options]
```

### Common workflows

**Update all card art after a game patch:**
```bash
python3 scripts/extract-card-portraits.py --force
```

**Check what's new/changed without extracting:**
```bash
python3 scripts/extract-card-portraits.py --dry-run
```

**Extract only a specific character's cards:**
```bash
python3 scripts/extract-card-portraits.py --force --character ironclad
```

### Options

| Flag | Description |
|------|-------------|
| `--pck PATH` | Custom PCK file path (auto-detected by default) |
| `--output DIR` | Official art output dir (default: `public/images/spire-codex/cards/`) |
| `--beta-output DIR` | Beta art output dir (default: `public/images/spire-codex/cards-beta/`) |
| `--dry-run` | List files without extracting |
| `--diff-only` | Only extract changed files |
| `--force` | Overwrite existing files |
| `--character NAME` | Filter by character (ironclad, silent, defect, necrobinder, regent, colorless, curse, event, status, token, quest) |

## Output

- Official art → `public/images/spire-codex/cards/{name}.png`
- Beta art → `public/images/spire-codex/cards-beta/{name}.png`
- Format: 1000×760 RGB PNG

## Data source

- **PCK location (macOS):** `~/Library/Application Support/Steam/steamapps/common/Slay the Spire 2/SlayTheSpire2.app/Contents/Resources/Slay the Spire 2.pck`
- **Game version:** Read from `release_info.json` next to the PCK file
- **Image path in PCK:** `images/packed/card_portraits/{character}/{name}.png` → `.godot/imported/{name}.png-{hash}.ctex`

## Notes

- The PCK contains ~588 official + ~265 beta card portraits
- Some cards (~24) use Spine-rendered art and are not available as static images in the PCK
- Card portrait dimensions vary by card (native resolution from PCK)
