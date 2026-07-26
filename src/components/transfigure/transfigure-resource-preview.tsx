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
  getTransfigureSourceCost,
  getTransfigureUpgradeInitialBlocks,
  getTransfigureUpgradeSourceCost,
  transfigureBlocksToGameDescription,
} from "@/lib/transfigure-types";
import { serviceMessages } from "@/messages/service";

interface TransfigureResourcePreviewProps {
  blocks: PostBlock[];
  entities: EntityInfo[];
  entity: EntityInfo;
  gameLocale: GameLocale;
  serviceLocale: ServiceLocale;
  transformedName?: string | null;
  transformedCost?: string | null;
  transformedUpgradeCost?: string | null;
  upgradedBlocks?: PostBlock[] | null;
  upgradeLabel: string;
}

export function TransfigureResourcePreview({
  blocks,
  entities,
  entity,
  gameLocale,
  serviceLocale,
  transformedName,
  transformedCost,
  transformedUpgradeCost,
  upgradedBlocks,
  upgradeLabel,
}: TransfigureResourcePreviewProps) {
  const entityMap = useMemo(() => buildEntityMap(entities), [entities]);
  const gameUpgradeBlocks = useMemo(
    () => getTransfigureUpgradeInitialBlocks(entity, entities),
    [entities, entity],
  );
  const [showUpgrade, setShowUpgrade] = useState(false);
  const copyTargetRef = useRef<HTMLDivElement>(null);
  const displayName = transformedName?.trim() || entity.nameKo;
  const copy = serviceMessages[serviceLocale].transfigure;
  const copyLabels = {
    copy: copy.copyAssetImage,
    copying: copy.copyingAssetImage,
    copied: copy.copied,
    success: copy.assetImageCopied,
    failed: copy.assetImageCopyFailed,
    unsupported: copy.assetImageCopyUnsupported,
  };

  if (entity.type === "card" && entity.cardData) {
    const effectiveUpgradeBlocks = upgradedBlocks ?? gameUpgradeBlocks;
    const activeBlocks = showUpgrade && effectiveUpgradeBlocks != null
      ? effectiveUpgradeBlocks
      : blocks;
    const sourceCost = showUpgrade
      ? getTransfigureUpgradeSourceCost(entity)
      : getTransfigureSourceCost(entity);
    const transformedActiveCost = showUpgrade
      ? transformedUpgradeCost
      : transformedCost;
    const normalizedCost = transformedActiveCost?.trim().toUpperCase()
      || sourceCost;
    const description = transfigureBlocksToGameDescription(activeBlocks);
    const card = {
      ...entity.cardData,
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
            forcedCost={forcedCost}
          />
        </div>
        {effectiveUpgradeBlocks != null && (
          <GameCheckboxToggle
            checked={showUpgrade}
            onCheckedChange={setShowUpgrade}
            label={upgradeLabel}
            size="sm"
            className="mt-2 justify-center"
          />
        )}
        <TransfigureImageCopyButton
          targetRef={copyTargetRef}
          labels={copyLabels}
        />
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
      <TransfigureImageCopyButton
        targetRef={copyTargetRef}
        labels={copyLabels}
      />
    </div>
  );
}
