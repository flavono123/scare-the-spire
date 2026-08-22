---
name: slseoun-patch
description: Fetch new Slay the Spire 2 Steam patch notes and turn them into 슬서운변경 rich patch pages, including shell-first publishing, Korean enrichment, exact Codex keyword linking, and required current-game asset synchronization. Trigger for 슬서운변경, STS2 patch notes, Steam patch ingestion, rich patch creation, or a target version like v0.105.0.
---

# slseoun-patch

Create or update STS2 rich patch notes. Steam is the source of truth for patch-note prose; the current local game install is the source of truth for Codex names, descriptions, images, and structural data.

## Non-Negotiables

- Run `update-game-assets` first when the target patch is newer than `data/sts2/meta.json` or when patch notes mention changed game content.
- Do not finalize Korean rich notes until Codex data reflects the patched game version.
- Use official Korean names from PCK/Codex. Cards with official English names such as `hello world` and `null` stay English.
- Follow `docs/I18N.md` for patch-note locale behavior; `serviceLocale` selects the patch-note file, while game entity names and hover/link targets follow `gameLocale`.
- Every meaningful edit gets its own speculative commit, following `AGENTS.md`.
- Never construct a Steam store/news URL from the Steam API `gid`; use a real store URL from the announcement or user.
- Before finalizing a ready patch that touches Compendium resources, run `.codex/skills/sts2-compendium-patch-sync/SKILL.md` after rich notes and asset extraction so PCK/DLL diffs, `data/sts2-changes.json`, and lifecycle/deprecated behavior are applied together.
- Do not push newly extracted localization or current Codex rows until lifecycle/deprecated sync, historical localization preservation, `pnpm i18n:validate`, and `pnpm codex:validate` all agree.
- Treat `/generated/sts2-patch-lines.json` as a mutable fixed URL: client loaders must revalidate it with `cache: "no-cache"` or use an automatically content-addressed URL. Never restore `force-cache` or require a manual patch-version query bump.
- Do not spend time preserving or checking any Vercel deployment path. Cloudflare Workers and the static patch Worker are the only deployment targets for this workflow.
- For Cloudflare Free-plan/runtime risk, load `.codex/skills/cf-guardrails/SKILL.md` instead of repeating quota rules here.

## Publish Order

Patch release work is speed-first:

1. If the expected patch window arrives but Steam has not published anything,
   use `.codex/skills/slseoun-patch-watch/SKILL.md` to publish the static
   `준비 시간` stage, or the optional `지연` stage after the expected Friday KST
   window slips. Keep the same trigger session running and poll the Steam store
   news page as described in Steam Watch Polling below.
2. As soon as Steam publishes the patch, publish the real `작업 도구` shell
   first:
   create/update the `data/sts2-patches.json` entry with `status: "building"`,
   commit it, push it, and continue. Do not wait for Cloudflare deployment
   success before starting the rich-note work.
3. Produce the first useful rich notes quickly and publish them as a **draft**.
   A readable first published version is preferred over trying to make every
   Korean nuance, tooltip, and expression perfect in one turn.
4. Draft publishing is the default after `작업 도구`. Set `draft: true` on the
   patch index entry, keep `status` omitted or `"ready"`, commit, push, and run
   the matching patch Worker checks. The index card must look like a finished
   patch card plus the `재성형` keyword beside the version title; the detail
   page must show the fixed floating furnace notice. Send the public patch URL
   to the user and keep shaping the notes. Do not treat this as a separate
   thumbnail/stage like `준비 시간`, `지연`, or `작업 도구`.
5. Only remove the draft chrome when the user explicitly asks to finish the
   patch notes. Delete `draft` (do not add a new status). Ready/complete does
   **not** mean the notes can never change again; it only means the in-progress
   keyword and notice come off.

## Draft Chrome

Draft is an overlay on an otherwise ready patch, not a visual stage.

`재성형` and the type/balance chips are different ranks. Type chips (`출시` /
`베타` / `핫픽스`) and the `밸런스` chip describe the patch notes themselves and
stay after the draft is finished. `재성형` is a temporary notes-revision
status: it sits beside the version title as a game keyword, never in the
type/balance chip row, and comes off when `draft` is deleted. Do not render it
as a Badge twin of `베타` or `밸런스`. Hover copy exists but is easy to miss;
the glanceable signal is the gold `font-game-title` keyword next to the
version, with a left divider before the nature chips.

