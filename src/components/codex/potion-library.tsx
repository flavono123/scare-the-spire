"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import Image from "@/components/ui/static-image";
import { DescriptionText } from "./codex-description";
import { PotionDetail } from "./potion-detail";
import { GameHoverTip } from "./hover-tip";
import {
  addCodexUrlChangeListener,
  pushCodexHistoryState,
  useHydrationSafeSearchParam,
} from "./use-hydration-safe-search-param";
import type { ServiceLocale } from "@/lib/i18n";
import type { CodexGameUiLabels } from "@/lib/codex-game-ui";
import type { EntityInfo } from "@/components/patch-note-renderer";
import {
  formatCodexCount,
  getCodexServiceMessages,
} from "@/lib/codex-service";
import {
  CodexCard,
  CodexEnchantment,
  CodexPotion,
  CodexCharacter,
  CodexEvent,
  CodexPower,
  PotionRarityKo,
  PotionPool,
  characterOutlineFilter,
} from "@/lib/codex-types";
import type { STS2Patch, STS2Change, EntityVersionDiff } from "@/lib/types";
import { versionCodexEntities } from "@/lib/codex-versioning";
import {
  fuzzyMatchCodexText,
  stripCodexMarkup,
} from "@/lib/codex-search";
import { VersionSelector } from "./version-selector";
import { SearchBar } from "./search-bar";
import {
  FilterSection,
  IconFilterButton,
  orderByFilterSortDir,
  toggleFilterSortDir,
  type FilterSortDir,
} from "./codex-filters";
import { GameCheckboxToggle } from "./game-checkbox";
import {
  CodexLibraryShell,
  CodexLibraryTopBar,
  useCodexFilterDrawer,
} from "./codex-filter-drawer";
import {
  COLORLESS_FILTER_ICON,
  EVENT_FILTER_ICON,
  getCharacterTokenIcon,
} from "./codex-filter-assets";
import {
  FUTURE_OF_POTIONS_EVENT_NAME_KO,
  FUTURE_OF_POTIONS_OUTCOMES,
  formatFuturePotionOutcome,
  getFuturePotionOutcomeIdsForPotion,
  type FuturePotionOutcomeId,
} from "@/lib/codex-references";

type PotionSectionKey = keyof CodexGameUiLabels["potionLab"]["sections"];
type PotionSortKey = "pool" | "rarity" | "future";

// Rarity sections to display (merge 이벤트 + 토큰 into 특별)
const DISPLAY_SECTIONS: {
  key: PotionSectionKey;
  color: string;
  rarities: PotionRarityKo[];
}[] = [
  {
    key: "common",
    color: "#b0b0b0",
    rarities: ["일반"],
  },
  {
    key: "uncommon",
    color: "#4fc3f7",
    rarities: ["고급"],
  },
  {
    key: "rare",
    color: "#ffd740",
    rarities: ["희귀"],
  },
  {
    key: "special",
    color: "#81c784",
    rarities: ["이벤트", "토큰"],
  },
];

// Character pools (excluding shared/event)
const CHARACTER_POOLS: PotionPool[] = [
  "ironclad",
  "silent",
  "defect",
  "necrobinder",
  "regent",
];

interface PotionLibraryProps {
  serviceLocale: ServiceLocale;
  gameUi: CodexGameUiLabels;
  title: string;
  potions: CodexPotion[];
  characters: CodexCharacter[];
  versions?: string[];
  currentVersion?: string;
  patches?: STS2Patch[];
  changes?: STS2Change[];
  versionDiffs?: EntityVersionDiff[];
  relatedCards?: CodexCard[];
  relatedEnchantments?: CodexEnchantment[];
  relatedEvents?: CodexEvent[];
  relatedPowers?: CodexPower[];
  entities?: EntityInfo[];
}

