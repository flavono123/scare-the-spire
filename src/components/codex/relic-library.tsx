"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Image from "@/components/ui/static-image";
import type { ServiceLocale } from "@/lib/i18n";
import type { CodexGameUiLabels } from "@/lib/codex-game-ui";
import {
  formatCodexCount,
  getCodexServiceMessages,
  type CodexServiceMessages,
} from "@/lib/codex-service";
import {
  CodexRelic,
  CodexCharacter,
  CodexAncient,
  CodexEvent,
  RelicRarityKo,
  RelicPool,
  RelicFilterPool,
  RELIC_RARITY_ORDER,
  RELIC_RARITY_COLORS,
  POOL_ALIASES,
  RARITY_ALIASES,
} from "@/lib/codex-types";
import type { STS2Patch, EntityVersionDiff } from "@/lib/types";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { reconstructRelicAtVersion } from "@/lib/entity-versioning";
import {
  fuzzyMatchCodexText,
  parseCodexSearch,
  stripCodexMarkup,
  type CodexSearchTriggerGroup,
} from "@/lib/codex-search";
import { RelicTile } from "./relic-tile";
import { RelicDetail } from "./relic-detail";
import { SearchBar } from "./search-bar";
import { FilterSection, IconFilterButton, ToggleButton } from "./codex-filters";
import { VersionSelector } from "./version-selector";
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

type RelicSearchTokenType = "pool" | "rarity";
type RelicPoolFilter = RelicFilterPool | "event";
const RELIC_POOL_FILTER_ALIASES: Record<string, RelicPoolFilter> = {
  ...POOL_ALIASES,
  이벤트: "event",
  event: "event",
};

interface RelicLibraryProps {
  serviceLocale: ServiceLocale;
  gameUi: CodexGameUiLabels;
  title: string;
  relics: CodexRelic[];
  characters: CodexCharacter[];
  ancients?: CodexAncient[];
  versions?: string[];
  currentVersion?: string;
  patches?: STS2Patch[];
  versionDiffs?: EntityVersionDiff[];
  /** All codex entities — enables rich cross-references in the detail modal. */
  entities?: EntityInfo[];
  relatedEvents?: CodexEvent[];
}

