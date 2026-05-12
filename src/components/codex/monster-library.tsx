"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Image from "@/components/ui/static-image";
import { MonsterDetail } from "./monster-detail";
import type { ServiceLocale } from "@/lib/i18n";
import type { CodexGameUiLabels } from "@/lib/codex-game-ui";
import { serviceMessages } from "@/messages/service";
import {
  CodexMonster,
  CodexEncounter,
  MonsterType,
  MONSTER_TYPE_CONFIG,
  MONSTER_TYPE_ORDER,
  MONSTER_TYPE_ALIASES,
  EVENT_ACT_ALIASES,
  EventAct,
} from "@/lib/codex-types";
import {
  fuzzyMatchCodexText,
  parseCodexSearch,
  type CodexSearchTriggerGroup,
} from "@/lib/codex-search";
import { SearchBar } from "./search-bar";
import { FilterSection } from "./codex-filters";
import {
  CodexLibraryShell,
  CodexLibraryTopBar,
  useCodexFilterDrawer,
} from "./codex-filter-drawer";

type MonsterViewMessages =
  (typeof serviceMessages)[ServiceLocale]["codex"]["monstersView"];
type MonsterSearchTokenType = "monsterType" | "act";

// Act display order
const ACT_ORDER: (EventAct | null)[] = [
  "Act 1 - Overgrowth",
  "Underdocks",
  "Act 2 - Hive",
  "Act 3 - Glory",
  null,
];
const BESTIARY_ACT_COLOR = "#60a5fa";

interface MonsterLibraryProps {
  serviceLocale: ServiceLocale;
  gameUi: CodexGameUiLabels;
  title: string;
  monsters: CodexMonster[];
  encounters: CodexEncounter[];
  trailing?: React.ReactNode;
}

