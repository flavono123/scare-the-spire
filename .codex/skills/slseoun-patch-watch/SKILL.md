---
name: slseoun-patch-watch
description: Publish or update pre-Steam Slay the Spire 2 patch index stages for 슬서운변경. Use when an expected STS2 patch has not appeared yet, when the expected KST patch window has slipped, or when preparing the static index state before switching to slseoun-patch shell-first mode.
---

# slseoun-patch-watch

Create and maintain the patch-index states that exist before rich patch notes are
ready. This skill covers only static index/page data. Do not add request-time
Worker work; load `.codex/skills/cf-guardrails/SKILL.md` for any runtime,
Worker, OpenNext, or asset-pipeline change.

## Stage Flow

Use this flow for the top of the patch index:

1. `준비 시간`: expected patch day is approaching, usually the day before the
   Friday KST patch window.
2. `지연`: optional. The expected Friday KST window has passed, but Steam has
   not published an announcement yet.
3. `작업 도구`: Steam has published the patch and the rich patch-note work is in
   progress. This replaces the old public wording for the `building` state.
4. `패치노트`: rich patch notes are ready.

Skip `준비 시간` or `지연` when an unscheduled patch is already live. In that
case go straight to `$slseoun-patch` shell-first mode, publish `작업 도구`,
push immediately, and continue patch-note work without waiting for deployment
success.

## Data Contract

- `준비 시간`: `status: "watching"`, `watchStage: "prep_time"`,
  `steamUrl: null`, no markdown file under `data/sts2-patch-notes/`.
- `지연`: `status: "watching"`, `watchStage: "delay"`, `steamUrl: null`, no
  markdown file under `data/sts2-patch-notes/`.
- `작업 도구`: `status: "building"`, real version/date if known, real
  `steamUrl` when available. A temporary or non-functional Steam link is
  acceptable for a local/example state, but not for real published patch data.
- `패치노트`: default/ready state with rich patch markdown and static patch
  Worker assets built ahead of time.

Patch index entries should stay compact:

- Title: `{token} {stage title or version}`
- Description: one short line, usually the patch title for real patches or
  borrowed game-locale copy for pre-Steam stages
- Date
- Index art: card art, epoch/history art, event art, or a static service image

Do not use `{token} chip` styling. Tokens belong in the title.

## Tokens And Copy

- `준비 시간`: title token
  `/images/sts2/intents/animated/sleep.webp`; title text from
  `cards.PREP_TIME.title`; description from `timeline.REMINDER_TEXT`, replacing
  the epoch subject with "오늘의 패치" / "Today's patch".
- `지연`: title token `/images/sts2/intents/animated/unknown.webp`; title text
  from `cards.DELAY.title`; description from `bestiary.DESCRIPTION.placeholder`,
  replacing the monster subject with "이 패치" / "this patch".
- `작업 도구`: title token
  `/images/sts2/powers/tools_of_the_trade_power.webp`; title text is the version
  label, with `powers.TOOLS_OF_THE_TRADE_POWER.title` available as the stage
  badge/copy.
- `패치노트`: title token `/images/sts2/nav/patch_notes_icon.png`; title text is
  the version label.

Asset investigation as of 2026-07-05:

- `sleep.webp` is animated: WebP animation, 16 frames.
- `unknown.webp` is animated: WebP animation, 20 frames.
- `tools_of_the_trade_power.webp` is static: one WebP frame.
- `patch_notes_icon.png` is static: one PNG frame.

If animated `작업 도구` or `패치노트` tokens are desired later, create them as
static build-time assets or CSS-driven presentation from existing game/service
art. Do not generate or transform animated assets inside a Worker request.

## Stage Art Defaults

- `준비 시간`: `art: { "type": "card", "id": "PREP_TIME" }`
- `지연`: `art: { "type": "card", "id": "DELAY" }`
- `작업 도구`: `art: { "type": "card", "id": "TOOLS_OF_THE_TRADE" }`
- `패치노트`: use the real patch's strongest history/card/event art, or the
  service patch-note token only when no game art is appropriate.

## Workflow

1. Check Steam announcements once with the `$slseoun-patch` fetch command. If a
   real patch exists, stop this skill and switch to `$slseoun-patch`.
2. Add or update the top-of-index placeholder in `data/sts2-patches.json`.
   Prefer one active pre-Steam stage in production. Multiple stages may be used
   temporarily as local examples.
3. Commit immediately.
4. Push immediately so Cloudflare can publish the static index state. Do not
   wait for deployment success before continuing other work.
5. When Steam publishes the patch, replace the placeholder with the real patch
   metadata, set `status: "building"`, commit and push that state immediately,
   then continue rich-note work in `$slseoun-patch`.

## Validation

For waiting/building index changes, run:

```bash
pnpm i18n:validate
pnpm lint
pnpm patch:build
pnpm patch:test
```

If time is critical, `pnpm patch:build` and `pnpm patch:test` are the minimum
checks before pushing the patch Worker. The output must remain static-first and
must not add request-time Cloudflare Worker CPU, memory, subrequest, or bundle
size risk.
