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
import { getCodexMetadata } from "@/lib/codex-service";
import { getCodexGameUiLabels } from "@/lib/codex-game-ui";
import { loadAllEntities } from "@/lib/load-all-entities";
import { EpochDetail } from "@/components/codex/epoch-detail";

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
  const epoch = epochs.find((item) => item.id.toLowerCase() === id.toLowerCase());
  if (!epoch) return {};
  return getCodexMetadata(serviceLocale, `${epoch.name} — ${gameUi.epochsTitle}`);
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
  const [epochs, cards, relics, potions, ancients, entities, gameUi] = await Promise.all([
    getCodexEpochs({ gameLocale }),
    getCodexCards({ gameLocale }),
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
      />
    </div>
  );
}
