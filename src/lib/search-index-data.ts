import type { EntityInfo, EntityType } from "@/components/patch-note-renderer";
import { stripCodexMarkup } from "@/lib/codex-search";
import { buildCompendiumResourceHref, type CompendiumResourceLinkType } from "@/lib/compendium-resource-links";
import { getStories, getSTS2Patches, getSTS2Stories } from "@/lib/data";
import type { GlobalSearchNames } from "@/lib/global-search";
import type { GameLocale } from "@/lib/i18n";
import { getPatchShell } from "@/lib/patch-shells";
import { eventCharacterQuoteSearchParts } from "@/lib/event-character-quotes";
import { loadAllEntities } from "@/lib/load-all-entities";
import { getCodexBlitzEntries } from "@/lib/codex-data";
import { PLACES, placeLabel, type Place, type PlaceArea } from "@/lib/place-registry";
import { getSts1Cards, getSts1Monsters, getSts1Potions, getSts1Powers, getSts1Relics } from "@/lib/sts1/data";
import { getSts1Events } from "@/lib/sts1/events";
import {
  sts1CardPortraitUrl,
  sts1EventImageUrl,
  sts1MonsterImageUrl,
  sts1PotionImageUrl,
  sts1PowerImageUrl,
  sts1RelicImageUrl,
} from "@/lib/sts1/paths";

export type SearchItemType = EntityType | "patch" | "story" | "compendium" | "zzapper" | "toybox";

export type SearchIndexItem = {
  id: string;
  type: SearchItemType;
  title: string;
  titleEn: string;
  description: string;
  descriptionEn: string;
  imageUrl: string | null;
  href: string;
  game?: "sts1";
};

export type SearchIndexPayload = {
  items: SearchIndexItem[];
};

const TYPE_TO_COMPENDIUM_LINK_TYPE: Partial<Record<EntityType, CompendiumResourceLinkType>> = {
  card: "card",
  character: "character",
  keyword: "keyword",
  relic: "relic",
  potion: "potion",
  power: "power",
  enchantment: "enchantment",
  affliction: "affliction",
  event: "event",
  monster: "monster",
  encounter: "encounter",
  ancient: "ancient",
  epoch: "epoch",
  modifier: "modifier",
  ascension: "ascension",
  dominion: "dominion",
  pet: "pet",
};

function entityHref(entity: EntityInfo): string | null {
  if (entity.href) return entity.href;

  const linkType = TYPE_TO_COMPENDIUM_LINK_TYPE[entity.type];
  if (!linkType) return null;
  return buildCompendiumResourceHref(linkType, entity.id);
}

function cleanSearchText(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return stripCodexMarkup(String(value)).replace(/\s+/g, " ").trim();
}

function appendSearchParts(parts: string[], ...values: (string | number | null | undefined)[]) {
  for (const value of values) {
    const text = cleanSearchText(value);
    if (text) parts.push(text);
  }
}

function compactSearchParts(parts: string[]): string {
  return Array.from(new Set(parts)).join(" ");
}

