import type { GameLocale } from "@/lib/i18n";
import {
  STS1_CARD_IN_ATLAS,
  STS1_DESC_ENERGY_IMG_WIDTH,
  STS1_DESC_FONT,
  sts1DescBoxWidthFrac,
} from "./card-style";
import { sts1KeywordNameAt } from "./keyword-tips";
import { sts1LineBreakViaCharacter } from "./locale";
import type { Sts1CardStats, Sts1Keyword } from "./types";

export const EMPTY_STS1_STATS: Sts1CardStats = {
  cost: 0,
  damage: null,
  block: null,
  magic: null,
  exhaust: false,
  ethereal: false,
  innate: false,
  retain: false,
  nameSuffix: "",
  upgraded: false,
};

export type Sts1TextSpan =
  | { kind: "text"; text: string; color?: string }
  | { kind: "energy"; orb: "red" | "green" | "blue" | "purple" | "colorless" }
  | { kind: "break" };

const COLOR_CODES: Record<string, string> = {
  r: "#ff6563",
  g: "#7fff00",
  b: "#87ceeb",
  y: "#efc851",
  p: "#ee82ee",
};

const ENERGY_CODES: Record<string, Sts1TextSpan & { kind: "energy" }> = {
  R: { kind: "energy", orb: "red" },
  G: { kind: "energy", orb: "green" },
  B: { kind: "energy", orb: "blue" },
  W: { kind: "energy", orb: "purple" },
  E: { kind: "energy", orb: "colorless" },
  C: { kind: "energy", orb: "colorless" },
};

const GOLD = "#efc851";
const UPGRADED = "#7fff00";

function replaceDynamic(text: string, stats: Sts1CardStats): string {
  const numberColor = stats.upgraded ? "UPGRADED" : "GOLD";
  return text
    .replace(/!D!/gi, stats.damage == null ? "0" : `${numberColor}:${stats.damage}`)
    .replace(/!B!/gi, stats.block == null ? "0" : `${numberColor}:${stats.block}`)
    .replace(/!M!/gi, stats.magic == null ? "0" : `${numberColor}:${stats.magic}`);
}

/**
 * AbstractCard.initializeDescription GlyphLayout width. CJK is slightly under
 * 1em so Korean Clash keeps "손에 있는 카드가 전부" on the first line.
 */
function glyphEmWidth(char: string): number {
  const code = char.codePointAt(0) ?? 0;
  if (char === " ") return 0.33;
  if (code >= 0x2e80) return 0.95;
  return 0.55;
}

