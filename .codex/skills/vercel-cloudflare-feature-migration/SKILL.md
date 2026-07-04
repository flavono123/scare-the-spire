---
name: vercel-cloudflare-feature-migration
description: Plan or execute functional application behavior changes for the current Cloudflare Workers/OpenNext runtime, including legacy Vercel-to-Cloudflare parity work. Use when preserving or changing route behavior, SSR/SSG/static semantics, app APIs, metadata, Supabase-backed features, client navigation, cookies/auth, static asset usage, static-first routing, or Cloudflare Free tier runtime viability.
---

# Cloudflare Runtime Feature Guardrails

## Scope

Use this skill for application behavior on the Cloudflare Workers/OpenNext
runtime. The project no longer treats Vercel as the primary deployment target;
Vercel references are legacy compatibility context.

Treat these as in scope:

- Next.js route behavior, including App Router layouts, dynamic routes, metadata, OG data, redirects that affect user navigation, and error/not-found behavior.
- SSR/SSG/static rendering semantics that change what users can see or do.
- Server actions, route handlers, API endpoints, cookies, headers, request origin helpers, and environment-dependent app behavior.
- Client navigation, modal routes, history state, hydration, and feature gates such as dev/admin UI parity.
- External product features that must keep working after the runtime move, such as Supabase-backed comments, likes, Chemical X, and History Course shared runs.
- Static asset paths only when missing assets break visible functionality.
- Static-first Cloudflare behavior: main Worker asset dispatch, OpenNext fallback, `_cf_static_pages` copies, cache headers, and patch Worker service-binding fallback.
- Cloudflare Workers Free viability for feature work: request-time CPU, memory, gzip bundle size, subrequests, and startup/runtime rendering risk.

Do not use this skill as the primary guide for:

- GitHub Actions, CI/CD, deployment automation, Wrangler credentials, API tokens, account setup, custom domains, DNS, billing dashboards, observability dashboards, Web Analytics, or paid-plan procurement.
- Pure redirect-landing or marketing copy migration unless the redirect changes app navigation behavior.

For Cloudflare platform facts, load `$cloudflare` and verify current official
docs. Do not rely on remembered limits. For final repository QA, load the
project `$qa` skill.

## Default Mode

When the user asks for a plan, produce a plan and do not edit code. Only implement after the user explicitly asks to implement. If implementation will touch broad route trees or many files, follow `AGENTS.md` broad-change approval rules before editing.

## Workflow

1. **State the boundary.**
   - Say which requested items are functional Cloudflare runtime behavior and which are infrastructure/nonfunctional.
   - Keep nonfunctional items in a separate appendix or handoff list rather than mixing them into the functional work plan.

2. **Inventory behavior surfaces.**
   - List routes by behavior class: static/SSG, dynamic SSR, API route/route handler, client-only feature, dev-only feature.
   - Include metadata/OG, `robots`, `metadataBase`, origin helpers, and localized routes when they affect user-visible behavior.
   - For this repository, always check at least: `/`, `/compendium/*` indexes and details, `/chemical-x`, `/chemical-x/[id]`, `/history-course`, `/history-course/[runId]`, `/api/dev/history-course-runs`, comments/likes/auth hooks, and dev/admin surfaces.

3. **Compare runtime assumptions.**
   - Identify behavior depending on Vercel-specific globals, Vercel env names, Vercel headers, Node APIs, filesystem reads after build, server bundle tracing, dynamic route defaults, or production-only `NODE_ENV`.
   - Identify behavior that would add request-time SSR, markdown rendering, large JSON parsing, unbounded search/index work, image processing, or many subrequests in a Worker.
   - Distinguish “must change for user behavior” from “deployment setting only.”

4. **Design the functional Cloudflare behavior.**
   - Prefer small compatibility helpers over scattered runtime checks.
   - Preserve existing public URLs and path/query semantics unless the user explicitly approves a canonical URL change.
   - Keep external data systems in place unless the user asks to migrate them. In this repo, Supabase remains the source for comments, likes, Chemical X, profiles, and shared runs.
   - Prefer static generation, precomputed data, static assets, and cacheable responses before introducing OpenNext runtime work.
   - Keep `/patches*` and `/_patches*` on the separate static patch Worker path for Cloudflare production. The main Worker's `PATCH_WORKER` binding is the current workers.dev and rollback fallback; future custom-domain direct routing lives in `docs/CLOUDFLARE_CUSTOM_DOMAIN_ROUTING.md`.

5. **Plan verification from user workflows.**
   - For each behavior surface, define a route or browser action that proves parity.
   - Include both HTTP smoke checks and browser checks for client navigation or hydration-sensitive bugs.
   - Include known data-backed examples such as a known Chemical X post id and known shared run id when available.

6. **Call out implementation risks.**
   - Note Cloudflare Workers Free risks when the feature may exceed 10 ms CPU per HTTP request, 128 MB memory, 3 MiB gzip Worker size, 50 subrequests per invocation, or 100,000 requests per day.
   - Treat Error 1102, `exceededResources`, and 503 risk as functional ship blockers unless the user explicitly accepts a paid-plan or architecture change.
   - Note runtime incompatibilities that may force a feature split into server shell + client fetch.
   - Note whether the plan needs production-like environment values to verify behavior.

## Output Shape

Use this structure for planning responses:

```markdown
**Boundary**
- Functional Cloudflare runtime behavior:
- Separate infrastructure/nonfunctional track:

**Behavior Inventory**
| Surface | Current behavior | Cloudflare/OpenNext concern | Functional action | Verification |

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
