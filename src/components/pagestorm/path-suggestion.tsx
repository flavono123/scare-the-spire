"use client";

import { Extension } from "@tiptap/core";
import Suggestion, { type SuggestionMatch, type SuggestionOptions } from "@tiptap/suggestion";
import { PluginKey } from "@tiptap/pm/state";
import type { ResolvedPos } from "@tiptap/pm/model";
import { forwardRef } from "react";
import {
  SUGGESTION_LIST_CLASS,
  SUGGESTION_ROW_CLASS,
  useSuggestionListNavigation,
  type SuggestionListRef,
} from "@/components/editor/suggestion-list";
import { suggestionPopupRender } from "@/components/editor/suggestion-popup";
import type { ServiceLocale } from "@/lib/i18n";
import {
  canonicalSitePath,
  isNeowsletterIssueHref,
  isPatchNoteHref,
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
  if (!isNeowsletterIssueHref(href) && !isPatchNoteHref(href)) return null;
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

const PathMenu = forwardRef<
  SuggestionListRef,
  {
    items: SitePathMenuItem[];
    locale: ServiceLocale;
    emptyLabel: string;
    command: (item: SitePathMenuItem) => void;
  }
>(function PathMenu({ items, locale, emptyLabel, command }, ref) {
  const { listRef, selectedIndex, rowProps } = useSuggestionListNavigation({
    items,
    command,
    itemKey: (item) => item.href,
    ref,
  });

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
      ref={listRef}
      className={`w-80 ${SUGGESTION_LIST_CLASS}`}
    >
      {items.map((item, index) => (
        <button
          key={item.href}
          type="button"
          className={`block w-full px-3 py-1.5 text-left ${SUGGESTION_ROW_CLASS} ${
            index === selectedIndex ? "bg-primary/20 text-primary" : "text-foreground hover:bg-primary/10"
          }`}
          {...rowProps(index)}
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
      render: suggestionPopupRender({
        component: PathMenu,
        pluginKey: pagestormPathPluginKey,
        name: "site-path",
        extraProps: () => ({
          locale: options.getLocale(),
          emptyLabel: options.getEmptyLabel(),
        }),
      }),
    },
  });
}
