import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCodexMonsters, getCodexEncounters } from "@/lib/codex-data";
import { getSTS2Changes, getSTS2Patches } from "@/lib/data";
import {
  getGameLocaleFromSearchRecord,
  getServiceLocaleFromSearchRecord,
} from "@/lib/i18n";
import { getCodexServiceMessages } from "@/lib/codex-service";
import { getCodexGameUiLabels } from "@/lib/codex-game-ui";
import {
  getCodexEncounterOgResource,
  getCodexResourceOgMetadata,
} from "@/lib/codex-resource-og";
import { EncounterDetail } from "@/components/codex/encounter-detail";

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
  const serviceText = getCodexServiceMessages(serviceLocale);
  const [encounters, monsters] = await Promise.all([
    getCodexEncounters({ gameLocale }),
    getCodexMonsters({ gameLocale }),
  ]);
  const encounter = encounters.find((e) => e.id.toLowerCase() === id.toLowerCase());
  if (!encounter) return {};
  return getCodexResourceOgMetadata(
    serviceLocale,
    serviceText.encountersView.title,
    getCodexEncounterOgResource(encounter, monsters, gameLocale),
  );
}

export default async function EncounterDetailPage({
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
  const serviceText = getCodexServiceMessages(serviceLocale);
  const [encounters, monsters, patches, changes, gameUi] = await Promise.all([
    getCodexEncounters({ gameLocale }),
    getCodexMonsters({ gameLocale }),
    getSTS2Patches(),
    getSTS2Changes(),
    getCodexGameUiLabels(gameLocale),
  ]);
  const encounter = encounters.find((e) => e.id.toLowerCase() === id.toLowerCase());
  if (!encounter) notFound();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <EncounterDetail
        serviceLocale={serviceLocale}
        gameUi={gameUi}
        backToListTitle={serviceText.encountersView.backToList}
        encounter={encounter}
        monsters={monsters}
        patches={patches}
        changes={changes}
      />
    </div>
  );
}