function entitySearchText(entity: EntityInfo): string {
  const parts: string[] = [];
  appendSearchParts(parts, entity.id, entity.aliasesKo?.join(" "), entity.aliasesEn?.join(" "));

  if (entity.cardData) {
    const card = entity.cardData;
    appendSearchParts(
      parts,
      card.description,
      card.descriptionEn,
      card.descriptionRaw,
      card.descriptionRawEn,
      card.type,
      card.typeLabel,
      card.rarity,
      card.rarityLabel,
      card.color,
      card.keywords.join(" "),
      Object.values(card.keywordLabels).join(" "),
      [...card.tags, ...card.serviceTags].join(" "),
      card.appliedPowerIds.join(" "),
    );
  }

  if (entity.keywordData) {
    const keyword = entity.keywordData;
    appendSearchParts(
      parts,
      keyword.description,
      keyword.descriptionEn,
      keyword.descriptionRaw,
      keyword.descriptionRawEn,
      keyword.source,
      keyword.sourceId,
    );
  }

  if (entity.characterData) {
    const character = entity.characterData;
    appendSearchParts(
      parts,
      character.description,
      character.descriptionEn,
      character.startingHp,
      character.startingGold,
      character.maxEnergy,
      character.orbSlots,
      character.startingDeckIds.join(" "),
      character.startingRelicIds.join(" "),
      character.unlocksAfter,
      character.gender,
      Object.values(character.quotes).join(" "),
    );
    for (const interaction of character.ancientInteractions) {
      appendSearchParts(parts, interaction.ancientId, interaction.ancientName);
      for (const line of interaction.lines) {
        appendSearchParts(parts, line.speaker, line.text);
      }
    }
  }

  if (entity.relicData) {
    const relic = entity.relicData;
    appendSearchParts(
      parts,
      relic.description,
      relic.descriptionEn,
      relic.descriptionRaw,
      relic.descriptionRawEn,
      relic.flavor,
      relic.rarity,
      relic.pool,
    );
  }

  if (entity.potionData) {
    const potion = entity.potionData;
    appendSearchParts(
      parts,
      potion.description,
      potion.descriptionEn,
      potion.descriptionRaw,
      potion.descriptionRawEn,
      potion.rarity,
      potion.pool,
    );
  }

  if (entity.powerData) {
    const power = entity.powerData;
    appendSearchParts(
      parts,
      power.description,
      power.descriptionEn,
      power.descriptionRaw,
      power.descriptionRawEn,
      power.type,
      power.stackType,
    );
  }

  if (entity.enchantmentData) {
    const enchantment = entity.enchantmentData;
    appendSearchParts(
      parts,
      enchantment.description,
      enchantment.descriptionEn,
      enchantment.descriptionRaw,
      enchantment.descriptionRawEn,
      enchantment.extraCardText,
      enchantment.extraCardTextEn,
      enchantment.cardType,
      enchantment.isStackable ? "stackable 중첩" : null,
    );
  }

  if (entity.afflictionData) {
    const affliction = entity.afflictionData;
    appendSearchParts(
      parts,
      affliction.description,
      affliction.descriptionEn,
      affliction.descriptionRaw,
      affliction.descriptionRawEn,
      affliction.extraCardText,
      affliction.extraCardTextEn,
      affliction.isStackable ? "stackable 중첩" : null,
    );
  }

  if (entity.eventData) {
    const event = entity.eventData;
    appendSearchParts(parts, event.description, event.descriptionEn, event.act, event.acts?.join(" "));
    for (const option of event.options ?? []) {
      appendSearchParts(parts, option.id, option.title, option.description);
    }
    for (const page of event.pages ?? []) {
      appendSearchParts(parts, page.id, page.description);
      for (const option of page.options ?? []) {
        appendSearchParts(parts, option.id, option.title, option.description);
      }
    }
  }

  if (entity.monsterData) {
    const monster = entity.monsterData;
    appendSearchParts(parts, monster.type);
    for (const move of monster.moves) {
      appendSearchParts(parts, move.id, move.name, move.nameEn, move.kind, move.animationId, move.actionTypes.join(" "), move.intents.join(" "));
      for (const power of move.powerApplications) {
        appendSearchParts(parts, power.powerId, power.powerName, power.powerNameEn, power.powerType, power.target);
      }
      for (const card of move.cardApplications) {
        appendSearchParts(parts, card.cardId, card.cardName, card.cardNameEn, card.cardType, card.cardRarity, card.cardColor, card.applicationKind);
      }
    }
    for (const power of monster.initialPowerApplications) {
      appendSearchParts(parts, power.powerId, power.powerName, power.powerNameEn, power.powerType, power.target);
    }
  }

  if (entity.encounterData) {
    const encounter = entity.encounterData;
    appendSearchParts(
      parts,
      encounter.roomType,
      encounter.act,
      encounter.tags?.join(" "),
      encounter.lossText,
      encounter.isWeak ? "weak 약화" : null,
    );
    for (const monster of encounter.monsters) {
      appendSearchParts(parts, monster.id, monster.name, monster.nameEn);
    }
  }

  if (entity.ancientData) {
    const ancient = entity.ancientData;
    appendSearchParts(parts, ancient.epithet, ancient.epithetEn, ancient.description, ancient.descriptionEn, ancient.act, ancient.relicIds.join(" "));
    for (const scenes of Object.values(ancient.dialogue)) {
      for (const scene of scenes) {
        for (const line of scene.lines) {
          appendSearchParts(parts, line.order, line.speaker, line.text);
        }
      }
    }
  }

  if (entity.epochData) {
    const epoch = entity.epochData;
    appendSearchParts(
      parts,
      epoch.description,
      epoch.descriptionEn,
      epoch.era,
      epoch.eraGroup,
      epoch.eraName,
      epoch.eraYear,
      epoch.storyId,
      epoch.affiliation,
      epoch.affiliations.join(" "),
      epoch.unlockInfo,
      epoch.unlockInfoEn,
      epoch.unlockText,
      epoch.unlockTextEn,
      epoch.unlockConditions.join(" "),
      epoch.unlockRewards.join(" "),
      epoch.unlocksCards.join(" "),
      epoch.unlocksRelics.join(" "),
      epoch.unlocksPotions.join(" "),
      epoch.expandsTimeline.join(" "),
    );
  }

  if (entity.modifierData) {
    const modifier = entity.modifierData;
    appendSearchParts(
      parts,
      modifier.description,
      modifier.descriptionEn,
      modifier.polarity,
      modifier.source,
      modifier.characterId,
      ...(modifier.aliasesKo ?? []),
      ...(modifier.aliasesEn ?? []),
    );
  }

  if (entity.dominionData) {
    appendSearchParts(parts, entity.dominionData.description, entity.dominionData.descriptionEn, entity.dominionData.encounterId);
  }

  if (entity.petData) {
    appendSearchParts(parts, entity.petData.description, entity.petData.descriptionEn, entity.petData.monsterId);
  }

  if (entity.ascensionData) {
    const ascension = entity.ascensionData;
    appendSearchParts(
      parts,
      ascension.description,
      ascension.descriptionEn,
      ascension.level,
      ...ascension.aliasesKo,
      ...ascension.aliasesEn,
    );
  }

  return compactSearchParts(parts);
}

