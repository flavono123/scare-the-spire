"use client";

import { useMemo, useRef, useState } from "react";
import { buildEntityMap, PostRenderer } from "@/components/chemicalx/post-renderer";
import { CardTile } from "@/components/codex/card-tile";
import { GameCheckboxToggle } from "@/components/codex/game-checkbox";
import { RelicInspectSlab } from "@/components/codex/relic-inspect-slab";
import { DescriptionText } from "@/components/codex/codex-description";
import { GameHoverTip } from "@/components/codex/hover-tip";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { TransfigureImageCopyButton } from "@/components/transfigure/transfigure-image-copy-button";
import { TransfigureTokenArt } from "@/components/transfigure/transfigure-token-art";
import Image from "@/components/ui/static-image";
import type { PostBlock } from "@/lib/chemical-types";
import { RELIC_RARITY_LABELS } from "@/lib/codex-types";
import type { GameLocale, ServiceLocale } from "@/lib/i18n";
import {
  applyTransfigureCardMetadata,
  canTransfigureCardMetadata,
  getTransfigureSourceCost,
  getTransfigureSourceStarCost,
  getTransfigureUpgradeInitialBlocks,
  getTransfigureUpgradeSourceCost,
  getTransfigureUpgradeSourceStarCost,
  isTransfigureTokenResourceType,
  normalizeTransfigureCardRarity,
  normalizeTransfigureCardType,
  transfigureBlocksToGameDescription,
  type TransfigureCardKeywords,
  type TransfigureCardRarity,
  type TransfigureCardType,
  type TransfigureTokenColor,
  type TransfigureTokenWax,
} from "@/lib/transfigure-types";
import { markUpgradePlusGreen } from "@/lib/transfigure-upgrade-diff";
import {
  resolveSts2EnergyIcon,
  type Sts2EnergyIconVariant,
} from "@/lib/sts2-energy-icons";
import { serviceMessages } from "@/messages/service";

interface TransfigureResourcePreviewProps {
  blocks: PostBlock[];
  entities: EntityInfo[];
  entityMap?: Map<string, EntityInfo>;
  entity: EntityInfo;
  gameLocale: GameLocale;
  serviceLocale: ServiceLocale;
  transformedName?: string | null;
  transformedCost?: string | null;
  transformedStarCost?: string | null;
  transformedCardType?: TransfigureCardType | null;
  transformedCardRarity?: TransfigureCardRarity | null;
  transformedUpgradeCost?: string | null;
  transformedUpgradeStarCost?: string | null;
  cardKeywords?: TransfigureCardKeywords | null;
  upgradedBlocks?: PostBlock[] | null;
  upgradedCardKeywords?: TransfigureCardKeywords | null;
  upgradeLabel: string;
  initialShowUpgrade?: boolean;
  showImageActions?: boolean;
  showUpgradeToggle?: boolean;
  tokenColor?: TransfigureTokenColor | null;
  tokenWax?: TransfigureTokenWax | null;
}

