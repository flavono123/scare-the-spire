"use client";

import Link from "next/link";
import { CardTile } from "@/components/codex/card-tile";
import { DescriptionText } from "@/components/codex/codex-description";
import { GameHoverTip } from "@/components/codex/hover-tip";
import { EntityPreview, type EntityInfo, type EntityType } from "@/components/patch-note-renderer";
import Image from "@/components/ui/static-image";
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

function assetOnlyDescription(entity: EntityInfo): string | null {
  return entity.relicData?.description
    ?? entity.potionData?.description
    ?? entity.powerData?.description
    ?? entity.enchantmentData?.description
    ?? entity.afflictionData?.description
    ?? entity.keywordData?.description
    ?? entity.characterData?.description
    ?? entity.eventOptionDesc
    ?? null;
}

function AssetOnlyNonCardPreview({ entity }: { entity: EntityInfo }) {
  const description = assetOnlyDescription(entity);
  if (!description) return null;

  return (
    <span className="relative flex h-full w-full items-center justify-center p-2">
      {entity.imageUrl && (
        <span className="absolute right-3 top-3 z-10 flex h-12 w-12 items-center justify-center rounded-lg bg-black/25 drop-shadow-xl">
          <Image
            src={entity.imageUrl}
            alt=""
            width={48}
            height={48}
            className="max-h-11 max-w-11 object-contain"
          />
        </span>
      )}
      <GameHoverTip
        title={entity.nameKo}
        className="w-full"
        style={{ width: "100%", minWidth: 0, maxWidth: "100%" }}
      >
        <DescriptionText description={description} className="block pr-10 text-left text-[13px] leading-snug" />
      </GameHoverTip>
    </span>
  );
}

export function ThisOrThatResourcePanel({
  entity,
  sideLabel,
  serviceLocale,
  gameLocale,
  size = "compact",
  assetOnly = false,
}: {
  entity: EntityInfo;
  sideLabel: string;
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
  size?: "compact" | "large";
  assetOnly?: boolean;
}) {
  const characterColor = getCharacterColor(entity.color);
  const isLarge = size === "large";
  const hrefBase = getThisOrThatEntityHref(entity);
  const href = !assetOnly && hrefBase
    ? localizeHrefWithGameLocale(hrefBase, serviceLocale, gameLocale)
    : null;
  const cardWidth = isLarge ? 260 : assetOnly ? 154 : 126;
  const assetOnlyNonCardPreview = assetOnly && !entity.cardData
    ? <AssetOnlyNonCardPreview entity={entity} />
    : null;
  const preview = entity.cardData ? (
    <CardTile
      card={entity.cardData}
      serviceLocale={serviceLocale}
      showUpgrade={false}
      showBeta={false}
      width={cardWidth}
      interactive={false}
    />
  ) : assetOnlyNonCardPreview ? (
    assetOnlyNonCardPreview
  ) : (
    <span className={cn(
      "block origin-center [&_.game-hover-tip]:shadow-2xl",
      assetOnly && "scale-[0.68] sm:scale-[0.74]",
      !assetOnly && (isLarge ? "[&_.game-hover-tip]:max-w-[360px]" : "scale-[0.76] [&_.game-hover-tip]:max-w-[260px]"),
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
    <span className={cn("block", assetOnly ? "h-full" : "space-y-2")}>
      {!assetOnly && (
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
      )}

        <span className={cn(
          "flex items-center justify-center rounded-md bg-black/20",
          assetOnly
            ? "h-full min-h-56 overflow-hidden p-1"
            : "min-h-36 overflow-visible p-2",
          isLarge && "min-h-72 py-4",
        )}>
          {preview}
        </span>

      {!assetOnly && (
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
      )}
      </span>
  );

  if (!href) {
    return (
      <span className={cn(
        "block h-full rounded-lg border border-border bg-card/35 text-left",
        assetOnly ? "p-0" : "p-3",
      )}>
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
