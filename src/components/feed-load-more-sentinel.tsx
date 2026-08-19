"use client";

import { useEffect, useRef } from "react";

export function FeedLoadMoreSentinel({
  hasMore,
  loadingMore,
  disabled = false,
  extraKey,
  label,
  onLoadMore,
}: {
  hasMore: boolean;
  loadingMore: boolean;
  disabled?: boolean;
  extraKey?: string | number;
  label: string;
  onLoadMore: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || !hasMore || loadingMore || disabled) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) onLoadMore();
      },
      { rootMargin: "400px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [disabled, extraKey, hasMore, loadingMore, onLoadMore]);

  if (!hasMore) return null;

  return (
    <div
      ref={ref}
      className="flex min-h-8 items-center justify-center py-2 text-xs text-zinc-500 md:col-span-2 2xl:col-span-3"
      aria-hidden={loadingMore ? undefined : true}
    >
      {loadingMore ? label : null}
    </div>
  );
}
