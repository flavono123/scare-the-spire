import type { CodexCard } from "@/lib/codex-types";

const UPGRADE_ADDED_KEYWORDS: Record<string, string> = {
  add_innate: "선천성",
  innate: "선천성",
  add_retain: "보존",
};

const UPGRADE_REMOVED_KEYWORDS: Record<string, string> = {
  remove_exhaust: "소멸",
  remove_ethereal: "휘발성",
};

const PRE_DESCRIPTION_KEYWORD_ORDER = [
  "사용불가",
  "선천성",
  "보존",
  "교활",
  "휘발성",
] as const;
const POST_DESCRIPTION_KEYWORD_ORDER = ["소멸", "영구"] as const;

function getUpgradeKeywords(
  upgrade: CodexCard["upgrade"],
  mapping: Record<string, string>,
): string[] {
  if (!upgrade) return [];
  return Object.entries(mapping).flatMap(([key, keyword]) => (
    upgrade[key] ? [keyword] : []
  ));
}

export function cardKeywordLookupKey(keyword: string): string {
  return keyword.split(/\s/)[0];
}

export function getCardKeywordDisplayText(
  card: Pick<CodexCard, "keywordLabels">,
  keyword: string,
): string {
  const lookupKey = cardKeywordLookupKey(keyword);
  const label = card.keywordLabels[lookupKey] ?? lookupKey;
  return keyword.replace(lookupKey, label);
}

export function getCardDisplayKeywords(
  card: Pick<CodexCard, "keywords" | "upgrade">,
  {
    upgradeLevel = 0,
    addedKeywords = [],
    removedKeywords = [],
  }: {
    upgradeLevel?: number;
    addedKeywords?: string[];
    removedKeywords?: string[];
  } = {},
): string[] {
  const isUpgraded = upgradeLevel > 0;
  const upgradeAddedKeywords = isUpgraded
    ? getUpgradeKeywords(card.upgrade, UPGRADE_ADDED_KEYWORDS)
    : [];
  const upgradeRemovedKeywords = isUpgraded
    ? getUpgradeKeywords(card.upgrade, UPGRADE_REMOVED_KEYWORDS)
    : [];
  const removedSet = new Set([
    ...upgradeRemovedKeywords,
    ...removedKeywords,
  ]);
  const baseKeywords = card.keywords.filter((keyword) => !removedSet.has(keyword));
  return [
    ...baseKeywords,
    ...[...upgradeAddedKeywords, ...addedKeywords].filter(
      (keyword) => (
        !removedSet.has(keyword)
        && !baseKeywords.includes(keyword)
      ),
    ),
  ];
}

export function splitCardDisplayKeywords(keywords: string[]): {
  preDescriptionKeywords: string[];
  postDescriptionKeywords: string[];
} {
  const preDescriptionKeywords = keywords
    .filter((keyword) => (
      PRE_DESCRIPTION_KEYWORD_ORDER.includes(
        cardKeywordLookupKey(keyword) as (typeof PRE_DESCRIPTION_KEYWORD_ORDER)[number],
      )
    ))
    .sort((left, right) => (
      PRE_DESCRIPTION_KEYWORD_ORDER.indexOf(
        cardKeywordLookupKey(left) as (typeof PRE_DESCRIPTION_KEYWORD_ORDER)[number],
      )
      - PRE_DESCRIPTION_KEYWORD_ORDER.indexOf(
        cardKeywordLookupKey(right) as (typeof PRE_DESCRIPTION_KEYWORD_ORDER)[number],
      )
    ));
  const postDescriptionKeywords = keywords
    .filter((keyword) => (
      !PRE_DESCRIPTION_KEYWORD_ORDER.includes(
        cardKeywordLookupKey(keyword) as (typeof PRE_DESCRIPTION_KEYWORD_ORDER)[number],
      )
    ))
    .sort((left, right) => {
      const leftIndex = POST_DESCRIPTION_KEYWORD_ORDER.indexOf(
        cardKeywordLookupKey(left) as (typeof POST_DESCRIPTION_KEYWORD_ORDER)[number],
      );
      const rightIndex = POST_DESCRIPTION_KEYWORD_ORDER.indexOf(
        cardKeywordLookupKey(right) as (typeof POST_DESCRIPTION_KEYWORD_ORDER)[number],
      );
      if (leftIndex === -1 && rightIndex === -1) return 0;
      if (leftIndex === -1) return 1;
      if (rightIndex === -1) return -1;
      return leftIndex - rightIndex;
    });
  return { preDescriptionKeywords, postDescriptionKeywords };
}
