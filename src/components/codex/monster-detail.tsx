"use client";

import Image from "@/components/ui/static-image";
import Link from "next/link";
import { CommentSection } from "@/components/comment-section";
import { buildCodexCommentThreadKey } from "@/lib/comment-threads";
import {
  CodexMonster,
  CodexEncounter,
  MONSTER_TYPE_CONFIG,
  EVENT_ACT_CONFIG,
  EVENT_ACT_UNKNOWN,
  ENCOUNTER_ROOM_TYPE_CONFIG,
} from "@/lib/codex-types";
import { DescriptionText } from "./codex-description";

function StatBadge({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
      <span className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</span>
      <span className="text-sm font-bold" style={color ? { color } : undefined}>{value}</span>
    </div>
  );
}

interface MonsterDetailProps {
  monster: CodexMonster;
  encounters: CodexEncounter[];
  allMonsters?: CodexMonster[];
  onClose?: () => void;
  onMonsterClick?: (m: CodexMonster) => void;
}

export function MonsterDetail({ monster, encounters, allMonsters, onClose, onMonsterClick }: MonsterDetailProps) {
  const typeConfig = MONSTER_TYPE_CONFIG[monster.type];
  const meaningfulMoves = monster.moves.filter(
    (m) => m.id !== "NOTHING" && m.id !== "SPAWNED" && m.id !== "DEAD",
  );

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between w-full">
        <Link
          href="/codex/monsters"
          className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
          onClick={(e) => {
            if (onClose) { e.preventDefault(); onClose(); }
          }}
        >
          ← 몬스터 도감
        </Link>
        {onClose && (
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-gray-400" aria-label="닫기">
            ✕
          </button>
        )}
      </div>

      {/* Monster portrait (Spine render or boss token) */}
      {(monster.imageUrl || monster.bossImageUrl) && (
        <div className="w-full max-w-xs mx-auto flex items-center justify-center p-4 rounded-lg border border-white/10 bg-white/[0.02]">
          <Image
            src={monster.imageUrl ?? monster.bossImageUrl!}
            alt={monster.name}
            width={256}
            height={256}
            className="max-w-full max-h-64 object-contain"
          />
        </div>
      )}

      {/* Name */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-3">
          <div className="w-1.5 h-8 rounded-full" style={{ backgroundColor: typeConfig.color }} />
          <div>
            <h1 className="text-2xl font-bold text-gray-100">{monster.name}</h1>
            <p className="text-sm text-gray-500">{monster.nameEn}</p>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="flex flex-wrap justify-center gap-2">
        <StatBadge label="유형" value={typeConfig.label} color={typeConfig.color} />
        {formatHp(monster) && (
          <StatBadge label="체력" value={formatHp(monster)!} />
        )}
        {formatHpAscension(monster) && (
          <StatBadge label="체력 (승천)" value={formatHpAscension(monster)!} color="#ff8a65" />
        )}
        {meaningfulMoves.length > 0 && (
          <StatBadge label="행동" value={`${meaningfulMoves.length}`} />
        )}
      </div>

      {/* Moves Section */}
      {meaningfulMoves.length > 0 && (
        <div className="w-full bg-white/5 border border-white/10 rounded-lg p-4">
          <h2 className="text-sm font-bold text-gray-300 mb-3">행동 패턴</h2>
          <div className="flex flex-col gap-2">
            {meaningfulMoves.map((move) => {
              // Find damage for this move
              const damageEntry = monster.damageValues
                ? findDamageForMove(move.id, monster.damageValues)
                : null;
              const blockEntry = monster.blockValues
                ? findBlockForMove(move.id, monster.blockValues)
                : null;

              return (
                <div key={move.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/5">
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-gray-200">{move.name}</span>
                    {move.nameEn !== move.name && (
                      <span className="ml-1.5 text-[10px] text-gray-500">{move.nameEn}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {damageEntry && (
                      <span className="text-xs text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">
                        {damageEntry.normal != null ? damageEntry.normal : "?"}
                        {damageEntry.ascension != null && damageEntry.ascension !== damageEntry.normal && (
                          <span className="text-red-400/60 ml-0.5">({damageEntry.ascension})</span>
                        )}
                        <span className="text-red-400/50 ml-0.5 text-[10px]">DMG</span>
                      </span>
                    )}
                    {blockEntry != null && (
                      <span className="text-xs text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
                        {blockEntry}
                        <span className="text-blue-400/50 ml-0.5 text-[10px]">BLK</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Damage Summary */}
      {monster.damageValues && Object.keys(monster.damageValues).length > 0 && (
        <div className="w-full bg-white/5 border border-white/10 rounded-lg p-4">
          <h2 className="text-sm font-bold text-gray-300 mb-3">피해량 상세</h2>
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
          <h2 className="text-sm font-bold text-gray-300 mb-3">방어력</h2>
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
          <h2 className="text-sm font-bold text-gray-300 mb-3">등장 전투</h2>
          <div className="flex flex-col gap-2">
            {encounters.map((enc) => {
              const roomConfig = ENCOUNTER_ROOM_TYPE_CONFIG[enc.roomType];
              const actConfig = enc.act ? EVENT_ACT_CONFIG[enc.act] : EVENT_ACT_UNKNOWN;

              return (
                <div key={enc.id} className="flex flex-col gap-1.5 px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-200">{enc.name}</span>
                    <span className="text-[10px] text-gray-500">{enc.nameEn}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: `${roomConfig.color}20`, color: roomConfig.color }}>
                      {roomConfig.label}
                    </span>
                    {enc.act && (
                      <span className={`text-[10px] ${actConfig.color}`}>{actConfig.labelKo}</span>
                    )}
                    {enc.isWeak && (
                      <span className="text-[10px] text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded">약한 전투</span>
                    )}
                    {enc.tags && enc.tags.map((tag) => (
                      <span key={tag} className="text-[10px] text-gray-500 bg-white/5 px-1.5 py-0.5 rounded">{tag}</span>
                    ))}
                  </div>

                  {/* Other monsters in this encounter */}
                  {enc.monsters.length > 1 && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-[10px] text-gray-500">함께 등장:</span>
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
        <h2 className="text-sm font-bold text-gray-300 mb-3">댓글</h2>
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
