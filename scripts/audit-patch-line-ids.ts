#!/usr/bin/env npx tsx
/**
 * audit-patch-line-ids.ts
 *
 * Audits STS2 patch lines for ID drifts, removed line IDs, and broken references.
 * Ensures that edits to past patch notes do not break community stories
 * or external line anchors.
 *
 * Usage: npx tsx scripts/audit-patch-line-ids.ts [--base <git-ref>]
 * Exit code: 0 = pass, 1 = unhandled ID drift detected
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import {
  PATCH_LINE_ALIASES,
  indexPatchLines,
  resolveStoryPatchLine,
} from "../src/lib/resolve-story-patch-line";
import type { STS2PatchLine, Story } from "../src/lib/types";

const DATA_DIR = path.join(process.cwd(), "data");
const PATCH_LINES_PATH = path.join(DATA_DIR, "sts2-patch-lines.json");
const STORIES_PATH = path.join(DATA_DIR, "sts2-stories.json");

function getBaseRef(): string | null {
  const args = process.argv.slice(2);
  const baseIdx = args.indexOf("--base");
  if (baseIdx !== -1 && args[baseIdx + 1]) {
    return args[baseIdx + 1];
  }

  // Check if working tree has unstaged or staged changes in sts2-patch-lines.json
  try {
    const status = execSync("git status --porcelain data/sts2-patch-notes data/sts2-patch-lines.json", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "ignore"],
    }).trim();
    if (status.length > 0) {
      return "HEAD";
    }
  } catch {
    // Not a git repo or git error
  }

  // If working tree is clean, compare HEAD with origin/main or HEAD~1
  for (const candidate of ["origin/main", "HEAD~1"]) {
    try {
      execSync(`git rev-parse --verify ${candidate}`, { stdio: "ignore" });
      return candidate;
    } catch {
      continue;
    }
  }
  return null;
}

function loadBaselinePatchLines(baseRef: string): STS2PatchLine[] | null {
  try {
    const raw = execSync(`git show ${baseRef}:data/sts2-patch-lines.json`, {
      encoding: "utf-8",
      maxBuffer: 30 * 1024 * 1024,
      stdio: ["pipe", "pipe", "ignore"],
    });
    return JSON.parse(raw) as STS2PatchLine[];
  } catch {
    return null;
  }
}

function findBestSuggestion(oldLine: STS2PatchLine, currentLines: STS2PatchLine[]): STS2PatchLine | null {
  const patchCandidates = currentLines.filter((l) => l.patch === oldLine.patch);

  // 1. Same entity refs
  const oldEntityKeys = new Set(oldLine.entityRefs?.map((r) => `${r.type}:${r.id}`));
  if (oldEntityKeys.size > 0) {
    const matchingEntity = patchCandidates.filter((cand) =>
      cand.entityRefs?.some((r) => oldEntityKeys.has(`${r.type}:${r.id}`)),
    );
    if (matchingEntity.length === 1) return matchingEntity[0];
  }

  // 2. Text inclusion/overlap
  const oldText = (oldLine.textKo || oldLine.markdownKo || "").replace(/[^가-힣a-zA-Z0-9]/g, "");
  if (oldText.length >= 4) {
    for (const cand of patchCandidates) {
      const candText = (cand.textKo || cand.markdownKo || "").replace(/[^가-힣a-zA-Z0-9]/g, "");
      if (candText.includes(oldText.slice(0, 10)) || oldText.includes(candText.slice(0, 10))) {
        return cand;
      }
    }
  }

  return null;
}

function main() {
  if (!fs.existsSync(PATCH_LINES_PATH)) {
    console.error(`Error: ${PATCH_LINES_PATH} does not exist. Run pnpm sts2:patch-lines first.`);
    process.exit(1);
  }

  const currentLines: STS2PatchLine[] = JSON.parse(fs.readFileSync(PATCH_LINES_PATH, "utf-8"));
  const currentLineMap = indexPatchLines(currentLines);
  console.log(`Loaded ${currentLines.length} current patch lines.`);

  let hasErrors = false;

  // 1. Audit static stories
  if (fs.existsSync(STORIES_PATH)) {
    const staticStories: Story[] = JSON.parse(fs.readFileSync(STORIES_PATH, "utf-8"));
    for (const story of staticStories) {
      if (!story.patchLineId) continue;
      const resolved = resolveStoryPatchLine(story, currentLineMap);
      if (!resolved) {
        console.error(`❌ Static story "${story.id}" has unresolvable patchLineId: "${story.patchLineId}"`);
        hasErrors = true;
      }
    }
  }

  // 2. Audit existing PATCH_LINE_ALIASES targets
  for (const [legacyId, targetId] of Object.entries(PATCH_LINE_ALIASES)) {
    const target = currentLineMap.get(targetId);
    if (!target) {
      console.error(`❌ Invalid alias in PATCH_LINE_ALIASES: "${legacyId}" -> "${targetId}" (target not found in current patch lines)`);
      hasErrors = true;
    }
  }

  // 3. Audit against baseline git ref
  const baseRef = getBaseRef();
  if (baseRef) {
    console.log(`Comparing current lines against git baseline ref: ${baseRef}`);
    const baselineLines = loadBaselinePatchLines(baseRef);
    if (baselineLines) {
      const missingBaselineLines: STS2PatchLine[] = [];
      for (const oldLine of baselineLines) {
        const resolved = resolveStoryPatchLine(
          { patchLineId: oldLine.id, source: oldLine.patch },
          currentLineMap,
        );
        if (!resolved) {
          missingBaselineLines.push(oldLine);
        }
      }

      if (missingBaselineLines.length > 0) {
        console.error(`\n❌ Found ${missingBaselineLines.length} unresolvable baseline patch line(s):`);
        console.error(`The following IDs existed in "${baseRef}" but can no longer be resolved in the current patch lines:`);

        const suggestedAliases: Record<string, string> = {};
        for (const line of missingBaselineLines) {
          const suggestion = findBestSuggestion(line, currentLines);
          console.error(`  - ${line.id} (patch: ${line.patch})`);
          console.error(`    Text: "${line.textKo || line.markdownKo}"`);
          if (suggestion) {
            console.error(`    Suggested target: ${suggestion.id}`);
            suggestedAliases[line.id] = suggestion.id;
          }
        }

        if (Object.keys(suggestedAliases).length > 0) {
          console.log(`\n💡 Suggested PATCH_LINE_ALIASES to add in src/lib/resolve-story-patch-line.ts:`);
          console.log("--------------------------------------------------");
          for (const [k, v] of Object.entries(suggestedAliases)) {
            console.log(`  "${k}": "${v}",`);
          }
          console.log("--------------------------------------------------");
        }
        hasErrors = true;
      } else {
        console.log(`✅ All ${baselineLines.length} baseline patch lines safely resolve (exact, slug, or alias).`);
      }
    } else {
      console.log(`Notice: Could not load baseline patch lines from ${baseRef}.`);
    }
  } else {
    console.log(`Notice: No git baseline ref found to compare against.`);
  }

  if (hasErrors) {
    console.error(`\n❌ Patch line audit failed. Resolve broken references or register aliases before deploying.`);
    process.exit(1);
  }

  console.log(`\n✅ Patch line audit passed.`);
}

main();
