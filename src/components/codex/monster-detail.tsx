"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "@/components/ui/static-image";
import Link from "next/link";
import { CommentSection } from "@/components/comment-section";
import { buildCodexCommentThreadKey } from "@/lib/comment-threads";
import type { ServiceLocale } from "@/lib/i18n";
import { localizeHref } from "@/lib/i18n";
import type { CodexGameUiLabels } from "@/lib/codex-game-ui";
import { serviceMessages } from "@/messages/service";
import type {
  CodexMonster,
  CodexEncounter,
  DamageValue,
  MonsterMove,
  MonsterMoveTransition,
} from "@/lib/codex-types";
import {
  MONSTER_TYPE_CONFIG,
  EVENT_ACT_CONFIG,
  ENCOUNTER_ROOM_TYPE_CONFIG,
} from "@/lib/codex-types";
import { DescriptionText } from "./codex-description";

type MoveTone = "attack" | "defense" | "mixed" | "setup";

interface MoveSummary {
  move: MonsterMove;
  damageEntry: DamageValue | null;
  blockEntry: number | null;
  outgoing: MonsterMoveTransition[];
  tone: MoveTone;
}

function StatBadge({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
      <span className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</span>
      <span className="text-sm font-bold" style={color ? { color } : undefined}>{value}</span>
    </div>
  );
}

function MoveMetricChips({
  summary,
  damageLabel,
  blockLabel,
}: {
  summary: MoveSummary;
  damageLabel: string;
  blockLabel: string;
}) {
  return (
    <span className="flex shrink-0 flex-wrap justify-end gap-1.5">
      {summary.damageEntry && (
        <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-xs font-semibold text-red-400">
          {formatDamageValue(summary.damageEntry)}
          <span className="ml-1 text-[10px] font-normal text-red-400/50">{damageLabel}</span>
        </span>
      )}
      {summary.blockEntry != null && (
        <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-xs font-semibold text-blue-400">
          {summary.blockEntry}
          <span className="ml-1 text-[10px] font-normal text-blue-400/50">{blockLabel}</span>
        </span>
      )}
    </span>
  );
}

interface MonsterDetailProps {
  serviceLocale: ServiceLocale;
  gameUi: CodexGameUiLabels;
  backToListTitle: string;
  monster: CodexMonster;
  encounters: CodexEncounter[];
  allMonsters?: CodexMonster[];
  onClose?: () => void;
  onMonsterClick?: (m: CodexMonster) => void;
}

