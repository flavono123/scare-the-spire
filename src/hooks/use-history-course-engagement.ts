"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { HISTORY_RUN_ENGAGEMENT_IDS, isRunId } from "@/lib/history-runs-api-rules";

export interface HistoryCourseEngagementCounts {
  likes: number;
  comments: number;
}

type EngagementCounts = Record<string, HistoryCourseEngagementCounts>;

/** The answer of GET /api/read/history-runs/engagement. */
export type HistoryCourseEngagementBody = {
  v?: number;
  likes?: Record<string, number>;
  comments?: Record<string, number>;
};

const EMPTY: EngagementCounts = {};

function runIdKey(runIds: string[]) {
  return [...runIds].sort().join(":");
}

/**
 * The run ids to ask the Worker for, in requests of at most HISTORY_RUN_ENGAGEMENT_IDS: each id
 * once, and only ids the api rule (isRunId) accepts. The index passes this browser's local runs
 * and the 100 shared ones, so the list can be longer than one request. An id outside the rule has
 * no thread rows (docs/supabase-exit/STEP6_PLAN.md 2, P14): it is left out and shows 0.
 */
export function historyCourseEngagementIdChunks(runIds: readonly string[]): string[][] {
  const ids = [...new Set(runIds)].filter(isRunId);
  const chunks: string[][] = [];
  for (let start = 0; start < ids.length; start += HISTORY_RUN_ENGAGEMENT_IDS) {
    chunks.push(ids.slice(start, start + HISTORY_RUN_ENGAGEMENT_IDS));
  }
  return chunks;
}

/** One request's counts, keyed by run id. Throws on an answer that is not version 1 with both maps. */
export function historyCourseEngagementFromBody(body: HistoryCourseEngagementBody | null | undefined): EngagementCounts {
  if (body?.v !== 1 || !body.likes || !body.comments) throw new Error("bad history engagement");
  const next: EngagementCounts = {};
  for (const runId of new Set([...Object.keys(body.likes), ...Object.keys(body.comments)])) {
    next[runId] = { likes: body.likes[runId] ?? 0, comments: body.comments[runId] ?? 0 };
  }
  return next;
}

function fetchEngagementChunk(ids: string[]): Promise<HistoryCourseEngagementBody> {
  return apiFetch<HistoryCourseEngagementBody>("history-runs", `/api/read/history-runs/engagement?ids=${ids.join(",")}`);
}

/**
 * Like and comment totals for these runs: one Worker read per chunk of ids, merged. Rejects when
 * any chunk fails, so the index shows no counts rather than part of them (as one failed read did).
 */
export async function loadHistoryCourseEngagement(
  runIds: readonly string[],
  fetchChunk: (ids: string[]) => Promise<HistoryCourseEngagementBody> = fetchEngagementChunk,
): Promise<EngagementCounts> {
  const parts = await Promise.all(
    historyCourseEngagementIdChunks(runIds).map((ids) => fetchChunk(ids).then(historyCourseEngagementFromBody)),
  );
  return Object.assign({}, ...parts) as EngagementCounts;
}

/**
 * Like and comment totals for the runs already on the index.
 * Bounded reads (docs/supabase-exit/STEP1_DESIGN.md 9.6), not a full-environment scan.
 */
export function useHistoryCourseEngagement(runIds: string[]) {
  const [counts, setCounts] = useState<EngagementCounts>(EMPTY);
  const [loadedKey, setLoadedKey] = useState("");
  const key = useMemo(() => runIdKey(runIds), [runIds]);

  useEffect(() => {
    if (runIds.length === 0) return;
    let cancelled = false;
    const show = (next: EngagementCounts) => {
      if (cancelled) return;
      setCounts(next);
      setLoadedKey(key);
    };
    loadHistoryCourseEngagement(runIds)
      .then(show)
      .catch(() => show(EMPTY));
    return () => {
      cancelled = true;
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    counts: runIds.length > 0 ? counts : EMPTY,
    ready: runIds.length === 0 || loadedKey === key,
  };
}
