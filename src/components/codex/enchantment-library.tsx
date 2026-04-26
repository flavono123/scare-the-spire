"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { getChoseong } from "es-hangul";
import {
  CodexEnchantment,
  CodexRelic,
  EnchantmentCardTypeFilter,
  ENCHANTMENT_CARD_TYPE_CONFIG,
  ENCHANTMENT_CARD_TYPE_ALIASES,
} from "@/lib/codex-types";
import type { STS2Patch, EntityVersionDiff } from "@/lib/types";
import type { EntityInfo } from "@/components/patch-note-renderer";
import { reconstructEntityAtVersion } from "@/lib/entity-versioning";
import { EnchantmentTile } from "./enchantment-tile";
import { EnchantmentDetail } from "./enchantment-detail";
import { SearchBar, TriggerGroup } from "./search-bar";
import { FilterSection, ToggleButton } from "./codex-filters";
import { VersionSelector } from "./version-selector";

const ENCHANTMENT_TRIGGERS: TriggerGroup[] = [
  {
    trigger: "#",
    label: "카드 유형",
    items: [
      { value: "공격", label: "공격", desc: "Attack" },
      { value: "스킬", label: "스킬", desc: "Skill" },
      { value: "전체", label: "전체", desc: "Any card type" },
    ],
    validate: (val) => ENCHANTMENT_CARD_TYPE_ALIASES[val] ?? null,
    chipColor: "bg-purple-500/20 text-purple-400",
  },
];

const CARD_TYPE_ORDER: EnchantmentCardTypeFilter[] = ["Any", "Attack", "Skill"];

function getCardTypeFilter(cardType: "Attack" | "Skill" | null): EnchantmentCardTypeFilter {
  return cardType ?? "Any";
}

interface EnchantmentLibraryProps {
  enchantments: CodexEnchantment[];
  versions?: string[];
  currentVersion?: string;
  patches?: STS2Patch[];
  versionDiffs?: EntityVersionDiff[];
  /** All codex entities — enables rich cross-references in the detail modal. */
  entities?: EntityInfo[];
  /** Relics — used to surface ones that grant the selected enchantment. */
  relics?: CodexRelic[];
}

