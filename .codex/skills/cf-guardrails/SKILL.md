---
name: cf-guardrails
description: Check Cloudflare Workers Free plan guardrails for scare-the-spire. Use when adding or changing features, Workers, OpenNext runtime behavior, patch Worker behavior, routing, build output, static assets, server data loading, API routes, SEO, sitemaps, canonical URLs, internal links, or any implementation that could affect Cloudflare CPU time, memory, bundle size, subrequests, crawl volume, request volume, or static-first delivery.
---

# cf-guardrails

Keep scare-the-spire viable on Cloudflare Workers Free. Apply this skill before
and after feature/runtime work, then use the focused project skill for the
domain being changed.

## Required Checks

- Prefer static generation, precomputed JSON, static assets, and cacheable
  responses. Keep Workers thin.
- Avoid request-time SSR, markdown rendering, large JSON parsing, full-data
  joins, search index construction, image processing, or route fan-out fetches.
- Treat these Workers Free constraints as design limits unless the user
  explicitly accepts a paid-plan target:
  - 10 ms CPU time per HTTP request
  - 128 MB memory per isolate
  - 3 MiB gzip Worker bundle size
  - 50 subrequests per invocation
  - 100,000 requests per day
- Treat `exceededResources`, Error 1102, exceeded CPU/memory, and likely 503
  behavior as functional failures, not ops-only concerns.
- Treat sitemap, canonical URL, `generateStaticParams`, internal-link, prefetch,
  and crawl-surface changes as runtime changes. A route becoming discoverable can
  expose cold OpenNext work even when no Worker file changed.
- For crawlable SSG routes, verify that the production request resolves to a
  static asset path. Do not infer static delivery only from successful Next.js
  generation or a `200` response.
- Check current Cloudflare docs before relying on numeric quotas, billing
  assumptions, or paid-only products.

## Project Shape

- Main Worker: `@opennextjs/cloudflare`, with static asset dispatch before
  OpenNext fallback.
- Prefixless Korean and `/en` service-locale Compendium detail HTML/RSC must be
  copied to `_cf_static_pages` and served before OpenNext. Game-only locale
  detail copies are excluded to stay below the Workers Free asset-count limit.
- Patch Worker: separate static Worker. Patch HTML, CSS, fonts, images, and
  provisional `/_patches/*` assets must be generated ahead of time.
- Do not move `/patches*` back into the main OpenNext runtime as the primary
  Cloudflare production path.
- Future custom-domain route dispatch is documented in
  `docs/CLOUDFLARE_CUSTOM_DOMAIN_ROUTING.md`.

## Verification Hooks

- For runtime/config changes, run the Cloudflare checks from `$qa`, including
  `pnpm cf:assets`, `pnpm cf:preview`, and Wrangler dry-run bundle/binding
  inspection.
- Smoke both HTML and RSC requests for representative Korean and English
  Compendium details. Require `x-cf-static-page: compendium`; a plain `200` is
  insufficient because OpenNext fallback can also return one.
- For patch Worker changes, run `pnpm patch:build`, `pnpm patch:test`, and
  preview/deploy checks from `$slseoun-patch` or `$qa`.
- For feature work, record the expected request-time cost and why it remains
  static, cached, or bounded to a small constant.
