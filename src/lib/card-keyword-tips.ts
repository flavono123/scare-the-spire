import type {
  CodexCard,
  CodexKeyword,
  CodexMonster,
  CodexPower,
} from "@/lib/codex-types";
import type { GameLocalizationTable } from "@/lib/game-localization-text";
import { gameText } from "@/lib/game-localization-text";
import {
  cardKeywordLookupKey,
  getCardDisplayKeywords,
  getCardKeywordDisplayText,
} from "@/lib/sts2-card-keywords";

export type CardSideTipVariant = "default" | "buff" | "debuff";

export type CardSideKeywordTip = {
  kind: "keyword";
  id: string;
  title: string;
  description: string;
  iconUrl?: string | null;
  variant: CardSideTipVariant;
  source: "cardKeyword" | "power" | "staticHoverTip" | "orb";
};

export type CardSideCardTip = {
  kind: "card";
  id: string;
  card: CodexCard;
};

export type CardSideMonsterTip = {
  kind: "monster";
  id: string;
  title: string;
  imageUrl: string | null;
  /** Full bestiary row when present; pets like OSTY may be localization-only. */
  monster?: CodexMonster | null;
};

export type CardSideTip = CardSideKeywordTip | CardSideCardTip | CardSideMonsterTip;

export type CardSideTipCatalog = {
  keywordsByName: Map<string, CardSideKeywordTip>;
  keywordsById: Map<string, CardSideKeywordTip>;
  cardsById: Map<string, CodexCard>;
  cardsByName: Map<string, CodexCard>;
  monstersByName: Map<string, CardSideMonsterTip>;
};

/** Pets/companions present in localization + art but missing from monsters.json. */
const LOCALIZATION_ONLY_MONSTER_IDS = ["OSTY", "BYRDPIP", "PAELS_LEGION"] as const;

/**
 * Keyword tips that append a card preview + that card's HoverTips.
 * Mirrors MegaCrit HoverTipFactory.FromForge → FromCardWithCardHoverTips<SovereignBlade>.
 * Not general gold-text cascading: tip body gold does not auto-expand.
 */
const KEYWORD_TIP_CARD_EXPANSIONS: Record<string, string> = {
  FORGE: "SOVEREIGN_BLADE",
};

function monsterRenderImageUrl(id: string): string {
  return `/images/sts2/monsters-render/${id.toLowerCase()}.webp`;
}

/** Gold terms that do not match static tip titles 1:1 after template strip. */
const GOLD_STATIC_TIP_ALIASES: Record<string, string> = {
  "소멸된 카드 더미": "EXHAUST_PILE",
  "Exhaust Pile": "EXHAUST_PILE",
};

const ORB_IDS = [
  "LIGHTNING_ORB",
  "FROST_ORB",
  "DARK_ORB",
  "PLASMA_ORB",
  "GLASS_ORB",
] as const;

const GOLD_TERM_RE = /\[gold\](.*?)\[\/gold\]/gi;

function normalizeTipName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

/** Strip nested `{…}` templates from localization titles (hotkey suffixes). */
export function stripLocalizationTitleTemplates(title: string): string {
  let out = "";
  for (let i = 0; i < title.length; i++) {
    if (title[i] !== "{") {
      out += title[i];
      continue;
    }
    let depth = 1;
    i += 1;
    while (i < title.length && depth > 0) {
      if (title[i] === "{") depth += 1;
      else if (title[i] === "}") depth -= 1;
      i += 1;
    }
    i -= 1;
  }
  return normalizeTipName(out);
}

export function extractGoldTerms(description: string): string[] {
  const terms: string[] = [];
  const seen = new Set<string>();
  GOLD_TERM_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = GOLD_TERM_RE.exec(description)) !== null) {
    const term = normalizeTipName(match[1] ?? "");
    if (!term || seen.has(term)) continue;
    seen.add(term);
    terms.push(term);
  }
  return terms;
}

function powerVariant(power: CodexPower): CardSideTipVariant {
  if (power.type === "Buff") return "buff";
  if (power.type === "Debuff") return "debuff";
  return "default";
}

function setKeywordTip(
  map: Map<string, CardSideKeywordTip>,
  name: string | null | undefined,
  tip: CardSideKeywordTip,
) {
  const key = normalizeTipName(name ?? "");
  if (!key || map.has(key)) return;
  map.set(key, tip);
}

function parseStaticHoverTips(
  table: GameLocalizationTable,
  engTable?: GameLocalizationTable | null,
): CardSideKeywordTip[] {
  const ids = new Set<string>();
  for (const key of Object.keys(table)) {
    if (key.endsWith(".title")) ids.add(key.slice(0, -".title".length));
  }

  const tips: CardSideKeywordTip[] = [];
  for (const id of ids) {
    const rawTitle = gameText(table, `${id}.title`, id);
    const title = stripLocalizationTitleTemplates(rawTitle);
    if (!title) continue;
    const description = gameText(table, `${id}.description`, "");
    if (!description) continue;
    const engTitle = engTable
      ? stripLocalizationTitleTemplates(gameText(engTable, `${id}.title`, title))
      : title;
    tips.push({
      kind: "keyword",
      id,
      title,
      description,
      iconUrl: null,
      variant: "default",
      source: "staticHoverTip",
    });
    // Keep eng title as alternate lookup via caller setKeywordTip(nameEn)
    void engTitle;
  }
  return tips;
}

