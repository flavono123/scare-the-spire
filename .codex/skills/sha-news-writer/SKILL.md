---
name: sha-news-writer
description: Format, create, or update 섀 소식 service-update posts for scare-the-spire from rough user notes. Use when the user asks to write, draft, publish, add, or normalize 섀 소식 / Sha News entries, especially markdown files under data/sha-news/YYYY-MM-DD.md, service update changelogs, deployment-date updates, rich keyword references, or optional screenshots/videos for service announcements.
---

# sha-news-writer

Turn rough service-update notes into canonical 섀 소식 markdown. The user owns the content; Codex owns formatting, validation, exact links/tooltips, and repository integration.

## Workflow

1. Confirm or infer the deployment date as `YYYY-MM-DD`.
   - Prefer the user-provided deploy date.
   - If missing, use today's date only after saying that assumption.
2. Read `docs/I18N.md` before editing user-visible service text.
3. Read `references/format.md` for the canonical markdown contract and examples.
4. Create or update `data/sha-news/YYYY-MM-DD.md`.
   - Create `data/sha-news/` if absent.
   - Use one `# YYYY-MM-DD` heading.
   - Use `## 서비스명` headings.
   - Use one-line bullets only.
5. Normalize user notes without inventing product facts.
   - Keep updates concise and factual.
   - Move notes into the closest allowed service section.
   - Ask only if the target date or intended meaning is genuinely ambiguous.
6. Add rich references only when verifiable in this repo.
   - Use patch-note BBCode syntax such as `[gold:card]광기[/gold]` or `[gold:relic]역사 강의서[/gold]`.
   - Verify game resources against extracted Codex data or existing comment/search entity data before adding a typed tag.
   - If unsure, keep plain text.
7. Handle media conservatively.
   - Default to no screenshots or video.
   - Add media only when the user asks for it or the update is primarily visual/interactive.
   - Store media under `public/images/sha-news/YYYY-MM-DD/`.
8. Commit every meaningful edit separately, following repository `AGENTS.md`.
9. Run focused validation:
   - Always run `pnpm i18n:validate`.
   - Run `pnpm lint` when React, TypeScript, markdown parsing, or rendering code changed.
   - Run `pnpm build` when routes, data loading, metadata, generated data, or rendering contracts changed.
   - Run mobile/browser QA when adding or changing screenshots, media rendering, or mobile-sensitive UI.

## Output Rules

- Preserve the user's intended substance, but rewrite bullets into service-update language.
- Do not mimic game patch notes or Steam patch prose.
- Do not put STS2 game balance changes here unless the service UI/content changed because of them.
- Do not add marketing copy, long explanations, or speculative roadmap items.
- Do not auto-translate community/user-authored content.
- Keep Korean as the primary authored service language unless the user explicitly asks for English copy.

## Media Rules

Prefer text-only entries. Media creates maintenance cost and stale visuals.

Use static screenshots for:

- New visual entry points.
- Before/after UI layout changes.
- Features that are hard to identify from text.

Use short video only for:

- Animation playback.
- Drag, hover, replay, or interactive flows where a still image hides the feature.

When capturing media:

- Use Playwright against a local route.
- Prefer mobile and one desktop viewport only when both are relevant.
- Use stable filenames such as `home-entry-mobile.png`.
- Reference media from markdown with root-relative paths, e.g. `![홈 섀 소식 진입점](/images/sha-news/2026-06-09/home-entry-mobile.png)`.

## Reference Files

- `references/format.md`: canonical markdown shape, service section names, prompt template, rich reference examples, and media examples.
