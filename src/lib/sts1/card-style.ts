import type { CSSProperties } from "react";
import type { GameLocale } from "@/lib/i18n";
import { sts1LineBreakViaCharacter, sts1GameLocale } from "@/lib/sts1/locale";
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
export const STS1_ATLAS = 512;
export const STS1_CARD_IN_ATLAS = { left: 106, top: 46, width: 300, height: 420 } as const;
/** 512 energy orb hangs past the 300×420 body; keep that pip inside the tile. */
export const STS1_CARD_STAGE_PAD = { left: 20, top: 18, right: 8, bottom: 8 } as const;
export const STS1_CARD_STAGE = {
  width: STS1_CARD_IN_ATLAS.width + STS1_CARD_STAGE_PAD.left + STS1_CARD_STAGE_PAD.right,
  height: STS1_CARD_IN_ATLAS.height + STS1_CARD_STAGE_PAD.top + STS1_CARD_STAGE_PAD.bottom,
} as const;
export const STS1_CARD_ASPECT = `${STS1_CARD_STAGE.width} / ${STS1_CARD_STAGE.height}`;

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

export function sts1CardBodyStyle() {
  const { left, top } = STS1_CARD_STAGE_PAD;
  const { width, height } = STS1_CARD_STAGE;
  return {
    left: `${(left / width) * 100}%`,
    top: `${(top / height) * 100}%`,
    width: `${(STS1_CARD_IN_ATLAS.width / width) * 100}%`,
    height: `${(STS1_CARD_IN_ATLAS.height / height) * 100}%`,
  };
}

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

/** AbstractCard.renderTitle: renderRotatedText(..., offsetX=0, offsetY=175). Game Y+ is up. */
export const STS1_TITLE_OFFSET_Y = 175;
/** FontHelper.cardTitleFont = prepFont(27, true). Long names scale to 0.85. */
export const STS1_TITLE_FONT = 27;
export const STS1_TITLE_SMALL_SCALE = 0.85;
export const STS1_TITLE_BOX_WIDTH = 0.6;
export const STS1_TITLE_BOX_WIDTH_NO_COST = 0.7;
/** FontHelper.cardDescFont_N / _L = prepFont(24, ...). */
export const STS1_DESC_FONT = 24;
/** AbstractCard.DESC_OFFSET_Y = 0.255 * IMG_HEIGHT when BIG_TEXT_MODE is off. */
export const STS1_DESC_OFFSET_Y_FRAC = 0.255;
export const STS1_DESC_BOX_WIDTH = 0.79;
export const STS1_CN_DESC_BOX_WIDTH = 0.72;
/** renderDescription line step is 1.45 * capHeight. */
export const STS1_DESC_LINE_HEIGHT = 1.45;
/**
 * CSS top of the description well. Type text sits at ~55%; wiki.gg/Fandom
 * full-card composites leave a gap under the type chip, then 24px copy.
 * 1-line game baseline is ~73% of the 300×420 body.
 */
export const STS1_DESC_BOX_TOP = 0.66;
export const STS1_DESC_BOX_BOTTOM = 0.08;
/** FontHelper.cardTypeFont = prepFont(17, true). */
export const STS1_TYPE_FONT = 17;
/** renderType draws at current_y - 22 (down in CSS). */
export const STS1_TYPE_OFFSET_Y = 22;

export function sts1TitleBoxWidthFrac(cost: number): number {
  return cost > 0 || cost === -1 ? STS1_TITLE_BOX_WIDTH : STS1_TITLE_BOX_WIDTH_NO_COST;
}

function titleEmWidth(name: string): number {
  let width = 0;
  for (const char of name) {
    const code = char.codePointAt(0) ?? 0;
    if (char === " ") width += 0.33;
    else if (code >= 0x2e80) width += 1;
    else width += 0.55;
  }
  return width;
}

export function sts1TitleFontScale(name: string, cost: number): number {
  const boxPx = sts1TitleBoxWidthFrac(cost) * STS1_CARD_IN_ATLAS.width;
  const px = titleEmWidth(name) * STS1_TITLE_FONT;
  return px > boxPx ? STS1_TITLE_SMALL_SCALE : 1;
}

export function sts1TitleBox(name: string, cost: number) {
  const { width, height } = STS1_CARD_IN_ATLAS;
  const widthFrac = sts1TitleBoxWidthFrac(cost);
  const scale = sts1TitleFontScale(name, cost);
  const centerY = height / 2 - STS1_TITLE_OFFSET_Y;
  const boxHeight = STS1_TITLE_FONT * 1.15;
  return {
    left: `${((1 - widthFrac) / 2) * 100}%`,
    top: `${((centerY - boxHeight / 2) / height) * 100}%`,
    width: `${widthFrac * 100}%`,
    height: `${(boxHeight / height) * 100}%`,
    fontSize: `${((STS1_TITLE_FONT * scale) / width) * 100}cqi`,
  };
}

export function sts1TypeBox() {
  const { width, height } = STS1_CARD_IN_ATLAS;
  const centerY = height / 2 + STS1_TYPE_OFFSET_Y;
  const boxHeight = STS1_TYPE_FONT * 1.2;
  return {
    left: "22%",
    width: "56%",
    top: `${((centerY - boxHeight / 2) / height) * 100}%`,
    height: `${(boxHeight / height) * 100}%`,
    fontSize: `${(STS1_TYPE_FONT / width) * 100}cqi`,
  };
}

export function sts1DescBoxWidthFrac(gameLocale: GameLocale): number {
  return sts1LineBreakViaCharacter(gameLocale) ? STS1_CN_DESC_BOX_WIDTH : STS1_DESC_BOX_WIDTH;
}

export function sts1DescriptionBox(gameLocale: GameLocale) {
  const widthFrac = sts1DescBoxWidthFrac(gameLocale);
  return {
    left: `${((1 - widthFrac) / 2) * 100}%`,
    width: `${widthFrac * 100}%`,
    top: `${STS1_DESC_BOX_TOP * 100}%`,
    bottom: `${STS1_DESC_BOX_BOTTOM * 100}%`,
  };
}

export function sts1DescriptionTextStyle(gameLocale: GameLocale): CSSProperties {
  const { width } = STS1_CARD_IN_ATLAS;
  const locale = sts1GameLocale(gameLocale);
  const wrap: CSSProperties = sts1LineBreakViaCharacter(gameLocale)
    ? { wordBreak: "break-all", lineBreak: "anywhere" }
    : locale === "kor"
      ? { wordBreak: "keep-all", overflowWrap: "break-word" }
      : locale === "tha"
        ? { wordBreak: "break-word", overflowWrap: "anywhere", lineBreak: "anywhere" }
        : { overflowWrap: "break-word" };
  return {
    fontSize: `${(STS1_DESC_FONT / width) * 100}cqi`,
    lineHeight: STS1_DESC_LINE_HEIGHT,
    ...wrap,
  };
}

/**
 * Inner transparent hole of `frame_{attack,skill,power}_common` (alpha scan
 * inside the opaque frame bbox). The previous values used the opaque bbox, so
 * art painted through the open pentagon under the type plaque.
 */
const PORTRAIT_HOLE_IN_ATLAS = {
  attack: { left: 136, top: 108, width: 240, height: 162 },
  skill: { left: 135, top: 108, width: 240, height: 163 },
  power: { left: 132, top: 61, width: 248, height: 209 },
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
  return atlasBoxToCard(PORTRAIT_HOLE_IN_ATLAS[type]);
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
