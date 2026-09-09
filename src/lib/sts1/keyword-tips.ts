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

export function sts1KeywordTipVariant(id: string): CardSideTipVariant {
  if (DEBUFF_IDS.has(id)) return "debuff";
  if (BUFF_IDS.has(id)) return "buff";
  return "default";
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
  const haystack = text.toLowerCase();
  const tips: CardSideTip[] = [];
  const seen = new Set<string>();

  for (const keyword of keywords) {
    if (!keyword.id || seen.has(keyword.id)) continue;
    const hit = keyword.names.some((name) => name.length > 1 && haystack.includes(name.toLowerCase()));
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
