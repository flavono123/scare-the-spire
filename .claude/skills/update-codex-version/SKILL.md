# update-codex-version (코덱스 버전 업데이트)

Full pipeline for updating the codex baseline when a new STS2 patch is released.

This skill should be used when:
- "새 패치 적용", "코덱스 업데이트", "버전 업데이트", "0.102 적용"
- "update codex", "new patch", "update baseline", "apply new version"
- A new STS2 patch has been released
- User says something like "0.102.0 나왔어" or "새 버전 적용해"

## Data Sources (SSOT)

**NEVER use spire-codex.com** — its data is unreliable and frequently out of date.

Primary sources in priority order:
1. **Steam patch notes** (balance changes, card reworks, numeric values)
2. **Game files** (PCK/DLL extraction via GDRE Tools + ILSpy for new entities)
3. **In-game verification** by the user

## Prerequisites

- `npx tsx` available (project devDependencies)
- Steam API accessible (`curl`)

## Workflow

The user provides the new version number (e.g. `0.102.0`). If not provided, ask.

### Step 1: Fetch Steam Patch Notes

```bash
curl -s "https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=2868840&count=10&maxlength=300000&format=json&feeds=steam_community_announcements" | python3 -c "
import json, sys
data = json.load(sys.stdin)
for item in data['appnews']['newsitems']:
    if 'patchnotes' in item.get('tags', []):
        print(f'{item[\"title\"]} | gid={item[\"gid\"]} | date={item[\"date\"]}')
" 2>/dev/null | head -5
```

Find the matching patch and extract the full BALANCE section. This is the SSOT for all numeric changes.

### Step 2: Backup Current Data

```bash
cp -r data/spire-codex data/spire-codex-old
```

The `-old` directory is gitignored and temporary.

### Step 3: Apply Balance Changes to Baseline

Using the Steam patch notes BALANCE section, write a Python script to patch `data/spire-codex/kor/cards.json` (and relics/potions if changed).

For each card/relic/potion change in the patch notes:
1. Find the entity by ID in the JSON
2. Update the affected fields (cost, vars.*, upgrade, keywords, etc.)
3. Track before/after values for entity-versions

**Field mapping** (patch notes → JSON fields):
- "Cost X -> Y" → `cost` field
- "Damage X(Y) -> A(B)" → `vars.Damage` = A (base)
- "Block X(Y) -> A(B)" → `vars.Block` = A (base)
- "now Exhausts" → add "소멸" to `keywords`
- "now Ethereal" → add "휘발성" to `keywords`
- "Upgrade changed from X -> Y" → `upgrade` field

**For reworked cards**: Update all fields (type, rarity, vars, description, keywords, upgrade). For description, use the in-game Korean text if the user can provide it, or translate from patch notes.

**For new entities**: If the patch adds new cards/relics, the user needs to provide the full entity data (from game files or manual entry).

**Speculative commit** after each batch of changes.

### Step 4: Generate Entity Version Diffs

Create entries in `data/sts2-entity-versions.json` for each changed entity:

```json
{
  "entityType": "card",
  "entityId": "CARD_ID",
  "patch": "v{NEW_VERSION}",
  "diffs": [
    { "field": "cost", "before": OLD_VALUE, "after": NEW_VALUE }
  ]
}
```

The `before` value is what the field was BEFORE this patch (= old baseline value).
The `after` value is what the field became AFTER this patch (= new baseline value).

Use `scripts/generate-entity-diffs.ts` if you have both old and new JSON data:

```bash
npx tsx scripts/generate-entity-diffs.ts \
  --old data/spire-codex-old \
  --new data/spire-codex \
  --patch v{NEW_VERSION} \
  --write
```

Or manually add diffs when patching cards by hand from patch notes.

**Speculative commit**.

### Step 5: Update meta.json

```json
{
  "version": "{NEW_VERSION}",
  "extractedAt": "{TODAY_ISO}"
}
```

**Speculative commit**.

### Step 6: Update Patch Index

Add entry to `data/sts2-patches.json` using **exact Steam API values**:

```json
{
  "id": "v{NEW_VERSION}",
  "version": "{NEW_VERSION}",
  "date": "{PATCH_DATE}",
  "title": "{EXACT_STEAM_TITLE}",
  "titleKo": "{TRANSLATED_TITLE}",
  "type": "beta|hotfix|stable",
  "steamUrl": "https://store.steampowered.com/news/app/2868840/view/{GID}",
  "summary": "{BRIEF_SUMMARY}",
  "summaryKo": "{BRIEF_SUMMARY_KO}",
  "hasBalanceChanges": true
}
```

**Do NOT fabricate** titles, summaries, or gid values.

**Speculative commit**.

### Step 7: Clean Up

```bash
rm -rf data/spire-codex-old
```

### Step 8: Optional — Rich Patch Notes

Invoke `/slseoun-patch` for the new version.

### Step 9: Optional — Update Game Assets

If new cards/relics were added, invoke `/update-game-assets` for images.

## Verification

1. **Build check**: `pnpm --dir . build`
2. **Visual check** on dev server:
   - Card library shows correct new values
   - Version selector includes the new version
   - Old versions reconstruct correctly via backward compaction
   - Diffs display proper before/after values

## Rollback

```bash
rm -rf data/spire-codex
mv data/spire-codex-old data/spire-codex
git checkout -- data/sts2-entity-versions.json data/sts2-patches.json
```

## File Changes Summary

| File | Action |
|------|--------|
| `data/spire-codex/kor/*.json` | Balance values patched |
| `data/spire-codex/eng/*.json` | Balance values patched (if applicable) |
| `data/spire-codex/meta.json` | Version + date updated |
| `data/sts2-entity-versions.json` | New diffs added |
| `data/sts2-patches.json` | New patch entry added |
| `data/sts2-patch-notes/v{X}.md` | (Optional) New patch notes |

No TypeScript code changes needed — the system is entirely data-driven.
