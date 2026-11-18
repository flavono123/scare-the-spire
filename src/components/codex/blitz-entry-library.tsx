"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  addCodexUrlChangeListener,
  pushCodexHistoryState,
  useHydrationSafeSearchParam,
} from "./use-hydration-safe-search-param";
import type { GameLocale, ServiceLocale } from "@/lib/i18n";
import {
  buildCompendiumEntryHref,
  updateCompendiumResourceModalUrl,
} from "@/lib/compendium-resource-links";
import type { CodexGameUiLabels } from "@/lib/codex-game-ui";
import { formatCodexCount, getCodexServiceMessages } from "@/lib/codex-service";
import type { CodexBlitzEntry } from "@/lib/codex-types";
import { BLITZ_ENTRY_CATEGORIES, type BlitzEntryCategory } from "@/lib/blitz-dread-service-categories";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { fuzzyMatchCodexText, stripCodexMarkup } from "@/lib/codex-search";
import { DescriptionText } from "./codex-description";
import { FilterSection, ToggleButton, toggleFilterSortDir, type FilterSortDir } from "./codex-filters";
import {
  CompendiumIndexLayout,
  CompendiumIndexTopBar,
  CompendiumIndexScroller,
  CompendiumDetailOverlay,
  useCodexFilterDrawer,
} from "./codex-filter-drawer";
import { GameHoverTip } from "./hover-tip";
import { BlitzEntryDetail } from "./blitz-entry-detail";
import { SearchBar } from "./search-bar";

// The Blitz merchant inventory (merchant_inventory.tscn): the rug rect and the six slot
// origins on it, in game px. Each slot's 240 px hitbox is centred on its origin.
const RUG_W = 1747;
const RUG_H = 978;
const RUG_URL = "/images/sts2/blitz-merchant/shop_rug.webp";
const RUG_SLOTS: [number, number][] = [[415, 320], [896, 293], [1291, 355], [437, 679], [831, 637], [1247, 689]];
const SLOT_HIT = { left: -121, top: -120, size: 240 };

type SortKey = "game" | "category" | "name";
type Rarity = "common" | "rare";
type Curse = "noCurse" | "cursed";

const pct = (value: number, total: number) => `${(value / total) * 100}%`;

function toggle<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

