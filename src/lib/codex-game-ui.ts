import type { GameLocale } from "@/lib/i18n";
import {
  gameText,
  readGameLocalizationTable,
} from "@/lib/game-localization";
import type {
  CardRarityKo,
  CardTypeKo,
  EncounterRoomType,
  EventAct,
  MonsterType,
  PotionRarityKo,
  PowerType,
  RelicRarityKo,
} from "@/lib/codex-types";

type CardLibraryRarityKey = CardRarityKo | "기타";

type LabelDescription = {
  label: string;
  description: string;
};

export type CodexGameUiLabels = {
  compendiumTitle: string;
  cardLibraryTitle: string;
  relicCollectionTitle: string;
  potionLabTitle: string;
  bestiaryTitle: string;
  eventsTitle: string;
  ancientsTitle: string;
  nav: {
    cards: string;
    relics: string;
    potions: string;
    powers: string;
    monsters: string;
    events: string;
    ancients: string;
  };
  common: {
    rarity: string;
  };
  cardLibrary: {
    searchPlaceholder: string;
    noResults: string;
    viewMultiplayerCards: string;
    viewStats: string;
    viewUpgrades: string;
    sort: {
      type: string;
      rarity: string;
      cost: string;
      name: string;
    };
    types: Record<CardTypeKo, string>;
    rarities: Record<CardLibraryRarityKey, string>;
  };
  relicCollection: {
    rarities: Record<RelicRarityKo, LabelDescription>;
  };
  potionLab: {
    rarities: Record<PotionRarityKo, LabelDescription>;
    sections: Record<"common" | "uncommon" | "rare" | "special", LabelDescription>;
  };
  powers: {
    types: Record<PowerType, LabelDescription>;
  };
  acts: Record<EventAct | "none", string>;
  monsterTypes: Record<MonsterType, LabelDescription>;
  encounterRoomTypes: Record<EncounterRoomType, string>;
};

const CARD_TYPE_KEYS: Record<CardTypeKo, string> = {
  공격: "CARD_TYPE.ATTACK",
  스킬: "CARD_TYPE.SKILL",
  파워: "CARD_TYPE.POWER",
  저주: "CARD_TYPE.CURSE",
  상태이상: "CARD_TYPE.STATUS",
  퀘스트: "CARD_TYPE.QUEST",
};

