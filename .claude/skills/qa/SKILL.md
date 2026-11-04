# qa (QA 테스트)

Systematically QA test the web application and fix bugs found.

This skill should be used when:
- "qa", "QA", "테스트해줘", "버그 찾아줘", "사이트 점검"
- "test this site", "find bugs", "test and fix", "fix what's broken"
- A feature is ready for testing or user asks "does this work?"
- After deploying or before creating a PR

## Overview

Three-tier QA testing with structured reporting:
- **Quick** — Critical/High severity only (default)
- **Standard** — + Medium severity
- **Exhaustive** — + Low/cosmetic issues

## Process

### 1. Setup

Ensure dev server is running. If not:
```bash
pnpm --dir /Users/hansuk.hong/P/scare-the-spire dev
```

Determine scope:
- **Full app**: Test all major routes
- **Scoped**: Test only the specified pages/features

### 2. Discovery

Identify pages to test based on scope:
- `/codex/cards` — Card library (612 cards, 5 characters, filters)
- `/codex/relics` — Relic library (314 relics)
- `/codex/potions` — Potion library (63 potions)
- `/codex/ancients` — Ancient library (8 ancients)
- `/codex/events` — Event library
- `/codex/cards/[slug]`, `/codex/relics/[slug]` — Detail pages
- `/patch/[version]` — Rich patch notes (슬서운변경)
- `/` — Main landing page
- `/(main)/cards`, `/(main)/relics` — STS1 legacy pages

### 3. Per-Page Testing (from issue-taxonomy.md)

For each page:
1. **Visual scan** — Check layout, broken images, alignment, responsive
2. **Interactive elements** — Click every button, link, filter, control
3. **Console errors** — Check browser console for JS errors, failed requests
4. **Navigation** — All paths in/out work correctly
5. **States** — Empty state, loading, error, overflow
6. **Content** — Korean text correct, no placeholder text, entity names match game i18n
7. **Performance** — Page load time, image optimization, layout shifts

### 4. Issue Reporting

Use severity levels from `references/issue-taxonomy.md`.
Write report using `templates/qa-report-template.md`.

Save reports to: `qa-reports/YYYY-MM-DD-{scope}.md`

### 5. Fix Loop (unless report-only)

For each issue (critical → low):
1. Fix the bug in source code
2. Commit atomically: `fix(qa): ISSUE-NNN short description`
3. Re-verify the fix
4. Update report with fix status

## Mobile State Matrix (required for UI changes)

A page that looks right on first load can still break once a filter, tab, menu, or toggle opens a
new row. Overflow checks and screenshots miss a control that spills out of a fixed-height box and
sits under the next block (2026-11-04: the beta art 출시 뒤 바뀐 그림 checkbox, covered on every
phone width, shipped after "mobile checked").

- Run `.codex/skills/mobile-viewport-qa` for every route whose UI changed, at all presets from
  `scripts/mobile-qa.mjs --list`. The list starts at 320px; never drop it or test only 390px.
- Pass `--open "SEL||SEL"` for each state the change adds or reshapes (type filters, sub-filters,
  tabs, drawers, quiz/answer views) so overflow and the covered-control check run after each click.
  A route with filters is not checked until each filter row has been opened.
- A covered-control failure is a bug, not a warning. "under a fixed layer" lines are reported as
  warnings; mention them in the report.
- Check ko, `/en`, and one game-only locale (`/ja`): longer labels wrap differently.
- Red flag in review: a fixed `h-*` on a `flex-wrap` row or any box holding wrapping controls.
  Reserve room with `min-h-*` per breakpoint instead.
- When a commit after an earlier QA pass changes the same screen, the earlier "mobile ok" does not
  carry over. Rerun the matrix.

## Project-Specific Notes

- This is a **Next.js SSG site** — most pages are static, check `next build` for build errors
- Korean is the primary language — verify Korean text rendering and gc-batang font
- Game entity names must match official Korean translations
- Image paths: `public/images/sts2/` — check for missing/broken asset references
- Text effects use BBCode-style markup — verify rendering of gold/colored/animated text
- Version selector in patch pages — test version switching works correctly

## References

- `references/issue-taxonomy.md` — Severity levels and category definitions
- `templates/qa-report-template.md` — Report format
