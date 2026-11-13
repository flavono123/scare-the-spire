"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { requireApiVersion } from "@/lib/api-client";
import { apiFetchAsUser } from "@/lib/api-session";
import type { PostBlock } from "@/lib/chemical-types";
import {
  PROFILE_ACTIVITY_CATEGORIES,
  type ProfileActivityCategory,
  type ProfileActivityFilter,
  type ProfileActivitySort,
} from "@/lib/profile-activity-rules";

export {
  PROFILE_ACTIVITY_CATEGORIES,
  type ProfileActivityCategory,
  type ProfileActivityFilter,
  type ProfileActivitySort,
};

export interface ProfileActivityItem {
  activityId: string;
  category: ProfileActivityCategory;
  content: string;
  contentBlocks: PostBlock[] | null;
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
  content_blocks: PostBlock[] | null;
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

type RowsBody<T> = { v?: number; rows?: T[] };

/**
 * Stats rows from the Worker (docs/supabase-exit/STEP1_DESIGN.md 9.4). Step 6
 * (docs/supabase-exit/STEP6_PLAN.md WP-D): there is no RPC path, so any failure,
 * a former legacy signal included, throws and the profile shows its notice.
 */
export async function readStatsRows(): Promise<ProfileActivityStatsRow[]> {
  const body = await apiFetchAsUser<RowsBody<ProfileActivityStatsRow>>("profile", "/api/me/profile/stats");
  requireApiVersion("profile", body);
  return body.rows ?? [];
}

/** One activity page, by the same route as the stats. */
export async function readActivityRows(
  filter: ProfileActivityFilter,
  sort: ProfileActivitySort,
  offset: number,
): Promise<ProfileActivityRow[]> {
  const query = new URLSearchParams({ category: filter, sort, offset: String(offset) });
  const body = await apiFetchAsUser<RowsBody<ProfileActivityRow>>("profile", `/api/me/profile/activity?${query}`);
  requireApiVersion("profile", body);
  return body.rows ?? [];
}

function emptyStats(): ProfileActivityStats {
  return {
    stories: { postCount: 0, likeCount: 0 },
    chemical_x: { postCount: 0, likeCount: 0 },
    this_or_that: { postCount: 0, likeCount: 0 },
    combo: { postCount: 0, likeCount: 0 },
    comments: { postCount: 0, likeCount: 0 },
    history_course: { postCount: 0, likeCount: 0 },
  };
}

function normalizeItem(row: ProfileActivityRow): ProfileActivityItem {
  return {
    activityId: row.activity_id,
    category: row.category,
    content: row.content,
    contentBlocks: row.content_blocks,
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
  const [statsUnavailable, setStatsUnavailable] = useState(false);
  const [itemsUnavailable, setItemsUnavailable] = useState(false);
  const queryKeyRef = useRef("");
  queryKeyRef.current = `${userId ?? "guest"}:${filter}:${sort}`;

  useEffect(() => {
    if (!userId) {
      setStats(emptyStats());
      setStatsLoading(false);
      setStatsUnavailable(false);
      return;
    }

    let cancelled = false;
    setStatsLoading(true);

    readStatsRows()
      .then((data) => {
        if (cancelled) return;

        const nextStats = emptyStats();
        for (const row of data) {
          if (!PROFILE_ACTIVITY_CATEGORIES.includes(row.category)) continue;
          nextStats[row.category] = {
            postCount: Number(row.post_count),
            likeCount: Number(row.like_count),
          };
        }
        setStats(nextStats);
        setStatsUnavailable(false);
      })
      .catch(() => {
        if (!cancelled) setStatsUnavailable(true);
      })
      .finally(() => {
        if (!cancelled) setStatsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setItems([]);
      setTotalCount(0);
      setItemsLoading(false);
      setItemsUnavailable(false);
      return;
    }

    let cancelled = false;
    setItems([]);
    setTotalCount(0);
    setItemsLoading(true);

    readActivityRows(filter, sort, 0)
      .then((rows) => {
        if (cancelled) return;

        setItems(rows.map(normalizeItem));
        setTotalCount(rows[0] ? Number(rows[0].total_count) : 0);
        setItemsUnavailable(false);
      })
      .catch(() => {
        if (!cancelled) setItemsUnavailable(true);
      })
      .finally(() => {
        if (!cancelled) setItemsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [filter, sort, userId]);

  const loadMore = useCallback(async () => {
    if (!userId || loadingMore || items.length >= totalCount) return;
    const queryKey = queryKeyRef.current;
    setLoadingMore(true);

    try {
      const rows = await readActivityRows(filter, sort, items.length);
      if (queryKeyRef.current !== queryKey) return;

      setItems((current) => [...current, ...rows.map(normalizeItem)]);
      if (rows[0]) setTotalCount(Number(rows[0].total_count));
      setItemsUnavailable(false);
    } catch {
      if (queryKeyRef.current === queryKey) setItemsUnavailable(true);
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
    unavailable: statsUnavailable || itemsUnavailable,
    loadMore,
  };
}
