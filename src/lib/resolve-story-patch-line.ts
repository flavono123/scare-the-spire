import type { STS2PatchLine, Story } from "@/lib/types";

export type StoryPatchLineRef = Pick<Story, "patchLineId" | "source" | "entityType" | "entityId">;

function samePatchId(left: string | undefined, right: string | undefined): boolean {
  if (!left || !right) return false;
  return left.replace(/^v/i, "") === right.replace(/^v/i, "");
}

function parsePatchLineId(id: string): { patch: string; ordinal: string; slug: string } | null {
  const match = id.match(/^(.*?):line-(\d+)-(.+)$/);
  if (!match) return null;
  return { patch: match[1], ordinal: match[2], slug: match[3] };
}

export function indexPatchLines(lines: Iterable<STS2PatchLine>): Map<string, STS2PatchLine> {
  return new Map(Array.from(lines, (line) => [line.id, line]));
}

export const PATCH_LINE_ALIASES: Record<string, string> = {
  // v0.100.0 initial abbreviated note was replaced with full Steam patch notes in commit caf38da0.
  // The 'Prepared -> Prepare' rework moved from line-001 (text-qgkkr7) to line-007 (card-prepared).
  "v0.100.0:line-001-text-qgkkr7": "v0.100.0:line-007-card-prepared",
  // v0.113.0 tags fixed the day it shipped: Byrdpip is the relic, The Architect the
  // event encounter, and Bound the affliction (patch pages now load afflictions).
  "v0.113.0:line-017-text-4yuvo5": "v0.113.0:line-017-relic-byrdpip",
  "v0.113.0:line-086-text-yx7z36": "v0.113.0:line-086-encounter-the-architect-event-encounter",
  "v0.113.0:line-121-card-imitation-learning": "v0.113.0:line-121-card-imitation-learning-affliction-bound",
  // 2026-11-26 gold tag fixes (official names and types) renamed these line ids; ssy tags found them.
  "v0.100.0:line-003-card-dominate": "v0.100.0:line-003-card-dominate-power-strength",
  "v0.100.0:line-012-ancient-neow": "v0.100.0:line-012-ancient-neow-relic-hefty-tablet",
  "v0.100.0:line-013-ancient-neow": "v0.100.0:line-013-ancient-neow-relic-neows-talisman",
  "v0.100.0:line-022-card-fight-me": "v0.100.0:line-022-card-fight-me-power-strength",
  "v0.100.0:line-077-text-lra695": "v0.100.0:line-077-power-focus",
  "v0.100.0:line-091-monster-bygone-effigy": "v0.100.0:line-091-monster-bygone-effigy-power-strength",
  "v0.100.0:line-095-text-1e9369d": "v0.100.0:line-094-monster-rocket-ascension-level-08",
  "v0.100.0:line-097-power-crab-rage": "v0.100.0:line-094-monster-rocket-ascension-level-08",
  "v0.100.0:line-099-text-1312j52": "v0.100.0:line-098-monster-crusher-ascension-level-08",
  "v0.100.0:line-101-power-crab-rage": "v0.100.0:line-094-monster-rocket-ascension-level-08",
  "v0.100.0:line-110-ascension-level-09": "v0.100.0:line-109-monster-nibbit-ascension-level-09",
  "v0.100.0:line-159-text-1lvur6l": "v0.100.0:line-159-relic-neows-talisman",
  "v0.100.0:line-160-text-kwmo8r": "v0.100.0:line-160-relic-hefty-tablet",
  "v0.101.0:line-002-text-1ocizr1": "v0.101.0:line-002-text-acd6z1",
  "v0.101.0:line-004-text-11b3jrh": "v0.101.0:line-004-power-strength",
  "v0.101.0:line-005-text-1mvkp1z": "v0.101.0:line-005-text-nsedkh",
  "v0.101.0:line-011-text-l3nnh2": "v0.101.0:line-011-text-1nitq3o",
  "v0.102.0:line-002-text-yr3gr": "v0.102.0:line-002-power-strength",
  "v0.102.0:line-044-text-256iwq": "v0.102.0:line-044-power-strength",
  "v0.103.0:line-002-text-c3wvng": "v0.103.0:line-002-relic-neows-bones",
  "v0.103.0:line-017-text-fbiw1k": "v0.103.0:line-017-power-strength",
  "v0.103.0:line-044-text-14tw3bv": "v0.103.0:line-044-power-strength",
  "v0.103.0:line-064-text-78math": "v0.103.0:line-064-power-smokestack",
  "v0.103.1:line-009-text-1u3x6p5": "v0.103.1:line-009-relic-neows-bones",
  "v0.103.1:line-010-text-frukx2": "v0.103.1:line-010-relic-neows-bones",
  "v0.103.2:line-012-card-arsenal": "v0.103.2:line-012-card-arsenal-power-strength",
  "v0.103.2:line-014-card-borrowed-time": "v0.103.2:line-014-card-borrowed-time-power-doom",
  "v0.103.2:line-025-text-1hkm1qb": "v0.103.2:line-025-relic-neows-bones",
  "v0.104.0:line-089-text-yb65u4": "v0.104.0:line-089-power-strength",
  "v0.105.0:line-020-monster-fossil-stalker": "v0.105.0:line-020-monster-fossil-stalker-power-strength",
  "v0.107.1:line-002-relic-neows-bones": "v0.107.1:line-002-relic-neows-bones-card-debt",
  "v0.107.1:line-078-power-artifact": "v0.107.1:line-078-power-artifact-power-slippery",
  "v0.107.1:line-096-text-1el3e5o": "v0.107.1:line-096-event-fake-merchant",
  "v0.107.1:line-142-text-1d1g6sg": "v0.107.1:line-142-monster-bowlbug-rock",
  "v0.109.0:line-038-text-1n41zm4": "v0.109.0:line-038-card-tutor",
  "v0.111.1:line-171-text-17q4cs1": "v0.111.1:line-171-text-giprv5",
  "v0.111.1:line-222-text-1uyphu6": "v0.111.1:line-222-text-14j6yum",
  "v0.111.1:line-239-text-1mx32ng": "v0.111.1:line-239-text-1hmazm4",
  "v0.114.0:line-104-card-dingy-dagger-event-welcome-to-wongos": "v0.114.0:line-104-card-dingy-dagger-event-reflections",
};

