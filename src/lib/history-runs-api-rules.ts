/**
 * Columns, limits and id rules of the history-runs group (docs/supabase-exit/STEP1_DESIGN.md 9.6),
 * shared by run-donation.ts and the Worker. No imports: the Worker bundle uses it.
 */

export const RUN_DETAIL_COLUMNS =
  "id,raw,seed,build,character,ascension,win,start_time,run_time,acts_count,cover_spec,created_at";
export const RUN_SUMMARY_COLUMNS =
  "id,raw,seed,build,character,ascension,win,start_time,run_time,acts_count,total_floors,cover_spec,donor_user_id,created_at";

/**
 * One run's raw file as a text/plain body (R3r, docs/supabase-exit/D1_SCHEMA_DESIGN.md 4.4): the
 * detail page and the owner's cover editor read it when the list or detail answer came from D1
 * without the raw. An empty body means the run is not shared in this env.
 */
export const HISTORY_RUN_RAW_PATH = "/api/read/history-run/raw";

export const RECENT_DONATED_RUNS_LIMIT = 100;
export const HISTORY_RUN_REFERENCE_LIMIT = 30;
/** Engagement counts for at most this many run threads per request (the list shows 100). */
export const HISTORY_RUN_ENGAGEMENT_IDS = 100;

const RUN_ID = /^[A-Za-z0-9_-]{1,64}$/;

export function isRunId(value: string): boolean {
  return RUN_ID.test(value);
}

export function parseRunIds(value: string): string[] | null {
  if (!value) return null;
  const ids = value.split(",");
  if (ids.length > HISTORY_RUN_ENGAGEMENT_IDS || new Set(ids).size !== ids.length) return null;
  return ids.every(isRunId) ? ids : null;
}

export type HistoryRunsView = "recent" | "reference";
export type HistoryRunView = "detail" | "meta" | "cover";

export function isHistoryRunsView(value: string): value is HistoryRunsView {
  return value === "recent" || value === "reference";
}

export function isHistoryRunView(value: string): value is HistoryRunView {
  return value === "detail" || value === "meta" || value === "cover";
}
