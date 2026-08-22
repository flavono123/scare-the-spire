"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  addCodexUrlChangeListener,
  pushCodexHistoryState,
  useHydrationSafeSearchParam,
} from "./use-hydration-safe-search-param";
import {
  localizeHrefWithGameLocale,
  type GameLocale,
  type ServiceLocale,
} from "@/lib/i18n";
import {
  buildCompendiumResourceDetailHref,
  updateCompendiumResourceModalUrl,
} from "@/lib/compendium-resource-links";
import type { CodexGameUiLabels } from "@/lib/codex-game-ui";
import {
  formatCodexCount,
  getCodexServiceMessages,
} from "@/lib/codex-service";
import type { CodexAscension } from "@/lib/codex-types";
import type { EntityInfo } from "@/components/patch-note-renderer";
import {
  fuzzyMatchCodexText,
  stripCodexMarkup,
} from "@/lib/codex-search";
import { AscensionDetail } from "./ascension-detail";
import { AscensionToken } from "./ascension-token";
import { DescriptionText } from "./codex-description";
import {
  CompendiumIndexLayout,
  CompendiumIndexTopBar,
  CompendiumIndexScroller,
  CompendiumDetailOverlay,
  useCodexFilterDrawer,
} from "./codex-filter-drawer";
import { GameHoverTip } from "./hover-tip";
import { SearchBar } from "./search-bar";

function AscensionTile({
  serviceLocale,
  gameLocale,
  ascension,
  onClick,
}: {
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
  ascension: CodexAscension;
  onClick: () => void;
}) {
  return (
    <Link
      href={localizeHrefWithGameLocale(
        buildCompendiumResourceDetailHref("ascension", ascension.id),
        serviceLocale,
        gameLocale,
      )}
      className="mb-5 block break-inside-avoid rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
        event.preventDefault();
        onClick();
      }}
    >
      <article className="grid min-w-0 grid-cols-[5rem_minmax(0,1fr)] items-center gap-2">
        <AscensionToken level={ascension.level} size={80} />
        <GameHoverTip title={ascension.name} className="min-w-0 w-full" style={{ minWidth: 0 }}>
          <DescriptionText description={ascension.description} className="block text-left" />
        </GameHoverTip>
      </article>
    </Link>
  );
}

export function AscensionLibrary({
  serviceLocale,
  gameLocale,
  gameUi,
  title,
  ascensions,
  entities,
}: {
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
  gameUi: CodexGameUiLabels;
  title: string;
  ascensions: CodexAscension[];
  entities?: EntityInfo[];
}) {
  const serviceText = getCodexServiceMessages(serviceLocale);
  const urlAscensionId = useHydrationSafeSearchParam("ascension");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAscensionIdOverride, setSelectedAscensionIdOverride] = useState<string | null>(null);
  const [useUrlSelection, setUseUrlSelection] = useState(true);
  const selectedAscensionId = useUrlSelection ? urlAscensionId : selectedAscensionIdOverride;
  const { sidebarOpen, setSidebarOpen, isMobile } = useCodexFilterDrawer();

  const selectAscension = useCallback((ascensionId: string) => {
    setUseUrlSelection(false);
    setSelectedAscensionIdOverride(ascensionId);
  }, []);

  const closeSelectedAscension = useCallback(() => {
    setUseUrlSelection(false);
    setSelectedAscensionIdOverride(null);
  }, []);

  useEffect(() => {
    if (useUrlSelection) return;
    const url = updateCompendiumResourceModalUrl(
      new URL(window.location.href),
      "ascension",
      selectedAscensionIdOverride,
    );
    if (url.toString() !== window.location.href) pushCodexHistoryState(url);
  }, [selectedAscensionIdOverride, useUrlSelection]);

  useEffect(() => addCodexUrlChangeListener(() => {
    setUseUrlSelection(true);
    setSelectedAscensionIdOverride(null);
  }), []);

  useEffect(() => {
    if (!selectedAscensionId) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeSelectedAscension();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [closeSelectedAscension, selectedAscensionId]);

  const filteredAscensions = useMemo(() => {
    const searchText = searchQuery.trim().toLowerCase();
    return ascensions
      .filter((ascension) => {
        if (!searchText) return true;
        return fuzzyMatchCodexText(
          [
            ascension.id,
            String(ascension.level),
            ascension.name,
            ascension.nameEn,
            ...ascension.aliasesKo,
            ...ascension.aliasesEn,
            stripCodexMarkup(ascension.description),
            stripCodexMarkup(ascension.descriptionEn),
          ].join(" "),
          searchText,
        );
      })
      .sort((left, right) => left.level - right.level);
  }, [ascensions, searchQuery]);

  const selectedAscension = useMemo(() => {
    if (!selectedAscensionId) return null;
    return ascensions.find((ascension) => (
      ascension.id.toLowerCase() === selectedAscensionId.toLowerCase()
      || String(ascension.level) === selectedAscensionId
    )) ?? null;
  }, [ascensions, selectedAscensionId]);

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
          placeholder={serviceText.ascensionsView.searchPlaceholder}
        />
      )}
    >
      <main className="flex flex-1 flex-col overflow-hidden" data-ascension-library>
        <CompendiumIndexTopBar
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          closeFiltersLabel={serviceText.common.closeFilters}
          openFiltersLabel={serviceText.common.openFilters}
          title={title}
          count={formatCodexCount(filteredAscensions.length, serviceText.labels.ascensions, serviceLocale)}
        />
        <CompendiumIndexScroller scrollerClassName="p-4 sm:p-6">
          <div className="columns-1 gap-5 xl:columns-2">
            {filteredAscensions.map((ascension) => (
              <AscensionTile
                key={ascension.id}
                serviceLocale={serviceLocale}
                gameLocale={gameLocale}
                ascension={ascension}
                onClick={() => selectAscension(ascension.id)}
              />
            ))}
          </div>
          {filteredAscensions.length === 0 && (
            <div className="flex h-64 items-center justify-center text-gray-500">
              {serviceText.common.noResults}
            </div>
          )}
        </CompendiumIndexScroller>
      </main>

      {selectedAscension && (
        <CompendiumDetailOverlay onClose={() => closeSelectedAscension()} data-ascension-modal>
          <div className="my-8 mx-4 w-full max-w-6xl">
            <AscensionDetail
              serviceLocale={serviceLocale}
              gameUi={gameUi}
              backToListTitle={title}
              ascension={selectedAscension}
              entities={entities}
              onClose={closeSelectedAscension}
            />
          </div>
        </CompendiumDetailOverlay>
      )}
    </CompendiumIndexLayout>
  );
}
