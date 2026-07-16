"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AncientNodeRender } from "@/components/codex/ancient-node-render";
import {
  addCodexUrlChangeListener,
  pushCodexHistoryState,
  useHydrationSafeSearchParam,
} from "./use-hydration-safe-search-param";
import type { ServiceLocale } from "@/lib/i18n";
import { localizeHref } from "@/lib/i18n";
import { buildCompendiumResourceDetailHref } from "@/lib/compendium-resource-links";
import type { EntityInfo } from "@/components/patch-note-renderer";
import type { EntityVersionDiff, STS2Change, STS2Patch } from "@/lib/types";
import type { CodexGameUiLabels } from "@/lib/codex-game-ui";
import {
  formatCodexCount,
  formatTemplateCount,
  getCodexServiceMessages,
  type CodexServiceMessages,
} from "@/lib/codex-service";
import type { CodexAncient, CodexCard, CodexRelic, EventAct } from "@/lib/codex-types";
import {
  EVENT_ACT_ORDER,
  EVENT_ACT_UNKNOWN,
} from "@/lib/codex-types";
import {
  fuzzyMatchCodexText,
  stripCodexMarkup,
} from "@/lib/codex-search";
import { withEntityLifecycleForVersion } from "@/lib/entity-lifecycle";
import {
  FilterSection,
  orderByFilterSortDir,
  toggleFilterSortDir,
  type FilterSortDir,
} from "./codex-filters";
import {
  CodexLibraryShell,
  CodexLibraryTopBar,
  useCodexFilterDrawer,
} from "./codex-filter-drawer";
import { SearchBar } from "./search-bar";
import { AncientDetail } from "./ancient-detail";
import { VersionSelector } from "./version-selector";

const COMPENDIUM_ACT_COLOR = "#60a5fa";
const COMPENDIUM_ACT_TEXT_CLASS = "text-blue-300";