function parseOrbTips(table: GameLocalizationTable): CardSideKeywordTip[] {
  return ORB_IDS.flatMap((id) => {
    const title = normalizeTipName(gameText(table, `${id}.title`, ""));
    const description = gameText(table, `${id}.description`, "");
    if (!title || !description) return [];
    return [{
      kind: "keyword" as const,
      id,
      title,
      description,
      iconUrl: null,
      variant: "default" as const,
      source: "orb" as const,
    }];
  });
}

export function buildCardSideTipCatalog(input: {
  keywords: readonly CodexKeyword[];
  powers: readonly CodexPower[];
  cards: readonly CodexCard[];
  monsters: readonly CodexMonster[];
  staticHoverTips: GameLocalizationTable;
  engStaticHoverTips?: GameLocalizationTable | null;
  orbs: GameLocalizationTable;
  engOrbs?: GameLocalizationTable | null;
  monsterNames?: GameLocalizationTable | null;
  engMonsterNames?: GameLocalizationTable | null;
}): CardSideTipCatalog {
  const keywordsByName = new Map<string, CardSideKeywordTip>();
  const keywordsById = new Map<string, CardSideKeywordTip>();

  const registerKeywordTip = (tip: CardSideKeywordTip, ...names: Array<string | null | undefined>) => {
    if (!keywordsById.has(tip.id)) keywordsById.set(tip.id, tip);
    for (const name of names) setKeywordTip(keywordsByName, name, tip);
  };

  for (const keyword of input.keywords) {
    const tip: CardSideKeywordTip = {
      kind: "keyword",
      id: keyword.id,
      title: keyword.name,
      description: keyword.description,
      iconUrl: null,
      variant: "default",
      source: keyword.source === "staticHoverTip" ? "staticHoverTip" : "cardKeyword",
    };
    registerKeywordTip(tip, keyword.name, keyword.nameEn);
  }

  for (const power of input.powers) {
    const tip: CardSideKeywordTip = {
      kind: "keyword",
      id: power.id,
      title: power.name,
      description: power.description,
      iconUrl: power.imageUrl,
      variant: powerVariant(power),
      source: "power",
    };
    registerKeywordTip(tip, power.name, power.nameEn);
  }

  for (const tip of parseStaticHoverTips(input.staticHoverTips, input.engStaticHoverTips)) {
    registerKeywordTip(tip, tip.title);
    if (input.engStaticHoverTips) {
      const engTitle = stripLocalizationTitleTemplates(
        gameText(input.engStaticHoverTips, `${tip.id}.title`, ""),
      );
      registerKeywordTip(tip, engTitle);
    }
  }

  for (const tip of parseOrbTips(input.orbs)) {
    registerKeywordTip(tip, tip.title);
  }
  if (input.engOrbs) {
    for (const tip of parseOrbTips(input.engOrbs)) {
      const localized = parseOrbTips(input.orbs).find((entry) => entry.id === tip.id) ?? tip;
      registerKeywordTip(localized, tip.title);
    }
  }

  for (const [gold, tipId] of Object.entries(GOLD_STATIC_TIP_ALIASES)) {
    const existing = keywordsById.get(tipId);
    if (existing) registerKeywordTip(existing, gold);
  }

  const cardsById = new Map<string, CodexCard>();
  const cardsByName = new Map<string, CodexCard>();
  for (const card of input.cards) {
    if (!cardsById.has(card.id)) cardsById.set(card.id, card);
    const name = normalizeTipName(card.name);
    const nameEn = normalizeTipName(card.nameEn);
    if (name && !cardsByName.has(name)) cardsByName.set(name, card);
    if (nameEn && !cardsByName.has(nameEn)) cardsByName.set(nameEn, card);
  }

  const monstersByName = new Map<string, CardSideMonsterTip>();
  const setMonsterTip = (name: string | null | undefined, tip: CardSideMonsterTip) => {
    const key = normalizeTipName(name ?? "");
    if (!key || monstersByName.has(key)) return;
    monstersByName.set(key, tip);
  };

  for (const monster of input.monsters) {
    const tip: CardSideMonsterTip = {
      kind: "monster",
      id: monster.id,
      title: monster.name,
      imageUrl: monster.bossImageUrl ?? monster.imageUrl,
      monster,
    };
    setMonsterTip(monster.name, tip);
    setMonsterTip(monster.nameEn, tip);
  }

  for (const id of LOCALIZATION_ONLY_MONSTER_IDS) {
    if ([...monstersByName.values()].some((tip) => tip.id === id)) continue;
    const title = normalizeTipName(
      gameText(input.monsterNames ?? null, `${id}.name`, id),
    );
    const titleEn = normalizeTipName(
      gameText(input.engMonsterNames ?? null, `${id}.name`, title),
    );
    if (!title) continue;
    const tip: CardSideMonsterTip = {
      kind: "monster",
      id,
      title,
      imageUrl: monsterRenderImageUrl(id),
      monster: null,
    };
    setMonsterTip(title, tip);
    setMonsterTip(titleEn, tip);
  }

  return { keywordsByName, keywordsById, cardsById, cardsByName, monstersByName };
}

