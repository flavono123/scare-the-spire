"use client";

import { useEffect, useState } from "react";
import { supabase, supabaseEnabled, supabaseEnv } from "@/lib/supabase";
import { withSupabaseTimeout } from "@/lib/supabase-timeout";

interface Counts {
  likes: Record<string, number>;
  comments: Record<string, number>;
  loading: boolean;
  unavailable: boolean;
}

export function useEngagementCounts({ enabled = true }: { enabled?: boolean } = {}) {
  const [counts, setCounts] = useState<Counts>({
    likes: {},
    comments: {},
    loading: supabaseEnabled && enabled,
    unavailable: false,
  });

  useEffect(() => {
    if (!enabled || !supabaseEnabled) return;

    let cancelled = false;

    // Try server-side RPC first (migration-003), fall back to client-side scan
    withSupabaseTimeout(
      "engagement_counts.rpc",
      supabase.rpc("get_engagement_counts", { p_env: supabaseEnv }),
    )
      .then(({ data, error }) => {
        if (!error && data) {
          const likes: Record<string, number> = {};
          const comments: Record<string, number> = {};
          for (const row of data as { story_id: string; like_count: number; comment_count: number }[]) {
            if (row.like_count) likes[row.story_id] = row.like_count;
            if (row.comment_count) comments[row.story_id] = row.comment_count;
          }
          if (cancelled) return;
          setCounts({ likes, comments, loading: false, unavailable: false });
          return;
        }

        // Fallback: client-side scan (before migration-003 is applied)
        withSupabaseTimeout(
          "engagement_counts.fallback",
          Promise.all([
            supabase.from("likes").select("story_id").eq("env", supabaseEnv),
            supabase.from("comments").select("story_id").eq("env", supabaseEnv),
          ]),
        ).then(([likesRes, commentsRes]) => {
          if (likesRes.error || commentsRes.error) {
            throw likesRes.error ?? commentsRes.error;
          }
          const likes: Record<string, number> = {};
          for (const row of likesRes.data ?? []) {
            likes[row.story_id] = (likes[row.story_id] ?? 0) + 1;
          }
          const comments: Record<string, number> = {};
          for (const row of commentsRes.data ?? []) {
            comments[row.story_id] = (comments[row.story_id] ?? 0) + 1;
          }
          if (cancelled) return;
          setCounts({ likes, comments, loading: false, unavailable: false });
        });
      })
      .catch(() => {
        if (cancelled) return;
        setCounts({ likes: {}, comments: {}, loading: false, unavailable: true });
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return counts;
}
