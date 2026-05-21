import { Suspense } from "react";
import type { Metadata } from "next";
import { getCodexCards, getCodexEncounters, getCodexMonsters, getCodexPotions, getCodexRelics } from "@/lib/codex-data";
import {
  getGameLocaleFromSearchRecord,
  getServiceLocaleFromSearchRecord,
} from "@/lib/i18n";
import { getCodexMetadata } from "@/lib/codex-service";
import { getCodexGameUiLabels } from "@/lib/codex-game-ui";
import { MonsterLibrary } from "@/components/codex/monster-library";

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

export default async function CodexMonstersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolvedSearchParams);
  const gameLocale = getGameLocaleFromSearchRecord(resolvedSearchParams);
  const [monsters, encounters, cards, potions, relics, gameUi] = await Promise.all([
    getCodexMonsters({ gameLocale }),
    getCodexEncounters({ gameLocale }),
    getCodexCards({ gameLocale }),
    getCodexPotions({ gameLocale }),
    getCodexRelics({ gameLocale }),
    getCodexGameUiLabels(gameLocale),
  ]);

  return (
    <Suspense>
      <MonsterLibrary
        serviceLocale={serviceLocale}
        gameUi={gameUi}
        title={gameUi.bestiaryTitle}
        monsters={monsters}
        encounters={encounters}
        cards={cards}
        potions={potions}
        relics={relics}
      />
    </Suspense>
  );
}
