# QA Report: 슬서운이야기

| Field | Value |
|-------|-------|
| **Date** | 2026-10-11 |
| **URL** | http://localhost:3001/pagestorm/write |
| **Branch** | main |
| **Commit** | 08d3f995 |
| **Tier** | Quick |
| **Scope** | Pagestorm write: dirty-leave confirm, disabled-button validation, STS1 relic hover text |
| **Pages visited** | 1 (`/pagestorm/write`) |

## Health Score: 94/100

| Category | Score |
|----------|-------|
| Console | 80 |
| Links | 95 |
| Visual | 95 |
| Functional | 95 |
| UX | 95 |
| Performance | 90 |
| Content | 100 |

## Top 3 Things to Fix

1. **ISSUE-001: Relic hover text left the slab** — Fixed. Gold, blue, red, green, purple, and energy orbs render, and description stays above the painted divider.
2. **ISSUE-002: Leaving a draft discarded the edit silently** — Fixed. The game confirm dialog offers 임시 저장 and 등록, and empty title or body is named beside the disabled buttons.
3. The site navbar still shows the existing hydration mismatch. It is outside this change.

## Summary

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 2 |
| Medium | 0 |
| Low | 0 |
| **Total** | **2** |

## Issues

### ISSUE-001: Relic hover text overflowed the slab and dropped color codes

| Field | Value |
|-------|-------|
| **Severity** | high |
| **Category** | visual |
| **URL** | http://localhost:3001/pagestorm/write |

**Description:** 금강저 description stored stripped `#y` / `#b` markup and drew it as one bitmap line, so 힘 was not gold, 1 was not blue, the divider between the description and the flavor was unused, and the flavor ran outside the panel.

**Repro Steps:**

1. Open `/pagestorm/write` and insert `{금강저#1}`.
2. Hover 금강저.
3. **Observe (before):** uncolored text, no wrap, flavor clipped past the slab.

---

### ISSUE-002: Dirty Pagestorm edits could be left without a confirm

| Field | Value |
|-------|-------|
| **Severity** | high |
| **Category** | functional |
| **URL** | http://localhost:3001/pagestorm/write |

**Description:** A filled or edited document navigated away with no confirm. Disabled 임시 저장 / 등록 buttons did not say that the title or body was empty.

**Repro Steps:**

1. Open `/pagestorm/write` with an empty title and body.
2. **Observe (before):** both buttons disabled, no reason.
3. Type a title and body, then follow 서류 폭풍으로 돌아가기.
4. **Observe (before):** the index opened and the edit was gone.

---

## Fixes Applied

| Issue | Fix Status | Commit | Files Changed |
|-------|-----------|--------|---------------|
| ISSUE-001 | verified | c7982530 | `mention-hover.tsx`, `generate-sts1-mention-index.ts` |
| ISSUE-002 | verified | 08d3f995 | `pagestorm-client.tsx`, `pagestorm-editor.tsx`, `game-confirm-modal.tsx`, `service.ts` |

Verified on `/pagestorm/write` after the fixes:

- Empty document: buttons disabled, copy `제목을 입력하세요. 본문을 입력하세요.`
- Title plus body, then 서류 폭풍으로 돌아가기: game confirm stays on the write URL. Ribbons are 임시 저장 and 등록. Escape stays. 등록 with an empty title stays and the body adds `제목을 입력하세요.`
- Relic hovers, text canvases inside the 248×315 panel, none crossing the divider band:
  - 금강저: gold 힘, blue 1, flavor wrapped on two lines, 힘 keyword tip
  - 네크로노미콘: gold and blue
  - 얼어붙은 핵: red `#r`
  - 구렁이의 반지: green `#g`
  - 성수: purple `#p`
  - 작은 집: longest description, `NL` line breaks, boss frame
  - 표본: longest flavor, rare frame, fully inside
  - 뱀의 반지 starter, 아카베코 common, 푸른 양초 uncommon, 새 머리 항아리 rare, 주판 shop, 피묻은 우상 special, 아스트롤라베 boss
  - 느로스의 배고픈 얼굴: longest title, inside the panel
  - 고대의 차 세트: two `[E]` orbs. 고통의 표식: red orb

## Ship Readiness

| Metric | Value |
|--------|-------|
| Health score | 70 → 94 |
| Issues found | 2 |
| Fixes applied | 2 |
| Deferred | navbar hydration mismatch (pre-existing) |
