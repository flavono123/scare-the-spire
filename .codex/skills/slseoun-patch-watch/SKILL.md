---
name: slseoun-patch-watch
description: Publish or update a pre-Steam Slay the Spire 2 patch waiting placeholder for 슬서운변경. Use when an expected STS2 patch has not appeared yet but the patch index should show that the service is waiting, especially around the two-week Friday KST patch window; skip this skill when Steam patch notes are already live and use slseoun-patch shell-first mode instead.
---

# slseoun-patch-watch

Create the pre-patch placeholder that appears before there is any Steam patch
URL or patch-note prose. This is distinct from `slseoun-patch` WIP/building:

- `watching`: the patch is expected, but Steam has not published it yet.
- `building`: Steam has published the patch and we are actively producing rich notes.
- `ready`: rich patch notes are published.

## Naming And Visual Contract

- Data status: `status: "watching"`.
- Korean label: `패치 대기 중`.
- English label: `Awaiting patch`.
- Visual tone: amber/warm, non-clickable, and not grayscale. Grayscale is
  reserved for `status: "building"` after the real Steam patch exists.
- Do not show a Steam original chip while `steamUrl` is `null`.
- Do not create markdown files under `data/sts2-patch-notes/` for a waiting
  placeholder.

## When To Use

Use this when the expected patch window arrives but Steam has not published the
patch yet. The usual expectation is every two weeks on Friday around 09:00-10:00
KST, but recent patches may slip toward 12:00-13:00 KST.

Skip this step when Steam has already published the patch. In that case go
straight to `$slseoun-patch` Shell-First Mode and publish `status: "building"`.

## Workflow

1. Check Steam announcements once with the `$slseoun-patch` fetch command. If a
   real patch exists, stop this skill and switch to shell-first mode.
2. Add or update a single top-of-index placeholder in `data/sts2-patches.json`:
   - Use `status: "watching"`.
   - Use `steamUrl: null`.
   - Use `versionLabelKo: "다음 패치"` and `versionLabel: "Next patch"` unless
     the user provided a known public version label.
   - Use a stable synthetic `version`, such as `expected-YYYY-MM-DD`, only
     while the real version is unknown.
   - Use the expected KST date in `date`.
   - Use `type: "beta"` unless the user or official source indicates another
     patch type.
   - Keep `hasBalanceChanges: false` until Steam confirms the patch contents.
   - Use short factual summaries: `Steam 패치를 기다리는 중입니다.` /
     `Waiting for the Steam patch.`
3. Commit this placeholder immediately.
4. Push immediately so Cloudflare can publish the index state. Do not wait for
   deployment success before continuing other work.
5. When Steam publishes the patch, replace the placeholder with the real patch
   metadata in `$slseoun-patch` Shell-First Mode:
   - Replace synthetic `version` and labels with the real version/title/date.
   - Set `status: "building"`.
   - Set the real `steamUrl`.
   - Commit and push that WIP state immediately, then continue rich-note work.

## Validation

For a waiting-only placeholder, run:

```bash
pnpm i18n:validate
pnpm lint
pnpm patch:build
pnpm patch:test
```

If time is critical, `pnpm patch:build` and `pnpm patch:test` are the minimum
checks before pushing the patch Worker. Load `.codex/skills/cf-guardrails/SKILL.md`
when touching Worker/runtime behavior; the page must remain static and must not
add request-time Worker work.
