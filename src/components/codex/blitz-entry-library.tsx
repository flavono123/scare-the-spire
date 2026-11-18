"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  addCodexUrlChangeListener,
  pushCodexHistoryState,
  useHydrationSafeSearchParam,
} from "./use-hydration-safe-search-param";
import type { GameLocale, ServiceLocale } from "@/lib/i18n";
import {
  buildCompendiumEntryHref,
  updateCompendiumResourceModalUrl,
} from "@/lib/compendium-resource-links";
import type { CodexGameUiLabels } from "@/lib/codex-game-ui";
import { formatCodexCount, getCodexServiceMessages } from "@/lib/codex-service";
import type { CodexBlitzEntry } from "@/lib/codex-types";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { fuzzyMatchCodexText, stripCodexMarkup } from "@/lib/codex-search";
import { DescriptionText } from "./codex-description";
import {
  CompendiumIndexLayout,
  CompendiumIndexTopBar,
  CompendiumIndexScroller,
  CompendiumDetailOverlay,
  useCodexFilterDrawer,
} from "./codex-filter-drawer";
import { GameHoverTip } from "./hover-tip";
import { BLITZ_CURSED_COLOR, BlitzEntryDetail } from "./blitz-entry-detail";
import { ModifierToken } from "./modifier-token";
import { SearchBar } from "./search-bar";

function BlitzEntryTile({
  gameLocale,
  entry,
  rareLabel,
  onClick,
}: {
  gameLocale: GameLocale;
  entry: CodexBlitzEntry;
  rareLabel: string;
  onClick: () => void;
}) {
  return (
    <Link
      prefetch={false}
      // Game-only locales have no detail pages; this links their list modal.
      href={buildCompendiumEntryHref("blitzEntry", entry.id, gameLocale)}
      className="mb-5 block break-inside-avoid rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
        event.preventDefault();
        onClick();
      }}
    >
      <article className="grid min-w-0 grid-cols-[4rem_minmax(0,1fr)] items-center gap-2">
        <ModifierToken modifier={entry} size={64} />
        <GameHoverTip
          title={(
            <span className="flex items-baseline gap-2">
              <span>{entry.name}</span>
              {entry.rare && <span className="text-xs text-[#ffd700]">{rareLabel}</span>}
            </span>
          )}
          className="min-w-0 w-full"
          style={{ minWidth: 0 }}
        >
          <DescriptionText description={entry.description} className="block text-left" />
        </GameHoverTip>
      </article>
    </Link>
  );
}

export function BlitzEntryLibrary({
  serviceLocale,
  gameLocale,
  gameUi,
  title,
  entries,
  entities,
}: {
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
  gameUi: CodexGameUiLabels;
  title: string;
  entries: CodexBlitzEntry[];
  entities?: EntityInfo[];
}) {
  const serviceText = getCodexServiceMessages(serviceLocale);
  const view = serviceText.blitzShopView;
  const urlEntryId = useHydrationSafeSearchParam("ware");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIdOverride, setSelectedIdOverride] = useState<string | null>(null);
  const [useUrlSelection, setUseUrlSelection] = useState(true);
  const selectedId = useUrlSelection ? urlEntryId : selectedIdOverride;
  const { sidebarOpen, setSidebarOpen, isMobile } = useCodexFilterDrawer();

  const select = useCallback((id: string | null) => {
    setUseUrlSelection(false);
    setSelectedIdOverride(id);
  }, []);

  useEffect(() => {
    if (useUrlSelection) return;
    const url = updateCompendiumResourceModalUrl(new URL(window.location.href), "blitzEntry", selectedIdOverride);
    if (url.toString() !== window.location.href) pushCodexHistoryState(url);
  }, [selectedIdOverride, useUrlSelection]);

  useEffect(() => addCodexUrlChangeListener(() => {
    setUseUrlSelection(true);
    setSelectedIdOverride(null);
  }), []);

  useEffect(() => {
    if (!selectedId) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") select(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [select, selectedId]);

  const filtered = useMemo(() => {
    const searchText = searchQuery.trim().toLowerCase();
    if (!searchText) return entries;
    return entries.filter((entry) => fuzzyMatchCodexText(
      [entry.id, entry.name, entry.nameEn, stripCodexMarkup(entry.description), stripCodexMarkup(entry.descriptionEn)].join(" "),
      searchText,
    ));
  }, [entries, searchQuery]);

  const groups = useMemo(() => (
    [false, true]
      .map((cursed) => ({
        cursed,
        entries: filtered.filter((entry) => entry.cursed === cursed).sort((a, b) => a.sortOrder - b.sortOrder),
      }))
      .filter((group) => group.entries.length > 0)
  ), [filtered]);

  const selected = useMemo(() => (
    selectedId ? entries.find((entry) => entry.id.toLowerCase() === selectedId.toLowerCase()) ?? null : null
  ), [entries, selectedId]);

  return (
    <CompendiumIndexLayout
      sidebarOpen={sidebarOpen}
      setSidebarOpen={setSidebarOpen}
      isMobile={isMobile}
      sidebar={(
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          inputId="codex-filter-search"
          placeholder={view.searchPlaceholder}
        />
      )}
    >
      <main className="flex flex-1 flex-col overflow-hidden" data-blitz-shop-library>
        <CompendiumIndexTopBar
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          closeFiltersLabel={serviceText.common.closeFilters}
          openFiltersLabel={serviceText.common.openFilters}
          title={title}
          count={formatCodexCount(filtered.length, serviceText.labels.blitzShop, serviceLocale)}
        />
        <CompendiumIndexScroller scrollerClassName="p-4 sm:p-6">
          <p className="mb-6 max-w-3xl text-sm leading-relaxed text-muted-foreground">{view.intro}</p>
          {groups.map(({ cursed, entries: groupEntries }) => (
            <section key={String(cursed)} className="mb-8 last:mb-0">
              <h2
                className="mb-3 font-game-title text-lg font-bold"
                style={{ color: cursed ? BLITZ_CURSED_COLOR : undefined }}
              >
                {cursed ? view.cursed : view.normal}
              </h2>
              <div className="columns-1 gap-5 xl:columns-2">
                {groupEntries.map((entry) => (
                  <BlitzEntryTile
                    key={entry.id}
                    gameLocale={gameLocale}
                    entry={entry}
                    rareLabel={view.rare}
                    onClick={() => select(entry.id)}
                  />
                ))}
              </div>
            </section>
          ))}
          {filtered.length === 0 && (
            <div className="flex h-64 items-center justify-center text-gray-500">{serviceText.common.noResults}</div>
          )}
        </CompendiumIndexScroller>
      </main>

      {selected && (
        <CompendiumDetailOverlay onClose={() => select(null)} data-blitz-entry-modal>
          <div className="my-8 mx-4 w-full max-w-6xl">
            <BlitzEntryDetail
              serviceLocale={serviceLocale}
              gameUi={gameUi}
              backToListTitle={title}
              entry={selected}
              entities={entities}
              onClose={() => select(null)}
            />
          </div>
        </CompendiumDetailOverlay>
      )}
    </CompendiumIndexLayout>
  );
}
