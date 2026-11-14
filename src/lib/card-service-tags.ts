/**
 * Card tags this service defines on top of the game's `CardTag` (`CodexCard.tags`).
 * They group cards the game groups in code without a tag.
 */
export const CARD_SERVICE_TAGS = ["Tarot"] as const;
export type CardServiceTag = (typeof CARD_SERVICE_TAGS)[number];

// Game TarotCards.All (Mythic Form's pool); the game's "타로" hover tip names the group.
const TAROT_CARD_IDS = new Set([
  "JUDGEMENT", "THE_FOOL", "THE_HIGH_PRIESTESS", "THE_EMPEROR", "THE_EMPRESS", "THE_HANGED_MAN",
  "THE_HIEROPHANT", "THE_CHARIOT", "JUSTICE", "THE_MAGICIAN", "THE_MOON", "THE_TOWER", "STRENGTH",
  "DEATH", "TEMPERANCE", "THE_DEVIL", "THE_HERMIT", "THE_LOVERS", "THE_STAR", "THE_SUN", "THE_WORLD",
  "WHEEL_OF_FORTUNE",
]);

export function cardServiceTags(cardId: string): CardServiceTag[] {
  return TAROT_CARD_IDS.has(cardId) ? ["Tarot"] : [];
}
