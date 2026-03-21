"use client";

import { useState, useMemo, useCallback } from "react";
import Image from "next/image";
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

// Character card color -> character id mapping
const COLOR_TO_CHAR_ID: Record<string, string> = {
  ironclad: "IRONCLAD",
  silent: "SILENT",
  defect: "DEFECT",
  necrobinder: "NECROBINDER",
  regent: "REGENT",
};

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
  고대의_존재: "#e040fb",
  이벤트: "#81c784",
  토큰: "#a1887f",
  저주: "#e57373",
  상태이상: "#ff8a65",
  퀘스트: "#ce93d8",
};

const COST_OPTIONS = [0, 1, 2, 3, 4, 5, "6+", "X"] as const;

interface CardLibraryProps {
  cards: CodexCard[];
  characters: CodexCharacter[];
}

export function CardLibrary({ cards, characters }: CardLibraryProps) {
  // Filter state
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
  const [sortAZ, setSortAZ] = useState(false);

  // Parse search query into text + token filters
  const parsedSearch = useMemo(() => {
    const tokens: { type: "color" | "type" | "cost"; value: string }[] = [];
    let textParts: string[] = [];

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

  // Fuzzy substring match
  const fuzzyMatch = useCallback((text: string, query: string): boolean => {
    if (!query) return true;
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();

    // Exact substring
    if (lowerText.includes(lowerQuery)) return true;

    // Subsequence match
    let qi = 0;
    for (let i = 0; i < lowerText.length && qi < lowerQuery.length; i++) {
      if (lowerText[i] === lowerQuery[qi]) qi++;
    }
    return qi === lowerQuery.length;
  }, []);

  // Cost matching helper
  const matchCost = useCallback(
    (card: CodexCard, costFilter: string): boolean => {
      if (costFilter.endsWith("+")) {
        const min = parseInt(costFilter);
        return !isNaN(min) && card.cost >= min;
      }
      if (costFilter === "X" || costFilter === "x") return card.isXCost;
      const num = parseInt(costFilter);
      if (!isNaN(num)) return card.cost === num;
      return true;
    },
    []
  );

  // Determine card's filter category (for ancient vs event distinction)
  const getCardCategory = useCallback((card: CodexCard): CardFilterCategory => {
    if (card.rarity === "고대의 존재") return "ancient";
    if (card.color === "event") return "event";
    return card.color as CardFilterCategory;
  }, []);

  // Filtered cards
  const filteredCards = useMemo(() => {
    let result = cards;

    // Color/category filter (multiselect, empty = all)
    if (selectedColors.size > 0) {
      result = result.filter((card) => {
        const category = getCardCategory(card);
        return selectedColors.has(category);
      });
    }

    // Search token filters (additive to sidebar filters)
    for (const token of parsedSearch.tokens) {
      if (token.type === "color") {
        const cat = token.value as CardFilterCategory;
        result = result.filter((card) => {
          if (cat === "ancient") return card.rarity === "고대의 존재";
          return card.color === cat;
        });
      } else if (token.type === "type") {
        result = result.filter((card) => card.type === token.value);
      } else if (token.type === "cost") {
        result = result.filter((card) => matchCost(card, token.value));
      }
    }

    // Type filter
    if (selectedTypes.size > 0) {
      result = result.filter((card) => selectedTypes.has(card.type));
    }

    // Rarity filter
    if (selectedRarities.size > 0) {
      result = result.filter((card) => selectedRarities.has(card.rarity));
    }

    // Cost filter
    if (selectedCosts.size > 0) {
      result = result.filter((card) => {
        for (const c of selectedCosts) {
          if (matchCost(card, c)) return true;
        }
        return false;
      });
    }

    // Text search (fuzzy)
    if (parsedSearch.text) {
      result = result.filter(
        (card) =>
          fuzzyMatch(card.name, parsedSearch.text) ||
          fuzzyMatch(card.nameEn, parsedSearch.text)
      );
    }

    // Sort
    if (sortAZ) {
      result = [...result].sort((a, b) => a.name.localeCompare(b.name, "ko"));
    }

    return result;
  }, [
    cards,
    selectedColors,
    selectedTypes,
    selectedRarities,
    selectedCosts,
    parsedSearch,
    sortAZ,
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

  // Character filter buttons
  const characterFilters: {
    key: CardFilterCategory;
    label: string;
    icon: string;
  }[] = characters.map((c) => ({
    key: c.id.toLowerCase() as CardFilterCategory,
    label: c.name,
    icon: c.imageUrl,
  }));

  // Extra category filters
  const extraFilters: {
    key: CardFilterCategory;
    label: string;
    icon: string;
  }[] = [
    {
      key: "colorless",
      label: COLOR_LABELS.colorless,
      icon: CATEGORY_ICONS.colorless,
    },
    { key: "event", label: COLOR_LABELS.event, icon: CATEGORY_ICONS.event },
    { key: "curse", label: COLOR_LABELS.curse, icon: CATEGORY_ICONS.curse },
    { key: "status", label: COLOR_LABELS.status, icon: CATEGORY_ICONS.status },
    {
      key: "ancient",
      label: COLOR_LABELS.ancient,
      icon: CATEGORY_ICONS.ancient,
    },
  ];

  // Available types for filter (only show types present in cards)
  const availableTypes: CardTypeKo[] = ["공격", "스킬", "파워"];

  // Playable rarities for filter
  const rarityFilters = [
    { key: "기본", label: "기본", color: RARITY_COLORS["기본"] },
    { key: "일반", label: "일반", color: RARITY_COLORS["일반"] },
    { key: "고급", label: "고급", color: RARITY_COLORS["고급"] },
    { key: "희귀", label: "희귀", color: RARITY_COLORS["희귀"] },
  ];

  return (
    <div className="flex h-screen bg-[#1a1a2e] text-gray-200 overflow-hidden">
      {/* Left Sidebar */}
      <aside className="w-56 shrink-0 border-r border-white/10 bg-[#16162a] flex flex-col gap-3 p-3 overflow-y-auto">
        {/* Search */}
        <SearchBar value={searchQuery} onChange={setSearchQuery} />

        {/* Character Filters */}
        <div className="flex flex-col gap-2">
          <span className="text-xs text-gray-500 uppercase tracking-wider">
            캐릭터
          </span>
          <div className="flex flex-wrap gap-1.5">
            {characterFilters.map((cf) => (
              <button
                key={cf.key}
                onClick={() => toggleColor(cf.key)}
                className={`group relative w-10 h-10 rounded-lg border-2 transition-all ${
                  selectedColors.has(cf.key)
                    ? "border-yellow-500 bg-yellow-500/20"
                    : "border-white/10 hover:border-white/30 bg-white/5"
                }`}
                title={cf.label}
              >
                <Image
                  src={cf.icon}
                  alt={cf.label}
                  width={32}
                  height={32}
                  className={`w-full h-full object-contain p-0.5 ${
                    selectedColors.has(cf.key) ? "" : "opacity-60 group-hover:opacity-100"
                  }`}
                />
                <Tooltip text={cf.label} />
              </button>
            ))}
          </div>
        </div>

        {/* Extra Category Filters */}
        <div className="flex flex-col gap-2">
          <span className="text-xs text-gray-500 uppercase tracking-wider">
            기타
          </span>
          <div className="flex flex-wrap gap-1.5">
            {extraFilters.map((ef) => (
              <button
                key={ef.key}
                onClick={() => toggleColor(ef.key)}
                className={`group relative w-10 h-10 rounded-lg border-2 transition-all ${
                  selectedColors.has(ef.key)
                    ? "border-yellow-500 bg-yellow-500/20"
                    : "border-white/10 hover:border-white/30 bg-white/5"
                }`}
                title={ef.label}
              >
                <Image
                  src={ef.icon}
                  alt={ef.label}
                  width={32}
                  height={32}
                  className={`w-full h-full object-contain p-0.5 ${
                    selectedColors.has(ef.key) ? "" : "opacity-60 group-hover:opacity-100"
                  }`}
                />
                <Tooltip text={ef.label} />
              </button>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-white/10" />

        {/* Card Type Filter */}
        <div className="flex flex-col gap-2">
          <span className="text-xs text-gray-500 uppercase tracking-wider">
            카드 유형
          </span>
          <div className="flex flex-col gap-1">
            {availableTypes.map((type) => (
              <button
                key={type}
                onClick={() => toggleType(type)}
                className={`text-left text-sm px-3 py-1.5 rounded-md transition-all ${
                  selectedTypes.has(type)
                    ? "bg-yellow-500/20 text-yellow-400"
                    : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Rarity Filter */}
        <div className="flex flex-col gap-2">
          <span className="text-xs text-gray-500 uppercase tracking-wider">
            희귀도
          </span>
          <div className="flex flex-col gap-1">
            {rarityFilters.map((r) => (
              <button
                key={r.key}
                onClick={() => toggleRarity(r.key)}
                className={`flex items-center gap-2 text-left text-sm px-3 py-1.5 rounded-md transition-all ${
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
        </div>

        {/* Cost Filter */}
        <div className="flex flex-col gap-2">
          <span className="text-xs text-gray-500 uppercase tracking-wider">
            비용
          </span>
          <div className="flex flex-wrap gap-1">
            {COST_OPTIONS.map((cost) => {
              const key = String(cost);
              return (
                <button
                  key={key}
                  onClick={() => toggleCost(key)}
                  className={`w-8 h-8 rounded-md text-sm font-bold transition-all ${
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
        </div>

        {/* Divider */}
        <div className="border-t border-white/10" />

        {/* Sort & Toggles */}
        <div className="flex flex-col gap-2">
          <ToggleButton
            label="가나다순"
            active={sortAZ}
            onClick={() => setSortAZ((v) => !v)}
          />
          <ToggleButton
            label="업그레이드"
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
        {/* Top Bar */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-white/10 bg-[#16162a]/80">
          <h1 className="text-lg font-bold text-yellow-500">카드 도서관</h1>
          <span className="text-sm text-gray-500">
            {filteredCards.length}장
          </span>
        </div>

        {/* Card Grid */}
        <div className="flex-1 overflow-y-auto p-4">
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

function Tooltip({ text }: { text: string }) {
  return (
    <span className="pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-black/90 px-2 py-1 text-xs text-gray-200 opacity-0 group-hover:opacity-100 transition-opacity z-50">
      {text}
    </span>
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
      className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-md transition-all ${
        active
          ? "bg-yellow-500/20 text-yellow-400"
          : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
      }`}
    >
      <span
        className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
          active ? "border-yellow-500 bg-yellow-500" : "border-gray-600"
        }`}
      >
        {active && (
          <svg
            className="w-3 h-3 text-black"
            viewBox="0 0 16 16"
            fill="currentColor"
          >
            <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" />
          </svg>
        )}
      </span>
      {label}
    </button>
  );
}
