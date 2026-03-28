// Card metadata annotations — overlays on top of game-extracted data.
// Does NOT modify the spec; enriches cards for service-level features.

import { CodexCard } from "./codex-types";

// Sub-category for cards whose spec rarity falls under "기타"
export type RarityDetail =
  | "unique"    // Character-specific ancient cards (고유)
  | "starter"   // Starting deck cards (시작)
  | "ancient"   // Shared/event ancient cards (고대의 존재)
  | "event"     // Event-only cards (이벤트)
  | "token"     // Generated/summoned cards (토큰)
  | "curse"     // Curse cards (저주)
  | "status"    // Status effect cards (상태이상)
  | "quest";    // Quest items (퀘스트)

export interface CardAnnotation {
  rarityDetail: RarityDetail | null;
}

// Derive annotation from existing card fields — no manual mapping needed
export function annotateCard(card: CodexCard): CardAnnotation {
  if (card.rarity === "기본") {
    return { rarityDetail: "starter" };
  }
  if (card.rarity === "고대의 존재") {
    // Character-specific ancient = unique; event/shared = ancient
    const isCharacterCard = !["event", "colorless", "token"].includes(card.color);
    return { rarityDetail: isCharacterCard ? "unique" : "ancient" };
  }
  if (card.rarity === "이벤트") return { rarityDetail: "event" };
  if (card.rarity === "토큰") return { rarityDetail: "token" };
  if (card.rarity === "저주") return { rarityDetail: "curse" };
  if (card.rarity === "상태이상") return { rarityDetail: "status" };
  if (card.rarity === "퀘스트") return { rarityDetail: "quest" };
  // Standard rarities (일반, 고급, 희귀) have no detail annotation
  return { rarityDetail: null };
}

// Check if a card is in the "기타" bucket (not 일반/고급/희귀)
export function isEtcRarity(card: CodexCard): boolean {
  return !["일반", "고급", "희귀"].includes(card.rarity);
}

// Display labels for rarity detail sub-filters
export const RARITY_DETAIL_LABELS: Record<RarityDetail, string> = {
  unique: "고유",
  starter: "시작",
  ancient: "고대의 존재",
  event: "이벤트",
  token: "토큰",
  curse: "저주",
  status: "상태이상",
  quest: "퀘스트",
};

// Order for display in filter UI
export const RARITY_DETAIL_ORDER: RarityDetail[] = [
  "starter",
  "unique",
  "ancient",
  "event",
  "token",
  "curse",
  "status",
  "quest",
];

// Colors for filter chips
export const RARITY_DETAIL_COLORS: Record<RarityDetail, string> = {
  unique: "#ffd740",
  starter: "#8b8b8b",
  ancient: "#ff8a65",
  event: "#ce93d8",
  token: "#78909c",
  curse: "#ef5350",
  status: "#7e57c2",
  quest: "#4fc3f7",
};
