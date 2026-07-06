"use client";

import { useEffect, useState } from "react";
import { supabase, supabaseEnabled, supabaseEnv } from "@/lib/supabase";
import { withSupabaseTimeout } from "@/lib/supabase-timeout";
import { isStoryReactionType, type StoryReactionCounts } from "@/lib/reactions";

interface Counts {
  likes: Record<string, number>;
  comments: Record<string, number>;
  reactions: Record<string, StoryReactionCounts>;
  loading: boolean;
  unavailable: boolean;
}

export function useEngagementCounts({ enabled = true }: { enabled?: boolean } = {}) {
  const [counts, setCounts] = useState<Omit<Counts, "loading">>({
    likes: {},
    comments: {},
    reactions: {},
    unavailable: false,
  });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!enabled || !supabaseEnabled) return;

    let cancelled = false;

    // Keep aggregation server-side. A client-side full-table scan is too
    // expensive when Supabase is already under Disk IO pressure.
    Promise.all([
      withSupabaseTimeout(
        "engagement_counts.rpc",
        supabase.rpc("get_engagement_counts", { p_env: supabaseEnv }),
      ),
      withSupabaseTimeout(
        "story_reaction_counts.rpc",
        supabase.rpc("get_story_reaction_counts", { p_env: supabaseEnv }),
      ).catch(() => ({ data: [], error: null })),
    ])
      .then(([engagementResult, reactionResult]) => {
        if (engagementResult.error) throw engagementResult.error;
        const likes: Record<string, number> = {};
        const comments: Record<string, number> = {};
        const rows = (engagementResult.data ?? []) as { story_id: string; like_count: number; comment_count: number }[];
        for (const row of rows) {
          if (row.like_count) likes[row.story_id] = row.like_count;
          if (row.comment_count) comments[row.story_id] = row.comment_count;
        }

        const reactions: Record<string, StoryReactionCounts> = {};
        const reactionRows = (reactionResult.data ?? []) as {
          story_id: string;
          reaction_type: unknown;
          reaction_count: number;
        }[];
        for (const row of reactionRows) {
          if (!isStoryReactionType(row.reaction_type) || !row.reaction_count) continue;
          reactions[row.story_id] ??= {};
          reactions[row.story_id][row.reaction_type] = row.reaction_count;
        }
        if (cancelled) return;
        setCounts({ likes, comments, reactions, unavailable: false });
        setLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        setCounts({ likes: {}, comments: {}, reactions: {}, unavailable: true });
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
