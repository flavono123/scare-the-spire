# OpenNext Runtime Exit Plan

## Status

The service began as a Vercel-targeted Next.js application. OpenNext was added
as the Cloudflare migration adapter and is still the build and runtime fallback
for routes that are not served from `_cf_static_pages`.

The short-term production shape remains:

```text
request
  -> thin main Worker
  -> static home, service index, or Compendium asset when covered
  -> OpenNext fallback otherwise
```

Chemical X and History Course indexes are direct static HTML/RSC pages across
all supported game-locale prefixes. This removes their known Error 1102 path
without coupling the incident fix to a broad deployment migration.

## Goal

Remove request-time OpenNext execution from public production traffic, then
remove the OpenNext runtime and build dependency after the static deployment
pipeline can produce the same public route surface.

Keeping Next.js as the authoring and build framework is allowed. The goal is to
remove OpenNext from the request path; replacing React or the App Router is not
required unless a later phase demonstrates that it is simpler.

## Constraints

- Stay within Cloudflare Workers Free guardrails.
- Keep the main Worker limited to bounded path dispatch, locale redirects, and
  the patch Worker service binding.
- Do not copy every generated locale page blindly. The Free plan allows 20,000
  static asset files per Worker version, while the full Next build produces
  substantially more HTML/RSC files.
- Preserve prefixless Korean service UI, `/en` English service UI, and all
  supported game-locale path prefixes.
- Preserve direct links to user-generated Chemical X, History Course, and This
  or That records even though their IDs are not enumerable at build time.
- Keep patch pages on the separate static patch Worker.
- Do not introduce request-time markdown rendering, full-data joins, large JSON
  parsing, image work, or search indexing in a Worker.

## Current OpenNext Responsibilities

OpenNext currently provides four capabilities that must be replaced before it
can be removed:

1. It packages Next static assets and the App Router output for Cloudflare.
2. It serves prerendered routes that are not copied into `_cf_static_pages`,
   including game-only locale detail variants constrained by the asset limit.
3. It renders route shells for unbounded IDs such as:
   - `/chemical-x/[id]`
   - `/history-course/[runId]`
   - `/this-or-that/[id]`
4. It handles residual Next routing behavior such as RSC requests, redirects,
   metadata, not-found responses, and development-only route fallbacks.

The user-generated detail pages do not need server-owned record rendering.
Their content already resolves in the browser from Supabase or IndexedDB, and
their current metadata is generic rather than record-specific. They can
therefore move to static shells without losing existing server-rendered data.

## Target Architecture

```text
request
  -> thin main Worker
     -> root locale redirect
     -> /patches* service binding
     -> exact static HTML/RSC asset
     -> bounded rewrite to a static shell for an unbounded public ID
     -> static 404

browser
  -> immutable Next chunks and images
  -> locale-scoped generated JSON
  -> Supabase or IndexedDB for user-owned/live records
```

The target main Worker has no application rendering fallback and performs no
work proportional to the number of cards, relics, runs, posts, or patch notes.

## Migration Phases

### Phase 1: Inventory and fallback observability

- Maintain a machine-readable list of public route families and their expected
  delivery mode: exact static page, static shell, patch Worker, or static 404.
- Add production-shaped smoke coverage for document and RSC requests.
- Require an `x-cf-static-page` classification for every route expected to be
  static; a plain `200` must not count as success.
- Add a bounded way to identify unexpected OpenNext fallback paths without
  storing sensitive request headers or user record IDs.
- Record baseline Worker CPU, 1102 errors, asset count, largest asset, and
  compressed Worker bundle size.

Exit condition: every intended public route family has an owner and expected
delivery mode, and unexpected fallback traffic can be measured.

### Phase 2: Remove oversized page payloads

- Stop embedding the full Compendium entity graph in the Chemical X HTML/RSC
  payload.
- Generate locale-scoped, cacheable client data for mentions and hover cards.
  Preserve official game-localized names for every supported game locale.
- Reuse the static comment-entity loading path where possible, but split or
  slim the payload when that materially improves initial load cost.
- Apply the same rule to any other page that serializes a full resource graph.

