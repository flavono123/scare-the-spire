# QA Report: 슬서운이야기

| Field | Value |
|-------|-------|
| **Date** | 2026-09-09 |
| **URL** | http://localhost:3000/compendium/sts1/cards |
| **Branch** | main |
| **Commit** | `92adef6a`, `bc758b89`, `d3798402`, `7b941947`, `fa801e6f` |
| **Tier** | Standard (visual + UX chrome vs STS2 Compendium and STS1 `desktop-1.0.jar`) |
| **Scope** | STS1 Compendium card tile compositing (portrait clip, Clash wrap, cream/Kreon cost) + detail overlay chrome (rail, upgrade/beta under card, keyword tips) |
| **Pages visited** | 5 (`/compendium/sts1/cards`, `?card=clash`, `?card=bash`, `?card=defend-r`, `?card=inflame` + upgrade toggle) |

## Health Score: 68 → 90/100

| Category | Score |
|----------|-------|
| Console | 80 |
| Links | 95 |
| Visual | 90 |
| Functional | 92 |
| UX | 90 |
| Performance | 80 |
| Content | 95 |

## Top 3 Things to Fix

1. **ISSUE-016: Portrait leaked over the type plaque** — Clip to the atlas inner hole, not the opaque frame bbox.
2. **ISSUE-017: Clash (격돌) description clipped** — Wrap + `start_y` from AbstractCard so four Korean lines fit.
3. **ISSUE-019: Detail chrome diverged from STS2** — Translucent overlay, right rail, upgrade/beta under the card.

## Summary

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 2 |
| Medium | 3 |
| Low | 0 |
| **Total** | **5** |

## Issues

### ISSUE-016: Portrait leaked out of the type plaque on every card type

| Field | Value |
|-------|-------|
| **Severity** | high |
| **Category** | visual |
| **URL** | `/compendium/sts1/cards`, `?card=bash`, `?card=defend-r`, `?card=inflame` |

**Description:** Type plaques (공격 / 스킬 / 파워) looked “too small” because portrait pixels sat on top of them. Game `initializeDynamicFrameWidths` only stretches the MID segment when `typeWidth > 1.1`; Korean **공격** is short, so the small chip is correct. The leak was the portrait mask using the opaque frame bbox (bottom ~58.8%) instead of the atlas inner hole (bottom ~53.3%). Inner holes on the 512 atlas, card at `(106,46) 300×420`: attack `{136,108,240,162}`, skill `{135,108,240,163}`, power `{132,61,248,209}`.

**Repro Steps:**

1. Open `/compendium/sts1/cards`
2. Open **강타**, **수비**, **발화** overlays
3. **Observe (before):** art bleeds over the type chip on attack, skill, and power
4. **Observe (after):** portrait clipped to the frame hole; type chip sits on the frame, not on leaked art

---

### ISSUE-017: Clash (격돌) description clipped vs full tooltip

| Field | Value |
|-------|-------|
| **Severity** | high |
| **Category** | content |
| **URL** | `/compendium/sts1/cards?card=clash` |

**Description:** Kor loc is `손에 있는 카드가 전부 공격 카드일 때만 사용할 수 있습니다. NL 피해를 !D! 줍니다.` Game `initializeDescription` wraps to four lines. The tile used a CSS box that clipped the last line. Fix: wrap like the game (`wrapSts1DescriptionLines`, CJK glyph em 0.95), join with `" NL "`, `whiteSpace: nowrap`, and `sts1DescriptionBox(locale, lineCount)` from `start_y = card_bottom + DESC_OFFSET_Y + nLines*cap*0.775 - cap*0.375` (`DESC_OFFSET_Y = 0.255 * 420`, line step `1.45 * capHeight`).

**Repro Steps:**

1. Filter the library for **격돌**
2. Open the overlay `?card=clash`
3. **Observe (before):** last line cut off vs the full tooltip
4. **Observe (after):** four lines fully visible on both the grid tile and the overlay card

---

### ISSUE-018: Cream glyphs and energy cost did not match the game fonts

| Field | Value |
|-------|-------|
| **Severity** | medium |
| **Category** | visual |
| **URL** | `/compendium/sts1/cards`, `?card=bash` |

**Description:** Default card text was not `Settings.CREAM_COLOR` `#FFF6E2`. Cost used a generic outlined digit instead of `cardEnergyFont_L`: Kreon-Bold **38px**, FreeType `borderWidth` **4**, `borderColor` `(0.3,0.3,0.3)` `#4D4D4D`, fill **WHITE**. Modified cost stays `#7FFF00`. The yellow energy pip still shows through around the glyph; game fill is still white + gray stroke, not a gold numeral.

