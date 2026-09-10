"use client";

import type { DragEvent } from "react";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { EntityPreview } from "@/components/patch-note-renderer";
import { CardTile } from "@/components/codex/card-tile";
import { AscensionToken } from "@/components/codex/ascension-token";
import { DecisionsActorSprite } from "@/components/decisions-decisions/decisions-decisions-actor";
import Image from "@/components/ui/static-image";
import type { DecisionsDecisionsResourceRef } from "@/lib/decisions-decisions";
import {
  DECISIONS_DECISIONS_CARD_WIDTH,
  DECISIONS_TOKEN_CARD_ASPECT,
} from "@/lib/decisions-token-layout";
import { COMBO_KEYWORD_IMAGE_URL } from "@/lib/combo-resource-visuals";
import { useStoredUserProfile } from "@/hooks/use-user-profile";
import type { GameLocale, ServiceLocale } from "@/lib/i18n";
import { relicAwareImageUrl } from "@/lib/relic-character-variant";
import { cn } from "@/lib/utils";

/** Draggable pool/board piece (말). */
const TILE_ATTR = "data-decisions-decisions-tile";

export function setDecisionsTokenDragImage(event: DragEvent<HTMLElement>) {
  const tile = event.currentTarget.querySelector(`[${TILE_ATTR}]`);
  const preview = event.currentTarget.querySelector("[data-drag-preview]");
  const source = preview instanceof HTMLElement ? preview : tile;
  if (!(source instanceof HTMLElement)) return;
  const rect = source.getBoundingClientRect();
  const width = Math.max(rect.width, 40);
  const height = Math.max(rect.height, 40);
  const imgSrc = source instanceof HTMLImageElement
    ? (source.currentSrc || source.src)
    : null;
  const clone = imgSrc
    ? Object.assign(document.createElement("img"), {
      src: imgSrc,
      alt: "",
      width,
      height,
    })
    : source.cloneNode(true) as HTMLElement;
  if (!(clone instanceof HTMLImageElement)) {
    clone.classList.remove("opacity-0");
    clone.querySelectorAll(".opacity-0").forEach((node) => {
      node.classList.remove("opacity-0");
    });
    clone.querySelectorAll("canvas").forEach((node) => node.remove());
  }
  clone.setAttribute("aria-hidden", "true");
  clone.style.position = "fixed";
  clone.style.top = "-1200px";
  clone.style.left = "-1200px";
  clone.style.width = `${width}px`;
  clone.style.height = `${height}px`;
  clone.style.margin = "0";
  clone.style.opacity = "1";
  clone.style.visibility = "visible";
  clone.style.zIndex = "-1";
  clone.style.pointerEvents = "none";
  clone.style.transform = "none";
  document.body.appendChild(clone);
  event.dataTransfer.setDragImage(
    clone,
    Math.min(Math.max(event.clientX - rect.left, 0), width),
    Math.min(Math.max(event.clientY - rect.top, 0), height),
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
  disablePreview = false,
  staticOnly = false,
}: {
  entity: EntityInfo;
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
  showName?: boolean;
  selected?: boolean;
  onSelect?: () => void;
  disablePreview?: boolean;
  staticOnly?: boolean;
}) {
  const profile = useStoredUserProfile();
  const label = entity.nameKo;
  const previewEntity = { ...entity, href: null };
  const actorSpine = entity.type === "monster"
    ? entity.monsterData?.spineAsset
    : null;
  const actorFallback = entity.type === "monster"
    ? (
      entity.monsterData?.imageUrl
      || entity.monsterData?.bossImageUrl
      || entity.imageUrl
      || entity.monsterData?.spineAsset?.textureUrls[0]
      || null
    )
    : null;
  const isMonster = entity.type === "monster";
  const tokenSrc = entity.type === "character"
    ? (entity.characterData?.iconUrl || entity.imageUrl)
    : relicAwareImageUrl(entity, profile.characterId)
      || (entity.type === "keyword" ? COMBO_KEYWORD_IMAGE_URL : null);

  const tile = (
      <span
        role={onSelect ? "button" : undefined}
        tabIndex={onSelect ? 0 : undefined}
        onClick={(event) => {
          if (!onSelect) return;
          event.preventDefault();
          event.stopPropagation();
          onSelect();
        }}
        onKeyDown={(event) => {
          if (!onSelect) return;
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          event.stopPropagation();
          onSelect();
        }}
        className={cn(
          "flex max-w-full flex-col items-center gap-0.5 rounded-sm p-0 text-left",
          entity.type === "card"
            ? "w-[var(--dd-card,72px)]"
            : isMonster
              ? "w-[var(--dd-monster,48px)]"
              : "w-[var(--dd-icon,40px)]",
          selected && "ring-1 ring-primary",
        )}
      >
        {entity.type === "card" && entity.cardData ? (
          <span
            {...{ [TILE_ATTR]: "" }}
            data-decisions-piece=""
            className="relative block w-full overflow-hidden [&_*]:[-webkit-user-drag:none] [&_img]:pointer-events-none"
            style={{ aspectRatio: DECISIONS_TOKEN_CARD_ASPECT }}
          >
            <span
              className="absolute left-0 top-0 origin-top-left"
              style={{
                width: DECISIONS_DECISIONS_CARD_WIDTH,
                transform: `scale(calc(var(--dd-card, ${DECISIONS_DECISIONS_CARD_WIDTH}px) / ${DECISIONS_DECISIONS_CARD_WIDTH}px))`,
              }}
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
          </span>
        ) : entity.type === "ascension" && entity.ascensionData ? (
          <span
            {...{ [TILE_ATTR]: "" }}
            data-decisions-piece=""
            data-drag-preview=""
            className="relative flex size-[var(--dd-icon,40px)] items-center justify-center overflow-hidden [&_*]:[-webkit-user-drag:none] [&_img]:pointer-events-none"
          >
            <span
              className="absolute left-0 top-0 origin-top-left"
              style={{
                width: 40,
                height: 40,
                transform: "scale(calc(var(--dd-icon, 40px) / 40px))",
              }}
            >
              <AscensionToken level={entity.ascensionData.level} size={40} />
            </span>
          </span>
        ) : isMonster ? (
          <span
            {...{ [TILE_ATTR]: "" }}
            data-decisions-piece=""
            className="block size-[var(--dd-monster,48px)] [&_*]:[-webkit-user-drag:none] [&_img]:pointer-events-none [&_canvas]:pointer-events-none"
          >
            <DecisionsActorSprite
              name={label}
              fallbackUrl={actorFallback}
              spineAsset={actorSpine}
              staticOnly={staticOnly}
              size={48}
              className="h-full w-full"
            />
          </span>
        ) : (
          <span
            {...{ [TILE_ATTR]: "" }}
            data-decisions-piece=""
            className="flex size-[var(--dd-icon,40px)] items-center justify-center [&_*]:[-webkit-user-drag:none] [&_img]:pointer-events-none"
          >
            {tokenSrc ? (
              <Image
                src={tokenSrc}
                alt={label}
                width={40}
                height={40}
                draggable={false}
                data-drag-preview=""
                className="h-full w-full object-contain"
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
  );
  if (disablePreview) return tile;
  return (
    <EntityPreview
      entity={previewEntity}
      serviceLocale={serviceLocale}
      gameLocale={gameLocale}
      linkClassName="block"
    >
      {tile}
    </EntityPreview>
  );
}

export function DecisionsDecisionsTokenPlaceholder({
  refItem,
}: {
  refItem: DecisionsDecisionsResourceRef;
}) {
  return (
    <span className="inline-flex h-[var(--dd-monster,48px)] min-w-[var(--dd-icon,40px)] items-center justify-center rounded-sm border border-dashed border-white/20 px-1 text-[9px] text-zinc-500">
      {refItem.id}
    </span>
  );
}
