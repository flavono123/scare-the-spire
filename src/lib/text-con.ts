import { SPIRE_ICON_COLORS } from "@/components/spire-icon";

export interface TextConBgColor {
  id: string;
  label: string;
  labelEn: string;
  hex: string;
  defaultTextColor: "white" | "dark";
}

export interface TextConTextColor {
  id: "white" | "dark";
  label: string;
  labelEn: string;
  hex: string;
}

/**
 * Background colors: spire-* theme colors + character colors + dark spire background.
 */
export const TEXTCON_BG_COLORS: readonly TextConBgColor[] = [
  {
    id: "gold",
    label: "골드",
    labelEn: "Gold",
    hex: SPIRE_ICON_COLORS.gold, // #EFC851
    defaultTextColor: "dark",
  },
  {
    id: "red",
    label: "아이언클래드",
    labelEn: "Ironclad",
    hex: SPIRE_ICON_COLORS.red, // #f87171
    defaultTextColor: "white",
  },
  {
    id: "green",
    label: "사일런트",
    labelEn: "Silent",
    hex: SPIRE_ICON_COLORS.green, // #34d399
    defaultTextColor: "dark",
  },
  {
    id: "aqua",
    label: "디펙트",
    labelEn: "Defect",
    hex: SPIRE_ICON_COLORS.aqua, // #22d3ee
    defaultTextColor: "dark",
  },
  {
    id: "pink",
    label: "네크로바인더",
    labelEn: "Necrobinder",
    hex: SPIRE_ICON_COLORS.pink, // #f472b6
    defaultTextColor: "white",
  },
  {
    id: "orange",
    label: "리젠트",
    labelEn: "Regent",
    hex: SPIRE_ICON_COLORS.orange, // #fb923c
    defaultTextColor: "dark",
  },
  {
    id: "blue",
    label: "고대",
    labelEn: "Ancient",
    hex: SPIRE_ICON_COLORS.blue, // #60a5fa
    defaultTextColor: "white",
  },
  {
    id: "purple",
    label: "이벤트",
    labelEn: "Event",
    hex: SPIRE_ICON_COLORS.purple, // #c084fc
    defaultTextColor: "white",
  },
  {
    id: "silver",
    label: "실버",
    labelEn: "Silver",
    hex: "#8ad6e0",
    defaultTextColor: "dark",
  },
  {
    id: "bronze",
    label: "브론즈",
    labelEn: "Bronze",
    hex: "#d7a470",
    defaultTextColor: "white",
  },
  {
    id: "dark",
    label: "첨탑",
    labelEn: "Spire Dark",
    hex: "#27272a",
    defaultTextColor: "white",
  },
] as const;

/**
 * Highly restricted 2 text colors: white and dark charcoal for optimal contrast.
 */
export const TEXTCON_TEXT_COLORS: readonly TextConTextColor[] = [
  {
    id: "white",
    label: "흰색",
    labelEn: "White",
    hex: "#FFFFFF",
  },
  {
    id: "dark",
    label: "검정",
    labelEn: "Dark",
    hex: "#18181B",
  },
] as const;

export const DEFAULT_TEXTCON_BG = "gold";
export const DEFAULT_TEXTCON_TEXT = "dark";
export const TEXTCON_MAX_CHARS = 30;

const BG_COLOR_BY_ID = new Map(TEXTCON_BG_COLORS.map((c) => [c.id, c]));
const TEXT_COLOR_BY_ID = new Map(TEXTCON_TEXT_COLORS.map((c) => [c.id, c]));

export function resolveTextConBg(idOrHex: string | null | undefined): TextConBgColor {
  if (!idOrHex) return TEXTCON_BG_COLORS[0];
  const found = BG_COLOR_BY_ID.get(idOrHex.toLowerCase());
  if (found) return found;

  // If it's a raw hex, return custom entry
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(idOrHex)) {
    return {
      id: idOrHex,
      label: idOrHex,
      labelEn: idOrHex,
      hex: idOrHex,
      defaultTextColor: isHexBright(idOrHex) ? "dark" : "white",
    };
  }

  return TEXTCON_BG_COLORS[0];
}

export function resolveTextConText(idOrHex: string | null | undefined): TextConTextColor {
  if (!idOrHex) return TEXTCON_TEXT_COLORS[0];
  const found = TEXT_COLOR_BY_ID.get(idOrHex.toLowerCase() as "white" | "dark");
  if (found) return found;

  if (idOrHex.toLowerCase() === "#ffffff" || idOrHex.toLowerCase() === "white") {
    return TEXTCON_TEXT_COLORS[0];
  }
  return TEXTCON_TEXT_COLORS[1];
}

export function isHexBright(hex: string): boolean {
  const clean = hex.replace("#", "");
  let r = 0;
  let g = 0;
  let b = 0;
  if (clean.length === 3) {
    r = Number.parseInt(clean[0] + clean[0], 16);
    g = Number.parseInt(clean[1] + clean[1], 16);
    b = Number.parseInt(clean[2] + clean[2], 16);
  } else if (clean.length === 6) {
    r = Number.parseInt(clean.slice(0, 2), 16);
    g = Number.parseInt(clean.slice(2, 4), 16);
    b = Number.parseInt(clean.slice(4, 6), 16);
  }
  // Standard luminance formula
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6;
}
