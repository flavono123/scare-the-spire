---
name: history-course-qa
description: Verify scare-the-spire History Course seeded replay behavior against real local Slay the Spire 2 `.run` history files. Use when Codex changes `src/lib/sts2-run-replay.ts`, `/history-course` replay/map/topbar behavior, run upload parsing, build-version RNG branching such as v0.107.1 MegaRandom, or when QA needs evidence that uploaded runs still reconstruct exact act paths.
---

# History Course QA

## Overview

Use this skill to validate History Course replay reconstruction with the user's actual local STS2 run history. The canonical smoke is `scripts/survey-all-runs.ts`, which reads Steam `.run` files and reports exact, ambiguous, and zero-match act reconstructions by build.

## Source Data

The current survey script reads:

```text
~/Library/Application Support/SlayTheSpire2/steam/76561199168753671/profile1/saves/history
```

If that directory does not exist, inspect `scripts/survey-all-runs.ts` and the local `~/Library/Application Support/SlayTheSpire2/steam/*/profile*/saves/history` tree before changing the script. Do not commit user `.run` files.

## Workflow

1. Inspect the changed scope:
   - `git status --short`
   - `git diff --name-only HEAD`
   - recent commits from the current task if the working tree is clean.
2. Run the survey:

```bash
pnpm exec tsx scripts/survey-all-runs.ts
```

3. Compare results against the relevant baseline from the task, not just the total:
   - Before the v0.107.1 RNG fix, local survey was `160 runs / 303 acts / EXACT 223 / ZERO 80`.
   - After the v0.107.1 MegaRandom branch, expected local survey is about `EXACT 302 / ZERO 1`, with `v0.108.0 zero 0`.
   - Treat any new ZERO in pre-v0.107.1 builds as a likely regression unless explained by a separate map rule change.
   - Treat any new ZERO in v0.107.1+ builds as a likely RNG, map-generation, or run parsing regression unless the run spans a game patch boundary.
4. For a failing row, open the corresponding `.run` file from the local Steam history directory and inspect:
   - `build_id`, `seed`, `acts`, `ascension`, `players`, `modifiers`
   - act variants: standard, Spoils Map, Golden Compass, Winged Boots, Big Game Hunter, multiplayer
   - whether the file was likely started before and finished after a patch.
5. If a replay change is meant to fix a failure, rerun the survey after the fix and report the per-build delta.

## Required Checks

Run these for History Course replay logic changes:

```bash
pnpm exec tsc --noEmit --pretty false
pnpm lint
pnpm exec tsx scripts/survey-all-runs.ts
```

Also run targeted Playwright specs when UI behavior or screenshots can regress:

```bash
pnpm exec playwright test scripts/history-course-shell.spec.ts
pnpm exec playwright test scripts/history-course-rewards.spec.ts
```

Use `$mobile-viewport-qa` when route layout, topbar density, map rendering, tooltip surfaces, or responsive History Course UI changed.

## Reporting

Report the exact command output summary, especially total runs, acts, exact, ambiguous, zero, and per-build zero counts. Include any known residual failure with filename, build, seed, and the likely reason.
