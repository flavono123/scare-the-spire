"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { shouldUseLegacy } from "@/lib/api-client";
import { apiFetchAsUser } from "@/lib/api-session";
import type { PostBlock } from "@/lib/chemical-types";
import {
  PROFILE_ACTIVITY_CATEGORIES,
  PROFILE_ACTIVITY_PAGE_SIZE,
  type ProfileActivityCategory,
  type ProfileActivityFilter,
  type ProfileActivitySort,
} from "@/lib/profile-activity-rules";
import { surfacePath } from "@/lib/runtime-flags";
import { supabase, supabaseEnabled, supabaseEnv } from "@/lib/supabase";
import { withSupabaseTimeout } from "@/lib/supabase-timeout";

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

const PAGE_SIZE = PROFILE_ACTIVITY_PAGE_SIZE;

type RowsBody<T> = { v?: number; rows?: T[] };

/** Stats rows: the Worker on the api path (docs/supabase-exit/STEP1_DESIGN.md 9.4), else the RPC. */
async function readStatsRows(): Promise<ProfileActivityStatsRow[]> {
  if (surfacePath("profile") === "api") {
    try {
      const body = await apiFetchAsUser<RowsBody<ProfileActivityStatsRow>>("profile", "/api/me/profile/stats");
      if (body?.v !== 1) throw new Error("bad profile stats");
      return body.rows ?? [];
    } catch (error) {
      if (!shouldUseLegacy(error)) throw error;
    }
  }
  const { data, error } = await withSupabaseTimeout(
    "profile_activity.stats",
    supabase.rpc("get_my_profile_activity_stats", { p_env: supabaseEnv }),
  );
  if (error) throw error;
  return (data ?? []) as ProfileActivityStatsRow[];
}

/** One activity page, by the same route as the stats. */
async function readActivityRows(
  filter: ProfileActivityFilter,
  sort: ProfileActivitySort,
  offset: number,
  operation: string,
): Promise<ProfileActivityRow[]> {
  if (surfacePath("profile") === "api") {
    try {
      const query = new URLSearchParams({ category: filter, sort, offset: String(offset) });
      const body = await apiFetchAsUser<RowsBody<ProfileActivityRow>>("profile", `/api/me/profile/activity?${query}`);
      if (body?.v !== 1) throw new Error("bad profile activity");
      return body.rows ?? [];
    } catch (error) {
      if (!shouldUseLegacy(error)) throw error;
    }
  }
  const { data, error } = await withSupabaseTimeout(
    operation,
    supabase.rpc("get_my_profile_activity", {
      p_env: supabaseEnv,
      p_category: filter,
      p_sort: sort,
      p_limit: PAGE_SIZE,
      p_offset: offset,
    }),
  );
  if (error) throw error;
  return (data ?? []) as ProfileActivityRow[];
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
  const [statsUnavailable, setStatsUnavailable] = useState(!supabaseEnabled);
  const [itemsUnavailable, setItemsUnavailable] = useState(!supabaseEnabled);
  const queryKeyRef = useRef("");
  queryKeyRef.current = `${userId ?? "guest"}:${filter}:${sort}`;

  useEffect(() => {
    if (!supabaseEnabled || !userId) {
      setStats(emptyStats());
      setStatsLoading(false);
      setStatsUnavailable(!supabaseEnabled);
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
    if (!supabaseEnabled || !userId) {
      setItems([]);
      setTotalCount(0);
      setItemsLoading(false);
      setItemsUnavailable(!supabaseEnabled);
      return;
    }

    let cancelled = false;
    setItems([]);
    setTotalCount(0);
    setItemsLoading(true);

    readActivityRows(filter, sort, 0, "profile_activity.list")
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
    if (!supabaseEnabled || !userId || loadingMore || items.length >= totalCount) return;
    const queryKey = queryKeyRef.current;
    setLoadingMore(true);

    try {
      const rows = await readActivityRows(filter, sort, items.length, "profile_activity.more");
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