- Data: `draft: true`. Keep `status` omitted or `"ready"` so the card stays
  a link with full-color representative art and the patch-notes title token.
- Index: `src/components/patches/patch-draft-chrome.tsx` `PatchDraftChip`
  beside the version title, in the same cluster as the ready `패치노트` token.
  Token is `powers/furnace_power.webp` with the `spire-purple` variant (not
  orange — that collides with hotfix). Label is `cards.BEAT_INTO_SHAPE.title`
  (`재성형` / `Beat into Shape`) in `font-game-title` gold (`#EFC851`), matching
  the detail-notice title. When `draft` is on, the type/balance chip cluster
  gets a left divider. Hover uses the Early Access punchline below; do not
  rely on hover or the furnace ember animation as the primary signal. The word
  `재성형` alone does not explain that notes are still being revised.
- Detail: `PatchDraftNotice` is a fixed bar under the site navbar. Copy is the
  Early Access punchline with the unfinished subject swapped to this patch
  note (`아직 작업이 완료되지 않았다는 뜻이죠.` /
  `That means this patch note isn't done yet.`).
- Always include both surfaces when publishing the first draft after
  `작업 도구`. Remove both together when the user asks for the finished notes.
- Do not grayscale the art, replace the title token, unlink the card, or move
  `재성형` into the type/balance chip row.

## Steam Watch Polling

After `준비 시간` is published, continue in the session that was started by the
same trigger. Poll the canonical Steam store news page until the intended new
patch appears:

```text
https://store.steampowered.com/news/app/2868840
```

- Poll at a restrained interval, such as once per minute. Do not terminate the
  watch merely because one request has no new announcement.
- Identify the intended patch by its newly appearing title/version and compare
  it with the announcements that existed when polling began.
- If the expected window slips while polling, optionally publish the `지연`
  stage through `$slseoun-patch-watch`, then keep polling in the same session.
- Follow the actual link exposed by the new store-page announcement. It should
  have the established form
  `https://store.steampowered.com/news/app/2868840/view/{id}`; preserve that
  discovered URL as `steamUrl` instead of synthesizing one from an API `gid`.
- As soon as the announcement appears, stop polling, switch to Shell-First
  Mode, publish and push the `작업 도구` WIP shell, then begin the full rich
  patch-note workflow without waiting for that deployment to finish.

## Steam Fetch

Fetch announcements:

```bash
curl -s "https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=2868840&count=10&maxlength=300000&format=json&feeds=steam_community_announcements"
```

Prefer items with `tags` containing `patchnotes`, but also search unfiltered titles because major updates and stable releases may omit the tag. Match the requested version in the title, such as `v0.105.0`.

## Shell-First Mode

Use this when Steam has published the patch but rich notes are not ready yet.

1. Add or update the `data/sts2-patches.json` entry with the real version/date/title/type/Steam URL.
2. Keep `steamUrl` live.
3. Set `status` to `"building"` so the index/detail UI shows the `작업 도구`
   stage while the patch is being prepared.
4. Mark the summary as being prepared in Korean and English instead of pretending the rich notes are done.
5. Do not add placeholder rich note markdown unless there is real content.
6. Commit this shell separately before asset extraction or translation work.
7. Push immediately after the shell commit so Cloudflare can deploy the
   `작업 도구` state. Do not wait for deployment success; continue the
   patch-note work.

Index/detail behavior while `status: "building"`:

- The index card is not a link to the local detail page.
- The index card still shows one muted grayscale thumbnail. If no `art` is
  present yet, the UI falls back to the default STS2 banner; do not omit the
  thumbnail area in the `작업 도구` shell.
- Keep the normal type/balance chips, but render them in disabled gray.
- The only colored action is the Steam original chip; it links to `steamUrl` and opens the real Steam source.
- The title uses the animated
  `powers/animated/tools_of_the_trade_power_tilt.webp` token plus the version
  label. Do not add a separate `작업 도구` / `Tools of the Trade` stage chip;
  the token already carries the building-stage identity.
- The card footer shows the date only.
- The detail page renders a stronger building state when markdown files are absent, but should not add another Steam link while building.

Remove `status` or set it to `"ready"` when the first enriched notes are
published, and set `draft: true` so the `재성형` keyword and floating notice stay
on. Do not wait for a perfect translation pass before this draft goes live.

