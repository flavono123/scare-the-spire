---
name: slseoun-patch
description: Turn a new Slay the Spire 2 Steam patch into a 슬서운변경 rich patch page, from the pre-Steam index stages (준비 시간, 지연) and shell patches through the 작업 도구 shell, the 재성형 draft and the finished notes, with exact Codex keyword markup. Trigger for 슬서운변경, STS2 patch notes, Steam patch ingestion, an expected patch that has not appeared yet, or a target version like v0.114.0.
---

# slseoun-patch

Steam is the truth for patch-note prose; the extracted current game build is the truth for names, numbers, art and structure. Commits, pushes, deploys, Cloudflare limits and the rich-tag color scheme follow `AGENTS.md`.

## Order of skills

1. `update-game-assets` first whenever the patch is newer than `data/sts2/meta.json` or touches game content. Never finalize Korean notes against stale Codex data.
2. This skill for the index entry and both note files.
3. `sts2-compendium-patch-sync` when the patch touched any Compendium resource, monster behavior, asset, localization or removed resource. It owns `fieldDiffs`, deprecation and Compendium QA.

Game names come from `bin/ssy find <name>`, never memory or your own translation. English-named cards (`hello world`, `null`) stay English.

## Before Steam publishes: index stages

The top of `data/sts2-patches.json` can hold a placeholder before Steam notes exist. Stage tokens, colors and art tones live in `PATCH_STAGE_TOKENS` and the card branches of `src/components/patches/patch-list-page.tsx`; index copy comes from `getPatchStageGameCopy()` (`src/lib/borrowed-game-copy.ts`); shell hero copy is hardcoded in `src/lib/patch-shells.ts`. `/dev/patch-types` shows every state. Don't restate any of it in data.

| Stage | Data |
|---|---|
| `준비 시간` (day before the Friday KST window) | `status: "watching"`, `watchStage: "prep_time"`, `steamUrl: null`, no markdown. `art: { "type": "card", "id": "PREP_TIME" }`. Its detail page reuses the 포석 shell body. |
| `지연` (optional, Friday window passed, no announcement) | `status: "watching"`, `watchStage: "delay"`, `steamUrl: null`, no markdown. `art` card `DELAY`. |
| `작업 도구` (Steam published, notes in progress) | `status: "building"`, real metadata. `art` card `TOOLS_OF_THE_TRADE` until real art is picked. |
| `재성형` draft (first rich notes live) | `status` omitted or `"ready"`, `draft: true`, both markdown files. |
| 패치노트 (user asked to finish) | `draft` deleted. Later edits are still allowed. |
| Shell patch (no Steam notes; borrowed card hero plus community reels) | `type: "wither"` or `"gambit"`, `steamUrl: null`, no markdown. A new shell type is a code change in `src/lib/patch-shells.ts`; ask first. |

- Only the values above exist. Never invent a status, stage or shell type.
- Keep one active pre-Steam stage in production. Commit and push each stage change immediately; don't wait for the deploy.
- An unscheduled patch that is already live skips `준비 시간`/`지연` and goes straight to `building`.
- While watching, keep the same session polling about once a minute (`bin/ssy steam`); one empty poll is not a reason to stop. If the window slips, publish `지연` and keep polling.
- Stage identity is the title token, never a chip. Type and balance chips are a separate row. `재성형` is a keyword beside the version title, not a chip.
- Verification for stage-only data changes is `pnpm patch:test`. Don't run builds for patch Worker-only deploys.

## Publish order (speed first)

1. **Shell.** As soon as Steam publishes, add the real entry: `version`, `date`, `title`/`titleKo`, `type`, `steamUrl`, `status: "building"`, a Korean and English summary saying the notes are being prepared, and `publishedAt` from `bin/ssy steam <version>` (ISO UTC with milliseconds; the nav unread dot counts the patch as new from this time, otherwise from noon UTC of `date`). No placeholder markdown. Commit, push, continue. Never wait for the deploy.
2. **Draft.** Publish the first useful rich notes fast: a readable first version beats a perfect one. Remove `status` (or set `"ready"`), set `draft: true`, commit, push, send the user the public patch URL, then keep shaping it in place.
3. **Finish** only when the user asks: delete `draft`. Don't add a status.

