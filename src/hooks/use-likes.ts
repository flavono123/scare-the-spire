"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase, supabaseEnabled, supabaseEnv } from "@/lib/supabase";
import { withSupabaseTimeout } from "@/lib/supabase-timeout";

interface UseLikesReturn {
  count: number;
  liked: boolean;
  loading: boolean;
  unavailable: boolean;
  toggle: (activeUserId?: string) => void;
}

export function useLikes(
  storyId: string,
  userId: string | null,
  { initialCount }: { initialCount?: number } = {},
): UseLikesReturn {
  const [fetchedCount, setFetchedCount] = useState(0);
  const [optimisticDelta, setOptimisticDelta] = useState(0);
  const [liked, setLiked] = useState(false);
  const [countLoading, setCountLoading] = useState(supabaseEnabled && initialCount === undefined);
  const [resolvedUserStatusKey, setResolvedUserStatusKey] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const count = Math.max(0, (initialCount ?? fetchedCount) + optimisticDelta);
  const userStatusKey = userId ? `${storyId}:${userId}` : null;
  const userStatusLoading = supabaseEnabled && !!userStatusKey && resolvedUserStatusKey !== userStatusKey;
  const loading = countLoading || userStatusLoading;

  // Count query — independent of auth
  useEffect(() => {
    if (initialCount !== undefined) {
      return;
    }
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
        setFetchedCount(c ?? 0);
        setUnavailable(false);
        setCountLoading(false);
      })
      .catch(() => {
        setUnavailable(true);
        setCountLoading(false);
      });
  }, [storyId, initialCount]);

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
        setResolvedUserStatusKey(`${storyId}:${userId}`);
      })
      .catch(() => {
        setResolvedUserStatusKey(`${storyId}:${userId}`);
        setUnavailable(true);
      });
  }, [storyId, userId]);

  const toggle = useCallback((activeUserId = userId) => {
    if (!activeUserId || !supabaseEnabled) return;

    if (liked) {
      setLiked(false);
      setOptimisticDelta((c) => c - 1);
      withSupabaseTimeout(
        "likes.delete",
        supabase
          .from("likes")
          .delete()
          .eq("story_id", storyId)
          .eq("user_id", activeUserId)
          .eq("env", supabaseEnv),
      )
        .then(({ error }) => {
          if (error) throw error;
        })
        .catch(() => {
          setLiked(true);
          setOptimisticDelta((c) => c + 1);
          setUnavailable(true);
        });
    } else {
      setLiked(true);
      setOptimisticDelta((c) => c + 1);
      withSupabaseTimeout(
        "likes.insert",
        supabase
          .from("likes")
          .insert({ story_id: storyId, user_id: activeUserId, env: supabaseEnv }),
      )
        .then(({ error }) => {
          if (error) throw error;
        })
        .catch(() => {
          setLiked(false);
          setOptimisticDelta((c) => c - 1);
          setUnavailable(true);
        });
    }
  }, [storyId, userId, liked]);

  return { count, liked, loading, unavailable, toggle };
}
