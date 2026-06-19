---
name: vercel-cloudflare-feature-migration
description: One-way fast-forward workflow for keeping a Cloudflare Workers migration/deploy branch current with Vercel/main feature and content changes while preserving Cloudflare-specific infrastructure. Use when the user asks to sync, fast-forward, catch up, cherry-pick, or move only feature/content implementation from Vercel/main into the Cloudflare branch, or asks how to avoid bringing Vercel-specific infra/nonfunctional changes during the Vercel to Cloudflare transition.
---

# Vercel to Cloudflare Feature Fast-Forward

## Purpose

Use this skill to move product behavior, UI, data, assets, copy, generated content, and feature support from the Vercel production line into the Cloudflare Workers line without redoing the Cloudflare migration or overwriting deployment/runtime setup.

Treat "fast-forward" as a one-way feature/content catch-up, not necessarily `git merge --ff-only`. Prefer preserving source commits when safe, but protect the target branch's Cloudflare infrastructure over Git history neatness.

## Branch Resolution

When the user does not name branches, infer them and state the assumption before changing files.

- Source branch: default to `main`, because this repository currently treats `main` as the Vercel production branch.
- Target branch: default to the only existing Cloudflare migration branch/worktree if present. In this repository that is usually `codex/cloudflare-workers-migration`.
- Confirm target by checking for Cloudflare markers: `wrangler.jsonc`, `open-next.config.ts`, `@opennextjs/cloudflare`, `wrangler`, and `.github/workflows/*cloudflare*`.
- If multiple plausible Cloudflare branches exist, stop and ask which one to update.
- If the source or target worktree is dirty, stop unless the dirty files are generated/ignored and clearly unrelated.

Do not assume the current shell `cwd` is the target branch. Inspect `git worktree list --porcelain` and `git branch --show-current`.

## What To Carry Forward

Include changes that alter the service's functional behavior or user-visible content:

- `src/app`, `src/components`, `src/lib`, `src/messages`
- `data`, `public` content/assets/generated files that are part of the feature
- `scripts` used by feature/content generation
- `supabase/migration-*` when the feature needs schema/data support
- project-local skills/docs only when the user asks to sync process knowledge

Review mixed commits carefully. A commit can be mostly feature work but contain deploy or environment edits that should not cross.

## What To Preserve On The Cloudflare Branch

Do not overwrite target-branch Cloudflare setup unless the user explicitly asks to change migration infrastructure:

- `wrangler.jsonc`
- `open-next.config.ts`
- Cloudflare deploy workflows such as `.github/workflows/cloudflare-workers.yml`
- Cloudflare environment naming, GHA secrets/vars wiring, and smoke steps
- Cloudflare analytics provider/token handling
- package scripts and dependencies added only for OpenNext/Wrangler
- Vercel-only landing/redirect/banner work that belongs to a future Vercel landing branch

Also avoid unrelated nonfunctional churn such as formatter-only rewrites, large metadata changes, or deployment policy edits unless required by the feature.

## Workflow

1. Fetch and orient:
   - Run `git fetch origin`.
   - Record source and target branch names.
   - Show divergence with `git log --left-right --cherry-pick --oneline <target>...<source>`.
   - Inspect changed paths with `git diff --name-status <target>...<source>`.

2. Classify commits:
   - Mark each source-only commit as `carry`, `skip`, or `split`.
   - `carry`: pure feature/content.
   - `skip`: Vercel infra, Cloudflare infra already handled, or unrelated nonfunctional work.
   - `split`: mixed commit; apply only allowed paths or revert excluded paths before committing.

3. Apply to target:
   - Prefer `git cherry-pick <sha>` for pure commits, preserving the original commit message.
   - For mixed commits, use `git cherry-pick -n <sha>`, restore excluded Cloudflare/Vercel infra paths from `HEAD`, then commit with the original message plus a short note if paths were intentionally omitted.
   - For a large contiguous set of pure commits, a normal merge from source into target is acceptable only after confirming it will not overwrite preserved Cloudflare files. If uncertain, cherry-pick.
   - Resolve conflicts in favor of source for product behavior and in favor of target for Cloudflare runtime/deploy setup.

4. Commit discipline:
   - Follow repository `AGENTS.md`; make a commit after each meaningful edit.
   - Use English commit messages unless the user explicitly asks otherwise.
   - Do not amend or squash existing user commits unless asked.

5. Verify on target:
   - Run at least `pnpm i18n:validate`, `pnpm lint`, and `pnpm tsc --noEmit`.
   - Run `pnpm build` when UI/data/routes changed or when the target will be pushed for deployment.
   - If the user asks to deploy or the workflow is expected to auto-deploy on push, push the target branch and inspect the relevant GitHub Actions/Cloudflare deployment status.

6. Report:
   - State source and target branch names.
   - List carried, skipped, and split commits.
   - Name any Cloudflare-specific files intentionally preserved.
   - Report validation and deployment status.

## Guardrails

- Do not use `git reset --hard`, `git checkout --`, or destructive cleanup unless explicitly requested.
- Do not silently sync Vercel preview settings, Vercel landing-page work, or Cloudflare deployment infrastructure.
- Do not treat Worker Observability, Web Analytics, or billing/security configuration as feature/content sync unless the user specifically asks.
- If a functional change depends on new environment variables, surface the variable names and where they must be set instead of inventing values.
