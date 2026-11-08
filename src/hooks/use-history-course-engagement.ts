"use client";

import { useEffect, useMemo, useState } from "react";
import { buildHistoryCourseCommentThreadKey } from "@/lib/comment-threads";
import { apiFetch, shouldUseLegacy } from "@/lib/api-client";
import { HISTORY_RUN_ENGAGEMENT_IDS, isRunId } from "@/lib/history-runs-api-rules";
import { surfacePath } from "@/lib/runtime-flags";
import { supabase, supabaseEnabled, supabaseEnv } from "@/lib/supabase";
import { withSupabaseTimeout } from "@/lib/supabase-timeout";

export interface HistoryCourseEngagementCounts {
  likes: number;
  comments: number;
}

const EMPTY: Record<string, HistoryCourseEngagementCounts> = {};

function runIdKey(runIds: string[]) {
  return [...runIds].sort().join(":");
}

function threadToRunId(storyId: string): string | null {
  const prefix = "history-course:";
  if (!storyId.startsWith(prefix)) return null;
  const runId = storyId.slice(prefix.length);
  return runId || null;
}

/**
 * Like and comment totals for the runs already on the index.
 * One bounded read per table, not a full-environment scan.
 */
export function useHistoryCourseEngagement(runIds: string[]) {
  const [counts, setCounts] = useState<Record<string, HistoryCourseEngagementCounts>>(EMPTY);
  const [loadedKey, setLoadedKey] = useState("");
  const key = useMemo(() => runIdKey(runIds), [runIds]);

  useEffect(() => {
    if (runIds.length === 0) return;
    // docs/supabase-exit/STEP1_DESIGN.md 9.6: the Worker counts the same two reads.
    const viaApi = surfacePath("history-runs") === "api"
      && runIds.length <= HISTORY_RUN_ENGAGEMENT_IDS
      && new Set(runIds).size === runIds.length
      && runIds.every(isRunId);
    if (!viaApi && !supabaseEnabled) return;
    let cancelled = false;
    const show = (next: Record<string, HistoryCourseEngagementCounts>) => {
      if (cancelled) return;
      setCounts(next);
      setLoadedKey(key);
    };

    const loadLegacy = () => {
      const threadKeys = runIds.map((runId) => buildHistoryCourseCommentThreadKey(runId));
      Promise.all([
        withSupabaseTimeout(
          "history_course_likes.select",
          supabase
            .from("likes")
            .select("story_id")
            .eq("env", supabaseEnv)
            .in("story_id", threadKeys)
            .limit(1000),
        ),
        withSupabaseTimeout(
          "history_course_comments.select",
          supabase
            .from("comments")
            .select("story_id")
            .eq("env", supabaseEnv)
            .in("story_id", threadKeys)
            .limit(1000),
        ),
      ])
        .then(([likes, comments]) => {
          if (likes.error) throw likes.error;
          if (comments.error) throw comments.error;
          const next: Record<string, HistoryCourseEngagementCounts> = {};
          const bump = (storyId: unknown, field: "likes" | "comments") => {
            const runId = threadToRunId(String(storyId ?? ""));
            if (!runId) return;
            const current = next[runId] ?? { likes: 0, comments: 0 };
            current[field] += 1;
            next[runId] = current;
          };
          for (const row of likes.data ?? []) bump((row as { story_id: unknown }).story_id, "likes");
          for (const row of comments.data ?? []) bump((row as { story_id: unknown }).story_id, "comments");
          show(next);
        })
        .catch(() => show(EMPTY));
    };

    if (viaApi) {
      apiFetch<{ v?: number; likes?: Record<string, number>; comments?: Record<string, number> }>(
        "history-runs",
        `/api/read/history-runs/engagement?ids=${runIds.join(",")}`,
      )
        .then((body) => {
          if (body?.v !== 1 || !body.likes || !body.comments) throw new Error("bad history engagement");
          const next: Record<string, HistoryCourseEngagementCounts> = {};
          for (const runId of new Set([...Object.keys(body.likes), ...Object.keys(body.comments)])) {
            next[runId] = { likes: body.likes[runId] ?? 0, comments: body.comments[runId] ?? 0 };
          }
          show(next);
        })
        .catch((error) => {
          if (cancelled) return;
          if (shouldUseLegacy(error) && supabaseEnabled) loadLegacy();
          else show(EMPTY);
        });
    } else {
      loadLegacy();
    }
    return () => {
      cancelled = true;
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    counts: runIds.length > 0 ? counts : EMPTY,
    ready: !supabaseEnabled || runIds.length === 0 || loadedKey === key,
  };
}
