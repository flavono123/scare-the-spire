---
name: shorts-asset-handoff
description: Move scare-the-spire shorts source artifacts and captured game-element images into the local slseoun-shorts repo. Use when a short needs captured card or relic stills, a brand asset export, or any file that would otherwise land in this repo's public or data trees.
---

# Shorts asset handoff

Shorts editing does not happen in this repository. The local repo is
`/Users/flavono123/P/slseoun-shorts`. It has no git remote. Do not create one.

This repository stays the source of game data and the running Compendium.
Captured stills, Kdenlive projects, plates, and audio belong in slseoun-shorts.

## Do not put shorts files here

Do not add shorts PNG, MP4, Kdenlive projects, plates, or extracted game audio
under `public/`, `data/`, or `scripts/`. Those paths are on the Cloudflare
deploy scan. A skill file under `.codex/skills/` is not.

Do not move `public/fonts/GyeonggiCheonnyeonBatangBold.ttf` out of this repo.
The site uses it. A short may copy that file into slseoun-shorts. It may not
be the only copy.

Do not copy `data/sts2-changes.json` or Compendium JSON into slseoun-shorts.
Read version diffs from this repo, then export the rendered still.

## Where files go

| Artifact | Destination |
| --- | --- |
| Downloaded card, relic, or other element still | `/Users/flavono123/P/slseoun-shorts/kdenlive/stills/v{version}/{id}-before.png` and `{id}-after.png` |
| Brand favicon export | `/Users/flavono123/P/slseoun-shorts/assets/brand-favicon.png` |
| STS1 audio | Already at `/Users/flavono123/P/slseoun-shorts/audio/sts1/`. Add new STS1 audio there. Do not put it in this repo. |
| Kdenlive project | Built in slseoun-shorts by `kdenlive/build_project.py` |

Capture stills in this repo with the Compendium image download button, then
move the files. Do not screenshot the page. The download button is
`[data-compendium-download-image]`. Card tiles are `[data-card-tile]`. Relic
slabs are `[data-relic-inspect-slab]`.

After the stills are in slseoun-shorts, build the short there. The Kdenlive
CLI skill for that repo is `.codex/skills/cli-anything-kdenlive/SKILL.md`.