Exit condition: service index HTML/RSC remains a small UI shell, and large
resource data is fetched as immutable or long-lived static JSON.

### Phase 3: Replace unbounded dynamic pages with static shells

- Create one static detail shell for Chemical X posts. The browser derives the
  post ID from the URL and loads the record from Supabase.
- Create one static History Course detail shell. The browser derives `runId`
  from the URL and loads from IndexedDB or Supabase.
- Create one static This or That detail shell with the same path-derived ID
  contract.
- Teach the thin Worker to rewrite only the validated route shapes to those
  shells for both document and RSC navigation.
- Preserve canonical URLs and generic metadata. Any future record-specific OG
  rendering is a separate design and must not reintroduce request-time Next
  rendering by default.

Exit condition: unbounded user-content paths never invoke OpenNext and invalid
nested paths fail closed.

### Phase 4: Consolidate game-only locale detail delivery

- Keep Korean and English crawlable Compendium details as exact prerendered
  HTML/RSC where they fit the asset budget.
- Serve game-only locale variants through a bounded static detail shell plus
  locale/resource JSON instead of copying every locale/entity HTML/RSC pair.
- Preserve the selected game locale in the URL and keep the service UI English
  for game-only locale prefixes.
- Measure asset count before and after every change. Prefer shared shells and a
  bounded number of locale/type JSON files over per-resource duplication.

Exit condition: every supported locale path is static or shell-backed while
the production asset count retains safe headroom below 20,000 files.

### Phase 5: Remove the runtime fallback

- Replace `openNextWorker.fetch` with an explicit static 404 after all known
  public routes are covered.
- Run the production route inventory against a preview with OpenNext fallback
  disabled.
- Observe production with fallback telemetry for at least seven days before
  deleting the fallback code.

Exit condition: no expected public request needs OpenNext, no unexplained
fallback paths remain, and there are no routing or locale regressions.

### Phase 6: Remove the OpenNext build dependency

- Evaluate Next static export versus a small repository-owned asset collector.
  The choice must support App Router chunks, HTML/RSC assets, static shells,
  redirects, and the Cloudflare asset manifest without dynamic route expansion.
- Update CI, preview, dry-run, and deploy commands to build and upload the new
  artifact directly with Wrangler.
- Remove `@opennextjs/cloudflare`, `open-next.config.ts`, `.open-next/worker.js`,
  and OpenNext-specific cache seeding only after artifact parity is verified.
- Retain a rollback tag or known-good deployment version for the final
  migration.

Exit condition: a clean checkout can build, preview, and deploy without
OpenNext, and the production smoke suite passes against the deployed version.

## Release Gates

The runtime fallback must not be removed until all of the following hold:

- Zero expected public route families use OpenNext in preview and production.
- No `exceededResources` or Error 1102 events attributable to page delivery for
  seven consecutive days.
- Static dispatch CPU stays comfortably below the 10 ms Free-plan limit; use a
  5 ms p99 investigation threshold for the thin main Worker.
- Static assets stay below 90% of the account's current per-version file limit,
  and every individual asset stays below the current Cloudflare size limit.
- The compressed main Worker bundle stays below the current Free-plan limit.
- Korean, English, and one game-only locale pass both document and RSC smoke
  tests for home, service indexes, Compendium indexes/details, and all static
  detail shells.
- Direct refresh, client navigation, canonical metadata, not-found behavior,
  Supabase-unavailable UI, and IndexedDB-only History Course runs still work.
- Patch routes still resolve through the separate patch Worker.

Re-check Cloudflare's current limits immediately before each migration phase;
the numeric values in this plan are guardrails, not a substitute for current
platform documentation.

## Rollback Strategy

- Keep every phase independently deployable and reversible.
- During shell migrations, retain the prior OpenNext route behind a temporary
  explicit fallback rather than mixing both renderers for the same request.
- If a static shell or locale route regresses, restore the previous route
  mapping and redeploy through CI; do not bypass CI with an ad hoc Wrangler
  production deploy.
- Do not combine the final runtime removal with content, schema, or game-data
  changes.
