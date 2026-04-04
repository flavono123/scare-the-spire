"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { MonsterDetail } from "./monster-detail";
import { getChoseong } from "es-hangul";
import {
  CodexMonster,
  CodexEncounter,
  MonsterType,
  MONSTER_TYPE_CONFIG,
  MONSTER_TYPE_ORDER,
  MONSTER_TYPE_ALIASES,
  EVENT_ACT_CONFIG,
  EVENT_ACT_UNKNOWN,
  EVENT_ACT_ALIASES,
  EventAct,
} from "@/lib/codex-types";

// Act display order
const ACT_ORDER: (EventAct | null)[] = [
  "Act 1 - Overgrowth",
  "Underdocks",
  "Act 2 - Hive",
  "Act 3 - Glory",
  null,
];

interface MonsterLibraryProps {
  monsters: CodexMonster[];
  encounters: CodexEncounter[];
}

export function MonsterLibrary({ monsters, encounters }: MonsterLibraryProps) {
  const searchParams = useSearchParams();
  const [selectedTypes, setSelectedTypes] = useState<Set<MonsterType>>(new Set());
  const [selectedActs, setSelectedActs] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  // Monster detail modal
  const initialMonsterId = searchParams.get("monster");
  const [selectedMonster, setSelectedMonster] = useState<CodexMonster | null>(() => {
    if (!initialMonsterId) return null;
    return monsters.find((m) => m.id.toLowerCase() === initialMonsterId.toLowerCase()) ?? null;
  });

  // URL sync
  useEffect(() => {
    const url = new URL(window.location.href);
    if (selectedMonster) {
      url.searchParams.set("monster", selectedMonster.id.toLowerCase());
    } else {
      url.searchParams.delete("monster");
    }
    if (url.toString() !== window.location.href) {
      window.history.pushState(null, "", url.toString());
    }
  }, [selectedMonster]);

  // Browser back button
  useEffect(() => {
    const handler = () => {
      const url = new URL(window.location.href);
      const param = url.searchParams.get("monster");
      if (!param) {
        setSelectedMonster(null);
      } else {
        setSelectedMonster(monsters.find((m) => m.id.toLowerCase() === param.toLowerCase()) ?? null);
      }
    };
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, [monsters]);

  // Escape to close
  useEffect(() => {
    if (!selectedMonster) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedMonster(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedMonster]);

  // Cmd+K to focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        document.getElementById("monster-search")?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
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

  // Build monster -> acts mapping from encounters
  const monsterActs = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const enc of encounters) {
      for (const m of enc.monsters) {
        if (!map.has(m.id)) map.set(m.id, new Set());
        map.get(m.id)!.add(enc.act ?? "none");
      }
    }
    return map;
  }, [encounters]);

  // Parse search
  const parsedSearch = useMemo(() => {
    const tokens: { type: "monsterType" | "act"; value: string }[] = [];
    const textParts: string[] = [];
    const parts = searchQuery.split(/\s+/).filter(Boolean);
    for (const part of parts) {
      if (part.startsWith("#")) {
        const val = part.slice(1).toLowerCase();
        const typeMatch = MONSTER_TYPE_ALIASES[val];
        if (typeMatch) {
          tokens.push({ type: "monsterType", value: typeMatch });
          continue;
        }
        const actMatch = EVENT_ACT_ALIASES[val];
        if (actMatch) {
          tokens.push({ type: "act", value: actMatch });
          continue;
        }
        textParts.push(part);
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
    if (/^[ㄱ-ㅎ]+$/.test(query)) {
      if (getChoseong(text).includes(query)) return true;
    }
    let qi = 0;
    for (let i = 0; i < lt.length && qi < lq.length; i++) {
      if (lt[i] === lq[qi]) qi++;
    }
    return qi === lq.length;
  }, []);

  // Filter monsters
  const filteredMonsters = useMemo(() => {
    let result = monsters;

    // Type filter
    if (selectedTypes.size > 0) {
      result = result.filter((m) => selectedTypes.has(m.type));
    }

    // Act filter
    if (selectedActs.size > 0) {
      result = result.filter((m) => {
        const acts = monsterActs.get(m.id);
        if (!acts) return false;
        return [...selectedActs].some((a) => acts.has(a));
      });
    }

    // Search tokens
    for (const token of parsedSearch.tokens) {
      if (token.type === "monsterType") {
        result = result.filter((m) => m.type === token.value);
      } else if (token.type === "act") {
        result = result.filter((m) => {
          const acts = monsterActs.get(m.id);
          return acts?.has(token.value === "none" ? "none" : token.value) ?? false;
        });
      }
    }

    // Text search
    if (parsedSearch.text) {
      result = result.filter(
        (m) =>
          fuzzyMatch(m.name, parsedSearch.text) ||
          fuzzyMatch(m.nameEn, parsedSearch.text),
      );
    }

    return result;
  }, [monsters, selectedTypes, selectedActs, parsedSearch, fuzzyMatch, monsterActs]);

  // Group by type
  const sections = useMemo(() => {
    return MONSTER_TYPE_ORDER.map((type) => ({
      type,
      ...MONSTER_TYPE_CONFIG[type],
      monsters: filteredMonsters
        .filter((m) => m.type === type)
        .sort((a, b) => a.name.localeCompare(b.name, "ko")),
    })).filter((s) => s.monsters.length > 0);
  }, [filteredMonsters]);

  const toggleType = useCallback((type: MonsterType) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

  const toggleAct = useCallback((act: string) => {
    setSelectedActs((prev) => {
      const next = new Set(prev);
      if (next.has(act)) next.delete(act);
      else next.add(act);
      return next;
    });
  }, []);

  // Tooltip state
  const [hoveredMonster, setHoveredMonster] = useState<CodexMonster | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  const handleMonsterHover = useCallback(
    (monster: CodexMonster | null, e?: React.MouseEvent) => {
      setHoveredMonster(monster);
      if (monster && e) {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const tooltipW = 320;
        const tileCenterX = rect.left + rect.width / 2;
        const isRightHalf = tileCenterX > window.innerWidth / 2;
        const x = isRightHalf ? rect.left - tooltipW - 12 : rect.right + 12;
        setTooltipPos({ x, y: rect.top });
      } else {
        setTooltipPos(null);
      }
    },
    [],
  );

  // Find encounters for a monster
  const getMonsterEncounters = useCallback(
    (monsterId: string) => encounters.filter((e) => e.monsters.some((m) => m.id === monsterId)),
    [encounters],
  );

  return (
    <div className="flex h-screen bg-[#1a1a2e] text-gray-200 overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && isMobile && (
        <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Left Sidebar */}
      <aside
        className={`
          border-r border-white/10 bg-[#16162a] flex flex-col gap-2 overflow-y-auto transition-all duration-200 shrink-0
          ${isMobile
            ? `fixed z-50 inset-y-0 left-0 w-52 ${sidebarOpen ? "translate-x-0 p-3" : "-translate-x-full p-3"}`
            : `relative ${sidebarOpen ? "w-52 p-3" : "w-0 p-0 overflow-hidden border-r-0"}`
          }
        `}
      >
        {/* Type Filters */}
        <FilterSection trigger="#" label="유형">
          <div className="flex flex-col gap-0.5">
            {MONSTER_TYPE_ORDER.map((type) => {
              const config = MONSTER_TYPE_CONFIG[type];
              return (
                <button
                  key={type}
                  onClick={() => toggleType(type)}
                  className={`flex items-center gap-2 text-left text-sm px-2.5 py-1 rounded transition-all ${
                    selectedTypes.has(type)
                      ? "bg-yellow-500/20 text-yellow-400"
                      : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
                  }`}
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: config.color }} />
                  {config.label}
                </button>
              );
            })}
          </div>
        </FilterSection>

        <div className="border-t border-white/10" />

        {/* Act Filters */}
        <FilterSection trigger="#" label="등장 막">
          <div className="flex flex-col gap-0.5">
            {ACT_ORDER.map((act) => {
              const config = act ? EVENT_ACT_CONFIG[act] : EVENT_ACT_UNKNOWN;
              const key = act ?? "none";
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
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: act ? undefined : "#666" }} />
                  <span className={act ? config.color : "text-zinc-400"}>{config.labelKo}</span>
                </button>
              );
            })}
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
          <h1 className="text-base font-bold text-yellow-500 shrink-0">몬스터 도감</h1>
          <div className="flex-1 max-w-xl mx-auto">
            <MonsterSearchBar value={searchQuery} onChange={setSearchQuery} inputId="monster-search" />
          </div>
          <span className="text-sm text-gray-500 shrink-0 tabular-nums">{filteredMonsters.length}마리</span>
        </div>

        {/* Monster Grid */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {sections.map((section) => (
            <div key={section.type} className="mb-8 last:mb-0">
              <div className="mb-3">
                <span className="text-lg font-bold font-[family-name:var(--font-spectral)]" style={{ color: section.color }}>
                  {section.label}:
                </span>
                <span className="ml-2 text-sm text-gray-400">{section.description}</span>
                <span className="ml-2 text-xs text-gray-600">({section.monsters.length})</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {section.monsters.map((monster) => (
                  <MonsterTile
                    key={monster.id}
                    monster={monster}
                    encounters={getMonsterEncounters(monster.id)}
                    onHover={handleMonsterHover}
                    onClick={() => setSelectedMonster(monster)}
                  />
                ))}
              </div>
            </div>
          ))}

          {sections.length === 0 && (
            <div className="flex items-center justify-center h-64 text-gray-500">검색 결과가 없습니다</div>
          )}
        </div>
      </main>

      {/* Hover Tooltip */}
      {hoveredMonster && tooltipPos && (
        <MonsterTooltip monster={hoveredMonster} encounters={getMonsterEncounters(hoveredMonster.id)} x={tooltipPos.x} y={tooltipPos.y} />
      )}

      {/* Detail Modal */}
      {selectedMonster && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedMonster(null);
          }}
        >
          <div className="w-full max-w-2xl my-8 mx-4 bg-[#1a1a2e] rounded-xl border border-white/10 shadow-2xl">
            <MonsterDetail
              monster={selectedMonster}
              encounters={getMonsterEncounters(selectedMonster.id)}
              allMonsters={monsters}
              onClose={() => setSelectedMonster(null)}
              onMonsterClick={(m) => setSelectedMonster(m)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Monster tile - text-based since most monsters lack images
function MonsterTile({
  monster,
  encounters,
  onHover,
  onClick,
}: {
  monster: CodexMonster;
  encounters: CodexEncounter[];
  onHover: (m: CodexMonster | null, e?: React.MouseEvent) => void;
  onClick?: () => void;
}) {
  const typeConfig = MONSTER_TYPE_CONFIG[monster.type];
  const hpText = formatHp(monster);
  const acts = [...new Set(encounters.map((e) => e.act).filter(Boolean))] as EventAct[];

  return (
    <button
      className="group relative flex items-center gap-3 px-3 py-2.5 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/10 hover:border-yellow-500/40 transition-all text-left"
      onMouseEnter={(e) => onHover(monster, e)}
      onMouseLeave={() => onHover(null)}
      onClick={onClick}
    >
      {/* Thumbnail: boss token icon for bosses, sprite sheet for others */}
      {(monster.bossImageUrl || monster.imageUrl) ? (
        <div className="w-10 h-10 shrink-0 rounded overflow-hidden bg-white/5 flex items-center justify-center">
          <Image
            src={monster.bossImageUrl ?? monster.imageUrl!}
            alt={monster.name}
            width={40}
            height={40}
            className={`w-10 h-10 ${monster.bossImageUrl ? "object-cover" : "object-cover"}`}
          />
        </div>
      ) : (
        <div
          className="w-1 h-8 rounded-full shrink-0"
          style={{ backgroundColor: typeConfig.color }}
        />
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-gray-100 truncate">{monster.name}</span>
          <span className="text-[10px] text-gray-500 truncate">{monster.nameEn}</span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ backgroundColor: `${typeConfig.color}20`, color: typeConfig.color }}>
            {typeConfig.label}
          </span>
          {hpText && <span className="text-[10px] text-gray-500">HP {hpText}</span>}
          {acts.length > 0 && (
            <div className="flex gap-1">
              {acts.slice(0, 2).map((act) => {
                const config = EVENT_ACT_CONFIG[act];
                return (
                  <span key={act} className={`text-[9px] ${config?.color ?? "text-zinc-400"}`}>
                    {config?.label ?? "?"}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Move count */}
      <span className="text-[10px] text-gray-600 shrink-0">
        {monster.moves.filter((m) => m.id !== "NOTHING" && m.id !== "SPAWNED" && m.id !== "DEAD").length} 행동
      </span>
    </button>
  );
}

// Tooltip
function MonsterTooltip({
  monster,
  encounters,
  x,
  y,
}: {
  monster: CodexMonster;
  encounters: CodexEncounter[];
  x: number;
  y: number;
}) {
  const typeConfig = MONSTER_TYPE_CONFIG[monster.type];
  const style: React.CSSProperties = {
    position: "fixed",
    left: Math.max(0, Math.min(x, window.innerWidth - 320)),
    top: Math.min(y, window.innerHeight - 300),
    zIndex: 100,
    pointerEvents: "none",
  };

  const meaningfulMoves = monster.moves.filter(
    (m) => m.id !== "NOTHING" && m.id !== "SPAWNED" && m.id !== "DEAD",
  );

  return (
    <div className="w-80 bg-[#1a1a3a] border border-white/20 rounded-lg shadow-2xl overflow-hidden" style={style}>
      <div className="p-3">
        {/* Header */}
        <div className="flex items-center gap-2 mb-1">
          {(monster.bossImageUrl || monster.imageUrl) ? (
            <Image src={monster.bossImageUrl ?? monster.imageUrl!} alt={monster.name} width={32} height={32} className="w-8 h-8 object-cover rounded" />
          ) : (
            <div className="w-1.5 h-6 rounded-full" style={{ backgroundColor: typeConfig.color }} />
          )}
          <div>
            <div className="font-bold text-sm text-gray-100">{monster.name}</div>
            <div className="text-[10px] text-gray-500">{monster.nameEn}</div>
          </div>
        </div>

        {/* Type + HP */}
        <div className="flex items-center gap-1.5 mb-2">
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ backgroundColor: `${typeConfig.color}20`, color: typeConfig.color }}>
            {typeConfig.label}
          </span>
          {formatHp(monster) && <span className="text-[10px] text-gray-400">HP {formatHp(monster)}</span>}
        </div>

        {/* Moves */}
        {meaningfulMoves.length > 0 && (
          <div className="mb-2">
            <div className="text-[10px] text-gray-500 mb-1">행동 패턴</div>
            <div className="flex flex-wrap gap-1">
              {meaningfulMoves.map((move) => (
                <span key={move.id} className="text-[10px] bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-gray-300">
                  {move.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Damage preview */}
        {monster.damageValues && Object.keys(monster.damageValues).length > 0 && (
          <div className="mb-2">
            <div className="text-[10px] text-gray-500 mb-1">피해량</div>
            <div className="flex flex-wrap gap-1">
              {Object.entries(monster.damageValues).slice(0, 4).map(([key, val]) => (
                <span key={key} className="text-[10px] text-red-400/80">
                  {key}: {val.normal ?? "?"}
                  {val.ascension != null && val.ascension !== val.normal ? ` (${val.ascension})` : ""}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Encounters */}
        {encounters.length > 0 && (
          <div>
            <div className="text-[10px] text-gray-500 mb-1">등장 전투</div>
            <div className="flex flex-wrap gap-1">
              {encounters.slice(0, 3).map((enc) => (
                <span key={enc.id} className="text-[10px] text-yellow-400/70">{enc.name}</span>
              ))}
              {encounters.length > 3 && <span className="text-[10px] text-gray-600">+{encounters.length - 3}</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Search bar
function MonsterSearchBar({ value, onChange, inputId }: { value: string; onChange: (v: string) => void; inputId?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  const HINTS = [
    { trigger: "#", label: "유형", examples: ["일반", "엘리트", "보스"] },
    { trigger: "#", label: "막", examples: ["1막", "2막", "3막", "지하선착장"] },
  ];

  return (
    <div className="relative">
      <div className="relative">
        <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
            if (e.key === "Escape") { onChange(""); inputRef.current?.blur(); }
          }}
          placeholder="몬스터 검색..."
          className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-16 py-1.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-yellow-500/50 focus:ring-1 focus:ring-yellow-500/30 transition-all"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {value && (
            <button onClick={() => onChange("")} className="text-gray-500 hover:text-gray-300 transition-colors p-0.5">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.3 5.71a1 1 0 00-1.42 0L12 10.59 7.12 5.7A1 1 0 005.7 7.12L10.59 12 5.7 16.88a1 1 0 101.42 1.42L12 13.41l4.88 4.89a1 1 0 001.42-1.42L13.41 12l4.89-4.88a1 1 0 000-1.41z" />
              </svg>
            </button>
          )}
          <kbd className="hidden sm:inline text-[9px] text-gray-600 bg-white/5 border border-white/10 rounded px-1 py-0.5 font-mono">⌘K</kbd>
        </div>
      </div>

      {isFocused && !value && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-[#1e1e3a] border border-white/10 rounded-lg shadow-xl z-50 overflow-hidden p-2.5 flex flex-col gap-2">
          {HINTS.map(({ trigger, label, examples }, hi) => (
            <div key={hi} className="flex items-center gap-2 flex-wrap">
              <button
                onMouseDown={() => { onChange(trigger); inputRef.current?.focus(); }}
                className="shrink-0 text-[11px] font-mono font-bold text-yellow-500 bg-yellow-500/10 hover:bg-yellow-500/20 rounded px-1.5 py-0.5 transition-colors"
              >
                {trigger}
              </button>
              <span className="shrink-0 text-[11px] text-gray-500 w-10">{label}</span>
              {examples.map((ex) => (
                <button
                  key={ex}
                  onMouseDown={() => { onChange(`${trigger}${ex} `); inputRef.current?.focus(); }}
                  className="text-[11px] text-gray-400 hover:text-gray-200 bg-white/5 hover:bg-white/10 rounded px-1.5 py-0.5 transition-colors"
                >
                  {ex}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Shared
function FilterSection({ trigger, label, children }: { trigger?: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        {trigger && (
          <span className="text-[10px] font-mono font-bold text-yellow-500/70 bg-yellow-500/10 rounded px-1 py-0.5 leading-none">{trigger}</span>
        )}
        <span className="text-[11px] text-gray-500 font-medium uppercase tracking-wider">{label}</span>
      </div>
      {children}
    </div>
  );
}

function formatHp(monster: CodexMonster): string | null {
  if (monster.minHp == null) return null;
  if (monster.minHp === 9999) return null;
  if (monster.maxHp != null && monster.maxHp !== monster.minHp) {
    return `${monster.minHp}-${monster.maxHp}`;
  }
  return `${monster.minHp}`;
}
