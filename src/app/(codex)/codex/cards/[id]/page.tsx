import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCodexAfflictions, getCodexAncients, getCodexCards, getCodexEnchantments, getCodexEvents, getCodexMonsters, getCodexPotions, getCodexPowers } from "@/lib/codex-data";
import { getSTS2Patches, getSTS2Changes, getEntityVersionDiffs } from "@/lib/data";
import {
  getGameLocaleFromSearchRecord,
  getServiceLocaleFromSearchRecord,
} from "@/lib/i18n";
import { getCodexGameUiLabels } from "@/lib/codex-game-ui";
import {
  findCardByCodexRouteId,
  getCodexCardOgMetadata,
  isBetaArtSearchParam,
} from "@/lib/codex-card-og";
import { CardDetail } from "@/components/codex/card-detail";

export const dynamic = "force-static";
export const dynamicParams = false;

export async function generateStaticParams() {
  const cards = await getCodexCards({ includeDeprecated: true });
  return cards.map((card) => ({ id: card.id.toLowerCase() }));
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
  const [cards, gameUi] = await Promise.all([
    getCodexCards({ includeDeprecated: true, gameLocale }),
    getCodexGameUiLabels(gameLocale),
  ]);
  const card = findCardByCodexRouteId(cards, id);
  if (!card) return {};
  return getCodexCardOgMetadata(serviceLocale, gameUi.cardLibraryTitle, card, {
    useBetaArt: isBetaArtSearchParam(resolvedSearchParams.beta),
  });
}

export default async function CardDetailPage({
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
  const showBetaArt = isBetaArtSearchParam(resolvedSearchParams.beta);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <CardDetail serviceLocale={serviceLocale} gameUi={gameUi} card={card} enchantments={enchantments} afflictions={afflictions} relatedAncients={ancients} relatedEvents={events} relatedMonsters={monsters} relatedPotions={potions} relatedPowers={powers} patches={patches} changes={changes} versionDiffs={versionDiffs} initialShowBeta={showBetaArt} syncBetaSearchParam />
    </div>
  );
}
