"use client";

import { useState, useRef, useCallback, useMemo, useEffect, type CSSProperties, type ReactNode } from "react";
import Image from "@/components/ui/static-image";
import Link from "next/link";
import {
  parseBBCode,
  COLOR_CLASSES,
  EFFECT_CLASSES,
} from "@/components/rich-text";
import type { CodexCard, CodexRelic, CodexPotion, CodexPower, CodexEnchantment, CodexEvent, CodexMonster, CodexEncounter, CodexAncient, CodexEpoch } from "@/lib/codex-types";
import { RELIC_RARITY_LABELS, RELIC_RARITY_COLORS, POOL_LABELS, POTION_RARITY_CONFIG, MONSTER_TYPE_CONFIG, ENCOUNTER_ROOM_TYPE_CONFIG, EVENT_ACT_CONFIG, EVENT_ACT_UNKNOWN, getCharacterColor, characterOutlineFilter, type RelicFilterPool } from "@/lib/codex-types";
import type { CodexGameUiLabels } from "@/lib/codex-game-ui";
import {
  localizeHrefWithGameLocale,
  type GameLocale,
  type ServiceLocale,
} from "@/lib/i18n";
import { CardTile } from "@/components/codex/card-tile";
import { DescriptionText } from "@/components/codex/codex-description";
import { GameHoverTip } from "@/components/codex/hover-tip";

// Entity types that can appear in patch notes
export type EntityType = "card" | "relic" | "potion" | "power" | "enchantment" | "event" | "monster" | "encounter" | "ancient" | "epoch";

export interface EntityInfo {
  id: string;
  nameEn: string;
  nameKo: string;
  aliasesEn?: string[];
  aliasesKo?: string[];
  imageUrl: string | null;
  href?: string | null;
  color: string; // card color or pool
  type: EntityType;
  cardData?: CodexCard; // Full card data for rich preview
  relicData?: CodexRelic; // Full relic data for rich preview
  potionData?: CodexPotion; // Full potion data for rich preview
  powerData?: CodexPower; // Full power data for rich preview
  enchantmentData?: CodexEnchantment; // Full enchantment data for rich preview
  eventData?: CodexEvent; // Full event data for rich preview
  eventOptionDesc?: string; // BBCode description for event option tooltips
  monsterData?: CodexMonster; // Full monster data for rich preview
  encounterData?: CodexEncounter; // Full encounter data for rich preview
  ancientData?: CodexAncient; // Full ancient data for rich preview
  epochData?: CodexEpoch; // Full epoch data for rich preview
}

// Keep backward compat alias
export type CardInfo = EntityInfo;

type RenderContext = {
  gameUi?: CodexGameUiLabels;
  serviceLocale?: ServiceLocale;
  gameLocale?: GameLocale;
  preferEntityLocaleLabel?: boolean;
  gameKeywordLabels?: Record<string, string>;
  gameHeadingLabels?: Record<string, string>;
};

// --- Entity Preview (hover card image) ---

const DEFAULT_ENTITY_LINK_CLASS =
  "font-game-title font-semibold spire-gold hover:text-yellow-300 underline decoration-yellow-500/30 underline-offset-2 transition-colors cursor-pointer";

