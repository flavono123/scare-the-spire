import type { EntityType } from "@/components/patch-note-renderer";
import type { PostBlock } from "@/lib/chemical-types";
import { isYouTubeVideoId } from "@/lib/youtube-reference";

export interface ComboResourceRef {
  type: EntityType;
  id: string;
}

export interface ComboPost {
  id: string;
  user_id: string;
  nickname: string;
  content: PostBlock[];
  content_text: string;
  resources: ComboResourceRef[];
  env: string;
  created_at: string;
}

export function comboResourceKey(resource: ComboResourceRef): string {
  return `${resource.type}:${resource.id}`;
}

export const COMBO_FEED_PAGE_SIZE = 20;

export interface ComboFeedCursor {
  createdAt: string;
  id: string;
}

/** PostgREST `.or()` filter for (created_at, id) keyset, newest-first. */
export function buildComboFeedKeysetFilter(cursor: ComboFeedCursor): string {
  const createdAt = cursor.createdAt.replaceAll('"', "");
  const id = cursor.id.replaceAll('"', "");
  return `created_at.lt."${createdAt}",and(created_at.eq."${createdAt}",id.lt."${id}")`;
}

export function comboPostMatchesAnyGameElement(
  post: Pick<ComboPost, "resources">,
  selected: ComboResourceRef[],
): boolean {
  if (selected.length === 0) return true;

  const postKeys = new Set(post.resources.map(comboResourceKey));
  return selected.some((gameElement) => postKeys.has(comboResourceKey(gameElement)));
}

export interface RankedComboResourceRef {
  resource: ComboResourceRef;
  count: number;
}

/** Rank game elements by how many loaded posts reference them (desc). */
export function rankPopularComboResources(
  posts: Array<Pick<ComboPost, "resources">>,
  limit: number,
): RankedComboResourceRef[] {
  if (limit <= 0 || posts.length === 0) return [];

  const counts = new Map<string, RankedComboResourceRef>();
  for (const post of posts) {
    for (const resource of post.resources) {
      const key = comboResourceKey(resource);
      const current = counts.get(key);
      if (current) {
        current.count += 1;
      } else {
        counts.set(key, { resource, count: 1 });
      }
    }
  }

  return [...counts.values()]
    .sort((left, right) => {
      if (left.count !== right.count) return right.count - left.count;
      const byType = left.resource.type.localeCompare(right.resource.type);
      if (byType !== 0) return byType;
      return left.resource.id.localeCompare(right.resource.id);
    })
    .slice(0, limit);
}

export function extractComboResourceRefs(blocks: PostBlock[]): ComboResourceRef[] {
  const resources: ComboResourceRef[] = [];
  const seen = new Set<string>();

  for (const block of blocks) {
    let resource: ComboResourceRef | null = null;
    if (block.type === "entity") {
      resource = { type: block.entityType, id: block.entityId };
    } else if (block.type === "keyword" && block.entityId && block.entityType) {
      resource = { type: block.entityType, id: block.entityId };
    }
    if (!resource) continue;

    const key = comboResourceKey(resource);
    if (seen.has(key)) continue;

    seen.add(key);
    resources.push(resource);
  }

  return resources;
}

export function countComboYouTubeReferences(blocks: PostBlock[]): number {
  return blocks.filter((block) => block.type === "youtube").length;
}

export function extractComboYouTubeReference(
  blocks: PostBlock[],
): Extract<PostBlock, { type: "youtube" }> | null {
  const block = blocks.find((candidate) => (
    candidate.type === "youtube"
    && isYouTubeVideoId(candidate.videoId)
    && candidate.title.trim().length > 0
  ));
  return block?.type === "youtube" ? block : null;
}

export function extractComboHistoryRunReferences(
  blocks: PostBlock[],
): Array<Extract<PostBlock, { type: "history-run" }>> {
  const references: Array<Extract<PostBlock, { type: "history-run" }>> = [];
  const seen = new Set<string>();

  for (const block of blocks) {
    if (block.type !== "history-run") continue;
    const runId = block.runId.trim();
    if (!runId || seen.has(runId)) continue;
    seen.add(runId);
    references.push(block);
  }

  return references;
}
