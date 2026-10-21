"use client";

import { forwardRef } from "react";
import {
  SUGGESTION_LIST_CLASS,
  SUGGESTION_ROW_CLASS,
  useSuggestionListNavigation,
  type SuggestionListRef,
} from "@/components/editor/suggestion-list";
import { HistoryRunFloorChip } from "@/components/history-course/history-run-floor-chip";
import type { HistoryRunFloorBlock } from "@/lib/chemical-types";

export type FloorMentionListRef = SuggestionListRef;

interface FloorMentionListProps {
  items: HistoryRunFloorBlock[];
  command: (item: HistoryRunFloorBlock) => void;
}

export const FloorMentionList = forwardRef<FloorMentionListRef, FloorMentionListProps>(
  ({ items, command }, ref) => {
    const { listRef, selectedIndex, rowProps } = useSuggestionListNavigation({
      items,
      command,
      itemKey: (item) => `${item.actIndex}:${item.step}:${item.floor}`,
      ref,
    });

    if (items.length === 0) return null;

    return (
      <div ref={listRef} className={`${SUGGESTION_LIST_CLASS} p-1`}>
        {items.map((item, index) => (
          <button
            key={`${item.actIndex}:${item.step}:${item.floor}`}
            type="button"
            {...rowProps(index)}
            className={`flex w-full items-center rounded-md px-2 py-1.5 text-left transition-colors ${SUGGESTION_ROW_CLASS} ${
              index === selectedIndex
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
