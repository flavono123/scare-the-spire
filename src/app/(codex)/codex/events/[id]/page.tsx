import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getCodexCards,
  getCodexEnchantments,
  getCodexEvents,
  getCodexPotions,
  getCodexPowers,
  getCodexRelics,
  getMadScienceBaseCard,
} from "@/lib/codex-data";
import { getSTS2Patches, getSTS2Changes, getEntityVersionDiffs } from "@/lib/data";
import {
  getGameLocaleFromSearchRecord,
  getServiceLocaleFromSearchRecord,
} from "@/lib/i18n";
import { getCodexGameUiLabels } from "@/lib/codex-game-ui";
import {
  findCodexResourceByRouteId,
  getCodexResourceOgMetadata,
} from "@/lib/codex-resource-og";
import { EventDetail } from "@/components/codex/event-detail";

export const dynamic = "force-static";

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
  const [events, gameUi] = await Promise.all([
    getCodexEvents({ gameLocale }),
    getCodexGameUiLabels(gameLocale),
  ]);
  const event = findCodexResourceByRouteId(events, id);
  if (!event) return {};
  return getCodexResourceOgMetadata(serviceLocale, gameUi.eventsTitle, event);
}

export default async function EventDetailPage({
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
  const [events, cards, enchantments, relics, powers, patches, changes, versionDiffs, gameUi, madScienceBaseCard, potions] = await Promise.all([
    getCodexEvents({ gameLocale }),
    getCodexCards({ includeDeprecated: true, gameLocale }),
    getCodexEnchantments({ gameLocale }),
    getCodexRelics({ gameLocale }),
    getCodexPowers({ includeDeprecated: true, gameLocale }),
    getSTS2Patches(),
    getSTS2Changes(),
    getEntityVersionDiffs(),
    getCodexGameUiLabels(gameLocale),
    getMadScienceBaseCard({ gameLocale }),
    getCodexPotions({ gameLocale }),
  ]);
  const event = events.find((e) => e.id.toLowerCase() === id.toLowerCase());
  if (!event) notFound();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <EventDetail
        serviceLocale={serviceLocale}
        gameUi={gameUi}
        event={event}
        cards={cards}
        enchantments={enchantments}
        madScienceBaseCard={madScienceBaseCard}
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
