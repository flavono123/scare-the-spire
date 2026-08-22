"use client";

import {
  forwardRef,
  useImperativeHandle,
  useState,
} from "react";
import Image from "@/components/ui/static-image";

export interface SlashCommandItem {
  id: string;
  label: string;
  description: string;
  aliases: string[];
  iconSrc: string;
  onSelect: () => void;
}

export interface SlashCommandListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

interface SlashCommandListProps {
  items: SlashCommandItem[];
  command: (item: SlashCommandItem) => void;
}

export const SlashCommandList = forwardRef<
  SlashCommandListRef,
  SlashCommandListProps
>(({ items, command }, ref) => {
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
          key={item.id}
          type="button"
          onClick={() => command(item)}
          onMouseEnter={() => setSelectedIndex(index)}
          className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left transition-colors ${
            index === safeIndex
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
