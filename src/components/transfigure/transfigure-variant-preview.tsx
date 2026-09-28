"use client";

import { Sparkles } from "lucide-react";
import { PostRenderer } from "@/components/chemicalx/post-renderer";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { TransfigureResourcePreview } from "@/components/transfigure/transfigure-resource-preview";
import type { GameLocale, ServiceLocale } from "@/lib/i18n";
import {
  transfigureVariantEntityKey,
  type TransfigureVariant,
} from "@/lib/transfigure-types";
import { cn } from "@/lib/utils";

interface TransfigureVariantPreviewProps {
  variant: TransfigureVariant;
  entities: EntityInfo[];
  entityMap: Map<string, EntityInfo>;
  gameLocale: GameLocale;
  serviceLocale: ServiceLocale;
  upgradeLabel: string;
  showImageActions?: boolean;
  showUpgradeToggle?: boolean;
  fallbackClassName?: string;
}

export function TransfigureVariantPreview({
  variant,
  entities,
  entityMap,
  gameLocale,
  serviceLocale,
  upgradeLabel,
  showImageActions = false,
  showUpgradeToggle = false,
  fallbackClassName,
}: TransfigureVariantPreviewProps) {
  const resource = entityMap.get(transfigureVariantEntityKey(variant));
  if (!resource) {
    return (
      <div
        className={cn(
          "flex max-w-full flex-col items-center gap-3 text-sm leading-relaxed text-[#f0e6d2]",
          fallbackClassName,
        )}
      >
        <Sparkles className="h-8 w-8 text-primary/70" aria-hidden="true" />
        <PostRenderer
          blocks={variant.show_upgrade && variant.upgraded_content
            ? variant.upgraded_content
            : variant.content}
          entityMap={entityMap}
          serviceLocale={serviceLocale}
          gameLocale={gameLocale}
        />
      </div>
    );
  }

  return (
    <TransfigureResourcePreview
      blocks={variant.content}
      entities={entities}
      entityMap={entityMap}
      entity={resource}
      gameLocale={gameLocale}
      serviceLocale={serviceLocale}
      transformedName={variant.transformed_name}
      transformedCost={variant.transformed_cost}
      transformedStarCost={variant.transformed_star_cost}
      transformedCardType={variant.transformed_card_type}
      transformedCardRarity={variant.transformed_card_rarity}
      transformedCardColor={variant.transformed_card_color}
      cardKeywords={{
        top: variant.card_top_keywords,
        bottom: variant.card_bottom_keywords,
      }}
      transformedUpgradeCost={variant.transformed_upgrade_cost}
      transformedUpgradeStarCost={variant.transformed_upgrade_star_cost}
      omitEnergyCost={variant.omit_energy_cost}
      upgradedBlocks={variant.upgraded_content}
      upgradedCardKeywords={{
        top: variant.upgraded_card_top_keywords,
        bottom: variant.upgraded_card_bottom_keywords,
      }}
      upgradeLabel={upgradeLabel}
      initialShowUpgrade={variant.show_upgrade}
      showImageActions={showImageActions}
      showUpgradeToggle={showUpgradeToggle}
      tokenColor={variant.token_color}
      tokenWax={variant.token_wax}
    />
  );
}

export function transfigureVariantDisplayName(
  variant: TransfigureVariant,
  entityMap: Map<string, EntityInfo>,
): string {
  const resource = entityMap.get(transfigureVariantEntityKey(variant));
  const name = variant.transformed_name?.trim() || resource?.nameKo || variant.resource_id;
  return variant.show_upgrade && resource?.type === "card" ? `${name}+` : name;
}
