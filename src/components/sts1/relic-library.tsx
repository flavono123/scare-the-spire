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
import { FilterSection, IconFilterButton } from "@/components/codex/codex-filters";
import { SearchBar } from "@/components/codex/search-bar";
import {
  addCodexUrlChangeListener,
  pushCodexHistoryState,
  useHydrationSafeSearchParam,
} from "@/components/codex/use-hydration-safe-search-param";
import { formatCodexCount, getCodexServiceMessages } from "@/lib/codex-service";
import { fuzzyMatchCodexText } from "@/lib/codex-search";
import { localizeHref, type ServiceLocale } from "@/lib/i18n";
import { STS1_FILTER_ICONS, STS1_TIER_COLORS } from "@/lib/sts1/card-style";
import { sts1CardUiUrl, sts1DetailPath } from "@/lib/sts1/paths";
import type { Sts1Relic, Sts1RelicPool, Sts1RelicTier, Sts1UiLabels } from "@/lib/sts1/types";
import { Sts1RelicDetail } from "./relic-detail";
import { Sts1RelicTile } from "./relic-tile";

const TIER_ORDER: Exclude<Sts1RelicTier, "deprecated">[] = ["starter", "common", "uncommon", "rare", "shop", "special", "boss"];

export function Sts1RelicLibrary({
  relics,
  labels,
  serviceLocale,
}: {
  relics: Sts1Relic[];
  labels: Sts1UiLabels;
  serviceLocale: ServiceLocale;
}) {
  const serviceText = getCodexServiceMessages(serviceLocale);
  const urlRelicId = useHydrationSafeSearchParam("relic");
  const [selectedPools, setSelectedPools] = useState<Set<Sts1RelicPool>>(new Set());
  const [selectedTiers, setSelectedTiers] = useState<Set<Sts1RelicTier>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOverride, setSelectedOverride] = useState<Sts1Relic | null>(null);
  const [useUrlSelection, setUseUrlSelection] = useState(true);
  const { sidebarOpen, setSidebarOpen, isMobile } = useCodexFilterDrawer();

  const selectedRelic = useMemo(() => {
    if (!useUrlSelection) return selectedOverride;
    if (!urlRelicId) return null;
    return relics.find((relic) => (
      relic.slug === urlRelicId.toLowerCase()
      || relic.legacySlugs.includes(urlRelicId.toLowerCase())
    )) ?? null;
  }, [relics, selectedOverride, urlRelicId, useUrlSelection]);

  const openRelic = useCallback((relic: Sts1Relic) => {
    setUseUrlSelection(false);
    setSelectedOverride(relic);
  }, []);
  const closeRelic = useCallback(() => {
    setUseUrlSelection(false);
    setSelectedOverride(null);
  }, []);

  useEffect(() => {
    if (useUrlSelection) return;
    const url = new URL(window.location.href);
    if (selectedOverride) url.searchParams.set("relic", selectedOverride.slug);
    else url.searchParams.delete("relic");
    if (url.toString() !== window.location.href) pushCodexHistoryState(url);
  }, [selectedOverride, useUrlSelection]);

  useEffect(() => addCodexUrlChangeListener(() => {
    setUseUrlSelection(true);
    setSelectedOverride(null);
  }), []);

  const filtered = useMemo(() => {
    const query = searchQuery.trim();
    return relics.filter((relic) => {
      if (selectedPools.size && !selectedPools.has(relic.pool)) return false;
      if (selectedTiers.size && !selectedTiers.has(relic.tier)) return false;
      if (query && !fuzzyMatchCodexText(`${relic.name} ${relic.nameEn} ${relic.id} ${relic.description}`, query)) return false;
      return true;
    });
  }, [relics, searchQuery, selectedPools, selectedTiers]);

  const toggle = <T,>(set: Set<T>, value: T, setter: (next: Set<T>) => void) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    setter(next);
  };

  const poolFilters = [
    { key: "shared" as const, label: labels.shared, icon: sts1CardUiUrl("card_colorless_orb") },
    { key: "ironclad" as const, label: labels.characters.ironclad, icon: STS1_FILTER_ICONS.ironclad },
    { key: "silent" as const, label: labels.characters.silent, icon: STS1_FILTER_ICONS.silent },
    { key: "defect" as const, label: labels.characters.defect, icon: STS1_FILTER_ICONS.defect },
    { key: "watcher" as const, label: labels.characters.watcher, icon: STS1_FILTER_ICONS.watcher },
  ];

  return (
    <CompendiumIndexLayout
      sidebarOpen={sidebarOpen}
      setSidebarOpen={setSidebarOpen}
      isMobile={isMobile}
      sidebar={(
        <>
          <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder={serviceLocale === "ko" ? "검색" : "Search"} />
          <FilterSection label={serviceText.labels.affiliation}>
            <div className="grid grid-cols-5 gap-1.5">
              {poolFilters.map((filter) => (
                <IconFilterButton
                  key={filter.key}
                  icon={filter.icon}
                  label={filter.label}
                  active={selectedPools.has(filter.key)}
                  onClick={() => toggle(selectedPools, filter.key, setSelectedPools)}
                />
              ))}
            </div>
          </FilterSection>
          <FilterSection label={labels.sort.rarity}>
            <div className="flex flex-col gap-0.5">
              {TIER_ORDER.map((tier) => (
                <button
                  key={tier}
                  onClick={() => toggle(selectedTiers, tier, setSelectedTiers)}
                  className={`flex items-center gap-2 rounded px-2.5 py-1 text-left text-sm ${selectedTiers.has(tier) ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-white/5"}`}
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: STS1_TIER_COLORS[tier] }}
                  />
                  {labels.relicTiers[tier]}
                </button>
              ))}
            </div>
          </FilterSection>
        </>
      )}
    >
      <main className="flex flex-1 flex-col overflow-hidden">
        <CompendiumIndexTopBar
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          closeFiltersLabel={serviceText.common.closeFilters}
          openFiltersLabel={serviceText.common.openFilters}
          title={labels.relicCollectionTitle}
          count={formatCodexCount(filtered.length, serviceText.labels.relics, serviceLocale)}
        />
        <CompendiumIndexScroller scrollerClassName="p-4 sm:p-6">
          {TIER_ORDER.filter((tier) => filtered.some((relic) => relic.tier === tier)).map((tier) => {
            const group = filtered.filter((relic) => relic.tier === tier);
            return (
              <section key={tier} className="mb-8 last:mb-0">
                <div className="mb-3">
                  <h2
                    className="font-game-title text-lg font-bold"
                    style={{ color: STS1_TIER_COLORS[tier] }}
                  >
                    {labels.relicTiers[tier]}:
                    <span className="ml-2 font-game-text text-sm font-normal text-gray-400">
                      {labels.relicTierDescriptions[tier]}
                    </span>
                  </h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  {group.map((relic) => (
                    <Link
                      key={relic.slug}
                      href={localizeHref(sts1DetailPath("relics", relic.slug), serviceLocale)}
                      className="group"
                      title={relic.name}
                      onClick={(event) => {
                        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
                        event.preventDefault();
                        openRelic(relic);
                      }}
                    >
                      <Sts1RelicTile relic={relic} />
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </CompendiumIndexScroller>
      </main>
      {selectedRelic ? (
        <CompendiumDetailOverlay onClose={closeRelic} aria-label={selectedRelic.name} zClassName="z-[100]">
          <div className="my-8 mx-4 w-full max-w-6xl">
            <Sts1RelicDetail relic={selectedRelic} labels={labels} serviceLocale={serviceLocale} onClose={closeRelic} />
          </div>
        </CompendiumDetailOverlay>
      ) : null}
    </CompendiumIndexLayout>
  );
}
