import fs from "fs/promises";
import path from "path";
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
const GENERATED_MANIFEST_PATH = path.join(process.cwd(), "public/generated/compendium-resource-manifest.json");
const PUBLIC_MANIFEST_PATH = "/generated/compendium-resource-manifest.json";

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

export function emptyCompendiumResourceManifest(): CompendiumResourceManifest {
  const resources = {} as Record<CompendiumResourceType, CompendiumResourceManifestEntry>;
  for (const type of COMPENDIUM_RESOURCE_TYPES) {
    resources[type] = { ids: [], routeIds: [] };
  }

  return {
    schemaVersion: 1,
    resources,
  };
}

export async function loadGeneratedCompendiumResourceManifest(): Promise<CompendiumResourceManifest> {
  const raw = await fs.readFile(GENERATED_MANIFEST_PATH, "utf-8").catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return null;
    throw error;
  });

  if (!raw) return buildCompendiumResourceManifest();
  return JSON.parse(raw) as CompendiumResourceManifest;
}

function liveCompendiumManifestUrl(): string | null {
  const explicitUrl = process.env.PATCH_COMPENDIUM_MANIFEST_URL?.trim();
  if (explicitUrl) return explicitUrl;

  const origin = process.env.NEXT_PUBLIC_SITE_ORIGIN?.trim();
  if (!origin) return null;
  return new URL(PUBLIC_MANIFEST_PATH, origin.endsWith("/") ? origin : `${origin}/`).toString();
}

export async function loadLiveCompendiumResourceManifest(): Promise<CompendiumResourceManifest> {
  const url = liveCompendiumManifestUrl();
  if (!url) {
    console.warn("PATCH_COMPENDIUM_MANIFEST_SOURCE=live set without NEXT_PUBLIC_SITE_ORIGIN or PATCH_COMPENDIUM_MANIFEST_URL; disabling patch compendium links.");
    return emptyCompendiumResourceManifest();
  }

  try {
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) {
      console.warn(`Live compendium manifest returned HTTP ${response.status}; disabling patch compendium links.`);
      return emptyCompendiumResourceManifest();
    }
    return await response.json() as CompendiumResourceManifest;
  } catch (error) {
    console.warn("Failed to read live compendium manifest; disabling patch compendium links.", error);
    return emptyCompendiumResourceManifest();
  }
}

export async function loadPatchBuildCompendiumResourceManifest(): Promise<CompendiumResourceManifest> {
  if (process.env.PATCH_COMPENDIUM_MANIFEST_SOURCE === "live") {
    return loadLiveCompendiumResourceManifest();
  }
  return loadGeneratedCompendiumResourceManifest();
}

export function compendiumManifestHasResource(
  manifest: CompendiumResourceManifest,
  type: CompendiumResourceType,
  id: string,
): boolean {
  return manifest.resources[type]?.routeIds.includes(id.toLowerCase()) ?? false;
}
