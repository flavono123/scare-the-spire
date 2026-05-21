"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import Image from "@/components/ui/static-image";
import { useSearchParams } from "next/navigation";
import type { ServiceLocale } from "@/lib/i18n";
import type { CodexGameUiLabels } from "@/lib/codex-game-ui";
import {
  formatCodexCount,
  getCodexServiceMessages,
  type CodexServiceMessages,
} from "@/lib/codex-service";
import type {
  CodexAncient,
  CodexCard,
  CodexEnchantment,
  CodexEvent,
  CodexPotion,
  CodexRelic,
  EventAct,
} from "@/lib/codex-types";
import {
  EVENT_ACT_ORDER,
  EVENT_ACT_UNKNOWN,
  EVENT_ACT_ALIASES,
} from "@/lib/codex-types";
import type { EntityVersionDiff, STS2Change, STS2Patch } from "@/lib/types";
import { reconstructEventAtVersion } from "@/lib/entity-versioning";
import {
  fuzzyMatchCodexText,
  parseCodexSearch,
  type CodexSearchTriggerGroup,
} from "@/lib/codex-search";
import { SearchBar } from "./search-bar";
import { VersionSelector } from "./version-selector";
import { FilterSection } from "./codex-filters";
import {
  CodexLibraryShell,
  CodexLibraryTopBar,
  useCodexFilterDrawer,
} from "./codex-filter-drawer";
import { EventDetail } from "./event-detail";

type EventSearchTokenType = "act";
const COMPENDIUM_ACT_COLOR = "#60a5fa";
const COMPENDIUM_ACT_TEXT_CLASS = "text-blue-300";

