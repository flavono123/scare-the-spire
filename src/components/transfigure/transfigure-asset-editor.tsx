"use client";

import dynamic from "next/dynamic";
import { Pencil } from "lucide-react";
import { CardTile } from "@/components/codex/card-tile";
import { GameHoverTip } from "@/components/codex/hover-tip";
import type { RichContentEditorProps } from "@/components/rich-content-editor";
import type { EntityInfo } from "@/components/patch-note-renderer";
import Image from "@/components/ui/static-image";
import type { PostBlock } from "@/lib/chemical-types";
import type { GameLocale, ServiceLocale } from "@/lib/i18n";
import { getTransfigureSourceCost } from "@/lib/transfigure-types";

const RichContentEditor = dynamic<RichContentEditorProps>(
  () => import("@/components/rich-content-editor").then((module) => module.RichContentEditor),
  { ssr: false },
);

interface TransfigureAssetEditorProps {
  canSubmitBlocks: (blocks: PostBlock[]) => boolean;
  draftKey: string;
  entities: EntityInfo[];
  entity: EntityInfo;
  gameLocale: GameLocale;
  initialBlocks: PostBlock[];
  nameLabel: string;
  costLabel: string;
  descriptionLabel: string;
  directEditLabel: string;
  serviceLocale: ServiceLocale;
  sourceText: string;
  submitLabel: string;
  submitRequestId: number;
  transformedName: string;
  transformedCost: string;
  onBlocksChange: (blocks: PostBlock[]) => void;
  onCostChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onSubmit: (blocks: PostBlock[]) => Promise<void>;
  onValidityChange: (valid: boolean) => void;
}

const editFieldClass = [
  "rounded-sm outline outline-1 outline-dashed outline-[#d4a843]/35",
  "transition-[background-color,box-shadow,outline-color] duration-150",
  "hover:bg-black/15 hover:outline-[#d4a843]/70",
  "focus-within:bg-black/25 focus-within:outline-2 focus-within:outline-[#EFC851]",
  "focus-within:shadow-[0_0_14px_rgba(212,168,67,0.22)]",
].join(" ");

export function TransfigureAssetEditor({
  canSubmitBlocks,
  draftKey,
  entities,
  entity,
  gameLocale,
  initialBlocks,
  nameLabel,
  costLabel,
  descriptionLabel,
  directEditLabel,
  serviceLocale,
  sourceText,
  submitLabel,
  submitRequestId,
  transformedName,
  transformedCost,
  onBlocksChange,
  onCostChange,
  onNameChange,
  onSubmit,
  onValidityChange,
}: TransfigureAssetEditorProps) {
  const sourceCost = getTransfigureSourceCost(entity);
  const titleInput = (
    <span className={`block w-full ${editFieldClass}`}>
      <input
        type="text"
        value={transformedName}
        onChange={(event) => onNameChange(event.target.value)}
        placeholder={entity.nameKo}
        aria-label={nameLabel}
        maxLength={80}
        className="w-full bg-transparent text-center text-inherit caret-[#EFC851] outline-none placeholder:text-inherit placeholder:opacity-65"
        style={{
          color: "inherit",
          fontFamily: "inherit",
          fontSize: "inherit",
          fontWeight: "inherit",
          textShadow: "inherit",
        }}
        data-transfigure-name-input
      />
    </span>
  );
  const descriptionEditor = (
    <div
      className={`h-full w-full ${editFieldClass}`}
      aria-label={descriptionLabel}
      data-transfigure-description-input
    >
      <RichContentEditor
        key={`${gameLocale}:${entity.type}:${entity.id}`}
        entities={entities}
        onSubmit={onSubmit}
        onBlocksChange={onBlocksChange}
        placeholder={sourceText}
        initialBlocks={initialBlocks}
        canSubmitBlocks={canSubmitBlocks}
        draftKey={draftKey}
        submitLabel={submitLabel}
        maxChars={null}
        embedded
        submitOnEnter={false}
        submitRequestId={submitRequestId}
        onValidityChange={onValidityChange}
      />
    </div>
  );

  return (
    <div className="space-y-2" data-transfigure-asset-editor>
      <div className="flex items-center justify-center gap-1.5 text-[11px] text-[#d4a843]/80">
        <Pencil className="h-3 w-3" aria-hidden="true" />
        <span>{directEditLabel}</span>
      </div>

      {entity.type === "card" && entity.cardData ? (
        <div className="flex justify-center">
          <CardTile
            card={entity.cardData}
            serviceLocale={serviceLocale}
            showUpgrade={false}
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
                value={transformedCost}
                onChange={(event) => {
                  const cleaned = event.target.value
                    .toUpperCase()
                    .replace(/[^0-9X]/g, "");
                  const next = cleaned.includes("X")
                    ? "X"
                    : cleaned.slice(0, 2);
                  onCostChange(next);
                }}
                placeholder={sourceCost ?? "—"}
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
                data-transfigure-cost-input
              />
            )}
          />
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
