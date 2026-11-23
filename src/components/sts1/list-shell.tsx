"use client";

import { useCallback, useEffect, useMemo, useState, type MouseEvent, type ReactNode } from "react";
import { CardSideTipsAnchor } from "@/components/codex/card-keyword-tip-stack";
import {
  CompendiumDetailOverlay,
  CompendiumIndexLayout,
  CompendiumIndexScroller,
  CompendiumIndexTopBar,
  useCodexFilterDrawer,
} from "@/components/codex/codex-filter-drawer";
import { SearchBar } from "@/components/codex/search-bar";
import {
  addCodexUrlChangeListener,
  pushCodexHistoryState,
  useHydrationSafeSearchParam,
} from "@/components/codex/use-hydration-safe-search-param";
import { formatCodexCount, getCodexServiceMessages } from "@/lib/codex-service";
import type { ServiceLocale } from "@/lib/i18n";
import { plainSts1Text } from "@/lib/sts1/description";
import { collectSts1CardSideTips, sts1KeywordTipBody } from "@/lib/sts1/keyword-tips";
import type { Sts1EntityRefs, Sts1Keyword } from "@/lib/sts1/types";
import { Sts1EventText } from "./event-text";
import { useEscapeClose } from "./use-escape-close";

/** The list's entry opened by `?<param>=<slug>`, kept in sync with history like the bestiary. */
export function useSts1Selection<T extends { slug: string; legacySlugs?: string[] }>(items: readonly T[], param: string) {
  const urlId = useHydrationSafeSearchParam(param);
  const [override, setOverride] = useState<T | null>(null);
  const [useUrl, setUseUrl] = useState(true);
  const selected = useMemo(() => {
    if (!useUrl) return override;
    if (!urlId) return null;
    const needle = urlId.toLowerCase();
    return items.find((item) => item.slug === needle || item.legacySlugs?.includes(needle)) ?? null;
  }, [items, override, urlId, useUrl]);
  const open = useCallback((item: T) => {
    setUseUrl(false);
    setOverride(item);
  }, []);
  const close = useCallback(() => {
    setUseUrl(false);
    setOverride(null);
  }, []);
  useEscapeClose(Boolean(selected), close);
  useEffect(() => {
    if (useUrl) return;
    const url = new URL(window.location.href);
    if (override) url.searchParams.set(param, override.slug);
    else url.searchParams.delete(param);
    if (url.toString() !== window.location.href) pushCodexHistoryState(url);
  }, [override, param, useUrl]);
  useEffect(() => addCodexUrlChangeListener(() => {
    setUseUrl(true);
    setOverride(null);
  }), []);
  return { selected, open, close };
}

/** Plain clicks open the modal; modified clicks follow the link to the detail page. */
export function openOnPlainClick(event: MouseEvent, open: () => void) {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
  event.preventDefault();
  open();
}

export function Sts1ListLayout({
  title,
  count,
  serviceLocale,
  searchQuery,
  onSearch,
  filters,
  overlay,
  children,
}: {
  title: string;
  count: number;
  serviceLocale: ServiceLocale;
  searchQuery: string;
  onSearch: (value: string) => void;
  filters?: ReactNode;
  overlay?: ReactNode;
  children: ReactNode;
}) {
  const serviceText = getCodexServiceMessages(serviceLocale);
  const { sidebarOpen, setSidebarOpen, isMobile } = useCodexFilterDrawer();
  return (
    <CompendiumIndexLayout
      sidebarOpen={sidebarOpen}
      setSidebarOpen={setSidebarOpen}
      isMobile={isMobile}
      sidebar={(
        <>
          <SearchBar value={searchQuery} onChange={onSearch} placeholder={serviceLocale === "ko" ? "검색" : "Search"} />
          {filters}
        </>
      )}
    >
      <main className="flex flex-1 flex-col overflow-hidden">
        <CompendiumIndexTopBar
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          closeFiltersLabel={serviceText.common.closeFilters}
          openFiltersLabel={serviceText.common.openFilters}
          title={title}
          count={formatCodexCount(count, serviceText.labels.items, serviceLocale)}
        />
        <CompendiumIndexScroller scrollerClassName="p-4 sm:p-6">
          {count === 0 ? (
            <div className="flex h-64 items-center justify-center text-gray-500">{serviceText.common.noResults}</div>
          ) : null}
          {children}
        </CompendiumIndexScroller>
      </main>
      {overlay}
    </CompendiumIndexLayout>
  );
}

export function Sts1DetailModal({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  return (
    <CompendiumDetailOverlay onClose={onClose} aria-label={label} zClassName="z-[100]">
      <div className="mx-4 my-8 w-full max-w-6xl">{children}</div>
    </CompendiumDetailOverlay>
  );
}

export function filterButtonClass(active: boolean): string {
  return `flex items-center gap-2 rounded px-2.5 py-1 text-left text-sm ${active ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-white/5"}`;
}

export function toggled<T>(previous: Set<T>, value: T): Set<T> {
  const next = new Set(previous);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

/** Game text with its colors, plus the keyword tips the game would show beside it. */
export function Sts1Description({
  text,
  keywords,
  refs,
  className = "block font-game-text text-sm leading-relaxed text-foreground",
}: {
  text: string;
  keywords?: readonly Sts1Keyword[];
  refs?: Sts1EntityRefs;
  className?: string;
}) {
  const tips = keywords ? collectSts1CardSideTips(plainSts1Text(text), keywords) : [];
  const body = <Sts1EventText text={text} refs={refs} className={className} />;
  if (tips.length === 0) return body;
  return (
    <CardSideTipsAnchor tips={tips} mode="hover" preferSide="right" className="block">
      {body}
    </CardSideTipsAnchor>
  );
}

/**
 * An index tile's hover, as the STS2 collections show it: the entry's own tip (name, game text)
 * with the keyword tips that text raises stacked beside it.
 */
export function Sts1EntryTips({
  title,
  description,
  keywords,
  children,
}: {
  title: string;
  description: string;
  keywords: readonly Sts1Keyword[];
  children: ReactNode;
}) {
  const tips = useMemo(() => [
    { kind: "keyword" as const, id: `entry:${title}`, title, description: sts1KeywordTipBody(description), variant: "default" as const, source: "staticHoverTip" as const },
    ...collectSts1CardSideTips(plainSts1Text(description), keywords),
  ], [description, keywords, title]);
  return (
    <CardSideTipsAnchor tips={tips} mode="hover" preferSide="right" className="block">
      {children}
    </CardSideTipsAnchor>
  );
}
