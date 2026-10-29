import type { CardSideTip, CardSideTipCatalog } from "@/lib/card-keyword-tips";
import { buildCardSideTipCatalog } from "@/lib/card-keyword-tips";
import type { GameLocalizationTable } from "@/lib/game-localization-text";
import type {
  CodexCard,
  CodexKeyword,
  CodexMonster,
  CodexPower,
} from "@/lib/codex-types";

export type CardSideTipCatalogSources = {
  keywords: CodexKeyword[];
  staticHoverTips: GameLocalizationTable;
  engStaticHoverTips: GameLocalizationTable;
  orbs: GameLocalizationTable;
  engOrbs: GameLocalizationTable;
  monsterNames: GameLocalizationTable;
  engMonsterNames: GameLocalizationTable;
  /**
   * Rows a picked catalog carries (see pickCardSideTipCatalogSources), added
   * after the powers, cards, and monsters the caller passes. The chunk's full
   * sources leave them out.
   */
  powers?: CodexPower[];
  cards?: CodexCard[];
  monsters?: CodexMonster[];
};

export type CardSideTipCatalogInput = {
  sources: CardSideTipCatalogSources;
  powers: readonly CodexPower[];
  cards: readonly CodexCard[];
  monsters: readonly CodexMonster[];
};

function withRows<T>(rows: readonly T[], extra: readonly T[] | undefined): readonly T[] {
  return extra?.length ? [...rows, ...extra] : rows;
}

/** Client-safe: no fs / codex-data imports. */
export function createCardSideTipCatalog(input: CardSideTipCatalogInput): CardSideTipCatalog {
  return buildCardSideTipCatalog({
    keywords: input.sources.keywords,
    powers: withRows(input.powers, input.sources.powers),
    cards: withRows(input.cards, input.sources.cards),
    monsters: withRows(input.monsters, input.sources.monsters),
    staticHoverTips: input.sources.staticHoverTips,
    engStaticHoverTips: input.sources.engStaticHoverTips,
    orbs: input.sources.orbs,
    engOrbs: input.sources.engOrbs,
    monsterNames: input.sources.monsterNames,
    engMonsterNames: input.sources.engMonsterNames,
  });
}

/** Entries of `<id>.<field>` tables (static hover tips, orbs, monster names) for the given ids. */
function pickTableEntries(table: GameLocalizationTable, ids: ReadonlySet<string>): GameLocalizationTable {
  return Object.fromEntries(
    Object.entries(table).filter(([key]) => {
      const dot = key.lastIndexOf(".");
      return dot > 0 && ids.has(key.slice(0, dot));
    }),
  );
}

/**
 * The catalog rows the given tips came from, for a list page to send with its
 * modals and tiles. A catalog built from them, with `sentCards` (the cards the
 * page sends anyway) and no other powers or monsters, resolves those tips as
 * the full catalog does: a lookup returns the first row registered under a
 * name or id, every row a tip came from is kept, and dropping the others adds
 * no row that could come first.
 */
export function pickCardSideTipCatalogSources(
  input: CardSideTipCatalogInput,
  tips: Iterable<CardSideTip>,
  { sentCards = [] }: { sentCards?: readonly Pick<CodexCard, "id">[] } = {},
): CardSideTipCatalogSources {
  const keywordIds = new Set<string>();
  const cardIds = new Set<string>();
  const monsterIds = new Set<string>();
  for (const tip of tips) {
    if (tip.kind === "keyword") keywordIds.add(tip.id);
    else if (tip.kind === "card") cardIds.add(tip.id);
    else monsterIds.add(tip.id);
  }
  const sentCardIds = new Set(sentCards.map((card) => card.id));
  const { sources } = input;
  return {
    keywords: sources.keywords.filter((keyword) => keywordIds.has(keyword.id)),
    staticHoverTips: pickTableEntries(sources.staticHoverTips, keywordIds),
    engStaticHoverTips: pickTableEntries(sources.engStaticHoverTips, keywordIds),
    orbs: pickTableEntries(sources.orbs, keywordIds),
    engOrbs: pickTableEntries(sources.engOrbs, keywordIds),
    monsterNames: pickTableEntries(sources.monsterNames, monsterIds),
    engMonsterNames: pickTableEntries(sources.engMonsterNames, monsterIds),
    powers: withRows(input.powers, sources.powers).filter((power) => keywordIds.has(power.id)),
    cards: withRows(input.cards, sources.cards).filter((card) => cardIds.has(card.id) && !sentCardIds.has(card.id)),
    monsters: withRows(input.monsters, sources.monsters).filter((monster) => monsterIds.has(monster.id)),
  };
}