When the user explicitly asks to finish the notes, delete `draft`. Completing
the draft chrome does not forbid later corrections.

## Cloudflare Patch-First Provisional Mode

Use this in the Cloudflare worktree when rich patch notes need to publish before
the main Compendium Worker has the matching pages and canonical assets.

- Follow `docs/PATCH_WORKER_DEPLOY_CONTRACT.md`.
- Build and validate patch pages through the separate static patch Worker path:
  `pnpm patch:build`, `pnpm patch:test`, then `pnpm cf:patch:preview` or
  `pnpm cf:patch:deploy`.
- Current production routing reaches the patch Worker through the main Worker's
  `PATCH_WORKER` service binding for `/patches*` and `/_patches*`. Keep this as
  the workers.dev/rollback fallback; future custom-domain direct routing is
  documented in `docs/CLOUDFLARE_CUSTOM_DOMAIN_ROUTING.md`.
- Keep patch publishing asset-first. Do not add request-time patch markdown
  rendering, Compendium data queries, large JSON parsing, or OpenNext SSR work
  to serve ready patch pages.
- Rich notes may include new cards, relics, powers, or other Compendium
  resources before the main Worker is ready only when those resources are also
  represented in `data/sts2-patch-local-resources.json`.
- Patch-local resources must use official game names from extracted data. Do not
  invent names, descriptions, or artwork.
- Patch-local provisional assets must live under `/_patches/*`; do not point to
  guessed canonical `/images/sts2/*` paths before the main Compendium data owns
  those assets.
- Pending patch-local resources render hover-only construction previews and must
  not link to Compendium pages until the deployed
  `/generated/compendium-resource-manifest.json` contains the resource.
- When the main Compendium Worker catches up, redeploy the patch Worker so the
  manifest turns pending hover-only previews into normal Compendium links.
- Apply `$cf-guardrails` for Cloudflare Free-plan release blockers. Patch pages
  should only dispatch static assets at request time.

## Patch Representative Art

Use `art` in `data/sts2-patches.json` to select one representative image for each ready patch. The same art appears on the patch index card and near the top of the patch detail page.

Preferred sources, in order:

1. Patch-relevant epoch art, when a timeline/epoch unlock or theme clearly matches the patch.
2. Patch-relevant event background art.
3. Patch-relevant card art, especially for headline new cards, major reworks, or new portrait art.
4. Patch-relevant Ancient background art from `public/images/sts2/ancients-bg/`.
5. If there is no good patch-specific art, use the text-free STS2 banner at `public/images/sts2/patches/default-art.jpg`.

Rules:

- Do not use a grid of up to 8 preview assets for the index anymore. Pick one art image.
- Use exact current IDs and factual asset sources. Valid `art.type` values are `card`, `epoch`, `event`, `ancient`, and `image`.
- Prefer `art: { "type": "epoch", "id": "REGENT5_EPOCH" }` style references over raw paths when the art maps to a known game concept.
- Use `image` only for standalone assets such as the default STS2 banner, and include `imageUrl`.
- Add `alt` and `altKo` when the automatic label would be unclear.
- For `v0.105.0`, use the Friendship epoch art: `art.type = "epoch"`, `art.id = "REGENT5_EPOCH"`, Korean alt text `역사: 친구`.
- If the best art for an older patch is unclear, ask the user or make an explicit recommendation instead of guessing silently.
- Keep `featuredEntities` only as a priority-ordered semantic shortlist and fallback source. The current UI no longer renders it as an 8-item thumbnail grid.

## Full Rich Patch Workflow

1. Fetch raw Steam contents for the target version.
2. If Shell-First Mode has not already been committed and pushed for this
   patch, do it now before writing rich notes.
3. Save structured English notes to `data/sts2-patch-notes/{version}.md`:
   - Use the Steam title exactly as `# ...`.
   - Skip greetings, community fluff, image placeholders, and unrelated promo text.
   - Use `##`/`###` sections and bullet items.
   - Preserve numeric values exactly, including upgrade notation like `5(7)`.
   - This is also a rich note file, not raw plain text. Add Codex keyword markup for cards, relics, powers, events, monsters, ancients, and important game terms so `/en` and other game-only locale pages keep hover/link previews.
4. Commit the English notes.
5. Run or verify the fast path in `update-game-assets` for the patched game
   version. Skip heavyweight asset refreshes unless the patch or diff indicates
   that those assets changed.
