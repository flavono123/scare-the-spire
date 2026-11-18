import {
  getCodexCards,
  getCodexCharacters,
  getCodexKeywords,
  getCodexModifiers,
  getCodexAscensions,
  getCodexDominions,
  getCodexRelics,
  getCodexPotions,
  getCodexPowers,
  getCodexEnchantments,
  getCodexAfflictions,
  getCodexEvents,
  getCodexMonsters,
  getCodexEncounters,
  getCodexAncients,
  getCodexEpochs,
} from "@/lib/codex-data";
import type { GameLocale } from "@/lib/i18n";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { buildAllEntities } from "@/lib/all-entities";

export { characterTitleAliases } from "@/lib/all-entities";

export async function loadAllEntities(opts?: { gameLocale?: GameLocale }): Promise<EntityInfo[]> {
  const gameLocale = opts?.gameLocale;
  const [
    codexCards,
    codexCharacters,
    codexKeywords,
    codexModifiers,
    codexAscensions,
    codexDominions,
    codexRelics,
    codexPotions,
    codexPowers,
    codexEnchantments,
    codexAfflictions,
    codexEvents,
    codexMonsters,
    codexEncounters,
    codexAncients,
    codexEpochs,
  ] = await Promise.all([
    getCodexCards({ includeDeprecated: true, gameLocale }),
    getCodexCharacters({ gameLocale }),
    getCodexKeywords({ gameLocale }),
    getCodexModifiers({ gameLocale }),
    getCodexAscensions({ gameLocale }),
    getCodexDominions({ gameLocale }),
    getCodexRelics({ gameLocale }),
    getCodexPotions({ gameLocale }),
    getCodexPowers({ includeDeprecated: true, gameLocale }),
    getCodexEnchantments({ gameLocale }),
    getCodexAfflictions({ gameLocale }),
    getCodexEvents({ gameLocale }),
    getCodexMonsters({ gameLocale }),
    getCodexEncounters({ gameLocale }),
    getCodexAncients({ gameLocale }),
    getCodexEpochs({ gameLocale }),
  ]);

  return buildAllEntities({
    cards: codexCards,
    characters: codexCharacters,
    keywords: codexKeywords,
    modifiers: codexModifiers,
    ascensions: codexAscensions,
    dominions: codexDominions,
    relics: codexRelics,
    potions: codexPotions,
    powers: codexPowers,
    enchantments: codexEnchantments,
    afflictions: codexAfflictions,
    events: codexEvents,
    monsters: codexMonsters,
    encounters: codexEncounters,
    ancients: codexAncients,
    epochs: codexEpochs,
  });
}
