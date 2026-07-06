"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase, supabaseEnabled, supabaseEnv } from "@/lib/supabase";
import { withSupabaseTimeout } from "@/lib/supabase-timeout";
import {
  isStoryReactionType,
  mergeStoryReactionCounts,
  type StoryReactionCounts,
  type StoryReactionType,
} from "@/lib/reactions";

interface UseStoryReactionsReturn {
  counts: StoryReactionCounts;
  total: number;
  selectedReaction: StoryReactionType | null;
  loading: boolean;
  unavailable: boolean;
  selectReaction: (reactionType: StoryReactionType, activeUserId?: string) => Promise<void>;
}

type UserStatusLoadingMode = "eager" | "lazy";

function sumCounts(counts: StoryReactionCounts): number {
  return Object.values(counts).reduce((total, count) => total + Math.max(0, count ?? 0), 0);
}

function rowsToCounts(rows: Array<{ reaction_type: unknown; reaction_count?: unknown }>): StoryReactionCounts {
  const counts: StoryReactionCounts = {};
  for (const row of rows) {
    if (!isStoryReactionType(row.reaction_type)) continue;
    const count = Number(row.reaction_count ?? 1);
    if (Number.isFinite(count) && count > 0) {
      counts[row.reaction_type] = (counts[row.reaction_type] ?? 0) + count;
    }
  }
  return counts;
}

function withDelta(counts: StoryReactionCounts, reactionType: StoryReactionType, delta: number): StoryReactionCounts {
  return {
    ...counts,
    [reactionType]: (counts[reactionType] ?? 0) + delta,
  };
}

