"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "@/components/ui/static-image";
import {
  localizeHrefWithGameLocale,
  type GameLocale,
  type ServiceLocale,
} from "@/lib/i18n";
import {
  badgeBaseImageUrl,
  getRunBadgeVariants,
  type RunBadgeCatalogEntry,
  type RunBadgeRarity,
} from "@/lib/run-badges";
import { fuzzyMatchCodexText, stripCodexMarkup } from "@/lib/codex-search";
import { formatCodexCount, getCodexServiceMessages } from "@/lib/codex-service";
import {
  buildCompendiumResourceDetailHref,
  updateCompendiumResourceModalUrl,
} from "@/lib/compendium-resource-links";
import { BadgeDetail } from "./badge-detail";
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
import {
  addCodexUrlChangeListener,
  pushCodexHistoryState,
  useHydrationSafeSearchParam,
} from "./use-hydration-safe-search-param";

type BadgeMode = "singleplayer" | "multiplayer";
type BadgeRankStructure = "single" | "tiered";

function BadgeArt({
  badge,
  rarity,
  title,
}: {
  badge: RunBadgeCatalogEntry;
  rarity: RunBadgeRarity;
  title: string;
}) {
  return (
    <div className="relative h-16 w-16 shrink-0 drop-shadow-[0_2px_5px_rgba(0,0,0,0.85)]">
      <Image src={badgeBaseImageUrl(rarity)} alt="" fill className="object-contain" aria-hidden />
      {badge.imageUrl && (
        <Image src={badge.imageUrl} alt={title} fill className="object-contain" />
      )}
    </div>
  );
}

