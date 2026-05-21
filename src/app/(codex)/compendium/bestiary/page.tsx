import { Suspense } from "react";
import type { Metadata } from "next";
import {
  getCodexEncounters,
  getCodexMonsters,
} from "@/lib/codex-data";
import { getSTS2Patches, getSTS2Changes } from "@/lib/data";
import {
  getGameLocaleFromSearchRecord,
  getServiceLocaleFromSearchRecord,
} from "@/lib/i18n";
import { getCodexMetadata } from "@/lib/codex-service";
import { getCodexGameUiLabels } from "@/lib/codex-game-ui";
import { BestiaryLibrary } from "@/components/codex/bestiary-library";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const resolvedSearchParams = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolvedSearchParams);
  const gameLocale = getGameLocaleFromSearchRecord(resolvedSearchParams);
  const gameUi = await getCodexGameUiLabels(gameLocale);
  return getCodexMetadata(serviceLocale, gameUi.bestiaryTitle);
}

export default async function CompendiumBestiaryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolvedSearchParams);
  const gameLocale = getGameLocaleFromSearchRecord(resolvedSearchParams);
  const [monsters, encounters, patches, changes, gameUi] = await Promise.all([
    getCodexMonsters({ gameLocale }),
    getCodexEncounters({ gameLocale }),
    getSTS2Patches(),
    getSTS2Changes(),
    getCodexGameUiLabels(gameLocale),
  ]);

  return (
    <Suspense>
      <BestiaryLibrary
        serviceLocale={serviceLocale}
        gameUi={gameUi}
        monsters={monsters}
        encounters={encounters}
        patches={patches}
        changes={changes}
      />
    </Suspense>
  );
}
