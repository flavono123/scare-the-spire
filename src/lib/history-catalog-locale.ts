import { bakeDescription } from "@/lib/codex-bake";
import type { CodexGameUiLabels } from "@/lib/codex-game-ui";
import type {
  CardRarityKo,
  CardTypeKo,
  CodexCard,
  CodexEnchantment,
  CodexKeyword,
  CodexMonster,
  CodexPotion,
  CodexPower,
  CodexRelic,
  PotionRarityKo,
  RelicRarityKo,
} from "@/lib/codex-types";
import { gameText } from "@/lib/game-localization-text";
import type { HistoryLocTables } from "@/lib/history-loc-tables";
import { getHistoryLocTablesSync } from "@/lib/history-loc-tables";
import { createCardSideTipCatalog } from "@/lib/card-side-tip-catalog";
import type { CardSideTipCatalog } from "@/lib/card-keyword-tips";
import type { CardSideTipCatalogSources } from "@/lib/card-side-tip-catalog";
import type { GameLocale } from "@/lib/i18n";

const CARD_TYPE_KEYS: Record<CardTypeKo, string> = {
  공격: "CARD_TYPE.ATTACK",
  스킬: "CARD_TYPE.SKILL",
  파워: "CARD_TYPE.POWER",
  저주: "CARD_TYPE.CURSE",
  상태이상: "CARD_TYPE.STATUS",
  퀘스트: "CARD_TYPE.QUEST",
};

const CARD_RARITY_KEYS: Record<CardRarityKo, string> = {
  기본: "CARD_RARITY.BASIC",
  일반: "CARD_RARITY.COMMON",
  고급: "CARD_RARITY.UNCOMMON",
  희귀: "CARD_RARITY.RARE",
  "고대의 존재": "CARD_RARITY.ANCIENT",
  이벤트: "CARD_RARITY.EVENT",
  토큰: "CARD_RARITY.TOKEN",
  저주: "CARD_RARITY.CURSE",
  상태이상: "CARD_RARITY.STATUS",
  퀘스트: "CARD_RARITY.QUEST",
};

const RELIC_COLLECTION_KEYS: Record<Exclude<RelicRarityKo, "None">, string> = {
  "시작 유물": "STARTER",
  "일반 유물": "COMMON",
  "고급 유물": "UNCOMMON",
  "희귀 유물": "RARE",
  "상점 유물": "SHOP",
  "이벤트 유물": "EVENT",
  "고대 유물": "ANCIENT",
};

const RELIC_GAMEPLAY_KEYS: Record<RelicRarityKo, string> = {
  "시작 유물": "RELIC_RARITY.STARTER",
  "일반 유물": "RELIC_RARITY.COMMON",
  "고급 유물": "RELIC_RARITY.UNCOMMON",
  "희귀 유물": "RELIC_RARITY.RARE",
  "상점 유물": "RELIC_RARITY.SHOP",
  "이벤트 유물": "RELIC_RARITY.EVENT",
  "고대 유물": "RELIC_RARITY.ANCIENT",
  None: "RELIC_RARITY.NONE",
};

const POTION_LAB_SECTION_KEYS = {
  common: "COMMON",
  uncommon: "UNCOMMON",
  rare: "RARE",
  special: "SPECIAL",
} as const;

const POTION_GAMEPLAY_KEYS: Record<PotionRarityKo, string> = {
  일반: "POTION_RARITY.COMMON",
  고급: "POTION_RARITY.UNCOMMON",
  희귀: "POTION_RARITY.RARE",
  이벤트: "POTION_RARITY.EVENT",
  토큰: "POTION_RARITY.TOKEN",
};

export function locResourceId(id: string): string {
  return id.includes(".") ? (id.split(".").pop() ?? id) : id;
}

function parseCollectionLabel(source: string, fallback: string): string {
  const match = source.match(/\[b\]([^:：\]]+)[：:]?\[\/b\]/);
  return match?.[1]?.trim() || fallback;
}

function cardTypeLabels(gameplay: HistoryLocTables["gameplayUi"]): Record<CardTypeKo, string> {
  return Object.fromEntries(
    Object.entries(CARD_TYPE_KEYS).map(([type, key]) => [
      type,
      gameText(gameplay, key, type),
    ]),
  ) as Record<CardTypeKo, string>;
}

function cardRarityLabels(gameplay: HistoryLocTables["gameplayUi"]): Record<CardRarityKo, string> {
  return Object.fromEntries(
    Object.entries(CARD_RARITY_KEYS).map(([rarity, key]) => [
      rarity,
      gameText(gameplay, key, rarity),
    ]),
  ) as Record<CardRarityKo, string>;
}

