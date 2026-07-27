"use client";

import dynamic from "next/dynamic";
import type { KeyboardEvent } from "react";
import { CardTile } from "@/components/codex/card-tile";
import { GameCheckboxToggle } from "@/components/codex/game-checkbox";
import { GameHoverTip } from "@/components/codex/hover-tip";
import type { RichContentEditorProps } from "@/components/rich-content-editor";
import type { EntityInfo } from "@/components/patch-note-renderer";
import Image from "@/components/ui/static-image";
import type { PostBlock } from "@/lib/chemical-types";
import type { GameLocale, ServiceLocale } from "@/lib/i18n";
import {
  getTransfigureSourceCost,
  normalizeTransfigureCostInput,
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
  serviceLocale: ServiceLocale;
  sourceText: string;
  sourceUpgradeText: string | null;
  sourceUpgradeCost: string | null;
  submitLabel: string;
  transformedName: string;
  transformedCost: string;
  transformedUpgradeCost: string;
  upgradedBlocks: PostBlock[] | null;
  upgradeLabel: string;
  showUpgrade: boolean;
  onBlocksChange: (blocks: PostBlock[]) => void;
  onCostChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onUpgradeBlocksChange: (blocks: PostBlock[] | null) => void;
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
  serviceLocale,
  sourceText,
  sourceUpgradeText,
  sourceUpgradeCost,
  submitLabel,
  transformedName,
  transformedCost,
  transformedUpgradeCost,
  upgradedBlocks,
  upgradeLabel,
  showUpgrade,
  onBlocksChange,
  onCostChange,
  onNameChange,
  onUpgradeBlocksChange,
  onUpgradeCostChange,
  onShowUpgradeChange,
  onSubmit,
}: TransfigureAssetEditorProps) {
  const sourceCost = getTransfigureSourceCost(entity);
  const activeInitialBlocks = showUpgrade && initialUpgradeBlocks != null
    ? initialUpgradeBlocks
    : initialBlocks;
  const activeSourceText = showUpgrade && sourceUpgradeText != null
    ? sourceUpgradeText
    : sourceText;
  const activeCost = showUpgrade ? transformedUpgradeCost : transformedCost;
  const activeSourceCost = showUpgrade ? sourceUpgradeCost : sourceCost;
  const updateActiveCost = showUpgrade ? onUpgradeCostChange : onCostChange;
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
          if (showUpgrade) onUpgradeBlocksChange(nextBlocks);
          else onBlocksChange(nextBlocks);
        }}
        placeholder={activeSourceText}
        initialBlocks={activeInitialBlocks}
        draftKey={showUpgrade ? `${draftKey}:upgrade` : draftKey}
        submitLabel={submitLabel}
        maxChars={null}
        embedded
        allowLineBreaks
        submitOnEnter={false}
      />
    </div>
  );

  return (
    <div className="space-y-2" data-transfigure-asset-editor>
      {entity.type === "card" && entity.cardData ? (
        <div className="flex flex-col items-center justify-center">
          <CardTile
            card={entity.cardData}
            serviceLocale={serviceLocale}
            showUpgrade={showUpgrade}
            showBeta={false}
            width={280}
            interactive={false}
            editableContent
            titleContent={titleInput}
            descriptionContent={(
              <div
                className="h-full w-full"
                style={{
                  color: "#FFF6E2",
                  fontSize: "7cqi",
                  textShadow: "2px 2px 0 rgba(0,0,0,0.45)",
                }}
              >
                {descriptionEditor}
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
