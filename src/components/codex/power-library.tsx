"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import {
  addCodexUrlChangeListener,
  pushCodexHistoryState,
  useHydrationSafeSearchParam,
} from "./use-hydration-safe-search-param";
import type { ServiceLocale } from "@/lib/i18n";
import type { CodexGameUiLabels } from "@/lib/codex-game-ui";
import {
  formatCodexCount,
  getCodexServiceMessages,
  type CodexServiceMessages,
} from "@/lib/codex-service";
import {
  CodexCard,
  CodexEnchantment,
  CodexEvent,
  CodexMonster,
  CodexPotion,
  CodexPower,
  CodexRelic,
  PowerType,
  POWER_TYPE_ORDER,
  POWER_TYPE_CONFIG,
} from "@/lib/codex-types";
import type { STS2Patch, STS2Change, EntityVersionDiff } from "@/lib/types";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { versionCodexEntities } from "@/lib/codex-versioning";
import {
  fuzzyMatchCodexText,
  stripCodexMarkup,
} from "@/lib/codex-search";
import { PowerTile } from "./power-tile";
import { PowerDetail } from "./power-detail";
import { SearchBar } from "./search-bar";
import {
  FilterSection,
  ToggleButton,
  orderByFilterSortDir,
  toggleFilterSortDir,
  type FilterSortDir,
} from "./codex-filters";
import { VersionSelector } from "./version-selector";
import {
  CodexLibraryShell,
  CodexLibraryTopBar,
  useCodexFilterDrawer,
} from "./codex-filter-drawer";

interface PowerLibraryProps {
  serviceLocale: ServiceLocale;
  gameUi: CodexGameUiLabels;
  title: string;
  powers: CodexPower[];
  cards?: CodexCard[];
  relics?: CodexRelic[];
  potions?: CodexPotion[];
  enchantments?: CodexEnchantment[];
  events?: CodexEvent[];
  monsters?: CodexMonster[];
  versions?: string[];
  currentVersion?: string;
  patches?: STS2Patch[];
  changes?: STS2Change[];
  versionDiffs?: EntityVersionDiff[];
  entities?: EntityInfo[];
}

