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
  pickAlternatingCover,
  pickAlternatingCoverFromFacts,
  type CoverPoolFacts,
  type PhraseFacts,
} from "./run-cover-suggest";
import type { CoverSpec } from "./run-cover-types";
import { RUN_SUMMARY_COLUMNS } from "./history-runs-api-rules";
import { buildRunHighlights, runHighlightFromId } from "./run-highlights";
import {
  isSummaryListRow,
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

/** True when a D1 row has its summary (summary_version above 0 and every summary column). */
export function hasListSummary(row: RunSummaryListRow): boolean {
  return row.summary_version > 0 && Boolean(row.list_facts) && Boolean(row.characters)
    && row.game_mode !== null && Boolean(row.game_elements);
}

const isText = (value: unknown): value is string => typeof value === "string";
const isCount = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);

/** list_facts as extractRunListSummary writes it, element by element. */
function isListFacts(value: unknown): value is RunListFacts {
  if (!isObject(value)) return false;
  const { cards, relics, potions, deck_size, relic_count, highlight_card, highlight_relic } = value;
  return Array.isArray(cards) && cards.every((card) => Array.isArray(card) && card.length === 4 && isText(card[0])
      && isCount(card[1]) && (card[2] === null || isCount(card[2])) && typeof card[3] === "boolean")
    && Array.isArray(relics) && relics.every((relic) => Array.isArray(relic) && relic.length === 2 && isText(relic[0]) && typeof relic[1] === "boolean")
    && Array.isArray(potions) && potions.every(isText)
    && isCount(deck_size) && isCount(relic_count)
    && (highlight_card === null || isText(highlight_card)) && (highlight_relic === null || isText(highlight_relic));
}

/** The other summary columns as the extractor writes them (characters, game_mode, game_elements, badges). */
function isSummaryShape(row: RunSummaryListRow): boolean {
  return Array.isArray(row.characters) && row.characters.every(isText)
    && isText(row.game_mode)
    && Array.isArray(row.game_elements) && row.game_elements.every((element) => isObject(element) && isText(element.type) && isText(element.id))
    && Array.isArray(row.badges) && row.badges.every(isObject);
}

/**
 * The list inputs of a D1 row from its summary columns, or null when the row has no summary or one
 * the list cannot read (columns of the wrong shape, from a hand-made share at step 5). The search
 * doc is built once here, as the list builds it for every card, so a summary that fails there fails
 * here, for this row only.
 */
function summaryInputsOrNull(row: RunSummaryListRow): HistoryRunListInputs | null {
  if (!hasListSummary(row) || !isListFacts(row.list_facts) || !isSummaryShape(row)) return null;
  try {
    const inputs = listInputsFromSummaryRow(row);
    listSearchDoc(inputs);
    return inputs;
  } catch {
    return null;
  }
}

/**
 * Today's list row for a D1 row without a summary: the RUN_SUMMARY_COLUMNS of the Supabase select,
 * with the raw read from R3r (null when it could not be read).
 */
export function rawRowFromSummaryRow(row: Record<string, unknown>, raw: string | null): RunRow {
  const out: Record<string, unknown> = {};
  for (const name of RUN_SUMMARY_COLUMNS.split(",")) out[name] = name === "raw" ? raw : row[name];
  return out as RunRow;
}

/** Fetches one run's raw file (R3r); null when it is not shared or cannot be read. */
export type RunRawFetcher = (runId: string) => Promise<string | null>;

/** summary_version 0 runs read their raw at most this many at a time. */
const RAW_FETCH_CONCURRENCY = 4;

async function rawOf(fetchRaw: RunRawFetcher, runId: string): Promise<string | null> {
  try {
    return await fetchRaw(runId);
  } catch {
    return null;
  }
}

/**
 * The history-course list (R1) or the run picker (R2) as DonatedRunSummary rows, from either
 * answer shape, with the functions today's list uses:
 * - a Supabase row (with `raw`): normalizeRunSummaryRow, as today;
 * - a D1 row with its summary: listInputsFromSummaryRow, the search facts kept on `search_facts`;
 * - a D1 row with summary_version 0, or a summary the list cannot read: its raw from R3r, then
 *   normalizeRunSummaryRow (design 4.4). One such row never fails the others.
 */
export async function donatedRunsFromListRows(
  rows: readonly RunRow[],
  fetchRaw: RunRawFetcher,
): Promise<DonatedRunSummary[]> {
  const out: DonatedRunSummary[] = new Array(rows.length);
  const pending: number[] = [];
  rows.forEach((row, index) => {
    if (!isSummaryListRow(row)) {
      out[index] = normalizeRunSummaryRow(row);
      return;
    }
    // No usable summary (summary_version 0, or columns the list cannot read): this row only goes the raw way.
    const inputs = summaryInputsOrNull(row as unknown as RunSummaryListRow);
    if (!inputs) {
      pending.push(index);
      return;
    }
    out[index] = inputs.searchFacts ? { ...inputs.summary, search_facts: inputs.searchFacts } : inputs.summary;
  });
  let next = 0;
  const worker = async () => {
    while (next < pending.length) {
      const index = pending[next];
      next += 1;
      const row = rows[index] as Record<string, unknown>;
      out[index] = normalizeRunSummaryRow(rawRowFromSummaryRow(row, await rawOf(fetchRaw, String(row.id))));
    }
  };
  await Promise.all(Array.from({ length: Math.min(RAW_FETCH_CONCURRENCY, pending.length) }, worker));
  return out;
}

/** The cover view row from D1 (R4): the stored cover and what a non-manual one is re-picked from. */
export interface RunSummaryCoverRow {
  id: string;
  cover_spec: unknown;
  list_facts: RunListFacts | null;
  win: boolean;
  ascension: number;
  total_floors: number;
  summary_version: number;
}

/**
 * The combo thumb's cover from an R4 row, picked as getRunCoverSpec picks it from the raw: a manual
 * cover as stored, otherwise pickAlternatingCover on the run, here from list_facts and the phrase
 * columns (summary_version 0: from the raw, R3r).
 */
export async function coverFromSummaryCoverRow(
  runId: string,
  row: RunSummaryCoverRow,
  fetchRaw: RunRawFetcher,
): Promise<CoverSpec | null> {
  const stored = parseCoverSpec(row.cover_spec);
  if (stored?.auto === false) return stored;
  const facts = row.list_facts;
  if (row.summary_version > 0 && isListFacts(facts)) {
    try {
      return pickAlternatingCoverFromFacts(runId, facts, {
        win: row.win,
        totalFloors: row.total_floors,
        ascension: row.ascension,
        relicCount: facts.relic_count,
        deckSize: facts.deck_size,
      });
    } catch {
      // Facts the picker cannot read: pick from the raw below.
    }
  }
  const parsed = parseRunSafely(await rawOf(fetchRaw, runId));
  return parsed ? pickAlternatingCover(runId, parsed) : stored;
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
