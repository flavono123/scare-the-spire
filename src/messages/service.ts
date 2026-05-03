import type { ServiceLocale } from "@/lib/i18n";

export const serviceMessages = {
  ko: {
    brand: "슬서운 이야기",
    serviceLocaleName: "한국어",
    serviceLocaleSwitch: "English",
    serviceLocaleSelect: "서비스",
    gameLocaleSelect: "게임 문구",
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
    },
  },
  en: {
    brand: "Scare the Spire",
    serviceLocaleName: "English",
    serviceLocaleSwitch: "한국어",
    serviceLocaleSelect: "Service",
    gameLocaleSelect: "Game Text",
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
    },
  },
} as const satisfies Record<ServiceLocale, object>;

export type ServiceMessages = (typeof serviceMessages)[ServiceLocale];
