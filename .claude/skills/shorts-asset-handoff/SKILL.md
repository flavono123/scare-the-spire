---
name: shorts-asset-handoff
description: Route 슬서운이야기 쇼츠 work to the local slseoun-shorts repo and capture site renders for it. Use when the user asks for a short (쇼츠) from this repo, wants card, relic, or other game-element stills or plates for a video, or is about to save shorts PNG, MP4, project, or audio files here.
---

# Shorts asset handoff

Shorts are made in `/Users/flavono123/P/slseoun-shorts`. It has no git remote.
Do not create one. Its `docs/CONVENTIONS.md` and its `version-short` skill
own the format. If the user starts a short here, say so and offer to continue
in that repo.

This repo provides two commands for it:

| Command | Output |
| --- | --- |
| `pnpm shorts:changes --versions` | Versions the Compendium picker offers, with change counts by type |
| `pnpm shorts:changes <version>` | Elements changed in that patch, Korean as-is and to-be text, capture targets |
| `pnpm shorts:texts --batch shots.json` | Each shot's name and text in every game locale, for subtitles (`texts.json`) |
| `pnpm shorts:capture --target cards/ID@version --out file.png` | The Compendium download-button render at fixed 3x, plus `file.png.json` |

`shorts:capture` needs `pnpm dev` (or `pnpm dev:next`) on port 3000. It also
takes `--url`, `--mark`, `--replace`, `--locale eng`, and `--batch`. Run it
with no arguments for usage. Relative `--out` paths resolve from where pnpm was
invoked, so `pnpm -C ~/P/scare-the-spire shorts:capture ...` from the shorts
repo writes there.

## Do not put shorts files here

Do not add shorts PNG, MP4, Kdenlive projects, plates, or extracted game audio
under `public/`, `data/`, or `scripts/`. Those paths are on the Cloudflare
deploy scan.

Do not move `public/fonts/GyeonggiCheonnyeonBatangBold.ttf` out of this repo.
The site uses it. A short may copy it.

Do not copy `data/sts2-changes.json` or Compendium JSON into slseoun-shorts.
Read version text with `shorts:changes`, then capture the rendered still.

Do not screenshot a Compendium page for a plate. A page shot includes side tips.
Use `shorts:capture`, which clicks `[data-compendium-download-image]`.
