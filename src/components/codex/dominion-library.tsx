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
import { DOMINION_CATEGORIES, type DominionCategory } from "@/lib/blitz-dread-service-categories";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { fuzzyMatchCodexText, stripCodexMarkup } from "@/lib/codex-search";
import { DescriptionText } from "./codex-description";
import { FilterSection, ToggleButton } from "./codex-filters";
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

function toggleSet<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

export function DominionLibrary({
  serviceLocale,
  gameLocale,
  gameUi,
  title,
  dominions,
  entities,
}: {
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
  gameUi: CodexGameUiLabels;
  title: string;
  dominions: CodexDominion[];
  entities?: EntityInfo[];
}) {
  const serviceText = getCodexServiceMessages(serviceLocale);
  const view = serviceText.dominionsView;
  const urlId = useHydrationSafeSearchParam("dominion");
  const [searchQuery, setSearchQuery] = useState("");
  const [acts, setActs] = useState<Set<string>>(new Set());
  const [categories, setCategories] = useState<Set<DominionCategory>>(new Set());
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

  // Acts in the order the dominions come in (see getCodexDominions).
  const actOptions = useMemo(() => [...new Set(dominions.map((dominion) => dominion.act ?? "none"))], [dominions]);

  const filtered = useMemo(() => {
    const searchText = searchQuery.trim().toLowerCase();
    return dominions.filter((dominion) => (
      (acts.size === 0 || acts.has(dominion.act ?? "none"))
      && (categories.size === 0 || categories.has(dominion.category))
    )).filter((dominion) => !searchText || fuzzyMatchCodexText(
      [dominion.id, dominion.name, dominion.nameEn, dominion.encounterName, stripCodexMarkup(dominion.description), stripCodexMarkup(dominion.descriptionEn)].join(" "),
      searchText,
    ));
  }, [acts, categories, dominions, searchQuery]);

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
        <>
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            inputId="codex-filter-search"
            placeholder={view.searchPlaceholder}
          />
          <FilterSection label={view.actFilter}>
            <div className="flex flex-col gap-0.5">
              {actOptions.map((act) => (
                <ToggleButton
                  key={act}
                  label={gameUi.acts[act as keyof typeof gameUi.acts]}
                  active={acts.has(act)}
                  onClick={() => setActs((current) => toggleSet(current, act))}
                />
              ))}
            </div>
          </FilterSection>
          <FilterSection label={view.categoryFilter}>
            <div className="flex flex-col gap-0.5">
              {DOMINION_CATEGORIES.map((category) => (
                <ToggleButton
                  key={category}
                  label={view.categories[category]}
                  active={categories.has(category)}
                  onClick={() => setCategories((current) => toggleSet(current, category))}
                />
              ))}
            </div>
          </FilterSection>
        </>
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
