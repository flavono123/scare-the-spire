"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { getChoseong } from "es-hangul";
import {
  CodexRelic,
  CodexCharacter,
  RelicRarityKo,
  RelicFilterPool,
  RELIC_RARITY_ORDER,
  RELIC_RARITY_LABELS,
  RELIC_RARITY_COLORS,
  RELIC_RARITY_DESCRIPTIONS,
  POOL_LABELS,
  POOL_ALIASES,
  RARITY_ALIASES,
} from "@/lib/codex-types";
import type { STS2Patch, EntityVersionDiff } from "@/lib/types";
import { reconstructRelicAtVersion } from "@/lib/entity-versioning";
import { RelicTile } from "./relic-tile";
import { RelicDetail } from "./relic-detail";
import { SearchBar, TriggerGroup } from "./search-bar";
import { FilterSection, IconFilterButton, ToggleButton } from "./codex-filters";
import { VersionSelector } from "./version-selector";

// Trigger groups for relic search
const RELIC_TRIGGERS: TriggerGroup[] = [
  {
    trigger: "@",
    label: "출처",
    items: [
      { value: "공용", label: "공용", desc: "Shared" },
      { value: "아이언클래드", label: "아이언클래드", desc: "Ironclad" },
      { value: "사일런트", label: "사일런트", desc: "Silent" },
      { value: "디펙트", label: "디펙트", desc: "Defect" },
      { value: "네크로바인더", label: "네크로바인더", desc: "Necrobinder" },
      { value: "리젠트", label: "리젠트", desc: "Regent" },
    ],
    validate: (val) => POOL_ALIASES[val] ?? null,
    chipColor: "bg-blue-500/20 text-blue-400",
  },
  {
    trigger: "#",
    label: "희귀도",
    items: [
      { value: "시작", label: "시작", desc: "Starter" },
      { value: "일반", label: "일반", desc: "Common" },
      { value: "고급", label: "고급", desc: "Uncommon" },
      { value: "희귀", label: "희귀", desc: "Rare" },
      { value: "상점", label: "상점", desc: "Shop" },
      { value: "이벤트", label: "이벤트", desc: "Event" },
      { value: "고대", label: "고대", desc: "Ancient/Boss" },
    ],
    validate: (val) => RARITY_ALIASES[val] ?? null,
    chipColor: "bg-green-500/20 text-green-400",
  },
];

interface RelicLibraryProps {
  relics: CodexRelic[];
  characters: CodexCharacter[];
  versions?: string[];
  currentVersion?: string;
  patches?: STS2Patch[];
  versionDiffs?: EntityVersionDiff[];
}