**Repro Steps:**

1. Open **강타** (cost 2) and **격돌** (cost 0)
2. **Observe (before):** cost font/style far from Kreon 38 / cream titles
3. **Observe (after):** title cream + 2px `#595959` stroke; cost Kreon 38cqi-scaled with 4px gray FreeType stroke

---

### ISSUE-019: STS1 detail overlay did not reuse STS2 Compendium chrome

| Field | Value |
|-------|-------|
| **Severity** | medium |
| **Category** | ux |
| **URL** | `/compendium/sts1/cards?card=bash` |

**Description:** Overlay used an opaque `bg-background` box. Upgrade/beta sat in the right rail instead of under the card (`stageExtra`). Rail did not match STS2 (`tiny tile + English name + type/rarity/character pills`, `max-w-6xl`, `data-card-detail-stage`).

**Repro Steps:**

1. Open `/compendium/sts1/cards?card=inflame`
2. Toggle **강화 상태 보기**
3. **Observe (before):** opaque modal; toggles in the rail
4. **Observe (after):** translucent overlay; rail is Inflame + 파워 / 고급 / 아이언클래드; checkbox under the card; Inflame+ shows `힘을 3 얻습니다.` with upgraded numeral

---

### ISSUE-020: Card keyword tips missing despite Game Dictionary keywords

| Field | Value |
|-------|-------|
| **Severity** | medium |
| **Category** | ux |
| **URL** | `/compendium/sts1/cards?card=bash`, `?card=defend-r`, `?card=inflame` |

**Description:** STS2 Compendium shows `CardSideTipsAnchor` keyword tips on hover/detail. STS1 already has `data/sts1/localization/{locale}/keywords.json`. Missing tips were not “no extracted entities”; they were unused. `collectSts1CardSideTips` + `CardSideTipsAnchor` (`mode="always"` on detail, `preferSide="left"`; `mode="hover"` on library tiles). `#b50%` → `[blue]50%[/blue]`. Skip `TODO` / entries without `NAMES`.

**Repro Steps:**

1. Open **강타**, **수비**, **발화** overlays
2. **Observe (before):** no keyword tip beside the card
3. **Observe (after):** 취약 / 방어도 / 힘 tips to the left of the card; gold keyword in the description

---

## Fixes Applied

| Issue | Fix Status | Commit | Files Changed |
|-------|-----------|--------|---------------|
| ISSUE-016 | verified | `92adef6a` | `src/lib/sts1/card-style.ts`, `src/components/sts1/card-tile.tsx`, `scripts/sts1-card-layout.spec.ts` |
| ISSUE-017 | verified | `bc758b89` | `src/lib/sts1/description.ts`, `src/lib/sts1/card-style.ts`, `src/components/sts1/card-tile.tsx`, `scripts/sts1-card-layout.spec.ts` |
| ISSUE-018 | verified | `d3798402` | `src/lib/sts1/card-style.ts`, `src/components/sts1/card-tile.tsx` |
| ISSUE-019 | verified | `7b941947` | `src/components/sts1/detail-chrome.tsx`, `src/components/sts1/card-detail.tsx`, STS1 library overlays |
| ISSUE-020 | verified | `fa801e6f` | `src/lib/sts1/keyword-tips.ts`, `src/components/sts1/card-detail.tsx`, library hover path |

---

## Ship Readiness

| Metric | Value |
|--------|-------|
| Health score | 68 → 90 (+22) |
| Issues found | 5 |
| Fixes applied | 5 |
| Deferred | Library-grid hover tip (detail `always` verified; grid `hover` not click-tested). Dedicated `/compendium/sts1/cards/[slug]` vs overlay not re-shot after chrome. Mobile viewport skill not run. Korean type plaques stay small on purpose (game `typeWidth` gate). |

## Notes

- Source of truth for tile compositing: `desktop-1.0.jar` `AbstractCard` / `FontHelper` / `Settings.CREAM_COLOR`, not STS2 card geometry.
- Source of truth for overlay chrome: STS2 Compendium `card-detail` + `CompendiumDetailOverlay` (translucent stage, rail, `stageExtra` under the hero).
- Do not stretch Korean 공격/스킬/파워 plaques to STS2 size; the game leaves them unstretched.
