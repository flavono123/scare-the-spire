"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Image from "@/components/ui/static-image";
import type { ServiceLocale } from "@/lib/i18n";
import type { CodexGameUiLabels } from "@/lib/codex-game-ui";
import type { STS2Change, STS2Patch } from "@/lib/types";
import {
  formatCodexCount,
  getCodexServiceMessages,
  type CodexServiceMessages,
} from "@/lib/codex-service";
import {
  CodexEncounter,
  CodexMonster,
  EncounterRoomType,
  ENCOUNTER_ROOM_TYPE_CONFIG,
  EVENT_ACT_CONFIG,
  EVENT_ACT_UNKNOWN,
  EVENT_ACT_ORDER,
  EVENT_ACT_ALIASES,
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
import { EncounterDetail } from "./encounter-detail";

// Room type display order and styling
const ROOM_TYPE_ORDER: EncounterRoomType[] = ["Monster", "Elite", "Boss"];
type EncounterSearchTokenType = "roomType" | "act";

const ENCOUNTER_ROOM_TYPE_ALIASES: Record<string, EncounterRoomType> = {
  일반: "Monster",
  monster: "Monster",
  normal: "Monster",
  몬스터: "Monster",
  엘리트: "Elite",
  elite: "Elite",
  보스: "Boss",
  boss: "Boss",
};

interface EncounterLibraryProps {
  serviceLocale: ServiceLocale;
  gameUi: CodexGameUiLabels;
  encounters: CodexEncounter[];
  monsters: CodexMonster[];
  patches?: STS2Patch[];
  changes?: STS2Change[];
  title?: string;
  trailing?: React.ReactNode;
}

export function EncounterLibrary({
  serviceLocale,
  gameUi,
  encounters,
  monsters,
  patches,
  changes,
  title,
  trailing,
}: EncounterLibraryProps) {
  const serviceText = getCodexServiceMessages(serviceLocale);
  const searchParams = useSearchParams();
  const [selectedRoomTypes, setSelectedRoomTypes] = useState<Set<EncounterRoomType>>(new Set());
  const [selectedActs, setSelectedActs] = useState<Set<string>>(new Set());
  const [showWeakOnly, setShowWeakOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Monster lookup
  const monsterById = useMemo(
    () => new Map(monsters.map((m) => [m.id, m])),
    [monsters],
  );
  const encounterTriggers = useMemo(
    () => getEncounterTriggers(serviceText, gameUi),
    [serviceText, gameUi],
  );
  const parsedSearch = useMemo(
    () => parseCodexSearch(searchQuery, encounterTriggers),
    [searchQuery, encounterTriggers],
  );

  // Detail modal
  const initialEncId = searchParams.get("encounter");
  const [selectedEncounter, setSelectedEncounter] = useState<CodexEncounter | null>(() => {
    if (!initialEncId) return null;
    return encounters.find((e) => e.id.toLowerCase() === initialEncId.toLowerCase()) ?? null;
  });

  // URL sync
  useEffect(() => {
    const url = new URL(window.location.href);
    if (selectedEncounter) {
      url.searchParams.set("encounter", selectedEncounter.id.toLowerCase());
    } else {
      url.searchParams.delete("encounter");
    }
    if (url.toString() !== window.location.href) {
      window.history.pushState(null, "", url.toString());
    }
  }, [selectedEncounter]);

  // Browser back
  useEffect(() => {
    const handler = () => {
      const url = new URL(window.location.href);
      const param = url.searchParams.get("encounter");
      if (!param) {
        setSelectedEncounter(null);
      } else {
        setSelectedEncounter(encounters.find((e) => e.id.toLowerCase() === param.toLowerCase()) ?? null);
      }
    };
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, [encounters]);

  // Escape to close
  useEffect(() => {
    if (!selectedEncounter) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedEncounter(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedEncounter]);

  // Filter
  const filtered = useMemo(() => {
    let result = encounters;

    if (selectedRoomTypes.size > 0) {
      result = result.filter((e) => selectedRoomTypes.has(e.roomType));
    }
    if (selectedActs.size > 0) {
      result = result.filter((e) => selectedActs.has(e.act ?? "none"));
    }
    if (showWeakOnly) {
      result = result.filter((e) => e.isWeak);
    }

    for (const token of parsedSearch.tokens) {
      if (token.type === "roomType") {
        result = result.filter((e) => e.roomType === token.value);
      } else if (token.type === "act") {
        result = result.filter((e) => (e.act ?? "none") === token.value);
      }
    }

    if (parsedSearch.text) {
      result = result.filter(
        (e) =>
          fuzzyMatchCodexText(e.name, parsedSearch.text) ||
          fuzzyMatchCodexText(e.nameEn, parsedSearch.text) ||
          e.monsters.some(
            (m) =>
              fuzzyMatchCodexText(m.name, parsedSearch.text) ||
              fuzzyMatchCodexText(m.nameEn, parsedSearch.text),
          ),
      );
    }

    return result;
  }, [encounters, selectedRoomTypes, selectedActs, showWeakOnly, parsedSearch]);

  // Group by act
  const sections = useMemo(() => {
    const ACT_ORDER_WITH_NULL = [...EVENT_ACT_ORDER];
    return ACT_ORDER_WITH_NULL.map((act) => {
      const actKey = act ?? "none";
      const config = act ? EVENT_ACT_CONFIG[act] : EVENT_ACT_UNKNOWN;
      const actEncounters = filtered
        .filter((e) => (e.act ?? "none") === actKey)
        .sort((a, b) => {
          // Sort: weak first, then by room type order, then by name
          const roomOrder = ROOM_TYPE_ORDER.indexOf(a.roomType) - ROOM_TYPE_ORDER.indexOf(b.roomType);
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
  }, [filtered, gameUi, serviceText]);

  const { sidebarOpen, setSidebarOpen, isMobile } = useCodexFilterDrawer();

  return (
    <CodexLibraryShell
      sidebarOpen={sidebarOpen}
      setSidebarOpen={setSidebarOpen}
      isMobile={isMobile}
      sidebar={(
        <>
        {/* Room Type Filters */}
        <FilterSection trigger="#" label={serviceText.encountersView.roomTypeFilter}>
          <div className="flex flex-col gap-0.5">
            {ROOM_TYPE_ORDER.map((type) => {
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
        <FilterSection trigger="%" label={serviceText.encountersView.actFilter}>
          <div className="flex flex-col gap-0.5">
            {EVENT_ACT_ORDER.map((act) => {
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
          search={(
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              inputId="encounter-search"
              triggerGroups={encounterTriggers}
              placeholder={serviceText.encountersView.searchPlaceholder}
            />
          )}
          count={formatCodexCount(filtered.length, serviceText.labels.encounters, serviceLocale)}
          trailing={trailing}
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
                    onClick={() => setSelectedEncounter(enc)}
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
            if (e.target === e.currentTarget) setSelectedEncounter(null);
          }}
        >
          <div className="my-8 mx-4 w-full max-w-6xl">
            <EncounterDetail
              serviceLocale={serviceLocale}
              gameUi={gameUi}
              backToListTitle={serviceText.encountersView.backToList}
              encounter={selectedEncounter}
              monsters={monsters}
              patches={patches}
              changes={changes}
              onClose={() => setSelectedEncounter(null)}
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
  onClick,
}: {
  encounter: CodexEncounter;
  monsterById: Map<string, CodexMonster>;
  messages: CodexServiceMessages;
  gameUi: CodexGameUiLabels;
  onClick: () => void;
}) {
  const roomConfig = ENCOUNTER_ROOM_TYPE_CONFIG[encounter.roomType];
  const representativeImageUrl = getRepresentativeEncounterImageUrl(encounter.imageUrl);

  // Deduplicate monster display (some encounters list same monster multiple times)
  const uniqueMonsters = Array.from(
    new Map(encounter.monsters.map((m) => [m.id, m])).values(),
  );

  return (
    <button
      onClick={onClick}
      className="group flex items-center gap-3 px-3 py-2.5 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/10 hover:border-yellow-500/40 transition-all text-left"
    >
      {representativeImageUrl ? (
        <div className="flex h-10 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-white/10 bg-white/[0.03]">
          <Image
            src={representativeImageUrl}
            alt={encounter.name}
            width={96}
            height={48}
            loading="lazy"
            className="h-full w-full object-contain"
          />
        </div>
      ) : (
        <div className="flex -space-x-2 shrink-0">
          {uniqueMonsters.slice(0, 4).map((mRef) => {
            const monster = monsterById.get(mRef.id);
            const imgUrl = monster?.imageUrl ?? monster?.bossImageUrl;
            return imgUrl ? (
              <div key={mRef.id} className="w-8 h-8 rounded-full overflow-hidden bg-white/5 border-2 border-[#1a1a2e]">
                <Image src={imgUrl} alt={mRef.name} width={32} height={32} loading="lazy" className="w-8 h-8 object-contain" />
              </div>
            ) : (
              <div key={mRef.id} className="w-8 h-8 rounded-full bg-white/10 border-2 border-[#1a1a2e] flex items-center justify-center">
                <span className="text-[9px] text-gray-500">{mRef.name[0]}</span>
              </div>
            );
          })}
          {uniqueMonsters.length > 4 && (
            <div className="w-8 h-8 rounded-full bg-white/10 border-2 border-[#1a1a2e] flex items-center justify-center">
              <span className="text-[9px] text-gray-500">+{uniqueMonsters.length - 4}</span>
            </div>
          )}
        </div>
      )}

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
        {uniqueMonsters.map((m) => (
          <span key={m.id} className="font-game-text text-[10px] text-gray-400 bg-white/5 px-1.5 py-0.5 rounded">{m.name}</span>
        ))}
      </div>
    </button>
  );
}

function getRepresentativeEncounterImageUrl(imageUrl: string | null): string | null {
  if (!imageUrl) return null;
  return imageUrl.includes("/encounters-render/") || imageUrl.includes("/monsters-render/")
    ? imageUrl
    : null;
}

function getEncounterTriggers(
  messages: CodexServiceMessages,
  gameUi: CodexGameUiLabels,
): CodexSearchTriggerGroup<EncounterSearchTokenType>[] {
  return [
    {
      trigger: "#",
      type: "roomType",
      label: messages.encountersView.roomTypeFilter,
      items: ROOM_TYPE_ORDER.map((roomType) => ({
        value: roomType.toLowerCase(),
        label: gameUi.encounterRoomTypes[roomType],
        desc: roomType,
      })),
      validate: (val) => ENCOUNTER_ROOM_TYPE_ALIASES[val] ?? null,
      chipColor: "bg-green-500/20 text-green-400",
    },
    {
      trigger: "%",
      type: "act",
      label: messages.encountersView.actFilter,
      items: [
        { value: "act1", label: gameUi.acts["Act 1 - Overgrowth"], desc: "Act 1 Overgrowth" },
        { value: "underdocks", label: gameUi.acts.Underdocks, desc: "Underdocks" },
        { value: "act2", label: gameUi.acts["Act 2 - Hive"], desc: "Act 2 Hive" },
        { value: "act3", label: gameUi.acts["Act 3 - Glory"], desc: "Act 3 Glory" },
        { value: "none", label: messages.labels.acts.none, desc: "Any act" },
      ],
      validate: (val) => EVENT_ACT_ALIASES[val] ?? null,
      chipColor: "bg-blue-500/20 text-blue-400",
    },
  ];
}

function getActLabel(
  act: CodexEncounter["act"],
  messages: CodexServiceMessages,
  gameUi: CodexGameUiLabels,
): string {
  return act ? gameUi.acts[act] : messages.labels.acts.none;
}
