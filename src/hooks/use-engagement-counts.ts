"use client";

import { useEffect, useState } from "react";
import { supabase, supabaseEnabled, supabaseEnv } from "@/lib/supabase";

interface Counts {
  likes: Record<string, number>;
  comments: Record<string, number>;
  loading: boolean;
}

export function useEngagementCounts() {
  const [counts, setCounts] = useState<Counts>({ likes: {}, comments: {}, loading: supabaseEnabled });

  useEffect(() => {
    if (!supabaseEnabled) return;

    // Try server-side RPC first (migration-003), fall back to client-side scan
    supabase
      .rpc("get_engagement_counts", { p_env: supabaseEnv })
      .then(({ data, error }) => {
        if (!error && data) {
          const likes: Record<string, number> = {};
          const comments: Record<string, number> = {};
          for (const row of data as { story_id: string; like_count: number; comment_count: number }[]) {
            if (row.like_count) likes[row.story_id] = row.like_count;
            if (row.comment_count) comments[row.story_id] = row.comment_count;
          }
          setCounts({ likes, comments, loading: false });
          return;
        }

        // Fallback: client-side scan (before migration-003 is applied)
        Promise.all([
          supabase.from("likes").select("story_id").eq("env", supabaseEnv),
          supabase.from("comments").select("story_id").eq("env", supabaseEnv),
        ]).then(([likesRes, commentsRes]) => {
          const likes: Record<string, number> = {};
          for (const row of likesRes.data ?? []) {
            likes[row.story_id] = (likes[row.story_id] ?? 0) + 1;
          }
          const comments: Record<string, number> = {};
          for (const row of commentsRes.data ?? []) {
            comments[row.story_id] = (comments[row.story_id] ?? 0) + 1;
          }
          setCounts({ likes, comments, loading: false });
        });
      });
  }, []);

  return counts;
}
