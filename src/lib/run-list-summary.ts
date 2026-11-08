/**
 * The History Course run summary of the D1 copy (docs/supabase-exit/D1_SCHEMA_DESIGN.md 4.4, 10.2).
 *
 * extractRunListSummary: a run's raw file -> the summary columns (characters, game_mode,
 * game_elements, list_facts, badges, summary_version). The first copy and the GitHub Actions fill
 * job run it in Node. listInputsFromSummaryRow: a D1 list row (summary columns, no raw) -> the same
 * list inputs the list builds from the raw today (listInputsFromRawRow). Both sides call the list's
 * own code (cover picker, phrase pool, highlights, search, badges); nothing here re-implements it.
 */
import type { ComboResourceRef } from "./combo-types";
import {
  buildHistoryCourseSearchDoc,
  extractRunGameElements,
  historyCourseRunSearchFacts,
  type HistoryCourseRunSearchFacts,
  type HistoryCourseSearchDoc,
} from "./history-course-search";
import { mergePartyBadges, partyCharacters } from "./history-party";
import {
  coverPhrasePoolFromFacts,
  coverPoolFactsFromRun,
  factsFromRun,
  pickAlternatingCoverFromFacts,
  type CoverPoolFacts,
  type PhraseFacts,
} from "./run-cover-suggest";
import { buildRunHighlights, runHighlightFromId } from "./run-highlights";
import {
  normalizeRunSummaryRow,
  parseCoverSpec,
  parseRunSafely,
  type DonatedRunSummary,
  type RunRow,
} from "./run-summary-row";
import { parseReplayRun, type ReplayBadge } from "./sts2-run-replay";
import type { EntityInfo } from "@/components/patch-note-renderer";

/**
 * Version of the extractor. Bump it when the extractor, buildRunHighlights, the list_facts inputs
 * or the badge rule (mergePartyBadges) change, then re-run the fill job (design 4.4).
 */
export const RUN_SUMMARY_VERSION = 1;

/**
 * post_history_course.list_facts: what the list read from the raw and no other column holds. The
 * cover pool facts in the picker's read order, the phrase facts' player maxima, and the highlight
 * card and relic ids (buildRunHighlights, fixed by the run id and seed).
 */
export interface RunListFacts extends CoverPoolFacts {
  deck_size: number;
  relic_count: number;
  highlight_card: string | null;
  highlight_relic: string | null;
}

export interface RunListSummary {
  characters: string[];
  game_mode: string;
  game_elements: ComboResourceRef[];
  list_facts: RunListFacts;
  badges: ReplayBadge[];
  summary_version: number;
}

/** The summary columns of one run. Throws when the raw does not parse (the caller reports it). */
export function extractRunListSummary(runId: string, raw: string): RunListSummary {
  const run = parseReplayRun(raw);
  const pool = coverPoolFactsFromRun(run);
  const phrase = factsFromRun(run);
  const highlights = buildRunHighlights(run, runId);
  return {
    characters: partyCharacters(run),
    game_mode: run.game_mode,
    game_elements: extractRunGameElements(run),
    list_facts: {
      cards: pool.cards,
      relics: pool.relics,
      potions: pool.potions,
      deck_size: phrase.deckSize,
      relic_count: phrase.relicCount,
      highlight_card: highlights.card?.id ?? null,
      highlight_relic: highlights.relic?.id ?? null,
    },
    badges: mergePartyBadges(run),
    summary_version: RUN_SUMMARY_VERSION,
  };
}

/** A D1 list row (R1, R2): the copied columns plus the summary columns, no raw. */
export interface RunSummaryListRow {
  id: string;
  seed: string;
  build: string;
  character: string;
  ascension: number;
  win: boolean;
  start_time: number | null;
  run_time: number | null;
  acts_count: number;
  total_floors: number;
  cover_spec: unknown;
  donor_user_id: string | null;
  created_at: string;
  characters: string[] | null;
  game_mode: string | null;
  game_elements: ComboResourceRef[] | null;
  list_facts: RunListFacts | null;
  badges: ReplayBadge[];
  summary_version: number;
}

/** What one donated run gives the list: the card's row, and the search doc's run facts. */
export interface HistoryRunListInputs {
  summary: DonatedRunSummary;
  /** In place of the parsed run for buildHistoryCourseSearchDoc; null when the raw did not parse. */
  searchFacts: HistoryCourseRunSearchFacts | null;
}

/** Today's list: a RUN_SUMMARY_COLUMNS row with its raw (normalizeRunSummaryRow + the parsed run). */
export function listInputsFromRawRow(row: RunRow): HistoryRunListInputs {
  const run = parseRunSafely(row.raw);
  return {
    summary: normalizeRunSummaryRow(row),
    searchFacts: run ? historyCourseRunSearchFacts(run) : null,
  };
}

function phraseFactsOf(row: RunSummaryListRow, facts: RunListFacts): PhraseFacts {
  return {
    win: row.win,
    totalFloors: row.total_floors,
    ascension: row.ascension,
    relicCount: facts.relic_count,
    deckSize: facts.deck_size,
  };
}

/**
 * The D1 list: the same inputs from the summary columns. A row with summary_version 0 has none yet;
 * the list reads that run's raw (R3r) and uses listInputsFromRawRow, as design 4.4 says.
 */
export function listInputsFromSummaryRow(row: RunSummaryListRow): HistoryRunListInputs {
  const facts = row.list_facts;
  if (row.summary_version <= 0 || !facts || !row.characters || row.game_mode === null || !row.game_elements) {
    throw new Error(`run ${row.id} has no summary yet (summary_version ${row.summary_version})`);
  }
  const phrase = phraseFactsOf(row, facts);
  const stored = parseCoverSpec(row.cover_spec);
  // Auto covers re-pick A/B on read, as normalizeRunRow does from the raw.
  const cover_spec = stored?.auto === false ? stored : pickAlternatingCoverFromFacts(row.id, facts, phrase);
  const summary: DonatedRunSummary = {
    id: row.id,
    raw: null,
    seed: row.seed,
    build: row.build,
    character: row.character,
    characters: row.characters,
    ascension: row.ascension,
    win: row.win,
    start_time: row.start_time,
    run_time: row.run_time,
    acts_count: row.acts_count,
    total_floors: row.total_floors,
    badges: row.badges,
    highlight_card: facts.highlight_card ? runHighlightFromId("card", facts.highlight_card) : null,
    highlight_relic: facts.highlight_relic ? runHighlightFromId("relic", facts.highlight_relic) : null,
    note_blocks: null,
    cover_spec,
    donor_user_id: row.donor_user_id,
    created_at: row.created_at,
  };
  const characters = row.characters;
  const gameElements = row.game_elements;
  return {
    summary,
    searchFacts: {
      gameElements,
      seed: row.seed,
      gameMode: row.game_mode,
      build: row.build,
      ascension: row.ascension,
      win: row.win,
      totalFloors: row.total_floors,
      characters,
      coverPhrasePool: (elements) => coverPhrasePoolFromFacts(phrase, elements),
    },
  };
}

/** The search doc the list builds for a donated run (history-course-run-index.tsx). */
export function listSearchDoc(inputs: HistoryRunListInputs, entities: EntityInfo[] = []): HistoryCourseSearchDoc {
  return buildHistoryCourseSearchDoc({
    runId: inputs.summary.id,
    runFacts: inputs.searchFacts,
    donated: inputs.summary,
    cover: inputs.summary.cover_spec ?? null,
    noteBlocks: inputs.summary.note_blocks ?? null,
    entities,
  });
}