function useCoarsePointer(): boolean {
  const [isCoarsePointer, setIsCoarsePointer] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(hover: none), (pointer: coarse)");
    const update = () => setIsCoarsePointer(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return isCoarsePointer;
}

type PreviewPlacement = {
  vertical: "above" | "below";
  horizontal: "left" | "center" | "right";
};

function estimatePreviewSize(entity: EntityInfo): { width: number; height: number } {
  if (entity.type === "card" && entity.cardData) return { width: 156, height: 230 };
  if (entity.eventData && !entity.eventOptionDesc) return { width: 360, height: 180 };
  if (entity.epochData) return { width: 360, height: 180 };
  if (entity.eventOptionDesc) return { width: 340, height: 180 };
  return { width: 380, height: 240 };
}

function getPreviewPlacement(
  rect: DOMRect,
  entity: EntityInfo,
  forcedVertical?: "above" | "below",
): PreviewPlacement {
  const { width, height } = estimatePreviewSize(entity);
  const margin = 12;
  const centerX = rect.left + rect.width / 2;
  const vertical = forcedVertical ?? (rect.top < height + margin ? "below" : "above");
  const horizontal =
    centerX + width / 2 > window.innerWidth - margin
      ? "right"
      : centerX - width / 2 < margin
        ? "left"
        : "center";
  return { vertical, horizontal };
}

function previewHorizontalClass(horizontal: PreviewPlacement["horizontal"]): string {
  if (horizontal === "left") return "left-0";
  if (horizontal === "right") return "right-0";
  return "left-1/2 -translate-x-1/2";
}

function GameResourcePreview({
  title,
  imageUrl,
  imageAlt,
  imageFrameClassName = "flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-black/20",
  imageClassName = "h-14 w-14 object-contain",
  imageWidth = 64,
  imageHeight = 64,
  imageStyle,
  hoverTipStyle = { minWidth: 240, maxWidth: 320 },
  meta,
  children,
}: {
  title: string;
  imageUrl?: string | null;
  imageAlt: string;
  imageFrameClassName?: string;
  imageClassName?: string;
  imageWidth?: number;
  imageHeight?: number;
  imageStyle?: CSSProperties;
  hoverTipStyle?: CSSProperties;
  meta?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <span className="flex w-max max-w-[25rem] items-start gap-2.5">
      {imageUrl && (
        <span className={imageFrameClassName}>
          <Image
            src={imageUrl}
            alt={imageAlt}
            width={imageWidth}
            height={imageHeight}
            className={imageClassName}
            style={imageStyle}
          />
        </span>
      )}
      <GameHoverTip title={title} style={hoverTipStyle}>
        {meta && (
          <span className="mb-1.5 flex flex-wrap items-center gap-1.5 text-[12px]">
            {meta}
          </span>
        )}
        {children}
      </GameHoverTip>
    </span>
  );
}

export function EntityPreview({
  entity,
  children,
  forceShow,
  forcePosition,
  linkClassName,
  gameUi,
  serviceLocale,
  gameLocale,
  preferEntityLocaleLabel = false,
}: {
  entity: EntityInfo;
  children: ReactNode;
  forceShow?: boolean;
  forcePosition?: "above" | "below";
  /** Override the link's CSS classes — used when embedded inside an already-colored span (e.g. [purple]…[/purple] in a description). */
  linkClassName?: string;
  gameUi?: CodexGameUiLabels;
  serviceLocale?: ServiceLocale;
  gameLocale?: GameLocale;
  preferEntityLocaleLabel?: boolean;
}) {
  const [show, setShow] = useState(false);
  const [previewPressed, setPreviewPressed] = useState(false);
  const [tapPreviewStyle, setTapPreviewStyle] = useState<React.CSSProperties | undefined>();
  const [placement, setPlacement] = useState<PreviewPlacement>({
    vertical: forcePosition ?? "above",
    horizontal: "center",
  });
  const ref = useRef<HTMLSpanElement>(null);
  const isCoarsePointer = useCoarsePointer();
  const useTapPreview = isCoarsePointer && !forceShow;
  const visible = show || forceShow;

  const handleMouseEnter = useCallback(() => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setPlacement(getPreviewPlacement(rect, entity, forcePosition));
    }
    setShow(true);
  }, [entity, forcePosition]);

  const hrefMap: Partial<Record<EntityType, string>> = {
    card: `/compendium/cards?card=${entity.id.toLowerCase()}`,
    relic: `/compendium/relics?relic=${entity.id.toLowerCase()}`,
    potion: `/compendium/potions?potion=${entity.id.toLowerCase()}`,
    power: `/compendium/powers?power=${entity.id.toLowerCase()}`,
    enchantment: `/compendium/enchantments?enchantment=${entity.id.toLowerCase()}`,
    event: `/compendium/events/${entity.id.toLowerCase()}`,
    monster: `/compendium/bestiary?monster=${entity.id.toLowerCase()}`,
    encounter: `/compendium/bestiary?view=encounters&encounter=${entity.id.toLowerCase()}`,
    ancient: `/compendium/ancients/${entity.id.toLowerCase()}`,
    epoch: `/compendium/epochs?epoch=${entity.id.toLowerCase()}`,
  };
  const hrefBase = entity.href === null ? null : entity.href ?? hrefMap[entity.type] ?? null;
  const href = hrefBase && serviceLocale && gameLocale
    ? localizeHrefWithGameLocale(hrefBase, serviceLocale, gameLocale)
    : hrefBase;
  const linkText = preferEntityLocaleLabel ? entity.nameKo : children;
  const renderedLinkText = <span className="font-game-title">{linkText}</span>;

  const openTapPreview = useCallback((event: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>) => {
    if (!useTapPreview) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const { width: estimatedWidth, height: estimatedHeight } = estimatePreviewSize(entity);
    const margin = 12;
    const topSafeArea = 56;
    const x = Math.min(
      Math.max(rect.left + rect.width / 2 - estimatedWidth / 2, margin),
      Math.max(margin, window.innerWidth - estimatedWidth - margin),
    );
    const hasRoomBelow = rect.bottom + margin + estimatedHeight < window.innerHeight;
    const preferredY = hasRoomBelow
      ? rect.bottom + 8
      : rect.top - estimatedHeight - 8;
    const y = Math.min(
      Math.max(preferredY, topSafeArea),
      Math.max(topSafeArea, window.innerHeight - estimatedHeight - margin),
    );

    setPreviewPressed(false);
    setTapPreviewStyle({ left: x, top: y });
    setShow(true);
  }, [entity, useTapPreview]);

  const tooltipPos = forceShow
    ? "relative z-50 mt-1"
    : useTapPreview
      ? "fixed z-[120] pointer-events-auto"
    : `absolute ${previewHorizontalClass(placement.horizontal)} z-50 pointer-events-none ${placement.vertical === "above" ? "bottom-full mb-2" : "top-full mt-2"}`;
  const renderTooltip = (content: ReactNode, variant: "card" | "box" = "box") => (
    <span className={tooltipPos} style={useTapPreview ? tapPreviewStyle : undefined}>
      {useTapPreview ? (
        href ? (
          <Link
            href={href}
            aria-label={`${entity.nameKo} 페이지로 이동`}
            data-pressed={previewPressed}
            onPointerDown={() => setPreviewPressed(true)}
            onPointerLeave={() => setPreviewPressed(false)}
            onPointerCancel={() => setPreviewPressed(false)}
            onPointerUp={() => setPreviewPressed(false)}
            className={
              variant === "card"
                ? "block cursor-pointer outline-none transition-[transform,filter] duration-100 focus-visible:brightness-125 data-[pressed=true]:scale-[0.97] data-[pressed=true]:brightness-125"
                : "block cursor-pointer rounded-lg outline-none ring-1 ring-yellow-400/20 shadow-[0_0_0_1px_rgba(250,204,21,0.14)] transition-[transform,filter,box-shadow] duration-100 focus-visible:ring-2 focus-visible:ring-yellow-400/70 data-[pressed=true]:scale-[0.97] data-[pressed=true]:brightness-125 data-[pressed=true]:ring-yellow-300/70 data-[pressed=true]:shadow-[0_0_0_2px_rgba(250,204,21,0.55),0_18px_45px_rgba(0,0,0,0.45)]"
            }
          >
            {content}
          </Link>
        ) : content
      ) : content}
    </span>
  );

  return (
    <span
      ref={ref}
      className={forceShow ? "inline-block" : "relative inline"}
      onMouseEnter={() => {
        if (!useTapPreview) handleMouseEnter();
      }}
      onMouseLeave={() => {
        if (!useTapPreview) setShow(false);
      }}
    >
      {!forceShow && href && (
        <Link
          href={href}
          className={linkClassName ?? DEFAULT_ENTITY_LINK_CLASS}
          onClick={openTapPreview}
          aria-expanded={useTapPreview ? show : undefined}
        >
          {renderedLinkText}
        </Link>
      )}
      {!forceShow && !href && (
        <span
          role="button"
          tabIndex={0}
          className={linkClassName ?? DEFAULT_ENTITY_LINK_CLASS}
          onClick={openTapPreview}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              openTapPreview(event);
            }
          }}
          aria-expanded={useTapPreview ? show : undefined}
        >
          {renderedLinkText}
        </span>
      )}
      {visible && useTapPreview && (
        <button
          type="button"
          aria-label="미리보기 닫기"
          className="fixed inset-0 z-[110] cursor-default bg-black/35"
          onClick={() => setShow(false)}
        />
      )}
      {visible && entity.type === "card" && entity.cardData && (
        renderTooltip(
          <span className="block w-36 drop-shadow-2xl">
            <CardTile card={entity.cardData} showUpgrade={false} showBeta={false} />
          </span>,
          "card",
        )
      )}
      {visible && entity.type === "relic" && entity.relicData && (
        renderTooltip(
          <GameResourcePreview
            title={entity.nameKo}
            imageUrl={entity.relicData.imageUrl}
            imageAlt={entity.nameKo}
            imageStyle={{
              filter: characterOutlineFilter(entity.relicData.pool) ?? "drop-shadow(0 2px 4px rgba(0,0,0,0.3))",
            }}
            meta={(
              <>
                <span style={{ color: RELIC_RARITY_COLORS[entity.relicData.rarity] }}>
                  {gameUi?.relicCollection.rarities[entity.relicData.rarity].label ?? RELIC_RARITY_LABELS[entity.relicData.rarity]}
                </span>
                {entity.relicData.pool !== "shared" && (
                  <span style={{ color: getCharacterColor(entity.relicData.pool) }}>
                    {POOL_LABELS[entity.relicData.pool as RelicFilterPool]}
                  </span>
                )}
              </>
            )}
          >
            <DescriptionText description={entity.relicData.description} />
          </GameResourcePreview>,
        )
      )}
      {visible && entity.type === "potion" && entity.potionData && (
        renderTooltip(
          <GameResourcePreview
            title={entity.nameKo}
            imageUrl={entity.potionData.imageUrl}
            imageAlt={entity.nameKo}
            imageStyle={{
              filter: characterOutlineFilter(entity.potionData.pool) ?? "drop-shadow(0 2px 4px rgba(0,0,0,0.5))",
            }}
            meta={(
              <>
                <span style={{ color: POTION_RARITY_CONFIG[entity.potionData.rarity].color }}>
                  {gameUi?.potionLab.rarities[entity.potionData.rarity].label ?? POTION_RARITY_CONFIG[entity.potionData.rarity].label}
                </span>
                {entity.potionData.pool !== "shared" && (
                  <span style={{ color: getCharacterColor(entity.potionData.pool) }}>
                    {entity.potionData.pool === "event" ? gameUi?.eventsTitle ?? "이벤트" : POOL_LABELS[entity.potionData.pool as RelicFilterPool]}
                  </span>
                )}
              </>
            )}
          >
            <DescriptionText description={entity.potionData.description} />
          </GameResourcePreview>,
        )
      )}
      {visible && entity.type === "power" && entity.powerData && (
        renderTooltip(
          <GameResourcePreview
            title={entity.nameKo}
            imageUrl={entity.powerData.imageUrl}
            imageAlt={entity.nameKo}
          >
            <DescriptionText description={entity.powerData.description} />
          </GameResourcePreview>,
        )
      )}
      {visible && entity.type === "enchantment" && entity.enchantmentData && (
        renderTooltip(
          <GameHoverTip title={entity.nameKo} style={{ minWidth: 240, maxWidth: 320 }}>
            <DescriptionText description={entity.enchantmentData.description} />
          </GameHoverTip>,
        )
      )}
      {visible && entity.type === "event" && entity.eventData && !entity.eventOptionDesc && (
        renderTooltip(
          <GameResourcePreview
            title={entity.nameKo}
            imageUrl={entity.eventData.imageUrl}
            imageAlt={entity.nameKo}
            imageFrameClassName="flex h-28 w-40 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-black/20"
            imageClassName="h-full w-full rounded-lg object-cover"
            imageWidth={160}
            imageHeight={112}
            hoverTipStyle={{ width: "max-content", maxWidth: 320, whiteSpace: "nowrap" }}
          />,
        )
      )}
      {visible && entity.eventOptionDesc && (
        renderTooltip(
          <GameResourcePreview
            title={entity.nameKo}
            imageUrl={entity.imageUrl}
            imageAlt={entity.nameKo}
          >
            <DescriptionText description={entity.eventOptionDesc} />
          </GameResourcePreview>,
        )
      )}
      {visible && entity.type === "monster" && entity.monsterData && (
        renderTooltip(
          <GameResourcePreview
            title={entity.nameKo}
            imageUrl={entity.monsterData.bossImageUrl ?? entity.monsterData.imageUrl}
            imageAlt={entity.nameKo}
            imageClassName="h-14 w-14 rounded object-cover"
            meta={(
              <>
                <span style={{ color: MONSTER_TYPE_CONFIG[entity.monsterData.type].color }}>
                  {gameUi?.monsterTypes[entity.monsterData.type].label ?? MONSTER_TYPE_CONFIG[entity.monsterData.type].label}
                </span>
                {entity.monsterData.minHp != null && entity.monsterData.minHp !== 9999 && (
                  <span className="text-gray-300">
                    HP {entity.monsterData.maxHp && entity.monsterData.maxHp !== entity.monsterData.minHp
                      ? `${entity.monsterData.minHp}-${entity.monsterData.maxHp}`
                      : entity.monsterData.minHp}
                  </span>
                )}
              </>
            )}
          >
            {entity.monsterData.bestiaryMoves.filter((m) => !["NOTHING", "SPAWNED", "DEAD"].includes(m.id)).slice(0, 4).map((m) => m.name).join(", ")}
          </GameResourcePreview>,
        )
      )}
      {visible && entity.type === "encounter" && entity.encounterData && (
        renderTooltip(
          <GameResourcePreview
            title={entity.nameKo}
            imageUrl={entity.imageUrl}
            imageAlt={entity.nameKo}
            meta={(
              <>
                <span style={{ color: ENCOUNTER_ROOM_TYPE_CONFIG[entity.encounterData.roomType].color }}>
                  {gameUi?.encounterRoomTypes[entity.encounterData.roomType] ?? ENCOUNTER_ROOM_TYPE_CONFIG[entity.encounterData.roomType].label}
                </span>
                {entity.encounterData.act && (
                  <span className={(EVENT_ACT_CONFIG[entity.encounterData.act] ?? EVENT_ACT_UNKNOWN).color}>
                    {gameUi?.acts[entity.encounterData.act] ?? (EVENT_ACT_CONFIG[entity.encounterData.act] ?? EVENT_ACT_UNKNOWN).labelKo}
                  </span>
                )}
                {entity.encounterData.isWeak && <span className="text-green-400">쉬운 전투</span>}
              </>
            )}
          >
            {Array.from(new Map(entity.encounterData.monsters.map((m) => [m.id, m])).values()).map((m) => m.name).join(", ")}
          </GameResourcePreview>,
        )
      )}
      {visible && entity.type === "ancient" && entity.ancientData && (
        renderTooltip(
          <GameResourcePreview
            title={entity.nameKo}
            imageUrl={entity.ancientData.imageUrl}
            imageAlt={entity.nameKo}
            imageClassName="h-14 w-14 rounded object-cover"
            meta={entity.ancientData.act ? (
              <span className={(EVENT_ACT_CONFIG[entity.ancientData.act] ?? EVENT_ACT_UNKNOWN).color}>
                {gameUi?.acts[entity.ancientData.act] ?? (EVENT_ACT_CONFIG[entity.ancientData.act] ?? EVENT_ACT_UNKNOWN).labelKo}
              </span>
            ) : undefined}
          >
            {entity.ancientData.epithet}
          </GameResourcePreview>,
        )
      )}
      {visible && entity.type === "epoch" && entity.epochData && (
        renderTooltip(
          <GameResourcePreview
            title={entity.nameKo}
            imageUrl={entity.epochData.imageUrl}
            imageAlt={entity.nameKo}
            imageFrameClassName="flex h-28 w-40 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-black/20"
            imageClassName="h-full w-full rounded-lg object-cover"
            imageWidth={160}
            imageHeight={112}
            hoverTipStyle={{ width: "max-content", maxWidth: 320, whiteSpace: "nowrap" }}
            meta={entity.epochData.eraName ? (
              <span className="text-blue-300">
                {entity.epochData.eraYear ? `${entity.epochData.eraName} ${entity.epochData.eraYear}` : entity.epochData.eraName}
              </span>
            ) : undefined}
          />,
        )
      )}
      {visible && !entity.cardData && !entity.relicData && !entity.potionData && !entity.powerData && !entity.enchantmentData && !entity.eventData && !entity.eventOptionDesc && !entity.monsterData && !entity.encounterData && !entity.ancientData && !entity.epochData && entity.imageUrl && (
        renderTooltip(
          <GameResourcePreview
            title={entity.nameKo}
            imageUrl={entity.imageUrl}
            imageAlt={entity.nameKo}
            imageClassName="h-14 w-14 rounded object-cover"
          />,
        )
      )}
    </span>
  );
}

