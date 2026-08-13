---
name: byrdispatch-writer
description: Format, localize, create, or update byrdispatch / 섀소식 service-update posts and notices for scare-the-spire from rough Korean notes. Use when the user asks to write, draft, translate, publish, add, or normalize byrdispatch / 섀소식 entries, especially paired Korean and English markdown files under data/byrdispatch/, service notices, service update changelogs, deployment-date updates, service-link sections, rich game-resource references, token status badges, staged-release markers, or optional screenshots/videos for service announcements.
---

# byrdispatch-writer

Turn rough Korean service-update notes into canonical Korean 섀소식 and English byrdispatch markdown. The user owns the content; Codex owns formatting, paired English, validation, exact links/tooltips, status markers, capture recommendations, and repository integration.

Compare against published entries the user already corrected (`2026-07-09`, `2026-08-04`, `2026-08-12`) before inventing a house style. Those files beat this skill's examples.

## Workflow

1. Confirm or infer the deployment date as `YYYY-MM-DD`.
   - Prefer the user-provided deploy date.
   - If missing, use today's date only after saying that assumption.
   - A short gap from the previous entry is not a reason to bury new user-facing work into that older file. Prefer a new date unless the user asks to patch the previous entry.
2. Read `docs/I18N.md` before editing user-visible service text.
3. Read `references/format.md` for the canonical markdown contract and examples.
4. Create or update both locale files for the same deployment date.
   - Korean source: `data/byrdispatch/YYYY-MM-DD.md`.
   - English service copy: `data/byrdispatch/YYYY-MM-DD.en.md`.
   - The user may give instructions and source notes only in Korean. Write the English version without asking for a separate translation prompt.
   - Keep the two files structurally aligned: the same H1 date, section order, bullets, nesting, links, media, rich references, inline action tokens, and status semantics.
   - Translate service-owned headings, bullets, link labels, and media alt text into natural concise English. Do not mechanically transliterate Korean service names when an established English UI name exists.
   - Preserve URLs, media paths, version numbers, code-like tokens, and other non-visible renderer control tokens exactly unless the renderer has an explicitly supported English equivalent.
   - This paired translation rule applies to authored byrdispatch service updates, not community/user-authored content covered by the no-i18n policy in `docs/I18N.md`.
   - Create `data/byrdispatch/` if absent.
   - Use one `# YYYY-MM-DD` heading.
   - Treat the H1 date as the title of that individual update entry. Do not add decorative date markup in Markdown; the renderer owns the larger purple text treatment, while the newest entry owns the borderless purple container treatment.
   - Put `## 공지` / `## Notice` first when the entry includes a site-wide notice.
   - Use `## 서비스명` and `### 하위 서비스명` in Korean; use the established English service names in the English file.
   - Keep a parent `## 서비스명` heading even when it has no bullets if it groups child `###` sections.
   - Use one-line bullets by default.
   - Preserve one nested bullet level (`  -`) when the user provides it or explicitly asks for child examples/details.
   - If the user writes a numbered list (`1. 2. 3.`), convert it to nested `-` bullets. The parser only accepts `-` bullets.
   - Route/service English naming is `byrdispatch`; the canonical public route is `/byrdispatch`.
5. Normalize user notes without inventing product facts.
   - When the user supplies Korean copy, that wording is the SSOT. Format it (headings, bullets, markers, links, gold tags, image paths). Do not rewrite it into a different "service-update voice."
   - When the user does not supply copy, write short factual bullets in the published voice: `합니다` / `했습니다`. Do not use `했다` / `이다` diary tone from older format examples.
   - Keep updates concise and factual. Move notes into the closest allowed service section.
   - Keep notice bullets operational and time-bounded; do not invent exact dates, URLs, or migration guarantees.
   - Write notice URLs as markdown links so users can click through.
   - Do not add `(서비스)` markers. Refer to services by their visible service name in plain text; the renderer styles recognized service names as aqua links with a leading token asset.
   - When a service mention has a qualifier, keep the qualifier plain and let only the service name style, e.g. `슬더스2 패치노트` styles only `패치노트`.
   - Wrap keyboard/editor tokens in backticks, e.g. `` `@` `` / `` `*` ``, so the renderer shows inline code chips.
   - Ask only if the target date or intended meaning is genuinely ambiguous.
