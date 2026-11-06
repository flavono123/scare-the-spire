import { ApiError, apiFetch, shouldUseLegacy, writeMayGoLegacy } from "./api-client";
import { apiFetchAsUser } from "./api-session";
import {
  HISTORY_RUN_REFERENCE_LIMIT,
  isRunId,
  RECENT_DONATED_RUNS_LIMIT,
  RUN_DETAIL_COLUMNS,
  RUN_DETAIL_COLUMNS_LEGACY,
  RUN_SUMMARY_COLUMNS,
  RUN_SUMMARY_COLUMNS_LEGACY,
} from "./history-runs-api-rules";
import { surfacePath } from "./runtime-flags";
import { supabase, supabaseEnabled, supabaseEnv } from "./supabase";
import { withSupabaseTimeout } from "./supabase-timeout";
import type { PostBlock } from "./chemical-types";
import { devToolsEnabled } from "./dev-tools";
import { buildRunHighlights, type RunHighlightResource } from "./run-highlights";
import { duplicateShareShouldUpdateCover } from "./history-course-share-state";
import { pickAlternatingCover, suggestDefaultCover } from "./run-cover-suggest";
import { isCoverSpec, type CoverSpec } from "./run-cover-types";
import { parseReplayRun, type ReplayBadge, type ReplayRun } from "./sts2-run-replay";
import { readStoredUserProfile } from "./user-profile";
import { mergePartyBadges, partyCharacters } from "./history-party";

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
  donor_user_id: string | null;
  created_at: string;
}

function totalFloorsFromRun(run: ReplayRun): number {
  let total = 0;
  for (const act of run.map_point_history) total += act.length;
  return total;
}

function parseCoverSpec(value: unknown): CoverSpec | null {
  return isCoverSpec(value) ? value : null;
}

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

type RunRow = Partial<DonatedRunSummary & DonatedRun> & {
  raw?: string | null;
  cover_spec?: unknown;
};

// The column lists live in history-runs-api-rules.ts so the Worker reads the same ones.
const LEGACY_RUN_DETAIL_COLUMNS = RUN_DETAIL_COLUMNS_LEGACY;
const COVER_RUN_DETAIL_COLUMNS = RUN_DETAIL_COLUMNS;
const LEGACY_RUN_SUMMARY_COLUMNS = RUN_SUMMARY_COLUMNS_LEGACY;
const COVER_RUN_SUMMARY_COLUMNS = RUN_SUMMARY_COLUMNS;
const HISTORY_REFERENCE_SUMMARY_COLUMNS = RUN_SUMMARY_COLUMNS;
const HISTORY_REFERENCE_SUMMARY_COLUMNS_LEGACY = RUN_SUMMARY_COLUMNS_LEGACY;

/** True when this env's runs go through the Worker (docs/supabase-exit/STEP1_DESIGN.md 9.6). */
function runsViaApi(env: string = supabaseEnv): boolean {
  return env === supabaseEnv && surfacePath("history-runs") === "api";
}

type RowsBody = { v?: number; rows?: unknown };

/** Rows from a Worker read, or "legacy" when the Worker sent this group back. */
async function apiRunRows(path: string): Promise<RunRow[] | "legacy"> {
  try {
    const body = await apiFetch<RowsBody>("history-runs", path, { timeoutMs: 20_000 });
    if (body?.v !== 1 || !Array.isArray(body.rows)) throw new Error("bad history-runs answer");
    return body.rows as RunRow[];
  } catch (error) {
    if (shouldUseLegacy(error)) return "legacy";
    throw error;
  }
}

/** An error shaped like PostgREST's, so callers keep checking `code` (23505 = already shared). */
function apiWriteError(error: unknown): { code?: string; message: string } {
  if (error instanceof ApiError) {
    return error.code === "duplicate" ? { code: "23505", message: "duplicate" } : { message: error.code };
  }
  return { message: error instanceof Error ? error.message : "request failed" };
}

function runReadEnvs(): string[] {
  if (devToolsEnabled() && supabaseEnv !== "production") {
    return [supabaseEnv, "production"];
  }
  return [supabaseEnv];
}

function parseRunSafely(raw: string | null | undefined): ReplayRun | null {
  if (!raw) return null;
  try {
    return parseReplayRun(raw);
  } catch {
    return null;
  }
}

