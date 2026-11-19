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
import type { CodexPet } from "@/lib/codex-types";
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
import { PetDetail, PetSpine } from "./pet-detail";
import { SearchBar } from "./search-bar";

// shortcut: search only; five pets split into one-pet groups by any field, add filters if the game adds pets.
export function PetLibrary({
  serviceLocale,
  gameLocale,
  gameUi,
  title,
  pets,
  entities,
}: {
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
  gameUi: CodexGameUiLabels;
  title: string;
  pets: CodexPet[];
  entities?: EntityInfo[];
}) {
  const serviceText = getCodexServiceMessages(serviceLocale);
  const view = serviceText.petsView;
  const urlId = useHydrationSafeSearchParam("pet");
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
    const url = updateCompendiumResourceModalUrl(new URL(window.location.href), "pet", selectedIdOverride);
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
    return pets.filter((pet) => !searchText || fuzzyMatchCodexText(
      [pet.id, pet.name, pet.nameEn, pet.source?.name ?? "", stripCodexMarkup(pet.description), stripCodexMarkup(pet.descriptionEn)].join(" "),
      searchText,
    ));
  }, [pets, searchQuery]);

  const selected = useMemo(() => (
    selectedId ? pets.find((pet) => pet.id.toLowerCase() === selectedId.toLowerCase()) ?? null : null
  ), [pets, selectedId]);

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
      <main className="flex flex-1 flex-col overflow-hidden" data-pet-library>
        <CompendiumIndexTopBar
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          closeFiltersLabel={serviceText.common.closeFilters}
          openFiltersLabel={serviceText.common.openFilters}
          title={title}
          count={formatCodexCount(filtered.length, serviceText.labels.pets, serviceLocale)}
        />
        <CompendiumIndexScroller scrollerClassName="p-4 sm:p-6">
          <div className="columns-1 gap-5 xl:columns-2">
            {filtered.map((pet) => (
              <Link
                key={pet.id}
                prefetch={false}
                // Game-only locales have no detail pages; this links their list modal.
                href={buildCompendiumEntryHref("pet", pet.id, gameLocale)}
                className="mb-5 block break-inside-avoid rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                onClick={(event) => {
                  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
                  event.preventDefault();
                  select(pet.id);
                }}
              >
                <article className="grid min-w-0 grid-cols-[6rem_minmax(0,1fr)] items-center gap-3">
                  <PetSpine pet={pet} className="relative h-24 w-24" />
                  <GameHoverTip title={pet.name} className="min-w-0 w-full" style={{ minWidth: 0 }}>
                    <DescriptionText description={pet.description} className="block text-left" />
                  </GameHoverTip>
                </article>
              </Link>
            ))}
          </div>
          {filtered.length === 0 && (
            <div className="flex h-64 items-center justify-center text-gray-500">{serviceText.common.noResults}</div>
          )}
        </CompendiumIndexScroller>
      </main>

      {selected && (
        <CompendiumDetailOverlay onClose={() => select(null)} data-pet-modal>
          <div className="my-8 mx-4 w-full max-w-6xl">
            <PetDetail
              serviceLocale={serviceLocale}
              gameUi={gameUi}
              backToListTitle={title}
              pet={selected}
              pets={pets}
              entities={entities}
              onClose={() => select(null)}
            />
          </div>
        </CompendiumDetailOverlay>
      )}
    </CompendiumIndexLayout>
  );
}
