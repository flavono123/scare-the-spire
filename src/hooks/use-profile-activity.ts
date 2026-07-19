"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase, supabaseEnabled, supabaseEnv } from "@/lib/supabase";
import { withSupabaseTimeout } from "@/lib/supabase-timeout";

export const PROFILE_ACTIVITY_CATEGORIES = [
  "stories",
  "chemical_x",
  "this_or_that",
  "comments",
] as const;

export type ProfileActivityCategory = (typeof PROFILE_ACTIVITY_CATEGORIES)[number];
export type ProfileActivityFilter = "all" | ProfileActivityCategory;
export type ProfileActivitySort = "latest" | "likes";

export interface ProfileActivityItem {
  activityId: string;
  category: ProfileActivityCategory;
  content: string;
  targetKey: string;
  createdAt: string;
  likeCount: number;
}

export interface ProfileActivityStat {
  postCount: number;
  likeCount: number;
}

type ProfileActivityStats = Record<ProfileActivityCategory, ProfileActivityStat>;

interface ProfileActivityRow {
  activity_id: string;
  category: ProfileActivityCategory;
  content: string;
  target_key: string;
  created_at: string;
  like_count: number | string;
  total_count: number | string;
}

interface ProfileActivityStatsRow {
  category: ProfileActivityCategory;
  post_count: number | string;
  like_count: number | string;
}

const PAGE_SIZE = 20;

function emptyStats(): ProfileActivityStats {
  return {
    stories: { postCount: 0, likeCount: 0 },
    chemical_x: { postCount: 0, likeCount: 0 },
    this_or_that: { postCount: 0, likeCount: 0 },
    comments: { postCount: 0, likeCount: 0 },
  };
}

function normalizeItem(row: ProfileActivityRow): ProfileActivityItem {
  return {
    activityId: row.activity_id,
    category: row.category,
    content: row.content,
    targetKey: row.target_key,
    createdAt: row.created_at,
    likeCount: Number(row.like_count),
  };
}

export function useProfileActivity(
  userId: string | null,
  filter: ProfileActivityFilter,
  sort: ProfileActivitySort,
) {
  const [stats, setStats] = useState<ProfileActivityStats>(emptyStats);
  const [items, setItems] = useState<ProfileActivityItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [statsLoading, setStatsLoading] = useState(false);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [unavailable, setUnavailable] = useState(!supabaseEnabled);

  useEffect(() => {
    if (!supabaseEnabled || !userId) {
      setStats(emptyStats());
      setStatsLoading(false);
      return;
    }

    let cancelled = false;
    setStatsLoading(true);

    withSupabaseTimeout(
      "profile_activity.stats",
      supabase.rpc("get_my_profile_activity_stats", { p_env: supabaseEnv }),
    )
      .then(({ data, error }) => {
        if (error) throw error;
        if (cancelled) return;

        const nextStats = emptyStats();
        for (const row of (data ?? []) as ProfileActivityStatsRow[]) {
          if (!PROFILE_ACTIVITY_CATEGORIES.includes(row.category)) continue;
          nextStats[row.category] = {
            postCount: Number(row.post_count),
            likeCount: Number(row.like_count),
          };
        }
        setStats(nextStats);
        setUnavailable(false);
      })
      .catch(() => {
        if (!cancelled) setUnavailable(true);
      })
      .finally(() => {
        if (!cancelled) setStatsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!supabaseEnabled || !userId) {
      setItems([]);
      setTotalCount(0);
      setItemsLoading(false);
      return;
    }

    let cancelled = false;
    setItems([]);
    setTotalCount(0);
    setItemsLoading(true);

    withSupabaseTimeout(
      "profile_activity.list",
      supabase.rpc("get_my_profile_activity", {
        p_env: supabaseEnv,
        p_category: filter,
        p_sort: sort,
        p_limit: PAGE_SIZE,
        p_offset: 0,
      }),
    )
      .then(({ data, error }) => {
        if (error) throw error;
        if (cancelled) return;

        const rows = (data ?? []) as ProfileActivityRow[];
        setItems(rows.map(normalizeItem));
        setTotalCount(rows[0] ? Number(rows[0].total_count) : 0);
        setUnavailable(false);
      })
      .catch(() => {
        if (!cancelled) setUnavailable(true);
      })
      .finally(() => {
        if (!cancelled) setItemsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [filter, sort, userId]);

  const loadMore = useCallback(async () => {
    if (!supabaseEnabled || !userId || loadingMore || items.length >= totalCount) return;
    setLoadingMore(true);

    try {
      const { data, error } = await withSupabaseTimeout(
        "profile_activity.more",
        supabase.rpc("get_my_profile_activity", {
          p_env: supabaseEnv,
          p_category: filter,
          p_sort: sort,
          p_limit: PAGE_SIZE,
          p_offset: items.length,
        }),
      );
      if (error) throw error;

      const rows = (data ?? []) as ProfileActivityRow[];
      setItems((current) => [...current, ...rows.map(normalizeItem)]);
      if (rows[0]) setTotalCount(Number(rows[0].total_count));
      setUnavailable(false);
    } catch {
      setUnavailable(true);
    } finally {
      setLoadingMore(false);
    }
  }, [filter, items.length, loadingMore, sort, totalCount, userId]);

  const totals = useMemo(
    () => PROFILE_ACTIVITY_CATEGORIES.reduce(
      (total, category) => ({
        postCount: total.postCount + stats[category].postCount,
        likeCount: total.likeCount + stats[category].likeCount,
      }),
      { postCount: 0, likeCount: 0 },
    ),
    [stats],
  );

  return {
    stats,
    totals,
    items,
    totalCount,
    loading: statsLoading || itemsLoading,
    loadingMore,
    unavailable,
    loadMore,
  };
}
