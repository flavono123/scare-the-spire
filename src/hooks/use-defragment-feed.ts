"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DefragmentFeedItem } from "@/lib/defragment";
import {
  cursorFromDefragmentItem,
  fetchDefragmentFeedPage,
} from "@/lib/defragment-feed";
import { supabase, supabaseEnabled, supabaseEnv } from "@/lib/supabase";
import {
  DEFAULT_TOYBOX_FEED_SORT,
  toyboxRecommendScore,
  type ToyboxFeedCursor,
  type ToyboxFeedSort,
} from "@/lib/toybox-feed";

export interface UseDefragmentFeedReturn {
  items: DefragmentFeedItem[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  unavailable: boolean;
  loadMore: () => Promise<void>;
  prependItem: (item: DefragmentFeedItem) => void;
  replaceItem: (item: DefragmentFeedItem) => void;
  removeItem: (postId: string) => void;
  setUnavailable: (value: boolean) => void;
}

export function useDefragmentFeed(
  sort: ToyboxFeedSort = DEFAULT_TOYBOX_FEED_SORT,
): UseDefragmentFeedReturn {
  const [items, setItems] = useState<DefragmentFeedItem[]>([]);
  const [loading, setLoading] = useState(supabaseEnabled);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [unavailable, setUnavailable] = useState(!supabaseEnabled);
  const loadingMoreRef = useRef(false);
  const cursorRef = useRef<ToyboxFeedCursor | null>(null);

  useEffect(() => {
    if (!supabaseEnabled) return;
    let cancelled = false;
    cursorRef.current = null;
    loadingMoreRef.current = false;
    setItems([]);
    setLoading(true);
    setHasMore(false);

    fetchDefragmentFeedPage({ sort, cursor: null })
      .then((page) => {
        if (cancelled) return;
        setItems(page.items);
        cursorRef.current = page.items.length > 0
          ? cursorFromDefragmentItem(page.items[page.items.length - 1], sort)
          : null;
        setHasMore(page.hasMore);
        setUnavailable(false);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setItems([]);
        setUnavailable(true);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [sort]);

  useEffect(() => {
    if (!supabaseEnabled) return;

    const channel = supabase
      .channel("defragment_posts_feed")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "defragment_posts" },
        (payload) => {
          const record = payload.new as {
            id?: unknown;
            env?: unknown;
            title?: unknown;
            created_at?: unknown;
            like_count?: unknown;
            comment_count?: unknown;
          };
          const id = typeof record.id === "string" ? record.id : "";
          if (!id) return;
          if (typeof record.env === "string" && record.env !== supabaseEnv) return;
          const likeCount = Number(record.like_count ?? 0) || 0;
          const commentCount = Number(record.comment_count ?? 0) || 0;
          setItems((current) => current.map((item) => (
            item.id === id && item.service === "defragment"
              ? {
                  ...item,
                  title: typeof record.title === "string" ? record.title : item.title,
                  created_at: typeof record.created_at === "string"
                    ? record.created_at
                    : item.created_at,
                  likeCount,
                  commentCount,
                  recommendScore: toyboxRecommendScore(likeCount, commentCount),
                }
              : item
          )));
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "defragment_posts" },
        (payload) => {
          const deletedId = String(
            (payload.old as { id?: unknown } | null)?.id ?? "",
          );
          if (!deletedId) return;
          setItems((current) => current.filter((item) => (
            !(item.service === "defragment" && item.id === deletedId)
          )));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadMore = useCallback(async () => {
    if (!supabaseEnabled || loadingMoreRef.current || !hasMore) return;
    const cursor = cursorRef.current;
    if (!cursor) return;

    loadingMoreRef.current = true;
    setLoadingMore(true);

    try {
      const page = await fetchDefragmentFeedPage({ sort, cursor });
      setItems((current) => {
        const seen = new Set(current.map((item) => `${item.service}:${item.id}`));
        const appended = page.items.filter(
          (item) => !seen.has(`${item.service}:${item.id}`),
        );
        return appended.length > 0 ? [...current, ...appended] : current;
      });
      if (page.items.length > 0) {
        cursorRef.current = cursorFromDefragmentItem(
          page.items[page.items.length - 1],
          sort,
        );
      }
      setHasMore(page.hasMore);
      setUnavailable(false);
    } catch {
      setUnavailable(true);
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [hasMore, sort]);

  const prependItem = useCallback((item: DefragmentFeedItem) => {
    setItems((current) => {
      if (current.some((row) => row.service === item.service && row.id === item.id)) {
        return current;
      }
      return [item, ...current];
    });
  }, []);

  const replaceItem = useCallback((item: DefragmentFeedItem) => {
    setItems((current) => current.map((row) => (
      row.service === item.service && row.id === item.id ? item : row
    )));
  }, []);

  const removeItem = useCallback((postId: string) => {
    setItems((current) => current.filter((item) => (
      !(item.service === "defragment" && item.id === postId)
    )));
  }, []);

  return {
    items,
    loading,
    loadingMore,
    hasMore,
    unavailable,
    loadMore,
    prependItem,
    replaceItem,
    removeItem,
    setUnavailable,
  };
}
