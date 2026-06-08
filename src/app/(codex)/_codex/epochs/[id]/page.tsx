import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getCodexAncients,
  getCodexCards,
  getCodexEpochs,
  getCodexPotions,
  getCodexRelics,
} from "@/lib/codex-data";
import {
  getGameLocaleFromSearchRecord,
  getServiceLocaleFromSearchRecord,
} from "@/lib/i18n";
import { getCodexGameUiLabels } from "@/lib/codex-game-ui";
import { loadAllEntities } from "@/lib/load-all-entities";
import {
  findCodexResourceByRouteId,
  getCodexResourceOgMetadata,
} from "@/lib/codex-resource-og";
import { isBetaArtSearchParam } from "@/lib/codex-card-og";
import { EpochDetail } from "@/components/codex/epoch-detail";

export const dynamic = "force-static";
export const dynamicParams = false;

export async function generateStaticParams() {
  const epochs = await getCodexEpochs();
  return epochs.map((epoch) => ({ id: epoch.id.toLowerCase() }));
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
  const [epochs, gameUi] = await Promise.all([
    getCodexEpochs({ gameLocale }),
    getCodexGameUiLabels(gameLocale),
  ]);
  const epoch = findCodexResourceByRouteId(epochs, id);
  if (!epoch) return {};
  const useBetaArt = isBetaArtSearchParam(resolvedSearchParams.beta);
  return getCodexResourceOgMetadata(serviceLocale, gameUi.epochsTitle, {
    ...epoch,
    imageUrl: useBetaArt ? epoch.betaImageUrl ?? epoch.imageUrl : epoch.imageUrl,
  });
}

export default async function EpochDetailPage({
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
  const showBetaArt = isBetaArtSearchParam(resolvedSearchParams.beta);
  const [epochs, cards, relics, potions, ancients, entities, gameUi] = await Promise.all([
    getCodexEpochs({ gameLocale }),
    getCodexCards({ includeDeprecated: true, gameLocale }),
    getCodexRelics({ gameLocale }),
    getCodexPotions({ gameLocale }),
    getCodexAncients({ gameLocale }),
    loadAllEntities({ gameLocale }),
    getCodexGameUiLabels(gameLocale),
  ]);
  const epoch = epochs.find((item) => item.id.toLowerCase() === id.toLowerCase());
  if (!epoch) notFound();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <EpochDetail
        serviceLocale={serviceLocale}
        gameUi={gameUi}
        epoch={epoch}
        cards={cards}
        relics={relics}
        potions={potions}
        ancients={ancients}
        epochs={epochs}
        entities={entities}
        initialShowBeta={showBetaArt}
        syncBetaSearchParam
      />
    </div>
  );
}
