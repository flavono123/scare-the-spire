import { isPublicBestiaryMonster } from "@/lib/bestiary-monster-policy";
import {
  getCodexAfflictions,
  getCodexAncients,
  getCodexCards,
  getCodexCharacters,
  getCodexEnchantments,
  getCodexEncounters,
  getCodexEpochs,
  getCodexEvents,
  getCodexKeywords,
  getCodexMonsters,
  getCodexPotions,
  getCodexPowers,
  getCodexRelics,
} from "@/lib/codex-data";

export const COMPENDIUM_RESOURCE_TYPES = [
  "cards",
  "characters",
  "keywords",
  "relics",
  "potions",
  "powers",
  "enchantments",
  "afflictions",
  "events",
  "monsters",
  "encounters",
  "ancients",
  "epochs",
] as const;

export type CompendiumResourceType = (typeof COMPENDIUM_RESOURCE_TYPES)[number];

export type CompendiumResourceManifestEntry = {
  ids: string[];
  routeIds: string[];
};

export type CompendiumResourceManifest = {
  schemaVersion: 1;
  resources: Record<CompendiumResourceType, CompendiumResourceManifestEntry>;
};

type ResourceRow = { id: string };

function manifestEntry(rows: ResourceRow[]): CompendiumResourceManifestEntry {
  const ids = rows.map((row) => row.id).sort((a, b) => a.localeCompare(b));
  const routeIds = ids.map((id) => id.toLowerCase());
  return { ids, routeIds };
}

export async function buildCompendiumResourceManifest(): Promise<CompendiumResourceManifest> {
  const [
    cards,
    characters,
    keywords,
    relics,
    potions,
    powers,
    enchantments,
    afflictions,
    events,
    monsters,
    encounters,
    ancients,
    epochs,
  ] = await Promise.all([
    getCodexCards({ includeDeprecated: true }),
    getCodexCharacters(),
    getCodexKeywords(),
    getCodexRelics(),
    getCodexPotions(),
    getCodexPowers({ includeDeprecated: true }),
    getCodexEnchantments(),
    getCodexAfflictions(),
    getCodexEvents(),
    getCodexMonsters(),
    getCodexEncounters(),
    getCodexAncients(),
    getCodexEpochs(),
  ]);

  return {
    schemaVersion: 1,
    resources: {
      cards: manifestEntry(cards),
      characters: manifestEntry(characters),
      keywords: manifestEntry(keywords),
      relics: manifestEntry(relics),
      potions: manifestEntry(potions),
      powers: manifestEntry(powers),
      enchantments: manifestEntry(enchantments),
      afflictions: manifestEntry(afflictions),
      events: manifestEntry(events),
      monsters: manifestEntry(monsters.filter((monster) =>
        monster.showInCompendium && isPublicBestiaryMonster(monster.id),
      )),
      encounters: manifestEntry(encounters),
      ancients: manifestEntry(ancients),
      epochs: manifestEntry(epochs),
    },
  };
}

export function compendiumManifestHasResource(
  manifest: CompendiumResourceManifest,
  type: CompendiumResourceType,
  id: string,
): boolean {
  return manifest.resources[type].routeIds.includes(id.toLowerCase());
}
