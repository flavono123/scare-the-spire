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
import { STS1_FILTER_ICONS } from "@/lib/sts1/card-style";
import { sts1CardUiUrl, sts1DetailPath } from "@/lib/sts1/paths";
import type { Sts1Potion, Sts1PotionPool, Sts1PotionRarity, Sts1UiLabels } from "@/lib/sts1/types";
import { Sts1PotionDetail } from "./potion-detail";
import { Sts1PotionTile } from "./potion-tile";

const RARITY_ORDER: Sts1PotionRarity[] = ["common", "uncommon", "rare"];

export function Sts1PotionLibrary({
  potions,
  labels,
  serviceLocale,
}: {
  potions: Sts1Potion[];
  labels: Sts1UiLabels;
  serviceLocale: ServiceLocale;
}) {
  const serviceText = getCodexServiceMessages(serviceLocale);
  const urlPotionId = useHydrationSafeSearchParam("potion");
  const [selectedPools, setSelectedPools] = useState<Set<Sts1PotionPool>>(new Set());
  const [selectedRarities, setSelectedRarities] = useState<Set<Sts1PotionRarity>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOverride, setSelectedOverride] = useState<Sts1Potion | null>(null);
  const [useUrlSelection, setUseUrlSelection] = useState(true);
  const { sidebarOpen, setSidebarOpen, isMobile } = useCodexFilterDrawer();

  const selectedPotion = useMemo(() => {
    if (!useUrlSelection) return selectedOverride;
    if (!urlPotionId) return null;
    return potions.find((potion) => (
      potion.slug === urlPotionId.toLowerCase()
      || potion.legacySlugs.includes(urlPotionId.toLowerCase())
    )) ?? null;
  }, [potions, selectedOverride, urlPotionId, useUrlSelection]);

  const openPotion = useCallback((potion: Sts1Potion) => {
    setUseUrlSelection(false);
    setSelectedOverride(potion);
  }, []);
  const closePotion = useCallback(() => {
    setUseUrlSelection(false);
    setSelectedOverride(null);
  }, []);

  useEffect(() => {
    if (useUrlSelection) return;
    const url = new URL(window.location.href);
    if (selectedOverride) url.searchParams.set("potion", selectedOverride.slug);
    else url.searchParams.delete("potion");
    if (url.toString() !== window.location.href) pushCodexHistoryState(url);
  }, [selectedOverride, useUrlSelection]);

  useEffect(() => addCodexUrlChangeListener(() => {
    setUseUrlSelection(true);
    setSelectedOverride(null);
  }), []);

  const filtered = useMemo(() => {
    const query = searchQuery.trim();
    return potions.filter((potion) => {
      if (selectedPools.size && !selectedPools.has(potion.pool)) return false;
      if (selectedRarities.size && !selectedRarities.has(potion.rarity)) return false;
      if (query && !fuzzyMatchCodexText(`${potion.name} ${potion.id} ${potion.description}`, query)) return false;
      return true;
    });
  }, [potions, searchQuery, selectedPools, selectedRarities]);

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
              {RARITY_ORDER.map((rarity) => (
                <button
                  key={rarity}
                  onClick={() => toggle(selectedRarities, rarity, setSelectedRarities)}
                  className={`rounded px-2.5 py-1 text-left text-sm ${selectedRarities.has(rarity) ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-white/5"}`}
                >
                  {labels.potionRarities[rarity]}
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
          title={labels.potionLabTitle}
          count={formatCodexCount(filtered.length, serviceText.labels.potions, serviceLocale)}
        />
        <CompendiumIndexScroller scrollerClassName="p-3">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(88px,1fr))] gap-2">
            {filtered.map((potion) => (
              <Link
                key={potion.slug}
                href={localizeHref(sts1DetailPath("potions", potion.slug), serviceLocale)}
                onClick={(event) => {
                  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
                  event.preventDefault();
                  openPotion(potion);
                }}
              >
                <Sts1PotionTile potion={potion} />
              </Link>
            ))}
          </div>
        </CompendiumIndexScroller>
      </main>
      {selectedPotion ? (
        <CompendiumDetailOverlay onClose={closePotion} aria-label={selectedPotion.name}>
          <div className="w-full max-w-3xl rounded-lg bg-background" onClick={(event) => event.stopPropagation()}>
            <Sts1PotionDetail potion={selectedPotion} labels={labels} serviceLocale={serviceLocale} />
          </div>
        </CompendiumDetailOverlay>
      ) : null}
    </CompendiumIndexLayout>
  );
}
