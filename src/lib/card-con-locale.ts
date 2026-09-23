import type { CodexCard } from "@/lib/codex-types";
import type { GameLocale } from "@/lib/i18n";

/** Text fields CardTile reads from the active game locale. */
export interface CardConLocaleText {
  name: string;
  description: string;
  descriptionRaw: string;
  typeLabel: string;
  rarityLabel: string;
  keywordLabels: Record<string, string>;
  madScienceLabels?: CodexCard["madScienceLabels"];
}

export type CardConLocaleTable = Record<string, CardConLocaleText>;

export function cardConLocalePath(gameLocale: GameLocale): string {
  return `/generated/card-con-locale-${gameLocale}.json`;
}

export function cardConLocaleText(card: CodexCard): CardConLocaleText {
  return {
    name: card.name,
    description: card.description,
    descriptionRaw: card.descriptionRaw,
    typeLabel: card.typeLabel,
    rarityLabel: card.rarityLabel,
    keywordLabels: card.keywordLabels,
    ...(card.madScienceLabels ? { madScienceLabels: card.madScienceLabels } : {}),
  };
}

export function applyCardConLocale(
  card: CodexCard,
  text: CardConLocaleText | undefined,
): CodexCard {
  if (!text) return card;
  return {
    ...card,
    name: text.name,
    description: text.description,
    descriptionRaw: text.descriptionRaw,
    typeLabel: text.typeLabel,
    rarityLabel: text.rarityLabel,
    keywordLabels: text.keywordLabels,
    ...(text.madScienceLabels ? { madScienceLabels: text.madScienceLabels } : {}),
  };
}
