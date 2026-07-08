import type { EntityInfo } from "@/components/patch-note-renderer";
import { loadAllEntities } from "@/lib/load-all-entities";
import type { GameLocale } from "@/lib/i18n";
import {
  getThisOrThatEntityHref,
  isThisOrThatResourceType,
} from "@/lib/this-or-that";

const RESOURCE_TYPE_ORDER = [
  "card",
  "relic",
  "potion",
  "power",
  "enchantment",
  "affliction",
  "event",
  "monster",
  "encounter",
  "ancient",
  "epoch",
  "keyword",
  "character",
] as const;

const resourceTypeOrder = new Map<string, number>(
  RESOURCE_TYPE_ORDER.map((type, index) => [type, index]),
);

function isCurrentPublicResource(entity: EntityInfo): boolean {
  if (!isThisOrThatResourceType(entity.type)) return false;
  if (!getThisOrThatEntityHref(entity)) return false;

  return !(
    entity.cardData?.deprecated
    || entity.relicData?.deprecated
    || entity.potionData?.deprecated
    || entity.powerData?.deprecated
    || entity.enchantmentData?.deprecated
    || entity.afflictionData?.deprecated
    || entity.eventData?.deprecated
    || entity.monsterData?.deprecated
    || entity.encounterData?.deprecated
    || entity.ancientData?.deprecated
    || entity.epochData?.deprecated
  );
}

function compareThisOrThatEntities(a: EntityInfo, b: EntityInfo): number {
  const typeDiff = (resourceTypeOrder.get(a.type) ?? 99) - (resourceTypeOrder.get(b.type) ?? 99);
  if (typeDiff !== 0) return typeDiff;
  return a.nameKo.localeCompare(b.nameKo, "ko");
}

export async function loadThisOrThatEntities({
  gameLocale,
}: {
  gameLocale?: GameLocale;
} = {}): Promise<EntityInfo[]> {
  const entities = await loadAllEntities({ gameLocale });
  return entities
    .filter(isCurrentPublicResource)
    .sort(compareThisOrThatEntities);
}
