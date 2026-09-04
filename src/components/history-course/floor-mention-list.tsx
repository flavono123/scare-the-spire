"use client";

import {
  forwardRef,
  useImperativeHandle,
  useState,
} from "react";
import { HistoryRunFloorChip } from "@/components/history-course/history-run-floor-chip";
import type { HistoryRunFloorBlock } from "@/lib/chemical-types";

export interface FloorMentionListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

interface FloorMentionListProps {
  items: HistoryRunFloorBlock[];
  command: (item: HistoryRunFloorBlock) => void;
}

export const FloorMentionList = forwardRef<FloorMentionListRef, FloorMentionListProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const safeIndex = items.length === 0 || selectedIndex >= items.length
      ? 0
      : selectedIndex;

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (items.length === 0) return false;
        if (event.key === "ArrowUp") {
          setSelectedIndex((index) => (index + items.length - 1) % items.length);
          return true;
        }
        if (event.key === "ArrowDown") {
          setSelectedIndex((index) => (index + 1) % items.length);
          return true;
        }
        if (event.key === "Enter" || event.key === "Tab") {
          event.preventDefault();
          const item = items[safeIndex];
          if (item) command(item);
          return true;
        }
        return event.key === "Escape";
      },
    }));

    if (items.length === 0) return null;

    return (
      <div className="max-h-60 overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-xl">
        {items.map((item, index) => (
          <button
            key={`${item.actIndex}:${item.step}:${item.floor}`}
            type="button"
            onClick={() => command(item)}
            onMouseEnter={() => setSelectedIndex(index)}
            className={`flex w-full items-center rounded-md px-2 py-1.5 text-left transition-colors ${
              index === safeIndex
                ? "bg-amber-400/15"
                : "hover:bg-muted"
            }`}
          >
            <HistoryRunFloorChip block={item} />
          </button>
        ))}
      </div>
    );
  },
);

FloorMentionList.displayName = "FloorMentionList";
