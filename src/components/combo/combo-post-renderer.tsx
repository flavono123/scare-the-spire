"use client";

import { useMemo, useState } from "react";
import { EntityPreview, type EntityInfo } from "@/components/patch-note-renderer";
import type { PostBlock } from "@/lib/chemical-types";
import {
  buildEntityKeywordIndex,
  resolveEntityKeyword,
} from "@/lib/chemical-utils";
import type { GameLocale, ServiceLocale } from "@/lib/i18n";
import {
  isYouTubeVideoId,
  youtubeWatchUrl,
} from "@/lib/youtube-reference";

interface ComboPostRendererProps {
  blocks: PostBlock[];
  entityMap: Map<string, EntityInfo>;
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
}

export function ComboPostRenderer({
  blocks,
  entityMap,
  serviceLocale,
  gameLocale,
}: ComboPostRendererProps) {
  const keywordEntityIndex = useMemo(
    () => buildEntityKeywordIndex(Array.from(entityMap.values())),
    [entityMap],
  );

  const resolveKeywordBlockEntity = (
    block: Extract<PostBlock, { type: "keyword" }>,
  ): EntityInfo | undefined => {
    if (block.entityId && block.entityType) {
      const entity = entityMap.get(`${block.entityType}:${block.entityId}`);
      if (entity) return entity;
    }
    return resolveEntityKeyword(block.keyword || block.text, keywordEntityIndex);
  };

  return (
    <span>
      {blocks.map((block, index) => {
        if (block.type === "text") {
          return <span key={index}>{block.text}</span>;
        }

        if (block.type === "keyword") {
          const entity = resolveKeywordBlockEntity(block);
          if (entity) {
            return (
              <EntityPreview
                key={index}
                entity={entity}
                serviceLocale={serviceLocale}
                gameLocale={gameLocale}
              >
                {block.text}
              </EntityPreview>
            );
          }
          return (
            <KeywordSpan
              key={index}
              text={block.text}
              keyword={block.keyword}
              description={block.description}
            />
          );
        }

        if (block.type === "youtube") {
          if (!isYouTubeVideoId(block.videoId) || !block.title.trim()) return null;
          return (
            <a
              key={index}
              href={youtubeWatchUrl(block.videoId)}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold spire-aqua underline decoration-cyan-300/30 underline-offset-2 transition-colors hover:text-cyan-200 hover:decoration-cyan-200"
            >
              {block.title}
            </a>
          );
        }

        const entity = entityMap.get(`${block.entityType}:${block.entityId}`);
        if (entity) {
          return (
            <EntityPreview
              key={index}
              entity={entity}
              serviceLocale={serviceLocale}
              gameLocale={gameLocale}
            >
              {block.displayText}
            </EntityPreview>
          );
        }

        return (
          <span key={index} className="spire-gold font-semibold">
            {block.displayText}
          </span>
        );
      })}
    </span>
  );
}

function KeywordSpan({
  text,
  keyword,
  description,
}: {
  text: string;
  keyword?: string;
  description: string;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <span
      className="relative inline cursor-help font-semibold spire-gold"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {text}
      {hovered && description && (
        <span className="pointer-events-none absolute left-0 top-full z-[100] mt-1 w-48 rounded border border-yellow-500/30 bg-[#0a0a1a] px-2.5 py-2 text-left shadow-xl">
          <span className="block text-xs font-bold text-yellow-400">{keyword || text}</span>
          <span className="mt-0.5 block text-[11px] font-normal leading-relaxed text-gray-300">
            {description}
          </span>
        </span>
      )}
    </span>
  );
}

export function buildComboEntityMap(entities: EntityInfo[]): Map<string, EntityInfo> {
  const map = new Map<string, EntityInfo>();
  for (const entity of entities) {
    map.set(`${entity.type}:${entity.id}`, entity);
  }
  return map;
}
