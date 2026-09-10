# QA Report: 슬서운이야기

| Field | Value |
|-------|-------|
| **Date** | 2026-09-10 |
| **URL** | http://localhost:3000/compendium/sts1/cards |
| **Branch** | main |
| **Commit** | (see Fixes Applied) |
| **Tier** | Standard |
| **Scope** | STS1 card-tile description overflow, adaptive type, Compendium title, keyword tips, filter-token candidates |
| **Pages visited** | 6 (`?card=clash`, `?card=omniscience`, `?card=metamorphosis`, `?card=rainbow`, `?card=inflame` + upgrade) |

## Health Score: 70 → 91/100

| Category | Score |
|----------|-------|
| Console | 80 |
| Links | 95 |
| Visual | 92 |
| Functional | 93 |
| UX | 90 |
| Performance | 80 |
| Content | 95 |

## Top 3 Things to Fix

1. **ISSUE-021: Clash description overflowed upward** — Fixed well + STS2 `fitCardDescriptionText`.
2. **ISSUE-022: Title lacked outline / upgrade green** — SCP border 4 + `GREEN_TEXT_COLOR` when upgraded.
3. **ISSUE-023: 가시 matched 증가시킵니다** — Hangul/latin token bounds.

## Summary

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 1 |
| Medium | 2 |
| Low | 1 |
| **Total** | **4** |

## Issues

### ISSUE-021: Clash description painted into the portrait

| Field | Value |
|-------|-------|
| **Severity** | high |
| **Category** | visual |
| **URL** | `/compendium/sts1/cards?card=clash` |

**Description:** ISSUE-017 shifted `start_y` up with line count. Four Clash lines started at ~54% and crossed the type plaque. STS2 card tiles keep a fixed well (`L.desc` top 64% / bottom 95%) and shrink type with `fitCardDescriptionText`. STS1 now uses a fixed well (62%–92.5%) and the same fitter (`STS1_DESC_MIN_FONT_SCALE` 0.5 so 7-line 전지 still fits).

**Repro Steps:**

1. Open `/compendium/sts1/cards?card=clash`
2. Compare 격돌 overlay vs grid tile
3. **Observe (before):** first line over the 공격 plaque
4. **Observe (after):** four lines inside the dark well; 전지 / 탈바꿈 / 무지개 also stay in-well

---

### ISSUE-022: Title outline missing; upgrade did not turn green

| Field | Value |
|-------|-------|
| **Severity** | medium |
| **Category** | visual |
| **URL** | `/compendium/sts1/cards?card=inflame` |

**Description:** Combat `cardTitleFont` is Kreon/Batang 27 with borderWidth 2. SingleCardViewPopup (in-game Compendium) uses `SCP_cardTitleFont_small` 46 with **borderWidth 4**. CSS stroke used half of 2px so the outline vanished on Batang. `renderTitle` / SCP: `Settings.GREEN_TEXT_COLOR` (`#7FFF00`) when `upgraded` / `isViewingUpgrade`; name already includes `+`.

**Repro Steps:**

1. Open 발화, toggle **강화 상태 보기**
2. **Observe (after):** 발화+ is green with a dark FreeType-style outline; numeral 3 is green

---

### ISSUE-023: THORNS tip on cards that only say 증가시킵니다

| Field | Value |
|-------|-------|
| **Severity** | medium |
| **Category** | content |
| **URL** | `/compendium/sts1/cards?card=genetic-algorithm` |

**Description:** `includes("가시")` matched inside 증가시킵니다. Tips now require Hangul/latin token bounds. Kor card text has no real 가시 keyword; count is 0.

---

### ISSUE-024: Curse filter tab invisible on dark UI

| Field | Value |
|-------|-------|
| **Severity** | low |
| **Category** | visual |
| **URL** | `/compendium/sts1/cards` |

**Description:** Extra filters use in-game `curseTab.webp` (near-black). Visible on the game's light library bar, not on this dark sidebar. Candidates listed in the session; not swapped pending pick.

---

## Fixes Applied

| Issue | Fix Status | Commit | Files Changed |
|-------|-----------|--------|---------------|
| ISSUE-021 | verified | (this session) | `card-style.ts`, `card-tile.tsx`, `description.tsx` |
| ISSUE-022 | verified | (this session) | `card-style.ts`, `card-tile.tsx` |
| ISSUE-023 | verified | (this session) | `keyword-tips.ts`, `description.ts` |
| ISSUE-024 | deferred | — | candidates only |

---

## Ship Readiness

| Metric | Value |
|--------|-------|
| Health score | 70 → 91 (+21) |
| Issues found | 4 |
| Fixes applied | 3 |
| Deferred | Curse/colorless/status/special filter token swap |

## Notes

- Description SSOT for *fitting* is STS2 `fitCardDescriptionText`; line breaks still follow STS1 `initializeDescription`.
- Title/upgrade SSOT is `SingleCardViewPopup.renderTitle` + `FontHelper.SCP_cardTitleFont_small`.
- Keyword *copy* is STS1 `Game Dictionary`. Chrome is STS2 `GameHoverTip` (`hover_tip.png`). STS1 PowerTip 9-slice (`tipTop/Mid/Bot`) is not extracted into `public/images/sts1`.
