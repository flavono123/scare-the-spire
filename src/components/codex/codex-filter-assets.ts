export const CHARACTER_TOKEN_ICONS: Record<string, string> = {
  ironclad: "/images/sts2/characters/character_icon_ironclad.webp",
  silent: "/images/sts2/characters/character_icon_silent.webp",
  defect: "/images/sts2/characters/character_icon_defect.webp",
  necrobinder: "/images/sts2/characters/character_icon_necrobinder.webp",
  regent: "/images/sts2/characters/character_icon_regent.webp",
};

export const COLORLESS_FILTER_ICON = "/images/sts2/icons/colorless_energy_icon.webp";
export const EVENT_FILTER_ICON = "/images/game-assets/card-library/filter_event.webp";

export function getCharacterTokenIcon(characterId: string, fallback: string): string {
  return CHARACTER_TOKEN_ICONS[characterId.toLowerCase()] ?? fallback;
}