export function PotionLibrary({ serviceLocale, gameUi, title, potions, characters, versions, currentVersion, patches, changes, versionDiffs, relatedCards = [], relatedEnchantments = [], relatedEvents = [], relatedPowers = [], entities }: PotionLibraryProps) {
  const serviceText = getCodexServiceMessages(serviceLocale);
  const urlPotionId = useHydrationSafeSearchParam("potion");
  const [selectedPools, setSelectedPools] = useState<Set<PotionPool>>(
    new Set()
  );
  const [selectedRarities, setSelectedRarities] = useState<Set<string>>(
    new Set()
  );
  const [selectedFutureOutcomes, setSelectedFutureOutcomes] = useState<Set<FuturePotionOutcomeId>>(
    new Set()
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedVersion, setSelectedVersion] = useState(currentVersion ?? "");
  const [sortDirs, setSortDirs] = useState<Record<PotionSortKey, FilterSortDir>>({
    pool: "asc",
    rarity: "asc",
    future: "asc",
  });

  // Potion detail modal
  const [selectedPotionOverride, setSelectedPotionOverride] = useState<CodexPotion | null>(null);
  const [useUrlSelection, setUseUrlSelection] = useState(true);
  const urlSelectedPotion = useMemo(() => (
    urlPotionId
      ? potions.find((p) => p.id.toLowerCase() === urlPotionId.toLowerCase()) ?? null
      : null
  ), [potions, urlPotionId]);
  const selectedPotion = useUrlSelection ? urlSelectedPotion : selectedPotionOverride;

  const selectPotion = useCallback((potion: CodexPotion) => {
    setUseUrlSelection(false);
    setSelectedPotionOverride(potion);
  }, [setSelectedPotionOverride, setUseUrlSelection]);

  const closeSelectedPotion = useCallback(() => {
    setUseUrlSelection(false);
    setSelectedPotionOverride(null);
  }, [setSelectedPotionOverride, setUseUrlSelection]);

  // Update URL query param when modal opens/closes
  useEffect(() => {
    if (useUrlSelection) return;
    const url = new URL(window.location.href);
    if (selectedPotionOverride) {
      url.searchParams.set("potion", selectedPotionOverride.id.toLowerCase());
    } else {
      url.searchParams.delete("potion");
    }
    if (url.toString() !== window.location.href) {
      pushCodexHistoryState(url);
    }
  }, [selectedPotionOverride, useUrlSelection]);

  // Handle browser back button
  useEffect(() => {
    const handler = () => {
      setUseUrlSelection(true);
      setSelectedPotionOverride(null);
    };
    return addCodexUrlChangeListener(handler);
  }, []);

  // Close modal on Escape
  useEffect(() => {
    if (!selectedPotion) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSelectedPotion();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [closeSelectedPotion, selectedPotion]);

  const versionedPotions = useMemo(() => {
    return versionCodexEntities(potions, "potion", {
      selectedVersion,
      currentVersion,
      versionDiffs,
      patches,
      changes,
    });
  }, [potions, selectedVersion, currentVersion, versionDiffs, patches, changes]);

  const { sidebarOpen, setSidebarOpen, isMobile } = useCodexFilterDrawer();

  const searchText = useMemo(() => searchQuery.trim().toLowerCase(), [searchQuery]);

  // Filter potions
  const filteredPotions = useMemo(() => {
    let result = versionedPotions;

    // Pool filter (sidebar)
    if (selectedPools.size > 0) {
      result = result.filter(
        (p) => selectedPools.has(p.pool) || (selectedPools.has("shared" as PotionPool) && p.pool === "shared")
      );
    }

    // Rarity filter (sidebar)
    if (selectedRarities.size > 0) {
      result = result.filter((p) => {
        return selectedRarities.has(getPotionSectionKey(p.rarity));
      });
    }

    if (selectedFutureOutcomes.size > 0) {
      result = result.filter((potion) =>
        getFuturePotionOutcomeIdsForPotion(potion).some((id) => selectedFutureOutcomes.has(id))
      );
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
  }, [versionedPotions, selectedPools, selectedRarities, selectedFutureOutcomes, searchText]);

  // Group by rarity sections
  const sections = useMemo(() => {
    return orderByFilterSortDir(DISPLAY_SECTIONS, sortDirs.rarity).map((section) => ({
      ...section,
      label: gameUi.potionLab.sections[section.key].label,
      description: gameUi.potionLab.sections[section.key].description,
      potions: filteredPotions
        .filter((p) => section.rarities.includes(p.rarity))
        .sort((a, b) => a.name.localeCompare(b.name, "ko")),
    })).filter((s) => s.potions.length > 0);
  }, [filteredPotions, gameUi, sortDirs.rarity]);

  const toggleSort = useCallback((key: PotionSortKey) => {
    setSortDirs((prev) => ({ ...prev, [key]: toggleFilterSortDir(prev[key]) }));
  }, []);

  // Toggle helpers
  const togglePool = useCallback((pool: PotionPool) => {
    setSelectedPools((prev) => {
      const next = new Set(prev);
      if (next.has(pool)) next.delete(pool);
      else next.add(pool);
      return next;
    });
  }, []);

  const toggleRarity = useCallback((rarity: string) => {
    setSelectedRarities((prev) => {
      const next = new Set(prev);
      if (next.has(rarity)) next.delete(rarity);
      else next.add(rarity);
      return next;
    });
  }, []);

  const toggleFutureOutcome = useCallback((outcomeId: FuturePotionOutcomeId) => {
    setSelectedFutureOutcomes((prev) => {
      const next = new Set(prev);
      if (next.has(outcomeId)) next.delete(outcomeId);
      else next.add(outcomeId);
      return next;
    });
  }, []);

  // Character filters from props
  const poolLabels = useMemo(() => {
    const labels: Record<PotionPool, string> = {
      shared: serviceText.labels.pools.shared,
      event: gameUi.eventsTitle,
      ironclad: serviceText.labels.pools.ironclad,
      silent: serviceText.labels.pools.silent,
      defect: serviceText.labels.pools.defect,
      necrobinder: serviceText.labels.pools.necrobinder,
      regent: serviceText.labels.pools.regent,
    };
    for (const character of characters) {
      labels[character.id.toLowerCase() as PotionPool] = character.name;
    }
    return labels;
  }, [characters, gameUi.eventsTitle, serviceText]);

  const characterFilters = orderByFilterSortDir(characters, sortDirs.pool)
    .filter((c) =>
      CHARACTER_POOLS.includes(c.id.toLowerCase() as PotionPool)
    )
    .map((c) => ({
      key: c.id.toLowerCase() as PotionPool,
      label: c.name,
      icon: getCharacterTokenIcon(c.id, c.imageUrl),
    }));

  const extraPoolFilters = orderByFilterSortDir([
    { key: "shared" as const, label: poolLabels.shared, icon: COLORLESS_FILTER_ICON },
    { key: "event" as const, label: poolLabels.event, icon: EVENT_FILTER_ICON },
  ], sortDirs.pool);

  const rarityFilters = orderByFilterSortDir(DISPLAY_SECTIONS, sortDirs.rarity).map((s) => ({
    key: s.key,
    label: gameUi.potionLab.sections[s.key].label,
    color: s.color,
  }));

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

        {/* Character/Pool Filters */}
        <FilterSection trigger="@" label={serviceText.labels.affiliation} sortDir={sortDirs.pool} onSortToggle={() => toggleSort("pool")} sortTitle={serviceText.common.sortButtonTitle}>
          <div className="grid grid-cols-5 gap-1.5">
            {characterFilters.map((cf) => (
              <IconFilterButton
                key={cf.key}
                icon={cf.icon}
                label={cf.label}
                active={selectedPools.has(cf.key)}
                onClick={() => togglePool(cf.key)}
              />
            ))}
            {extraPoolFilters.map((filter) => (
              <IconFilterButton
                key={filter.key}
                icon={filter.icon}
                label={filter.label}
                active={selectedPools.has(filter.key)}
                onClick={() => togglePool(filter.key)}
              />
            ))}
          </div>
        </FilterSection>

        <div className="border-t border-white/10" />

        {/* Rarity */}
        <FilterSection trigger="$" label={gameUi.common.rarity} sortDir={sortDirs.rarity} onSortToggle={() => toggleSort("rarity")} sortTitle={serviceText.common.sortButtonTitle}>
          <div className="flex flex-col gap-0.5">
            {rarityFilters.map((r) => (
              <button
                key={r.key}
                onClick={() => toggleRarity(r.key)}
                className={`flex items-center gap-2 text-left text-sm px-2.5 py-1 rounded transition-all ${
                  selectedRarities.has(r.key)
                    ? "bg-yellow-500/20 text-yellow-400"
                    : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: r.color }}
                />
                {r.label}
              </button>
            ))}
          </div>
        </FilterSection>

        <div className="border-t border-white/10" />

        <FilterSection trigger="?" label={FUTURE_OF_POTIONS_EVENT_NAME_KO} sortDir={sortDirs.future} onSortToggle={() => toggleSort("future")} sortTitle={serviceText.common.sortButtonTitle}>
          <div className="flex flex-col gap-1">
            {orderByFilterSortDir(FUTURE_OF_POTIONS_OUTCOMES, sortDirs.future).map((outcome) => {
              const active = selectedFutureOutcomes.has(outcome.id);
              return (
                <GameCheckboxToggle
                  key={outcome.id}
                  checked={active}
                  onCheckedChange={() => toggleFutureOutcome(outcome.id)}
                  label={formatFuturePotionOutcome(outcome)}
                  size="sm"
                  align="start"
                  className="w-full py-1.5"
                  labelClassName="font-game-text text-xs leading-relaxed text-[#e5d68a]"
                />
              );
            })}
          </div>
        </FilterSection>
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
          count={formatCodexCount(filteredPotions.length, serviceText.labels.potions, serviceLocale)}
          trailing={versions && versions.length > 0 && currentVersion ? (
            <VersionSelector
              versions={versions}
              currentVersion={currentVersion}
              selectedVersion={selectedVersion}
              onChange={setSelectedVersion}
            />
          ) : undefined}
        />

        {/* Potion Grid by Rarity */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {sections.map((section) => (
            <div key={section.key} className="mb-8 last:mb-0">
              {/* Section header */}
              <div className="mb-3">
                <span
                  className="font-game-title text-lg font-bold"
                  style={{ color: section.color }}
                >
                  {section.label}:
                </span>
                <span className="ml-2 text-sm text-gray-400">
                  {section.description}
                </span>
              </div>

              {/* Potion icon grid */}
              <div className="flex flex-wrap gap-2 sm:gap-3">
                {section.potions.map((potion) => (
                  <PotionTile
                    key={potion.id}
                    potion={potion}
                    onClick={() => selectPotion(potion)}
                  />
                ))}
              </div>
            </div>
          ))}

          {sections.length === 0 && (
            <div className="flex items-center justify-center h-64 text-gray-500">
              {serviceText.common.noResults}
            </div>
          )}
        </div>
      </main>

      {/* Potion Detail Modal */}
      {selectedPotion && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeSelectedPotion();
          }}
        >
          <div className="my-8 mx-4 w-full max-w-6xl">
            <PotionDetail serviceLocale={serviceLocale} gameUi={gameUi} backToListTitle={title} potion={selectedPotion} poolLabels={poolLabels} relatedCards={relatedCards} relatedEnchantments={relatedEnchantments} relatedEvents={relatedEvents} relatedPowers={relatedPowers} patches={patches} changes={changes} versionDiffs={versionDiffs} entities={entities} onClose={closeSelectedPotion} />
          </div>
        </div>
      )}
    </CodexLibraryShell>
  );
}

type TooltipPlacement = {
  horizontal: "left" | "right";
  vertical: "top" | "bottom";
};

const TOOLTIP_GAP = 12;
const TOOLTIP_WIDTH = 380;
const TOOLTIP_HEIGHT = 220;

// Individual potion icon tile
function PotionTile({
  potion,
  onClick,
}: {
  potion: CodexPotion;
  onClick?: () => void;
}) {
  const tileRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  const [placement, setPlacement] = useState<TooltipPlacement>({
    horizontal: "right",
    vertical: "top",
  });
  const lifecycleClassName = potion.deprecated ? " opacity-50 grayscale saturate-0" : "";

  const updatePlacement = useCallback(() => {
    const rect = tileRef.current?.getBoundingClientRect();
    if (!rect) return;
    const horizontal = rect.right + TOOLTIP_GAP + TOOLTIP_WIDTH > window.innerWidth
      ? "left"
      : "right";
    const vertical = rect.top + TOOLTIP_HEIGHT > window.innerHeight
      ? "bottom"
      : "top";
    setPlacement({ horizontal, vertical });
  }, []);

  return (
    <div
      ref={tileRef}
      className="group relative"
      onMouseEnter={() => {
        updatePlacement();
        setHovered(true);
      }}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        data-potion-tile={potion.id}
        className={`flex h-14 w-14 items-center justify-center rounded-lg border-2 p-1 transition-all sm:h-16 sm:w-16${lifecycleClassName} ${
          hovered
            ? "z-10 scale-110 border-yellow-500/60 bg-yellow-500/10"
            : "border-transparent bg-white/5 hover:bg-white/10"
        }`}
        onClick={onClick}
      >
        <Image
          src={potion.imageUrl}
          alt={potion.name}
          width={48}
          height={48}
          loading="lazy"
          className="h-10 w-10 object-contain sm:h-12 sm:w-12"
          style={{
            filter: characterOutlineFilter(potion.pool) ?? "drop-shadow(0 2px 4px rgba(0,0,0,0.5))",
          }}
        />
      </button>

      {hovered && (
        <div
          className={`pointer-events-none absolute z-50 hidden w-max max-w-[24rem] md:block ${
            placement.horizontal === "right" ? "left-full ml-3" : "right-full mr-3"
          } ${placement.vertical === "top" ? "top-0" : "bottom-0"}`}
        >
          <span className="flex w-max max-w-[24rem] items-start gap-2.5">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-black/20">
              <Image
                src={potion.imageUrl}
                alt={potion.name}
                width={64}
                height={64}
                loading="lazy"
                className="h-14 w-14 object-contain"
                style={{
                  filter: characterOutlineFilter(potion.pool) ?? "drop-shadow(0 2px 4px rgba(0,0,0,0.5))",
                }}
              />
            </span>
            <GameHoverTip title={potion.name} style={{ minWidth: 240, maxWidth: 320 }}>
              <DescriptionText description={potion.description} className="block text-left" />
            </GameHoverTip>
          </span>
        </div>
      )}
    </div>
  );
}

function getPotionSectionKey(rarity: PotionRarityKo): string {
  if (rarity === "일반") return "common";
  if (rarity === "고급") return "uncommon";
  if (rarity === "희귀") return "rare";
  return "special";
}
