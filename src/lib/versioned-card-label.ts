import type { CardTypeKo, CodexCard } from "@/lib/codex-types";

export function withResolvedCardTypeLabel(
  card: CodexCard,
  typeLabels: Record<CardTypeKo, string>,
): CodexCard {
  const typeLabel = typeLabels[card.type] ?? card.typeLabel;
  if (typeLabel === card.typeLabel) return card;
  return { ...card, typeLabel };
}
