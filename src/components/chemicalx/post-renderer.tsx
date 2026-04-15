"use client";

import type { ReactNode } from "react";
import type { PostBlock } from "@/lib/chemical-types";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { EntityPreview } from "@/components/patch-note-renderer";

interface PostRendererProps {
  blocks: PostBlock[];
  entityMap: Map<string, EntityInfo>;
  forceShowTooltips?: boolean;
}

export function PostRenderer({ blocks, entityMap, forceShowTooltips }: PostRendererProps) {
  return (
    <span>
      {blocks.map((block, i) => {
        if (block.type === "text") {
          return <span key={i}>{block.text}</span>;
        }

        const key = `${block.entityType}:${block.entityId}`;
        const entity = entityMap.get(key);

        if (entity) {
          return (
            <EntityPreview key={i} entity={entity} forceShow={forceShowTooltips}>
              {block.displayText}
            </EntityPreview>
          );
        }

        // Fallback: gold text without link
        return (
          <span key={i} className="spire-gold font-semibold">
            {block.displayText}
          </span>
        );
      })}
    </span>
  );
}

/**
 * Build a lookup map from EntityInfo array for O(1) access in PostRenderer.
 */
export function buildEntityMap(entities: EntityInfo[]): Map<string, EntityInfo> {
  const map = new Map<string, EntityInfo>();
  for (const e of entities) {
    map.set(`${e.type}:${e.id}`, e);
  }
  return map;
}
