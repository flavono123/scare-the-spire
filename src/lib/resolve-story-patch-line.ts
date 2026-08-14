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

export function resolveStoryPatchLine(
  story: StoryPatchLineRef,
  patchLineMap: Map<string, STS2PatchLine>,
): STS2PatchLine | undefined {
  if (!story.patchLineId) return undefined;

  const exact = patchLineMap.get(story.patchLineId);
  if (exact) return exact;

  const parsed = parsePatchLineId(story.patchLineId);
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
