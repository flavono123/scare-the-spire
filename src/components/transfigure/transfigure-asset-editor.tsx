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
import {
  CardTile,
  type CardDescriptionFit,
} from "@/components/codex/card-tile";
import { GameCheckboxToggle } from "@/components/codex/game-checkbox";
import { GameHoverTip } from "@/components/codex/hover-tip";
import type { RichContentEditorProps } from "@/components/rich-content-editor";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { TransfigureCardKeywordRail } from "@/components/transfigure/transfigure-card-keyword-rail";
import Image from "@/components/ui/static-image";
import type { PostBlock } from "@/lib/chemical-types";
import type { GameLocale, ServiceLocale } from "@/lib/i18n";
import {
  CARD_BOTTOM_KEYWORD_ORDER,
  CARD_TOP_KEYWORD_ORDER,
} from "@/lib/sts2-card-keywords";
import {
  applyTransfigureCardMetadata,
  getTransfigureSourceCost,
  normalizeTransfigureCostInput,
  type TransfigureCardKeywords,
  type TransfigureCardRarity,
  type TransfigureCardType,
} from "@/lib/transfigure-types";

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
  addTopKeywordLabel: string;
  addBottomKeywordLabel: string;
  removeKeywordLabel: string;
  serviceLocale: ServiceLocale;
  sourceText: string;
  sourceUpgradeText: string | null;
  sourceUpgradeCost: string | null;
  submitLabel: string;
  transformedName: string;
  transformedCost: string;
  transformedCardType: TransfigureCardType | "";
  transformedCardRarity: TransfigureCardRarity | "";
  cardKeywords: TransfigureCardKeywords | null;
  transformedUpgradeCost: string;
  upgradedCardKeywords: TransfigureCardKeywords | null;
  upgradedBlocks: PostBlock[] | null;
  upgradeLabel: string;
  showUpgrade: boolean;
  onBlocksChange: (blocks: PostBlock[]) => void;
  onCardKeywordsChange: (keywords: TransfigureCardKeywords | null) => void;
  onCostChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onUpgradeBlocksChange: (blocks: PostBlock[] | null) => void;
  onUpgradeCardKeywordsChange: (
    keywords: TransfigureCardKeywords | null,
  ) => void;
  onUpgradeCostChange: (value: string) => void;
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
  addTopKeywordLabel,
  addBottomKeywordLabel,
  removeKeywordLabel,
  serviceLocale,
  sourceText,
  sourceUpgradeText,
  sourceUpgradeCost,
  submitLabel,
  transformedName,
  transformedCost,
  transformedCardType,
  transformedCardRarity,
  cardKeywords,
  transformedUpgradeCost,
  upgradedCardKeywords,
  upgradedBlocks,
  upgradeLabel,
  showUpgrade,
  onBlocksChange,
  onCardKeywordsChange,
  onCostChange,
  onNameChange,
  onUpgradeBlocksChange,
  onUpgradeCardKeywordsChange,
  onUpgradeCostChange,
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
  const updateActiveCost = showUpgrade ? onUpgradeCostChange : onCostChange;
  const updateActiveCardKeywords = showUpgrade
    ? onUpgradeCardKeywordsChange
    : onCardKeywordsChange;
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
      ) : (
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row sm:items-start">
          {entity.imageUrl && (
            <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-black/25 p-1.5">
              <Image
                src={entity.imageUrl}
                alt={entity.nameKo}
                width={76}
                height={76}
                className="max-h-[4.5rem] max-w-[4.5rem] object-contain"
              />
            </span>
          )}
          <GameHoverTip
            title={titleInput}
            className="w-full max-w-[26rem]"
            style={{ minWidth: 240, maxWidth: 416 }}
          >
            <div className="min-h-28">
              {descriptionEditor}
            </div>
          </GameHoverTip>
        </div>
      )}
    </div>
  );
}
