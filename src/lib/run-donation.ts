import { supabase, supabaseEnabled, supabaseEnv } from "./supabase";
import { withSupabaseTimeout } from "./supabase-timeout";
import type { PostBlock } from "./chemical-types";
import { devToolsEnabled } from "./dev-tools";
import { buildRunHighlights, type RunHighlightResource } from "./run-highlights";
import { parseReplayRun, type ReplayBadge, type ReplayRun } from "./sts2-run-replay";

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
  created_at: string;
}

export interface DonatedRunSummary {
  id: string;
  seed: string;
  build: string;
  character: string;
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
  donor_user_id: string | null;
  created_at: string;
}

function totalFloorsFromRun(run: ReplayRun): number {
  let total = 0;
  for (const act of run.map_point_history) total += act.length;
  return total;
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
    badges: run.players[0]?.badges ?? [],
    highlight_card: highlights.card,
    highlight_relic: highlights.relic,
    note_blocks: null,
  };
}

type SupabaseMaybeError = {
  code?: string;
  message?: string;
};

type RunRow = Partial<DonatedRunSummary & DonatedRun> & {
  raw?: string | null;
};

const RICH_RUN_DETAIL_COLUMNS =
  "id, raw, seed, build, character, ascension, win, start_time, run_time, acts_count, badges, highlight_card, highlight_relic, note_blocks, created_at";
const LEGACY_RUN_DETAIL_COLUMNS =
  "id, raw, seed, build, character, ascension, win, start_time, run_time, acts_count, created_at";
const RICH_RUN_SUMMARY_COLUMNS =
  "id, seed, build, character, ascension, win, start_time, run_time, acts_count, total_floors, badges, highlight_card, highlight_relic, note_blocks, donor_user_id, created_at";
const LEGACY_RUN_SUMMARY_COLUMNS =
  "id, raw, seed, build, character, ascension, win, start_time, run_time, acts_count, total_floors, donor_user_id, created_at";

function isMissingColumnError(error: unknown): boolean {
  return Boolean(
    error
      && typeof error === "object"
      && "code" in error
      && (error as SupabaseMaybeError).code === "42703",
  );
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
    badges: row.badges ?? parsedRun?.players[0]?.badges ?? [],
    highlight_card: row.highlight_card ?? highlights?.card ?? null,
    highlight_relic: row.highlight_relic ?? highlights?.relic ?? null,
    note_blocks: row.note_blocks ?? null,
    created_at: row.created_at ?? new Date(0).toISOString(),
  };
}

function normalizeRunSummaryRow(row: RunRow): DonatedRunSummary {
  const runId = row.id ?? "";
  const normalized = normalizeRunRow(row, runId);
  const parsedRun = parseRunSafely(row.raw);
  return {
    ...normalized,
    total_floors: row.total_floors ?? (parsedRun ? totalFloorsFromRun(parsedRun) : 0),
    donor_user_id: row.donor_user_id ?? null,
  };
}

async function selectDonatedRunForEnv(
  runId: string,
  env: string,
): Promise<{ data: DonatedRun | null; error: unknown }> {
  const rich = await withSupabaseTimeout(
    "runs.select.detail",
    supabase
      .from("runs")
      .select(RICH_RUN_DETAIL_COLUMNS)
      .eq("id", runId)
      .eq("env", env)
      .maybeSingle(),
  ).catch((error) => ({ data: null, error }));

  if (!rich.error) {
    return { data: rich.data ? normalizeRunRow(rich.data as RunRow, runId) : null, error: null };
  }
  if (!isMissingColumnError(rich.error)) return { data: null, error: rich.error };

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
  const rich = await withSupabaseTimeout(
    "runs.select.recent",
    supabase
      .from("runs")
      .select(RICH_RUN_SUMMARY_COLUMNS)
      .eq("env", env)
      .order("created_at", { ascending: false })
      .limit(RECENT_DONATED_RUNS_LIMIT),
  ).catch((error) => ({ data: null, error }));

  if (!rich.error) {
    return {
      data: ((rich.data ?? []) as RunRow[]).map(normalizeRunSummaryRow),
      error: null,
    };
  }
  if (!isMissingColumnError(rich.error)) return { data: null, error: rich.error };

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

export async function donateRun(input: {
  runId: string;
  raw: string;
  run: ReplayRun;
  donorUserId: string;
}): Promise<{ ok: true } | { ok: false; alreadyDonated: boolean; message: string }> {
  if (!supabaseEnabled) {
    return { ok: false, alreadyDonated: false, message: "Supabase 연결이 설정되지 않았습니다." };
  }
  const meta = parsedMetaFromRun(input.run, input.runId);
  const { error } = await withSupabaseTimeout(
    "runs.insert",
    supabase.from("runs").insert({
      id: input.runId,
      raw: input.raw,
      donor_user_id: input.donorUserId,
      env: supabaseEnv,
      ...meta,
    }),
  ).catch(() => ({ error: new Error("timeout") }));
  if (!error) return { ok: true };
  // 23505 = unique_violation. The row may have been donated already
  // (by anyone). Treat as "already shared" rather than an error.
  const alreadyDonated = "code" in error && error.code === "23505";
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
  runs: Array<{ runId: string; raw: string; run: ReplayRun }>;
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
  const rows = input.runs.map((r) => ({
    id: r.runId,
    raw: r.raw,
    donor_user_id: input.donorUserId,
    env: supabaseEnv,
    ...parsedMetaFromRun(r.run, r.runId),
  }));
  // onConflict spans (id, env) — the composite PK after migration-009.
  // Same content-addressable runId in a different env is a fresh row;
  // only same id + same env is treated as a duplicate.
  const { data, error } = await withSupabaseTimeout(
    "runs.upsert",
    supabase
      .from("runs")
      .upsert(rows, { onConflict: "id,env", ignoreDuplicates: true })
      .select("id"),
  ).catch(() => ({ data: null, error: new Error("timeout") }));
  if (error) {
    return {
      inserted: 0,
      alreadyDonated: 0,
      failed: input.runs.length,
      errorMessage: error.message,
    };
  }
  // upsert with ignoreDuplicates returns ONLY the newly-inserted rows
  // — anything that conflicted on `id` is silently skipped. We treat
  // those as 'already donated' (by this user or anyone).
  const inserted = data?.length ?? 0;
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
    if (error && !isMissingColumnError(error)) return null;
  }
  return null;
}

export async function isRunDonated(runId: string): Promise<boolean> {
  if (!supabaseEnabled) return false;
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

const RECENT_DONATED_RUNS_LIMIT = 100;

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

export async function deleteDonatedRun(runId: string): Promise<boolean> {
  if (!supabaseEnabled) return false;
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
