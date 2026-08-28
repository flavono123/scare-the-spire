import type { GameLocale } from "@/lib/i18n";
import type { GameLocalizationTable } from "@/lib/game-localization-text";
import engCards from "../../data/sts2/localization/eng/cards.json";
import engRelics from "../../data/sts2/localization/eng/relics.json";
import engPotions from "../../data/sts2/localization/eng/potions.json";
import engPowers from "../../data/sts2/localization/eng/powers.json";
import engMonsters from "../../data/sts2/localization/eng/monsters.json";
import engEnchantments from "../../data/sts2/localization/eng/enchantments.json";
import engCardKeywords from "../../data/sts2/localization/eng/card_keywords.json";
import engStaticHoverTips from "../../data/sts2/localization/eng/static_hover_tips.json";
import engGameplayUi from "../../data/sts2/localization/eng/gameplay_ui.json";
import engRelicCollection from "../../data/sts2/localization/eng/relic_collection.json";
import engPotionLab from "../../data/sts2/localization/eng/potion_lab.json";
import engOrbs from "../../data/sts2/localization/eng/orbs.json";

export type HistoryLocTables = {
  cards: GameLocalizationTable;
  relics: GameLocalizationTable;
  potions: GameLocalizationTable;
  powers: GameLocalizationTable;
  monsters: GameLocalizationTable;
  enchantments: GameLocalizationTable;
  cardKeywords: GameLocalizationTable;
  staticHoverTips: GameLocalizationTable;
  gameplayUi: GameLocalizationTable;
  relicCollection: GameLocalizationTable;
  potionLab: GameLocalizationTable;
  orbs: GameLocalizationTable;
};

type LocModule = { default: GameLocalizationTable };

function pack(modules: {
  cards: LocModule;
  relics: LocModule;
  potions: LocModule;
  powers: LocModule;
  monsters: LocModule;
  enchantments: LocModule;
  cardKeywords: LocModule;
  staticHoverTips: LocModule;
  gameplayUi: LocModule;
  relicCollection: LocModule;
  potionLab: LocModule;
  orbs: LocModule;
}): HistoryLocTables {
  return {
    cards: modules.cards.default,
    relics: modules.relics.default,
    potions: modules.potions.default,
    powers: modules.powers.default,
    monsters: modules.monsters.default,
    enchantments: modules.enchantments.default,
    cardKeywords: modules.cardKeywords.default,
    staticHoverTips: modules.staticHoverTips.default,
    gameplayUi: modules.gameplayUi.default,
    relicCollection: modules.relicCollection.default,
    potionLab: modules.potionLab.default,
    orbs: modules.orbs.default,
  };
}

const ENGLISH_TABLES: HistoryLocTables = {
  cards: engCards as GameLocalizationTable,
  relics: engRelics as GameLocalizationTable,
  potions: engPotions as GameLocalizationTable,
  powers: engPowers as GameLocalizationTable,
  monsters: engMonsters as GameLocalizationTable,
  enchantments: engEnchantments as GameLocalizationTable,
  cardKeywords: engCardKeywords as GameLocalizationTable,
  staticHoverTips: engStaticHoverTips as GameLocalizationTable,
  gameplayUi: engGameplayUi as GameLocalizationTable,
  relicCollection: engRelicCollection as GameLocalizationTable,
  potionLab: engPotionLab as GameLocalizationTable,
  orbs: engOrbs as GameLocalizationTable,
};

