"use client";

import { useMemo, memo } from "react";
import Link from "next/link";
import Image from "@/components/ui/static-image";
import { localizeHref, type ServiceLocale } from "@/lib/i18n";
import { buildCompendiumResourceDetailHref } from "@/lib/compendium-resource-links";
import type { CodexAffliction, CodexCard, CodexEnchantment, CodexMonster, CodexPower } from "@/lib/codex-types";
import {
  createCardSideTipCatalog,
  type CardSideTipCatalogSources,
} from "@/lib/card-side-tip-catalog";
import { collectAfflictionSideTips } from "@/lib/affliction-side-tips";
import { collectEnchantmentSideTips } from "@/lib/enchantment-side-tips";
import { CardSideTipsAnchor } from "./card-keyword-tip-stack";

interface EnchantmentTileProps {
  serviceLocale?: ServiceLocale;
  resource: CodexEnchantment | CodexAffliction;
  resourceKind?: "enchantment" | "affliction";
  onClick?: () => void;
  tipCatalogSources?: CardSideTipCatalogSources;
  tipCatalogCards?: readonly CodexCard[];
  tipCatalogPowers?: readonly CodexPower[];
  tipCatalogMonsters?: readonly CodexMonster[];
}

export const EnchantmentTile = memo(function EnchantmentTile({
  serviceLocale = "ko",
  resource,
  resourceKind,
  onClick,
  tipCatalogSources,
  tipCatalogCards = [],
  tipCatalogPowers = [],
  tipCatalogMonsters = [],
}: EnchantmentTileProps) {
  const resolvedKind: "enchantment" | "affliction" =
    resourceKind ?? ("cardType" in resource ? "enchantment" : "affliction");
  const lifecycleClassName = resource.deprecated ? " opacity-50 grayscale saturate-0" : "";

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

  const sideTips = useMemo(() => {
    if (!tipCatalog) return [];
    if (resolvedKind === "affliction") {
      return collectAfflictionSideTips(resource as CodexAffliction, tipCatalog, {
        includeSelf: true,
      });
    }
    return collectEnchantmentSideTips(resource as CodexEnchantment, tipCatalog, {
      includeSelf: true,
    });
  }, [resource, resolvedKind, tipCatalog]);

  return (
    <CardSideTipsAnchor mode="hover" preferSide="right" tips={sideTips} className="relative">
      <Link
        href={localizeHref(buildCompendiumResourceDetailHref("enchantment", resource.id), serviceLocale)}
        className="relative group"
        onClick={(event) => {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
          event.preventDefault();
          onClick?.();
        }}
      >
        <div
          className={`w-14 h-14 sm:w-16 sm:h-16 rounded-lg border-2 p-1 transition-all cursor-pointer${lifecycleClassName} border-transparent bg-white/5 hover:bg-white/10 hover:z-10 hover:scale-110 hover:border-purple-500/60 hover:bg-purple-500/10`}
        >
          {resource.imageUrl ? (
            <Image
              src={resource.imageUrl}
              alt={resource.name}
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
