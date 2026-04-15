import type { JSONContent } from "@tiptap/react";
import type { EntityInfo } from "@/components/patch-note-renderer";
import type { PostBlock } from "@/lib/chemical-types";

/**
 * Convert TipTap editor JSON to PostBlock array for storage.
 */
export function tiptapToBlocks(doc: JSONContent): PostBlock[] {
  const blocks: PostBlock[] = [];
  const paragraph = doc.content?.[0];
  if (!paragraph?.content) return blocks;

  for (const node of paragraph.content) {
    if (node.type === "text" && node.text) {
      blocks.push({ type: "text", text: node.text });
    } else if (node.type === "entity-mention") {
      blocks.push({
        type: "entity",
        entityId: node.attrs?.id ?? "",
        entityType: node.attrs?.entityType ?? "card",
        displayText: node.attrs?.label ?? "",
      });
    }
  }
  return blocks;
}

/**
 * Convert PostBlock array to plain text for character counting.
 */
export function blocksToPlainText(blocks: PostBlock[]): string {
  return blocks
    .map((b) => (b.type === "text" ? b.text : b.displayText))
    .join("");
}

/**
 * Search entities by query string (Korean or English name).
 * Returns up to `limit` matches, prioritizing prefix matches over includes.
 */
export function matchEntities(
  query: string,
  entities: EntityInfo[],
  limit = 8,
): EntityInfo[] {
  if (query.length < 2) return [];
  const lower = query.toLowerCase();

  const prefixMatches: EntityInfo[] = [];
  const includesMatches: EntityInfo[] = [];

  for (const e of entities) {
    const ko = e.nameKo.toLowerCase();
    const en = e.nameEn.toLowerCase();
    if (ko.startsWith(lower) || en.startsWith(lower)) {
      prefixMatches.push(e);
    } else if (ko.includes(lower) || en.includes(lower)) {
      includesMatches.push(e);
    }
    if (prefixMatches.length + includesMatches.length >= limit * 2) break;
  }

  return [...prefixMatches, ...includesMatches].slice(0, limit);
}
