"use client";

import { forwardRef } from "react";
import Image from "@/components/ui/static-image";
import {
  SUGGESTION_LIST_CLASS,
  SUGGESTION_ROW_CLASS,
  useSuggestionListNavigation,
  type SuggestionListRef,
} from "@/components/editor/suggestion-list";

export interface SlashCommandItem {
  id: string;
  label: string;
  description: string;
  aliases: string[];
  iconSrc: string;
  onSelect: () => void;
}

export type SlashCommandListRef = SuggestionListRef;

interface SlashCommandListProps {
  items: SlashCommandItem[];
  command: (item: SlashCommandItem) => void;
}

export const SlashCommandList = forwardRef<
  SlashCommandListRef,
  SlashCommandListProps
>(({ items, command }, ref) => {
  const { listRef, selectedIndex, rowProps } = useSuggestionListNavigation({
    items,
    command,
    itemKey: (item) => item.id,
    ref,
  });

  if (items.length === 0) return null;

  return (
    <div ref={listRef} className={`${SUGGESTION_LIST_CLASS} p-1`}>
      {items.map((item, index) => (
        <button
          key={item.id}
          type="button"
          {...rowProps(index)}
          className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left transition-colors ${SUGGESTION_ROW_CLASS} ${
            index === selectedIndex
              ? "bg-primary/10 text-primary"
              : "text-foreground hover:bg-muted"
          }`}
        >
          <Image
            src={item.iconSrc}
            alt=""
            width={28}
            height={28}
            className="h-7 w-7 shrink-0 object-contain"
          />
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-semibold">{item.label}</span>
            <span className="block truncate text-[10px] text-muted-foreground">
              {item.description}
            </span>
          </span>
          <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
            {item.aliases[0]}
          </span>
        </button>
      ))}
    </div>
  );
});

SlashCommandList.displayName = "SlashCommandList";
