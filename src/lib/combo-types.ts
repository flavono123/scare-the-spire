import type { EntityType } from "@/components/patch-note-renderer";
import type { PostBlock } from "@/lib/chemical-types";
import { TOYBOX_FEED_PAGE_SIZE } from "@/lib/toybox-feed-keyset";
import { isYouTubeVideoId } from "@/lib/youtube-reference";
import { isMadScienceCardId, MAD_SCIENCE_CARD_ID } from "@/lib/tinker-time";

/** The content_text CHECK in the rls_hardening migration. */
export const COMBO_TEXT_MAX_BYTES = 65536;

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
  like_count?: number;
  comment_count?: number;
  avatar_id?: string | null;
  avatar_kind?: string | null;
  palette_id?: string | null;
  palette_swapped?: boolean | null;
}

export function comboResourceKey(resource: ComboResourceRef): string {
  return `${resource.type}:${resource.id}`;
}

/** The game element a resource counts as in feed filters: every Mad Science variant is the one card. */
export function comboFilterResource(resource: ComboResourceRef): ComboResourceRef {
  return resource.type === "card" && isMadScienceCardId(resource.id)
    ? { type: "card", id: MAD_SCIENCE_CARD_ID }
    : resource;
}

export function comboFilterKey(resource: ComboResourceRef): string {
  return comboResourceKey(comboFilterResource(resource));
}

export const COMBO_FEED_PAGE_SIZE = TOYBOX_FEED_PAGE_SIZE;

export function comboPostMatchesAnyGameElement(
  post: Pick<ComboPost, "resources">,
  selected: ComboResourceRef[],
): boolean {
  if (selected.length === 0) return true;

  const postKeys = new Set(post.resources.map(comboFilterKey));
  return selected.some((gameElement) => postKeys.has(comboFilterKey(gameElement)));
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
    for (const postResource of post.resources) {
      const resource = comboFilterResource(postResource);
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

export function exceedsComboTextLimit(contentText: string): boolean {
  return new TextEncoder().encode(contentText).length > COMBO_TEXT_MAX_BYTES;
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
