"use client";

import {
  forwardRef,
  useImperativeHandle,
  useState,
} from "react";
import Image from "next/image";
import type { EntityInfo, EntityType } from "@/components/patch-note-renderer";
import { getCharacterColor } from "@/lib/codex-types";

const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
  card: "카드",
  relic: "유물",
  potion: "포션",
  power: "파워",
  enchantment: "인챈트",
  event: "이벤트",
  monster: "몬스터",
  encounter: "인카운터",
};

export interface MentionListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

interface MentionListProps {
  items: EntityInfo[];
  command: (item: EntityInfo) => void;
}

export const MentionList = forwardRef<MentionListRef, MentionListProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const safeSelectedIndex =
      items.length === 0
        ? 0
        : selectedIndex >= items.length
          ? 0
          : selectedIndex;

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (items.length === 0) return false;

        if (event.key === "ArrowUp") {
          setSelectedIndex((i) => (i + items.length - 1) % items.length);
          return true;
        }
        if (event.key === "ArrowDown") {
          setSelectedIndex((i) => (i + 1) % items.length);
          return true;
        }
        if (event.key === "Enter" || event.key === "Tab") {
          event.preventDefault();
          const item = items[safeSelectedIndex];
          if (item) command(item);
          return true;
        }
        if (event.key === "Escape") {
          return true;
        }
        return false;
      },
    }));

    if (items.length === 0) return null;

    return (
      <div className="bg-[#0a0a1a]/95 border border-yellow-500/30 rounded-lg shadow-xl overflow-hidden max-h-64 overflow-y-auto">
        {items.map((item, i) => {
          const charColor = getCharacterColor(item.color);
          return (
            <button
              key={`${item.type}:${item.id}`}
              type="button"
              className={`flex items-center gap-2 w-full px-3 py-1.5 text-left text-sm transition-colors ${
                i === safeSelectedIndex
                  ? "bg-yellow-500/20 text-yellow-300"
                  : "text-gray-300 hover:bg-yellow-500/10"
              }`}
              onClick={() => command(item)}
              onMouseEnter={() => setSelectedIndex(i)}
            >
              {item.imageUrl && (
                <Image
                  src={item.imageUrl}
                  alt=""
                  width={20}
                  height={20}
                  className="object-contain shrink-0"
                />
              )}
              {charColor && (
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: charColor }}
                />
              )}
              <span className="truncate font-medium">{item.nameKo}</span>
              {item.nameEn && (
                <span className="text-xs text-gray-500 truncate">
                  {item.nameEn}
                </span>
              )}
              <span className="ml-auto text-[10px] text-gray-500 shrink-0">
                {ENTITY_TYPE_LABELS[item.type]}
              </span>
            </button>
          );
        })}
      </div>
    );
  },
);

MentionList.displayName = "MentionList";