function entityKey(entity: { type: SearchItemType; id: string }): string {
  return `${entity.type}:${entity.id}`;
}

function entitySearchImageUrl(entity: EntityInfo): string | null {
  if (entity.cardData) {
    return entity.cardData.imageUrl ?? entity.cardData.betaImageUrl;
  }
  return entity.imageUrl;
}

function eventSearchCharacters(entities: EntityInfo[]) {
  return entities.flatMap((entity) => entity.characterData ? [entity.characterData] : []);
}

function eventSearchText(
  entity: EntityInfo,
  characters: ReturnType<typeof eventSearchCharacters>,
): string {
  const base = entitySearchText(entity);
  if (!entity.eventData) return base;
  return compactSearchParts([
    base,
    ...eventCharacterQuoteSearchParts(entity.eventData, characters),
  ]);
}

/** One small file per game-only language; the shared index stays Korean and English. */
export async function buildSearchNames(gameLocale: GameLocale): Promise<GlobalSearchNames> {
  const [entities, blitzEntries] = await Promise.all([
    loadAllEntities({ gameLocale }),
    getCodexBlitzEntries({ gameLocale }),
  ]);
  const sts1Items = await buildSts1SearchItems(gameLocale);
  return Object.fromEntries([
    ...entities.flatMap((entity) => (entityHref(entity) ? [[entityKey(entity), entity.nameKo]] : [])),
    ...blitzEntries.map((entry) => [entityKey({ type: "blitzEntry", id: entry.id }), entry.name]),
    ...sts1Items.map((item) => [entityKey(item), item.title]),
    ...PLACES.map((place) => [entityKey(placeSearchKey(place)), placeLabel(place, "en", gameLocale)]),
  ]);
}

const PLACE_SEARCH_TYPE: Record<PlaceArea, SearchItemType> = {
  sts2: "compendium",
  sts1: "compendium",
  zzapper: "zzapper",
  toybox: "toybox",
};

function placeSearchKey(place: Place): { type: SearchItemType; id: string } {
  return { type: PLACE_SEARCH_TYPE[place.area], id: place.id };
}

// Menu destinations: Codex kinds, Vexing Puzzlebox games, Toy Box services.
function buildPlaceSearchItems(): SearchIndexItem[] {
  return PLACES.filter((place) => place.kind !== "tool").map((place) => ({
    ...placeSearchKey(place),
    title: placeLabel(place, "ko", "kor"),
    titleEn: placeLabel(place, "en", "eng"),
    description: place.search?.ko ?? "",
    descriptionEn: place.search?.en ?? "",
    imageUrl: place.token,
    href: place.href,
    ...(place.area === "sts1" ? { game: "sts1" as const } : {}),
  }));
}

/** STS1 elements; ids carry an `sts1:` prefix so their keys never meet STS2 ones. */
async function buildSts1SearchItems(gameLocale: GameLocale): Promise<SearchIndexItem[]> {
  const [cards, relics, potions, powers, monsters, events] = await Promise.all([
    getSts1Cards(gameLocale),
    getSts1Relics(gameLocale),
    getSts1Potions(gameLocale),
    getSts1Powers(gameLocale),
    getSts1Monsters(gameLocale),
    getSts1Events(gameLocale),
  ]);
  const item = (
    type: SearchItemType,
    segment: string,
    entry: { id: string; slug: string; name: string; nameEn: string },
    imageUrl: string | null,
  ): SearchIndexItem => ({
    id: `sts1:${entry.id}`,
    type,
    title: entry.name,
    titleEn: entry.nameEn,
    description: "",
    descriptionEn: "",
    imageUrl,
    href: `/compendium/sts1/${segment}/${entry.slug}`,
    game: "sts1",
  });
  return [
    ...cards.map((card) => item("card", "cards", card, sts1CardPortraitUrl(card))),
    ...relics.map((relic) => item("relic", "relics", relic, sts1RelicImageUrl(relic))),
    ...potions.map((potion) => item("potion", "potions", potion, sts1PotionImageUrl(potion))),
    ...powers.map((power) => item("power", "powers", power, sts1PowerImageUrl(power))),
    ...monsters.map((monster) => item("monster", "monsters", monster, sts1MonsterImageUrl(monster))),
    ...events.map((event) => item("event", "events", event, event.image ? sts1EventImageUrl(event.image) : null)),
  ];
}