function RugSlot({
  entry,
  index,
  gameLocale,
  onSelect,
}: {
  entry: CodexBlitzEntry;
  index: number;
  gameLocale: GameLocale;
  onSelect: () => void;
}) {
  const [hover, setHover] = useState(false);
  const [ox, oy] = RUG_SLOTS[index];
  // NBlitzMerchantSlot.CreateHoverTip: the third column opens its tip to the left.
  const tipLeft = index % 3 === 2;
  return (
    <div
      className="absolute"
      style={{
        left: pct(ox + SLOT_HIT.left, RUG_W),
        top: pct(oy + SLOT_HIT.top, RUG_H),
        width: pct(SLOT_HIT.size, RUG_W),
        height: pct(SLOT_HIT.size, RUG_H),
        zIndex: hover ? 20 : 1,
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <Link
        prefetch={false}
        // Game-only locales have no detail pages; this links their list modal.
        href={buildCompendiumEntryHref("blitzEntry", entry.id, gameLocale)}
        aria-label={stripCodexMarkup(entry.name)}
        className="block h-full w-full rounded-full outline-none transition-transform duration-100 focus-visible:ring-2 focus-visible:ring-primary/70"
        style={{ transform: hover ? "scale(1.1)" : undefined }}
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
        onClick={(event) => {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
          event.preventDefault();
          onSelect();
        }}
      >
        {/* Slot shadow (offset 20, 16; 25% black) under the ware icon. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={entry.imageUrl} alt="" className="absolute h-full w-full" style={{ left: "8%", top: "6.5%", filter: "brightness(0)", opacity: 0.25 }} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={entry.imageUrl} alt="" className="relative h-full w-full" />
      </Link>
      {hover && (
        <div
          className="pointer-events-none absolute top-0 w-64 sm:w-72"
          style={tipLeft ? { right: "100%" } : { left: "100%" }}
        >
          <GameHoverTip title={entry.name}>
            <DescriptionText description={entry.description} className="block text-left" />
            {entry.variants.length > 0 && (
              <span className="mt-1 block text-left text-[#fff6e2]/80">
                {entry.variants.map((variant) => variant.label).join(" · ")}
              </span>
            )}
          </GameHoverTip>
        </div>
      )}
    </div>
  );
}

export function BlitzEntryLibrary({
  serviceLocale,
  gameLocale,
  gameUi,
  title,
  entries,
  entities,
}: {
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
  gameUi: CodexGameUiLabels;
  title: string;
  entries: CodexBlitzEntry[];
  entities?: EntityInfo[];
}) {
  const serviceText = getCodexServiceMessages(serviceLocale);
  const view = serviceText.blitzShopView;
  const urlEntryId = useHydrationSafeSearchParam("ware");
  const [searchQuery, setSearchQuery] = useState("");
  const [categories, setCategories] = useState<Set<BlitzEntryCategory>>(new Set());
  const [rarities, setRarities] = useState<Set<Rarity>>(new Set());
  const [curses, setCurses] = useState<Set<Curse>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>("game");
  const [sortDir, setSortDir] = useState<FilterSortDir>("asc");
  const [selectedIdOverride, setSelectedIdOverride] = useState<string | null>(null);
  const [useUrlSelection, setUseUrlSelection] = useState(true);
  const selectedId = useUrlSelection ? urlEntryId : selectedIdOverride;
  const { sidebarOpen, setSidebarOpen, isMobile } = useCodexFilterDrawer();

  const select = useCallback((id: string | null) => {
    setUseUrlSelection(false);
    setSelectedIdOverride(id);
  }, []);

  useEffect(() => {
    if (useUrlSelection) return;
    const url = updateCompendiumResourceModalUrl(new URL(window.location.href), "blitzEntry", selectedIdOverride);
    if (url.toString() !== window.location.href) pushCodexHistoryState(url);
  }, [selectedIdOverride, useUrlSelection]);

  useEffect(() => addCodexUrlChangeListener(() => {
    setUseUrlSelection(true);
    setSelectedIdOverride(null);
  }), []);

  useEffect(() => {
    if (!selectedId) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") select(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [select, selectedId]);

  const shown = useMemo(() => {
    const searchText = searchQuery.trim().toLowerCase();
    const filtered = entries.filter((entry) => {
      if (categories.size > 0 && !entry.categories.some((category) => categories.has(category))) return false;
      if (rarities.size > 0 && !rarities.has(entry.rare ? "rare" : "common")) return false;
      if (curses.size > 0 && !curses.has(entry.cursed ? "cursed" : "noCurse")) return false;
      if (!searchText) return true;
      return fuzzyMatchCodexText(
        [
          entry.id,
          entry.name,
          entry.nameEn,
          stripCodexMarkup(entry.description),
          stripCodexMarkup(entry.descriptionEn),
          ...entry.variants.flatMap((variant) => [variant.name, variant.nameEn]),
        ].join(" "),
        searchText,
      );
    });
    const categoryRank = (entry: CodexBlitzEntry) => BLITZ_ENTRY_CATEGORIES.indexOf(entry.categories[0]);
    const sorted = filtered.sort((a, b) => {
      if (sortKey === "name") return stripCodexMarkup(a.name).localeCompare(stripCodexMarkup(b.name), "ko");
      if (sortKey === "category") return categoryRank(a) - categoryRank(b) || a.sortOrder - b.sortOrder;
      return a.sortOrder - b.sortOrder;
    });
    return sortDir === "asc" ? sorted : sorted.reverse();
  }, [categories, curses, entries, rarities, searchQuery, sortDir, sortKey]);

  // The shop lays six wares on one rug; more wares take more rugs.
  const rugs = useMemo(() => {
    const out: CodexBlitzEntry[][] = [];
    for (let i = 0; i < shown.length; i += RUG_SLOTS.length) out.push(shown.slice(i, i + RUG_SLOTS.length));
    return out;
  }, [shown]);

  const selected = useMemo(() => (
    selectedId ? entries.find((entry) => entry.id.toLowerCase() === selectedId.toLowerCase()) ?? null : null
  ), [entries, selectedId]);

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
            placeholder={view.searchPlaceholder}
          />
          <FilterSection label={view.categoryFilter}>
            <div className="flex flex-col gap-0.5">
              {BLITZ_ENTRY_CATEGORIES.map((category) => (
                <ToggleButton
                  key={category}
                  label={view.categories[category]}
                  active={categories.has(category)}
                  onClick={() => setCategories((current) => toggle(current, category))}
                />
              ))}
            </div>
          </FilterSection>
          <FilterSection label={view.rarityFilter}>
            <div className="flex flex-col gap-0.5">
              {(["common", "rare"] as const).map((rarity) => (
                <ToggleButton
                  key={rarity}
                  label={rarity === "rare" ? view.rare : view.normal}
                  active={rarities.has(rarity)}
                  onClick={() => setRarities((current) => toggle(current, rarity))}
                />
              ))}
            </div>
          </FilterSection>
          <FilterSection label={view.curseFilter}>
            <div className="flex flex-col gap-0.5">
              {(["noCurse", "cursed"] as const).map((curse) => (
                <ToggleButton
                  key={curse}
                  label={view[curse]}
                  active={curses.has(curse)}
                  onClick={() => setCurses((current) => toggle(current, curse))}
                />
              ))}
            </div>
          </FilterSection>
          <FilterSection
            label={view.sort}
            sortDir={sortDir}
            onSortToggle={() => setSortDir(toggleFilterSortDir)}
            sortTitle={serviceText.common.sortButtonTitle}
          >
            <div className="flex flex-col gap-0.5">
              {(["game", "category", "name"] as const).map((key) => (
                <ToggleButton
                  key={key}
                  label={view[key === "game" ? "sortGame" : key === "category" ? "sortCategory" : "sortName"]}
                  active={sortKey === key}
                  onClick={() => setSortKey(key)}
                />
              ))}
            </div>
          </FilterSection>
        </>
      )}
    >
      <main className="flex flex-1 flex-col overflow-hidden" data-blitz-shop-library>
        <CompendiumIndexTopBar
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          closeFiltersLabel={serviceText.common.closeFilters}
          openFiltersLabel={serviceText.common.openFilters}
          title={title}
          count={formatCodexCount(shown.length, serviceText.labels.blitzShop, serviceLocale)}
        />
        <CompendiumIndexScroller scrollerClassName="p-4 sm:p-6">
          <p className="mb-6 max-w-3xl text-sm leading-relaxed text-muted-foreground">{view.intro}</p>
          <div className="mx-auto flex max-w-4xl flex-col gap-6">
            {rugs.map((rug, rugIndex) => (
              <section
                key={rugIndex}
                aria-label={view.rug.replace("{n}", String(rugIndex + 1))}
                className="relative w-full"
                style={{ aspectRatio: `${RUG_W} / ${RUG_H}` }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={RUG_URL} alt="" className="absolute inset-0 h-full w-full select-none" draggable={false} />
                {rug.map((entry, index) => (
                  <RugSlot
                    key={entry.id}
                    entry={entry}
                    index={index}
                    gameLocale={gameLocale}
                    onSelect={() => select(entry.id)}
                  />
                ))}
              </section>
            ))}
          </div>
          {shown.length === 0 && (
            <div className="flex h-64 items-center justify-center text-gray-500">{serviceText.common.noResults}</div>
          )}
        </CompendiumIndexScroller>
      </main>

      {selected && (
        <CompendiumDetailOverlay onClose={() => select(null)} data-blitz-entry-modal>
          <div className="my-8 mx-4 w-full max-w-6xl">
            <BlitzEntryDetail
              serviceLocale={serviceLocale}
              gameUi={gameUi}
              backToListTitle={title}
              entry={selected}
              entities={entities}
              onClose={() => select(null)}
            />
          </div>
        </CompendiumDetailOverlay>
      )}
    </CompendiumIndexLayout>
  );
}
