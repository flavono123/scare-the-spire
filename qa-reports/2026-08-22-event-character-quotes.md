# QA Report: 슬서운이야기

| Field | Value |
|-------|-------|
| **Date** | 2026-08-22 |
| **URL** | http://localhost:3000 |
| **Branch** | main |
| **Commit** | `cf7a64e6` |
| **Tier** | Quick |
| **Scope** | Event character quotes + compile blocker (`getCodexAscensions` duplicate import) |
| **Pages visited** | 6 |

## Health Score: 88/100

| Category | Score |
|----------|-------|
| Console | 80 |
| Links | 90 |
| Visual | 90 |
| Functional | 92 |
| UX | 88 |
| Performance | 82 |
| Content | 95 |

## Top 3 Things to Fix

1. **ISSUE-001: Event quote search leaked across events** — Searching an Ironclad gold monologue also returned Aroma of Chaos. **Fixed.**
2. **ISSUE-002: Direct event detail 404s without generated payload** — `/compendium/events/[id]` stays on “상세 정보를 불러오지 못했습니다” until `public/generated/compendium-detail-kor.json` exists. `pnpm dev` does not ensure this file. **Deferred** (production `pnpm static:data` / build already writes it; list modal path still works).
3. No remaining Critical/High issues in this scope after ISSUE-001.

## Summary

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 1 (fixed before this report: duplicate import) |
| Medium | 2 (1 fixed, 1 deferred) |
| Low | 0 |
| **Total** | **3** |

## Compile blocker (answered)

The overlay `the name getCodexAscensions is defined multiple times` in `src/lib/load-all-entities.ts` is a **source error**. Restarting `pnpm dev` does not fix it. Two concurrent edits both imported the same named binding.

Fixed in `4e6c0e7d`. Home (`/`) returns HTTP 200 after that commit.

## Pages visited

1. `/` — compiles (200)
2. `/compendium/events` — list + search
3. `/compendium/events?event=sunken_treasury` — list modal (server `EventDetail`, no payload JSON)
4. `/compendium/events/sunken_treasury` — canonical detail (client payload)
5. `/profile` — character switch (Necrobinder → Ironclad)
6. `/compendium/events/aroma_of_chaos` — Aroma principle quotes

## Quote checks (pass)

| Check | Result |
|-------|--------|
| Sunken Treasury → 두 번째 상자, default Necrobinder | `잘만 하면 드디어 신발을 살 수 있을지도...` |
| Quote idle look | Game-like; no `{Monologue}`, `[Monologue]`, or baked `X` |
| Quote is a `/profile` link (`data-event-character-quote`) | Yes; Enter on the focused link navigates to 프로필 |
| Profile → Ironclad → return to second chest | `이 재물이라면 우리 부족의 무기고를 더 채울 수 있겠어...` |
| Aroma of Chaos → 정신을 붙잡는다 (page `MAINTAIN_CONTROL`) | Ironclad line repeated **3** times: `고통은 무의미해. 내 적들은 모두 죽는다.` |
| List search for Ironclad gold monologue after ISSUE-001 | Only 가라앉은 보물 |

## Issues

### ISSUE-001: Event quote search leaked across events

| Field | Value |
|-------|-------|
| **Severity** | medium |
| **Category** | functional |
| **URL** | `/compendium/events` |

**Description:** List search and the generated search index treated any event with `{Monologue}` / `{AromaPrinciple}` as matching **all** character quote fields. Searching `무기고를 더 채울` (Sunken Treasury / gold monologue) also returned 혼돈의 향기.

**Repro Steps:**

1. Open `/compendium/events`
2. Search `무기고를 더 채울`
3. **Observe (before):** 가라앉은 보물 **and** 혼돈의 향기
4. **Observe (after):** 가라앉은 보물 only

---

### ISSUE-002: Canonical event detail needs generated payload JSON

| Field | Value |
|-------|-------|
| **Severity** | medium |
| **Category** | functional / console |
| **URL** | `/compendium/events/sunken_treasury` |

**Description:** `CompendiumDirectDetailPage` fetches `/generated/compendium-detail-kor.json`. That file is gitignored. `pnpm dev` ensure helpers do not write it (unlike This or That JSON). Without it the shell title/description render and the body shows “상세 정보를 불러오지 못했습니다.” Choice buttons never appear. The list modal (`?event=`) does not need this file.

**Repro Steps:**

1. Start `pnpm dev` without a prior `pnpm static:data`
2. Open `/compendium/events/sunken_treasury`
3. **Observe:** payload 404, loading/error copy, no 두 번째 상자 control

**Workaround:** Run `pnpm static:data`, or otherwise write `public/generated/compendium-detail-kor.json`. After that the same URL loads EventDetail and quotes work.

---

### Duplicate `getCodexAscensions` import (pre-QA)

| Field | Value |
|-------|-------|
| **Severity** | high |
| **Category** | console / performance (SSG compile) |
| **URL** | `/` via `src/lib/load-all-entities.ts` |

**Description:** Named import listed twice. Next.js Build Error; restarting the dev server does not clear it.

## Fixes Applied

| Issue | Fix Status | Commit | Files Changed |
|-------|-----------|--------|---------------|
| Duplicate `getCodexAscensions` import | verified | `4e6c0e7d` | `src/lib/load-all-entities.ts` |
| ISSUE-001 | verified | `cf7a64e6` | `src/lib/event-character-quotes.ts`, `src/components/codex/event-list.tsx`, `src/lib/search-index-data.ts`, `scripts/event-character-quotes.spec.ts` |
| ISSUE-002 | deferred | — | Local `pnpm static:data` / clone setup; optional later `ensure-*` helper like This or That |

---

## Ship Readiness

| Metric | Value |
|--------|-------|
| Health score | 72 → 88 (+16; compile unblocked, quotes pass, search scoped) |
| Issues found | 3 |
| Fixes applied | 2 |
| Deferred | 1 (ISSUE-002 local payload ensure) |
