"use client";

import { Extension } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import type { ResolvedPos } from "@tiptap/pm/model";
import { ReactRenderer } from "@tiptap/react";
import Suggestion, {
  type SuggestionMatch,
  type SuggestionOptions,
} from "@tiptap/suggestion";
import {
  forwardRef,
  useImperativeHandle,
  useState,
} from "react";
import Image from "@/components/ui/static-image";
import { filterPrefixItems, type MockGameAsset } from "./sample";
import { gameAssetAttrs } from "./tiptap-nodes";

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
  const itemKey = items.map((item) => item.id).join("|");
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

const braceAssetPluginKey = new PluginKey("pagestorm-brace-asset");

function findBraceAssetMatch(config: { $position: ResolvedPos }): SuggestionMatch | null {
  const nodeBefore = config.$position.nodeBefore;
  if (!nodeBefore?.isText) return null;
  const text = nodeBefore.text ?? "";
  const match = text.match(/\{([^{}\n]*)$/);
  if (!match) return null;
  return {
    range: {
      from: config.$position.pos - match[0].length,
      to: config.$position.pos,
    },
    query: match[1] ?? "",
    text: match[0],
  };
}

export const BraceAssetSuggestion = Extension.create({
  name: "pagestorm-brace-asset",
  addProseMirrorPlugins() {
    const suggestion: Omit<SuggestionOptions<MockGameAsset>, "editor"> = {
      pluginKey: braceAssetPluginKey,
      // Empty trigger + custom matcher: `{` is regex-special in the default
      // finder, and Chemical X already uses this pattern for `{query`.
      char: "",
      allowSpaces: false,
      allowedPrefixes: null,
      findSuggestionMatch: findBraceAssetMatch,
      items: ({ query }) => filterPrefixItems(query).slice(0, 8),
      command: ({ editor, range, props }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertContent([
            { type: "gameAsset", attrs: gameAssetAttrs(props) },
            { type: "paragraph" },
          ])
          .run();
      },
      render: () => {
        let renderer: ReactRenderer<PrefixMenuRef> | null = null;
        let popup: HTMLDivElement | null = null;
        const place = (clientRect?: (() => DOMRect | null) | null) => {
          const rect = clientRect?.();
          if (!popup || !rect) return;
          popup.style.left = `${rect.left}px`;
          popup.style.top = `${rect.bottom + 6}px`;
        };
        const dismiss = () => {
          popup?.remove();
          renderer?.destroy();
          popup = null;
          renderer = null;
        };
        return {
          onStart: (props) => {
            renderer = new ReactRenderer(PrefixMenu, {
              props: {
                items: props.items,
                command: props.command,
              },
              editor: props.editor,
            });
            popup = document.createElement("div");
            popup.dataset.pagestormPrefixMenu = "true";
            popup.style.position = "fixed";
            popup.style.zIndex = "100";
            popup.appendChild(renderer.element);
            document.body.appendChild(popup);
            place(props.clientRect);
          },
          onUpdate: (props) => {
            renderer?.updateProps({
              items: props.items,
              command: props.command,
            });
            place(props.clientRect);
          },
          onKeyDown: (props) => {
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
    };
    return [
      Suggestion({
        editor: this.editor,
        ...suggestion,
      }),
    ];
  },
});
