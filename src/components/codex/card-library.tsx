"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
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
import { CardTile } from "./card-tile";
import { SearchBar } from "./search-bar";

// Filter icon paths for non-character categories
const CATEGORY_ICONS: Record<string, string> = {
  colorless: "/images/spire-codex/icons/colorless_energy_icon.png",
  event: "/images/spire-codex/icons/chest_icon.png",
  curse: "/images/spire-codex/cards/ascenders_bane.png",
  status: "/images/spire-codex/cards/burn.png",
  ancient: "/images/spire-codex/cards/apparition.png",
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
}

export function CardLibrary({ cards, characters }: CardLibraryProps) {
  const [selectedColors, setSelectedColors] = useState<Set<CardFilterCategory>>(
    new Set()
  );
  const [selectedTypes, setSelectedTypes] = useState<Set<CardTypeKo>>(
    new Set()
  );
  const [selectedRarities, setSelectedRarities] = useState<Set<string>>(
    new Set()
  );
  const [selectedCosts, setSelectedCosts] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [showUpgrades, setShowUpgrades] = useState(false);
  const [showBeta, setShowBeta] = useState(false);
  const [showMultiplayer, setShowMultiplayer] = useState(true);

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
    const tokens: { type: "color" | "type" | "cost"; value: string }[] = [];
    const textParts: string[] = [];

    const parts = searchQuery.split(/\s+/).filter(Boolean);
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
  }, [searchQuery]);

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

  // Filtered & sorted cards (always sorted by name)
  const filteredCards = useMemo(() => {
    let result = cards;

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

    // Rarity filter
    if (selectedRarities.size > 0) {
      result = result.filter((c) => {
        if (selectedRarities.has("기타")) {
          return selectedRarities.has(c.rarity) ||
            !["기본", "일반", "고급", "희귀"].includes(c.rarity);
        }
        return selectedRarities.has(c.rarity);
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

    // Text search (name + description)
    if (parsedSearch.text) {
      result = result.filter(
        (c) =>
          fuzzyMatch(c.name, parsedSearch.text) ||
          fuzzyMatch(c.nameEn, parsedSearch.text) ||
          c.description.replace(/\[\/?\w+(?::?\w*)*\]/g, "").toLowerCase().includes(parsedSearch.text)
      );
    }

    // Always sort by Korean name
    return [...result].sort((a, b) => a.name.localeCompare(b.name, "ko"));
  }, [
    cards,
    selectedColors,
    selectedTypes,
    selectedRarities,
    selectedCosts,
    parsedSearch,
    fuzzyMatch,
    matchCost,
    getCardCategory,
  ]);

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
      return next;
    });
  }, []);

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

  return (
    <div className="flex h-screen bg-[#1a1a2e] text-gray-200 overflow-hidden">
      {/* Left Sidebar */}
      <aside className="w-52 shrink-0 border-r border-white/10 bg-[#16162a] flex flex-col gap-2 p-3 overflow-y-auto">
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
        <div className="flex items-center gap-4 px-4 py-2 border-b border-white/10 bg-[#16162a]/80">
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
        </div>

        {/* Card Grid */}
        <div className="flex-1 overflow-y-auto p-3">
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-2">
            {filteredCards.map((card) => (
              <CardTile
                key={card.id}
                card={card}
                showUpgrade={showUpgrades}
                showBeta={showBeta}
              />
            ))}
          </div>
          {filteredCards.length === 0 && (
            <div className="flex items-center justify-center h-64 text-gray-500">
              검색 결과가 없습니다
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function FilterSection({
  trigger,
  label,
  children,
}: {
  trigger?: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        {trigger && (
          <span className="text-[10px] font-mono font-bold text-yellow-500/70 bg-yellow-500/10 rounded px-1 py-0.5 leading-none">
            {trigger}
          </span>
        )}
        <span className="text-[11px] text-gray-500 font-medium uppercase tracking-wider">
          {label}
        </span>
      </div>
      {children}
    </div>
  );
}

function IconFilterButton({
  icon,
  label,
  active,
  onClick,
}: {
  icon: string;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`group relative w-9 h-9 rounded-lg border-2 transition-all ${
        active
          ? "border-yellow-500 bg-yellow-500/20"
          : "border-white/10 hover:border-white/30 bg-white/5"
      }`}
      title={label}
    >
      <Image
        src={icon}
        alt={label}
        width={28}
        height={28}
        className={`w-full h-full object-contain p-0.5 ${
          active ? "" : "opacity-50 group-hover:opacity-100"
        }`}
      />
      <span className="pointer-events-none absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-black/90 px-2 py-0.5 text-[10px] text-gray-200 opacity-0 group-hover:opacity-100 transition-opacity z-50">
        {label}
      </span>
    </button>
  );
}

function TypeFilterIcon({ type, active }: { type: string; active: boolean }) {
  const color = active ? "#fbbf24" : "#9ca3af";
  if (type === "공격") {
    return (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill={color}>
        <path d="M6.92 5L5 6.92l4.06 4.06L5 15.03l1.94 1.94 4.06-4.06 4.03 4.03L17 15l-4.03-4.03L17 6.94 15.06 5l-4.03 4.03L6.92 5z" />
      </svg>
    );
  }
  if (type === "스킬") {
    return (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill={color}>
        <path d="M12 2C9.2 2 7 4.2 7 7c0 1.8 1.1 3.4 2.6 4.2L8 22h8l-1.6-10.8C15.9 10.4 17 8.8 17 7c0-2.8-2.2-5-5-5z" />
      </svg>
    );
  }
  // 파워
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill={color}>
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

function ToggleButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 text-xs px-2.5 py-1 rounded transition-all ${
        active
          ? "bg-yellow-500/15 text-yellow-400"
          : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
      }`}
    >
      <span
        className={`w-3.5 h-3.5 rounded border-[1.5px] flex items-center justify-center transition-all ${
          active ? "border-yellow-500 bg-yellow-500" : "border-gray-600"
        }`}
      >
        {active && (
          <svg className="w-2.5 h-2.5 text-black" viewBox="0 0 16 16" fill="currentColor">
            <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" />
          </svg>
        )}
      </span>
      {label}
    </button>
  );
}
