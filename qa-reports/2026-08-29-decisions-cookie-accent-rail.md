# QA Report: 슬서운이야기

| Field | Value |
|-------|-------|
| **Date** | 2026-08-29 |
| **URL** | `/decisions-decisions` composer, compact this-or-that catalog, `/compendium/relics/yummy_cookie` |
| **Branch** | main |
| **Commit** | `c1d53efc` (fixes: `ba2c6f3d`, `2cc28f28`) |
| **Tier** | Quick |
| **Scope** | 어려운 결정 pool token for 냠냠 쿠키; preset chip accent rail |
| **Pages visited** | 4 (`/decisions-decisions`, `/this-or-that`, `/compendium/relics`, `/compendium/relics/yummy_cookie`) |

## Health Score: 88/100

| Category | Score |
|----------|-------|
| Console | 70 |
| Links | 100 |
| Visual | 90 |
| Functional | 85 |
| UX | 88 |
| Performance | 80 |
| Content | 95 |

## Top 3 Things to Fix

1. **ISSUE-001: Decisions (and sibling Toy Box) client islands did not hydrate in this QA session** — `/decisions-decisions` stayed on `보드를 불러오는 중...` and never showed `티어 만들기`. Catalog `fetch('/generated/this-or-that-resources-kor.json')` never started from `useThisOrThatEntities`. Manual fetch of the same URL succeeded. Dev HMR WebSocket on `:3001` failed handshake. Deferred; environment / existing auth-gating, not introduced by these two fixes.
2. **ISSUE-002 (fixed): Compact catalog tokens showed 냠 / hover ? for 냠냠 쿠키** — `imageUrl` is null for variant relics. Resolved via `relicData.variantImageUrls` + profile pool.
3. **ISSUE-003 (fixed): Preset chip color mark overshot rounded-xl** — Replaced inset pill bar with clipped `chip-accent-rail`.

## Summary

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 1 |
| Medium | 0 |
| Low | 0 |
| **Total** | **1** open (2 fixed this session) |

## Issues

### ISSUE-001: Decisions composer unreachable while feed/auth client never becomes ready

| Field | Value |
|-------|-------|
| **Severity** | high |
| **Category** | functional |
| **URL** | http://127.0.0.1:3001/decisions-decisions |

**Description:** Automated browsers (Cursor IDE browser and Playwright) kept the index on `ContentLoadingNotice` for 60s. `티어 만들기` is gated on `ready && !unavailable`, so it never appeared. `useThisOrThatEntities` did not issue the catalog request. A direct `fetch` of `/generated/this-or-that-resources-kor.json` returned 200 (~1.0 MiB) with `YUMMY_COOKIE.relicData.variantImageUrls`. Console: repeated `ws://127.0.0.1:3001/_next/webpack-hmr` `ERR_INVALID_HTTP_RESPONSE`. The reporter's own screenshot shows the composer working, so this is treated as a local-dev hydration/HMR failure rather than a production data bug.

**Repro Steps:**

1. Navigate to `/decisions-decisions` on the existing `next-server` PID on port 3001
2. Wait 60s
3. **Observe:** loading copy only; no create CTA; no catalog network request

---

### ISSUE-002: 냠냠 쿠키 pool token used the first glyph instead of profile art

| Field | Value |
|-------|-------|
| **Severity** | high |
| **Category** | visual / content |
| **URL** | `/decisions-decisions` composer pool |

**Description:** Compact this-or-that JSON leaves variant relics with `imageUrl: null`. `DecisionsDecisionsToken` used `entity.imageUrl` and fell back to `label.slice(0, 1)` → **냠**. Hover inspect showed **?** when `variantImageUrls` was missing from a stale generated file.

**Repro Steps:**

1. Open 어려운 결정 composer with profile character 아이언클래드
2. Search 냠냠 쿠키 in the unranked pool
3. **Observe (before):** glyph 냠 and hover `?`
4. **Observe (after):** `relicAwareImageUrl` + regenerated catalog resolve `/images/sts2/relics/yummy_cookie_ironclad.webp`

---

### ISSUE-003: Preset chip leading color mark sat outside the chip radius

| Field | Value |
|-------|-------|
| **Severity** | low |
| **Category** | visual |
| **URL** | `/decisions-decisions` composer presets (e.g. 아이언클래드 카드) |

**Description:** `absolute inset-y-1.5 left-0 w-[3px] rounded-full` did not follow `rounded-xl`. Host now uses `overflow-hidden`; the rail is `inset-y-0 left-0 z-0` and is clipped to the chip.

**Repro Steps:**

1. Open composer presets
2. Inspect the leading color mark on 아이언클래드 카드
3. **Observe (before):** caps poke past the chip corner
4. **Observe (after):** injected chip with the shared classes measured `overflow: hidden`, `overshootX/Y: false`, rail `z-index: 0`, 1px inset matching the border

---

## Fixes Applied

| Issue | Fix Status | Commit | Files Changed |
|-------|-----------|--------|---------------|
| ISSUE-002 | verified (catalog JSON + helper spec; composer UI blocked by ISSUE-001) | `ba2c6f3d` | `relic-character-variant.ts`, token, resource picker, ranking, compact relicData, spec |
| ISSUE-003 | verified (geometry on live Tailwind classes) | `2cc28f28` | `chip-accent-rail.tsx`, `decisions-decisions-pool-picker.tsx` |
| ISSUE-001 | deferred | — | — |

Local `pnpm exec tsx scripts/generate-static-api-data.ts --this-or-that-resources-only` was run so compact JSON includes `variantImageUrls`. Generated files are not committed.

## Ship Readiness

| Metric | Value |
|--------|-------|
| Health score | (pre-session composer 냠/?) → 88 |
| Issues found | 3 |
| Fixes applied | 2 |
| Deferred | 1 |
