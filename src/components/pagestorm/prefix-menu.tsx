"use client";

import { PluginKey } from "@tiptap/pm/state";
import { ReactRenderer } from "@tiptap/react";
import type { SuggestionKeyDownProps, SuggestionProps } from "@tiptap/suggestion";
import {
  forwardRef,
  useImperativeHandle,
  useState,
} from "react";
import {
  BraceKeywordSuggestion,
  findBracePortraitMatch,
} from "@/components/chemicalx/brace-keyword-suggestion";
import { MentionList, type MentionListRef } from "@/components/chemicalx/mention-list";
import type { EntityInfo } from "@/components/patch-note-renderer";
import Image from "@/components/ui/static-image";
import { matchEntities } from "@/lib/chemical-utils";
import { findPagestormEntity } from "./entities-context";
import type { MockGameAsset } from "./sample";

export type PrefixMenuRef = {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
};

export const PrefixMenu = forwardRef<
  PrefixMenuRef,
  {
    items: MockGameAsset[];
    command: (item: MockGameAsset) => void;
  }
>(function PrefixMenu({ items, command }, ref) {
  const itemKey = items.map((item) => `${item.kind}:${item.id}`).join("|");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [seenKey, setSeenKey] = useState(itemKey);
  if (seenKey !== itemKey) {
    setSeenKey(itemKey);
    setSelectedIndex(0);
  }
  const safeIndex = items.length === 0 ? 0 : selectedIndex % items.length;

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
        const item = items[safeIndex];
        if (item) command(item);
        return true;
      }
      if (event.key === "Escape") return true;
      return false;
    },
  }));

  if (items.length === 0) {
    return (
      <div
        data-pagestorm-prefix-menu
        className="rounded-lg border border-border bg-popover px-3 py-2 text-xs text-muted-foreground shadow-xl"
      >
        일치하는 게임 요소 없음
      </div>
    );
  }

  return (
    <div
      data-pagestorm-prefix-menu
      className="max-h-64 overflow-y-auto rounded-lg border border-border bg-popover shadow-xl"
    >
      {items.map((item, index) => (
        <button
          key={`${item.kind}:${item.id}`}
          type="button"
          className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm ${
            index === safeIndex
              ? "bg-primary/20 text-primary"
              : "text-foreground hover:bg-primary/10"
          }`}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => command(item)}
          onMouseEnter={() => setSelectedIndex(index)}
        >
          <Image
            src={item.imageUrl}
            alt=""
            width={28}
            height={28}
            className="h-7 w-7 object-contain"
          />
          <span className="font-game-title">{item.name}</span>
          <span className="text-[11px] text-muted-foreground">{item.kind}</span>
        </button>
      ))}
    </div>
  );
});

export const pagestormBracePluginKey = new PluginKey("pagestorm-brace-portrait");

export function createPagestormBraceSuggestion(options: {
  getEntities: () => EntityInfo[];
  onPick: (payload: { entity: EntityInfo; range: { from: number; to: number } }) => void;
}) {
  return BraceKeywordSuggestion.configure({
    suggestion: {
      pluginKey: pagestormBracePluginKey,
      char: "",
      allowSpaces: false,
      allowedPrefixes: null,
      findSuggestionMatch: findBracePortraitMatch,
      items: ({ query }) => {
        const entities = options.getEntities();
        const trimmed = query.trim();
        if (!trimmed) {
          return entities.filter((entity) => entity.imageUrl).slice(0, 8);
        }
        return matchEntities(trimmed, entities);
      },
      command: ({ range, props }) => {
        const item = props as unknown as EntityInfo;
        const entity = findPagestormEntity(
          options.getEntities(),
          item.type ?? (item as { entityType?: EntityInfo["type"] }).entityType,
          String(item.id ?? ""),
        ) ?? item;
        if (!entity?.id) return;
        options.onPick({ entity, range });
      },
      render: () => {
        let renderer: ReactRenderer<MentionListRef> | null = null;
        let popup: HTMLDivElement | null = null;
        const place = (props: SuggestionProps) => {
          if (!popup) return;
          let rect = props.clientRect?.() ?? null;
          if (!rect) {
            try {
              const coords = props.editor.view.coordsAtPos(props.editor.state.selection.from);
              rect = new DOMRect(coords.left, coords.top, 0, coords.bottom - coords.top);
            } catch {
              return;
            }
          }
          const popupWidth = Math.max(popup.offsetWidth, 240);
          const popupHeight = Math.max(popup.offsetHeight, 160);
          const left = Math.min(Math.max(8, rect.left), window.innerWidth - popupWidth - 8);
          const below = rect.bottom + 6;
          const top = below + popupHeight > window.innerHeight - 8
            ? Math.max(8, rect.top - popupHeight - 6)
            : below;
          popup.style.left = `${left}px`;
          popup.style.top = `${top}px`;
        };
        const dismiss = () => {
          popup?.remove();
          renderer?.destroy();
          popup = null;
          renderer = null;
        };
        return {
          onStart: (props: SuggestionProps) => {
            renderer = new ReactRenderer(MentionList, {
              props: {
                items: props.items,
                command: props.command,
              },
              editor: props.editor,
            });
            popup = document.createElement("div");
            popup.style.position = "fixed";
            popup.style.zIndex = "100";
            popup.dataset.pagestormPrefixMenu = "true";
            popup.appendChild(renderer.element);
            document.body.appendChild(popup);
            place(props);
          },
          onUpdate: (props: SuggestionProps) => {
            renderer?.updateProps({
              items: props.items,
              command: props.command,
            });
            place(props);
          },
          onKeyDown: (props: SuggestionKeyDownProps) => {
            if (props.event.key === "Escape") {
              dismiss();
              return true;
            }
            return renderer?.ref?.onKeyDown(props) ?? false;
          },
          onExit: () => {
            dismiss();
          },
        };
      },
    },
  });
}
