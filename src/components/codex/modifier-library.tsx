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
import {
  MODIFIER_POLARITY_ORDER,
  type CodexModifier,
  type ModifierPolarity,
} from "@/lib/codex-types";
import type { EntityInfo } from "@/components/patch-note-renderer";
import {
  fuzzyMatchCodexText,
  stripCodexMarkup,
} from "@/lib/codex-search";
import { DescriptionText } from "./codex-description";
import { FilterSection } from "./codex-filters";
import {
  CodexLibraryShell,
  CodexLibraryTopBar,
  useCodexFilterDrawer,
} from "./codex-filter-drawer";
import { GameCheckboxToggle } from "./game-checkbox";
import { GameHoverTip } from "./hover-tip";
import { ModifierDetail } from "./modifier-detail";
import { ModifierToken } from "./modifier-token";
import { SearchBar } from "./search-bar";

const POLARITY_STYLE: Record<ModifierPolarity, { color: string; hover: string }> = {
  good: { color: "text-[#7fff00]", hover: "group-hover:text-[#b8ff66]" },
  bad: { color: "text-[#ff5555]", hover: "group-hover:text-[#ff8888]" },
};

function ModifierTile({
  serviceLocale,
  gameLocale,
  modifier,
  onClick,
}: {
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
  modifier: CodexModifier;
  onClick: () => void;
}) {
  return (
    <Link
      href={localizeHrefWithGameLocale(
        buildCompendiumResourceDetailHref("modifier", modifier.id),
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
      <article className="grid min-w-0 grid-cols-[4rem_minmax(0,1fr)] items-center gap-2">
        <ModifierToken modifier={modifier} size={64} />
        <GameHoverTip
          title={(
            <span style={{ color: modifier.polarity === "good" ? "#7fff00" : "#ff5555" }}>
              {modifier.name}
            </span>
          )}
          className="min-w-0 w-full"
          style={{ minWidth: 0 }}
        >
          <DescriptionText description={modifier.description} className="block text-left" />
        </GameHoverTip>
      </article>
    </Link>
  );
}

export function ModifierLibrary({
  serviceLocale,
  gameLocale,
  gameUi,
  title,
  modifiers,
  entities,
}: {
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
  gameUi: CodexGameUiLabels;
  title: string;
  modifiers: CodexModifier[];
  entities?: EntityInfo[];
}) {
  const serviceText = getCodexServiceMessages(serviceLocale);
  const urlModifierId = useHydrationSafeSearchParam("modifier");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPolarities, setSelectedPolarities] = useState<Set<ModifierPolarity>>(new Set());
  const [selectedModifierIdOverride, setSelectedModifierIdOverride] = useState<string | null>(null);
  const [useUrlSelection, setUseUrlSelection] = useState(true);
  const selectedModifierId = useUrlSelection ? urlModifierId : selectedModifierIdOverride;
  const { sidebarOpen, setSidebarOpen, isMobile } = useCodexFilterDrawer();

  const selectModifier = useCallback((modifierId: string) => {
    setUseUrlSelection(false);
    setSelectedModifierIdOverride(modifierId);
  }, []);

  const closeSelectedModifier = useCallback(() => {
    setUseUrlSelection(false);
    setSelectedModifierIdOverride(null);
  }, []);

  useEffect(() => {
    if (useUrlSelection) return;
    const url = updateCompendiumResourceModalUrl(
      new URL(window.location.href),
      "modifier",
      selectedModifierIdOverride,
    );
    if (url.toString() !== window.location.href) pushCodexHistoryState(url);
  }, [selectedModifierIdOverride, useUrlSelection]);

  useEffect(() => addCodexUrlChangeListener(() => {
    setUseUrlSelection(true);
    setSelectedModifierIdOverride(null);
  }), []);

  useEffect(() => {
    if (!selectedModifierId) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeSelectedModifier();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [closeSelectedModifier, selectedModifierId]);

  const filteredModifiers = useMemo(() => {
    const searchText = searchQuery.trim().toLowerCase();
    return modifiers.filter((modifier) => {
      if (selectedPolarities.size > 0 && !selectedPolarities.has(modifier.polarity)) return false;
      if (!searchText) return true;
      return         fuzzyMatchCodexText(
        [
          modifier.id,
          modifier.name,
          modifier.nameEn,
          ...(modifier.aliasesKo ?? []),
          ...(modifier.aliasesEn ?? []),
          stripCodexMarkup(modifier.description),
          stripCodexMarkup(modifier.descriptionEn),
        ].join(" "),
        searchText,
      );
    });
  }, [modifiers, searchQuery, selectedPolarities]);

  const groupedModifiers = useMemo(() => (
    MODIFIER_POLARITY_ORDER.map((polarity) => ({
      polarity,
      modifiers: filteredModifiers
        .filter((modifier) => modifier.polarity === polarity)
        .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, "ko")),
    })).filter((group) => group.modifiers.length > 0)
  ), [filteredModifiers]);

  const selectedModifier = useMemo(() => {
    if (!selectedModifierId) return null;
    return modifiers.find((modifier) => modifier.id.toLowerCase() === selectedModifierId.toLowerCase()) ?? null;
  }, [modifiers, selectedModifierId]);

  const togglePolarity = useCallback((polarity: ModifierPolarity) => {
    setSelectedPolarities((current) => {
      const next = new Set(current);
      if (next.has(polarity)) next.delete(polarity);
      else next.add(polarity);
      return next;
    });
  }, []);

  return (
    <CodexLibraryShell
      sidebarOpen={sidebarOpen}
      setSidebarOpen={setSidebarOpen}
      isMobile={isMobile}
      sidebar={(
        <>
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            inputId="codex-filter-search"
            placeholder={serviceText.modifiersView.searchPlaceholder}
          />
          <FilterSection label={serviceText.modifiersView.polarityFilter}>
            <div className="flex flex-col gap-0.5">
              {MODIFIER_POLARITY_ORDER.map((polarity) => {
                const style = POLARITY_STYLE[polarity];
                return (
                  <GameCheckboxToggle
                    key={polarity}
                    checked={selectedPolarities.has(polarity)}
                    onCheckedChange={() => togglePolarity(polarity)}
                    label={serviceText.modifiersView[polarity === "good" ? "positive" : "negative"]}
                    size="sm"
                    className="w-full"
                    labelClassName={`${style.color} ${style.hover}`}
                  />
                );
              })}
            </div>
          </FilterSection>
        </>
      )}
    >
      <main className="flex flex-1 flex-col overflow-hidden" data-modifier-library>
        <CodexLibraryTopBar
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          closeFiltersLabel={serviceText.common.closeFilters}
          openFiltersLabel={serviceText.common.openFilters}
          title={title}
          count={formatCodexCount(filteredModifiers.length, serviceText.labels.modifiers, serviceLocale)}
        />
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {groupedModifiers.map(({ polarity, modifiers: groupModifiers }) => (
            <section key={polarity} className="mb-8 last:mb-0">
              <div className="mb-3">
                <h2
                  className="font-game-title text-lg font-bold"
                  style={{ color: polarity === "good" ? "#7fff00" : "#ff5555" }}
                >
                  {serviceText.modifiersView[polarity === "good" ? "positive" : "negative"]}
                </h2>
              </div>
              <div className="columns-1 gap-5 xl:columns-2">
                {groupModifiers.map((modifier) => (
                  <ModifierTile
                    key={modifier.id}
                    serviceLocale={serviceLocale}
                    gameLocale={gameLocale}
                    modifier={modifier}
                    onClick={() => selectModifier(modifier.id)}
                  />
                ))}
              </div>
            </section>
          ))}
          {filteredModifiers.length === 0 && (
            <div className="flex h-64 items-center justify-center text-gray-500">
              {serviceText.common.noResults}
            </div>
          )}
        </div>
      </main>

      {selectedModifier && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 backdrop-blur-sm"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeSelectedModifier();
          }}
          data-modifier-modal
        >
          <div className="my-8 mx-4 w-full max-w-6xl">
            <ModifierDetail
              serviceLocale={serviceLocale}
              gameUi={gameUi}
              backToListTitle={title}
              modifier={selectedModifier}
              entities={entities}
              onClose={closeSelectedModifier}
            />
          </div>
        </div>
      )}
    </CodexLibraryShell>
  );
}