function resolveKeywordTerm(
  term: string,
  catalog: CardSideTipCatalog,
): CardSideKeywordTip | null {
  const key = normalizeTipName(term);
  return catalog.keywordsByName.get(key) ?? null;
}

export function resolveKeywordTipById(
  catalog: CardSideTipCatalog,
  id: string,
): CardSideKeywordTip | null {
  return catalog.keywordsById.get(id) ?? null;
}

/**
 * Shared tip pusher with Forge → Sovereign Blade expansion.
 * Used by card and relic side-tip collectors.
 */
export function createCardSideTipPusher(
  catalog: CardSideTipCatalog,
  tips: CardSideTip[],
  seen: Set<string>,
  excludeCardId?: string | null,
): (tip: CardSideTip | null) => void {
  const push = (tip: CardSideTip | null) => {
    if (!tip) return;
    const key = `${tip.kind}:${tip.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    tips.push(tip);

    if (tip.kind !== "keyword") return;
    const expandCardId = KEYWORD_TIP_CARD_EXPANSIONS[tip.id];
    if (!expandCardId) return;
    const expandCard = catalog.cardsById.get(expandCardId);
    if (!expandCard) return;
    pushCardWithCardHoverTips(expandCard, catalog, push, excludeCardId);
  };
  return push;
}

/**
 * Mirror CardModel.HoverTips keyword portion for a previewed card:
 * printed keywords, plus Exhaust when Ethereal is present.
 * Does not scrape gold from the preview card description (game doesn't either here).
 */
export function pushCardWithCardHoverTips(
  previewCard: CodexCard,
  catalog: CardSideTipCatalog,
  push: (tip: CardSideTip | null) => void,
  excludeCardId?: string | null,
) {
  if (previewCard.id === excludeCardId) return;
  push({ kind: "card", id: previewCard.id, card: previewCard });

  const printed = getCardDisplayKeywords(previewCard, { upgradeLevel: 0 });
  let hasEthereal = false;
  for (const keyword of printed) {
    const lookupKey = cardKeywordLookupKey(keyword);
    if (lookupKey === "ETHEREAL") hasEthereal = true;
    const display = getCardKeywordDisplayText(previewCard, keyword);
    push(
      resolveKeywordTerm(lookupKey, catalog)
        ?? resolveKeywordTerm(display, catalog),
    );
  }
  if (hasEthereal) {
    push(resolveKeywordTerm("EXHAUST", catalog) ?? resolveKeywordTerm("Exhaust", catalog));
  }
}

function resolveEntityTerm(
  term: string,
  catalog: CardSideTipCatalog,
  excludeCardId?: string | null,
): CardSideCardTip | CardSideMonsterTip | null {
  const key = normalizeTipName(term);
  const card = catalog.cardsByName.get(key);
  if (card && card.id !== excludeCardId) {
    return { kind: "card", id: card.id, card };
  }
  return catalog.monstersByName.get(key) ?? null;
}

export function resolveCardSideTipTerm(
  term: string,
  catalog: CardSideTipCatalog,
  opts?: { excludeCardId?: string | null },
): CardSideTip | null {
  return resolveKeywordTerm(term, catalog)
    ?? resolveEntityTerm(term, catalog, opts?.excludeCardId);
}

export function collectCardSideTips(
  card: Pick<CodexCard, "id" | "keywords" | "keywordLabels" | "upgrade" | "description">,
  catalog: CardSideTipCatalog,
  opts?: {
    upgradeLevel?: number;
    description?: string;
    addedKeywords?: string[];
    removedKeywords?: string[];
  },
): CardSideTip[] {
  const tips: CardSideTip[] = [];
  const seen = new Set<string>();
  const push = createCardSideTipPusher(catalog, tips, seen, card.id);

  const printed = getCardDisplayKeywords(card, {
    upgradeLevel: opts?.upgradeLevel ?? 0,
    addedKeywords: opts?.addedKeywords,
    removedKeywords: opts?.removedKeywords,
  });

  for (const keyword of printed) {
    const lookupKey = cardKeywordLookupKey(keyword);
    const display = getCardKeywordDisplayText(card, keyword);
    push(
      resolveKeywordTerm(lookupKey, catalog)
        ?? resolveKeywordTerm(display, catalog),
    );
  }

  const description = opts?.description ?? card.description;
  for (const term of extractGoldTerms(description)) {
    push(resolveCardSideTipTerm(term, catalog, { excludeCardId: card.id }));
  }

  return tips;
}
