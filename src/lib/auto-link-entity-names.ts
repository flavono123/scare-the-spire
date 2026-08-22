import type { EntityType } from "@/components/patch-note-renderer";

export type AutoLinkKeyword = {
  label: string;
  lower: string;
  ascii: boolean;
};

export const AUTO_LINK_ENTITY_TYPES = new Set<EntityType>([
  "card",
  "relic",
  "potion",
  "power",
  "keyword",
  "enchantment",
  "affliction",
  "event",
  "monster",
  "encounter",
  "ancient",
  "epoch",
  "modifier",
  "ascension",
]);

const AUTO_LINK_SKIP_LABELS = new Set([
  "타격",
  "수비",
  "strike",
  "defend",
  "draft",
  "flight",
  "midas",
]);

const GOLD_OR_CODE_PROTECT_RE = /\[gold(?::[a-zA-Z]+)?\][\s\S]*?\[\/gold\]|`[^`\n]+`/g;

/** Numbered Ascension mentions only. Do not match bare 승천 / Ascension. */
const NUMBERED_ASCENSION_MENTION_RE =
  /(?<![낮높]은\s)(?<!(?:low|high)\s)(?:승천|ascension)\s*(?:10|[1-9])(?!\d)|\bA(?:10|[1-9])\b/gi;

function protectedRangesOf(text: string): Array<{ start: number; end: number }> {
  return [...text.matchAll(GOLD_OR_CODE_PROTECT_RE)].map((match) => {
    const start = match.index ?? 0;
    return { start, end: start + match[0].length };
  });
}

function rangeOverlaps(
  start: number,
  end: number,
  ranges: Array<{ start: number; end: number }>,
): boolean {
  return ranges.some((range) => start < range.end && end > range.start);
}

export function wrapNumberedAscensionMentions(text: string): string {
  const protectedRanges = protectedRangesOf(text);
  let result = "";
  let index = 0;

  for (const match of text.matchAll(NUMBERED_ASCENSION_MENTION_RE)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    if (rangeOverlaps(start, end, protectedRanges)) continue;
    result += text.slice(index, start);
    result += `[gold:ascension]${match[0]}[/gold]`;
    index = end;
  }

  result += text.slice(index);
  return result;
}

export function buildAutoLinkKeywordsByFirst(
  names: Array<{ label: string; type: EntityType }>,
): Map<string, AutoLinkKeyword[]> {
  const seen = new Set<string>();
  const byFirst = new Map<string, AutoLinkKeyword[]>();

  for (const { label, type } of names) {
    if (!AUTO_LINK_ENTITY_TYPES.has(type)) continue;
    const trimmed = label.trim();
    if (trimmed.length < 2) continue;
    const lower = trimmed.toLowerCase();
    if (AUTO_LINK_SKIP_LABELS.has(lower) || seen.has(lower)) continue;
    seen.add(lower);
    const keyword: AutoLinkKeyword = {
      label: trimmed,
      lower,
      ascii: /^[\x00-\x7F]+$/.test(trimmed),
    };
    const first = lower[0] ?? "";
    const bucket = byFirst.get(first);
    if (bucket) bucket.push(keyword);
    else byFirst.set(first, [keyword]);
  }

  for (const bucket of byFirst.values()) {
    bucket.sort((a, b) => b.lower.length - a.lower.length);
  }

  return byFirst;
}

export function wrapUntaggedEntityNames(
  text: string,
  keywordsByFirst: Map<string, AutoLinkKeyword[]> | undefined,
  resolve: (raw: string) => { type: EntityType } | null,
): string {
  if (!keywordsByFirst?.size) return text;

  const protectedRanges = protectedRangesOf(text);

  let result = "";
  let index = 0;
  while (index < text.length) {
    const blocked = protectedRanges.find((range) => index >= range.start && index < range.end);
    if (blocked) {
      result += text.slice(blocked.start, blocked.end);
      index = blocked.end;
      continue;
    }

    const match = matchAutoLinkAt(text, index, keywordsByFirst, protectedRanges, resolve);
    if (match) {
      result += `[gold:${match.type}]${text.slice(index, match.end)}[/gold]`;
      index = match.end;
      continue;
    }

    result += text[index];
    index += 1;
  }

  return result;
}

function matchAutoLinkAt(
  text: string,
  start: number,
  keywordsByFirst: Map<string, AutoLinkKeyword[]>,
  protectedRanges: Array<{ start: number; end: number }>,
  resolve: (raw: string) => { type: EntityType } | null,
): { end: number; type: EntityType } | null {
  const lower = text.toLowerCase();
  const keywords = keywordsByFirst.get(lower[start] ?? "");
  if (!keywords) return null;

  for (const keyword of keywords) {
    if (!lower.startsWith(keyword.lower, start)) continue;
    const end = start + keyword.lower.length;
    if (rangeOverlaps(start, end, protectedRanges)) continue;
    if (keyword.ascii && !hasAsciiTokenBoundary(lower, start, keyword.lower.length)) continue;

    const plusMatch = text.slice(end).match(/^\++/);
    const base = text.slice(start, end);
    const withUpgrade = plusMatch ? `${base}${plusMatch[0]}` : base;
    const upgraded = plusMatch ? resolve(withUpgrade) : null;
    const entity = upgraded ?? resolve(base);
    if (!entity || !AUTO_LINK_ENTITY_TYPES.has(entity.type)) continue;
    return {
      end: upgraded && plusMatch ? end + plusMatch[0].length : end,
      type: entity.type,
    };
  }

  return null;
}

function hasAsciiTokenBoundary(text: string, start: number, length: number): boolean {
  const before = start > 0 ? text[start - 1] : "";
  const after = start + length < text.length ? text[start + length] : "";
  return !isAsciiWordChar(before) && !isAsciiWordChar(after);
}

function isAsciiWordChar(char: string): boolean {
  return /^[a-z0-9_]$/i.test(char);
}
