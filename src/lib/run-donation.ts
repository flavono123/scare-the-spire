import { supabase, supabaseEnabled } from "./supabase";
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
  created_at: string;
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
    .eq("donor_user_id", userId)
    .maybeSingle();
  return !error && !!data;
}

export async function listRecentDonatedRuns(limit = 12): Promise<DonatedRunSummary[]> {
  if (!supabaseEnabled) return [];
  const { data, error } = await supabase
    .from("runs")
    .select(
      "id, seed, build, character, ascension, win, start_time, run_time, acts_count, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data as DonatedRunSummary[];
}

export async function deleteDonatedRun(runId: string): Promise<boolean> {
  if (!supabaseEnabled) return false;
  const { error } = await supabase.from("runs").delete().eq("id", runId);
  return !error;
}