export function MonsterLibrary({
  serviceLocale,
  gameUi,
  title,
  monsters,
  encounters,
  trailing,
}: MonsterLibraryProps) {
  const serviceText = serviceMessages[serviceLocale];
  const commonText = serviceText.codex.common;
  const monsterText = serviceText.codex.monstersView;
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

  const { sidebarOpen, setSidebarOpen, isMobile } = useCodexFilterDrawer();

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

  const monsterTriggers = useMemo(
    () => getMonsterTriggers(monsterText, gameUi),
    [monsterText, gameUi],
  );

  // Parse search
  const parsedSearch = useMemo(
    () => parseCodexSearch(searchQuery, monsterTriggers),
    [searchQuery, monsterTriggers],
  );

  // Filter monsters
  const filteredMonsters = useMemo(() => {
    let result = monsters.filter((m) => m.showInCompendium);

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
          fuzzyMatchCodexText(m.name, parsedSearch.text) ||
          fuzzyMatchCodexText(m.nameEn, parsedSearch.text),
      );
    }

    return result;
  }, [monsters, selectedTypes, selectedActs, parsedSearch, monsterActs]);

  const getPrimaryMonsterAct = useCallback(
    (monsterId: string): EventAct | null => {
      const acts = monsterActs.get(monsterId);
      if (!acts || acts.size === 0) return null;

      let primaryAct: EventAct | null = null;
      let primaryOrder = Number.POSITIVE_INFINITY;
      for (const candidate of acts) {
        const act = candidate === "none" ? null : (candidate as EventAct);
        const order = getActSortOrder(act);
        if (order < primaryOrder) {
          primaryAct = act;
          primaryOrder = order;
        }
      }
      return primaryAct;
    },
    [monsterActs],
  );

  // Group by act, then sort like the in-game Bestiary list: monster room, elite, boss, name.
  const sections = useMemo(() => {
    return ACT_ORDER.map((act) => ({
      act,
      key: act ?? "none",
      color: act ? BESTIARY_ACT_COLOR : "#a1a1aa",
      label: getActLabel(act, monsterText, gameUi),
      monsters: filteredMonsters
        .filter((monster) => getPrimaryMonsterAct(monster.id) === act)
        .sort((a, b) => {
          const typeDiff = getMonsterTypeSortOrder(a.type) - getMonsterTypeSortOrder(b.type);
          if (typeDiff !== 0) return typeDiff;
          return a.name.localeCompare(b.name, "ko");
        }),
    })).filter((s) => s.monsters.length > 0);
  }, [filteredMonsters, gameUi, getPrimaryMonsterAct, monsterText]);

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
    <CodexLibraryShell
      sidebarOpen={sidebarOpen}
      setSidebarOpen={setSidebarOpen}
      isMobile={isMobile}
      sidebar={(
        <>
        {/* Type Filters */}
        <FilterSection trigger="#" label={monsterText.typeFilter}>
          <div className="flex flex-col gap-0.5">
            {MONSTER_TYPE_ORDER.map((type) => {
              const config = MONSTER_TYPE_CONFIG[type];
              const typeText = gameUi.monsterTypes[type];
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
                  {typeText.label}
                </button>
              );
            })}
          </div>
        </FilterSection>

        <div className="border-t border-white/10" />

        {/* Act Filters */}
        <FilterSection trigger="%" label={monsterText.actFilter}>
          <div className="flex flex-col gap-0.5">
            {ACT_ORDER.map((act) => {
              const key = act ?? "none";
              const label = getActLabel(act, monsterText, gameUi);
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
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: act ? BESTIARY_ACT_COLOR : "#666" }} />
                  <span className={act ? "text-blue-300" : "text-zinc-400"}>{label}</span>
                </button>
              );
            })}
          </div>
        </FilterSection>
        </>
      )}
    >

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <CodexLibraryTopBar
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          closeFiltersLabel={commonText.closeFilters}
          openFiltersLabel={commonText.openFilters}
          title={title}
          search={(
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              inputId="monster-search"
              triggerGroups={monsterTriggers}
              placeholder={monsterText.searchPlaceholder}
            />
          )}
          count={formatCount(filteredMonsters.length, monsterText.resultUnit, serviceLocale)}
          trailing={trailing}
        />

        {/* Monster Grid */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {sections.map((section) => (
            <div key={section.key} className="mb-8 last:mb-0">
              <div className="mb-3 flex items-baseline gap-2">
                <span className="text-lg font-bold font-[family-name:var(--font-spectral)]" style={{ color: section.color }}>
                  {section.label}:
                </span>
                <span className="text-xs text-gray-600">({section.monsters.length})</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {section.monsters.map((monster) => (
                  <MonsterTile
                    key={monster.id}
                    monster={monster}
                    gameUi={gameUi}
                    onHover={handleMonsterHover}
                    onClick={() => setSelectedMonster(monster)}
                  />
                ))}
              </div>
            </div>
          ))}

          {sections.length === 0 && (
            <div className="flex items-center justify-center h-64 text-gray-500">{commonText.noResults}</div>
          )}
        </div>
      </main>

      {/* Hover Tooltip */}
      {hoveredMonster && tooltipPos && (
        <MonsterTooltip
          monster={hoveredMonster}
          encounters={getMonsterEncounters(hoveredMonster.id)}
          x={tooltipPos.x}
          y={tooltipPos.y}
          messages={monsterText}
          gameUi={gameUi}
        />
      )}

      {/* Detail Modal */}
      {selectedMonster && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedMonster(null);
          }}
        >
          <div className="w-full max-w-6xl my-8 mx-4 bg-[#1a1a2e] rounded-xl border border-white/10 shadow-2xl">
            <MonsterDetail
              serviceLocale={serviceLocale}
              gameUi={gameUi}
              backToListTitle={title}
              monster={selectedMonster}
              encounters={getMonsterEncounters(selectedMonster.id)}
              allMonsters={monsters}
              onClose={() => setSelectedMonster(null)}
              onMonsterClick={(m) => setSelectedMonster(m)}
            />
          </div>
        </div>
      )}
    </CodexLibraryShell>
  );
}

// Monster tile - text-based since most monsters lack images
function MonsterTile({
  monster,
  gameUi,
  onHover,
  onClick,
}: {
  monster: CodexMonster;
  gameUi: CodexGameUiLabels;
  onHover: (m: CodexMonster | null, e?: React.MouseEvent) => void;
  onClick?: () => void;
}) {
  const typeConfig = MONSTER_TYPE_CONFIG[monster.type];

  return (
    <button
      className="group relative flex items-center gap-3 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-white/[0.06]"
      onMouseEnter={(e) => onHover(monster, e)}
      onMouseLeave={() => onHover(null)}
      onClick={onClick}
    >
      {/* Thumbnail: Spine render or boss token */}
      {(monster.imageUrl || monster.bossImageUrl) ? (
        <div className="flex h-12 w-14 shrink-0 items-center justify-center overflow-hidden">
          <Image
            src={monster.imageUrl ?? monster.bossImageUrl!}
            alt={monster.name}
            width={56}
            height={48}
            className="max-h-12 max-w-14 object-contain drop-shadow-[0_10px_18px_rgba(0,0,0,0.45)]"
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
        <div className="mt-0.5 flex items-center gap-2">
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ backgroundColor: `${typeConfig.color}20`, color: typeConfig.color }}>
            {gameUi.monsterTypes[monster.type].label}
          </span>
        </div>
      </div>
    </button>
  );
}

