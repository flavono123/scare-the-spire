"use client";

import { type CSSProperties, type ReactNode, useMemo, useState } from "react";
import Link from "next/link";
import Image from "@/components/ui/static-image";
import { CommentSection } from "@/components/comment-section";
import { buildCodexCommentThreadKey } from "@/lib/comment-threads";
import type { ServiceLocale } from "@/lib/i18n";
import { localizeHref } from "@/lib/i18n";
import type { CodexGameUiLabels } from "@/lib/codex-game-ui";
import { bakeDescription } from "@/lib/codex-bake";
import type { STS2Change, STS2Patch } from "@/lib/types";
import { getBestiaryDisplayMonsterType } from "@/lib/bestiary-monster-policy";
import { serviceMessages } from "@/messages/service";
import type {
  CodexEncounter,
  CodexCard,
  CodexMonster,
  CodexPower,
  DamageValue,
  MonsterMove,
  MonsterMoveCardApplication,
  MonsterMovePowerApplication,
  MonsterMoveTransitionKind,
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
import {
  getRelatedEncounterIdsForMonster,
} from "@/lib/codex-references";
import { EntityReferenceGroupLinks, type CodexReferenceTarget } from "./entity-reference-links";
import { EntityPreview, type EntityInfo } from "@/components/patch-note-renderer";
import { MonsterSpineStage } from "./monster-spine-stage";
import { STS2ChangeHistory } from "./sts2-change-history";

type MoveTone = "attack" | "defense" | "mixed" | "setup";

interface MoveSummary {
  move: MonsterMove;
  damageEntry: DamageValue | null;
  blockEntry: DamageValue | null;
  outgoing: MonsterMoveTransition[];
  tone: MoveTone;
}

type PatternKind = "fixed" | "random" | "conditional" | "mixed" | "unknown";

interface PatternPhase {
  id: string;
  label: string;
  moveIds: string[];
}

interface PatternSummary {
  kind: PatternKind;
  hasPhases: boolean;
  phases: PatternPhase[];
}

interface TransitionTableRow {
  key: string;
  from: string;
  to: string;
  chance: number | null;
  isStart: boolean;
  kind: MonsterMoveTransitionKind | "start" | "unknown";
  condition: string | null;
}

interface PatternDiagramNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isInitial: boolean;
  phaseId: string | null;
}

interface PatternDiagramEdge {
  key: string;
  from: string;
  to: string;
  path: string;
  color: string;
  marker: "normal" | "conditional" | "start";
  isLoop: boolean;
  label: string | null;
  labelX: number;
  labelY: number;
}

