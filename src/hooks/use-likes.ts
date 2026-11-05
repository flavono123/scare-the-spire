"use client";

import { useCallback, useEffect, useState } from "react";
import {
  engagementApiFor,
  forgetEngagement,
  loadEngagement,
  loadEngagementMine,
  shouldUseLegacy,
  writeMayGoLegacy,
} from "@/lib/api-engagement";
import { apiFetchAsUser } from "@/lib/api-session";
import { supabase, supabaseEnabled, supabaseEnv } from "@/lib/supabase";
import { withSupabaseTimeout } from "@/lib/supabase-timeout";

interface UseLikesReturn {
  count: number;
  liked: boolean;
  loading: boolean;
  unavailable: boolean;
  toggle: (activeUserId?: string) => Promise<void>;
}

type UserStatusLoadingMode = "eager" | "lazy";

async function readLegacyUserStatus(storyId: string, userId: string): Promise<boolean> {
  const { data, error } = await withSupabaseTimeout(
    "likes.user_status",
    supabase
      .from("likes")
      .select("id")
      .eq("story_id", storyId)
      .eq("user_id", userId)
      .eq("env", supabaseEnv)
      .maybeSingle(),
  );
  if (error) throw error;
  return !!data;
}

/** Whether this user liked the key; the api path asks /api/me/engagement (the sub comes from the token). */
async function readUserStatus(storyId: string, userId: string): Promise<boolean> {
  if (engagementApiFor("likes", storyId)) {
    try {
      return await loadEngagementMine("likes", storyId);
    } catch (error) {
      if (!shouldUseLegacy(error)) throw error;
    }
  }
  return readLegacyUserStatus(storyId, userId);
}

export function useLikes(
  storyId: string,
  userId: string | null,
  {
    initialCount,
    userStatusLoading: userStatusLoadingMode = "eager",
  }: {
    initialCount?: number;
    userStatusLoading?: UserStatusLoadingMode;
  } = {},
): UseLikesReturn {
  const [fetchedCount, setFetchedCount] = useState(0);
  const [optimisticDelta, setOptimisticDelta] = useState(0);
  const [liked, setLiked] = useState(false);
  const [countLoading, setCountLoading] = useState(supabaseEnabled && initialCount === undefined);
  const [resolvedUserStatusKey, setResolvedUserStatusKey] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [seenInitialCount, setSeenInitialCount] = useState(initialCount);
  if (seenInitialCount !== initialCount) {
    setSeenInitialCount(initialCount);
    setOptimisticDelta(0);
  }
  const count = Math.max(0, (initialCount ?? fetchedCount) + optimisticDelta);
  const userStatusKey = userId ? `${storyId}:${userId}` : null;
  const userStatusLoading = supabaseEnabled && !!userStatusKey && resolvedUserStatusKey !== userStatusKey;
  const loading = countLoading || (userStatusLoadingMode === "eager" && userStatusLoading);

  // Count query — independent of auth
  useEffect(() => {
    if (initialCount !== undefined) {
      return;
    }
    let cancelled = false;
    const loadLegacy = () => {
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
          if (cancelled) return;
          setFetchedCount(c ?? 0);
          setUnavailable(false);
          setCountLoading(false);
        })
        .catch(() => {
          if (cancelled) return;
          setUnavailable(true);
          setCountLoading(false);
        });
    };

    if (engagementApiFor("likes", storyId)) {
      loadEngagement("likes", storyId)
        .then((c) => {
          if (cancelled) return;
          setFetchedCount(c);
          setUnavailable(false);
          setCountLoading(false);
        })
        .catch((error) => {
          if (cancelled) return;
          if (shouldUseLegacy(error) && supabaseEnabled) {
            loadLegacy();
            return;
          }
          setUnavailable(true);
          setCountLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }

    if (!supabaseEnabled) return;
    loadLegacy();
    return () => {
      cancelled = true;
    };
  }, [storyId, initialCount]);

  // User like status — depends on auth
  useEffect(() => {
    if (!supabaseEnabled || !userId) return;
    if (userStatusLoadingMode !== "eager") return;
    let cancelled = false;

    readUserStatus(storyId, userId)
      .then((value) => {
        if (cancelled) return;
        setLiked(value);
        setResolvedUserStatusKey(`${storyId}:${userId}`);
      })
      .catch(() => {
        if (cancelled) return;
        setResolvedUserStatusKey(`${storyId}:${userId}`);
        setUnavailable(true);
      });
    return () => {
      cancelled = true;
    };
  }, [storyId, userId, userStatusLoadingMode]);

  const resolveUserStatus = useCallback(async (activeUserId: string) => {
    const key = `${storyId}:${activeUserId}`;
    if (resolvedUserStatusKey === key) return liked;

    const nextLiked = await readUserStatus(storyId, activeUserId);
    setLiked(nextLiked);
    setResolvedUserStatusKey(key);
    return nextLiked;
  }, [liked, resolvedUserStatusKey, storyId]);

  const toggle = useCallback(async (activeUserId = userId) => {
    if (!activeUserId || !supabaseEnabled) return;

    let activeLiked = liked;
    if (resolvedUserStatusKey !== `${storyId}:${activeUserId}`) {
      try {
        activeLiked = await resolveUserStatus(activeUserId);
      } catch {
        setUnavailable(true);
        return;
      }
    }

    if (engagementApiFor("likes", storyId)) {
      const nextLiked = !activeLiked;
      setLiked(nextLiked);
      setOptimisticDelta((c) => c + (nextLiked ? 1 : -1));
      try {
        await apiFetchAsUser("comments", `/api/write/likes?key=${encodeURIComponent(storyId)}`, {
          method: nextLiked ? "PUT" : "DELETE",
        });
        forgetEngagement("likes", storyId);
        return;
      } catch (error) {
        setLiked(activeLiked);
        setOptimisticDelta((c) => c - (nextLiked ? 1 : -1));
        if (!writeMayGoLegacy(error)) {
          setUnavailable(true);
          return;
        }
      }
    }

    if (activeLiked) {
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
  }, [storyId, userId, liked, resolvedUserStatusKey, resolveUserStatus]);

  return { count, liked, loading, unavailable, toggle };
}