export function EnchantmentLibrary({ enchantments, versions, currentVersion, patches, versionDiffs, entities, relics }: EnchantmentLibraryProps) {
  const searchParams = useSearchParams();
  const [selectedCardTypes, setSelectedCardTypes] = useState<Set<EnchantmentCardTypeFilter>>(new Set());
  const [stackableOnly, setStackableOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedVersion, setSelectedVersion] = useState(currentVersion ?? "");

  // Enchantment detail modal
  const initialEnchId = searchParams.get("enchantment");
  const [selectedEnchantment, setSelectedEnchantment] = useState<CodexEnchantment | null>(() => {
    if (!initialEnchId) return null;
    return enchantments.find((e) => e.id.toLowerCase() === initialEnchId.toLowerCase()) ?? null;
  });

  useEffect(() => {
    const url = new URL(window.location.href);
    if (selectedEnchantment) {
      url.searchParams.set("enchantment", selectedEnchantment.id.toLowerCase());
    } else {
      url.searchParams.delete("enchantment");
    }
    if (url.toString() !== window.location.href) {
      window.history.pushState(null, "", url.toString());
    }
  }, [selectedEnchantment]);

  useEffect(() => {
    const handler = () => {
      const url = new URL(window.location.href);
      const param = url.searchParams.get("enchantment");
      if (!param) {
        setSelectedEnchantment(null);
      } else {
        setSelectedEnchantment(enchantments.find((e) => e.id.toLowerCase() === param.toLowerCase()) ?? null);
      }
    };
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, [enchantments]);

  useEffect(() => {
    if (!selectedEnchantment) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedEnchantment(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedEnchantment]);

  const versionedEnchantments = useMemo(() => {
    if (!currentVersion || !versionDiffs || !patches || selectedVersion === currentVersion) return enchantments;
    return enchantments.map((ench) =>
      reconstructEntityAtVersion(ench, "enchantment", selectedVersion, currentVersion, versionDiffs, patches),
    );
  }, [enchantments, selectedVersion, currentVersion, versionDiffs, patches]);

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
    const tokens: { type: "cardType"; value: EnchantmentCardTypeFilter }[] = [];
    const textParts: string[] = [];

    const parts = searchQuery.split(/\s+/).filter(Boolean);
    for (const part of parts) {
      if (part.startsWith("#")) {
        const val = part.slice(1).toLowerCase();
        const match = ENCHANTMENT_CARD_TYPE_ALIASES[val];
        if (match) tokens.push({ type: "cardType", value: match });
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

  // Filtered enchantments
  const filteredEnchantments = useMemo(() => {
    let result = versionedEnchantments;

    // Card type filter (sidebar)
    if (selectedCardTypes.size > 0) {
      result = result.filter((e) => selectedCardTypes.has(getCardTypeFilter(e.cardType)));
    }

    // Stackable filter
    if (stackableOnly) {
      result = result.filter((e) => e.isStackable);
    }

    // Search token filters
    for (const token of parsedSearch.tokens) {
      if (token.type === "cardType") {
        result = result.filter((e) => getCardTypeFilter(e.cardType) === token.value);
      }
    }

    // Text search
    if (parsedSearch.text) {
      result = result.filter(
        (e) =>
          fuzzyMatch(e.name, parsedSearch.text) ||
          fuzzyMatch(e.nameEn, parsedSearch.text) ||
          e.description.replace(/\[\/?\w+(?::?\w*)*\]/g, "").toLowerCase().includes(parsedSearch.text)
      );
    }

    return result;
  }, [versionedEnchantments, selectedCardTypes, stackableOnly, parsedSearch, fuzzyMatch]);

  // Group by card type restriction
  const groupedEnchantments = useMemo(() => {
    const groups: { cardType: EnchantmentCardTypeFilter; enchantments: CodexEnchantment[] }[] = [];
    for (const ct of CARD_TYPE_ORDER) {
      const group = filteredEnchantments
        .filter((e) => getCardTypeFilter(e.cardType) === ct)
        .sort((a, b) => a.name.localeCompare(b.name, "ko"));
      if (group.length > 0) {
        groups.push({ cardType: ct, enchantments: group });
      }
    }
    return groups;
  }, [filteredEnchantments]);

  const toggleCardType = useCallback((ct: EnchantmentCardTypeFilter) => {
    setSelectedCardTypes((prev) => {
      const next = new Set(prev);
      if (next.has(ct)) next.delete(ct);
      else next.add(ct);
      return next;
    });
  }, []);

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

  const GROUP_DESCRIPTIONS: Record<EnchantmentCardTypeFilter, string> = {
    Any: "모든 카드에 적용 가능한 인챈트입니다.",
    Attack: "공격 카드에만 적용 가능한 인챈트입니다.",
    Skill: "스킬 카드에만 적용 가능한 인챈트입니다.",
  };

  return (
    <div className="flex h-[calc(100dvh-3rem)] bg-background text-foreground overflow-hidden">
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
        {/* Card type filter */}
        <FilterSection trigger="#" label="카드 유형">
          <div className="flex flex-col gap-0.5">
            {CARD_TYPE_ORDER.map((ct) => (
              <button
                key={ct}
                onClick={() => toggleCardType(ct)}
                className={`flex items-center gap-2 text-left text-sm px-2.5 py-1 rounded transition-all ${
                  selectedCardTypes.has(ct)
                    ? "bg-yellow-500/20 text-yellow-400"
                    : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: ENCHANTMENT_CARD_TYPE_CONFIG[ct].color }}
                />
                {ENCHANTMENT_CARD_TYPE_CONFIG[ct].label}
              </button>
            ))}
          </div>
        </FilterSection>

        <div className="border-t border-white/10" />

        {/* Stackable filter */}
        <FilterSection label="속성">
          <ToggleButton
            label="중첩 가능만"
            active={stackableOnly}
            onClick={() => setStackableOnly((v) => !v)}
          />
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
          <h1 className="text-base font-bold text-yellow-500 shrink-0">인챈트 도감</h1>
          <div className="flex-1 max-w-xl mx-auto">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              inputId="codex-search"
              triggerGroups={ENCHANTMENT_TRIGGERS}
              placeholder="인챈트 검색..."
            />
          </div>
          <span className="text-sm text-gray-500 shrink-0 tabular-nums">
            {filteredEnchantments.length}개
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

        {/* Enchantment Grid (grouped by card type) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {groupedEnchantments.map(({ cardType, enchantments: groupEnchantments }) => (
            <section key={cardType} className="mb-8 last:mb-0">
              <div className="mb-3">
                <h2
                  className="text-lg font-bold mb-0.5"
                  style={{ color: ENCHANTMENT_CARD_TYPE_CONFIG[cardType].color }}
                >
                  {ENCHANTMENT_CARD_TYPE_CONFIG[cardType].label}
                  <span className="text-sm font-normal text-gray-400 ml-2">
                    {GROUP_DESCRIPTIONS[cardType]}
                  </span>
                </h2>
              </div>

              <div className="flex flex-wrap gap-2">
                {groupEnchantments.map((ench) => (
                  <EnchantmentTile key={ench.id} enchantment={ench} onClick={() => setSelectedEnchantment(ench)} />
                ))}
              </div>
            </section>
          ))}

          {filteredEnchantments.length === 0 && (
            <div className="flex items-center justify-center h-64 text-gray-500">
              검색 결과가 없습니다
            </div>
          )}
        </div>
      </main>

      {/* Enchantment Detail Modal */}
      {selectedEnchantment && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedEnchantment(null);
          }}
        >
          <div className="w-full max-w-lg my-8 mx-4 bg-[#1a1a2e] rounded-xl border border-white/10 shadow-2xl">
            <EnchantmentDetail enchantment={selectedEnchantment} onClose={() => setSelectedEnchantment(null)} entities={entities} relics={relics} />
          </div>
        </div>
      )}
    </div>
  );
}