function normalizeRunRow(row: RunRow, runId: string): DonatedRun {
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

function normalizeRunSummaryRow(row: RunRow): DonatedRunSummary {
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

function isMissingCoverSpecColumn(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const message = "message" in error ? String(error.message ?? "") : "";
  return /cover_spec/i.test(message) && /column/i.test(message);
}

function isMissingDonorNicknameColumn(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const message = "message" in error ? String(error.message ?? "") : "";
  return /donor_nickname/i.test(message) && /column/i.test(message);
}

function omitRunColumns(
  row: Record<string, unknown>,
  keys: string[],
): Record<string, unknown> {
  const rest = { ...row };
  for (const key of keys) delete rest[key];
  return rest;
}

async function selectDonatedRunForEnv(
  runId: string,
  env: string,
): Promise<{ data: DonatedRun | null; error: unknown }> {
  if (runsViaApi(env) && isRunId(runId)) {
    try {
      const rows = await apiRunRows(`/api/read/history-run?id=${encodeURIComponent(runId)}&view=detail`);
      if (rows !== "legacy") return { data: rows[0] ? normalizeRunRow(rows[0], runId) : null, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }
  const withCover = await withSupabaseTimeout(
    "runs.select.detail",
    supabase
      .from("runs")
      .select(COVER_RUN_DETAIL_COLUMNS)
      .eq("id", runId)
      .eq("env", env)
      .maybeSingle(),
  ).catch((error) => ({ data: null, error }));

  if (!withCover.error || !isMissingCoverSpecColumn(withCover.error)) {
    return {
      data: withCover.data ? normalizeRunRow(withCover.data as RunRow, runId) : null,
      error: withCover.error ?? null,
    };
  }

  const legacy = await withSupabaseTimeout(
    "runs.select.detail.legacy",
    supabase
      .from("runs")
      .select(LEGACY_RUN_DETAIL_COLUMNS)
      .eq("id", runId)
      .eq("env", env)
      .maybeSingle(),
  ).catch((error) => ({ data: null, error }));

  return {
    data: legacy.data ? normalizeRunRow(legacy.data as RunRow, runId) : null,
    error: legacy.error ?? null,
  };
}

async function selectRecentDonatedRunsForEnv(
  env: string,
): Promise<{ data: DonatedRunSummary[] | null; error: unknown }> {
  if (runsViaApi(env)) {
    try {
      // The Worker streams the rows (raw run files, about 8 MB) without parsing them.
      const rows = await apiRunRows("/api/read/history-runs?view=recent");
      if (rows !== "legacy") return { data: rows.map(normalizeRunSummaryRow), error: null };
    } catch (error) {
      return { data: null, error };
    }
  }
  const withCover = await withSupabaseTimeout(
    "runs.select.recent",
    supabase
      .from("runs")
      .select(COVER_RUN_SUMMARY_COLUMNS)
      .eq("env", env)
      .order("created_at", { ascending: false })
      .limit(RECENT_DONATED_RUNS_LIMIT),
  ).catch((error) => ({ data: null, error }));

  if (!withCover.error || !isMissingCoverSpecColumn(withCover.error)) {
    return {
      data: withCover.data
        ? (withCover.data as RunRow[]).map(normalizeRunSummaryRow)
        : null,
      error: withCover.error ?? null,
    };
  }

  const legacy = await withSupabaseTimeout(
    "runs.select.recent.legacy",
    supabase
      .from("runs")
      .select(LEGACY_RUN_SUMMARY_COLUMNS)
      .eq("env", env)
      .order("created_at", { ascending: false })
      .limit(RECENT_DONATED_RUNS_LIMIT),
  ).catch((error) => ({ data: null, error }));

  return {
    data: legacy.data ? (legacy.data as RunRow[]).map(normalizeRunSummaryRow) : null,
    error: legacy.error ?? null,
  };
}

async function selectHistoryRunReferencesForEnv(
  env: string,
): Promise<{ data: DonatedRunSummary[] | null; error: unknown }> {
  if (runsViaApi(env)) {
    try {
      const rows = await apiRunRows("/api/read/history-runs?view=reference");
      if (rows !== "legacy") return { data: rows.map(normalizeRunSummaryRow), error: null };
    } catch (error) {
      return { data: null, error };
    }
  }
  const withCover = await withSupabaseTimeout(
    "runs.select.history-references",
    supabase
      .from("runs")
      .select(HISTORY_REFERENCE_SUMMARY_COLUMNS)
      .eq("env", env)
      .order("start_time", { ascending: false })
      .limit(HISTORY_RUN_REFERENCE_LIMIT),
  ).catch((error) => ({ data: null, error }));

  if (!withCover.error || !isMissingCoverSpecColumn(withCover.error)) {
    return {
      data: withCover.data
        ? (withCover.data as RunRow[]).map(normalizeRunSummaryRow)
        : null,
      error: withCover.error ?? null,
    };
  }

  const result = await withSupabaseTimeout(
    "runs.select.history-references.legacy",
    supabase
      .from("runs")
      .select(HISTORY_REFERENCE_SUMMARY_COLUMNS_LEGACY)
      .eq("env", env)
      .order("start_time", { ascending: false })
      .limit(HISTORY_RUN_REFERENCE_LIMIT),
  ).catch((error) => ({ data: null, error }));

  return {
    data: result.data
      ? (result.data as RunRow[]).map(normalizeRunSummaryRow)
      : null,
    error: result.error ?? null,
  };
}

async function insertDonatedRunRow(row: Record<string, unknown>): Promise<{ error: { code?: string; message?: string } | null }> {
  if (runsViaApi()) {
    try {
      await apiFetchAsUser("history-runs", "/api/write/history-runs", { method: "POST", body: row, timeoutMs: 30_000 });
      return { error: null };
    } catch (error) {
      if (!writeMayGoLegacy(error)) return { error: apiWriteError(error) };
    }
  }
  const first = await withSupabaseTimeout(
    "runs.insert",
    supabase.from("runs").insert(row),
  ).catch(() => ({ error: new Error("timeout") }));
  if (first.error && isMissingDonorNicknameColumn(first.error)) {
    return insertDonatedRunRow(omitRunColumns(row, ["donor_nickname"]));
  }
  if (!first.error || !isMissingCoverSpecColumn(first.error)) return first;
  const legacyRow = omitRunColumns(row, ["cover_spec"]);
  return withSupabaseTimeout(
    "runs.insert.legacy",
    supabase.from("runs").insert(legacyRow),
  ).catch(() => ({ error: new Error("timeout") }));
}

export async function donateRun(input: {
  runId: string;
  raw: string;
  run: ReplayRun;
  donorUserId: string;
  coverSpec?: CoverSpec | null;
}): Promise<{ ok: true } | { ok: false; alreadyDonated: boolean; message: string }> {
  if (!supabaseEnabled) {
    return { ok: false, alreadyDonated: false, message: "Supabase 연결이 설정되지 않았습니다." };
  }
  const meta = parsedMetaFromRun(input.run, input.runId);
  if (input.coverSpec) meta.cover_spec = input.coverSpec;
  const { error } = await insertDonatedRunRow({
    id: input.runId,
    raw: input.raw,
    donor_user_id: input.donorUserId,
    donor_nickname: readStoredUserProfile().nickname,
    env: supabaseEnv,
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
// single upsert. ignoreDuplicates lets already-donated rows pass
// through without aborting siblings.
export async function donateRunsBatch(input: {
  runs: Array<{
    runId: string;
    raw: string;
    run: ReplayRun;
    coverSpec?: CoverSpec | null;
  }>;
  donorUserId: string;
}): Promise<DonateBatchResult> {
  if (!supabaseEnabled) {
    return {
      inserted: 0,
      alreadyDonated: 0,
      failed: input.runs.length,
      errorMessage: "Supabase 연결이 설정되지 않았습니다.",
    };
  }
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
      env: supabaseEnv,
      ...meta,
    };
  });
  if (runsViaApi()) {
    try {
      const body = await apiFetchAsUser<{ v?: number; inserted?: string[] }>(
        "history-runs",
        "/api/write/history-runs/batch",
        { method: "POST", body: rows, timeoutMs: 30_000 },
      );
      const inserted = Array.isArray(body?.inserted) ? body.inserted.length : 0;
      return { inserted, alreadyDonated: input.runs.length - inserted, failed: 0 };
    } catch (error) {
      if (!writeMayGoLegacy(error)) {
        return { inserted: 0, alreadyDonated: 0, failed: input.runs.length, errorMessage: apiWriteError(error).message };
      }
    }
  }
  // onConflict spans (id, env) — the composite PK after migration-009.
  // Same content-addressable runId in a different env is a fresh row;
  // only same id + same env is treated as a duplicate.
  let result = await withSupabaseTimeout(
    "runs.upsert",
    supabase
      .from("runs")
      .upsert(rows, { onConflict: "id,env", ignoreDuplicates: true })
      .select("id"),
  ).catch(() => ({ data: null, error: new Error("timeout") }));

  if (result.error && isMissingDonorNicknameColumn(result.error)) {
    const stripped = rows.map((row) => omitRunColumns(row, ["donor_nickname"]));
    result = await withSupabaseTimeout(
      "runs.upsert.legacy-nickname",
      supabase
        .from("runs")
        .upsert(stripped, { onConflict: "id,env", ignoreDuplicates: true })
        .select("id"),
    ).catch(() => ({ data: null, error: new Error("timeout") }));
  }

  if (result.error && isMissingCoverSpecColumn(result.error)) {
    const legacyRows = rows.map((row) => omitRunColumns(row, ["cover_spec", "donor_nickname"]));
    result = await withSupabaseTimeout(
      "runs.upsert.legacy",
      supabase
        .from("runs")
        .upsert(legacyRows, { onConflict: "id,env", ignoreDuplicates: true })
        .select("id"),
    ).catch(() => ({ data: null, error: new Error("timeout") }));
  }

  if (result.error) {
    const message =
      result.error instanceof Error
        ? result.error.message
        : typeof result.error === "object" &&
            result.error &&
            "message" in result.error
          ? String((result.error as { message?: unknown }).message ?? "upsert failed")
          : "upsert failed";
    return {
      inserted: 0,
      alreadyDonated: 0,
      failed: input.runs.length,
      errorMessage: message,
    };
  }
  // upsert with ignoreDuplicates returns ONLY the newly-inserted rows
  // — anything that conflicted on `id` is silently skipped. We treat
  // those as 'already donated' (by this user or anyone).
  const inserted = result.data?.length ?? 0;
  return {
    inserted,
    alreadyDonated: input.runs.length - inserted,
    failed: 0,
  };
}

export async function getDonatedRun(runId: string): Promise<DonatedRun | null> {
  if (!supabaseEnabled) return null;
  for (const env of runReadEnvs()) {
    const { data, error } = await selectDonatedRunForEnv(runId, env);
    if (data) return data;
    if (error) return null;
  }
  return null;
}

/** Persist a custom cover for a donated run (donor-only via RLS). */
export async function updateDonatedRunCoverSpec(input: {
  runId: string;
  donorUserId: string;
  coverSpec: CoverSpec;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!supabaseEnabled) {
    return { ok: false, message: "Supabase 연결이 설정되지 않았습니다." };
  }
  if (runsViaApi() && isRunId(input.runId)) {
    try {
      const body = await apiFetchAsUser<{ v?: number; updated?: boolean; reason?: string }>(
        "history-runs",
        `/api/write/history-runs/cover?id=${encodeURIComponent(input.runId)}`,
        { method: "PATCH", body: { coverSpec: input.coverSpec } },
      );
      if (body?.reason === "no_column") return { ok: false, message: "cover_spec column unavailable" };
      return body?.updated ? { ok: true } : { ok: false, message: "수정 권한이 없거나 대상 런을 찾을 수 없습니다." };
    } catch (error) {
      if (!writeMayGoLegacy(error)) return { ok: false, message: apiWriteError(error).message };
    }
  }
  const result = await withSupabaseTimeout(
    "runs.update.cover-spec",
    supabase
      .from("runs")
      .update({ cover_spec: input.coverSpec })
      .eq("id", input.runId)
      .eq("env", supabaseEnv)
      .eq("donor_user_id", input.donorUserId)
      .select("id"),
  ).catch(() => ({ data: null, error: new Error("timeout") }));

  if (result.error) {
    if (isMissingCoverSpecColumn(result.error)) {
      return { ok: false, message: "cover_spec column unavailable" };
    }
    const message =
      result.error instanceof Error
        ? result.error.message
        : "message" in result.error
          ? String((result.error as { message?: unknown }).message ?? "update failed")
          : "update failed";
    return { ok: false, message };
  }
  if (!result.data || result.data.length === 0) {
    return { ok: false, message: "수정 권한이 없거나 대상 런을 찾을 수 없습니다." };
  }
  return { ok: true };
}

/** OG/metadata fields only — no raw parse, one small row select. */
export async function getDonatedRunOgFields(runId: string): Promise<{
  character: string;
  coverSpec: CoverSpec | null;
} | null> {
  if (!supabaseEnabled || !runId) return null;
  if (runsViaApi() && isRunId(runId)) {
    try {
      const rows = await apiRunRows(`/api/read/history-run?id=${encodeURIComponent(runId)}&view=meta`);
      if (rows !== "legacy") {
        const row = rows[0];
        return row ? { character: String(row.character ?? ""), coverSpec: parseCoverSpec(row.cover_spec) } : null;
      }
    } catch {
      return null;
    }
  }
  for (const env of runReadEnvs()) {
    const withCover = await withSupabaseTimeout(
      "runs.select.og-fields",
      supabase
        .from("runs")
        .select("character, cover_spec")
        .eq("id", runId)
        .eq("env", env)
        .maybeSingle(),
    ).catch((error) => ({ data: null, error }));

    if (withCover.error && isMissingCoverSpecColumn(withCover.error)) {
      const legacy = await withSupabaseTimeout(
        "runs.select.og-fields.legacy",
        supabase
          .from("runs")
          .select("character")
          .eq("id", runId)
          .eq("env", env)
          .maybeSingle(),
      ).catch((error) => ({ data: null, error }));
      if (!legacy.data) {
        if (legacy.error) return null;
        continue;
      }
      return {
        character: String((legacy.data as RunRow).character ?? ""),
        coverSpec: null,
      };
    }

    if (withCover.error) return null;
    if (!withCover.data) continue;
    const row = withCover.data as RunRow;
    return {
      character: String(row.character ?? ""),
      coverSpec: parseCoverSpec(row.cover_spec),
    };
  }
  return null;
}

/** Light cover lookup for combo list thumbs when snapshot omitted coverSpec. */
export async function getRunCoverSpec(runId: string): Promise<CoverSpec | null> {
  if (!supabaseEnabled || !runId) return null;
  if (runsViaApi() && isRunId(runId)) {
    try {
      const rows = await apiRunRows(`/api/read/history-run?id=${encodeURIComponent(runId)}&view=cover`);
      if (rows !== "legacy") {
        const row = rows[0];
        if (!row) return null;
        const stored = parseCoverSpec(row.cover_spec);
        if (stored?.auto === false) return stored;
        const parsed = parseRunSafely(row.raw);
        return parsed ? pickAlternatingCover(runId, parsed) : stored;
      }
    } catch {
      return null;
    }
  }
  for (const env of runReadEnvs()) {
    const withCover = await withSupabaseTimeout(
      "runs.select.cover-spec",
      supabase
        .from("runs")
        .select("id, raw, cover_spec")
        .eq("id", runId)
        .eq("env", env)
        .maybeSingle(),
    ).catch((error) => ({ data: null, error }));

    if (withCover.error && isMissingCoverSpecColumn(withCover.error)) {
      const legacy = await withSupabaseTimeout(
        "runs.select.cover-spec.legacy",
        supabase
          .from("runs")
          .select("id, raw")
          .eq("id", runId)
          .eq("env", env)
          .maybeSingle(),
      ).catch((error) => ({ data: null, error }));
      if (!legacy.data) {
        if (legacy.error) return null;
        continue;
      }
      const parsed = parseRunSafely((legacy.data as RunRow).raw);
      return parsed ? pickAlternatingCover(runId, parsed) : null;
    }

    if (withCover.error) return null;
    if (!withCover.data) continue;
    const row = withCover.data as RunRow;
    const stored = parseCoverSpec(row.cover_spec);
    if (stored?.auto === false) return stored;
    const parsed = parseRunSafely(row.raw);
    return parsed ? pickAlternatingCover(runId, parsed) : stored;
  }
  return null;
}

export async function isRunDonated(runId: string): Promise<boolean> {
  if (!supabaseEnabled) return false;
  if (runsViaApi() && isRunId(runId)) {
    try {
      const rows = await apiRunRows(`/api/read/history-run?id=${encodeURIComponent(runId)}&view=meta`);
      if (rows !== "legacy") return rows.length > 0;
    } catch {
      return false;
    }
  }
  const { data, error } = await withSupabaseTimeout(
    "runs.select.exists",
    supabase
      .from("runs")
      .select("id")
      .eq("id", runId)
      .eq("env", supabaseEnv)
      .maybeSingle(),
  ).catch(() => ({ data: null, error: new Error("timeout") }));
  return !error && !!data;
}

// True only if the visitor (userId) is the donor on record. Used to
// gate the "공유 취소" button — RLS already enforces donor-only delete
// server-side, so this is purely UI affordance.
export async function isOwnDonation(
  runId: string,
  userId: string,
): Promise<boolean> {
  if (!supabaseEnabled || !userId) return false;
  if (runsViaApi() && isRunId(runId)) {
    try {
      // The donor is the token's user, never an id the page passes.
      const body = await apiFetchAsUser<{ v?: number; ids?: string[] }>(
        "history-runs",
        `/api/me/history-runs?id=${encodeURIComponent(runId)}`,
      );
      return Array.isArray(body?.ids) && body.ids.includes(runId);
    } catch (error) {
      if (!shouldUseLegacy(error)) return false;
    }
  }
  const { data, error } = await withSupabaseTimeout(
    "runs.select.owner",
    supabase
      .from("runs")
      .select("id")
      .eq("id", runId)
      .eq("env", supabaseEnv)
      .eq("donor_user_id", userId)
      .maybeSingle(),
  ).catch(() => ({ data: null, error: new Error("timeout") }));
  return !error && !!data;
}

// All runIds that the visitor has donated. One query, used to mark
// 내 런 cards as already-shared so we can render '공유 취소' instead
// of '공유'.
export async function listMyDonatedRunIds(
  userId: string,
): Promise<Set<string>> {
  const ids = new Set<string>();
  if (!supabaseEnabled || !userId) return ids;
  if (runsViaApi()) {
    try {
      const body = await apiFetchAsUser<{ v?: number; ids?: string[] }>("history-runs", "/api/me/history-runs");
      for (const id of body?.ids ?? []) ids.add(id);
      return ids;
    } catch (error) {
      if (!shouldUseLegacy(error)) return ids;
    }
  }
  const { data, error } = await withSupabaseTimeout(
    "runs.select.mine",
    supabase
      .from("runs")
      .select("id")
      .eq("env", supabaseEnv)
      .eq("donor_user_id", userId),
  ).catch(() => ({ data: null, error: new Error("timeout") }));
  if (error || !data) return ids;
  for (const row of data) ids.add(row.id as string);
  return ids;
}

export async function syncDonatedRunNicknames(userId: string): Promise<void> {
  if (!supabaseEnabled || !userId) return;
  const nickname = readStoredUserProfile().nickname;
  if (runsViaApi()) {
    try {
      await apiFetchAsUser("history-runs", "/api/write/history-runs/nicknames", { method: "POST", body: { nickname } });
      return;
    } catch (error) {
      if (!writeMayGoLegacy(error)) return;
    }
  }
  await withSupabaseTimeout(
    "runs.update.donor-nickname",
    supabase
      .from("runs")
      .update({ donor_nickname: nickname })
      .eq("env", supabaseEnv)
      .eq("donor_user_id", userId)
      .neq("donor_nickname", nickname),
  ).catch(() => undefined);
}


export async function listRecentDonatedRuns(): Promise<DonatedRunSummary[]> {
  if (!supabaseEnabled) return [];
  let lastError: unknown = null;
  for (const env of runReadEnvs()) {
    const { data, error } = await selectRecentDonatedRunsForEnv(env);
    if (data?.length) return data;
    if (error) lastError = error;
  }
  if (lastError) throw lastError;
  return [];
}

/**
 * Bounded metadata-only listing for the Combo reference picker.
 *
 * Unlike the History Course gallery's legacy-compatible query, this never
 * downloads or parses raw run JSON. The picker filters these rows in the
 * browser and only loads them when opened.
 */
export async function listHistoryRunReferences(): Promise<DonatedRunSummary[]> {
  if (!supabaseEnabled) return [];
  let lastError: unknown = null;
  for (const env of runReadEnvs()) {
    const { data, error } = await selectHistoryRunReferencesForEnv(env);
    if (data?.length) return data;
    if (error) lastError = error;
  }
  if (lastError) throw lastError;
  return [];
}

export async function deleteDonatedRun(runId: string): Promise<boolean> {
  if (!supabaseEnabled) return false;
  if (runsViaApi() && isRunId(runId)) {
    try {
      // Like the legacy delete, success means "no error", whether or not a row went.
      await apiFetchAsUser("history-runs", `/api/write/history-runs?id=${encodeURIComponent(runId)}`, { method: "DELETE" });
      return true;
    } catch (error) {
      if (!writeMayGoLegacy(error)) return false;
    }
  }
  const { error } = await withSupabaseTimeout(
    "runs.delete",
    supabase
      .from("runs")
      .delete()
      .eq("id", runId)
      .eq("env", supabaseEnv),
  ).catch(() => ({ error: new Error("timeout") }));
  return !error;
}
