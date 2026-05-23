import type { ServiceLocale } from "@/lib/i18n";
import type { CodexServiceMessages } from "@/lib/codex-service";
import {
  getCharacterColor,
  type EpochAffiliation,
  type EpochUnlockKind,
} from "@/lib/codex-types";

export const EPOCH_AFFILIATION_ALIASES: Record<string, EpochAffiliation> = {
  아클: "ironclad",
  아이언클래드: "ironclad",
  ironclad: "ironclad",
  사일: "silent",
  사일런트: "silent",
  silent: "silent",
  디펙: "defect",
  디펙트: "defect",
  defect: "defect",
  네크로: "necrobinder",
  네크로바인더: "necrobinder",
  necrobinder: "necrobinder",
  리젠: "regent",
  리젠트: "regent",
  regent: "regent",
  고대: "ancient",
  고존: "ancient",
  "고대의존재": "ancient",
  ancient: "ancient",
  ancients: "ancient",
  세계: "world",
  월드: "world",
  world: "world",
  대서사: "world",
  첨탑: "spire",
  이야기: "spire",
  spire: "spire",
  tales: "spire",
  재개방: "reopening",
  reopening: "reopening",
  미정: "unknown",
  unknown: "unknown",
};

export const EPOCH_UNLOCK_KIND_ALIASES: Record<string, EpochUnlockKind> = {
  카드: "card",
  card: "card",
  cards: "card",
  유물: "relic",
  relic: "relic",
  relics: "relic",
  포션: "potion",
  potion: "potion",
  potions: "potion",
  캐릭터: "character",
  character: "character",
  char: "character",
  고대: "ancient",
  고존: "ancient",
  ancient: "ancient",
  이벤트: "event",
  event: "event",
  모드: "mode",
  mode: "mode",
  막: "act",
  act: "act",
  승천: "ascension",
  ascension: "ascension",
  이야기: "story",
  story: "story",
  미정: "unknown",
  unknown: "unknown",
};

export function getEpochAffiliationLabel(
  affiliation: EpochAffiliation,
  messages: CodexServiceMessages,
  serviceLocale: ServiceLocale,
): string {
  switch (affiliation) {
    case "ironclad":
    case "silent":
    case "defect":
    case "necrobinder":
    case "regent":
      return messages.labels.pools[affiliation];
    case "ancient":
      return messages.labels.pools.ancient;
    case "world":
      return serviceLocale === "ko" ? "세계" : "World";
    case "spire":
      return serviceLocale === "ko" ? "첨탑 이야기" : "Tales";
    case "reopening":
      return serviceLocale === "ko" ? "재개방" : "Reopening";
    case "unknown":
      return serviceLocale === "ko" ? "미정" : "Unknown";
  }
}

export function getEpochAffiliationColor(affiliation: EpochAffiliation): string {
  return getCharacterColor(affiliation) ?? {
    ancient: "#60a5fa",
    world: "#eab308",
    spire: "#c084fc",
    reopening: "#38bdf8",
    unknown: "#a1a1aa",
  }[affiliation] ?? "#a1a1aa";
}

export function getEpochUnlockKindLabel(
  kind: EpochUnlockKind,
  serviceLocale: ServiceLocale,
): string {
  if (serviceLocale === "ko") {
    return {
      card: "카드",
      relic: "유물",
      potion: "포션",
      character: "캐릭터",
      ancient: "고대의 존재",
      event: "이벤트",
      mode: "게임 모드",
      act: "막",
      ascension: "승천",
      story: "이야기",
      unknown: "미정",
    }[kind];
  }

  return {
    card: "Cards",
    relic: "Relics",
    potion: "Potions",
    character: "Character",
    ancient: "Ancient",
    event: "Event",
    mode: "Game Mode",
    act: "Act",
    ascension: "Ascension",
    story: "Story",
    unknown: "Unknown",
  }[kind];
}

export function getEpochUnlockKindColor(kind: EpochUnlockKind): string {
  return {
    card: "#eab308",
    relic: "#facc15",
    potion: "#22d3ee",
    character: "#fb923c",
    ancient: "#60a5fa",
    event: "#c084fc",
    mode: "#34d399",
    act: "#60a5fa",
    ascension: "#ef4444",
    story: "#a1a1aa",
    unknown: "#71717a",
  }[kind];
}