`steamUrl` must be a real `https://store.steampowered.com/news/app/2868840/view/{id}` link taken from the store news page (`https://store.steampowered.com/news/app/2868840`) or from the user. Never build it from the API `gid`.

### Draft chrome

`재성형` is a temporary notes-revision keyword: `PatchDraftChip` beside the version title on the index and `PatchDraftNotice` as a fixed bar on the detail page (`src/components/patches/patch-draft-chrome.tsx`). Both go on together with the first draft and come off together. Type chips (`출시`/`베타`/`핫픽스`) and `밸런스` describe the notes and stay. Never move `재성형` into that chip row, render it as a badge twin of them, grayscale the art, swap the title token or unlink the card. Hover is not the primary signal.

## Patch-first (notes ahead of the main Worker)

The urgent path from `docs/RELEASE_PROCESS.md` section 4 under `docs/PATCH_WORKER_DEPLOY_CONTRACT.md`: skip full smoke and feature QA, gate on `pnpm patch:test`, push, then record any other un-QA'd commits that shipped in `docs/release/UNRELEASED.md`. CI deploys the patch Worker on push.

- Notes may mention new resources before the main Compendium has them only when those resources are in `data/sts2-patch-local-resources.json`, with official extracted names (never invented names, text or art) and assets under `/_patches/*`, never guessed `/images/sts2/*` paths.
- They render hover-only previews until `/generated/compendium-resource-manifest.json` contains them; once the main Worker catches up, a patch Worker redeploy turns them into links.
- Patch pages serve static assets only: no request-time markdown rendering, Compendium queries or large JSON parsing.

## Writing the notes

- `data/sts2-patch-notes/{version}.md` (English, read for `serviceLocale=en`) and `{version}.ko.md` (Korean). `gameLocale` decides displayed game names and hover/link targets (`docs/I18N.md`).
- Steam title exactly as `# ...`; `##`/`###` sections and bullets; drop greetings, image placeholders and promo text. Keep numbers exactly, including upgrade notation like `5(7)`.
- The English file is a rich file too and needs the same entity coverage as the Korean one: never leave a name plain because the prose is English.
- Commit the English notes before translating. First Korean pass: factual, correct markup; tone comes later.
- Entry fields: factual `summary`/`summaryKo`, `hasBalanceChanges`, one representative `art` (types in `STS2PatchArtType`, `src/lib/types.ts`). Prefer patch-relevant epoch art, then event, card, Ancient background, then the text-free `/images/sts2/patches/default-art.jpg` via `type: "image"` + `imageUrl`. Use ids over raw paths, add `alt`/`altKo` when the auto label is unclear, and ask when the best art for an older patch is unclear. `featuredEntities` is only a priority-ordered fallback shortlist.
- Developer notes only in the Korean file, below the `###` heading (section) or the affected bullet (item):
  `[devnote]한국어 번역, 게임 요소 태그 포함[/devnote]` then `[devnote:en]Original English[/devnote]`.

## Rich markup

| Target | Markup |
|---|---|
| Codex resource | `[gold:card]`, `[gold:relic]`, `[gold:potion]`, `[gold:power]`, `[gold:enchantment]`, `[gold:event]`, `[gold:monster]`, `[gold:encounter]`, `[gold:ancient]`, `[gold:monsterMove]` + `Name[/gold]` |
| Game term with no Codex page | `[gold]term[/gold]` (gold text, no hover/link) |
| Ancient category | `[blue]고대의 존재[/blue]` / `[blue]Ancient[/blue]` |
| Upgraded card | suffix inside the tag: `[gold:card]하사+[/gold]`, `[gold:card]Largesse+[/gold]` |
| Ascension level | `[gold:ascension]승천 8[/gold]`, `Ascension 8`, `A8`. Never tag bare `승천`/`Ascension` (hits tutorials and phrases like "높은 승천"). |
| Buff / nerf label | `([green][sine]버프[/sine][/green])` / `([red][jitter]너프[/jitter][/red])` |
| Character names, headings included | `[ironclad]`, `[silent]`, `[defect]`, `[regent]`, `[necrobinder]` around the name in either language; never `[green]`/`[red]`/`[aqua]` |

