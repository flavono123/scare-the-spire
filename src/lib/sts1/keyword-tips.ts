import type { CardSideTip, CardSideTipVariant } from "@/lib/card-keyword-tips";
import type { Sts1Keyword } from "./types";

const DEBUFF_IDS = new Set([
  "VULNERABLE",
  "WEAK",
  "FRAIL",
  "POISON",
  "CONFUSED",
  "BURN",
  "DAZED",
  "VOID",
  "WOUND",
]);

const BUFF_IDS = new Set([
  "STRENGTH",
  "DEXTERITY",
  "ARTIFACT",
  "INTANGIBLE",
  "FOCUS",
  "THORNS",
  "REGEN",
  "VIGOR",
  "RITUAL",
  "LOCK_ON",
]);

const WORD_CHAR = /[\uac00-\ud7a3a-z0-9]/i;

export function sts1KeywordTipVariant(id: string): CardSideTipVariant {
  if (DEBUFF_IDS.has(id)) return "debuff";
  if (BUFF_IDS.has(id)) return "buff";
  return "default";
}

function isWordInterior(text: string, index: number, length: number): boolean {
  const before = index > 0 ? text[index - 1] : "";
  const after = text[index + length] ?? "";
  return WORD_CHAR.test(before) || WORD_CHAR.test(after);
}

/** True when `name` occurs as its own token, not inside 증가시킵니다 / artifacts. */
export function sts1KeywordNameOccurs(text: string, name: string): boolean {
  if (name.length <= 1) return false;
  const haystack = text.toLowerCase();
  const needle = name.toLowerCase();
  let from = 0;
  while (from <= haystack.length) {
    const index = haystack.indexOf(needle, from);
    if (index < 0) return false;
    if (!isWordInterior(haystack, index, needle.length)) return true;
    from = index + 1;
  }
  return false;
}

export function sts1KeywordNameAt(text: string, index: number, name: string): boolean {
  if (name.length <= 1) return false;
  const haystack = text.toLowerCase();
  const needle = name.toLowerCase();
  if (!haystack.startsWith(needle, index)) return false;
  return !isWordInterior(haystack, index, needle.length);
}

/** Map STS1 #color tokens onto Compendium DescriptionText markup. */
export function sts1KeywordTipBody(description: string): string {
  return description
    .replace(/\s*NL\s*/g, "\n")
    .replace(/#b(\S+)/gi, "[blue]$1[/blue]")
    .replace(/#y(\S+)/gi, "[gold]$1[/gold]")
    .replace(/#r(\S+)/gi, "[red]$1[/red]")
    .replace(/#g(\S+)/gi, "[green]$1[/green]")
    .replace(/#p(\S+)/gi, "[purple]$1[/purple]")
    .replace(/\[\]/g, "");
}

export function collectSts1CardSideTips(
  text: string,
  keywords: readonly Sts1Keyword[],
): CardSideTip[] {
  const tips: CardSideTip[] = [];
  const seen = new Set<string>();

  for (const keyword of keywords) {
    if (!keyword.id || seen.has(keyword.id)) continue;
    const hit = keyword.names.some((name) => sts1KeywordNameOccurs(text, name));
    if (!hit) continue;
    seen.add(keyword.id);
    tips.push({
      kind: "keyword",
      id: keyword.id,
      title: keyword.names[0],
      description: sts1KeywordTipBody(keyword.description),
      variant: sts1KeywordTipVariant(keyword.id),
      source: "cardKeyword",
    });
  }

  return tips;
}

