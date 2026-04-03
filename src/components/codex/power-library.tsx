"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { getChoseong } from "es-hangul";
import {
  CodexPower,
  PowerType,
  POWER_TYPE_ORDER,
  POWER_TYPE_CONFIG,
  POWER_TYPE_ALIASES,
} from "@/lib/codex-types";
import type { STS2Patch, EntityVersionDiff } from "@/lib/types";
import { reconstructEntityAtVersion } from "@/lib/entity-versioning";
import { PowerTile } from "./power-tile";
import { SearchBar, TriggerGroup } from "./search-bar";
import { FilterSection, ToggleButton } from "./codex-filters";
import { VersionSelector } from "./version-selector";

const POWER_TRIGGERS: TriggerGroup[] = [
  {
    trigger: "#",
    label: "유형",
    items: [
      { value: "버프", label: "버프", desc: "Buff" },
      { value: "디버프", label: "디버프", desc: "Debuff" },
      { value: "기타", label: "기타", desc: "Other" },
    ],
    validate: (val) => POWER_TYPE_ALIASES[val] ?? null,
    chipColor: "bg-green-500/20 text-green-400",
  },
];

interface PowerLibraryProps {
  powers: CodexPower[];
  versions?: string[];
  currentVersion?: string;
  patches?: STS2Patch[];
  versionDiffs?: EntityVersionDiff[];
}

export function PowerLibrary({ powers, versions, currentVersion, patches, versionDiffs }: PowerLibraryProps) {
  const [selectedTypes, setSelectedTypes] = useState<Set<PowerType>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedVersion, setSelectedVersion] = useState(currentVersion ?? "");

  const versionedPowers = useMemo(() => {
    if (!currentVersion || !versionDiffs || !patches || selectedVersion === currentVersion) return powers;
    return powers.map((power) =>
      reconstructEntityAtVersion(power, "power", selectedVersion, currentVersion, versionDiffs, patches),
    );
  }, [powers, selectedVersion, currentVersion, versionDiffs, patches]);

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
    const tokens: { type: "powerType"; value: PowerType }[] = [];
    const textParts: string[] = [];

    const parts = searchQuery.split(/\s+/).filter(Boolean);
    for (const part of parts) {
      if (part.startsWith("#")) {
        const val = part.slice(1).toLowerCase();
        const match = POWER_TYPE_ALIASES[val];
        if (match) tokens.push({ type: "powerType", value: match });
        else textParts.push(part);
      } else {
        textParts.push(part);
      }
    }

    return { text: textParts.join(" ").toLowerCase(), tokens };
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
    for (let i = 0; i < lt.length && qi < lq.length; i++) {
      if (lt[i] === lq[qi]) qi++;
    }
    return qi === lq.length;
  }, []);

  // Filtered powers
  const filteredPowers = useMemo(() => {
    let result = versionedPowers;

    // Type filter (sidebar)
    if (selectedTypes.size > 0) {
      result = result.filter((p) => selectedTypes.has(p.type));
    }

    // Search token filters
    for (const token of parsedSearch.tokens) {
      if (token.type === "powerType") {
        result = result.filter((p) => p.type === token.value);
      }
    }

    // Text search
    if (parsedSearch.text) {
      result = result.filter(
        (p) =>
          fuzzyMatch(p.name, parsedSearch.text) ||
          fuzzyMatch(p.nameEn, parsedSearch.text) ||
          p.description.replace(/\[\/?\w+(?::?\w*)*\]/g, "").toLowerCase().includes(parsedSearch.text)
      );
    }

    return result;
  }, [versionedPowers, selectedTypes, parsedSearch, fuzzyMatch]);

  // Group by type
  const groupedPowers = useMemo(() => {
    const groups: { type: PowerType; powers: CodexPower[] }[] = [];
    for (const type of POWER_TYPE_ORDER) {
      const group = filteredPowers
        .filter((p) => p.type === type)
        .sort((a, b) => a.name.localeCompare(b.name, "ko"));
      if (group.length > 0) {
        groups.push({ type, powers: group });
      }
    }
    return groups;
  }, [filteredPowers]);

  const toggleType = useCallback((type: PowerType) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

  const typeFilters = POWER_TYPE_ORDER.filter((t) => t !== "None").map((t) => ({
    key: t,
    label: POWER_TYPE_CONFIG[t].label,
    color: POWER_TYPE_CONFIG[t].color,
  }));

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = (e: { matches: boolean }) => {
      setIsMobile(e.matches);
      setSidebarOpen(!e.matches);
    };
    update(mq);
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return (
    <div className="flex h-screen bg-[#1a1a2e] text-gray-200 overflow-hidden">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && isMobile && (
        <div
          className="fixed inset-0 z-40 bg-black/50"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Left Sidebar */}
      <aside className={`
        border-r border-white/10 bg-[#16162a] flex flex-col gap-2 overflow-y-auto transition-all duration-200 shrink-0
        ${isMobile
          ? `fixed z-50 inset-y-0 left-0 w-52 ${sidebarOpen ? "translate-x-0 p-3" : "-translate-x-full p-3"}`
          : `relative ${sidebarOpen ? "w-52 p-3" : "w-0 p-0 overflow-hidden border-r-0"}`
        }
      `}>
        {/* Type filter */}
        <FilterSection trigger="#" label="유형">
          <div className="flex flex-col gap-0.5">
            {typeFilters.map((t) => (
              <button
                key={t.key}
                onClick={() => toggleType(t.key)}
                className={`flex items-center gap-2 text-left text-sm px-2.5 py-1 rounded transition-all ${
                  selectedTypes.has(t.key)
                    ? "bg-yellow-500/20 text-yellow-400"
                    : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: t.color }}
                />
                {t.label}
              </button>
            ))}
          </div>
        </FilterSection>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div className="flex items-center gap-2 sm:gap-4 px-3 sm:px-4 py-2 border-b border-white/10 bg-[#16162a]/80">
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg border border-white/10 hover:bg-white/10 text-gray-400"
            aria-label={sidebarOpen ? "필터 닫기" : "필터 열기"}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {sidebarOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              )}
            </svg>
          </button>
          <h1 className="text-base font-bold text-yellow-500 shrink-0">파워 도감</h1>
          <div className="flex-1 max-w-xl mx-auto">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              inputId="codex-search"
              triggerGroups={POWER_TRIGGERS}
              placeholder="파워 검색..."
            />
          </div>
          <span className="text-sm text-gray-500 shrink-0 tabular-nums">
            {filteredPowers.length}개
          </span>
          {versions && versions.length > 0 && currentVersion && (
            <VersionSelector
              versions={versions}
              currentVersion={currentVersion}
              selectedVersion={selectedVersion}
              onChange={setSelectedVersion}
            />
          )}
        </div>

        {/* Power Grid (grouped by type) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {groupedPowers.map(({ type, powers: groupPowers }) => (
            <section key={type} className="mb-8 last:mb-0">
              <div className="mb-3">
                <h2
                  className="text-lg font-bold mb-0.5"
                  style={{ color: POWER_TYPE_CONFIG[type].color }}
                >
                  {POWER_TYPE_CONFIG[type].label}
                  <span className="text-sm font-normal text-gray-400 ml-2">
                    {POWER_TYPE_CONFIG[type].description}
                  </span>
                </h2>
              </div>

              <div className="flex flex-wrap gap-2">
                {groupPowers.map((power) => (
                  <PowerTile key={power.id} power={power} />
                ))}
              </div>
            </section>
          ))}

          {filteredPowers.length === 0 && (
            <div className="flex items-center justify-center h-64 text-gray-500">
              검색 결과가 없습니다
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
