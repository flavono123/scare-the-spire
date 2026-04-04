# QA Report: 슬서운이야기

| Field | Value |
|-------|-------|
| **Date** | {DATE} |
| **URL** | {URL} |
| **Branch** | {BRANCH} |
| **Commit** | {COMMIT_SHA} |
| **Tier** | Quick / Standard / Exhaustive |
| **Scope** | {SCOPE or "Full app"} |
| **Pages visited** | {COUNT} |

## Health Score: {SCORE}/100

| Category | Score |
|----------|-------|
| Console | {0-100} |
| Links | {0-100} |
| Visual | {0-100} |
| Functional | {0-100} |
| UX | {0-100} |
| Performance | {0-100} |
| Content | {0-100} |

## Top 3 Things to Fix

1. **{ISSUE-NNN}: {title}** — {one-line description}
2. **{ISSUE-NNN}: {title}** — {one-line description}
3. **{ISSUE-NNN}: {title}** — {one-line description}

## Summary

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 0 |
| Medium | 0 |
| Low | 0 |
| **Total** | **0** |

## Issues

### ISSUE-001: {Short title}

| Field | Value |
|-------|-------|
| **Severity** | critical / high / medium / low |
| **Category** | visual / functional / ux / content / performance / console / accessibility |
| **URL** | {page URL} |

**Description:** {What is wrong, expected vs actual.}

**Repro Steps:**

1. Navigate to {URL}
2. {Action}
3. **Observe:** {what goes wrong}

---

## Fixes Applied

| Issue | Fix Status | Commit | Files Changed |
|-------|-----------|--------|---------------|
| ISSUE-NNN | verified / deferred | {SHA} | {files} |

---

## Ship Readiness

| Metric | Value |
|--------|-------|
| Health score | {before} → {after} ({delta}) |
| Issues found | N |
| Fixes applied | N |
| Deferred | N |
