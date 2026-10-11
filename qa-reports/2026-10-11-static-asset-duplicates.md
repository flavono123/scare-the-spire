# QA Report: 슬서운이야기

| Field | Value |
|-------|-------|
| **Date** | 2026-10-11 |
| **URL** | http://localhost:3000 |
| **Branch** | main |
| **Commit** | 56601688, f1fc5c24, a2f35e7a, c946b7d3, 81f219ae, 3d2a5531 |
| **Tier** | Quick |
| **Scope** | Static asset reduction items 1 and 3: patch OpenNext cache prune, identical beta art, shared Decimillipede atlas, shared encounter backgrounds, `/fonts` loading, JSON and app-icon aliases |
| **Pages visited** | 8 |

## Health Score: 98/100

| Category | Score |
|----------|-------|
| Console | 95 |
| Links | 100 |
| Visual | 100 |
| Functional | 100 |
| UX | 100 |
| Performance | 95 |
| Content | 100 |

## Top 3 Things to Fix

1. No critical or high issue in this scope.
2. No second high-severity issue.
3. No third high-severity issue.

## Summary

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 0 |
| Medium | 0 |
| Low | 0 |
| **Total** | **0** |

## Issues

No critical or high issues.

Item 1 was checked with `scripts/prune-opennext-static-page-cache.spec.ts` (`pruned === 6`, `prunedPatch === 4`, `/dev` cache kept). It was not measured against a full `.open-next/assets` tree. `pnpm cf:preview` and `pnpm cf:assets` were not run. The known `ja/defragment.html` asset-check failure is unchanged and out of scope.

## Verification

Dev proxy `http://localhost:3000` (Next on port 3001). Redirects were not followed.

| Check | Result |
|-------|--------|
| `GET /api/search-index` | 308 → `/generated/search-index.json` |
| `GET /comment-entities/sts2` | 308 → `/generated/comment-entities-sts2.json` |
| `GET /icon-192.png`, `/apple-touch-icon.png`, `/apple-touch-icon-precomposed.png` | 308 → `/apple-icon.png` |
| Canonical JSON, `/apple-icon.png`, `/icon-512.png`, four `/fonts/` files | 200 |
| `/` computed font | `STS GC Batang`; CSS variables `STS Spectral`, `STS Kreon`, `STS GC Batang`; four `/fonts/` preloads 200; no `_next/static/media` font request |
| `/compendium/monsters/decimillipede_segment` | 뒤쪽, 가운데, 앞쪽 load `decimillipede3.skel`, `decimillipede2.skel`, `decimillipede1.skel` at 200, all through `/spine/sts2/monsters/decimillipede_front/decimillipede_front.atlas` and `decimillipede.png` (200). No request for the removed middle/back atlas or png |
| `/compendium/epochs/defect7_epoch` | No 베타 아트 toggle. Official portrait only |
| `/compendium/epochs/colorless1_epoch` | 베타 아트 stays. Toggle sets `?beta=true` and loads `/images/sts2/epochs-beta/colorless1_epoch.webp` 200 |
| `/compendium/relics/fishing_rod` | No 베타 아트 toggle |
| `/compendium/relics/beautiful_bracelet` | 베타 아트 toggle remains |
| `/compendium/encounters/soul_fysh_boss` | Background `/images/sts2/encounter-scenes/underdocks-a.webp` 200 |
| `/compendium/encounters/the_kin_boss` | Background `/images/sts2/encounter-scenes/ceremonial-beast-boss-a.webp` 200 |
| 통합 검색, query 혈족 | Fetches `/generated/search-index.json` 200 and lists 혈족 추종자, 혈족 사제, and 혈족 전투 |
| Deleted paths (`epochs-beta/defect7_epoch.webp`, `relics-beta/fishing_rod.webp`, middle atlas, `soul-fysh-boss-a.webp`, `the-kin-boss-a.webp`) | 404 |

`public/generated/compendium-detail-kor.json` and `compendium-detail-eng.json` are gitignored and were still carrying the removed beta and encounter URLs. They were regenerated locally before the detail-page checks. `pnpm build` and `pnpm cf:build` run `static:data`, which rebuilds those payloads, so a deploy does not keep the stale URLs.

## Fixes Applied

| Issue | Fix Status | Commit | Files Changed |
|-------|-----------|--------|---------------|
| — | no product bug in this smoke | 56601688, f1fc5c24, a2f35e7a, c946b7d3, 81f219ae, 3d2a5531 | prune script, image extractors, Decimillipede stage, encounter backgrounds, font loading, static alias redirects |

---

## Ship Readiness

| Metric | Value |
|--------|-------|
| Health score | 98 |
| Issues found | 0 |
| Fixes applied | 0 (implementation already on main) |
| Deferred | Full `.open-next` file count, `cf:preview`, `cf:assets`, items 2 and 4, `ja/defragment.html` |
