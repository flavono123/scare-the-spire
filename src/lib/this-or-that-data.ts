import type { EntityInfo } from "@/components/patch-note-renderer";
import { loadAllEntities } from "@/lib/load-all-entities";
import type { MonsterSpineAsset } from "@/lib/codex-types";
import type { GameLocale } from "@/lib/i18n";
import {
  RELIC_CHARACTER_VARIANT_ORDER,
  resolveRelicDisplayImage,
} from "@/lib/relic-character-variant";
import {
  getThisOrThatEntityHref,
  isThisOrThatResourceType,
} from "@/lib/this-or-that";

const RESOURCE_TYPE_ORDER = [
  "character",
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
  "modifier",
  "ascension",
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

export function compactIdleSpineAsset(
  asset: MonsterSpineAsset | null | undefined,
  { includeIdleVfx }: { includeIdleVfx: boolean },
): MonsterSpineAsset | undefined {
  if (!asset?.atlasUrl || !asset.binaryUrl) return undefined;

  const idleAnims = new Set<string>([asset.idleAnimation, ...(asset.moveAnimations.IDLE ?? [])]);
  for (const track of asset.idleTracks ?? []) {
    idleAnims.add(track.animation);
    if (track.idleAnimation) idleAnims.add(track.idleAnimation);
  }

  const idleEffects = includeIdleVfx
    ? (asset.moveEffects.IDLE ?? []).filter((effect) => effect.usable !== false)
    : [];

  return {
    id: asset.id,
    source: asset.source,
    renderStatus: asset.renderStatus,
    renderTags: asset.renderTags,
    atlasUrl: asset.atlasUrl,
    binaryUrl: asset.binaryUrl,
    textureUrls: asset.textureUrls,
    skin: asset.skin,
    skins: asset.skins,
    defaultSkinCombination: asset.defaultSkinCombination,
    viewport: asset.viewport,
    idleTracks: asset.idleTracks,
    animations: [...idleAnims],
    bestiaryAnimations: [],
    idleAnimation: asset.idleAnimation,
    moveAnimations: { IDLE: [...idleAnims] },
    moveEffects: idleEffects.length > 0 ? { IDLE: idleEffects } : {},
  };
}

function compactEntityImageUrl(entity: EntityInfo): string | null {
  if (entity.type === "relic") {
    return resolveRelicDisplayImage(
      entity.relicData ?? {
        imageUrl: entity.imageUrl ?? null,
        variantImageUrls: null,
        betaImageUrl: null,
      },
      RELIC_CHARACTER_VARIANT_ORDER[0],
    ) ?? entity.imageUrl ?? null;
  }
  return entity.imageUrl ?? null;
}

export function compactThisOrThatEntity(entity: EntityInfo): EntityInfo {
  return {
    id: entity.id,
    nameEn: entity.nameEn,
    nameKo: entity.nameKo,
    aliasesEn: entity.aliasesEn,
    aliasesKo: entity.aliasesKo,
    imageUrl: compactEntityImageUrl(entity),
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
      combatImageUrl: entity.characterData.combatImageUrl,
      name: entity.characterData.name,
      spineAsset: compactIdleSpineAsset(entity.characterData.spineAsset, { includeIdleVfx: true }),
    } as EntityInfo["characterData"] : undefined,
    keywordData: entity.keywordData ? {
      description: entity.keywordData.description,
      source: entity.keywordData.source,
    } as EntityInfo["keywordData"] : undefined,
    relicData: entity.relicData ? {
      name: entity.relicData.name,
      description: entity.relicData.description,
      flavor: entity.relicData.flavor,
      imageUrl: entity.relicData.imageUrl,
      variantImageUrls: entity.relicData.variantImageUrls,
      pool: entity.relicData.pool,
      rarity: entity.relicData.rarity,
      deprecated: entity.relicData.deprecated,
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
      type: entity.powerData.type,
    } as EntityInfo["powerData"] : undefined,
    enchantmentData: entity.enchantmentData ? {
      description: entity.enchantmentData.description,
      cardType: entity.enchantmentData.cardType,
    } as EntityInfo["enchantmentData"] : undefined,
    afflictionData: entity.afflictionData ? {
      description: entity.afflictionData.description,
    } as EntityInfo["afflictionData"] : undefined,
    eventData: entity.eventData ? {
      imageUrl: entity.eventData.imageUrl,
      act: entity.eventData.act,
      acts: entity.eventData.acts,
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
      spineAsset: compactIdleSpineAsset(entity.monsterData.spineAsset, { includeIdleVfx: false }),
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
      relicIds: entity.ancientData.relicIds,
    } as EntityInfo["ancientData"] : undefined,
    epochData: entity.epochData ? {
      affiliation: entity.epochData.affiliation,
      affiliations: entity.epochData.affiliations,
      betaImageUrl: entity.epochData.betaImageUrl,
      eraName: entity.epochData.eraName,
      eraYear: entity.epochData.eraYear,
      imageUrl: entity.epochData.imageUrl,
    } as EntityInfo["epochData"] : undefined,
    modifierData: entity.modifierData ? {
      name: entity.modifierData.name,
      description: entity.modifierData.description,
      imageUrl: entity.modifierData.imageUrl,
      polarity: entity.modifierData.polarity,
    } as EntityInfo["modifierData"] : undefined,
    ascensionData: entity.ascensionData ? {
      name: entity.ascensionData.name,
      description: entity.ascensionData.description,
      imageUrl: entity.ascensionData.imageUrl,
      level: entity.ascensionData.level,
    } as EntityInfo["ascensionData"] : undefined,
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
