import { isHistoryRunsView, isHistoryRunView, isRunId, parseRunIds } from "../../../src/lib/history-runs-api-rules";
import { Q_R1, Q_R2, Q_R3, Q_R3r, Q_R4, Q_R5, Q_R6, Q_R7 } from "./queries";
import { AdapterInputError, bool, json, jsonList, query, readAll, TextBody, ts, type AdapterContext, type Row } from "./rows";

/**
 * D1 adapters of the history-runs group (design 4.4, 6). The list (R1) and the picker (R2) answer
 * summary columns in place of the raw run file; detail (R3) and cover (R4) answer their columns
 * without the raw, which has its own route (R3r, a text/plain body). JSON columns stay unparsed (RawJson).
 */

/** The list and picker row: step-1 RUN_SUMMARY_COLUMNS without raw, then the summary columns. */
function summaryRow(row: Row): Row {
  const out: Row = {
    id: row.id,
    seed: row.seed,
    build: row.build,
    character: row.character,
    ascension: row.ascension,
    win: bool(row.win),
    start_time: row.start_time ?? null,
    run_time: row.run_time ?? null,
    acts_count: row.acts_count,
    total_floors: row.total_floors,
    cover_spec: json(row.cover_spec),
    donor_user_id: row.donor_user_id ?? null,
    created_at: ts(row.created_at),
    characters: json(row.characters),
    badges: json(row.badges),
    game_mode: row.game_mode ?? null,
    game_elements: json(row.game_elements),
    list_facts: json(row.list_facts),
    summary_version: row.summary_version,
  };
  if ("like_count" in row) {
    out.like_count = row.like_count;
    out.comment_count = row.comment_count;
  }
  return out;
}

/** read.history-runs: view=recent (R1, 100 by created_at) or view=reference (R2, 30 by start_time). */
export async function historyRunsAdapter(context: AdapterContext): Promise<Row[]> {
  const view = context.url.searchParams.get("view") ?? "";
  if (!isHistoryRunsView(view)) throw new AdapterInputError("view");
  const [rows] = await readAll(context.db, [query(view === "recent" ? Q_R1 : Q_R2)]);
  return rows.map(summaryRow);
}

/** read.history-run: view=detail (R3), cover (R4) or meta (R5, the step-1 `{v, env, rows}` body). */
export async function historyRunAdapter(context: AdapterContext): Promise<unknown> {
  const id = context.url.searchParams.get("id") ?? "";
  const view = context.url.searchParams.get("view") ?? "detail";
  if (!isRunId(id) || !isHistoryRunView(view)) throw new AdapterInputError("id or view");
  if (view === "meta") {
    const [rows] = await readAll(context.db, [query(Q_R5, id)]);
    return {
      v: 1,
      env: context.dataEnv,
      rows: rows.map((row) => ({ id: row.id, character: row.character, cover_spec: json(row.cover_spec) })),
    };
  }
  if (view === "cover") {
    const [rows] = await readAll(context.db, [query(Q_R4, id)]);
    // The stored cover, then what a non-manual cover is re-picked from (list facts and phrase facts).
    return rows.map((row) => ({
      id: row.id,
      cover_spec: json(row.cover_spec),
      list_facts: json(row.list_facts),
      win: bool(row.win),
      ascension: row.ascension,
      total_floors: row.total_floors,
      summary_version: row.summary_version,
    }));
  }
  const [rows] = await readAll(context.db, [query(Q_R3, id)]);
  return rows.map((row) => ({
    id: row.id,
    seed: row.seed,
    build: row.build,
    character: row.character,
    ascension: row.ascension,
    win: bool(row.win),
    start_time: row.start_time ?? null,
    run_time: row.run_time ?? null,
    acts_count: row.acts_count,
    cover_spec: json(row.cover_spec),
    created_at: ts(row.created_at),
  }));
}

/** read.history-run.raw (R3r): the stored raw file as the body; empty when the run is not in this D1. */
export async function historyRunRawAdapter(context: AdapterContext): Promise<TextBody> {
  const id = context.url.searchParams.get("id") ?? "";
  if (!isRunId(id)) throw new AdapterInputError("id");
  const [rows] = await readAll(context.db, [query(Q_R3r, id)]);
  const raw = rows[0]?.raw;
  return new TextBody(typeof raw === "string" ? raw : "");
}

/** read.history-runs.engagement: like and comment counts of the listed runs (runs with none left out). */
export async function historyRunsEngagementAdapter(context: AdapterContext): Promise<Row> {
  const ids = parseRunIds(context.url.searchParams.get("ids") ?? "");
  if (!ids) throw new AdapterInputError("ids");
  const [rows] = await readAll(context.db, [query(Q_R6, jsonList(ids))]);
  const likes: Record<string, number> = {};
  const comments: Record<string, number> = {};
  const prefix = "history-course:".length;
  for (const row of rows) {
    const id = String(row.thread_key).slice(prefix);
    if (Number(row.like_count) > 0) likes[id] = Number(row.like_count);
    if (Number(row.comment_count) > 0) comments[id] = Number(row.comment_count);
  }
  return { v: 1, env: context.dataEnv, likes, comments };
}

/** me.history-runs: the caller's run ids (or whether one id is theirs). */
export async function myHistoryRunsAdapter(context: AdapterContext): Promise<Row> {
  if (!context.userId) throw new AdapterInputError("user");
  const id = context.url.searchParams.get("id");
  if (id !== null && !isRunId(id)) throw new AdapterInputError("id");
  const [rows] = await readAll(context.db, [query(Q_R7, context.userId)]);
  const ids = rows.map((row) => String(row.id)).filter((runId) => id === null || runId === id);
  return { v: 1, env: context.dataEnv, ids };
}
