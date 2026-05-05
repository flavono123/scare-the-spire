import type { GameLocale } from "@/lib/i18n";
import {
  gameText,
  readGameLocalizationTable,
} from "@/lib/game-localization";
import type { CardRarityKo, CardTypeKo } from "@/lib/codex-types";

type CardLibraryRarityKey = CardRarityKo | "기타";

export type CodexGameUiLabels = {
  compendiumTitle: string;
  cardLibraryTitle: string;
  relicCollectionTitle: string;
  potionLabTitle: string;
  bestiaryTitle: string;
  cardLibrary: {
    searchPlaceholder: string;
    noResults: string;
    viewMultiplayerCards: string;
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

export async function getCodexGameUiLabels(
  gameLocale: GameLocale,
): Promise<CodexGameUiLabels> {
  const [mainMenu, gameplay, cardLibrary] = await Promise.all([
    readGameLocalizationTable(gameLocale, "main_menu_ui"),
    readGameLocalizationTable(gameLocale, "gameplay_ui"),
    readGameLocalizationTable(gameLocale, "card_library"),
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

  return {
    compendiumTitle: gameText(mainMenu, "COMPENDIUM", "백과사전"),
    cardLibraryTitle: gameText(mainMenu, "COMPENDIUM_CARD_LIBRARY.title", "카드 목록"),
    relicCollectionTitle: gameText(mainMenu, "COMPENDIUM_RELIC_COLLECTION.title", "유물 모음집"),
    potionLabTitle: gameText(mainMenu, "COMPENDIUM_POTION_LAB.title", "포션 연구실"),
    bestiaryTitle: gameText(mainMenu, "COMPENDIUM_BESTIARY.title", "몬스터 도감"),
    cardLibrary: {
      searchPlaceholder: gameText(cardLibrary, "SEARCH_PLACEHOLDER", "검색"),
      noResults: gameText(cardLibrary, "NO_RESULTS", "카드를 찾을 수 없습니다"),
      viewMultiplayerCards: gameText(
        cardLibrary,
        "VIEW_MULTIPLAYER_CARDS",
        "멀티플레이 카드",
      ),
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
