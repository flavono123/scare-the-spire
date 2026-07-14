"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import Image from "@/components/ui/static-image";
import {
  addCodexUrlChangeListener,
  pushCodexHistoryState,
  useHydrationSafeSearchParam,
} from "./use-hydration-safe-search-param";
import type { ServiceLocale } from "@/lib/i18n";
import type { CodexGameUiLabels } from "@/lib/codex-game-ui";
import type { EntityVersionDiff, STS2Change, STS2Patch } from "@/lib/types";
import {
  formatCodexCount,
  getCodexServiceMessages,
  type CodexServiceMessages,
} from "@/lib/codex-service";
import {
  CodexEncounter,
  CodexCharacter,
  CodexMonster,
  EncounterRoomType,
  ENCOUNTER_ROOM_TYPE_CONFIG,
  EVENT_ACT_CONFIG,
  EVENT_ACT_UNKNOWN,
  EVENT_ACT_ORDER,
} from "@/lib/codex-types";
import { fuzzyMatchCodexText } from "@/lib/codex-search";
import { expandEncounterFormations } from "@/lib/encounter-compositions";
import { versionCodexEntities } from "@/lib/codex-versioning";
import { pickRandomMonsterPreviewMoveId } from "@/lib/monster-spine-preview";
import { SearchBar } from "./search-bar";
import {
  FilterSection,
  orderByFilterSortDir,
  toggleFilterSortDir,
  type FilterSortDir,
} from "./codex-filters";
import {
  CodexLibraryShell,
  CodexLibraryTopBar,
  useCodexFilterDrawer,
} from "./codex-filter-drawer";
import { EncounterDetail } from "./encounter-detail";
import { VersionSelector } from "./version-selector";
import { MonsterSpineStage } from "./monster-spine-stage";
import { GameCheckboxToggle } from "./game-checkbox";

// Room type display order and styling
const ROOM_TYPE_ORDER: EncounterRoomType[] = ["Monster", "Elite", "Boss"];
const MAX_INDIVIDUAL_FORMATION_COUNT_FILTERS = 8;

interface EncounterLibraryProps {
  serviceLocale: ServiceLocale;
  gameUi: CodexGameUiLabels;
  encounters: CodexEncounter[];
  characters: CodexCharacter[];
  monsters: CodexMonster[];
  patches?: STS2Patch[];
  changes?: STS2Change[];
  versionDiffs?: EntityVersionDiff[];
  versions?: string[];
  currentVersion?: string;
  selectedVersion?: string;
  onVersionChange?: (version: string) => void;
  title?: string;
  trailing?: React.ReactNode;
}

