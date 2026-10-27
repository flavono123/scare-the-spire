import type { GameLocale } from "@/lib/i18n";
import { sts1GameLocale } from "@/lib/sts1/locale";
import { sts1BitmapFontUrl } from "@/lib/sts1/paths";
import energy from "@/lib/sts1/bitmap-fonts/energy.json";

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
  /** Nominal font size the card layout uses for em math. */
  size: number;
  /** Baked px when FontHelper.fontScale differs (Thai 0.95); metrics are in these px. */
  pixelSize?: number;
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

export type Sts1BitmapPackName = "kor" | "latin" | "jpn" | "zhs" | "rus" | "tha";

const ENERGY_PACK = energy as Sts1BitmapPack;

/**
 * Locale glyph packs are 28–290 KB each, so they are not bundled here. A page
 * registers the pack it renders through Sts1BitmapPackScope before any card
 * text renders; Node specs use scripts/lib/sts1-bitmap-packs.ts.
 */
const PACKS: Partial<Record<Sts1BitmapPackName, Sts1BitmapPack>> = {};
const warnedMissingPacks = new Set<Sts1BitmapPackName>();

export function registerSts1BitmapPack(name: Sts1BitmapPackName, pack: Sts1BitmapPack) {
  PACKS[name] = pack;
}

export function sts1BitmapPackName(gameLocale: GameLocale): Sts1BitmapPackName {
  const locale = sts1GameLocale(gameLocale);
  if (locale === "kor" || locale === "jpn" || locale === "zhs" || locale === "rus" || locale === "tha") {
    return locale;
  }
  return "latin";
}

function localePack(gameLocale: GameLocale): Sts1BitmapPack | undefined {
  const name = sts1BitmapPackName(gameLocale);
  const pack = PACKS[name];
  if (!pack && process.env.NODE_ENV !== "production" && !warnedMissingPacks.has(name)) {
    warnedMissingPacks.add(name);
    console.error(`STS1 bitmap pack "${name}" rendered before Sts1BitmapPackScope registered it.`);
  }
  return pack;
}

export function sts1BitmapRole(
  gameLocale: GameLocale,
  role: Sts1BitmapRoleName,
): Sts1BitmapRole | undefined {
  const pack = role === "energy" ? ENERGY_PACK : localePack(gameLocale);
  return pack?.roles[role];
}

export function sts1BitmapPack(
  gameLocale: GameLocale,
  role: Sts1BitmapRoleName,
): Sts1BitmapPack | undefined {
  return role === "energy" ? ENERGY_PACK : localePack(gameLocale);
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
  // A span split at a color token keeps its edge spaces ("카드가 " + "소멸"); keep
  // their advance instead of trimming to glyph ink so words do not touch.
  if (/^\s/.test(text)) minX = Math.min(minX, 0);
  if (/\s$/.test(text)) maxX = Math.max(maxX, cursor);
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
