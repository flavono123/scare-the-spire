"use client";

import { useMemo, useState } from "react";
import Image from "@/components/ui/static-image";
import type { ServiceLocale } from "@/lib/i18n";
import type { ReplayBadgeRarity } from "@/lib/sts2-run-replay";
import type { RunBadgeCatalogEntry } from "@/lib/run-badges";
import { badgeBaseImageUrl } from "@/lib/run-badges";
import { fuzzyMatchCodexText, stripCodexMarkup } from "@/lib/codex-search";
import { formatCodexCount, getCodexServiceMessages } from "@/lib/codex-service";
import { DescriptionText } from "./codex-description";
import { FilterSection, ToggleButton } from "./codex-filters";
import {
  CodexLibraryShell,
  CodexLibraryTopBar,
  useCodexFilterDrawer,
} from "./codex-filter-drawer";
import { GameHoverTip } from "./hover-tip";
import { SearchBar } from "./search-bar";

type BadgeMode = "singleplayer" | "multiplayer";
type BadgeRarity = Exclude<ReplayBadgeRarity, "none">;

const BADGE_RARITIES: BadgeRarity[] = ["bronze", "silver", "gold"];

function badgeVariants(badge: RunBadgeCatalogEntry) {
  const variants = BADGE_RARITIES.flatMap((rarity) => {
    const copy = badge.rarities[rarity];
    return copy ? [{ rarity, ...copy }] : [];
  });

  return variants.length > 0
    ? variants
    : [{
        rarity: "bronze" as const,
        title: badge.title ?? badge.id,
        description: badge.description ?? "",
      }];
}

function BadgeArt({
  badge,
  rarity,
  title,
}: {
  badge: RunBadgeCatalogEntry;
  rarity: BadgeRarity;
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

function BadgeTile({ badge }: { badge: RunBadgeCatalogEntry }) {
  return (
    <article className="flex flex-col gap-2">
      {badgeVariants(badge).map((variant) => (
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
  );
}

export function BadgeLibrary({
  serviceLocale,
  title,
  badges,
}: {
  serviceLocale: ServiceLocale;
  title: string;
  badges: RunBadgeCatalogEntry[];
}) {
  const serviceText = getCodexServiceMessages(serviceLocale);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedModes, setSelectedModes] = useState<Set<BadgeMode>>(new Set());
  const { sidebarOpen, setSidebarOpen, isMobile } = useCodexFilterDrawer();

  const filteredBadges = useMemo(() => {
    const searchText = searchQuery.trim().toLowerCase();
    return badges
      .filter((badge) => {
        const mode: BadgeMode = badge.multiplayerOnly ? "multiplayer" : "singleplayer";
        if (selectedModes.size > 0 && !selectedModes.has(mode)) return false;
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
        badgeVariants(left)[0].title.localeCompare(badgeVariants(right)[0].title)
      ));
  }, [badges, searchQuery, selectedModes]);

  function toggleMode(mode: BadgeMode) {
    setSelectedModes((current) => {
      const next = new Set(current);
      if (next.has(mode)) next.delete(mode);
      else next.add(mode);
      return next;
    });
  }

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
        </>
      )}
    >
      <main className="flex flex-1 flex-col overflow-hidden" data-badge-library>
        <CodexLibraryTopBar
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          closeFiltersLabel={serviceText.common.closeFilters}
          openFiltersLabel={serviceText.common.openFilters}
          title={title}
          count={formatCodexCount(filteredBadges.length, serviceText.labels.badges, serviceLocale)}
        />
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            {filteredBadges.map((badge) => <BadgeTile key={badge.id} badge={badge} />)}
          </div>
          {filteredBadges.length === 0 && (
            <div className="flex h-64 items-center justify-center text-gray-500">
              {serviceText.common.noResults}
            </div>
          )}
        </div>
      </main>
    </CodexLibraryShell>
  );
}
