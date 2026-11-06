"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { shouldUseLegacy, writeMayGoLegacy } from "@/lib/api-client";
import { supabase, supabaseEnabled, supabaseEnv } from "@/lib/supabase";
import { withSupabaseTimeout } from "@/lib/supabase-timeout";
import { apiMyThisOrThatLikes, apiSetThisOrThatLike, apiThisOrThatLikeCounts, toyboxViaApi } from "@/lib/toybox-api";
import { TOYBOX_IDS_MAX } from "@/lib/toybox-api-rules";

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

/** The api reads at most TOYBOX_IDS_MAX unique ids a call; the legacy `.in()` takes them all. */
async function readInChunks<T>(postIds: string[], read: (ids: string[]) => Promise<T[]>): Promise<T[]> {
  const unique = [...new Set(postIds)];
  const reads: Promise<T[]>[] = [];
  for (let start = 0; start < unique.length; start += TOYBOX_IDS_MAX) {
    reads.push(read(unique.slice(start, start + TOYBOX_IDS_MAX)));
  }
  return (await Promise.all(reads)).flat();
}

export function useThisOrThatLikes(
  postIds: string[],
  userId: string | null,
  seedCounts: Record<string, number> = {},
): UseThisOrThatLikesReturn {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(supabaseEnabled && postIds.length > 0);
  const [unavailable, setUnavailable] = useState(!supabaseEnabled);
  const mutationVersion = useRef(0);
  const key = useMemo(() => postIdKey(postIds), [postIds]);

  useEffect(() => {
    if (!supabaseEnabled) return;
    if (postIds.length === 0) {
      return;
    }

    let cancelled = false;
    const requestMutationVersion = mutationVersion.current;

    const load = async (): Promise<{ countRows: unknown[]; likedRows: unknown[] }> => {
      if (toyboxViaApi()) {
        try {
          // docs/supabase-exit/STEP1_DESIGN.md 9.8: the same view and rows, through the Worker.
          const [countRows, likedIds] = await Promise.all([
            readInChunks(postIds, apiThisOrThatLikeCounts),
            userId ? readInChunks(postIds, apiMyThisOrThatLikes) : [],
          ]);
          return { countRows, likedRows: likedIds.map((post_id) => ({ post_id })) };
        } catch (error) {
          if (!shouldUseLegacy(error) || !supabaseEnabled) throw error;
        }
      }
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

      const [countResult, likedResult] = await Promise.all([countQuery, likedQuery]);
      if (countResult.error) throw countResult.error;
      if (likedResult.error) throw likedResult.error;
      return { countRows: countResult.data ?? [], likedRows: likedResult.data ?? [] };
    };

    load()
      .then(({ countRows, likedRows }) => {
        if (cancelled) return;
        if (requestMutationVersion !== mutationVersion.current) {
          setLoading(false);
          return;
        }

        const nextCounts: Record<string, number> = { ...seedCounts };
        for (const row of countRows) {
          const postId = String((row as { post_id: unknown }).post_id);
          nextCounts[postId] = Number((row as { like_count: unknown }).like_count ?? 0);
        }

        const nextLiked = new Set<string>();
        for (const row of likedRows) {
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
    mutationVersion.current += 1;
    setLiked((prev) => {
      const next = new Set(prev);
      if (currentlyLiked) next.delete(postId);
      else next.add(postId);
      return next;
    });
    setCounts((prev) => ({
      ...prev,
      [postId]: Math.max(0, (prev[postId] ?? seedCounts[postId] ?? 0) + (currentlyLiked ? -1 : 1)),
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

    // The builder above sends nothing until awaited, so the api path skips it.
    let apiResult: { error: unknown } | null = null;
    if (toyboxViaApi()) {
      try {
        await apiSetThisOrThatLike(postId, !currentlyLiked);
        apiResult = { error: null };
      } catch (apiError) {
        // Only a write that certainly did nothing is sent again on the legacy path.
        if (!writeMayGoLegacy(apiError)) apiResult = { error: apiError };
      }
    }
    const { error } = apiResult ?? await withSupabaseTimeout(
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
        [postId]: Math.max(0, (prev[postId] ?? seedCounts[postId] ?? 0) + (currentlyLiked ? 1 : -1)),
      }));
      setUnavailable(true);
    }
  }, [liked, seedCounts]);

  return { counts, liked, loading, unavailable, toggle };
}
