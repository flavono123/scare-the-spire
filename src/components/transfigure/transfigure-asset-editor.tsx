"use client";

import dynamic from "next/dynamic";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { CardTile, type CardDescriptionFit } from "@/components/codex/card-tile";
import { GameCheckboxToggle } from "@/components/codex/game-checkbox";
import { RelicInspectSlab } from "@/components/codex/relic-inspect-slab";
import { DescriptionText } from "@/components/codex/codex-description";
import { GameHoverTip } from "@/components/codex/hover-tip";
import type { RichContentEditorProps } from "@/components/rich-content-editor";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { TransfigureCardKeywordRail } from "@/components/transfigure/transfigure-card-keyword-rail";
import { TransfigureTokenArt } from "@/components/transfigure/transfigure-token-art";
import Image from "@/components/ui/static-image";
import type { PostBlock } from "@/lib/chemical-types";
import { RELIC_RARITY_LABELS } from "@/lib/codex-types";
import type { GameLocale, ServiceLocale } from "@/lib/i18n";
import {
  CARD_BOTTOM_KEYWORD_ORDER,
  CARD_TOP_KEYWORD_ORDER,
} from "@/lib/sts2-card-keywords";
import {
  applyTransfigureCardMetadata,
  getTransfigureSourceCost,
  isTransfigureTokenResourceType,
  normalizeTransfigureCostInput,
  type TransfigureCardKeywords,
  type TransfigureCardRarity,
  type TransfigureCardType,
  type TransfigureTokenColor,
  type TransfigureTokenWax,
} from "@/lib/transfigure-types";
import { resolveSts2EnergyIcon } from "@/lib/sts2-energy-icons";

const RichContentEditor = dynamic<RichContentEditorProps>(
  () => import("@/components/rich-content-editor").then((module) => module.RichContentEditor),
  { ssr: false },
);

interface TransfigureAssetEditorProps {
  blocks: PostBlock[];
  draftKey: string;
  entities: EntityInfo[];
  entity: EntityInfo;
  gameLocale: GameLocale;
  initialBlocks: PostBlock[];
  initialUpgradeBlocks: PostBlock[] | null;
  nameLabel: string;
  costLabel: string;
  descriptionLabel: string;
  descriptionFrameLimit: string;
  costTokenTip: {
    atThen: string;
    starThen: string;
    apply: string;
  };
  addTopKeywordLabel: string;
  addBottomKeywordLabel: string;
  removeKeywordLabel: string;
  serviceLocale: ServiceLocale;
  sourceText: string;
  sourceUpgradeText: string | null;
  sourceUpgradeCost: string | null;
  sourceStarCost: string | null;
  sourceUpgradeStarCost: string | null;
  submitLabel: string;
  transformedName: string;
  transformedCost: string;
  transformedStarCost: string;
  transformedCardType: TransfigureCardType | "";
  transformedCardRarity: TransfigureCardRarity | "";
  cardKeywords: TransfigureCardKeywords | null;
  transformedUpgradeCost: string;
  transformedUpgradeStarCost: string;
  upgradedCardKeywords: TransfigureCardKeywords | null;
  upgradedBlocks: PostBlock[] | null;
  upgradeLabel: string;
  starCostLabel: string;
  showUpgrade: boolean;
  tokenColor: TransfigureTokenColor | "";
  tokenWax: TransfigureTokenWax;
  onBlocksChange: (blocks: PostBlock[]) => void;
  onCardKeywordsChange: (keywords: TransfigureCardKeywords | null) => void;
  onCostChange: (value: string) => void;
  onStarCostChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onUpgradeBlocksChange: (blocks: PostBlock[] | null) => void;
  onUpgradeCardKeywordsChange: (
    keywords: TransfigureCardKeywords | null,
  ) => void;
  onUpgradeCostChange: (value: string) => void;
  onUpgradeStarCostChange: (value: string) => void;
  onShowUpgradeChange: (showUpgrade: boolean) => void;
  onSubmit: (
    blocks: PostBlock[],
    upgradedBlocks: PostBlock[] | null,
  ) => Promise<void>;
}