// Tooltip
function MonsterTooltip({
  monster,
  encounters,
  x,
  y,
  messages,
  gameUi,
}: {
  monster: CodexMonster;
  encounters: CodexEncounter[];
  x: number;
  y: number;
  messages: MonsterViewMessages;
  gameUi: CodexGameUiLabels;
}) {
  const typeConfig = MONSTER_TYPE_CONFIG[monster.type];
  const style: React.CSSProperties = {
    position: "fixed",
    left: Math.max(0, Math.min(x, window.innerWidth - 320)),
    top: Math.min(y, window.innerHeight - 300),
    zIndex: 100,
    pointerEvents: "none",
  };

  const meaningfulMoves = getMeaningfulMoves(monster);

  return (
    <div className="w-80 bg-[#1a1a3a] border border-white/20 rounded-lg shadow-2xl overflow-hidden" style={style}>
      <div className="p-3">
        {/* Header */}
        <div className="flex items-center gap-2 mb-1">
          {(monster.imageUrl || monster.bossImageUrl) ? (
            <Image src={monster.imageUrl ?? monster.bossImageUrl!} alt={monster.name} width={32} height={32} className="w-8 h-8 object-contain rounded" />
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
            {gameUi.monsterTypes[monster.type].label}
          </span>
          {formatHp(monster) && <span className="text-[10px] text-gray-400">HP {formatHp(monster)}</span>}
        </div>

        {/* Moves */}
        {meaningfulMoves.length > 0 && (
          <div className="mb-2">
            <div className="text-[10px] text-gray-500 mb-1">{messages.movePatterns}</div>
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
            <div className="text-[10px] text-gray-500 mb-1">{messages.damagePreview}</div>
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
            <div className="text-[10px] text-gray-500 mb-1">{messages.encounters}</div>
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

function getMonsterTriggers(
  messages: MonsterViewMessages,
  gameUi: CodexGameUiLabels,
): CodexSearchTriggerGroup<MonsterSearchTokenType>[] {
  return [
    {
      trigger: "#",
      type: "monsterType",
      label: messages.filters.typeHints.label,
      items: MONSTER_TYPE_ORDER.map((type) => ({
        value: type.toLowerCase(),
        label: gameUi.monsterTypes[type].label,
        desc: type,
      })),
      validate: (val) => MONSTER_TYPE_ALIASES[val] ?? null,
      chipColor: "bg-green-500/20 text-green-400",
    },
    {
      trigger: "%",
      type: "act",
      label: messages.filters.actHints.label,
      items: [
        { value: "act1", label: gameUi.acts["Act 1 - Overgrowth"], desc: "Act 1 Overgrowth" },
        { value: "underdocks", label: gameUi.acts.Underdocks, desc: "Underdocks" },
        { value: "act2", label: gameUi.acts["Act 2 - Hive"], desc: "Act 2 Hive" },
        { value: "act3", label: gameUi.acts["Act 3 - Glory"], desc: "Act 3 Glory" },
        { value: "none", label: messages.acts.none, desc: "Any act" },
      ],
      validate: (val) => EVENT_ACT_ALIASES[val] ?? null,
      chipColor: "bg-blue-500/20 text-blue-400",
    },
  ];
}

function formatHp(monster: CodexMonster): string | null {
  if (monster.minHp == null) return null;
  if (monster.minHp === 9999) return null;
  if (monster.maxHp != null && monster.maxHp !== monster.minHp) {
    return `${monster.minHp}-${monster.maxHp}`;
  }
  return `${monster.minHp}`;
}

function formatCount(count: number, unit: string, serviceLocale: ServiceLocale): string {
  if (serviceLocale === "ko") return `${count}${unit}`;

  const displayUnit = count === 1 ? unit.replace(/s$/, "") : unit;
  return `${count} ${displayUnit}`;
}

function getActLabel(
  act: EventAct | null,
  messages: MonsterViewMessages,
  gameUi: CodexGameUiLabels,
): string {
  return act ? gameUi.acts[act] : messages.acts.none;
}

function getActSortOrder(act: EventAct | null): number {
  const index = ACT_ORDER.findIndex((candidate) => candidate === act);
  return index === -1 ? 99 : index;
}

function getMonsterTypeSortOrder(type: MonsterType): number {
  const index = MONSTER_TYPE_ORDER.indexOf(type);
  return index === -1 ? 99 : index;
}

function getMeaningfulMoves(monster: CodexMonster) {
  return monster.bestiaryMoves.filter(
    (m) => m.id !== "NOTHING" && m.id !== "SPAWNED" && m.id !== "DEAD",
  );
}
