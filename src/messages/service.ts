import type { ServiceLocale } from "@/lib/i18n";

export const serviceMessages = {
  ko: {
    brand: "슬서운 이야기",
    languageSelect: "언어",
    nav: {
      patches: "패치노트",
      chemicalX: "케미컬X",
      historyCourse: "역사 강의서",
    },
    games: {
      sts2Codex: "STS2 백과사전",
      sts1: "STS1",
    },
    codex: {
      cards: "카드",
      relics: "유물",
      potions: "포션",
      powers: "파워",
      enchantments: "인챈트",
      monsters: "몬스터",
      events: "이벤트",
      encounters: "인카운터",
      ancients: "고대의 존재",
      index: "전체 보기",
      common: {
        close: "닫기",
        openFilters: "필터 열기",
        closeFilters: "필터 닫기",
        noResults: "검색 결과가 없습니다",
        comments: "댓글",
      },
      monstersView: {
        title: "몬스터 도감",
        backToList: "몬스터 도감",
        searchPlaceholder: "몬스터 검색...",
        resultUnit: "마리",
        typeFilter: "유형",
        actFilter: "등장 막",
        moveCount: "행동",
        movePatterns: "행동 패턴",
        damagePreview: "피해량",
        damageDetails: "피해량 상세",
        block: "방어력",
        encounters: "등장 전투",
        weakEncounter: "약한 전투",
        appearsWith: "함께 등장:",
        stats: {
          type: "유형",
          hp: "체력",
          hpAscension: "체력 (승천)",
          moves: "행동",
        },
        filters: {
          typeHints: {
            label: "유형",
            examples: ["일반", "엘리트", "보스"],
          },
          actHints: {
            label: "막",
            examples: ["1막", "2막", "3막", "지하선착장"],
          },
        },
        monsterTypes: {
          Normal: {
            label: "일반",
            description: "첨탑에서 가장 자주 마주치는 전투입니다.",
          },
          Elite: {
            label: "엘리트",
            description: "일반 전투보다 강력하고 보상이 큰 전투입니다.",
          },
          Boss: {
            label: "보스",
            description: "각 막의 끝을 지키는 주요 적입니다.",
          },
        },
        roomTypes: {
          Monster: "일반 전투",
          Elite: "엘리트 전투",
          Boss: "보스 전투",
        },
        acts: {
          "Act 1 - Overgrowth": "1막 - 과성장",
          Underdocks: "1막 - 지하 선착장",
          "Act 2 - Hive": "2막 - 군락",
          "Act 3 - Glory": "3막 - 영광",
          none: "막 무관",
        },
      },
    },
  },
  en: {
    brand: "Scare the Spire",
    languageSelect: "Language",
    nav: {
      patches: "Patch Notes",
      chemicalX: "Chemical X",
      historyCourse: "History Course",
    },
    games: {
      sts2Codex: "STS2 Codex",
      sts1: "STS1",
    },
    codex: {
      cards: "Cards",
      relics: "Relics",
      potions: "Potions",
      powers: "Powers",
      enchantments: "Enchantments",
      monsters: "Monsters",
      events: "Events",
      encounters: "Encounters",
      ancients: "Ancients",
      index: "All",
      common: {
        close: "Close",
        openFilters: "Open filters",
        closeFilters: "Close filters",
        noResults: "No results",
        comments: "Comments",
      },
      monstersView: {
        title: "Monster Codex",
        backToList: "Monster Codex",
        searchPlaceholder: "Search monsters...",
        resultUnit: "monsters",
        typeFilter: "Type",
        actFilter: "Act",
        moveCount: "moves",
        movePatterns: "Move Patterns",
        damagePreview: "Damage",
        damageDetails: "Damage Details",
        block: "Block",
        encounters: "Encounters",
        weakEncounter: "Weak encounter",
        appearsWith: "Appears with:",
        stats: {
          type: "Type",
          hp: "HP",
          hpAscension: "HP (Ascension)",
          moves: "Moves",
        },
        filters: {
          typeHints: {
            label: "Type",
            examples: ["normal", "elite", "boss"],
          },
          actHints: {
            label: "Act",
            examples: ["act1", "act2", "act3", "underdocks"],
          },
        },
        monsterTypes: {
          Normal: {
            label: "Normal",
            description: "Common fights found throughout the Spire.",
          },
          Elite: {
            label: "Elite",
            description: "Harder fights with stronger rewards.",
          },
          Boss: {
            label: "Boss",
            description: "Major enemies guarding the end of each act.",
          },
        },
        roomTypes: {
          Monster: "Monster",
          Elite: "Elite",
          Boss: "Boss",
        },
        acts: {
          "Act 1 - Overgrowth": "Act 1 - Overgrowth",
          Underdocks: "Act 1 - Underdocks",
          "Act 2 - Hive": "Act 2 - Hive",
          "Act 3 - Glory": "Act 3 - Glory",
          none: "Any Act",
        },
      },
    },
  },
} as const satisfies Record<ServiceLocale, object>;

export type ServiceMessages = (typeof serviceMessages)[ServiceLocale];
