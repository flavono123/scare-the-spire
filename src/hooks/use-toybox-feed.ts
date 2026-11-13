"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  countsFromFeedItems,
  cursorFromFeedItem,
  DEFAULT_TOYBOX_FEED_SORT,
  fetchToyboxFeedPage,
  itemFromPostRecord,
  type ToyboxFeedCursor,
  type ToyboxFeedItem,
  type ToyboxFeedService,
  type ToyboxFeedSort,
} from "@/lib/toybox-feed";

type PostIdentity = {
  id: string;
  created_at: string;
  env?: string;
};

export interface UseToyboxFeedReturn<T extends PostIdentity> {
  items: ToyboxFeedItem<T>[];
  posts: T[];
  likeCounts: Record<string, number>;
  commentCounts: Record<string, number>;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  unavailable: boolean;
  loadMore: () => Promise<void>;
  prependPost: (post: T, raw?: unknown) => void;
  setUnavailable: (value: boolean) => void;
}

export function useToyboxFeed<T extends PostIdentity>({
  service,
  sort = DEFAULT_TOYBOX_FEED_SORT,
  normalizePost,
}: {
  service: ToyboxFeedService;
  sort?: ToyboxFeedSort;
  normalizePost: (raw: unknown) => T;
}): UseToyboxFeedReturn<T> {
  const [items, setItems] = useState<ToyboxFeedItem<T>[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const loadingMoreRef = useRef(false);
  const cursorRef = useRef<ToyboxFeedCursor | null>(null);
  const normalizeRef = useRef(normalizePost);
  normalizeRef.current = normalizePost;

  useEffect(() => {
    let cancelled = false;
    cursorRef.current = null;
    loadingMoreRef.current = false;
    setItems([]);
    setLoading(true);
    setHasMore(false);

    fetchToyboxFeedPage({
      service,
      sort,
      cursor: null,
      normalizePost: normalizeRef.current,
    })
      .then((page) => {
        if (cancelled) return;
        setItems(page.items);
        cursorRef.current = page.items.length > 0
          ? cursorFromFeedItem(page.items[page.items.length - 1], sort)
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
  }, [service, sort]);

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || !hasMore) return;
    const cursor = cursorRef.current;
    if (!cursor) return;

    loadingMoreRef.current = true;
    setLoadingMore(true);

    try {
      const page = await fetchToyboxFeedPage({
        service,
        sort,
        cursor,
        normalizePost: normalizeRef.current,
      });
      setItems((current) => {
        const seen = new Set(current.map((item) => item.post.id));
        const appended = page.items.filter((item) => !seen.has(item.post.id));
        return appended.length > 0 ? [...current, ...appended] : current;
      });
      if (page.items.length > 0) {
        cursorRef.current = cursorFromFeedItem(
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
  }, [hasMore, service, sort]);

  const prependPost = useCallback((post: T, raw: unknown = post) => {
    setItems((current) => {
      if (current.some((item) => item.post.id === post.id)) return current;
      return [itemFromPostRecord(post, raw), ...current];
    });
  }, []);

  const posts = useMemo(() => items.map((item) => item.post), [items]);
  const { likeCounts, commentCounts } = useMemo(
    () => countsFromFeedItems(items),
    [items],
  );

  return {
    items,
    posts,
    likeCounts,
    commentCounts,
    loading,
    loadingMore,
    hasMore,
    unavailable,
    loadMore,
    prependPost,
    setUnavailable,
  };
}
