"use client";

import {
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ForwardedRef,
} from "react";

/** Imperative handle every TipTap suggestion list exposes to its popup. */
export interface SuggestionListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

/**
 * Scrollable list frame shared by suggestion menus. The popup sets
 * `--editor-suggestion-max-height` to the room left above or below the caret
 * inside the visual viewport, so the list never slides under a phone keyboard.
 */
export const SUGGESTION_LIST_CLASS =
  "relative max-h-[min(16rem,var(--editor-suggestion-max-height,16rem))] overflow-y-auto overscroll-contain rounded-lg border border-border bg-popover shadow-xl";

/** Row hit area: a little taller on touch screens. */
export const SUGGESTION_ROW_CLASS = "pointer-coarse:min-h-11";

/**
 * Arrow/Enter/Tab navigation, hover highlight, and keeping the highlighted
 * row scrolled into view. Selection resets to the top when the items change.
 */
export function useSuggestionListNavigation<Item>({
  items,
  command,
  itemKey,
  ref,
}: {
  items: Item[];
  command: (item: Item) => void;
  itemKey: (item: Item) => string;
  ref: ForwardedRef<SuggestionListRef>;
}) {
  const key = items.map(itemKey).join("|");
  const [selection, setSelection] = useState({ key, index: 0 });
  const selectedIndex = selection.key === key && selection.index < items.length
    ? selection.index
    : 0;
  const listRef = useRef<HTMLDivElement>(null);

  const select = (index: number) => setSelection({ key, index });

  useEffect(() => {
    const list = listRef.current;
    const row = list?.querySelector<HTMLElement>(`[data-suggestion-index="${selectedIndex}"]`);
    if (!list || !row) return;
    // Scroll only the list; scrollIntoView would also move the page.
    if (row.offsetTop < list.scrollTop) {
      list.scrollTop = row.offsetTop;
    } else if (row.offsetTop + row.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = row.offsetTop + row.offsetHeight - list.clientHeight;
    }
  }, [selectedIndex, key]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (items.length === 0) return false;
      if (event.key === "ArrowUp") {
        select((selectedIndex + items.length - 1) % items.length);
        return true;
      }
      if (event.key === "ArrowDown") {
        select((selectedIndex + 1) % items.length);
        return true;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        const item = items[selectedIndex];
        if (item) command(item);
        return true;
      }
      return event.key === "Escape";
    },
  }));

  return {
    listRef,
    selectedIndex,
    rowProps: (index: number) => ({
      "data-suggestion-index": index,
      onMouseEnter: () => select(index),
      onClick: () => {
        const item = items[index];
        if (item) command(item);
      },
    }),
  };
}
