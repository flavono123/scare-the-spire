"use client";

import { useState, useRef, useCallback, useMemo, useEffect, type CSSProperties, type ReactNode } from "react";
import Image from "@/components/ui/static-image";
import Link from "next/link";
import {
  parseBBCode,
  COLOR_CLASSES,
  EFFECT_CLASSES,
} from "@/components/rich-text";
import type { CodexCard, CodexKeyword, CodexCharacter, CodexRelic, CodexPotion, CodexPower, CodexEnchantment, CodexAffliction, CodexEvent, CodexMonster, CodexEncounter, CodexAncient, CodexEpoch, CodexModifier, CodexAscension, DamageValue, MonsterMove } from "@/lib/codex-types";
import { RELIC_RARITY_LABELS, POOL_LABELS, POTION_RARITY_CONFIG, MONSTER_TYPE_CONFIG, ENCOUNTER_ROOM_TYPE_CONFIG, EVENT_ACT_CONFIG, EVENT_ACT_UNKNOWN, getCharacterColor, type RelicFilterPool } from "@/lib/codex-types";
import type { CodexGameUiLabels } from "@/lib/codex-game-ui";
import { buildCompendiumResourceHref } from "@/lib/compendium-resource-links";
import { AUTO_LINK_ENTITY_TYPES, buildAutoLinkKeywordsByFirst, wrapNumberedAscensionMentions, wrapUntaggedEntityNames, type AutoLinkKeyword } from "@/lib/auto-link-entity-names";
import {
  localizeHrefWithGameLocale,
  type GameLocale,
  type ServiceLocale,
} from "@/lib/i18n";
import { patchLineAnchorId } from "@/lib/patch-line-links";
import { classNameForHref, RESOURCE_LINK_CLASS } from "@/lib/service-link-classes";
import { patchLineSummaryMarkdownForService, withPatchChangeEffects } from "@/lib/patch-line-display";
import { reconstructEntityAtVersion } from "@/lib/entity-versioning";
import type { EntityVersionDiff, STS2Patch, STS2PatchLine } from "@/lib/types";
import { CardTile } from "@/components/codex/card-tile";
import {
  CardSideTipsAnchor,
  HoverTipStack,
  PortaledHoverTipLayer,
} from "@/components/codex/card-keyword-tip-stack";
import {
  useCardSideTipCatalog,
  useCardSideTipResourceMaps,
} from "@/components/codex/card-side-tip-catalog-context";
import {
  DescriptionText,
  getCardMaxUpgradeLevel,
  renderCardDescription,
  type EnchantVarMod,
} from "@/components/codex/codex-description";
import { collectCardSideTips } from "@/lib/card-keyword-tips";
import { collectPotionSideTips } from "@/lib/potion-side-tips";
import { collectRelicSideTips } from "@/lib/relic-side-tips";
import { RELIC_INSPECT_HOVER_SIZE } from "@/lib/relic-inspect-assets";
import { RelicInspectPreview } from "@/components/codex/relic-inspect-preview";
import { GameHoverTip, type HoverTipArt, type HoverTipArtMode } from "@/components/codex/hover-tip";
import {
  buildMonsterMoveVisual,
  hasMonsterAnimationPatchDiff,
  MonsterAnimationPatchDiffBlock,
  MonsterMoveHoverPreview,
} from "@/components/codex/monster-move-visuals";
import { CharacterLowHpHoverPreview, CharacterLowHpIdleBlock } from "@/components/codex/character-low-hp-idle-block";
import { characterHasLowHealthIdle, withCharacterLowHpQuery } from "@/components/codex/character-spine-stage";
import { applyPowerAmountForPreview } from "@/components/codex/power-preview";
import { AscensionToken } from "@/components/codex/ascension-token";
import { ModifierToken } from "@/components/codex/modifier-token";
import {
  expandEncounterFormations,
  formatEncounterProbability,
} from "@/lib/encounter-compositions";

// Entity types that can appear in patch notes
export type EntityType = "card" | "character" | "keyword" | "relic" | "potion" | "power" | "enchantment" | "affliction" | "event" | "monster" | "monsterMove" | "encounter" | "ancient" | "epoch" | "modifier" | "ascension";

export interface EntityInfo {
  id: string;
  nameEn: string;
  nameKo: string;
  aliasesEn?: string[];
  aliasesKo?: string[];
  imageUrl: string | null;
  href?: string | null;
  availability?: "available" | "pending-compendium";
  compendiumResourceId?: string;
  color: string; // card color or pool
  type: EntityType;
  cardPreviewUpgradeLevel?: number; // Patch-note token explicitly refers to an upgraded card, e.g. Largesse+.
  /** History Course / in-run copy: enchantment painted onto the hover CardTile. */
  cardPreviewEnchantment?: {
    enchantmentImageUrl: string | null;
    enchantmentLabel: string | null;
    enchantmentAmount: number | null;
    forcedCost: number | null;
    enchantAddedKeywords: string[];
    enchantRemovedKeywords: string[];
    descriptionSuffix: string | null;
    enchantStatMod: EnchantVarMod | null;
  } | null;
  cardData?: CodexCard; // Full card data for rich preview
  characterData?: CodexCharacter; // Full character data for rich preview
  keywordData?: CodexKeyword; // Card keyword or static hover-tip concept preview data
  relicData?: CodexRelic; // Full relic data for rich preview
  potionData?: CodexPotion; // Full potion data for rich preview
  powerData?: CodexPower; // Full power data for rich preview
  powerAmount?: DamageValue | null; // Contextual amount used by monster power applications.
  powerAmountAscensionLevel?: number;
  powerAmountAscensionThreshold?: number;
  powerDescriptionVars?: Record<string, number | string>;
  enchantmentData?: CodexEnchantment; // Full enchantment data for rich preview
  afflictionData?: CodexAffliction; // Full affliction data for rich preview
  eventData?: CodexEvent; // Full event data for rich preview
  eventOptionDesc?: string; // BBCode description for event option tooltips
  monsterData?: CodexMonster; // Full monster data for rich preview
  monsterMoveData?: MonsterMove; // Monster move keyword preview data
  monsterMoveMonsterData?: CodexMonster; // Parent monster for move preview/linking
  monsterMoveDamageValue?: DamageValue | null; // Historical move values for removed moves
  monsterMoveBlockValue?: DamageValue | null; // Historical move block for removed moves
  encounterData?: CodexEncounter; // Full encounter data for rich preview
  ancientData?: CodexAncient; // Full ancient data for rich preview
  epochData?: CodexEpoch; // Full epoch data for rich preview
  modifierData?: CodexModifier;
  ascensionData?: CodexAscension;
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
  preferredMonsterIds?: string[];
  patchVersion?: string;
  currentVersion?: string;
  patches?: STS2Patch[];
  versionDiffs?: EntityVersionDiff[];
  epochArtMode?: HoverTipArtMode;
  staticHoverPreviews?: boolean;
  autoLinkEntities?: boolean;
};

// --- Entity Preview (hover card image) ---

const DEFAULT_ENTITY_LINK_CLASS = RESOURCE_LINK_CLASS;
const GAME_INSPECT_CURSOR_CLASS = "game-inspect-cursor";

