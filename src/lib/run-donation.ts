import { supabase, supabaseEnabled, supabaseEnv } from "./supabase";
import type { ReplayRun } from "./sts2-run-replay";

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
  donor_user_id: string | null;
  created_at: string;
}

function totalFloorsFromRun(run: ReplayRun): number {
  let total = 0;
  for (const act of run.map_point_history) total += act.length;
  return total;
}

function parsedMetaFromRun(run: ReplayRun) {
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
  const meta = parsedMetaFromRun(input.run);
  const { error } = await supabase.from("runs").insert({
    id: input.runId,
    raw: input.raw,
    donor_user_id: input.donorUserId,
    env: supabaseEnv,
    ...meta,
  });
  if (!error) return { ok: true };
  // 23505 = unique_violation. The row may have been donated already
  // (by anyone). Treat as "already shared" rather than an error.
  const alreadyDonated = error.code === "23505";
  return {
    ok: false,
    alreadyDonated,
    message: alreadyDonated ? "이미 공유된 런입니다." : (error.message ?? "공유에 실패했습니다."),
  };
}

export async function getDonatedRun(runId: string): Promise<DonatedRun | null> {
  if (!supabaseEnabled) return null;
  const { data, error } = await supabase
    .from("runs")
    .select(
      "id, raw, seed, build, character, ascension, win, start_time, run_time, acts_count, created_at",
    )
    .eq("id", runId)
    .eq("env", supabaseEnv)
    .maybeSingle();
  if (error || !data) return null;
  return data as DonatedRun;
}

export async function isRunDonated(runId: string): Promise<boolean> {
  if (!supabaseEnabled) return false;
  const { data, error } = await supabase
    .from("runs")
    .select("id")
    .eq("id", runId)
    .eq("env", supabaseEnv)
    .maybeSingle();
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
  const { data, error } = await supabase
    .from("runs")
    .select("id")
    .eq("id", runId)
    .eq("env", supabaseEnv)
    .eq("donor_user_id", userId)
    .maybeSingle();
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
  const { data, error } = await supabase
    .from("runs")
    .select("id")
    .eq("env", supabaseEnv)
    .eq("donor_user_id", userId);
  if (error || !data) return ids;
  for (const row of data) ids.add(row.id as string);
  return ids;
}

export async function listRecentDonatedRuns(limit = 12): Promise<DonatedRunSummary[]> {
  if (!supabaseEnabled) return [];
  const { data, error } = await supabase
    .from("runs")
    .select(
      "id, seed, build, character, ascension, win, start_time, run_time, acts_count, total_floors, donor_user_id, created_at",
    )
    .eq("env", supabaseEnv)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data as DonatedRunSummary[];
}

export async function deleteDonatedRun(runId: string): Promise<boolean> {
  if (!supabaseEnabled) return false;
  const { error } = await supabase
    .from("runs")
    .delete()
    .eq("id", runId)
    .eq("env", supabaseEnv);
  return !error;
}
