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
  firstCodexImageUrl,
  getCodexResourceOgMetadata,
  plainCodexOgDescription,
} from "@/lib/codex-resource-og";
import { EncounterDetail } from "@/components/codex/encounter-detail";

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
  const encounterMonsterAssets = encounter.monsters
    .map((monsterRef) => monsters.find((monster) => monster.id === monsterRef.id))
    .flatMap((monster) => monster ? [monster.imageUrl, monster.bossImageUrl] : []);

  return getCodexResourceOgMetadata(serviceLocale, serviceText.encountersView.title, {
    name: encounter.name,
    description: plainCodexOgDescription(encounter.lossText) ||
      encounter.monsters.map((monster) => monster.name).join(", "),
    imageUrl: firstCodexImageUrl(encounter.imageUrl, ...encounterMonsterAssets),
  });
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
