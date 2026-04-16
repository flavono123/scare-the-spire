"use client";

import { useState } from "react";
import type { PostBlock } from "@/lib/chemical-types";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { EntityPreview } from "@/components/patch-note-renderer";

interface PostRendererProps {
  blocks: PostBlock[];
  entityMap: Map<string, EntityInfo>;
  forceShowTooltips?: boolean;
}

export function PostRenderer({ blocks, entityMap, forceShowTooltips }: PostRendererProps) {
  // Collect entities + keywords for the expanded preview section
  const expandedEntities: EntityInfo[] = [];
  const expandedKeywords: { text: string; description: string }[] = [];
  if (forceShowTooltips) {
    const seen = new Set<string>();
    for (const block of blocks) {
      if (block.type === "entity") {
        const key = `${block.entityType}:${block.entityId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const entity = entityMap.get(key);
        if (entity) expandedEntities.push(entity);
      } else if (block.type === "keyword") {
        if (!seen.has(`kw:${block.text}`)) {
          seen.add(`kw:${block.text}`);
          expandedKeywords.push({ text: block.text, description: block.description });
        }
      }
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

          if (block.type === "keyword") {
            return <KeywordSpan key={i} text={block.text} description={block.description} />;
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
      {forceShowTooltips && (expandedEntities.length > 0 || expandedKeywords.length > 0) && (
        <div className="flex flex-wrap gap-2 mt-3">
          {expandedEntities.map((entity) => (
            <EntityPreview key={`${entity.type}:${entity.id}`} entity={entity} forceShow forcePosition="below">
              {entity.nameKo}
            </EntityPreview>
          ))}
          {expandedKeywords.map((kw) => (
            <span key={`kw:${kw.text}`} className="block w-fit rounded-lg shadow-2xl border border-yellow-500/20 bg-[#0c0c20]/95 px-3 py-2">
              <span className="block font-bold text-sm text-yellow-400">{kw.text}</span>
              <span className="block text-xs text-gray-300 leading-relaxed mt-0.5">{kw.description}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function KeywordSpan({ text, description }: { text: string; description: string }) {
  const [hover, setHover] = useState(false);
  return (
    <span
      className="relative inline spire-gold font-semibold cursor-help"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {text}
      {hover && description && (
        <span className="absolute top-full left-0 mt-1 w-fit max-w-48 bg-[#0a0a1a] border border-yellow-500/30 rounded px-2.5 py-2 text-left z-[100] pointer-events-none shadow-xl">
          <span className="font-bold text-yellow-400 text-xs block">{text}</span>
          <span className="text-[11px] text-gray-300 font-normal leading-relaxed block mt-0.5">{description}</span>
        </span>
      )}
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
