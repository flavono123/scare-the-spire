import type { CodexAffliction, CodexCard } from "./codex-types";
import { substituteAmount } from "./sts2-enchant-rules";

export const DEFAULT_AFFLICTION_AMOUNT = 1;

const APPLICABLE_CARD_TYPES: Partial<Record<string, CodexCard["type"]>> = {
  ENTANGLED: "공격",
  GALVANIZED: "파워",
  SMOG: "스킬",
};

const AFFLICTION_ADDED_KEYWORDS: Record<string, string[]> = {
  HEXED: ["휘발성"],
};

function normalizeId(id: string): string {
  return id.toUpperCase();
}

export function canAfflictCard(affliction: CodexAffliction, card: CodexCard): boolean {
  const requiredType = APPLICABLE_CARD_TYPES[normalizeId(affliction.id)];
  return requiredType ? card.type === requiredType : true;
}

export function getAfflictionAddedKeywords(affliction: CodexAffliction): string[] {
  return AFFLICTION_ADDED_KEYWORDS[normalizeId(affliction.id)] ?? [];
}

export function getAfflictionDescriptionSuffix(
  affliction: CodexAffliction,
  amount = DEFAULT_AFFLICTION_AMOUNT,
): string | null {
  if (normalizeId(affliction.id) === "HEXED") return null;
  const text = affliction.extraCardText ?? affliction.description;
  return substituteAmount(text, amount, { asEnergyIcon: normalizeId(affliction.id) === "ENTANGLED" });
}

export function getAfflictionForcedCost(
  affliction: CodexAffliction | null,
  card: CodexCard,
  opts: {
    showUpgrade: boolean;
    enchantForcedCost: number | null;
    amount?: number;
  },
): number | null {
  if (!affliction || normalizeId(affliction.id) !== "ENTANGLED" || card.isXCost || card.cost < 0) {
    return opts.enchantForcedCost;
  }

  const baseCost = opts.enchantForcedCost ??
    (opts.showUpgrade && card.upgrade?.cost !== undefined ? Number(card.upgrade.cost) : card.cost);
  return baseCost + (opts.amount ?? DEFAULT_AFFLICTION_AMOUNT);
}
