"use client";

import { TOYBOX_FEED_SORT_OPTIONS, type ToyboxFeedSort } from "@/lib/toybox-feed";

export function FeedSortToggle({
  sort,
  onSortChange,
  labels,
}: {
  sort: ToyboxFeedSort;
  onSortChange: (sort: ToyboxFeedSort) => void;
  labels: Record<ToyboxFeedSort, string>;
}) {
  return (
    <div className="inline-flex overflow-hidden rounded-md border border-border/70 bg-background/40">
      {TOYBOX_FEED_SORT_OPTIONS.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onSortChange(option)}
          className={`h-8 px-3 text-xs transition-colors ${
            sort === option
              ? "bg-white/10 text-foreground"
              : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
          }`}
        >
          {labels[option]}
        </button>
      ))}
    </div>
  );
}
