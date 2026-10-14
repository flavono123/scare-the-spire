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
import { FilterSection } from "@/components/codex/codex-filters";
import { SearchBar } from "@/components/codex/search-bar";
import {
  addCodexUrlChangeListener,
  pushCodexHistoryState,
  useHydrationSafeSearchParam,
} from "@/components/codex/use-hydration-safe-search-param";
import { formatCodexCount, getCodexServiceMessages } from "@/lib/codex-service";
import { fuzzyMatchCodexText } from "@/lib/codex-search";
import { localizeHref, type ServiceLocale } from "@/lib/i18n";
import { STS1_POWER_TYPE_COLORS } from "@/lib/sts1/card-style";
import { plainSts1Text } from "@/lib/sts1/description";
import { sts1DetailPath } from "@/lib/sts1/paths";
import type { Sts1Power, Sts1PowerType, Sts1ResourceRef, Sts1UiLabels } from "@/lib/sts1/types";
import { Sts1PowerDetail } from "./power-detail";
import { Sts1PowerTile } from "./power-tile";

const TYPE_ORDER: Sts1PowerType[] = ["buff", "debuff"];

export function Sts1PowerLibrary({
  powers,
  sourceRefs,
  labels,
  serviceLocale,
}: {
  powers: Sts1Power[];
  sourceRefs: Record<string, Sts1ResourceRef[]>;
  labels: Sts1UiLabels;
  serviceLocale: ServiceLocale;
}) {
  const serviceText = getCodexServiceMessages(serviceLocale);
  const urlPowerId = useHydrationSafeSearchParam("power");
  const [selectedTypes, setSelectedTypes] = useState<Set<Sts1PowerType>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOverride, setSelectedOverride] = useState<Sts1Power | null>(null);
  const [useUrlSelection, setUseUrlSelection] = useState(true);
  const { sidebarOpen, setSidebarOpen, isMobile } = useCodexFilterDrawer();

  const selectedPower = useMemo(() => {
    if (!useUrlSelection) return selectedOverride;
    if (!urlPowerId) return null;
    const needle = urlPowerId.toLowerCase();
    return powers.find((power) => power.slug === needle || power.legacySlugs.includes(needle)) ?? null;
  }, [powers, selectedOverride, urlPowerId, useUrlSelection]);

  const openPower = useCallback((power: Sts1Power) => {
    setUseUrlSelection(false);
    setSelectedOverride(power);
  }, []);
  const closePower = useCallback(() => {
    setUseUrlSelection(false);
    setSelectedOverride(null);
  }, []);

  useEffect(() => {
    if (useUrlSelection) return;
    const url = new URL(window.location.href);
    if (selectedOverride) url.searchParams.set("power", selectedOverride.slug);
    else url.searchParams.delete("power");
    if (url.toString() !== window.location.href) pushCodexHistoryState(url);
  }, [selectedOverride, useUrlSelection]);

  useEffect(() => addCodexUrlChangeListener(() => {
    setUseUrlSelection(true);
    setSelectedOverride(null);
  }), []);

  const filtered = useMemo(() => {
    const query = searchQuery.trim();
    return powers.filter((power) => {
      if (selectedTypes.size && !selectedTypes.has(power.type)) return false;
      if (query && !fuzzyMatchCodexText(
        `${power.name} ${power.nameEn} ${power.id} ${plainSts1Text(power.description)}`,
        query,
      )) return false;
      return true;
    });
  }, [powers, searchQuery, selectedTypes]);

  const toggleType = (type: Sts1PowerType) => {
    setSelectedTypes((previous) => {
      const next = new Set(previous);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const sortLocale = serviceLocale === "ko" ? "ko" : "en";

  return (
    <CompendiumIndexLayout
      sidebarOpen={sidebarOpen}
      setSidebarOpen={setSidebarOpen}
      isMobile={isMobile}
      sidebar={(
        <>
          <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder={serviceLocale === "ko" ? "검색" : "Search"} />
          <FilterSection label={serviceText.powersView.typeFilter}>
            <div className="flex flex-col gap-0.5">
              {TYPE_ORDER.map((type) => (
                <button
                  key={type}
                  onClick={() => toggleType(type)}
                  className={`flex items-center gap-2 rounded px-2.5 py-1 text-left text-sm ${selectedTypes.has(type) ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-white/5"}`}
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: STS1_POWER_TYPE_COLORS[type] }}
                  />
                  {labels.powerTypes[type]}
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
          title={labels.powersTitle}
          count={formatCodexCount(filtered.length, serviceText.labels.powers, serviceLocale)}
        />
        <CompendiumIndexScroller scrollerClassName="p-4 sm:p-6">
          {filtered.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-gray-500">{serviceText.common.noResults}</div>
          ) : null}
          {TYPE_ORDER.filter((type) => filtered.some((power) => power.type === type)).map((type) => {
            const group = filtered
              .filter((power) => power.type === type)
              .sort((left, right) => left.name.localeCompare(right.name, sortLocale));
            return (
              <section key={type} className="mb-8 last:mb-0">
                <h2
                  className="mb-3 font-game-title text-lg font-bold"
                  style={{ color: STS1_POWER_TYPE_COLORS[type] }}
                >
                  {labels.powerTypes[type]}
                  <span className="ml-2 font-game-text text-sm font-normal text-gray-400">{group.length}</span>
                </h2>
                <div className="flex flex-wrap gap-2">
                  {group.map((power) => (
                    <Link
                      key={power.slug}
                      href={localizeHref(sts1DetailPath("powers", power.slug), serviceLocale)}
                      className="group"
                      aria-label={power.name}
                      onClick={(event) => {
                        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
                        event.preventDefault();
                        openPower(power);
                      }}
                    >
                      <Sts1PowerTile power={power} />
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </CompendiumIndexScroller>
      </main>
      {selectedPower ? (
        <CompendiumDetailOverlay onClose={closePower} aria-label={selectedPower.name} zClassName="z-[100]">
          <div className="mx-4 my-8 w-full max-w-6xl">
            <Sts1PowerDetail
              power={selectedPower}
              sourceRefs={sourceRefs[selectedPower.id] ?? []}
              labels={labels}
              serviceLocale={serviceLocale}
              onClose={closePower}
            />
          </div>
        </CompendiumDetailOverlay>
      ) : null}
    </CompendiumIndexLayout>
  );
}
