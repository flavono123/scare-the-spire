import { loadCardSideTipCatalogSources } from "@/lib/card-side-tip-catalog.server";
import {
  getCodexAfflictions,
  getCodexAncients,
  getCodexAscensions,
  getCodexCards,
  getCodexCharacters,
  getCodexEnchantments,
  getCodexEncounters,
  getCodexEpochs,
  getCodexEvents,
  getCodexKeywords,
  getCodexModifiers,
  getCodexMonsters,
  getCodexPotions,
  getCodexPowers,
  getCodexRelics,
  getMadScienceBaseCard,
} from "@/lib/codex-data";
import { getCodexGameUiLabels } from "@/lib/codex-game-ui";
import {
  COMPENDIUM_DATA_CHUNK_KEYS,
  compendiumDataChunkPath,
  isSharedCompendiumDataChunk,
  type CompendiumDataChunkName,
  type CompendiumDataResources,
} from "@/lib/compendium-data-chunks";
import { getEntityVersionDiffs, getSTS2Changes, getSTS2Patches } from "@/lib/data";
import { GAME_LOCALES, type GameLocale } from "@/lib/i18n";

/**
 * Loads every Compendium resource with the same options the Compendium pages
 * use, so client chunks match what the pages used to receive as props.
 */
export async function loadCompendiumDataResources(
  gameLocale: GameLocale,
): Promise<CompendiumDataResources> {
  const [
    afflictions,
    ancients,
    ascensions,
    cardSideTipSources,
    cards,
    changes,
    characters,
    enchantments,
    encounters,
    epochs,
    events,
    gameUi,
    keywords,
    madScienceBaseCard,
    modifiers,
    monsters,
    patches,
    potions,
    powers,
    relics,
    versionDiffs,
  ] = await Promise.all([
    getCodexAfflictions({ gameLocale }),
    getCodexAncients({ gameLocale }),
    getCodexAscensions({ gameLocale }),
    loadCardSideTipCatalogSources(gameLocale),
    getCodexCards({ includeDeprecated: true, gameLocale }),
    getSTS2Changes(),
    getCodexCharacters({ gameLocale }),
    getCodexEnchantments({ gameLocale }),
    getCodexEncounters({ gameLocale }),
    getCodexEpochs({ gameLocale }),
    getCodexEvents({ gameLocale }),
    getCodexGameUiLabels(gameLocale),
    getCodexKeywords({ gameLocale }),
    getMadScienceBaseCard({ gameLocale }),
    getCodexModifiers({ gameLocale }),
    getCodexMonsters({ gameLocale }),
    getSTS2Patches(),
    getCodexPotions({ gameLocale }),
    getCodexPowers({ includeDeprecated: true, gameLocale }),
    getCodexRelics({ gameLocale }),
    getEntityVersionDiffs(gameLocale),
  ]);

  return {
    afflictions,
    ancients,
    ascensions,
    cardSideTipSources,
    cards,
    changes,
    characters,
    enchantments,
    encounters,
    epochs,
    events,
    gameUi,
    keywords,
    madScienceBaseCard,
    modifiers,
    monsters,
    patches,
    potions,
    powers,
    relics,
    versionDiffs,
  };
}

export type CompendiumDataChunkFile = {
  path: string;
  data: Partial<CompendiumDataResources>;
};

function pickChunk(
  resources: CompendiumDataResources,
  chunk: CompendiumDataChunkName,
): Partial<CompendiumDataResources> {
  return Object.fromEntries(
    COMPENDIUM_DATA_CHUNK_KEYS[chunk].map((key) => [key, resources[key]]),
  ) as Partial<CompendiumDataResources>;
}

/** One file per (game locale, chunk); locale-independent chunks are written once. */
export async function buildCompendiumDataChunkFiles(): Promise<CompendiumDataChunkFile[]> {
  const files: CompendiumDataChunkFile[] = [];
  const chunks = Object.keys(COMPENDIUM_DATA_CHUNK_KEYS) as CompendiumDataChunkName[];

  for (const gameLocale of GAME_LOCALES) {
    const resources = await loadCompendiumDataResources(gameLocale);
    for (const chunk of chunks) {
      if (isSharedCompendiumDataChunk(chunk) && gameLocale !== GAME_LOCALES[0]) continue;
      files.push({
        path: compendiumDataChunkPath(gameLocale, chunk),
        data: pickChunk(resources, chunk),
      });
    }
  }

  return files;
}
