"use client";

import type { EntityInfo } from "@/components/patch-note-renderer";
import { EntityPreview } from "@/components/patch-note-renderer";
import { CardTile } from "@/components/codex/card-tile";
import Image from "@/components/ui/static-image";
import {
  DECISIONS_DECISIONS_CARD_WIDTH,
  type DecisionsDecisionsResourceRef,
} from "@/lib/decisions-decisions";
import type { GameLocale, ServiceLocale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

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
          <CardTile
            card={entity.cardData}
            serviceLocale={serviceLocale}
            showUpgrade={false}
            showBeta={false}
            width={DECISIONS_DECISIONS_CARD_WIDTH}
            interactive={false}
          />
        ) : (
          <Image
            src={entity.imageUrl ?? ""}
            alt={label}
            width={40}
            height={40}
            className="h-10 w-10 object-contain"
          />
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
