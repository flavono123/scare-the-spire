---
name: shorts-diff-pair
description: Insert as-is and to-be Compendium stills into the CapCut diff-pair template for a Slay the Spire 2 patch short. Use when the user names a version for a 쇼츠, asks to fill the CapCut diff template, or wants before/after game-element pairs on the 슬서운이야기 brand frame.
---

# Shorts diff pair

Put approved before/after stills on the CapCut timeline. The frame is the brand and the version. Do not draw jitter, sine, circles, or diff captions on the video. Those effects are authored on the still in Transfigure, then copied.

## Frame

- Canvas 1080×1920.
- Top: site favicon plus `슬서운이야기`, font `경기천년바탕` (`public/fonts/GyeonggiCheonnyeonBatangBold.ttf`).
- Under that: the version only, same font. No element index.
- Center: one still, then the next still. Each holds 2.4 seconds.
- Audio is already the STS1 Act 2 `The City` bed.

Template draft:

`/Users/flavono123/Movies/CapCut/User Data/Projects/com.lveditor.draft/diff-pair-template`

Working scripts:

`/Users/flavono123/Movies/슬서운이야기-쇼츠/diff-pair/`

## Approval first

When the user names a version, list the elements whose tile or slab actually changes in that patch. Use structured field diffs. Mark prose-only changes and portrait-only changes separately. Wait for the user to approve the list before capturing or writing a CapCut project.

## Capture

For each approved element, save two PNGs:

- as-is: `/compendium/{type}/{id}?version={previous selectable version}`
- to-be: the same page at the named patch version

Use the detail page image download. The file name includes the version. Card tiles use `[data-card-tile]`. Relic slabs use `[data-relic-inspect-slab]`.

If the copied still should show a nerf or buff in the text, make that still in Transfigure first. The description toolbar there has the Pagestorm color swatches, sine, and jitter. Copy that image. Do not add those marks again in CapCut.

## Insert

From `/Users/flavono123/Movies/슬서운이야기-쇼츠/diff-pair`:

```bash
python3 insert_pairs.py --version 0.100.0 \
  --pair BELIEVE_IN_YOU before.png after.png \
  --pair ANOTHER before.png after.png
```

This writes a new CapCut draft `diff-v0.100.0` and registers it in CapCut's draft list. Restart CapCut if it was already open. Do not edit `diff-pair-template` in place.
