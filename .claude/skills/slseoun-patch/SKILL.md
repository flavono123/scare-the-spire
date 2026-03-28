# slseoun-patch (슬서운변경)

Fetch Steam patch notes for STS2 and convert them into 슬서운변경 (rich patch notes).

This skill should be used when:
- "슬서운변경", "패치노트 가져와", "패치 업데이트", "새 패치", "rich patch"
- "Steam 패치노트", "스팀 패치", "patch notes fetch"
- A new STS2 patch is released and needs to be ingested
- User specifies a version like "v0.101.0" to process

## Overview

슬서운변경 converts raw Steam patch notes into a structured, enriched Korean format:
1. **Fetch** — Pull raw text from Steam API (SSOT)
2. **Extract** — Parse bullet points and clear statements; skip greetings/community fluff and images
3. **Translate** — Convert to Korean using in-game i18n for game entities (cards, relics, powers, etc.)
4. **Enrich** — Apply BBCode markup for text effects (entity highlighting, buff/nerf indicators)

## Data Sources

### Steam API (SSOT)
```
GET https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/
  ?appid=2868840
  &count=10
  &maxlength=300000
  &format=json
  &feeds=steam_community_announcements
```

Filter by `tags` containing `"patchnotes"`. Each item has:
- `gid` — unique ID
- `title` — e.g. "Beta Patch Notes - v0.101.0"
- `contents` — plain text (no HTML/BBCode), sections separated by newlines
- `date` — Unix timestamp
- `url` — Steam community URL

### Existing Data
- `data/sts2-patches.json` — Patch index (version, date, title, steamUrl, summary)
- `data/sts2-patch-notes/` — Per-version markdown files (raw English structured notes)
- `src/lib/codex-data.ts` — Game entity data (cards, relics, potions) for name matching
- `src/lib/codex-types.ts` — Type definitions

## Workflow

### Step 1: Fetch Raw Patch Notes

```bash
curl -s "https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=2868840&count=10&maxlength=300000&format=json&feeds=steam_community_announcements" | python3 -c "
import json, sys
data = json.load(sys.stdin)
for item in data['appnews']['newsitems']:
    if 'patchnotes' in item.get('tags', []):
        print(f'{item[\"title\"]} (gid={item[\"gid\"]})')
"
```

To fetch a specific version's content, filter by title containing the version string.

**For updating an existing version**: The same version may receive content updates (e.g. semver corrections). In that case, re-fetch and overwrite the raw notes.

### Step 2: Extract & Structure

From the raw plain text:
1. **Keep**: Bullet-point items, card/relic/enemy change descriptions, balance numbers
2. **Skip**: Greeting paragraphs ("Hey everyone..."), community messages, image references
3. **Structure** as markdown with sections:
   - Use `##` for major sections (CONTENT, BALANCE, BUG FIXES, etc.)
   - Use `###` for sub-sections (Card Changes - Silent, Relic Changes, etc.)
   - Use `- **Name**: description` for individual changes
   - Card rework format: `**OldName -> NewName** (rework): description`
   - Preserve upgrade values in parentheses: `5(7)` means base(upgraded)

Save to `data/sts2-patch-notes/{version}.md` (English structured version).

### Step 3: Translate to Korean

Create a Korean version alongside the English one. Rules:
- Game entities use **official Korean translations** from `src/lib/codex-data.ts`
  - Cards: use `nameKo` field
  - Relics: use `nameKo` field
  - Powers/keywords (Vulnerable, Strength, Block, etc.): use in-game Korean (취약, 힘, 방어도, etc.)
  - Cards with English-only names (e.g. "hello world", "null"): keep English
- Section headers: translate to Korean
- Descriptive text: natural Korean translation
- Numbers and mechanical descriptions: preserve exactly

### Step 4: Enrich with BBCode

Apply text effects to the Korean version for rich rendering:

#### Entity Highlighting (gold)
All game entities get `[gold]...[/gold]`:
- Card names: `[gold]준비[/gold]` (Prepared)
- Relic names: `[gold]진자[/gold]` (Pendulum)
- Powers/keywords: `[gold]취약[/gold]`, `[gold]힘[/gold]`, `[gold]방어도[/gold]`

#### Character Colors (section headers)
- Ironclad sections: `[red]아이언클래드[/red]`
- Silent sections: `[green]사일런트[/green]`
- Defect sections: `[aqua]디펙트[/aqua]`
- Regent sections: `[orange]리젠트[/orange]`
- Necrobinder sections: `[pink]네크로바인더[/pink]`

#### Ancient references
- Ancient names: `[blue]고대의 존재[/blue]`

#### Buff/Nerf indicators
When the original patch note clearly indicates a buff or nerf:
- Buff: `[green][sine]버프된 값[/sine][/green]`
- Nerf: `[red][jitter]너프된 값[/jitter][/red]`

### Step 5: Update Patch Index

Add/update entry in `data/sts2-patches.json`:
```json
{
  "id": "v0.101.0",
  "version": "0.101.0",
  "date": "2026-03-24",
  "title": "Beta v0.101.0",
  "titleKo": "베타 v0.101.0",
  "type": "beta",
  "steamUrl": "https://store.steampowered.com/news/app/2868840/view/{gid}",
  "summary": "...",
  "summaryKo": "...",
  "hasBalanceChanges": true
}
```

### Step 6: Speculative Commit

Per CLAUDE.md rules, commit after each meaningful edit:
- Commit raw English notes first
- Commit Korean enriched version
- Commit patches.json update

## Output Files

| File | Content |
|------|---------|
| `data/sts2-patch-notes/{version}.md` | Structured English patch notes |
| `data/sts2-patch-notes/{version}.ko.md` | Korean enriched (BBCode) patch notes |
| `data/sts2-patches.json` | Updated patch index |

## Game Entity Reference

For Korean translations, check these sources in order:
1. `src/lib/codex-data.ts` — Primary source for card/relic/potion names
2. In-game terminology (common powers, keywords):
   - Strength → 힘, Block → 방어도, Vulnerable → 취약, Weak → 약화
   - Exhaust → 소멸, Ethereal → 영묘, Innate → 선천
   - Energy → 에너지, Draw Pile → 뽑을 더미, Discard Pile → 버린 더미
   - Doom → 파멸, Soul → 영혼, Star → 별
3. If unsure, keep the English name and mark with `<!-- TODO: i18n -->` for review
