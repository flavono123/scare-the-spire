import type { EntityInfo } from "@/components/patch-note-renderer";
import { isPublicBestiaryMonster } from "@/lib/bestiary-monster-policy";
import type {
  CodexAffliction,
  CodexAncient,
  CodexAscension,
  CodexCard,
  CodexCharacter,
  CodexDominion,
  CodexEnchantment,
  CodexEncounter,
  CodexEpoch,
  CodexEvent,
  CodexKeyword,
  CodexModifier,
  CodexMonster,
  CodexPet,
  CodexPotion,
  CodexPower,
  CodexRelic,
} from "@/lib/codex-types";
import { buildCompendiumResourceHref } from "@/lib/compendium-resource-links";
import { inflectionAliases } from "@/lib/inflection-aliases";
import {
  formatMadScienceVariantParam,
  getMadScienceVariantCard,
  getMadScienceVariantCardId,
  getMadScienceVariantFromId,
  MAD_SCIENCE_CARD_ID,
  type MadScienceVariant,
} from "@/lib/tinker-time";

export type AllEntityResources = {
  cards: readonly CodexCard[];
  characters: readonly CodexCharacter[];
  keywords: readonly CodexKeyword[];
  modifiers: readonly CodexModifier[];
  ascensions: readonly CodexAscension[];
  dominions: readonly CodexDominion[];
  relics: readonly CodexRelic[];
  potions: readonly CodexPotion[];
  powers: readonly CodexPower[];
  enchantments: readonly CodexEnchantment[];
  afflictions: readonly CodexAffliction[];
  events: readonly CodexEvent[];
  monsters: readonly CodexMonster[];
  encounters: readonly CodexEncounter[];
  ancients: readonly CodexAncient[];
  epochs: readonly CodexEpoch[];
  pets: readonly CodexPet[];
};

/** Client-safe: maps already-loaded Codex resources to hover/link entities. */
export function buildAllEntities(resources: AllEntityResources): EntityInfo[] {
  return [
    ...resources.cards.map((c) => ({
      id: c.id,
      nameEn: c.nameEn,
      nameKo: c.name,
      ...inflectionAliases("card", c.id),
      imageUrl: c.imageUrl ?? c.betaImageUrl,
      color: c.color,
      type: "card" as const,
      cardData: c,
    })),
    ...resources.characters.map((c) => ({
      id: c.id,
      nameEn: c.nameEn,
      nameKo: c.name,
      aliasesEn: characterTitleAliases(c.nameEn),
      imageUrl: c.iconUrl || c.imageUrl,
      color: c.id.toLowerCase(),
      type: "character" as const,
      characterData: c,
    })),
    ...resources.keywords.map((k) => ({
      id: k.id,
      nameEn: k.nameEn,
      nameKo: k.name,
      ...inflectionAliases("keyword", k.id),
      imageUrl: k.imageUrl,
      href: buildCompendiumResourceHref("keyword", k.id),
      color: k.source,
      type: "keyword" as const,
      keywordData: k,
    })),
    ...resources.modifiers.map((m) => ({
      id: m.id,
      nameEn: m.nameEn,
      nameKo: m.name,
      aliasesEn: m.aliasesEn,
      aliasesKo: m.aliasesKo,
      imageUrl: m.imageUrl,
      href: buildCompendiumResourceHref("modifier", m.id),
      color: m.polarity,
      type: "modifier" as const,
      modifierData: m,
    })),
    ...resources.ascensions.map((a) => ({
      id: a.id,
      nameEn: a.nameEn,
      nameKo: a.name,
      aliasesEn: a.aliasesEn,
      aliasesKo: a.aliasesKo,
      imageUrl: a.imageUrl,
      href: buildCompendiumResourceHref("ascension", a.id),
      color: "ascension",
      type: "ascension" as const,
      ascensionData: a,
    })),
    ...resources.dominions.map((d) => ({
      id: d.id,
      nameEn: d.nameEn,
      nameKo: d.name,
      imageUrl: d.imageUrl,
      href: buildCompendiumResourceHref("dominion", d.id),
      color: "dread",
      type: "dominion" as const,
      dominionData: d,
    })),
    ...resources.relics.map((r) => ({
      id: r.id,
      nameEn: r.nameEn,
      nameKo: r.name,
      imageUrl: r.imageUrl,
      color: r.pool,
      type: "relic" as const,
      relicData: r,
    })),
    ...resources.potions.map((p) => ({
      id: p.id,
      nameEn: p.nameEn,
      nameKo: p.name,
      imageUrl: p.imageUrl,
      color: p.pool,
      type: "potion" as const,
      potionData: p,
    })),
    ...resources.powers.map((p) => ({
      id: p.id,
      nameEn: p.nameEn,
      nameKo: p.name,
      ...inflectionAliases("power", p.id),
      imageUrl: p.imageUrl,
      color: p.type,
      type: "power" as const,
      powerData: p,
    })),
    ...resources.enchantments.map((e) => ({
      id: e.id,
      nameEn: e.nameEn,
      nameKo: e.name,
      imageUrl: e.imageUrl,
      color: e.cardType ?? "Any",
      type: "enchantment" as const,
      enchantmentData: e,
    })),
    ...resources.afflictions.map((a) => ({
      id: a.id,
      nameEn: a.nameEn,
      nameKo: a.name,
      imageUrl: a.imageUrl,
      color: "affliction",
      type: "affliction" as const,
      afflictionData: a,
    })),
    ...resources.events.map((e) => ({
      id: e.id,
      nameEn: e.nameEn,
      nameKo: e.name,
      imageUrl: e.imageUrl,
      color: e.act ?? "none",
      type: "event" as const,
      eventData: e,
    })),
    ...resources.monsters
      .filter((m) => m.showInCompendium && isPublicBestiaryMonster(m.id))
      .map((m) => ({
        id: m.id,
        nameEn: m.nameEn,
        nameKo: m.name,
        imageUrl: m.bossImageUrl ?? m.imageUrl,
        color: m.type,
        type: "monster" as const,
        monsterData: m,
      })),
    ...resources.encounters.map((e) => ({
      id: e.id,
      nameEn: e.nameEn,
      nameKo: e.name,
      imageUrl: e.imageUrl,
      color: e.roomType,
      type: "encounter" as const,
      encounterData: e,
    })),
    ...resources.ancients.map((a) => ({
      id: a.id,
      nameEn: a.nameEn,
      nameKo: a.name,
      imageUrl: a.imageUrl,
      color: a.act ?? "none",
      type: "ancient" as const,
      ancientData: a,
    })),
    ...resources.epochs.map((e) => ({
      id: e.id,
      nameEn: e.nameEn,
      nameKo: e.name,
      imageUrl: e.imageUrl,
      href: buildCompendiumResourceHref("epoch", e.id),
      color: e.affiliation,
      type: "epoch" as const,
      epochData: e,
    })),
    // Last: a pet named like its relic (Wuppy, Byrdpip, ...) leaves that name to the relic.
    ...resources.pets.map((p) => ({
      id: p.id,
      nameEn: p.nameEn,
      nameKo: p.name,
      imageUrl: p.imageUrl,
      href: buildCompendiumResourceHref("pet", p.id),
      color: "pet",
      type: "pet" as const,
      petData: p,
    })),
  ];
}

