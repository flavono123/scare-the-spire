# QA Report: 슬서운이야기

| Field | Value |
|-------|-------|
| **Date** | 2026-08-27 |
| **URL** | `/chemical-x/[id]`, `/compendium/cards/bash`, comment threads |
| **Branch** | main |
| **Tier** | Standard |
| **Scope** | Game hover tips clipped by overflow / low z-index |
| **Pages visited** | 4 |

## Health Score: 92/100

| Category | Score |
|----------|-------|
| Console | 95 |
| Links | 100 |
| Visual | 90 |
| Functional | 92 |
| UX | 90 |
| Performance | 95 |
| Content | 95 |

## Top 3 Things to Fix

1. **ISSUE-001: Game hover tips clipped or buried** — Keyword/asset tips inside comments, overflow cards, and stacked lists did not paint above the page.
2. **ISSUE-002: Fallback keyword tooltips used a separate black box** — Comment/editor keywords without a Compendium entity used an in-tree CSS tooltip.
3. **ISSUE-003: Portal z-index was split across 200/400/500** — Side tips, UI chrome tips, and resource tips competed instead of sharing one layer.

## Summary

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 1 |
| Medium | 2 |
| Low | 0 |
| **Total** | **3** |

## Issues

### ISSUE-001: Game hover tips clipped by overflow / buried z-index

| Field | Value |
|-------|-------|
| **Severity** | high |
| **Category** | visual |
| **URL** | `/chemical-x/[id]` comments, post article (`overflow: hidden`) |

**Description:** Keyword and asset game hover tips were `absolute` inside comments, overflow-hidden cards, and scroll panes, or portaled at z-index 200–500 that lost to later siblings. Expected: the full game hover tip always paints above page chrome.

**Repro Steps:**

1. Open a 케미컬X detail page with keywords in the post or comments.
2. Hover a gold keyword near the bottom of a clipped card or comment list.
3. **Observe:** tip cut off by the container, or hidden behind the next comment.

---

### ISSUE-002: Fallback keywords used a non-game tooltip

| Field | Value |
|-------|-------|
| **Severity** | medium |
| **Category** | visual |
| **URL** | comment `PostRenderer`, Combo renderer, editor keyword node |

**Description:** Keywords without a resolved Compendium entity used a black `z-[100]` box instead of `GameHoverTip`, and did not portal.

---

### ISSUE-003: Hover-tip stacking was not global

| Field | Value |
|-------|-------|
| **Severity** | medium |
| **Category** | visual |
| **URL** | site-wide |

**Description:** `CardSideTipsAnchor` (200), `GameUiHoverTip` (400), and `PortaledHoverTipLayer` (500) used different z-index values and `document.body`, so later stacking contexts could still cover tips.

---

## Fixes Applied

| Issue | Fix Status | Commit | Files Changed |
|-------|-----------|--------|---------------|
| ISSUE-001 | verified | (this commit) | layout `#hover-tip-root`, `PortaledHoverTipLayer`, `EntityPreview` |
| ISSUE-002 | verified | (this commit) | `KeywordHoverTip` pull-up |
| ISSUE-003 | verified | (this commit) | `--z-hover-tip` / `HOVER_TIP_LAYER_Z_INDEX` 10050 |

## Verification

- `/compendium/cards/bash`: hover `취약` → tip in `#hover-tip-root`, `z-index: 10050`, game hover_tip chrome, not clipped.
- `/chemical-x` feed: hover `곡예` card keyword → card preview portaled, visible.
- `/chemical-x/[id]`: article `overflow: hidden`; hover `민첩` still visible in `#hover-tip-root`.
- `pnpm exec tsx scripts/hover-tip-layer.selfcheck.ts` — pass.

## Ship Readiness

| Metric | Value |
|--------|-------|
| Health score | 70 → 92 (+22) |
| Issues found | 3 |
| Fixes applied | 3 |
| Deferred | 0 (static patch HTML still uses CSS group-hover; `renderToStaticMarkup` cannot portal) |