function gameKeywordLabel(text: string, context: RenderContext): string | null {
  return context.gameKeywordLabels?.[text.trim().toLowerCase()] ?? null;
}

function labelKey(text: string): string {
  return text
    .replace(/\[\/?[a-z_]+(?:=[^\]]+)?(?::[^\]]+)?\]/gi, "")
    .replace(/\*\*/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function gameHeadingLabel(text: string, context: RenderContext): string {
  return context.gameHeadingLabels?.[labelKey(text)] ?? text;
}

const PATCH_CHANGE_TAG_RE = /\(([^)\n]*(?:\bbuff\b|\bnerf\b)[^)\n]*)\)(?=:)/gi;

function withPatchChangeEffects(markdown: string): string {
  return markdown.replace(PATCH_CHANGE_TAG_RE, (_match, inner: string) => {
    const tagged = inner
      .replace(/\bbuff\b/gi, (value) => `[green][sine]${value}[/sine][/green]`)
      .replace(/\bnerf\b/gi, (value) => `[red][jitter]${value}[/jitter][/red]`);
    return `(${tagged})`;
  });
}

// --- Entity Lookup ---

export interface EntityLookup {
  byKo: Map<string, EntityInfo>;
  byEn: Map<string, EntityInfo>;
  allByKo?: Map<string, EntityInfo[]>;
  allByEn?: Map<string, EntityInfo[]>;
}

