"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Image from "@/components/ui/static-image";
import { MonsterDetail } from "./monster-detail";
import type { ServiceLocale } from "@/lib/i18n";
import type { CodexGameUiLabels } from "@/lib/codex-game-ui";
import type { STS2Change, STS2Patch } from "@/lib/types";
import { serviceMessages } from "@/messages/service";
import {
  CodexCard,
  CodexMonster,
  CodexEncounter,
  CodexPotion,
  CodexRelic,
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
import {
  BESTIARY_FORCED_ACTS,
  getBestiaryDisplayMonsterType,
  isPublicBestiaryMonster,
} from "@/lib/bestiary-monster-policy";
import { buildCodexCommentThreadKey } from "@/lib/comment-threads";
import { hasMonsterSkinParts } from "@/lib/monster-skins";
import { useEngagementCounts } from "@/hooks/use-engagement-counts";
import { useAuth } from "@/hooks/use-auth";
import { EngagementSummary } from "@/components/engagement-summary";
import { LikeButton } from "@/components/like-button";
import { SearchBar } from "./search-bar";
import { FilterSection, ToggleButton } from "./codex-filters";
import { MonsterSpineStage } from "./monster-spine-stage";
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
  cards?: CodexCard[];
  potions?: CodexPotion[];
  relics?: CodexRelic[];
  patches?: STS2Patch[];
  changes?: STS2Change[];
  trailing?: React.ReactNode;
}