export function EncounterLibrary({
  serviceLocale,
  gameUi,
  encounters,
  characters,
  monsters,
  patches,
  changes,
  versionDiffs,
  versions,
  currentVersion,
  selectedVersion,
  onVersionChange,
  title,
  trailing,
}: EncounterLibraryProps) {
  const serviceText = getCodexServiceMessages(serviceLocale);
  const urlEncounterId = useHydrationSafeSearchParam("encounter");
  const [selectedRoomTypes, setSelectedRoomTypes] = useState<Set<EncounterRoomType>>(new Set());
  const [selectedActs, setSelectedActs] = useState<Set<string>>(new Set());
  const [selectedFormationCounts, setSelectedFormationCounts] = useState<Set<number>>(new Set());
  const [showWeakOnly, setShowWeakOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [internalSelectedVersion, setInternalSelectedVersion] = useState(currentVersion ?? "");
  const [roomTypeSortDir, setRoomTypeSortDir] = useState<FilterSortDir>("asc");
  const [actSortDir, setActSortDir] = useState<FilterSortDir>("asc");
  const activeVersion = selectedVersion ?? internalSelectedVersion;
  const setActiveVersion = onVersionChange ?? setInternalSelectedVersion;
  const versionedEncounters = useMemo(() => {
    return versionCodexEntities(encounters, "encounter", {
      selectedVersion: activeVersion,
      currentVersion,
      versionDiffs,
      patches,
      changes,
    });
  }, [encounters, activeVersion, currentVersion, versionDiffs, patches, changes]);
  const versionedMonsters = useMemo(() => {
    return versionCodexEntities(monsters, "monster", {
      selectedVersion: activeVersion,
      currentVersion,
      versionDiffs,
      patches,
      changes,
    });
  }, [monsters, activeVersion, currentVersion, versionDiffs, patches, changes]);

  // Monster lookup
  const monsterById = useMemo(
    () => new Map(versionedMonsters.map((m) => [m.id, m])),
    [versionedMonsters],
  );
  const formationCountByEncounterId = useMemo(
    () => new Map(versionedEncounters.map((encounter) => [
      encounter.id,
      getEncounterFormationCount(encounter),
    ])),
    [versionedEncounters],
  );
  const formationCountOptions = useMemo(() => {
    const encounterCounts = new Map<number, number>();
    for (const count of formationCountByEncounterId.values()) {
      if (count < 1) continue;
      encounterCounts.set(count, (encounterCounts.get(count) ?? 0) + 1);
    }
    return Array.from(encounterCounts, ([formationCount, encounterCount]) => ({
      formationCount,
      encounterCount,
    })).sort((a, b) => a.formationCount - b.formationCount);
  }, [formationCountByEncounterId]);
  const searchText = useMemo(() => searchQuery.trim().toLowerCase(), [searchQuery]);

  // Detail modal
  const [selectedEncounterOverride, setSelectedEncounterOverride] = useState<CodexEncounter | null>(null);
  const [useUrlSelection, setUseUrlSelection] = useState(true);
  const urlSelectedEncounter = useMemo(() => (
    urlEncounterId
      ? versionedEncounters.find((e) => e.id.toLowerCase() === urlEncounterId.toLowerCase()) ?? null
      : null
  ), [urlEncounterId, versionedEncounters]);
  const selectedEncounter = useUrlSelection ? urlSelectedEncounter : selectedEncounterOverride;

  const selectEncounter = useCallback((encounter: CodexEncounter) => {
    setUseUrlSelection(false);
    setSelectedEncounterOverride(encounter);
  }, [setSelectedEncounterOverride, setUseUrlSelection]);

  const closeSelectedEncounter = useCallback(() => {
    setUseUrlSelection(false);
    setSelectedEncounterOverride(null);
  }, [setSelectedEncounterOverride, setUseUrlSelection]);

  // URL sync
  useEffect(() => {
    if (useUrlSelection) return;
    const url = new URL(window.location.href);
    if (selectedEncounterOverride) {
      url.searchParams.set("encounter", selectedEncounterOverride.id.toLowerCase());
    } else {
      url.searchParams.delete("encounter");
    }
    if (url.toString() !== window.location.href) {
      pushCodexHistoryState(url);
    }
  }, [selectedEncounterOverride, useUrlSelection]);

  // Browser back
  useEffect(() => {
    const handler = () => {
      setUseUrlSelection(true);
      setSelectedEncounterOverride(null);
    };
    return addCodexUrlChangeListener(handler);
  }, []);

  // Escape to close
  useEffect(() => {
    if (!selectedEncounter) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSelectedEncounter();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [closeSelectedEncounter, selectedEncounter]);

  // Filter
  const filtered = useMemo(() => {
    let result = versionedEncounters;

    if (selectedRoomTypes.size > 0) {
      result = result.filter((e) => selectedRoomTypes.has(e.roomType));
    }
    if (selectedActs.size > 0) {
      result = result.filter((e) => selectedActs.has(e.act ?? "none"));
    }
    if (selectedFormationCounts.size > 0) {
      result = result.filter((encounter) => selectedFormationCounts.has(
        formationCountByEncounterId.get(encounter.id) ?? 0,
      ));
    }
    if (showWeakOnly) {
      result = result.filter((e) => e.isWeak);
    }

    if (searchText) {
      result = result.filter(
        (e) =>
          fuzzyMatchCodexText(e.name, searchText) ||
          fuzzyMatchCodexText(e.nameEn, searchText) ||
          e.monsters.some(
            (m) =>
              fuzzyMatchCodexText(m.name, searchText) ||
              fuzzyMatchCodexText(m.nameEn, searchText),
          ),
      );
    }

    return result;
  }, [
    versionedEncounters,
    selectedRoomTypes,
    selectedActs,
    selectedFormationCounts,
    formationCountByEncounterId,
    showWeakOnly,
    searchText,
  ]);

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

  // Group by act
  const sections = useMemo(() => {
    const ACT_ORDER_WITH_NULL = orderByFilterSortDir(EVENT_ACT_ORDER, actSortDir);
    return ACT_ORDER_WITH_NULL.map((act) => {
      const actKey = act ?? "none";
      const config = act ? EVENT_ACT_CONFIG[act] : EVENT_ACT_UNKNOWN;
      const actEncounters = filtered
        .filter((e) => (e.act ?? "none") === actKey)
        .sort((a, b) => {
          // Sort: weak first, then by room type order, then by name
          const roomOrder = roomTypeSortDir === "asc"
            ? ROOM_TYPE_ORDER.indexOf(a.roomType) - ROOM_TYPE_ORDER.indexOf(b.roomType)
            : ROOM_TYPE_ORDER.indexOf(b.roomType) - ROOM_TYPE_ORDER.indexOf(a.roomType);
          if (roomOrder !== 0) return roomOrder;
          if (a.isWeak !== b.isWeak) return a.isWeak ? 1 : -1;
          return a.name.localeCompare(b.name, "ko");
        });
      return {
        act,
        actKey,
        config,
        label: getActLabel(act, serviceText, gameUi),
        encounters: actEncounters,
      };
    }).filter((s) => s.encounters.length > 0);
  }, [filtered, gameUi, serviceText, actSortDir, roomTypeSortDir]);

  const { sidebarOpen, setSidebarOpen, isMobile } = useCodexFilterDrawer();

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

        {/* Room Type Filters */}
        <FilterSection trigger="#" label={serviceText.encountersView.roomTypeFilter} sortDir={roomTypeSortDir} onSortToggle={() => setRoomTypeSortDir(toggleFilterSortDir)} sortTitle={serviceText.common.sortButtonTitle}>
          <div className="flex flex-col gap-0.5">
            {orderByFilterSortDir(ROOM_TYPE_ORDER, roomTypeSortDir).map((type) => {
              const config = ENCOUNTER_ROOM_TYPE_CONFIG[type];
              return (
                <button
                  key={type}
                  onClick={() => setSelectedRoomTypes((prev) => {
                    const next = new Set(prev);
                    if (next.has(type)) next.delete(type); else next.add(type);
                    return next;
                  })}
                  className={`flex items-center gap-2 text-left text-sm px-2.5 py-1 rounded transition-all ${
                    selectedRoomTypes.has(type)
                      ? "bg-yellow-500/20 text-yellow-400"
                      : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
                  }`}
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: config.color }} />
                  {gameUi.encounterRoomTypes[type]}
                </button>
              );
            })}
          </div>
        </FilterSection>

        <div className="border-t border-white/10" />

        {/* Act Filters */}
        <FilterSection trigger="%" label={serviceText.encountersView.actFilter} sortDir={actSortDir} onSortToggle={() => setActSortDir(toggleFilterSortDir)} sortTitle={serviceText.common.sortButtonTitle}>
          <div className="flex flex-col gap-0.5">
            {orderByFilterSortDir(EVENT_ACT_ORDER, actSortDir).map((act) => {
              const config = act ? EVENT_ACT_CONFIG[act] : EVENT_ACT_UNKNOWN;
              const key = act ?? "none";
              return (
                <button
                  key={key}
                  onClick={() => setSelectedActs((prev) => {
                    const next = new Set(prev);
                    if (next.has(key)) next.delete(key); else next.add(key);
                    return next;
                  })}
                  className={`flex items-center gap-2 text-left text-sm px-2.5 py-1 rounded transition-all ${
                    selectedActs.has(key)
                      ? "bg-yellow-500/20 text-yellow-400"
                      : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
                  }`}
                >
                  <span className={act ? config.color : "text-zinc-400"}>
                    {getActLabel(act, serviceText, gameUi)}
                  </span>
                </button>
              );
            })}
          </div>
        </FilterSection>

        <div className="border-t border-white/10" />

        {formationCountOptions.length > 0 &&
          formationCountOptions.length <= MAX_INDIVIDUAL_FORMATION_COUNT_FILTERS && (
          <>
            <FilterSection label={serviceText.encountersView.formationCountFilter}>
              <div className="flex flex-col gap-0.5">
                {formationCountOptions.map(({ formationCount, encounterCount }) => (
                  <GameCheckboxToggle
                    key={formationCount}
                    checked={selectedFormationCounts.has(formationCount)}
                    onCheckedChange={() => setSelectedFormationCounts((previous) => {
                      const next = new Set(previous);
                      if (next.has(formationCount)) next.delete(formationCount);
                      else next.add(formationCount);
                      return next;
                    })}
                    label={(
                      <span className="flex items-baseline gap-1.5">
                        <span>{formationCount}</span>
                        <span className="font-game-text text-xs text-[#d1b667]">({encounterCount})</span>
                      </span>
                    )}
                    size="sm"
                    className="w-full"
                    labelClassName="text-sm"
                  />
                ))}
              </div>
            </FilterSection>

            <div className="border-t border-white/10" />
          </>
        )}

        {/* Weak toggle */}
        <button
          onClick={() => setShowWeakOnly((v) => !v)}
          className={`flex items-center gap-2 text-left text-sm px-2.5 py-1 rounded transition-all ${
            showWeakOnly
              ? "bg-green-500/20 text-green-400"
              : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
          }`}
        >
          <span className="w-2 h-2 rounded-full shrink-0 bg-green-500" />
          {serviceText.encountersView.weakOnly}
        </button>
        </>
      )}
    >

      {/* Main */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <CodexLibraryTopBar
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          closeFiltersLabel={serviceText.common.closeFilters}
          openFiltersLabel={serviceText.common.openFilters}
          title={title ?? serviceText.encountersView.title}
          count={formatCodexCount(filtered.length, serviceText.labels.encounters, serviceLocale)}
          trailing={topBarTrailing}
        />

        {/* Encounter List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {sections.map((section) => (
            <div key={section.actKey} className="mb-8 last:mb-0">
              <div className="mb-3">
                <span className={`font-game-title text-lg font-bold ${section.config.color}`}>
                  {section.label}
                </span>
                <span className="ml-2 text-xs text-gray-600">({section.encounters.length})</span>
              </div>

              <div className="flex flex-col gap-2">
                {section.encounters.map((enc) => (
                  <EncounterTile
                    key={enc.id}
                    encounter={enc}
                    monsterById={monsterById}
                    messages={serviceText}
                    gameUi={gameUi}
                    formationCount={formationCountByEncounterId.get(enc.id) ?? 0}
                    onClick={() => selectEncounter(enc)}
                  />
                ))}
              </div>
            </div>
          ))}

          {sections.length === 0 && (
            <div className="flex items-center justify-center h-64 text-gray-500">{serviceText.common.noResults}</div>
          )}
        </div>
      </main>

      {/* Detail Modal */}
      {selectedEncounter && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeSelectedEncounter();
          }}
        >
          <div className="my-8 mx-4 w-full max-w-6xl">
            <EncounterDetail
              serviceLocale={serviceLocale}
              gameUi={gameUi}
              backToListTitle={serviceText.encountersView.backToList}
              encounter={selectedEncounter}
              characters={characters}
              monsters={versionedMonsters}
              patches={patches}
              changes={changes}
              onClose={closeSelectedEncounter}
            />
          </div>
        </div>
      )}
    </CodexLibraryShell>
  );
}