function addLookupEntry(
  primary: Map<string, EntityInfo>,
  all: Map<string, EntityInfo[]>,
  value: string,
  entity: EntityInfo,
) {
  const key = value.trim().toLowerCase();
  if (!key) return;

  primary.set(key, entity);
  const matches = all.get(key);
  if (matches) matches.push(entity);
  else all.set(key, [entity]);
}

export function buildEntityLookup(entities: EntityInfo[]): EntityLookup {
  const byKo = new Map<string, EntityInfo>();
  const byEn = new Map<string, EntityInfo>();
  const allByKo = new Map<string, EntityInfo[]>();
  const allByEn = new Map<string, EntityInfo[]>();
  for (const e of entities) {
    addLookupEntry(byKo, allByKo, e.nameKo, e);
    addLookupEntry(byEn, allByEn, e.nameEn, e);
    for (const alias of e.aliasesKo ?? []) addLookupEntry(byKo, allByKo, alias, e);
    for (const alias of e.aliasesEn ?? []) addLookupEntry(byEn, allByEn, alias, e);
  }
  return { byKo, byEn, allByKo, allByEn };
}

export function findEntity(text: string, lookup: EntityLookup, typeHint?: string): EntityInfo | null {
  const lower = text.toLowerCase();
  if (typeHint) {
    // [gold:card], [gold:relic], etc. — filter by entity type
    const koMatch = lookup.byKo.get(lower);
    if (koMatch && koMatch.type === typeHint) return koMatch;
    const enMatch = lookup.byEn.get(lower);
    if (enMatch && enMatch.type === typeHint) return enMatch;
    // Fall back to type-specific lists
    const koAll = lookup.allByKo?.get(lower);
    if (koAll) {
      const match = koAll.find((e) => e.type === typeHint);
      if (match) return match;
    }
    const enAll = lookup.allByEn?.get(lower);
    if (enAll) {
      const match = enAll.find((e) => e.type === typeHint);
      if (match) return match;
    }
    return null;
  }

  const preferDirectEntity = (matches: EntityInfo[] | undefined): EntityInfo | null => {
    if (!matches?.length) return null;
    return matches.find((entity) => entity.type !== "epoch") ?? matches[0];
  };

  return (
    preferDirectEntity(lookup.allByKo?.get(lower)) ??
    preferDirectEntity(lookup.allByEn?.get(lower)) ??
    lookup.byKo.get(lower) ??
    lookup.byEn.get(lower) ??
    null
  );
}

