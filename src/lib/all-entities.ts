import type { EntityInfo } from "@/components/patch-note-renderer";
import { isPublicBestiaryMonster } from "@/lib/bestiary-monster-policy";
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
import { buildCompendiumResourceHref } from "@/lib/compendium-resource-links";

export type AllEntityResources = {
  cards: readonly CodexCard[];
  characters: readonly CodexCharacter[];
  keywords: readonly CodexKeyword[];
  modifiers: readonly CodexModifier[];
  ascensions: readonly CodexAscension[];
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
};

/** Client-safe: maps already-loaded Codex resources to hover/link entities. */
export function buildAllEntities(resources: AllEntityResources): EntityInfo[] {
  return [
    ...resources.cards.map((c) => ({
      id: c.id,
      nameEn: c.nameEn,
      nameKo: c.name,
      aliasesEn: c.id === "MAD_SCIENCE_SKILL" ? ["Mad Science"] : undefined,
      aliasesKo: c.id === "MAD_SCIENCE_SKILL" ? ["괴짜 과학"] : undefined,
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
  ];
}

export function characterTitleAliases(nameEn: string): string[] | undefined {
  if (!nameEn.startsWith("The ")) return undefined;
  const withoutArticle = nameEn.slice(4).trim();
  return withoutArticle ? [withoutArticle] : undefined;
}
