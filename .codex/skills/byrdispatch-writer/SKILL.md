---
name: byrdispatch-writer
description: Format, create, or update byrdispatch / 섀소식 service-update posts and notices for scare-the-spire from rough user notes. Use when the user asks to write, draft, publish, add, or normalize byrdispatch / 섀소식 entries, especially markdown files under data/byrdispatch/YYYY-MM-DD.md, service notices, service update changelogs, deployment-date updates, service-link sections, rich game-resource references, token status badges, or optional screenshots/videos for service announcements.
---

# byrdispatch-writer

Turn rough service-update notes into canonical 섀소식 / byrdispatch markdown. The user owns the content; Codex owns formatting, validation, exact links/tooltips, token badges, and repository integration.

## Workflow

1. Confirm or infer the deployment date as `YYYY-MM-DD`.
   - Prefer the user-provided deploy date.
   - If missing, use today's date only after saying that assumption.
2. Read `docs/I18N.md` before editing user-visible service text.
3. Read `references/format.md` for the canonical markdown contract and examples.
4. Create or update `data/byrdispatch/YYYY-MM-DD.md`.
   - Create `data/byrdispatch/` if absent.
   - Use one `# YYYY-MM-DD` heading.
   - Put `## 공지` first when the entry includes a site-wide notice.
   - Use `## 서비스명` headings and `### 하위 서비스명` headings.
   - Keep a parent `## 서비스명` heading even when it has no bullets if it groups child `###` sections.
   - Use one-line bullets by default.
   - Preserve one nested bullet level (`  -`) when the user provides it or explicitly asks for child examples/details.
   - Route/service English naming is `byrdispatch`; the canonical public route is `/byrdispatch`.
5. Normalize user notes without inventing product facts.
   - Keep updates concise and factual.
   - When the user says to preserve exact wording, keep the visible text verbatim; do not rewrite spacing, phrasing, status labels, or parenthetical notes.
   - Move notes into the closest allowed service section.
   - Keep notice bullets operational and time-bounded; do not invent exact dates, URLs, or migration guarantees.
   - Write notice URLs as markdown links so users can click through.
   - Do not add `(서비스)` markers. Refer to services by their visible service name in plain text; the renderer styles recognized service names as aqua links with a leading token asset.
   - When a service mention has a qualifier, keep the qualifier plain and let only the service name style, e.g. `슬더스2 패치노트` styles only `패치노트`.
   - Preserve status markers such as `(new)`, `(개발 중)`, `(버그)`, and `(제보 감사)` when the user provides them; the renderer turns them into token badges.
   - Treat `(버그)` as the Infested power token badge in rendered output.
   - Treat `(제보 감사)` as the Wongo Customer Appreciation Badge relic token with the `제보 감사` tooltip in rendered output.
   - Ask only if the target date or intended meaning is genuinely ambiguous.
6. Add rich references only when verifiable in this repo.
   - Use patch-note BBCode syntax such as `[gold:card]광기[/gold]` or `[gold:relic]역사 강의서[/gold]`.
   - Verify game resources against extracted Codex data or existing comment/search entity data before adding a typed tag.
   - Use typed tags for individual game resources, not service headings; game resource labels must follow the active game locale at render time.
   - For epoch beta-art updates, use typed `[gold:epoch]...[/gold]` references so byrdispatch renders the hover tip in beta-art mode when present.
   - Beta-art mode selects the beta art instead of the official art; do not describe or expect both images to render together.
   - If unsure, keep plain text.
7. Handle media conservatively.
   - Default to no screenshots or video.
   - Add media only when the user asks for it or the update is primarily visual/interactive.
   - Store media under `public/images/byrdispatch/YYYY-MM-DD/`.
   - Reference rendered media with root-relative paths such as `/images/byrdispatch/YYYY-MM-DD/name.png`.
   - For compact reaction/like palette images, keep the image centered and render it at about half the normal media width when requested.
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
- Reference media from markdown with root-relative paths, e.g. `![홈 섀소식 진입점](/images/byrdispatch/2026-06-09/home-entry-mobile.png)`.

## Reference Files

- `references/format.md`: canonical markdown shape, service section names, prompt template, rich reference examples, and media examples.