// --- BBCode node types from rich-text.tsx ---

interface TextNode {
  type: "text" | "newline" | "tag";
  text?: string;
  tag?: string;
  param?: string;
  children?: TextNode[];
}

type SineOffset = { current: number };

function renderSineText(text: string, keyPrefix: string, offset: SineOffset): ReactNode[] {
  return Array.from(text).map((char, i) => {
    const index = offset.current++;
    return (
      <span
        key={`${keyPrefix}-sine-${i}`}
        className="rich-sine-letter"
        style={{ "--rich-sine-index": index } as CSSProperties}
      >
        {char}
      </span>
    );
  });
}

// Extract plain text from BBCode node tree
function extractPlainText(nodes: TextNode[]): string {
  let result = "";
  for (const node of nodes) {
    if (node.type === "text" && node.text) result += node.text;
    if (node.type === "tag" && node.children)
      result += extractPlainText(node.children);
  }
  return result;
}

// --- Render BBCode nodes with entity matching ---

function renderBBNodes(
  nodes: TextNode[],
  lookup: EntityLookup,
  prefix: string,
  context: RenderContext,
): ReactNode[] {
  return nodes.map((node, i) => {
    const key = `${prefix}-${i}`;

    if (node.type === "newline") return <br key={key} />;

    if (node.type === "text" && node.text) {
      // Within plain text, handle **bold** markdown patterns
      return renderMarkdownBold(node.text, lookup, key, context);
    }

    if (node.type === "tag" && node.tag && node.children) {
      if (node.tag === "sine") {
        return (
          <span key={key} className="rich-sine">
            {renderSineBBNodes(node.children, lookup, key, context)}
          </span>
        );
      }

      // [gold] tag: check if content matches an entity
      if (node.tag === "gold") {
        const plainText = extractPlainText(node.children);
        const entity = findEntity(plainText, lookup, node.param);

        if (entity) {
          return (
            <EntityPreview key={key} entity={entity} {...context}>
              {plainText}
            </EntityPreview>
          );
        }

        // Not an entity, just gold styling
        const label = gameKeywordLabel(plainText, context);
        return (
          <span key={key} className="font-game-text spire-gold font-semibold">
            {label ?? renderBBNodes(node.children, lookup, key, context)}
          </span>
        );
      }

      // Other tags: apply CSS classes (colors + effects)
      const colorClass = COLOR_CLASSES[node.tag] ?? "";
      const effectClass = EFFECT_CLASSES[node.tag] ?? "";
      const className = [colorClass, effectClass].filter(Boolean).join(" ");

      return (
        <span key={key} className={className || undefined}>
          {renderBBNodes(node.children, lookup, key, context)}
        </span>
      );
    }

    return null;
  });
}

