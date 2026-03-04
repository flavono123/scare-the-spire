"use client";

import { useEffect, useState } from "react";
import { supabase, supabaseEnabled, supabaseEnv } from "@/lib/supabase";

interface Counts {
  likes: Record<string, number>;
  comments: Record<string, number>;
}

export function useEngagementCounts() {
  const [counts, setCounts] = useState<Counts>({ likes: {}, comments: {} });

  useEffect(() => {
    if (!supabaseEnabled) return;

    Promise.all([
      supabase
        .from("likes")
        .select("story_id")
        .eq("env", supabaseEnv),
      supabase
        .from("comments")
        .select("story_id")
        .eq("env", supabaseEnv),
    ]).then(([likesRes, commentsRes]) => {
      const likes: Record<string, number> = {};
      for (const row of likesRes.data ?? []) {
        likes[row.story_id] = (likes[row.story_id] ?? 0) + 1;
      }
      const comments: Record<string, number> = {};
      for (const row of commentsRes.data ?? []) {
        comments[row.story_id] = (comments[row.story_id] ?? 0) + 1;
      }
      setCounts({ likes, comments });
    });
  }, []);

  return counts;
}