function overlayKeywordLabels(
  current: Record<string, string>,
  keywords: readonly CodexKeyword[],
  tables: HistoryLocTables,
): Record<string, string> {
  const idByName = new Map(keywords.map((keyword) => [keyword.name, keyword.id]));
  const out: Record<string, string> = { ...current };
  for (const korName of Object.keys(current)) {
    const id = idByName.get(korName);
    if (!id) continue;
    out[korName] =
      tables.cardKeywords[`${id}.title`]
      ?? tables.staticHoverTips[`${id}.title`]
      ?? current[korName];
  }
  return out;
}

export function overlayHistoryCard(
  card: CodexCard,
  tables: HistoryLocTables,
  keywords: readonly CodexKeyword[],
): CodexCard {
  const id = locResourceId(card.id);
  const title = tables.cards[`${id}.title`];
  const raw = tables.cards[`${id}.description`];
  const types = cardTypeLabels(tables.gameplayUi);
  const rarities = cardRarityLabels(tables.gameplayUi);
  return {
    ...card,
    name: title ?? card.nameEn,
    descriptionRaw: raw ?? card.descriptionRawEn,
    description: raw ? bakeDescription(raw, card.vars) : card.descriptionEn,
    typeLabel: types[card.type] ?? card.typeLabel,
    rarityLabel: rarities[card.rarity] ?? card.rarityLabel,
    keywordLabels: overlayKeywordLabels(card.keywordLabels, keywords, tables),
  };
}

export function overlayHistoryRelic(relic: CodexRelic, tables: HistoryLocTables): CodexRelic {
  const id = locResourceId(relic.id);
  const title = tables.relics[`${id}.title`];
  const raw = tables.relics[`${id}.description`];
  const flavor = tables.relics[`${id}.flavor`];
  return {
    ...relic,
    name: title ?? relic.nameEn,
    descriptionRaw: raw ?? relic.descriptionRawEn,
    description: raw ? bakeDescription(raw, relic.vars) : relic.descriptionEn,
    flavor: flavor ?? relic.flavor,
  };
}

export function overlayHistoryPotion(potion: CodexPotion, tables: HistoryLocTables): CodexPotion {
  const id = locResourceId(potion.id);
  const title = tables.potions[`${id}.title`];
  const raw = tables.potions[`${id}.description`];
  return {
    ...potion,
    name: title ?? potion.nameEn,
    descriptionRaw: raw ?? potion.descriptionRawEn,
    description: raw ? bakeDescription(raw, potion.vars) : potion.descriptionEn,
  };
}

function powerLocalizationBase(powers: HistoryLocTables["powers"], id: string): string {
  const powerKey = `${id}_POWER`;
  return `${powerKey}.title` in powers || `${powerKey}.smartDescription` in powers
    ? powerKey
    : id;
}

export function overlayHistoryPower(power: CodexPower, tables: HistoryLocTables): CodexPower {
  const id = locResourceId(power.id);
  const base = powerLocalizationBase(tables.powers, id);
  const title = tables.powers[`${base}.title`];
  const raw =
    tables.powers[`${base}.smartDescription`]
    ?? tables.powers[`${base}.description`];
  return {
    ...power,
    name: title ?? power.nameEn,
    descriptionRaw: raw ?? power.descriptionRawEn,
    description: raw ? bakeDescription(raw, power.vars) : power.descriptionEn,
  };
}

export function overlayHistoryMonster(monster: CodexMonster, tables: HistoryLocTables): CodexMonster {
  const id = locResourceId(monster.id);
  const name = tables.monsters[`${id}.name`];
  return {
    ...monster,
    name: name ?? monster.nameEn,
  };
}

export function overlayHistoryKeyword(keyword: CodexKeyword, tables: HistoryLocTables): CodexKeyword {
  const id = locResourceId(keyword.id);
  const table = keyword.source === "staticHoverTip" ? tables.staticHoverTips : tables.cardKeywords;
  const title = table[`${id}.title`] ?? tables.staticHoverTips[`${id}.title`];
  const description = table[`${id}.description`] ?? tables.staticHoverTips[`${id}.description`];
  return {
    ...keyword,
    name: title ?? keyword.nameEn,
    description: description ?? keyword.descriptionEn,
    descriptionRaw: description ?? keyword.descriptionRawEn,
  };
}

export function overlayHistoryEnchantment(
  enchantment: CodexEnchantment,
  tables: HistoryLocTables,
): CodexEnchantment {
  const id = locResourceId(enchantment.id);
  const title = tables.enchantments[`${id}.title`];
  const raw = tables.enchantments[`${id}.description`];
  const extraRaw = tables.enchantments[`${id}.extraCardText`];
  return {
    ...enchantment,
    name: title ?? enchantment.nameEn,
    descriptionRaw: raw ?? enchantment.descriptionRawEn,
    description: raw ? bakeDescription(raw, enchantment.vars) : enchantment.descriptionEn,
    extraCardText: extraRaw ? bakeDescription(extraRaw, enchantment.vars) : enchantment.extraCardTextEn,
  };
}