// --- Act badge ---
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
  return (
    <button
      onClick={onClick}
      className="group relative h-[72px] w-full cursor-pointer overflow-hidden rounded-lg border border-zinc-700/40 bg-zinc-900/80 text-left shadow-sm shadow-black/20 transition-all duration-200 hover:-translate-y-0.5 hover:border-yellow-500/40 hover:bg-white/[0.04] hover:shadow-lg hover:shadow-black/30"
    >
      {event.imageUrl ? (
        <div className="absolute inset-0">
          <Image
            src={event.imageUrl}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
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
        <ActBadge act={event.act} messages={messages} gameUi={gameUi} />
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
  ancients?: CodexAncient[];
  cards?: CodexCard[];
  enchantments?: CodexEnchantment[];
  events: CodexEvent[];
  madScienceBaseCard?: CodexCard | null;
  potions?: CodexPotion[];
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
  ancients,
  cards,
  enchantments,
  events,
  madScienceBaseCard,
  potions,
  relics,
  versions,
  currentVersion,
  patches,
  changes,
  versionDiffs,
}: EventListProps) {
  const serviceText = getCodexServiceMessages(serviceLocale);
  const searchParams = useSearchParams();
  const [selectedActs, setSelectedActs] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedVersion, setSelectedVersion] = useState(currentVersion);

  // Event detail modal
  const initialEventId = searchParams.get("event");
  const [selectedEvent, setSelectedEvent] = useState<CodexEvent | null>(() => {
    if (!initialEventId) return null;
    return events.find((e) => e.id.toLowerCase() === initialEventId.toLowerCase()) ?? null;
  });

  useEffect(() => {
    const url = new URL(window.location.href);
    if (selectedEvent) {
      url.searchParams.set("event", selectedEvent.id.toLowerCase());
    } else {
      url.searchParams.delete("event");
    }
    if (url.toString() !== window.location.href) {
      window.history.pushState(null, "", url.toString());
    }
  }, [selectedEvent]);

  useEffect(() => {
    const handler = () => {
      const url = new URL(window.location.href);
      const p = url.searchParams.get("event");
      if (!p) setSelectedEvent(null);
      else setSelectedEvent(events.find((e) => e.id.toLowerCase() === p.toLowerCase()) ?? null);
    };
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, [events]);

  useEffect(() => {
    if (!selectedEvent) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setSelectedEvent(null); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedEvent]);

  // Reconstruct events at selected version
  const versionedEvents = useMemo(() => {
    if (selectedVersion === currentVersion) return events;
    return events.map((event) =>
      reconstructEventAtVersion(event, selectedVersion, currentVersion, versionDiffs, patches),
    );
  }, [events, selectedVersion, currentVersion, versionDiffs, patches]);

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

  const eventTriggers = useMemo(
    () => getEventTriggers(serviceText, gameUi),
    [serviceText, gameUi],
  );

  // Parse search query
  const parsedSearch = useMemo(
    () => parseCodexSearch(searchQuery, eventTriggers),
    [searchQuery, eventTriggers],
  );

  // Filter events — 막 무관 events pass through any act filter
  const filtered = useMemo(() => {
    return versionedEvents.filter((e) => {
      if (selectedActs.size > 0 && e.act !== null) {
        const actKey = e.act ?? "none";
        if (!selectedActs.has(actKey)) return false;
      }
      if (selectedActs.size > 0 && e.act === null && !selectedActs.has("none")) {
        const hasSpecificAct = [...selectedActs].some((a) => a !== "none");
        if (!hasSpecificAct) return false;
      }
      const actTokens = parsedSearch.tokens.filter((token) => token.type === "act");
      if (actTokens.length > 0 && e.act !== null) {
        const actKey = e.act ?? "none";
        if (!actTokens.some((token) => token.value === actKey)) return false;
      }
      if (parsedSearch.text) {
        const nameMatch = fuzzyMatchCodexText(e.name, parsedSearch.text);
        const nameEnMatch = fuzzyMatchCodexText(e.nameEn, parsedSearch.text);
        if (!nameMatch && !nameEnMatch) return false;
      }
      return true;
    });
  }, [versionedEvents, selectedActs, parsedSearch]);

  // Group by act
  const groups = useMemo(() => {
    const map = new Map<string, CodexEvent[]>();
    for (const e of filtered) {
      const key = e.act ?? "__none__";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    const ordered: { act: EventAct | null; label: string; color: string; events: CodexEvent[] }[] = [];
    for (const act of EVENT_ACT_ORDER) {
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
  }, [filtered, gameUi, serviceText]);

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
      const key = e.act ?? "none";
      counts.set(key, (counts.get(key) ?? 0) + 1);
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
        <FilterSection trigger="%" label={serviceText.eventsView.actFilter}>
          <div className="flex flex-col gap-0.5">
            {EVENT_ACT_ORDER.map((act) => {
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
      )}
    >
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
              triggerGroups={eventTriggers}
              placeholder={serviceText.eventsView.searchPlaceholder}
            />
          )}
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
                          onClick={() => setSelectedEvent(event)}
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
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedEvent(null); }}
        >
          <div className="mx-4 my-4 w-full max-w-[92rem]">
            <EventDetail
              serviceLocale={serviceLocale}
              gameUi={gameUi}
              event={selectedEvent}
              ancients={ancients}
              cards={cards}
              enchantments={enchantments}
              madScienceBaseCard={madScienceBaseCard}
              potions={potions}
              relics={relics}
              patches={patches}
              changes={changes}
              versionDiffs={versionDiffs}
              onClose={() => setSelectedEvent(null)}
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

function getEventTriggers(
  serviceText: CodexServiceMessages,
  gameUi: CodexGameUiLabels,
): CodexSearchTriggerGroup<EventSearchTokenType>[] {
  return [
    {
      trigger: "%",
      type: "act",
      label: serviceText.eventsView.actFilter,
      items: [
        { value: "act1", label: gameUi.acts["Act 1 - Overgrowth"], desc: "Act 1 Overgrowth" },
        { value: "underdocks", label: gameUi.acts.Underdocks, desc: "Underdocks" },
        { value: "act2", label: gameUi.acts["Act 2 - Hive"], desc: "Act 2 Hive" },
        { value: "act3", label: gameUi.acts["Act 3 - Glory"], desc: "Act 3 Glory" },
        { value: "none", label: serviceText.labels.acts.none, desc: "Any act" },
      ],
      validate: (val) => EVENT_ACT_ALIASES[val] ?? null,
      chipColor: "bg-blue-500/20 text-blue-400",
    },
  ];
}