export function resolveCanonicalPatchLineId(id: string | null | undefined): string | undefined {
  if (!id) return undefined;
  return PATCH_LINE_ALIASES[id] ?? id;
}

export function resolveStoryPatchLine(
  story: StoryPatchLineRef,
  patchLineMap: Map<string, STS2PatchLine>,
): STS2PatchLine | undefined {
  if (!story.patchLineId) return undefined;

  const aliasedId = resolveCanonicalPatchLineId(story.patchLineId) ?? story.patchLineId;
  const exact = patchLineMap.get(aliasedId);
  if (exact) return exact;

  const parsed = parsePatchLineId(aliasedId);
  if (parsed) {
    const slugMatches: STS2PatchLine[] = [];
    for (const line of patchLineMap.values()) {
      const candidate = parsePatchLineId(line.id);
      if (!candidate) continue;
      if (candidate.patch === parsed.patch && candidate.slug === parsed.slug) {
        slugMatches.push(line);
      }
    }
    if (slugMatches.length === 1) return slugMatches[0];
  }

  if (!story.source || !story.entityType || !story.entityId) return undefined;
  const entityCandidates = Array.from(patchLineMap.values()).filter((line) =>
    samePatchId(line.patch, story.source)
    && line.entityRefs.some((ref) => ref.type === story.entityType && ref.id === story.entityId),
  );
  return entityCandidates.length === 1 ? entityCandidates[0] : undefined;
}

export function storyMatchesPatchLine(
  story: StoryPatchLineRef,
  patchLine: STS2PatchLine,
  patchLineMap: Map<string, STS2PatchLine>,
): boolean {
  return resolveStoryPatchLine(story, patchLineMap)?.id === patchLine.id;
}

export function countStoriesByPatchLine(
  stories: readonly StoryPatchLineRef[],
  patchLineMap: Map<string, STS2PatchLine>,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const story of stories) {
    const resolved = resolveStoryPatchLine(story, patchLineMap);
    if (!resolved) continue;
    counts.set(resolved.id, (counts.get(resolved.id) ?? 0) + 1);
  }
  return counts;
}