export function characterTitleAliases(nameEn: string): string[] | undefined {
  if (!nameEn.startsWith("The ")) return undefined;
  const withoutArticle = nameEn.slice(4).trim();
  return withoutArticle ? [withoutArticle] : undefined;
}

/** The one Mad Science card entity painted as a variant, under the variant's stored id. */
export function withMadScienceVariantEntity(entity: EntityInfo, variant: MadScienceVariant): EntityInfo {
  if (!entity.cardData) return entity;
  const cardData = getMadScienceVariantCard(entity.cardData, variant);
  return {
    ...entity,
    id: getMadScienceVariantCardId(variant),
    imageUrl: cardData.imageUrl ?? entity.imageUrl,
    cardData,
    cardPreviewVariant: formatMadScienceVariantParam(variant),
  };
}

/**
 * `${type}:${id}` lookup for stored ids. Pickers list one Mad Science card; posts store a variant as
 * MAD_SCIENCE_ATTACK_VIOLENCE (old posts as MAD_SCIENCE_ATTACK), which resolves to that card painted as
 * the variant. Variants stay out of `values()` so name matching and lists see one card.
 */
export class EntityLookupMap extends Map<string, EntityInfo> {
  private readonly variants = new Map<string, EntityInfo | undefined>();

  override get(key: string): EntityInfo | undefined {
    const entity = super.get(key);
    if (entity || !key.startsWith("card:")) return entity;
    if (this.variants.has(key)) return this.variants.get(key);
    const variant = getMadScienceVariantFromId(key.slice("card:".length));
    const base = variant ? super.get(`card:${MAD_SCIENCE_CARD_ID}`) : undefined;
    const resolved = base && variant ? withMadScienceVariantEntity(base, variant) : undefined;
    this.variants.set(key, resolved);
    return resolved;
  }

  override has(key: string): boolean {
    return this.get(key) !== undefined;
  }
}

export function buildEntityLookupMap(entities: readonly EntityInfo[]): EntityLookupMap {
  const map = new EntityLookupMap();
  for (const entity of entities) map.set(`${entity.type}:${entity.id}`, entity);
  return map;
}

/** Array lookup with the same Mad Science variant fallback as EntityLookupMap. */
export function findEntityByRef(
  entities: readonly EntityInfo[],
  type: string,
  id: string,
): EntityInfo | undefined {
  const exact = entities.find((entity) => entity.type === type && entity.id === id);
  if (exact || type !== "card") return exact;
  const variant = getMadScienceVariantFromId(id);
  const base = variant
    ? entities.find((entity) => entity.type === "card" && entity.id === MAD_SCIENCE_CARD_ID)
    : undefined;
  return base && variant ? withMadScienceVariantEntity(base, variant) : undefined;
}
