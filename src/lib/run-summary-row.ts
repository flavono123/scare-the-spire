/**
 * The list and detail rows of donated runs, normalized the way the History Course reads them
 * (moved out of run-donation.ts unchanged so Node scripts can use them without the Supabase client).
 */
import { buildRunHighlights, type RunHighlightResource } from "./run-highlights";
import { pickAlternatingCover } from "./run-cover-suggest";
import { isCoverSpec, type CoverSpec } from "./run-cover-types";
import { parseReplayRun, type ReplayBadge, type ReplayRun } from "./sts2-run-replay";
import { mergePartyBadges, partyCharacters } from "./history-party";
import type { PostBlock } from "./chemical-types";
import type { HistoryCourseRunSearchFacts } from "./history-course-search";

export interface DonatedRun {
  id: string;
  raw: string;
  seed: string;
  build: string;
  character: string;
  ascension: number;
  win: boolean;
  start_time: number | null;
  run_time: number | null;
  acts_count: number;
  badges: ReplayBadge[];
  highlight_card: RunHighlightResource | null;
  highlight_relic: RunHighlightResource | null;
  note_blocks: PostBlock[] | null;
  cover_spec: CoverSpec | null;
  created_at: string;
}

export interface DonatedRunSummary {
  id: string;
  seed: string;
  build: string;
  character: string;
  /** Present when listing still has raw and can parse the party. */
  characters?: string[];
  ascension: number;
  win: boolean;
  start_time: number | null;
  run_time: number | null;
  acts_count: number;
  // Total floors visited across all acts. Pre-extracted at insert
  // time so the listing query doesn't have to parse the raw JSON.
  total_floors: number;
  badges: ReplayBadge[];
  highlight_card: RunHighlightResource | null;
  highlight_relic: RunHighlightResource | null;
  note_blocks: PostBlock[] | null;
  cover_spec: CoverSpec | null;
  /** Present on gallery listings that still select raw for cover backfill. */
  raw?: string | null;
  /**
   * A list row answered from D1 with its summary columns and no raw (docs/supabase-exit/
   * D1_SCHEMA_DESIGN.md 4.4): what the search reads from the run, built from those columns. The
   * owner's cover editor then reads the raw from R3r.
   */
  search_facts?: HistoryCourseRunSearchFacts;
  donor_user_id: string | null;
  created_at: string;
}

export function totalFloorsFromRun(run: ReplayRun): number {
  let total = 0;
  for (const act of run.map_point_history) total += act.length;
  return total;
}

export function parseCoverSpec(value: unknown): CoverSpec | null {
  return isCoverSpec(value) ? value : null;
}

export type RunRow = Partial<DonatedRunSummary & DonatedRun> & {
  raw?: string | null;
  cover_spec?: unknown;
};

/**
 * True for a run row answered from D1 (list R1, picker R2, cover R4): summary columns in place of
 * the raw. A row from Supabase always carries `raw`.
 */
export function isSummaryListRow(row: object): boolean {
  return "summary_version" in row && !("raw" in row);
}

export function parseRunSafely(raw: string | null | undefined): ReplayRun | null {
  if (!raw) return null;
  try {
    return parseReplayRun(raw);
  } catch {
    return null;
  }
}

export function normalizeRunRow(row: RunRow, runId: string): DonatedRun {
  const parsedRun = parseRunSafely(row.raw);
  const highlights = parsedRun ? buildRunHighlights(parsedRun, runId) : null;
  const storedCover = parseCoverSpec(row.cover_spec);
  // Auto covers re-pick A/B on read so both variants show in the index.
  const cover_spec =
    storedCover?.auto === false
      ? storedCover
      : parsedRun
        ? pickAlternatingCover(runId, parsedRun)
        : storedCover;
  return {
    id: row.id ?? runId,
    raw: row.raw ?? "",
    seed: row.seed ?? parsedRun?.seed ?? "",
    build: row.build ?? parsedRun?.build_id ?? "",
    character: row.character ?? parsedRun?.players[0]?.character ?? "",
    ascension: row.ascension ?? parsedRun?.ascension ?? 0,
    win: row.win ?? parsedRun?.win ?? false,
    start_time: row.start_time ?? parsedRun?.start_time ?? null,
    run_time: row.run_time ?? parsedRun?.run_time ?? null,
    acts_count: row.acts_count ?? parsedRun?.acts.length ?? 0,
    badges: parsedRun ? mergePartyBadges(parsedRun) : (row.badges ?? []),
    highlight_card: row.highlight_card ?? highlights?.card ?? null,
    highlight_relic: row.highlight_relic ?? highlights?.relic ?? null,
    note_blocks: row.note_blocks ?? null,
    cover_spec,
    created_at: row.created_at ?? new Date(0).toISOString(),
  };
}

export function normalizeRunSummaryRow(row: RunRow): DonatedRunSummary {
  const runId = row.id ?? "";
  const normalized = normalizeRunRow(row, runId);
  const parsedRun = parseRunSafely(row.raw);
  return {
    ...normalized,
    characters: parsedRun ? partyCharacters(parsedRun) : [normalized.character],
    total_floors: row.total_floors ?? (parsedRun ? totalFloorsFromRun(parsedRun) : 0),
    raw: row.raw ?? null,
    donor_user_id: row.donor_user_id ?? null,
  };
}