const editFieldClass = [
  "box-border rounded-md border-2 border-dashed border-[#EFC851]/80 bg-[#EFC851]/10",
  "shadow-[inset_0_0_12px_rgba(239,200,81,0.08)]",
  "transition-[background-color,border-color,box-shadow] duration-150",
  "hover:border-[#F6DF8B] hover:bg-[#EFC851]/15",
  "focus-within:border-solid focus-within:border-[#FFF0A8] focus-within:bg-black/25",
  "focus-within:shadow-[0_0_16px_rgba(239,200,81,0.32),inset_0_0_12px_rgba(239,200,81,0.12)]",
].join(" ");

export function TransfigureAssetEditor({
  blocks,
  draftKey,
  entities,
  entity,
  gameLocale,
  initialBlocks,
  initialUpgradeBlocks,
  nameLabel,
  costLabel,
  descriptionLabel,
  descriptionFrameLimit,
  costTokenTip,
  addTopKeywordLabel,
  addBottomKeywordLabel,
  removeKeywordLabel,
  serviceLocale,
  sourceText,
  sourceUpgradeText,
  sourceUpgradeCost,
  sourceStarCost,
  sourceUpgradeStarCost,
  submitLabel,
  transformedName,
  transformedCost,
  transformedStarCost,
  transformedCardType,
  transformedCardRarity,
  cardKeywords,
  transformedUpgradeCost,
  transformedUpgradeStarCost,
  upgradedCardKeywords,
  upgradedBlocks,
  upgradeLabel,
  starCostLabel,
  showUpgrade,
  tokenColor,
  tokenWax,
  onBlocksChange,
  onCardKeywordsChange,
  onCostChange,
  onStarCostChange,
  onNameChange,
  onUpgradeBlocksChange,
  onUpgradeCardKeywordsChange,
  onUpgradeCostChange,
  onUpgradeStarCostChange,
  onShowUpgradeChange,
  onSubmit,
}: TransfigureAssetEditorProps) {
  const activeMode = showUpgrade ? "upgrade" : "base";
  const sourceCost = getTransfigureSourceCost(entity);
  const displayCard = useMemo(
    () => entity.cardData
      ? applyTransfigureCardMetadata(
        entity.cardData,
        entities,
        transformedCardType || null,
        transformedCardRarity || null,
      )
      : null,
    [entities, entity.cardData, transformedCardRarity, transformedCardType],
  );
  const activeInitialBlocks = showUpgrade && initialUpgradeBlocks != null
    ? initialUpgradeBlocks
    : initialBlocks;
  const activeSourceText = showUpgrade && sourceUpgradeText != null
    ? sourceUpgradeText
    : sourceText;
  const activeCost = showUpgrade ? transformedUpgradeCost : transformedCost;
  const activeStarCost = showUpgrade
    ? transformedUpgradeStarCost
    : transformedStarCost;
  const activeCardKeywords = useMemo(
    () => (
      showUpgrade ? upgradedCardKeywords : cardKeywords
    ) ?? { top: [], bottom: [] },
    [cardKeywords, showUpgrade, upgradedCardKeywords],
  );
  const activeBlocks = showUpgrade
    ? (upgradedBlocks ?? activeInitialBlocks)
    : blocks;
  const activeSourceCost = showUpgrade ? sourceUpgradeCost : sourceCost;
  const activeSourceStarCost = showUpgrade
    ? sourceUpgradeStarCost
    : sourceStarCost;
  const updateActiveCost = showUpgrade ? onUpgradeCostChange : onCostChange;
  const updateActiveStarCost = showUpgrade
    ? onUpgradeStarCostChange
    : onStarCostChange;
  const updateActiveCardKeywords = showUpgrade
    ? onUpgradeCardKeywordsChange
    : onCardKeywordsChange;
  const energyIconSrc = resolveSts2EnergyIcon(
    displayCard?.visualColor ?? displayCard?.color ?? "colorless",
  );
  const costTokenTipNode = (
    <p
      className="mt-2 flex max-w-[20rem] flex-wrap items-center justify-center gap-x-1 gap-y-0.5 text-center text-[11px] text-gray-500 opacity-70"
      data-transfigure-cost-token-tip
    >
      <span className="spire-gold">{"@"}</span>
      <span>{costTokenTip.atThen}</span>
      <Image
        src={energyIconSrc}
        alt=""
        width={12}
        height={12}
        className="inline-block align-text-bottom"
        style={{ width: "1em", height: "1em" }}
      />
      <span>,</span>
      <span className="spire-gold">{"*"}</span>
      <span>{costTokenTip.starThen}</span>
      <Image
        src="/images/game-assets/card-misc/star_icon.png"
        alt=""
        width={12}
        height={12}
        className="inline-block align-text-bottom"
        style={{ width: "1em", height: "1em" }}
      />
      {costTokenTip.apply ? <span>{costTokenTip.apply}</span> : null}
    </p>
  );
  const acceptedDescriptionRef = useRef({
    base: {
      blocks,
      keywords: cardKeywords ?? { top: [], bottom: [] },
    },
    upgrade: {
      blocks: upgradedBlocks ?? initialUpgradeBlocks ?? [],
      keywords: upgradedCardKeywords ?? { top: [], bottom: [] },
    },
  });
  const pendingModeRef = useRef<"base" | "upgrade" | null>(null);
  const contentReplaceRequestIdRef = useRef(0);
  const feedbackTimeoutRef = useRef<number | null>(null);
  const [descriptionLimitVisible, setDescriptionLimitVisible] = useState(false);
  const [contentReplaceRequest, setContentReplaceRequest] = useState<{
    requestId: number;
    mode: "base" | "upgrade";
    blocks: PostBlock[];
  } | null>(null);

  useEffect(() => () => {
    if (feedbackTimeoutRef.current != null) {
      window.clearTimeout(feedbackTimeoutRef.current);
    }
  }, []);

  const showDescriptionLimit = useCallback(() => {
    setDescriptionLimitVisible(true);
    if (feedbackTimeoutRef.current != null) {
      window.clearTimeout(feedbackTimeoutRef.current);
    }
    feedbackTimeoutRef.current = window.setTimeout(() => {
      setDescriptionLimitVisible(false);
      feedbackTimeoutRef.current = null;
    }, 2800);
  }, []);

  const updateActiveBlocks = useCallback((nextBlocks: PostBlock[]) => {
    pendingModeRef.current = activeMode;
    if (activeMode === "upgrade") onUpgradeBlocksChange(nextBlocks);
    else onBlocksChange(nextBlocks);
  }, [
    activeMode,
    onBlocksChange,
    onUpgradeBlocksChange,
  ]);

  const updateKeywords = useCallback((nextKeywords: TransfigureCardKeywords) => {
    pendingModeRef.current = activeMode;
    updateActiveCardKeywords(nextKeywords);
  }, [activeMode, updateActiveCardKeywords]);

  const handleDescriptionFitChange = useCallback((fit: CardDescriptionFit) => {
    if (fit.fits) {
      acceptedDescriptionRef.current[activeMode] = {
        blocks: activeBlocks,
        keywords: activeCardKeywords,
      };
      if (pendingModeRef.current === activeMode) {
        pendingModeRef.current = null;
      }
      return;
    }

    if (pendingModeRef.current !== activeMode) return;
    pendingModeRef.current = null;
    const accepted = acceptedDescriptionRef.current[activeMode];
    contentReplaceRequestIdRef.current += 1;
    setContentReplaceRequest({
      requestId: contentReplaceRequestIdRef.current,
      mode: activeMode,
      blocks: accepted.blocks,
    });
    if (activeMode === "upgrade") {
      onUpgradeBlocksChange(accepted.blocks);
      onUpgradeCardKeywordsChange(accepted.keywords);
    } else {
      onBlocksChange(accepted.blocks);
      onCardKeywordsChange(accepted.keywords);
    }
    showDescriptionLimit();
  }, [
    activeBlocks,
    activeCardKeywords,
    activeMode,
    onBlocksChange,
    onCardKeywordsChange,
    onUpgradeBlocksChange,
    onUpgradeCardKeywordsChange,
    showDescriptionLimit,
  ]);

  const handleCostKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key.toLowerCase() !== "x") return;
    event.preventDefault();
    updateActiveCost("X");
  };
  const handleStarCostKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key.toLowerCase() !== "x") return;
    event.preventDefault();
    updateActiveStarCost("X");
  };
  const titleInput = (
    <span className={`flex w-full items-center justify-center ${editFieldClass}`}>
      <input
        type="text"
        value={transformedName}
        onChange={(event) => onNameChange(event.target.value)}
        placeholder={entity.nameKo}
        aria-label={nameLabel}
        maxLength={80}
        className="min-w-0 flex-1 bg-transparent text-center text-inherit caret-[#EFC851] outline-none placeholder:text-inherit placeholder:opacity-65"
        style={{
          color: "inherit",
          fontFamily: "inherit",
          fontSize: "inherit",
          fontWeight: "inherit",
          textShadow: "inherit",
        }}
        data-transfigure-name-input
      />
      {showUpgrade && <span aria-hidden="true">+</span>}
    </span>
  );
  const descriptionEditor = (
    <div
      className={`h-full w-full ${editFieldClass}`}
      aria-label={descriptionLabel}
      data-transfigure-description-input
    >
      <RichContentEditor
        key={`${gameLocale}:${entity.type}:${entity.id}:${showUpgrade ? "upgrade" : "base"}`}
        entities={entities}
        onSubmit={(nextBlocks) => onSubmit(
          showUpgrade ? blocks : nextBlocks,
          showUpgrade ? nextBlocks : upgradedBlocks,
        )}
        onBlocksChange={(nextBlocks) => {
          updateActiveBlocks(nextBlocks);
        }}
        placeholder={activeSourceText}
        initialBlocks={activeInitialBlocks}
        draftKey={showUpgrade ? `${draftKey}:upgrade` : draftKey}
        submitLabel={submitLabel}
        maxChars={null}
        contentReplaceRequest={contentReplaceRequest?.mode === activeMode
          ? contentReplaceRequest
          : null}
        embedded
        allowLineBreaks
        submitOnEnter={false}
        costTokens={{
          energyIconSrc,
        }}
      />
    </div>
  );

  return (
    <div className="space-y-2" data-transfigure-asset-editor>
      {entity.type === "card" && displayCard ? (
        <div className="relative flex flex-col items-center justify-center">
          <CardTile
            card={displayCard}
            serviceLocale={serviceLocale}
            showUpgrade={showUpgrade}
            showBeta={false}
            width={280}
            interactive={false}
            keywordOverride={[]}
            editableContent
            onDescriptionFitChange={handleDescriptionFitChange}
            titleContent={titleInput}
            descriptionContent={(
              <div
                className="flex h-full w-full flex-col"
                style={{
                  color: "#FFF6E2",
                  textShadow: "2px 2px 0 rgba(0,0,0,0.45)",
                }}
              >
                <TransfigureCardKeywordRail
                  addLabel={addTopKeywordLabel}
                  card={displayCard}
                  keywords={activeCardKeywords.top}
                  options={CARD_TOP_KEYWORD_ORDER}
                  placement="top"
                  removeLabel={removeKeywordLabel}
                  onChange={(top) => updateKeywords({
                    ...activeCardKeywords,
                    top,
                  })}
                />
                <div className="relative z-0 min-h-0 w-full flex-1 overflow-hidden">
                  {descriptionEditor}
                </div>
                <TransfigureCardKeywordRail
                  addLabel={addBottomKeywordLabel}
                  card={displayCard}
                  keywords={activeCardKeywords.bottom}
                  options={CARD_BOTTOM_KEYWORD_ORDER}
                  placement="bottom"
                  removeLabel={removeKeywordLabel}
                  onChange={(bottom) => updateKeywords({
                    ...activeCardKeywords,
                    bottom,
                  })}
                />
              </div>
            )}
            costContent={(
              <input
                type="text"
                inputMode="text"
                autoCapitalize="characters"
                spellCheck={false}
                value={activeCost}
                onKeyDown={handleCostKeyDown}
                onChange={(event) => {
                  updateActiveCost(
                    normalizeTransfigureCostInput(event.target.value),
                  );
                }}
                placeholder={activeSourceCost ?? "—"}
                aria-label={costLabel}
                maxLength={2}
                className={`h-full w-full bg-transparent text-center text-inherit caret-[#EFC851] outline-none placeholder:text-inherit placeholder:opacity-65 ${editFieldClass}`}
                style={{
                  color: "inherit",
                  fontFamily: "inherit",
                  fontSize: "inherit",
                  fontWeight: "inherit",
                  textShadow: "inherit",
                }}
                data-transfigure-cost-input={showUpgrade ? "upgrade" : "base"}
              />
            )}
            starCostContent={activeSourceStarCost != null ? (
              <input
                type="text"
                inputMode="text"
                autoCapitalize="characters"
                spellCheck={false}
                value={activeStarCost}
                onKeyDown={handleStarCostKeyDown}
                onChange={(event) => {
                  updateActiveStarCost(
                    normalizeTransfigureCostInput(event.target.value),
                  );
                }}
                placeholder={activeSourceStarCost}
                aria-label={starCostLabel}
                maxLength={2}
                className={`h-full w-full bg-transparent text-center text-inherit caret-[#EFC851] outline-none placeholder:text-inherit placeholder:opacity-65 ${editFieldClass}`}
                style={{
                  color: "inherit",
                  fontFamily: "inherit",
                  fontSize: "inherit",
                  fontWeight: "inherit",
                  textShadow: "inherit",
                }}
                data-transfigure-star-cost-input={showUpgrade ? "upgrade" : "base"}
              />
            ) : undefined}
          />
          {descriptionLimitVisible && (
            <div
              role="alert"
              aria-live="polite"
              className="pointer-events-none absolute left-1/2 top-1/2 z-50 w-[min(16rem,90vw)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-red-300/45 bg-[#16090b]/95 px-3 py-2 text-center text-xs font-semibold text-red-100 shadow-[0_8px_30px_rgba(0,0,0,0.7)]"
              data-transfigure-description-limit
            >
              {descriptionFrameLimit}
            </div>
          )}
          {costTokenTipNode}
          {upgradedBlocks != null && (
            <GameCheckboxToggle
              checked={showUpgrade}
              onCheckedChange={onShowUpgradeChange}
              label={upgradeLabel}
              size="sm"
              className="mt-2 justify-center"
            />
          )}
        </div>
      ) : entity.type === "relic" && entity.relicData ? (
        <div className="flex w-full flex-col items-center justify-center">
          <RelicInspectSlab
            className="max-w-[24rem]"
            rarity={entity.relicData.rarity}
            rarityLabel={RELIC_RARITY_LABELS[entity.relicData.rarity]}
            title={titleInput}
            art={entity.imageUrl ? (
              <TransfigureTokenArt
                src={entity.imageUrl}
                label={transformedName.trim() || entity.nameKo}
                size={160}
                color={tokenColor || null}
                wax={tokenWax}
                outlinePool={entity.relicData.pool}
                className="relative z-[1] h-[62%] w-[62%]"
              />
            ) : (
              <div className="relative z-[1] flex h-[62%] w-[62%] items-center justify-center text-2xl text-gray-600">
                ?
              </div>
            )}
            description={(
              <div className="min-h-24 w-full">
                {descriptionEditor}
              </div>
            )}
            flavor={entity.relicData.flavor ? (
              <DescriptionText description={entity.relicData.flavor} />
            ) : undefined}
          />
          {costTokenTipNode}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row sm:items-start">
          {entity.imageUrl && (
            <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-black/25 p-1.5">
              {isTransfigureTokenResourceType(entity.type) ? (
                <TransfigureTokenArt
                  src={entity.imageUrl}
                  label={transformedName.trim() || entity.nameKo}
                  size={72}
                  color={tokenColor || null}
                  wax={tokenWax}
                />
              ) : (
                <Image
                  src={entity.imageUrl}
                  alt={entity.nameKo}
                  width={76}
                  height={76}
                  className="max-h-[4.5rem] max-w-[4.5rem] object-contain"
                />
              )}
            </span>
          )}
          <div className="flex w-full max-w-[26rem] flex-col gap-1.5">
            <GameHoverTip
              title={titleInput}
              className="w-full"
              style={{ minWidth: 240, maxWidth: 416 }}
            >
              <div className="min-h-28">
                {descriptionEditor}
              </div>
            </GameHoverTip>
            {costTokenTipNode}
          </div>
        </div>
      )}
    </div>
  );
}
