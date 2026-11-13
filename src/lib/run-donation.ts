import { ApiError, apiFetch, requireApiVersion } from "./api-client";
import { apiFetchAsUser } from "./api-session";
import { dataEnv } from "./data-env";
import {
  HISTORY_RUN_RAW_PATH,
  isRunId,
  RUN_SUMMARY_CLIENT_HEADER,
} from "./history-runs-api-rules";
import { buildRunHighlights } from "./run-highlights";
import { duplicateShareShouldUpdateCover } from "./history-course-share-state";
import { pickAlternatingCover, suggestDefaultCover } from "./run-cover-suggest";
import type { CoverSpec } from "./run-cover-types";
import type { ReplayRun } from "./sts2-run-replay";
import { readStoredUserProfile } from "./user-profile";
import { mergePartyBadges } from "./history-party";
import {
  isSummaryListRow,
  normalizeRunRow,
  normalizeRunSummaryRow,
  parseCoverSpec,
  parseRunSafely,
  totalFloorsFromRun,
  type DonatedRun,
  type DonatedRunSummary,
  type RunRow,
} from "./run-summary-row";

export type { DonatedRun, DonatedRunSummary } from "./run-summary-row";

function parsedMetaFromRun(run: ReplayRun, runId: string) {
  const highlights = buildRunHighlights(run, runId);
  return {
    seed: run.seed,
    build: run.build_id,
    character: run.players[0]?.character ?? "",
    ascension: run.ascension,
    win: run.win,
    start_time: run.start_time ?? null,
    run_time: run.run_time ?? null,
    acts_count: run.acts.length,
    total_floors: totalFloorsFromRun(run),
    badges: mergePartyBadges(run),
    highlight_card: highlights.card,
    highlight_relic: highlights.relic,
    note_blocks: null,
    cover_spec: suggestDefaultCover(runId, run),
  };
}

// Every read and write goes through the Worker (docs/supabase-exit/STEP1_DESIGN.md 9.6), in this
// bundle's data env only. A run id outside the api rule (isRunId) is never sent: no shared run has
// one (docs/supabase-exit/STEP6_PLAN.md 2, P14), so those calls answer "not shared" without a request,
// as the direct Supabase read used to.

type RowsBody = { v?: number; rows?: unknown };

/**
 * Rows from a Worker read. Views with raw run files are PostgREST's array passed through as is
 * (Supabase source); `meta` and the D1 answers are `{ v, env, rows }`. Any other shape, and a
 * Worker that sends the group back, is an error (api-client's ApiUnavailableError).
 */
async function apiRunRows(path: string): Promise<RunRow[]> {
  // This client reads the D1 answers too (summary rows, no raw): say so (RUN_SUMMARY_CLIENT_HEADER).
  const body = await apiFetch<RowsBody | RunRow[]>("history-runs", path, {
    timeoutMs: 20_000,
    headers: { [RUN_SUMMARY_CLIENT_HEADER]: "1" },
  });
  if (Array.isArray(body)) return body;
  requireApiVersion("history-runs", body);
  if (!Array.isArray(body.rows)) throw new Error("bad history-runs answer");
  return body.rows as RunRow[];
}

/**
 * One run's raw file (R3r, docs/supabase-exit/D1_SCHEMA_DESIGN.md 4.4) for an answer that came from
 * D1 without it: the detail page, the owner's cover editor, a list row without a summary. The api
 * route's text/plain body as is; null when the run is not shared in this env.
 */
async function fetchDonatedRunRaw(runId: string): Promise<string | null> {
  if (!isRunId(runId)) return null;
  const text = await apiFetch<string>("history-runs", `${HISTORY_RUN_RAW_PATH}?id=${encodeURIComponent(runId)}`, {
    timeoutMs: 20_000,
    responseType: "text",
  });
  return text || null;
}

/** The raw file of a shared run, for the owner's cover editor when the list row has none. */
export async function getDonatedRunRaw(runId: string): Promise<string | null> {
  if (!runId) return null;
  return fetchDonatedRunRaw(runId);
}

/**
 * List and picker rows: a Supabase answer goes through normalizeRunSummaryRow as it always has;
 * a D1 answer (summary columns, no raw) through donatedRunsFromListRows (design 4.4).
 */
async function donatedRunSummaries(rows: RunRow[]): Promise<DonatedRunSummary[]> {
  if (!rows.some(isSummaryListRow)) return rows.map(normalizeRunSummaryRow);
  const { donatedRunsFromListRows } = await import("./run-list-summary");
  return donatedRunsFromListRows(rows, fetchDonatedRunRaw);
}

