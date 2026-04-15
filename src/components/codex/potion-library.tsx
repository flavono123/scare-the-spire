"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { DescriptionText } from "./codex-description";
import { PotionDetail } from "./potion-detail";
import { getChoseong } from "es-hangul";
import {
  CodexPotion,
  CodexCharacter,
  PotionRarityKo,
  PotionPool,
  POTION_RARITY_CONFIG,
  POOL_ALIASES,
  POTION_RARITY_ALIASES,
  getCharacterColor,
  characterOutlineFilter,
} from "@/lib/codex-types";
import type { STS2Patch, EntityVersionDiff } from "@/lib/types";
import { reconstructPotionAtVersion } from "@/lib/entity-versioning";
import { VersionSelector } from "./version-selector";

// Potion pool labels (extends relic pool labels with "event")
const POTION_POOL_LABELS: Record<PotionPool, string> = {
  shared: "공용",
  ironclad: "아이언클래드",
  silent: "사일런트",
  defect: "디펙트",
  necrobinder: "네크로바인더",
  regent: "리젠트",
  event: "이벤트",
};

// Rarity sections to display (merge 이벤트 + 토큰 into 특별)
const DISPLAY_SECTIONS: {
  key: string;
  label: string;
  color: string;
  description: string;
  rarities: PotionRarityKo[];
}[] = [
  {
    key: "common",
    label: "일반",
    color: "#b0b0b0",
    description: "첨탑에서 가장 자주 발견되는 포션들입니다.",
    rarities: ["일반"],
  },
  {
    key: "uncommon",
    label: "고급",
    color: "#4fc3f7",
    description: "일반 포션보다 드물게 나타나는 강력한 포션들입니다.",
    rarities: ["고급"],
  },
  {
    key: "rare",
    label: "희귀",
    color: "#ffd740",
    description: "아주 드물게 만나볼 수 있는 희귀하고 강력한 포션들입니다.",
    rarities: ["희귀"],
  },
  {
    key: "special",
    label: "특별",
    color: "#81c784",
    description:
      "이벤트에서 얻거나 다른 수단을 통해 생성할 수 있는 포션들입니다.",
    rarities: ["이벤트", "토큰"],
  },
];

// Character pools (excluding shared/event)
const CHARACTER_POOLS: PotionPool[] = [
  "ironclad",
  "silent",
  "defect",
  "necrobinder",
  "regent",
];

interface PotionLibraryProps {
  potions: CodexPotion[];
  characters: CodexCharacter[];
  versions?: string[];
  currentVersion?: string;
  patches?: STS2Patch[];
  versionDiffs?: EntityVersionDiff[];
}

