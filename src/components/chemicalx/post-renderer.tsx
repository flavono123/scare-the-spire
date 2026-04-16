"use client";

import type { PostBlock } from "@/lib/chemical-types";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { EntityPreview } from "@/components/patch-note-renderer";

interface PostRendererProps {
  blocks: PostBlock[];
  entityMap: Map<string, EntityInfo>;
  forceShowTooltips?: boolean;
}

export function PostRenderer({ blocks, entityMap, forceShowTooltips }: PostRendererProps) {
  // Collect unique entities for the expanded preview section
  const expandedEntities: EntityInfo[] = [];
  if (forceShowTooltips) {
    const seen = new Set<string>();
    for (const block of blocks) {
      if (block.type !== "entity") continue;
      const key = `${block.entityType}:${block.entityId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const entity = entityMap.get(key);
      if (entity) expandedEntities.push(entity);
    }
  }

  return (
    <div>
      {/* Inline text — always one line, hover tooltips only */}
      <span>
        {blocks.map((block, i) => {
          if (block.type === "text") {
            return <span key={i}>{block.text}</span>;
          }

          const key = `${block.entityType}:${block.entityId}`;
          const entity = entityMap.get(key);

          if (entity) {
            return (
              <EntityPreview key={i} entity={entity}>
                {block.displayText}
              </EntityPreview>
            );
          }

          return (
            <span key={i} className="spire-gold font-semibold">
              {block.displayText}
            </span>
          );
        })}
      </span>

      {/* Expanded tooltip cards below the text — block layout, border grows naturally */}
      {forceShowTooltips && expandedEntities.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {expandedEntities.map((entity) => (
            <EntityPreview key={`${entity.type}:${entity.id}`} entity={entity} forceShow forcePosition="below">
              {entity.nameKo}
            </EntityPreview>
          ))}
        </div>
      )}
    </div>
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
