---
name: animation-playback-qa
description: Local browser QA workflow for verifying animation playback and replay with screenshots. Use when Codex needs to test that clicking or otherwise triggering a UI animation actually plays on first and repeated triggers, including SpinePlayer actors, VFX overlays, Godot shader/canvas effects, WebGL/canvas animations, video-like render surfaces, and local frontend animation regressions.
---

# Animation Playback QA

Use this skill when an animation bug report is about "plays once", "does not replay", "VFX does not show", "shader is blank", "first click works but second click does not", or any similar local UI animation behavior.

## Core Workflow

1. Start or reuse the local app server.
2. Identify the page URL, the render surface selector, and the trigger locator.
   - Render surface examples: `.sts2-spine-stage canvas`, `.vfx-layer canvas`, `canvas`, `video`, or a positioned VFX container.
   - Trigger examples: `text=방출`, `button:has-text("Play")`, `[data-testid=attack]`.
3. Run `scripts/capture-animation-playback.mjs` to capture before, first trigger, and repeated trigger frames.
4. Inspect the saved screenshots. Do not treat nonzero pixel differences alone as proof; idle loops, camera jitter, or shader noise can create false positives.
5. When the fix touches page layout, render surface sizing, or a mobile-visible actor, run `$mobile-viewport-qa` on the same route as the final mobile layout hook.
6. Report whether the expected non-idle/nonblank frame appears after both the first trigger and the repeated trigger.

## Capture Script

Run from this skill directory or pass the absolute script path:

```bash
node .codex/skills/animation-playback-qa/scripts/capture-animation-playback.mjs \
  --url http://localhost:3000/compendium/monsters/infested_prism \
  --stage ".sts2-spine-stage canvas" \
  --trigger "text=방출" \
  --repeat 2 \
  --delays 80,120,240,480
```

The script writes PNG frames and `summary.json` under `/tmp/animation-playback-qa/<timestamp>` by default. Use `--output <dir>` only when the artifacts should be kept.

Important options:

- `--url`: page URL to test.
- `--stage`: CSS selector for the element to screenshot.
- `--trigger`: Playwright locator to click. Repeat this option to test multiple controls.
- `--repeat`: number of times to click each trigger; use at least `2` for replay bugs.
- `--delays`: capture offsets after each click. Include a known action frame such as `120` ms when possible.
- `--pre-wait`: initial wait after navigation for loaders/assets.
- `--settle`: wait after each trigger sequence before clicking again.
- Omit `--trigger` for passive continuous animations such as always-running shaders; the script captures the stage at the configured delays without clicking.

## Validation Rules

- For replay bugs, compare the same delay after trigger 1 and trigger 2. Both must show the expected action/VFX/shader state, not just any pixel change.
- For SpinePlayer regressions, check `summary.json` `checks.uniqueStageElementIds` when a fix relies on remounting. If the ids do not change, the component may still be reusing stale playback state.
- For VFX overlays, target the overlay render surface if it is separate from the actor. Run a second pass for the actor if both must animate.
- For Godot shader or generic canvas effects, use the canvas/container as `--stage`; if the effect is triggered, provide the triggering locator, otherwise use passive capture.
- Treat console warnings/errors in `summary.json` as part of the result.
- If the action is visually subtle, capture more offsets: `--delays 40,80,120,180,240,360,480`.
- Mobile layout is a separate pass: animation playback can succeed while the render surface is clipped or offscreen on mobile. Use `.codex/skills/mobile-viewport-qa/SKILL.md` after playback checks for responsive pages.

## Reporting

Include:

- the exact command run,
- the `summary.json` path,
- whether first and repeated triggers show the expected frame,
- whether the render surface remounted or reused state when relevant,
- console errors/warnings,
- any residual uncertainty, such as an animation whose expected frame is not visually distinguishable.
