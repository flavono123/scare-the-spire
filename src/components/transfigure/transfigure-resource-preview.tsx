"use client";

import { useMemo } from "react";
import { buildEntityMap, PostRenderer } from "@/components/chemicalx/post-renderer";
import { CardTile } from "@/components/codex/card-tile";
import { GameHoverTip } from "@/components/codex/hover-tip";
import type { EntityInfo } from "@/components/patch-note-renderer";
import Image from "@/components/ui/static-image";
import type { PostBlock } from "@/lib/chemical-types";
import type { GameLocale, ServiceLocale } from "@/lib/i18n";
import { transfigureBlocksToGameDescription } from "@/lib/transfigure-types";

interface TransfigureResourcePreviewProps {
  blocks: PostBlock[];
  entities: EntityInfo[];
  entity: EntityInfo;
  gameLocale: GameLocale;
  serviceLocale: ServiceLocale;
}

export function TransfigureResourcePreview({
  blocks,
  entities,
  entity,
  gameLocale,
  serviceLocale,
}: TransfigureResourcePreviewProps) {
  const entityMap = useMemo(() => buildEntityMap(entities), [entities]);

  if (entity.type === "card" && entity.cardData) {
    const card = {
      ...entity.cardData,
      description: transfigureBlocksToGameDescription(blocks),
    };
    return (
      <div className="flex justify-center" data-transfigure-preview="card">
        <CardTile
          card={card}
          serviceLocale={serviceLocale}
          showUpgrade={false}
          showBeta={false}
          width={280}
          interactive={false}
        />
      </div>
    );
  }

  return (
    <div
      className="flex flex-col items-center justify-center gap-3 sm:flex-row sm:items-start"
      data-transfigure-preview={entity.type}
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
        title={entity.nameKo}
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
  );
}
