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
- Keep the normal type/balance chips, but render them in disabled gray.
- The only colored action is the Steam original chip; it links to `steamUrl` and opens the real Steam source.
- The body shows gray per-letter sine text for "작성 중" / "Building"; do not add a separate "작성 중" chip.
- The card footer shows the date only.
- The detail page renders a stronger building state when markdown files are absent, but should not add another Steam link while building.

Remove `status` or set it to `"ready"` when the enriched notes are published.

## Patch Index Preview Assets

Use `featuredEntities` in `data/sts2-patches.json` to replace the gray summary body on ready patch cards with related game assets.

Rules:

- Treat `featuredEntities` as a priority-ordered shortlist, not an exhaustive list.
- Keep at most 8 entries per patch; the index also caps rendering at 8.
- Choose the most important patch subjects first: new cards/relics/potions, major reworks, balance headline items, then important monsters/events.
- Use exact current Codex entity IDs and types. Valid types are `card`, `relic`, `potion`, `power`, `enchantment`, `event`, `monster`, `encounter`, and `ancient`.
- Only include entities that resolve to an image in the current Codex data. If a patch keyword has no current Codex image, keep it in the rich note text but do not add it to `featuredEntities`.
- Cards render as full card tiles; other entities render as image-only assets. Do not show labels, tooltips, links, borders, or hover scale in the index preview.
- The current layout is a card-sized responsive slot: 4 columns on mobile, 8 on wider screens. Non-card assets can look vertically sparse or small in that slot, especially events; leave that as a UI TODO unless the task is specifically to redesign preview sizing.

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
6. Update `data/sts2-patches.json` with factual summaries and `hasBalanceChanges`.
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

## Developer Notes

Only include developer intent/commentary in the Korean rich file:

```markdown
[devnote]자연스러운 한국어 번역, 엔티티 BBCode 포함[/devnote]
[devnote:en]Original English text[/devnote]
```

Put section-level notes below the `###` heading and item-level notes below the affected bullet.

## Legacy Reference

The older Claude workflow lives at `.claude/skills/slseoun-patch/SKILL.md`. Use it only for historical examples; this Codex skill is the operational source for new Codex runs.
