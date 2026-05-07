---
name: codex-pet-sprite
description: Extract Slay the Spire 2 Spine actors from the local Godot PCK and render them as Codex custom pet spritesheets. Use when Codex needs to make or update a custom pet from STS2 characters, monsters, summons, objects, or other Spine-based game actors; map body animations to Codex pet states; debug pet spritesheet size, frame grid, preview, idle, hover, running, waiting, failed, or review behavior.
---

# Codex Pet Sprite

Create Codex custom pets from STS2 Spine assets. Prefer body-only animation first; add VFX only after the body sheet works.

## Output Contract

Codex custom pets live at `${CODEX_HOME:-$HOME/.codex}/pets/<pet-id>/`:

```json
{
  "id": "<pet-id>",
  "displayName": "<Display Name>",
  "description": "...",
  "spritesheetPath": "spritesheet.webp"
}
```

The spritesheet must be `1536x1872`, WebP or PNG, transparent, arranged as an `8x9` grid of `192x208` cells:

| Row | Codex state | Frames | Typical STS2 mapping |
|---:|---|---:|---|
| 0 | `idle` | 6 | `idle_loop`, `idle`, `relaxed_loop` |
| 1 | `running-right` | 8 | `run`, `walk`, `relaxed_loop` |
| 2 | `running-left` | 8 | same as row 1, mirrored |
| 3 | `waving` | 4 | `cast`, skill/power animation |
| 4 | `jumping` | 5 | `attack` hover animation |
| 5 | `failed` | 8 | `hurt`, `die` fallback |
| 6 | `waiting` | 6 | `relaxed_loop`, idle fallback |
| 7 | `running` | 6 | active-work animation, often `cast` |
| 8 | `review` | 6 | idle or celebratory animation |

Keep scale constant across all rows to avoid hover/action states shrinking.

## Workflow

1. Find a Spine actor prefix in the PCK. The prefix has sibling imports:
   `<prefix>.atlas.import`, `<prefix>.skel.import`, `<prefix>.png.import`.

2. Extract the actor:

```bash
PYTHONPATH=/tmp/pillow-py:/tmp/texture2ddecoder-py PYTHONDONTWRITEBYTECODE=1 \
python3 .claude/skills/codex-pet-sprite/scripts/extract-spine-actor.py \
  --asset animations/characters/defect/defect \
  --out /tmp/sts2-pets/defect \
  --name defect
```

Install Python dependencies in a temp path if missing:

```bash
python3 -m pip install --target /tmp/pillow-py Pillow
python3 -m pip install --target /tmp/texture2ddecoder-py texture2ddecoder
```

3. Prepare Node render dependencies in a temp project, never in the repo unless explicitly asked:

```bash
mkdir -p /tmp/codex-pet-node
cd /tmp/codex-pet-node
npm init -y
npm install @esotericsoftware/spine-canvas @napi-rs/canvas
```

4. Render and install the pet:

```bash
cd /tmp/codex-pet-node
node /Users/hansuk.hong/P/scare-the-spire/.claude/skills/codex-pet-sprite/scripts/render-codex-pet.mjs \
  --input /tmp/sts2-pets/defect \
  --pet-id defect-demo \
  --display-name "Defect Demo" \
  --description "STS2 Defect body-only Spine animation frames mapped to Codex pet states."
```

Use `--fit-mode height` for humanoids whose attack or weapon frames make the strict full-bounds fit too small. This keeps all rows at one scale but allows extreme weapon arcs to clip instead of shrinking the whole pet.
Use `--scale-multiplier 1.1` or similar when a specific actor still reads too small after fit selection. This preserves the Codex sheet format but may clip wide weapons or effects.
Use `--skin <name>` when a Spine actor has visual variants such as alternate hair, crests, eggs, or equipment. The renderer combines that skin with the default skin.
Use `--offset-x -20 --offset-y 20` or profile `offsetX`/`offsetY` when the Codex overlay chrome covers a key part of the pet. Negative X moves left; positive Y moves down.

5. Inspect:

- `${CODEX_HOME:-$HOME/.codex}/pet-builds/<pet-id>/state-rows-preview.png`
- `${CODEX_HOME:-$HOME/.codex}/pet-builds/<pet-id>/idle-row-preview.png`
- `${CODEX_HOME:-$HOME/.codex}/pet-builds/<pet-id>/build-info.json`
- `${CODEX_HOME:-$HOME/.codex}/pets/<pet-id>/spritesheet.webp`

6. Validate:

```bash
magick identify "${CODEX_HOME:-$HOME/.codex}/pets/<pet-id>/spritesheet.webp"
```

Expect `WEBP 1536x1872` with alpha.

## Actor Discovery

Use the bundled helper to list candidate actor prefixes:

```bash
PYTHONDONTWRITEBYTECODE=1 \
python3 .claude/skills/codex-pet-sprite/scripts/list-spine-actors.py --prefix animations/characters/
```

If the prefix only has `.skel.import` but no matching `.atlas.import` or `.png.import`, it is not directly renderable with the bundled helper.

## Profiles

Use a JSON profile when the automatic animation mapping is poor:

```json
{
  "fitMode": "height",
  "scaleMultiplier": 1.1,
  "offsetX": -20,
  "offsetY": 20,
  "skin": "version1",
  "hiddenSlotPatterns": ["^binder_", "^blender-"],
  "auxLoops": ["_ignore/cloth_loop", "_ignore/glow_loop"],
  "rows": [
    { "state": "idle", "animation": "idle_loop", "loop": true, "times": [1.0, 1.1, 1.2, 1.3, 1.4, 1.5] },
    { "state": "jumping", "animation": "attack", "loop": false }
  ]
}
```

Render with `--profile /path/to/profile.json`.

## Notes

- Body-only is the default approach. VFX scenes (`scenes/vfx/...`) are separate Godot compositions and should be treated as a later compositing task.
- Some Spine exports include effect slots inside the skeleton. Hide those with `--hide-slot-regex` or `hiddenSlotPatterns`.
- Built-in Codex pet animation is driven by sprite-grid row/column CSS, not animated WebP frames.
- Hover triggers Codex `jumping`; active work triggers `running`; waiting states trigger `waiting`; errors trigger `failed`; review/success states trigger `review`.
