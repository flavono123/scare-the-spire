---
name: qa
description: Integrated repository QA coordinator for scare-the-spire. Use when the user invokes $qa or asks for implementation-scoped QA, final verification, regression checks, or "QA this change"; always verifies docs/I18N.md policy and delegates to project QA skills such as mobile-viewport-qa and animation-playback-qa when the touched implementation scope requires them.
---

# QA

## Overview

Run the smallest QA set that credibly covers the implementation scope. Treat `docs/I18N.md` as mandatory policy for every QA pass, not as an optional localization check.

## Core Workflow

1. Identify the implementation scope from the conversation, `git status --short`, `git diff --name-only HEAD`, and any recent commits made during the current task.
2. Read `docs/I18N.md` before deciding checks. Summarize which i18n policy areas are relevant to the touched files.
3. Always run `pnpm i18n:validate`.
4. Run focused static checks:
   - `pnpm lint` when TypeScript, React, CSS, scripts, config, or data transforms changed.
   - `pnpm build` when routing, app layout, server/client boundaries, data loading, generated data, metadata, or deployment behavior changed.
   - Cloudflare/OpenNext checks when `wrangler.jsonc`, `open-next.config.ts`, Workers scripts, runtime env behavior, static asset headers, server/client data loading, or deployment target behavior changed. Load `.codex/skills/cf-guardrails/SKILL.md` first, then:
     - `pnpm cf:preview` for local Workers runtime smoke.
     - `pnpm exec wrangler deploy --dry-run --outdir /tmp/sts-worker-dry-run` after an OpenNext build to confirm final Worker bundle size and bindings.
     - Apply `$cf-guardrails` to review Free-plan runtime risk, request-time work, bundle size, subrequests, and `exceededResources`/503 failure modes.
     - Smoke representative static, SSG, and dynamic routes plus cache headers for `_next/static`, `/images`, `/spine`, `/generated`, `/api/search-index`, and `/comment-entities/sts2`.
   - Domain validators such as `pnpm codex:validate` or `pnpm codex:validate-references` when Codex entity data, versions, references, hover links, or rich patch content changed.
5. Run feature-specific tests or Playwright specs that directly cover the changed area. Prefer existing scripts in `scripts/*.spec.ts` over inventing new checks.
6. Delegate to the linked QA skills below when their trigger conditions match.
7. Report commands run, artifacts produced, failures, fixes made, and any checks intentionally skipped with the reason.

## Mandatory I18N Review

Use both automated and manual review:

- Re-read `docs/I18N.md` each QA pass.
- Run `pnpm i18n:validate` even if the implementation does not look localization-related.
- For changed React/UI files, scan newly touched user-visible text. Service-owned UI strings must come from the typed service dictionary rather than ad hoc literals.
- For game-origin text, verify the code uses extracted game localization/data instead of translating, normalizing, or hand-maintaining display labels.
- For URLs or locale handling, verify Korean remains prefixless canonical service UI, `/en` remains English service UI, game-only locale prefixes canonicalize to English service UI, and `/ko` is not introduced.
- For community, profile, nickname, comment, Chemical X, or meme content, verify stored/displayed body text is not auto-translated and that only the UI shell follows `serviceLocale`.
- For borrowed game phrases, verify fixture/runtime handling follows the source-game-text rules instead of generic service translation.

## Linked QA Skills

Use these project-local skills as subroutines when scope matches:

- `.codex/skills/sts2-compendium-patch-qa/SKILL.md`: run after STS2 PCK/game-data patch sync, Compendium `fieldDiffs`, versioning, lifecycle/deprecated handling, patch-history rails, or rich patch pages that touch Codex resources.
- `.codex/skills/mobile-viewport-qa/SKILL.md`: run after mobile-sensitive UI, page layout, render surfaces, detail rails, hover previews, patch pages, profile UI, or responsive behavior changes.
- `.codex/skills/animation-playback-qa/SKILL.md`: run after SpinePlayer, VFX, canvas, shader, video-like render surface, click-triggered animation, or replay behavior changes.

Load the sub-skill body only when needed, then follow its reporting rules in addition to this skill's summary.

## Scope Mapping

- Data-only STS2 entity changes: run `pnpm i18n:validate`, `pnpm codex:validate`, any entity/reference validator touched by the data shape, and `sts2-compendium-patch-qa` when the change came from a patch, PCK extraction, versioned diff, lifecycle field, or deprecated resource.
- Cross-reference or related-resource changes: run `pnpm i18n:validate`, `pnpm codex:validate-references`, relevant unit/static checks, and mobile QA if UI rails or detail pages changed.
- Rich patch note changes: run `pnpm i18n:validate`, patch/link/reference validators, targeted render or Playwright checks for hover/link behavior, `sts2-compendium-patch-qa` when linked Codex resources changed or should have changed, and mobile QA for patch routes.
- Frontend component changes: run `pnpm i18n:validate`, `pnpm lint`, targeted Playwright/spec checks, and mobile QA when layout or responsive behavior changed.
- Animation/rendering changes: run `pnpm i18n:validate`, targeted static checks, `animation-playback-qa`, and mobile QA if the render surface must work on mobile.
- Script, parser, or extraction changes: run `pnpm i18n:validate`, a representative script command or dry run, and validators for generated outputs affected by the script.
- Cloudflare Workers migration/runtime changes: load `$cf-guardrails`, then run `pnpm i18n:validate`, `pnpm lint`, `pnpm build`, `pnpm cf:preview`, Wrangler dry-run upload size check, guardrail risk review, and route/cache smoke against the local Workers preview URL. Include dev-tool parity smoke when `NEXT_PUBLIC_ENABLE_DEV_TOOLS=1` is expected for local preview, and verify that production deploy scripts do not enable dev tools by default.
- Patch Worker deployment changes: load `$cf-guardrails`, run `pnpm patch:build`, `pnpm patch:test`, `pnpm cf:patch:preview` when practical, and verify the patch Worker remains asset-first with no request-time patch markdown rendering or Compendium data querying.

## Adding Sub-QA Skills

When the same QA pattern becomes repeatable and too detailed for this coordinator, create a narrow project-local sub-skill under `.codex/skills/<area>-qa` using `$skill-creator`. Keep this skill as the router, then add a link and trigger condition under "Linked QA Skills".
