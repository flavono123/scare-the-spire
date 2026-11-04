---
name: mobile-viewport-qa
description: Verify local frontend pages across this repository's mobile viewport presets with Playwright. Use when Codex needs mobile QA for layout regressions, clipped render areas, hidden interactive previews, horizontal overflow, or profile page carousel-to-render behavior using the sizes defined by scripts/mobile-qa.mjs.
---

# Mobile Viewport QA

Use this skill for mobile layout QA in this repository, especially when a page works on desktop but a render surface, preview, canvas, Spine actor, carousel result, or key content is missing on mobile.

## Workflow

1. Start or reuse the local app server.
2. Read the canonical mobile sizes from `scripts/mobile-qa.mjs --list`; do not invent viewport presets. The list starts at 320px (the narrowest supported phone); run every preset.
3. Run `scripts/check-mobile-route.mjs` against the route under test.
4. Inspect failures and screenshots under `/tmp/mobile-viewport-qa/<timestamp>`.
5. Fix the page, then rerun the same command.

## Hook Contract

Other project skills should call this as their final visual QA hook when they changed mobile-sensitive UI, render surfaces, detail rails, hover previews, patch pages, or page-level layout.

Use stable `data-*` selectors when the route has interactive state to verify. For generic visual routes without a separate control block, skip the vertical-order assertion by passing a selector that should not exist:

```bash
node .codex/skills/mobile-viewport-qa/scripts/check-mobile-route.mjs \
  --route /compendium/cards \
  --render-selector main \
  --controls-selector "[data-mobile-qa-none]"
```

For pages whose controls open new rows or panels, list each state with `--open` (selectors joined
by `||`). After every click the script rechecks horizontal overflow and that each visible control in
`--occlusion-scope` (default `body`) takes a tap at its own center:

```bash
node .codex/skills/mobile-viewport-qa/scripts/check-mobile-route.mjs \
  --route /vexing-puzzlebox/beta-art \
  --render-selector "[data-beta-art-mode]" \
  --controls-selector "[data-mobile-qa-none]" \
  --min-visible-height 200 \
  --open "[data-beta-art-filters] button:has(img)"
```

`covered control` lines fail the run (also text that runs outside its own control, such as a long
name that cannot wrap): something in the page flow sits over a control (a wrapped
row escaping a fixed-height box, a stage drawn over its own filters). `under a fixed layer` lines are
warnings for headers or floating widgets over content at the scroll end; report them. An empty scope
fails so the check never passes by finding nothing. The browser language defaults to `ko-KR`;
pass `--locale en-US` with `/en` routes and check one game-only locale (`/ja`).

Do not replace feature-specific checks with this hook. Run it after narrow lint/build/interaction checks so mobile layout failures are caught before final reporting.

## Profile Page QA

For `/profile`, verify that:

- The selector carousel block is above the render block on mobile.
- The render block is visible within the viewport at every mobile preset.
- The document has no horizontal overflow.
- Selecting a character or boss token updates the render block's reflected selection.

Run:

```bash
node .codex/skills/mobile-viewport-qa/scripts/check-mobile-route.mjs \
  --route /profile \
  --render-selector "[data-profile-render]" \
  --controls-selector "[data-profile-controls]" \
  --choice-selector "[data-profile-choice]" \
  --click-types character,boss
```

If a different page lacks stable selectors, add narrowly scoped `data-*` attributes to the page before relying on this QA. Prefer assertions against real layout and state over visual-only screenshots.

## Script Notes

- The script starts `pnpm exec next dev` when the configured base URL is unreachable, unless `--no-dev` is passed.
- Use `--base-url http://localhost:<port>` for an existing server on a nondefault port.
- Use `--headed` only when manual inspection is needed.
- Use `--min-visible-height <px>` when a route legitimately has a smaller mobile render area than the profile page.

Report the exact command, the summary JSON path, failed presets, and any remaining visual uncertainty.
