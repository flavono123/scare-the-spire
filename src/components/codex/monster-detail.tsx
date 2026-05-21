"use client";

import { type ReactNode, useMemo, useState } from "react";
import Link from "next/link";
import { CommentSection } from "@/components/comment-section";
import { buildCodexCommentThreadKey } from "@/lib/comment-threads";
import type { ServiceLocale } from "@/lib/i18n";
import { localizeHref } from "@/lib/i18n";
import type { CodexGameUiLabels } from "@/lib/codex-game-ui";
import type { STS2Change, STS2Patch } from "@/lib/types";
import { getBestiaryDisplayMonsterType } from "@/lib/bestiary-monster-policy";
import { serviceMessages } from "@/messages/service";
import type {
  CodexMonster,
  CodexEncounter,
  DamageValue,
  MonsterMove,
  MonsterMoveTransition,
} from "@/lib/codex-types";
import {
  getDefaultMonsterSkinSelections,
  getMonsterSkinOptionLabel,
  getMonsterSkinPartLabel,
  getMonsterSkinParts,
  getMonsterSkinRenderKey,
  getSelectedMonsterSkinNames,
  getSingleMonsterSkin,
  type MonsterSkinSelections,
} from "@/lib/monster-skins";
import {
  MONSTER_TYPE_CONFIG,
} from "@/lib/codex-types";
import { EntityReferenceLinks, type CodexReferenceTarget } from "./entity-reference-links";
import { GameHoverTip } from "./hover-tip";
import { MonsterSpineStage } from "./monster-spine-stage";
import { STS2ChangeHistory } from "./sts2-change-history";

type MoveTone = "attack" | "defense" | "mixed" | "setup";

interface MoveSummary {
  move: MonsterMove;
  damageEntry: DamageValue | null;
  blockEntry: number | null;
  outgoing: MonsterMoveTransition[];
  tone: MoveTone;
}

interface TransitionTableRow {
  key: string;
  from: string;
  to: string;
  chance: number | null;
  isStart: boolean;
}

function MetaPill({ value, color }: { value: string; color?: string }) {
  return (
    <span
      className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 font-game-text text-sm font-bold"
      style={color ? { color } : undefined}
    >
      {value}
    </span>
  );
}