export type HistoryLocalizedCatalog = {
  allCards: CodexCard[];
  allRelics: CodexRelic[];
  allPotions: CodexPotion[];
  allPowers: CodexPower[];
  allMonsters: CodexMonster[];
  allEnchantments: CodexEnchantment[];
  tipSources: CardSideTipCatalogSources | null;
};

export function localizeHistoryCatalog(
  catalog: HistoryLocalizedCatalog,
  tables: HistoryLocTables,
): HistoryLocalizedCatalog {
  const keywords = (catalog.tipSources?.keywords ?? []).map((keyword) =>
    overlayHistoryKeyword(keyword, tables),
  );
  const allCards = catalog.allCards.map((card) =>
    overlayHistoryCard(card, tables, catalog.tipSources?.keywords ?? []),
  );
  const allRelics = catalog.allRelics.map((relic) => overlayHistoryRelic(relic, tables));
  const allPotions = catalog.allPotions.map((potion) => overlayHistoryPotion(potion, tables));
  const allPowers = catalog.allPowers.map((power) => overlayHistoryPower(power, tables));
  const allMonsters = catalog.allMonsters.map((monster) => overlayHistoryMonster(monster, tables));
  const allEnchantments = catalog.allEnchantments.map((enchantment) =>
    overlayHistoryEnchantment(enchantment, tables),
  );
  const tipSources = catalog.tipSources
    ? {
        ...catalog.tipSources,
        keywords,
        staticHoverTips: tables.staticHoverTips,
        orbs: tables.orbs,
        monsterNames: tables.monsters,
      }
    : null;
  return {
    allCards,
    allRelics,
    allPotions,
    allPowers,
    allMonsters,
    allEnchantments,
    tipSources,
  };
}

export function createLocalizedHistorySideTipCatalog(
  catalog: HistoryLocalizedCatalog,
): CardSideTipCatalog | null {
  if (!catalog.tipSources) return null;
  return createCardSideTipCatalog({
    sources: catalog.tipSources,
    cards: catalog.allCards,
    powers: catalog.allPowers,
    monsters: catalog.allMonsters,
  });
}

export function buildHistoryHoverGameUi(tables: HistoryLocTables): CodexGameUiLabels {
  const relicRarities = {
    ...Object.fromEntries(
      Object.entries(RELIC_COLLECTION_KEYS).map(([rarity, key]) => {
        const fallback = gameText(tables.gameplayUi, RELIC_GAMEPLAY_KEYS[rarity as RelicRarityKo], rarity);
        return [
          rarity,
          {
            label: parseCollectionLabel(gameText(tables.relicCollection, key, fallback), fallback),
            description: "",
          },
        ];
      }),
    ),
    None: {
      label: gameText(tables.gameplayUi, RELIC_GAMEPLAY_KEYS.None, "Other"),
      description: "",
    },
  } as CodexGameUiLabels["relicCollection"]["rarities"];

  const potionSections = Object.fromEntries(
    Object.entries(POTION_LAB_SECTION_KEYS).map(([section, key]) => {
      const fallback = section;
      return [
        section,
        {
          label: parseCollectionLabel(gameText(tables.potionLab, key, fallback), fallback),
          description: "",
        },
      ];
    }),
  ) as CodexGameUiLabels["potionLab"]["sections"];

  const potionRarities = Object.fromEntries(
    Object.entries(POTION_GAMEPLAY_KEYS).map(([rarity, key]) => [
      rarity,
      {
        label: gameText(tables.gameplayUi, key, rarity),
        description: "",
      },
    ]),
  ) as CodexGameUiLabels["potionLab"]["rarities"];

  return {
    relicCollection: { rarities: relicRarities },
    potionLab: { rarities: potionRarities, sections: potionSections },
    eventsTitle: gameText(tables.gameplayUi, "CARD_RARITY.EVENT", "Event"),
  } as CodexGameUiLabels;
}

export function historyEnchantmentLocaleCopy(
  id: string,
  locale: GameLocale,
): { name: string; extraCardText: string | null } | null {
  if (locale === "kor") return null;
  const tables = getHistoryLocTablesSync(locale);
  if (!tables) return null;
  const key = locResourceId(id).toUpperCase().replace(/^ENCHANTMENT\./, "");
  const name = tables.enchantments[`${key}.title`];
  const extraCardText = tables.enchantments[`${key}.extraCardText`] ?? null;
  if (!name && extraCardText == null) return null;
  return { name: name ?? key, extraCardText };
}

export function historyStaticHoverTipFromTables(
  id: string,
  tables: HistoryLocTables | null | undefined,
  fallback: { title: string; description: string },
): { title: string; description: string } {
  if (!tables) return fallback;
  return {
    title: tables.staticHoverTips[`${id}.title`] ?? fallback.title,
    description: tables.staticHoverTips[`${id}.description`] ?? fallback.description,
  };
}
