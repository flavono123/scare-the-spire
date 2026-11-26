import type { CodexCard } from "@/lib/codex-types";

// Card library sort, shared with the 어려운 결정 pool.
export type SortKey = "color" | "type" | "rarity" | "cost" | "name";
export type SortDir = "asc" | "desc";

const COLOR_SORT_ORDER: Record<string, number> = {
  ironclad: 0, silent: 1, defect: 2, necrobinder: 3, regent: 4, fool: 5,
  colorless: 6, ancient: 7, status: 8, curse: 9, event: 10, quest: 11, token: 12,
};

const TYPE_SORT_ORDER: Record<string, number> = {
  "공격": 0, "스킬": 1, "파워": 2, "저주": 3, "상태이상": 4, "퀘스트": 5,
};

const RARITY_SORT_ORDER: Record<string, number> = {
  "기본": 0, "일반": 1, "고급": 2, "희귀": 3,
  "고대의 존재": 4, "이벤트": 4, "토큰": 4, "저주": 4, "상태이상": 4, "퀘스트": 4,
};

function getCardSortCategory(card: CodexCard): string {
  if (card.rarity === "고대의 존재") return "ancient";
  if (card.color === "status" || card.rarity === "상태이상" || card.type === "상태이상") return "status";
  if (card.color === "curse" || card.rarity === "저주" || card.type === "저주") return "curse";
  if (card.rarity === "이벤트") return "event";
  if (card.color === "quest" || card.rarity === "퀘스트" || card.type === "퀘스트") return "quest";
  if (card.color === "token" || card.rarity === "토큰") return "token";
  return card.color;
}

export function compareCards(a: CodexCard, b: CodexCard, key: SortKey, dir: SortDir): number {
  let cmp = 0;
  switch (key) {
    case "color":
      cmp = (COLOR_SORT_ORDER[getCardSortCategory(a)] ?? 99) - (COLOR_SORT_ORDER[getCardSortCategory(b)] ?? 99);
      break;
    case "type":
      cmp = (TYPE_SORT_ORDER[a.type] ?? 99) - (TYPE_SORT_ORDER[b.type] ?? 99);
      break;
    case "rarity":
      cmp = (RARITY_SORT_ORDER[a.rarity] ?? 99) - (RARITY_SORT_ORDER[b.rarity] ?? 99);
      break;
    case "cost":
      cmp = a.cost - b.cost;
      break;
    case "name":
      cmp = a.name.localeCompare(b.name, "ko");
      break;
  }
  return dir === "desc" ? -cmp : cmp;
}
