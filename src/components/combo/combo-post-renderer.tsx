"use client";

import { useMemo } from "react";
import { EntityPreview, type EntityInfo } from "@/components/patch-note-renderer";
import { KeywordHoverTip } from "@/components/keyword-hover-tip";
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
import { SERVICE_LINK_CLASS } from "@/lib/service-link-classes";

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
            <KeywordHoverTip
              key={index}
              title={block.keyword || block.text}
              description={block.description}
            >
              {block.text}
            </KeywordHoverTip>
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
              className={SERVICE_LINK_CLASS}
            >
              {block.title}
            </a>
          );
        }

        if (block.type === "history-run") return null;

        if (block.type === "cost-token") {
          const text = block.kind === "energy"
            ? "@".repeat(Math.max(1, block.count))
            : "*".repeat(Math.max(1, block.count));
          return <span key={index}>{text}</span>;
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

export function buildComboEntityMap(entities: EntityInfo[]): Map<string, EntityInfo> {
  const map = new Map<string, EntityInfo>();
  for (const entity of entities) {
    map.set(`${entity.type}:${entity.id}`, entity);
  }
  return map;
}
