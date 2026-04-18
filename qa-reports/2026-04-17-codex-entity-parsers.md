# QA Report — Codex entity parsers + boss icon refresh

- **Date:** 2026-04-17 (KST)
- **Scope:** Codex pages impacted by new enchantment/monster/encounter parsers and the re-extracted boss icons (see commits `ac37596`, `029ff9c`, `bee6505`, `779ff11`).
- **Tier:** Standard (critical + high + medium)
- **Env:** local dev server `http://localhost:3000`, `pnpm run build` also exercised.

## Coverage

| Route | Status | Notes |
|---|---|---|
| `/` | 200 | Unaffected landing page |
| `/codex` | 200 | Index |
| `/codex/cards` | 200 | Unaffected; sanity only |
| `/codex/relics` | 200 | Unaffected; sanity only |
| `/codex/enchantments` | 200 | Lists 22 entries; `잉크투성이` (INKY) visible |
| `/codex/enchantments/inky` | 200 | New enchantment; Korean title/description/extra-card-text render correctly |
| `/codex/enchantments/favored` | 404 | Correct — removed from game in v0.103.x |
| `/codex/enchantments/adroit`, `/corrupted` | 200 | Existing entries preserved |
| `/codex/monsters` | 200 | 121 entries; 10 loc-only entries present (HATCHLING, COCOON, ...). 12 boss icons from `bosses/` confirmed referenced |
| `/codex/monsters/vantom`, `/byrdonis`, `/queen`, `/bowlbug_egg` | 200 | Existing monsters; Spine portraits from `monsters-render/` still load |
| `/codex/monsters/hatchling` | 200 | Loc-only monster; `imageUrl=null` path renders without crash |
| `/codex/encounters` | 200 | 89 entries; new `FLYCONID_WEAK`, `OVERGROWTH_WILDLIFE`, `SEAPUNK_NORMAL` visible |
| `/codex/encounters/vantom_boss`, `/axebots_normal`, `/bowlbugs_normal` | 200 | Monster composition + portraits render |
| `/codex/encounters/flyconid_weak` | 200 | New encounter, no class-backed monster list, page renders |
| `pnpm run build` | PASS | All 179+ relic detail pages, codex pages, and patch pages prerender |

## Issues found & fixed

### ISSUE-001 — `/dev/monsters` prerender crash (fixed)
- **Severity:** high
- **Category:** Functional / Console
- **Symptom:** `TypeError: Cannot read properties of null (reading 'split')` during `next build` for `/dev/monsters`. Parser now sets `image_url: null` for locale-only monsters (HATCHLING, COCOON, ...); the dev page assumed a string and called `.split("/")`.
- **Fix:** Commit `76193b5` made `image_url` nullable and added placeholder handling.
- **Follow-up:** Per user direction, the `/dev/monsters` page was removed entirely (`55ebcb4`) since the codex uses `monsters-render/` + `bosses/` rather than the atlas-sheet `monsters/` directory the dev page relied on.

## Sanity checks on parser output

- Monster type distribution preserved: **91 Normal / 14 Elite / 16 Boss** — matches pre-parser counts (91/14/16), just with +10 Normal for the new loc-only entries.
- Key elite/boss classification preserved:
  - `BYRDONIS → Elite`
  - `VANTOM → Boss`
  - `QUEEN → Boss`
  - `CEREMONIAL_BEAST → Boss`
- Damage values reflect v0.103.2 balance:
  - Byrdonis Swoop: `16/18 → 17/19` (DLL bump observed; previously stored as 16/18)
- Boss icons re-extracted from PCK `images/ui/run_history/*_boss.png` (BPTC/BC7 decoded) now match the existing 12 filenames and are wired up through `mapMonster.bossImageUrl` (12 references on `/codex/monsters`).

## Outstanding (explicitly scoped out of this session)

- `monsters-render/*.webp` still reflects pre-v0.102 Spine renders. Patch notes v0.102 (Ruby Raiders), v0.103.2 ("many enemies received official visuals") imply some portraits are stale; the 10 loc-only additions have no Spine assets in PCK (verified 0 files under `animations/monsters/{slug}/`), so no new portraits are *addable* without a Node.js Spine renderer. Deferred.
- `data_sts2/{eng,kor}/monsters.json` still carries `image_url: "/static/images/monsters/...png"` for legacy records (copied forward). Codex ignores this field and resolves images by directory listing instead, so no visible regression; cleaning these values up can happen with the Spine pipeline work.

## Verdict

**PASS.** All codex routes affected by the parser refresh and boss-icon re-extraction render correctly. Build passes. The one build regression (`/dev/monsters`) was fixed inline, and the user subsequently decided to delete that route. No high/medium issues remaining within QA scope.
