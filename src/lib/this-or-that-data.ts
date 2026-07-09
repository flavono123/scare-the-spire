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

function compactThisOrThatEntity(entity: EntityInfo): EntityInfo {
  return {
    id: entity.id,
    nameEn: entity.nameEn,
    nameKo: entity.nameKo,
    aliasesEn: entity.aliasesEn,
    aliasesKo: entity.aliasesKo,
    imageUrl: entity.imageUrl,
    href: entity.href,
    availability: entity.availability,
    compendiumResourceId: entity.compendiumResourceId,
    color: entity.color,
    type: entity.type,
    cardData: entity.cardData,
    characterData: entity.characterData ? {
      description: entity.characterData.description,
      imageUrl: entity.characterData.imageUrl,
      selectImageUrl: entity.characterData.selectImageUrl,
    } as EntityInfo["characterData"] : undefined,
    keywordData: entity.keywordData ? {
      description: entity.keywordData.description,
    } as EntityInfo["keywordData"] : undefined,
    relicData: entity.relicData ? {
      description: entity.relicData.description,
      imageUrl: entity.relicData.imageUrl,
      pool: entity.relicData.pool,
      rarity: entity.relicData.rarity,
    } as EntityInfo["relicData"] : undefined,
    potionData: entity.potionData ? {
      description: entity.potionData.description,
      imageUrl: entity.potionData.imageUrl,
      pool: entity.potionData.pool,
      rarity: entity.potionData.rarity,
    } as EntityInfo["potionData"] : undefined,
    powerData: entity.powerData ? {
      deprecated: entity.powerData.deprecated,
      description: entity.powerData.description,
      imageUrl: entity.powerData.imageUrl,
    } as EntityInfo["powerData"] : undefined,
    enchantmentData: entity.enchantmentData ? {
      description: entity.enchantmentData.description,
    } as EntityInfo["enchantmentData"] : undefined,
    afflictionData: entity.afflictionData ? {
      description: entity.afflictionData.description,
    } as EntityInfo["afflictionData"] : undefined,
    eventData: entity.eventData ? {
      imageUrl: entity.eventData.imageUrl,
    } as EntityInfo["eventData"] : undefined,
    eventOptionDesc: entity.eventOptionDesc,
    monsterData: entity.monsterData ? {
      bestiaryMoves: entity.monsterData.bestiaryMoves.map((move) => ({
        id: move.id,
        name: move.name,
      })),
      bossImageUrl: entity.monsterData.bossImageUrl,
      imageUrl: entity.monsterData.imageUrl,
      maxHp: entity.monsterData.maxHp,
      minHp: entity.monsterData.minHp,
      type: entity.monsterData.type,
    } as EntityInfo["monsterData"] : undefined,
    encounterData: entity.encounterData ? {
      act: entity.encounterData.act,
      isWeak: entity.encounterData.isWeak,
      monsters: entity.encounterData.monsters.map((monster) => ({
        id: monster.id,
        name: monster.name,
      })),
      roomType: entity.encounterData.roomType,
    } as EntityInfo["encounterData"] : undefined,
    ancientData: entity.ancientData ? {
      act: entity.ancientData.act,
      epithet: entity.ancientData.epithet,
      imageUrl: entity.ancientData.imageUrl,
    } as EntityInfo["ancientData"] : undefined,
    epochData: entity.epochData ? {
      betaImageUrl: entity.epochData.betaImageUrl,
      eraName: entity.epochData.eraName,
      eraYear: entity.epochData.eraYear,
      imageUrl: entity.epochData.imageUrl,
    } as EntityInfo["epochData"] : undefined,
  };
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

export async function loadCompactThisOrThatEntities({
  gameLocale,
}: {
  gameLocale?: GameLocale;
} = {}): Promise<EntityInfo[]> {
  const entities = await loadThisOrThatEntities({ gameLocale });
  return entities.map(compactThisOrThatEntity);
}
