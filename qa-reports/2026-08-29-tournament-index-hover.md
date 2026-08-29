# QA Report: 슬서운이야기

| Field | Value |
|-------|-------|
| **Date** | 2026-08-29 |
| **URL** | `/this-or-that/tournament`, `/this-or-that/tournament/[id]` |
| **Branch** | main |
| **Commit** | `b317b688` |
| **Tier** | Quick (scoped) + light mode |
| **Scope** | 이아저? 월드컵 index hover, thumbnail token size, preset author tokens |
| **Pages visited** | 3 (`/this-or-that/tournament` light, same dark, `/this-or-that/tournament/56a6ee1c-665d-452e-9e16-173b16236736`) |

## Health Score: 90/100

| Category | Score |
|----------|-------|
| Console | 80 |
| Links | 95 |
| Visual | 95 |
| Functional | 95 |
| UX | 95 |
| Performance | 95 |
| Content | 95 |

## Top 3 Things to Fix

1. **ISSUE-001: Navbar hydration warning (pre-existing)** — Next.js overlay reports a hydration mismatch in `SiteNavbar` / `MenuDropdown`. Not introduced by this index hover work.
2. *(none in scope)*
3. *(none in scope)*

## Summary

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 0 |
| Medium | 1 |
| Low | 0 |
| **Total** | **1** |

## Issues

### ISSUE-001: Site navbar hydration mismatch

| Field | Value |
|-------|-------|
| **Severity** | medium |
| **Category** | console |
| **URL** | `/this-or-that/tournament` (site chrome, any page) |

**Description:** Dev overlay shows a React hydration error at `src/components/site-navbar.tsx` (and later `menu-dropdown.tsx`). The tournament index itself rendered and navigated. Expected: no hydration warning on first paint.

**Repro Steps:**

1. Open `/this-or-that/tournament` with `next dev`.
2. **Observe:** Next.js issues badge / overlay cites SiteNavbar hydration.

**Status:** deferred — outside this hover/token scope; navbar existed before this change.

---

## Checks

### YouTube lockup observation (Mega Crit `/videos`)

Live `yt-lockup-view-model` + `yt-touch-feedback-shape`:

- Overlay covers thumbnail **and** metadata (`margin: -12px`).
- Hover plate: `border-radius: 16px`, idle `opacity: 0` + `scale(0.9)` from **center**, hover `opacity: 1` + `scale(1)`, `300ms cubic-bezier(0.05, 0, 0, 1)`.
- No `translateY`, no thumbnail `box-shadow`.
- Fill color is thumbnail-sampled (~13% alpha). We use spire-gold `#efc851` at 18%.

### Light mode (`html.light`, parchment)

- Idle: 16:9 thumbs, no card lift/shadow, tokens 40×40 (relics) / 72px wide (cards).
- Hover: rounded gold plate behind whole lockup including metadata; card transform none; thumb box-shadow none.
- Preset author slot: `bing_bong.webp` + ancient art (e.g. 다브 `darv.webp`), matching Decisions editor preset chips.
- User cups still show nickname text.

### Dark mode

- Same plate geometry; gold wash is more visible on charcoal than on parchment (expected).

### Interactions

- 최신 filter focuses.
- Card click opens `/this-or-that/tournament/[id]` (다브 유물).
- Detail start chips (16강/8강/4강) and 시작하기 present.

### I18N

- `pnpm i18n:validate` passed.
- No new ad-hoc service strings in this pass (CSS + existing `DecisionsPresetLead`).

### Mobile

```
node .codex/skills/mobile-viewport-qa/scripts/check-mobile-route.mjs \
  --route /this-or-that/tournament \
  --base-url http://localhost:3000 \
  --render-selector "[data-favorite-tournament-index]" \
  --controls-selector "[data-mobile-qa-none]" \
  --no-dev --min-visible-height 120
```

All 7 presets OK. Summary: `/tmp/mobile-viewport-qa/2026-08-29T04-25-12-075Z/summary.json`.

### Skipped

- `pnpm build` / `pnpm cf:assets` / Wrangler dry-run: CSS-only hover + existing client tokens; no Worker, routing, or sitemap change.
- `animation-playback-qa`: index thumbs stay `staticOnly` (no Spine playback).

## Fixes Applied

| Issue | Fix Status | Commit | Files Changed |
|-------|-----------|--------|---------------|
| YouTube hover was toast-up / wrong origin | verified | `44c18888`, `b317b688` | `globals.css`, post card |
| Token size scaled with thumb viewport | verified | prior token restore on `main` | board/token (no compact scale) |
| Preset author slot missing editor chips | verified | prior `DecisionsPresetLead` on `main` | `decisions-decisions-preset-lead.tsx` |
| ISSUE-001 navbar hydration | deferred | — | — |

---

## Ship Readiness

| Metric | Value |
|--------|-------|
| Health score | 90 |
| Issues found | 1 (pre-existing chrome) |
| Fixes applied | hover/token/preset (this task) |
| Deferred | ISSUE-001 |

Cloudflare: client CSS + existing index client components only. No request-time joins, no Worker CPU change.
