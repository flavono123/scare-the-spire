"use client";

import Image from "@/components/ui/static-image";
import { EntityPreview, type EntityInfo, type EntityType } from "@/components/patch-note-renderer";
import { getCharacterColor } from "@/lib/codex-types";
import { cn } from "@/lib/utils";
import type { GameLocale, ServiceLocale } from "@/lib/i18n";
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

function imageClassName(entity: EntityInfo, size: "compact" | "large"): string {
  const base = size === "large" ? "h-48 sm:h-64" : "h-28";
  if (entity.type === "event" || entity.type === "epoch" || entity.type === "encounter") {
    return `${base} w-full rounded-md object-cover`;
  }
  if (entity.type === "monster" || entity.type === "character" || entity.type === "ancient") {
    return `${base} w-full rounded-md object-contain`;
  }
  return `${base} w-full object-contain`;
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

  return (
    <EntityPreview
      entity={entity}
      serviceLocale={serviceLocale}
      gameLocale={gameLocale}
      linkClassName={cn(
        "block h-full rounded-lg border border-border bg-card/35 p-3 text-left transition-colors",
        "hover:border-yellow-500/35 hover:bg-card/50 focus-visible:outline focus-visible:outline-1 focus-visible:outline-yellow-400/70",
      )}
    >
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

        <span className="flex items-center justify-center overflow-hidden rounded-md bg-black/20">
          {entity.imageUrl ? (
            <Image
              src={entity.imageUrl}
              alt={entity.nameKo}
              width={isLarge ? 420 : 220}
              height={isLarge ? 280 : 160}
              className={imageClassName(entity, size)}
            />
          ) : (
            <span className={cn("flex w-full items-center justify-center text-muted-foreground", isLarge ? "h-64" : "h-28")}>
              ?
            </span>
          )}
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
    </EntityPreview>
  );
}
