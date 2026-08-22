"use client";

import { Fragment, useMemo, useState } from "react";
import type { PostBlock } from "@/lib/chemical-types";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { EntityPreview } from "@/components/patch-note-renderer";
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
            return <KeywordSpan key={i} text={block.text} keyword={block.keyword} description={block.description} />;
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
            <span key={`kw:${kw.keyword || kw.text}`} className="block w-fit rounded-lg shadow-2xl border border-primary/20 bg-[#0c0c20]/95 px-3 py-2">
              <span className="block font-bold text-sm text-primary">{kw.keyword || kw.text}</span>
              <span className="block text-xs text-gray-300 leading-relaxed mt-0.5">{kw.description}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function KeywordSpan({ text, keyword, description }: { text: string; keyword?: string; description: string }) {
  const [hover, setHover] = useState(false);
  const title = keyword || text;
  return (
    <span
      className="relative inline spire-gold font-semibold cursor-help"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {text}
      {hover && description && (
        <span className="absolute top-full left-0 mt-1 w-48 bg-[#0a0a1a] border border-primary/30 rounded px-2.5 py-2 text-left z-[100] pointer-events-none shadow-xl">
          <span className="font-bold text-primary text-xs block">{title}</span>
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