function renderSineBBNodes(
  nodes: TextNode[],
  lookup: EntityLookup,
  prefix: string,
  context: RenderContext,
  offset: SineOffset = { current: 0 },
): ReactNode[] {
  return nodes.map((node, i) => {
    const key = `${prefix}-${i}`;

    if (node.type === "newline") return <br key={key} />;
    if (node.type === "text" && node.text) return renderSineText(node.text, key, offset);

    if (node.type === "tag" && node.tag && node.children) {
      if (node.tag === "sine") {
        return renderSineBBNodes(node.children, lookup, key, context, offset);
      }

      if (node.tag === "gold") {
        const plainText = extractPlainText(node.children);
        const entity = findEntity(plainText, lookup, node.param);

        if (entity) {
          return (
            <EntityPreview key={key} entity={entity} {...context}>
              {renderSineText(plainText, key, offset)}
            </EntityPreview>
          );
        }

        const label = gameKeywordLabel(plainText, context);
        return (
          <span key={key} className="font-game-text spire-gold font-semibold">
            {label ? renderSineText(label, key, offset) : renderSineBBNodes(node.children, lookup, key, context, offset)}
          </span>
        );
      }

      const colorClass = COLOR_CLASSES[node.tag] ?? "";
      const effectClass = EFFECT_CLASSES[node.tag] ?? "";
      const className = [colorClass, effectClass].filter(Boolean).join(" ");

      return (
        <span key={key} className={className || undefined}>
          {renderSineBBNodes(node.children, lookup, key, context, offset)}
        </span>
      );
    }

    return null;
  });
}

