import type { CardSideTipCatalogSources } from "@/lib/card-side-tip-catalog";
import type { CodexCard, CodexCharacter, CodexEncounter, CodexEvent, CodexMonster } from "@/lib/codex-types";

// Compendium list pages serialize their grid data into the page HTML. These
// helpers drop what the grid never reads before the first render; the list
// loaders restore it, or swap in the full rows once the data chunks load.

export type CompactCodexCard = Omit<CodexCard, "keywordLabels"> & {
  keywordLabels?: CodexCard["keywordLabels"];
};

/** Every card of a locale carries the same keyword label table; send it once. */
export function compactCardKeywordLabels(cards: readonly CodexCard[]): {
  cards: CompactCodexCard[];
  keywordLabels: CodexCard["keywordLabels"];
} {
  const keywordLabels = cards[0]?.keywordLabels ?? {};
  const shared = JSON.stringify(keywordLabels);
  return {
    keywordLabels,
    cards: cards.map(({ keywordLabels: labels, ...card }) => (
      JSON.stringify(labels) === shared ? card : { ...card, keywordLabels: labels }
    )),
  };
}

export function expandCardKeywordLabels(
  cards: readonly CompactCodexCard[],
  keywordLabels: CodexCard["keywordLabels"],
): CodexCard[] {
  return cards.map((card) => ({ ...card, keywordLabels: card.keywordLabels ?? keywordLabels }));
}

export const EMPTY_CARD_SIDE_TIP_SOURCES: CardSideTipCatalogSources = {
  keywords: [],
  staticHoverTips: {},
  engStaticHoverTips: {},
  orbs: {},
  engOrbs: {},
  monsterNames: {},
  engMonsterNames: {},
};

/** Bestiary grid rows: moves, Spine assets, and the move graph only feed hover and detail views. */
export function slimBestiaryMonsters(monsters: readonly CodexMonster[]): CodexMonster[] {
  return monsters.map((monster) => ({
    ...monster,
    moves: [],
    bestiaryMoves: [],
    initialPowerApplications: [],
    moveGraph: null,
    damageValues: null,
    blockValues: null,
    spineAsset: null,
  }));
}

/** Bestiary encounter rows: the combat scene only feeds the encounter detail. */
export function slimBestiaryEncounters(encounters: readonly CodexEncounter[]): CodexEncounter[] {
  return encounters.map((encounter) => ({ ...encounter, scene: null }));
}

/** Character rows for list filters: ancient dialogue and Spine assets only feed character pages. */
export function slimFilterCharacters(characters: readonly CodexCharacter[]): CodexCharacter[] {
  return characters.map((character) => ({
    ...character,
    ancientInteractions: [],
    characterSelectSpineAsset: null,
    spineAsset: null,
  }));
}

/**
 * Event rows a list's detail modal links to. The modal falls back to them when
 * the events chunk fails, so its related event links keep their names.
 */
export function pickLinkedEvents(events: readonly CodexEvent[], eventIds: Iterable<string>): CodexEvent[] {
  const wanted = new Set(eventIds);
  return events.filter((event) => wanted.has(event.id));
}

/** Linked event rows for modals whose event links and hover read only the names and art. */
export function slimLinkedEvents(events: readonly CodexEvent[]): CodexEvent[] {
  return events.map((event) => ({
    ...event,
    description: "",
    descriptionEn: "",
    options: null,
    pages: null,
  }));
}
