"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import Link from "next/link";
import Image from "@/components/ui/static-image";
import { MonsterDetail } from "./monster-detail";
import { localizeHref, type ServiceLocale } from "@/lib/i18n";
import { buildCompendiumResourceDetailHref } from "@/lib/compendium-resource-links";
import type { CodexGameUiLabels } from "@/lib/codex-game-ui";
import type { EntityVersionDiff, STS2Change, STS2Patch } from "@/lib/types";
import { serviceMessages } from "@/messages/service";
import {
  CodexAffliction,
  CodexMonster,
  CodexEncounter,
  CodexCard,
  CodexPower,
  MonsterType,
  MONSTER_TYPE_CONFIG,
  MONSTER_TYPE_ORDER,
  EventAct,
} from "@/lib/codex-types";
import { fuzzyMatchCodexText } from "@/lib/codex-search";
import { versionCodexEntities } from "@/lib/codex-versioning";
import { pickRandomMonsterPreviewMoveId } from "@/lib/monster-spine-preview";
import {
  BESTIARY_FORCED_ACTS,
  getBestiaryDisplayMonsterType,
  isPublicBestiaryMonster,
} from "@/lib/bestiary-monster-policy";
import { buildCodexCommentThreadKey } from "@/lib/comment-threads";
import {
  getMonsterPhobiaModeLabel,
  hasMonsterPhobiaMode,
  hasMonsterSkinParts,
} from "@/lib/monster-skins";
import { useEngagementCounts } from "@/hooks/use-engagement-counts";
import { useAuth } from "@/hooks/use-auth";
import { EngagementSummary } from "@/components/engagement-summary";
import { LikeButton } from "@/components/like-button";
import { SearchBar } from "./search-bar";
import {
  FilterSection,
  ToggleButton,
  orderByFilterSortDir,
  toggleFilterSortDir,
  type FilterSortDir,
} from "./codex-filters";
import { MonsterSpineStage } from "./monster-spine-stage";
import {
  CodexLibraryShell,
  CodexLibraryTopBar,
  useCodexFilterDrawer,
} from "./codex-filter-drawer";
import { VersionSelector } from "./version-selector";
import {
  addCodexUrlChangeListener,
  pushCodexHistoryState,
  useHydrationSafeSearchParam,
} from "./use-hydration-safe-search-param";

type MonsterViewMessages =
  (typeof serviceMessages)[ServiceLocale]["codex"]["monstersView"];

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
  afflictions?: CodexAffliction[];
  cards?: CodexCard[];
  powers?: CodexPower[];
  patches?: STS2Patch[];
  changes?: STS2Change[];
  versionDiffs?: EntityVersionDiff[];
  versions?: string[];
  currentVersion?: string;
  selectedVersion?: string;
  onVersionChange?: (version: string) => void;
  trailing?: React.ReactNode;
}