export function RelicLibrary({ relics, characters, versions, currentVersion, patches, versionDiffs }: RelicLibraryProps) {
  const searchParams = useSearchParams();
  const [selectedPools, setSelectedPools] = useState<Set<RelicFilterPool>>(new Set());
  const [selectedRarities, setSelectedRarities] = useState<Set<RelicRarityKo>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedVersion, setSelectedVersion] = useState(currentVersion ?? "");

  // Relic detail modal — initialize from ?relic= query param
  const initialRelicId = searchParams.get("relic");
  const [selectedRelic, setSelectedRelic] = useState<CodexRelic | null>(() => {
    if (!initialRelicId) return null;
    return relics.find((r) => r.id.toLowerCase() === initialRelicId.toLowerCase()) ?? null;
  });

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

  // Parse search query
  const parsedSearch = useMemo(() => {
    const tokens: { type: "pool" | "rarity"; value: string }[] = [];
    const textParts: string[] = [];

    const parts = searchQuery.split(/\s+/).filter(Boolean);
    for (const part of parts) {
      if (part.startsWith("@")) {
        const val = part.slice(1).toLowerCase();
        const match = POOL_ALIASES[val];
        if (match) tokens.push({ type: "pool", value: match });
        else textParts.push(part);
      } else if (part.startsWith("#")) {
        const val = part.slice(1).toLowerCase();
        const match = RARITY_ALIASES[val];
        if (match) tokens.push({ type: "rarity", value: match });
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

  // Filtered relics
  const filteredRelics = useMemo(() => {
    let result = versionedRelics;

    // Pool filter (sidebar)
    if (selectedPools.size > 0) {
      result = result.filter((r) => selectedPools.has(r.pool));
    }

    // Rarity filter (sidebar)
    if (selectedRarities.size > 0) {
      result = result.filter((r) => selectedRarities.has(r.rarity));
    }

    // Search token filters
    for (const token of parsedSearch.tokens) {
      if (token.type === "pool") {
        result = result.filter((r) => r.pool === token.value);
      } else if (token.type === "rarity") {
        result = result.filter((r) => r.rarity === token.value);
      }
    }

    // Text search (name + description)
    if (parsedSearch.text) {
      result = result.filter(
        (r) =>
          fuzzyMatch(r.name, parsedSearch.text) ||
          fuzzyMatch(r.nameEn, parsedSearch.text) ||
          r.description.replace(/\[\/?\w+(?::?\w*)*\]/g, "").toLowerCase().includes(parsedSearch.text)
      );
    }

    return result;
  }, [versionedRelics, selectedPools, selectedRarities, parsedSearch, fuzzyMatch]);

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

  // Toggle helpers
  const togglePool = useCallback((pool: RelicFilterPool) => {
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

  // Character filters for pool
  const characterFilters = characters.map((c) => ({
    key: c.id.toLowerCase() as RelicFilterPool,
    label: c.name,
    icon: c.imageUrl,
  }));

  const rarityFilters = RELIC_RARITY_ORDER.filter((r) => r !== "None").map((r) => ({
    key: r,
    label: RELIC_RARITY_LABELS[r],
    color: RELIC_RARITY_COLORS[r],
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
        {/* Pool (character) filters */}
        <FilterSection trigger="@" label="출처">
          <div className="flex flex-wrap gap-1.5">
            {characterFilters.map((cf) => (
              <IconFilterButton
                key={cf.key}
                icon={cf.icon}
                label={cf.label}
                active={selectedPools.has(cf.key)}
                onClick={() => togglePool(cf.key)}
              />
            ))}
          </div>
        </FilterSection>

        <div className="border-t border-white/10" />

        {/* Rarity filter */}
        <FilterSection trigger="#" label="희귀도">
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
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar with Search */}
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
          <h1 className="text-base font-bold text-yellow-500 shrink-0">유물 도감</h1>
          <div className="flex-1 max-w-xl mx-auto">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              inputId="codex-search"
              triggerGroups={RELIC_TRIGGERS}
              placeholder="유물 검색..."
            />
          </div>
          <span className="text-sm text-gray-500 shrink-0 tabular-nums">
            {filteredRelics.length}개
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

        {/* Relic Grid (grouped by rarity) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {groupedRelics.map(({ rarity, relics: groupRelics }) => (
            <section key={rarity} className="mb-8 last:mb-0">
              {/* Rarity section header */}
              <div className="mb-3">
                <h2
                  className="text-lg font-bold mb-0.5"
                  style={{ color: RELIC_RARITY_COLORS[rarity] }}
                >
                  {RELIC_RARITY_LABELS[rarity]}:
                  <span className="text-sm font-normal text-gray-400 ml-2">
                    {RELIC_RARITY_DESCRIPTIONS[rarity]}
                  </span>
                </h2>
              </div>

              {/* Relic icon grid */}
              <div className="flex flex-wrap gap-2">
                {groupRelics.map((relic) => (
                  <RelicTile key={relic.id} relic={relic} onClick={() => setSelectedRelic(relic)} />
                ))}
              </div>
            </section>
          ))}

          {filteredRelics.length === 0 && (
            <div className="flex items-center justify-center h-64 text-gray-500">
              검색 결과가 없습니다
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
          <div className="w-full max-w-lg my-8 mx-4 bg-[#1a1a2e] rounded-xl border border-white/10 shadow-2xl">
            <RelicDetail relic={selectedRelic} onClose={() => setSelectedRelic(null)} />
          </div>
        </div>
      )}
    </div>
  );
}
