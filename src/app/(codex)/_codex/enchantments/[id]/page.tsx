import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCodexAfflictions, getCodexCards, getCodexEnchantments, getCodexEvents, getCodexMonsters, getCodexPotions, getCodexPowers, getCodexRelics } from "@/lib/codex-data";
import { loadAllEntities } from "@/lib/load-all-entities";
import { getSTS2Patches, getSTS2Changes, getEntityVersionDiffs } from "@/lib/data";
import {
  getGameLocaleFromSearchRecord,
  getServiceLocaleFromSearchRecord,
} from "@/lib/i18n";
import { getCodexServiceMessages } from "@/lib/codex-service";
import { getCodexGameUiLabels } from "@/lib/codex-game-ui";
import {
  findCodexResourceByRouteId,
  getCodexResourceOgMetadata,
} from "@/lib/codex-resource-og";
import { loadCardSideTipCatalogSources } from "@/lib/card-side-tip-catalog.server";
import { EnchantmentDetail } from "@/components/codex/enchantment-detail";

export const dynamic = "force-static";
export const dynamicParams = false;

export async function generateStaticParams() {
  const [enchantments, afflictions] = await Promise.all([
    getCodexEnchantments(),
    getCodexAfflictions(),
  ]);
  return [...enchantments, ...afflictions].map((resource) => ({ id: resource.id.toLowerCase() }));
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolvedSearchParams);
  const gameLocale = getGameLocaleFromSearchRecord(resolvedSearchParams);
  const serviceText = getCodexServiceMessages(serviceLocale);
  const [enchantments, afflictions] = await Promise.all([
    getCodexEnchantments({ gameLocale }),
    getCodexAfflictions({ gameLocale }),
  ]);
  const ench = findCodexResourceByRouteId(enchantments, id);
  const affliction = findCodexResourceByRouteId(afflictions, id);
  const resource = ench ?? affliction;
  if (!resource) return {};
  return getCodexResourceOgMetadata(serviceLocale, serviceText.enchantmentsView.title, resource);
}

export default async function EnchantmentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolvedSearchParams);
  const gameLocale = getGameLocaleFromSearchRecord(resolvedSearchParams);
  const [enchantments, afflictions, cards, events, monsters, potions, powers, relics, entities, patches, changes, versionDiffs, gameUi, tipCatalogSources] = await Promise.all([
    getCodexEnchantments({ gameLocale }),
    getCodexAfflictions({ gameLocale }),
    getCodexCards({ includeDeprecated: true, gameLocale }),
    getCodexEvents({ gameLocale }),
    getCodexMonsters({ gameLocale }),
    getCodexPotions({ gameLocale }),
    getCodexPowers({ includeDeprecated: true, gameLocale }),
    getCodexRelics({ gameLocale }),
    loadAllEntities({ gameLocale }),
    getSTS2Patches(),
    getSTS2Changes(),
    getEntityVersionDiffs(),
    getCodexGameUiLabels(gameLocale),
    loadCardSideTipCatalogSources(gameLocale),
  ]);
  const ench = enchantments.find((e) => e.id.toLowerCase() === id.toLowerCase());
  const affliction = afflictions.find((a) => a.id.toLowerCase() === id.toLowerCase());
  if (!ench && !affliction) notFound();
  const serviceText = getCodexServiceMessages(serviceLocale);

  if (ench) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <EnchantmentDetail
          serviceLocale={serviceLocale}
          gameUi={gameUi}
          backToListTitle={serviceText.enchantmentsView.title}
          enchantment={ench}
          entities={entities}
          cards={cards}
          events={events}
          potions={potions}
          powers={powers}
          relics={relics}
          monsters={monsters}
          patches={patches}
          changes={changes}
          versionDiffs={versionDiffs}
          tipCatalogSources={tipCatalogSources}
          tipCatalogCards={cards}
          tipCatalogPowers={powers}
        />
      </div>
    );
  }

  if (!affliction) notFound();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <EnchantmentDetail
        serviceLocale={serviceLocale}
        gameUi={gameUi}
        backToListTitle={serviceText.enchantmentsView.title}
        affliction={affliction}
        entities={entities}
        monsters={monsters}
        cards={cards}
        powers={powers}
        patches={patches}
        changes={changes}
        tipCatalogSources={tipCatalogSources}
        tipCatalogCards={cards}
        tipCatalogPowers={powers}
      />
    </div>
  );
}
