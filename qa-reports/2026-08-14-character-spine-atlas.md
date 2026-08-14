# QA Report: 슬서운이야기

| Field | Value |
|-------|-------|
| **Date** | 2026-08-14 |
| **URL** | http://localhost:3000/compendium/characters/{regent,necrobinder,defect,ironclad,silent}?lowHp=1, http://localhost:3000/patches/0.111.0 |
| **Branch** | main |
| **Commit** | 2537a37e |
| **Tier** | Quick |
| **Scope** | Character Spine atlas region-not-found overlays (Regent bubble, Necrobinder slash, Defect deathspark) |
| **Pages visited** | 6 |

## Health Score: 94/100

| Category | Score |
|----------|-------|
| Console | 95 |
| Links | 95 |
| Visual | 90 |
| Functional | 95 |
| UX | 90 |
| Performance | 90 |
| Content | 95 |

## Top 3 Things to Fix

1. **ISSUE-004: Character Spine atlas regions missing** — Three different atlas-load failures hid Regent, Necrobinder, and Defect behind Spine error overlays.

## Summary

| Severity | Count |
|----------|-------|
| Critical | 1 |
| High | 0 |
| Medium | 0 |
| Low | 0 |
| **Total** | **1** |

## Issues

### ISSUE-004: Character Spine overlays from three different missing atlas regions

| Field | Value |
|-------|-------|
| **Severity** | critical |
| **Category** | console / functional |
| **URL** | http://localhost:3000/compendium/characters/regent?lowHp=1, /necrobinder, /defect |

**Description:** Each character failed Spine skeleton parse for a different atlas reason. The current files already contain the regions; the runtime was pairing or fetching the wrong atlas text.

1. **Regent** `Region not found in atlas: bubble (region attachment: bubble)` — `public/spine/sts2/characters/regent/` has both `regent.atlas` (has `bubble`) and `regent_weapon.atlas` (does not). The index builder used `files.find(.atlas)`, so readdir order could attach the weapon atlas to the body skeleton.
2. **Necrobinder** `Region not found in atlas: attack_slash/slash_placeholder (mesh attachment: ...)` — that mesh is the first region on atlas page 2 (`necrobinder_2.png`). A stale single-page atlas, or a fetch that never registered page 2, fails this mesh after page-1 body parts already exist.
3. **Defect** `Region not found in atlas: deathspark/deathspark03 (sequence: deathspark/deathspark)` — sequence frames `00`–`03` load in order. Failing specifically on `03` means `00`–`02` were found, which matches a truncated atlas that stopped after `deathspark02`.

Cross-cutting: `/spine/:path*` is `Cache-Control: immutable` with no content hash in the URL, so a browser can keep an old atlas after a re-extract. Spine's default `Downloader` also `overrideMimeType("text/html")`, which can HTML-sniff `.atlas` text.

**Repro Steps:**

1. Open `/compendium/characters/regent?lowHp=1`, `/necrobinder?lowHp=1`, and `/defect?lowHp=1` with a stale or wrongly paired atlas.
2. Wait for Spine to load.
3. **Observe:** `.spine-player-error` overlay with the region names above; Low HP idle / attack / die unusable.

---

## Fixes Applied

| Issue | Fix Status | Commit | Files Changed |
|-------|-----------|--------|---------------|
| ISSUE-004 | verified | 2537a37e | `scripts/build-sts2-spine-index.mjs`, `data/sts2/*-spine-assets.json`, `src/lib/spine-player-runtime.ts`, `monster-spine-stage.tsx`, `decimillipede-spine-stage.tsx`, `patch-static-spine-client.js`, `next.config.ts`, `validate-sts2-ancient-scenes.mjs` |

Verified locally after regenerating Compendium detail JSON and `pnpm patch:build`:

- `/compendium/characters/regent?lowHp=1`: hashed `regent.atlas?v=70c4f9fbca` (not weapon atlas), 1 canvas, no overlay. Attack and 사망 played without region errors.
- `/compendium/characters/necrobinder?lowHp=1`: hashed atlas, `necrobinder_2.png` fetched, 1 canvas, no overlay.
- `/compendium/characters/defect?lowHp=1`: hashed `defect.atlas?v=847da142f6`, 1 canvas, no overlay.
- Ironclad and Silent low-HP pages also loaded hashed atlases with no overlay.
- `/patches/0.111.0` **낮은 체력 대기** grid: 5 canvases, all five character atlases fetched with `?v=`, no `.spine-player-error`.

Remaining console noise is Cloudflare insights CORS and unused beacon preloads, unrelated.

## Ship Readiness

| Metric | Value |
|--------|-------|
| Health score | 70 → 94 (+24) |
| Issues found | 1 |
| Fixes applied | 1 |
| Deferred | 0 |

v0.111.0 stays `draft: true` until asked to finish.
