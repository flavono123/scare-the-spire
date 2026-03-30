# update-codex-version (코덱스 버전 업데이트)

Full pipeline for updating the codex baseline when a new STS2 patch is released.

This skill should be used when:
- "새 패치 적용", "코덱스 업데이트", "버전 업데이트", "0.102 적용"
- "update codex", "new patch", "update baseline", "apply new version"
- A new STS2 patch has been released and spire-codex.com has updated
- User says something like "0.102.0 나왔어" or "새 버전 적용해"

## Prerequisites

- spire-codex.com must already have the new version's data available
- `npx tsx` must be available (comes with the project's devDependencies)
- The download script needs `curl` and `jq`

## Workflow

The user provides the new version number (e.g. `0.102.0`). If not provided, ask.

### Step 1: Backup Current Data

```bash
cp -r data/spire-codex data/spire-codex-old
```

This preserves the current baseline for diff comparison. The `-old` directory is gitignored and temporary.

**Verify**: Check that `data/spire-codex-old/meta.json` exists and contains the old version.

### Step 2: Download New Data from spire-codex.com

The existing download script skips files that already exist. To force re-download:

```bash
# Remove existing data files (keep directory structure)
rm -f data/spire-codex/kor/*.json data/spire-codex/eng/*.json
# Re-download
bash scripts/download-spire-codex.sh
```

**Important**: Only re-download data JSONs, NOT images. Images are handled separately by `/update-game-assets`.

**Wait for download to complete** — this takes ~2 minutes due to rate limiting.

**Verify**: Spot-check a few cards in the new `data/spire-codex/kor/cards.json` to confirm it reflects the new version.

### Step 3: Generate Entity Diffs

Run the diff generator to compare old vs new data:

```bash
npx tsx scripts/generate-entity-diffs.ts \
  --old data/spire-codex-old \
  --new data/spire-codex \
  --patch v{NEW_VERSION}
```

**Review the output carefully:**
- Check the summary (cards/relics/potions changed counts)
- Verify a few diffs against the Steam patch notes to confirm accuracy
- Look for any `[WARN]` about removed entities

If the output looks correct, re-run with `--write` to persist:

```bash
npx tsx scripts/generate-entity-diffs.ts \
  --old data/spire-codex-old \
  --new data/spire-codex \
  --patch v{NEW_VERSION} \
  --write
```

**Speculative commit**: Commit `data/sts2-entity-versions.json` changes.

### Step 4: Update meta.json

Update `data/spire-codex/meta.json` with the new version and today's date:

```json
{
  "version": "{NEW_VERSION}",
  "extractedAt": "{TODAY_ISO}"
}
```

**Speculative commit**: Commit meta.json change.

### Step 5: Update Patch Index

Add a new entry to `data/sts2-patches.json`. To get accurate metadata, fetch from Steam API:

```bash
curl -s "https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=2868840&count=10&maxlength=300000&format=json&feeds=steam_community_announcements" | python3 -c "
import json, sys
data = json.load(sys.stdin)
for item in data['appnews']['newsitems']:
    if 'patchnotes' in item.get('tags', []):
        print(f'{item[\"title\"]} | gid={item[\"gid\"]} | date={item[\"date\"]}')
" 2>/dev/null | head -5
```

Create the entry using **exact Steam API values** (do NOT fabricate titles or summaries):

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

Set `hasBalanceChanges: true` if there are any entity diffs from Step 3.

**Speculative commit**: Commit patches.json update.

### Step 6: Clean Up Backup

```bash
rm -rf data/spire-codex-old
```

### Step 7: Optional — Rich Patch Notes

If the user wants rich patch notes, invoke the `/slseoun-patch` skill for the new version.

### Step 8: Optional — Update Game Assets

If new cards were added or card art changed, invoke `/update-game-assets`.

### Step 9: Optional — Update Image Format

If new images were downloaded as PNG, convert them to WebP:

```bash
# Check for new PNG files that need conversion
find public/images/spire-codex -name "*.png" -newer data/spire-codex/meta.json
```

## Verification

After completing all steps:

1. **Build check**: `pnpm --dir . build` should succeed
2. **Visual check**: Run dev server and verify:
   - Card library shows correct data for the new version
   - Version selector includes the new version
   - Selecting an old version correctly shows historical data
   - Diffs display properly (before/after values make sense)

## Rollback

If something goes wrong and you still have `data/spire-codex-old`:

```bash
rm -rf data/spire-codex
mv data/spire-codex-old data/spire-codex
git checkout -- data/sts2-entity-versions.json data/sts2-patches.json
```

## Gitignore

Add `data/spire-codex-old/` to `.gitignore` if not already present.

## File Changes Summary

| File | Action |
|------|--------|
| `data/spire-codex/kor/*.json` | Overwritten with new version data |
| `data/spire-codex/eng/*.json` | Overwritten with new version data |
| `data/spire-codex/meta.json` | Version + date updated |
| `data/sts2-entity-versions.json` | New diffs appended |
| `data/sts2-patches.json` | New patch entry added |
| `data/sts2-patch-notes/v{X}.md` | (Optional) New patch notes |

No TypeScript code changes are needed — the system is entirely data-driven.
