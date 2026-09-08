import type { Sts1Card, Sts1CardType, Sts1PotionRarity, Sts1RelicPool, Sts1RelicTier } from "@/lib/sts1/types";
import { sts1CardLibraryTabUrl, sts1CardUiUrl, sts1CharacterIconUrl } from "@/lib/sts1/paths";

const FRAME_RARITY: Record<string, "common" | "uncommon" | "rare"> = {
  basic: "common",
  common: "common",
  special: "common",
  curse: "common",
  uncommon: "uncommon",
  rare: "rare",
};

/** AbstractCard RAW_W / RAW_H. Combat atlas orig is 512² with the card at (106, 46) 300×420. */
export const STS1_CARD_ASPECT = "300 / 420";
export const STS1_ATLAS = 512;
export const STS1_CARD_IN_ATLAS = { left: 106, top: 46, width: 300, height: 420 } as const;

export const STS1_ATLAS_LAYER_STYLE = {
  width: `${(STS1_ATLAS / STS1_CARD_IN_ATLAS.width) * 100}%`,
  height: `${(STS1_ATLAS / STS1_CARD_IN_ATLAS.height) * 100}%`,
  left: `${(-STS1_CARD_IN_ATLAS.left / STS1_CARD_IN_ATLAS.width) * 100}%`,
  top: `${(-STS1_CARD_IN_ATLAS.top / STS1_CARD_IN_ATLAS.height) * 100}%`,
} as const;

/**
 * AbstractCard.renderEnergy FontHelper.renderRotatedText offsets from card
 * center (unscaled 300×420). Game Y+ is up; CSS Y+ is down.
 */
export const STS1_ENERGY_TEXT_OFFSET = { x: -132, y: 192 } as const;
/** Packed size of 512/card_red_orb; the cost glyph is centered on this pip. */
export const STS1_ENERGY_ORB_SIZE = { width: 72, height: 71 } as const;

export function sts1EnergyCostBox() {
  const { width, height } = STS1_CARD_IN_ATLAS;
  const centerX = width / 2 + STS1_ENERGY_TEXT_OFFSET.x;
  const centerY = height / 2 - STS1_ENERGY_TEXT_OFFSET.y;
  return {
    left: `${((centerX - STS1_ENERGY_ORB_SIZE.width / 2) / width) * 100}%`,
    top: `${((centerY - STS1_ENERGY_ORB_SIZE.height / 2) / height) * 100}%`,
    width: `${(STS1_ENERGY_ORB_SIZE.width / width) * 100}%`,
    height: `${(STS1_ENERGY_ORB_SIZE.height / height) * 100}%`,
  };
}

const FRAME_IN_ATLAS = {
  attack: { left: 125, top: 108, width: 262, height: 185 },
  skill: { left: 124, top: 107, width: 263, height: 183 },
  power: { left: 121, top: 52, width: 269, height: 238 },
} as const;

function atlasBoxToCard(box: { left: number; top: number; width: number; height: number }) {
  const card = STS1_CARD_IN_ATLAS;
  return {
    left: `${((box.left - card.left) / card.width) * 100}%`,
    top: `${((box.top - card.top) / card.height) * 100}%`,
    width: `${(box.width / card.width) * 100}%`,
    height: `${(box.height / card.height) * 100}%`,
  };
}

export function sts1PortraitBox(card: Sts1Card) {
  const type = card.type === "power" || card.type === "attack" ? card.type : "skill";
  return atlasBoxToCard(FRAME_IN_ATLAS[type]);
}

export const STS1_POOL_COLORS: Record<Exclude<Sts1RelicPool, "shared">, string> = {
  ironclad: "#f87171",
  silent: "#34d399",
  defect: "#22d3ee",
  watcher: "#c084fc",
};

export const STS1_TIER_COLORS: Record<Exclude<Sts1RelicTier, "deprecated">, string> = {
  starter: "#ffd740",
  common: "#b0b0b0",
  uncommon: "#4fc3f7",
  rare: "#ffd740",
  shop: "#81c784",
  special: "#ce93d8",
  boss: "#ff8a65",
};

export const STS1_POTION_RARITY_COLORS: Record<Sts1PotionRarity, string> = {
  common: "#b0b0b0",
  uncommon: "#4fc3f7",
  rare: "#ffd740",
};

export function sts1PoolColor(pool: string): string | undefined {
  return STS1_POOL_COLORS[pool as keyof typeof STS1_POOL_COLORS];
}

export function sts1PoolOutline(pool: string): string {
  const color = sts1PoolColor(pool);
  if (!color) return "drop-shadow(0 2px 4px rgba(0,0,0,0.5))";
  return `drop-shadow(1px 0 0 ${color}) drop-shadow(-1px 0 0 ${color}) drop-shadow(0 1px 0 ${color}) drop-shadow(0 -1px 0 ${color})`;
}

export function sts1TypeBannerRarity(card: Sts1Card): "common" | "uncommon" | "rare" {
  return FRAME_RARITY[card.rarity] ?? "common";
}

export function sts1TypeBannerPieces(card: Sts1Card): readonly ["left" | "center" | "right", string][] {
  const rarity = sts1TypeBannerRarity(card);
  return [
    ["left", `${rarity}_left`],
    ["center", `${rarity}_center`],
    ["right", `${rarity}_right`],
  ];
}

export function sts1CardBackgroundRegion(card: Sts1Card): string {
  if (card.type === "curse" || card.cardColor === "curse") return "bg_skill_black";
  if (card.type === "status") return "bg_skill_gray";
  const type = card.type === "power" || card.type === "attack" ? card.type : "skill";
  const color = ["red", "green", "blue", "purple"].includes(card.cardColor)
    ? card.cardColor
    : "gray";
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
  colorless: sts1CardLibraryTabUrl("colorlessTab"),
  curse: sts1CardLibraryTabUrl("curseTab"),
  status: sts1CardUiUrl("bg_skill_colorless"),
  special: sts1CardUiUrl("card_colorless_orb"),
} as const;
