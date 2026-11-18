"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  addCodexUrlChangeListener,
  pushCodexHistoryState,
  useHydrationSafeSearchParam,
} from "./use-hydration-safe-search-param";
import {
  type GameLocale,
  type ServiceLocale,
} from "@/lib/i18n";
import {
  buildCompendiumEntryHref,
  updateCompendiumResourceModalUrl,
} from "@/lib/compendium-resource-links";
import type { CodexGameUiLabels } from "@/lib/codex-game-ui";
import {
  formatCodexCount,
  getCodexServiceMessages,
} from "@/lib/codex-service";
import type { CodexAscension, CodexAscensionGameModeLabels } from "@/lib/codex-types";
import type { EntityInfo } from "@/components/patch-note-renderer";
import {
  fuzzyMatchCodexText,
  stripCodexMarkup,
} from "@/lib/codex-search";
import { AscensionDetail } from "./ascension-detail";
import { AscensionToken } from "./ascension-token";
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
import { SearchBar } from "./search-bar";

type AscensionGameMode = "standard" | "blitz";

function AscensionTile({
  gameLocale,
  ascension,
  blitz,
  standardLevelLabel,
  onClick,
}: {
  gameLocale: GameLocale;
  ascension: CodexAscension;
  blitz: boolean;
  standardLevelLabel: string;
  onClick: () => void;
}) {
  return (
    <Link
      prefetch={false}
      // Game-only locales have no detail pages; this links their list modal.
      href={buildCompendiumEntryHref("ascension", ascension.id, gameLocale)}
      className="mb-5 block break-inside-avoid rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
        event.preventDefault();
        onClick();
      }}
    >
      <article className="grid min-w-0 grid-cols-[5rem_minmax(0,1fr)] items-center gap-2">
        <div className="flex flex-col items-center gap-0.5">
          <AscensionToken level={blitz ? ascension.blitzLevel ?? 0 : ascension.level} size={80} />
          {/* The Blitz step reuses this standard level's rule. */}
          {blitz && ascension.level > 0 && (
            <span className="font-game-text text-[11px] text-muted-foreground">
              {standardLevelLabel.replace("{level}", String(ascension.level))}
            </span>
          )}
        </div>
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
  gameModes,
  entities,
}: {
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
  gameUi: CodexGameUiLabels;
  title: string;
  ascensions: CodexAscension[];
  gameModes: CodexAscensionGameModeLabels;
  entities?: EntityInfo[];
}) {
  const serviceText = getCodexServiceMessages(serviceLocale);
  const urlAscensionId = useHydrationSafeSearchParam("ascension");
  const [searchQuery, setSearchQuery] = useState("");
  const [gameMode, setGameMode] = useState<AscensionGameMode>("standard");
  const blitz = gameMode === "blitz";
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
      .filter((ascension) => !blitz || ascension.blitzLevel !== null)
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
      .sort((left, right) => (blitz
        ? (left.blitzLevel ?? 0) - (right.blitzLevel ?? 0)
        : left.level - right.level));
  }, [ascensions, blitz, searchQuery]);

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
        <>
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            inputId="codex-filter-search"
            placeholder={serviceText.ascensionsView.searchPlaceholder}
          />
          <FilterSection label={gameModes.title}>
            <div className="flex flex-col gap-0.5">
              {(["standard", "blitz"] as const).map((mode) => (
                <ToggleButton
                  key={mode}
                  label={gameModes[mode]}
                  active={gameMode === mode}
                  onClick={() => setGameMode(mode === gameMode ? "standard" : mode)}
                />
              ))}
            </div>
          </FilterSection>
        </>
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
                gameLocale={gameLocale}
                ascension={ascension}
                blitz={blitz}
                standardLevelLabel={serviceText.ascensionsView.standardLevel}
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
              gameModes={gameModes}
              entities={entities}
              onClose={closeSelectedAscension}
            />
          </div>
        </CompendiumDetailOverlay>
      )}
    </CompendiumIndexLayout>
  );
}