// Blitz shop wares are searchable but not hover/link entities: their names ("유물",
// "포션") would capture those plain game terms in every description.
async function buildBlitzEntrySearchItems(): Promise<SearchIndexItem[]> {
  const [entries, englishEntries] = await Promise.all([
    getCodexBlitzEntries({ gameLocale: "kor" }),
    getCodexBlitzEntries({ gameLocale: "eng" }),
  ]);
  const englishById = new Map(englishEntries.map((entry) => [entry.id, entry]));
  return entries.map((entry) => {
    const english = englishById.get(entry.id) ?? entry;
    return {
      id: entry.id,
      type: "blitzEntry",
      title: entry.name,
      titleEn: english.name,
      description: compactSearchParts([
        entry.id,
        cleanSearchText(entry.description),
        cleanSearchText(entry.descriptionEn),
        ...entry.variants.flatMap((variant) => [variant.name, variant.nameEn]),
      ]),
      descriptionEn: compactSearchParts([
        entry.id,
        cleanSearchText(english.description),
        ...english.variants.map((variant) => variant.name),
      ]),
      imageUrl: entry.imageUrl,
      href: buildCompendiumResourceHref("blitzEntry", entry.id),
    };
  });
}

export async function buildSearchIndexPayload(): Promise<SearchIndexPayload> {
  const [entities, englishEntities] = await Promise.all([
    loadAllEntities({ gameLocale: "kor" }),
    loadAllEntities({ gameLocale: "eng" }),
  ]);
  const englishByKey = new Map(englishEntities.map((entity) => [entityKey(entity), entity]));
  const charactersKo = eventSearchCharacters(entities);
  const charactersEn = eventSearchCharacters(englishEntities);
  const items: SearchIndexItem[] = entities
    .flatMap((entity) => {
      const href = entityHref(entity);
      if (!href) return [];
      const englishEntity = englishByKey.get(entityKey(entity));

      return [{
        id: entity.id,
        type: entity.type,
        title: entity.nameKo,
        titleEn: entity.nameEn,
        description: eventSearchText(entity, charactersKo),
        descriptionEn: englishEntity
          ? eventSearchText(englishEntity, charactersEn)
          : eventSearchText(entity, charactersKo),
        imageUrl: entitySearchImageUrl(entity),
        href,
      }];
    });

  const [patches, stories, sts2Stories] = await Promise.all([
    getSTS2Patches(),
    getStories(),
    getSTS2Stories(),
  ]);

  const patchItems: SearchIndexItem[] = patches.map((patch) => {
    const shell = getPatchShell(patch);
    return {
      id: patch.id,
      type: "patch",
      title: shell ? patch.titleKo : `${patch.versionLabelKo ?? patch.id} ${patch.titleKo}`,
      titleEn: shell ? patch.title : `${patch.versionLabel ?? patch.id} ${patch.title}`,
      description: [patch.summaryKo, patch.date, patch.version, patch.type].filter(Boolean).join(" "),
      descriptionEn: [patch.summary, patch.date, patch.version, patch.type].filter(Boolean).join(" "),
      imageUrl: shell?.searchImageUrl ?? "/images/sts2/nav/patch_notes_icon.png",
      href: `/patches/${patch.version}`,
    };
  });

  const storyItems: SearchIndexItem[] = [...stories, ...sts2Stories].map((story) => ({
    id: story.id,
    type: "story",
    title: story.sentence,
    titleEn: story.sentence,
    description: [
      story.game,
      story.entityType,
      story.entityId,
      story.changeId,
      story.source,
      ...(story.tags ?? []),
      ...(story.linkedEntities?.map((entity) => `${entity.game ?? ""} ${entity.entityType} ${entity.entityId} ${entity.label ?? ""}`) ?? []),
    ].filter(Boolean).join(" "),
    descriptionEn: "",
    imageUrl: "/images/bone_tea.png",
    href: `/#${story.id}`,
  }));

  const [blitzEntryItems, sts1Items] = await Promise.all([
    buildBlitzEntrySearchItems(),
    buildSts1SearchItems("kor"),
  ]);

  return { items: [...patchItems, ...storyItems, ...items, ...blitzEntryItems, ...sts1Items, ...buildPlaceSearchItems()] };
}