export function TransfigureResourcePreview({
  blocks,
  entities,
  entityMap: providedEntityMap,
  entity,
  gameLocale,
  serviceLocale,
  transformedName,
  transformedCost,
  transformedStarCost,
  transformedCardType,
  transformedCardRarity,
  transformedUpgradeCost,
  transformedUpgradeStarCost,
  cardKeywords,
  upgradedBlocks,
  upgradedCardKeywords,
  upgradeLabel,
  initialShowUpgrade = false,
  showImageActions = true,
  showUpgradeToggle = true,
  tokenColor = null,
  tokenWax = "off",
}: TransfigureResourcePreviewProps) {
  const entityMap = useMemo(
    () => providedEntityMap ?? buildEntityMap(entities),
    [entities, providedEntityMap],
  );
  const gameUpgradeBlocks = useMemo(
    () => getTransfigureUpgradeInitialBlocks(entity, entities),
    [entities, entity],
  );
  const [showUpgrade, setShowUpgrade] = useState(initialShowUpgrade);
  const copyTargetRef = useRef<HTMLDivElement>(null);
  const displayName = transformedName?.trim() || entity.nameKo;
  const copy = serviceMessages[serviceLocale].transfigure;
  const imageLabels = {
    copy: copy.copyAssetImage,
    copying: copy.copyingAssetImage,
    copied: copy.copied,
    copyFailed: copy.assetImageCopyFailed,
    copyUnsupported: copy.assetImageCopyUnsupported,
    download: copy.downloadAssetImage,
    downloading: copy.downloadingAssetImage,
    downloaded: copy.downloaded,
    downloadFailed: copy.assetImageDownloadFailed,
  };
  const imageFileName = copy.assetImageFileName.replace("{name}", displayName);

  if (entity.type === "card" && entity.cardData) {
    const cardMetadataEditable = canTransfigureCardMetadata(
      entity.cardData.type,
      entity.cardData.rarity,
    );
    const effectiveCardType = cardMetadataEditable
      ? normalizeTransfigureCardType(transformedCardType, entity.cardData.type)
      : null;
    const effectiveCardRarity = cardMetadataEditable
      ? normalizeTransfigureCardRarity(
        transformedCardRarity,
        entity.cardData.rarity,
      )
      : null;
    const effectiveUpgradeBlocks = upgradedBlocks ?? gameUpgradeBlocks;
    const activeBlocks = showUpgrade && effectiveUpgradeBlocks != null
      ? effectiveUpgradeBlocks
      : blocks;
    const activeCardKeywords = (
      showUpgrade && effectiveUpgradeBlocks != null
        ? upgradedCardKeywords
        : cardKeywords
    ) ?? { top: [], bottom: [] };
    const sourceCost = showUpgrade
      ? getTransfigureUpgradeSourceCost(entity)
      : getTransfigureSourceCost(entity);
    const sourceStarCost = showUpgrade
      ? getTransfigureUpgradeSourceStarCost(entity)
      : getTransfigureSourceStarCost(entity);
    const transformedActiveCost = showUpgrade
      ? transformedUpgradeCost
      : transformedCost;
    const transformedActiveStarCost = showUpgrade
      ? transformedUpgradeStarCost
      : transformedStarCost;
    const normalizedCost = transformedActiveCost?.trim().toUpperCase()
      || sourceCost;
    const normalizedStarCost = transformedActiveStarCost?.trim().toUpperCase()
      || sourceStarCost;
    const baseDescription = transfigureBlocksToGameDescription(blocks);
    const activeDescription = transfigureBlocksToGameDescription(activeBlocks);
    const description = showUpgrade && effectiveUpgradeBlocks != null
      ? markUpgradePlusGreen(baseDescription, activeDescription)
      : activeDescription;
    const card = {
      ...applyTransfigureCardMetadata(
        entity.cardData,
        entities,
        effectiveCardType,
        effectiveCardRarity,
      ),
      name: displayName,
      description,
      descriptionRaw: description,
      isXCost: normalizedCost == null
        ? entity.cardData.isXCost
        : normalizedCost === "X",
      isXStarCost: normalizedStarCost == null
        ? entity.cardData.isXStarCost
        : normalizedStarCost === "X",
      starCost: normalizedStarCost == null || normalizedStarCost === "X"
        ? (
          normalizedStarCost === "X"
            ? null
            : entity.cardData.starCost
        )
        : Number(normalizedStarCost),
    };
    const forcedCost = normalizedCost && normalizedCost !== "X"
      ? Number(normalizedCost)
      : undefined;
    const forcedStarCost = normalizedStarCost && normalizedStarCost !== "X"
      ? Number(normalizedStarCost)
      : undefined;
    return (
      <div
        className="flex flex-col items-center justify-center"
        data-transfigure-preview="card"
      >
        <div ref={copyTargetRef} data-transfigure-copy-target>
          <CardTile
            card={card}
            serviceLocale={serviceLocale}
            showUpgrade={showUpgrade}
            showBeta={false}
            width={280}
            interactive={false}
            keywordOverride={[
              ...activeCardKeywords.top,
              ...activeCardKeywords.bottom,
            ]}
            forcedCost={forcedCost}
            forcedStarCost={forcedStarCost}
          />
        </div>
        {showUpgradeToggle && effectiveUpgradeBlocks != null && (
          <GameCheckboxToggle
            checked={showUpgrade}
            onCheckedChange={setShowUpgrade}
            label={upgradeLabel}
            size="sm"
            className="mt-2 justify-center"
          />
        )}
        {showImageActions && (
          <TransfigureImageCopyButton
            fileName={imageFileName}
            targetRef={copyTargetRef}
            labels={imageLabels}
          />
        )}
      </div>
    );
  }

  const tokenWaxValue = tokenWax ?? "off";
  const displayDescription = (
    <PostRenderer
      blocks={blocks}
      entityMap={entityMap}
      serviceLocale={serviceLocale}
      gameLocale={gameLocale}
      energyIconSrc={resolveSts2EnergyIcon(
        (entity.cardData?.visualColor
          ?? entity.cardData?.color
          ?? entity.color) as Sts2EnergyIconVariant,
      )}
    />
  );

  if (entity.type === "relic" && entity.relicData) {
    return (
      <div
        className="flex flex-col items-center justify-center"
        data-transfigure-preview="relic"
      >
        <div ref={copyTargetRef} className="w-full" data-transfigure-copy-target>
          <RelicInspectSlab
            className="max-w-[20rem]"
            titleAs="div"
            rarity={entity.relicData.rarity}
            rarityLabel={RELIC_RARITY_LABELS[entity.relicData.rarity]}
            title={displayName}
            art={entity.imageUrl ? (
              <TransfigureTokenArt
                src={entity.imageUrl}
                label={displayName}
                size={160}
                color={tokenColor}
                wax={tokenWaxValue}
                outlinePool={entity.relicData.pool}
                className="relative z-[1] h-[62%] w-[62%]"
              />
            ) : (
              <div className="relative z-[1] flex h-[62%] w-[62%] items-center justify-center text-2xl text-gray-600">
                ?
              </div>
            )}
            description={displayDescription}
            flavor={entity.relicData.flavor ? (
              <DescriptionText description={entity.relicData.flavor} />
            ) : undefined}
          />
        </div>
        {showImageActions && (
          <TransfigureImageCopyButton
            fileName={imageFileName}
            targetRef={copyTargetRef}
            labels={imageLabels}
          />
        )}
      </div>
    );
  }

  return (
    <div
      className="flex flex-col items-center justify-center"
      data-transfigure-preview={entity.type}
    >
      <div
        ref={copyTargetRef}
        className="flex flex-col items-center justify-center gap-3 sm:flex-row sm:items-start"
        data-transfigure-copy-target
      >
        {entity.imageUrl && (
          <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-black/25 p-1.5">
            {isTransfigureTokenResourceType(entity.type) ? (
              <TransfigureTokenArt
                src={entity.imageUrl}
                label={displayName}
                size={72}
                color={tokenColor}
                wax={tokenWaxValue}
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
        <GameHoverTip
          title={displayName}
          className="w-full max-w-80"
          style={{ minWidth: 240, maxWidth: 320 }}
        >
          {displayDescription}
        </GameHoverTip>
      </div>
      {showImageActions && (
        <TransfigureImageCopyButton
          fileName={imageFileName}
          targetRef={copyTargetRef}
          labels={imageLabels}
        />
      )}
    </div>
  );
}