6. Translate/enrich Korean notes at `data/sts2-patch-notes/{version}.ko.md`.
   Prefer a fast, factual first pass with correct entity markup over a perfect
   final tone in one turn.
7. Update `data/sts2-patches.json` with factual summaries, `hasBalanceChanges`, representative `art`, and any useful `featuredEntities` fallback shortlist.
8. Apply machine-readable data changes:
   - `data/sts2/{eng,kor}/cards.json`
   - `data/sts2/{eng,kor}/relics.json`
   - `data/sts2/{eng,kor}/potions.json`
   - `data/sts2/{eng,kor}/powers.json`
   - `data/sts2-changes.json` is the SSOT for structured patch changes. Put player-facing `diffs`, machine-applicable `fieldDiffs`, cross-resource `relatedEntities`, and optional `visualDiff` on the same `STS2Change` record.
   - Do not hand-author `data/sts2-entity-versions.json`; `getEntityVersionDiffs()` derives version diffs from `data/sts2-changes.json`.
   - `data/sts2/meta.json`
9. Run `.codex/skills/sts2-compendium-patch-sync/SKILL.md` when the patch touched any Compendium resource, monster behavior, asset, localization, or deprecated/removed resource. Treat this as the post-patch guardrail before the patch becomes ready.
10. Before pushing any extraction/localization/lifecycle milestone:
    - Compare removed or renamed game IDs with current Codex rows and apply the
      lifecycle/deprecated sync first.
    - Preserve the previous official localized title and description for
      historical or deprecated resources when the current PCK no longer ships
      them. Never invent replacement text or blindly whitelist a missing key.
    - Run `pnpm i18n:validate` and `pnpm codex:validate`. A missing active
      resource needs verified extracted localization; a removed resource needs
      both lifecycle metadata and preserved historical localization.
    - Treat extraction, lifecycle sync, and localization preservation as one
      push boundary. Keep the shell-first WIP push separate, but do not publish
      a partially synchronized game-data commit.
11. Commit each meaningful file group independently and push publishable milestones
    quickly after the validation gate passes.
12. For the first complete draft, set `draft: true`, omit `status` or set it to
    `"ready"`, commit, push, and verify that the public patch page deployed with
    both the index keyword and the detail notice. Send the public patch URL to
    the user. Keep correcting in place until the user asks to take the draft
    chrome off.

## Community Story Patch-Line Cache Contract

- After patch-note line content or IDs change, run `pnpm sts2:patch-lines` and
  `pnpm static:data` before the main Worker deployment so both
  `data/sts2-patch-lines.json` and
  `public/generated/sts2-patch-lines.json` contain the new patch.
- Keep the large static JSON cacheable while forcing browser revalidation via
  `cache: "no-cache"`; its ETag avoids retransferring unchanged data. Do not add
  a query string that someone must update for each patch.
- After deployment, reload a `#community:{id}` deep link whose story references
  the newest patch and verify `[data-story-reference-state="resolved"]`. This
  catches the stale previous-patch JSON failure that only affects newly added
  community stories.
- Run `pnpm patch:test` after `pnpm patch:build`; it guards the populated story
  tooltip copy and the patch representative art used by the story panel.
- On the newest ready patch, hover a change whose story count is positive and
  verify the tooltip offers to view that exact count rather than writing the
  first story. Open it and verify the panel thumbnail matches the patch's
  representative `art`, just as the story reference block does, instead of
  falling back to the generic patch image.

## Compendium Versioning Contract

Every Codex resource changed by a patch needs machine-readable `fieldDiffs` in `data/sts2-changes.json`, not only rich prose or a visual diff. The shared version selector is driven by `src/lib/codex-versioning.ts`, which derives historical resource state from `fieldDiffs`; do not add one-off reconstruction logic inside individual library/detail components.