interface PatternDiagramPhaseBox {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PatternDiagramChoiceBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PatternDiagramPhaseConnector {
  key: string;
  path: string;
}

interface PatternDiagramModel {
  width: number;
  height: number;
  nodes: PatternDiagramNode[];
  edges: PatternDiagramEdge[];
  phaseBoxes: PatternDiagramPhaseBox[];
  choiceBoxes: PatternDiagramChoiceBox[];
  phaseConnectors: PatternDiagramPhaseConnector[];
}

function MetaPill({ value, color, children }: { value?: string; color?: string; children?: ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1.5 font-game-text text-sm font-bold"
      style={color ? { color } : undefined}
    >
      {children ?? value}
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
      className="group min-w-0 rounded-lg border border-white/10 bg-black/20 px-4 py-3"
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

function MoveMetrics({
  summary,
}: {
  summary: MoveSummary;
}) {
  return (
    <span className="flex shrink-0 flex-wrap justify-end gap-2">
      {summary.damageEntry && (
        <MetricTokenValue value={summary.damageEntry} kind="attack" />
      )}
      {summary.blockEntry != null && (
        <MetricTokenValue value={summary.blockEntry} kind="block" />
      )}
    </span>
  );
}

function MetricTokenValue({
  value,
  kind,
  ascensionLevel,
  compact = false,
}: {
  value: DamageValue;
  kind: "attack" | "block" | "hp";
  ascensionLevel?: number;
  compact?: boolean;
}) {
  const icon = METRIC_TOKEN_ICONS[kind];
  const level = ascensionLevel ?? (kind === "hp" ? 8 : 9);

  return (
    <span className={`inline-flex items-center font-game-text font-bold leading-none text-gray-100 ${compact ? "gap-0.5 text-xs" : "gap-1 text-sm"}`}>
      <Image
        src={icon}
        alt=""
        width={compact ? 18 : 22}
        height={compact ? 18 : 22}
        className={`${compact ? "h-4 w-4" : "h-5 w-5"} shrink-0 object-contain`}
      />
      <span>{value.normal ?? "?"}</span>
      {value.ascension != null && value.ascension !== value.normal && (
        <span className={`inline-flex items-center text-orange-300 ${compact ? "gap-0.5" : "gap-1"}`}>
          <span className="text-gray-500">(</span>
          <AscensionBadge level={level} />
          <span>{value.ascension}</span>
          <span className="text-gray-500">)</span>
        </span>
      )}
    </span>
  );
}

function HpTokenValue({ monster }: { monster: CodexMonster }) {
  const normal = formatHp(monster);
  const ascension = formatHpAscension(monster);
  if (!normal) return null;

  return (
    <span className="inline-flex items-center gap-1 font-game-text text-sm font-bold leading-none text-gray-100">
      <Image src={METRIC_TOKEN_ICONS.hp} alt="" width={22} height={22} className="h-5 w-5 shrink-0 object-contain" />
      <span>{normal}</span>
      {ascension && ascension !== normal && (
        <span className="inline-flex items-center gap-1 text-orange-300">
          <span className="text-gray-500">(</span>
          <AscensionBadge level={8} />
          <span>{ascension}</span>
          <span className="text-gray-500">)</span>
        </span>
      )}
    </span>
  );
}

function AscensionBadge({ level }: { level: number }) {
  return (
    <span className="relative inline-flex h-4 w-4 items-center justify-center align-middle">
      <Image
        src="/images/sts2/ui/topbar/top_bar_ascension.png"
        alt=""
        width={16}
        height={16}
        className="h-4 w-4 object-contain"
      />
      <span className="absolute inset-0 flex items-center justify-center pt-px text-[8px] font-black leading-none text-white drop-shadow">
        {level}
      </span>
    </span>
  );
}

function MoveApplicationTokens({
  powers,
  cards,
  serviceLocale,
  powerById,
  cardById,
}: {
  powers: readonly MonsterMovePowerApplication[];
  cards: readonly MonsterMoveCardApplication[];
  serviceLocale: ServiceLocale;
  powerById: Map<string, CodexPower>;
  cardById: Map<string, CodexCard>;
}) {
  if (powers.length === 0 && cards.length === 0) return null;

  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {powers.map((application) => (
        <MoveApplicationToken
          key={`power-${application.powerId}-${application.target}-${formatNumericValue(application.amount ?? { normal: null, ascension: null })}`}
          entity={buildPowerEntity(application, powerById.get(application.powerId))}
          imageUrl={application.imageUrl}
          label={serviceLocale === "ko" ? application.powerName : application.powerNameEn}
          amount={application.amount}
          serviceLocale={serviceLocale}
        />
      ))}
      {cards.map((application) => (
        <MoveApplicationToken
          key={`card-${application.cardId}-${formatNumericValue(application.amount ?? { normal: null, ascension: null })}`}
          entity={buildCardEntity(application, cardById.get(application.cardId))}
          imageUrl={application.imageUrl}
          label={serviceLocale === "ko" ? application.cardName : application.cardNameEn}
          amount={application.amount}
          serviceLocale={serviceLocale}
        />
      ))}
    </span>
  );
}

function MoveApplicationToken({
  entity,
  imageUrl,
  label,
  amount,
  serviceLocale,
}: {
  entity: EntityInfo;
  imageUrl: string | null;
  label: string;
  amount: DamageValue | null;
  serviceLocale: ServiceLocale;
}) {
  return (
    <EntityPreview
      entity={entity}
      serviceLocale={serviceLocale}
      linkClassName="relative inline-flex h-7 w-7 items-center justify-center rounded-sm outline-none transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-yellow-300/70"
    >
      <span className="relative inline-flex h-7 w-7 items-center justify-center" title={label}>
        {imageUrl && (
          <Image src={imageUrl} alt="" width={28} height={28} className="h-7 w-7 object-contain" />
        )}
      </span>
      {amount && (
        <span className="pointer-events-none absolute -bottom-0.5 -right-1 rounded bg-black/75 px-0.5 text-[9px] font-bold tabular-nums text-gray-100">
          {amount.normal ?? "?"}
        </span>
      )}
    </EntityPreview>
  );
}

function PatternStateTransitionDiagram({
  monster,
  phases,
  rows,
  serviceLocale,
  onSelectMove,
  powerById,
  cardById,
}: {
  monster: CodexMonster;
  phases: PatternPhase[];
  rows: TransitionTableRow[];
  serviceLocale: ServiceLocale;
  onSelectMove: (moveId: string) => void;
  powerById: Map<string, CodexPower>;
  cardById: Map<string, CodexCard>;
}) {
  const diagram = useMemo(
    () => buildPatternDiagramModel(monster, rows, phases, serviceLocale),
    [monster, phases, rows, serviceLocale],
  );
  if (!diagram) return null;

  const markerPrefix = sanitizeSvgId(`monster-pattern-${monster.id}`);

  return (
    <div
      className="max-w-full overflow-x-auto rounded-md border border-white/10 bg-black/15 p-3"
    >
      <div
        className="relative"
        style={{ width: diagram.width, height: diagram.height }}
      >
        {diagram.choiceBoxes.map((box) => (
          <div
            key={box.id}
            className="pointer-events-none absolute z-0"
            style={{
              left: box.x,
              top: box.y,
              width: box.width,
              height: box.height,
              border: "1px solid rgba(239, 200, 81, 0.28)",
              backgroundColor: "rgba(7, 9, 20, 0.22)",
            }}
          />
        ))}
        {diagram.phaseBoxes.map((box) => (
          <div
            key={box.id}
            className="pointer-events-none absolute z-0"
            style={{
              left: box.x,
              top: box.y,
              width: box.width,
              height: box.height,
              border: "1px solid rgba(41, 235, 192, 0.32)",
              backgroundColor: "rgba(7, 9, 20, 0.18)",
            }}
          >
            <span className="absolute left-3 top-2 font-game-title text-[11px] font-bold text-[#29ebc0]">
              {box.label}
            </span>
          </div>
        ))}
        <svg
          className="pointer-events-none absolute inset-0 z-[5]"
          width={diagram.width}
          height={diagram.height}
          viewBox={`0 0 ${diagram.width} ${diagram.height}`}
          aria-hidden="true"
        >
          <defs>
            <marker
              id={`${markerPrefix}-arrow-normal`}
              markerWidth="10"
              markerHeight="10"
              refX="9"
              refY="5"
              orient="auto"
              markerUnits="userSpaceOnUse"
            >
              <image href={DIAGRAM_ARROW_ICON} x="0" y="0" width="10" height="10" preserveAspectRatio="xMidYMid meet" />
            </marker>
            <marker
              id={`${markerPrefix}-arrow-conditional`}
              markerWidth="10"
              markerHeight="10"
              refX="9"
              refY="5"
              orient="auto"
              markerUnits="userSpaceOnUse"
            >
              <image href={DIAGRAM_ARROW_ICON} x="0" y="0" width="10" height="10" preserveAspectRatio="xMidYMid meet" />
            </marker>
            <marker
              id={`${markerPrefix}-arrow-start`}
              markerWidth="10"
              markerHeight="10"
              refX="9"
              refY="5"
              orient="auto"
              markerUnits="userSpaceOnUse"
            >
              <image href={DIAGRAM_ARROW_ICON} x="0" y="0" width="10" height="10" preserveAspectRatio="xMidYMid meet" />
            </marker>
          </defs>
          {diagram.phaseConnectors.map((connector) => (
            <path
              key={connector.key}
              d={connector.path}
              fill="none"
              stroke={DIAGRAM_CONDITIONAL_COLOR}
              strokeWidth="4"
              strokeLinecap="square"
              strokeLinejoin="miter"
              markerEnd={`url(#${markerPrefix}-arrow-conditional)`}
            />
          ))}
          {diagram.edges.map((edge) => (
            <path
              key={edge.key}
              d={edge.path}
              fill="none"
              stroke={edge.color}
              strokeWidth={edge.isLoop ? "3" : "4"}
              strokeLinecap="square"
              strokeLinejoin="miter"
              markerEnd={`url(#${markerPrefix}-arrow-${edge.marker})`}
            />
          ))}
        </svg>

        {diagram.edges.map((edge) => edge.label && (
          <span
            key={`${edge.key}-label`}
            className="pointer-events-none absolute z-20 max-w-28 truncate rounded bg-[#070914]/90 px-1.5 py-0.5 text-[10px] font-bold tabular-nums"
            style={{
              left: edge.labelX,
              top: edge.labelY,
              color: edge.color,
              transform: "translate(-50%, -50%)",
            }}
            title={edge.label}
          >
            {edge.label}
          </span>
        ))}

        {diagram.nodes.map((node) => (
          <PatternMoveStateNode
            key={node.id}
            node={node}
            monster={monster}
            serviceLocale={serviceLocale}
            onSelectMove={onSelectMove}
            powerById={powerById}
            cardById={cardById}
          />
        ))}
      </div>
    </div>
  );
}

function PatternMoveStateNode({
  node,
  monster,
  serviceLocale,
  onSelectMove,
  powerById,
  cardById,
}: {
  node: PatternDiagramNode;
  monster: CodexMonster;
  serviceLocale: ServiceLocale;
  onSelectMove: (moveId: string) => void;
  powerById: Map<string, CodexPower>;
  cardById: Map<string, CodexCard>;
}) {
  const move = getMonsterMove(monster, node.id);
  const damageEntry = monster.damageValues ? findDamageForMove(node.id, monster.damageValues) : null;
  const blockEntry = monster.blockValues ? findBlockForMove(node.id, monster.blockValues) : null;
  const title = move ? `${move.name}${move.nameEn !== move.name ? ` / ${move.nameEn}` : ""}` : getMoveName(monster, node.id);

  return (
    <button
      type="button"
      className="absolute z-10 overflow-hidden bg-transparent px-3 py-2 text-center shadow-[0_0_18px_rgba(0,0,0,0.25)] transition-transform hover:scale-[1.02]"
      style={{
        ...PATTERN_MOVE_PANEL_STYLE,
        left: node.x,
        top: node.y,
        width: node.width,
        height: node.height,
      }}
      title={title}
      aria-label={title}
      onClick={() => onSelectMove(node.id)}
    >
      <span className="relative z-10 flex h-full min-w-0 flex-col items-center justify-center gap-1">
        <span className="flex max-w-full flex-wrap items-center justify-center gap-x-1 gap-y-0.5">
          {damageEntry && (
            <MetricTokenValue value={damageEntry} kind="attack" compact />
          )}
          {blockEntry && (
            <MetricTokenValue value={blockEntry} kind="block" compact />
          )}
        </span>
        {move && (move.powerApplications.length > 0 || move.cardApplications.length > 0) && (
          <span className="flex max-w-full flex-wrap items-center justify-center gap-0.5 overflow-hidden">
            <MoveApplicationTokens
              powers={move.powerApplications.slice(0, 3)}
              cards={move.cardApplications.slice(0, 3)}
              serviceLocale={serviceLocale}
              powerById={powerById}
              cardById={cardById}
            />
          </span>
        )}
      </span>
    </button>
  );
}

interface MonsterDetailProps {
  serviceLocale: ServiceLocale;
  gameUi: CodexGameUiLabels;
  backToListTitle: string;
  monster: CodexMonster;
  encounters: CodexEncounter[];
  cards?: CodexCard[];
  powers?: CodexPower[];
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
  cards = [],
  powers = [],
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
        actionTypes: "행동 타입",
        appliedTokens: "적용 토큰",
        patternKind: "패턴 종류",
        phases: "페이즈",
        hasPhases: "페이즈 있음",
        noPhases: "페이즈 없음",
        noPattern: "패턴 데이터 없음",
      }
    : {
        englishName: "English name",
        patchHistory: "Patch History",
        noPatchHistory: "No structured changes",
        numericDetails: "Numbers",
        actionTypes: "Action Types",
        appliedTokens: "Applied Tokens",
        patternKind: "Pattern Type",
        phases: "Phases",
        hasPhases: "Has phases",
        noPhases: "No phases",
        noPattern: "No pattern data",
      };
  const displayType = getBestiaryDisplayMonsterType(monster.id, monster.type);
  const typeConfig = MONSTER_TYPE_CONFIG[displayType];
  const meaningfulMoves = useMemo(
    () => buildMonsterActionMoves(monster),
    [monster],
  );
  const moveSummaries = useMemo(() => buildMoveSummaries(monster, meaningfulMoves), [monster, meaningfulMoves]);
  const transitionRows = useMemo(() => buildTransitionTableRows(monster), [monster]);
  const patternSummary = useMemo(() => buildPatternSummary(monster), [monster]);
  const loopLength = useMemo(() => getFixedLoopLength(monster), [monster]);
  const firstMoveId = monster.moveGraph?.initial ?? null;
  const [selectedMoveState, setSelectedMoveState] = useState<{ monsterId: string; moveId: string | null; nonce: number }>({
    monsterId: monster.id,
    moveId: null,
    nonce: 0,
  });
  const [selectedSkinState, setSelectedSkinState] = useState<{ monsterId: string; selections: MonsterSkinSelections }>({
    monsterId: monster.id,
    selections: getDefaultMonsterSkinSelections(monster),
  });
  const selectedMoveId = selectedMoveState.monsterId === monster.id ? selectedMoveState.moveId : null;
  const selectedMoveNonce = selectedMoveState.monsterId === monster.id ? selectedMoveState.nonce : 0;
  const selectMove = (moveId: string) => {
    setSelectedMoveState((state) => ({
      monsterId: monster.id,
      moveId,
      nonce: state.monsterId === monster.id ? state.nonce + 1 : 1,
    }));
  };
  const selectedSkinSelections = selectedSkinState.monsterId === monster.id
    ? selectedSkinState.selections
    : getDefaultMonsterSkinSelections(monster);
  const selectedSkinNames = getSelectedMonsterSkinNames(monster, selectedSkinSelections);
  const selectedSingleSkin = selectedSkinNames.length > 0 ? null : getSingleMonsterSkin(monster);
  const defaultSelectedMove = moveSummaries.find((summary) => summary.move.id === firstMoveId) ?? moveSummaries[0] ?? null;
  const selectedMove = moveSummaries.find((summary) => summary.move.id === selectedMoveId) ?? defaultSelectedMove;
  const selectedAccent = selectedMove ? getMoveToneColor(selectedMove.tone, typeConfig.color) : typeConfig.color;
  const imageSrc = monster.imageUrl ?? monster.bossImageUrl;
  const skinParts = getMonsterSkinParts(monster.spineAsset);
  const activeSkinKey = getMonsterSkinRenderKey(selectedSkinNames, selectedSingleSkin);
  const [commentCount, setCommentCount] = useState(0);
  const encounterById = useMemo(() => new Map(encounters.map((encounter) => [encounter.id, encounter])), [encounters]);
  const relatedEncounterTargets: CodexReferenceTarget[] = getRelatedEncounterIdsForMonster(monster.id, encounters).flatMap((encounterId) => {
    const encounter = encounterById.get(encounterId);
    if (!encounter) return [];
    const href = `/compendium/encounters/${encounter.id.toLowerCase()}`;
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
  const cardById = useMemo(() => new Map(cards.map((card) => [card.id, card])), [cards]);
  const powerById = useMemo(() => new Map(powers.map((power) => [power.id, power])), [powers]);

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
        <section className="flex min-h-[26rem] flex-col items-center justify-center gap-4 py-4">
          <div className="relative flex min-h-[22rem] w-full max-w-2xl items-center justify-center overflow-hidden">
            <div
              className="absolute bottom-10 left-[18%] right-[18%] h-8 rounded-[50%] blur-md"
              style={{ backgroundColor: hexToRgba(selectedAccent, 0.18) }}
            />
            {imageSrc ? (
              <MonsterSpineStage
                key={`${monster.id}-${activeSkinKey}-${selectedMoveId ?? "idle"}-${selectedMoveNonce}`}
                asset={monster.spineAsset}
                fallbackImageUrl={imageSrc}
                monsterName={monster.name}
                selectedMoveId={selectedMoveId}
                selectedMoveNonce={selectedMoveNonce}
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

          <div className="text-center">
            <h1
              className="font-game-title break-keep text-3xl font-bold leading-tight text-gray-100 sm:text-4xl"
              style={{ color: typeConfig.color }}
            >
              {monster.name}
            </h1>
          </div>

          {skinParts.length > 0 && (
            <div className="w-full max-w-xl rounded-lg border border-white/10 bg-black/20 px-4 py-3">
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
        </section>

        <aside className="flex min-w-0 flex-col gap-3">
          <section className="rounded-lg border border-white/10 bg-black/20 px-4 py-3">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <MetaPill value={gameUi.monsterTypes[displayType].label} color={typeConfig.color} />
                {formatHp(monster) && (
                  <MetaPill>
                    <HpTokenValue monster={monster} />
                  </MetaPill>
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

          <InfoRailSection title={monsterText.actionPreview}>
            {moveSummaries.length > 0 ? (
              <div className="space-y-1.5 pr-1">
                {moveSummaries.map((summary) => {
                  const isSelected = selectedMoveId === summary.move.id;

                  return (
                    <button
                      key={summary.move.id}
                      type="button"
                      onClick={() => selectMove(summary.move.id)}
                      className="w-full rounded-md border px-2.5 py-2.5 text-left transition-colors hover:bg-white/[0.06]"
                      style={{
                        backgroundColor: isSelected ? "rgba(255,255,255,0.055)" : "rgba(255,255,255,0.015)",
                        borderColor: isSelected ? "rgba(239,200,81,0.65)" : "rgba(255, 255, 255, 0.06)",
                      }}
                    >
                      <div className="flex items-start gap-2.5">
                        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                          <span>
                            <span className="font-game-title block truncate text-sm font-semibold text-gray-100">{summary.move.name}</span>
                            {summary.move.nameEn !== summary.move.name && (
                              <span className="font-game-text block truncate text-[11px] text-gray-500">{summary.move.nameEn}</span>
                            )}
                          </span>
                          <MoveApplicationTokens
                            powers={summary.move.powerApplications}
                            cards={summary.move.cardApplications}
                            serviceLocale={serviceLocale}
                            powerById={powerById}
                            cardById={cardById}
                          />
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-1">
                          <MoveMetrics summary={summary} />
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-500">{commonText.noResults}</p>
            )}
          </InfoRailSection>

          {transitionRows.length > 0 && (
            <InfoRailSection title={monsterText.actionGraph}>
              <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-400">
                <span>{getPatternKindLabel(patternSummary.kind, serviceLocale)}</span>
                {loopLength && (
                  <span className="font-semibold text-[#efc851]">
                    {serviceLocale === "ko" ? `${loopLength}턴 반복` : `${loopLength}-turn loop`}
                  </span>
                )}
              </div>

              {patternSummary.hasPhases && (
                <div className="mb-3 grid gap-1.5 text-xs text-gray-400">
                  {patternSummary.phases.map((phase) => (
                    <div key={phase.id} className="flex flex-wrap items-center gap-1.5">
                      <span className="font-game-title font-semibold text-[#29ebc0]">
                        {serviceLocale === "ko" ? `페이즈 ${phase.label}` : `Phase ${phase.label}`}
                      </span>
                      <span>{phase.moveIds.map((moveId) => getMoveName(monster, moveId)).join(" → ")}</span>
                    </div>
                  ))}
                </div>
              )}

              <PatternStateTransitionDiagram
                monster={monster}
                phases={patternSummary.phases}
                rows={transitionRows}
                serviceLocale={serviceLocale}
                onSelectMove={selectMove}
                powerById={powerById}
                cardById={cardById}
              />
              {monster.moveGraph?.confidence === "partial" && (
                <p className="mt-3 text-[11px] leading-relaxed text-gray-500">{monsterText.graphPartial}</p>
              )}
            </InfoRailSection>
          )}

          <EntityReferenceGroupLinks
            gameUi={gameUi}
            serviceLocale={serviceLocale}
            groups={[
              { kind: "encounter", targets: relatedEncounterTargets },
            ]}
          />

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

const DIAGRAM_CELL_WIDTH = 148;
const DIAGRAM_CELL_HEIGHT = 96;
const DIAGRAM_H_GAP = 82;
const DIAGRAM_V_GAP = 24;
const DIAGRAM_PAD = 84;
const DIAGRAM_ROW_GAP = 76;
const DIAGRAM_ARROW_COLOR = "#efc851";
const DIAGRAM_CONDITIONAL_COLOR = "#ff4545";
const BESTIARY_START_COLOR = "#60a5fa";
const DIAGRAM_ARROW_ICON = "/images/sts2/ui/settings_tiny_right_arrow.png";
const PATTERN_MOVE_PANEL_STYLE: CSSProperties = {
  borderStyle: "solid",
  borderColor: "transparent",
  borderTopWidth: "12px",
  borderRightWidth: "24px",
  borderBottomWidth: "10px",
  borderLeftWidth: "16px",
  borderImageSource: "url('/images/sts2/ui/hover_tip.png')",
  borderImageSlice: "43 91 32 55 fill",
  borderImageWidth: "12px 24px 10px 16px",
  borderImageRepeat: "stretch",
  boxSizing: "border-box",
};
const METRIC_TOKEN_ICONS = {
  attack: "/images/sts2/intents/attack.png",
  block: "/images/sts2/ui/combat/block.png",
  hp: "/images/sts2/ui/topbar/top_bar_heart.png",
};

function buildPowerEntity(
  application: MonsterMovePowerApplication,
  power: CodexPower | undefined,
): EntityInfo {
  const href = `/compendium/powers?power=${application.powerId.toLowerCase()}`;
  const powerData = power ? applyMovePowerAmount(power, application.amount) : undefined;
  return {
    id: application.powerId,
    nameEn: powerData?.nameEn ?? application.powerNameEn,
    nameKo: powerData?.name ?? application.powerName,
    imageUrl: powerData?.imageUrl ?? application.imageUrl,
    href,
    color: powerData?.type ?? application.powerType,
    type: "power",
    powerData,
  };
}

function applyMovePowerAmount(power: CodexPower, amount: DamageValue | null): CodexPower {
  if (!amount || amount.normal == null || !power.descriptionRaw?.includes("{Amount}")) return power;
  const vars = {
    ...power.vars,
    Amount: amount.normal,
  };
  return {
    ...power,
    vars,
    description: bakeDescription(power.descriptionRaw, vars),
  };
}

function buildCardEntity(
  application: MonsterMoveCardApplication,
  card: CodexCard | undefined,
): EntityInfo {
  const href = `/compendium/cards?card=${application.cardId.toLowerCase()}`;
  return {
    id: application.cardId,
    nameEn: card?.nameEn ?? application.cardNameEn,
    nameKo: card?.name ?? application.cardName,
    imageUrl: card?.imageUrl ?? application.imageUrl,
    href,
    color: "card",
    type: "card",
    cardData: card,
  };
}

function buildPatternDiagramModel(
  monster: CodexMonster,
  rows: TransitionTableRow[],
  phases: PatternPhase[],
  serviceLocale: ServiceLocale,
): PatternDiagramModel | null {
  const transitions = rows.filter((row) => !row.isStart && row.from !== "__START__" && row.to !== "__START__");
  const initialMoveId = monster.moveGraph?.initial ?? rows.find((row) => row.isStart)?.to ?? null;
  const nodeIds = new Set<string>();
  if (initialMoveId) nodeIds.add(initialMoveId);
  transitions.forEach((transition) => {
    nodeIds.add(transition.from);
    nodeIds.add(transition.to);
  });

  const orderedNodeIds = Array.from(nodeIds).filter((nodeId) => !isHiddenDiagramMove(nodeId));
  if (orderedNodeIds.length === 0) return null;

  const outgoing = buildOutgoingMap(transitions);
  const order = getReachableOrder(initialMoveId ?? orderedNodeIds[0] ?? null, outgoing);
  const sortedNodeIds = orderedNodeIds.sort((a, b) => getDiagramOrder(a, orderedNodeIds, order) - getDiagramOrder(b, orderedNodeIds, order));
  const phaseAssignments = buildDiagramPhaseAssignments(sortedNodeIds, outgoing, phases);
  const phaseById = new Map(phases.map((phase) => [phase.id, phase]));
  const groups = buildDiagramGroups(sortedNodeIds, phaseAssignments, phases, initialMoveId, serviceLocale);

  const nodes: PatternDiagramNode[] = [];
  const phaseBoxes: PatternDiagramPhaseBox[] = [];
  let cursorY = DIAGRAM_PAD;
  let maxRight = DIAGRAM_PAD + DIAGRAM_CELL_WIDTH;

  groups.forEach((group) => {
    const groupNodeSet = new Set(group.nodeIds);
    const localOutgoing = new Map<string, string[]>();
    transitions.forEach((transition) => {
      if (!groupNodeSet.has(transition.from) || !groupNodeSet.has(transition.to)) return;
      localOutgoing.set(transition.from, [...(localOutgoing.get(transition.from) ?? []), transition.to]);
    });

    const localIncoming = new Map<string, number>();
    transitions.forEach((transition) => {
      if (groupNodeSet.has(transition.from) && groupNodeSet.has(transition.to)) {
        localIncoming.set(transition.to, (localIncoming.get(transition.to) ?? 0) + 1);
      }
    });

    const groupStart = group.nodeIds.includes(initialMoveId ?? "")
      ? initialMoveId
      : group.nodeIds.find((nodeId) => !localIncoming.has(nodeId)) ?? group.nodeIds[0] ?? null;
    const depths = buildDiagramDepths(group.nodeIds, localOutgoing, groupStart);
    const columns = new Map<number, string[]>();
    group.nodeIds.forEach((nodeId) => {
      const depth = depths.get(nodeId) ?? 0;
      columns.set(depth, [...(columns.get(depth) ?? []), nodeId]);
    });

    const sortedColumns = Array.from(columns.entries())
      .sort(([a], [b]) => a - b)
      .map(([depth, columnNodeIds]) => [
        depth,
        columnNodeIds.sort((a, b) => getDiagramOrder(a, sortedNodeIds, order) - getDiagramOrder(b, sortedNodeIds, order)),
      ] as const);
    const maxColumnHeight = Math.max(
      DIAGRAM_CELL_HEIGHT,
      ...sortedColumns.map(([, columnNodeIds]) => (
        columnNodeIds.length * DIAGRAM_CELL_HEIGHT + Math.max(0, columnNodeIds.length - 1) * DIAGRAM_V_GAP
      )),
    );
    const nodeAreaTop = cursorY + (group.isPhase ? 26 : 0);

    sortedColumns.forEach(([depth, columnNodeIds]) => {
      const columnHeight = columnNodeIds.length * DIAGRAM_CELL_HEIGHT + Math.max(0, columnNodeIds.length - 1) * DIAGRAM_V_GAP;
      const columnTop = nodeAreaTop + (maxColumnHeight - columnHeight) / 2;
      columnNodeIds.forEach((nodeId, index) => {
        const x = DIAGRAM_PAD + depth * (DIAGRAM_CELL_WIDTH + DIAGRAM_H_GAP);
        const y = columnTop + index * (DIAGRAM_CELL_HEIGHT + DIAGRAM_V_GAP);
        nodes.push({
          id: nodeId,
          x,
          y,
          width: DIAGRAM_CELL_WIDTH,
          height: DIAGRAM_CELL_HEIGHT,
          isInitial: nodeId === initialMoveId,
          phaseId: phaseAssignments.get(nodeId) ?? null,
        });
        maxRight = Math.max(maxRight, x + DIAGRAM_CELL_WIDTH + DIAGRAM_PAD);
      });
    });

    if (group.isPhase && group.nodeIds.length > 0) {
      const groupNodes = nodes.filter((node) => groupNodeSet.has(node.id));
      const minX = Math.min(...groupNodes.map((node) => node.x));
      const minY = Math.min(...groupNodes.map((node) => node.y));
      const maxX = Math.max(...groupNodes.map((node) => node.x + node.width));
      const maxY = Math.max(...groupNodes.map((node) => node.y + node.height));
      const phase = phaseById.get(group.id);
      phaseBoxes.push({
        id: group.id,
        label: phase ? group.label : group.label,
        x: minX - 18,
        y: minY - 28,
        width: maxX - minX + 36,
        height: maxY - minY + 44,
      });
    }

    cursorY = nodeAreaTop + maxColumnHeight + DIAGRAM_ROW_GAP;
  });

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const edges = transitions.flatMap((transition, index) => {
    const edge = buildDiagramEdge(transition, nodeById, index);
    return edge ? [edge] : [];
  });
  const choiceBoxes = buildChoiceBoxes(transitions, nodeById);
  const phaseConnectors = buildPhaseConnectors(phaseBoxes);

  return {
    width: Math.max(360, maxRight),
    height: Math.max(180, cursorY + DIAGRAM_PAD - DIAGRAM_ROW_GAP),
    nodes,
    edges,
    phaseBoxes,
    choiceBoxes,
    phaseConnectors,
  };
}

function buildDiagramGroups(
  nodeIds: string[],
  phaseAssignments: Map<string, string>,
  phases: PatternPhase[],
  initialMoveId: string | null,
  serviceLocale: ServiceLocale,
): Array<{ id: string; label: string; nodeIds: string[]; isPhase: boolean }> {
  if (phases.length <= 1) {
    return [{ id: "main", label: "", nodeIds, isPhase: false }];
  }

  const groups = phases.flatMap((phase) => {
    const assignedNodeIds = nodeIds.filter((nodeId) => phaseAssignments.get(nodeId) === phase.id);
    if (assignedNodeIds.length === 0) return [];
    return [{
      id: phase.id,
      label: serviceLocale === "ko" ? `페이즈 ${phase.label}` : `Phase ${phase.label}`,
      nodeIds: assignedNodeIds,
      isPhase: true,
    }];
  });
  const unassigned = nodeIds.filter((nodeId) => !phaseAssignments.has(nodeId));
  if (unassigned.length === 0) return groups;

  const unassignedGroup = {
    id: "unassigned",
    label: serviceLocale === "ko" ? "조건 전이" : "Conditional",
    nodeIds: unassigned,
    isPhase: false,
  };

  if (initialMoveId && unassigned.includes(initialMoveId)) {
    return [unassignedGroup, ...groups];
  }
  return [...groups, unassignedGroup];
}

function buildDiagramPhaseAssignments(
  nodeIds: string[],
  outgoing: Map<string, string[]>,
  phases: PatternPhase[],
): Map<string, string> {
  const assignments = new Map<string, string>();
  const phaseByMove = new Map<string, string>();
  phases.forEach((phase) => {
    phase.moveIds.forEach((moveId) => phaseByMove.set(moveId, phase.id));
  });
  const reachablePhaseCache = new Map<string, Set<string>>();

  const collectReachablePhases = (nodeId: string, seen = new Set<string>()): Set<string> => {
    if (reachablePhaseCache.has(nodeId)) return new Set(reachablePhaseCache.get(nodeId));
    if (seen.has(nodeId)) return new Set();
    seen.add(nodeId);

    const phaseId = phaseByMove.get(nodeId);
    const reachable = new Set<string>();
    if (phaseId) reachable.add(phaseId);
    for (const next of outgoing.get(nodeId) ?? []) {
      collectReachablePhases(next, new Set(seen)).forEach((reachablePhaseId) => reachable.add(reachablePhaseId));
    }
    reachablePhaseCache.set(nodeId, reachable);
    return new Set(reachable);
  };

  nodeIds.forEach((nodeId) => {
    const directPhaseId = phaseByMove.get(nodeId);
    if (directPhaseId) {
      assignments.set(nodeId, directPhaseId);
      return;
    }

    if (phases.length <= 1) return;
    const reachablePhases = collectReachablePhases(nodeId);
    if (reachablePhases.size === 1) {
      assignments.set(nodeId, Array.from(reachablePhases)[0]);
    }
  });

  return assignments;
}

function buildDiagramDepths(
  nodeIds: string[],
  outgoing: Map<string, string[]>,
  start: string | null,
): Map<string, number> {
  const nodeSet = new Set(nodeIds);
  const depths = new Map<string, number>();
  const queue: Array<{ nodeId: string; depth: number }> = [];
  if (start && nodeSet.has(start)) queue.push({ nodeId: start, depth: 0 });

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || depths.has(current.nodeId)) continue;
    depths.set(current.nodeId, current.depth);
    for (const next of outgoing.get(current.nodeId) ?? []) {
      if (nodeSet.has(next) && !depths.has(next)) {
        queue.push({ nodeId: next, depth: current.depth + 1 });
      }
    }
  }

  let fallbackDepth = depths.size > 0 ? Math.max(...depths.values()) + 1 : 0;
  nodeIds.forEach((nodeId) => {
    if (depths.has(nodeId)) return;
    depths.set(nodeId, fallbackDepth);
    fallbackDepth += 1;
  });
  return depths;
}

function buildDiagramEdge(
  transition: TransitionTableRow,
  nodeById: Map<string, PatternDiagramNode>,
  index: number,
): PatternDiagramEdge | null {
  const from = nodeById.get(transition.from);
  const to = nodeById.get(transition.to);
  if (!from || !to) return null;

  const kind = transition.kind === "conditional" ? "conditional" : transition.kind === "start" ? "start" : "fixed";
  const color = kind === "conditional" ? DIAGRAM_CONDITIONAL_COLOR : kind === "start" ? BESTIARY_START_COLOR : DIAGRAM_ARROW_COLOR;
  const marker = kind === "conditional" ? "conditional" : kind === "start" ? "start" : "normal";
  const laneOffset = (index % 5) * 7;
  const label = getDiagramEdgeLabel(transition);
  const isLoop = from.id === to.id || to.x <= from.x;
  let path: string;
  let labelX: number;
  let labelY: number;

  if (from.id === to.id) {
    const startX = from.x + from.width;
    const startY = from.y + from.height / 2;
    const loopX = startX + 34 + laneOffset;
    const loopY = from.y - 20 - laneOffset;
    const endX = from.x + from.width * 0.58;
    const endY = from.y;
    path = `M ${startX} ${startY} H ${loopX} V ${loopY} H ${endX} V ${endY}`;
    labelX = loopX;
    labelY = loopY - 8;
  } else if (to.x > from.x + from.width / 2) {
    const startX = from.x + from.width;
    const startY = from.y + from.height / 2;
    const endX = to.x;
    const endY = to.y + to.height / 2;
    const midX = (startX + endX) / 2 + laneOffset;
    path = `M ${startX} ${startY} H ${midX} V ${endY} H ${endX}`;
    labelX = midX;
    labelY = (startY + endY) / 2;
  } else if (to.x + to.width < from.x + from.width / 2) {
    const startX = from.x + from.width / 2;
    const startY = from.y;
    const endX = to.x + to.width / 2;
    const endY = to.y;
    const loopY = Math.min(from.y, to.y) - 34 - laneOffset;
    path = `M ${startX} ${startY} V ${loopY} H ${endX} V ${endY}`;
    labelX = (startX + endX) / 2;
    labelY = loopY - 8;
  } else {
    const startX = from.x + from.width;
    const startY = from.y + from.height / 2;
    const endX = to.x + to.width;
    const endY = to.y + to.height / 2;
    const channelX = Math.max(startX, endX) + 38 + laneOffset;
    path = `M ${startX} ${startY} H ${channelX} V ${endY} H ${endX}`;
    labelX = channelX;
    labelY = (startY + endY) / 2;
  }

  return {
    key: transition.key,
    from: transition.from,
    to: transition.to,
    path,
    color,
    marker,
    isLoop,
    label,
    labelX,
    labelY,
  };
}

function buildPhaseConnectors(phaseBoxes: PatternDiagramPhaseBox[]): PatternDiagramPhaseConnector[] {
  const sortedPhaseBoxes = [...phaseBoxes].sort((a, b) => a.y - b.y);
  return sortedPhaseBoxes.flatMap((box, index) => {
    const next = sortedPhaseBoxes[index + 1];
    if (!next) return [];
    const fromX = box.x + box.width / 2;
    const fromY = box.y + box.height;
    const toX = next.x + next.width / 2;
    const toY = next.y;
    const midY = (fromY + toY) / 2;
    const path = fromX === toX
      ? `M ${fromX} ${fromY} V ${toY}`
      : `M ${fromX} ${fromY} V ${midY} H ${toX} V ${toY}`;
    return [{ key: `${box.id}-${next.id}`, path }];
  });
}

function buildChoiceBoxes(
  transitions: TransitionTableRow[],
  nodeById: Map<string, PatternDiagramNode>,
): PatternDiagramChoiceBox[] {
  const bySource = new Map<string, TransitionTableRow[]>();
  transitions.forEach((transition) => {
    if (transition.kind !== "random" && transition.kind !== "conditional") return;
    bySource.set(transition.from, [...(bySource.get(transition.from) ?? []), transition]);
  });

  return Array.from(bySource.entries()).flatMap(([sourceId, sourceTransitions]) => {
    const sourceNode = nodeById.get(sourceId);
    if (!sourceNode || sourceTransitions.length < 2) return [];
    const targetNodes = Array.from(new Set(sourceTransitions.map((transition) => transition.to)))
      .map((targetId) => nodeById.get(targetId))
      .filter((node): node is PatternDiagramNode => Boolean(node));
    if (targetNodes.length < 2) return [];

    const minTargetX = Math.min(...targetNodes.map((node) => node.x));
    if (minTargetX <= sourceNode.x + sourceNode.width) return [];

    const minX = Math.min(...targetNodes.map((node) => node.x)) - 16;
    const minY = Math.min(...targetNodes.map((node) => node.y)) - 16;
    const maxX = Math.max(...targetNodes.map((node) => node.x + node.width)) + 16;
    const maxY = Math.max(...targetNodes.map((node) => node.y + node.height)) + 16;

    return [{
      id: `choice-${sourceId}`,
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    }];
  });
}

function buildOutgoingMap(rows: TransitionTableRow[]): Map<string, string[]> {
  const outgoing = new Map<string, string[]>();
  rows.forEach((row) => {
    if (row.from === "__START__") return;
    outgoing.set(row.from, [...(outgoing.get(row.from) ?? []), row.to]);
  });
  return outgoing;
}

function getDiagramOrder(nodeId: string, nodeIds: string[], order: Map<string, number>): number {
  return order.get(nodeId) ?? nodeIds.indexOf(nodeId) + 1000;
}

function getDiagramEdgeLabel(row: TransitionTableRow): string | null {
  if (row.condition) return row.condition;
  if (row.kind === "random") {
    return row.chance == null ? "?" : formatChancePercent(row.chance);
  }
  return null;
}

function formatChancePercent(chance: number): string {
  return `${Number.isInteger(chance) ? chance : chance.toFixed(1)}%`;
}

function isHiddenDiagramMove(moveId: string): boolean {
  return moveId === "DEAD" || moveId === "SPAWNED" || moveId === "__START__";
}

function sanitizeSvgId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-");
}

function buildMonsterActionMoves(monster: CodexMonster): MonsterMove[] {
  const byId = new Map<string, MonsterMove>();
  const addMove = (move: MonsterMove | undefined) => {
    if (!move) return;
    if (move.id === "DEAD" || move.id === "SPAWNED") return;
    if (!byId.has(move.id)) byId.set(move.id, move);
  };

  const allMoves = [...monster.moves, ...monster.bestiaryMoves];
  const allMovesById = new Map(allMoves.map((move) => [move.id, move]));

  if (monster.moveGraph?.initial) addMove(allMovesById.get(monster.moveGraph.initial));
  for (const transition of monster.moveGraph?.transitions ?? []) {
    if (transition.from !== "__START__") addMove(allMovesById.get(transition.from));
    addMove(allMovesById.get(transition.to));
  }

  monster.bestiaryMoves.forEach(addMove);
  if (byId.size === 0) monster.moves.forEach(addMove);

  return Array.from(byId.values());
}

function buildPatternSummary(monster: CodexMonster): PatternSummary {
  const transitions = monster.moveGraph?.transitions ?? [];
  if (transitions.length === 0) {
    return { kind: "unknown", hasPhases: false, phases: [] };
  }

  const kinds = new Set(transitions.map((transition) => transition.kind ?? inferTransitionKind(transition)));
  const hasRandom = kinds.has("random");
  const hasConditional = kinds.has("conditional");
  const kind: PatternKind = hasRandom && hasConditional
    ? "mixed"
    : hasConditional ? "conditional"
      : hasRandom ? "random"
        : "fixed";
  const phases = buildPatternPhases(monster);

  return {
    kind,
    hasPhases: phases.length > 1,
    phases,
  };
}

function buildPatternPhases(monster: CodexMonster): PatternPhase[] {
  const transitions = monster.moveGraph?.transitions ?? [];
  const nodes = new Set<string>();
  const outgoing = new Map<string, string[]>();

  for (const transition of transitions) {
    if (transition.from !== "__START__") nodes.add(transition.from);
    nodes.add(transition.to);
    if (transition.from !== "__START__") {
      outgoing.set(transition.from, [...(outgoing.get(transition.from) ?? []), transition.to]);
    }
  }

  const components = getStronglyConnectedComponents(Array.from(nodes), outgoing);
  const recurrent = components.filter((component) => {
    if (component.length > 1) return true;
    const [node] = component;
    return (outgoing.get(node) ?? []).includes(node);
  });

  if (recurrent.length <= 1) return [];

  const order = getReachableOrder(monster.moveGraph?.initial ?? transitions[0]?.to ?? null, outgoing);
  return recurrent
    .sort((a, b) => componentOrder(a, order) - componentOrder(b, order))
    .map((component, index) => ({
      id: component.join("|"),
      label: `${index + 1}`,
      moveIds: component.sort((a, b) => (order.get(a) ?? Number.MAX_SAFE_INTEGER) - (order.get(b) ?? Number.MAX_SAFE_INTEGER)),
    }));
}

function getStronglyConnectedComponents(nodes: string[], outgoing: Map<string, string[]>): string[][] {
  const indexByNode = new Map<string, number>();
  const lowLinkByNode = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const components: string[][] = [];
  let index = 0;

  const visit = (node: string) => {
    indexByNode.set(node, index);
    lowLinkByNode.set(node, index);
    index += 1;
    stack.push(node);
    onStack.add(node);

    for (const next of outgoing.get(node) ?? []) {
      if (!indexByNode.has(next)) {
        visit(next);
        lowLinkByNode.set(node, Math.min(lowLinkByNode.get(node) ?? 0, lowLinkByNode.get(next) ?? 0));
      } else if (onStack.has(next)) {
        lowLinkByNode.set(node, Math.min(lowLinkByNode.get(node) ?? 0, indexByNode.get(next) ?? 0));
      }
    }

    if (lowLinkByNode.get(node) !== indexByNode.get(node)) return;

    const component: string[] = [];
    let current: string | undefined;
    do {
      current = stack.pop();
      if (!current) break;
      onStack.delete(current);
      component.push(current);
    } while (current !== node);
    components.push(component);
  };

  nodes.forEach((node) => {
    if (!indexByNode.has(node)) visit(node);
  });

  return components;
}

function getReachableOrder(start: string | null, outgoing: Map<string, string[]>): Map<string, number> {
  const order = new Map<string, number>();
  if (!start) return order;
  const queue = [start];

  while (queue.length > 0) {
    const node = queue.shift();
    if (!node || order.has(node)) continue;
    order.set(node, order.size);
    for (const next of outgoing.get(node) ?? []) queue.push(next);
  }

  return order;
}

function componentOrder(component: string[], order: Map<string, number>): number {
  return Math.min(...component.map((node) => order.get(node) ?? Number.MAX_SAFE_INTEGER));
}

function inferTransitionKind(transition: MonsterMoveTransition): MonsterMoveTransitionKind {
  if (transition.condition) return "conditional";
  if (transition.chance != null && transition.chance < 100) return "random";
  return "fixed";
}

function getPatternKindLabel(kind: PatternKind, serviceLocale: ServiceLocale): string {
  const labels: Record<PatternKind, { ko: string; en: string }> = {
    fixed: { ko: "고정 반복", en: "Fixed" },
    random: { ko: "무작위", en: "Random" },
    conditional: { ko: "조건부", en: "Conditional" },
    mixed: { ko: "혼합", en: "Mixed" },
    unknown: { ko: "미확인", en: "Unknown" },
  };
  return serviceLocale === "ko" ? labels[kind].ko : labels[kind].en;
}

function getFixedLoopLength(monster: CodexMonster): number | null {
  const graph = monster.moveGraph;
  if (!graph?.initial) return null;
  const transitions = graph.transitions.filter((transition) => {
    const kind = transition.kind ?? inferTransitionKind(transition);
    return kind === "fixed" && transition.from !== "__START__";
  });
  if (transitions.length === 0 || transitions.length !== graph.transitions.length) return null;
  const nextByMove = new Map<string, string>();
  for (const transition of transitions) {
    if (nextByMove.has(transition.from)) return null;
    nextByMove.set(transition.from, transition.to);
  }

  const seen = new Set<string>();
  let current = graph.initial;
  while (!seen.has(current)) {
    seen.add(current);
    const next = nextByMove.get(current);
    if (!next) return null;
    current = next;
  }

  return current === graph.initial ? seen.size : null;
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

function getMoveTone(move: MonsterMove, damageEntry: DamageValue | null, blockEntry: DamageValue | null): MoveTone {
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

function formatNumericValue(value: DamageValue): string {
  const normal = value.normal ?? "?";
  if (value.ascension != null && value.ascension !== value.normal) {
    return `${normal} (${value.ascension})`;
  }
  return `${normal}`;
}

function normalizeNumericValue(value: DamageValue | number): DamageValue {
  return typeof value === "number" ? { normal: value, ascension: null } : value;
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
      kind: "start",
      condition: null,
    });
  }

  transitions.forEach((transition, index) => {
    rows.push({
      key: `${transition.from}-${transition.to}-${transition.chance ?? "unknown"}-${index}`,
      from: transition.from,
      to: transition.to,
      chance: transition.chance,
      isStart: transition.from === "__START__",
      kind: transition.from === "__START__" ? "start" : transition.kind ?? inferTransitionKind(transition),
      condition: transition.condition ?? null,
    });
  });

  return rows;
}

function getMonsterMove(monster: CodexMonster, moveId: string): MonsterMove | null {
  return [...monster.bestiaryMoves, ...monster.moves].find((move) => move.id === moveId) ?? null;
}

function getMoveName(monster: CodexMonster, moveId: string): string {
  if (moveId === "__START__") return "Start";
  const move = getMonsterMove(monster, moveId);
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

function findBlockForMove(moveId: string, blockValues: Record<string, DamageValue | number>): DamageValue | null {
  const moveIdLower = moveId.toLowerCase().replace(/_/g, "");
  for (const [key, val] of Object.entries(blockValues)) {
    if (key.toLowerCase().replace(/_/g, "") === moveIdLower) return normalizeNumericValue(val);
  }
  for (const [key, val] of Object.entries(blockValues)) {
    const keyLower = key.toLowerCase();
    if (moveIdLower.includes(keyLower) || keyLower.includes(moveIdLower)) return normalizeNumericValue(val);
  }
  return null;
}
