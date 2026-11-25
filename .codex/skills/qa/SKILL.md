---
name: qa
description: Integrated repository QA coordinator for scare-the-spire. Use when the user invokes $qa or asks for implementation-scoped QA, final verification, regression checks, or "QA this change"; always verifies docs/I18N.md policy and delegates to project QA skills such as mobile-viewport-qa, animation-playback-qa, and history-course-qa when the touched implementation scope requires them.
---

# QA

Run the smallest set of checks that covers the change (`git status --short`, `git diff --name-only HEAD`, this task's commits). Report commands run, failures, fixes and anything skipped with the reason.

## Always

- Re-read `docs/I18N.md` and run `pnpm i18n:validate`. On touched UI: service strings come from the typed dictionary, game text from extracted data (never hand-translated), Korean stays prefixless and `/en` is English UI (no `/ko`), community bodies (comments, nicknames, posts) are never auto-translated, borrowed game phrases follow the source-text rules.
- `pnpm lint` when code, config, scripts or data transforms changed. Prefer existing `scripts/*.spec.ts` covering the area over new checks.

## By scope

- STS2 data, versions, patch sync, deprecated resources: `pnpm codex:validate`, `pnpm codex:validate-references`, then the QA section of `$sts2-compendium-patch-sync`.
- Rich patch notes: `bin/ssy tags <version>`, `pnpm patch:test`, hover/link checks on `/patches/<v>` and `/en/patches/<v>`.
- Routing, layout, data loading, metadata, Workers, headers, sitemap or crawlable routes: `pnpm cf:build`, `pnpm cf:assets`, `pnpm cf:size`, `pnpm cf:preview` (it serves no `/dev` or `/api/dev`; test dev tools on `pnpm dev`), and the owner-header smoke from AGENTS.md (`pnpm cf:smoke`). Check that production deploy scripts don't enable dev tools.
- Patch Worker: `pnpm patch:build`, `pnpm patch:test`, `pnpm cf:patch:preview` when practical; it stays asset-first with no request-time markdown or Compendium queries.
- Animation, Spine, VFX, canvas: `$animation-playback-qa`. History Course replay, `.run` parsing, RNG branching: `$history-course-qa`.

## Mobile state matrix (every UI change)

A control can spill out of a fixed-height box and hide under the next block after a filter opens, while overflow checks and screenshots pass (2026-11-04, the beta-art checkbox).

- `$mobile-viewport-qa` on every changed route at all presets (`scripts/mobile-qa.mjs --list`, from 320px; never only 390px), with `--open "SEL||SEL"` for each state the change adds or reshapes (filters, tabs, drawers). A route with filters isn't checked until each filter row was opened.
- A covered control is a bug; "under a fixed layer" is a warning to report.
- Check ko, `/en` and one game-only locale (`/ja`).
- Red flag: fixed `h-*` on a `flex-wrap` row; use `min-h-*` per breakpoint.
- A later commit to the same screen voids an earlier "mobile ok".
