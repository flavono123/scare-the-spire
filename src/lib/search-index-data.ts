import type { EntityInfo, EntityType } from "@/components/patch-note-renderer";
import { stripCodexMarkup } from "@/lib/codex-search";
import { buildCompendiumResourceHref, type CompendiumResourceLinkType } from "@/lib/compendium-resource-links";
import { getStories, getSTS2Patches, getSTS2Stories } from "@/lib/data";
import { loadAllEntities } from "@/lib/load-all-entities";

export type SearchItemType = EntityType | "patch" | "story" | "historyCourse";

export type SearchIndexItem = {
  id: string;
  type: SearchItemType;
  title: string;
  titleEn: string;
  description: string;
  descriptionEn: string;
  imageUrl: string | null;
  href: string;
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
      card.tags.join(" "),
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
    for (const lines of Object.values(ancient.dialogue)) {
      for (const line of lines) {
        appendSearchParts(parts, line.order, line.speaker, line.text);
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

  return compactSearchParts(parts);
}

function entityKey(entity: Pick<EntityInfo, "type" | "id">): string {
  return `${entity.type}:${entity.id}`;
}

export async function buildSearchIndexPayload(): Promise<SearchIndexPayload> {
  const [entities, englishEntities] = await Promise.all([
    loadAllEntities({ gameLocale: "kor" }),
    loadAllEntities({ gameLocale: "eng" }),
  ]);
  const englishByKey = new Map(englishEntities.map((entity) => [entityKey(entity), entity]));
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
        description: entitySearchText(entity),
        descriptionEn: englishEntity ? entitySearchText(englishEntity) : entitySearchText(entity),
        imageUrl: entity.imageUrl,
        href,
      }];
    });

  const [patches, stories, sts2Stories] = await Promise.all([
    getSTS2Patches(),
    getStories(),
    getSTS2Stories(),
  ]);

  const patchItems: SearchIndexItem[] = patches.map((patch) => ({
    id: patch.id,
    type: "patch",
    title: `${patch.versionLabelKo ?? patch.id} ${patch.titleKo}`,
    titleEn: `${patch.versionLabel ?? patch.id} ${patch.title}`,
    description: [patch.summaryKo, patch.date, patch.version, patch.type].filter(Boolean).join(" "),
    descriptionEn: [patch.summary, patch.date, patch.version, patch.type].filter(Boolean).join(" "),
    imageUrl: "/images/sts2/nav/patch_notes_icon.png",
    href: `/patches/${patch.version}`,
  }));

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

  const historyCourseItems: SearchIndexItem[] = [{
    id: "history-course",
    type: "historyCourse",
    title: "역사 강의서",
    titleEn: "History Course",
    description: "런 리플레이 시드 공유 카드 유물 뱃지 보상 run history seed replay card relic badge",
    descriptionEn: "run history seed sharing replay card relic badge reward",
    imageUrl: "/images/sts2/relics/history_course.webp",
    href: "/history-course",
  }];

  return { items: [...patchItems, ...storyItems, ...items, ...historyCourseItems] };
}