// Encounter tile in list
function EncounterTile({
  encounter,
  monsterById,
  messages,
  gameUi,
  formationCount,
  onClick,
}: {
  encounter: CodexEncounter;
  monsterById: Map<string, CodexMonster>;
  messages: CodexServiceMessages;
  gameUi: CodexGameUiLabels;
  formationCount: number;
  onClick: () => void;
}) {
  const roomConfig = ENCOUNTER_ROOM_TYPE_CONFIG[encounter.roomType];

  // Deduplicate monster display (some encounters list same monster multiple times)
  const uniqueMonsters = Array.from(
    new Map(encounter.monsters.map((m) => [m.id, m])).values(),
  );

  return (
    <button
      onClick={onClick}
      className={`group flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2.5 text-left transition-all hover:border-yellow-500/40 hover:bg-white/10 ${
        encounter.deprecated ? "opacity-50 grayscale saturate-0" : ""
      }`}
    >
      <div className="flex shrink-0 items-center -space-x-1">
        {uniqueMonsters.slice(0, 4).map((monsterRef) => (
          <EncounterMonsterThumbnail
            key={monsterRef.id}
            monster={monsterById.get(monsterRef.id)}
            name={monsterRef.name}
          />
        ))}
        {uniqueMonsters.length > 4 && (
          <div className="flex h-9 w-7 items-center justify-center">
            <span className="font-game-text text-[9px] text-gray-500">
              +{uniqueMonsters.length - 4}
            </span>
          </div>
        )}
      </div>

      {/* Name + meta */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-game-title text-sm font-medium text-gray-100 truncate">{encounter.name}</span>
          <span className="font-game-text text-[10px] text-gray-500 truncate">{encounter.nameEn}</span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span
            className="font-game-text text-[10px] font-medium px-1.5 py-0.5 rounded"
            style={{ backgroundColor: `${roomConfig.color}20`, color: roomConfig.color }}
          >
            {gameUi.encounterRoomTypes[encounter.roomType]}
          </span>
          {encounter.isWeak && (
            <span className="text-[10px] text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded">{messages.encountersView.weakEncounter}</span>
          )}
          {encounter.tags?.map((tag) => (
            <span key={tag} className="text-[10px] text-gray-500 bg-white/5 px-1.5 py-0.5 rounded">{tag}</span>
          ))}
        </div>
      </div>

      {/* Monster names */}
      <div className="hidden sm:flex flex-wrap gap-1 shrink-0 max-w-48">
        {formationCount > 1 && (
          <span className="rounded bg-amber-500/10 px-1.5 py-0.5 font-game-text text-[10px] text-amber-200">
            {messages.encountersView.formationCount.replace("{count}", String(formationCount))}
          </span>
        )}
      </div>
    </button>
  );
}

function getEncounterFormationCount(encounter: CodexEncounter): number {
  return expandEncounterFormations(encounter).length;
}

function EncounterMonsterThumbnail({
  monster,
  name,
}: {
  monster: CodexMonster | undefined;
  name: string;
}) {
  const [hoverMoveId, setHoverMoveId] = useState<string | null | undefined>(undefined);
  const imageUrl = monster?.imageUrl ?? monster?.bossImageUrl ?? null;
  const hovering = hoverMoveId !== undefined;

  return (
    <div
      className="relative flex h-9 w-9 items-center justify-center overflow-hidden"
      title={name}
      onMouseEnter={() => setHoverMoveId(monster ? pickRandomMonsterPreviewMoveId(monster) : null)}
      onMouseLeave={() => setHoverMoveId(undefined)}
    >
      {imageUrl && (
        <Image
          src={imageUrl}
          alt={name}
          width={36}
          height={36}
          loading="lazy"
          className={`h-9 w-9 object-contain drop-shadow-[0_7px_8px_rgba(0,0,0,0.6)] transition-opacity ${
            hovering && monster?.spineAsset ? "opacity-0" : "opacity-100"
          }`}
        />
      )}
      {hovering && monster?.spineAsset && (
        <MonsterSpineStage
          asset={monster.spineAsset}
          fallbackImageUrl={imageUrl}
          monsterName={monster.name}
          selectedMoveId={hoverMoveId}
          imagePriority={false}
          showLoadingLabel={false}
          className="absolute inset-0"
        />
      )}
      {!imageUrl && !monster?.spineAsset && (
        <span className="font-game-title text-[10px] text-gray-500">{name.slice(0, 1)}</span>
      )}
    </div>
  );
}

function getActLabel(
  act: CodexEncounter["act"],
  messages: CodexServiceMessages,
  gameUi: CodexGameUiLabels,
): string {
  return act ? gameUi.acts[act] : messages.labels.acts.none;
}
