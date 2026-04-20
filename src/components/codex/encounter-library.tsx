"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { CommentSection } from "@/components/comment-section";
import { buildCodexCommentThreadKey } from "@/lib/comment-threads";
import { DescriptionText } from "./codex-description";
import {
  CodexEncounter,
  CodexMonster,
  EncounterRoomType,
  ENCOUNTER_ROOM_TYPE_CONFIG,
  EVENT_ACT_CONFIG,
  EVENT_ACT_UNKNOWN,
  EVENT_ACT_ORDER,
} from "@/lib/codex-types";

// Room type display order and styling
const ROOM_TYPE_ORDER: EncounterRoomType[] = ["Monster", "Elite", "Boss"];

interface EncounterLibraryProps {
  encounters: CodexEncounter[];
  monsters: CodexMonster[];
}

export function EncounterLibrary({ encounters, monsters }: EncounterLibraryProps) {
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
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.nameEn.toLowerCase().includes(q) ||
          e.monsters.some((m) => m.name.toLowerCase().includes(q) || m.nameEn.toLowerCase().includes(q)),
      );
    }

    return result;
  }, [encounters, selectedRoomTypes, selectedActs, showWeakOnly, searchQuery]);

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
      return { act, actKey, config, encounters: actEncounters };
    }).filter((s) => s.encounters.length > 0);
  }, [filtered]);

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

  return (
    <div className="flex h-[calc(100dvh-3rem)] bg-background text-foreground overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && isMobile && (
        <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`
          border-r border-white/10 bg-[#16162a] flex flex-col gap-2 overflow-y-auto transition-all duration-200 shrink-0
          ${isMobile
            ? `fixed z-50 inset-y-0 left-0 w-52 ${sidebarOpen ? "translate-x-0 p-3" : "-translate-x-full p-3"}`
            : `relative ${sidebarOpen ? "w-52 p-3" : "w-0 p-0 overflow-hidden border-r-0"}`
          }
        `}
      >
        {/* Room Type Filters */}
        <FilterSection label="전투 유형">
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
                  {config.label}
                </button>
              );
            })}
          </div>
        </FilterSection>

        <div className="border-t border-white/10" />

        {/* Act Filters */}
        <FilterSection label="등장 막">
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
                  <span className={act ? config.color : "text-zinc-400"}>{config.labelKo}</span>
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
          쉬운 전투만
        </button>
      </aside>

      {/* Main */}
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
          <h1 className="text-base font-bold text-yellow-500 shrink-0">전투 도감</h1>
          <div className="flex-1 max-w-xl mx-auto">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="전투 또는 몬스터 검색..."
              className="w-full bg-white/5 border border-white/10 rounded-lg pl-3 pr-3 py-1.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-yellow-500/50 focus:ring-1 focus:ring-yellow-500/30 transition-all"
            />
          </div>
          <span className="text-sm text-gray-500 shrink-0 tabular-nums">{filtered.length}건</span>
        </div>

        {/* Encounter List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {sections.map((section) => (
            <div key={section.actKey} className="mb-8 last:mb-0">
              <div className="mb-3">
                <span className={`text-lg font-bold font-[family-name:var(--font-spectral)] ${section.config.color}`}>
                  {section.config.labelKo}
                </span>
                <span className="ml-2 text-xs text-gray-600">({section.encounters.length})</span>
              </div>

              <div className="flex flex-col gap-2">
                {section.encounters.map((enc) => (
                  <EncounterTile
                    key={enc.id}
                    encounter={enc}
                    monsterById={monsterById}
                    onClick={() => setSelectedEncounter(enc)}
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

      {/* Detail Modal */}
      {selectedEncounter && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedEncounter(null);
          }}
        >
          <div className="w-full max-w-2xl my-8 mx-4 bg-[#1a1a2e] rounded-xl border border-white/10 shadow-2xl">
            <EncounterDetail
              encounter={selectedEncounter}
              monsterById={monsterById}
              onClose={() => setSelectedEncounter(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Encounter tile in list
function EncounterTile({
  encounter,
  monsterById,
  onClick,
}: {
  encounter: CodexEncounter;
  monsterById: Map<string, CodexMonster>;
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
      className="group flex items-center gap-3 px-3 py-2.5 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/10 hover:border-yellow-500/40 transition-all text-left"
    >
      {/* Monster portraits */}
      <div className="flex -space-x-2 shrink-0">
        {uniqueMonsters.slice(0, 4).map((mRef) => {
          const monster = monsterById.get(mRef.id);
          const imgUrl = monster?.imageUrl ?? monster?.bossImageUrl;
          return imgUrl ? (
            <div key={mRef.id} className="w-8 h-8 rounded-full overflow-hidden bg-white/5 border-2 border-[#1a1a2e]">
              <Image src={imgUrl} alt={mRef.name} width={32} height={32} className="w-8 h-8 object-contain" />
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

      {/* Name + meta */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-gray-100 truncate">{encounter.name}</span>
          <span className="text-[10px] text-gray-500 truncate">{encounter.nameEn}</span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span
            className="text-[10px] font-medium px-1.5 py-0.5 rounded"
            style={{ backgroundColor: `${roomConfig.color}20`, color: roomConfig.color }}
          >
            {roomConfig.label}
          </span>
          {encounter.isWeak && (
            <span className="text-[10px] text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded">쉬운 전투</span>
          )}
          {encounter.tags?.map((tag) => (
            <span key={tag} className="text-[10px] text-gray-500 bg-white/5 px-1.5 py-0.5 rounded">{tag}</span>
          ))}
        </div>
      </div>

      {/* Monster names */}
      <div className="hidden sm:flex flex-wrap gap-1 shrink-0 max-w-48">
        {uniqueMonsters.map((m) => (
          <span key={m.id} className="text-[10px] text-gray-400 bg-white/5 px-1.5 py-0.5 rounded">{m.name}</span>
        ))}
      </div>
    </button>
  );
}

// Encounter detail modal content
function EncounterDetail({
  encounter,
  monsterById,
  onClose,
}: {
  encounter: CodexEncounter;
  monsterById: Map<string, CodexMonster>;
  onClose: () => void;
}) {
  const roomConfig = ENCOUNTER_ROOM_TYPE_CONFIG[encounter.roomType];
  const actConfig = encounter.act ? EVENT_ACT_CONFIG[encounter.act] : EVENT_ACT_UNKNOWN;

  const uniqueMonsters = Array.from(
    new Map(encounter.monsters.map((m) => [m.id, m])).values(),
  );

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between w-full">
        <Link
          href="/codex/encounters"
          className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
          onClick={(e) => { e.preventDefault(); onClose(); }}
        >
          ← 전투 도감
        </Link>
        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-gray-400" aria-label="닫기">
          ✕
        </button>
      </div>

      {/* Title */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-100">{encounter.name}</h1>
        <p className="text-sm text-gray-500">{encounter.nameEn}</p>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap justify-center gap-2">
        <span className="text-xs font-medium px-2.5 py-1 rounded-lg" style={{ backgroundColor: `${roomConfig.color}20`, color: roomConfig.color }}>
          {roomConfig.label}
        </span>
        <span className={`text-xs px-2.5 py-1 rounded-lg ${actConfig.bg} ${actConfig.color}`}>
          {actConfig.labelKo}
        </span>
        {encounter.isWeak && (
          <span className="text-xs text-green-400 bg-green-500/10 px-2.5 py-1 rounded-lg">쉬운 전투</span>
        )}
        {encounter.tags?.map((tag) => (
          <span key={tag} className="text-xs text-gray-400 bg-white/5 px-2.5 py-1 rounded-lg">{tag}</span>
        ))}
      </div>

      {/* Monster Composition */}
      <div className="w-full bg-white/5 border border-white/10 rounded-lg p-4">
        <h2 className="text-sm font-bold text-gray-300 mb-3">몬스터 구성</h2>
        <div className="flex flex-col gap-2">
          {uniqueMonsters.map((mRef) => {
            const monster = monsterById.get(mRef.id);
            const imgUrl = monster?.imageUrl ?? monster?.bossImageUrl;

            return (
              <Link
                key={mRef.id}
                href={`/codex/monsters/${mRef.id.toLowerCase()}`}
                className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/5 hover:bg-white/10 hover:border-yellow-500/30 transition-all"
              >
                {imgUrl ? (
                  <div className="w-10 h-10 shrink-0 rounded overflow-hidden bg-white/5 flex items-center justify-center">
                    <Image src={imgUrl} alt={mRef.name} width={40} height={40} className="w-10 h-10 object-contain" />
                  </div>
                ) : (
                  <div className="w-10 h-10 shrink-0 rounded bg-white/10 flex items-center justify-center">
                    <span className="text-xs text-gray-500">{mRef.name[0]}</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-gray-100">{mRef.name}</span>
                  <span className="ml-1.5 text-[10px] text-gray-500">{mRef.nameEn}</span>
                  {monster && (
                    <div className="flex items-center gap-2 mt-0.5">
                      {monster.minHp != null && monster.minHp !== 9999 && (
                        <span className="text-[10px] text-gray-500">
                          HP {monster.minHp}{monster.maxHp != null && monster.maxHp !== monster.minHp ? `-${monster.maxHp}` : ""}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-gray-600">→</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Loss Text */}
      <div className="w-full bg-white/5 border border-white/10 rounded-lg p-4">
        <h2 className="text-sm font-bold text-gray-300 mb-2">패배 시</h2>
        <div className="text-sm text-gray-400 italic">
          <DescriptionText description={encounter.lossText} />
        </div>
      </div>

      <div className="w-full bg-white/5 border border-white/10 rounded-lg p-4">
        <h2 className="text-sm font-bold text-gray-300 mb-3">댓글</h2>
        <CommentSection threadKey={buildCodexCommentThreadKey("encounter", encounter.id)} />
      </div>
    </div>
  );
}

function FilterSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] text-gray-500 font-medium uppercase tracking-wider">{label}</span>
      {children}
    </div>
  );
}
