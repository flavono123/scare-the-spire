"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import Image from "@/components/ui/static-image";
import {
  addCodexUrlChangeListener,
  pushCodexHistoryState,
  useHydrationSafeSearchParam,
} from "./use-hydration-safe-search-param";
import type { ServiceLocale } from "@/lib/i18n";
import type { CodexGameUiLabels } from "@/lib/codex-game-ui";
import {
  formatCodexCount,
  getCodexServiceMessages,
  type CodexServiceMessages,
} from "@/lib/codex-service";
import type {
  CodexCard,
  CodexEnchantment,
  CodexEvent,
  CodexPotion,
  CodexPower,
  CodexRelic,
  EventAct,
} from "@/lib/codex-types";
import {
  EVENT_ACT_ORDER,
  EVENT_ACT_UNKNOWN,
  getEventActs,
} from "@/lib/codex-types";
import type { EntityVersionDiff, STS2Change, STS2Patch } from "@/lib/types";
import { versionCodexEntities } from "@/lib/codex-versioning";
import { fuzzyMatchCodexText, stripCodexMarkup } from "@/lib/codex-search";
import { SearchBar } from "./search-bar";
import { VersionSelector } from "./version-selector";
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
import { EventDetail } from "./event-detail";

const COMPENDIUM_ACT_COLOR = "#60a5fa";
const COMPENDIUM_ACT_TEXT_CLASS = "text-blue-300";

function eventActKey(act: EventAct | null): string {
  return act ?? "none";
}

function eventMatchesActKeys(event: CodexEvent, actKeys: Set<string>): boolean {
  if (actKeys.size === 0) return true;

  const eventKeys = getEventActs(event).map(eventActKey);
  if (eventKeys.includes("none")) {
    if (actKeys.has("none")) return true;
    return [...actKeys].some((key) => key !== "none");
  }

  return eventKeys.some((key) => actKeys.has(key));
}

function getGroupingActs(event: CodexEvent, activeActKeys: Set<string>): (EventAct | null)[] {
  const acts = getEventActs(event);
  if (activeActKeys.size === 0) return acts;

  const matchingActs = acts.filter((act) => activeActKeys.has(eventActKey(act)));
  return matchingActs.length > 0 ? matchingActs : acts;
}

