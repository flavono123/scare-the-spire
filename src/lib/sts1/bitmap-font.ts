import type { GameLocale } from "@/lib/i18n";
import { sts1GameLocale } from "@/lib/sts1/locale";
import { sts1BitmapFontUrl } from "@/lib/sts1/paths";
import energy from "@/lib/sts1/bitmap-fonts/energy.json";
import kor from "@/lib/sts1/bitmap-fonts/kor.json";
import latin from "@/lib/sts1/bitmap-fonts/latin.json";
import jpn from "@/lib/sts1/bitmap-fonts/jpn.json";
import zhs from "@/lib/sts1/bitmap-fonts/zhs.json";
import rus from "@/lib/sts1/bitmap-fonts/rus.json";
import tha from "@/lib/sts1/bitmap-fonts/tha.json";

export type Sts1BitmapGlyph = {
  x: number;
  y: number;
  w: number;
  h: number;
  xoff: number;
  top: number;
  xadv: number;
};

export type Sts1BitmapRole = {
  size: number;
  ascent: number;
  descent: number;
  lineHeight: number;
  capHeight: number;
  glyphs: Record<string, Sts1BitmapGlyph>;
};

export type Sts1BitmapPack = {
  page: string;
  pageWidth: number;
  pageHeight: number;
  roles: Record<string, Sts1BitmapRole>;
};

export type Sts1BitmapRoleName = "title" | "desc" | "type" | "energy";

const PACKS: Record<string, Sts1BitmapPack> = {
  energy: energy as Sts1BitmapPack,
  kor: kor as Sts1BitmapPack,
  latin: latin as Sts1BitmapPack,
  jpn: jpn as Sts1BitmapPack,
  zhs: zhs as Sts1BitmapPack,
  rus: rus as Sts1BitmapPack,
  tha: tha as Sts1BitmapPack,
};

export function sts1BitmapPackName(gameLocale: GameLocale): keyof typeof PACKS {
  const locale = sts1GameLocale(gameLocale);
  if (locale === "kor" || locale === "jpn" || locale === "zhs" || locale === "rus" || locale === "tha") {
    return locale;
  }
  return "latin";
}

export function sts1BitmapRole(
  gameLocale: GameLocale,
  role: Sts1BitmapRoleName,
): Sts1BitmapRole | undefined {
  const pack = role === "energy" ? PACKS.energy : PACKS[sts1BitmapPackName(gameLocale)];
  return pack.roles[role];
}

export function sts1BitmapPack(gameLocale: GameLocale, role: Sts1BitmapRoleName): Sts1BitmapPack {
  return role === "energy" ? PACKS.energy : PACKS[sts1BitmapPackName(gameLocale)];
}

export function sts1BitmapAdvance(
  gameLocale: GameLocale,
  role: Sts1BitmapRoleName,
  char: string,
  fallbackPx: number,
): number {
  const glyph = sts1BitmapRole(gameLocale, role)?.glyphs[char];
  return glyph ? glyph.xadv : fallbackPx;
}

export function measureBitmapText(role: Sts1BitmapRole, text: string) {
  let cursor = 0;
  let minX = 0;
  let maxX = 0;
  let minY = 0;
  let maxY = 0;
  let sawGlyph = false;
  for (const char of text) {
    const glyph = role.glyphs[char];
    if (!glyph) {
      cursor += role.size * 0.55;
      continue;
    }
    const left = cursor + glyph.xoff;
    const top = role.ascent - glyph.top;
    minX = sawGlyph ? Math.min(minX, left) : left;
    maxX = sawGlyph ? Math.max(maxX, left + glyph.w) : left + glyph.w;
    minY = sawGlyph ? Math.min(minY, top) : top;
    maxY = sawGlyph ? Math.max(maxY, top + glyph.h) : top + glyph.h;
    sawGlyph = true;
    cursor += glyph.xadv;
  }
  if (!sawGlyph) {
    return { width: Math.max(1, cursor), height: role.lineHeight, originX: 0, originY: 0 };
  }
  return {
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
    originX: -minX,
    originY: -minY,
  };
}

const pageImages = new Map<string, Promise<HTMLImageElement>>();

export function loadSts1BitmapPage(page: string): Promise<HTMLImageElement> {
  const url = sts1BitmapFontUrl(page);
  const cached = pageImages.get(url);
  if (cached) return cached;
  const pending = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`STS1 bitmap font failed: ${url}`));
    image.src = url;
  });
  pageImages.set(url, pending);
  return pending;
}

function parseHexColor(color: string): [number, number, number] | null {
  const hex = color.trim().replace("#", "");
  if (hex.length !== 6) return null;
  return [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16),
  ];
}

export function drawBitmapText(
  context: CanvasRenderingContext2D,
  page: HTMLImageElement,
  role: Sts1BitmapRole,
  text: string,
  color: string,
  originX: number,
  originY: number,
) {
  let cursor = originX;
  const baseline = originY + role.ascent;
  for (const char of text) {
    const glyph = role.glyphs[char];
    if (!glyph) {
      cursor += role.size * 0.55;
      continue;
    }
    context.drawImage(
      page,
      glyph.x,
      glyph.y,
      glyph.w,
      glyph.h,
      cursor + glyph.xoff,
      baseline - glyph.top,
      glyph.w,
      glyph.h,
    );
    cursor += glyph.xadv;
  }
  const rgb = parseHexColor(color);
  if (!rgb || (rgb[0] === 255 && rgb[1] === 255 && rgb[2] === 255)) return;
  const image = context.getImageData(0, 0, context.canvas.width, context.canvas.height);
  const data = image.data;
  const [red, green, blue] = rgb;
  for (let index = 0; index < data.length; index += 4) {
    if (data[index + 3] === 0) continue;
    data[index] = (data[index] * red) / 255;
    data[index + 1] = (data[index + 1] * green) / 255;
    data[index + 2] = (data[index + 2] * blue) / 255;
  }
  context.putImageData(image, 0, 0);
}
