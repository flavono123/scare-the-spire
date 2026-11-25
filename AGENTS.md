# 슬서운 이야기 (scare-the-spire)

Slay the Spire 1/2 site. The STS2 Compendium and rich patch notes (슬서운변경) are the service; STS1 is legacy.
Korean is the first-class language. Facts the repo can answer (stack, structure, counts) are not repeated here: read the code or ask a tool.

## Tools first

- `bin/ssy find <id|name>` — official ko/en name, type and URL of any game element. Never translate an id yourself.
- `bin/ssy changes <ID>`, `bin/ssy lines <version> [text]` — balance history and patch line ids.
- `bin/ssy api [route] [k=v]` — list or call public `/api/read/*` routes (prod by default, `--host testbed|local`).
- `bin/ssy ci` — deploy runs with queue wait and slow steps.
- `pnpm cf:limits` before adding pages, Compendium entries, toybox games or `public/` files (main Worker static asset budget). Details: `docs/CLOUDFLARE_LIMITS.md`.
- Skills live in `.codex/skills/` (`.claude/skills/` symlinks to them). When a skill restates something a tool or script does, trust the tool.

## Commits and branches

- Work on local `main` and commit right after each meaningful edit (speculative commits). Commit only your own paths: other sessions share this checkout.
- English commit messages. Commits that change user-visible behavior carry `Feature:`, `Expect:`, `QA:` lines (`QA: none` otherwise); multi-commit features and open worktrees go in `docs/release/UNRELEASED.md`.
- No branches or worktrees unless asked, except: for a large refactor (services, shared rendering, route trees or data schemas; unsafe half-done or longer than a weekly release) ask to approve a worktree in `.claude/worktrees/<name>` on `refactor/<name>`, then `git merge --no-ff` into `main` and remove it.
- Ask before creating many files, moving route trees, or broad mechanical edits.
- Never commit generated output (`public/generated/*`, `src/generated/*.json`); `pnpm static:data` and the ensure helpers rebuild it.

## Deploy

- Deploy only by pushing the whole local `main` HEAD; CI (`.github/workflows/cloudflare-workers.yml`) deploys. Never push a subset, cherry-pick, alternate ref or synthetic history to `main`; reconcile divergence on the real local `main`. No ad hoc `wrangler deploy`.
- Pushes queue behind each other (one deploy at a time, ~20 min each). Batch commits into one push when you can. Any change under `src/`, `data/`, `public/`, `scripts/`, `workers/` or `package.json` redeploys; docs, skills and `bin/` don't, so agent tools that aren't part of the site go in `bin/`.
- Releases (regular with byrdispatch, CI gate, smoke and feature QA; urgent patch-note releases limited to `pnpm patch:test`) follow `docs/RELEASE_PROCESS.md`. D1 schema changes go in `d1/migrations/` and are applied remotely only with user approval.
- Don't run builds for patch Worker or byrdispatch-only deploys; build only when the main Worker or its assets change.
- Testbed (`pnpm cf:testbed`) is development-only and never touches production; `--skip-build` refuses artifacts whose `build-record.json` doesn't match HEAD, so rebuild instead of working around it.

## Cloudflare Workers Free

10 ms CPU per request, 128 MB, 3 MiB gzip bundle, 50 subrequests, 100k requests/day for the account. Keep Workers thin: precompute, serve static assets and cached JSON, and never add request-time work that scales with cards, patch notes, comments or search docs. Check `pnpm cf:size` after `pnpm cf:build` for runtime/config changes. The patch Worker (`docs/PATCH_WORKER_DEPLOY_CONTRACT.md`) stays static-first and keeps `/patches*`, and pending Compendium links in patch notes render hover-only previews, never links to 404s.

- Unbounded ID routes (UUID posts, History Course runs, 조각모음 details) ship a prerendered `__id__` shell in the same change: register it in `workers/static-page-routing.ts`, `scripts/copy-cf-static-pages.mjs`, `scripts/check-cloudflare-static-assets.ts` and the route-smoke/testbed allowlists (none auto-discover `[id]`). Read the id after hydration, never with `useParams`. Record OG goes through `workers/detail-shell-og.ts`; there is no renderer fallback, don't add one.
- Smoke proof is the owner header, not a `200`: `x-cf-static-page: compendium` for details, `shell` for ID routes, on both document and RSC requests; `not-found` on a record URL blocks the ship (`pnpm cf:smoke`).

## Content rules

- Game data comes from extracted game files or code, never guesses or hand-tuned values. Past builds are archived outside the repo in `~/sts2-builds/<version>/` (`docs/STS2_DEPOT_MANIFESTS.md`, `python3 scripts/archive-installed-build.py` on patch day). Steam login is the user's; never handle their credentials.
- Game elements use the in-game translation, including English-named cards (`hello world`, `null`) and game-derived terms. Proper nouns stay proper nouns (니오우스레터, not 소식지).
- Data JSON is English (`name`, plus `nameKo` for the official Korean). Service UI is Korean first, English second. Don't say "엔티티"; say 카드, 유물.
- Rich patch tags: game elements gold; Ironclad red, Silent green, Regent orange, Necrobinder pink, Defect aqua; Ancients blue; buff green + sine, nerf red + jitter.
- When `/api` doesn't answer, `StorageUnavailableNotice` is the only storage-error UI; surfaces without React (patch Worker JS) mirror its image and copy. No ad hoc error boxes.
- 역사 강의서 UI follows YouTube for now: index cards are thumbnail lockups, the lockup title is the player title. Terms: `CONTEXT.md`.
- Code and comments in English; components use kebab-case files and PascalCase exports.
