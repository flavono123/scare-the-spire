import { Suspense } from "react";
import type { Metadata } from "next";
import { isPublicBestiaryMonster } from "@/lib/bestiary-monster-policy";
import {
  getCodexEncounters,
  getCodexCharacters,
  getCodexMonsters,
} from "@/lib/codex-data";
import { getCodexMeta, getEntityVersionDiffs, getSTS2Patches } from "@/lib/data";
import { getVersionsWithDiffs } from "@/lib/entity-versioning";
import { getServiceLocaleForGameLocale, type GameLocale } from "@/lib/i18n";
import { DEFAULT_ROUTE_GAME_LOCALE } from "@/lib/locale-routing";
import { getCodexMetadata, getCodexServiceMessages } from "@/lib/codex-service";
import { getCodexGameUiLabels } from "@/lib/codex-game-ui";
import { BestiaryLibraryLoader } from "@/components/codex/bestiary-library-loader";
import { CompendiumEntryLinkIndex } from "@/components/codex/compendium-entry-link-index";

export async function generateCompendiumBestiaryMetadata(
  gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE,
): Promise<Metadata> {
  const serviceLocale = getServiceLocaleForGameLocale(gameLocale);
  const gameUi = await getCodexGameUiLabels(gameLocale);
  return getCodexMetadata(serviceLocale, gameUi.bestiaryTitle, "/compendium/bestiary");
}

export async function renderCompendiumBestiaryPage(
  gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE,
) {
  const serviceLocale = getServiceLocaleForGameLocale(gameLocale);
  const [monsters, characters, encounters, patches, versionDiffs, meta, gameUi] = await Promise.all([
    getCodexMonsters({ gameLocale }),
    getCodexCharacters({ gameLocale }),
    getCodexEncounters({ gameLocale }),
    getSTS2Patches(),
    getEntityVersionDiffs(gameLocale),
    getCodexMeta(),
    getCodexGameUiLabels(gameLocale),
  ]);
  const versions = getVersionsWithDiffs(patches, versionDiffs);
  const serviceText = getCodexServiceMessages(serviceLocale);
  return (
    <>
      <Suspense>
        <BestiaryLibraryLoader
          gameLocale={gameLocale}
          serviceLocale={serviceLocale}
          gameUi={gameUi}
          monsters={monsters}
          characters={characters}
          encounters={encounters}
          patches={patches}
          versions={versions}
          currentVersion={meta.version}
        />
      </Suspense>
      <CompendiumEntryLinkIndex
        gameLocale={gameLocale}
        title={gameUi.bestiaryTitle}
        groups={[
          {
            type: "monster",
            entries: monsters.filter((monster) => monster.showInCompendium && isPublicBestiaryMonster(monster.id)),
          },
          { type: "encounter", heading: serviceText.encounters, entries: encounters },
        ]}
      />
    </>
  );
}
