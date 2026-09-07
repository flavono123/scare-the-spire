"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CompendiumDetailOverlay,
  CompendiumIndexLayout,
  CompendiumIndexScroller,
  CompendiumIndexTopBar,
  useCodexFilterDrawer,
} from "@/components/codex/codex-filter-drawer";
import {
  FilterSection,
  IconFilterButton,
  ToggleButton,
  orderByFilterSortDir,
  toggleFilterSortDir,
  type FilterSortDir,
} from "@/components/codex/codex-filters";
import { SearchBar } from "@/components/codex/search-bar";
import {
  addCodexUrlChangeListener,
  pushCodexHistoryState,
  useHydrationSafeSearchParam,
} from "@/components/codex/use-hydration-safe-search-param";
import { formatCodexCount, getCodexServiceMessages } from "@/lib/codex-service";
import { fuzzyMatchCodexText } from "@/lib/codex-search";
import { localizeHref, type ServiceLocale } from "@/lib/i18n";
import { STS1_FILTER_ICONS, sts1TypeFilterIcon } from "@/lib/sts1/card-style";
import { sts1DetailPath } from "@/lib/sts1/paths";
import { sts1MatchesCostFilter } from "@/lib/sts1/stats";
import type {
  Sts1Card,
  Sts1CardColor,
  Sts1CardType,
  Sts1Keyword,
  Sts1UiLabels,
} from "@/lib/sts1/types";
import { Sts1CardDetail } from "./card-detail";
import { Sts1CardTile } from "./card-tile";

type RarityFilter = "common" | "uncommon" | "rare" | "other";
const COST_OPTIONS = [0, 1, 2, 3, "3+", "X"] as const;
const COLOR_ORDER: Record<string, number> = {
  ironclad: 0,
  silent: 1,
  defect: 2,
  watcher: 3,
  colorless: 4,
  status: 5,
  curse: 6,
  special: 7,
};
const TYPE_ORDER: Record<string, number> = {
  attack: 0,
  skill: 1,
  power: 2,
  curse: 3,
  status: 4,
};
const RARITY_ORDER: Record<string, number> = {
  basic: 0,
  common: 1,
  uncommon: 2,
  rare: 3,
  special: 4,
  curse: 4,
};

type ColorFilter = Sts1CardColor | "status" | "special";
type SortKey = "color" | "type" | "rarity" | "cost" | "name";

function cardCategory(card: Sts1Card): string {
  if (card.type === "status") return "status";
  if (card.rarity === "special") return "special";
  return card.color;
}

function matchesColor(card: Sts1Card, filter: ColorFilter): boolean {
  switch (filter) {
    case "status":
      return card.type === "status";
    case "special":
      return card.rarity === "special";
    case "colorless":
      return card.color === "colorless" && card.type !== "status" && card.rarity !== "special";
    case "curse":
      return card.color === "curse" || card.type === "curse";
    default:
      return card.color === filter;
  }
}

function isEtcRarity(card: Sts1Card): boolean {
  return card.rarity === "basic" || card.rarity === "special" || card.rarity === "curse" || card.type === "status";
}

function rarityFilterKey(card: Sts1Card): RarityFilter {
  if (isEtcRarity(card)) return "other";
  if (card.rarity === "common") return "common";
  if (card.rarity === "uncommon") return "uncommon";
  return "rare";
}

