# QA Report: 슬서운이야기

| Field | Value |
|-------|-------|
| **Date** | 2026-09-10 |
| **URL** | http://localhost:3001/dev/decisions-board, http://localhost:3001/decisions-decisions, production https://scare-the-spire.flavono123.workers.dev/defragment/decisions_decisions/f0a78d16-3526-4894-9f8f-339038d5e878 |
| **Branch** | main |
| **Commit** | e9bc095d (layout 6a3a4c20) |
| **Tier** | Standard |
| **Scope** | 어려운 결정 mobile token sizes (index, detail, type/mixed lab) |
| **Pages visited** | 6 |

## Health Score: 92/100

| Category | Score |
|----------|-------|
| Console | 85 |
| Links | 95 |
| Visual | 92 |
| Functional | 95 |
| UX | 94 |
| Performance | 90 |
| Content | 95 |

## Top 3 Things to Fix

1. **ISSUE-001: English `/dev/decisions-board` 404** — locale prefix `/en/dev/...` has no route; lab is prefixless-Korean only.
2. **ISSUE-002: Cloudflare Insights CORS on localhost** — beacon/rum blocked from `:3001`; unrelated to tokens.
3. **ISSUE-003: Mixed-type row baselines** — cards (~45×64) sit taller than icons (~28) / monsters (~32) in the same wrap.

## Summary

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 0 |
| Medium | 0 |
| Low | 3 |
| **Total** | **3** |

## Baseline (Tiermaker + production)

Tiermaker Defect cards template at 375×812 (`tiermaker.com/create/slay-the-spire-defect-cards-ver22-731115`):

- Official tiles: portrait **80×120**, square **80×80**
- Label column ~101px, ranked gutter ~252px → **3 portraits per wrap**
- Those portraits are **cropped art**, not full card frames

Production 디펙트 카드 티어 (`f0a78d16-3526-4894-9f8f-339038d5e878`) before this change:

- Full `CardTile` **72×101** (`300/422`)
- Board ~343×3721 → **~4.6 viewports**
- Same ~295px gutter → **3 cards per wrap**
- Densest row (26 cards, “조건부 추천”) ~9 wraps / ~1.3 screens

Packed target: **6 full cards per wrap** via container `cqw`:

`card = clamp(36px, (100cqw − label − 2·pad − 5·gap) / 6, 72px)`

Comfortable cap remains **72×101** from container `@xl` (~576px).

## Measured after (local, 2026-09-10)

| Surface | Board | Token | First wrap | Notes |
|---------|-------|-------|------------|--------|
| Detail 375 | 343 | card **45.2×63.5** | — | matches formula |
| Detail 360 | 328 | card **42.7×60** | — | still 6-wide capable |
| Detail 1280 | 1120 | card **72×101.3** | — | comfortable restored |
| Lab cards 375 | 343 | **45.2×63.5** | **6** | 90 Ironclad, 18 in S → 3 wraps |
| Lab cards 640 | 640 | **72×101.3** | **7** | `@xl` comfortable |
| Lab dense 375 | 343 | **45.2×63.5** | **6** | 90 in one “조건부 추천” row, **15 wraps / 1.22 vh** vs ~3.78 vh at 72px |
| Lab relics 375 | 343 | icon **28×28** | **9** | 253 shared relics |
| Lab potions 375 | 343 | icon **28×28** | **9** | 64 potions |
| Lab monsters 375 | 343 | **32×32** | 3 | 15 elites, static fallback |
| Lab mixed 375 | 343 | mixed 28–45 | 8 | 101 pieces, 8 per type |
| Index 375 | 309 | card 39.5 / icon 28 | — | compact cards also pack |

26-card production row at packed 6-wide: **5 wraps** vs 9. No horizontal overflow on 360–480.

## Pages

1. Production federated URL (before) — 72px tiles, 3-wide, long scroll
2. Tiermaker Defect template at 375 — 80×120, 3-wide
3. `/dev/decisions-board` — type stamps + mixed + one-row long label
4. `/decisions-decisions` index
5. `/decisions-decisions/27578700-118a-4a65-bb5f-ad842bcc845a` local detail
6. Production UUID on local — “보드를 찾을 수 없습니다” (not in local Supabase)

## Mobile viewport QA

```
node .codex/skills/mobile-viewport-qa/scripts/check-mobile-route.mjs \
  --base-url http://localhost:3001 --no-dev \
  --route /decisions-decisions \
  --render-selector "[data-decisions-decisions-page='index']" \
  --controls-selector "[data-mobile-qa-none]"
```

All 7 presets OK. Summary: `/tmp/mobile-viewport-qa/2026-09-10T13-37-56-084Z/summary.json`.

```
... --route /decisions-decisions/27578700-118a-4a65-bb5f-ad842bcc845a \
  --render-selector "[data-decisions-decisions-page='detail']" \
  --controls-selector "[data-mobile-qa-none]"
```

All 7 presets OK. Summary: `/tmp/mobile-viewport-qa/2026-09-10T13-38-18-661Z/summary.json`.

Lab route was measured with Playwright `locale: ko-KR` (prefixless `/dev`). English UI prefixes `/en/dev/...` and 404s (ISSUE-001).

## Issues

### ISSUE-001: English locale 404s the board lab

| Field | Value |
|-------|-------|
| **Severity** | low |
| **Category** | functional |
| **URL** | `/en/dev/decisions-board` |

**Description:** Other `/dev/*` labs are prefixless-only. Playwright default `en-US` client-navigates to `/en/dev/decisions-board` → Next 404. Korean `/dev/decisions-board` works.

**Repro Steps:**

1. Set UI language to English
2. Open `/dev/decisions-board`
3. **Observe:** 404

---

### ISSUE-002: Cloudflare Insights CORS on local `:3001`

| Field | Value |
|-------|-------|
| **Severity** | low |
| **Category** | console |
| **URL** | http://localhost:3001/decisions-decisions |

**Description:** `cloudflareinsights.com/cdn-cgi/rum` preflight allows `http://localhost` but not `http://localhost:3001`. Pre-existing; no app exception.

---

### ISSUE-003: Mixed-type wrap heights are uneven

| Field | Value |
|-------|-------|
| **Severity** | low |
| **Category** | visual |
| **URL** | `/dev/decisions-board` mixed 375 |

**Description:** Card slots follow `--dd-card`, relics/potions `--dd-icon`, monsters `--dd-monster`. A mixed wrap is denser than forcing card-width gutters, but baselines are ragged. Intentional.

---

## Fixes Applied

| Issue | Fix Status | Commit | Files Changed |
|-------|-----------|--------|---------------|
| Packed 6-wide tokens (original report) | verified | 6a3a4c20 | `src/lib/decisions-token-layout.ts`, board/token/actor, lab |
| Lab dense / long-label fixture | verified | e9bc095d | `decisions-board-dev-page.tsx` |
| ISSUE-001 | deferred | — | `/dev` locale shells are a separate change |
| ISSUE-002 | deferred | — | Insights origin, not token CSS |
| ISSUE-003 | deferred | — | type-specific sizes are the packed layout |

---

## Ship Readiness

| Metric | Value |
|--------|-------|
| Health score | ~70 (3-wide 72px scroll) → 92 (+22) |
| Issues found | 3 low |
| Fixes applied | original scroll bug + lab |
| Deferred | 3 low |
| Cloudflare | client CSS/container queries only; no Worker/request-time work |
