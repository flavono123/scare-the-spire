# QA Report: 슬서운이야기

| Field | Value |
|-------|-------|
| **Date** | 2026-08-27 |
| **URL** | `/decisions-decisions` composer modal |
| **Branch** | main |
| **Commit** | (this change) |
| **Tier** | Quick |
| **Scope** | 어려운 결정 composer: process nav, pool labels, empty copy, character tokens, monster drag portraits |
| **Pages visited** | 1 (+ composer steps) |

## Health Score: 94/100

| Category | Score |
|----------|-------|
| Console | 95 |
| Links | 100 |
| Visual | 92 |
| Functional | 95 |
| UX | 94 |
| Performance | 90 |
| Content | 96 |

## Top 3 Things to Fix

1. **ISSUE-001: Index create CTA waits on auth ready** — `티어 만들기` is gated on `ready && !unavailable`, so a slow anonymous session hides the control. Workaround: wait for feed load. Deferred; pre-existing.
2. No other high/critical issues in the composer flow.
3. —

## Summary

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 0 |
| Medium | 1 |
| Low | 0 |
| **Total** | **1** |

## Issues

### ISSUE-001: Index create CTA waits on auth ready

| Field | Value |
|-------|-------|
| **Severity** | medium |
| **Category** | ux |
| **URL** | `/decisions-decisions` |

**Description:** Header `티어 만들기` only mounts when `useAuth().ready` is true and the feed is not unavailable. Playwright mobile opened the index during `보드를 불러오는 중...` and had no create control. Desktop Chromium after load showed the CTA.

**Repro Steps:**

1. Open `/decisions-decisions` before anonymous auth finishes.
2. **Observe:** header has title/subtitle only; create control appears after ready.

---

## Fixes Applied

| Issue | Fix Status | Commit | Files Changed |
|-------|-----------|--------|---------------|
| Composer copy/nav/pool/tokens (requested work) | verified | (this change) | decisions composer, picker, board, token, actor, `service.ts` |
| ISSUE-001 | deferred | — | pre-existing auth gate |

---

## Ship Readiness

| Metric | Value |
|--------|-------|
| Health score | n/a → 94 |
| Issues found | 1 |
| Fixes applied | requested composer UX (verified) |
| Deferred | 1 (auth-gated CTA) |

## Verification notes

- Desktop Chromium on `http://localhost:3000/decisions-decisions`: index CTA is `티어 만들기`; modal title matches; breadcrumb `준비하기` / `티어 만들기` at top; step 2 disabled until the pool has 말; both steps clickable once the pool is stamped.
- Generator order: 유형 → 필터 (after a type with chips) → search. Preset block labeled `프리셋` with `고르면 바로 준비`.
- Empty pool: no type → `유형을 골라보세요`; card type only → `필터를 적용해보세요`.
- Board submit stays `올리기`. Preset `유물 전체` jumps to step 2.
- Characters render `character_icon_*.webp` tokens (no Spine canvas). Monsters show `monsters-render` portraits for drag; up to 8 in-view live Spine stages after a fresh load.
- `pnpm i18n:validate` passed. `pnpm lint` had no new errors.
- Mobile index (`check-mobile-route.mjs`, 7 presets): OK. Composer modal layout verified on desktop; mobile Playwright did not wait out feed/auth before the CTA.

### Guardrails / game assets

- **cf-guardrails:** client-only catalog/stamps; no Worker joins, no request-time Supabase for this composer.
- **Game assets:** Buffer service token (unchanged); character `iconUrl` tokens; monster Spine render portraits (`/images/sts2/monsters-render/`) plus compact idle Spine for in-view tiles.
- **Title/token:** existing 어려운 결정 / Buffer; no new service surface.
