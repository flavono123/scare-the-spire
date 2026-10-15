---
name: shorts-diff-pair
description: Insert as-is and to-be Compendium stills into a Kdenlive short. Use when the user names a version for a 쇼츠, asks to fill the diff template, or wants before/after game-element pairs on the 슬서운이야기 brand frame.
---

# Shorts diff pair

Put approved before/after stills on a Kdenlive timeline. The frame is the brand and the version. Do not draw jitter, sine, circles, or diff captions on the video. Those effects are authored on the still in Transfigure, then copied.

Kdenlive has no CapCut project-template gallery. The reusable template is `build_project.py`. Title clips are `.kdenlivetitle` files.

## Frame

Organic YouTube Shorts cover the top ~192 px, the bottom ~576 px, and the right ~130 px of a 1080×1920 frame. The brand row sits under that top band, and the still sits above the bottom band. Placement numbers are in `brand-placement.md`.

- Canvas 1080×1920, 30 fps.
- Brand row: site favicon plus `슬서운이야기`. Font family `GyeonggiBatang` (경기천년바탕 Bold), installed in `~/Library/Fonts` from `public/fonts/GyeonggiCheonnyeonBatangBold.ttf`.
- Under that: the version only. No element index.
- Center: one still, then the next. Each holds 1.2 seconds. Within a pair the composition is Wipe. Between pairs it is Push Left. Both ship with Kdenlive; there is no paid set.
- Audio is the STS1 Act 2 `The City` bed at about -18 dB.

The short itself is built in `/Users/flavono123/P/slseoun-shorts`. Use
`shorts-asset-handoff` to move captured stills there. Do not store them in
this repo.

## Approval first

When the user names a version, list cards, relics, and potions changed in that patch. For each one print the as-is phrase and the to-be phrase as separate lines. Do not explain the diff. Next to the name, print 버프, 너프, or 리워크 from that patch note. If the note does not use one of those three, judge which of the three it is. Use reconstructed Korean text from the version API. Do not invent a phrase the data does not contain. Mark a row whose tile or slab text does not change, and leave it out of the video. Wait for the user to approve the video list before capturing or writing a project, unless they already asked to make the video from that list.

## Capture

For each approved element, save two PNGs by clicking the detail page's image download button (`[data-compendium-download-image]`). Do not screenshot the page. A page shot includes the side tips next to the card. The download renders only the tile or slab, with padding so the cost token is inside the image.

The detail payload's `versionDiffs` must match `data/sts2-changes.json`. If a local `public/generated/compendium-detail-*.json` is stale, refresh those diffs before downloading.

- as-is: `/compendium/{type}/{id}?version={previous selectable version}`
- to-be: the same page at the named patch version

## Insert

From `/Users/flavono123/P/slseoun-shorts/kdenlive`:

```bash
python3 build_project.py --version 0.100.0 \
  --pair PREPARED before.png after.png \
  --pair ANOTHER before.png after.png
```

This writes `projects/diff-v{version}.kdenlive`. Open that file in Kdenlive.
