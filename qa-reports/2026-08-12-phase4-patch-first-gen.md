# QA Report: 슬서운이야기

> Later rename: Cloudflare isolated env `phase4` → `testbed` (`pnpm cf:testbed`).
> This report still describes the `phase4` Workers used that day.

| Field | Value |
|-------|-------|
| **Date** | 2026-08-12 |
| **URL** | https://scare-the-spire-phase4.flavono123.workers.dev |
| **Branch** | main |
| **Commit** | fb9c83ea |
| **Tier** | Standard |
| **Scope** | Phase4 isolated workers after patch-first CI + static:data untrack/ensure |
| **Pages visited** | home, patches, patch detail, compendium cards/relics/detail, history-course, c-c-c-combo |

## Health Score: 92/100

| Category | Score |
|----------|-------|
| Console | 95 |
| Links | 95 |
| Visual | 95 |
| Functional | 95 |
| UX | 90 |
| Performance | 85 |
| Content | 95 |

## Top 3 Things to Fix

1. **ISSUE-001: patch-rich-comments `process is not defined`** — fixed in this session
2. **ISSUE-002: stale phase4 Compendium modal assertion** — fixed (detail is full page + back link)
3. **ISSUE-003: History Course invalid-run CTA strict-mode selector** — fixed (use accessible name)

## Summary

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 0 (1 fixed) |
| Medium | 0 (2 fixed) |
| Low | 0 |
| **Total open** | **0** |

## Verification run

- `pnpm cf:phase4` deployed `scare-the-spire-phase4` + `scare-the-spire-patches-phase4`
- Route smoke: **71/71 passed**
- Playwright `qa:cf:phase4`: **9/9 passed** after fixes (modal click uses noWaitAfter)
- Mobile viewport presets (iPhone/Android matrix):
  - OK: `/`, `/patches`, `/compendium/cards`, `/compendium/relics`, `/compendium/relics/fishing_rod`
  - OK after page-specific selectors: `/history-course`, `/c-c-c-combo`
- Interaction/overflow pass (desktop/tablet/iphone): search, patch changes tab, card detail click — no overflow; patch console error fixed
- Supabase writes: blocked / aborted in tests; no row-creating flows exercised

## Issues

### ISSUE-001: patch client `process is not defined`

| Field | Value |
|-------|-------|
| **Severity** | high |
| **Category** | console / functional |
| **URL** | /patches, /patches/0.110.0 |

**Description:** `/_patches/patch-rich-comments.js` evaluated `process.env.NEXT_PUBLIC_SITE_ORIGIN` in the browser.

**Fix:** Extended esbuild `define` in `scripts/build-patch-worker.tsx` for SITE_ORIGIN env keys; redeployed phase4 patch Worker.

### ISSUE-002 / ISSUE-003: phase4 Playwright selectors

Stale modal close button and ambiguous History Course back link. Updated `scripts/cloudflare-phase4.spec.ts`.

## Fixes Applied

| Issue | Fix Status | Commit | Files Changed |
|-------|-----------|--------|---------------|
| ISSUE-001 | verified | (this commit) | scripts/build-patch-worker.tsx |
| ISSUE-002/003 | verified | fcfaa3ad + follow-up | scripts/cloudflare-phase4.spec.ts |
| build blockers | verified | 993248c7, 7a45562f | selfcheck + OG/relic typecheck |

## Ship Readiness

| Metric | Value |
|--------|-------|
| Health score | ~80 → 92 |
| Issues found | 3 |
| Fixes applied | 3 |
| Deferred | 0 |
| Fresh-checkout meaning | clean tree without tracked gen JSON (clone / git clean of ignored static:data outputs) |
