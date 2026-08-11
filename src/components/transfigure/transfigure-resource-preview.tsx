"use client";

import { useMemo, useRef, useState } from "react";
import { buildEntityMap, PostRenderer } from "@/components/chemicalx/post-renderer";
import { CardTile } from "@/components/codex/card-tile";
import { GameCheckboxToggle } from "@/components/codex/game-checkbox";
import { GameHoverTip } from "@/components/codex/hover-tip";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { TransfigureImageCopyButton } from "@/components/transfigure/transfigure-image-copy-button";
import Image from "@/components/ui/static-image";
import type { PostBlock } from "@/lib/chemical-types";
import type { GameLocale, ServiceLocale } from "@/lib/i18n";
import {
  applyTransfigureCardMetadata,
  canTransfigureCardMetadata,
  getTransfigureSourceCost,
  getTransfigureUpgradeInitialBlocks,
  getTransfigureUpgradeSourceCost,
  normalizeTransfigureCardRarity,
  normalizeTransfigureCardType,
  transfigureBlocksToGameDescription,
  type TransfigureCardKeywords,
  type TransfigureCardRarity,
  type TransfigureCardType,
} from "@/lib/transfigure-types";
import { markUpgradePlusGreen } from "@/lib/transfigure-upgrade-diff";
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
  transformedCardType?: TransfigureCardType | null;
  transformedCardRarity?: TransfigureCardRarity | null;
  transformedUpgradeCost?: string | null;
  cardKeywords?: TransfigureCardKeywords | null;
  upgradedBlocks?: PostBlock[] | null;
  upgradedCardKeywords?: TransfigureCardKeywords | null;
  upgradeLabel: string;
  initialShowUpgrade?: boolean;
  showImageActions?: boolean;
  showUpgradeToggle?: boolean;
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
  transformedCardType,
  transformedCardRarity,
  transformedUpgradeCost,
  cardKeywords,
  upgradedBlocks,
  upgradedCardKeywords,
  upgradeLabel,
  initialShowUpgrade = false,
  showImageActions = true,
  showUpgradeToggle = true,
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
    const transformedActiveCost = showUpgrade
      ? transformedUpgradeCost
      : transformedCost;
    const normalizedCost = transformedActiveCost?.trim().toUpperCase()
      || sourceCost;
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
    };
    const forcedCost = normalizedCost && normalizedCost !== "X"
      ? Number(normalizedCost)
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
          title={displayName}
          className="w-full max-w-80"
          style={{ minWidth: 240, maxWidth: 320 }}
        >
          <PostRenderer
            blocks={blocks}
            entityMap={entityMap}
            serviceLocale={serviceLocale}
            gameLocale={gameLocale}
          />
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
