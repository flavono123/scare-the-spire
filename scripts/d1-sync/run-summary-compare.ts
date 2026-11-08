/**
 * The run summary check of design 9 ("런 요약"): the list inputs a D1 list row gives (summary
 * columns, no raw) must equal the ones today's list builds from the Supabase row and its raw. Shared
 * by the synthetic spec and the backup-driven check.
 */
import { isDeepStrictEqual } from "node:util";
import { rankPopularComboResources } from "../../src/lib/combo-types";
import { postgrestTs } from "../../src/lib/d1-time";
import {
  listInputsFromRawRow,
  listInputsFromSummaryRow,
  listSearchDoc,
  type HistoryRunListInputs,
  type RunSummaryListRow,
} from "../../src/lib/run-list-summary";
import type { RunRow } from "../../src/lib/run-summary-row";
import type { SqliteDb } from "./test-db";

/** What the list shows or searches for one donated run. */
function comparable(inputs: HistoryRunListInputs) {
  const summary = { ...inputs.summary };
  delete summary.raw;
  const doc = listSearchDoc(inputs);
  return {
    // The card: auto cover candidate (or the manual cover), badges, party characters, columns.
    summary,
    // Search phrases and game elements (popular chips come from these resources).
    haystack: doc.haystack,
    resources: doc.resources,
  };
}

/** Differences between today's list inputs (raw) and the D1 ones (summary), by field. */
export function compareListInputs(rawRow: RunRow, summaryRow: RunSummaryListRow): string[] {
  const today = comparable(listInputsFromRawRow(rawRow));
  const d1 = comparable(listInputsFromSummaryRow(summaryRow));
  const diffs: string[] = [];
  const fields = new Set([...Object.keys(today.summary), ...Object.keys(d1.summary)]);
  for (const field of fields) {
    const a = (today.summary as Record<string, unknown>)[field];
    const b = (d1.summary as Record<string, unknown>)[field];
    if (!isDeepStrictEqual(a, b)) diffs.push(`summary.${field}`);
  }
  if (today.haystack !== d1.haystack) diffs.push("search.haystack");
  if (!isDeepStrictEqual(today.resources, d1.resources)) diffs.push("search.resources");
  return diffs;
}

/** The popular-element chips of a list (ComboGameElementFilter ranks every run's resources). */
export function popularElements(inputs: HistoryRunListInputs[], limit = Number.MAX_SAFE_INTEGER) {
  return rankPopularComboResources(inputs.map((item) => ({ resources: listSearchDoc(item).resources })), limit);
}

export function popularElementsMatch(rawRows: RunRow[], summaryRows: RunSummaryListRow[]): boolean {
  const today = popularElements(rawRows.map(listInputsFromRawRow));
  const d1 = popularElements(summaryRows.map(listInputsFromSummaryRow));
  return isDeepStrictEqual(today, d1);
}

const LIST_COLUMNS =
  "p.id, h.seed, h.build, h.\"character\", h.characters, h.ascension, h.win, h.start_time, h.run_time, h.acts_count, " +
  "h.total_floors, h.badges, h.cover_spec, h.game_mode, h.game_elements, h.list_facts, h.summary_version, " +
  "p.user_id AS donor_user_id, p.created_at";

/** R1's row shape for every run of the database (newest first), JSON text columns as stored. */
export function d1ListRows(db: SqliteDb, limit = -1): Array<Record<string, unknown>> {
  return (
    db
      .prepare(
        `SELECT ${LIST_COLUMNS}, coalesce(t.like_count, 0) AS like_count, coalesce(t.comment_count, 0) AS comment_count ` +
          "FROM posts p CROSS JOIN post_history_course h ON h.service = p.service AND h.post_id = p.id " +
          "LEFT JOIN threads t ON t.thread_key = 'history-course:' || p.id " +
          "WHERE p.service = 'history_course' ORDER BY p.created_at DESC, p.id DESC LIMIT ?1",
      )
      .all(limit) as Array<Record<string, unknown>>
  ).map((row) => ({ ...row }));
}

function parseJson(value: unknown): unknown {
  return typeof value === "string" ? JSON.parse(value) : value;
}

/** A stored R1 row as the D1 adapter answers it: JSON columns as JSON, 0/1 as booleans, PostgREST times. */
export function summaryRowFromD1(row: Record<string, unknown>): RunSummaryListRow {
  return {
    id: String(row.id),
    seed: String(row.seed),
    build: String(row.build),
    character: String(row.character),
    ascension: Number(row.ascension),
    win: row.win === 1,
    start_time: row.start_time === null ? null : Number(row.start_time),
    run_time: row.run_time === null ? null : Number(row.run_time),
    acts_count: Number(row.acts_count),
    total_floors: Number(row.total_floors),
    cover_spec: parseJson(row.cover_spec),
    donor_user_id: row.donor_user_id === null ? null : String(row.donor_user_id),
    created_at: postgrestTs(row.created_at) ?? String(row.created_at),
    characters: parseJson(row.characters) as RunSummaryListRow["characters"],
    game_mode: row.game_mode === null ? null : String(row.game_mode),
    game_elements: parseJson(row.game_elements) as RunSummaryListRow["game_elements"],
    list_facts: parseJson(row.list_facts) as RunSummaryListRow["list_facts"],
    badges: parseJson(row.badges) as RunSummaryListRow["badges"],
    summary_version: Number(row.summary_version),
  };
}

/** The 100-row list answer as the adapter would send it (JSON columns embedded), in bytes. */
export function listAnswerBytes(rows: Array<Record<string, unknown>>): number {
  const body = rows.map((row) => ({
    ...row,
    win: row.win === 1,
    created_at: postgrestTs(row.created_at),
    characters: parseJson(row.characters),
    badges: parseJson(row.badges),
    cover_spec: parseJson(row.cover_spec),
    game_elements: parseJson(row.game_elements),
    list_facts: parseJson(row.list_facts),
  }));
  return new TextEncoder().encode(JSON.stringify(body)).length;
}
