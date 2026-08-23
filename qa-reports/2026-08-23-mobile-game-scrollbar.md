# QA Report: 슬서운이야기

| Field | Value |
|-------|-------|
| **Date** | 2026-08-23 |
| **URL** | http://localhost:3000 |
| **Branch** | main |
| **Commit** | 33c6aba0 |
| **Tier** | Standard |
| **Scope** | Mobile game-asset scrollbar (`GameScrollArea` rail) |
| **Pages visited** | 10 |

## Health Score: 94/100

| Category | Score |
|----------|-------|
| Console | 82 |
| Links | 95 |
| Visual | 96 |
| Functional | 95 |
| UX | 96 |
| Performance | 94 |
| Content | 100 |

## Top 3 Things to Fix

1. **ISSUE-001: Mobile gold scrollbar rails** — Game-asset trains ate width on touch surfaces; hidden below `md`. Verified.
2. **ISSUE-002: SearchBar hydration mismatch** — Pre-existing Next.js overlay on `/compendium/cards`. Deferred.

## Keep / hide review

Mobile (`< md`, 768px) should not show the gold rail. Touch pan already scrolls, and the train plus gutter steals 18–28px from narrow panes. Nested short panes (cover-editor `h-40` candidates, character dialogue `max-h-[32rem]`) were the closest keep candidates; they still lose on mobile because a 22–36px train is a poor finger target and inner swipe is the right gesture.

Desktop (`md+`) keeps the rail wherever content overflows. That is the jump affordance for pointer users.

No `showRailOnMobile` exception was added.

## Summary

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 0 |
| Medium | 1 (fixed) |
| Low | 1 (deferred) |
| **Total** | **2** |

## Issues

### ISSUE-001: Gold game scrollbar rails on mobile

| Field | Value |
|-------|-------|
| **Severity** | medium |
| **Category** | ux |
| **URL** | /compendium/cards, overlays, search, /history-course, page body |

**Description:** After the game scrollbar landed on overflowing panes, mobile still drew the STS2 track + gold train. Touch drag already scrolls; the rail and right gutter shrank filters (`w-52`), pickers, sheets, and the page body. The train uses `touch-none`, which fights edge swipes.

**Repro Steps:**

1. Open `/compendium/cards` at 375×812
2. Open the filter drawer, a card overlay, and unified search
3. **Observe (before):** gold rail + gutter. **Observe (after):** `[data-game-scroll-rail]` is `display: none`; overflow-y still works

---

### ISSUE-002: SearchBar hydration mismatch

| Field | Value |
|-------|-------|
| **Severity** | low |
| **Category** | console |
| **URL** | /compendium/cards |

**Description:** Next.js overlay points at `src/components/codex/search-bar.tsx` (~line 21). Present before this scrollbar change. Not caused by hiding the rail.

**Repro Steps:**

1. Load `/compendium/cards` in Next.js dev
2. **Observe:** hydration warning / "1 Issue" badge

---

## Fixes Applied

| Issue | Fix Status | Commit | Files Changed |
|-------|-----------|--------|---------------|
| ISSUE-001 | verified | 33c6aba0 | `src/components/game-scroll-area.tsx`, `docs/DESIGN.md` |
| ISSUE-002 | deferred | — | SearchBar hydration, out of scope |

## Verification

- Browser at 375×812: cards index, Strike overlay, unified search "타격", History Course landing — 0 visible rails (`display: none`).
- Playwright 375 vs 1280 on `/`, `/compendium/cards|relics|potions|characters`, `/history-course`, `/this-or-that`, `/c-c-c-combo`: every mobile `visibleCount` was 0. Desktop showed rails where content overflowed (cards 2, relics 1, characters 1, home 1, history-course 1, combo 1).
- Desktop 1280×800 cards index: small filter rail (18px) and large grid rail (28px) still `display: block`.
- `check-mobile-route.mjs --route /compendium/cards --render-selector main --controls-selector "[data-mobile-qa-none]" --no-dev`: all 7 mobile presets OK. Summary: `/tmp/mobile-viewport-qa/2026-08-23T10-41-27-694Z/summary.json`.

## Ship Readiness

| Metric | Value |
|--------|-------|
| Health score | 86 → 94 (+8) |
| Issues found | 2 |
| Fixes applied | 1 |
| Deferred | 1 |
