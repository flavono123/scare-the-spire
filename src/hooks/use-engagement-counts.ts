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
  const [counts, setCounts] = useState<Omit<Counts, "loading">>({
    likes: {},
    comments: {},
    unavailable: false,
  });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!enabled || !supabaseEnabled) return;

    let cancelled = false;

    // Keep aggregation server-side. A client-side full-table scan is too
    // expensive when Supabase is already under Disk IO pressure.
    withSupabaseTimeout(
      "engagement_counts.rpc",
      supabase.rpc("get_engagement_counts", { p_env: supabaseEnv }),
    )
      .then(({ data, error }) => {
        if (error) throw error;
        const likes: Record<string, number> = {};
        const comments: Record<string, number> = {};
        const rows = (data ?? []) as { story_id: string; like_count: number; comment_count: number }[];
        for (const row of rows) {
          if (row.like_count) likes[row.story_id] = row.like_count;
          if (row.comment_count) comments[row.story_id] = row.comment_count;
        }
        if (cancelled) return;
        setCounts({ likes, comments, unavailable: false });
        setLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        setCounts({ likes: {}, comments: {}, unavailable: true });
        setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return {
    ...counts,
    loading: supabaseEnabled && enabled && !loaded,
  };
}