function withGameInspectCursor(className: string): string {
  return [className, GAME_INSPECT_CURSOR_CLASS].filter(Boolean).join(" ");
}

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
  if (entity.type === "character" && entity.characterData) {
    return characterHasLowHealthIdle(entity.characterData)
      ? { width: 220, height: 280 }
      : { width: 380, height: 220 };
  }
  if (entity.type === "keyword" && entity.keywordData) return { width: 320, height: 140 };
  if (entity.type === "modifier" && entity.modifierData) return { width: 420, height: 160 };
  if (entity.type === "ascension" && entity.ascensionData) return { width: 420, height: 160 };
  if (entity.type === "relic" && entity.relicData) {
    return {
      width: RELIC_INSPECT_HOVER_SIZE.width + 280,
      height: RELIC_INSPECT_HOVER_SIZE.height,
    };
  }
  if (entity.type === "monsterMove") return { width: 280, height: 260 };
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

function staticPreviewDesktopClass(placement: PreviewPlacement): string {
  const horizontal =
    placement.horizontal === "left"
      ? "sm:left-0 sm:right-auto sm:translate-x-0"
      : placement.horizontal === "right"
        ? "sm:left-auto sm:right-0 sm:translate-x-0"
        : "sm:left-1/2 sm:right-auto sm:-translate-x-1/2";
  const vertical = placement.vertical === "above"
    ? "sm:bottom-full sm:top-auto sm:mb-2"
    : "sm:top-full sm:bottom-auto sm:mt-2";

  return `sm:absolute ${horizontal} ${vertical}`;
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
  hoverTipArt,
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
  hoverTipArt?: HoverTipArt;
  meta?: ReactNode;
  children?: ReactNode;
}) {
  const showImageFrame = Boolean(imageUrl) && !hoverTipArt;

  return (
    <span className="flex w-max max-w-[calc(100vw-1.5rem)] items-start gap-2.5 sm:max-w-[25rem]">
      {showImageFrame && (
        <span className={imageFrameClassName}>
          <Image
            src={imageUrl!}
            alt={imageAlt}
            width={imageWidth}
            height={imageHeight}
            className={imageClassName}
            style={imageStyle}
          />
        </span>
      )}
      <GameHoverTip
        title={title}
        style={hoverTipStyle}
        art={hoverTipArt}
      >
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

function MonsterMoveKeywordPreview({
  entity,
  serviceLocale,
  previewNonce,
}: {
  entity: EntityInfo;
  serviceLocale: ServiceLocale;
  previewNonce: number;
}) {
  const move = entity.monsterMoveData;
  const monster = entity.monsterMoveMonsterData;
  if (!move || !monster) return null;

  const title = serviceLocale === "ko" ? entity.nameKo : entity.nameEn;
  const visual = buildMonsterMoveVisual(monster, move, {
    damage: entity.monsterMoveDamageValue,
    block: entity.monsterMoveBlockValue,
  });

  return (
    <MonsterMoveHoverPreview
      move={visual}
      monster={monster}
      serviceLocale={serviceLocale}
      selectedMoveNonce={previewNonce}
      title={title}
    />
  );
}

function EntityCardHoverPreview({ entity }: { entity: EntityInfo }) {
  const catalog = useCardSideTipCatalog();
  const card = entity.cardData;
  if (!card) return null;

  const upgradeLevel = entity.cardPreviewUpgradeLevel ?? 0;
  const enchant = entity.cardPreviewEnchantment;
  const tile = (
    <CardTile
      card={card}
      showUpgrade={Boolean(upgradeLevel)}
      upgradeLevel={upgradeLevel}
      showBeta={false}
      interactive={false}
      enchantmentImageUrl={enchant?.enchantmentImageUrl}
      enchantmentLabel={enchant?.enchantmentLabel}
      enchantmentAmount={enchant?.enchantmentAmount}
      forcedCost={enchant?.forcedCost}
      enchantAddedKeywords={enchant?.enchantAddedKeywords}
      enchantRemovedKeywords={enchant?.enchantRemovedKeywords}
      descriptionSuffix={enchant?.descriptionSuffix}
      enchantStatMod={enchant?.enchantStatMod}
    />
  );

  const tips = catalog
    ? collectCardSideTips(card, catalog, {
        upgradeLevel,
        description: upgradeLevel > 0 || enchant?.enchantStatMod
          ? renderCardDescription(card, {
              upgradeLevel,
              enchantMod: enchant?.enchantStatMod ?? null,
            })
          : card.description,
        addedKeywords: enchant?.enchantAddedKeywords,
        removedKeywords: enchant?.enchantRemovedKeywords,
      })
    : [];

  if (tips.length === 0) {
    return <span className="block w-36 drop-shadow-2xl">{tile}</span>;
  }

  return (
    <CardSideTipsAnchor mode="always" tips={tips} className="block w-36 drop-shadow-2xl">
      {tile}
    </CardSideTipsAnchor>
  );
}

function EntityPotionHoverPreview({
  entity,
  gameUi,
}: {
  entity: EntityInfo;
  gameUi?: CodexGameUiLabels;
}) {
  const catalog = useCardSideTipCatalog();
  const potion = entity.potionData;
  if (!potion) return null;

  const extraTips = catalog
    ? collectPotionSideTips(potion, catalog, { includeSelf: false })
    : [];

  return (
    <PortaledHoverTipLayer>
      <span className="flex w-max items-start gap-2">
        <GameHoverTip
          title={entity.nameKo}
          style={{ minWidth: 240, maxWidth: 320 }}
        >
          <span className="mb-1.5 flex flex-wrap items-center gap-1.5 text-[12px]">
            <span style={{ color: POTION_RARITY_CONFIG[potion.rarity].color }}>
              {gameUi?.potionLab.rarities[potion.rarity].label ?? POTION_RARITY_CONFIG[potion.rarity].label}
            </span>
            {potion.pool !== "shared" && (
              <span style={{ color: getCharacterColor(potion.pool) }}>
                {potion.pool === "event" ? gameUi?.eventsTitle ?? "이벤트" : POOL_LABELS[potion.pool as RelicFilterPool]}
              </span>
            )}
          </span>
          <DescriptionText description={potion.description} />
        </GameHoverTip>
        {extraTips.length > 0 ? <HoverTipStack tips={extraTips} /> : null}
      </span>
    </PortaledHoverTipLayer>
  );
}

function EntityRelicHoverPreview({
  entity,
  gameUi,
  portal = false,
  growUp = false,
}: {
  entity: EntityInfo;
  gameUi?: CodexGameUiLabels;
  portal?: boolean;
  growUp?: boolean;
}) {
  const catalog = useCardSideTipCatalog();
  const { potionsById, enchantmentsById } = useCardSideTipResourceMaps();
  const relic = entity.relicData;
  if (!relic) return null;

  const extraTips = catalog
    ? collectRelicSideTips(relic, catalog, {
        includeSelf: false,
        potionsById,
        enchantmentsById,
      })
    : [];

  const preview = (
    <span
      className="flex w-max max-w-[calc(100vw-1.5rem)] flex-col items-start gap-2 sm:flex-row"
      data-relic-inspect-hover
    >
      <RelicInspectPreview
        relic={relic}
        title={entity.nameKo}
        rarityLabel={gameUi?.relicCollection.rarities[relic.rarity].label ?? RELIC_RARITY_LABELS[relic.rarity]}
        density="hover"
        className="shrink-0 drop-shadow-2xl"
      />
      {extraTips.length > 0 ? <HoverTipStack tips={extraTips} /> : null}
    </span>
  );

  if (!portal) return preview;

  return (
    <PortaledHoverTipLayer pin={growUp ? "bottom-left" : "top-left"}>
      {preview}
    </PortaledHoverTipLayer>
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
  patchVersion,
  currentVersion,
  patches,
  versionDiffs,
  epochArtMode = "official",
  staticHoverPreviews = false,
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
  patchVersion?: string;
  currentVersion?: string;
  patches?: STS2Patch[];
  versionDiffs?: EntityVersionDiff[];
  epochArtMode?: HoverTipArtMode;
  staticHoverPreviews?: boolean;
}) {
  const [show, setShow] = useState(false);
  const [previewPressed, setPreviewPressed] = useState(false);
  const [tapPreviewStyle, setTapPreviewStyle] = useState<React.CSSProperties | undefined>();
  const [previewNonce, setPreviewNonce] = useState(0);
  const [placement, setPlacement] = useState<PreviewPlacement>({
    vertical: forcePosition ?? "above",
    horizontal: "center",
  });
  const ref = useRef<HTMLSpanElement>(null);
  const isCoarsePointer = useCoarsePointer();
  const useTapPreview = isCoarsePointer && !forceShow;
  const visible = show || forceShow;
  const previewEntity = useMemo(
    () => reconstructPatchPreviewEntity(entity, patchVersion, currentVersion, versionDiffs, patches),
    [currentVersion, entity, patchVersion, patches, versionDiffs],
  );
  const isPendingCompendium = previewEntity.availability === "pending-compendium";
  const staticPreview = staticHoverPreviews && !useTapPreview && !forceShow;
  const pendingStaticPreview = (isPendingCompendium || staticPreview) && !useTapPreview && !forceShow;
  const showResolvedPreview = (visible || staticPreview) && !isPendingCompendium;
  const staticCardPreviewKey = staticPreview && previewEntity.type === "card" && previewEntity.cardData
    ? `${previewEntity.id}:${previewEntity.cardPreviewUpgradeLevel ?? 0}`
    : undefined;

  const handleMouseEnter = useCallback(() => {
    setPreviewNonce((value) => value + 1);
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setPlacement(getPreviewPlacement(rect, entity, forcePosition));
    }
    setShow(true);
  }, [entity, forcePosition]);

  const compendiumRouteId = (entity.compendiumResourceId ?? entity.id).toLowerCase();
  const hrefMap: Partial<Record<EntityType, string>> = {
    card: buildCompendiumResourceHref("card", compendiumRouteId),
    character: buildCompendiumResourceHref("character", compendiumRouteId),
    keyword: buildCompendiumResourceHref("keyword", compendiumRouteId),
    relic: buildCompendiumResourceHref("relic", compendiumRouteId),
    potion: buildCompendiumResourceHref("potion", compendiumRouteId),
    power: buildCompendiumResourceHref("power", compendiumRouteId),
    enchantment: buildCompendiumResourceHref("enchantment", compendiumRouteId),
    affliction: buildCompendiumResourceHref("affliction", compendiumRouteId),
    event: buildCompendiumResourceHref("event", compendiumRouteId),
    monster: buildCompendiumResourceHref("monster", compendiumRouteId),
    monsterMove: entity.compendiumResourceId
      ? buildCompendiumResourceHref("monster", compendiumRouteId)
      : entity.monsterMoveMonsterData
      ? buildCompendiumResourceHref("monster", entity.monsterMoveMonsterData.id)
      : undefined,
    encounter: buildCompendiumResourceHref("encounter", compendiumRouteId),
    ancient: buildCompendiumResourceHref("ancient", compendiumRouteId),
    epoch: buildCompendiumResourceHref("epoch", compendiumRouteId),
    modifier: buildCompendiumResourceHref("modifier", compendiumRouteId),
    ascension: buildCompendiumResourceHref("ascension", compendiumRouteId),
  };
  const hrefBase = isPendingCompendium ? null : entity.href === null ? null : entity.href ?? hrefMap[entity.type] ?? null;
  const localizedHref = hrefBase && serviceLocale && gameLocale
    ? localizeHrefWithGameLocale(hrefBase, serviceLocale, gameLocale)
    : hrefBase;
  const href = localizedHref
    && previewEntity.type === "character"
    && previewEntity.characterData
    && characterHasLowHealthIdle(previewEntity.characterData)
    ? withCharacterLowHpQuery(localizedHref)
    : localizedHref;
  const linkText = preferEntityLocaleLabel
    ? `${previewEntity.nameKo}${cardPreviewUpgradeSuffix(previewEntity)}`
    : children;
  const renderedLinkText = (
    <span className="inline-flex max-w-full items-center gap-1.5 font-game-title">
      {linkText}
    </span>
  );
  const baseLinkClassName = isPendingCompendium
    ? [
        linkClassName ?? DEFAULT_ENTITY_LINK_CLASS,
        "text-fuchsia-200 decoration-dotted decoration-fuchsia-300/60 hover:text-fuchsia-100",
      ].join(" ")
    : linkClassName ?? DEFAULT_ENTITY_LINK_CLASS;
  const resolvedLinkClassName = href ? withGameInspectCursor(baseLinkClassName) : baseLinkClassName;

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
    setPreviewNonce((value) => value + 1);
    setTapPreviewStyle({ left: x, top: y });
    setShow(true);
  }, [entity, useTapPreview]);

  const tooltipPos = forceShow
    ? "relative z-50 mt-1"
    : useTapPreview
      ? "fixed z-[120] pointer-events-auto"
      : pendingStaticPreview
        ? [
            "fixed left-3 right-3 top-16 z-50 pointer-events-none opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100",
            staticPreviewDesktopClass(placement),
          ].join(" ")
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
                : "block cursor-pointer rounded-lg outline-none ring-1 ring-primary/20 shadow-[0_0_0_1px_rgba(239,200,81,0.14)] transition-[transform,filter,box-shadow] duration-100 focus-visible:ring-2 focus-visible:ring-primary/70 data-[pressed=true]:scale-[0.97] data-[pressed=true]:brightness-125 data-[pressed=true]:ring-primary/70 data-[pressed=true]:shadow-[0_0_0_2px_rgba(239,200,81,0.55),0_18px_45px_rgba(0,0,0,0.45)]"
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
      className={forceShow ? "inline-block" : pendingStaticPreview ? "group relative inline-flex max-w-full items-center" : "relative inline-flex max-w-full items-center"}
      data-static-card-trigger={staticCardPreviewKey}
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
          className={resolvedLinkClassName}
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
          className={resolvedLinkClassName}
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
      {(visible || pendingStaticPreview) && isPendingCompendium && (
        renderTooltip(
          <GameResourcePreview
            title={previewEntity.nameKo}
            imageUrl={previewEntity.imageUrl}
            imageAlt={previewEntity.nameKo}
            imageClassName="h-14 w-14 rounded object-cover opacity-60 grayscale"
            meta={(
              <span className="rounded border border-fuchsia-400/30 bg-fuchsia-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-fuchsia-200">
                {serviceLocale === "en" ? "Compendium page in progress" : "모음집 준비 중"}
              </span>
            )}
          >
            <span className="text-sm text-zinc-300">
              {serviceLocale === "en"
                ? "This patch note can be published before the Compendium page is ready."
                : "패치노트가 모음집 페이지보다 먼저 배포된 상태입니다."}
            </span>
          </GameResourcePreview>,
        )
      )}
      {showResolvedPreview && previewEntity.type === "card" && previewEntity.cardData && (
        renderTooltip(
          staticHoverPreviews ? (
            <template data-static-card-preview-template={staticCardPreviewKey}>
              <div
                hidden
                data-static-card-preview={staticCardPreviewKey}
                className="w-36 drop-shadow-2xl"
              >
                <CardTile
                  card={previewEntity.cardData}
                  showUpgrade={Boolean(previewEntity.cardPreviewUpgradeLevel)}
                  upgradeLevel={previewEntity.cardPreviewUpgradeLevel}
                  showBeta={false}
                  interactive={false}
                />
              </div>
            </template>
          ) : (
            <EntityCardHoverPreview entity={previewEntity} />
          ),
          "card",
        )
      )}
      {showResolvedPreview && previewEntity.type === "character" && previewEntity.characterData && (
        renderTooltip(
          characterHasLowHealthIdle(previewEntity.characterData) ? (
            <CharacterLowHpHoverPreview
              character={previewEntity.characterData}
              serviceLocale={serviceLocale ?? "ko"}
            />
          ) : (
            <GameResourcePreview
              title={previewEntity.nameKo}
              imageUrl={previewEntity.characterData.selectImageUrl || previewEntity.characterData.imageUrl}
              imageAlt={previewEntity.nameKo}
              imageFrameClassName="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg bg-black/20"
              imageClassName="h-24 w-24 object-contain"
              imageWidth={96}
              imageHeight={96}
            />
          ),
        )
      )}
      {showResolvedPreview && previewEntity.type === "keyword" && previewEntity.keywordData && (
        renderTooltip(
          <GameHoverTip title={previewEntity.nameKo} style={{ minWidth: 240, maxWidth: 320 }}>
            <DescriptionText description={previewEntity.keywordData.description} />
          </GameHoverTip>,
        )
      )}
      {showResolvedPreview && previewEntity.type === "modifier" && previewEntity.modifierData && (
        renderTooltip(
          <div className="flex items-center gap-3">
            <ModifierToken modifier={previewEntity.modifierData} size={64} />
            <GameHoverTip title={previewEntity.nameKo} style={{ minWidth: 240, maxWidth: 320 }}>
              <DescriptionText description={previewEntity.modifierData.description} />
            </GameHoverTip>
          </div>,
        )
      )}
      {showResolvedPreview && previewEntity.type === "ascension" && previewEntity.ascensionData && (
        renderTooltip(
          <div className="flex items-center gap-3">
            <AscensionToken level={previewEntity.ascensionData.level} size={64} />
            <GameHoverTip title={previewEntity.nameKo} style={{ minWidth: 240, maxWidth: 320 }}>
              <DescriptionText description={previewEntity.ascensionData.description} />
            </GameHoverTip>
          </div>,
        )
      )}
      {showResolvedPreview && previewEntity.type === "relic" && previewEntity.relicData && (
        renderTooltip(
          <EntityRelicHoverPreview
            entity={previewEntity}
            gameUi={gameUi}
            portal={!staticHoverPreviews && !useTapPreview && !forceShow}
            growUp={placement.vertical === "above"}
          />,
        )
      )}
      {showResolvedPreview && previewEntity.type === "potion" && previewEntity.potionData && (
        renderTooltip(
          <EntityPotionHoverPreview entity={previewEntity} gameUi={gameUi} />,
        )
      )}
      {showResolvedPreview && previewEntity.type === "power" && previewEntity.powerData && (
        renderTooltip(
          <GameResourcePreview
            title={previewEntity.nameKo}
            imageUrl={previewEntity.powerData.imageUrl}
            imageAlt={previewEntity.nameKo}
            imageClassName={`h-14 w-14 object-contain${previewEntity.powerData.deprecated ? " opacity-50 grayscale saturate-0" : ""}`}
          >
            <DescriptionText description={previewEntity.powerData.description} />
          </GameResourcePreview>,
        )
      )}
      {showResolvedPreview && previewEntity.type === "enchantment" && previewEntity.enchantmentData && (
        renderTooltip(
          <GameHoverTip title={previewEntity.nameKo} style={{ minWidth: 240, maxWidth: 320 }}>
            <DescriptionText description={previewEntity.enchantmentData.description} />
          </GameHoverTip>,
        )
      )}
      {showResolvedPreview && previewEntity.type === "affliction" && previewEntity.afflictionData && (
        renderTooltip(
          <GameHoverTip title={previewEntity.nameKo} style={{ minWidth: 240, maxWidth: 320 }}>
            <DescriptionText description={previewEntity.afflictionData.description} />
          </GameHoverTip>,
        )
      )}
      {showResolvedPreview && previewEntity.type === "event" && previewEntity.eventData && !previewEntity.eventOptionDesc && (
        renderTooltip(
          <GameResourcePreview
            title={previewEntity.nameKo}
            imageUrl={previewEntity.eventData.imageUrl}
            imageAlt={previewEntity.nameKo}
            imageFrameClassName="flex h-28 w-40 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-black/20"
            imageClassName="h-full w-full rounded-lg object-cover"
            imageWidth={160}
            imageHeight={112}
            hoverTipStyle={{ width: "max-content", maxWidth: 320, whiteSpace: "nowrap" }}
          />,
        )
      )}
      {showResolvedPreview && previewEntity.eventOptionDesc && (
        renderTooltip(
          <GameResourcePreview
            title={previewEntity.nameKo}
            imageUrl={previewEntity.imageUrl}
            imageAlt={previewEntity.nameKo}
          >
            <DescriptionText description={previewEntity.eventOptionDesc} />
          </GameResourcePreview>,
        )
      )}
      {showResolvedPreview && entity.type === "monster" && entity.monsterData && (
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
      {showResolvedPreview && entity.type === "monsterMove" && entity.monsterMoveData && entity.monsterMoveMonsterData && (
        renderTooltip(
          <MonsterMoveKeywordPreview
            entity={entity}
            serviceLocale={serviceLocale ?? "ko"}
            previewNonce={previewNonce}
          />,
        )
      )}
      {showResolvedPreview && entity.type === "encounter" && entity.encounterData && (
        renderTooltip(
          <GameResourcePreview
            title={entity.nameKo}
            imageUrl={entity.encounterData.scene?.backgroundUrl ?? entity.imageUrl}
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
            <div className="space-y-1">
              {expandEncounterFormations(entity.encounterData).map((formation) => (
                <div key={formation.id} className="flex items-start justify-between gap-3 text-xs">
                  <span>{formation.monsters.map((monster) => monster.name).join(" + ")}</span>
                  <span className="shrink-0 text-amber-300/90">
                    {formatEncounterProbability(
                      formation.probability,
                      serviceLocale === "en" ? "en-US" : "ko-KR",
                    )}
                  </span>
                </div>
              ))}
            </div>
          </GameResourcePreview>,
        )
      )}
      {showResolvedPreview && entity.type === "ancient" && entity.ancientData && (
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
      {showResolvedPreview && entity.type === "epoch" && entity.epochData && (
        renderTooltip(
          <GameResourcePreview
            title={entity.nameKo}
            imageUrl={entity.epochData.imageUrl}
            imageAlt={entity.nameKo}
            hoverTipStyle={{ width: "max-content", maxWidth: 360, whiteSpace: "nowrap" }}
            hoverTipArt={{
              mode: epochArtMode,
              imageUrl: entity.epochData.imageUrl,
              betaImageUrl: entity.epochData.betaImageUrl,
              alt: entity.nameKo,
              betaAlt: `${entity.nameKo} 베타 아트`,
              width: 320,
              height: 224,
              className: "h-auto w-80 rounded object-cover",
            }}
            meta={entity.epochData.eraName ? (
              <span className="text-blue-300">
                {entity.epochData.eraYear ? `${entity.epochData.eraName} ${entity.epochData.eraYear}` : entity.epochData.eraName}
              </span>
            ) : undefined}
          />,
        )
      )}
      {showResolvedPreview && !entity.cardData && !entity.characterData && !entity.keywordData && !entity.relicData && !entity.potionData && !entity.powerData && !entity.enchantmentData && !entity.afflictionData && !entity.eventData && !entity.eventOptionDesc && !entity.monsterData && !entity.monsterMoveData && !entity.encounterData && !entity.ancientData && !entity.epochData && !entity.modifierData && !entity.ascensionData && entity.imageUrl && (
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

function reconstructPatchPreviewEntity(
  entity: EntityInfo,
  patchVersion?: string,
  currentVersion?: string,
  versionDiffs?: EntityVersionDiff[],
  patches?: STS2Patch[],
): EntityInfo {
  if (!patchVersion || !currentVersion || !versionDiffs?.length || !patches?.length) {
    return applyPreviewEntityContext(entity);
  }

  switch (entity.type) {
    case "card": {
      if (!entity.cardData) return entity;
      const card = reconstructEntityAtVersion(entity.cardData, "card", patchVersion, currentVersion, versionDiffs, patches);
      return { ...entity, nameKo: card.name, nameEn: card.nameEn, imageUrl: card.imageUrl ?? card.betaImageUrl, color: card.color, cardData: card };
    }
    case "relic": {
      if (!entity.relicData) return entity;
      const relic = reconstructEntityAtVersion(entity.relicData, "relic", patchVersion, currentVersion, versionDiffs, patches);
      return { ...entity, nameKo: relic.name, nameEn: relic.nameEn, imageUrl: relic.imageUrl, color: relic.pool, relicData: relic };
    }
    case "potion": {
      if (!entity.potionData) return entity;
      const potion = reconstructEntityAtVersion(entity.potionData, "potion", patchVersion, currentVersion, versionDiffs, patches);
      return { ...entity, nameKo: potion.name, nameEn: potion.nameEn, imageUrl: potion.imageUrl, color: potion.pool, potionData: potion };
    }
    case "power": {
      if (!entity.powerData) return entity;
      const power = reconstructEntityAtVersion(entity.powerData, "power", patchVersion, currentVersion, versionDiffs, patches);
      return applyPreviewEntityContext({ ...entity, nameKo: power.name, nameEn: power.nameEn, imageUrl: power.imageUrl, color: power.type, powerData: power });
    }
    case "enchantment": {
      if (!entity.enchantmentData) return entity;
      const enchantment = reconstructEntityAtVersion(entity.enchantmentData, "enchantment", patchVersion, currentVersion, versionDiffs, patches);
      return {
        ...entity,
        nameKo: enchantment.name,
        nameEn: enchantment.nameEn,
        imageUrl: enchantment.imageUrl,
        color: enchantment.cardType ?? "Any",
        enchantmentData: enchantment,
      };
    }
    case "event": {
      if (!entity.eventData || entity.eventOptionDesc) return entity;
      const event = reconstructEntityAtVersion(entity.eventData, "event", patchVersion, currentVersion, versionDiffs, patches);
      return { ...entity, nameKo: event.name, nameEn: event.nameEn, imageUrl: event.imageUrl, color: event.act ?? "none", eventData: event };
    }
    case "affliction": {
      if (!entity.afflictionData) return entity;
      const affliction = reconstructEntityAtVersion(entity.afflictionData, "affliction", patchVersion, currentVersion, versionDiffs, patches);
      return {
        ...entity,
        nameKo: affliction.name,
        nameEn: affliction.nameEn,
        imageUrl: affliction.imageUrl,
        afflictionData: affliction,
      };
    }
    case "monster": {
      if (!entity.monsterData) return entity;
      const monster = reconstructEntityAtVersion(entity.monsterData, "monster", patchVersion, currentVersion, versionDiffs, patches);
      return {
        ...entity,
        nameKo: monster.name,
        nameEn: monster.nameEn,
        imageUrl: monster.bossImageUrl ?? monster.imageUrl,
        color: monster.type,
        monsterData: monster,
      };
    }
    case "encounter": {
      if (!entity.encounterData) return entity;
      const encounter = reconstructEntityAtVersion(entity.encounterData, "encounter", patchVersion, currentVersion, versionDiffs, patches);
      return {
        ...entity,
        nameKo: encounter.name,
        nameEn: encounter.nameEn,
        imageUrl: encounter.scene?.backgroundUrl ?? encounter.imageUrl,
        color: encounter.roomType,
        encounterData: encounter,
      };
    }
    case "ancient": {
      if (!entity.ancientData) return entity;
      const ancient = reconstructEntityAtVersion(entity.ancientData, "ancient", patchVersion, currentVersion, versionDiffs, patches);
      return {
        ...entity,
        nameKo: ancient.name,
        nameEn: ancient.nameEn,
        imageUrl: ancient.imageUrl,
        color: ancient.act ?? "none",
        ancientData: ancient,
      };
    }
    case "epoch": {
      if (!entity.epochData) return entity;
      const epoch = reconstructEntityAtVersion(entity.epochData, "epoch", patchVersion, currentVersion, versionDiffs, patches);
      return {
        ...entity,
        nameKo: epoch.name,
        nameEn: epoch.nameEn,
        imageUrl: epoch.imageUrl,
        epochData: epoch,
      };
    }
    default:
      return entity;
  }
}

function applyPreviewEntityContext(entity: EntityInfo): EntityInfo {
  if (entity.type !== "power" || !entity.powerData) return entity;
  const powerData = applyPowerAmountForPreview(
    entity.powerData,
    entity.powerAmount,
    entity.powerAmountAscensionLevel,
    entity.powerAmountAscensionThreshold,
    entity.powerDescriptionVars,
  );
  return {
    ...entity,
    nameKo: powerData.name,
    nameEn: powerData.nameEn,
    imageUrl: powerData.imageUrl,
    color: powerData.type,
    powerData,
  };
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

function normalizePatchLineContent(text: string): string {
  return text.replace(/\s+/g, " ")
    .trim();
}

function patchLineContentKeyFromRenderedLine(line: string): string | null {
  const bulletMatch = line.match(/^\s*-\s+(.*)$/);
  if (!bulletMatch) return null;
  return normalizePatchLineContent(bulletMatch[1]);
}

// --- Entity Lookup ---

export interface EntityLookup {
  byKo: Map<string, EntityInfo>;
  byEn: Map<string, EntityInfo>;
  allByKo?: Map<string, EntityInfo[]>;
  allByEn?: Map<string, EntityInfo[]>;
  monsterMoveKeywords?: MonsterMoveKeyword[];
  monsterEntities?: EntityInfo[];
  autoLinkKeywordsByFirst?: Map<string, AutoLinkKeyword[]>;
}

interface MonsterMoveKeyword {
  label: string;
  lower: string;
  entity: EntityInfo;
  ascii: boolean;
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
  const monsterMoveKeywords: MonsterMoveKeyword[] = [];
  const monsterEntities: EntityInfo[] = [];
  const autoLinkNames: Array<{ label: string; type: EntityType }> = [];
  for (const e of entities) {
    addLookupEntry(byKo, allByKo, e.nameKo, e);
    addLookupEntry(byEn, allByEn, e.nameEn, e);
    autoLinkNames.push({ label: e.nameKo, type: e.type }, { label: e.nameEn, type: e.type });
    for (const alias of e.aliasesKo ?? []) {
      addLookupEntry(byKo, allByKo, alias, e);
      autoLinkNames.push({ label: alias, type: e.type });
    }
    for (const alias of e.aliasesEn ?? []) {
      addLookupEntry(byEn, allByEn, alias, e);
      autoLinkNames.push({ label: alias, type: e.type });
    }
    if (e.type === "monster") monsterEntities.push(e);
    if (e.type === "monsterMove") {
      for (const label of [e.nameKo, e.nameEn, ...(e.aliasesKo ?? []), ...(e.aliasesEn ?? [])]) {
        const trimmed = label.trim();
        if (!trimmed) continue;
        monsterMoveKeywords.push({
          label: trimmed,
          lower: trimmed.toLowerCase(),
          entity: e,
          ascii: /^[\x00-\x7F]+$/.test(trimmed),
        });
      }
    }
  }
  monsterMoveKeywords.sort((a, b) => b.label.length - a.label.length);
  return {
    byKo,
    byEn,
    allByKo,
    allByEn,
    monsterMoveKeywords,
    monsterEntities,
    autoLinkKeywordsByFirst: buildAutoLinkKeywordsByFirst(autoLinkNames),
  };
}

export function findEntity(text: string, lookup: EntityLookup, typeHint?: string): EntityInfo | null {
  const lower = text.trim().toLowerCase();
  const upgradedCardToken = parseUpgradedCardToken(lower, typeHint);
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
    if (upgradedCardToken) {
      const card = findEntity(upgradedCardToken.baseText, lookup, "card");
      if (card) return withCardPreviewUpgrade(card, upgradedCardToken.level);
    }
    return null;
  }

  const preferDirectEntity = (matches: EntityInfo[] | undefined): EntityInfo | null => {
    if (!matches?.length) return null;
    return matches.find((entity) => entity.type !== "epoch") ?? matches[0];
  };

  const match =
    preferDirectEntity(lookup.allByKo?.get(lower)) ??
    preferDirectEntity(lookup.allByEn?.get(lower)) ??
    lookup.byKo.get(lower) ??
    lookup.byEn.get(lower) ??
    null;
  if (match) return match;

  if (upgradedCardToken) {
    const card = findEntity(upgradedCardToken.baseText, lookup, "card");
    if (card) return withCardPreviewUpgrade(card, upgradedCardToken.level);
  }

  return null;
}

function parseUpgradedCardToken(
  lowerText: string,
  typeHint?: string,
): { baseText: string; level: number } | null {
  if (typeHint && typeHint !== "card") return null;
  const match = lowerText.match(/^(.+?)(\++)$/);
  if (!match) return null;
  const baseText = match[1].trim();
  if (!baseText) return null;
  return { baseText, level: match[2].length };
}

function withCardPreviewUpgrade(entity: EntityInfo, level: number): EntityInfo {
  if (entity.type !== "card") return entity;
  return { ...entity, cardPreviewUpgradeLevel: Math.max(1, level) };
}

function cardPreviewUpgradeSuffix(entity: EntityInfo): string {
  const level = entity.cardPreviewUpgradeLevel ?? 0;
  if (entity.type !== "card" || level <= 0) return "";
  const maxUpgradeLevel = entity.cardData ? getCardMaxUpgradeLevel(entity.cardData) : 1;
  return maxUpgradeLevel > 1 ? `+${level}` : "+";
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
      // Within plain text, handle `inline code` then **bold** markdown
      return renderMarkdownInlineCode(node.text, lookup, key, context);
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

const INLINE_CODE_CLASS =
  "rounded border border-white/10 bg-black/45 px-1 py-0.5 font-mono text-[0.9em] font-semibold text-amber-100/95";

// Handle `inline code` before **bold** so tokens like `*` stay literal.
function renderMarkdownInlineCode(
  text: string,
  lookup: EntityLookup,
  keyPrefix: string,
  context: RenderContext,
): ReactNode {
  const regex = /`([^`\n]+)`/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const parts: ReactNode[] = [];
  let idx = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(
        renderMarkdownBold(
          text.slice(lastIndex, match.index),
          lookup,
          `${keyPrefix}-pre-${idx}`,
          context,
        ),
      );
    }

    parts.push(
      <code key={`${keyPrefix}-code-${idx}`} className={INLINE_CODE_CLASS}>
        {match[1]}
      </code>,
    );
    idx += 1;
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex === 0) {
    return renderMarkdownBold(text, lookup, keyPrefix, context);
  }
  if (lastIndex < text.length) {
    parts.push(
      renderMarkdownBold(
        text.slice(lastIndex),
        lookup,
        `${keyPrefix}-tail`,
        context,
      ),
    );
  }
  return <span key={keyPrefix}>{parts}</span>;
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
      parts.push(...renderPlainTextWithMonsterMoveLinks(
        text.slice(lastIndex, match.index),
        lookup,
        `${keyPrefix}-t${idx}`,
        context,
      ));
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

      const entity = findMonsterMoveEntity(name, lookup, context) ?? findEntity(name, lookup);
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

  if (lastIndex === 0) {
    const plain = renderMarkdownLinks(text, lookup, `${keyPrefix}-plain`, context);
    if (plain.length === 1 && typeof plain[0] === "string") return plain[0];
    return <span key={keyPrefix}>{plain}</span>;
  }
  if (lastIndex < text.length) {
    parts.push(...renderMarkdownLinks(
      text.slice(lastIndex),
      lookup,
      `${keyPrefix}-tail`,
      context,
    ));
  }
  return <span key={keyPrefix}>{parts}</span>;
}

function renderPlainTextWithMonsterMoveLinks(
  text: string,
  lookup: EntityLookup,
  keyPrefix: string,
  context: RenderContext,
): ReactNode[] {
  const preferredMonsterIds = context.preferredMonsterIds ?? [];
  if (preferredMonsterIds.length === 0 || !lookup.monsterMoveKeywords?.length) return [text];

  let remaining = text;
  const parts: ReactNode[] = [];
  let cursor = 0;
  let matchIndex = 0;

  while (cursor < remaining.length) {
    const match = findMonsterMoveKeywordAt(remaining.toLowerCase(), cursor, lookup.monsterMoveKeywords, context);
    if (!match) {
      cursor += 1;
      continue;
    }

    if (match.start > 0) parts.push(remaining.slice(0, match.start));
    const label = remaining.slice(match.start, match.start + match.keyword.label.length);
    parts.push(
      <EntityPreview key={`${keyPrefix}-move-${matchIndex}`} entity={match.keyword.entity} {...context}>
        {label}
      </EntityPreview>,
    );
    remaining = remaining.slice(match.start + match.keyword.label.length);
    cursor = 0;
    matchIndex += 1;
  }

  if (remaining) parts.push(remaining);
  return parts.length > 0 ? parts : [text];
}

const MARKDOWN_IMAGE_RE = /^!\[([^\]\n]*)\]\(([^)\s]+)\)$/;
const MARKDOWN_LINK_RE = /\[([^\]\n]+)\]\(((?:https?:\/\/|\/)[^\s)]+)\)/g;

function renderMarkdownLink(
  key: string,
  label: string,
  href: string,
  context: RenderContext,
): ReactNode {
  const className = classNameForHref(href);
  if (href.startsWith("/")) {
    const localizedHref = context.serviceLocale && context.gameLocale
      ? localizeHrefWithGameLocale(href, context.serviceLocale, context.gameLocale)
      : href;
    return <Link key={key} href={localizedHref} className={className}>{label}</Link>;
  }

  return (
    <a
      key={key}
      href={href}
      target="_blank"
      rel="noreferrer"
      className={className}
    >
      {label}
    </a>
  );
}

function renderMarkdownImage(
  key: string,
  alt: string,
  src: string,
): ReactNode {
  return (
    <figure key={key} className="my-4 overflow-hidden rounded-md border border-border/70 bg-black/30">
      <Image
        src={src}
        alt={alt || "Patch note image"}
        loading="lazy"
        className="h-auto w-full object-contain"
      />
    </figure>
  );
}

function renderMarkdownLinks(
  text: string,
  lookup: EntityLookup,
  keyPrefix: string,
  context: RenderContext,
): ReactNode[] {
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let matchIndex = 0;

  for (const match of text.matchAll(MARKDOWN_LINK_RE)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      parts.push(...renderPlainTextWithMonsterMoveLinks(
        text.slice(lastIndex, index),
        lookup,
        `${keyPrefix}-text-${matchIndex}`,
        context,
      ));
    }

    parts.push(renderMarkdownLink(`${keyPrefix}-link-${matchIndex}`, match[1], match[2], context));
    lastIndex = index + match[0].length;
    matchIndex += 1;
  }

  if (lastIndex === 0) {
    return renderPlainTextWithMonsterMoveLinks(text, lookup, `${keyPrefix}-plain`, context);
  }

  if (lastIndex < text.length) {
    parts.push(...renderPlainTextWithMonsterMoveLinks(
      text.slice(lastIndex),
      lookup,
      `${keyPrefix}-tail`,
      context,
    ));
  }

  return parts;
}

function findMonsterMoveKeywordAt(
  lowerText: string,
  start: number,
  keywords: MonsterMoveKeyword[],
  context: RenderContext,
): { keyword: MonsterMoveKeyword; start: number } | null {
  const matches = keywords.filter((keyword) => {
    if (!lowerText.startsWith(keyword.lower, start)) return false;
    if (!monsterMoveMatchesContext(keyword.entity, context)) return false;
    return !keyword.ascii || hasAsciiTokenBoundary(lowerText, start, keyword.lower.length);
  });
  if (matches.length === 0) return null;
  matches.sort((a, b) => (
    Number(monsterMoveMatchesPreferred(b.entity, context)) - Number(monsterMoveMatchesPreferred(a.entity, context)) ||
    b.label.length - a.label.length
  ));
  return { keyword: matches[0], start };
}

function findMonsterMoveEntity(
  text: string,
  lookup: EntityLookup,
  context: RenderContext,
): EntityInfo | null {
  const lower = text.trim().toLowerCase();
  if (!lower) return null;
  const matches = [
    ...(lookup.allByKo?.get(lower) ?? []),
    ...(lookup.allByEn?.get(lower) ?? []),
  ].filter((entity) => entity.type === "monsterMove" && monsterMoveMatchesContext(entity, context));
  if (matches.length === 0) return null;
  matches.sort((a, b) => (
    Number(monsterMoveMatchesPreferred(b, context)) - Number(monsterMoveMatchesPreferred(a, context))
  ));
  return matches[0];
}

function monsterMoveMatchesContext(entity: EntityInfo, context: RenderContext): boolean {
  const preferredMonsterIds = context.preferredMonsterIds ?? [];
  if (preferredMonsterIds.length === 0) return false;
  return preferredMonsterIds.includes(entity.monsterMoveMonsterData?.id ?? "");
}

function monsterMoveMatchesPreferred(entity: EntityInfo, context: RenderContext): boolean {
  return (context.preferredMonsterIds ?? []).includes(entity.monsterMoveMonsterData?.id ?? "");
}

function hasAsciiTokenBoundary(text: string, start: number, length: number): boolean {
  const before = start > 0 ? text[start - 1] : "";
  const after = start + length < text.length ? text[start + length] : "";
  return !isAsciiWordChar(before) && !isAsciiWordChar(after);
}

function isAsciiWordChar(char: string): boolean {
  return /^[a-z0-9_]$/i.test(char);
}

// --- Enrich a line of text (BBCode + markdown bold) ---

function enrichLine(
  text: string,
  lookup: EntityLookup,
  key: string,
  context: RenderContext,
): ReactNode[] {
  const wrapSegment = (segment: string) => {
    const withNumberedAscensions = wrapNumberedAscensionMentions(segment);
    return context.autoLinkEntities
      ? wrapUntaggedEntityNames(
        withNumberedAscensions,
        lookup.autoLinkKeywordsByFirst,
        (raw) => {
          const entity = findEntity(raw, lookup);
          return entity && AUTO_LINK_ENTITY_TYPES.has(entity.type) ? entity : null;
        },
      )
      : withNumberedAscensions;
  };
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let matchIndex = 0;

  for (const match of text.matchAll(MARKDOWN_LINK_RE)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      parts.push(...renderBBNodes(
        parseBBCode(wrapSegment(text.slice(lastIndex, index))),
        lookup,
        `${key}-text-${matchIndex}`,
        context,
      ));
    }

    parts.push(renderMarkdownLink(`${key}-link-${matchIndex}`, match[1], match[2], context));
    lastIndex = index + match[0].length;
    matchIndex += 1;
  }

  if (lastIndex > 0) {
    if (lastIndex < text.length) {
      parts.push(...renderBBNodes(
        parseBBCode(wrapSegment(text.slice(lastIndex))),
        lookup,
        `${key}-tail`,
        context,
      ));
    }
    return parts;
  }

  const nodes = parseBBCode(wrapSegment(text));
  return renderBBNodes(nodes, lookup, key, context);
}

export function PatchNoteInlineText({
  markdown,
  lookup,
  serviceLocale,
  gameLocale,
}: {
  markdown: string;
  lookup: EntityLookup;
  serviceLocale?: ServiceLocale;
  gameLocale?: GameLocale;
}) {
  const context = useMemo<RenderContext>(
    () => ({ serviceLocale, gameLocale }),
    [gameLocale, serviceLocale],
  );

  return <>{enrichLine(withPatchChangeEffects(markdown), lookup, "patch-inline", context)}</>;
}

// --- Markdown line rendering ---

function renderLine(
  line: string,
  lookup: EntityLookup,
  key: string,
  context: RenderContext,
  options: {
    patchLineAction?: ReactNode;
    patchLineId?: string;
  } = {},
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
      <h3 key={key} className="font-game-title text-base font-semibold mt-6 mb-2 text-primary">
        {enrichLine(heading, lookup, key, context)}
      </h3>
    );
  }
  if (trimmed.startsWith("## ")) {
    const heading = gameHeadingLabel(trimmed.slice(3), context);
    return (
      <h2
        key={key}
        className="font-game-title text-lg font-bold mt-8 mb-3 text-primary border-b border-border pb-1"
      >
        {enrichLine(heading, lookup, key, context)}
      </h2>
    );
  }
  if (trimmed.startsWith("# ")) {
    // Skip top-level heading (shown in page header)
    return null;
  }

  const imageMatch = trimmed.match(MARKDOWN_IMAGE_RE);
  if (imageMatch) {
    return renderMarkdownImage(key, imageMatch[1], imageMatch[2]);
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
        id={options.patchLineId ? patchLineAnchorId(options.patchLineId) : undefined}
        data-patch-line-id={options.patchLineId}
        className={`text-sm ${bulletClass} mb-1 list-outside`}
        style={{ marginLeft: `${1 + indentLevel * 1.25}rem` }}
      >
        {enrichLine(bulletMatch[2], lookup, key, context)}
        {options.patchLineAction && (
          <span className="ml-2 inline-flex align-baseline">
            {options.patchLineAction}
          </span>
        )}
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
const MONSTER_PATTERN_DIFF_RE = /^\[monster-pattern-diff:([a-z0-9_]+)(?::([v0-9.]+))?(?::(full|compact))?\]$/i;
const CHARACTER_LOW_HP_IDLE_RE = /^\[character-low-hp-idle(?::([v0-9.]+))?\]$/i;

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

function mentionedMonsterIds(line: string, lookup: EntityLookup): string[] {
  const lower = line.toLowerCase();
  const ids: string[] = [];
  for (const entity of lookup.monsterEntities ?? []) {
    const labels = [
      entity.nameKo,
      entity.nameEn,
      ...(entity.aliasesKo ?? []),
      ...(entity.aliasesEn ?? []),
    ].map((label) => label.trim().toLowerCase()).filter(Boolean);
    if (labels.some((label) => lower.includes(label))) ids.push(entity.id);
  }
  return ids;
}

function bulletIndentLevel(line: string): number | null {
  const bulletMatch = line.match(/^(\s*)-\s+/);
  if (!bulletMatch) return null;
  return Math.min(Math.floor(bulletMatch[1].length / 2), 3);
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
  patchVersion,
  currentVersion,
  patches,
  versionDiffs,
  epochArtMode,
  staticHoverPreviews,
  autoLinkEntities,
  patchLines = [],
  patchLineActions,
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
  patchVersion?: string;
  currentVersion?: string;
  patches?: STS2Patch[];
  versionDiffs?: EntityVersionDiff[];
  epochArtMode?: HoverTipArtMode;
  staticHoverPreviews?: boolean;
  autoLinkEntities?: boolean;
  patchLines?: STS2PatchLine[];
  patchLineActions?: ReadonlyMap<string, ReactNode>;
}) {
  const allEntities = useMemo(() => entities ?? cards ?? [], [entities, cards]);
  const lookup = useMemo(() => buildEntityLookup(allEntities), [allEntities]);
  const context = useMemo<RenderContext>(
    () => ({
      gameUi,
      serviceLocale,
      gameLocale,
      preferEntityLocaleLabel,
      gameKeywordLabels,
      gameHeadingLabels,
      patchVersion,
      currentVersion,
      patches,
      versionDiffs,
      epochArtMode,
      staticHoverPreviews,
      autoLinkEntities,
    }),
    [currentVersion, epochArtMode, gameHeadingLabels, gameKeywordLabels, gameLocale, gameUi, patchVersion, patches, preferEntityLocaleLabel, serviceLocale, staticHoverPreviews, autoLinkEntities, versionDiffs],
  );
  const patchLineByRenderedContent = useMemo(() => {
    const map = new Map<string, STS2PatchLine>();
    for (const patchLine of patchLines) {
      const key = normalizePatchLineContent(withPatchChangeEffects(patchLineSummaryMarkdownForService(patchLine, serviceLocale)));
      if (key && !map.has(key)) map.set(key, patchLine);
    }
    return map;
  }, [patchLines, serviceLocale]);
  const lines = withPatchChangeEffects(markdown).split("\n");

  // Group consecutive list items into <ul> containers
  const elements: ReactNode[] = [];
  let listBuffer: ReactNode[] = [];
  let listKey = 0;
  let wasInList = false;
  let currentMonsterContext: string[] = [];

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

    const characterLowHpIdleMatch = trimmed.match(CHARACTER_LOW_HP_IDLE_RE);
    if (characterLowHpIdleMatch) {
      flushList();
      wasInList = false;
      const characters = allEntities
        .filter((entity) => entity.type === "character" && entity.characterData)
        .map((entity) => entity.characterData!);
      if (characters.length > 0) {
        elements.push(
          <CharacterLowHpIdleBlock
            key={`character-low-hp-idle-${i}`}
            characters={characters}
            serviceLocale={context.serviceLocale ?? "ko"}
          />,
        );
      }
      continue;
    }

    const monsterPatternDiffMatch = trimmed.match(MONSTER_PATTERN_DIFF_RE);
    if (monsterPatternDiffMatch) {
      flushList();
      wasInList = false;
      const monsterId = monsterPatternDiffMatch[1].toUpperCase();
      const patchId = monsterPatternDiffMatch[2] ?? "";
      const variant = (monsterPatternDiffMatch[3] as "full" | "compact" | undefined) ?? "full";
      const monster = allEntities.find((entity) => entity.type === "monster" && entity.id === monsterId)?.monsterData;
      if (monster && hasMonsterAnimationPatchDiff(monsterId, patchId || "v0.106.0")) {
        const monsters = allEntities
          .filter((entity) => entity.type === "monster" && entity.monsterData)
          .map((entity) => entity.monsterData!);
        elements.push(
          <MonsterAnimationPatchDiffBlock
            key={`monster-pattern-diff-${i}`}
            monster={monster}
            monsters={monsters}
            serviceLocale={context.serviceLocale ?? "ko"}
            patchId={patchId || "v0.106.0"}
            variant={variant}
          />,
        );
      }
      continue;
    }

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

    const indentLevel = bulletIndentLevel(lines[i]);
    const mentionedMonsters = mentionedMonsterIds(lines[i], lookup);
    const preferredMonsterIds = mentionedMonsters.length > 0
      ? mentionedMonsters
      : indentLevel != null && indentLevel > 0
        ? currentMonsterContext
        : [];
    const lineContext = preferredMonsterIds.length > 0 ? { ...context, preferredMonsterIds } : context;
    const patchLine = patchLineByRenderedContent.get(patchLineContentKeyFromRenderedLine(lines[i]) ?? "");
    const patchLineAction = patchLine ? patchLineActions?.get(patchLine.id) : undefined;

    if (/^\s*-\s+/.test(lines[i])) {
      listBuffer.push(renderLine(lines[i], lookup, `line-${i}`, lineContext, {
        patchLineAction,
        patchLineId: patchLine?.id,
      }));
      wasInList = true;
    } else {
      flushList();
      wasInList = false;
      const el = renderLine(lines[i], lookup, `line-${i}`, lineContext);
      if (el) elements.push(el);
    }

    if (indentLevel === 0) currentMonsterContext = mentionedMonsters;
    if (indentLevel == null && trimmed !== "") currentMonsterContext = [];
  }
  flushList();

  return <div className="patch-note-content">{elements}</div>;
}