// --- Act badges ---
function ActBadge({
  act,
  messages,
  gameUi,
}: {
  act: EventAct | null;
  messages: CodexServiceMessages;
  gameUi: CodexGameUiLabels;
}) {
  const label = getActLabel(act, messages, gameUi);
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

function ActBadges({
  event,
  messages,
  gameUi,
}: {
  event: CodexEvent;
  messages: CodexServiceMessages;
  gameUi: CodexGameUiLabels;
}) {
  return (
    <span className="flex flex-wrap justify-end gap-1">
      {getEventActs(event).map((act) => (
        <ActBadge key={eventActKey(act)} act={act} messages={messages} gameUi={gameUi} />
      ))}
    </span>
  );
}

// --- Collapsed thumbnail item ---
function EventThumbnail({
  event,
  onClick,
  messages,
  gameUi,
}: {
  event: CodexEvent;
  onClick: () => void;
  messages: CodexServiceMessages;
  gameUi: CodexGameUiLabels;
}) {
  const lifecycleClassName = event.deprecated ? " opacity-50 grayscale saturate-0" : "";
  return (
    <button
      onClick={onClick}
      className={`group relative h-[72px] w-full cursor-pointer overflow-hidden rounded-lg border border-zinc-700/40 bg-zinc-900/80 text-left shadow-sm shadow-black/20 transition-all duration-200 hover:-translate-y-0.5 hover:border-yellow-500/40 hover:bg-white/[0.04] hover:shadow-lg hover:shadow-black/30${lifecycleClassName}`}
    >
      {event.imageUrl ? (
        <div className="absolute inset-0">
          <Image
            src={event.imageUrl}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            loading="lazy"
            className="object-cover object-[30%_center] opacity-40 transition-all duration-300 group-hover:scale-[1.03] group-hover:opacity-65"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/30 via-black/60 to-black/80 transition-opacity duration-200 group-hover:opacity-90" />
        </div>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-r from-zinc-800/50 to-zinc-900/80" />
      )}
      <div className="relative flex h-full items-center px-4 gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-game-title text-sm font-semibold text-zinc-100 truncate group-hover:text-yellow-200 transition-colors">
            {event.name}
          </h3>
          <span className="font-game-text text-[10px] text-zinc-500 group-hover:text-zinc-400">
            {event.nameEn}
          </span>
        </div>
        <ActBadges event={event} messages={messages} gameUi={gameUi} />
        <svg
          className="w-4 h-4 text-zinc-600 group-hover:text-yellow-500 transition-colors flex-shrink-0"
          viewBox="0 0 16 16"
          fill="currentColor"
        >
          <path d="M6.22 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 010-1.06z" />
        </svg>
      </div>
    </button>
  );
}

// --- Main EventList component ---
interface EventListProps {
  serviceLocale: ServiceLocale;
  gameUi: CodexGameUiLabels;
  title: string;
  cards?: CodexCard[];
  enchantments?: CodexEnchantment[];
  events: CodexEvent[];
  madScienceBaseCard?: CodexCard | null;
  potions?: CodexPotion[];
  powers?: CodexPower[];
  relics?: CodexRelic[];
  versions: string[];
  currentVersion: string;
  patches: STS2Patch[];
  changes?: STS2Change[];
  versionDiffs: EntityVersionDiff[];
}

export function EventList({
  serviceLocale,
  gameUi,
  title,
  cards,
  enchantments,
  events,
  madScienceBaseCard,
  potions,
  powers,
  relics,
  versions,
  currentVersion,
  patches,
  changes,
  versionDiffs,
}: EventListProps) {
  const serviceText = getCodexServiceMessages(serviceLocale);
  const urlEventId = useHydrationSafeSearchParam("event");
  const [selectedActs, setSelectedActs] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedVersion, setSelectedVersion] = useState(currentVersion);
  const [actSortDir, setActSortDir] = useState<FilterSortDir>("asc");

  // Event detail modal
  const [selectedEventOverride, setSelectedEventOverride] = useState<CodexEvent | null>(null);
  const [useUrlSelection, setUseUrlSelection] = useState(true);
  const urlSelectedEvent = useMemo(() => (
    urlEventId
      ? events.find((e) => e.id.toLowerCase() === urlEventId.toLowerCase()) ?? null
      : null
  ), [events, urlEventId]);
  const selectedEvent = useUrlSelection ? urlSelectedEvent : selectedEventOverride;

  const selectEvent = useCallback((event: CodexEvent) => {
    setUseUrlSelection(false);
    setSelectedEventOverride(event);
  }, [setSelectedEventOverride, setUseUrlSelection]);

  const closeSelectedEvent = useCallback(() => {
    setUseUrlSelection(false);
    setSelectedEventOverride(null);
  }, [setSelectedEventOverride, setUseUrlSelection]);

  useEffect(() => {
    if (useUrlSelection) return;
    const url = new URL(window.location.href);
    if (selectedEventOverride) {
      url.searchParams.set("event", selectedEventOverride.id.toLowerCase());
    } else {
      url.searchParams.delete("event");
    }
    if (url.toString() !== window.location.href) {
      pushCodexHistoryState(url);
    }
  }, [selectedEventOverride, useUrlSelection]);

  useEffect(() => {
    const handler = () => {
      setUseUrlSelection(true);
      setSelectedEventOverride(null);
    };
    return addCodexUrlChangeListener(handler);
  }, []);

  useEffect(() => {
    if (!selectedEvent) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") closeSelectedEvent(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [closeSelectedEvent, selectedEvent]);

  const versionedEvents = useMemo(() => {
    return versionCodexEntities(events, "event", {
      selectedVersion,
      currentVersion,
      versionDiffs,
      patches,
      changes,
    });
  }, [events, selectedVersion, currentVersion, versionDiffs, patches, changes]);

  const searchText = useMemo(() => searchQuery.trim().toLowerCase(), [searchQuery]);

  const activeActKeys = useMemo(
    () => new Set(selectedActs),
    [selectedActs],
  );

  // Filter events — 막 무관 events pass through any specific act filter
  const filtered = useMemo(() => {
    return versionedEvents.filter((e) => {
      if (selectedActs.size > 0 && !eventMatchesActKeys(e, selectedActs)) return false;
      if (searchText) {
        const nameMatch = fuzzyMatchCodexText(e.name, searchText);
        const nameEnMatch = fuzzyMatchCodexText(e.nameEn, searchText);
        const descriptionMatch = fuzzyMatchCodexText(stripCodexMarkup(e.description), searchText);
        const descriptionEnMatch = fuzzyMatchCodexText(stripCodexMarkup(e.descriptionEn), searchText);
        if (!nameMatch && !nameEnMatch && !descriptionMatch && !descriptionEnMatch) return false;
      }
      return true;
    });
  }, [versionedEvents, selectedActs, searchText]);

  // Group by act
  const groups = useMemo(() => {
    const map = new Map<string, CodexEvent[]>();
    for (const e of filtered) {
      for (const act of getGroupingActs(e, activeActKeys)) {
        const key = act ?? "__none__";
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(e);
      }
    }
    const ordered: { act: EventAct | null; label: string; color: string; events: CodexEvent[] }[] = [];
    for (const act of orderByFilterSortDir(EVENT_ACT_ORDER, actSortDir)) {
      const key = act ?? "__none__";
      const items = map.get(key);
      if (!items) continue;
      ordered.push({
        act,
        label: getActLabel(act, serviceText, gameUi),
        color: act ? COMPENDIUM_ACT_COLOR : "#a1a1aa",
        events: items.sort((a, b) => a.name.localeCompare(b.name, "ko")),
      });
    }
    return ordered;
  }, [filtered, activeActKeys, gameUi, serviceText, actSortDir]);

  const toggleAct = useCallback((act: string) => {
    setSelectedActs((prev) => {
      const next = new Set(prev);
      if (next.has(act)) next.delete(act);
      else next.add(act);
      return next;
    });
  }, []);

  const actCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of events) {
      for (const act of getEventActs(e)) {
        const key = eventActKey(act);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    return counts;
  }, [events]);

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
          title={title}
          count={formatCodexCount(filtered.length, serviceText.labels.items, serviceLocale)}
          trailing={(
            <VersionSelector
              versions={versions}
              currentVersion={currentVersion}
              selectedVersion={selectedVersion}
              onChange={setSelectedVersion}
            />
          )}
        />

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {groups.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-gray-500">
              {serviceText.common.noResults}
            </div>
          ) : (
            <div className="space-y-8">
              {groups.map((group) => (
                <section key={group.act ?? "none"}>
                  <h2
                    className="mb-3 flex items-center gap-2 text-base font-semibold"
                    style={{ color: group.color }}
                  >
                    {group.label}
                    <span className="text-xs font-normal text-zinc-600">
                      {group.events.length}
                    </span>
                  </h2>
                  <div className="space-y-2">
                    {group.events.map((event, index) => (
                      <div
                        key={event.id}
                        className="animate-card-enter"
                        style={{ animationDelay: `${Math.min(index * 12, 180)}ms` }}
                      >
                        <EventThumbnail
                          event={event}
                          messages={serviceText}
                          gameUi={gameUi}
                          onClick={() => selectEvent(event)}
                        />
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Event Detail Modal */}
      {selectedEvent && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) closeSelectedEvent(); }}
        >
          <div className="mx-4 my-4 w-full max-w-[92rem]">
            <EventDetail
              serviceLocale={serviceLocale}
              gameUi={gameUi}
              event={selectedEvent}
              cards={cards}
              enchantments={enchantments}
              madScienceBaseCard={madScienceBaseCard}
              potions={potions}
              powers={powers}
              relics={relics}
              patches={patches}
              changes={changes}
              versionDiffs={versionDiffs}
              onClose={closeSelectedEvent}
            />
          </div>
        </div>
      )}
    </CodexLibraryShell>
  );
}

function getActLabel(
  act: EventAct | null,
  serviceText: CodexServiceMessages,
  gameUi: CodexGameUiLabels,
): string {
  return act ? gameUi.acts[act] : serviceText.labels.acts.none;
}
