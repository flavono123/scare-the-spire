"use client";

import { useMemo } from "react";
import Link from "next/link";
import Image from "@/components/ui/static-image";
import { localizeHref, type ServiceLocale } from "@/lib/i18n";
import { buildCompendiumResourceDetailHref } from "@/lib/compendium-resource-links";
import { CodexRelic, characterOutlineFilter, type RelicPool } from "@/lib/codex-types";
import type { CardSideTipCatalogSources } from "@/lib/card-side-tip-catalog";
import { createCardSideTipCatalog } from "@/lib/card-side-tip-catalog";
import { collectRelicSideTips } from "@/lib/relic-side-tips";
import {
  pickRelicCharacterVariant,
  resolveRelicDisplayImage,
} from "@/lib/relic-character-variant";
import type {
  CodexCard,
  CodexEnchantment,
  CodexMonster,
  CodexPotion,
  CodexPower,
} from "@/lib/codex-types";
import { CardSideTipsAnchor } from "./card-keyword-tip-stack";

interface RelicTileProps {
  serviceLocale?: ServiceLocale;
  relic: CodexRelic;
  preferredPool: RelicPool;
  showBeta?: boolean;
  onClick?: (variantPool?: RelicPool) => void;
  tipCatalogSources?: CardSideTipCatalogSources;
  tipCatalogCards?: readonly CodexCard[];
  tipCatalogPowers?: readonly CodexPower[];
  tipCatalogMonsters?: readonly CodexMonster[];
  tipCatalogPotions?: readonly CodexPotion[];
  tipCatalogEnchantments?: readonly CodexEnchantment[];
}

export function RelicTile({
  serviceLocale = "ko",
  relic,
  preferredPool,
  showBeta = false,
  onClick,
  tipCatalogSources,
  tipCatalogCards = [],
  tipCatalogPowers = [],
  tipCatalogMonsters = [],
  tipCatalogPotions = [],
  tipCatalogEnchantments = [],
}: RelicTileProps) {
  const tileVariant = pickRelicCharacterVariant(relic, preferredPool);
  const tileImageUrl = resolveRelicDisplayImage(relic, preferredPool, { showBeta });
  const outlinePool = tileVariant ?? relic.pool;
  const lifecycleClassName = relic.deprecated ? " opacity-50 grayscale saturate-0" : "";

  const tipCatalog = useMemo(
    () => tipCatalogSources
      ? createCardSideTipCatalog({
        sources: tipCatalogSources,
        powers: tipCatalogPowers,
        cards: tipCatalogCards,
        monsters: tipCatalogMonsters,
      })
      : null,
    [tipCatalogSources, tipCatalogPowers, tipCatalogCards, tipCatalogMonsters],
  );

  const potionsById = useMemo(
    () => new Map(tipCatalogPotions.map((potion) => [potion.id, potion])),
    [tipCatalogPotions],
  );
  const enchantmentsById = useMemo(
    () => new Map(tipCatalogEnchantments.map((enchantment) => [enchantment.id, enchantment])),
    [tipCatalogEnchantments],
  );

  const sideTips = useMemo(() => {
    if (!tipCatalog) return [];
    return collectRelicSideTips(
      { ...relic, imageUrl: tileImageUrl ?? relic.imageUrl },
      tipCatalog,
      {
        includeSelf: true,
        potionsById,
        enchantmentsById,
      },
    );
  }, [relic, tileImageUrl, tipCatalog, potionsById, enchantmentsById]);

  return (
    <CardSideTipsAnchor mode="hover" preferSide="right" tips={sideTips} className="relative">
      <Link
        href={localizeHref(buildCompendiumResourceDetailHref("relic", relic.id), serviceLocale)}
        className="relative group block"
        onClick={(event) => {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
          event.preventDefault();
          onClick?.(tileVariant ?? undefined);
        }}
      >
        <div
          className={`w-14 h-14 sm:w-16 sm:h-16 rounded-lg border-2 p-1 transition-all cursor-pointer${lifecycleClassName} border-transparent bg-white/5 hover:bg-white/10 group-hover:border-primary/60 group-hover:bg-primary/10 group-hover:scale-110 group-hover:z-10`}
        >
          {tileImageUrl ? (
            <Image
              src={tileImageUrl}
              alt={relic.name}
              width={56}
              height={56}
              loading="lazy"
              className="w-full h-full object-contain"
              style={{
                filter: characterOutlineFilter(outlinePool) ?? "drop-shadow(0 2px 4px rgba(0,0,0,0.3))",
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs">
              ?
            </div>
          )}
        </div>
      </Link>
    </CardSideTipsAnchor>
  );
}
