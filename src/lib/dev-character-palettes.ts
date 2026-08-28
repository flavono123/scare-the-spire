/**
 * Two-color palettes extracted from on-screen HEXCODE title cards in
 * https://youtu.be/23kxFVxYZIY ("그대로 갖다 쓰는 색깔 조합 16가지").
 *
 * Korean names follow the video's localization. English names are the
 * Wada Sanzo dictionary labels shown on the same cards. Left/right of
 * each title card maps to colorA/colorB.
 *
 * Local `/dev/character-palette` lab only. Not a public profile feature yet.
 */

export const CHARACTER_PALETTE_SOURCE = {
  url: "https://youtu.be/23kxFVxYZIY",
  title: "그대로 갖다 쓰는 색깔 조합 16가지",
} as const;

export interface CharacterPalettePair {
  id: string;
  colorA: string;
  colorB: string;
  nameKoA: string;
  nameKoB: string;
  nameEnA: string;
  nameEnB: string;
}

export const CHARACTER_PALETTE_PAIRS: readonly CharacterPalettePair[] = [
  {
    id: "sage-blush",
    colorA: "#719470",
    colorB: "#E0B3B6",
    nameKoA: "세이지그린",
    nameKoB: "연분홍색",
    nameEnA: "Chromium Green",
    nameEnB: "Cameo Pink",
  },
  {
    id: "ivory-sky",
    colorA: "#F5ECC2",
    colorB: "#A7D4E4",
    nameKoA: "아이보리",
    nameKoB: "연하늘색",
    nameEnA: "Sulphur Yellow",
    nameEnB: "Pale King's Blue",
  },
  {
    id: "orange-teal",
    colorA: "#D96629",
    colorB: "#0093A5",
    nameKoA: "오렌지",
    nameKoB: "틸블루",
    nameEnA: "English Red",
    nameEnB: "Cerulia Blue",
  },
  {
    id: "rose-mint",
    colorA: "#DA525D",
    colorB: "#00B49B",
    nameKoA: "로즈핑크",
    nameKoB: "민트그린",
    nameEnA: "Eugenia Red",
    nameEnB: "Sea Green",
  },
  {
    id: "coffee-olive",
    colorA: "#71502F",
    colorB: "#788860",
    nameKoA: "커피브라운",
    nameKoB: "올리브그린",
    nameEnA: "Pale Raw Umber",
    nameEnB: "Rainette Green",
  },
  {
    id: "magenta-blue",
    colorA: "#B73F74",
    colorB: "#005B8D",
    nameKoA: "자홍색",
    nameKoB: "진파란색",
    nameEnA: "Rosolane Purple",
    nameEnB: "Helvetia Blue",
  },
  {
    id: "lime-purple",
    colorA: "#C7D14F",
    colorB: "#501345",
    nameKoA: "라임옐로우",
    nameKoB: "진보라색",
    nameEnA: "Light Green Yellow",
    nameEnB: "Cotinga Purple",
  },
  {
    id: "lemon-olive",
    colorA: "#FFEFAE",
    colorB: "#42533E",
    nameKoA: "연노란색",
    nameKoB: "다크올리브",
    nameEnA: "Pale Lemon Yellow",
    nameEnB: "Blackish Olive",
  },
  {
    id: "amber-coffee",
    colorA: "#F3A257",
    colorB: "#71502F",
    nameKoA: "앰버",
    nameKoB: "커피브라운",
    nameEnA: "Golden Yellow",
    nameEnB: "Pale Raw Umber",
  },
  {
    id: "apricot-blue",
    colorA: "#FDD4BD",
    colorB: "#006EB8",
    nameKoA: "살구색",
    nameKoB: "파란색",
    nameEnA: "Seashell Pink",
    nameEnB: "Blue",
  },
  {
    id: "ochre-lavender",
    colorA: "#C27544",
    colorB: "#B5B1D8",
    nameKoA: "황토색",
    nameKoB: "라벤더",
    nameEnA: "Cinnamon Rufous",
    nameEnB: "Grayish Lavender",
  },
  {
    id: "terracotta-dusty-pink",
    colorA: "#C55347",
    colorB: "#C0A9B3",
    nameKoA: "테라코타",
    nameKoB: "회분홍색",
    nameEnA: "Etruscan Red",
    nameEnB: "Grayish Lavender",
  },
  {
    id: "pine-navy",
    colorA: "#437742",
    colorB: "#064F6E",
    nameKoA: "솔잎색",
    nameKoB: "감청색",
    nameEnA: "Cossack Green",
    nameEnB: "Van der Poel's Blue",
  },
  {
    id: "jade-lavender",
    colorA: "#00978D",
    colorB: "#B5B1D8",
    nameKoA: "옥색",
    nameKoB: "라벤더",
    nameEnA: "Benzol Green",
    nameEnB: "Grayish Lavender",
  },
  {
    id: "carmine-ink",
    colorA: "#CC1236",
    colorB: "#0F1A14",
    nameKoA: "빨간색",
    nameKoB: "흑녹색",
    nameEnA: "Carmine",
    nameEnB: "Ink Green",
  },
  {
    id: "coral-midnight",
    colorA: "#F48067",
    colorB: "#051230",
    nameKoA: "코럴",
    nameKoB: "미드나잇블루",
    nameEnA: "Grenadine Pink",
    nameEnB: "Deep Indigo",
  },
] as const;

export function normalizeHex(input: string): string | null {
  const raw = input.trim().replace(/^#/, "");
  if (/^[0-9A-Fa-f]{3}$/.test(raw)) {
    return `#${raw[0]}${raw[0]}${raw[1]}${raw[1]}${raw[2]}${raw[2]}`.toUpperCase();
  }
  if (/^[0-9A-Fa-f]{6}$/.test(raw)) {
    return `#${raw.toUpperCase()}`;
  }
  return null;
}

export function hexToRgb01(hex: string): { r: number; g: number; b: number } {
  const normalized = normalizeHex(hex);
  if (!normalized) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  return {
    r: Number.parseInt(normalized.slice(1, 3), 16) / 255,
    g: Number.parseInt(normalized.slice(3, 5), 16) / 255,
    b: Number.parseInt(normalized.slice(5, 7), 16) / 255,
  };
}

export function resolveDuotoneColors(
  colorA: string,
  colorB: string,
  inverted: boolean,
): { shadow: string; highlight: string } {
  return inverted
    ? { shadow: colorB, highlight: colorA }
    : { shadow: colorA, highlight: colorB };
}

export function swapHexPair(colorA: string, colorB: string): { colorA: string; colorB: string } {
  return { colorA: colorB, colorB: colorA };
}
