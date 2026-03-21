# Spire Codex Update Status

**Report date:** 2026-03-21
**Source:** https://spire-codex.com (GitHub: ptrlrd/spire-codex)

## Current Local Data Age

| Item | Last Downloaded | Notes |
|------|----------------|-------|
| `data/spire-codex/eng/cards.json` | 2026-03-18 | 576 cards |
| `data/spire-codex/eng/relics.json` | 2026-03-18 | 288 relics |
| `data/spire-codex/changelogs.json` | 2026-03-18 | 4 entries (up to v1.0.3) |
| `data/spire-codex/images-index.json` | 2026-03-18 | 1,647 images across 13 categories |
| `public/images/spire-codex/cards/` | 2026-03-18 | 612 card images |

All remote static images have `Last-Modified` dates of 2026-03-07 to 2026-03-08, well before the local download. **No new images have been uploaded.**

## What's New on Remote (since 2026-03-18)

### 1. Changelog v1.0.4 (2026-03-20)

The remote `/api/changelogs` now has **5 entries** (local has 4). The new entry:

- **v1.0.4** (2026-03-20): "SEO overhaul, tooltip widget, comparison pages, and data fixes"

This is a spire-codex site update, not a game patch. No new card/relic/potion data.

### 2. New `compendium_order` Field

The remote `/api/cards` and `/api/relics` responses now include a `compendium_order` field (integer) that was not present when data was downloaded. This reflects the in-game compendium sort order, added in spire-codex commit `Add compendium sort order for cards, relics, and potions` (2026-03-20).

**Local data is missing this field.** If compendium ordering is desired in the UI, a re-download is needed.

### 3. Relic Count: +1

Remote `/api/stats` reports **289 relics** vs local **288 relics**. One relic was likely fixed/added (the commit "Assign upgraded starter relics to their character pool" on 2026-03-20 may account for this).

### 4. No New Images

Remote image counts match local exactly:

| Category | Local | Remote |
|----------|-------|--------|
| cards | 612 | 612 |
| characters | 46 | 46 |
| monsters | 127 | 127 |
| relics | 314 | 314 |
| potions | 63 | 63 |
| icons | 12 | 12 |
| ancients | 8 | 8 |
| bosses | 12 | 12 |
| npcs | 4 | 4 |
| renders | 125 | 125 |
| cards-beta | 265 | 265 |
| relics-beta | 50 | 50 |
| monsters-beta | 9 | 9 |

Note: `/api/stats` reports 1,913 total images (likely counting render subdirectory files individually), while `/api/images` index sums to 1,647. This discrepancy existed at download time and is unchanged.

## Sloth (나태) Card Image Status

The local `sloth.png` (264 KB, 1000x760, RGBA PNG) is the **official art** -- a cartoon illustration of a smiling sloth animal with sparkles against a green leaf background. This matches the current image served by spire-codex.com (remote `Last-Modified: 2026-03-07`).

The beta art version also exists locally at `public/images/spire-codex/cards-beta/sloth.png`.

**The "나태" card already has its official art in the project. No update is needed for this card.**

## How to Update

To refresh only the changed data (not images):

```bash
# 1. Delete stale JSON files to force re-download
rm data/spire-codex/changelogs.json
rm data/spire-codex/eng/cards.json
rm data/spire-codex/eng/relics.json
rm data/spire-codex/eng/potions.json
rm data/spire-codex/kor/cards.json
rm data/spire-codex/kor/relics.json
rm data/spire-codex/kor/potions.json

# 2. Re-run the download script (skips existing files)
bash scripts/download-spire-codex.sh
```

To do a full re-download (all data + images):

```bash
# Remove all data and re-download
rm -rf data/spire-codex/eng/ data/spire-codex/kor/ data/spire-codex/changelogs.json data/spire-codex/images-index.json
bash scripts/download-spire-codex.sh
```

Note: The download script (`scripts/download-spire-codex.sh`) skips files that already exist. To force re-download of specific files, delete them first.

## Summary

| Change | Impact | Action Needed |
|--------|--------|---------------|
| Changelog v1.0.4 added | Low (display only) | Optional re-download |
| `compendium_order` field on cards/relics/potions | Medium (enables in-game sort order) | Re-download JSON data |
| +1 relic in data | Low | Re-download relics.json |
| Sloth card art | None -- already up to date | No action |
| New images | None -- no changes | No action |
