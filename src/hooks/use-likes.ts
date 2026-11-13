"use client";

import { useCallback, useEffect, useState } from "react";
import {
  engagementApiFor,
  forgetEngagement,
  loadEngagement,
  loadEngagementMine,
} from "@/lib/api-engagement";
import { apiFetchAsUser } from "@/lib/api-session";

interface UseLikesReturn {
  count: number;
  liked: boolean;
  loading: boolean;
  unavailable: boolean;
  toggle: (activeUserId?: string) => Promise<void>;
}

type UserStatusLoadingMode = "eager" | "lazy";

/**
 * Whether this user liked the key, from /api/me/engagement (the Worker knows the user). A key the
 * Worker refuses is an empty thread: not liked.
 */
async function readUserStatus(storyId: string): Promise<boolean> {
  return engagementApiFor("likes", storyId) ? loadEngagementMine("likes", storyId) : false;
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
  const [countLoading, setCountLoading] = useState(initialCount === undefined);
  const [resolvedUserStatusKey, setResolvedUserStatusKey] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [seenInitialCount, setSeenInitialCount] = useState(initialCount);
  if (seenInitialCount !== initialCount) {
    setSeenInitialCount(initialCount);
    setOptimisticDelta(0);
  }
  const count = Math.max(0, (initialCount ?? fetchedCount) + optimisticDelta);
  const userStatusKey = userId ? `${storyId}:${userId}` : null;
  const userStatusLoading = !!userStatusKey && resolvedUserStatusKey !== userStatusKey;
  const loading = countLoading || (userStatusLoadingMode === "eager" && userStatusLoading);

  // Count query — independent of auth
  useEffect(() => {
    if (initialCount !== undefined) {
      return;
    }
    let cancelled = false;
    // A key the Worker refuses is an empty thread: no likes.
    const read = engagementApiFor("likes", storyId) ? loadEngagement("likes", storyId) : Promise.resolve(0);
    read
      .then((c) => {
        if (cancelled) return;
        setFetchedCount(c);
        setUnavailable(false);
        setCountLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setUnavailable(true);
        setCountLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [storyId, initialCount]);

  // User like status — depends on auth
  useEffect(() => {
    if (!userId) return;
    if (userStatusLoadingMode !== "eager") return;
    let cancelled = false;

    readUserStatus(storyId)
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

    const nextLiked = await readUserStatus(storyId);
    setLiked(nextLiked);
    setResolvedUserStatusKey(key);
    return nextLiked;
  }, [liked, resolvedUserStatusKey, storyId]);

  const toggle = useCallback(async (activeUserId = userId) => {
    if (!activeUserId) return;

    let activeLiked = liked;
    if (resolvedUserStatusKey !== `${storyId}:${activeUserId}`) {
      try {
        activeLiked = await resolveUserStatus(activeUserId);
      } catch {
        setUnavailable(true);
        return;
      }
    }

    // A key the Worker refuses takes no like, as the closed direct insert refused it.
    if (!engagementApiFor("likes", storyId)) {
      setUnavailable(true);
      return;
    }
    const nextLiked = !activeLiked;
    setLiked(nextLiked);
    setOptimisticDelta((c) => c + (nextLiked ? 1 : -1));
    try {
      await apiFetchAsUser("comments", `/api/write/likes?key=${encodeURIComponent(storyId)}`, {
        method: nextLiked ? "PUT" : "DELETE",
      });
      forgetEngagement("likes", storyId);
    } catch {
      setLiked(activeLiked);
      setOptimisticDelta((c) => c - (nextLiked ? 1 : -1));
      setUnavailable(true);
    }
  }, [storyId, userId, liked, resolvedUserStatusKey, resolveUserStatus]);

  return { count, liked, loading, unavailable, toggle };
}
