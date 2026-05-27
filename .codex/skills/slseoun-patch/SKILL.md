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
- Every meaningful edit gets its own speculative commit, following `AGENTS.md`.
- Never construct a Steam store/news URL from the Steam API `gid`; use a real store URL from the announcement or user.

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
3. Set `status` to `"building"` so the index/detail UI labels the patch as being prepared.
4. Mark the summary as work-in-progress in Korean and English instead of pretending the rich notes are done.
5. Do not add placeholder rich note markdown unless there is real content.
6. Commit this shell separately before asset extraction or translation work.

Index/detail behavior while `status: "building"`:

- The index card is not a link to the local detail page.
- The index card still shows one muted grayscale thumbnail. If no `art` is present yet, the UI falls back to the default STS2 banner; do not omit the thumbnail area in WIP.
- Keep the normal type/balance chips, but render them in disabled gray.
- The only colored action is the Steam original chip; it links to `steamUrl` and opens the real Steam source.
- The body shows gray per-letter sine text for "작성 중" / "Building"; do not add a separate "작성 중" chip.
- The card footer shows the date only.
- The detail page renders a stronger building state when markdown files are absent, but should not add another Steam link while building.

Remove `status` or set it to `"ready"` when the enriched notes are published.

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
2. Save structured English notes to `data/sts2-patch-notes/{version}.md`:
   - Use the Steam title exactly as `# ...`.
   - Skip greetings, community fluff, image placeholders, and unrelated promo text.
   - Use `##`/`###` sections and bullet items.
   - Preserve numeric values exactly, including upgrade notation like `5(7)`.
3. Commit the English notes.
4. Run or verify `update-game-assets` for the patched game version.
5. Translate/enrich Korean notes at `data/sts2-patch-notes/{version}.ko.md`.
6. Update `data/sts2-patches.json` with factual summaries, `hasBalanceChanges`, representative `art`, and any useful `featuredEntities` fallback shortlist.
7. Apply machine-readable data changes:
   - `data/sts2/{eng,kor}/cards.json`
   - `data/sts2/{eng,kor}/relics.json`
   - `data/sts2/{eng,kor}/potions.json`
   - `data/sts2/{eng,kor}/powers.json`
   - `data/sts2-entity-versions.json`
   - `data/sts2-changes.json`
   - `data/sts2/meta.json`
8. Commit each meaningful file group independently.

## Korean Rich Markup

- Cards: `[gold:card]이름[/gold]`
- Relics: `[gold:relic]이름[/gold]` when needed, otherwise `[gold]이름[/gold]`
- Potions: `[gold:potion]이름[/gold]`
- Powers: `[gold:power]이름[/gold]`
- Enchantments: `[gold:enchantment]이름[/gold]`
- Events: `[gold:event]이름[/gold]`
- Monsters/encounters: `[gold:monster]이름[/gold]`, `[gold:encounter]이름[/gold]`
- Ancients: `[blue]고대의 존재[/blue]` for the category; `[gold:ancient]니오우[/gold]` for a specific Ancient.
- Buff label: `([green][sine]버프[/sine][/green])`
- Nerf label: `([red][jitter]너프[/jitter][/red])`

When a name can be both a card and a power, always use a type hint. Patch notes usually mean cards in card-change sections, so prefer `[gold:card]` there.

## Monster Animation Patch Diff

Use this only for monster reworks, moveset changes, intent/action changes, HP or power changes that are clearer as animated before/after panels. The current supported target is monsters.

Rules:

- Keep Steam patch-note prose outside the diff block. Do not move official bullets like "Adjusted moveset" or "Reworked Wither status..." into service commentary.
- Put service-authored explanation inside the animation diff component, but do not label the UI as `애니메이션 패치 diff` / `Animation Patch Diff`. The collapsible summary should read like the Steam original-view disclosure: compact, text-only, and borderless.
- Add a standalone marker line below the relevant monster bullet:

```markdown
[monster-pattern-diff:MONSTER_ID:v0.106.0:full]
```

- Use `full` on patch detail pages. Compact rendering is for monster patch-history rails.
- The diff block must be collapsible and default-open. When collapsed, only the narrow summary header should remain; do not force the full wide animation row to reserve space.
- The collapsible summary text is only the expand/collapse trigger. Do not make the summary title itself link to the monster page.
- Keywords inside service-authored diff explanation must use the game gold treatment and real hover previews/links. Monster move keywords link to the parent monster page and preview the move animation + intent. Power/card keywords use their game hover tip.
- Build before/after move panels from game data whenever possible. Use current Codex/game data for the after state. For before values, prefer prior extracted data or an existing pre-patch commit over memory.
- Include HP bars when HP changed and starting effects when starting powers changed. If a power/card is mentioned in service commentary, link it as a real Codex keyword.
- Do not add an animation diff just because a monster is mentioned. Use it when behavior or pattern changed enough that prose alone hides the actual player-facing difference.
- Current implementation lives in `src/components/codex/monster-move-visuals.tsx` and is rendered by `src/components/patch-note-renderer.tsx`.

## Keyword And Link Validation

Before finalizing `.ko.md`, audit all `[gold...]...[/gold]` names against current Codex data:

- If the name exists in current Codex data, the BBCode must match the official Korean display name and use a type hint whenever ambiguous.
- If the patch note mentions a real game term that is not a current Codex page, keep `[gold]term[/gold]`; the renderer will show yellow bold text without tooltip/link.
- Do not translate entity names by memory when PCK has a Korean title.
- For new entities from the patch, update Codex data first, then use their official names in the rich note.

Useful checks:

```bash
pnpm codex:validate
pnpm lint
```

For tooltip/link changes, inspect the patch detail page in the browser and hover several cards, relics, powers, and unknown keyword-only highlights.

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
