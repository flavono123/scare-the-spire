"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase, supabaseEnabled, supabaseEnv } from "@/lib/supabase";

interface UseLikesReturn {
  count: number;
  liked: boolean;
  toggle: () => Promise<void>;
}

export function useLikes(storyId: string, userId: string | null): UseLikesReturn {
  const [count, setCount] = useState(0);
  const [liked, setLiked] = useState(false);

  useEffect(() => {
    if (!supabaseEnabled) return;

    supabase
      .from("likes")
      .select("*", { count: "exact", head: true })
      .eq("story_id", storyId)
      .eq("env", supabaseEnv)
      .then(({ count: c }) => setCount(c ?? 0));

    if (userId) {
      supabase
        .from("likes")
        .select("id")
        .eq("story_id", storyId)
        .eq("user_id", userId)
        .eq("env", supabaseEnv)
        .maybeSingle()
        .then(({ data }) => setLiked(!!data));
    }
  }, [storyId, userId]);

  const toggle = useCallback(async () => {
    if (!userId || !supabaseEnabled) return;

    if (liked) {
      await supabase
        .from("likes")
        .delete()
        .eq("story_id", storyId)
        .eq("user_id", userId)
        .eq("env", supabaseEnv);
      setLiked(false);
      setCount((c) => Math.max(0, c - 1));
    } else {
      await supabase
        .from("likes")
        .insert({ story_id: storyId, user_id: userId, env: supabaseEnv });
      setLiked(true);
      setCount((c) => c + 1);
    }
  }, [storyId, userId, liked]);

  return { count, liked, toggle };
}
