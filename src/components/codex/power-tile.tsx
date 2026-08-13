"use client";

import { useMemo, memo } from "react";
import Link from "next/link";
import Image from "@/components/ui/static-image";
import { localizeHref, type ServiceLocale } from "@/lib/i18n";
import { buildCompendiumResourceDetailHref } from "@/lib/compendium-resource-links";
import type { CodexGameUiLabels } from "@/lib/codex-game-ui";
import type { CodexAffliction, CodexCard, CodexMonster, CodexPower } from "@/lib/codex-types";
import {
  createCardSideTipCatalog,
  type CardSideTipCatalogSources,
} from "@/lib/card-side-tip-catalog";
import { collectPowerSideTips } from "@/lib/power-side-tips";
import { CardSideTipsAnchor } from "./card-keyword-tip-stack";

const TYPE_STYLES: Record<string, { idle: string; hover: string }> = {
  Buff: {
    idle: "border-transparent bg-white/5",
    hover: "hover:border-green-500/60 hover:bg-green-500/10 hover:z-10 hover:scale-110",
  },
  Debuff: {
    idle: "border-transparent bg-white/5",
    hover: "hover:border-red-500/60 hover:bg-red-500/10 hover:z-10 hover:scale-110",
  },
  None: {
    idle: "border-transparent bg-white/5",
    hover: "hover:border-zinc-500/60 hover:bg-zinc-500/10 hover:z-10 hover:scale-110",
  },
};

interface PowerTileProps {
  serviceLocale?: ServiceLocale;
  gameUi: CodexGameUiLabels;
  power: CodexPower;
  showBeta?: boolean;
  onClick?: () => void;
  tipCatalogSources?: CardSideTipCatalogSources;
  tipCatalogCards?: readonly CodexCard[];
  tipCatalogPowers?: readonly CodexPower[];
  tipCatalogMonsters?: readonly CodexMonster[];
  tipCatalogAfflictions?: readonly CodexAffliction[];
}

export const PowerTile = memo(function PowerTile({
  serviceLocale = "ko",
  power,
  showBeta = false,
  onClick,
  tipCatalogSources,
  tipCatalogCards = [],
  tipCatalogPowers = [],
  tipCatalogMonsters = [],
  tipCatalogAfflictions = [],
}: PowerTileProps) {
  const style = TYPE_STYLES[power.type] ?? TYPE_STYLES.None;
  const imageUrl = showBeta && power.betaImageUrl ? power.betaImageUrl : power.imageUrl;
  const lifecycleClassName = power.deprecated ? " opacity-50 grayscale saturate-0" : "";

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

  const afflictionsById = useMemo(
    () => new Map(tipCatalogAfflictions.map((item) => [item.id, item])),
    [tipCatalogAfflictions],
  );

  const sideTips = useMemo(() => {
    if (!tipCatalog) return [];
    return collectPowerSideTips(power, tipCatalog, {
      includeSelf: true,
      afflictionsById,
    });
  }, [power, tipCatalog, afflictionsById]);

  return (
    <CardSideTipsAnchor mode="hover" preferSide="right" tips={sideTips} className="relative">
      <Link
        href={localizeHref(buildCompendiumResourceDetailHref("power", power.id), serviceLocale)}
        className="relative group"
        onClick={(event) => {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
          event.preventDefault();
          onClick?.();
        }}
      >
        <div
          className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full border-2 p-1 transition-all cursor-pointer${lifecycleClassName} ${style.idle} ${style.hover}`}
        >
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={power.name}
              width={56}
              height={56}
              loading="lazy"
              className="w-full h-full object-contain drop-shadow-md"
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
});