export function PotionLibrary({ potions, characters, versions, currentVersion, patches, versionDiffs }: PotionLibraryProps) {
  const searchParams = useSearchParams();
  const [selectedPools, setSelectedPools] = useState<Set<PotionPool>>(
    new Set()
  );
  const [selectedRarities, setSelectedRarities] = useState<Set<string>>(
    new Set()
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedVersion, setSelectedVersion] = useState(currentVersion ?? "");

  // Potion detail modal — initialize from ?potion= query param
  const initialPotionId = searchParams.get("potion");
  const [selectedPotion, setSelectedPotion] = useState<CodexPotion | null>(() => {
    if (!initialPotionId) return null;
    return potions.find((p) => p.id.toLowerCase() === initialPotionId.toLowerCase()) ?? null;
  });

  // Update URL query param when modal opens/closes
  useEffect(() => {
    const url = new URL(window.location.href);
    if (selectedPotion) {
      url.searchParams.set("potion", selectedPotion.id.toLowerCase());
    } else {
      url.searchParams.delete("potion");
    }
    if (url.toString() !== window.location.href) {
      window.history.pushState(null, "", url.toString());
    }
  }, [selectedPotion]);

  // Handle browser back button
  useEffect(() => {
    const handler = () => {
      const url = new URL(window.location.href);
      const potionParam = url.searchParams.get("potion");
      if (!potionParam) {
        setSelectedPotion(null);
      } else {
        const potion = potions.find((p) => p.id.toLowerCase() === potionParam.toLowerCase());
        setSelectedPotion(potion ?? null);
      }
    };
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, [potions]);

  // Close modal on Escape
  useEffect(() => {
    if (!selectedPotion) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedPotion(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedPotion]);

  const versionedPotions = useMemo(() => {
    if (!currentVersion || !versionDiffs || !patches || selectedVersion === currentVersion) return potions;
    return potions.map((potion) =>
      reconstructPotionAtVersion(potion, selectedVersion, currentVersion, versionDiffs, patches),
    );
  }, [potions, selectedVersion, currentVersion, versionDiffs, patches]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [hoveredPotion, setHoveredPotion] = useState<CodexPotion | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Cmd+K to focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        document.getElementById("potion-search")?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Auto-collapse on mobile
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

  // Parse search query for @ (pool) and # (rarity) tokens
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
        const match = POTION_RARITY_ALIASES[val];
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

  // Filter potions
  const filteredPotions = useMemo(() => {
    let result = versionedPotions;

    // Pool filter (sidebar)
    if (selectedPools.size > 0) {
      result = result.filter(
        (p) => selectedPools.has(p.pool) || (selectedPools.has("shared" as PotionPool) && p.pool === "shared")
      );
    }

    // Rarity filter (sidebar)
    if (selectedRarities.size > 0) {
      result = result.filter((p) => {
        if (selectedRarities.has("특별")) {
          return (
            selectedRarities.has(
              POTION_RARITY_CONFIG[p.rarity].label
            ) ||
            p.rarity === "이벤트" ||
            p.rarity === "토큰"
          );
        }
        return selectedRarities.has(POTION_RARITY_CONFIG[p.rarity].label);
      });
    }

    // Search token filters
    for (const token of parsedSearch.tokens) {
      if (token.type === "pool") {
        result = result.filter((p) => p.pool === token.value);
      } else if (token.type === "rarity") {
        result = result.filter((p) => p.rarity === token.value);
      }
    }

    // Text search
    if (parsedSearch.text) {
      result = result.filter(
        (p) =>
          fuzzyMatch(p.name, parsedSearch.text) ||
          fuzzyMatch(p.nameEn, parsedSearch.text) ||
          p.description
            .replace(/\[\/?\w+(?::?\w*)*\]/g, "")
            .toLowerCase()
            .includes(parsedSearch.text)
      );
    }

    return result;
  }, [versionedPotions, selectedPools, selectedRarities, parsedSearch, fuzzyMatch]);

  // Group by rarity sections
  const sections = useMemo(() => {
    return DISPLAY_SECTIONS.map((section) => ({
      ...section,
      potions: filteredPotions
        .filter((p) => section.rarities.includes(p.rarity))
        .sort((a, b) => a.name.localeCompare(b.name, "ko")),
    })).filter((s) => s.potions.length > 0);
  }, [filteredPotions]);

  // Toggle helpers
  const togglePool = useCallback((pool: PotionPool) => {
    setSelectedPools((prev) => {
      const next = new Set(prev);
      if (next.has(pool)) next.delete(pool);
      else next.add(pool);
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

  // Hover tooltip positioning — dynamic left/right based on viewport half
  const handlePotionHover = useCallback(
    (potion: CodexPotion | null, e?: React.MouseEvent) => {
      setHoveredPotion(potion);
      if (potion && e) {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const tooltipW = 288; // w-72
        const tileCenterX = rect.left + rect.width / 2;
        const isRightHalf = tileCenterX > window.innerWidth / 2;
        const x = isRightHalf
          ? rect.left - tooltipW - 12
          : rect.right + 12;
        setTooltipPos({ x, y: rect.top });
      } else {
        setTooltipPos(null);
      }
    },
    []
  );

  // Character filters from props
  const characterFilters = characters
    .filter((c) =>
      CHARACTER_POOLS.includes(c.id.toLowerCase() as PotionPool)
    )
    .map((c) => ({
      key: c.id.toLowerCase() as PotionPool,
      label: c.name,
      icon: c.imageUrl,
    }));

  const rarityFilters = DISPLAY_SECTIONS.map((s) => ({
    key: s.label,
    label: s.label,
    color: s.color,
  }));

  return (
    <div className="flex h-[calc(100dvh-3rem)] bg-[#1a1a2e] text-gray-200 overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && isMobile && (
        <div
          className="fixed inset-0 z-40 bg-black/50"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Left Sidebar */}
      <aside
        className={`
        border-r border-white/10 bg-[#16162a] flex flex-col gap-2 overflow-y-auto transition-all duration-200 shrink-0
        ${
          isMobile
            ? `fixed z-50 inset-y-0 left-0 w-52 ${sidebarOpen ? "translate-x-0 p-3" : "-translate-x-full p-3"}`
            : `relative ${sidebarOpen ? "w-52 p-3" : "w-0 p-0 overflow-hidden border-r-0"}`
        }
      `}
      >
        {/* Character/Pool Filters */}
        <FilterSection trigger="@" label="캐릭터">
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

        <FilterSection trigger="@" label="기타">
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => togglePool("shared")}
              className={`group relative px-2.5 py-1 rounded-lg border-2 text-xs font-medium transition-all ${
                selectedPools.has("shared")
                  ? "border-yellow-500 bg-yellow-500/20 text-yellow-400"
                  : "border-white/10 hover:border-white/30 bg-white/5 text-gray-400"
              }`}
            >
              공용
            </button>
            <button
              onClick={() => togglePool("event")}
              className={`group relative px-2.5 py-1 rounded-lg border-2 text-xs font-medium transition-all ${
                selectedPools.has("event")
                  ? "border-yellow-500 bg-yellow-500/20 text-yellow-400"
                  : "border-white/10 hover:border-white/30 bg-white/5 text-gray-400"
              }`}
            >
              이벤트
            </button>
          </div>
        </FilterSection>

        <div className="border-t border-white/10" />

        {/* Rarity */}
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
        {/* Top Bar */}
        <div className="flex items-center gap-2 sm:gap-4 px-3 sm:px-4 py-2 border-b border-white/10 bg-[#16162a]/80">
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg border border-white/10 hover:bg-white/10 text-gray-400"
            aria-label={sidebarOpen ? "필터 닫기" : "필터 열기"}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {sidebarOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                />
              )}
            </svg>
          </button>
          <h1 className="text-base font-bold text-yellow-500 shrink-0">
            포션 도감
          </h1>
          <div className="flex-1 max-w-xl mx-auto">
            <PotionSearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              inputId="potion-search"
            />
          </div>
          <span className="text-sm text-gray-500 shrink-0 tabular-nums">
            {filteredPotions.length}개
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

        {/* Potion Grid by Rarity */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {sections.map((section) => (
            <div key={section.key} className="mb-8 last:mb-0">
              {/* Section header */}
              <div className="mb-3">
                <span
                  className="text-lg font-bold font-[family-name:var(--font-spectral)]"
                  style={{ color: section.color }}
                >
                  {section.label}:
                </span>
                <span className="ml-2 text-sm text-gray-400">
                  {section.description}
                </span>
              </div>

              {/* Potion icon grid */}
              <div className="flex flex-wrap gap-2 sm:gap-3">
                {section.potions.map((potion) => (
                  <PotionTile
                    key={potion.id}
                    potion={potion}
                    onHover={handlePotionHover}
                    onClick={() => setSelectedPotion(potion)}
                  />
                ))}
              </div>
            </div>
          ))}

          {sections.length === 0 && (
            <div className="flex items-center justify-center h-64 text-gray-500">
              검색 결과가 없습니다
            </div>
          )}
        </div>
      </main>

      {/* Hover Tooltip */}
      {hoveredPotion && tooltipPos && (
        <PotionTooltip
          ref={tooltipRef}
          potion={hoveredPotion}
          x={tooltipPos.x}
          y={tooltipPos.y}
        />
      )}

      {/* Potion Detail Modal */}
      {selectedPotion && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedPotion(null);
          }}
        >
          <div className="w-full max-w-lg my-8 mx-4 bg-[#1a1a2e] rounded-xl border border-white/10 shadow-2xl">
            <PotionDetail potion={selectedPotion} onClose={() => setSelectedPotion(null)} />
          </div>
        </div>
      )}
    </div>
  );
}

// Individual potion icon tile
function PotionTile({
  potion,
  onHover,
  onClick,
}: {
  potion: CodexPotion;
  onHover: (potion: CodexPotion | null, e?: React.MouseEvent) => void;
  onClick?: () => void;
}) {
  return (
    <button
      data-potion-tile={potion.id}
      className="group relative w-14 h-14 sm:w-16 sm:h-16 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/10 hover:border-yellow-500/40 transition-all flex items-center justify-center"
      onMouseEnter={(e) => onHover(potion, e)}
      onMouseLeave={() => onHover(null)}
      onClick={onClick}
    >
      <Image
        src={potion.imageUrl}
        alt={potion.name}
        width={48}
        height={48}
        className="w-10 h-10 sm:w-12 sm:h-12 object-contain"
        style={{
          filter: characterOutlineFilter(potion.pool) ?? "drop-shadow(0 2px 4px rgba(0,0,0,0.5))",
        }}
      />
    </button>
  );
}

// Hover tooltip for potion details
import { forwardRef } from "react";

const PotionTooltip = forwardRef<
  HTMLDivElement,
  { potion: CodexPotion; x: number; y: number }
>(function PotionTooltip({ potion, x, y }, ref) {
  const rarityConfig = POTION_RARITY_CONFIG[potion.rarity];

  // Clamp to viewport bounds (position already computed by handler)
  const style: React.CSSProperties = {
    position: "fixed",
    left: Math.max(0, Math.min(x, window.innerWidth - 288)),
    top: Math.min(y, window.innerHeight - 200),
    zIndex: 100,
    pointerEvents: "none",
  };

  return (
    <div
      ref={ref}
      className="w-72 bg-[#1a1a3a] border border-white/20 rounded-lg shadow-2xl overflow-hidden"
      style={style}
    >
      <div className="p-3">
        {/* Header with name and rarity */}
        <div className="flex items-center gap-2 mb-1">
          <Image
            src={potion.imageUrl}
            alt={potion.name}
            width={32}
            height={32}
            className="w-8 h-8 object-contain"
          />
          <div>
            <div className="font-bold text-sm text-gray-100">{potion.name}</div>
            <div className="text-[10px] text-gray-500">{potion.nameEn}</div>
          </div>
        </div>

        {/* Rarity + pool badge */}
        <div className="flex items-center gap-1.5 mb-2">
          <span
            className="text-[10px] font-medium px-1.5 py-0.5 rounded"
            style={{
              backgroundColor: `${rarityConfig.color}20`,
              color: rarityConfig.color,
            }}
          >
            {rarityConfig.label}
          </span>
          {potion.pool !== "shared" && (
            <span
              className="text-[10px] font-medium"
              style={{
                color:
                  potion.pool !== "event"
                    ? getPoolColor(potion.pool)
                    : undefined,
              }}
            >
              {POTION_POOL_LABELS[potion.pool]}
            </span>
          )}
        </div>

        {/* Description */}
        <div className="text-sm text-gray-300 leading-relaxed">
          <DescriptionText description={potion.description} />
        </div>
      </div>
    </div>
  );
});

// Pool color mapping (delegates to shared CHARACTER_COLORS)
function getPoolColor(pool: PotionPool): string {
  return getCharacterColor(pool) ?? "#888";
}

// Potion-specific search bar (simpler than card search)
function PotionSearchBar({
  value,
  onChange,
  inputId,
}: {
  value: string;
  onChange: (value: string) => void;
  inputId?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  const HINTS = [
    { trigger: "@", label: "캐릭터", examples: ["아이언클래드", "디펙트", "공용"] },
    { trigger: "#", label: "희귀도", examples: ["일반", "고급", "희귀", "특별"] },
  ];

  return (
    <div className="relative">
      <div className="relative">
        <svg
          className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              onChange("");
              inputRef.current?.blur();
            }
          }}
          placeholder="포션 검색..."
          className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-16 py-1.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-yellow-500/50 focus:ring-1 focus:ring-yellow-500/30 transition-all"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {value && (
            <button
              onClick={() => onChange("")}
              className="text-gray-500 hover:text-gray-300 transition-colors p-0.5"
            >
              <svg
                className="w-3.5 h-3.5"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M18.3 5.71a1 1 0 00-1.42 0L12 10.59 7.12 5.7A1 1 0 005.7 7.12L10.59 12 5.7 16.88a1 1 0 101.42 1.42L12 13.41l4.88 4.89a1 1 0 001.42-1.42L13.41 12l4.89-4.88a1 1 0 000-1.41z" />
              </svg>
            </button>
          )}
          <kbd className="hidden sm:inline text-[9px] text-gray-600 bg-white/5 border border-white/10 rounded px-1 py-0.5 font-mono">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Trigger hints on focus */}
      {isFocused && !value && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-[#1e1e3a] border border-white/10 rounded-lg shadow-xl z-50 overflow-hidden p-2.5 flex flex-col gap-2">
          {HINTS.map(({ trigger, label, examples }) => (
            <div key={trigger} className="flex items-center gap-2 flex-wrap">
              <button
                onMouseDown={() => {
                  onChange(trigger);
                  inputRef.current?.focus();
                }}
                className="shrink-0 text-[11px] font-mono font-bold text-yellow-500 bg-yellow-500/10 hover:bg-yellow-500/20 rounded px-1.5 py-0.5 transition-colors"
              >
                {trigger}
              </button>
              <span className="shrink-0 text-[11px] text-gray-500 w-10">
                {label}
              </span>
              {examples.map((ex) => (
                <button
                  key={ex}
                  onMouseDown={() => {
                    onChange(`${trigger}${ex} `);
                    inputRef.current?.focus();
                  }}
                  className="text-[11px] text-gray-400 hover:text-gray-200 bg-white/5 hover:bg-white/10 rounded px-1.5 py-0.5 transition-colors"
                >
                  {ex}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Token chips */}
      {value &&
        value
          .split(/\s+/)
          .some((t) => t.startsWith("@") || t.startsWith("#")) && (
          <div className="flex flex-wrap gap-1 mt-1">
            {value
              .split(/\s+/)
              .filter(Boolean)
              .map((token, i) => {
                if (token.startsWith("@")) {
                  const val = token.slice(1).toLowerCase();
                  const match = POOL_ALIASES[val];
                  return (
                    <span
                      key={i}
                      className={`inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                        match
                          ? "bg-blue-500/20 text-blue-400"
                          : "bg-red-500/15 text-red-400/70"
                      }`}
                    >
                      @{token.slice(1)}
                    </span>
                  );
                }
                if (token.startsWith("#")) {
                  const val = token.slice(1).toLowerCase();
                  const match = POTION_RARITY_ALIASES[val];
                  return (
                    <span
                      key={i}
                      className={`inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                        match
                          ? "bg-green-500/20 text-green-400"
                          : "bg-red-500/15 text-red-400/70"
                      }`}
                    >
                      #{token.slice(1)}
                    </span>
                  );
                }
                return null;
              })}
          </div>
        )}
    </div>
  );
}

// Shared sub-components
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