export function MonsterLibrary({
  serviceLocale,
  gameUi,
  title,
  monsters,
  encounters,
  cards = [],
  potions = [],
  relics = [],
  patches,
  changes,
  trailing,
}: MonsterLibraryProps) {
  const serviceText = serviceMessages[serviceLocale];
  const commonText = serviceText.codex.common;
  const monsterText = serviceText.codex.monstersView;
  const searchParams = useSearchParams();
  const [selectedTypes, setSelectedTypes] = useState<Set<MonsterType>>(new Set());
  const [selectedActs, setSelectedActs] = useState<Set<string>>(new Set());
  const [showOnlySkinVariants, setShowOnlySkinVariants] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { userId, ready: authReady, unavailable: authUnavailable } = useAuth();
  const engagementCounts = useEngagementCounts();

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
    for (const [monsterId, act] of Object.entries(BESTIARY_FORCED_ACTS)) {
      map.set(monsterId, new Set([act]));
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
    let result = monsters.filter((m) => m.showInCompendium && isPublicBestiaryMonster(m.id));

    if (showOnlySkinVariants) {
      result = result.filter((m) => hasSkinVariants(m));
    }

    // Type filter
    if (selectedTypes.size > 0) {
      result = result.filter((m) => selectedTypes.has(getDisplayMonsterType(m)));
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
        result = result.filter((m) => getDisplayMonsterType(m) === token.value);
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
  }, [monsters, showOnlySkinVariants, selectedTypes, selectedActs, parsedSearch, monsterActs]);

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
          const typeDiff = getMonsterTypeSortOrder(getDisplayMonsterType(a)) - getMonsterTypeSortOrder(getDisplayMonsterType(b));
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

        <div className="border-t border-white/10" />

        <FilterSection label={serviceLocale === "ko" ? "표시" : "Display"}>
          <div className="flex flex-col gap-1">
            <ToggleButton
              label={serviceLocale === "ko" ? "스킨 있음" : "Has skins"}
              active={showOnlySkinVariants}
              onClick={() => setShowOnlySkinVariants((value) => !value)}
            />
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
                <span className="font-game-title text-lg font-bold" style={{ color: section.color }}>
                  {section.label}:
                </span>
                <span className="text-xs text-gray-600">({section.monsters.length})</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {section.monsters.map((monster) => {
                  const threadKey = buildCodexCommentThreadKey("monster", monster.id);
                  return (
                    <MonsterTile
                      key={monster.id}
                      monster={monster}
                      displayType={getDisplayMonsterType(monster)}
                      threadKey={threadKey}
                      commentCount={engagementCounts.comments[threadKey] ?? 0}
                      likeCount={engagementCounts.likes[threadKey] ?? 0}
                      engagementLoading={engagementCounts.loading}
                      engagementUnavailable={engagementCounts.unavailable}
                      userId={userId}
                      authReady={authReady}
                      authUnavailable={authUnavailable}
                      onClick={() => setSelectedMonster(monster)}
                    />
                  );
                })}
              </div>
            </div>
          ))}

          {sections.length === 0 && (
            <div className="flex items-center justify-center h-64 text-gray-500">{commonText.noResults}</div>
          )}
        </div>
      </main>

      {/* Detail Modal */}
      {selectedMonster && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedMonster(null);
          }}
        >
          <div className="my-8 mx-4 w-full max-w-6xl">
            <MonsterDetail
              serviceLocale={serviceLocale}
              gameUi={gameUi}
              backToListTitle={title}
              monster={selectedMonster}
              encounters={encounters}
              relatedCards={cards}
              relatedPotions={potions}
              relatedRelics={relics}
              patches={patches}
              changes={changes}
              onClose={() => setSelectedMonster(null)}
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
  displayType,
  threadKey,
  commentCount,
  likeCount,
  engagementLoading,
  engagementUnavailable,
  userId,
  authReady,
  authUnavailable,
  onClick,
}: {
  monster: CodexMonster;
  displayType: MonsterType;
  threadKey: string;
  commentCount: number;
  likeCount: number;
  engagementLoading: boolean;
  engagementUnavailable: boolean;
  userId: string | null;
  authReady: boolean;
  authUnavailable: boolean;
  onClick?: () => void;
}) {
  const typeConfig = MONSTER_TYPE_CONFIG[displayType];
  const [hoverMoveId, setHoverMoveId] = useState<string | null | undefined>(undefined);
  const imageSrc = monster.imageUrl ?? monster.bossImageUrl;
  const hovering = hoverMoveId !== undefined;

  return (
    <div
      className="group relative flex items-center gap-2 rounded-md px-2.5 py-2 transition-colors hover:bg-white/[0.06]"
      onMouseEnter={() => setHoverMoveId(pickHoverMoveId(monster))}
      onMouseLeave={() => setHoverMoveId(undefined)}
    >
      <button
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
        onClick={onClick}
      >
        {/* Thumbnail: Spine render or boss token */}
        {(imageSrc || monster.spineAsset) ? (
          <div className="relative flex h-12 w-14 shrink-0 items-center justify-center overflow-hidden">
            {imageSrc && (
              <Image
                src={imageSrc}
                alt={monster.name}
                width={56}
                height={48}
                className={`max-h-12 max-w-14 object-contain drop-shadow-[0_10px_18px_rgba(0,0,0,0.45)] transition-opacity ${
                  hovering && monster.spineAsset ? "opacity-0" : "opacity-100"
                }`}
              />
            )}
            {hovering && monster.spineAsset && (
              <MonsterSpineStage
                asset={monster.spineAsset}
                fallbackImageUrl={imageSrc}
                monsterName={monster.name}
                selectedMoveId={hoverMoveId}
                imagePriority={false}
                showLoadingLabel={false}
                className="absolute inset-0"
              />
            )}
            {!imageSrc && !hovering && (
              <div
                className="h-8 w-1 rounded-full"
                style={{ backgroundColor: typeConfig.color }}
              />
            )}
          </div>
        ) : (
          <div
            className="w-1 h-8 rounded-full shrink-0"
            style={{ backgroundColor: typeConfig.color }}
          />
        )}

        <div className="flex-1 min-w-0">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="font-game-title min-w-0 truncate text-sm font-medium" style={{ color: typeConfig.color }}>{monster.name}</span>
            <span className="font-game-text min-w-0 truncate text-[10px] text-gray-500">{monster.nameEn}</span>
            <EngagementSummary
              commentCount={commentCount}
              loading={engagementLoading}
              unavailable={engagementUnavailable}
              className="shrink-0"
            />
          </div>
        </div>
      </button>

      <LikeButton
        storyId={threadKey}
        userId={userId}
        initialCount={likeCount}
        size={16}
        authReady={authReady}
        authUnavailable={authUnavailable}
        className="shrink-0 px-1 py-1"
      />
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

function getDisplayMonsterType(monster: CodexMonster): MonsterType {
  return getBestiaryDisplayMonsterType(monster.id, monster.type);
}

function hasSkinVariants(monster: CodexMonster): boolean {
  return hasMonsterSkinParts(monster);
}

function getMeaningfulMoves(monster: CodexMonster) {
  return monster.bestiaryMoves.filter(
    (m) => m.id !== "NOTHING" && m.id !== "SPAWNED" && m.id !== "DEAD",
  );
}

function pickHoverMoveId(monster: CodexMonster): string | null {
  const playableMoves = getMeaningfulMoves(monster).filter((move) => {
    const moveAnimations = monster.spineAsset?.moveAnimations[move.id] ?? [];
    const moveEffects = monster.spineAsset?.moveEffects[move.id] ?? [];
    return moveAnimations.length > 0 || moveEffects.some((effect) => effect.usable !== false);
  });
  const candidates: (string | null)[] = [null, ...playableMoves.map((move) => move.id)];
  return candidates[Math.floor(Math.random() * candidates.length)] ?? null;
}
