"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase, supabaseEnabled, supabaseEnv } from "@/lib/supabase";
import {
  countsFromFeedItems,
  cursorFromFeedItem,
  DEFAULT_TOYBOX_FEED_SORT,
  fetchToyboxFeedPage,
  itemFromPostRecord,
  mergeToyboxFeedItem,
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
  replacePost: (post: T, raw?: unknown) => void;
  removePost: (postId: string) => void;
  setUnavailable: (value: boolean) => void;
}

export function useToyboxFeed<T extends PostIdentity>({
  service,
  table,
  sort = DEFAULT_TOYBOX_FEED_SORT,
  normalizePost,
}: {
  service: ToyboxFeedService;
  table: string;
  sort?: ToyboxFeedSort;
  normalizePost: (raw: unknown) => T;
}): UseToyboxFeedReturn<T> {
  const [items, setItems] = useState<ToyboxFeedItem<T>[]>([]);
  const [loading, setLoading] = useState(supabaseEnabled);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [unavailable, setUnavailable] = useState(!supabaseEnabled);
  const loadingMoreRef = useRef(false);
  const cursorRef = useRef<ToyboxFeedCursor | null>(null);
  const normalizeRef = useRef(normalizePost);
  normalizeRef.current = normalizePost;

  useEffect(() => {
    if (!supabaseEnabled) return;
    let cancelled = false;
    cursorRef.current = null;
    loadingMoreRef.current = false;
    setItems([]);
    setLoading(true);
    setHasMore(false);

    fetchToyboxFeedPage({
      service,
      table,
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
  }, [service, sort, table]);

  useEffect(() => {
    if (!supabaseEnabled) return;

    const channel = supabase
      .channel(`${table}_feed`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table },
        (payload) => {
          const updatedPost = normalizeRef.current(payload.new);
          if (updatedPost.env && updatedPost.env !== supabaseEnv) return;
          setItems((current) => current.map((item) => (
            item.post.id === updatedPost.id
              ? mergeToyboxFeedItem(item, updatedPost, payload.new)
              : item
          )));
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table },
        (payload) => {
          const deletedId = String(
            (payload.old as { id?: unknown } | null)?.id ?? "",
          );
          if (!deletedId) return;
          setItems((current) => current.filter((item) => item.post.id !== deletedId));
        },
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setUnavailable(true);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table]);

  const loadMore = useCallback(async () => {
    if (!supabaseEnabled || loadingMoreRef.current || !hasMore) return;
    const cursor = cursorRef.current;
    if (!cursor) return;

    loadingMoreRef.current = true;
    setLoadingMore(true);

    try {
      const page = await fetchToyboxFeedPage({
        service,
        table,
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
  }, [hasMore, service, sort, table]);

  const prependPost = useCallback((post: T, raw: unknown = post) => {
    setItems((current) => {
      if (current.some((item) => item.post.id === post.id)) return current;
      return [itemFromPostRecord(post, raw), ...current];
    });
  }, []);

  const replacePost = useCallback((post: T, raw: unknown = post) => {
    setItems((current) => current.map((item) => (
      item.post.id === post.id ? mergeToyboxFeedItem(item, post, raw) : item
    )));
  }, []);

  const removePost = useCallback((postId: string) => {
    setItems((current) => current.filter((item) => item.post.id !== postId));
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
    replacePost,
    removePost,
    setUnavailable,
  };
}
