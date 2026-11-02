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
import { useLocalizedHref } from "@/hooks/use-localized-href";
import { FilterSection } from "@/components/codex/codex-filters";
import { SearchBar } from "@/components/codex/search-bar";
import {
  addCodexUrlChangeListener,
  pushCodexHistoryState,
  useHydrationSafeSearchParam,
} from "@/components/codex/use-hydration-safe-search-param";
import { formatCodexCount, getCodexServiceMessages } from "@/lib/codex-service";
import { fuzzyMatchCodexText } from "@/lib/codex-search";
import type { ServiceLocale } from "@/lib/i18n";
import { STS1_MONSTER_TYPE_COLORS } from "@/lib/sts1/card-style";
import { sts1DetailPath } from "@/lib/sts1/paths";
import type { Sts1Dungeon, Sts1Monster, Sts1MonsterType, Sts1UiLabels } from "@/lib/sts1/types";
import { Sts1MonsterDetail } from "./monster-detail";
import { Sts1MonsterTile } from "./monster-tile";
import { useEscapeClose } from "./use-escape-close";

const DUNGEON_ORDER: Sts1Dungeon[] = ["exordium", "city", "beyond", "ending"];
const TYPE_ORDER: Sts1MonsterType[] = ["normal", "elite", "boss"];

function toggled<T>(previous: Set<T>, value: T): Set<T> {
  const next = new Set(previous);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

export function Sts1MonsterLibrary({
  monsters,
  labels,
  serviceLocale,
}: {
  monsters: Sts1Monster[];
  labels: Sts1UiLabels;
  serviceLocale: ServiceLocale;
}) {
  const localizeLink = useLocalizedHref();
  const serviceText = getCodexServiceMessages(serviceLocale);
  const urlMonsterId = useHydrationSafeSearchParam("monster");
  const [selectedTypes, setSelectedTypes] = useState<Set<Sts1MonsterType>>(new Set());
  const [selectedDungeons, setSelectedDungeons] = useState<Set<Sts1Dungeon>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOverride, setSelectedOverride] = useState<Sts1Monster | null>(null);
  const [useUrlSelection, setUseUrlSelection] = useState(true);
  const { sidebarOpen, setSidebarOpen, isMobile } = useCodexFilterDrawer();

  const selectedMonster = useMemo(() => {
    if (!useUrlSelection) return selectedOverride;
    if (!urlMonsterId) return null;
    const needle = urlMonsterId.toLowerCase();
    return monsters.find((monster) => monster.slug === needle || monster.legacySlugs.includes(needle)) ?? null;
  }, [monsters, selectedOverride, urlMonsterId, useUrlSelection]);

  const openMonster = useCallback((monster: Sts1Monster) => {
    setUseUrlSelection(false);
    setSelectedOverride(monster);
  }, []);
  const closeMonster = useCallback(() => {
    setUseUrlSelection(false);
    setSelectedOverride(null);
  }, []);
  useEscapeClose(Boolean(selectedMonster), closeMonster);

  useEffect(() => {
    if (useUrlSelection) return;
    const url = new URL(window.location.href);
    if (selectedOverride) url.searchParams.set("monster", selectedOverride.slug);
    else url.searchParams.delete("monster");
    if (url.toString() !== window.location.href) pushCodexHistoryState(url);
  }, [selectedOverride, useUrlSelection]);

  useEffect(() => addCodexUrlChangeListener(() => {
    setUseUrlSelection(true);
    setSelectedOverride(null);
  }), []);

  const filtered = useMemo(() => {
    const query = searchQuery.trim();
    return monsters.filter((monster) => {
      if (selectedTypes.size && !selectedTypes.has(monster.type)) return false;
      if (selectedDungeons.size && !selectedDungeons.has(monster.dungeon)) return false;
      if (query && !fuzzyMatchCodexText(`${monster.name} ${monster.nameEn} ${monster.id}`, query)) return false;
      return true;
    });
  }, [monsters, searchQuery, selectedDungeons, selectedTypes]);

  const sortLocale = serviceLocale === "ko" ? "ko" : "en";
  const filterButtonClass = (active: boolean) => (
    `flex items-center gap-2 rounded px-2.5 py-1 text-left text-sm ${active ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-white/5"}`
  );

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
                  onClick={() => setSelectedTypes((previous) => toggled(previous, type))}
                  className={filterButtonClass(selectedTypes.has(type))}
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: STS1_MONSTER_TYPE_COLORS[type] }}
                  />
                  {labels.monsters.types[type]}
                </button>
              ))}
            </div>
          </FilterSection>
          <FilterSection label={serviceLocale === "ko" ? "지역" : "Act"}>
            <div className="flex flex-col gap-0.5">
              {DUNGEON_ORDER.map((dungeon) => (
                <button
                  key={dungeon}
                  onClick={() => setSelectedDungeons((previous) => toggled(previous, dungeon))}
                  className={filterButtonClass(selectedDungeons.has(dungeon))}
                >
                  {labels.monsters.dungeons[dungeon].act} {labels.monsters.dungeons[dungeon].name}
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
          title={labels.monstersTitle}
          count={formatCodexCount(filtered.length, serviceText.labels.items, serviceLocale)}
        />
        <CompendiumIndexScroller scrollerClassName="p-4 sm:p-6">
          {filtered.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-gray-500">{serviceText.common.noResults}</div>
          ) : null}
          {DUNGEON_ORDER.filter((dungeon) => filtered.some((monster) => monster.dungeon === dungeon)).map((dungeon) => {
            const group = filtered
              .filter((monster) => monster.dungeon === dungeon)
              .sort((left, right) => (
                TYPE_ORDER.indexOf(left.type) - TYPE_ORDER.indexOf(right.type)
                || left.name.localeCompare(right.name, sortLocale)
              ));
            return (
              <section key={dungeon} className="mb-8 last:mb-0">
                <h2 className="mb-3 font-game-title text-lg font-bold text-primary">
                  {labels.monsters.dungeons[dungeon].act} {labels.monsters.dungeons[dungeon].name}
                  <span className="ml-2 font-game-text text-sm font-normal text-gray-400">{group.length}</span>
                </h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                  {group.map((monster) => (
                    <Link
                      key={monster.slug}
                      prefetch={false}
                      href={localizeLink(sts1DetailPath("monsters", monster.slug))}
                      className="group"
                      aria-label={monster.name}
                      onClick={(event) => {
                        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
                        event.preventDefault();
                        openMonster(monster);
                      }}
                    >
                      <Sts1MonsterTile monster={monster} />
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </CompendiumIndexScroller>
      </main>
      {selectedMonster ? (
        <CompendiumDetailOverlay onClose={closeMonster} aria-label={selectedMonster.name} zClassName="z-[100]">
          <div className="mx-4 my-8 w-full max-w-6xl">
            <Sts1MonsterDetail
              monster={selectedMonster}
              labels={labels}
              serviceLocale={serviceLocale}
              onClose={closeMonster}
            />
          </div>
        </CompendiumDetailOverlay>
      ) : null}
    </CompendiumIndexLayout>
  );
}
