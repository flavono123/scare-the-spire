"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import Image from "next/image";
import { getChoseong } from "es-hangul";
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
import { EventContentViewer } from "./event-detail";

// --- Search triggers ---
const EVENT_TRIGGERS: TriggerGroup[] = [
  {
    trigger: "@",
    label: "막",
    items: [
      { value: "1막", label: "1막 — 과성장", desc: "Act 1 Overgrowth" },
      { value: "지하 선착장", label: "1막 — 지하 선착장", desc: "Underdocks" },
      { value: "2막", label: "2막 — 군락", desc: "Act 2 Hive" },
      { value: "3막", label: "3막 — 영광", desc: "Act 3 Glory" },
      { value: "막 무관", label: "막 무관", desc: "Any act" },
    ],
    validate: (val) => EVENT_ACT_ALIASES[val] ?? null,
    chipColor: "bg-blue-500/20 text-blue-400",
  },
];

// --- Act badge ---
function ActBadge({ act }: { act: EventAct | null }) {
  const config = act
    ? (EVENT_ACT_CONFIG[act] ?? EVENT_ACT_UNKNOWN)
    : EVENT_ACT_UNKNOWN;
  return (
    <span
      className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-medium ${config.color} ${config.border} ${config.bg}`}
    >
      {config.labelKo}
    </span>
  );
}

// --- Collapsed thumbnail item ---
function EventThumbnail({
  event,
  onClick,
}: {
  event: CodexEvent;
  onClick: () => void;
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
        <ActBadge act={event.act} />
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

// --- Expanded event card (inline, game-like layout) ---
function EventExpanded({
  event,
  onClose,
}: {
  event: CodexEvent;
  onClose: () => void;
}) {
  return (
    <div className="rounded-xl border border-yellow-900/30 bg-[#12121a] overflow-hidden animate-in slide-in-from-top-1 fade-in duration-200">
      <div className="flex flex-col md:flex-row">
        {/* Left: Event art */}
        {event.imageUrl && (
          <div className="relative md:w-[360px] h-[200px] md:h-auto md:min-h-[300px] flex-shrink-0">
            <Image
              src={event.imageUrl}
              alt={event.name}
              fill
              sizes="360px"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-b md:bg-gradient-to-r from-transparent via-transparent to-[#12121a]" />
          </div>
        )}

        {/* Right: Title, description, choices */}
        <div className="flex-1 p-5 md:p-6 min-w-0">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h2 className="font-[family-name:var(--font-gc-batang)] text-xl text-yellow-400">
                {event.name}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-zinc-500">{event.nameEn}</span>
                <ActBadge act={event.act} />
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-zinc-600 hover:text-zinc-300 transition-colors p-1 flex-shrink-0"
            >
              <svg className="w-5 h-5" viewBox="0 0 16 16" fill="currentColor">
                <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z" />
              </svg>
            </button>
          </div>

          {/* Interactive content (description + options in-place) */}
          <EventContentViewer event={event} />
        </div>
      </div>
    </div>
  );
}

// --- Main EventList component ---
interface EventListProps {
  events: CodexEvent[];
  versions: string[];
  currentVersion: string;
  patches: STS2Patch[];
  versionDiffs: EntityVersionDiff[];
}

export function EventList({ events, versions, currentVersion, patches, versionDiffs }: EventListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedActs, setSelectedActs] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedVersion, setSelectedVersion] = useState(currentVersion);

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
        label: config.labelKo,
        color: config.color,
        events: items.sort((a, b) => a.name.localeCompare(b.name, "ko")),
      });
    }
    return ordered;
  }, [filtered]);

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

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Header */}
      <div className="border-b border-yellow-900/30 bg-[#0d0d14]">
        <div className="mx-auto max-w-5xl px-6 py-8 text-center">
          <h1 className="font-[family-name:var(--font-gc-batang)] text-3xl md:text-4xl text-yellow-500 mb-2">
            이벤트
          </h1>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 md:px-6 py-6">
        <div className="flex gap-6">
          {/* Sidebar filters */}
          <aside className="hidden md:block w-48 flex-shrink-0 space-y-5">
            <FilterSection trigger="@" label="막">
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
                      label={`${config.labelKo} (${count})`}
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
                  triggerGroups={EVENT_TRIGGERS}
                  placeholder="이벤트 검색... (⌘K)"
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
                    {config.labelKo}
                  </button>
                );
              })}
            </div>

            {/* Event list grouped by act */}
            {groups.length === 0 ? (
              <div className="text-center py-16 text-zinc-600">
                <p className="text-lg">검색 결과가 없습니다</p>
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
                      {group.events.map((event) =>
                        expandedId === event.id ? (
                          <EventExpanded
                            key={event.id}
                            event={event}
                            onClose={() => setExpandedId(null)}
                          />
                        ) : (
                          <EventThumbnail
                            key={event.id}
                            event={event}
                            onClick={() => setExpandedId(event.id)}
                          />
                        ),
                      )}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="h-16" />
    </div>
  );
}
