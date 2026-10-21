"use client";

import { forwardRef } from "react";
import Image from "@/components/ui/static-image";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { getCharacterColor } from "@/lib/codex-types";
import { compendiumTypeLabels } from "@/lib/compendium-type-labels";
import { useServiceLocale } from "@/hooks/use-service-locale";
import {
  SUGGESTION_LIST_CLASS,
  SUGGESTION_ROW_CLASS,
  useSuggestionListNavigation,
  type SuggestionListRef,
} from "@/components/editor/suggestion-list";

export type MentionListRef = SuggestionListRef;

interface MentionListProps {
  items: EntityInfo[];
  command: (item: EntityInfo) => void;
}

export const MentionList = forwardRef<MentionListRef, MentionListProps>(
  ({ items, command }, ref) => {
    const serviceLocale = useServiceLocale();
    const entityTypeLabels = compendiumTypeLabels(serviceLocale);
    const { listRef, selectedIndex, rowProps } = useSuggestionListNavigation({
      items,
      command,
      itemKey: (item) => `${item.type}:${item.id}`,
      ref,
    });

    if (items.length === 0) return null;

    return (
      <div ref={listRef} className={`w-max max-w-full ${SUGGESTION_LIST_CLASS}`}>
        {items.map((item, i) => {
          const charColor = getCharacterColor(item.color);
          return (
            <button
              key={`${item.type}:${item.id}`}
              type="button"
              className={`flex items-center gap-2 w-full px-3 py-1.5 text-left text-sm transition-colors ${SUGGESTION_ROW_CLASS} ${
                i === selectedIndex
                  ? "bg-primary/20 text-primary"
                  : "text-foreground hover:bg-primary/10"
              }`}
              {...rowProps(i)}
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
                {entityTypeLabels[item.type] ?? item.type}
              </span>
            </button>
          );
        })}
      </div>
    );
  },
);

MentionList.displayName = "MentionList";