- Supported compendium version targets include cards, relics, potions, powers, enchantments, afflictions, events, monsters, encounters, ancients, and epochs. Steam/game `enemy` changes are normalized to compendium `monster` versioning.
- For monster reworks, pair `visualDiff: { "type": "monster-pattern" }` with resource field diffs for the actual changed data, such as `minHp`, `minHpAscension`, `damageValues`, `blockValues`, `moves`, `bestiaryMoves`, and `initialPowerApplications`.
- Patch-history rails may suppress raw field-diff prose when a curated visual diff exists, but the field diffs must still exist so old versions render correctly in the Compendium.
- Context-free compendium pages should not bake action-specific amounts into resource descriptions. For example, a power description with `{Amount}` should show `X` unless a monster move, card, relic, or patch visual passes a concrete amount into the shared game hover tip.
- If a resource needs patch-specific behavior beyond generic field reconstruction, add a small extension around the common versioning path instead of bypassing it.
- For deprecated or removed resources, follow `.codex/skills/sts2-compendium-patch-sync/SKILL.md`: keep historical resource rows, add `deprecated` and `deprecatedInPatch` field diffs, render assets grayscale from the deprecated patch onward, and keep pre-deprecated versions colored and linkable.

## Patch Note I18N Contract

Patch notes follow the truth table in `docs/I18N.md`.

- `serviceLocale=ko` reads `data/sts2-patch-notes/{version}.ko.md`; `serviceLocale=en` reads `data/sts2-patch-notes/{version}.md`.
- `gameLocale` controls displayed game names, hover cards, and Compendium links. For example, `/en/patches/0.106.1` should use English service UI and English game text, while `/zh/patches/0.106.1` should keep the English-authored prose but show Chinese game entity names in linked keywords.
- English files need the same entity coverage as Korean files. Do not leave names as plain text just because Steam prose is English.
- In both files, use `[gold:type]Name[/gold]` when the target is a Codex resource, `[gold]term[/gold]` when it is only a game term, and `[blue]Ancient[/blue]` / `[blue]고대의 존재[/blue]` for the category.
- When a card mention includes an upgrade suffix, put the suffix inside the entity tag, e.g. `[gold:card]Largesse+[/gold]` or `[gold:card]하사+[/gold]`, so the hover preview renders the upgraded card.
- After adding a new ready patch, smoke test the Korean route and the English game-locale route, e.g. `/patches/{version}` and `/en/patches/{version}`.

## Rich Markup

- Cards: `[gold:card]이름[/gold]`
- Cards in English notes: `[gold:card]Name[/gold]`
- Relics: `[gold:relic]이름[/gold]` when needed, otherwise `[gold]이름[/gold]`
- Relics in English notes: `[gold:relic]Name[/gold]`
- Potions: `[gold:potion]이름[/gold]`
- Powers: `[gold:power]이름[/gold]`
- Enchantments: `[gold:enchantment]이름[/gold]`
- Events: `[gold:event]이름[/gold]`
- Monsters/encounters: `[gold:monster]이름[/gold]`, `[gold:encounter]이름[/gold]`
- Ascensions: `[gold:ascension]승천 8[/gold]`, `[gold:ascension]Ascension 8[/gold]`, `[gold:ascension]A8[/gold]`. Never tag bare `승천` / `Ascension` — that hits tutorials and phrases like "높은 승천".
- Ancients: `[blue]고대의 존재[/blue]` for the category; `[gold:ancient]니오우[/gold]` for a specific Ancient.
- Buff label: `([green][sine]버프[/sine][/green])`
- Nerf label: `([red][jitter]너프[/jitter][/red])`

When a name can be both a card and a power, always use a type hint. Patch notes usually mean cards in card-change sections, so prefer `[gold:card]` there.

### Ascension history (tier 2)

An Ascension's patch history includes **every change that affects that level**, not only notes *about* the modifier itself.

- Explicit `승천 N` / `Ascension N` / `A8` always belongs to that level. Example: `갑각충 (버프): 승천 8 체력이 24-28(25-29) → 24-28(26-30)` is both the monster's history **and** Ascension 8's history.
- Some A8/A9 monster changes never say 승천. Tag the numbered phrase when Steam wrote it; when Steam only changed the parenthetical value, still treat it as that Ascension:
  - Monster **HP** `N-N(N-N)` / `N(N)` parentheticals are Ascension 8 (질긴 적들), even with no 승천 mention.
  - Monster **damage** `N(M) → N(M2)` parentheticals are Ascension 9 (지독한 적들). Card upgrade parens like `6(8)` on cards are **not** A9.
- Do not invent a `승천 9` clause in the Korean prose if Steam did not say it. Matching is done by `scripts/generate-sts2-patch-lines.ts`; the renderer also auto-wraps untagged numbered mentions for hover/link.
- After notes change, run `pnpm sts2:patch-lines`. Commit `data/sts2-patch-lines.json`; do not commit `public/generated/*`.

