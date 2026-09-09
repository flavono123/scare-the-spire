# QA Report: 슬서운이야기

| Field | Value |
|-------|-------|
| **Date** | 2026-09-09 |
| **URL** | http://localhost:3002/compendium/sts1/cards |
| **Branch** | main |
| **Commit** | `60c0d6da`, `69477c46` |
| **Tier** | Quick (Critical/High first), scoped |
| **Scope** | STS1 combat-card title/description layout + all game locales |
| **Pages visited** | 6 (`/compendium/sts1/cards`, `/compendium/sts1/cards/strike-r`, `/en/compendium/sts1/cards/strike-r`, `/ja/compendium/sts1/cards`, `/zh/compendium/sts1/cards`; HTTP 200 on every game-locale prefix index) |

## Health Score: 82 → 92/100

| Category | Score |
|----------|-------|
| Console | 70 |
| Links | 95 |
| Visual | 92 |
| Functional | 92 |
| UX | 90 |
| Performance | 75 |
| Content | 95 |

## Top 3 Things to Fix

1. **ISSUE-013: Title sat down-right of the ribbon** — Centered on the card at AbstractCard offset Y 175 (CSS 8.33%).
2. **ISSUE-014: Description too high and too small** — FontHelper 24px (8cqi), well top 66%, line-height 1.45.
3. **ISSUE-015: One CSS box for every locale** — CJK 0.72 width + break-all; KOR keep-all; THA overflow-wrap; `lang` / `data-game-locale` on the tile.

## Summary

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 0 |
| Medium | 3 |
| Low | 0 |
| **Total** | **3** |

## Issues

### ISSUE-013: Card title sat down-right of the title ribbon

| Field | Value |
|-------|-------|
| **Severity** | medium |
| **Category** | visual |
| **URL** | `/compendium/sts1/cards`, `/compendium/sts1/cards/strike-r` |

**Description:** `h3` used `left: 18%; right: 8%; top: 6.5%`, so the title box center was at 55% of card width and below the ribbon. Game `renderTitle` is `FontHelper.renderRotatedText(current_x, current_y, 0, 175)` on the 300×420 body (CSS center 50%, 8.33%). Banner atlas centroid is ~50% / 9.7%. wiki.gg File:Red-Strike.png and the Fandom `Strike_R` full-card composite show the name dead-center in the ribbon; Korean uses the same layout (`Settings.lineBreakViaCharacter` is false for KOR).

**Repro Steps:**

1. Open `/compendium/sts1/cards`
2. Look at **타격**
3. **Observe (before):** title right of ribbon center
4. **Observe (after):** title box center 50% × 8.33%; cream glyph centroid ~49.6% × 7.7% of the 300×420 body; font 9cqi (27/300)

---

### ISSUE-014: Description hugged the type chip and looked undersized

| Field | Value |
|-------|-------|
| **Severity** | medium |
| **Category** | visual |
| **URL** | `/compendium/sts1/cards/strike-r` |

**Description:** Description box was `top: 59%` with `fontSize: 5.6cqi` (~17px on a 300-wide body vs game 24px). Full-card captures put one-line copy in the upper-middle of the dark well with a gap under the type chip. Game: `cardDescFont` 24px, `DESC_OFFSET_Y = 0.255 * IMG_HEIGHT`, line step `1.45 * capHeight`.

**Repro Steps:**

1. Open `/compendium/sts1/cards/strike-r`
2. Compare **피해를 6 줍니다.** to the type chip **공격**
3. **Observe (before):** small type jammed under the chip
4. **Observe (after):** 8cqi / line-height 1.45; well top 66%; one-line text center ~70% of the body (detail tile 21.95px on a 274px-wide body)

---

### ISSUE-015: Card text layout ignored game-locale wrapping rules

| Field | Value |
|-------|-------|
| **Severity** | medium |
| **Category** | content |
| **URL** | `/ja/compendium/sts1/cards`, `/zh/compendium/sts1/cards`, `/en/compendium/sts1/cards/strike-r` |

**Description:** One 79%-wide CSS box and Latin wrapping for every language. Game `CN_DESC_BOX_WIDTH = 0.72 * IMG_WIDTH` and `lineBreakViaCharacter` apply to ZHS/JPN only. Tiles now take `gameLocale`, set `lang` + `data-game-locale`, use 72% + `break-all` for zhs/jpn, `keep-all` for kor, `overflow-wrap: anywhere` for tha. `esp` still maps to `spa`. Index routes for every `GAME_LOCALES` path prefix return 200. Detail HTML for game-only locales stays out of the Cloudflare asset copy (existing Free-plan limit).

**Repro Steps:**

1. Open `/ja/compendium/sts1/cards` and `/zh/compendium/sts1/cards`
2. Inspect the first **ストライク** / **打击** tile
3. **Observe:** `data-game-locale=jpn|zhs`, `lang=ja|zh-Hans`, description width 72%, `word-break: break-all`
4. Open `/en/compendium/sts1/cards/strike-r` — width 79%, `word-break: normal`; upgrade toggle shows Strike+ / Deal 9 damage.

---

## Fixes Applied

| Issue | Fix Status | Commit | Files Changed |
|-------|-----------|--------|---------------|
| ISSUE-013 | verified | `60c0d6da` | `card-style.ts`, `card-tile.tsx`, `locale.ts`, library/detail/pages, spec |
| ISSUE-014 | verified | `69477c46` | `card-style.ts`, spec |
| ISSUE-015 | verified | `60c0d6da` | same as ISSUE-013 |

---

## Ship Readiness

| Metric | Value |
|--------|-------|
| Health score | 82 → 92 (+10) |
| Issues found | 3 |
| Fixes applied | 3 |
| Deferred | Navbar hydration overlay on `/en/...` (existing `site-navbar.tsx`, not this change) |