function InfoRailSection({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      className="group rounded-lg border border-white/10 bg-black/20 px-4 py-3"
      open={defaultOpen}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-game-title text-sm font-bold text-gray-200">
        <span>{title}</span>
        <span className="text-xs text-gray-500 transition-transform group-open:rotate-180">⌄</span>
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

function DetailPanel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
      <h2 className="mb-3 text-sm font-bold text-gray-300">{title}</h2>
      {children}
    </section>
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
  patches?: STS2Patch[];
  changes?: STS2Change[];
  onClose?: () => void;
}

export function MonsterDetail({
  serviceLocale,
  gameUi,
  backToListTitle,
  monster,
  encounters,
  patches,
  changes,
  onClose,
}: MonsterDetailProps) {
  const serviceText = serviceMessages[serviceLocale];
  const commonText = serviceText.codex.common;
  const monsterText = serviceText.codex.monstersView;
  const detailLabels = serviceLocale === "ko"
    ? {
        englishName: "영어명",
        patchHistory: "패치 이력",
        noPatchHistory: "구조화 변경 없음",
        numericDetails: "수치",
      }
    : {
        englishName: "English name",
        patchHistory: "Patch History",
        noPatchHistory: "No structured changes",
        numericDetails: "Numbers",
      };
  const displayType = getBestiaryDisplayMonsterType(monster.id, monster.type);
  const typeConfig = MONSTER_TYPE_CONFIG[displayType];
  const meaningfulMoves = useMemo(
    () => monster.bestiaryMoves.filter(
      (m) => m.id !== "NOTHING" && m.id !== "SPAWNED" && m.id !== "DEAD",
    ),
    [monster],
  );
  const moveSummaries = useMemo(() => buildMoveSummaries(monster, meaningfulMoves), [monster, meaningfulMoves]);
  const transitionRows = useMemo(() => buildTransitionTableRows(monster), [monster]);
  const firstMoveId = monster.moveGraph?.initial ?? null;
  const [selectedMoveState, setSelectedMoveState] = useState<{ monsterId: string; moveId: string | null }>({
    monsterId: monster.id,
    moveId: null,
  });
  const [selectedSkinState, setSelectedSkinState] = useState<{ monsterId: string; selections: MonsterSkinSelections }>({
    monsterId: monster.id,
    selections: getDefaultMonsterSkinSelections(monster),
  });
  const selectedMoveId = selectedMoveState.monsterId === monster.id ? selectedMoveState.moveId : null;
  const selectedSkinSelections = selectedSkinState.monsterId === monster.id
    ? selectedSkinState.selections
    : getDefaultMonsterSkinSelections(monster);
  const selectedSkinNames = getSelectedMonsterSkinNames(monster, selectedSkinSelections);
  const selectedSingleSkin = selectedSkinNames.length > 0 ? null : getSingleMonsterSkin(monster);
  const selectedMove = moveSummaries.find((summary) => summary.move.id === selectedMoveId) ?? moveSummaries[0] ?? null;
  const selectedAccent = selectedMove ? getMoveToneColor(selectedMove.tone, typeConfig.color) : typeConfig.color;
  const imageSrc = monster.imageUrl ?? monster.bossImageUrl;
  const skinParts = getMonsterSkinParts(monster.spineAsset);
  const activeSkinKey = getMonsterSkinRenderKey(selectedSkinNames, selectedSingleSkin);
  const [commentCount, setCommentCount] = useState(0);
  const damageEntries = Object.entries(monster.damageValues ?? {});
  const blockEntries = Object.entries(monster.blockValues ?? {});
  const hasNumericDetails = damageEntries.length > 0 || blockEntries.length > 0;
  const relatedEncounterTargets: CodexReferenceTarget[] = encounters.map((encounter) => {
    const href = `/compendium/bestiary?view=encounters&encounter=${encounter.id.toLowerCase()}`;
    return {
      id: encounter.id,
      href,
      title: encounter.name,
      entity: {
        id: encounter.id,
        nameEn: encounter.nameEn,
        nameKo: encounter.name,
        imageUrl: encounter.imageUrl,
        href,
        color: encounter.roomType,
        type: "encounter" as const,
        encounterData: encounter,
      },
    };
  });

  return (
    <div className="mx-auto w-full max-w-6xl p-4 sm:p-6">
      <div className="mb-4 flex w-full items-center justify-between gap-3">
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

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)] lg:items-start">
        <section className="flex flex-col gap-4">
          <section className="flex min-h-[26rem] flex-col items-center justify-center gap-5 py-4">
            <div className="flex w-full flex-col items-center justify-center gap-5 xl:flex-row xl:items-center">
              <div className="relative flex min-h-[22rem] w-full max-w-2xl items-center justify-center overflow-hidden">
                <div
                  className="absolute bottom-10 left-[18%] right-[18%] h-8 rounded-[50%] blur-md"
                  style={{ backgroundColor: hexToRgba(selectedAccent, 0.18) }}
                />
                {imageSrc ? (
                  <MonsterSpineStage
                    key={`${monster.id}-${activeSkinKey}`}
                    asset={monster.spineAsset}
                    fallbackImageUrl={imageSrc}
                    monsterName={monster.name}
                    selectedMoveId={selectedMove?.move.id ?? null}
                    selectedSkin={selectedSingleSkin}
                    selectedSkins={selectedSkinNames}
                    className="relative z-10 h-[22rem] w-full sm:h-[30rem] lg:h-[34rem]"
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

              <div className="flex w-full max-w-[24rem] flex-col items-center gap-3 xl:items-start">
                <GameHoverTip
                  title={monster.name}
                  className="w-full max-w-[23rem]"
                  style={{ minWidth: 220, width: "max-content", maxWidth: "100%" }}
                />

                {skinParts.length > 0 && (
                  <div className="w-full rounded-lg border border-white/10 bg-black/20 px-4 py-3">
                    <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                      {serviceLocale === "ko" ? "외형" : "Appearance"}
                    </div>
                    <div className="flex flex-col gap-2">
                      {skinParts.map((part) => {
                        const partLabel = getMonsterSkinPartLabel(part, serviceLocale);

                        return (
                          <div key={part.id} className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                            <span className="min-w-10 text-[11px] font-medium text-gray-400">{partLabel}</span>
                            <div className="flex flex-wrap gap-1" role="group" aria-label={`${monster.name} ${partLabel}`}>
                              {part.options.map((option) => {
                                const selected = selectedSkinSelections[part.id] === option.id;

                                return (
                                  <button
                                    key={option.id}
                                    type="button"
                                    onClick={() => {
                                      setSelectedSkinState((state) => ({
                                        monsterId: monster.id,
                                        selections: {
                                          ...(state.monsterId === monster.id
                                            ? state.selections
                                            : getDefaultMonsterSkinSelections(monster)),
                                          [part.id]: option.id,
                                        },
                                      }));
                                    }}
                                    className="rounded border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-white/10"
                                    style={{
                                      backgroundColor: selected ? hexToRgba(typeConfig.color, 0.18) : "rgba(255,255,255,0.03)",
                                      borderColor: selected ? `${typeConfig.color}88` : "rgba(255,255,255,0.1)",
                                      color: selected ? typeConfig.color : "#a1a1aa",
                                    }}
                                  >
                                    {getMonsterSkinOptionLabel(option, serviceLocale)}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          <DetailPanel title={monsterText.actionPreview}>
            {selectedMove && (
              <div className="mb-3 flex justify-end">
                <span
                  className="rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-wide"
                  style={{
                    backgroundColor: hexToRgba(selectedAccent, 0.16),
                    color: selectedAccent,
                  }}
                >
                  <span className="font-game-title">{selectedMove.move.name}</span>
                </span>
              </div>
            )}
            {moveSummaries.length > 0 ? (
              <div className="max-h-[22rem] space-y-2 overflow-y-auto pr-1">
                {moveSummaries.map((summary, index) => {
                  const isSelected = selectedMove?.move.id === summary.move.id;
                  const toneColor = getMoveToneColor(summary.tone, typeConfig.color);

                  return (
                    <button
                      key={summary.move.id}
                      type="button"
                      onClick={() => setSelectedMoveState({ monsterId: monster.id, moveId: summary.move.id })}
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
                          <span className="font-game-title block truncate text-sm font-semibold text-gray-100">{summary.move.name}</span>
                          {summary.move.nameEn !== summary.move.name && (
                            <span className="font-game-text block truncate text-[11px] text-gray-500">{summary.move.nameEn}</span>
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

            {selectedMove && (
            <div
              className="mt-4 rounded-lg border bg-black/20 p-4"
              style={{ borderColor: `${selectedAccent}55` }}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="font-game-title text-lg font-bold text-gray-100">{selectedMove.move.name}</div>
                  {selectedMove.move.nameEn !== selectedMove.move.name && (
                    <div className="font-game-text text-xs text-gray-500">{selectedMove.move.nameEn}</div>
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
          </DetailPanel>

          {transitionRows.length > 0 && (
            <DetailPanel title={monsterText.actionGraph}>
              <div className="mb-3 flex justify-end">
                {firstMoveId && (
                  <span className="text-[10px] text-gray-500">
                    {monsterText.firstAction}: {getMoveName(monster, firstMoveId)}
                  </span>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[34rem] border-separate border-spacing-y-1 text-left">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wide text-gray-500">
                      <th className="px-3 py-1 font-medium">{monsterText.currentAction}</th>
                      <th className="px-3 py-1 font-medium">{monsterText.nextActions}</th>
                      <th className="w-40 px-3 py-1 font-medium">{monsterText.chance}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transitionRows.map((row) => {
                      const chance = row.chance ?? 100;

                      return (
                        <tr key={row.key} className="text-xs">
                          <td className="rounded-l-md bg-white/[0.03] px-3 py-2">
                            <span className={row.isStart ? "font-semibold text-blue-300" : "text-gray-300"}>
                              {row.isStart ? monsterText.startPoint : getMoveName(monster, row.from)}
                            </span>
                          </td>
                          <td className="bg-white/[0.03] px-3 py-2 text-gray-200">
                            {getMoveName(monster, row.to)}
                          </td>
                          <td className="rounded-r-md bg-white/[0.03] px-3 py-2">
                            <span className="flex items-center gap-2">
                              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                                <span
                                  className="block h-full rounded-full"
                                  style={{
                                    width: `${chance}%`,
                                    backgroundColor: row.isStart ? BESTIARY_START_COLOR : selectedAccent,
                                  }}
                                />
                              </span>
                              <span className="w-9 text-right text-[10px] tabular-nums text-gray-500">
                                {row.chance == null ? "?" : `${row.chance}%`}
                              </span>
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {monster.moveGraph?.confidence === "partial" && (
                <p className="mt-3 text-[11px] leading-relaxed text-gray-500">{monsterText.graphPartial}</p>
              )}
            </DetailPanel>
          )}
        </section>

        <aside className="flex flex-col gap-3">
          <section className="rounded-lg border border-white/10 bg-black/20 px-4 py-3">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <MetaPill value={gameUi.monsterTypes[displayType].label} color={typeConfig.color} />
                {formatHp(monster) && <MetaPill value={`${monsterText.stats.hp} ${formatHp(monster)}`} />}
                {formatHpAscension(monster) && (
                  <MetaPill value={`${monsterText.stats.hpAscension} ${formatHpAscension(monster)}`} color="#ff8a65" />
                )}
                {meaningfulMoves.length > 0 && (
                  <MetaPill value={`${monsterText.stats.moves} ${meaningfulMoves.length}`} />
                )}
              </div>
              {monster.nameEn !== monster.name && (
                <div>
                  <div className="mb-1 text-[10px] uppercase tracking-wider text-gray-500">{detailLabels.englishName}</div>
                  <div className="font-game-text text-sm text-gray-300">{monster.nameEn}</div>
                </div>
              )}
            </div>
          </section>

          <EntityReferenceLinks
            kind="encounter"
            serviceLocale={serviceLocale}
            targets={relatedEncounterTargets}
          />

          {hasNumericDetails && (
            <InfoRailSection title={detailLabels.numericDetails}>
              <div className="space-y-3">
                {damageEntries.length > 0 && (
                  <div>
                    <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-gray-500">
                      {monsterText.damageDetails}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {damageEntries.map(([key, val]) => (
                        <div key={key} className="flex flex-col items-center gap-0.5 rounded border border-white/5 bg-white/[0.03] px-2 py-1.5">
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

                {blockEntries.length > 0 && (
                  <div>
                    <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-gray-500">
                      {monsterText.block}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {blockEntries.map(([key, val]) => (
                        <div key={key} className="flex items-center gap-2 rounded border border-blue-500/20 bg-blue-500/10 px-3 py-1.5">
                          <span className="text-[10px] text-blue-400/70">{key}</span>
                          <span className="text-sm font-bold text-blue-400">{val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </InfoRailSection>
          )}

          <InfoRailSection title={detailLabels.patchHistory}>
            <STS2ChangeHistory
              serviceLocale={serviceLocale}
              entityType="monster"
              changeEntityTypes={["monster", "enemy"]}
              entityId={monster.id}
              changes={changes}
              patches={patches}
              emptyLabel={detailLabels.noPatchHistory}
            />
          </InfoRailSection>

          <InfoRailSection title={`${commonText.comments}${commentCount > 0 ? ` (${commentCount})` : ""}`}>
            <CommentSection
              threadKey={buildCodexCommentThreadKey("monster", monster.id)}
              onCountChange={setCommentCount}
            />
          </InfoRailSection>
        </aside>
      </div>
    </div>
  );
}

const BESTIARY_START_COLOR = "#60a5fa";

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

function buildTransitionTableRows(monster: CodexMonster): TransitionTableRow[] {
  const transitions = monster.moveGraph?.transitions ?? [];
  const hasExplicitStart = transitions.some((transition) => transition.from === "__START__");
  const rows: TransitionTableRow[] = [];

  if (!hasExplicitStart && monster.moveGraph?.initial) {
    rows.push({
      key: `__START__-${monster.moveGraph.initial}`,
      from: "__START__",
      to: monster.moveGraph.initial,
      chance: 100,
      isStart: true,
    });
  }

  transitions.forEach((transition, index) => {
    rows.push({
      key: `${transition.from}-${transition.to}-${transition.chance ?? "unknown"}-${index}`,
      from: transition.from,
      to: transition.to,
      chance: transition.chance,
      isStart: transition.from === "__START__",
    });
  });

  return rows;
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