## Monster Animation Patch Diff

Use this only for monster reworks, moveset changes, intent/action changes, HP or power changes that are clearer as animated before/after panels. The current supported target is monsters.

Rules:

- Keep Steam patch-note prose outside the diff block. Do not move official bullets like "Adjusted moveset" or "Reworked Wither status..." into service commentary.
- Put service-authored explanation inside the animation diff component, but do not label the UI as `애니메이션 패치 diff` / `Animation Patch Diff`. The collapsible summary should read like the Steam original-view disclosure: compact, text-only, and borderless.
- Add a standalone marker line below the relevant monster bullet:

```markdown
[monster-pattern-diff:MONSTER_ID:v0.106.0:full]
```

- Also set `visualDiff: { "type": "monster-pattern" }` on the corresponding `data/sts2-changes.json` record. Patch-history rails use that structured change record to decide whether to show the compact monster diff.
- Use `full` on patch detail pages. Compact rendering is for monster patch-history rails.
- The diff block must be collapsible and default-open. When collapsed, only the narrow summary header should remain; do not force the full wide animation row to reserve space.
- The collapsible summary text is only the expand/collapse trigger. Do not make the summary title itself link to the monster page.
- Keywords inside service-authored diff explanation must use the game gold treatment and real hover previews/links. Monster move keywords link to the parent monster page and preview the move animation + intent. Power/card keywords use their game hover tip.
- Build before/after move panels from game data whenever possible. Use current Codex/game data for the after state. For before values, prefer prior extracted data or an existing pre-patch commit over memory.
- Include HP bars when HP changed and starting effects when starting powers changed. If a power/card is mentioned in service commentary, link it as a real Codex keyword.
- For monster move card applications, distinguish adding a card from upgrading/strengthening an existing status/card effect. Tiny-card applications should show the card icon and card name. Upgrade-style applications should render the name as `Name+` in the game's green text color without tinting the tiny-card icon and without a quantity badge.
- Do not add an animation diff just because a monster is mentioned. Use it when behavior or pattern changed enough that prose alone hides the actual player-facing difference.
- Current implementation lives in `src/components/codex/monster-move-visuals.tsx` and is rendered by `src/components/patch-note-renderer.tsx`.

## Keyword And Link Validation

Before finalizing `.md` and `.ko.md`, audit all `[gold...]...[/gold]` names against current Codex data:

- If the name exists in current Codex data, the BBCode must match the official display name for that file and use a type hint whenever ambiguous.
- If the patch note mentions a real game term that is not a current Codex page, keep `[gold]term[/gold]`; the renderer will show yellow bold text without tooltip/link.
- Do not translate entity names by memory when PCK has a Korean title.
- For new entities from the patch, update Codex data first, then use their official names in the rich note.

Useful checks:

```bash
pnpm codex:validate
pnpm lint
```

For tooltip/link changes, inspect the patch detail page in the browser and hover several cards, relics, powers, and unknown keyword-only highlights.

For Cloudflare patch-first publishing, run:

```bash
pnpm patch:build
pnpm patch:test
pnpm cf:patch:preview
```

Confirm the preview serves `/patches`, `/patches/{version}`, and `/_patches/*`
assets from the patch Worker without request-time markdown rendering or broken
pending Compendium links.

For ready-state patch page changes, run `$mobile-viewport-qa` after the browser smoke checks on both `/patches` and `/patches/{version}`. Use `main` as the render selector and a non-matching controls selector unless the page has a route-specific QA selector:

```bash
node .codex/skills/mobile-viewport-qa/scripts/check-mobile-route.mjs \
  --route /patches \
  --render-selector main \
  --controls-selector "[data-mobile-qa-none]"

node .codex/skills/mobile-viewport-qa/scripts/check-mobile-route.mjs \
  --route /patches/0.106.0 \
  --render-selector main \
  --controls-selector "[data-mobile-qa-none]"
```

## Developer Notes

Only include developer intent/commentary in the Korean rich file:

```markdown
[devnote]자연스러운 한국어 번역, 엔티티 BBCode 포함[/devnote]
[devnote:en]Original English text[/devnote]
```

Put section-level notes below the `###` heading and item-level notes below the affected bullet.

## Legacy Reference

The older Claude workflow lives at `.claude/skills/slseoun-patch/SKILL.md`. Use it only for historical examples; this Codex skill is the operational source for new Codex runs.