// Handle **bold** patterns in plain text segments
function renderMarkdownBold(
  text: string,
  lookup: EntityLookup,
  keyPrefix: string,
  context: RenderContext,
): ReactNode {
  const regex = /\*\*([^*]+)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const parts: ReactNode[] = [];
  let idx = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const boldText = match[1];
    // Handle "X -> Y" renames and "X & Y" pairs
    const names = boldText.split(/\s*(?:->|→|&)\s*/);
    const enriched: ReactNode[] = [];

    for (let j = 0; j < names.length; j++) {
      const name = names[j].trim();
      if (j > 0) {
        const sep =
          boldText.includes("->") || boldText.includes("→") ? " → " : " & ";
        enriched.push(sep);
      }

      const entity = findEntity(name, lookup);
      if (entity) {
        enriched.push(
          <EntityPreview key={`${keyPrefix}-b${idx}-${j}`} entity={entity} {...context}>
            {name}
          </EntityPreview>,
        );
      } else {
        const label = gameKeywordLabel(name, context) ?? name;
        enriched.push(
          <strong
            key={`${keyPrefix}-b${idx}-${j}`}
            className="font-game-text font-semibold spire-gold"
          >
            {label}
          </strong>,
        );
      }
    }

    parts.push(
      <span key={`${keyPrefix}-bold-${idx}`}>{enriched}</span>,
    );
    idx++;
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex === 0) return text; // No bold patterns
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return <span key={keyPrefix}>{parts}</span>;
}

// --- Enrich a line of text (BBCode + markdown bold) ---

function enrichLine(
  text: string,
  lookup: EntityLookup,
  key: string,
  context: RenderContext,
): ReactNode[] {
  const nodes = parseBBCode(text);
  return renderBBNodes(nodes, lookup, key, context);
}

// --- Markdown line rendering ---

function renderLine(
  line: string,
  lookup: EntityLookup,
  key: string,
  context: RenderContext,
): ReactNode {
  const trimmed = line.trimStart();

  // Skip HTML comments (<!-- TODO: ... -->)
  if (trimmed.startsWith("<!--")) return null;

  // Heading levels (check longer prefixes first)
  if (trimmed.startsWith("#### ")) {
    const heading = gameHeadingLabel(trimmed.slice(5), context);
    return (
      <h4 key={key} className="font-game-title text-sm font-semibold mt-4 mb-1 text-yellow-600">
        {enrichLine(heading, lookup, key, context)}
      </h4>
    );
  }
  if (trimmed.startsWith("### ")) {
    const heading = gameHeadingLabel(trimmed.slice(4), context);
    return (
      <h3 key={key} className="font-game-title text-base font-semibold mt-6 mb-2 text-yellow-500">
        {enrichLine(heading, lookup, key, context)}
      </h3>
    );
  }
  if (trimmed.startsWith("## ")) {
    const heading = gameHeadingLabel(trimmed.slice(3), context);
    return (
      <h2
        key={key}
        className="font-game-title text-lg font-bold mt-8 mb-3 text-yellow-400 border-b border-border pb-1"
      >
        {enrichLine(heading, lookup, key, context)}
      </h2>
    );
  }
  if (trimmed.startsWith("# ")) {
    // Skip top-level heading (shown in page header)
    return null;
  }

  // Bullet points. Preserve markdown indentation visually; the renderer keeps a
  // flat list structure, but nested patch-note details should still read as
  // child bullets.
  const bulletMatch = line.match(/^(\s*)-\s+(.*)$/);
  if (bulletMatch) {
    const indentLevel = Math.min(Math.floor(bulletMatch[1].length / 2), 3);
    const bulletClass = indentLevel > 0 ? "list-[circle] text-zinc-500" : "list-disc text-muted-foreground";
    return (
      <li
        key={key}
        className={`text-sm ${bulletClass} mb-1 list-outside`}
        style={{ marginLeft: `${1 + indentLevel * 1.25}rem` }}
      >
        {enrichLine(bulletMatch[2], lookup, key, context)}
      </li>
    );
  }

  // Empty line
  if (trimmed === "") {
    return <div key={key} className="h-2" />;
  }

  // Regular paragraph
  return (
    <p key={key} className="text-sm text-muted-foreground mb-1">
      {enrichLine(trimmed, lookup, key, context)}
    </p>
  );
}

