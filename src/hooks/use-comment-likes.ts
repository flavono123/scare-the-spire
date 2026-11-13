"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Comment } from "@/hooks/use-comments";
import { engagementApiFor, forgetEngagement, loadEngagementMine } from "@/lib/api-engagement";
import { apiFetchAsUser } from "@/lib/api-session";

interface UseCommentLikesReturn {
  counts: Map<string, number>;
  liked: Set<string>;
  toggle: (commentId: string, activeUserId?: string) => void;
}

/**
 * Like counts and this user's likes for one thread's comments. The counts come
 * with the thread rows (`like_count`) and this user's likes from
 * /api/me/engagement, asked as soon as the thread mounts so it joins the page's
 * first batch (docs/supabase-exit/STEP1_DESIGN.md 9.1).
 */
export function useCommentLikes(threadKey: string, comments: readonly Comment[], userId: string | null): UseCommentLikesReturn {
  // Counts a write answered (or adjusted when it could not count); they win over the rows'.
  const [writtenCounts, setWrittenCounts] = useState<{ threadKey: string; counts: Map<string, number> }>({
    threadKey,
    counts: new Map(),
  });
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const counts = useMemo(() => {
    const base = new Map(comments.map((comment) => [comment.id, comment.like_count ?? 0]));
    if (writtenCounts.threadKey === threadKey) {
      for (const [id, count] of writtenCounts.counts) base.set(id, count);
    }
    return base;
  }, [comments, threadKey, writtenCounts]);

  // This user's likes for the whole thread, without waiting for the rows. A key the Worker
  // refuses is an empty thread, with no likes.
  useEffect(() => {
    if (!userId || !engagementApiFor("threads", threadKey)) return;
    let cancelled = false;
    loadEngagementMine("threads", threadKey)
      .then((ids) => {
        if (!cancelled) setLiked(new Set(ids));
      })
      // A failure leaves the hearts empty.
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [threadKey, userId]);

  const applyToggle = useCallback((commentId: string, nowLiked: boolean, count: number | null) => {
    setLiked((prev) => {
      const next = new Set(prev);
      if (nowLiked) next.add(commentId);
      else next.delete(commentId);
      return next;
    });
    const shown = counts.get(commentId) ?? (nowLiked ? 0 : 1);
    const value = typeof count === "number" ? count : Math.max(0, shown + (nowLiked ? 1 : -1));
    setWrittenCounts((prev) => {
      const next = new Map(prev.threadKey === threadKey ? prev.counts : []);
      next.set(commentId, value);
      return { threadKey, counts: next };
    });
  }, [counts, threadKey]);

  const toggle = useCallback(
    async (commentId: string, activeUserId = userId) => {
      // A refused key has no comment to like.
      if (!activeUserId || !engagementApiFor("threads", threadKey)) return;
      const wasLiked = liked.has(commentId);
      try {
        const result = await apiFetchAsUser<{ liked: boolean; count: number | null }>(
          "comments",
          `/api/write/comment-likes?id=${encodeURIComponent(commentId)}`,
          { method: wasLiked ? "DELETE" : "PUT" },
        );
        // Held thread rows carry the old like_count; a remount must read again.
        forgetEngagement("threads", threadKey);
        applyToggle(commentId, result.liked, result.count);
      } catch {
        // The heart stays as it was.
      }
    },
    [applyToggle, liked, threadKey, userId],
  );

  return { counts, liked, toggle };
}
