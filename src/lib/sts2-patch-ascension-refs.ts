import type { STS2PatchFeaturedEntityType } from "@/lib/types";

type AscensionLabel = { type: "ascension"; label: string };

const PAREN_STAT_RE = /\d+(?:\s*-\s*\d+)?\s*\(\s*\d+(?:\s*-\s*\d+)?\s*\)/;
const HP_RANGE_RE =
  /\d+\s*-\s*\d+\s*\(\s*\d+\s*-\s*\d+\s*\)|\d+\s*\(\s*\d+\s*\)\s*-\s*\d+\s*\(\s*\d+\s*\)/;
const NUMBERED_ASCENSION_RE =
  /(?<![낮높]은\s)(?<!(?:low|high)\s)(?:승천|ascension)\s*(10|[1-9])(?!\d)|\bA(10|[1-9])\b/gi;
const MONSTER_TAG_RE = /\[gold:monster\]/i;
const HEAL_HP_RE = /회복(?:하는)?\s*체력|\bheals?\b|\brestores?\b/i;
const HP_RE = /체력|\bhp\b|health/i;
const DAMAGE_RE = /피해량|피해를|\bdamage\b/i;

export function isNumberedAscensionLabel(label: string): boolean {
  return /^(?:승천|ascension)\s*(?:10|[1-9])$|^a(?:10|[1-9])$/i.test(label.trim());
}

function pushLevel(seen: Set<string>, labels: AscensionLabel[], raw: string) {
  const level = raw.replace(/^0+/, "") || "0";
  if (level === "0" || seen.has(level)) return;
  seen.add(level);
  labels.push({ type: "ascension", label: `승천 ${level}` });
  labels.push({ type: "ascension", label: `Ascension ${level}` });
  labels.push({ type: "ascension", label: `A${level}` });
}

/** Any explicit 승천 N / Ascension N / A8 mention, including monster HP/damage lines. */
export function extractNumberedAscensionLabels(text: string): AscensionLabel[] {
  const labels: AscensionLabel[] = [];
  const seen = new Set<string>();
  const pattern = new RegExp(NUMBERED_ASCENSION_RE.source, NUMBERED_ASCENSION_RE.flags);
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    pushLevel(seen, labels, match[1] ?? match[2] ?? "");
  }
  return labels;
}

/**
 * Tier-2 matching: monster changes that affect an Ascension even when the
 * notes never say "승천 N". Parenthetical HP is A8; parenthetical damage is A9.
 * Check each bullet/detail separately so a sibling "Max HP" line does not
 * inherit another line's parenthetical damage values.
 */
export function extractMonsterThresholdAscensionLabels(markdown: string): AscensionLabel[] {
  const labels: AscensionLabel[] = [];
  if (!MONSTER_TAG_RE.test(markdown)) return labels;

  const seen = new Set<string>();
  for (const segment of markdown.split(/\n+/)) {
    if (!PAREN_STAT_RE.test(segment) && !HP_RANGE_RE.test(segment)) continue;
    if (!HEAL_HP_RE.test(segment) && (HP_RE.test(segment) || HP_RANGE_RE.test(segment))) {
      pushLevel(seen, labels, "8");
    }
    if (DAMAGE_RE.test(segment)) {
      pushLevel(seen, labels, "9");
    }
  }
  return labels;
}

export function extractAscensionPatchLabels(markdown: string): Array<{
  type: STS2PatchFeaturedEntityType;
  label: string;
}> {
  return [
    ...extractNumberedAscensionLabels(markdown),
    ...extractMonsterThresholdAscensionLabels(markdown),
  ];
}
