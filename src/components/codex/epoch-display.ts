import type { ServiceLocale } from "@/lib/i18n";
import type { CodexServiceMessages } from "@/lib/codex-service";
import {
  getCharacterColor,
  type EpochAffiliation,
  type EpochUnlockCondition,
  type EpochUnlockReward,
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
  니오우: "neow",
  neow: "neow",
  다브: "darv",
  darv: "darv",
  오로바스: "orobas",
  orobas: "orobas",
  파엘: "pael",
  pael: "pael",
  탄스: "tanx",
  tanx: "tanx",
  테즈카타라: "tezcatara",
  tezcatara: "tezcatara",
  노누파이페: "nonupeipe",
  nonupeipe: "nonupeipe",
  바쿠: "vakuu",
  vakuu: "vakuu",
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

export const EPOCH_UNLOCK_CONDITION_ALIASES: Record<string, EpochUnlockCondition> = {
  점수: "score",
  score: "score",
  누적: "score",
  도전: "play_run",
  런: "play_run",
  play: "play_run",
  run: "play_run",
  모든캐릭터: "all_characters",
  allcharacters: "all_characters",
  "1막": "beat_act1",
  act1: "beat_act1",
  "2막": "beat_act2",
  act2: "beat_act2",
  "3막": "beat_act3",
  act3: "beat_act3",
  엘리트: "kill_elites",
  elite: "kill_elites",
  elites: "kill_elites",
  보스: "kill_bosses",
  boss: "kill_bosses",
  bosses: "kill_bosses",
  승천: "ascension",
  ascension: "ascension",
  고대: "encounter_ancients",
  고존: "encounter_ancients",
  ancient: "encounter_ancients",
  ancients: "encounter_ancients",
};

export const EPOCH_UNLOCK_REWARD_ALIASES: Record<string, EpochUnlockReward> = {
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
  연대기: "timeline",
  타임라인: "timeline",
  timeline: "timeline",
  없음: "none",
  none: "none",
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
    case "neow":
      return serviceLocale === "ko" ? "니오우" : "Neow";
    case "darv":
      return serviceLocale === "ko" ? "다브" : "Darv";
    case "orobas":
      return serviceLocale === "ko" ? "오로바스" : "Orobas";
    case "pael":
      return serviceLocale === "ko" ? "파엘" : "Pael";
    case "tanx":
      return serviceLocale === "ko" ? "탄스" : "Tanx";
    case "tezcatara":
      return serviceLocale === "ko" ? "테즈카타라" : "Tezcatara";
    case "nonupeipe":
      return serviceLocale === "ko" ? "노누파이페" : "Nonupeipe";
    case "vakuu":
      return serviceLocale === "ko" ? "바쿠" : "Vakuu";
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
  const fallbackColors: Partial<Record<EpochAffiliation, string>> = {
    neow: "#60a5fa",
    darv: "#c084fc",
    orobas: "#22d3ee",
    pael: "#facc15",
    tanx: "#f97316",
    tezcatara: "#fb7185",
    nonupeipe: "#a3e635",
    vakuu: "#a78bfa",
    world: "#eab308",
    spire: "#c084fc",
    reopening: "#38bdf8",
    unknown: "#a1a1aa",
  };
  return getCharacterColor(affiliation) ?? fallbackColors[affiliation] ?? "#a1a1aa";
}

export function getEpochUnlockConditionLabel(
  condition: EpochUnlockCondition,
  serviceLocale: ServiceLocale,
): string {
  if (serviceLocale === "ko") {
    return {
      score: "점수 누적",
      play_run: "도전 플레이",
      all_characters: "모든 캐릭터",
      beat_act1: "1막 클리어",
      beat_act2: "2막 클리어",
      beat_act3: "3막 클리어",
      kill_elites: "엘리트 처치",
      kill_bosses: "보스 처치",
      ascension: "승천",
      encounter_ancients: "고대의 존재 조우",
    }[condition];
  }

  return {
    score: "Score",
    play_run: "Play Run",
    all_characters: "All Characters",
    beat_act1: "Beat Act 1",
    beat_act2: "Beat Act 2",
    beat_act3: "Beat Act 3",
    kill_elites: "Kill Elites",
    kill_bosses: "Kill Bosses",
    ascension: "Ascension",
    encounter_ancients: "Ancient Encounters",
  }[condition];
}

export function getEpochUnlockRewardLabel(
  reward: EpochUnlockReward,
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
      timeline: "연대기 확장",
      none: "없음",
      unknown: "미정",
    }[reward];
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
    timeline: "Timeline",
    none: "None",
    unknown: "Unknown",
  }[reward];
}

export function getEpochUnlockConditionColor(condition: EpochUnlockCondition): string {
  return {
    score: "#facc15",
    play_run: "#34d399",
    all_characters: "#22d3ee",
    beat_act1: "#86efac",
    beat_act2: "#f97316",
    beat_act3: "#facc15",
    kill_elites: "#c084fc",
    kill_bosses: "#ef4444",
    ascension: "#ef4444",
    encounter_ancients: "#60a5fa",
  }[condition];
}

export function getEpochUnlockRewardColor(reward: EpochUnlockReward): string {
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
    timeline: "#38bdf8",
    none: "#a1a1aa",
    unknown: "#71717a",
  }[reward];
}
