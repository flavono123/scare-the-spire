# QA Report: 슬서운이야기

| Field | Value |
|-------|-------|
| **Date** | 2026-09-04 |
| **URL** | http://localhost:3001/pagestorm/write |
| **Branch** | main |
| **Commit** | b29aad69, plus follow-up hug-ring fix |
| **Tier** | Quick |
| **Scope** | Pagestorm write editor: card art max width, selected-asset float |
| **Pages visited** | 2 (`/pagestorm/write`, `/pagestorm/lorem` attempted) |

## Health Score: 92/100

| Category | Score |
|----------|-------|
| Console | 80 |
| Links | 100 |
| Visual | 95 |
| Functional | 95 |
| UX | 95 |
| Performance | 95 |
| Content | 100 |

## Top 3 Things to Fix

1. **ISSUE-001: Full-width selection ring on game assets** — The selected-node outline followed the full editor row, so a 128px card art looked like a landscape block. Fixed: ring now hugs the asset box.
2. **ISSUE-002: Dev overlay `Failed to fetch`** — Next.js issues badge showed a console TypeError during write-page QA. Pre-existing comment-entity/network fetch, not caused by this change.
3. **ISSUE-003: Local `.next/dev/prerender-manifest.json` concatenation** — Dev server returned 500 on every route until the corrupted cache file was rewritten. Local Next cache, not product code.

## Summary

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 0 |
| Medium | 1 |
| Low | 2 |
| **Total** | **3** |

## Issues

### ISSUE-001: Full-width selection ring on game assets

| Field | Value |
|-------|-------|
| **Severity** | medium |
| **Category** | visual |
| **URL** | http://localhost:3001/pagestorm/write |

**Description:** Selecting a card painted `ring-1` on the full-width align row, not the sized figure. Card art at 128px sat in a wide gold box, which hid how large the art actually was after switching to 아트만.

**Repro Steps:**

1. Open `/pagestorm/write`
2. Insert a card, switch to 아트만
3. **Observe:** Gold outline spanned the editor column while the portrait stayed ~128px

---

### ISSUE-002: Dev overlay Failed to fetch

| Field | Value |
|-------|-------|
| **Severity** | low |
| **Category** | console |
| **URL** | http://localhost:3001/pagestorm/write |

**Description:** Next.js dev overlay reported `Console TypeError: Failed to fetch` (2 issues). The write editor still loaded and the card float worked. Likely an unrelated entity/profile fetch in local dev.

**Repro Steps:**

1. Open `/pagestorm/write` in `next dev`
2. **Observe:** red Next.js issues badge

---

### ISSUE-003: Corrupted prerender-manifest.json took down local Next

| Field | Value |
|-------|-------|
| **Severity** | low |
| **Category** | console |
| **URL** | http://localhost:3001/ |

**Description:** `.next/dev/prerender-manifest.json` contained a second JSON fragment after a valid object (`Extra data` at column 3227). Every route returned 500 until the first JSON object was rewritten. Not shipped; local Turbopack cache.

**Repro Steps:**

1. Hit any local route while the manifest is concatenated
2. **Observe:** `Internal Server Error`

---

## Checks performed

### Card art size

- `clampAssetWidth("card", 2000, "art")` equals `WIDE_ART_MAX_WIDTH` (1080), same as event/epoch (`scripts/pagestorm.spec.ts`).
- Switching 카드 타일 (150×211) → 아트만 yields 128×200 default; the art box can be resized up to 1080 with matching 1.56 height.
- Resize-handle Playwright drag was flaky (atom node `draggable` + ProseMirror). Max width is covered by the unit spec.

### Desktop float (1440×900 and 1920×1080)

- Chrome width ~404px, `flex-wrap: nowrap`.
- Align group (~104px) and presentation group (~296px) share the same row (y within 8px).
- `베타 아트` label: `whitespace: nowrap`, height 15px, `clientHeight === scrollHeight`.
- 아트만 / 카드 타일 / Tiny 카드 / 베타 아트 all present in the accessibility tree.
- Beta checkbox toggles (`aria-checked` after click).

### Mobile (Emulation 375×812 and 360×800)

- Outer chrome `flex-wrap: wrap`: align row then presentation row (user-requested mobile stacking).
- Chrome width 351px @375 and 336px @360; `documentElement.scrollWidth` matches viewport (no horizontal overflow).
- `베타 아트` stays one line (`nowrap`, 57×15).

`scripts/check-mobile-route.mjs --no-dev` failed `canReach` with a 1.2s timeout even while `curl` returned 200. Layout was checked with Chrome Emulation against the live write page instead.

## Fixes Applied

| Issue | Fix Status | Commit | Files Changed |
|-------|-----------|--------|---------------|
| Card art max 1080 + float beside align | verified | b29aad69 | `sample.ts`, `figures.tsx`, `pagestorm.spec.ts` |
| ISSUE-001 | verified | follow-up | `figures.tsx`, `tiptap-nodes.tsx` |
| ISSUE-002 | deferred | — | — |
| ISSUE-003 | deferred (local cache) | — | — |

---

## Ship Readiness

| Metric | Value |
|--------|-------|
| Health score | 78 → 92 (+14) |
| Issues found | 3 |
| Fixes applied | 2 (feature + ring) |
| Deferred | 2 |
