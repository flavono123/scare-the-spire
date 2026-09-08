# QA Report: 슬서운이야기

| Field | Value |
|-------|-------|
| **Date** | 2026-09-08 |
| **URL** | http://localhost:3002/compendium/sts1/* |
| **Branch** | main |
| **Commit** | `795ad95e` plus follow-up Compendium rendering fixes |
| **Tier** | Quick (Critical/High first), scoped |
| **Scope** | STS1 Compendium (`/compendium/sts1/cards`, relics, potions, details, `/cards|/relics|/potions` aliases) |
| **Pages visited** | 8 |

## Health Score: 42 → 78/100

| Category | Score |
|----------|-------|
| Console | 70 |
| Links | 95 |
| Visual | 75 |
| Functional | 90 |
| UX | 80 |
| Performance | 70 |
| Content | 95 |

## Top 3 Things to Fix

1. **ISSUE-001: Combat cards used the 1024 inspect atlas** — Tiles layered `SingleCardViewPopup` art onto a 300×420 box, so banners cut portraits and orbs drifted. Fixed: 512 `cardui` combat atlas with the card at `(106, 46, 300×420)`.
2. **ISSUE-002: Relic/potion pages were wiki stubs** — Tiny icons, raw Java ids, one-line pages. Fixed: Compendium chrome (hero + rail, rarity sections with game copy, English names, overlay close).
3. **ISSUE-003: Potion outlines were untinted** — `bloodpotion.webp` was a white glow because the lab outline PNG was not tinted with `Settings.RED_RELIC_COLOR`. Fixed: extract tints `labOutlineColor`; Blood Potion keeps game `PotionColor.WHITE` liquid plus red lab/character outline.

## Summary

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 4 |
| Medium | 3 |
| Low | 2 |
| **Total** | **9** |

## Issues

### ISSUE-001: STS1 cards composited from the 1024 inspect atlas

| Field | Value |
|-------|-------|
| **Severity** | high |
| **Category** | visual |
| **URL** | `/compendium/sts1/cards` |

**Description:** Combat cards live on the 512 `cardui.atlas` page (`orig` 512², card in `card_shadow` at left 106, top 46, 300×420). The first Compendium tiles used 1024 inspect regions with `object-contain`, so frames, banners, and orbs did not share a coordinate system.

**Repro Steps:**

1. Open `/compendium/sts1/cards`
2. Look at 타격 / 강타 tiles
3. **Observe (before):** name banner slicing the portrait; orb not on the energy pip

---

### ISSUE-002: Relic and potion UI was a wiki stub

| Field | Value |
|-------|-------|
| **Severity** | high |
| **Category** | ux |
| **URL** | `/compendium/sts1/potions/bloodpotion`, `/compendium/sts1/relics` |

**Description:** Libraries were unlabeled icon dumps. Details showed a 72px icon, a Java class id, and a single sentence on a mostly empty page. STS2 Compendium uses hover tiles, rarity/tier sections with game screen copy, a large hero, meta pills, and English name.

**Repro Steps:**

1. Open `/compendium/sts1/potions/bloodpotion`
2. **Observe (before):** raw `BloodPotion` id, tiny art, empty viewport

---

### ISSUE-003: Potion lab outlines extracted untinted

| Field | Value |
|-------|-------|
| **Severity** | high |
| **Category** | visual |
| **URL** | `/compendium/sts1/potions/bloodpotion` |

**Description:** Compose drew the outline PNG without `labOutlineColor`. Blood Potion sets `labOutlineColor = Settings.RED_RELIC_COLOR`. Liquid is game `PotionColor.WHITE` (pearly), not a red fill. Without the outline tint the bottle read as a white blob. `/images` is cached `immutable` for a year, so even a correct file stayed stale in the browser until `?v=` busting.

**Repro Steps:**

1. Open Blood Potion detail after the first extract
2. **Observe:** white halo, no Ironclad red outline

---

### ISSUE-004: Card library HTML shipped ~3400 `<img>` tags

| Field | Value |
|-------|-------|
| **Severity** | high |
| **Category** | performance |
| **URL** | `/compendium/sts1/cards` |

**Description:** Each of 370 cards inlined 8–9 atlas `<img>` layers (shared 512 webps). SSR HTML was ~1.9MB with 3426 images. Dev streaming (`<div hidden id="S:1">`) often never revealed. Atlas layers are now CSS `background-image` (~466 `<img>`, portraits + chrome).

**Repro Steps:**

1. View source / count `<img>` on `/compendium/sts1/cards`
2. **Observe (before):** thousands of `card-ui-512` image tags

---

### ISSUE-005: Upgrade label clipped on the 22rem rail

