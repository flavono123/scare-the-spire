import type { Sts1Card, Sts1CardType } from "@/lib/sts1/types";
import { sts1CardUiUrl, sts1CharacterIconUrl } from "@/lib/sts1/paths";

const FRAME_RARITY: Record<string, "common" | "uncommon" | "rare"> = {
  basic: "common",
  common: "common",
  special: "common",
  curse: "common",
  uncommon: "uncommon",
  rare: "rare",
};

export function sts1CardBackgroundRegion(card: Sts1Card): string {
  if (card.type === "curse" || card.cardColor === "curse") return "bg_skill_black";
  if (card.type === "status") return "bg_skill_colorless";
  const type = card.type === "power" || card.type === "attack" ? card.type : "skill";
  const color = ["red", "green", "blue", "purple", "colorless"].includes(card.cardColor)
    ? card.cardColor
    : "colorless";
  return `bg_${type}_${color}`;
}

export function sts1CardFrameRegion(card: Sts1Card): string {
  const type = card.type === "power" || card.type === "attack" ? card.type : "skill";
  const rarity = FRAME_RARITY[card.rarity] ?? "common";
  return `frame_${type}_${rarity}`;
}

export function sts1CardBannerRegion(card: Sts1Card): string {
  const rarity = FRAME_RARITY[card.rarity] ?? "common";
  return `banner_${rarity}`;
}

export function sts1CardOrbRegion(card: Sts1Card): string {
  if (card.cardColor === "red") return "card_red_orb";
  if (card.cardColor === "green") return "card_green_orb";
  if (card.cardColor === "blue") return "card_blue_orb";
  if (card.cardColor === "purple") return "card_purple_orb";
  return "card_colorless_orb";
}

export function sts1TypeFilterIcon(type: Extract<Sts1CardType, "attack" | "skill" | "power">): string {
  return sts1CardUiUrl(`frame_${type}_common`);
}

export const STS1_FILTER_ICONS = {
  ironclad: sts1CharacterIconUrl("ironclad"),
  silent: sts1CharacterIconUrl("silent"),
  defect: sts1CharacterIconUrl("defect"),
  watcher: sts1CharacterIconUrl("watcher"),
  colorless: "/images/sts1/card-library/colorlessTab.webp",
  curse: "/images/sts1/card-library/curseTab.webp",
  status: sts1CardUiUrl("bg_skill_colorless"),
  special: sts1CardUiUrl("card_colorless_orb"),
} as const;