6. Add rich references only when verifiable in this repo.
   - Use patch-note BBCode syntax such as `[gold:card]광기[/gold]` or `[gold:relic]역사 강의서[/gold]` in Korean and the verified game-localized names in English.
   - Verify game resources against extracted Codex data or existing comment/search entity data before adding a typed tag.
   - Use typed tags for individual game resources, not service headings; game resource labels must follow the active game locale at render time. Use extracted Korean game text in the Korean source and extracted English game text in the English source so each file is also readable as Markdown.
   - For epoch beta-art updates, use typed `[gold:epoch]...[/gold]` references so byrdispatch renders the hover tip in beta-art mode when present.
   - Beta-art mode selects the beta art instead of the official art; do not describe or expect both images to render together.
   - If unsure, keep plain text.
7. Handle media conservatively. Follow **Capture Rules** below. Default to no screenshots.
8. Commit every meaningful edit separately, following repository `AGENTS.md`.
9. Run focused validation:
   - Always run `pnpm i18n:validate` and verify that every Korean date file has a same-date `.en.md` partner.
   - Run `pnpm lint` when React, TypeScript, markdown parsing, or rendering code changed.
   - Do not run `pnpm build` for copy-only byrdispatch markdown.
   - Do not add a QA/browser pass to the byrdispatch write itself. Capture with headless Playwright only when media is actually required.

## What to write

Include only **user-visible functional** service changes.

Do not write about, even as a nested aside:

- CI, lint, typecheck, pre-push hooks, generated files, gitignore, untrack, `static:data`
- SEO, search canonical, metadata, OG, sitemap
- Worker/deploy pipeline, patch-worker ordering, Cloudflare internals
- QA reports, Playwright fixtures, selfcheck scripts
- Internal polish that does not change what a player sees (cover playtime corner tweaks, copy-token grayscale, admin-only APIs)

If a commit list is the only source, filter to player-facing UI/behavior. When unsure, omit. Never pad an entry with ops or platform work to look complete.

Do not add marketing copy, long explanations, or speculative roadmap items unless the user explicitly asks for a staged roadmap.

Under `패치노트`, include only functional service changes; do not list publishing a patch note, syncing a game patch, or adding patch content by itself.

Do not put STS2 game balance changes here unless the service UI/content changed because of them.

Do not auto-translate community/user-authored content.

Keep Korean as the primary authored service language and derive the English service copy automatically, even when the user provides only Korean instructions.

Do not mention implementation names (`ExtraHoverTips`, component ids, JSON files) in user copy.

## Status markers

Korean files:

- `(new)` — shipping in this update (New Leaf). Tooltip/label: `이번에 적용됨`.
- `(적용됨)` — already shipped in a past update (Old Coin). Nested staged rows only.
- `(예정)` — announced, not shipped yet (Mercury Hourglass). Nested staged rows only.
- `(개발 중)` — still being built (Hammer Time). Not the same as `(예정)`.
- `(버그)` — bug fix (Infested).
- `(제보 감사)` — thanks for a report (Wongo Customer Appreciation Badge).

English files: `(new)`, `(already)`, `(planned)`, `(in progress)`, `(bug)`, `(thanks for the report)`.

`(개발 중)` / `(in progress)` is WIP. `(예정)` / `(planned)` is a future release the user asked to announce. Do not substitute one for the other.

### Staged releases

When the user announces a multi-step rollout (example: History Course three-stage redesign), write it as **one parent bullet + nested `-` children**. Do not use numbered lists. Do not write `- 완성` / `- done` postfixes; the renderer owns the three states.

- Nested `(적용됨)` / `(already)`: already shipped before this entry. Muted text plus Old Coin token.
- Nested `(new)`: shipping in this entry. Green text plus New Leaf token.
- Nested `(예정)` / `(planned)`: not shipped yet. Amber text plus Mercury Hourglass token.

Top-level `(new)` stays token-only. Nested staged bullets get text color and the same suffix status tokens — no row container and no extra invented text chips.

When a later stage actually ships:

