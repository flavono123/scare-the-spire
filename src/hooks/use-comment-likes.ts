"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase, supabaseEnabled } from "@/lib/supabase";

interface UseCommentLikesReturn {
  counts: Map<string, number>;
  liked: Set<string>;
  toggle: (commentId: string) => void;
}

export function useCommentLikes(commentIds: string[], userId: string | null): UseCommentLikesReturn {
  const [counts, setCounts] = useState<Map<string, number>>(new Map());
  const [liked, setLiked] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!supabaseEnabled || commentIds.length === 0) return;

    // Fetch counts for all comments
    supabase
      .from("comment_likes")
      .select("comment_id")
      .in("comment_id", commentIds)
      .then(({ data }) => {
        const map = new Map<string, number>();
        for (const row of data ?? []) {
          map.set(row.comment_id, (map.get(row.comment_id) ?? 0) + 1);
        }
        setCounts(map);
      });

    // Fetch user's likes
    if (userId) {
      supabase
        .from("comment_likes")
        .select("comment_id")
        .eq("user_id", userId)
        .in("comment_id", commentIds)
        .then(({ data }) => {
          setLiked(new Set((data ?? []).map((r) => r.comment_id)));
        });
    }
  }, [commentIds.join(","), userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = useCallback(
    async (commentId: string) => {
      if (!userId || !supabaseEnabled) return;

      if (liked.has(commentId)) {
        await supabase.from("comment_likes").delete().eq("comment_id", commentId).eq("user_id", userId);
        setLiked((prev) => {
          const next = new Set(prev);
          next.delete(commentId);
          return next;
        });
        setCounts((prev) => {
          const next = new Map(prev);
          next.set(commentId, (next.get(commentId) ?? 1) - 1);
          return next;
        });
      } else {
        await supabase.from("comment_likes").insert({ comment_id: commentId, user_id: userId });
        setLiked((prev) => new Set(prev).add(commentId));
        setCounts((prev) => {
          const next = new Map(prev);
          next.set(commentId, (next.get(commentId) ?? 0) + 1);
          return next;
        });
      }
    },
    [userId, liked],
  );

  return { counts, liked, toggle };
}
