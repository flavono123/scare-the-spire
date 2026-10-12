"use client";

import { Extension } from "@tiptap/core";
import Suggestion, { type SuggestionMatch, type SuggestionOptions, type SuggestionProps } from "@tiptap/suggestion";
import { PluginKey } from "@tiptap/pm/state";
import type { ResolvedPos } from "@tiptap/pm/model";
import { ReactRenderer } from "@tiptap/react";
import { forwardRef, useImperativeHandle, useState } from "react";
import type { ServiceLocale } from "@/lib/i18n";
import {
  canonicalSitePath,
  isNeowsletterIssueHref,
  localizedSiteHref,
  openSitePathQuery,
  sitePathText,
  type SitePathEntry,
  type SitePathMenuItem,
} from "@/lib/site-paths";

export const pagestormPathPluginKey = new PluginKey("pagestorm-site-path");

export function findSitePathMatch(config: { $position: ResolvedPos }): SuggestionMatch | null {
  const { $position } = config;
  const nodeBefore = $position.nodeBefore;
  if (!nodeBefore?.isText) return null;
  if (nodeBefore.marks.some((mark) => mark.type.name === "link")) return null;
  const query = openSitePathQuery(nodeBefore.text ?? "");
  if (query) {
    return {
      range: {
        from: $position.pos - query.length,
        to: $position.pos,
      },
      query,
      text: query,
    };
  }
  if (!/^#[^\s]*$/.test(nodeBefore.text ?? "")) return null;
  const beforeHash = $position.doc.resolve($position.pos - nodeBefore.nodeSize);
  const link = beforeHash.nodeBefore;
  if (link?.type.name !== "pagestormInternalLink") return null;
  const href = canonicalSitePath(String(link.attrs.href ?? "")) ?? "";
  if (!isNeowsletterIssueHref(href)) return null;
  return {
    range: {
      from: beforeHash.pos - link.nodeSize,
      to: $position.pos,
    },
    query: `${href}${nodeBefore.text}`,
    text: nodeBefore.text ?? "",
  };
}

export const PagestormPathSuggestion = Extension.create<{
  suggestion: Omit<SuggestionOptions, "editor">;
}>({
  name: "pagestorm-path-suggestion",
  addOptions() {
    return {
      suggestion: {
        pluginKey: pagestormPathPluginKey,
        char: "",
        allowSpaces: false,
        findSuggestionMatch: findSitePathMatch,
        items: () => [],
        render: () => ({}),
        command: () => undefined,
      } as Omit<SuggestionOptions, "editor">,
    };
  },
  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});

type PathMenuRef = {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
};

const PathMenu = forwardRef<
  PathMenuRef,
  {
    items: SitePathMenuItem[];
    locale: ServiceLocale;
    emptyLabel: string;
    command: (item: SitePathMenuItem) => void;
  }
>(function PathMenu({ items, locale, emptyLabel, command }, ref) {
  const itemKey = items.map((item) => item.href).join("|");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [seenKey, setSeenKey] = useState(itemKey);
  if (seenKey !== itemKey) {
    setSeenKey(itemKey);
    setSelectedIndex(0);
  }
  const safeIndex = items.length === 0 ? 0 : selectedIndex % items.length;

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === "ArrowUp" && items.length > 0) {
        setSelectedIndex((index) => (index + items.length - 1) % items.length);
        return true;
      }
      if (event.key === "ArrowDown" && items.length > 0) {
        setSelectedIndex((index) => (index + 1) % items.length);
        return true;
      }
      if ((event.key === "Enter" || event.key === "Tab") && items[safeIndex]) {
        event.preventDefault();
        command(items[safeIndex]);
        return true;
      }
      if (event.key === "Escape") return true;
      return false;
    },
  }));

  if (items.length === 0) {
    return (
      <div
        data-pagestorm-path-menu
        className="rounded-lg border border-border bg-popover px-3 py-2 text-xs text-muted-foreground shadow-xl"
      >
        {emptyLabel}
      </div>
    );
  }

  return (
    <div
      data-pagestorm-path-menu
      className="max-h-72 w-80 overflow-y-auto rounded-lg border border-border bg-popover shadow-xl"
    >
      {items.map((item, index) => (
        <button
          key={item.href}
          type="button"
          className={`block w-full px-3 py-1.5 text-left ${
            index === safeIndex ? "bg-primary/20 text-primary" : "text-foreground hover:bg-primary/10"
          }`}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => command(item)}
          onMouseEnter={() => setSelectedIndex(index)}
        >
          <span className="block truncate text-sm">
            {sitePathText(item, locale, "label")}
            {item.action === "drill" ? " ›" : ""}
          </span>
          <span className="block truncate text-[11px] text-muted-foreground">
            {localizedSiteHref(item.href, locale)}
          </span>
        </button>
      ))}
    </div>
  );
});

export function createPagestormPathSuggestion(options: {
  getEntries: () => SitePathEntry[];
  getLocale: () => ServiceLocale;
  getEmptyLabel: () => string;
  rank: (query: string, entries: SitePathEntry[], locale: ServiceLocale) => SitePathMenuItem[];
  onPick: (payload: { entry: SitePathMenuItem; range: { from: number; to: number } }) => void;
}) {
  return PagestormPathSuggestion.configure({
    suggestion: {
      pluginKey: pagestormPathPluginKey,
      char: "",
      allowSpaces: false,
      findSuggestionMatch: findSitePathMatch,
      items: ({ query }) => options.rank(query, options.getEntries(), options.getLocale()),
      command: ({ range, props }) => {
        const entry = props as unknown as SitePathMenuItem;
        if (!entry?.href) return;
        options.onPick({ entry, range });
      },
      render: () => {
        let renderer: ReactRenderer<PathMenuRef> | null = null;
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
          const popupWidth = Math.max(popup.offsetWidth, 280);
          const popupHeight = Math.max(popup.offsetHeight, 80);
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
            renderer = new ReactRenderer(PathMenu, {
              props: {
                items: props.items,
                locale: options.getLocale(),
                emptyLabel: options.getEmptyLabel(),
                command: props.command,
              },
              editor: props.editor,
            });
            popup = document.createElement("div");
            popup.style.position = "fixed";
            popup.style.zIndex = "100";
            popup.appendChild(renderer.element);
            document.body.appendChild(popup);
            place(props);
          },
          onUpdate: (props: SuggestionProps) => {
            renderer?.updateProps({
              items: props.items,
              locale: options.getLocale(),
              emptyLabel: options.getEmptyLabel(),
              command: props.command,
            });
            place(props);
          },
          onKeyDown: (props: { event: KeyboardEvent }) => {
            if (props.event.key === "Escape") {
              dismiss();
              return true;
            }
            return renderer?.ref?.onKeyDown(props) ?? false;
          },
          onExit: dismiss,
        };
      },
    },
  });
}