export function MonsterLibrary({
  serviceLocale,
  gameUi,
  title,
  monsters,
  encounters,
  afflictions = [],
  cards = [],
  powers = [],
  patches,
  changes,
  versionDiffs,
  versions,
  currentVersion,
  selectedVersion,
  onVersionChange,
  trailing,
}: MonsterLibraryProps) {
  const serviceText = serviceMessages[serviceLocale];
  const commonText = serviceText.codex.common;
  const monsterText = serviceText.codex.monstersView;
  const [selectedTypes, setSelectedTypes] = useState<Set<MonsterType>>(new Set());
  const [selectedActs, setSelectedActs] = useState<Set<string>>(new Set());
  const [showOnlySkinVariants, setShowOnlySkinVariants] = useState(false);
  const [showOnlyPhobiaMode, setShowOnlyPhobiaMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [internalSelectedVersion, setInternalSelectedVersion] = useState(currentVersion ?? "");
  const [typeSortDir, setTypeSortDir] = useState<FilterSortDir>("asc");
  const [actSortDir, setActSortDir] = useState<FilterSortDir>("asc");
  const activeVersion = selectedVersion ?? internalSelectedVersion;
  const setActiveVersion = onVersionChange ?? setInternalSelectedVersion;
  const { userId, ready: authReady, ensureUser } = useAuth();
  const engagementCounts = useEngagementCounts();
  const versionedMonsters = useMemo(() => {
    return versionCodexEntities(monsters, "monster", {
      selectedVersion: activeVersion,
      currentVersion,
      versionDiffs,
      patches,
      changes,
    });
  }, [monsters, activeVersion, currentVersion, versionDiffs, patches, changes]);
  const versionedEncounters = useMemo(() => {
    return versionCodexEntities(encounters, "encounter", {
      selectedVersion: activeVersion,
      currentVersion,
      versionDiffs,
      patches,
      changes,
    });
  }, [encounters, activeVersion, currentVersion, versionDiffs, patches, changes]);
  const versionedCards = useMemo(() => {
    return versionCodexEntities(cards, "card", {
      selectedVersion: activeVersion,
      currentVersion,
      versionDiffs,
      patches,
      changes,
    });
  }, [cards, activeVersion, currentVersion, versionDiffs, patches, changes]);
  const versionedPowers = useMemo(() => {
    return versionCodexEntities(powers, "power", {
      selectedVersion: activeVersion,
      currentVersion,
      versionDiffs,
      patches,
      changes,
    });
  }, [powers, activeVersion, currentVersion, versionDiffs, patches, changes]);

  // Monster detail modal
  const urlMonsterId = useHydrationSafeSearchParam("monster");
  const [selectedMonsterId, setSelectedMonsterId] = useState<string | null>(null);
  const [useUrlSelection, setUseUrlSelection] = useState(true);
  const selectedMonster = useMemo(() => {
    const activeMonsterId = useUrlSelection ? urlMonsterId : selectedMonsterId;
    return activeMonsterId
      ? versionedMonsters.find((m) =>
          m.id.toLowerCase() === activeMonsterId.toLowerCase() &&
          m.showInCompendium &&
          isPublicBestiaryMonster(m.id)
        ) ?? null
      : null;
  }, [selectedMonsterId, useUrlSelection, urlMonsterId, versionedMonsters]);

  const openSelectedMonster = useCallback((monster: CodexMonster) => {
    setUseUrlSelection(false);
    setSelectedMonsterId(monster.id);
  }, []);

  const closeSelectedMonster = useCallback(() => {
    setUseUrlSelection(false);
    setSelectedMonsterId(null);
  }, []);

  // URL sync
  useEffect(() => {
    if (useUrlSelection) return;
    const url = new URL(window.location.href);
    if (selectedMonsterId) {
      url.searchParams.set("monster", selectedMonsterId.toLowerCase());
    } else {
      url.searchParams.delete("monster");
    }
    if (url.toString() !== window.location.href) {
      pushCodexHistoryState(url);
    }
  }, [selectedMonsterId, useUrlSelection]);

  // Browser back button
  useEffect(() => {
    const handler = () => {
      setUseUrlSelection(true);
      setSelectedMonsterId(null);
    };
    return addCodexUrlChangeListener(handler);
  }, []);

  // Escape to close
  useEffect(() => {
    if (!selectedMonster) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSelectedMonster();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [closeSelectedMonster, selectedMonster]);

  const { sidebarOpen, setSidebarOpen, isMobile } = useCodexFilterDrawer();

  // Build monster -> acts mapping from encounters
  const monsterActs = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const enc of versionedEncounters) {
      for (const m of enc.monsters) {
        if (!map.has(m.id)) map.set(m.id, new Set());
        map.get(m.id)!.add(enc.act ?? "none");
      }
    }
    for (const [monsterId, act] of Object.entries(BESTIARY_FORCED_ACTS)) {
      map.set(monsterId, new Set([act]));
    }
    return map;
  }, [versionedEncounters]);

  const searchText = useMemo(() => searchQuery.trim().toLowerCase(), [searchQuery]);

  // Filter monsters
  const filteredMonsters = useMemo(() => {
    let result = versionedMonsters.filter((m) => m.showInCompendium && isPublicBestiaryMonster(m.id));

    if (showOnlySkinVariants) {
      result = result.filter((m) => hasSkinVariants(m));
    }
    if (showOnlyPhobiaMode) {
      result = result.filter((m) => hasMonsterPhobiaMode(m));
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

    // Text search
    if (searchText) {
      result = result.filter(
        (m) =>
          fuzzyMatchCodexText(m.name, searchText) ||
          fuzzyMatchCodexText(m.nameEn, searchText),
      );
    }

    return result;
  }, [versionedMonsters, showOnlySkinVariants, showOnlyPhobiaMode, selectedTypes, selectedActs, searchText, monsterActs]);

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
    return orderByFilterSortDir(ACT_ORDER, actSortDir).map((act) => ({
      act,
      key: act ?? "none",
      color: act ? BESTIARY_ACT_COLOR : "#a1a1aa",
      label: getActLabel(act, monsterText, gameUi),
      monsters: filteredMonsters
        .filter((monster) => getPrimaryMonsterAct(monster.id) === act)
        .sort((a, b) => {
          const typeDiff = typeSortDir === "asc"
            ? getMonsterTypeSortOrder(getDisplayMonsterType(a)) - getMonsterTypeSortOrder(getDisplayMonsterType(b))
            : getMonsterTypeSortOrder(getDisplayMonsterType(b)) - getMonsterTypeSortOrder(getDisplayMonsterType(a));
          if (typeDiff !== 0) return typeDiff;
          return a.name.localeCompare(b.name, "ko");
        }),
    })).filter((s) => s.monsters.length > 0);
  }, [filteredMonsters, gameUi, getPrimaryMonsterAct, monsterText, actSortDir, typeSortDir]);

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

  const topBarTrailing = trailing || (versions && currentVersion) ? (
    <div className="flex shrink-0 items-center gap-2">
      {trailing}
      {versions && currentVersion ? (
        <VersionSelector
          versions={versions}
          currentVersion={currentVersion}
          selectedVersion={activeVersion}
          onChange={setActiveVersion}
        />
      ) : null}
    </div>
  ) : undefined;

  return (
    <CodexLibraryShell
      sidebarOpen={sidebarOpen}
      setSidebarOpen={setSidebarOpen}
      isMobile={isMobile}
      sidebar={(
        <>
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          inputId="codex-filter-search"
          placeholder={serviceLocale === "ko" ? "검색" : "Search"}
        />

        {/* Type Filters */}
        <FilterSection trigger="#" label={monsterText.typeFilter} sortDir={typeSortDir} onSortToggle={() => setTypeSortDir(toggleFilterSortDir)} sortTitle={commonText.sortButtonTitle}>
          <div className="flex flex-col gap-0.5">
            {orderByFilterSortDir(MONSTER_TYPE_ORDER, typeSortDir).map((type) => {
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
        <FilterSection trigger="%" label={monsterText.actFilter} sortDir={actSortDir} onSortToggle={() => setActSortDir(toggleFilterSortDir)} sortTitle={commonText.sortButtonTitle}>
          <div className="flex flex-col gap-0.5">
            {orderByFilterSortDir(ACT_ORDER, actSortDir).map((act) => {
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
            <ToggleButton
              label={getMonsterPhobiaModeLabel(serviceLocale)}
              active={showOnlyPhobiaMode}
              onClick={() => setShowOnlyPhobiaMode((value) => !value)}
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
          count={formatCount(filteredMonsters.length, monsterText.resultUnit, serviceLocale)}
          trailing={topBarTrailing}
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
                      serviceLocale={serviceLocale}
                      monster={monster}
                      displayType={getDisplayMonsterType(monster)}
                      threadKey={threadKey}
                      commentCount={engagementCounts.comments[threadKey] ?? 0}
                      likeCount={engagementCounts.likes[threadKey] ?? 0}
                      engagementLoading={engagementCounts.loading}
                      engagementUnavailable={engagementCounts.unavailable}
                      userId={userId}
                      authReady={authReady}
                      ensureUser={ensureUser}
                      onClick={() => openSelectedMonster(monster)}
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
            if (e.target === e.currentTarget) closeSelectedMonster();
          }}
        >
          <div className="my-8 mx-4 w-full max-w-6xl">
            <MonsterDetail
              serviceLocale={serviceLocale}
              gameUi={gameUi}
              backToListTitle={title}
              monster={selectedMonster}
              monsters={versionedMonsters}
              encounters={versionedEncounters}
              afflictions={afflictions}
              cards={versionedCards}
              powers={versionedPowers}
              patches={patches}
              changes={changes}
              versionDiffs={versionDiffs}
              onClose={closeSelectedMonster}
            />
          </div>
        </div>
      )}
    </CodexLibraryShell>
  );
}

// Monster tile - text-based since most monsters lack images
function MonsterTile({
  serviceLocale,
  monster,
  displayType,
  threadKey,
  commentCount,
  likeCount,
  engagementLoading,
  engagementUnavailable,
  userId,
  authReady,
  ensureUser,
  onClick,
}: {
  serviceLocale: ServiceLocale;
  monster: CodexMonster;
  displayType: MonsterType;
  threadKey: string;
  commentCount: number;
  likeCount: number;
  engagementLoading: boolean;
  engagementUnavailable: boolean;
  userId: string | null;
  authReady: boolean;
  ensureUser: () => Promise<string | null>;
  onClick?: () => void;
}) {
  const typeConfig = MONSTER_TYPE_CONFIG[displayType];
  const [hoverMoveId, setHoverMoveId] = useState<string | null | undefined>(undefined);
  const imageSrc = monster.imageUrl ?? monster.bossImageUrl;
  const hovering = hoverMoveId !== undefined;

  return (
    <div
      className={`group relative flex items-center gap-2 rounded-md px-2.5 py-2 transition-colors hover:bg-white/[0.06] ${
        monster.deprecated ? "opacity-50 grayscale saturate-0" : ""
      }`}
      onMouseEnter={() => setHoverMoveId(pickRandomMonsterPreviewMoveId(monster))}
      onMouseLeave={() => setHoverMoveId(undefined)}
    >
      <Link
        href={localizeHref(buildCompendiumResourceDetailHref("monster", monster.id), serviceLocale)}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
        onClick={(event) => {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
          event.preventDefault();
          onClick?.();
        }}
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
                loading="lazy"
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
            <EngagementSummary
              commentCount={commentCount}
              loading={engagementLoading}
              unavailable={engagementUnavailable}
              className="shrink-0"
            />
          </div>
        </div>
      </Link>

      <LikeButton
        storyId={threadKey}
        userId={userId}
        initialCount={likeCount}
        size={16}
        authReady={authReady}
        userStatusLoading="lazy"
        ensureUser={ensureUser}
        className="shrink-0 px-1 py-1"
      />
    </div>
  );
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
