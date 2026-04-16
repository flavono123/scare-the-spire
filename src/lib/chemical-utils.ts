import type { JSONContent } from "@tiptap/react";
import { getChoseong } from "es-hangul";
import type { EntityInfo, EntityType } from "@/components/patch-note-renderer";
import type { PostBlock } from "@/lib/chemical-types";

/**
 * Convert TipTap editor JSON to PostBlock array for storage.
 */
export function tiptapToBlocks(doc: JSONContent): PostBlock[] {
  const blocks: PostBlock[] = [];
  if (!doc.content) return blocks;

  for (const paragraph of doc.content) {
    if (!paragraph.content) continue;
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
      } else if (node.type === "custom-keyword") {
        const entityId = node.attrs?.entityId ?? "";
        const entityType = node.attrs?.entityType ?? "";
        blocks.push({
          type: "keyword",
          text: node.attrs?.text ?? "",
          keyword: node.attrs?.keyword ?? "",
          description: node.attrs?.description ?? "",
          entityId: entityId || undefined,
          entityType: (entityType || undefined) as EntityType | undefined,
        });
      }
    }
  }
  return blocks;
}

/**
 * Convert PostBlock array to plain text for character counting.
 */
export function blocksToPlainText(blocks: PostBlock[]): string {
  return blocks
    .map((b) => {
      if (b.type === "text") return b.text;
      if (b.type === "keyword") return b.text;
      return b.displayText;
    })
    .join("");
}

/**
 * Search entities by query string.
 * Supports: Korean name, English name, and Korean choseong (jamo) matching.
 * Triggers from 1 character. Prioritizes prefix > choseong > includes.
 */
export function matchEntities(
  query: string,
  entities: EntityInfo[],
  limit = 8,
): EntityInfo[] {
  if (query.length < 1) return [];
  const lower = query.toLowerCase();
  const isAllJamo = /^[ㄱ-ㅎ]+$/.test(query);

  const prefixMatches: EntityInfo[] = [];
  const choseongMatches: EntityInfo[] = [];
  const includesMatches: EntityInfo[] = [];

  for (const e of entities) {
    const ko = e.nameKo.toLowerCase();
    const en = e.nameEn.toLowerCase();

    if (ko.startsWith(lower) || en.startsWith(lower)) {
      prefixMatches.push(e);
    } else if (isAllJamo && getChoseong(e.nameKo).includes(query)) {
      choseongMatches.push(e);
    } else if (ko.includes(lower) || en.includes(lower)) {
      includesMatches.push(e);
    }

    const total = prefixMatches.length + choseongMatches.length + includesMatches.length;
    if (total >= limit * 2) break;
  }

  return [...prefixMatches, ...choseongMatches, ...includesMatches].slice(0, limit);
}