- A name that is both a card and a power needs a type hint; in card-change sections that is `[gold:card]`.
- Run `bin/ssy tags <version>` after every markup pass and fix every flag: a typed tag that resolves to nothing has no hover or link, and an untyped name shared by two types needs a hint. It does not check `[gold:monsterMove]`; hover those in the browser.
- New resources from the patch: update Codex data first, then use their official names.

### Ascension history

An Ascension's history includes every change that affects that level, matched by `scripts/generate-sts2-patch-lines.ts` (the renderer also auto-wraps untagged numbered mentions).

- Explicit `승천 N`/`Ascension N`/`A8` belongs to that level, and also to the monster it changes.
- Monster HP parentheticals `N-N(N-N)` / `N(N)` are Ascension 8 (질긴 적들) with no 승천 mention. Monster damage parentheticals `N(M) → N(M2)` are Ascension 9 (지독한 적들). Card upgrade parens like `6(8)` are not.
- Tag the numbered phrase only where Steam wrote it. Never invent 승천 text in the Korean prose.

## Monster pattern diff

Only for monster reworks where moveset, intent, HP or starting-power changes are clearer as animated before/after panels than as prose; not just because a monster is mentioned.

- Standalone marker line below the monster bullet, matched by `MONSTER_PATTERN_DIFF_RE` in `src/components/patch-note-renderer.tsx`: `[monster-pattern-diff:MONSTER_ID:v0.106.0:full]`. `full` on patch pages; `compact` is for patch-history rails.
- The matching `data/sts2-changes.json` record carries `visualDiff: { "type": "monster-pattern" }` and the real `fieldDiffs` (`minHp`, `minHpAscension`, `damageValues`, `blockValues`, `moves`, `bestiaryMoves`, `initialPowerApplications`); rails use it to decide whether to show the diff.
- Steam bullets stay outside the block; service commentary goes inside, with real gold keywords (moves link to their monster and preview the move). The disclosure is collapsible, default-open, compact and borderless; its summary is only a toggle (no monster link) and never says `애니메이션 패치 diff`.
- Before values come from the build archive or a pre-patch commit, never memory. Monster card applications: adding a card shows the tiny card and name; upgrading an existing effect shows `Name+` in the game green, untinted icon, no quantity badge.
- Code: `src/components/codex/monster-move-visuals.tsx`.

## Data after the notes

- Structured changes live in `data/sts2-changes.json` (`diffs`, `fieldDiffs`, `relatedEntities`, `visualDiff`) via `sts2-compendium-patch-sync`. Never hand-author `data/sts2-entity-versions.json`; versions are derived from `fieldDiffs`. Game JSON and `meta.json` come from `update-game-assets`, not hand edits.
- New content: with `/tmp/sts2-src` decompiled for this build, run `pnpm codex:relations` (rewrites `data/sts2/code-relations.json`, fails on event text still showing `{Var}`, `[Var]` or `X`). Fix a failing event in `eventDisplayVars()` (`src/lib/codex-data.ts`); a runtime-rolled value gets a pool word and the option hover lists the pool. Commit the JSON with the Compendium data.
- After note lines change, run `pnpm sts2:patch-lines` and commit `data/sts2-patch-lines.json` (never `public/generated/*`). `/generated/sts2-patch-lines.json` is a fixed mutable URL: loaders keep `cache: "no-cache"`. Never switch to `force-cache` or add a per-patch query bump.
- Extraction, lifecycle/deprecated sync and preserved historical localization are one push boundary: don't push it until `pnpm i18n:validate` and `pnpm codex:validate` pass. The shell push stays separate.

## Checks

- `/patches/{version}` and `/en/patches/{version}`: hover several cards, relics, powers, monster moves and plain gold terms.
- After deploy, reload a `#community:{id}` link whose story cites the newest patch and confirm `[data-story-reference-state="resolved"]` (catches stale patch-lines JSON). On a change with stories, the tooltip offers that exact count and the story panel thumbnail matches the patch `art`.
- Ready-page layout changes: `mobile-viewport-qa` on `/patches` and `/patches/{version}` with `--render-selector main --controls-selector "[data-mobile-qa-none]"`.

## Post-release (low priority)

After the notes are finished and Compendium sync is done: `pnpm static:data`, then add the patch's changed, new and deprecated resources to `scripts/versioned-entity-api.spec.ts` (new values at the new version, no leak at the version before, correct lifecycle status) and run `pnpm codex:validate` and `pnpm test:version-api`.
