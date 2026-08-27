"use client";

import type { DragEvent } from "react";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { EntityPreview } from "@/components/patch-note-renderer";
import { CardTile } from "@/components/codex/card-tile";
import { DecisionsActorSprite } from "@/components/decisions-decisions/decisions-decisions-actor";
import Image from "@/components/ui/static-image";
import {
  DECISIONS_DECISIONS_CARD_WIDTH,
  type DecisionsDecisionsResourceRef,
} from "@/lib/decisions-decisions";
import { COMBO_KEYWORD_IMAGE_URL } from "@/lib/combo-resource-visuals";
import type { GameLocale, ServiceLocale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Draggable pool/board piece (말). */
const TILE_ATTR = "data-decisions-decisions-tile";

export function setDecisionsTokenDragImage(event: DragEvent<HTMLElement>) {
  const tile = event.currentTarget.querySelector(`[${TILE_ATTR}]`);
  if (!(tile instanceof HTMLElement)) return;
  const rect = tile.getBoundingClientRect();
  const clone = tile.cloneNode(true) as HTMLElement;
  clone.setAttribute("aria-hidden", "true");
  clone.style.position = "fixed";
  clone.style.top = "-1200px";
  clone.style.left = "-1200px";
  clone.style.width = `${rect.width}px`;
  clone.style.height = `${rect.height}px`;
  clone.style.margin = "0";
  clone.style.zIndex = "-1";
  clone.style.pointerEvents = "none";
  clone.style.transform = "none";
  document.body.appendChild(clone);
  event.dataTransfer.setDragImage(
    clone,
    Math.min(Math.max(event.clientX - rect.left, 0), rect.width),
    Math.min(Math.max(event.clientY - rect.top, 0), rect.height),
  );
  const cleanup = () => clone.remove();
  event.currentTarget.addEventListener("dragend", cleanup, { once: true });
  window.setTimeout(cleanup, 1500);
}

export function DecisionsDecisionsToken({
  entity,
  serviceLocale,
  gameLocale,
  showName = false,
  selected = false,
  onSelect,
}: {
  entity: EntityInfo;
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
  showName?: boolean;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const label = entity.nameKo;
  const previewEntity = { ...entity, href: null };
  const actorSpine = entity.type === "character"
    ? entity.characterData?.spineAsset
    : entity.type === "monster"
      ? entity.monsterData?.spineAsset
      : null;
  const actorFallback = entity.type === "character"
    ? (entity.characterData?.combatImageUrl || entity.characterData?.imageUrl || entity.imageUrl)
    : entity.type === "monster"
      ? (entity.monsterData?.imageUrl || entity.monsterData?.bossImageUrl || entity.imageUrl)
      : null;
  const isActor = entity.type === "character" || entity.type === "monster";
  const tokenSrc = entity.imageUrl
    || (entity.type === "keyword" ? COMBO_KEYWORD_IMAGE_URL : null);

  return (
    <EntityPreview
      entity={previewEntity}
      serviceLocale={serviceLocale}
      gameLocale={gameLocale}
      linkClassName="block"
    >
      <span
        role={onSelect ? "button" : undefined}
        tabIndex={onSelect ? 0 : undefined}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onSelect?.();
        }}
        onKeyDown={(event) => {
          if (!onSelect) return;
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          event.stopPropagation();
          onSelect();
        }}
        className={cn(
          "flex max-w-[5.5rem] flex-col items-center gap-0.5 rounded-sm p-0.5 text-left",
          selected && "ring-1 ring-primary",
        )}
      >
        {entity.type === "card" && entity.cardData ? (
          <span
            {...{ [TILE_ATTR]: "" }}
            data-decisions-piece=""
            className="block [&_*]:[-webkit-user-drag:none] [&_img]:pointer-events-none"
          >
            <CardTile
              card={entity.cardData}
              serviceLocale={serviceLocale}
              showUpgrade={false}
              showBeta={false}
              width={DECISIONS_DECISIONS_CARD_WIDTH}
              interactive={false}
            />
          </span>
        ) : isActor ? (
          <span
            {...{ [TILE_ATTR]: "" }}
            data-decisions-piece=""
            className="[&_*]:[-webkit-user-drag:none] [&_img]:pointer-events-none [&_canvas]:pointer-events-none"
          >
            <DecisionsActorSprite
              name={label}
              fallbackUrl={actorFallback}
              spineAsset={actorSpine}
              kind={entity.type === "character" ? "character" : "monster"}
            />
          </span>
        ) : (
          <span
            {...{ [TILE_ATTR]: "" }}
            data-decisions-piece=""
            className="flex h-10 w-10 items-center justify-center [&_*]:[-webkit-user-drag:none] [&_img]:pointer-events-none"
          >
            {tokenSrc ? (
              <Image
                src={tokenSrc}
                alt={label}
                width={40}
                height={40}
                draggable={false}
                className="h-10 w-10 object-contain"
              />
            ) : (
              <span
                aria-hidden
                className="font-game-title text-lg font-bold text-primary"
              >
                {label.slice(0, 1)}
              </span>
            )}
          </span>
        )}
        {showName && (
          <span
            data-export-name
            className="line-clamp-2 w-full text-center text-[9px] leading-tight text-zinc-200"
          >
            {label}
          </span>
        )}
      </span>
    </EntityPreview>
  );
}

export function DecisionsDecisionsTokenPlaceholder({
  refItem,
}: {
  refItem: DecisionsDecisionsResourceRef;
}) {
  return (
    <span className="inline-flex h-[4.5rem] min-w-12 items-center justify-center rounded-sm border border-dashed border-white/20 px-1 text-[9px] text-zinc-500">
      {refItem.id}
    </span>
  );
}
