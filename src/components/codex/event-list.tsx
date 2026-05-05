"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import Image from "@/components/ui/static-image";
import { useSearchParams } from "next/navigation";
import { getChoseong } from "es-hangul";
import type { ServiceLocale } from "@/lib/i18n";
import {
  getCodexServiceMessages,
  type CodexServiceMessages,
} from "@/lib/codex-service";
import type {
  CodexEvent,
  EventAct,
} from "@/lib/codex-types";
import {
  EVENT_ACT_ORDER,
  EVENT_ACT_CONFIG,
  EVENT_ACT_UNKNOWN,
  EVENT_ACT_ALIASES,
} from "@/lib/codex-types";
import type { EntityVersionDiff, STS2Patch } from "@/lib/types";
import { reconstructEventAtVersion } from "@/lib/entity-versioning";
import { SearchBar, TriggerGroup } from "./search-bar";
import { VersionSelector } from "./version-selector";
import { FilterSection, ToggleButton } from "./codex-filters";
import { EventDetail } from "./event-detail";

// --- Act badge ---
function ActBadge({
  act,
  messages,
}: {
  act: EventAct | null;
  messages: CodexServiceMessages;
}) {
  const config = act
    ? (EVENT_ACT_CONFIG[act] ?? EVENT_ACT_UNKNOWN)
    : EVENT_ACT_UNKNOWN;
  const label = act ? messages.labels.acts[act] : messages.labels.acts.none;
  return (
    <span
      className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-medium ${config.color} ${config.border} ${config.bg}`}
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
}: {
  event: CodexEvent;
  onClick: () => void;
  messages: CodexServiceMessages;
}) {
  return (
    <button
      onClick={onClick}
      className="group relative w-full h-[72px] overflow-hidden rounded-lg border border-zinc-700/40 bg-zinc-900/80 hover:border-yellow-700/40 transition-all cursor-pointer text-left"
    >
      {event.imageUrl ? (
        <div className="absolute inset-0">
          <Image
            src={event.imageUrl}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover object-[30%_center] opacity-40 group-hover:opacity-60 transition-opacity"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/30 via-black/60 to-black/80" />
        </div>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-r from-zinc-800/50 to-zinc-900/80" />
      )}
      <div className="relative flex h-full items-center px-4 gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-zinc-100 truncate group-hover:text-yellow-200 transition-colors">
            {event.name}
          </h3>
          <span className="text-[10px] text-zinc-500 group-hover:text-zinc-400">
            {event.nameEn}
          </span>
        </div>
        <ActBadge act={event.act} messages={messages} />
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
  events: CodexEvent[];
  versions: string[];
  currentVersion: string;
  patches: STS2Patch[];
  versionDiffs: EntityVersionDiff[];
}

export function EventList({ serviceLocale, events, versions, currentVersion, patches, versionDiffs }: EventListProps) {
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

  // Parse search query
  const parsedSearch = useMemo(() => {
    const actTokens: string[] = [];
    const textParts: string[] = [];
    const parts = searchQuery.split(/\s+/).filter(Boolean);
    for (const part of parts) {
      if (part.startsWith("@")) {
        const val = part.slice(1).toLowerCase();
        const match = EVENT_ACT_ALIASES[val];
        if (match) actTokens.push(match);
        else textParts.push(part);
      } else {
        textParts.push(part);
      }
    }
    return { text: textParts.join(" ").toLowerCase(), actTokens };
  }, [searchQuery]);

  const fuzzyMatch = useCallback((text: string, query: string): boolean => {
    if (!query) return true;
    const lt = text.toLowerCase();
    const lq = query.toLowerCase();
    if (lt.includes(lq)) return true;
    const isAllJamo = /^[ㄱ-ㅎ]+$/.test(query);
    if (isAllJamo) {
      const choseong = getChoseong(text);
      if (choseong.includes(query)) return true;
    }
    let qi = 0;
    for (let ti = 0; ti < lt.length && qi < lq.length; ti++) {
      if (lt[ti] === lq[qi]) qi++;
    }
    return qi === lq.length;
  }, []);

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
      if (parsedSearch.actTokens.length > 0 && e.act !== null) {
        const actKey = e.act ?? "none";
        if (!parsedSearch.actTokens.includes(actKey)) return false;
      }
      if (parsedSearch.text) {
        const nameMatch = fuzzyMatch(e.name, parsedSearch.text);
        const nameEnMatch = fuzzyMatch(e.nameEn, parsedSearch.text);
        if (!nameMatch && !nameEnMatch) return false;
      }
      return true;
    });
  }, [versionedEvents, selectedActs, parsedSearch, fuzzyMatch]);

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
      const config = act ? (EVENT_ACT_CONFIG[act] ?? EVENT_ACT_UNKNOWN) : EVENT_ACT_UNKNOWN;
      ordered.push({
        act,
        label: act ? serviceText.labels.acts[act] : serviceText.labels.acts.none,
        color: config.color,
        events: items.sort((a, b) => a.name.localeCompare(b.name, "ko")),
      });
    }
    return ordered;
  }, [filtered, serviceText]);

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

  const eventTriggers = useMemo(
    () => getEventTriggers(serviceText),
    [serviceText],
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-yellow-900/30 bg-[#0d0d14]">
        <div className="mx-auto max-w-5xl px-6 py-8 text-center">
          <h1 className="font-[family-name:var(--font-gc-batang)] text-3xl md:text-4xl text-yellow-500 mb-2">
            {serviceText.eventsView.title}
          </h1>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 md:px-6 py-6">
        <div className="flex gap-6">
          {/* Sidebar filters */}
          <aside className="hidden md:block w-48 flex-shrink-0 space-y-5">
            <FilterSection trigger="@" label={serviceText.eventsView.actFilter}>
              <div className="space-y-0.5">
                {EVENT_ACT_ORDER.map((act) => {
                  const key = act ?? "none";
                  const config = act
                    ? (EVENT_ACT_CONFIG[act] ?? EVENT_ACT_UNKNOWN)
                    : EVENT_ACT_UNKNOWN;
                  const count = actCounts.get(key) ?? 0;
                  return (
                    <ToggleButton
                      key={key}
                      label={`${act ? serviceText.labels.acts[act] : serviceText.labels.acts.none} (${count})`}
                      active={selectedActs.has(key)}
                      onClick={() => toggleAct(key)}
                    />
                  );
                })}
              </div>
            </FilterSection>
          </aside>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            {/* Search + Version */}
            <div className="mb-6 flex items-center gap-2">
              <div className="flex-1">
                <SearchBar
                  value={searchQuery}
                  onChange={setSearchQuery}
                  inputId="codex-search"
                  triggerGroups={eventTriggers}
                  placeholder={serviceText.eventsView.searchPlaceholder}
                />
              </div>
              <VersionSelector
                versions={versions}
                currentVersion={currentVersion}
                selectedVersion={selectedVersion}
                onChange={setSelectedVersion}
              />
            </div>

            {/* Mobile act filter */}
            <div className="flex md:hidden flex-wrap gap-1.5 mb-4">
              {EVENT_ACT_ORDER.map((act) => {
                const key = act ?? "none";
                const config = act
                  ? (EVENT_ACT_CONFIG[act] ?? EVENT_ACT_UNKNOWN)
                  : EVENT_ACT_UNKNOWN;
                return (
                  <button
                    key={key}
                    onClick={() => toggleAct(key)}
                    className={`text-[11px] px-2 py-1 rounded-full border transition-all ${
                      selectedActs.has(key)
                        ? `${config.border} ${config.bg} ${config.color}`
                        : "border-zinc-700/40 text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    {act ? serviceText.labels.acts[act] : serviceText.labels.acts.none}
                  </button>
                );
              })}
            </div>

            {/* Event list grouped by act */}
            {groups.length === 0 ? (
              <div className="text-center py-16 text-zinc-600">
                <p className="text-lg">{serviceText.common.noResults}</p>
              </div>
            ) : (
              <div className="space-y-8">
                {groups.map((group) => (
                  <section key={group.act ?? "none"}>
                    <h2
                      className={`mb-3 flex items-center gap-2 text-base font-semibold ${group.color}`}
                    >
                      {group.label}
                      <span className="text-xs font-normal text-zinc-600">
                        {group.events.length}
                      </span>
                    </h2>
                    <div className="space-y-2">
                      {group.events.map((event) => (
                        <EventThumbnail
                          key={event.id}
                          event={event}
                          messages={serviceText}
                          onClick={() => setSelectedEvent(event)}
                        />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="h-16" />

      {/* Event Detail Modal */}
      {selectedEvent && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedEvent(null); }}
        >
          <div className="w-full max-w-3xl my-8 mx-4 bg-[#12121a] rounded-xl border border-yellow-900/30 shadow-2xl">
            <EventDetail serviceLocale={serviceLocale} event={selectedEvent} onClose={() => setSelectedEvent(null)} />
          </div>
        </div>
      )}
    </div>
  );
}

function getEventTriggers(serviceText: CodexServiceMessages): TriggerGroup[] {
  return [
    {
      trigger: "@",
      label: serviceText.eventsView.actFilter,
      items: [
        { value: "act1", label: serviceText.labels.acts["Act 1 - Overgrowth"], desc: "Act 1 Overgrowth" },
        { value: "underdocks", label: serviceText.labels.acts.Underdocks, desc: "Underdocks" },
        { value: "act2", label: serviceText.labels.acts["Act 2 - Hive"], desc: "Act 2 Hive" },
        { value: "act3", label: serviceText.labels.acts["Act 3 - Glory"], desc: "Act 3 Glory" },
        { value: "none", label: serviceText.labels.acts.none, desc: "Any act" },
      ],
      validate: (val) => EVENT_ACT_ALIASES[val] ?? null,
      chipColor: "bg-blue-500/20 text-blue-400",
    },
  ];
}