export function useStoryReactions(
  storyId: string,
  userId: string | null,
  {
    initialCounts,
    initialTotal,
    userStatusLoading: userStatusLoadingMode = "eager",
  }: {
    initialCounts?: StoryReactionCounts;
    initialTotal?: number;
    userStatusLoading?: UserStatusLoadingMode;
  } = {},
): UseStoryReactionsReturn {
  const [fetchedCounts, setFetchedCounts] = useState<StoryReactionCounts>({});
  const [optimisticDelta, setOptimisticDelta] = useState<StoryReactionCounts>({});
  const [selectedReaction, setSelectedReaction] = useState<StoryReactionType | null>(null);
  const [fetchedCountLoading, setFetchedCountLoading] = useState(supabaseEnabled);
  const [resolvedUserStatusKey, setResolvedUserStatusKey] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  const baseCounts = initialCounts ?? fetchedCounts;
  const counts = useMemo(() => mergeStoryReactionCounts(baseCounts, optimisticDelta), [baseCounts, optimisticDelta]);
  const total = Math.max(0, sumCounts(counts) || initialTotal || 0);
  const countLoading = initialCounts === undefined && fetchedCountLoading;
  const userStatusKey = userId ? `${storyId}:${userId}` : null;
  const userStatusLoading = supabaseEnabled && !!userStatusKey && resolvedUserStatusKey !== userStatusKey;
  const loading = countLoading || (userStatusLoadingMode === "eager" && userStatusLoading);

  useEffect(() => {
    if (initialCounts !== undefined) {
      return;
    }
    if (!supabaseEnabled) return;

    withSupabaseTimeout(
      "story_reactions.count",
      supabase
        .from("likes")
        .select("reaction_type")
        .eq("story_id", storyId)
        .eq("env", supabaseEnv),
    )
      .then(({ data, error }) => {
        if (error) throw error;
        setFetchedCounts(rowsToCounts((data ?? []) as Array<{ reaction_type: unknown }>));
        setUnavailable(false);
        setFetchedCountLoading(false);
      })
      .catch(() => {
        setUnavailable(true);
        setFetchedCountLoading(false);
      });
  }, [storyId, initialCounts]);

  useEffect(() => {
    if (!supabaseEnabled || !userId) return;
    if (userStatusLoadingMode !== "eager") return;

    withSupabaseTimeout(
      "story_reactions.user_status",
      supabase
        .from("likes")
        .select("reaction_type")
        .eq("story_id", storyId)
        .eq("user_id", userId)
        .eq("env", supabaseEnv)
        .maybeSingle(),
    )
      .then(({ data, error }) => {
        if (error) throw error;
        const reactionType = (data as { reaction_type?: unknown } | null)?.reaction_type;
        setSelectedReaction(isStoryReactionType(reactionType) ? reactionType : null);
        setResolvedUserStatusKey(`${storyId}:${userId}`);
      })
      .catch(() => {
        setResolvedUserStatusKey(`${storyId}:${userId}`);
        setUnavailable(true);
      });
  }, [storyId, userId, userStatusLoadingMode]);

  const resolveUserReaction = useCallback(async (activeUserId: string) => {
    const key = `${storyId}:${activeUserId}`;
    if (resolvedUserStatusKey === key) return selectedReaction;

    const { data, error } = await withSupabaseTimeout(
      "story_reactions.user_status",
      supabase
        .from("likes")
        .select("reaction_type")
        .eq("story_id", storyId)
        .eq("user_id", activeUserId)
        .eq("env", supabaseEnv)
        .maybeSingle(),
    );
    if (error) throw error;
    const reactionType = (data as { reaction_type?: unknown } | null)?.reaction_type;
    const nextReaction = isStoryReactionType(reactionType) ? reactionType : null;
    setSelectedReaction(nextReaction);
    setResolvedUserStatusKey(key);
    return nextReaction;
  }, [resolvedUserStatusKey, selectedReaction, storyId]);

  const selectReaction = useCallback(async (reactionType: StoryReactionType, activeUserId = userId) => {
    if (!activeUserId || !supabaseEnabled) return;

    let activeReaction = selectedReaction;
    if (resolvedUserStatusKey !== `${storyId}:${activeUserId}`) {
      try {
        activeReaction = await resolveUserReaction(activeUserId);
      } catch {
        setUnavailable(true);
        return;
      }
    }

    if (activeReaction === reactionType) {
      setSelectedReaction(null);
      setOptimisticDelta((counts) => withDelta(counts, reactionType, -1));
      withSupabaseTimeout(
        "story_reactions.delete",
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
          setSelectedReaction(reactionType);
          setOptimisticDelta((counts) => withDelta(counts, reactionType, 1));
          setUnavailable(true);
        });
      return;
    }

    if (activeReaction) {
      setSelectedReaction(reactionType);
      setOptimisticDelta((counts) => withDelta(withDelta(counts, activeReaction, -1), reactionType, 1));
      withSupabaseTimeout(
        "story_reactions.update",
        supabase
          .from("likes")
          .update({ reaction_type: reactionType })
          .eq("story_id", storyId)
          .eq("user_id", activeUserId)
          .eq("env", supabaseEnv),
      )
        .then(({ error }) => {
          if (error) throw error;
        })
        .catch(() => {
          setSelectedReaction(activeReaction);
          setOptimisticDelta((counts) => withDelta(withDelta(counts, reactionType, -1), activeReaction, 1));
          setUnavailable(true);
        });
      return;
    }

    setSelectedReaction(reactionType);
    setOptimisticDelta((counts) => withDelta(counts, reactionType, 1));
    withSupabaseTimeout(
      "story_reactions.insert",
      supabase
        .from("likes")
        .insert({ story_id: storyId, user_id: activeUserId, env: supabaseEnv, reaction_type: reactionType }),
    )
      .then(({ error }) => {
        if (error) throw error;
      })
      .catch(() => {
        setSelectedReaction(null);
        setOptimisticDelta((counts) => withDelta(counts, reactionType, -1));
        setUnavailable(true);
      });
  }, [storyId, userId, selectedReaction, resolvedUserStatusKey, resolveUserReaction]);

  return { counts, total, selectedReaction, loading, unavailable, selectReaction };
}