export function PowerLibrary({ serviceLocale, gameUi, title, powers, cards = [], relics = [], potions = [], enchantments = [], events = [], monsters = [], versions, currentVersion, patches, changes, versionDiffs, entities }: PowerLibraryProps) {
  const serviceText = getCodexServiceMessages(serviceLocale);
  const urlPowerId = useHydrationSafeSearchParam("power");
  const [selectedTypes, setSelectedTypes] = useState<Set<PowerType>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedVersion, setSelectedVersion] = useState(currentVersion ?? "");
  const [showBeta, setShowBeta] = useState(false);
  const [typeSortDir, setTypeSortDir] = useState<FilterSortDir>("asc");
  const hasBetaArt = powers.some((power) => power.betaImageUrl);

  // Power detail modal
  const [selectedPowerIdOverride, setSelectedPowerIdOverride] = useState<string | null>(null);
  const [useUrlSelection, setUseUrlSelection] = useState(true);
  const selectedPowerId = useUrlSelection ? urlPowerId : selectedPowerIdOverride;

  const selectPower = useCallback((powerId: string) => {
    setUseUrlSelection(false);
    setSelectedPowerIdOverride(powerId);
  }, [setSelectedPowerIdOverride, setUseUrlSelection]);

  const closeSelectedPower = useCallback(() => {
    setUseUrlSelection(false);
    setSelectedPowerIdOverride(null);
  }, [setSelectedPowerIdOverride, setUseUrlSelection]);

  useEffect(() => {
    if (useUrlSelection) return;
    const url = new URL(window.location.href);
    if (selectedPowerIdOverride) {
      url.searchParams.set("power", selectedPowerIdOverride.toLowerCase());
    } else {
      url.searchParams.delete("power");
    }
    if (url.toString() !== window.location.href) {
      pushCodexHistoryState(url);
    }
  }, [selectedPowerIdOverride, useUrlSelection]);

  useEffect(() => {
    const handler = () => {
      setUseUrlSelection(true);
      setSelectedPowerIdOverride(null);
    };
    return addCodexUrlChangeListener(handler);
  }, []);

  useEffect(() => {
    if (!selectedPowerId) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSelectedPower();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [closeSelectedPower, selectedPowerId]);

  const versionedPowers = useMemo(() => {
    return versionCodexEntities(powers, "power", {
      selectedVersion,
      currentVersion,
      versionDiffs,
      patches,
      changes,
    });
  }, [powers, selectedVersion, currentVersion, versionDiffs, patches, changes]);

  const selectedPower = useMemo(() => {
    if (!selectedPowerId) return null;
    return versionedPowers.find((p) => p.id.toLowerCase() === selectedPowerId.toLowerCase()) ?? null;
  }, [selectedPowerId, versionedPowers]);

  const searchText = useMemo(() => searchQuery.trim().toLowerCase(), [searchQuery]);

  // Filtered powers
  const filteredPowers = useMemo(() => {
    let result = versionedPowers;

    // Type filter (sidebar)
    if (selectedTypes.size > 0) {
      result = result.filter((p) => selectedTypes.has(p.type));
    }

    // Text search
    if (searchText) {
      result = result.filter(
        (p) =>
          fuzzyMatchCodexText(p.name, searchText) ||
          fuzzyMatchCodexText(p.nameEn, searchText) ||
          fuzzyMatchCodexText(stripCodexMarkup(p.description), searchText) ||
          fuzzyMatchCodexText(stripCodexMarkup(p.descriptionEn), searchText)
      );
    }

    return result;
  }, [versionedPowers, selectedTypes, searchText]);

  // Group by type
  const groupedPowers = useMemo(() => {
    const groups: { type: PowerType; powers: CodexPower[] }[] = [];
    for (const type of orderByFilterSortDir(POWER_TYPE_ORDER, typeSortDir)) {
      const group = filteredPowers
        .filter((p) => p.type === type)
        .sort((a, b) => a.name.localeCompare(b.name, "ko"));
      if (group.length > 0) {
        groups.push({ type, powers: group });
      }
    }
    return groups;
  }, [filteredPowers, typeSortDir]);

  const toggleType = useCallback((type: PowerType) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

  const typeFilters = orderByFilterSortDir(POWER_TYPE_ORDER.filter((t) => t !== "None"), typeSortDir).map((t) => ({
    key: t,
    label: getPowerTypeLabel(t, serviceText, gameUi),
    color: POWER_TYPE_CONFIG[t].color,
  }));

  const { sidebarOpen, setSidebarOpen, isMobile } = useCodexFilterDrawer();

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
          placeholder={serviceLocale === "ko" ? "검색" : "Search"}
        />

        {/* Type filter */}
        <FilterSection trigger="#" label={serviceText.powersView.typeFilter} sortDir={typeSortDir} onSortToggle={() => setTypeSortDir(toggleFilterSortDir)} sortTitle={serviceText.common.sortButtonTitle}>
          <div className="flex flex-col gap-0.5">
            {typeFilters.map((t) => (
              <button
                key={t.key}
                onClick={() => toggleType(t.key)}
                className={`flex items-center gap-2 text-left text-sm px-2.5 py-1 rounded transition-all ${
                  selectedTypes.has(t.key)
                    ? "bg-yellow-500/20 text-yellow-400"
                    : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: t.color }}
                />
                {t.label}
              </button>
            ))}
          </div>
        </FilterSection>

        {hasBetaArt && (
          <>
            <div className="border-t border-white/10" />

            <div className="flex flex-col gap-1">
              <ToggleButton
                label={serviceText.cardsView.toggles.betaArt}
                active={showBeta}
                onClick={() => setShowBeta((v) => !v)}
              />
            </div>
          </>
        )}

        </>
      )}
    >

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <CodexLibraryTopBar
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          closeFiltersLabel={serviceText.common.closeFilters}
          openFiltersLabel={serviceText.common.openFilters}
          title={title}
          count={formatCodexCount(filteredPowers.length, serviceText.labels.powers, serviceLocale)}
          trailing={versions && versions.length > 0 && currentVersion ? (
            <VersionSelector
              versions={versions}
              currentVersion={currentVersion}
              selectedVersion={selectedVersion}
              onChange={setSelectedVersion}
            />
          ) : undefined}
        />

        {/* Power Grid (grouped by type) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {groupedPowers.map(({ type, powers: groupPowers }) => (
            <section key={type} className="mb-8 last:mb-0">
              <div className="mb-3">
                <h2
                  className="font-game-title text-lg font-bold mb-0.5"
                  style={{ color: POWER_TYPE_CONFIG[type].color }}
                >
                  {getPowerTypeLabel(type, serviceText, gameUi)}
                  {getPowerTypeDescription(type, serviceText, gameUi) && (
                    <span className="font-game-text text-sm font-normal text-gray-400 ml-2">
                      {getPowerTypeDescription(type, serviceText, gameUi)}
                    </span>
                  )}
                </h2>
              </div>

              <div className="flex flex-wrap gap-2">
                {groupPowers.map((power) => (
                  <PowerTile
                    key={power.id}
                    serviceLocale={serviceLocale}
                    gameUi={gameUi}
                    power={power}
                    showBeta={showBeta}
                    onClick={() => selectPower(power.id)}
                  />
                ))}
              </div>
            </section>
          ))}

          {filteredPowers.length === 0 && (
            <div className="flex items-center justify-center h-64 text-gray-500">
              {serviceText.common.noResults}
            </div>
          )}
        </div>
      </main>

      {/* Power Detail Modal */}
      {selectedPower && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeSelectedPower();
          }}
        >
          <div className="my-8 mx-4 w-full max-w-6xl">
            <PowerDetail
              serviceLocale={serviceLocale}
              gameUi={gameUi}
              backToListTitle={title}
              power={selectedPower}
              initialShowBeta={showBeta}
              patches={patches}
              changes={changes}
              versionDiffs={versionDiffs}
              entities={entities}
              relatedCards={cards}
              relatedRelics={relics}
              relatedPotions={potions}
              relatedEnchantments={enchantments}
              relatedEvents={events}
              relatedMonsters={monsters}
              onClose={closeSelectedPower}
            />
          </div>
        </div>
      )}
    </CodexLibraryShell>
  );
}

function getPowerTypeLabel(
  type: PowerType,
  serviceText: CodexServiceMessages,
  gameUi: CodexGameUiLabels,
): string {
  return gameUi.powers.types[type].label || serviceText.labels.powerTypes[type].label;
}

function getPowerTypeDescription(
  type: PowerType,
  serviceText: CodexServiceMessages,
  gameUi: CodexGameUiLabels,
): string {
  return gameUi.powers.types[type].description || (type === "None" ? serviceText.labels.powerTypes[type].description : "");
}
