/**
 * static_hover_tips the game can attach to card, relic, power or potion text:
 * HoverTipFactory.Static takes only the StaticHoverTip enum, plus ForEnergy and ForArrow.
 * Every other static tip (Deck, piles, gold, HP, floor, rooms, Stars ...) belongs to a UI part
 * (top bar, combat piles, map) and never shows on a gold word, so text renders it as highlight only.
 */
const TEXT_STATIC_HOVER_TIP_IDS = new Set([
  "CHANNELING", "EVOKE", "TRANSFORM", "BLOCK", "FATAL", "ENERGY", "STUN", "CARD_REWARD", "FORGE",
  "SUMMON_DYNAMIC", "SUMMON_STATIC", "REPLAY", "REPLAY_DYNAMIC", "REPLAY_STATIC", "COOK",
  "WAH_MELODY", "CHO_MELODY", "KI_MELODY", "TAROT", "ARROW",
]);

/** False for a static tip only a UI part shows; card keywords, powers and orbs always attach. */
export function isTextHoverTip(source: string, id: string): boolean {
  return source !== "staticHoverTip" || TEXT_STATIC_HOVER_TIP_IDS.has(id);
}