function BadgeTile({
  badge,
  serviceLocale,
  gameLocale,
  onClick,
}: {
  badge: RunBadgeCatalogEntry;
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
  onClick: () => void;
}) {
  const variants = getRunBadgeVariants(badge);
  return (
    <Link
      href={localizeHrefWithGameLocale(
        buildCompendiumResourceDetailHref("badge", badge.slug),
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
      <article className="flex flex-col gap-2">
        {variants.map((variant) => (
          <div
            key={variant.rarity}
            className="grid min-w-0 grid-cols-[4rem_minmax(0,1fr)] items-center gap-2"
          >
            <BadgeArt badge={badge} rarity={variant.rarity} title={variant.title} />
            <GameHoverTip title={variant.title} className="min-w-0 w-full" style={{ minWidth: 0 }}>
              <DescriptionText description={variant.description} className="block text-left" />
            </GameHoverTip>
          </div>
        ))}
      </article>
    </Link>
  );
}

export function BadgeLibrary({
  serviceLocale,
  gameLocale,
  title,
  badges,
}: {
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
  title: string;
  badges: RunBadgeCatalogEntry[];
}) {
  const serviceText = getCodexServiceMessages(serviceLocale);
  const urlBadgeId = useHydrationSafeSearchParam("badge");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedModes, setSelectedModes] = useState<Set<BadgeMode>>(new Set());
  const [selectedRankStructures, setSelectedRankStructures] = useState<Set<BadgeRankStructure>>(new Set());
  const [selectedBadgeOverride, setSelectedBadgeOverride] = useState<RunBadgeCatalogEntry | null>(null);
  const [useUrlSelection, setUseUrlSelection] = useState(true);
  const { sidebarOpen, setSidebarOpen, isMobile } = useCodexFilterDrawer();

  const urlSelectedBadge = useMemo(() => (
    urlBadgeId
      ? badges.find((badge) => badge.slug === urlBadgeId.toLowerCase() || badge.id.toLowerCase() === urlBadgeId.toLowerCase()) ?? null
      : null
  ), [badges, urlBadgeId]);
  const selectedBadge = useUrlSelection ? urlSelectedBadge : selectedBadgeOverride;

  const filteredBadges = useMemo(() => {
    const searchText = searchQuery.trim().toLowerCase();
    return badges
      .filter((badge) => {
        const mode: BadgeMode = badge.multiplayerOnly ? "multiplayer" : "singleplayer";
        const rankStructure: BadgeRankStructure = getRunBadgeVariants(badge).length > 1 ? "tiered" : "single";
        if (selectedModes.size > 0 && !selectedModes.has(mode)) return false;
        if (selectedRankStructures.size > 0 && !selectedRankStructures.has(rankStructure)) return false;
        if (!searchText) return true;

        return fuzzyMatchCodexText(
          [
            badge.id,
            badge.title,
            badge.description,
            ...Object.values(badge.rarities).flatMap((copy) => [copy?.title, copy?.description]),
          ]
            .filter(Boolean)
            .map((value) => stripCodexMarkup(String(value)))
            .join(" "),
          searchText,
        );
      })
      .sort((left, right) => (
        getRunBadgeVariants(left)[0].title.localeCompare(getRunBadgeVariants(right)[0].title)
      ));
  }, [badges, searchQuery, selectedModes, selectedRankStructures]);

  const selectBadge = useCallback((badge: RunBadgeCatalogEntry) => {
    setUseUrlSelection(false);
    setSelectedBadgeOverride(badge);
  }, []);

  const closeSelectedBadge = useCallback(() => {
    setUseUrlSelection(false);
    setSelectedBadgeOverride(null);
  }, []);

  useEffect(() => {
    if (useUrlSelection) return;
    const url = updateCompendiumResourceModalUrl(
      new URL(window.location.href),
      "badge",
      selectedBadgeOverride?.slug ?? null,
    );
    if (url.toString() !== window.location.href) pushCodexHistoryState(url);
  }, [selectedBadgeOverride, useUrlSelection]);

  useEffect(() => addCodexUrlChangeListener(() => {
    setUseUrlSelection(true);
    setSelectedBadgeOverride(null);
  }), []);

  useEffect(() => {
    if (!selectedBadge) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeSelectedBadge();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [closeSelectedBadge, selectedBadge]);

  function toggleMode(mode: BadgeMode) {
    setSelectedModes((current) => {
      const next = new Set(current);
      if (next.has(mode)) next.delete(mode);
      else next.add(mode);
      return next;
    });
  }

  function toggleRankStructure(rankStructure: BadgeRankStructure) {
    setSelectedRankStructures((current) => {
      const next = new Set(current);
      if (next.has(rankStructure)) next.delete(rankStructure);
      else next.add(rankStructure);
      return next;
    });
  }

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
            placeholder={serviceText.badgesView.searchPlaceholder}
          />
          <FilterSection label={serviceText.badgesView.modeFilter}>
            <div className="flex flex-col gap-1">
              <ToggleButton
                label={serviceText.badgesView.singleplayer}
                active={selectedModes.has("singleplayer")}
                onClick={() => toggleMode("singleplayer")}
              />
              <ToggleButton
                label={serviceText.badgesView.multiplayerOnly}
                active={selectedModes.has("multiplayer")}
                onClick={() => toggleMode("multiplayer")}
              />
            </div>
          </FilterSection>
          <div className="border-t border-white/10" />
          <FilterSection label={serviceText.badgesView.rankFilter}>
            <div className="flex flex-col gap-1">
              <ToggleButton
                label={serviceText.badgesView.singleRank}
                active={selectedRankStructures.has("single")}
                onClick={() => toggleRankStructure("single")}
              />
              <ToggleButton
                label={serviceText.badgesView.tieredRanks}
                active={selectedRankStructures.has("tiered")}
                onClick={() => toggleRankStructure("tiered")}
              />
            </div>
          </FilterSection>
        </>
      )}
    >
      <main className="flex flex-1 flex-col overflow-hidden" data-badge-library>
        <CompendiumIndexTopBar
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          closeFiltersLabel={serviceText.common.closeFilters}
          openFiltersLabel={serviceText.common.openFilters}
          title={title}
          count={formatCodexCount(filteredBadges.length, serviceText.labels.badges, serviceLocale)}
        />
        <CompendiumIndexScroller scrollerClassName="p-4 sm:p-6">
          <div className="columns-1 gap-5 xl:columns-2">
            {filteredBadges.map((badge) => (
              <BadgeTile
                key={badge.id}
                badge={badge}
                serviceLocale={serviceLocale}
                gameLocale={gameLocale}
                onClick={() => selectBadge(badge)}
              />
            ))}
          </div>
          {filteredBadges.length === 0 && (
            <div className="flex h-64 items-center justify-center text-gray-500">
              {serviceText.common.noResults}
            </div>
          )}
        </CompendiumIndexScroller>
      </main>

      {selectedBadge && (
        <CompendiumDetailOverlay onClose={() => closeSelectedBadge()} data-badge-modal>
          <div className="my-8 mx-4 w-full max-w-6xl">
            <BadgeDetail
              serviceLocale={serviceLocale}
              gameLocale={gameLocale}
              backToListTitle={title}
              badge={selectedBadge}
              onClose={closeSelectedBadge}
            />
          </div>
        </CompendiumDetailOverlay>
      )}
    </CompendiumIndexLayout>
  );
}
