---
name: sts2-spine-assets
description: Extract and refresh Slay the Spire 2 monster Spine bodies and lightweight Spine VFX for the Compendium bestiary from the local PCK. Trigger after STS2 patches that may change monster art, animations, VFX, skins, or bestiary rendering.
---

# sts2-spine-assets

Refresh the Compendium bestiary Spine assets from the current local Slay the Spire 2 install.

## Source Of Truth

- PCK: `~/Library/Application Support/Steam/steamapps/common/Slay the Spire 2/SlayTheSpire2.app/Contents/Resources/Slay the Spire 2.pck`
- Version check: `.../Resources/release_info.json`
- Repo outputs:
  - `public/spine/sts2/monsters/**`
  - `public/spine/sts2/vfx/**`
  - `data/sts2/monster-spine-assets.json`
  - `data/sts2/spine-vfx-assets.json`

Do not create patch-versioned Spine folders by default. These files represent the latest local PCK state, like the current static STS2 image assets. Historical gameplay versioning belongs in patch notes and entity version data, not in bestiary rendering assets.

## Required Workflow

1. Confirm the local game install is on the intended patch:
   ```bash
   cat ~/Library/Application\ Support/Steam/steamapps/common/Slay\ the\ Spire\ 2/SlayTheSpire2.app/Contents/Resources/release_info.json
   ```
2. Ensure temporary texture decode dependencies exist:
   ```bash
   python3 -m pip install --target /tmp/sts2-spine-deps Pillow texture2ddecoder
   ```
3. Extract renderable Spine actors from the PCK:
   ```bash
   PYTHONPATH=/tmp/sts2-spine-deps PYTHONDONTWRITEBYTECODE=1 python3 scripts/extract-sts2-spine-assets.py --force
   ```
4. Build the runtime indexes:
   ```bash
   node scripts/build-sts2-spine-index.mjs
   ```
5. Review generated coverage before committing:
   ```bash
   find public/spine/sts2/monsters -mindepth 1 -maxdepth 1 -type d | wc -l
   find public/spine/sts2/vfx -mindepth 1 -maxdepth 1 -type d | wc -l
   node -e "const m=require('./data/sts2/monster-spine-assets.json'); const v=require('./data/sts2/spine-vfx-assets.json'); console.log({monsters:m.length, withVfx:m.filter(x=>Object.keys(x.moveEffects||{}).length).length, vfx:v.length, usableVfx:v.filter(x=>x.usable!==false).length})"
   ```
6. Commit generated asset changes and generated index changes as separate meaningful commits when practical, following `AGENTS.md`.

## Runtime Policy

- The website lazy-loads `@esotericsoftware/spine-player` only on monster detail pages with a generated `spineAsset`.
- Godot-extracted PNGs are rendered as straight alpha in the web player. Do not switch `premultipliedAlpha` back on unless the source extraction starts producing premultiplied textures.
- If WebGL, the Spine runtime, an atlas, a skeleton, a skin, or a selected animation fails, keep the existing static `monsters-render` image visible.
- `moveAnimations` are candidates from skeleton animation names, bestiary move ids, damage/block vars, and semantic move words such as buff, shield, goop, gaze, and charge. They are not a full recreation of the Godot combat scripting layer.
- `moveEffects` may play extracted Spine VFX when a move name clearly matches a lightweight VFX asset. Treat this as a best-effort visual overlay, not exact in-game timing, positioning, particles, shaders, or hit logic.
- `spine-vfx-assets.json` keeps unsupported VFX with `usable: false` and `parseError`; do not map those to moves until the web runtime can render them correctly.

## Alias And Toggle Notes

- Update `MONSTER_ALIASES` in `scripts/build-sts2-spine-index.mjs` when a Compendium monster id uses a shared actor folder or skin.
- Update `VFX_ALIASES` and `moveVfxCandidates()` when a new lightweight VFX should be mapped to moves.
- Do not hand-edit generated JSON except for emergency investigation. Prefer changing the extractor or index builder and regenerating.
- Future UI toggles should be backed by generated metadata rather than path conventions. Useful categories:
  - `static-only`: no renderable Spine actor in the PCK.
  - `unfinished`: implementation appears incomplete or parser output is partial.
  - `mimic`: the monster uses another actor/skin as a stand-in.
  - `unknown`: ambiguous extraction; show by default only if the render is clearly better than the static image.
- When classification is uncertain, do not guess in UI. Keep the asset as fallback-safe and document the uncertainty in the build script or generated metadata.

## Verification

Run:

```bash
pnpm codex:validate
pnpm lint
pnpm build
```

For visual QA, inspect several detail pages in a real browser with WebGL:

- `/compendium/bestiary/AXEBOT`
- `/compendium/bestiary/BOWLBUG_EGG`
- `/compendium/bestiary/ZAPBOT`
- `/compendium/bestiary/AEONGLASS`

Headless Playwright on this workspace may not expose WebGL. In that case, verify that the static fallback remains visible and note the WebGL limitation in the final report.
