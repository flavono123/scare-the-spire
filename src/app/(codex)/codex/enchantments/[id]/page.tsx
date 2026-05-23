import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCodexAfflictions, getCodexCards, getCodexEnchantments, getCodexEvents, getCodexMonsters, getCodexPotions, getCodexPowers, getCodexRelics } from "@/lib/codex-data";
import { loadAllEntities } from "@/lib/load-all-entities";
import { getSTS2Patches, getSTS2Changes, getEntityVersionDiffs } from "@/lib/data";
import {
  getGameLocaleFromSearchRecord,
  getServiceLocaleFromSearchRecord,
} from "@/lib/i18n";
import { getCodexMetadata, getCodexServiceMessages } from "@/lib/codex-service";
import { getCodexGameUiLabels } from "@/lib/codex-game-ui";
import { EnchantmentDetail } from "@/components/codex/enchantment-detail";

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
  const ench = enchantments.find((e) => e.id.toLowerCase() === id.toLowerCase());
  const affliction = afflictions.find((a) => a.id.toLowerCase() === id.toLowerCase());
  const resource = ench ?? affliction;
  if (!resource) return {};
  return getCodexMetadata(serviceLocale, `${resource.name} — ${serviceText.enchantmentsView.title}`);
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
  const [enchantments, afflictions, cards, events, monsters, potions, powers, relics, entities, patches, changes, versionDiffs, gameUi] = await Promise.all([
    getCodexEnchantments({ gameLocale }),
    getCodexAfflictions({ gameLocale }),
    getCodexCards({ gameLocale }),
    getCodexEvents({ gameLocale }),
    getCodexMonsters({ gameLocale }),
    getCodexPotions({ gameLocale }),
    getCodexPowers({ gameLocale }),
    getCodexRelics({ gameLocale }),
    loadAllEntities({ gameLocale }),
    getSTS2Patches(),
    getSTS2Changes(),
    getEntityVersionDiffs(),
    getCodexGameUiLabels(gameLocale),
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
          patches={patches}
          changes={changes}
          versionDiffs={versionDiffs}
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
        patches={patches}
        changes={changes}
      />
    </div>
  );
}
