# QA Report: 슬서운이야기

| Field | Value |
|-------|-------|
| **Date** | 2026-08-28 |
| **URL** | `/history-course/[runId]` run-info overlay (gear) |
| **Branch** | main |
| **Tier** | Quick |
| **Scope** | History Course run-info game hovertips vs service/game locale pairing |
| **Pages visited** | 3 (`/`, `/en/`, `/zh/` run `12jr8pfwzycbewd9`) |

## Health Score: 96/100

| Category | Score |
|----------|-------|
| Console | 100 |
| Links | 100 |
| Visual | 95 |
| Functional | 95 |
| UX | 95 |
| Performance | 95 |
| Content | 98 |

## Top 3 Things to Fix

1. **ISSUE-001: Run-info game hovertips ignored game locale** — Card/relic/potion previews stayed Korean when service locale was English. **Fixed.**
2. **ISSUE-002: Map rewind control stays Korean** — `1층으로 되감기` is hardcoded in the shared replay POC and shows on `/en/` and `/zh/`. Deferred; not the run-info hovertip path.

## Summary

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 1 (fixed) |
| Medium | 0 |
| Low | 1 (deferred) |
| **Total** | **2** |

## Issues

### ISSUE-001: Run-info hovertips did not follow game locale

| Field | Value |
|-------|-------|
| **Severity** | high |
| **Category** | content |
| **URL** | `/en/history-course/[runId]` run-info overlay |

**Description:** The gear panel chrome used service locale (English labels such as Relics / Cards / In progress), but `EntityPreview` card tiles still read the Korean-only History Course catalog (`name`, `typeLabel`, `description`). Act row headers used baked `act.actLabel` (과성장 / 군락). Expected pairing: Korean UI → SL ko + GL kor; English UI → SL en + GL eng; other UI (e.g. `/zh/`) → SL en + GL that language.

**Repro Steps:**

1. Open `/en/history-course/{runId}` and click the top-right gear (`Run info`).
2. Hover a deck card (e.g. Strike / Hellraiser).
3. **Observe (before):** hovertip title/type/body stay Korean (지옥검무 / 파워 / …). Act labels stay 과성장.

**Fix:** Overlay game localization tables onto the bundled Korean catalog in `HistoryCatalogLocaleProvider`. `HistoryEntityPreview` passes `gameLocale` / `serviceLocale` / `gameUi`. Act labels use `localizeGame(..., "acts", actId)`.

**Re-verify (run `12jr8pfwzycbewd9`, floor 1 Strike / Bound Phylactery):**

| Path | Service locale | Game locale | Overlay chrome | Hovertip |
|------|----------------|-------------|----------------|----------|
| `/history-course/…` | ko (시드, 진행 중, 유물, 카드) | kor | 과성장 | 타격 / 공격 / 피해를 6 줍니다. |
| `/en/history-course/…` | en (Seed, In progress, Relics, Cards) | eng | Overgrowth | Strike / Attack / Deal 6 damage. |
| `/zh/history-course/…` | en (Seed, In progress, Relics, Back to replay) | zhs | 密林 | 打击 / 攻击 / 造成6点伤害。 Relic 缚魂命匣 |

Unit check: `pnpm exec tsx scripts/check-history-catalog-locale.ts` → `history-catalog-locale ok`.

---

### ISSUE-002: Rewind control hardcoded Korean

| Field | Value |
|-------|-------|
| **Severity** | low |
| **Category** | content |
| **URL** | `/en/history-course/[runId]`, `/zh/history-course/[runId]` |

**Description:** Timeline rewind is labeled `1층으로 되감기` on English and Chinese routes. It comes from `src/components/dev/run-replay-poc.tsx`, imported by the History Course shell. Out of scope for run-info hovertips.

**Repro Steps:**

1. Open `/en/history-course/{runId}`.
2. **Observe:** a rewind control still reads Korean.

---

## Fixes Applied

| Issue | Fix Status | Commit | Files Changed |
|-------|-----------|--------|---------------|
| ISSUE-001 | verified | (this change) | `history-catalog-locale.ts`, `history-loc-tables.ts`, `use-history-catalog-locale.tsx`, `history-entity-preview.tsx`, run-summary/topbar/deck-modal/run-detail-loader, `history-enchantments.ts`, `check-history-catalog-locale.ts` |
| ISSUE-002 | deferred | — | rewind label in run-replay-poc |

---

## Ship Readiness

| Metric | Value |
|--------|-------|
| Health score | 70 → 96 (hovertip locale mismatch closed) |
| Issues found | 2 |
| Fixes applied | 1 |
| Deferred | 1 (rewind Korean label) |