export function RelicLibrary({ serviceLocale, gameUi, title, relics, characters, ancients, versions, currentVersion, patches, versionDiffs, entities, relatedEvents = [] }: RelicLibraryProps) {
  const serviceText = getCodexServiceMessages(serviceLocale);
  const searchParams = useSearchParams();
  const [selectedPools, setSelectedPools] = useState<Set<RelicPoolFilter>>(new Set());
  const [selectedRarities, setSelectedRarities] = useState<Set<RelicRarityKo>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedVersion, setSelectedVersion] = useState(currentVersion ?? "");
  const [showBeta, setShowBeta] = useState(false);
  const hasBetaArt = relics.some((relic) => relic.betaImageUrl);

  // Relic detail modal — initialize from ?relic= query param
  const initialRelicId = searchParams.get("relic");
  const [selectedRelic, setSelectedRelic] = useState<CodexRelic | null>(() => {
    if (!initialRelicId) return null;
    return relics.find((r) => r.id.toLowerCase() === initialRelicId.toLowerCase()) ?? null;
  });
  const [selectedVariantPool, setSelectedVariantPool] = useState<RelicPool | undefined>();

  const selectRelic = useCallback((relic: CodexRelic, variantPool?: RelicPool) => {
    setSelectedRelic(relic);
    setSelectedVariantPool(variantPool);
  }, [setSelectedRelic, setSelectedVariantPool]);

  // Update URL query param when modal opens/closes
  useEffect(() => {
    const url = new URL(window.location.href);
    if (selectedRelic) {
      url.searchParams.set("relic", selectedRelic.id.toLowerCase());
    } else {
      url.searchParams.delete("relic");
    }
    if (url.toString() !== window.location.href) {
      window.history.pushState(null, "", url.toString());
    }
  }, [selectedRelic]);

  // Handle browser back button
  useEffect(() => {
    const handler = () => {
      const url = new URL(window.location.href);
      const relicParam = url.searchParams.get("relic");
      if (!relicParam) {
        setSelectedRelic(null);
      } else {
        const relic = relics.find((r) => r.id.toLowerCase() === relicParam.toLowerCase());
        setSelectedRelic(relic ?? null);
      }
    };
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, [relics]);

  // Close modal on Escape
  useEffect(() => {
    if (!selectedRelic) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedRelic(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedRelic]);

  const versionedRelics = useMemo(() => {
    if (!currentVersion || !versionDiffs || !patches || selectedVersion === currentVersion) return relics;
    return relics.map((relic) =>
      reconstructRelicAtVersion(relic, selectedVersion, currentVersion, versionDiffs, patches),
    );
  }, [relics, selectedVersion, currentVersion, versionDiffs, patches]);

  // Cmd+K to focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        document.getElementById("codex-search")?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Character filters for pool
  const poolLabels = useMemo(() => {
    const labels: Record<RelicPool, string> = {
      shared: serviceText.labels.pools.shared,
      ironclad: serviceText.labels.pools.ironclad,
      silent: serviceText.labels.pools.silent,
      defect: serviceText.labels.pools.defect,
      necrobinder: serviceText.labels.pools.necrobinder,
      regent: serviceText.labels.pools.regent,
    };
    for (const character of characters) {
      labels[character.id.toLowerCase() as RelicPool] = character.name;
    }
    return labels;
  }, [characters, serviceText]);

  const relicTriggers = useMemo(
    () => getRelicTriggers(serviceText, gameUi, poolLabels),
    [serviceText, gameUi, poolLabels],
  );

  // Parse search query
  const parsedSearch = useMemo(
    () => parseCodexSearch(searchQuery, relicTriggers),
    [searchQuery, relicTriggers],
  );

  // Filtered relics
  const filteredRelics = useMemo(() => {
    let result = versionedRelics;

    // Pool filter (sidebar)
    if (selectedPools.size > 0) {
      result = result.filter((r) => selectedPools.has(r.pool) || (selectedPools.has("event") && r.rarity === "이벤트 유물"));
    }

    // Rarity filter (sidebar)
    if (selectedRarities.size > 0) {
      result = result.filter((r) => selectedRarities.has(r.rarity));
    }

    // Search token filters
    for (const token of parsedSearch.tokens) {
      if (token.type === "pool") {
        result = result.filter((r) =>
          token.value === "event" ? r.rarity === "이벤트 유물" : r.pool === token.value
        );
      } else if (token.type === "rarity") {
        result = result.filter((r) => r.rarity === token.value);
      }
    }

    // Text search (name + description)
    if (parsedSearch.text) {
      result = result.filter(
        (r) =>
          fuzzyMatchCodexText(r.name, parsedSearch.text) ||
          fuzzyMatchCodexText(r.nameEn, parsedSearch.text) ||
          stripCodexMarkup(r.description).toLowerCase().includes(parsedSearch.text)
      );
    }

    return result;
  }, [versionedRelics, selectedPools, selectedRarities, parsedSearch]);

  // Group filtered relics by rarity
  const groupedRelics = useMemo(() => {
    const groups: { rarity: RelicRarityKo; relics: CodexRelic[] }[] = [];
    for (const rarity of RELIC_RARITY_ORDER) {
      const group = filteredRelics
        .filter((r) => r.rarity === rarity)
        .sort((a, b) => a.name.localeCompare(b.name, "ko"));
      if (group.length > 0) {
        groups.push({ rarity, relics: group });
      }
    }
    return groups;
  }, [filteredRelics]);

  // Sub-group ancient relics by their ancient boss
  const ancientSubgroups = useMemo(() => {
    if (!ancients || ancients.length === 0) return null;
    const ancientRelics = filteredRelics.filter((r) => r.rarity === "고대 유물");
    if (ancientRelics.length === 0) return null;

    const groups: { ancient: CodexAncient; relics: CodexRelic[] }[] = [];
    for (const ancient of ancients) {
      const relicIds = new Set(ancient.relicIds);
      const group = ancientRelics
        .filter((r) => relicIds.has(r.id))
        .sort((a, b) => a.name.localeCompare(b.name, "ko"));
      if (group.length > 0) {
        groups.push({ ancient, relics: group });
      }
    }
    return groups;
  }, [filteredRelics, ancients]);

  // Toggle helpers
  const togglePool = useCallback((pool: RelicPoolFilter) => {
    setSelectedPools((prev) => {
      const next = new Set(prev);
      if (next.has(pool)) next.delete(pool);
      else next.add(pool);
      return next;
    });
  }, []);

  const toggleRarity = useCallback((rarity: RelicRarityKo) => {
    setSelectedRarities((prev) => {
      const next = new Set(prev);
      if (next.has(rarity)) next.delete(rarity);
      else next.add(rarity);
      return next;
    });
  }, []);

  const characterFilters = characters.map((c) => ({
    key: c.id.toLowerCase() as RelicPoolFilter,
    label: c.name,
    icon: getCharacterTokenIcon(c.id, c.imageUrl),
  }));

  const extraPoolFilters = [
    { key: "shared" as const, label: poolLabels.shared, icon: COLORLESS_FILTER_ICON },
    { key: "event" as const, label: gameUi.relicCollection.rarities["이벤트 유물"].label, icon: EVENT_FILTER_ICON },
  ];

  const rarityFilters = RELIC_RARITY_ORDER.filter((r) => r !== "None").map((r) => ({
    key: r,
    label: gameUi.relicCollection.rarities[r].label,
    color: RELIC_RARITY_COLORS[r],
  }));

  const { sidebarOpen, setSidebarOpen, isMobile } = useCodexFilterDrawer();

  return (
    <CodexLibraryShell
      sidebarOpen={sidebarOpen}
      setSidebarOpen={setSidebarOpen}
      isMobile={isMobile}
      sidebar={(
        <>
        <FilterSection trigger="@" label={serviceText.labels.affiliation}>
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

        {/* Rarity filter */}
        <FilterSection trigger="$" label={gameUi.common.rarity}>
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
          search={(
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              inputId="codex-search"
              triggerGroups={relicTriggers}
              placeholder={serviceText.relicsView.searchPlaceholder}
            />
          )}
          count={formatCodexCount(filteredRelics.length, serviceText.labels.relics, serviceLocale)}
          trailing={versions && versions.length > 0 && currentVersion ? (
            <VersionSelector
              versions={versions}
              currentVersion={currentVersion}
              selectedVersion={selectedVersion}
              onChange={setSelectedVersion}
            />
          ) : undefined}
        />

        {/* Relic Grid (grouped by rarity) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {groupedRelics.map(({ rarity, relics: groupRelics }) => (
            <section key={rarity} className="mb-8 last:mb-0">
              {/* Rarity section header */}
              <div className="mb-3">
                <h2
                  className="font-game-title text-lg font-bold mb-0.5"
                  style={{ color: RELIC_RARITY_COLORS[rarity] }}
                >
                  {gameUi.relicCollection.rarities[rarity].label}:
                  <span className="font-game-text text-sm font-normal text-gray-400 ml-2">
                    {gameUi.relicCollection.rarities[rarity].description}
                  </span>
                </h2>
              </div>

              {/* Ancient relics: sub-grouped by ancient boss */}
              {rarity === "고대 유물" && ancientSubgroups ? (
                <div className="flex flex-col gap-5">
                  {ancientSubgroups.map(({ ancient, relics: ancientRelics }) => (
                    <div key={ancient.id}>
                      <div className="flex items-center gap-2 mb-2">
                        {ancient.imageUrl && (
                          <Image
                            src={ancient.imageUrl}
                            alt={ancient.name}
                            width={24}
                            height={24}
                            className="w-6 h-6 object-contain rounded-full"
                          />
                        )}
                        <h3 className="font-game-title text-sm font-bold text-blue-400">
                          {ancient.name}:
                        </h3>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {ancientRelics.map((relic) => (
                          <RelicTile key={relic.id} serviceLocale={serviceLocale} relic={relic} showBeta={showBeta} onClick={(v) => selectRelic(relic, v)} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* Regular relic icon grid */
                <div className="flex flex-wrap gap-2">
                  {groupRelics.map((relic) => (
                    <RelicTile key={relic.id} serviceLocale={serviceLocale} relic={relic} showBeta={showBeta} onClick={(v) => selectRelic(relic, v)} />
                  ))}
                </div>
              )}
            </section>
          ))}

          {filteredRelics.length === 0 && (
            <div className="flex items-center justify-center h-64 text-gray-500">
              {serviceText.common.noResults}
            </div>
          )}
        </div>
      </main>

      {/* Relic Detail Modal */}
      {selectedRelic && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedRelic(null);
          }}
        >
          <div className="my-8 mx-4 w-full max-w-6xl">
            <RelicDetail
              serviceLocale={serviceLocale}
              gameUi={gameUi}
              backToListTitle={title}
              relic={selectedRelic}
              poolLabels={poolLabels}
              initialVariant={selectedVariantPool}
              initialShowBeta={showBeta}
              onClose={() => setSelectedRelic(null)}
              entities={entities}
              relatedEvents={relatedEvents}
              patches={patches}
              versionDiffs={versionDiffs}
            />
          </div>
        </div>
      )}
    </CodexLibraryShell>
  );
}

function getRelicTriggers(
  serviceText: CodexServiceMessages,
  gameUi: CodexGameUiLabels,
  poolLabels: Record<RelicPool, string>,
): CodexSearchTriggerGroup<RelicSearchTokenType>[] {
  return [
    {
      trigger: "@",
      type: "pool",
      label: serviceText.labels.affiliation,
      maxPreviewItems: 4,
      items: [
        { value: "shared", label: poolLabels.shared, desc: "Shared" },
        { value: "ironclad", label: poolLabels.ironclad, desc: "Ironclad" },
        { value: "silent", label: poolLabels.silent, desc: "Silent" },
        { value: "defect", label: poolLabels.defect, desc: "Defect" },
        { value: "necrobinder", label: poolLabels.necrobinder, desc: "Necrobinder" },
        { value: "regent", label: poolLabels.regent, desc: "Regent" },
        { value: "event", label: gameUi.relicCollection.rarities["이벤트 유물"].label, desc: "Event" },
      ],
      validate: (val) => RELIC_POOL_FILTER_ALIASES[val] ?? null,
      chipColor: "bg-blue-500/20 text-blue-400",
    },
    {
      trigger: "$",
      type: "rarity",
      label: gameUi.common.rarity,
      items: [
        { value: "starter", label: gameUi.relicCollection.rarities["시작 유물"].label, desc: "Starter" },
        { value: "common", label: gameUi.relicCollection.rarities["일반 유물"].label, desc: "Common" },
        { value: "uncommon", label: gameUi.relicCollection.rarities["고급 유물"].label, desc: "Uncommon" },
        { value: "rare", label: gameUi.relicCollection.rarities["희귀 유물"].label, desc: "Rare" },
        { value: "shop", label: gameUi.relicCollection.rarities["상점 유물"].label, desc: "Shop" },
        { value: "event", label: gameUi.relicCollection.rarities["이벤트 유물"].label, desc: "Event" },
        { value: "ancient", label: gameUi.relicCollection.rarities["고대 유물"].label, desc: "Ancient/Boss" },
      ],
      validate: (val) => RARITY_ALIASES[val] ?? null,
      chipColor: "bg-green-500/20 text-green-400",
    },
  ];
}
