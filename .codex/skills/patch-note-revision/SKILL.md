---
name: patch-note-revision
description: Safely revise, edit, backfill, or reformat existing or historical Slay the Spire 2 patch notes (data/sts2-patch-notes/*.md) without breaking community story references, external anchors, or patch line IDs. Trigger when editing already-published or older patch notes (not for ingesting newly released Steam patches, which uses slseoun-patch), backfilling official Steam notes into historical patches, fixing typos or reordering bullets in past versions, or auditing and aliasing drifted patch line IDs.
---

# Patch Note Revision

## Overview

Use this skill when modifying or backfilling **existing, previously published, or historical** STS2 patch notes (`data/sts2-patch-notes/*.md`).

This workflow is distinct from `slseoun-patch`, which handles the initial ingestion and publication of brand-new Steam releases. When revising past patch notes (fixing typos, improving Korean localization, backfilling full Steam prose into abbreviated notes, or updating `[gold]` tags), line numbers (`line-001`) and text hashes (`text-xxxxxx`) change. Without this workflow, community stories (`community_stories`), comments, and deep-link anchors break.

This skill ensures that all changes preserve backward compatibility through the static ID Transform Layer (`PATCH_LINE_ALIASES` and `scripts/audit-patch-line-ids.ts`).

## Non-Negotiables

1. **Distinct from `slseoun-patch`**: Do not use `slseoun-patch` for historical revisions. Use this skill whenever editing notes for already existing versions.
2. **Zero Operator Burden**: The assistant must never ask the user to manually compute shifted line numbers or look up old hashes. The workflow must automatically detect ID drifts, update aliases, and verify references.
3. **No Dangling Story References**:
   - Patch line IDs follow the format `${patch}:line-${ordinal}-${slug}`.
   - When bullet order, text, or entity markup changes, the ID changes.
   - Any deleted or altered ID must be mapped to its successor in `src/lib/resolve-story-patch-line.ts` (`PATCH_LINE_ALIASES`).
4. **Atomic Commits**:
   - Markdown changes in `data/sts2-patch-notes/`
   - Generated line data in `data/sts2-patch-lines.json`
   - Alias mappings in `src/lib/resolve-story-patch-line.ts`
   Must be kept consistent and committed together, following `AGENTS.md`.

## Workflow Steps

### Step 1: Edit Historical Patch Markdown
- Edit `data/sts2-patch-notes/v<version>.ko.md` and/or `data/sts2-patch-notes/v<version>.md`.
- Ensure all entity references use typed tags where possible (e.g. `[gold:card]`, `[gold:relic]`, `[gold:potion]`, `[gold:monster]`).
- Follow `docs/I18N.md` for official Korean naming conventions.

### Step 2: Regenerate Patch Lines
Run the line generator immediately after markdown edits:
```bash
pnpm sts2:patch-lines
```
This updates `data/sts2-patch-lines.json` and `data/sts2-resource-patch-index.json`.

### Step 3: Audit ID Drifts & Auto-Detect Aliases
Run the audit script to check for any line IDs that existed in the git baseline (`origin/main` or `HEAD`) but are missing or unresolvable in the new output:
```bash
pnpm patch:audit-ids
```

- **If passed** (`✅ All baseline patch lines safely resolve`): No stories or anchors were broken. Proceed to Step 5.
- **If unhandled drifts are reported** (`❌ Found N unresolvable baseline patch line(s)`):
  - Review the suggested aliases printed by the script.
  - Open [`src/lib/resolve-story-patch-line.ts`](file:///Users/flavono123/P/scare-the-spire/src/lib/resolve-story-patch-line.ts) and add the mappings to `PATCH_LINE_ALIASES`:
    ```ts
    export const PATCH_LINE_ALIASES: Record<string, string> = {
      // Existing aliases...
      "<old-id>": "<new-id>",
    };
    ```
  - Re-run `pnpm patch:audit-ids` until it exits cleanly with code 0.

### Step 4: Check Remote Database Records (When Applicable)
If an old ID was actively referenced in Supabase `community_stories`:
1. Check for affected rows:
   ```bash
   supabase db query --linked "SELECT id, sentence, patch_line_id FROM public.community_stories WHERE patch_line_id = '<old-id>';"
   ```
2. If any rows are returned, update the remote database record to point to the canonical new ID and entity metadata:
   ```bash
   supabase db query --linked "UPDATE public.community_stories SET patch_line_id = '<new-id>', entity_type = '<type>', entity_id = '<id>' WHERE patch_line_id = '<old-id>';"
   ```

### Step 5: Test & Verify
Verify the entire pipeline locally:
```bash
# 1. Verify resolution and aliases unit tests
npx tsx scripts/resolve-story-patch-line.spec.ts

# 2. Run patch regression suite (includes audit-patch-line-ids)
pnpm patch:test

# 3. Lint and type check
pnpm lint
```

### Step 6: Commit
Commit the changes with an English commit message explaining the revision and aliased lines:
```bash
git add data/sts2-patch-notes/ data/sts2-patch-lines.json src/lib/resolve-story-patch-line.ts scripts/resolve-story-patch-line.spec.ts
git commit -m "Revise vX.Y.Z patch notes and alias drifted line IDs"
```
