# QA Report: 슬서운이야기

| Field | Value |
|-------|-------|
| **Date** | 2026-05-14 |
| **URL** | http://localhost:3001 |
| **Branch** | main |
| **Commit** | eaec4e7 |
| **Tier** | Standard |
| **Scope** | Card rendering: title ribbons, SmartFormat card text, upgraded keyword placement |
| **Pages visited** | 4 |

## Health Score: 96/100

| Category | Score |
|----------|-------|
| Console | 100 |
| Links | 100 |
| Visual | 92 |
| Functional | 96 |
| UX | 96 |
| Performance | 94 |
| Content | 96 |

## Top 3 Things to Fix

1. **ISSUE-001: Title ribbon regression** — Previous banner change over-scaled standard ribbons and pushed card titles out of alignment.

## Summary

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 0 |
| Medium | 1 |
| Low | 0 |
| **Total** | **1** |

## Issues

### ISSUE-001: Title ribbon regression

| Field | Value |
|-------|-------|
| **Severity** | medium |
| **Category** | visual |
| **URL** | /codex/cards, /codex/cards/brightest_flame, /codex/cards/feed |

**Description:** The prior ribbon patch changed standard card banner sizing and title positioning. This made normal card ribbons too large and misaligned. Ancient card ribbon sizing also needed a smaller, scoped adjustment that did not affect standard cards.

**Repro Steps:**

1. Navigate to `/codex/cards`.
2. Compare common and rare attack cards in the grid.
3. Navigate to `/codex/cards/brightest_flame`.
4. **Observe:** Standard titles should remain centered on their original banner position, and the ancient ribbon should show the center ornament and ends without excessive scaling.

---

## Fixes Applied

| Issue | Fix Status | Commit | Files Changed |
|-------|-----------|--------|---------------|
| ISSUE-001 | verified | 402bfb7 | src/components/codex/card-tile.tsx |
| ISSUE-001 | verified | eaec4e7 | src/components/codex/card-tile.tsx |

## Verification

- Browser QA on `http://localhost:3001/codex/cards`: standard card titles and ribbons visually aligned.
- Browser QA on `http://localhost:3001/codex/cards/brightest_flame`: ancient ribbon center ornament visible, ends extend beyond the card frame, title is not clipped.
- Browser QA on `http://localhost:3001/codex/cards/feed`: rare attack title remains centered on the banner.
- Browser QA on `http://localhost:3001/codex/cards/tyranny` with upgrade enabled: `선천성` renders as the top standalone line.
- Browser console warnings/errors checked on visited pages: none.
- `pnpm lint`: passed.
- `pnpm build`: passed.

---

## Ship Readiness

| Metric | Value |
|--------|-------|
| Health score | 82 -> 96 (+14) |
| Issues found | 1 |
| Fixes applied | 1 |
| Deferred | 0 |
