import type { CardFilterTag, CardTypeKo } from "@/lib/codex-types";

export const CHARACTER_TOKEN_ICONS: Record<string, string> = {
  ironclad: "/images/sts2/characters/character_icon_ironclad.webp",
  silent: "/images/sts2/characters/character_icon_silent.webp",
  defect: "/images/sts2/characters/character_icon_defect.webp",
  necrobinder: "/images/sts2/characters/character_icon_necrobinder.webp",
  regent: "/images/sts2/characters/character_icon_regent.webp",
  fool: "/images/sts2/characters/character_icon_fool.webp",
};

export const COLORLESS_FILTER_ICON = "/images/sts2/icons/colorless_energy_icon.webp";
export const EVENT_FILTER_ICON = "/images/game-assets/card-library/filter_event.webp";
export const TOKEN_FILTER_ICON = "/images/game-assets/card-library/pool_filter_other.webp";
export const QUEST_FILTER_ICON = "/images/sts2/ui/topbar/top_bar_map.png";

export type CardTypeFilterIconKey = Extract<
  CardTypeKo,
  "공격" | "스킬" | "파워"
>;

export const CARD_TYPE_FILTER_ICONS: Record<CardTypeFilterIconKey, string> = {
  "공격": "/images/game-assets/card-library/type_sort_attack.webp",
  "스킬": "/images/game-assets/card-library/type_sort_skill.webp",
  "파워": "/images/game-assets/card-library/type_sort_power.webp",
};

export function getCardTypeFilterIcon(type: CardTypeKo): string {
  if (type === "스킬" || type === "파워") return CARD_TYPE_FILTER_ICONS[type];
  return CARD_TYPE_FILTER_ICONS["공격"];
}

export function getCharacterTokenIcon(characterId: string, fallback: string): string {
  return CHARACTER_TOKEN_ICONS[characterId.toLowerCase()] ?? fallback;
}

/** Game art for each card tag filter: Fool melody symbols and arrow, the Wheel of Fortune for Tarot, and the power icons that act on Minion, Shiv (Infinite Blades) and Osty attacks (Calcify). */
export const CARD_TAG_FILTER_ICONS: Record<CardFilterTag, string> = {
  Wah: "/images/sts2/card-tags/wah.webp",
  Cho: "/images/sts2/card-tags/cho.webp",
  Ki: "/images/sts2/card-tags/ki.webp",
  Shoot: "/images/sts2/card-tags/shoot.webp",
  Tarot: "/images/sts2/card-tags/tarot.webp",
  Minion: "/images/sts2/powers/minion_power.webp",
  Shiv: "/images/sts2/powers/infinite_blades_power.webp",
  OstyAttack: "/images/sts2/powers/calcify_power.webp",
};
