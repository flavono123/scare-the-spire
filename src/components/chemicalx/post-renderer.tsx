"use client";

import { Fragment, useMemo } from "react";
import type { PostBlock } from "@/lib/chemical-types";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { EntityPreview } from "@/components/patch-note-renderer";
import { KeywordHoverTip } from "@/components/keyword-hover-tip";
import { GameHoverTip } from "@/components/codex/hover-tip";
import Image from "@/components/ui/static-image";
import {
  buildEntityKeywordIndex,
  resolveEntityKeyword,
} from "@/lib/chemical-utils";
import type { GameLocale, ServiceLocale } from "@/lib/i18n";
import { resolveSts2EnergyIcon } from "@/lib/sts2-energy-icons";
import {
  isYouTubeVideoId,
  youtubeWatchUrl,
} from "@/lib/youtube-reference";
import { historyRunPlainText } from "@/lib/history-run-reference";
import { HistoryRunFloorChip } from "@/components/history-course/history-run-floor-chip";
import type { HistoryRunFloorBlock } from "@/lib/chemical-types";
import { SERVICE_LINK_CLASS } from "@/lib/service-link-classes";

const STAR_ICON_SRC = "/images/game-assets/card-misc/star_icon.png";

interface PostRendererProps {
  blocks: PostBlock[];
  entityMap: Map<string, EntityInfo>;
  forceShowTooltips?: boolean;
  serviceLocale?: ServiceLocale;
  gameLocale?: GameLocale;
  /** Energy orb art for in-description cost tokens. Defaults to colorless. */
  energyIconSrc?: string;
  onHistoryFloorClick?: (block: HistoryRunFloorBlock) => void;
}

function CostTokenIcons({
  kind,
  count,
  energyIconSrc,
}: {
  kind: "energy" | "star";
  count: number;
  energyIconSrc: string;
}) {
  const safeCount = Math.max(1, Math.floor(count) || 1);
  const src = kind === "star" ? STAR_ICON_SRC : energyIconSrc;
  const alt = kind === "star" ? "star" : "energy";

  return (
    <span className="inline-flex items-baseline gap-0 align-text-bottom">
      {Array.from({ length: safeCount }, (_, index) => (
        <Image
          key={index}
          src={src}
          alt={alt}
          width={14}
          height={14}
          className="mx-[0.05em] inline-block align-text-bottom"
          style={{ width: "1em", height: "1em" }}
        />
      ))}
    </span>
  );
}

export function PostRenderer({
  blocks,
  entityMap,
  forceShowTooltips,
  serviceLocale,
  gameLocale,
  energyIconSrc = resolveSts2EnergyIcon("colorless"),
  onHistoryFloorClick,
}: PostRendererProps) {
  const keywordEntityIndex = useMemo(
    () => buildEntityKeywordIndex(Array.from(entityMap.values())),
    [entityMap],
  );

  const resolveKeywordBlockEntity = (block: Extract<PostBlock, { type: "keyword" }>): EntityInfo | undefined => {
    if (block.entityId && block.entityType) {
      const entity = entityMap.get(`${block.entityType}:${block.entityId}`);
      if (entity) return entity;
    }

    return resolveEntityKeyword(block.keyword || block.text, keywordEntityIndex);
  };

  // Collect entities + keywords for the expanded preview section
  const expandedEntities: EntityInfo[] = [];
  const expandedKeywords: { text: string; keyword?: string; description: string }[] = [];
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
        const entity = resolveKeywordBlockEntity(block);
        if (entity) {
          const key = `${entity.type}:${entity.id}`;
          if (!seen.has(key)) {
            seen.add(key);
            expandedEntities.push(entity);
          }
          continue;
        }

        const keyName = block.keyword || block.text;
        if (!seen.has(`kw:${keyName}`)) {
          seen.add(`kw:${keyName}`);
          expandedKeywords.push({ text: block.text, keyword: block.keyword, description: block.description });
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
            return (
              <span key={i}>
                {block.text.split("\n").map((line, lineIndex) => (
                  <Fragment key={lineIndex}>
                    {lineIndex > 0 && <br />}
                    {line}
                  </Fragment>
                ))}
              </span>
            );
          }

          if (block.type === "keyword") {
            const entity = resolveKeywordBlockEntity(block);
            if (entity) {
              return (
                <EntityPreview key={i} entity={entity} serviceLocale={serviceLocale} gameLocale={gameLocale}>
                  {block.text}
                </EntityPreview>
              );
            }
            return (
              <KeywordHoverTip
                key={i}
                title={block.keyword || block.text}
                description={block.description}
              >
                {block.text}
              </KeywordHoverTip>
            );
          }

          if (block.type === "cost-token") {
            return (
              <CostTokenIcons
                key={i}
                kind={block.kind}
                count={block.count}
                energyIconSrc={energyIconSrc}
              />
            );
          }

          if (block.type === "youtube") {
            if (!isYouTubeVideoId(block.videoId) || !block.title.trim()) return null;
            return (
              <a
                key={i}
                href={youtubeWatchUrl(block.videoId)}
                target="_blank"
                rel="noopener noreferrer"
                className={SERVICE_LINK_CLASS}
              >
                {block.title}
              </a>
            );
          }

          if (block.type === "history-run") {
            return (
              <span key={i} className="font-semibold text-amber-100">
                {historyRunPlainText(block, serviceLocale)}
              </span>
            );
          }

          if (block.type === "history-run-floor") {
            return (
              <HistoryRunFloorChip
                key={i}
                block={block}
                onClick={onHistoryFloorClick}
              />
            );
          }

          const key = `${block.entityType}:${block.entityId}`;
          const entity = entityMap.get(key);

          if (entity) {
            return (
              <EntityPreview key={i} entity={entity} serviceLocale={serviceLocale} gameLocale={gameLocale}>
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
            <EntityPreview
              key={`${entity.type}:${entity.id}`}
              entity={entity}
              forceShow
              forcePosition="below"
              serviceLocale={serviceLocale}
              gameLocale={gameLocale}
            >
              {entity.nameKo}
            </EntityPreview>
          ))}
          {expandedKeywords.map((kw) => (
            <span key={`kw:${kw.keyword || kw.text}`} className="block w-fit">
              <GameHoverTip title={kw.keyword || kw.text} style={{ minWidth: 200, maxWidth: 280 }}>
                <span className="block text-left">{kw.description}</span>
              </GameHoverTip>
            </span>
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
