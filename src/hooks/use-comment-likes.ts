"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Comment } from "@/hooks/use-comments";
import {
  engagementApiFor,
  forgetEngagement,
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
 * from /api/me/engagement, asked as soon as the thread mounts so it joins the
 * page's first batch (docs/supabase-exit/STEP1_DESIGN.md 9.1).
 */
export function useCommentLikes(threadKey: string, comments: readonly Comment[], userId: string | null): UseCommentLikesReturn {
  // Legacy: counted by a query, and toggles adjust it so a later query result replaces them.
  const [queriedCounts, setQueriedCounts] = useState<Map<string, number>>(new Map());
  // Api: counts a write answered (or adjusted when it could not count); they win over the rows'.
  const [writtenCounts, setWrittenCounts] = useState<{ threadKey: string; counts: Map<string, number> }>({
    threadKey,
    counts: new Map(),
  });
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const commentIds = comments.map((comment) => comment.id);
  const idsKey = commentIds.join(",");
  const idsRef = useRef<string[]>(commentIds);
  useEffect(() => {
    idsRef.current = commentIds;
  });
  // Rows from the Worker carry their like counts; legacy rows do not and are counted by a query.
  const rowsCarryCounts = comments.length > 0 && comments.every((comment) => typeof comment.like_count === "number");
  const counts = useMemo(() => {
    if (!rowsCarryCounts) return queriedCounts;
    const base = new Map(comments.map((comment) => [comment.id, comment.like_count ?? 0]));
    if (writtenCounts.threadKey === threadKey) {
      for (const [id, count] of writtenCounts.counts) base.set(id, count);
    }
    return base;
  }, [comments, queriedCounts, rowsCarryCounts, threadKey, writtenCounts]);

  const loadLegacyMine = useCallback((ids: readonly string[], isCancelled: () => boolean) => {
    if (!supabaseEnabled || !userId || ids.length === 0) return;
    supabase
      .from("comment_likes")
      .select("comment_id")
      .eq("user_id", userId)
      .in("comment_id", [...ids])
      .then(({ data }) => {
        if (isCancelled()) return;
        setLiked(new Set((data ?? []).map((r) => r.comment_id)));
      });
  }, [userId]);

  // Legacy counts and likes, keyed on the comment ids like before.
  useEffect(() => {
    if (commentIds.length === 0) return;
    let cancelled = false;
    const viaApi = engagementApiFor("threads", threadKey);
    if ((!viaApi || !rowsCarryCounts) && supabaseEnabled) {
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
    }
    if (!viaApi) loadLegacyMine(commentIds, () => cancelled);
    return () => {
      cancelled = true;
    };
  }, [idsKey, rowsCarryCounts, threadKey, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Api: this user's likes for the whole thread, without waiting for the rows.
  useEffect(() => {
    if (!userId || !engagementApiFor("threads", threadKey)) return;
    let cancelled = false;
    loadEngagementMine("threads", threadKey)
      .then((ids) => {
        if (!cancelled) setLiked(new Set(ids));
      })
      .catch((error) => {
        // Other failures leave the hearts empty, as the legacy query ignores its errors.
        if (shouldUseLegacy(error)) loadLegacyMine(idsRef.current, () => cancelled);
      });
    return () => {
      cancelled = true;
    };
  }, [loadLegacyMine, threadKey, userId]);

  const applyToggle = useCallback((commentId: string, nowLiked: boolean, count?: number | null) => {
    setLiked((prev) => {
      const next = new Set(prev);
      if (nowLiked) next.add(commentId);
      else next.delete(commentId);
      return next;
    });
    if (rowsCarryCounts) {
      const shown = counts.get(commentId) ?? (nowLiked ? 0 : 1);
      const value = typeof count === "number" ? count : Math.max(0, shown + (nowLiked ? 1 : -1));
      setWrittenCounts((prev) => {
        const next = new Map(prev.threadKey === threadKey ? prev.counts : []);
        next.set(commentId, value);
        return { threadKey, counts: next };
      });
      return;
    }
    setQueriedCounts((prev) => {
      const next = new Map(prev);
      next.set(commentId, typeof count === "number" ? count : (next.get(commentId) ?? (nowLiked ? 0 : 1)) + (nowLiked ? 1 : -1));
      return next;
    });
  }, [counts, rowsCarryCounts, threadKey]);

  const toggle = useCallback(
    async (commentId: string, activeUserId = userId) => {
      if (!activeUserId || !supabaseEnabled) return;
      const wasLiked = liked.has(commentId);

      if (engagementApiFor("threads", threadKey)) {
        try {
          const result = await apiFetchAsUser<{ liked: boolean; count: number | null }>(
            "comments",
            `/api/write/comment-likes?id=${encodeURIComponent(commentId)}`,
            { method: wasLiked ? "DELETE" : "PUT" },
          );
          // Held thread rows carry the old like_count; a remount must read again.
          forgetEngagement("threads", threadKey);
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
