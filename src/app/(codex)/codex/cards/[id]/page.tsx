import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCodexAfflictions, getCodexAncients, getCodexCards, getCodexEnchantments, getCodexEvents, getCodexMonsters, getCodexPotions, getCodexPowers } from "@/lib/codex-data";
import { getSTS2Patches, getSTS2Changes, getEntityVersionDiffs } from "@/lib/data";
import {
  getGameLocaleFromSearchRecord,
  getServiceLocaleFromSearchRecord,
} from "@/lib/i18n";
import { getCodexMetadata } from "@/lib/codex-service";
import { getCodexGameUiLabels } from "@/lib/codex-game-ui";
import { stripCodexMarkup } from "@/lib/codex-search";
import { DEFAULT_PAGE_OG_IMAGE } from "@/lib/page-og-images";
import { CardDetail } from "@/components/codex/card-detail";
import {
  getMadScienceCardTypeFromId,
  getMadScienceVariantId,
} from "@/lib/tinker-time";

function findCardByRouteId<T extends { id: string }>(cards: T[], id: string): T | undefined {
  const madScienceType = getMadScienceCardTypeFromId(id);
  const resolvedId = madScienceType ? getMadScienceVariantId(madScienceType) : id;
  return cards.find((c) => c.id.toLowerCase() === resolvedId.toLowerCase());
}

function cardOgDescription(description: string): string {
  return stripCodexMarkup(description).replace(/\s+/g, " ").trim();
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
  const card = findCardByRouteId(cards, id);
  if (!card) return {};
  const metadata = getCodexMetadata(serviceLocale, `${card.name} — ${gameUi.cardLibraryTitle}`);
  const description = cardOgDescription(card.description);
  const imageUrl = card.imageUrl ?? card.betaImageUrl ?? DEFAULT_PAGE_OG_IMAGE.url;
  const image = {
    url: imageUrl,
    width: 1000,
    height: 760,
    alt: card.name,
  };

  return {
    ...metadata,
    description,
    openGraph: {
      title: card.name,
      description,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: card.name,
      description,
      images: [imageUrl],
    },
  };
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
  const card = findCardByRouteId(cards, id);
  if (!card) notFound();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <CardDetail serviceLocale={serviceLocale} gameUi={gameUi} card={card} enchantments={enchantments} afflictions={afflictions} relatedAncients={ancients} relatedEvents={events} relatedMonsters={monsters} relatedPotions={potions} relatedPowers={powers} patches={patches} changes={changes} versionDiffs={versionDiffs} />
    </div>
  );
}