const LOADERS: Record<Exclude<GameLocale, "kor">, () => Promise<HistoryLocTables>> = {
  eng: () => Promise.resolve(ENGLISH_TABLES),
  zhs: () =>
    Promise.all([
      import("../../data/sts2/localization/zhs/cards.json"),
      import("../../data/sts2/localization/zhs/relics.json"),
      import("../../data/sts2/localization/zhs/potions.json"),
      import("../../data/sts2/localization/zhs/powers.json"),
      import("../../data/sts2/localization/zhs/monsters.json"),
      import("../../data/sts2/localization/zhs/enchantments.json"),
      import("../../data/sts2/localization/zhs/card_keywords.json"),
      import("../../data/sts2/localization/zhs/static_hover_tips.json"),
      import("../../data/sts2/localization/zhs/gameplay_ui.json"),
      import("../../data/sts2/localization/zhs/relic_collection.json"),
      import("../../data/sts2/localization/zhs/potion_lab.json"),
      import("../../data/sts2/localization/zhs/orbs.json"),
    ]).then(([
      cards, relics, potions, powers, monsters, enchantments,
      cardKeywords, staticHoverTips, gameplayUi, relicCollection, potionLab, orbs,
    ]) => pack({
      cards, relics, potions, powers, monsters, enchantments,
      cardKeywords, staticHoverTips, gameplayUi, relicCollection, potionLab, orbs,
    })),
  jpn: () =>
    Promise.all([
      import("../../data/sts2/localization/jpn/cards.json"),
      import("../../data/sts2/localization/jpn/relics.json"),
      import("../../data/sts2/localization/jpn/potions.json"),
      import("../../data/sts2/localization/jpn/powers.json"),
      import("../../data/sts2/localization/jpn/monsters.json"),
      import("../../data/sts2/localization/jpn/enchantments.json"),
      import("../../data/sts2/localization/jpn/card_keywords.json"),
      import("../../data/sts2/localization/jpn/static_hover_tips.json"),
      import("../../data/sts2/localization/jpn/gameplay_ui.json"),
      import("../../data/sts2/localization/jpn/relic_collection.json"),
      import("../../data/sts2/localization/jpn/potion_lab.json"),
      import("../../data/sts2/localization/jpn/orbs.json"),
    ]).then(([
      cards, relics, potions, powers, monsters, enchantments,
      cardKeywords, staticHoverTips, gameplayUi, relicCollection, potionLab, orbs,
    ]) => pack({
      cards, relics, potions, powers, monsters, enchantments,
      cardKeywords, staticHoverTips, gameplayUi, relicCollection, potionLab, orbs,
    })),
  deu: () =>
    Promise.all([
      import("../../data/sts2/localization/deu/cards.json"),
      import("../../data/sts2/localization/deu/relics.json"),
      import("../../data/sts2/localization/deu/potions.json"),
      import("../../data/sts2/localization/deu/powers.json"),
      import("../../data/sts2/localization/deu/monsters.json"),
      import("../../data/sts2/localization/deu/enchantments.json"),
      import("../../data/sts2/localization/deu/card_keywords.json"),
      import("../../data/sts2/localization/deu/static_hover_tips.json"),
      import("../../data/sts2/localization/deu/gameplay_ui.json"),
      import("../../data/sts2/localization/deu/relic_collection.json"),
      import("../../data/sts2/localization/deu/potion_lab.json"),
      import("../../data/sts2/localization/deu/orbs.json"),
    ]).then(([
      cards, relics, potions, powers, monsters, enchantments,
      cardKeywords, staticHoverTips, gameplayUi, relicCollection, potionLab, orbs,
    ]) => pack({
      cards, relics, potions, powers, monsters, enchantments,
      cardKeywords, staticHoverTips, gameplayUi, relicCollection, potionLab, orbs,
    })),
  fra: () =>
    Promise.all([
      import("../../data/sts2/localization/fra/cards.json"),
      import("../../data/sts2/localization/fra/relics.json"),
      import("../../data/sts2/localization/fra/potions.json"),
      import("../../data/sts2/localization/fra/powers.json"),
      import("../../data/sts2/localization/fra/monsters.json"),
      import("../../data/sts2/localization/fra/enchantments.json"),
      import("../../data/sts2/localization/fra/card_keywords.json"),
      import("../../data/sts2/localization/fra/static_hover_tips.json"),
      import("../../data/sts2/localization/fra/gameplay_ui.json"),
      import("../../data/sts2/localization/fra/relic_collection.json"),
      import("../../data/sts2/localization/fra/potion_lab.json"),
      import("../../data/sts2/localization/fra/orbs.json"),
    ]).then(([
      cards, relics, potions, powers, monsters, enchantments,
      cardKeywords, staticHoverTips, gameplayUi, relicCollection, potionLab, orbs,
    ]) => pack({
      cards, relics, potions, powers, monsters, enchantments,
      cardKeywords, staticHoverTips, gameplayUi, relicCollection, potionLab, orbs,
    })),
  ita: () =>
    Promise.all([
      import("../../data/sts2/localization/ita/cards.json"),
      import("../../data/sts2/localization/ita/relics.json"),
      import("../../data/sts2/localization/ita/potions.json"),
      import("../../data/sts2/localization/ita/powers.json"),
      import("../../data/sts2/localization/ita/monsters.json"),
      import("../../data/sts2/localization/ita/enchantments.json"),
      import("../../data/sts2/localization/ita/card_keywords.json"),
      import("../../data/sts2/localization/ita/static_hover_tips.json"),
      import("../../data/sts2/localization/ita/gameplay_ui.json"),
      import("../../data/sts2/localization/ita/relic_collection.json"),
      import("../../data/sts2/localization/ita/potion_lab.json"),
      import("../../data/sts2/localization/ita/orbs.json"),
    ]).then(([
      cards, relics, potions, powers, monsters, enchantments,
      cardKeywords, staticHoverTips, gameplayUi, relicCollection, potionLab, orbs,
    ]) => pack({
      cards, relics, potions, powers, monsters, enchantments,
      cardKeywords, staticHoverTips, gameplayUi, relicCollection, potionLab, orbs,
    })),
  spa: () =>
    Promise.all([
      import("../../data/sts2/localization/spa/cards.json"),
      import("../../data/sts2/localization/spa/relics.json"),
      import("../../data/sts2/localization/spa/potions.json"),
      import("../../data/sts2/localization/spa/powers.json"),
      import("../../data/sts2/localization/spa/monsters.json"),
      import("../../data/sts2/localization/spa/enchantments.json"),
      import("../../data/sts2/localization/spa/card_keywords.json"),
      import("../../data/sts2/localization/spa/static_hover_tips.json"),
      import("../../data/sts2/localization/spa/gameplay_ui.json"),
      import("../../data/sts2/localization/spa/relic_collection.json"),
      import("../../data/sts2/localization/spa/potion_lab.json"),
      import("../../data/sts2/localization/spa/orbs.json"),
    ]).then(([
      cards, relics, potions, powers, monsters, enchantments,
      cardKeywords, staticHoverTips, gameplayUi, relicCollection, potionLab, orbs,
    ]) => pack({
      cards, relics, potions, powers, monsters, enchantments,
      cardKeywords, staticHoverTips, gameplayUi, relicCollection, potionLab, orbs,
    })),
  esp: () =>
    Promise.all([
      import("../../data/sts2/localization/esp/cards.json"),
      import("../../data/sts2/localization/esp/relics.json"),
      import("../../data/sts2/localization/esp/potions.json"),
      import("../../data/sts2/localization/esp/powers.json"),
      import("../../data/sts2/localization/esp/monsters.json"),
      import("../../data/sts2/localization/esp/enchantments.json"),
      import("../../data/sts2/localization/esp/card_keywords.json"),
      import("../../data/sts2/localization/esp/static_hover_tips.json"),
      import("../../data/sts2/localization/esp/gameplay_ui.json"),
      import("../../data/sts2/localization/esp/relic_collection.json"),
      import("../../data/sts2/localization/esp/potion_lab.json"),
      import("../../data/sts2/localization/esp/orbs.json"),
    ]).then(([
      cards, relics, potions, powers, monsters, enchantments,
      cardKeywords, staticHoverTips, gameplayUi, relicCollection, potionLab, orbs,
    ]) => pack({
      cards, relics, potions, powers, monsters, enchantments,
      cardKeywords, staticHoverTips, gameplayUi, relicCollection, potionLab, orbs,
    })),
  ptb: () =>
    Promise.all([
      import("../../data/sts2/localization/ptb/cards.json"),
      import("../../data/sts2/localization/ptb/relics.json"),
      import("../../data/sts2/localization/ptb/potions.json"),
      import("../../data/sts2/localization/ptb/powers.json"),
      import("../../data/sts2/localization/ptb/monsters.json"),
      import("../../data/sts2/localization/ptb/enchantments.json"),
      import("../../data/sts2/localization/ptb/card_keywords.json"),
      import("../../data/sts2/localization/ptb/static_hover_tips.json"),
      import("../../data/sts2/localization/ptb/gameplay_ui.json"),
      import("../../data/sts2/localization/ptb/relic_collection.json"),
      import("../../data/sts2/localization/ptb/potion_lab.json"),
      import("../../data/sts2/localization/ptb/orbs.json"),
    ]).then(([
      cards, relics, potions, powers, monsters, enchantments,
      cardKeywords, staticHoverTips, gameplayUi, relicCollection, potionLab, orbs,
    ]) => pack({
      cards, relics, potions, powers, monsters, enchantments,
      cardKeywords, staticHoverTips, gameplayUi, relicCollection, potionLab, orbs,
    })),
  rus: () =>
    Promise.all([
      import("../../data/sts2/localization/rus/cards.json"),
      import("../../data/sts2/localization/rus/relics.json"),
      import("../../data/sts2/localization/rus/potions.json"),
      import("../../data/sts2/localization/rus/powers.json"),
      import("../../data/sts2/localization/rus/monsters.json"),
      import("../../data/sts2/localization/rus/enchantments.json"),
      import("../../data/sts2/localization/rus/card_keywords.json"),
      import("../../data/sts2/localization/rus/static_hover_tips.json"),
      import("../../data/sts2/localization/rus/gameplay_ui.json"),
      import("../../data/sts2/localization/rus/relic_collection.json"),
      import("../../data/sts2/localization/rus/potion_lab.json"),
      import("../../data/sts2/localization/rus/orbs.json"),
    ]).then(([
      cards, relics, potions, powers, monsters, enchantments,
      cardKeywords, staticHoverTips, gameplayUi, relicCollection, potionLab, orbs,
    ]) => pack({
      cards, relics, potions, powers, monsters, enchantments,
      cardKeywords, staticHoverTips, gameplayUi, relicCollection, potionLab, orbs,
    })),
  pol: () =>
    Promise.all([
      import("../../data/sts2/localization/pol/cards.json"),
      import("../../data/sts2/localization/pol/relics.json"),
      import("../../data/sts2/localization/pol/potions.json"),
      import("../../data/sts2/localization/pol/powers.json"),
      import("../../data/sts2/localization/pol/monsters.json"),
      import("../../data/sts2/localization/pol/enchantments.json"),
      import("../../data/sts2/localization/pol/card_keywords.json"),
      import("../../data/sts2/localization/pol/static_hover_tips.json"),
      import("../../data/sts2/localization/pol/gameplay_ui.json"),
      import("../../data/sts2/localization/pol/relic_collection.json"),
      import("../../data/sts2/localization/pol/potion_lab.json"),
      import("../../data/sts2/localization/pol/orbs.json"),
    ]).then(([
      cards, relics, potions, powers, monsters, enchantments,
      cardKeywords, staticHoverTips, gameplayUi, relicCollection, potionLab, orbs,
    ]) => pack({
      cards, relics, potions, powers, monsters, enchantments,
      cardKeywords, staticHoverTips, gameplayUi, relicCollection, potionLab, orbs,
    })),
  tha: () =>
    Promise.all([
      import("../../data/sts2/localization/tha/cards.json"),
      import("../../data/sts2/localization/tha/relics.json"),
      import("../../data/sts2/localization/tha/potions.json"),
      import("../../data/sts2/localization/tha/powers.json"),
      import("../../data/sts2/localization/tha/monsters.json"),
      import("../../data/sts2/localization/tha/enchantments.json"),
      import("../../data/sts2/localization/tha/card_keywords.json"),
      import("../../data/sts2/localization/tha/static_hover_tips.json"),
      import("../../data/sts2/localization/tha/gameplay_ui.json"),
      import("../../data/sts2/localization/tha/relic_collection.json"),
      import("../../data/sts2/localization/tha/potion_lab.json"),
      import("../../data/sts2/localization/tha/orbs.json"),
    ]).then(([
      cards, relics, potions, powers, monsters, enchantments,
      cardKeywords, staticHoverTips, gameplayUi, relicCollection, potionLab, orbs,
    ]) => pack({
      cards, relics, potions, powers, monsters, enchantments,
      cardKeywords, staticHoverTips, gameplayUi, relicCollection, potionLab, orbs,
    })),
  tur: () =>
    Promise.all([
      import("../../data/sts2/localization/tur/cards.json"),
      import("../../data/sts2/localization/tur/relics.json"),
      import("../../data/sts2/localization/tur/potions.json"),
      import("../../data/sts2/localization/tur/powers.json"),
      import("../../data/sts2/localization/tur/monsters.json"),
      import("../../data/sts2/localization/tur/enchantments.json"),
      import("../../data/sts2/localization/tur/card_keywords.json"),
      import("../../data/sts2/localization/tur/static_hover_tips.json"),
      import("../../data/sts2/localization/tur/gameplay_ui.json"),
      import("../../data/sts2/localization/tur/relic_collection.json"),
      import("../../data/sts2/localization/tur/potion_lab.json"),
      import("../../data/sts2/localization/tur/orbs.json"),
    ]).then(([
      cards, relics, potions, powers, monsters, enchantments,
      cardKeywords, staticHoverTips, gameplayUi, relicCollection, potionLab, orbs,
    ]) => pack({
      cards, relics, potions, powers, monsters, enchantments,
      cardKeywords, staticHoverTips, gameplayUi, relicCollection, potionLab, orbs,
    })),
};

const cache: Partial<Record<GameLocale, HistoryLocTables>> = {
  eng: ENGLISH_TABLES,
};
const inflight = new Map<GameLocale, Promise<HistoryLocTables | null>>();

export function getHistoryLocTablesSync(locale: GameLocale): HistoryLocTables | null {
  return cache[locale] ?? null;
}

export function loadHistoryLocTables(locale: GameLocale): Promise<HistoryLocTables | null> {
  if (locale === "kor") return Promise.resolve(null);
  const hit = cache[locale];
  if (hit) return Promise.resolve(hit);
  const pending = inflight.get(locale);
  if (pending) return pending;
  const next = LOADERS[locale]()
    .then((tables) => {
      cache[locale] = tables;
      inflight.delete(locale);
      return tables;
    })
    .catch((error: unknown) => {
      inflight.delete(locale);
      console.warn("[history-course] failed to load game locale tables", locale, error);
      return cache.eng ?? null;
    });
  inflight.set(locale, next);
  return next;
}
