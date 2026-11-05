"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Comment } from "@/hooks/use-comments";
import {
  engagementApiFor,
  loadEngagementMine,
  shouldUseLegacy,
  writeMayGoLegacy,
} from "@/lib/api-engagement";
import { apiFetchAsUser } from "@/lib/api-session";
import { supabase, supabaseEnabled } from "@/lib/supabase";

interface UseCommentLikesReturn {
  counts: Map<string, number>;
  liked: Set<string>;
  toggle: (commentId: string, activeUserId?: string) => void;
}

/**
 * Like counts and this user's likes for one thread's comments. On the api path
 * the counts come with the thread rows (`like_count`) and this user's likes
 * from /api/me/engagement (docs/supabase-exit/STEP1_DESIGN.md 9.1).
 */
export function useCommentLikes(threadKey: string, comments: readonly Comment[], userId: string | null): UseCommentLikesReturn {
  const [queriedCounts, setQueriedCounts] = useState<Map<string, number>>(new Map());
  // Counts this page changed by liking; they win over the loaded ones.
  const [toggledCounts, setToggledCounts] = useState<Map<string, number>>(new Map());
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const commentIds = comments.map((comment) => comment.id);
  const idsKey = commentIds.join(",");
  // Rows from the Worker carry their like counts; legacy rows do not and are counted by a query.
  const rowsCarryCounts = comments.length > 0 && comments.every((comment) => typeof comment.like_count === "number");
  const counts = useMemo(() => {
    const base = rowsCarryCounts
      ? new Map(comments.map((comment) => [comment.id, comment.like_count ?? 0]))
      : new Map(queriedCounts);
    for (const [id, count] of toggledCounts) base.set(id, count);
    return base;
  }, [comments, queriedCounts, rowsCarryCounts, toggledCounts]);

  useEffect(() => {
    if (commentIds.length === 0) return;
    let cancelled = false;

    const loadLegacyCounts = () => {
      if (!supabaseEnabled) return;
      supabase
        .from("comment_likes")
        .select("comment_id")
        .in("comment_id", commentIds)
        .then(({ data }) => {
          if (cancelled) return;
          const map = new Map<string, number>();
          for (const row of data ?? []) {
            map.set(row.comment_id, (map.get(row.comment_id) ?? 0) + 1);
          }
          setQueriedCounts(map);
        });
    };
    const loadLegacyMine = () => {
      if (!supabaseEnabled || !userId) return;
      supabase
        .from("comment_likes")
        .select("comment_id")
        .eq("user_id", userId)
        .in("comment_id", commentIds)
        .then(({ data }) => {
          if (cancelled) return;
          setLiked(new Set((data ?? []).map((r) => r.comment_id)));
        });
    };

    if (engagementApiFor("threads", threadKey)) {
      if (!rowsCarryCounts) loadLegacyCounts();
      if (userId) {
        loadEngagementMine("threads", threadKey)
          .then((ids) => {
            if (!cancelled) setLiked(new Set(ids));
          })
          .catch((error) => {
            // Other failures leave the hearts empty, as the legacy query ignores its errors.
            if (shouldUseLegacy(error)) loadLegacyMine();
          });
      }
      return () => {
        cancelled = true;
      };
    }

    loadLegacyCounts();
    loadLegacyMine();
    return () => {
      cancelled = true;
    };
  }, [idsKey, rowsCarryCounts, threadKey, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyToggle = useCallback((commentId: string, nowLiked: boolean, count?: number) => {
    setLiked((prev) => {
      const next = new Set(prev);
      if (nowLiked) next.add(commentId);
      else next.delete(commentId);
      return next;
    });
    const shown = counts.get(commentId);
    setToggledCounts((prev) => {
      const next = new Map(prev);
      next.set(commentId, count ?? (shown ?? (nowLiked ? 0 : 1)) + (nowLiked ? 1 : -1));
      return next;
    });
  }, [counts]);

  const toggle = useCallback(
    async (commentId: string, activeUserId = userId) => {
      if (!activeUserId || !supabaseEnabled) return;
      const wasLiked = liked.has(commentId);

      if (engagementApiFor("threads", threadKey)) {
        try {
          const result = await apiFetchAsUser<{ liked: boolean; count: number }>(
            "comments",
            `/api/write/comment-likes?id=${encodeURIComponent(commentId)}`,
            { method: wasLiked ? "DELETE" : "PUT" },
          );
          applyToggle(commentId, result.liked, result.count);
          return;
        } catch (error) {
          if (!writeMayGoLegacy(error)) return;
        }
      }

      if (wasLiked) {
        await supabase.from("comment_likes").delete().eq("comment_id", commentId).eq("user_id", activeUserId);
        applyToggle(commentId, false);
      } else {
        await supabase.from("comment_likes").insert({ comment_id: commentId, user_id: activeUserId });
        applyToggle(commentId, true);
      }
    },
    [applyToggle, liked, threadKey, userId],
  );

  return { counts, liked, toggle };
}