function visibleTokenPx(token: string): number {
  if (/^\[[RGBWEC]\]$/i.test(token)) return STS1_DESC_ENERGY_IMG_WIDTH;
  const text = token
    .replace(/^#([rgbypl])/i, "")
    .replace(/^(GOLD|UPGRADED):/, "");
  let em = 0;
  for (const char of text) em += glyphEmWidth(char);
  return em * STS1_DESC_FONT;
}

function wrapByWord(replaced: string, maxPx: number): string[] {
  const tokens = replaced.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current: string[] = [];
  let currentPx = 0;
  const spacePx = 0.33 * STS1_DESC_FONT;
  const flush = () => {
    if (current.length === 0) return;
    lines.push(current.join(" "));
    current = [];
    currentPx = 0;
  };

  for (const token of tokens) {
    if (token === "NL") {
      flush();
      continue;
    }
    const tokenPx = visibleTokenPx(token);
    const extra = current.length > 0 ? spacePx + tokenPx : tokenPx;
    if (current.length > 0 && currentPx + extra > maxPx) {
      flush();
      current = [token];
      currentPx = tokenPx;
      continue;
    }
    current.push(token);
    currentPx += extra;
  }
  flush();
  return lines.length > 0 ? lines : [""];
}

function wrapByCharacter(replaced: string, maxPx: number): string[] {
  const lines: string[] = [];
  let current = "";
  let currentPx = 0;
  const flush = () => {
    if (!current) return;
    lines.push(current);
    current = "";
    currentPx = 0;
  };

  for (const chunk of replaced.split(/(\s*NL\s*)/)) {
    if (/^\s*NL\s*$/.test(chunk)) {
      flush();
      continue;
    }
    for (const char of chunk) {
      if (/\s/.test(char) && currentPx === 0) continue;
      const width = glyphEmWidth(char) * STS1_DESC_FONT;
      if (current && currentPx + width > maxPx) flush();
      current += char;
      currentPx += width;
    }
  }
  flush();
  return lines.length > 0 ? lines : [""];
}

/** Mirror AbstractCard.initializeDescription / initializeDescriptionCN. */
export function wrapSts1DescriptionLines(
  raw: string,
  stats: Sts1CardStats,
  gameLocale: GameLocale,
): string[] {
  const replaced = replaceDynamic(raw, stats);
  const maxPx = sts1DescBoxWidthFrac(gameLocale) * STS1_CARD_IN_ATLAS.width;
  return sts1LineBreakViaCharacter(gameLocale)
    ? wrapByCharacter(replaced, maxPx)
    : wrapByWord(replaced, maxPx);
}

function keywordNames(keywords: readonly Sts1Keyword[]): string[] {
  return keywords
    .flatMap((keyword) => keyword.names)
    .filter((name) => name.length > 1)
    .sort((left, right) => right.length - left.length);
}

export function parseSts1CardText(
  raw: string,
  stats: Sts1CardStats,
  keywords: readonly Sts1Keyword[] = [],
): Sts1TextSpan[] {
  const names = keywordNames(keywords);
  const spans: Sts1TextSpan[] = [];
  const lines = replaceDynamic(raw, stats).split(/\s*NL\s*/);

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    if (lineIndex > 0) spans.push({ kind: "break" });
    let color: string | undefined;
    const line = lines[lineIndex];
    let index = 0;
    while (index < line.length) {
      const energy = line.slice(index).match(/^\[([RGBWEC])\]/);
      if (energy) {
        spans.push(ENERGY_CODES[energy[1]]);
        index += energy[0].length;
        continue;
      }

      const codedNumber = line.slice(index).match(/^(GOLD|UPGRADED):(-?\d+)/);
      if (codedNumber) {
        spans.push({
          kind: "text",
          text: codedNumber[2],
          color: codedNumber[1] === "UPGRADED" ? UPGRADED : GOLD,
        });
        index += codedNumber[0].length;
        continue;
      }

      if (line[index] === "#" && index + 1 < line.length) {
        const code = line[index + 1].toLowerCase();
        if (COLOR_CODES[code]) {
          color = COLOR_CODES[code];
          index += 2;
          continue;
        }
        if (line[index + 1] === "[") {
          const hex = line.slice(index).match(/^\[#([0-9a-fA-F]{6})\]/);
          if (hex) {
            color = `#${hex[1]}`;
            index += hex[0].length;
            continue;
          }
        }
      }

      if (line.startsWith("[]", index)) {
        color = undefined;
        index += 2;
        continue;
      }

      const rest = line.slice(index);
      const keyword = names.find((name) => sts1KeywordNameAt(line, index, name));
      if (keyword) {
        spans.push({ kind: "text", text: rest.slice(0, keyword.length), color: color ?? GOLD });
        index += keyword.length;
        continue;
      }

      const nextBreak = rest.search(/!|#|\[|NL|GOLD:|UPGRADED:/);
      const chunk = nextBreak === -1 ? rest : rest.slice(0, Math.max(nextBreak, 1));
      const safeChunk = nextBreak === 0 ? rest[0] : chunk;
      spans.push({ kind: "text", text: safeChunk, color });
      index += safeChunk.length;
    }
  }

  return spans;
}

export function plainSts1Text(raw: string, stats?: Sts1CardStats): string {
  const replaced = stats ? replaceDynamic(raw, stats) : raw;
  return replaced
    .replace(/GOLD:|UPGRADED:/g, "")
    .replace(/!\w+!/g, "")
    .replace(/\[[RGBWEC]\]/g, "")
    .replace(/#([rgbypl])/gi, "")
    .replace(/\[#[0-9a-fA-F]{6}\]/g, "")
    .replace(/\[\]/g, "")
    .replace(/\s*NL\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
