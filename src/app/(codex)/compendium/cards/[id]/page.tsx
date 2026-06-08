import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCodexAfflictions, getCodexAncients, getCodexCards, getCodexEnchantments, getCodexEvents, getCodexMonsters, getCodexPotions, getCodexPowers } from "@/lib/codex-data";
import { getSTS2Patches, getSTS2Changes, getEntityVersionDiffs } from "@/lib/data";
import { getCodexGameUiLabels } from "@/lib/codex-game-ui";
import {
  findCardByCodexRouteId,
  getCodexCardOgMetadata,
} from "@/lib/codex-card-og";
import { getLocalePair } from "@/lib/locale-routing";
import { CardDetail } from "@/components/codex/card-detail";

export const dynamic = "force-static";
export const dynamicParams = false;

export async function generateStaticParams() {
  const cards = await getCodexCards({ includeDeprecated: true });
  return cards.map((card) => ({ id: card.id.toLowerCase() }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const { serviceLocale, gameLocale } = getLocalePair();
  const [cards, gameUi] = await Promise.all([
    getCodexCards({ includeDeprecated: true, gameLocale }),
    getCodexGameUiLabels(gameLocale),
  ]);
  const card = findCardByCodexRouteId(cards, id);
  if (!card) return {};
  return getCodexCardOgMetadata(serviceLocale, gameUi.cardLibraryTitle, card);
}

export default async function CardDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { serviceLocale, gameLocale } = getLocalePair();
  const [cards, enchantments, afflictions, patches, changes, versionDiffs, gameUi, ancients, events, monsters, potions, powers] = await Promise.all([
    getCodexCards({ includeDeprecated: true, gameLocale }),
    getCodexEnchantments({ gameLocale }),
    getCodexAfflictions({ gameLocale }),
    getSTS2Patches(),
    getSTS2Changes(),
    getEntityVersionDiffs(),
    getCodexGameUiLabels(gameLocale),
    getCodexAncients({ gameLocale }),
    getCodexEvents({ gameLocale }),
    getCodexMonsters({ gameLocale }),
    getCodexPotions({ gameLocale }),
    getCodexPowers({ includeDeprecated: true, gameLocale }),
  ]);
  const card = findCardByCodexRouteId(cards, id);
  if (!card) notFound();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <CardDetail serviceLocale={serviceLocale} gameUi={gameUi} card={card} enchantments={enchantments} afflictions={afflictions} relatedAncients={ancients} relatedEvents={events} relatedMonsters={monsters} relatedPotions={potions} relatedPowers={powers} patches={patches} changes={changes} versionDiffs={versionDiffs} syncBetaSearchParam />
    </div>
  );
}
