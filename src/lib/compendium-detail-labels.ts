import type { CodexGameUiLabels } from "@/lib/codex-game-ui";
import type { ServiceLocale } from "@/lib/i18n";

// Labels the interactive Compendium detail components share with the
// server-rendered static detail, so the static text matches the detail that
// replaces it. Keep this module free of "use client": server code importing a
// value from a client module gets a client reference, not the value.

export function getDetailPatchHistoryLabels(serviceLocale: ServiceLocale) {
  return serviceLocale === "ko"
    ? {
        patchHistory: "패치 이력",
        noPatchHistory: "구조화 변경 없음",
      }
    : {
        patchHistory: "Patch History",
        noPatchHistory: "No structured changes",
      };
}

export function getCharacterReferenceLabels(serviceLocale: ServiceLocale) {
  return serviceLocale === "ko"
    ? {
        startingCards: "시작 카드",
        dedicatedRelicsAndPotions: "전용 유물, 포션",
        relics: "유물",
        potions: "포션",
      }
    : {
        startingCards: "Starting Cards",
        dedicatedRelicsAndPotions: "Character Relics & Potions",
        relics: "Relics",
        potions: "Potions",
      };
}

export function getEpochUnlockLabels(serviceLocale: ServiceLocale) {
  return serviceLocale === "ko"
    ? {
        unlockInfo: "해금 조건",
        unlockText: "해금 내용",
      }
    : {
        unlockInfo: "Unlock condition",
        unlockText: "Unlock text",
      };
}

export type RelatedResourceKind =
  | "card"
  | "event"
  | "potion"
  | "relic"
  | "enchantment"
  | "affliction"
  | "monster"
  | "encounter"
  | "ancient"
  | "power"
  | "epoch";

const RELATED_RESOURCE_FALLBACK_LABELS: Record<RelatedResourceKind, Record<ServiceLocale, string>> = {
  card: { ko: "카드", en: "Card" },
  event: { ko: "이벤트", en: "Event" },
  potion: { ko: "포션", en: "Potion" },
  relic: { ko: "유물", en: "Relic" },
  enchantment: { ko: "인챈트", en: "Enchantment" },
  affliction: { ko: "고난", en: "Affliction" },
  monster: { ko: "몬스터", en: "Monster" },
  encounter: { ko: "전투", en: "Encounter" },
  ancient: { ko: "고대의 존재", en: "Ancient" },
  power: { ko: "파워", en: "Power" },
  epoch: { ko: "연대기", en: "Epoch" },
};

const COLLECTION_SUFFIX_PATTERN = /\s*(목록|모음집|연구실|도감|Library|Collection|Lab|Codex|Bestiary)$/i;

function compactCollectionLabel(label: string): string {
  return label.replace(COLLECTION_SUFFIX_PATTERN, "").trim() || label;
}

/**
 * The "관련 …" / "Related …" heading of a related-resource group, as the
 * interactive details' RelatedResourceLinks (entity-reference-links.tsx) build it.
 */
export function relatedResourceLabel(
  kind: RelatedResourceKind,
  serviceLocale: ServiceLocale,
  gameUi?: CodexGameUiLabels,
): string {
  const fallback = RELATED_RESOURCE_FALLBACK_LABELS[kind][serviceLocale];
  const resourceLabel = (() => {
    if (!gameUi) return fallback;
    switch (kind) {
      case "card":
        return compactCollectionLabel(gameUi.cardLibraryTitle);
      case "relic":
        return compactCollectionLabel(gameUi.relicCollectionTitle);
      case "potion":
        return compactCollectionLabel(gameUi.potionLabTitle);
      case "power":
        return gameUi.nav.powers;
      case "monster":
        return compactCollectionLabel(gameUi.bestiaryTitle);
      case "event":
        return gameUi.eventsTitle;
      case "ancient":
        return gameUi.ancientsTitle;
      case "epoch":
        return gameUi.epochsTitle;
      case "encounter":
      case "enchantment":
      case "affliction":
        return fallback;
    }
  })();
  return serviceLocale === "ko" ? `관련 ${resourceLabel}` : `Related ${resourceLabel}`;
}
