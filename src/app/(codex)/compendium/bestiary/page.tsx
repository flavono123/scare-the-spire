import { Suspense } from "react";
import type { Metadata } from "next";
import {
  getCodexAfflictions,
  getCodexEncounters,
  getCodexCards,
  getCodexMonsters,
  getCodexPowers,
} from "@/lib/codex-data";
import { getSTS2Patches, getSTS2Changes } from "@/lib/data";
import { getServiceLocaleForGameLocale, type GameLocale } from "@/lib/i18n";
import { DEFAULT_ROUTE_GAME_LOCALE } from "@/lib/locale-routing";
import { getCodexMetadata } from "@/lib/codex-service";
import { getCodexGameUiLabels } from "@/lib/codex-game-ui";
import { BestiaryLibrary } from "@/components/codex/bestiary-library";

export const dynamic = "force-static";

export async function generateCompendiumBestiaryMetadata(
  gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE,
): Promise<Metadata> {
  const serviceLocale = getServiceLocaleForGameLocale(gameLocale);
  const gameUi = await getCodexGameUiLabels(gameLocale);
  return getCodexMetadata(serviceLocale, gameUi.bestiaryTitle);
}

export async function generateMetadata(): Promise<Metadata> {
  return generateCompendiumBestiaryMetadata();
}

export async function renderCompendiumBestiaryPage(
  gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE,
) {
  const serviceLocale = getServiceLocaleForGameLocale(gameLocale);
  const [monsters, encounters, afflictions, cards, powers, patches, changes, gameUi] = await Promise.all([
    getCodexMonsters({ gameLocale }),
    getCodexEncounters({ gameLocale }),
    getCodexAfflictions({ gameLocale }),
    getCodexCards({ includeDeprecated: true, gameLocale }),
    getCodexPowers({ includeDeprecated: true, gameLocale }),
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
        afflictions={afflictions}
        cards={cards}
        powers={powers}
        patches={patches}
        changes={changes}
      />
    </Suspense>
  );
}

export default async function CompendiumBestiaryPage() {
  return renderCompendiumBestiaryPage();
}