/** An error shaped like PostgREST's, so callers keep checking `code` (23505 = already shared). */
function apiWriteError(error: unknown): { code?: string; message: string } {
  if (error instanceof ApiError) {
    return error.code === "duplicate" ? { code: "23505", message: "duplicate" } : { message: error.code };
  }
  return { message: error instanceof Error ? error.message : "request failed" };
}

/** 409 from the step 5 D1 source: runs are shared one per request (design 4.4). */
const SINGLE_RUN_REQUIRED = "single_run_required";

function singleRunRequired(error: unknown): boolean {
  return error instanceof ApiError && error.status === 409 && error.code === SINGLE_RUN_REQUIRED;
}

/**
 * One run to /api/write/history-runs/share: `[<row>,<raw>]`, the row's length in a header so the
 * Worker parses only the row, with the list summary computed here (docs/supabase-exit/D1_SCHEMA_DESIGN.md
 * 4.4, 10.2). Resolves true when this request shared it, false when it was already shared.
 */
async function shareOneRun(row: Record<string, unknown>): Promise<boolean> {
  const { raw, ...meta } = row as Record<string, unknown> & { raw: string };
  const { extractRunListSummary } = await import("./run-list-summary");
  let summary: Record<string, unknown> = {};
  try {
    const extracted = extractRunListSummary(String(meta.id), raw);
    summary = {
      characters: extracted.characters,
      game_mode: extracted.game_mode,
      game_elements: extracted.game_elements,
      list_facts: extracted.list_facts,
      badges: extracted.badges,
      summary_version: extracted.summary_version,
    };
  } catch {
    // An unparsable raw keeps summary_version 0; the fill job and the list handle it (design 4.4).
  }
  const rowText = JSON.stringify({ ...meta, ...summary });
  const body = await apiFetchAsUser<{ v?: number; inserted?: string[] }>("history-runs", "/api/write/history-runs/share", {
    method: "POST",
    rawBody: `[${rowText},${raw}]`,
    headers: { "X-Slseoun-Row-Length": String(rowText.length) },
    timeoutMs: 30_000,
  });
  return Array.isArray(body?.inserted) && body.inserted.length > 0;
}

/** The batch on the D1 source: one run per request, two at a time, counted as the batch answer. */
async function shareRunsOneByOne(rows: Record<string, unknown>[]): Promise<DonateBatchResult> {
  const result: DonateBatchResult = { inserted: 0, alreadyDonated: 0, failed: 0 };
  let next = 0;
  const worker = async () => {
    while (next < rows.length) {
      const row = rows[next];
      next += 1;
      try {
        if (await shareOneRun(row)) result.inserted += 1;
        else result.alreadyDonated += 1;
      } catch (error) {
        result.failed += 1;
        result.errorMessage = apiWriteError(error).message;
      }
    }
  };
  await Promise.all([worker(), worker()]);
  return result;
}

async function insertDonatedRunRow(row: Record<string, unknown>): Promise<{ error: { code?: string; message?: string } | null }> {
  try {
    await apiFetchAsUser("history-runs", "/api/write/history-runs", { method: "POST", body: row, timeoutMs: 30_000 });
    return { error: null };
  } catch (error) {
    if (singleRunRequired(error)) {
      try {
        return (await shareOneRun(row)) ? { error: null } : { error: { code: "23505", message: "duplicate" } };
      } catch (shareError) {
        return { error: apiWriteError(shareError) };
      }
    }
    return { error: apiWriteError(error) };
  }
}

export async function donateRun(input: {
  runId: string;
  raw: string;
  run: ReplayRun;
  donorUserId: string;
  coverSpec?: CoverSpec | null;
}): Promise<{ ok: true } | { ok: false; alreadyDonated: boolean; message: string }> {
  const meta = parsedMetaFromRun(input.run, input.runId);
  if (input.coverSpec) meta.cover_spec = input.coverSpec;
  const { error } = await insertDonatedRunRow({
    id: input.runId,
    raw: input.raw,
    donor_user_id: input.donorUserId,
    donor_nickname: readStoredUserProfile().nickname,
    env: dataEnv,
    ...meta,
  });
  if (!error) return { ok: true };
  // 23505 = unique_violation. The row may have been donated already
  // (by anyone). A manual cover still has to land on that row: the
  // index can show the run as unshared after share-on-upload, and the
  // follow-up click used to stop at the conflict.
  const alreadyDonated = "code" in error && error.code === "23505";
  if (alreadyDonated && duplicateShareShouldUpdateCover(input.coverSpec)) {
    const updated = await updateDonatedRunCoverSpec({
      runId: input.runId,
      donorUserId: input.donorUserId,
      coverSpec: input.coverSpec,
    });
    if (updated.ok) return { ok: true };
  }
  return {
    ok: false,
    alreadyDonated,
    message: alreadyDonated ? "이미 공유된 런입니다." : (error.message ?? "공유에 실패했습니다."),
  };
}