export function MonsterDetail({
  serviceLocale,
  gameUi,
  backToListTitle,
  monster,
  encounters,
  allMonsters,
  onClose,
  onMonsterClick,
}: MonsterDetailProps) {
  const serviceText = serviceMessages[serviceLocale];
  const commonText = serviceText.codex.common;
  const monsterText = serviceText.codex.monstersView;
  const typeConfig = MONSTER_TYPE_CONFIG[monster.type];
  const meaningfulMoves = useMemo(
    () => monster.bestiaryMoves.filter(
      (m) => m.id !== "NOTHING" && m.id !== "SPAWNED" && m.id !== "DEAD",
    ),
    [monster],
  );
  const moveSummaries = useMemo(() => buildMoveSummaries(monster, meaningfulMoves), [monster, meaningfulMoves]);
  const [selectedMoveId, setSelectedMoveId] = useState<string | null>(null);
  const selectedMove = moveSummaries.find((summary) => summary.move.id === selectedMoveId) ?? moveSummaries[0] ?? null;
  const selectedAccent = selectedMove ? getMoveToneColor(selectedMove.tone, typeConfig.color) : typeConfig.color;
  const imageSrc = monster.imageUrl ?? monster.bossImageUrl;

  useEffect(() => {
    setSelectedMoveId(moveSummaries[0]?.move.id ?? null);
  }, [monster.id, moveSummaries]);

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between w-full">
        <Link
          href={localizeHref("/compendium/bestiary", serviceLocale)}
          className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
          onClick={(e) => {
            if (onClose) { e.preventDefault(); onClose(); }
          }}
        >
          ← {backToListTitle}
        </Link>
        {onClose && (
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-gray-400" aria-label={commonText.close}>
            ✕
          </button>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(20rem,0.95fr)]">
        <section
          className="overflow-hidden rounded-xl border bg-[#18182b] shadow-2xl"
          style={{
            borderColor: `${selectedAccent}66`,
            boxShadow: `inset 0 0 90px ${hexToRgba(selectedAccent, 0.12)}, 0 24px 80px rgba(0, 0, 0, 0.35)`,
          }}
        >
          <div
            className="relative flex min-h-[26rem] items-center justify-center overflow-hidden border-b border-white/10 px-4 py-6 sm:min-h-[34rem] sm:px-8"
            style={{
              background: `linear-gradient(180deg, ${hexToRgba(selectedAccent, 0.16)} 0%, rgba(24, 24, 43, 0.96) 48%, rgba(9, 9, 14, 0.98) 100%)`,
            }}
          >
            <div
              className="absolute bottom-10 left-[18%] right-[18%] h-8 rounded-[50%] blur-md"
              style={{ backgroundColor: hexToRgba(selectedAccent, 0.18) }}
            />
            {imageSrc ? (
              <Image
                src={imageSrc}
                alt={monster.name}
                width={640}
                height={640}
                className="relative z-10 h-[22rem] w-full object-contain drop-shadow-2xl sm:h-[30rem] lg:h-[34rem]"
                priority
              />
            ) : (
              <div
                className="relative z-10 flex h-52 w-52 items-center justify-center rounded-full border text-5xl font-bold"
                style={{ borderColor: `${typeConfig.color}66`, color: typeConfig.color }}
              >
                {monster.name.slice(0, 1)}
              </div>
            )}
          </div>

          <div className="p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="h-11 w-1.5 rounded-full" style={{ backgroundColor: typeConfig.color }} />
                <div>
                  <h1 className="text-3xl font-bold leading-tight text-gray-100 sm:text-4xl">{monster.name}</h1>
                  <p className="text-sm text-gray-500">{monster.nameEn}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <StatBadge label={monsterText.stats.type} value={gameUi.monsterTypes[monster.type].label} color={typeConfig.color} />
                {formatHp(monster) && (
                  <StatBadge label={monsterText.stats.hp} value={formatHp(monster)!} />
                )}
                {formatHpAscension(monster) && (
                  <StatBadge label={monsterText.stats.hpAscension} value={formatHpAscension(monster)!} color="#ff8a65" />
                )}
                {meaningfulMoves.length > 0 && (
                  <StatBadge label={monsterText.stats.moves} value={`${meaningfulMoves.length}`} />
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-sm font-bold text-gray-300">{monsterText.actionPreview}</h2>
              {selectedMove && (
                <span
                  className="rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-wide"
                  style={{
                    backgroundColor: hexToRgba(selectedAccent, 0.16),
                    color: selectedAccent,
                  }}
                >
                  {selectedMove.move.name}
                </span>
              )}
            </div>

            {moveSummaries.length > 0 ? (
              <div className="max-h-[22rem] space-y-2 overflow-y-auto pr-1 sm:max-h-[28rem]">
                {moveSummaries.map((summary, index) => {
                  const isSelected = selectedMove?.move.id === summary.move.id;
                  const toneColor = getMoveToneColor(summary.tone, typeConfig.color);

                  return (
                    <button
                      key={summary.move.id}
                      type="button"
                      onClick={() => setSelectedMoveId(summary.move.id)}
                      className="w-full rounded-lg border px-3 py-3 text-left transition-colors hover:bg-white/10"
                      style={{
                        backgroundColor: isSelected ? hexToRgba(toneColor, 0.14) : "rgba(255, 255, 255, 0.03)",
                        borderColor: isSelected ? `${toneColor}88` : "rgba(255, 255, 255, 0.08)",
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xs font-bold tabular-nums"
                          style={{
                            backgroundColor: hexToRgba(toneColor, 0.18),
                            color: toneColor,
                          }}
                        >
                          {index + 1}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-gray-100">{summary.move.name}</span>
                          {summary.move.nameEn !== summary.move.name && (
                            <span className="block truncate text-[11px] text-gray-500">{summary.move.nameEn}</span>
                          )}
                        </span>
                        <MoveMetricChips
                          summary={summary}
                          damageLabel={monsterText.damagePreview}
                          blockLabel={monsterText.block}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-500">{commonText.noResults}</p>
            )}
          </div>

          {selectedMove && (
            <div
              className="rounded-xl border bg-white/[0.04] p-4"
              style={{ borderColor: `${selectedAccent}55` }}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="text-lg font-bold text-gray-100">{selectedMove.move.name}</div>
                  {selectedMove.move.nameEn !== selectedMove.move.name && (
                    <div className="text-xs text-gray-500">{selectedMove.move.nameEn}</div>
                  )}
                </div>
                <MoveMetricChips
                  summary={selectedMove}
                  damageLabel={monsterText.damagePreview}
                  blockLabel={monsterText.block}
                />
              </div>

              {selectedMove.outgoing.length > 0 && (
                <div className="mt-4">
                  <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-gray-500">
                    {monsterText.nextActions}
                  </div>
                  <div className="space-y-2">
                    {selectedMove.outgoing.map((transition) => (
                      <div key={`${transition.from}-${transition.to}-${transition.chance ?? "unknown"}`} className="grid grid-cols-[minmax(6rem,1fr)_minmax(5rem,9rem)] items-center gap-3">
                        <span className="truncate text-xs text-gray-300">{getMoveName(monster, transition.to)}</span>
                        <span className="flex items-center gap-2">
                          <span className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                            <span
                              className="block h-full rounded-full"
                              style={{
                                width: `${transition.chance ?? 100}%`,
                                backgroundColor: selectedAccent,
                              }}
                            />
                          </span>
                          <span className="w-9 text-right text-[10px] tabular-nums text-gray-500">
                            {transition.chance == null ? "?" : `${transition.chance}%`}
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {monster.moveGraph && monster.moveGraph.transitions.length > 0 && (
        <div className="w-full bg-white/5 border border-white/10 rounded-lg p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold text-gray-300">{monsterText.actionGraph}</h2>
            {monster.moveGraph.initial && (
              <span className="text-[10px] text-gray-500">
                {monsterText.firstAction}: {getMoveName(monster, monster.moveGraph.initial)}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-2">
            {groupMoveTransitions(monster).map((group) => (
              <div key={group.from} className="rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2">
                <div className="mb-2 text-xs font-medium text-gray-300">
                  {group.from === "__START__" ? monsterText.firstAction : getMoveName(monster, group.from)}
                </div>
                <div className="flex flex-col gap-1.5">
                  {group.transitions.map((transition) => (
                    <div key={`${transition.from}-${transition.to}-${transition.chance ?? "unknown"}`} className="grid grid-cols-[minmax(6rem,1fr)_minmax(5rem,8rem)] items-center gap-3">
                      <span className="truncate text-xs text-gray-400">{getMoveName(monster, transition.to)}</span>
                      <span className="flex items-center gap-2">
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                          <span
                            className="block h-full rounded-full bg-yellow-400/70"
                            style={{ width: `${transition.chance ?? 100}%` }}
                          />
                        </span>
                        <span className="w-9 text-right text-[10px] tabular-nums text-gray-500">
                          {transition.chance == null ? "?" : `${transition.chance}%`}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {monster.moveGraph.confidence === "partial" && (
            <p className="mt-3 text-[11px] leading-relaxed text-gray-500">{monsterText.graphPartial}</p>
          )}
        </div>
      )}

      {/* Damage Summary */}
      {monster.damageValues && Object.keys(monster.damageValues).length > 0 && (
        <div className="w-full bg-white/5 border border-white/10 rounded-lg p-4">
          <h2 className="text-sm font-bold text-gray-300 mb-3">{monsterText.damageDetails}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {Object.entries(monster.damageValues).map(([key, val]) => (
              <div key={key} className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded bg-white/[0.03] border border-white/5">
                <span className="text-[10px] text-gray-500">{key}</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-red-400">{val.normal ?? "?"}</span>
                  {val.ascension != null && val.ascension !== val.normal && (
                    <span className="text-[10px] text-orange-400">→ {val.ascension}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Block Values */}
      {monster.blockValues && Object.keys(monster.blockValues).length > 0 && (
        <div className="w-full bg-white/5 border border-white/10 rounded-lg p-4">
          <h2 className="text-sm font-bold text-gray-300 mb-3">{monsterText.block}</h2>
          <div className="flex flex-wrap gap-2">
            {Object.entries(monster.blockValues).map(([key, val]) => (
              <div key={key} className="flex items-center gap-2 px-3 py-1.5 rounded bg-blue-500/10 border border-blue-500/20">
                <span className="text-[10px] text-blue-400/70">{key}</span>
                <span className="text-sm font-bold text-blue-400">{val}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Encounters */}
      {encounters.length > 0 && (
        <div className="w-full bg-white/5 border border-white/10 rounded-lg p-4">
          <h2 className="text-sm font-bold text-gray-300 mb-3">{monsterText.encounters}</h2>
          <div className="flex flex-col gap-2">
            {encounters.map((enc) => {
              const roomConfig = ENCOUNTER_ROOM_TYPE_CONFIG[enc.roomType];
              const actConfig = enc.act ? EVENT_ACT_CONFIG[enc.act] : null;

              return (
                <div key={enc.id} className="flex flex-col gap-1.5 px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-200">{enc.name}</span>
                    <span className="text-[10px] text-gray-500">{enc.nameEn}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: `${roomConfig.color}20`, color: roomConfig.color }}>
                      {gameUi.encounterRoomTypes[enc.roomType]}
                    </span>
                    {enc.act && actConfig && (
                      <span className={`text-[10px] ${actConfig.color}`}>{gameUi.acts[enc.act]}</span>
                    )}
                    {enc.isWeak && (
                      <span className="text-[10px] text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded">{monsterText.weakEncounter}</span>
                    )}
                    {enc.tags && enc.tags.map((tag) => (
                      <span key={tag} className="text-[10px] text-gray-500 bg-white/5 px-1.5 py-0.5 rounded">{tag}</span>
                    ))}
                  </div>

                  {/* Other monsters in this encounter */}
                  {enc.monsters.length > 1 && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-[10px] text-gray-500">{monsterText.appearsWith}</span>
                      {enc.monsters
                        .filter((m) => m.id !== monster.id)
                        .map((m) => {
                          const linked = allMonsters?.find((am) => am.id === m.id);
                          if (linked && onMonsterClick) {
                            return (
                              <button
                                key={m.id}
                                onClick={() => onMonsterClick(linked)}
                                className="text-[10px] text-yellow-400 hover:text-yellow-300 underline underline-offset-2 transition-colors"
                              >
                                {m.name}
                              </button>
                            );
                          }
                          return <span key={m.id} className="text-[10px] text-gray-400">{m.name}</span>;
                        })}
                    </div>
                  )}

                  {/* Loss text */}
                  <div className="text-[11px] text-gray-500 italic mt-0.5">
                    <DescriptionText description={enc.lossText} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="w-full bg-white/5 border border-white/10 rounded-lg p-4">
        <h2 className="text-sm font-bold text-gray-300 mb-3">{commonText.comments}</h2>
        <CommentSection threadKey={buildCodexCommentThreadKey("monster", monster.id)} />
      </div>
    </div>
  );
}

function formatHp(monster: CodexMonster): string | null {
  if (monster.minHp == null || monster.minHp === 9999) return null;
  if (monster.maxHp != null && monster.maxHp !== monster.minHp) {
    return `${monster.minHp}-${monster.maxHp}`;
  }
  return `${monster.minHp}`;
}

function formatHpAscension(monster: CodexMonster): string | null {
  if (monster.minHpAscension == null) return null;
  if (monster.maxHpAscension != null && monster.maxHpAscension !== monster.minHpAscension) {
    return `${monster.minHpAscension}-${monster.maxHpAscension}`;
  }
  return `${monster.minHpAscension}`;
}

function buildMoveSummaries(monster: CodexMonster, moves: MonsterMove[]): MoveSummary[] {
  return moves.map((move) => {
    const damageEntry = monster.damageValues
      ? findDamageForMove(move.id, monster.damageValues)
      : null;
    const blockEntry = monster.blockValues
      ? findBlockForMove(move.id, monster.blockValues)
      : null;
    const outgoing = monster.moveGraph?.transitions.filter((transition) => transition.from === move.id) ?? [];

    return {
      move,
      damageEntry,
      blockEntry,
      outgoing,
      tone: getMoveTone(move, damageEntry, blockEntry),
    };
  });
}

function getMoveTone(move: MonsterMove, damageEntry: DamageValue | null, blockEntry: number | null): MoveTone {
  if (damageEntry && blockEntry != null) return "mixed";
  if (damageEntry) return "attack";
  if (blockEntry != null) return "defense";

  const id = move.id.toLowerCase();
  if (id.includes("block") || id.includes("shield") || id.includes("defend")) return "defense";
  if (id.includes("attack") || id.includes("strike") || id.includes("bite") || id.includes("slash")) return "attack";
  return "setup";
}

function getMoveToneColor(tone: MoveTone, fallback: string): string {
  switch (tone) {
    case "attack":
      return "#f87171";
    case "defense":
      return "#60a5fa";
    case "mixed":
      return "#f59e0b";
    case "setup":
      return fallback;
  }
}

function formatDamageValue(value: DamageValue): string {
  const normal = value.normal ?? "?";
  if (value.ascension != null && value.ascension !== value.normal) {
    return `${normal} (${value.ascension})`;
  }
  return `${normal}`;
}

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) return `rgba(255, 255, 255, ${alpha})`;
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function groupMoveTransitions(monster: CodexMonster) {
  const byFrom = new Map<string, NonNullable<CodexMonster["moveGraph"]>["transitions"]>();
  for (const transition of monster.moveGraph?.transitions ?? []) {
    const bucket = byFrom.get(transition.from) ?? [];
    bucket.push(transition);
    byFrom.set(transition.from, bucket);
  }
  return Array.from(byFrom.entries()).map(([from, transitions]) => ({ from, transitions }));
}

function getMoveName(monster: CodexMonster, moveId: string): string {
  if (moveId === "__START__") return "Start";
  const move = [...monster.bestiaryMoves, ...monster.moves].find((m) => m.id === moveId);
  return move?.name ?? moveId.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

// Fuzzy match move ID to damage key
function findDamageForMove(moveId: string, damageValues: Record<string, { normal: number | null; ascension: number | null }>): { normal: number | null; ascension: number | null } | null {
  // Try exact match first (case-insensitive)
  const moveIdLower = moveId.toLowerCase().replace(/_/g, "");
  for (const [key, val] of Object.entries(damageValues)) {
    if (key.toLowerCase().replace(/_/g, "") === moveIdLower) return val;
  }
  // Try substring match
  for (const [key, val] of Object.entries(damageValues)) {
    const keyLower = key.toLowerCase();
    if (moveIdLower.includes(keyLower) || keyLower.includes(moveIdLower)) return val;
  }
  return null;
}

function findBlockForMove(moveId: string, blockValues: Record<string, number>): number | null {
  const moveIdLower = moveId.toLowerCase().replace(/_/g, "");
  for (const [key, val] of Object.entries(blockValues)) {
    if (key.toLowerCase().replace(/_/g, "") === moveIdLower) return val;
  }
  for (const [key, val] of Object.entries(blockValues)) {
    const keyLower = key.toLowerCase();
    if (moveIdLower.includes(keyLower) || keyLower.includes(moveIdLower)) return val;
  }
  return null;
}
