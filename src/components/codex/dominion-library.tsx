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
import type { CodexDominion } from "@/lib/codex-types";
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
import { DominionDetail } from "./dominion-detail";
import { ModifierToken } from "./modifier-token";
import { SearchBar } from "./search-bar";

export function DominionLibrary({
  serviceLocale,
  gameLocale,
  gameUi,
  title,
  dominions,
  rules,
  entities,
}: {
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
  gameUi: CodexGameUiLabels;
  title: string;
  dominions: CodexDominion[];
  rules: string[];
  entities?: EntityInfo[];
}) {
  const serviceText = getCodexServiceMessages(serviceLocale);
  const view = serviceText.dominionsView;
  const urlId = useHydrationSafeSearchParam("dominion");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIdOverride, setSelectedIdOverride] = useState<string | null>(null);
  const [useUrlSelection, setUseUrlSelection] = useState(true);
  const selectedId = useUrlSelection ? urlId : selectedIdOverride;
  const { sidebarOpen, setSidebarOpen, isMobile } = useCodexFilterDrawer();

  const select = useCallback((id: string | null) => {
    setUseUrlSelection(false);
    setSelectedIdOverride(id);
  }, []);

  useEffect(() => {
    if (useUrlSelection) return;
    const url = updateCompendiumResourceModalUrl(new URL(window.location.href), "dominion", selectedIdOverride);
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
    if (!searchText) return dominions;
    return dominions.filter((dominion) => fuzzyMatchCodexText(
      [dominion.id, dominion.name, dominion.nameEn, dominion.encounterName, stripCodexMarkup(dominion.description), stripCodexMarkup(dominion.descriptionEn)].join(" "),
      searchText,
    ));
  }, [dominions, searchQuery]);

  // Already in act order (see getCodexDominions).
  const groups = useMemo(() => {
    const byAct = new Map<string, CodexDominion[]>();
    for (const dominion of filtered) {
      const key = dominion.act ?? "none";
      byAct.set(key, [...(byAct.get(key) ?? []), dominion]);
    }
    return [...byAct.entries()];
  }, [filtered]);

  const selected = useMemo(() => (
    selectedId ? dominions.find((dominion) => dominion.id.toLowerCase() === selectedId.toLowerCase()) ?? null : null
  ), [dominions, selectedId]);

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
      <main className="flex flex-1 flex-col overflow-hidden" data-dominion-library>
        <CompendiumIndexTopBar
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          closeFiltersLabel={serviceText.common.closeFilters}
          openFiltersLabel={serviceText.common.openFilters}
          title={title}
          count={formatCodexCount(filtered.length, serviceText.labels.dominions, serviceLocale)}
        />
        <CompendiumIndexScroller scrollerClassName="p-4 sm:p-6">
          {rules.length > 0 && (
            <section className="mb-8 max-w-3xl rounded-lg border border-border bg-compendium-rail px-4 py-3">
              <h2 className="mb-2 font-game-title text-sm font-bold text-foreground">{view.rules}</h2>
              <ul className="space-y-1">
                {rules.map((rule) => (
                  <li key={rule}>
                    <DescriptionText description={rule} className="block text-left text-sm" />
                  </li>
                ))}
              </ul>
            </section>
          )}
          {groups.map(([act, actDominions]) => (
            <section key={act} className="mb-8 last:mb-0">
              <h2 className="mb-3 font-game-title text-lg font-bold">
                {gameUi.acts[act as keyof typeof gameUi.acts]}
              </h2>
              <div className="columns-1 gap-5 xl:columns-2">
                {actDominions.map((dominion) => (
                  <Link
                    key={dominion.id}
                    prefetch={false}
                    // Game-only locales have no detail pages; this links their list modal.
                    href={buildCompendiumEntryHref("dominion", dominion.id, gameLocale)}
                    className="mb-5 block break-inside-avoid rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                    onClick={(event) => {
                      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
                      event.preventDefault();
                      select(dominion.id);
                    }}
                  >
                    <article className="grid min-w-0 grid-cols-[4rem_minmax(0,1fr)] items-center gap-2">
                      <ModifierToken modifier={dominion} size={64} />
                      <GameHoverTip title={dominion.name} className="min-w-0 w-full" style={{ minWidth: 0 }}>
                        <DescriptionText description={dominion.description} className="block text-left" />
                      </GameHoverTip>
                    </article>
                  </Link>
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
        <CompendiumDetailOverlay onClose={() => select(null)} data-dominion-modal>
          <div className="my-8 mx-4 w-full max-w-6xl">
            <DominionDetail
              serviceLocale={serviceLocale}
              gameUi={gameUi}
              backToListTitle={title}
              dominion={selected}
              entities={entities}
              onClose={() => select(null)}
            />
          </div>
        </CompendiumDetailOverlay>
      )}
    </CompendiumIndexLayout>
  );
}
