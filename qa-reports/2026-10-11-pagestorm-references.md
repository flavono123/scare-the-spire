# QA Report: 슬서운이야기

| Field | Value |
|-------|-------|
| **Date** | 2026-10-11 |
| **URL** | http://localhost:3001/pagestorm/write |
| **Branch** | main |
| **Commit** | 2414f9c2 |
| **Tier** | Quick |
| **Scope** | Pagestorm write editor: block drag, header grip, inline link sheet, hover references, STS1 picker |
| **Pages visited** | 1 (`/pagestorm/write`) |

## Health Score: 92/100

| Category | Score |
|----------|-------|
| Console | 80 |
| Links | 95 |
| Visual | 95 |
| Functional | 95 |
| UX | 90 |
| Performance | 90 |
| Content | 100 |

## Top 3 Things to Fix

1. **ISSUE-001: Link sheet stayed open until a later blur** — Fixed in the same change. Clicking outside the sheet writes the phrase and address.
2. No second high-severity issue in this scope.
3. The site navbar still shows the existing hydration mismatch. It is outside this editor change.

## Summary

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 1 |
| Medium | 0 |
| Low | 0 |
| **Total** | **1** |

## Issues

### ISSUE-001: Inline link sheet did not apply when focus left it

| Field | Value |
|-------|-------|
| **Severity** | high |
| **Category** | functional |
| **URL** | http://localhost:3001/pagestorm/write |

**Description:** The phrase and address fields appeared beside the caret, but leaving them by clicking the title field did not write the link.

**Repro Steps:**

1. Open `/pagestorm/write` and click 링크.
2. Fill 링크 문구 and 링크 주소.
3. Click the title field.
4. **Observe:** the sheet stayed and no `pagestorm-inline-link` was created.

---

## Fixes Applied

| Issue | Fix Status | Commit | Files Changed |
|-------|-----------|--------|---------------|
| ISSUE-001 | verified | 2414f9c2 | `src/components/pagestorm/link-sheet.tsx` |

Verification on `/pagestorm/write`:

- A details block shows 끌어서 옮기기 on the left. A focused table shows a second drag handle, and 헤더 해제 stays on the header row (button center at the header midline) while the caret is in a body cell of another column.
- Clicking outside the link sheet created one aqua inline link, 도로헤도로 → `https://example.com/dorohedoro`, and closed the sheet. The fields are not in the top toolbar.
- `{타격}` became the STS2 card `STRIKE_DEFECT` (`/compendium/cards?card=strike_defect`). `타격#1` became STS1 `sts1:cards:strike-r`. `죽어 죽어 죽어` became STS1 Die Die Die because that name is not an STS2 card.
- The STS1 toolbar icon opens 캐릭터, 카드 모음집, 유물 모음집, 포션 연구실, 파워. Card search for 타격, plus color, type, rarity, and cost filters, listed the library strikes. Choosing 타격 inserted a card asset at `/images/sts1/cards/strike-r.webp` linking to `/compendium/sts1/cards/strike-r`.
- `#1` and `@version` are parsed together. `예비@0.99.1` is recognized and not resolved.

## Ship Readiness

| Metric | Value |
|--------|-------|
| Health score | 92 |
| Issues found | 1 |
| Fixes applied | 1 |
| Deferred | 0 |
