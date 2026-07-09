"use client";

import Link from "next/link";
import { CardTile } from "@/components/codex/card-tile";
import { DescriptionText } from "@/components/codex/codex-description";
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

function AssetOnlyNonCardPreview({
  entity,
  size,
}: {
  entity: EntityInfo;
  size: "compact" | "large";
}) {
  const description = assetOnlyDescription(entity);
  if (!description) return null;

  const isLarge = size === "large";
  const iconSize = isLarge ? 58 : 40;

  return (
    <span className={cn(
      "relative flex h-full w-full items-center justify-center",
      isLarge ? "p-2 sm:p-3" : "p-0.5",
    )}>
      <span
        className={cn(
          "relative flex w-full flex-col justify-center font-game-text text-zinc-100",
          isLarge ? "min-h-80" : "min-h-36",
        )}
        style={{
          borderStyle: "solid",
          borderColor: "transparent",
          borderTopWidth: 11,
          borderRightWidth: 18,
          borderBottomWidth: 10,
          borderLeftWidth: 15,
          borderImageSource: "url('/images/sts2/ui/hover_tip.png')",
          borderImageSlice: "43 91 32 55 fill",
          borderImageWidth: "11px 18px 10px 15px",
          boxSizing: "border-box",
        }}
      >
        {entity.imageUrl && (
          <span className={cn(
            "absolute z-10 flex items-center justify-center rounded-lg bg-black/25 drop-shadow-xl",
            isLarge ? "right-4 top-4 h-14 w-14" : "right-3 top-3 h-10 w-10",
          )}>
            <Image
              src={entity.imageUrl}
              alt=""
              width={iconSize}
              height={iconSize}
              className={cn("object-contain", isLarge ? "max-h-12 max-w-12" : "max-h-9 max-w-9")}
            />
          </span>
        )}
        <span
          className={cn(
            "block text-left font-bold leading-snug text-[#EFC851]",
            isLarge ? "pr-14 text-lg" : "pr-9 text-[13px]",
          )}
          style={{ textShadow: "2px 2px 0 rgba(0,0,0,0.45)", wordBreak: "keep-all" }}
        >
          {entity.nameKo}
        </span>
        <DescriptionText
          description={description}
          className={cn(
            "mt-1 block text-left leading-snug text-[#FFF6E2] [word-break:keep-all]",
            isLarge ? "pr-14 text-base" : "pr-9 text-[12px]",
          )}
        />
      </span>
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
  linkAsset = false,
}: {
  entity: EntityInfo;
  sideLabel: string;
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
  size?: "compact" | "large";
  assetOnly?: boolean;
  linkAsset?: boolean;
}) {
  const characterColor = getCharacterColor(entity.color);
  const isLarge = size === "large";
  const hrefBase = getThisOrThatEntityHref(entity);
  const href = (!assetOnly || linkAsset) && hrefBase
    ? localizeHrefWithGameLocale(hrefBase, serviceLocale, gameLocale)
    : null;
  const cardWidth = isLarge ? 300 : assetOnly ? 164 : 126;
  const assetOnlyNonCardPreview = assetOnly && !entity.cardData
    ? <AssetOnlyNonCardPreview entity={entity} size={size} />
    : null;
  const hasAssetOnlyNonCardPreview = Boolean(assetOnlyNonCardPreview);
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

  if (assetOnly) {
    const assetContent = (
      <span className={cn(
        "flex h-full w-full items-center justify-center overflow-hidden",
        isLarge
          ? hasAssetOnlyNonCardPreview ? "min-h-[22rem]" : "min-h-[28rem]"
          : hasAssetOnlyNonCardPreview ? "min-h-40" : "min-h-52",
      )}>
        {preview}
      </span>
    );

    if (!href) {
      return (
        <span className="block h-full text-left">
          {assetContent}
        </span>
      );
    }

    return (
      <Link
        href={href}
        title={entity.nameKo}
        className="block h-full text-left focus-visible:outline focus-visible:outline-1 focus-visible:outline-yellow-400/70"
      >
        {assetContent}
      </Link>
    );
  }

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
          "flex items-center justify-center rounded-md bg-black/20",
          "min-h-36 overflow-visible p-2",
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
