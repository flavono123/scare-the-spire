import type { CodexCard } from "@/lib/codex-types";
import type { GameLocale } from "@/lib/i18n";
import { getMadScienceVariantCard } from "@/lib/tinker-time";

/** Text fields CardTile reads from the active game locale. */
export interface CardConLocaleText {
  name: string;
  description: string;
  descriptionRaw: string;
  typeLabel: string;
  rarityLabel: string;
  keywordLabels: Record<string, string>;
  madScienceLabels?: CodexCard["madScienceLabels"];
  madScienceBaseDescriptionRaw?: string;
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
    ...(card.madScienceBaseDescriptionRaw ? { madScienceBaseDescriptionRaw: card.madScienceBaseDescriptionRaw } : {}),
  };
}

export function applyCardConLocale(
  card: CodexCard,
  text: CardConLocaleText | undefined,
): CodexCard {
  if (!text) return card;
  const localized: CodexCard = {
    ...card,
    name: text.name,
    description: text.description,
    descriptionRaw: text.descriptionRaw,
    typeLabel: text.typeLabel,
    rarityLabel: text.rarityLabel,
    keywordLabels: text.keywordLabels,
    ...(text.madScienceLabels ? { madScienceLabels: text.madScienceLabels } : {}),
    ...(text.madScienceBaseDescriptionRaw ? { madScienceBaseDescriptionRaw: text.madScienceBaseDescriptionRaw } : {}),
  };
  // The table holds the default Mad Science text; a variant is painted again from the localized template.
  return card.madScienceVariant && text.madScienceBaseDescriptionRaw
    ? getMadScienceVariantCard(localized, card.madScienceVariant)
    : localized;
}
