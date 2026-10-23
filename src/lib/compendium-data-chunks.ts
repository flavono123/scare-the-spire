import type { CardSideTipCatalogSources } from "@/lib/card-side-tip-catalog";
import type { CodexGameUiLabels } from "@/lib/codex-game-ui";
import type {
  CodexAffliction,
  CodexAncient,
  CodexAscension,
  CodexCard,
  CodexCharacter,
  CodexEnchantment,
  CodexEncounter,
  CodexEpoch,
  CodexEvent,
  CodexKeyword,
  CodexModifier,
  CodexMonster,
  CodexPotion,
  CodexPower,
  CodexRelic,
} from "@/lib/codex-types";
import type { GameLocale } from "@/lib/i18n";
import type { EntityVersionDiff, STS2Change, STS2Patch } from "@/lib/types";

// Compendium data is published as small static JSON chunks instead of one
// multi-megabyte payload. Crawlers stop reading a resource after 2MB, so every
// chunk must stay well below that; scripts/generate-static-api-data.ts fails
// the build when one grows past COMPENDIUM_DATA_CHUNK_MAX_BYTES.
export const COMPENDIUM_DATA_CHUNK_ROOT = "/generated/compendium-data";
export const COMPENDIUM_DATA_CHUNK_MAX_BYTES = 1_500_000;

export type CompendiumDataResources = {
  afflictions: CodexAffliction[];
  ancients: CodexAncient[];
  ascensions: CodexAscension[];
  cardSideTipSources: CardSideTipCatalogSources;
  cards: CodexCard[];
  changes: STS2Change[];
  characters: CodexCharacter[];
  enchantments: CodexEnchantment[];
  encounters: CodexEncounter[];
  epochs: CodexEpoch[];
  events: CodexEvent[];
  gameUi: CodexGameUiLabels;
  keywords: CodexKeyword[];
  madScienceBaseCard: CodexCard | null;
  modifiers: CodexModifier[];
  monsters: CodexMonster[];
  patches: STS2Patch[];
  potions: CodexPotion[];
  powers: CodexPower[];
  relics: CodexRelic[];
  versionDiffs: EntityVersionDiff[];
};

export type CompendiumDataKey = keyof CompendiumDataResources;

// Small resources share one "core" chunk to keep the static asset count low.
const CHUNK_BY_KEY = {
  afflictions: "core",
  ancients: "core",
  ascensions: "core",
  cardSideTipSources: "core",
  cards: "cards",
  changes: "history",
  characters: "core",
  enchantments: "enchantments",
  encounters: "encounters",
  epochs: "epochs",
  events: "events",
  gameUi: "core",
  keywords: "core",
  madScienceBaseCard: "core",
  modifiers: "core",
  monsters: "monsters",
  patches: "history",
  potions: "core",
  powers: "powers",
  relics: "relics",
  versionDiffs: "version-diffs",
} as const satisfies Record<CompendiumDataKey, string>;

export type CompendiumDataChunkName = (typeof CHUNK_BY_KEY)[CompendiumDataKey];

/** Chunks that do not depend on the game locale live outside locale folders. */
const SHARED_CHUNKS = new Set<CompendiumDataChunkName>(["history"]);

export const COMPENDIUM_DATA_CHUNK_KEYS = Object.entries(CHUNK_BY_KEY).reduce(
  (acc, [key, chunk]) => {
    (acc[chunk] ??= []).push(key as CompendiumDataKey);
    return acc;
  },
  {} as Record<CompendiumDataChunkName, CompendiumDataKey[]>,
);

export function isSharedCompendiumDataChunk(chunk: CompendiumDataChunkName): boolean {
  return SHARED_CHUNKS.has(chunk);
}

export function compendiumDataChunkPath(
  gameLocale: GameLocale,
  chunk: CompendiumDataChunkName,
): string {
  return isSharedCompendiumDataChunk(chunk)
    ? `${COMPENDIUM_DATA_CHUNK_ROOT}/${chunk}.json`
    : `${COMPENDIUM_DATA_CHUNK_ROOT}/${gameLocale}/${chunk}.json`;
}

/** Every key the hover/link entity list is built from (see buildAllEntities). */
export const ALL_ENTITY_DATA_KEYS = [
  "afflictions",
  "ancients",
  "ascensions",
  "cards",
  "characters",
  "enchantments",
  "encounters",
  "epochs",
  "events",
  "keywords",
  "modifiers",
  "monsters",
  "potions",
  "powers",
  "relics",
] as const satisfies readonly CompendiumDataKey[];

const chunkPromises = new Map<string, Promise<Partial<CompendiumDataResources>>>();

function fetchChunk(path: string): Promise<Partial<CompendiumDataResources>> {
  const existing = chunkPromises.get(path);
  if (existing) return existing;

  const next = fetch(path, { cache: "no-cache" })
    .then((response) => {
      if (!response.ok) throw new Error(`Failed to load ${path}`);
      return response.json() as Promise<Partial<CompendiumDataResources>>;
    })
    .catch((error: unknown) => {
      chunkPromises.delete(path);
      throw error;
    });
  chunkPromises.set(path, next);
  return next;
}

export async function loadCompendiumData<K extends CompendiumDataKey>(
  gameLocale: GameLocale,
  keys: readonly K[],
): Promise<Pick<CompendiumDataResources, K>> {
  const chunks = [...new Set(keys.map((key) => CHUNK_BY_KEY[key]))];
  const loaded = await Promise.all(
    chunks.map((chunk) => fetchChunk(compendiumDataChunkPath(gameLocale, chunk))),
  );
  const merged = Object.assign({}, ...loaded) as Partial<CompendiumDataResources>;
  const result = {} as Pick<CompendiumDataResources, K>;
  for (const key of keys) {
    if (!(key in merged)) {
      throw new Error(`Compendium data chunk ${CHUNK_BY_KEY[key]} has no ${key}`);
    }
    result[key] = merged[key] as CompendiumDataResources[K];
  }
  return result;
}
