"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { getChoseong } from "es-hangul";
import {
  CodexCard,
  CodexCharacter,
  CardFilterCategory,
  CardTypeKo,
  COLOR_LABELS,
  COLOR_ALIASES,
  TYPE_ALIASES,
} from "@/lib/codex-types";
import type { STS2Patch, EntityVersionDiff } from "@/lib/types";
import { reconstructCardAtVersion } from "@/lib/entity-versioning";
import {
  annotateCard,
  isEtcRarity,
  RarityDetail,
  RARITY_DETAIL_LABELS,
  RARITY_DETAIL_ORDER,
  RARITY_DETAIL_COLORS,
} from "@/lib/card-annotations";

// Sort key definitions
export type SortKey = "type" | "rarity" | "cost" | "name";
export type SortDir = "asc" | "desc";

const TYPE_SORT_ORDER: Record<string, number> = {
  "공격": 0, "스킬": 1, "파워": 2, "저주": 3, "상태이상": 4, "퀘스트": 5,
};

const RARITY_SORT_ORDER: Record<string, number> = {
  "기본": 0, "일반": 1, "고급": 2, "희귀": 3,
  // "기타" bucket
  "고대의 존재": 4, "이벤트": 4, "토큰": 4, "저주": 4, "상태이상": 4, "퀘스트": 4,
};

const SORT_LABELS: Record<SortKey, string> = {
  type: "유형",
  rarity: "희귀도",
  cost: "비용",
  name: "이름순",
};

// Default sort priority: type → rarity → cost → name
const DEFAULT_SORT_KEYS: SortKey[] = ["type", "rarity", "cost", "name"];

function compareCards(a: CodexCard, b: CodexCard, key: SortKey, dir: SortDir): number {
  let cmp = 0;
  switch (key) {
    case "type":
      cmp = (TYPE_SORT_ORDER[a.type] ?? 99) - (TYPE_SORT_ORDER[b.type] ?? 99);
      break;
    case "rarity":
      cmp = (RARITY_SORT_ORDER[a.rarity] ?? 99) - (RARITY_SORT_ORDER[b.rarity] ?? 99);
      break;
    case "cost":
      cmp = a.cost - b.cost;
      break;
    case "name":
      cmp = a.name.localeCompare(b.name, "ko");
      break;
  }
  return dir === "desc" ? -cmp : cmp;
}
import { CardTile } from "./card-tile";
import { CardDetail } from "./card-detail";
import { SearchBar } from "./search-bar";
import { FilterSection, IconFilterButton, ToggleButton } from "./codex-filters";
import { VersionSelector } from "./version-selector";

// Filter icon paths for non-character categories
const CATEGORY_ICONS: Record<string, string> = {
  colorless: "/images/sts2/icons/colorless_energy_icon.webp",
  event: "/images/sts2/icons/chest_icon.webp",
  curse: "/images/sts2/cards/ascenders_bane.webp",
  status: "/images/sts2/cards/burn.webp",
  ancient: "/images/sts2/cards/apparition.webp",
};

const RARITY_COLORS: Record<string, string> = {
  기본: "#8b8b8b",
  일반: "#b0b0b0",
  고급: "#4fc3f7",
  희귀: "#ffd740",
  기타: "#81c784",
};

const COST_OPTIONS = [0, 1, 2, 3, "3+", "X"] as const;

interface CardLibraryProps {
  cards: CodexCard[];
  characters: CodexCharacter[];
  versions: string[];
  currentVersion: string;
  patches: STS2Patch[];
  versionDiffs: EntityVersionDiff[];
}