export interface DonateBatchResult {
  inserted: number;
  alreadyDonated: number;
  failed: number;
  errorMessage?: string;
}

// One round-trip donation for a batch of runs. The 'upload + tick
// share' path used to fire 42 sequential inserts and lost ~30 to
// auth race + rate limiting; this collapses the whole batch into a
// single request. Already-donated rows pass through without aborting
// siblings.
export async function donateRunsBatch(input: {
  runs: Array<{
    runId: string;
    raw: string;
    run: ReplayRun;
    coverSpec?: CoverSpec | null;
  }>;
  donorUserId: string;
}): Promise<DonateBatchResult> {
  if (input.runs.length === 0) {
    return { inserted: 0, alreadyDonated: 0, failed: 0 };
  }
  const rows = input.runs.map((r) => {
    const meta = parsedMetaFromRun(r.run, r.runId);
    if (r.coverSpec) meta.cover_spec = r.coverSpec;
    return {
      id: r.runId,
      raw: r.raw,
      donor_user_id: input.donorUserId,
      donor_nickname: readStoredUserProfile().nickname,
      env: dataEnv,
      ...meta,
    };
  });
  try {
    const body = await apiFetchAsUser<{ v?: number; inserted?: string[] }>(
      "history-runs",
      "/api/write/history-runs/batch",
      { method: "POST", body: rows, timeoutMs: 30_000 },
    );
    // The batch answer lists only the newly shared ids; the rest were already shared (by anyone).
    const inserted = Array.isArray(body?.inserted) ? body.inserted.length : 0;
    return { inserted, alreadyDonated: input.runs.length - inserted, failed: 0 };
  } catch (error) {
    if (singleRunRequired(error)) return shareRunsOneByOne(rows);
    return { inserted: 0, alreadyDonated: 0, failed: input.runs.length, errorMessage: apiWriteError(error).message };
  }
}

export async function getDonatedRun(runId: string): Promise<DonatedRun | null> {
  if (!isRunId(runId)) return null;
  try {
    const rows = await apiRunRows(`/api/read/history-run?id=${encodeURIComponent(runId)}&view=detail`);
    const row = rows[0];
    if (!row) return null;
    // A D1 answer carries the detail columns without the raw: read it from R3r.
    const raw = "raw" in row ? row.raw : await fetchDonatedRunRaw(runId);
    return normalizeRunRow({ ...row, raw: raw ?? undefined }, runId);
  } catch {
    return null;
  }
}

const NOT_UPDATED_MESSAGE = "수정 권한이 없거나 대상 런을 찾을 수 없습니다.";

/**
 * Persist a custom cover for a donated run. The Worker updates it only for the donor of record,
 * taken from the visitor's identity cookie; `donorUserId` is the same user, kept for callers.
 */
export async function updateDonatedRunCoverSpec(input: {
  runId: string;
  donorUserId: string;
  coverSpec: CoverSpec;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!isRunId(input.runId)) return { ok: false, message: NOT_UPDATED_MESSAGE };
  try {
    const body = await apiFetchAsUser<{ v?: number; updated?: boolean; reason?: string }>(
      "history-runs",
      `/api/write/history-runs/cover?id=${encodeURIComponent(input.runId)}`,
      { method: "PATCH", body: { coverSpec: input.coverSpec } },
    );
    return body?.updated ? { ok: true } : { ok: false, message: NOT_UPDATED_MESSAGE };
  } catch (error) {
    return { ok: false, message: apiWriteError(error).message };
  }
}

/** OG/metadata fields only — no raw parse, one small row select. */
export async function getDonatedRunOgFields(runId: string): Promise<{
  character: string;
  coverSpec: CoverSpec | null;
} | null> {
  if (!runId || !isRunId(runId)) return null;
  try {
    const rows = await apiRunRows(`/api/read/history-run?id=${encodeURIComponent(runId)}&view=meta`);
    const row = rows[0];
    if (!row) return null;
    return { character: String(row.character ?? ""), coverSpec: parseCoverSpec(row.cover_spec) };
  } catch {
    return null;
  }
}

