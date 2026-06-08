import {
  getCodexAfflictions,
  getCodexAncients,
  getCodexCards,
  getCodexCharacters,
  getCodexEnchantments,
  getCodexEncounters,
  getCodexEpochs,
  getCodexEvents,
  getCodexMonsters,
  getCodexPotions,
  getCodexPowers,
  getCodexRelics,
  getMadScienceBaseCard,
} from "@/lib/codex-data";
import { getCodexGameUiLabels } from "@/lib/codex-game-ui";
import { getEntityVersionDiffs, getSTS2Changes, getSTS2Patches } from "@/lib/data";
import {
  DEFAULT_GAME_LOCALE_BY_SERVICE,
  DEFAULT_SERVICE_LOCALE,
} from "@/lib/i18n";
import type { CompendiumDetailPayload } from "@/lib/compendium-detail-payload";

export async function buildCompendiumDetailPayload(): Promise<CompendiumDetailPayload> {
  const serviceLocale = DEFAULT_SERVICE_LOCALE;
  const gameLocale = DEFAULT_GAME_LOCALE_BY_SERVICE[serviceLocale];

  const [
    afflictions,
    ancients,
    cards,
    characters,
    enchantments,
    encounters,
    epochs,
    events,
    monsters,
    potions,
    powers,
    relics,
    madScienceBaseCard,
    gameUi,
    patches,
    changes,
    versionDiffs,
  ] = await Promise.all([
    getCodexAfflictions({ gameLocale }),
    getCodexAncients({ gameLocale }),
    getCodexCards({ includeDeprecated: true, gameLocale }),
    getCodexCharacters({ gameLocale }),
    getCodexEnchantments({ gameLocale }),
    getCodexEncounters({ gameLocale }),
    getCodexEpochs({ gameLocale }),
    getCodexEvents({ gameLocale }),
    getCodexMonsters({ gameLocale }),
    getCodexPotions({ gameLocale }),
    getCodexPowers({ includeDeprecated: true, gameLocale }),
    getCodexRelics({ gameLocale }),
    getMadScienceBaseCard({ gameLocale }),
    getCodexGameUiLabels(gameLocale),
    getSTS2Patches(),
    getSTS2Changes(),
    getEntityVersionDiffs(),
  ]);

  return {
    serviceLocale,
    gameLocale,
    gameUi,
    resources: {
      afflictions,
      ancients,
      cards,
      characters,
      enchantments,
      encounters,
      epochs,
      events,
      monsters,
      potions,
      powers,
      relics,
      madScienceBaseCard,
    },
    history: {
      patches,
      changes,
      versionDiffs,
    },
  };
}
