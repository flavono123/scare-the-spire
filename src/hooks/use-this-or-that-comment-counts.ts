"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase, supabaseEnabled, supabaseEnv } from "@/lib/supabase";
import { withSupabaseTimeout } from "@/lib/supabase-timeout";

interface UseThisOrThatCommentCountsReturn {
  counts: Record<string, number>;
  loading: boolean;
  unavailable: boolean;
}

interface CommentCountState {
  counts: Record<string, number>;
  loadedKey: string;
  unavailable: boolean;
}

const EMPTY_COUNTS: Record<string, number> = {};

function postIdKey(postIds: string[]) {
  return [...postIds].sort().join(":");
}

function threadKeyForPost(postId: string) {
  return `this-or-that:${postId}`;
}

export function useThisOrThatCommentCounts(
  postIds: string[],
): UseThisOrThatCommentCountsReturn {
  const [state, setState] = useState<CommentCountState>({
    counts: EMPTY_COUNTS,
    loadedKey: "",
    unavailable: !supabaseEnabled,
  });
  const key = useMemo(() => postIdKey(postIds), [postIds]);

  useEffect(() => {
    if (!supabaseEnabled || postIds.length === 0) {
      return;
    }

    let cancelled = false;

    const threadKeys = postIds.map(threadKeyForPost);
    withSupabaseTimeout(
      "this_or_that_comment_counts.select",
      supabase
        .from("comments")
        .select("story_id")
        .eq("env", supabaseEnv)
        .in("story_id", threadKeys),
    )
      .then(({ data, error }) => {
        if (error) throw error;
        if (cancelled) return;

        const nextCounts: Record<string, number> = {};
        for (const row of data ?? []) {
          const storyId = String((row as { story_id: unknown }).story_id ?? "");
          if (!storyId.startsWith("this-or-that:")) continue;
          const postId = storyId.slice("this-or-that:".length);
          nextCounts[postId] = (nextCounts[postId] ?? 0) + 1;
        }

        setState({ counts: nextCounts, loadedKey: key, unavailable: false });
      })
      .catch(() => {
        if (cancelled) return;
        setState({ counts: EMPTY_COUNTS, loadedKey: key, unavailable: true });
      });

    return () => {
      cancelled = true;
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    counts: postIds.length > 0 ? state.counts : EMPTY_COUNTS,
    loading: supabaseEnabled && postIds.length > 0 && state.loadedKey !== key,
    unavailable: state.unavailable,
  };
}