1. Put the functional change in the **new** dated entry as a normal bullet.
2. Go back to the original roadmap nested list and retarget markers: previous `(new)` → `(적용됨)`, the stage that just shipped → `(new)`, remaining stages stay `(예정)`.
3. Do not invent the next stage's copy. Only retarget markers the user already wrote.

### Inline service widgets

When the user names an on-screen control and says to use the real chip/button (e.g. `「내 글」(실제 게임에서 렌더하는 칩 사용)`), that is a render instruction, not visible copy.

- Write `「내 글」` / `「Mine」`. The renderer inserts `OwnPostMark`, the same ownership chip used on Toy Box / Combo / Transfigure / Chemical X / This or That indexes.
- Write `[새 이야기 쓰기 버튼 노출/링크]` for the live Story composer button.
- Do not leave `(실제 게임에서 렌더하는 칩 사용)` or similar parentheticals in the published sentence.
- Do not restyle a fake chip. Import the index component.

Do not add nested bullets on your own. Do not invent a roadmap because commits look sequential.

## Capture Rules

Prefer text-only entries. Media creates maintenance cost and stale visuals.

### When the user lists captures

Treat `<캡쳐>`, `(이미지)`, and explicit "캡쳐 포함" notes as the shot list. Insert only those shots.

- Place each image **immediately before** the bullet it illustrates, matching published `2026-08-04` / `2026-08-12`.
- Indent an image by the same two spaces when it belongs to a nested example.
- Do not add extra shots the user did not list (the 2026-08-12 create-post modal was this failure).
- If a placeholder is ambiguous (`<모달창 캡쳐>` next to a delete bullet), capture that feature, not a nearby similar modal.

### When the user does not list captures

Default to **no media**. If the update is primarily visual or hard to identify from text, **recommend** shots in the draft instead of inserting them first.

Each recommendation must name:

- route (local path)
- subject that must be in frame
- crop rule
- why this shot, not a full page

Example:

```text
추천 캡쳐:
- 유물 상세 인스펙트 + 키워드 팁
  route: /compendium/relics/philosophers_stone
  frame: inspect panel + keyword tip stack (not the navbar, not the meta rail)
  why: relic detail is a new visual, not the same as card keyword tips
```

Only capture after the user listed shots or accepted the recommendation. Then write the markdown image tags.

### What to recommend

Recommend a shot when the player would miss the change from text:

- New visual entry point
- Layout/art that is the feature (inspect panel, cover thumbnail, Yes/No modal)
- A control that is hard to describe (quick-filter token row, wax/used checkboxes)

Do not recommend a shot for:

- Copy-only changes
- The same UX repeated on another resource (if card keyword tips already shipped, do not also shoot potion/power/enchantment unless the visual is actually different — relic inspect panel is different; enchantment-only "same tips" can stay text)
- Internal or non-functional work
- A second angle of the same pattern

One visual pattern per shot. Pick a concrete resource that actually shows the feature (e.g. 재성형 for keyword tips, 현자의 돌 for inspect + ExtraHoverTips).

### How to capture

- Headless Playwright only. Do not open a GUI browser.
- Hit a **local** route that already includes the feature. Production may lag local HEAD.
- Compendium detail pages load payload asynchronously (`상세 정보를 불러오는 중입니다.`). Wait until the feature node exists (`[data-relic-inspect-slab]`, `[data-card-side-tips]` visible with non-zero size), not just `domcontentloaded`.
- Crop to the feature. Exclude the site navbar and other chrome.
- Exceptions that may include surrounding chrome: full-screen/game confirm modals, cover thumbnails shown as the artifact, editor sheets that are the feature.
- For a marked-up region (Combo quick filters), crop to that region only — the token row, not the whole index.
- If a capture target 404s or the database is unavailable, leave the bullet text-only. Do not substitute a different screen.

Store media under `public/images/byrdispatch/YYYY-MM-DD/`.
Reference rendered media with root-relative paths such as `/images/byrdispatch/YYYY-MM-DD/name.png`.

Use short video only for animation, drag, hover, or replay flows where a still image hides the feature.

## Reference Files

- `references/format.md`: canonical markdown shape, service section names, prompt template, rich reference examples, staged-release examples, and media examples.
