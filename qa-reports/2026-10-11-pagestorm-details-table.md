# QA Report: 슬서운이야기

| Field | Value |
|-------|-------|
| **Date** | 2026-10-11 |
| **URL** | http://localhost:3001/pagestorm/write |
| **Branch** | main |
| **Commit** | a1aa6854, 5b614ca8 |
| **Tier** | Quick |
| **Scope** | Pagestorm write editor: collapsed details edit chrome, table header restore |
| **Pages visited** | 1 (`/pagestorm/write`) |

## Health Score: 94/100

| Category | Score |
|----------|-------|
| Console | 90 |
| Links | 100 |
| Visual | 95 |
| Functional | 95 |
| UX | 95 |
| Performance | 90 |
| Content | 100 |

## Top 3 Things to Fix

1. **ISSUE-001: Edit handles stay after details collapses** — Fixed. Collapsing moves the caret into the summary and hides the body, so table grips and other edit chrome disappear.
2. **ISSUE-002: No way back to a header row** — Fixed. The current row has a header grip that turns it into a gold header row, or back into a body row.
3. No third high-severity issue in this scope.

## Summary

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 2 |
| Medium | 0 |
| Low | 0 |
| **Total** | **2** |

## Issues

### ISSUE-001: Edit handles stay after details collapses

| Field | Value |
|-------|-------|
| **Severity** | high |
| **Category** | visual |
| **URL** | http://localhost:3001/pagestorm/write |

**Description:** Focusing a table inside a details block and then collapsing it left the row and column grips floating in the empty area under the summary. The same must not happen for other editor components.

**Repro Steps:**

1. Open `/pagestorm/write` and insert 펼치기, then a table inside it.
2. Focus a cell so the row and column grips appear.
3. Click 접기.
4. **Observe:** minus and plus grips stayed visible below the collapsed summary.

---

### ISSUE-002: Deleted header row cannot be restored

| Field | Value |
|-------|-------|
| **Severity** | high |
| **Category** | functional |
| **URL** | http://localhost:3001/pagestorm/write |

**Description:** Deleting the header row left only body cells. There was no control to turn a remaining row back into a header.

**Repro Steps:**

1. Insert a table and focus the header row.
2. Delete that row.
3. **Observe:** every remaining cell is a body cell, and nothing on the table restores the gold header style.

---

## Fixes Applied

| Issue | Fix Status | Commit | Files Changed |
|-------|-----------|--------|---------------|
| ISSUE-001 | verified | a1aa6854 | `details.tsx`, `toolbar.tsx`, `table-controls.tsx`, `pagestorm-editor.css` |
| ISSUE-002 | verified | 5b614ca8 | `table-controls.tsx`, `pagestorm-editor.css`, `messages/service.ts` |

Verification on `/pagestorm/write`:

- With a table cell focused, 접기 set `data-open="false"`, hid the body (`display: none`), and left zero `.pagestorm-table-grip` nodes. The collapsed summary is only the 펼치기 bar.
- A selected YouTube embed inside the same details showed 5 edit buttons while open and 0 visible buttons after 접기, with the table grips still gone.
- Deleting the header row left 0 `th` cells. The grip labeled 이 행을 헤더로 restored 3 gold header cells (`rgb(239, 200, 81)`, weight 700). In a header cell the same grip reads 헤더 해제.

## Ship Readiness

| Metric | Value |
|--------|-------|
| Health score | 70 → 94 (+24) |
| Issues found | 2 |
| Fixes applied | 2 |
| Deferred | 0 |
