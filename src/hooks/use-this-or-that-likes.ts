"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase, supabaseEnabled, supabaseEnv } from "@/lib/supabase";
import { withSupabaseTimeout } from "@/lib/supabase-timeout";

interface UseThisOrThatLikesReturn {
  counts: Record<string, number>;
  liked: Set<string>;
  loading: boolean;
  unavailable: boolean;
  toggle: (postId: string, activeUserId: string) => Promise<void>;
}

function postIdKey(postIds: string[]) {
  return [...postIds].sort().join(":");
}

export function useThisOrThatLikes(
  postIds: string[],
  userId: string | null,
): UseThisOrThatLikesReturn {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(supabaseEnabled && postIds.length > 0);
  const [unavailable, setUnavailable] = useState(!supabaseEnabled);
  const key = useMemo(() => postIdKey(postIds), [postIds]);

  useEffect(() => {
    if (!supabaseEnabled) return;
    if (postIds.length === 0) {
      setCounts({});
      setLiked(new Set());
      setLoading(false);
      setUnavailable(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const countQuery = withSupabaseTimeout(
      "this_or_that_post_like_counts.select",
      supabase
        .from("this_or_that_post_like_counts")
        .select("post_id,like_count")
        .eq("env", supabaseEnv)
        .in("post_id", postIds),
    );
    const likedQuery = userId
      ? withSupabaseTimeout(
          "this_or_that_post_likes.user_status",
          supabase
            .from("this_or_that_post_likes")
            .select("post_id")
            .eq("env", supabaseEnv)
            .eq("user_id", userId)
            .in("post_id", postIds),
        )
      : Promise.resolve({ data: [], error: null });

    Promise.all([countQuery, likedQuery])
      .then(([countResult, likedResult]) => {
        if (countResult.error) throw countResult.error;
        if (likedResult.error) throw likedResult.error;
        if (cancelled) return;

        const nextCounts: Record<string, number> = {};
        for (const row of countResult.data ?? []) {
          const postId = String((row as { post_id: unknown }).post_id);
          nextCounts[postId] = Number((row as { like_count: unknown }).like_count ?? 0);
        }

        const nextLiked = new Set<string>();
        for (const row of likedResult.data ?? []) {
          nextLiked.add(String((row as { post_id: unknown }).post_id));
        }

        setCounts(nextCounts);
        setLiked(nextLiked);
        setUnavailable(false);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setUnavailable(true);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [key, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = useCallback(async (postId: string, activeUserId: string) => {
    if (!supabaseEnabled || !activeUserId) return;

    const currentlyLiked = liked.has(postId);
    setLiked((prev) => {
      const next = new Set(prev);
      if (currentlyLiked) next.delete(postId);
      else next.add(postId);
      return next;
    });
    setCounts((prev) => ({
      ...prev,
      [postId]: Math.max(0, (prev[postId] ?? 0) + (currentlyLiked ? -1 : 1)),
    }));

    const request = currentlyLiked
      ? supabase
          .from("this_or_that_post_likes")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", activeUserId)
          .eq("env", supabaseEnv)
      : supabase
          .from("this_or_that_post_likes")
          .insert({ post_id: postId, user_id: activeUserId, env: supabaseEnv });

    const { error } = await withSupabaseTimeout(
      currentlyLiked ? "this_or_that_post_likes.delete" : "this_or_that_post_likes.insert",
      request,
    ).catch(() => ({ error: new Error("timeout") }));

    if (error) {
      setLiked((prev) => {
        const next = new Set(prev);
        if (currentlyLiked) next.add(postId);
        else next.delete(postId);
        return next;
      });
      setCounts((prev) => ({
        ...prev,
        [postId]: Math.max(0, (prev[postId] ?? 0) + (currentlyLiked ? 1 : -1)),
      }));
      setUnavailable(true);
    }
  }, [liked]);

  return { counts, liked, loading, unavailable, toggle };
}