export function Sts1CardLibrary({
  cards,
  labels,
  keywords,
  serviceLocale,
}: {
  cards: Sts1Card[];
  labels: Sts1UiLabels;
  keywords: Sts1Keyword[];
  serviceLocale: ServiceLocale;
}) {
  const serviceText = getCodexServiceMessages(serviceLocale);
  const urlCardId = useHydrationSafeSearchParam("card");
  const [selectedColors, setSelectedColors] = useState<Set<ColorFilter>>(new Set());
  const [selectedTypes, setSelectedTypes] = useState<Set<Sts1CardType>>(new Set());
  const [selectedRarities, setSelectedRarities] = useState<Set<RarityFilter>>(new Set());
  const [selectedCosts, setSelectedCosts] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [showUpgrades, setShowUpgrades] = useState(false);
  const [showBeta, setShowBeta] = useState(false);
  const [sortDirs, setSortDirs] = useState<Record<SortKey, FilterSortDir>>({
    color: "asc",
    type: "asc",
    rarity: "asc",
    cost: "asc",
    name: "asc",
  });
  const [selectedOverride, setSelectedOverride] = useState<Sts1Card | null>(null);
  const [useUrlSelection, setUseUrlSelection] = useState(true);
  const { sidebarOpen, setSidebarOpen, isMobile } = useCodexFilterDrawer();

  const selectedCard = useMemo(() => {
    if (!useUrlSelection) return selectedOverride;
    if (!urlCardId) return null;
    return cards.find((card) => (
      card.slug === urlCardId.toLowerCase()
      || card.legacySlugs.includes(urlCardId.toLowerCase())
    )) ?? null;
  }, [cards, selectedOverride, urlCardId, useUrlSelection]);

  const openCard = useCallback((card: Sts1Card) => {
    setUseUrlSelection(false);
    setSelectedOverride(card);
  }, []);

  const closeCard = useCallback(() => {
    setUseUrlSelection(false);
    setSelectedOverride(null);
  }, []);

  useEffect(() => {
    if (useUrlSelection) return;
    const url = new URL(window.location.href);
    if (selectedOverride) url.searchParams.set("card", selectedOverride.slug);
    else url.searchParams.delete("card");
    if (url.toString() !== window.location.href) pushCodexHistoryState(url);
  }, [selectedOverride, useUrlSelection]);

  useEffect(() => addCodexUrlChangeListener(() => {
    setUseUrlSelection(true);
    setSelectedOverride(null);
  }), []);

  useEffect(() => {
    if (!selectedCard) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeCard();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [closeCard, selectedCard]);

  const toggle = <T,>(set: Set<T>, value: T, setter: (next: Set<T>) => void) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    setter(next);
  };

  const filteredCards = useMemo(() => {
    const query = searchQuery.trim();
    return cards
      .filter((card) => {
        if (selectedColors.size && ![...selectedColors].some((filter) => matchesColor(card, filter))) {
          return false;
        }
        if (selectedTypes.size) {
          if (card.type !== "attack" && card.type !== "skill" && card.type !== "power") return false;
          if (!selectedTypes.has(card.type)) return false;
        }
        if (selectedRarities.size && !selectedRarities.has(rarityFilterKey(card))) {
          return false;
        }
        if (!sts1MatchesCostFilter(card.cost, selectedCosts)) return false;
        if (query && !fuzzyMatchCodexText(`${card.name} ${card.id} ${card.description}`, query)) {
          return false;
        }
        return true;
      })
      .sort((left, right) => {
        const keys: SortKey[] = ["color", "type", "rarity", "cost", "name"];
        for (const key of keys) {
          const dir = sortDirs[key] === "desc" ? -1 : 1;
          let cmp = 0;
          if (key === "color") cmp = (COLOR_ORDER[cardCategory(left)] ?? 99) - (COLOR_ORDER[cardCategory(right)] ?? 99);
          if (key === "type") cmp = (TYPE_ORDER[left.type] ?? 99) - (TYPE_ORDER[right.type] ?? 99);
          if (key === "rarity") cmp = (RARITY_ORDER[left.rarity] ?? 99) - (RARITY_ORDER[right.rarity] ?? 99);
          if (key === "cost") cmp = left.cost - right.cost;
          if (key === "name") cmp = left.name.localeCompare(right.name, serviceLocale === "ko" ? "ko" : "en");
          if (cmp) return cmp * dir;
        }
        return 0;
      });
  }, [cards, searchQuery, selectedColors, selectedCosts, selectedRarities, selectedTypes, serviceLocale, sortDirs]);

  const characterFilters = [
    { key: "ironclad" as const, label: labels.characters.ironclad, icon: STS1_FILTER_ICONS.ironclad },
    { key: "silent" as const, label: labels.characters.silent, icon: STS1_FILTER_ICONS.silent },
    { key: "defect" as const, label: labels.characters.defect, icon: STS1_FILTER_ICONS.defect },
    { key: "watcher" as const, label: labels.characters.watcher, icon: STS1_FILTER_ICONS.watcher },
  ];
  const extraFilters = [
    { key: "colorless" as const, label: labels.extras.colorless, icon: STS1_FILTER_ICONS.colorless },
    { key: "status" as const, label: labels.extras.status, icon: STS1_FILTER_ICONS.status },
    { key: "curse" as const, label: labels.extras.curse, icon: STS1_FILTER_ICONS.curse },
    { key: "special" as const, label: labels.extras.special, icon: STS1_FILTER_ICONS.special },
  ];

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
            inputId="sts1-card-search"
            placeholder={serviceLocale === "ko" ? "검색" : "Search"}
          />
          <FilterSection
            label={serviceText.labels.affiliation}
            sortDir={sortDirs.color}
            onSortToggle={() => setSortDirs((current) => ({ ...current, color: toggleFilterSortDir(current.color) }))}
          >
            <div className="flex flex-col gap-1.5">
              <div className="grid grid-cols-4 gap-1.5">
                {orderByFilterSortDir(characterFilters, sortDirs.color).map((filter) => (
                  <IconFilterButton
                    key={filter.key}
                    icon={filter.icon}
                    label={filter.label}
                    active={selectedColors.has(filter.key)}
                    onClick={() => toggle(selectedColors, filter.key, setSelectedColors)}
                  />
                ))}
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {orderByFilterSortDir(extraFilters, sortDirs.color).map((filter) => (
                  <IconFilterButton
                    key={filter.key}
                    icon={filter.icon}
                    label={filter.label}
                    active={selectedColors.has(filter.key)}
                    onClick={() => toggle(selectedColors, filter.key, setSelectedColors)}
                  />
                ))}
              </div>
            </div>
          </FilterSection>
          <FilterSection
            label={labels.sort.type}
            sortDir={sortDirs.type}
            onSortToggle={() => setSortDirs((current) => ({ ...current, type: toggleFilterSortDir(current.type) }))}
          >
            <div className="flex gap-1.5">
              {(["attack", "skill", "power"] as const).map((type) => (
                <IconFilterButton
                  key={type}
                  icon={sts1TypeFilterIcon(type)}
                  label={labels.types[type]}
                  active={selectedTypes.has(type)}
                  onClick={() => toggle(selectedTypes, type, setSelectedTypes)}
                />
              ))}
            </div>
          </FilterSection>
          <FilterSection
            label={labels.sort.rarity}
            sortDir={sortDirs.rarity}
            onSortToggle={() => setSortDirs((current) => ({ ...current, rarity: toggleFilterSortDir(current.rarity) }))}
          >
            <div className="flex flex-col gap-0.5">
              {[
                { key: "common" as const, label: labels.potionRarities.common },
                { key: "uncommon" as const, label: labels.potionRarities.uncommon },
                { key: "rare" as const, label: labels.potionRarities.rare },
                { key: "other" as const, label: serviceLocale === "ko" ? "기타" : "Other" },
              ].map((rarity) => (
                <button
                  key={rarity.key}
                  onClick={() => toggle(selectedRarities, rarity.key, setSelectedRarities)}
                  className={`rounded px-2.5 py-1 text-left text-sm ${selectedRarities.has(rarity.key) ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-white/5"}`}
                >
                  {rarity.label}
                </button>
              ))}
            </div>
          </FilterSection>
          <FilterSection
            label={labels.sort.cost}
            sortDir={sortDirs.cost}
            onSortToggle={() => setSortDirs((current) => ({ ...current, cost: toggleFilterSortDir(current.cost) }))}
          >
            <div className="flex flex-wrap gap-1">
              {COST_OPTIONS.map((cost) => {
                const key = String(cost);
                return (
                  <button
                    key={key}
                    onClick={() => toggle(selectedCosts, key, setSelectedCosts)}
                    className={`h-7 w-8 rounded text-xs font-bold ${selectedCosts.has(key) ? "border border-primary bg-primary/30 text-primary" : "border border-white/10 bg-white/5 text-muted-foreground"}`}
                  >
                    {cost}
                  </button>
                );
              })}
            </div>
          </FilterSection>
          <FilterSection
            label={labels.sort.name}
            sortDir={sortDirs.name}
            onSortToggle={() => setSortDirs((current) => ({ ...current, name: toggleFilterSortDir(current.name) }))}
          >
            <span />
          </FilterSection>
          <ToggleButton
            label={labels.viewUpgrades}
            active={showUpgrades}
            onClick={() => setShowUpgrades((value) => !value)}
          />
          {cards.some((card) => card.hasBetaArt) ? (
            <ToggleButton
              label={labels.betaArt}
              active={showBeta}
              onClick={() => setShowBeta((value) => !value)}
            />
          ) : null}
        </>
      )}
    >
      <main className="flex flex-1 flex-col overflow-hidden">
        <CompendiumIndexTopBar
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          closeFiltersLabel={serviceText.common.closeFilters}
          openFiltersLabel={serviceText.common.openFilters}
          title={labels.cardLibraryTitle}
          count={formatCodexCount(filteredCards.length, serviceText.labels.cards, serviceLocale)}
        />
        <CompendiumIndexScroller scrollerClassName="p-3">
          <div
            className="grid justify-center gap-2 sm:gap-3"
            style={{ gridTemplateColumns: "repeat(auto-fill, 200px)" }}
          >
            {filteredCards.map((card) => (
              <Link
                key={card.slug}
                href={localizeHref(sts1DetailPath("cards", card.slug), serviceLocale)}
                className="block"
                onClick={(event) => {
                  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
                  event.preventDefault();
                  openCard(card);
                }}
              >
                <Sts1CardTile
                  card={card}
                  upgradeLevel={showUpgrades ? 1 : 0}
                  showBeta={showBeta}
                  keywords={keywords}
                />
              </Link>
            ))}
          </div>
        </CompendiumIndexScroller>
      </main>
      {selectedCard ? (
        <CompendiumDetailOverlay onClose={closeCard} aria-label={selectedCard.name}>
          <div className="w-full max-w-4xl rounded-lg bg-background shadow-xl" onClick={(event) => event.stopPropagation()}>
            <Sts1CardDetail
              card={selectedCard}
              labels={labels}
              keywords={keywords}
              serviceLocale={serviceLocale}
              showBeta={showBeta}
              onBetaChange={setShowBeta}
            />
          </div>
        </CompendiumDetailOverlay>
      ) : null}
    </CompendiumIndexLayout>
  );
}