| Field | Value |
|-------|-------|
| **Severity** | medium |
| **Category** | visual |
| **URL** | `/compendium/sts1/cards/bash`, `/compendium/sts1/cards/searing-blow` |

**Description:** `GameUpgradeToggle` used checkbox size `md`, which clipped `강화 상태 보기` in the Compendium rail. One-step upgrades now use `GameCheckboxToggle` `sm`. Searing Blow keeps the stepper; checkbox size is `sm`.

**Repro Steps:**

1. Open 강타 detail
2. **Observe (before):** truncated upgrade label

---

### ISSUE-006: 64px potions upscaled with bilinear filtering

| Field | Value |
|-------|-------|
| **Severity** | medium |
| **Category** | visual |
| **URL** | `/compendium/sts1/potions/bloodpotion` |

**Description:** Game potions are 64×64 nearest-neighbor sprites. Bilinear stretch to 160px turned the red outline into a white glow. Tiles/detail now use `image-rendering: pixelated` and the Ironclad CSS outline filter.

**Repro Steps:**

1. Open Blood Potion at 160px without pixelated rendering
2. **Observe:** outline disappears into a blur

---

### ISSUE-007: Potion/relic hero used a 22rem min-height empty column

| Field | Value |
|-------|-------|
| **Severity** | medium |
| **Category** | ux |
| **URL** | `/compendium/sts1/potions/bloodpotion` |

**Description:** STS2 detail chrome uses `min-h-[22rem]` because related rails fill the page. STS1 skipped those rails, so a 64px potion sat in a tall empty hero. Icon details no longer force that min-height; the 1fr + 22rem grid is unchanged.

**Repro Steps:**

1. Open a potion detail
2. **Observe (before):** tiny bottle in a tall empty left column

---

### ISSUE-008: Next.js navbar hydration overlay in `next dev`

| Field | Value |
|-------|-------|
| **Severity** | low |
| **Category** | console |
| **URL** | `/compendium/sts1/cards/bash` |

**Description:** Dev overlay reported a hydration mismatch in `site-navbar.tsx` (`typeof window !== 'undefined'`). The Bash upgrade toggle still worked. Pre-existing navbar, not STS1-specific. Deferred.

**Repro Steps:**

1. Open an STS1 detail in `next dev`
2. **Observe:** Next.js issues badge / hydration stack

---

### ISSUE-009: Card title/orb still not pixel-identical to LibGDX

| Field | Value |
|-------|-------|
| **Severity** | low |
| **Category** | visual |
| **URL** | `/compendium/sts1/cards` |

**Description:** 512 layers and portrait window match the atlas. Type banner pieces are the game’s small center ribbon (not a stretched full-width bar). Title `cqi` type is an approximation of the bitmap font. Good enough for Compendium tiles; not a screenshot of the Java renderer.

**Repro Steps:**

1. Compare a tile to an in-game Card Library screenshot
2. **Observe:** small banner/type/kerning differences

---

## Fixes Applied

| Issue | Fix Status | Commit | Files Changed |
|-------|-----------|--------|---------------|
| ISSUE-001 | verified | this session | `card-style.ts`, `card-tile.tsx`, `card-ui-512/`, extract script, layout spec |
| ISSUE-002 | verified | this session | `detail-chrome.tsx`, relic/potion library+detail+tile, `data.ts` `nameEn` |
| ISSUE-003 | verified | this session | extract `labOutline`, recomposed `public/images/sts1/potions/*`, `?v=` cache buster |
| ISSUE-004 | verified | this session | atlas layers as CSS backgrounds |
| ISSUE-005 | verified | this session | sm checkbox; Searing Blow stepper; +2 = 21 damage |
| ISSUE-006 | verified | this session | `image-rendering: pixelated` + `sts1PoolOutline` |
| ISSUE-007 | verified | this session | `heroLayout="icon"` drops `min-h-[22rem]` |
| ISSUE-008 | deferred | — | `site-navbar.tsx` hydration |
| ISSUE-009 | deferred | — | remaining LibGDX pixel match |

---

## Ship Readiness

| Metric | Value |
|--------|-------|
| Health score | 42 → 78 (+36) |
| Issues found | 9 |
| Fixes applied | 7 |
| Deferred | 2 |

Verified this pass: card grid 200×280 tiles on 512 atlas; Bash upgrade 8/2 → 10/3; Searing Blow +2 = 21; Blood Potion cache-busted pixel art with red outline; potion rarity copy keeps the game typo `드물게 나타는`; `/cards/bash` 200; overlay close on details.

Not in this scope: STS1 keyword hover tips, comments/related rails, `pnpm cf:build`, History Course story images.