export function CardLibrary({ cards, characters, versions, currentVersion, patches, versionDiffs }: CardLibraryProps) {
  const searchParams = useSearchParams();
  const [selectedVersion, setSelectedVersion] = useState(currentVersion);
  const [selectedColors, setSelectedColors] = useState<Set<CardFilterCategory>>(
    new Set()
  );
  const [selectedTypes, setSelectedTypes] = useState<Set<CardTypeKo>>(
    new Set()
  );
  const [selectedRarities, setSelectedRarities] = useState<Set<string>>(
    new Set()
  );
  const [selectedRarityDetails, setSelectedRarityDetails] = useState<Set<RarityDetail>>(
    new Set()
  );
  const [selectedCosts, setSelectedCosts] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Debounce text search (150ms)
  useEffect(() => {
    debounceRef.current = setTimeout(() => setDebouncedQuery(searchQuery), 150);
    return () => clearTimeout(debounceRef.current);
  }, [searchQuery]);
  const [showUpgrades, setShowUpgrades] = useState(false);
  const [showBeta, setShowBeta] = useState(false);
  const [showMultiplayer, setShowMultiplayer] = useState(true);

  // Sort state: ordered priority list of sort keys with directions
  const [sortKeys, setSortKeys] = useState<SortKey[]>(DEFAULT_SORT_KEYS);
  const [sortDirs, setSortDirs] = useState<Record<SortKey, SortDir>>({
    type: "asc", rarity: "asc", cost: "asc", name: "asc",
  });

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

  // Parse search query (uses debounced value)
  const parsedSearch = useMemo(() => {
    const tokens: { type: "color" | "type" | "cost"; value: string }[] = [];
    const textParts: string[] = [];

    const parts = debouncedQuery.split(/\s+/).filter(Boolean);
    for (const part of parts) {
      if (part.startsWith("@")) {
        const val = part.slice(1).toLowerCase();
        const match = COLOR_ALIASES[val];
        if (match) tokens.push({ type: "color", value: match });
        else textParts.push(part);
      } else if (part.startsWith("#")) {
        const val = part.slice(1).toLowerCase();
        const match = TYPE_ALIASES[val];
        if (match) tokens.push({ type: "type", value: match });
        else textParts.push(part);
      } else if (part.startsWith("!")) {
        tokens.push({ type: "cost", value: part.slice(1) });
      } else {
        textParts.push(part);
      }
    }

    return { text: textParts.join(" ").toLowerCase(), tokens };
  }, [debouncedQuery]);

  const fuzzyMatch = useCallback((text: string, query: string): boolean => {
    if (!query) return true;
    const lt = text.toLowerCase();
    const lq = query.toLowerCase();
    // Exact substring
    if (lt.includes(lq)) return true;
    // Korean choseong (jamo) match: ㅇㅋ matches 아이언클래드
    const isAllJamo = /^[ㄱ-ㅎ]+$/.test(query);
    if (isAllJamo) {
      const choseong = getChoseong(text);
      if (choseong.includes(query)) return true;
    }
    // Subsequence match
    let qi = 0;
    for (let i = 0; i < lt.length && qi < lq.length; i++) {
      if (lt[i] === lq[qi]) qi++;
    }
    return qi === lq.length;
  }, []);

  const matchCost = useCallback(
    (card: CodexCard, costFilter: string): boolean => {
      if (costFilter.endsWith("+")) {
        const min = parseInt(costFilter);
        return !isNaN(min) && card.cost >= min;
      }
      if (costFilter.endsWith("-")) {
        const max = parseInt(costFilter);
        return !isNaN(max) && card.cost >= 0 && card.cost <= max;
      }
      if (costFilter === "X" || costFilter === "x") return card.isXCost;
      const num = parseInt(costFilter);
      if (!isNaN(num)) return card.cost === num;
      return true;
    },
    []
  );

  const getCardCategory = useCallback((card: CodexCard): CardFilterCategory => {
    if (card.rarity === "고대의 존재") return "ancient";
    if (card.color === "event") return "event";
    return card.color as CardFilterCategory;
  }, []);

  // Reconstruct cards at the selected version (only when version differs from current)
  const versionedCards = useMemo(() => {
    if (selectedVersion === currentVersion) return cards;
    return cards.map((card) =>
      reconstructCardAtVersion(card, selectedVersion, currentVersion, versionDiffs, patches),
    );
  }, [cards, selectedVersion, currentVersion, versionDiffs, patches]);

  // Filtered & sorted cards (always sorted by name)
  const filteredCards = useMemo(() => {
    let result = versionedCards;

    // Color/category filter
    if (selectedColors.size > 0) {
      result = result.filter((c) => selectedColors.has(getCardCategory(c)));
    }

    // Search token filters
    for (const token of parsedSearch.tokens) {
      if (token.type === "color") {
        const cat = token.value as CardFilterCategory;
        result = result.filter((c) =>
          cat === "ancient" ? c.rarity === "고대의 존재" : c.color === cat
        );
      } else if (token.type === "type") {
        result = result.filter((c) => c.type === token.value);
      } else if (token.type === "cost") {
        result = result.filter((c) => matchCost(c, token.value));
      }
    }

    // Type filter
    if (selectedTypes.size > 0) {
      result = result.filter((c) => selectedTypes.has(c.type));
    }

    // Rarity filter (with detail sub-filters)
    if (selectedRarities.size > 0 || selectedRarityDetails.size > 0) {
      result = result.filter((c) => {
        // Standard rarities (일반/고급/희귀) — direct match
        if (selectedRarities.has(c.rarity)) return true;
        // "기타" bucket — check detail sub-filters if any are active
        if (selectedRarities.has("기타") || selectedRarityDetails.size > 0) {
          if (!isEtcRarity(c)) return false;
          // If detail sub-filters active, only show matching details
          if (selectedRarityDetails.size > 0) {
            const detail = annotateCard(c).rarityDetail;
            return detail !== null && selectedRarityDetails.has(detail);
          }
          // "기타" selected with no detail filters → show all etc cards
          return selectedRarities.has("기타");
        }
        return false;
      });
    }

    // Cost filter
    if (selectedCosts.size > 0) {
      result = result.filter((c) => {
        for (const cost of selectedCosts) {
          if (matchCost(c, cost)) return true;
        }
        return false;
      });
    }

    // Text search (name + description + keywords)
    if (parsedSearch.text) {
      result = result.filter(
        (c) =>
          fuzzyMatch(c.name, parsedSearch.text) ||
          fuzzyMatch(c.nameEn, parsedSearch.text) ||
          c.description.replace(/\[\/?\w+(?::?\w*)*\]/g, "").toLowerCase().includes(parsedSearch.text) ||
          c.keywords.some((kw) => kw.toLowerCase().includes(parsedSearch.text))
      );
    }

    // Multi-level sort by sortKeys priority
    return [...result].sort((a, b) => {
      for (const key of sortKeys) {
        const cmp = compareCards(a, b, key, sortDirs[key]);
        if (cmp !== 0) return cmp;
      }
      return 0;
    });
  }, [
    versionedCards,
    selectedColors,
    selectedTypes,
    selectedRarities,
    selectedRarityDetails,
    selectedCosts,
    parsedSearch,
    fuzzyMatch,
    matchCost,
    getCardCategory,
    sortKeys,
    sortDirs,
  ]);

  // Progressive rendering — render cards in batches to avoid initial jank
  const BATCH_SIZE = 42; // ~6 rows of 7
  // Build a stable key from filter inputs to reset visibleCount on change
  const filterKey = useMemo(
    () =>
      `${[...selectedColors].sort()}-${[...selectedTypes].sort()}-${[...selectedRarities].sort()}-${[...selectedRarityDetails].sort()}-${[...selectedCosts].sort()}-${parsedSearch.text}`,
    [selectedColors, selectedTypes, selectedRarities, selectedRarityDetails, selectedCosts, parsedSearch],
  );
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const filterKeyRef = useRef(filterKey);

  useEffect(() => {
    if (filterKeyRef.current !== filterKey) {
      filterKeyRef.current = filterKey;
      setVisibleCount(BATCH_SIZE); // eslint-disable-line react-hooks/set-state-in-effect -- reset batch on filter change
    }
  }, [filterKey]);

  // IntersectionObserver to load more cards on scroll
  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + BATCH_SIZE, filteredCards.length));
        }
      },
      { rootMargin: "400px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [filteredCards.length]);

  const visibleCards = filteredCards.slice(0, visibleCount);

  // Toggle helpers
  const toggleColor = useCallback((color: CardFilterCategory) => {
    setSelectedColors((prev) => {
      const next = new Set(prev);
      if (next.has(color)) next.delete(color);
      else next.add(color);
      return next;
    });
  }, []);

  const toggleType = useCallback((type: CardTypeKo) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

  const toggleRarity = useCallback((rarity: string) => {
    setSelectedRarities((prev) => {
      const next = new Set(prev);
      if (next.has(rarity)) next.delete(rarity);
      else next.add(rarity);
      // When "기타" is deselected, also clear detail sub-filters
      if (rarity === "기타" && !next.has("기타")) {
        setSelectedRarityDetails(new Set());
      }
      return next;
    });
  }, []);

  const toggleRarityDetail = useCallback((detail: RarityDetail) => {
    setSelectedRarityDetails((prev) => {
      const next = new Set(prev);
      if (next.has(detail)) next.delete(detail);
      else next.add(detail);
      return next;
    });
    // Auto-activate "기타" when a detail is selected
    setSelectedRarities((prev) => {
      if (prev.has("기타")) return prev;
      return new Set([...prev, "기타"]);
    });
  }, []);

  // Sort toggle: clicking a sort key promotes it to primary and toggles direction
  const toggleSort = useCallback((key: SortKey) => {
    setSortKeys((prev) => {
      const without = prev.filter((k) => k !== key);
      return [key, ...without];
    });
    setSortDirs((prev) => {
      // If already primary, toggle direction; otherwise set to asc
      const isPrimary = sortKeys[0] === key;
      return { ...prev, [key]: isPrimary ? (prev[key] === "asc" ? "desc" : "asc") : "asc" };
    });
  }, [sortKeys]);

  const toggleCost = useCallback((cost: string) => {
    setSelectedCosts((prev) => {
      const next = new Set(prev);
      if (next.has(cost)) next.delete(cost);
      else next.add(cost);
      return next;
    });
  }, []);

  // Character filters
  const characterFilters = characters.map((c) => ({
    key: c.id.toLowerCase() as CardFilterCategory,
    label: c.name,
    icon: c.imageUrl,
  }));

  const extraFilters = [
    { key: "colorless" as const, label: COLOR_LABELS.colorless, icon: CATEGORY_ICONS.colorless },
    { key: "event" as const, label: COLOR_LABELS.event, icon: CATEGORY_ICONS.event },
    { key: "curse" as const, label: COLOR_LABELS.curse, icon: CATEGORY_ICONS.curse },
    { key: "status" as const, label: COLOR_LABELS.status, icon: CATEGORY_ICONS.status },
    { key: "ancient" as const, label: COLOR_LABELS.ancient, icon: CATEGORY_ICONS.ancient },
  ];

  const availableTypes: CardTypeKo[] = ["공격", "스킬", "파워"];

  const rarityFilters = [
    { key: "일반", label: "일반", color: RARITY_COLORS["일반"] },
    { key: "고급", label: "고급", color: RARITY_COLORS["고급"] },
    { key: "희귀", label: "희귀", color: RARITY_COLORS["희귀"] },
    { key: "기타", label: "기타", color: RARITY_COLORS["기타"] },
  ];

  // Card detail modal
  const [selectedCard, setSelectedCard] = useState<CodexCard | null>(null);

  // Update URL hash when modal opens/closes (for shareable links)
  useEffect(() => {
    if (selectedCard) {
      window.history.pushState(null, "", `/codex/cards/${selectedCard.id.toLowerCase()}`);
    } else {
      // Restore URL only if currently on a card detail path
      if (window.location.pathname.startsWith("/codex/cards/") && window.location.pathname !== "/codex/cards") {
        window.history.pushState(null, "", "/codex/cards");
      }
    }
  }, [selectedCard]);

  // Handle browser back button
  useEffect(() => {
    const handler = () => {
      if (selectedCard) setSelectedCard(null);
    };
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, [selectedCard]);

  // Close modal on Escape
  useEffect(() => {
    if (!selectedCard) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedCard(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedCard]);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  // Auto-collapse on mobile, expand on desktop
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
        {/* Character Filters */}
        <FilterSection trigger="@" label="캐릭터">
          <div className="flex flex-wrap gap-1.5">
            {characterFilters.map((cf) => (
              <IconFilterButton
                key={cf.key}
                icon={cf.icon}
                label={cf.label}
                active={selectedColors.has(cf.key)}
                onClick={() => toggleColor(cf.key)}
              />
            ))}
          </div>
        </FilterSection>

        <FilterSection trigger="@" label="기타">
          <div className="flex flex-wrap gap-1.5">
            {extraFilters.map((ef) => (
              <IconFilterButton
                key={ef.key}
                icon={ef.icon}
                label={ef.label}
                active={selectedColors.has(ef.key)}
                onClick={() => toggleColor(ef.key)}
              />
            ))}
          </div>
        </FilterSection>

        <div className="border-t border-white/10" />

        {/* Card Type (icon buttons) */}
        <FilterSection trigger="#" label="카드 유형">
          <div className="flex gap-1.5">
            {availableTypes.map((type) => (
              <button
                key={type}
                onClick={() => toggleType(type)}
                className={`group relative w-9 h-9 rounded-lg border-2 flex items-center justify-center transition-all ${
                  selectedTypes.has(type)
                    ? "border-yellow-500 bg-yellow-500/20"
                    : "border-white/10 hover:border-white/30 bg-white/5"
                }`}
              >
                <TypeFilterIcon type={type} active={selectedTypes.has(type)} />
                <span className="pointer-events-none absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-black/90 px-2 py-0.5 text-[10px] text-gray-200 opacity-0 group-hover:opacity-100 transition-opacity z-50">
                  {type}
                </span>
              </button>
            ))}
          </div>
        </FilterSection>

        {/* Rarity */}
        <FilterSection label="희귀도">
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
            {/* Rarity detail sub-filters (visible when 기타 is active) */}
            {selectedRarities.has("기타") && (
              <div className="ml-4 mt-0.5 flex flex-col gap-0.5 border-l border-white/10 pl-2">
                {RARITY_DETAIL_ORDER.map((detail) => (
                  <button
                    key={detail}
                    onClick={() => toggleRarityDetail(detail)}
                    className={`flex items-center gap-2 text-left text-xs px-2 py-0.5 rounded transition-all ${
                      selectedRarityDetails.has(detail)
                        ? "bg-yellow-500/20 text-yellow-400"
                        : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
                    }`}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: RARITY_DETAIL_COLORS[detail] }}
                    />
                    {RARITY_DETAIL_LABELS[detail]}
                  </button>
                ))}
              </div>
            )}
          </div>
        </FilterSection>

        {/* Cost */}
        <FilterSection trigger="!" label="비용">
          <div className="flex flex-wrap gap-1">
            {COST_OPTIONS.map((cost) => {
              const key = String(cost);
              return (
                <button
                  key={key}
                  onClick={() => toggleCost(key)}
                  className={`w-8 h-7 rounded text-xs font-bold transition-all ${
                    selectedCosts.has(key)
                      ? "bg-yellow-500/30 text-yellow-400 border border-yellow-500"
                      : "bg-white/5 text-gray-400 border border-white/10 hover:border-white/30"
                  }`}
                >
                  {cost}
                </button>
              );
            })}
          </div>
        </FilterSection>

        {/* Sort */}
        <FilterSection label="정렬">
          <div className="flex flex-col gap-0.5">
            {(["type", "rarity", "cost", "name"] as SortKey[]).map((key) => {
              const isPrimary = sortKeys[0] === key;
              const idx = sortKeys.indexOf(key);
              const dir = sortDirs[key];
              return (
                <button
                  key={key}
                  onClick={() => toggleSort(key)}
                  className={`flex items-center justify-between text-left text-sm px-2.5 py-1 rounded transition-all ${
                    isPrimary
                      ? "bg-yellow-500/20 text-yellow-400"
                      : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <span className="text-[10px] text-gray-500 w-3 text-center tabular-nums">{idx + 1}</span>
                    {SORT_LABELS[key]}
                  </span>
                  <span className="text-xs opacity-60">{dir === "asc" ? "▲" : "▼"}</span>
                </button>
              );
            })}
          </div>
        </FilterSection>

        <div className="border-t border-white/10" />

        {/* Toggles */}
        <div className="flex flex-col gap-1">
          <ToggleButton
            label="멀티플레이 카드"
            active={showMultiplayer}
            onClick={() => setShowMultiplayer((v) => !v)}
          />
          <ToggleButton
            label="강화 보기"
            active={showUpgrades}
            onClick={() => setShowUpgrades((v) => !v)}
          />
          <ToggleButton
            label="베타 아트"
            active={showBeta}
            onClick={() => setShowBeta((v) => !v)}
          />
        </div>
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
          <h1 className="text-base font-bold text-yellow-500 shrink-0">카드 도서관</h1>
          <div className="flex-1 max-w-xl mx-auto">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              inputId="codex-search"
            />
          </div>
          <span className="text-sm text-gray-500 shrink-0 tabular-nums">
            {filteredCards.length}장
          </span>
          {/* Version selector */}
          <VersionSelector
            versions={versions}
            currentVersion={currentVersion}
            selectedVersion={selectedVersion}
            onChange={setSelectedVersion}
          />
        </div>

        {/* Card Grid */}
        <div className="flex-1 overflow-y-auto p-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-2 sm:gap-3">
            {visibleCards.map((card, i) => (
              <div
                key={card.id}
                className="animate-card-enter"
                style={{ animationDelay: `${Math.min(i * 12, 250)}ms` }}
              >
                <CardTile
                  card={card}
                  showUpgrade={showUpgrades}
                  showBeta={showBeta}
                  onClick={() => setSelectedCard(card)}
                />
              </div>
            ))}
          </div>
          {/* Sentinel for infinite scroll */}
          {visibleCount < filteredCards.length && (
            <div ref={loadMoreRef} className="h-8" />
          )}
          {filteredCards.length === 0 && (
            <div className="flex items-center justify-center h-64 text-gray-500">
              검색 결과가 없습니다
            </div>
          )}
        </div>
      </main>

      {/* Card Detail Modal */}
      {selectedCard && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedCard(null);
          }}
        >
          <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-[#1a1a2e] border border-white/10 rounded-2xl shadow-2xl">
            <CardDetail card={selectedCard} onClose={() => setSelectedCard(null)} />
          </div>
        </div>
      )}
    </div>
  );
}


function TypeFilterIcon({ type, active }: { type: string; active: boolean }) {
  const color = active ? "#fbbf24" : "#9ca3af";
  if (type === "공격") {
    // Sword icon
    return (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill={color}>
        <path d="M14.1 4L12 2l-2.1 2L8.5 5.4l3.5 3.5 3.5-3.5L14.1 4zM4 8.5l1.4 1.4L8.9 13l-3.5 3.5L4 18.1 5.9 20l1.6-1.4L11 15.1l3.5 3.5 1.6 1.4L18.1 18l-1.4-1.5L13.1 13l3.5-3.5L18 8.1 16.1 6.5l-1.6 1.4L11 11.5 7.5 8 5.9 6.5 4 8.5z" />
      </svg>
    );
  }
  if (type === "스킬") {
    // Shield icon
    return (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill={color}>
        <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
      </svg>
    );
  }
  // 파워 - Star icon
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill={color}>
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

