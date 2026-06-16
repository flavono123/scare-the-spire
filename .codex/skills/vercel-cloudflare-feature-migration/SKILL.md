---
name: vercel-cloudflare-feature-migration
description: Plan or execute functional application behavior migration from Vercel/Next.js to Cloudflare Workers/OpenNext while explicitly excluding infrastructure-only or nonfunctional work such as GitHub Actions, DNS, domains, billing, analytics dashboards, credentials, observability, and deployment pipelines. Use when the task is to preserve route behavior, SSR/SSG semantics, app APIs, metadata, Supabase-backed features, client navigation, cookies/auth, static asset usage that affects behavior, or development-only feature parity across the Vercel-to-Cloudflare runtime change.
---

# Vercel to Cloudflare Feature Migration

## Scope

Use this skill for application behavior parity. Treat these as in scope:

- Next.js route behavior, including App Router layouts, dynamic routes, metadata, OG data, redirects that affect user navigation, and error/not-found behavior.
- SSR/SSG/static rendering semantics that change what users can see or do.
- Server actions, route handlers, API endpoints, cookies, headers, request origin helpers, and environment-dependent app behavior.
- Client navigation, modal routes, history state, hydration, and feature gates such as dev/admin UI parity.
- External product features that must keep working after the runtime move, such as Supabase-backed comments, likes, Chemical X, and History Course shared runs.
- Static asset paths only when missing assets break visible functionality.

Do not use this skill as the primary guide for:

- GitHub Actions, CI/CD, deployment automation, Wrangler credentials, API tokens, account setup, custom domains, DNS, billing, quotas, observability, dashboards, Web Analytics, or performance budgets.
- Pure redirect-landing or marketing copy migration unless the redirect changes app navigation behavior.

For Cloudflare platform facts, load `$cloudflare` and verify current official docs. For final repository QA, load the project `$qa` skill.

## Default Mode

When the user asks for a plan, produce a plan and do not edit code. Only implement after the user explicitly asks to implement. If implementation will touch broad route trees or many files, follow `AGENTS.md` broad-change approval rules before editing.

## Workflow

1. **State the boundary.**
   - Say which requested items are functional app migration and which are infrastructure/nonfunctional.
   - Keep nonfunctional items in a separate appendix or handoff list rather than mixing them into the functional work plan.

2. **Inventory behavior surfaces.**
   - List routes by behavior class: static/SSG, dynamic SSR, API route/route handler, client-only feature, dev-only feature.
   - Include metadata/OG, `robots`, `metadataBase`, origin helpers, and localized routes when they affect user-visible behavior.
   - For this repository, always check at least: `/`, `/compendium/*` indexes and details, `/chemical-x`, `/chemical-x/[id]`, `/history-course`, `/history-course/[runId]`, `/api/dev/history-course-runs`, comments/likes/auth hooks, and dev/admin surfaces.

3. **Compare runtime assumptions.**
   - Identify behavior depending on Vercel-specific globals, Vercel env names, Vercel headers, Node APIs, filesystem reads after build, server bundle tracing, dynamic route defaults, or production-only `NODE_ENV`.
   - Distinguish “must change for user behavior” from “deployment setting only.”

4. **Design the functional migration.**
   - Prefer small compatibility helpers over scattered runtime checks.
   - Keep Vercel and Cloudflare coexisting in the same branch unless the user asks for a fork.
   - Preserve existing public URLs and path/query semantics unless the user explicitly approves a canonical URL change.
   - Keep external data systems in place unless the user asks to migrate them. In this repo, Supabase remains the source for comments, likes, Chemical X, profiles, and shared runs.

5. **Plan verification from user workflows.**
   - For each behavior surface, define a route or browser action that proves parity.
   - Include both HTTP smoke checks and browser checks for client navigation or hydration-sensitive bugs.
   - Include known data-backed examples such as a known Chemical X post id and known shared run id when available.

6. **Call out implementation risks.**
   - Note Worker bundle size risk only as it affects whether a functional implementation can ship; detailed billing/quota planning belongs outside this skill.
   - Note runtime incompatibilities that may force a feature split into server shell + client fetch.
   - Note whether the plan needs production-like environment values to verify behavior.

## Output Shape

Use this structure for planning responses:

```markdown
**Boundary**
- Functional migration:
- Separate infrastructure/nonfunctional track:

**Behavior Inventory**
| Surface | Current Vercel behavior | Cloudflare/OpenNext concern | Functional action | Verification |

**Migration Plan**
1. ...

**Verification Plan**
- Local:
- Preview:
- Production-parallel:

**Open Decisions**
- ...
```

If the user also asks about GHA, credentials, domains, analytics, or rollout operations, answer those in a clearly separate section titled `Infrastructure Handoff` and do not let that section drive application-code changes.