// --- Developer comment block ---

const DEVNOTE_KO_RE = /^\[devnote\](.*)\[\/devnote\]$/;
const DEVNOTE_EN_RE = /^\[devnote:en\](.*)\[\/devnote\]$/;

function DevnoteBlock({
  koContent,
  enContent,
  lookup,
  isItemLevel,
  keyPrefix,
  context,
}: {
  koContent: string;
  enContent: string | null;
  lookup: EntityLookup;
  isItemLevel: boolean;
  keyPrefix: string;
  context: RenderContext;
}) {
  return (
    <div key={keyPrefix} className={isItemLevel ? "ml-6 mt-1 mb-2" : "mt-1 mb-3"}>
      <div className="pl-3 border-l-2 border-zinc-600 text-xs text-zinc-400 leading-relaxed">
        <span className="text-zinc-500 font-medium mr-1.5">Dev</span>
        {enrichLine(koContent, lookup, `${keyPrefix}-ko`, context)}
      </div>
      {enContent && (
        <details className="mt-1">
          <summary className="pl-3 text-[11px] text-zinc-600 cursor-pointer hover:text-zinc-500 transition-colors select-none">
            원문 보기
          </summary>
          <div className="mt-1 pl-3 border-l-2 border-zinc-700/50 text-[11px] text-zinc-600 italic leading-relaxed">
            {enContent}
          </div>
        </details>
      )}
    </div>
  );
}

// --- Main Component ---

export function PatchNoteRenderer({
  markdown,
  entities,
  // Backward compat: accept cards prop
  cards,
  gameUi,
  serviceLocale,
  gameLocale,
  preferEntityLocaleLabel,
  gameKeywordLabels,
  gameHeadingLabels,
}: {
  markdown: string;
  entities?: EntityInfo[];
  cards?: EntityInfo[];
  gameUi?: CodexGameUiLabels;
  serviceLocale?: ServiceLocale;
  gameLocale?: GameLocale;
  preferEntityLocaleLabel?: boolean;
  gameKeywordLabels?: Record<string, string>;
  gameHeadingLabels?: Record<string, string>;
}) {
  const allEntities = useMemo(() => entities ?? cards ?? [], [entities, cards]);
  const lookup = useMemo(() => buildEntityLookup(allEntities), [allEntities]);
  const context = useMemo<RenderContext>(
    () => ({ gameUi, serviceLocale, gameLocale, preferEntityLocaleLabel, gameKeywordLabels, gameHeadingLabels }),
    [gameHeadingLabels, gameKeywordLabels, gameLocale, gameUi, preferEntityLocaleLabel, serviceLocale],
  );
  const lines = withPatchChangeEffects(markdown).split("\n");

  // Group consecutive list items into <ul> containers
  const elements: ReactNode[] = [];
  let listBuffer: ReactNode[] = [];
  let listKey = 0;
  let wasInList = false;

  function flushList() {
    if (listBuffer.length > 0) {
      elements.push(
        <ul key={`ul-${listKey}`} className="mb-2">
          {listBuffer}
        </ul>,
      );
      listBuffer = [];
      listKey++;
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trimStart();

    // Developer comment: [devnote]Korean[/devnote] + optional [devnote:en]English[/devnote]
    const koMatch = trimmed.match(DEVNOTE_KO_RE);
    if (koMatch) {
      const hadList = listBuffer.length > 0;
      flushList();
      const koText = koMatch[1];
      let enText: string | null = null;
      if (i + 1 < lines.length) {
        const nextMatch = lines[i + 1].trimStart().match(DEVNOTE_EN_RE);
        if (nextMatch) {
          enText = nextMatch[1];
          i++;
        }
      }
      elements.push(
        <DevnoteBlock
          key={`devnote-${i}`}
          koContent={koText}
          enContent={enText}
          lookup={lookup}
          isItemLevel={hadList || wasInList}
          keyPrefix={`devnote-${i}`}
          context={context}
        />,
      );
      wasInList = false;
      continue;
    }

    // Skip orphaned [devnote:en] lines
    if (DEVNOTE_EN_RE.test(trimmed)) continue;

    if (/^\s*-\s+/.test(lines[i])) {
      listBuffer.push(renderLine(lines[i], lookup, `line-${i}`, context));
      wasInList = true;
    } else {
      flushList();
      wasInList = false;
      const el = renderLine(lines[i], lookup, `line-${i}`, context);
      if (el) elements.push(el);
    }
  }
  flushList();

  return <div className="patch-note-content">{elements}</div>;
}
