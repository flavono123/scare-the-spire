"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase, supabaseEnabled, supabaseEnv } from "@/lib/supabase";
import { withSupabaseTimeout } from "@/lib/supabase-timeout";

interface UseLikesReturn {
  count: number;
  liked: boolean;
  loading: boolean;
  unavailable: boolean;
  toggle: () => void;
}

export function useLikes(storyId: string, userId: string | null): UseLikesReturn {
  const [count, setCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [loading, setLoading] = useState(supabaseEnabled);
  const [unavailable, setUnavailable] = useState(false);

  // Count query — independent of auth
  useEffect(() => {
    if (!supabaseEnabled) return;

    withSupabaseTimeout(
      "likes.count",
      supabase
        .from("likes")
        .select("*", { count: "exact", head: true })
        .eq("story_id", storyId)
        .eq("env", supabaseEnv),
    )
      .then(({ count: c, error }) => {
        if (error) throw error;
        setCount(c ?? 0);
        setUnavailable(false);
        setLoading(false);
      })
      .catch(() => {
        setUnavailable(true);
        setLoading(false);
      });
  }, [storyId]);

  // User like status — depends on auth
  useEffect(() => {
    if (!supabaseEnabled || !userId) return;

    withSupabaseTimeout(
      "likes.user_status",
      supabase
        .from("likes")
        .select("id")
        .eq("story_id", storyId)
        .eq("user_id", userId)
        .eq("env", supabaseEnv)
        .maybeSingle(),
    )
      .then(({ data, error }) => {
        if (error) throw error;
        setLiked(!!data);
      })
      .catch(() => setUnavailable(true));
  }, [storyId, userId]);

  const toggle = useCallback(() => {
    if (!userId || !supabaseEnabled) return;

    if (liked) {
      setLiked(false);
      setCount((c) => Math.max(0, c - 1));
      withSupabaseTimeout(
        "likes.delete",
        supabase
          .from("likes")
          .delete()
          .eq("story_id", storyId)
          .eq("user_id", userId)
          .eq("env", supabaseEnv),
      )
        .then(({ error }) => {
          if (error) throw error;
        })
        .catch(() => {
          setLiked(true);
          setCount((c) => c + 1);
          setUnavailable(true);
        });
    } else {
      setLiked(true);
      setCount((c) => c + 1);
      withSupabaseTimeout(
        "likes.insert",
        supabase
          .from("likes")
          .insert({ story_id: storyId, user_id: userId, env: supabaseEnv }),
      )
        .then(({ error }) => {
          if (error) throw error;
        })
        .catch(() => {
          setLiked(false);
          setCount((c) => Math.max(0, c - 1));
          setUnavailable(true);
        });
    }
  }, [storyId, userId, liked]);

  return { count, liked, loading, unavailable, toggle };
}
