import fs from "fs/promises";
import path from "path";
import type { EntityInfo, EntityType } from "@/components/patch-note-renderer";
import {
  compendiumManifestHasResource,
  type CompendiumResourceManifest,
  type CompendiumResourceType,
} from "@/lib/compendium-resource-manifest";

const DATA_PATH = path.join(process.cwd(), "data/sts2-patch-local-resources.json");

export type PatchLocalResource = {
  version: string;
  type: EntityType;
  id: string;
  nameEn: string;
  nameKo: string;
  aliasesEn?: string[];
  aliasesKo?: string[];
  imageUrl?: string | null;
  color?: string;
  availability: "pending-compendium";
};

const COMPENDIUM_RESOURCE_TYPE_BY_ENTITY_TYPE: Partial<Record<EntityType, CompendiumResourceType>> = {
  card: "cards",
  character: "characters",
  keyword: "keywords",
  relic: "relics",
  potion: "potions",
  power: "powers",
  enchantment: "enchantments",
  affliction: "afflictions",
  event: "events",
  monster: "monsters",
  encounter: "encounters",
  ancient: "ancients",
  epoch: "epochs",
};

async function readPatchLocalResources(): Promise<PatchLocalResource[]> {
  const raw = await fs.readFile(DATA_PATH, "utf-8").catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return "[]";
    throw error;
  });
  return JSON.parse(raw) as PatchLocalResource[];
}

export function compendiumResourceTypeForEntityType(type: EntityType): CompendiumResourceType | null {
  return COMPENDIUM_RESOURCE_TYPE_BY_ENTITY_TYPE[type] ?? null;
}

export async function loadPatchLocalEntities({
  version,
  compendiumManifest,
}: {
  version: string;
  compendiumManifest?: CompendiumResourceManifest | null;
}): Promise<EntityInfo[]> {
  const resources = (await readPatchLocalResources()).filter((resource) =>
    resource.version === version,
  );

  return resources.map((resource) => {
    const compendiumResourceType = compendiumResourceTypeForEntityType(resource.type);
    const isCompendiumReady = Boolean(
      compendiumManifest &&
      compendiumResourceType &&
      compendiumManifestHasResource(compendiumManifest, compendiumResourceType, resource.id),
    );

    return {
      id: resource.id,
      nameEn: resource.nameEn,
      nameKo: resource.nameKo,
      aliasesEn: resource.aliasesEn,
      aliasesKo: resource.aliasesKo,
      imageUrl: resource.imageUrl ?? null,
      color: resource.color ?? "pending",
      type: resource.type,
      availability: isCompendiumReady ? "available" : resource.availability,
      href: isCompendiumReady ? undefined : null,
    };
  });
}
