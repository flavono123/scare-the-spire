"use client";

import Link from "next/link";
import { CardTile } from "@/components/codex/card-tile";
import { EntityPreview, type EntityInfo, type EntityType } from "@/components/patch-note-renderer";
import { getCharacterColor } from "@/lib/codex-types";
import { cn } from "@/lib/utils";
import type { GameLocale, ServiceLocale } from "@/lib/i18n";
import { localizeHrefWithGameLocale } from "@/lib/i18n";
import { getThisOrThatEntityHref } from "@/lib/this-or-that";
import { serviceMessages } from "@/messages/service";

function entityTypeLabel(entityType: EntityType, serviceLocale: ServiceLocale): string {
  const codex = serviceMessages[serviceLocale].codex;
  const labels: Partial<Record<EntityType, string>> = {
    affliction: codex.afflictions,
    ancient: codex.ancients,
    card: codex.cards,
    character: codex.characters,
    enchantment: codex.enchantments,
    encounter: codex.encounters,
    epoch: codex.epochs,
    event: codex.events,
    keyword: codex.keywords,
    monster: codex.monsters,
    potion: codex.potions,
    power: codex.powers,
    relic: codex.relics,
  };
  return labels[entityType] ?? entityType;
}

export function ThisOrThatResourcePanel({
  entity,
  sideLabel,
  serviceLocale,
  gameLocale,
  size = "compact",
}: {
  entity: EntityInfo;
  sideLabel: string;
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
  size?: "compact" | "large";
}) {
  const characterColor = getCharacterColor(entity.color);
  const isLarge = size === "large";
  const hrefBase = getThisOrThatEntityHref(entity);
  const href = hrefBase
    ? localizeHrefWithGameLocale(hrefBase, serviceLocale, gameLocale)
    : null;
  const cardWidth = isLarge ? 260 : 126;
  const preview = entity.cardData ? (
    <CardTile
      card={entity.cardData}
      serviceLocale={serviceLocale}
      showUpgrade={false}
      showBeta={false}
      width={cardWidth}
      interactive={false}
    />
  ) : (
    <span className={cn(
      "block [&_.game-hover-tip]:shadow-2xl",
      isLarge ? "[&_.game-hover-tip]:max-w-[360px]" : "[&_.game-hover-tip]:max-w-[260px]",
    )}>
      <EntityPreview
        entity={entity}
        serviceLocale={serviceLocale}
        gameLocale={gameLocale}
        forceShow
      >
        <span />
      </EntityPreview>
    </span>
  );

  const content = (
    <span className="block space-y-2">
        <span className="flex items-center justify-between gap-2">
          <span className="font-service text-[11px] font-semibold uppercase text-muted-foreground">
            {sideLabel}
          </span>
          <span className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
            {characterColor && (
              <span
                aria-hidden="true"
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: characterColor }}
              />
            )}
            <span className="truncate">{entityTypeLabel(entity.type, serviceLocale)}</span>
          </span>
        </span>

        <span className={cn(
          "flex min-h-36 items-center justify-center overflow-visible rounded-md bg-black/20 p-2",
          isLarge && "min-h-72 py-4",
        )}>
          {preview}
        </span>

        <span className="block min-w-0">
          <span className={cn(
            "block truncate font-game-title font-semibold text-zinc-100",
            isLarge ? "text-lg" : "text-sm",
          )}>
            {entity.nameKo}
          </span>
          {entity.nameEn && (
            <span className="block truncate text-[11px] text-muted-foreground">
              {entity.nameEn}
            </span>
          )}
        </span>
      </span>
  );

  if (!href) {
    return (
      <span className="block h-full rounded-lg border border-border bg-card/35 p-3 text-left">
        {content}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className={cn(
        "block h-full rounded-lg border border-border bg-card/35 p-3 text-left transition-colors",
        "hover:border-yellow-500/35 hover:bg-card/50 focus-visible:outline focus-visible:outline-1 focus-visible:outline-yellow-400/70",
      )}
    >
      {content}
    </Link>
  );
}