const CARD_RARITY_GAMEPLAY_KEYS: Record<CardRarityKo, string> = {
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

const CARD_RARITY_LIBRARY_KEYS: Record<CardLibraryRarityKey, string> = {
  기본: "CARD_LIBRARY_RARITY_BASIC",
  일반: "CARD_LIBRARY_RARITY_COMMON",
  고급: "CARD_LIBRARY_RARITY_UNCOMMON",
  희귀: "CARD_LIBRARY_RARITY_RARE",
  "고대의 존재": "CARD_LIBRARY_RARITY_ANCIENT",
  이벤트: "CARD_RARITY.EVENT",
  토큰: "CARD_RARITY.TOKEN",
  저주: "CARD_RARITY.CURSE",
  상태이상: "CARD_RARITY.STATUS",
  퀘스트: "CARD_RARITY.QUEST",
  기타: "CARD_LIBRARY_RARITY_OTHER",
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

const ACT_TITLE_KEYS: Record<Exclude<EventAct, "Underdocks">, string> & { Underdocks: string } = {
  "Act 1 - Overgrowth": "OVERGROWTH.title",
  Underdocks: "UNDERDOCKS.title",
  "Act 2 - Hive": "HIVE.title",
  "Act 3 - Glory": "GLORY.title",
};

const ACT_NUMBERS: Record<EventAct, number> = {
  "Act 1 - Overgrowth": 1,
  Underdocks: 1,
  "Act 2 - Hive": 2,
  "Act 3 - Glory": 3,
};

function stripGameMarkup(text: string): string {
  return text
    .replace(/\[\/?[a-z_]+(?:=[^\]]+)?(?::[^\]]+)?\]/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseCollectionEntry(source: string, fallbackLabel: string): LabelDescription {
  const labelMatch = source.match(/\[b\]([^:：\]]+)[：:]?\[\/b\]/);
  const label = labelMatch?.[1]?.trim() || fallbackLabel;
  const descriptionSource = source.replace(/^[\s\S]*?\[\/gold\]\s*/, "");
  const description = stripGameMarkup(descriptionSource || source);
  return { label, description };
}

function extractGoldTerm(source: string, fallback: string): string {
  const match = source.match(/\[gold\]([^[]+)\[\/gold\]/);
  return match?.[1]?.trim() || fallback;
}

function formatActLabel(
  gameplay: Record<string, string>,
  acts: Record<string, string>,
  act: EventAct,
): string {
  const actNumber = gameText(gameplay, "ACT_NUMBER", "Act {actNumber}")
    .replace("{actNumber}", String(ACT_NUMBERS[act]));
  const actName = gameText(acts, ACT_TITLE_KEYS[act], act);
  return `${actNumber} - ${actName}`;
}

export async function getCodexGameUiLabels(
  gameLocale: GameLocale,
): Promise<CodexGameUiLabels> {
  const [
    mainMenu,
    gameplay,
    cardLibrary,
    relicCollection,
    potionLab,
    acts,
    map,
    staticHoverTips,
    epochs,
    intents,
  ] = await Promise.all([
    readGameLocalizationTable(gameLocale, "main_menu_ui"),
    readGameLocalizationTable(gameLocale, "gameplay_ui"),
    readGameLocalizationTable(gameLocale, "card_library"),
    readGameLocalizationTable(gameLocale, "relic_collection"),
    readGameLocalizationTable(gameLocale, "potion_lab"),
    readGameLocalizationTable(gameLocale, "acts"),
    readGameLocalizationTable(gameLocale, "map"),
    readGameLocalizationTable(gameLocale, "static_hover_tips"),
    readGameLocalizationTable(gameLocale, "epochs"),
    readGameLocalizationTable(gameLocale, "intents"),
  ]);

  const cardTypes = Object.fromEntries(
    Object.entries(CARD_TYPE_KEYS).map(([type, key]) => [
      type,
      gameText(gameplay, key, type),
    ]),
  ) as Record<CardTypeKo, string>;

  const rarities = Object.fromEntries(
    Object.entries(CARD_RARITY_LIBRARY_KEYS).map(([rarity, key]) => {
      const source = key.startsWith("CARD_LIBRARY_") ? mainMenu : gameplay;
      return [rarity, gameText(source, key, gameText(gameplay, key, rarity))];
    }),
  ) as Record<CardLibraryRarityKey, string>;

  const relicRarities = {
    ...Object.fromEntries(
      Object.entries(RELIC_COLLECTION_KEYS).map(([rarity, key]) => [
        rarity,
        parseCollectionEntry(
          gameText(relicCollection, key, gameText(gameplay, RELIC_GAMEPLAY_KEYS[rarity as RelicRarityKo], rarity)),
          gameText(gameplay, RELIC_GAMEPLAY_KEYS[rarity as RelicRarityKo], rarity),
        ),
      ]),
    ),
    None: {
      label: gameText(gameplay, RELIC_GAMEPLAY_KEYS.None, "기타"),
      description: "",
    },
  } as Record<RelicRarityKo, LabelDescription>;

  const potionSections = Object.fromEntries(
    Object.entries(POTION_LAB_SECTION_KEYS).map(([section, key]) => [
      section,
      parseCollectionEntry(gameText(potionLab, key, section), section),
    ]),
  ) as CodexGameUiLabels["potionLab"]["sections"];

  const potionRarities: Record<PotionRarityKo, LabelDescription> = {
    일반: {
      label: gameText(gameplay, POTION_GAMEPLAY_KEYS.일반, potionSections.common.label),
      description: potionSections.common.description,
    },
    고급: {
      label: gameText(gameplay, POTION_GAMEPLAY_KEYS.고급, potionSections.uncommon.label),
      description: potionSections.uncommon.description,
    },
    희귀: {
      label: gameText(gameplay, POTION_GAMEPLAY_KEYS.희귀, potionSections.rare.label),
      description: potionSections.rare.description,
    },
    이벤트: {
      label: gameText(gameplay, POTION_GAMEPLAY_KEYS.이벤트, potionSections.special.label),
      description: potionSections.special.description,
    },
    토큰: {
      label: gameText(gameplay, POTION_GAMEPLAY_KEYS.토큰, potionSections.special.label),
      description: potionSections.special.description,
    },
  };

  const powerTypes: Record<PowerType, LabelDescription> = {
    Buff: {
      label: extractGoldTerm(gameText(intents, "BUFF.description", "Buff"), "Buff"),
      description: "",
    },
    Debuff: {
      label: extractGoldTerm(gameText(intents, "DEBUFF.description", "Debuff"), "Debuff"),
      description: "",
    },
    None: {
      label: "",
      description: "",
    },
  };

  const monsterTypes: Record<MonsterType, LabelDescription> = {
    Normal: {
      label: gameText(map, "LEGEND_ENEMY.title", "Enemy"),
      description: stripGameMarkup(gameText(map, "LEGEND_ENEMY.hoverTip.description", "")),
    },
    Elite: {
      label: gameText(map, "LEGEND_ELITE.title", "Elite"),
      description: stripGameMarkup(gameText(map, "LEGEND_ELITE.hoverTip.description", "")),
    },
    Boss: {
      label: gameText(map, "LEGEND_BOSS.title", "Boss"),
      description: stripGameMarkup(gameText(map, "LEGEND_BOSS.hoverTip.description", "")),
    },
  };

  const actsByLocale = {
    "Act 1 - Overgrowth": formatActLabel(gameplay, acts, "Act 1 - Overgrowth"),
    Underdocks: formatActLabel(gameplay, acts, "Underdocks"),
    "Act 2 - Hive": formatActLabel(gameplay, acts, "Act 2 - Hive"),
    "Act 3 - Glory": formatActLabel(gameplay, acts, "Act 3 - Glory"),
    none: "",
  };

  const powerTitle = gameText(gameplay, "CARD_TYPE.POWER", "파워");
  const eventsTitle = gameText(staticHoverTips, "ROOM_EVENT.title", "이벤트");
  const ancientsTitle = gameText(epochs, "RELIC2_EPOCH.title", gameText(staticHoverTips, "ROOM_ANCIENT.title", "고대의 존재"));

  return {
    compendiumTitle: gameText(mainMenu, "COMPENDIUM", "백과사전"),
    cardLibraryTitle: gameText(mainMenu, "COMPENDIUM_CARD_LIBRARY.title", "카드 목록"),
    relicCollectionTitle: gameText(mainMenu, "COMPENDIUM_RELIC_COLLECTION.title", "유물 모음집"),
    potionLabTitle: gameText(mainMenu, "COMPENDIUM_POTION_LAB.title", "포션 연구실"),
    bestiaryTitle: gameText(mainMenu, "COMPENDIUM_BESTIARY.title", "몬스터 도감"),
    eventsTitle,
    ancientsTitle,
    nav: {
      cards: gameText(mainMenu, "COMPENDIUM_CARD_LIBRARY.title", "카드 목록"),
      relics: gameText(mainMenu, "COMPENDIUM_RELIC_COLLECTION.title", "유물 모음집"),
      potions: gameText(mainMenu, "COMPENDIUM_POTION_LAB.title", "포션 연구실"),
      powers: powerTitle,
      monsters: gameText(mainMenu, "COMPENDIUM_BESTIARY.title", "몬스터 도감"),
      events: eventsTitle,
      ancients: ancientsTitle,
    },
    common: {
      rarity: gameText(gameplay, "SORT_RARITY", "희귀도"),
    },
    cardLibrary: {
      searchPlaceholder: gameText(cardLibrary, "SEARCH_PLACEHOLDER", "검색"),
      noResults: gameText(cardLibrary, "NO_RESULTS", "카드를 찾을 수 없습니다"),
      viewMultiplayerCards: gameText(
        cardLibrary,
        "VIEW_MULTIPLAYER_CARDS",
        "멀티플레이 카드",
      ),
      viewStats: gameText(cardLibrary, "VIEW_STATS", "통계 보기"),
      viewUpgrades: gameText(cardLibrary, "VIEW_UPGRADES", "강화 상태 보기"),
      sort: {
        type: gameText(gameplay, "SORT_TYPE", "카드 유형"),
        rarity: gameText(gameplay, "SORT_RARITY", "희귀도"),
        cost: gameText(gameplay, "SORT_COST", "비용"),
        name: gameText(gameplay, "SORT_ALPHABET", "이름순"),
      },
      types: cardTypes,
      rarities,
    },
    relicCollection: {
      rarities: relicRarities,
    },
    potionLab: {
      rarities: potionRarities,
      sections: potionSections,
    },
    powers: {
      types: powerTypes,
    },
    acts: actsByLocale,
    monsterTypes,
    encounterRoomTypes: {
      Monster: gameText(map, "LEGEND_ENEMY.title", "Enemy"),
      Elite: gameText(map, "LEGEND_ELITE.title", "Elite"),
      Boss: gameText(map, "LEGEND_BOSS.title", "Boss"),
    },
  };
}

export function getGameplayCardTypeLabels(
  gameplay: Record<string, string>,
): Record<CardTypeKo, string> {
  return Object.fromEntries(
    Object.entries(CARD_TYPE_KEYS).map(([type, key]) => [
      type,
      gameText(gameplay, key, type),
    ]),
  ) as Record<CardTypeKo, string>;
}

export function getGameplayCardRarityLabels(
  gameplay: Record<string, string>,
): Record<CardRarityKo, string> {
  return Object.fromEntries(
    Object.entries(CARD_RARITY_GAMEPLAY_KEYS).map(([rarity, key]) => [
      rarity,
      gameText(gameplay, key, rarity),
    ]),
  ) as Record<CardRarityKo, string>;
}