/** Light cover lookup for combo list thumbs when snapshot omitted coverSpec. */
export async function getRunCoverSpec(runId: string): Promise<CoverSpec | null> {
  if (!runId || !isRunId(runId)) return null;
  try {
    const rows = await apiRunRows(`/api/read/history-run?id=${encodeURIComponent(runId)}&view=cover`);
    const row = rows[0];
    if (!row) return null;
    if (isSummaryListRow(row)) {
      // A D1 cover row: list facts and phrase columns in place of the raw (R4).
      const { coverFromSummaryCoverRow } = await import("./run-list-summary");
      return coverFromSummaryCoverRow(runId, row as unknown as Parameters<typeof coverFromSummaryCoverRow>[1], fetchDonatedRunRaw);
    }
    const stored = parseCoverSpec(row.cover_spec);
    if (stored?.auto === false) return stored;
    const parsed = parseRunSafely(row.raw);
    return parsed ? pickAlternatingCover(runId, parsed) : stored;
  } catch {
    return null;
  }
}

export async function isRunDonated(runId: string): Promise<boolean> {
  if (!isRunId(runId)) return false;
  try {
    const rows = await apiRunRows(`/api/read/history-run?id=${encodeURIComponent(runId)}&view=meta`);
    return rows.length > 0;
  } catch {
    return false;
  }
}

// True only if the visitor (userId) is the donor on record. Used to
// gate the "공유 취소" button — the Worker already enforces donor-only
// delete, so this is purely UI affordance.
export async function isOwnDonation(
  runId: string,
  userId: string,
): Promise<boolean> {
  if (!userId || !isRunId(runId)) return false;
  try {
    // The donor is the identity cookie's user, never an id the page passes.
    const body = await apiFetchAsUser<{ v?: number; ids?: string[] }>(
      "history-runs",
      `/api/me/history-runs?id=${encodeURIComponent(runId)}`,
    );
    return Array.isArray(body?.ids) && body.ids.includes(runId);
  } catch {
    return false;
  }
}

// All runIds that the visitor has donated. One query, used to mark
// 내 런 cards as already-shared so we can render '공유 취소' instead
// of '공유'.
export async function listMyDonatedRunIds(
  userId: string,
): Promise<Set<string>> {
  const ids = new Set<string>();
  if (!userId) return ids;
  try {
    const body = await apiFetchAsUser<{ v?: number; ids?: string[] }>("history-runs", "/api/me/history-runs");
    for (const id of body?.ids ?? []) ids.add(id);
  } catch {
    // A failed read leaves the cards on the unshared action, as before.
  }
  return ids;
}

export async function syncDonatedRunNicknames(userId: string): Promise<void> {
  if (!userId) return;
  const nickname = readStoredUserProfile().nickname;
  try {
    await apiFetchAsUser("history-runs", "/api/write/history-runs/nicknames", { method: "POST", body: { nickname } });
  } catch {
    // Best effort, as before: the next visit tries again.
  }
}

export async function listRecentDonatedRuns(): Promise<DonatedRunSummary[]> {
  // From Supabase the Worker streams the rows (raw run files, about 8 MB) without parsing them;
  // from D1 they carry the summary columns instead of the raw (about 0.6 MB). Errors reach the caller.
  const rows = await apiRunRows("/api/read/history-runs?view=recent");
  return donatedRunSummaries(rows);
}

/**
 * Bounded metadata-only listing for the Combo reference picker.
 *
 * Unlike the History Course gallery's legacy-compatible query, this never
 * downloads or parses raw run JSON. The picker filters these rows in the
 * browser and only loads them when opened.
 */
export async function listHistoryRunReferences(): Promise<DonatedRunSummary[]> {
  const rows = await apiRunRows("/api/read/history-runs?view=reference");
  return donatedRunSummaries(rows);
}

export async function deleteDonatedRun(runId: string): Promise<boolean> {
  // No shared run has an id outside the rule (P14): the old direct delete matched no row and
  // reported success, which the api delete also does for a run that is not there.
  if (!isRunId(runId)) return true;
  try {
    // Success means "no error", whether or not a row went.
    await apiFetchAsUser("history-runs", `/api/write/history-runs?id=${encodeURIComponent(runId)}`, { method: "DELETE" });
    return true;
  } catch {
    return false;
  }
}
