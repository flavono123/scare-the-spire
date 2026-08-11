# QA Report — Card side tips (2026-08-11)

## Scope
Card collection keyword/entity side tips: index hover + detail always-on placement/z-index/clipping.

## Environment
- `http://localhost:3000` (existing dev server)
- Playwright probes at 1440×900 and 980×800
- Selfcheck: `pnpm exec tsx scripts/card-keyword-tips.selfcheck.ts` — pass

## Issues found (and fixed)

| ID | Severity | Issue | Fix |
|----|----------|-------|-----|
| TIP-001 | high | Index tips painted **behind** neighboring cards (`animate-card-enter` transform stacking) | Portal tips to `document.body` with `position: fixed; z-index: 200` |
| TIP-002 | high | Detail tips covered right rail / preferred wrong side | Prefer left; treat `[data-card-detail-meta] aside` as hard wall |
| TIP-003 | medium | Ambiguous widths still clipped (moved left but still cut off) | `placeCardSideTip` only shows when tip fully fits without card/rail/viewport overlap; else `visibility: hidden` |

## Verification

| Case | Result |
|------|--------|
| Index hover BASH | tip visible, `fixed`, on `body`, `elementFromPoint` hits tip |
| Detail BASH @1440 | tip **left** of card, gap 12px, `overlapsAside: false` |
| Detail BASH @980 | tip **hidden**, not clipped while visible |
| Selfcheck placement | pass |

## Notes
Earlier change only flipped side preference without escaping overflow/stacking — that was insufficient. Portal + fit gate was required.