function ActBadge({
  act,
  messages,
  gameUi,
}: {
  act: EventAct | null;
  messages: CodexServiceMessages;
  gameUi: CodexGameUiLabels;
}) {
  const label = act ? gameUi.acts[act] : messages.labels.acts.none;
  return (
    <span
      className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-medium ${
        act
          ? "border-blue-500/40 bg-blue-500/10 text-blue-300"
          : `${EVENT_ACT_UNKNOWN.border} ${EVENT_ACT_UNKNOWN.bg} ${EVENT_ACT_UNKNOWN.color}`
      }`}
    >
      {label}
    </span>
  );
}

interface AncientListProps {
  serviceLocale: ServiceLocale;
  gameUi: CodexGameUiLabels;
  ancients: CodexAncient[];
  cards?: CodexCard[];
  relics?: CodexRelic[];
  patches?: STS2Patch[];
  changes?: STS2Change[];
  versionDiffs?: EntityVersionDiff[];
  versions?: string[];
  currentVersion?: string;
  entities?: EntityInfo[];
}

export function AncientList({
  serviceLocale,
  gameUi,
  ancients,
  cards = [],
  relics = [],
  patches,
  changes,
  versionDiffs,
  versions,
  currentVersion,
  entities,
}: AncientListProps) {
  const serviceText = getCodexServiceMessages(serviceLocale);
  const urlAncientId = useHydrationSafeSearchParam("ancient");
  const [selectedVersion, setSelectedVersion] = useState(currentVersion ?? "");
  const [selectedActs, setSelectedActs] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [actSortDir, setActSortDir] = useState<FilterSortDir>("asc");
  const [selectedAncientOverride, setSelectedAncientOverride] = useState<CodexAncient | null>(null);
  const [useUrlSelection, setUseUrlSelection] = useState(true);
  const versionedAncients = useMemo(() => {
    if (!currentVersion || !selectedVersion) return ancients;
    return withEntityLifecycleForVersion(ancients, selectedVersion, { changes, entityType: "ancient" });
  }, [ancients, changes, currentVersion, selectedVersion]);

  const urlSelectedAncient = useMemo(() => (
    urlAncientId
      ? versionedAncients.find((ancient) => ancient.id.toLowerCase() === urlAncientId.toLowerCase()) ?? null
      : null
  ), [urlAncientId, versionedAncients]);
  const selectedAncient = useUrlSelection ? urlSelectedAncient : selectedAncientOverride;

  const relicById = useMemo(
    () => new Map(relics.map((relic) => [relic.id, relic])),
    [relics],
  );
  const selectedAncientRelics = useMemo(() => {
    if (!selectedAncient) return [];
    return selectedAncient.relicIds
      .map((relicId) => relicById.get(relicId))
      .filter((relic): relic is CodexRelic => Boolean(relic));
  }, [relicById, selectedAncient]);

  const selectAncient = useCallback((ancient: CodexAncient) => {
    setUseUrlSelection(false);
    setSelectedAncientOverride(ancient);
  }, [setSelectedAncientOverride, setUseUrlSelection]);

  const closeSelectedAncient = useCallback(() => {
    setUseUrlSelection(false);
    setSelectedAncientOverride(null);
  }, [setSelectedAncientOverride, setUseUrlSelection]);

  useEffect(() => {
    if (useUrlSelection) return;
    const url = new URL(window.location.href);
    if (selectedAncientOverride) {
      url.searchParams.set("ancient", selectedAncientOverride.id.toLowerCase());
    } else {
      url.searchParams.delete("ancient");
    }
    if (url.toString() !== window.location.href) {
      pushCodexHistoryState(url);
    }
  }, [selectedAncientOverride, useUrlSelection]);

  useEffect(() => {
    const handler = () => {
      setUseUrlSelection(true);
      setSelectedAncientOverride(null);
    };
    return addCodexUrlChangeListener(handler);
  }, []);

  useEffect(() => {
    if (!selectedAncient) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSelectedAncient();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [closeSelectedAncient, selectedAncient]);

  const searchText = useMemo(() => searchQuery.trim().toLowerCase(), [searchQuery]);

  const filteredAncients = useMemo(() => {
    return versionedAncients.filter((ancient) => {
      const actKey = ancient.act ?? "none";
      if (selectedActs.size > 0 && !selectedActs.has(actKey)) return false;

      if (!searchText) return true;

      return (
        fuzzyMatchCodexText(ancient.name, searchText) ||
        fuzzyMatchCodexText(ancient.nameEn, searchText) ||
        fuzzyMatchCodexText(ancient.epithet, searchText) ||
        fuzzyMatchCodexText(ancient.epithetEn, searchText) ||
        fuzzyMatchCodexText(stripCodexMarkup(ancient.description), searchText) ||
        fuzzyMatchCodexText(stripCodexMarkup(ancient.descriptionEn), searchText)
      );
    });
  }, [versionedAncients, selectedActs, searchText]);

  const groupedAncients = useMemo(() => {
    const groups: { act: EventAct | null; label: string; color: string; ancients: CodexAncient[] }[] = [];
    for (const act of orderByFilterSortDir(EVENT_ACT_ORDER, actSortDir)) {
      const items = filteredAncients
        .filter((ancient) => ancient.act === act)
        .sort((a, b) => a.name.localeCompare(b.name, "ko"));
      if (items.length === 0) continue;

      groups.push({
        act,
        label: getActLabel(act, serviceText, gameUi),
        color: act ? COMPENDIUM_ACT_COLOR : "#a1a1aa",
        ancients: items,
      });
    }
    return groups;
  }, [filteredAncients, gameUi, serviceText, actSortDir]);

  const actCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const ancient of versionedAncients) {
      const key = ancient.act ?? "none";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [versionedAncients]);

  const toggleAct = useCallback((act: string) => {
    setSelectedActs((prev) => {
      const next = new Set(prev);
      if (next.has(act)) next.delete(act);
      else next.add(act);
      return next;
    });
  }, []);

  const { sidebarOpen, setSidebarOpen, isMobile } = useCodexFilterDrawer();

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

          <FilterSection trigger="%" label={serviceText.eventsView.actFilter} sortDir={actSortDir} onSortToggle={() => setActSortDir(toggleFilterSortDir)} sortTitle={serviceText.common.sortButtonTitle}>
            <div className="flex flex-col gap-0.5">
              {orderByFilterSortDir(EVENT_ACT_ORDER, actSortDir).map((act) => {
                const key = act ?? "none";
                const count = actCounts.get(key) ?? 0;
                const label = getActLabel(act, serviceText, gameUi);
                return (
                  <button
                    key={key}
                    onClick={() => toggleAct(key)}
                    className={`flex items-center gap-2 text-left text-sm px-2.5 py-1 rounded transition-all ${
                      selectedActs.has(key)
                        ? "bg-yellow-500/20 text-yellow-400"
                        : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: act ? COMPENDIUM_ACT_COLOR : "#666" }}
                    />
                    <span className={act ? COMPENDIUM_ACT_TEXT_CLASS : "text-zinc-400"}>{label}</span>
                    <span className="text-xs text-zinc-600">({count})</span>
                  </button>
                );
              })}
            </div>
          </FilterSection>
        </>
      )}
    >
      <main className="flex-1 flex flex-col overflow-hidden">
        <CodexLibraryTopBar
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          closeFiltersLabel={serviceText.common.closeFilters}
          openFiltersLabel={serviceText.common.openFilters}
          title={gameUi.ancientsTitle}
          count={formatCodexCount(filteredAncients.length, serviceText.labels.items, serviceLocale)}
          trailing={versions && currentVersion ? (
            <VersionSelector
              versions={versions}
              currentVersion={currentVersion}
              selectedVersion={selectedVersion}
              onChange={setSelectedVersion}
            />
          ) : undefined}
        />

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {groupedAncients.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-gray-500">
              {serviceText.common.noResults}
            </div>
          ) : (
            <div className="space-y-8">
              {groupedAncients.map((group) => (
                <section key={group.act ?? "none"}>
                  <h2 className="mb-3 flex items-center gap-2 text-base font-semibold" style={{ color: group.color }}>
                    {group.label}
                    <span className="text-xs font-normal text-zinc-600">
                      {group.ancients.length}
                    </span>
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {group.ancients.map((ancient) => (
                      <AncientCard
                        key={ancient.id}
                        ancient={ancient}
                        relicCount={ancient.relicIds.length}
                        serviceLocale={serviceLocale}
                        messages={serviceText}
                        gameUi={gameUi}
                        onSelect={selectAncient}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </main>

      {selectedAncient && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeSelectedAncient();
          }}
        >
          <div className="my-8 mx-4 w-full max-w-6xl">
            <AncientDetail
              serviceLocale={serviceLocale}
              gameUi={gameUi}
              backToListTitle={gameUi.ancientsTitle}
              ancient={selectedAncient}
              cards={cards}
              relics={selectedAncientRelics}
              onClose={closeSelectedAncient}
              entities={entities}
              patches={patches}
              changes={changes}
              versionDiffs={versionDiffs}
            />
          </div>
        </div>
      )}
    </CodexLibraryShell>
  );
}

function AncientCard({
  ancient,
  relicCount,
  serviceLocale,
  messages,
  gameUi,
  onSelect,
}: {
  ancient: CodexAncient;
  relicCount: number;
  serviceLocale: ServiceLocale;
  messages: CodexServiceMessages;
  gameUi: CodexGameUiLabels;
  onSelect: (ancient: CodexAncient) => void;
}) {
  return (
    <Link
      href={localizeHref(buildCompendiumResourceDetailHref("ancient", ancient.id), serviceLocale)}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
        event.preventDefault();
        onSelect(ancient);
      }}
      className={`group relative overflow-hidden rounded-xl border border-blue-900/30 bg-[#12121a] transition-all duration-200 hover:border-blue-600/50 ${
        ancient.deprecated ? "opacity-50 grayscale saturate-0" : ""
      }`}
    >
      {/* Image */}
      <div className="relative flex w-full aspect-square items-center justify-center overflow-hidden">
        <AncientNodeRender
          ancientId={ancient.id}
          className="h-[62%] transition-transform duration-300 group-hover:scale-105"
          sizes="(max-width: 640px) 62vw, (max-width: 1024px) 31vw, 16vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#12121a] via-transparent to-transparent" />
      </div>

      {/* Text */}
      <div className="relative px-4 pb-4 -mt-8">
        <h2 className="font-game-title text-lg text-blue-300 group-hover:text-blue-200 transition-colors">
          {ancient.name}
        </h2>
        <p className="text-xs text-zinc-400 mt-1 italic">{ancient.epithet}</p>
        <div className="flex items-center gap-2 mt-2">
          <ActBadge act={ancient.act} messages={messages} gameUi={gameUi} />
          <span className="text-[10px] text-zinc-500">
            {formatTemplateCount(messages.ancientsView.relicCount, relicCount)}
          </span>
        </div>
      </div>
    </Link>
  );
}

function getActLabel(
  act: EventAct | null,
  serviceText: CodexServiceMessages,
  gameUi: CodexGameUiLabels,
): string {
  return act ? gameUi.acts[act] : serviceText.labels.acts.none;
}
