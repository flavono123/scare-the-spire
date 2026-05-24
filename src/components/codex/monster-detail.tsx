"use client";

import { type CSSProperties, type PointerEvent, type ReactNode, useCallback, useMemo, useRef, useState } from "react";
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
  CodexAffliction,
  CodexEncounter,
  CodexCard,
  CodexMonster,
  CodexPower,
  DamageValue,
  MonsterMove,
  MonsterMoveCardApplication,
  MonsterMoveIntentDetail,
  MonsterMovePowerApplication,
  MonsterMoveTransitionKind,
  MonsterMoveTransition,
} from "@/lib/codex-types";
import {
  getDefaultMonsterSkinSelections,
  getMonsterSkinOptionLabel,
  getMonsterSkinPartLabel,
  getMonsterSkinParts,
  getSelectedMonsterSkinNames,
  getSingleMonsterSkin,
  type MonsterSkinSelections,
} from "@/lib/monster-skins";
import {
  MONSTER_TYPE_CONFIG,
} from "@/lib/codex-types";
import {
  getRelatedAfflictionIdsForMonster,
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

type MonsterIntentKind =
  | "attack"
  | "buff"
  | "cardDebuff"
  | "deathBlow"
  | "debuff"
  | "defend"
  | "escape"
  | "heal"
  | "hidden"
  | "sleep"
  | "statusCard"
  | "stun"
  | "summon"
  | "unknown";

interface MonsterIntentPreviewItem {
  key: string;
  kind: MonsterIntentKind;
  icon: string;
  label: string | null;
}

interface MoveAttackMetric {
  value: DamageValue;
  icon: string;
  normalLabel: string;
  ascensionLabel: string | null;
}

interface AttackRepeatInfo {
  value: DamageValue | null;
  isMulti: boolean;
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

interface PatternDiagramPan {
  x: number;
  y: number;
}

interface PatternDiagramDragState {
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  moved: boolean;
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

interface MonsterCombatStatState {
  strength: DamageValue;
  dexterity: DamageValue;
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
  const attackMetric = getMoveAttackMetric(summary);

  return (
    <span className="flex shrink-0 flex-wrap justify-end gap-2">
      {attackMetric && (
        <MetricTokenValue
          value={attackMetric.value}
          kind="attack"
          iconOverride={attackMetric.icon}
          normalLabel={attackMetric.normalLabel}
          ascensionLabel={attackMetric.ascensionLabel}
        />
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
  iconOverride,
  normalLabel,
  ascensionLabel,
  compact = false,
}: {
  value: DamageValue;
  kind: "attack" | "block" | "hp";
  ascensionLevel?: number;
  iconOverride?: string;
  normalLabel?: string;
  ascensionLabel?: string | null;
  compact?: boolean;
}) {
  const icon = iconOverride ?? METRIC_TOKEN_ICONS[kind];
  const level = ascensionLevel ?? (kind === "hp" ? 8 : 9);
  const normalText = normalLabel ?? String(value.normal ?? "?");
  const ascensionText = ascensionLabel ?? (value.ascension != null ? String(value.ascension) : null);
  const showAscension = ascensionText != null && ascensionText !== normalText;

  return (
    <span className={`inline-flex items-center font-game-text font-bold leading-none text-gray-100 ${compact ? "gap-0.5 text-xs" : "gap-1 text-sm"}`}>
      <Image
        src={icon}
        alt=""
        width={compact ? 18 : 22}
        height={compact ? 18 : 22}
        className={`${compact ? "h-4 w-4" : "h-5 w-5"} shrink-0 object-contain`}
      />
      <span>{normalText}</span>
      {showAscension && (
        <span className={`inline-flex items-center text-orange-300 ${compact ? "gap-0.5" : "gap-1"}`}>
          <span className="text-gray-500">(</span>
          <AscensionBadge level={level} />
          <span>{ascensionText}</span>
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

function MonsterIntentPreview({ summary }: { summary: MoveSummary | null }) {
  const intents = summary ? buildMonsterIntentPreviewItems(summary) : [];
  if (intents.length === 0) return null;

  return (
    <div
      className="pointer-events-none absolute left-1/2 top-2 z-40 flex -translate-x-1/2 items-end justify-center gap-1 sm:top-3"
      aria-hidden="true"
    >
      {intents.map((intent) => (
        <span
          key={intent.key}
          className="relative inline-flex h-14 w-14 items-center justify-center sm:h-16 sm:w-16"
        >
          <Image
            src={intent.icon}
            alt=""
            width={64}
            height={64}
            className="h-12 w-12 object-contain drop-shadow-[0_5px_6px_rgba(0,0,0,0.78)] sm:h-14 sm:w-14"
          />
          {intent.label && (
            <span
              className="font-game-title absolute -bottom-0.5 left-1/2 -translate-x-1/2 text-lg font-black leading-none text-[#fff8db] sm:text-xl"
              style={{ textShadow: "0 2px 0 #000, 0 0 4px #000, 1px 1px 0 #000" }}
            >
              {intent.label}
            </span>
          )}
        </span>
      ))}
    </div>
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
  onPreviewMoveIntent,
  moveSummaryById,
  powerById,
  cardById,
}: {
  monster: CodexMonster;
  phases: PatternPhase[];
  rows: TransitionTableRow[];
  serviceLocale: ServiceLocale;
  onSelectMove: (moveId: string) => void;
  onPreviewMoveIntent: (moveId: string | null) => void;
  moveSummaryById: Map<string, MoveSummary>;
  powerById: Map<string, CodexPower>;
  cardById: Map<string, CodexCard>;
}) {
  const diagram = useMemo(
    () => buildPatternDiagramModel(monster, rows, phases, serviceLocale),
    [monster, phases, rows, serviceLocale],
  );
  const markerPrefix = sanitizeSvgId(`monster-pattern-${monster.id}`);
  const diagramWidth = diagram?.width ?? 0;
  const diagramHeight = diagram?.height ?? 0;
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<PatternDiagramDragState | null>(null);
  const suppressClickUntilRef = useRef(0);
  const viewportHeight = Math.max(DIAGRAM_VIEWPORT_MIN_HEIGHT, diagramHeight + DIAGRAM_VIEWPORT_HEIGHT_EXTRA);
  const [pan, setPan] = useState<PatternDiagramPan>({ x: 0, y: DIAGRAM_VIEWPORT_TOP_GUTTER });
  const [isDragging, setIsDragging] = useState(false);

  const clampPan = useCallback((next: PatternDiagramPan): PatternDiagramPan => {
    const viewport = viewportRef.current;
    const viewportWidth = viewport?.clientWidth ?? diagramWidth;
    const viewportClientHeight = viewport?.clientHeight ?? viewportHeight;
    const minX = Math.min(DIAGRAM_DRAG_GUTTER, viewportWidth - diagramWidth - DIAGRAM_DRAG_GUTTER);
    const minY = Math.min(DIAGRAM_DRAG_GUTTER, viewportClientHeight - diagramHeight - DIAGRAM_DRAG_GUTTER);

    return {
      x: Math.min(DIAGRAM_DRAG_GUTTER, Math.max(minX, next.x)),
      y: Math.min(DIAGRAM_DRAG_GUTTER, Math.max(minY, next.y)),
    };
  }, [diagramHeight, diagramWidth, viewportHeight]);

  const handlePointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: pan.x,
      originY: pan.y,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsDragging(true);
  }, [pan.x, pan.y]);

  const handlePointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
      drag.moved = true;
    }
    setPan(clampPan({ x: drag.originX + deltaX, y: drag.originY + deltaY }));
  }, [clampPan]);

  const handlePointerEnd = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.moved) {
      suppressClickUntilRef.current = Date.now() + 160;
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
    setIsDragging(false);
  }, []);

  const shouldSuppressDiagramClick = useCallback(() => Date.now() < suppressClickUntilRef.current, []);
  if (!diagram) return null;

  return (
    <div
      ref={viewportRef}
      className={`relative max-w-full touch-none overflow-hidden rounded-md border border-white/10 bg-black/15 select-none ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
      style={{ height: viewportHeight }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
    >
      <div
        className="relative"
        style={{
          width: diagram.width,
          height: diagram.height,
          transform: `translate3d(${pan.x}px, ${pan.y}px, 0)`,
        }}
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
            onPreviewMoveIntent={onPreviewMoveIntent}
            moveSummary={moveSummaryById.get(node.id) ?? null}
            powerById={powerById}
            cardById={cardById}
            shouldSuppressDiagramClick={shouldSuppressDiagramClick}
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
  onPreviewMoveIntent,
  moveSummary,
  powerById,
  cardById,
  shouldSuppressDiagramClick,
}: {
  node: PatternDiagramNode;
  monster: CodexMonster;
  serviceLocale: ServiceLocale;
  onSelectMove: (moveId: string) => void;
  onPreviewMoveIntent: (moveId: string | null) => void;
  moveSummary: MoveSummary | null;
  powerById: Map<string, CodexPower>;
  cardById: Map<string, CodexCard>;
  shouldSuppressDiagramClick: () => boolean;
}) {
  const move = getMonsterMove(monster, node.id);
  const damageEntry = moveSummary?.damageEntry ?? (monster.damageValues ? findDamageForMove(node.id, monster.damageValues) : null);
  const blockEntry = moveSummary?.blockEntry ?? (monster.blockValues ? findBlockForMove(node.id, monster.blockValues) : null);
  const attackMetric = moveSummary ? getMoveAttackMetric(moveSummary) : damageEntry ? buildAttackMetric(damageEntry, null) : null;
  const title = move ? `${move.name}${move.nameEn !== move.name ? ` / ${move.nameEn}` : ""}` : getMoveName(monster, node.id);

  return (
    <div
      role="button"
      tabIndex={0}
      className="absolute z-10 cursor-pointer bg-transparent px-3 py-2 text-center shadow-[0_0_18px_rgba(0,0,0,0.25)] transition-transform hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300/70"
      style={{
        ...PATTERN_MOVE_PANEL_STYLE,
        left: node.x,
        top: node.y,
        width: node.width,
        height: node.height,
      }}
      title={title}
      aria-label={title}
      data-pattern-node="true"
      onMouseEnter={() => onPreviewMoveIntent(node.id)}
      onMouseLeave={() => onPreviewMoveIntent(null)}
      onFocus={() => onPreviewMoveIntent(node.id)}
      onBlur={() => onPreviewMoveIntent(null)}
      onClick={(event) => {
        if (shouldSuppressDiagramClick()) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        onSelectMove(node.id);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelectMove(node.id);
        }
      }}
    >
      <span className="relative z-10 flex h-full min-w-0 flex-col items-center justify-center gap-1">
        <span className="flex max-w-full flex-wrap items-center justify-center gap-x-1 gap-y-0.5">
          {attackMetric && (
            <MetricTokenValue
              value={attackMetric.value}
              kind="attack"
              iconOverride={attackMetric.icon}
              normalLabel={attackMetric.normalLabel}
              ascensionLabel={attackMetric.ascensionLabel}
              compact
            />
          )}
          {blockEntry && (
            <MetricTokenValue value={blockEntry} kind="block" compact />
          )}
        </span>
        {move && (move.powerApplications.length > 0 || move.cardApplications.length > 0) && (
          <span
            className="flex max-w-full flex-wrap items-center justify-center gap-0.5"
            onClick={(event) => {
              if (shouldSuppressDiagramClick()) event.preventDefault();
              event.stopPropagation();
            }}
            onKeyDown={(event) => event.stopPropagation()}
          >
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
    </div>
  );
}

interface MonsterDetailProps {
  serviceLocale: ServiceLocale;
  gameUi: CodexGameUiLabels;
  backToListTitle: string;
  monster: CodexMonster;
  encounters: CodexEncounter[];
  afflictions?: CodexAffliction[];
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
  afflictions = [],
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
  const moveSummaryById = useMemo(() => new Map(moveSummaries.map((summary) => [summary.move.id, summary])), [moveSummaries]);
  const transitionRows = useMemo(() => buildTransitionTableRows(monster), [monster]);
  const patternSummary = useMemo(() => buildPatternSummary(monster), [monster]);
  const loopLength = useMemo(() => getFixedLoopLength(monster), [monster]);
  const firstMoveId = monster.moveGraph?.initial ?? null;
  const [selectedMoveState, setSelectedMoveState] = useState<{ monsterId: string; moveId: string | null; nonce: number }>({
    monsterId: monster.id,
    moveId: null,
    nonce: 0,
  });
  const [intentPreviewState, setIntentPreviewState] = useState<{ monsterId: string; moveId: string | null }>({
    monsterId: monster.id,
    moveId: null,
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
  const previewMoveIntent = useCallback((moveId: string | null) => {
    setIntentPreviewState({ monsterId: monster.id, moveId });
  }, [monster.id]);
  const intentPreviewMoveId = intentPreviewState.monsterId === monster.id ? intentPreviewState.moveId : null;
  const intentPreviewSummary = moveSummaries.find((summary) => summary.move.id === intentPreviewMoveId) ?? null;
  const selectedSkinSelections = selectedSkinState.monsterId === monster.id
    ? selectedSkinState.selections
    : getDefaultMonsterSkinSelections(monster);
  const selectedSkinNames = useMemo(
    () => getSelectedMonsterSkinNames(monster, selectedSkinSelections),
    [monster, selectedSkinSelections],
  );
  const selectedSingleSkin = selectedSkinNames.length > 0 ? null : getSingleMonsterSkin(monster);
  const defaultSelectedMove = moveSummaries.find((summary) => summary.move.id === firstMoveId) ?? moveSummaries[0] ?? null;
  const selectedMove = moveSummaries.find((summary) => summary.move.id === selectedMoveId) ?? defaultSelectedMove;
  const selectedAccent = selectedMove ? getMoveToneColor(selectedMove.tone, typeConfig.color) : typeConfig.color;
  const imageSrc = monster.imageUrl ?? monster.bossImageUrl;
  const skinParts = getMonsterSkinParts(monster.spineAsset);
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
  const afflictionById = useMemo(() => new Map(afflictions.map((affliction) => [affliction.id, affliction])), [afflictions]);
  const relatedAfflictionTargets: CodexReferenceTarget[] = getRelatedAfflictionIdsForMonster(monster)
    .map((afflictionId) => afflictionById.get(afflictionId))
    .filter((affliction): affliction is CodexAffliction => Boolean(affliction))
    .map(afflictionToReferenceTarget);
  const cardById = useMemo(() => new Map(cards.map((card) => [card.id, card])), [cards]);
  const powerById = useMemo(() => new Map(powers.map((power) => [power.id, power])), [powers]);
  const patternRail = transitionRows.length > 0 ? (
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
        onPreviewMoveIntent={previewMoveIntent}
        moveSummaryById={moveSummaryById}
        powerById={powerById}
        cardById={cardById}
      />
      {monster.moveGraph?.confidence === "partial" && (
        <p className="mt-3 text-[11px] leading-relaxed text-gray-500">{monsterText.graphPartial}</p>
      )}
    </InfoRailSection>
  ) : null;

  return (
    <div className="mx-auto w-full max-w-6xl p-4 sm:p-6 xl:max-w-7xl">
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
        <div className="flex min-w-0 flex-col gap-4">
          <section className="flex min-h-[26rem] flex-col items-center justify-center gap-4 py-4">
          <div className="relative flex min-h-[22rem] w-full max-w-2xl items-center justify-center overflow-hidden">
            <div
              className="absolute bottom-10 left-[18%] right-[18%] h-8 rounded-[50%] blur-md"
              style={{ backgroundColor: hexToRgba(selectedAccent, 0.18) }}
            />
            {imageSrc ? (
              <MonsterSpineStage
                asset={monster.spineAsset}
                fallbackImageUrl={imageSrc}
                monsterName={monster.name}
                selectedMoveId={selectedMoveId}
                selectedMoveNonce={selectedMoveNonce}
                selectedSkin={selectedSingleSkin}
                selectedSkins={selectedSkinNames}
                className="relative z-10 h-[22rem] w-full sm:h-[30rem] lg:h-[34rem]"
                viewportPadding={MONSTER_DETAIL_VIEWPORT_PADDING}
                fallbackImageClassName="absolute inset-0 z-10 h-full w-full translate-y-[8%] scale-[0.78] object-contain drop-shadow-2xl"
              />
            ) : (
              <div
                className="relative z-10 flex h-52 w-52 items-center justify-center rounded-full border text-5xl font-bold"
                style={{ borderColor: `${typeConfig.color}66`, color: typeConfig.color }}
              >
                {monster.name.slice(0, 1)}
              </div>
            )}
            <MonsterIntentPreview summary={intentPreviewSummary} />
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

          {patternRail}
        </div>

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
                      onMouseEnter={() => previewMoveIntent(summary.move.id)}
                      onMouseLeave={() => previewMoveIntent(null)}
                      onFocus={() => previewMoveIntent(summary.move.id)}
                      onBlur={() => previewMoveIntent(null)}
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

          <EntityReferenceGroupLinks
            gameUi={gameUi}
            serviceLocale={serviceLocale}
            groups={[
              { kind: "affliction", targets: relatedAfflictionTargets },
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
const DIAGRAM_H_GAP = 32;
const DIAGRAM_V_GAP = 24;
const DIAGRAM_PAD = 58;
const DIAGRAM_ROW_GAP = 76;
const DIAGRAM_VIEWPORT_MIN_HEIGHT = 270;
const DIAGRAM_VIEWPORT_HEIGHT_EXTRA = 42;
const DIAGRAM_VIEWPORT_TOP_GUTTER = 18;
const DIAGRAM_DRAG_GUTTER = 96;
const DIAGRAM_ARROW_COLOR = "#efc851";
const DIAGRAM_CONDITIONAL_COLOR = "#ff4545";
const BESTIARY_START_COLOR = "#60a5fa";
const DIAGRAM_ARROW_ICON = "/images/sts2/ui/settings_tiny_right_arrow.png";
const MONSTER_DETAIL_VIEWPORT_PADDING = {
  padLeft: "8%",
  padRight: "8%",
  padTop: "24%",
  padBottom: "4%",
};
const ZERO_DAMAGE_VALUE: DamageValue = { normal: 0, ascension: null };
const EMPTY_MONSTER_COMBAT_STAT_STATE: MonsterCombatStatState = {
  strength: ZERO_DAMAGE_VALUE,
  dexterity: ZERO_DAMAGE_VALUE,
};
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
  attack: "/images/sts2/intents/attack_3.png",
  block: "/images/sts2/ui/combat/block.png",
  hp: "/images/sts2/ui/topbar/top_bar_heart.png",
};
const MONSTER_INTENT_ICONS: Record<MonsterIntentKind, string> = {
  attack: "/images/sts2/intents/attack_3.png",
  buff: "/images/sts2/intents/buff.png",
  cardDebuff: "/images/sts2/intents/card_debuff.png",
  deathBlow: "/images/sts2/intents/death_blow.png",
  debuff: "/images/sts2/intents/debuff.png",
  defend: "/images/sts2/intents/defend.png",
  escape: "/images/sts2/intents/escape.png",
  heal: "/images/sts2/intents/heal.png",
  hidden: "/images/sts2/intents/hidden.png",
  sleep: "/images/sts2/intents/sleep.png",
  statusCard: "/images/sts2/intents/status_card.png",
  stun: "/images/sts2/intents/stun.png",
  summon: "/images/sts2/intents/summon.png",
  unknown: "/images/sts2/intents/unknown.png",
};
const MONSTER_INTENT_CLASS_TO_KIND: Record<string, MonsterIntentKind> = {
  AttackIntent: "attack",
  SingleAttackIntent: "attack",
  MultiAttackIntent: "attack",
  BuffIntent: "buff",
  CardDebuffIntent: "cardDebuff",
  DeathBlowIntent: "deathBlow",
  DebuffIntent: "debuff",
  DebuffStrongIntent: "debuff",
  DefendIntent: "defend",
  EscapeIntent: "escape",
  HealIntent: "heal",
  HiddenIntent: "hidden",
  SleepIntent: "sleep",
  StatusIntent: "statusCard",
  StunIntent: "stun",
  SummonIntent: "summon",
  UnknownIntent: "unknown",
};
const SINGLE_ATTACK_REPEAT: DamageValue = { normal: 1, ascension: null };

function buildMonsterIntentPreviewItems(summary: MoveSummary): MonsterIntentPreviewItem[] {
  return getMoveIntentDetails(summary.move).flatMap((intent, index) => {
    const kind = getMonsterIntentKind(intent.type);
    if (kind === "hidden") return [];

    return [{
      key: `${intent.type}-${index}`,
      kind,
      icon: getMonsterIntentIcon(kind, summary, intent),
      label: getMonsterIntentPreviewLabel(intent, kind, summary),
    }];
  });
}

function getMoveIntentDetails(move: MonsterMove): MonsterMoveIntentDetail[] {
  if (move.intentDetails.length > 0) return move.intentDetails;
  return move.intents.map((type) => ({ type }));
}

function getMonsterIntentKind(intent: string): MonsterIntentKind {
  const kind = MONSTER_INTENT_CLASS_TO_KIND[intent];
  if (kind) return kind;
  if (intent.includes("Attack")) return "attack";
  if (intent.includes("Buff")) return "buff";
  if (intent.includes("Debuff")) return "debuff";
  if (intent.includes("Defend")) return "defend";
  if (intent.includes("Status")) return "statusCard";
  return "unknown";
}

function getMonsterIntentIcon(kind: MonsterIntentKind, summary: MoveSummary, intent: MonsterMoveIntentDetail): string {
  if (kind === "attack") {
    return getAttackIntentIcon(summary.damageEntry, getIntentRepeatInfo(intent));
  }
  return MONSTER_INTENT_ICONS[kind];
}

function getMonsterIntentPreviewLabel(intent: MonsterMoveIntentDetail, kind: MonsterIntentKind, summary: MoveSummary): string | null {
  if (kind === "attack" || kind === "deathBlow") {
    return formatAttackMetricLabel(summary.damageEntry, getIntentRepeatInfo(intent), "normal");
  }

  if (kind === "statusCard") {
    const amount = summary.move.cardApplications[0]?.amount?.normal;
    return amount == null ? null : String(amount);
  }

  return null;
}

function getMoveAttackMetric(summary: MoveSummary): MoveAttackMetric | null {
  if (!summary.damageEntry) return null;
  return buildAttackMetric(summary.damageEntry, getPrimaryAttackIntent(summary.move));
}

function buildAttackMetric(value: DamageValue, intent: MonsterMoveIntentDetail | null): MoveAttackMetric {
  const repeat = getIntentRepeatInfo(intent);
  return {
    value,
    icon: getAttackIntentIcon(value, repeat),
    normalLabel: formatAttackMetricLabel(value, repeat, "normal") ?? String(value.normal ?? "?"),
    ascensionLabel: formatAttackMetricLabel(value, repeat, "ascension"),
  };
}

function getPrimaryAttackIntent(move: MonsterMove): MonsterMoveIntentDetail | null {
  return getMoveIntentDetails(move).find((intent) => {
    const kind = getMonsterIntentKind(intent.type);
    return kind === "attack" || kind === "deathBlow";
  }) ?? null;
}

function getIntentRepeatInfo(intent: MonsterMoveIntentDetail | null): AttackRepeatInfo {
  if (!intent) return { value: null, isMulti: false };
  if (intent.repeat) return { value: intent.repeat, isMulti: intent.type === "MultiAttackIntent" };
  if (intent.type === "MultiAttackIntent") return { value: null, isMulti: true };
  const kind = getMonsterIntentKind(intent.type);
  return kind === "attack" || kind === "deathBlow"
    ? { value: SINGLE_ATTACK_REPEAT, isMulti: false }
    : { value: null, isMulti: false };
}

function formatAttackMetricLabel(
  damage: DamageValue | null,
  repeat: AttackRepeatInfo,
  mode: "normal" | "ascension",
): string | null {
  const damageValue = getDamageModeValue(damage, mode);
  if (damageValue == null) return null;
  const repeatValue = getDamageModeValue(repeat.value, mode);
  if (repeat.isMulti) return `${damageValue}x${repeatValue ?? "?"}`;
  return String(damageValue);
}

function getAttackIntentIcon(damage: DamageValue | null, repeat: AttackRepeatInfo): string {
  const totalDamage = getAttackTotalDamage(damage, repeat, "normal")
    ?? getAttackTotalDamage(damage, repeat, "ascension")
    ?? 10;
  return `/images/sts2/intents/attack_${getAttackIntentTier(totalDamage)}.png`;
}

function getAttackTotalDamage(
  damage: DamageValue | null,
  repeat: AttackRepeatInfo,
  mode: "normal" | "ascension",
): number | null {
  const damageValue = getDamageModeValue(damage, mode);
  if (damageValue == null) return null;
  const repeatValue = getDamageModeValue(repeat.value, mode) ?? 1;
  return damageValue * repeatValue;
}

function getDamageModeValue(value: DamageValue | null, mode: "normal" | "ascension"): number | null {
  if (!value) return null;
  return mode === "ascension" ? (value.ascension ?? value.normal) : value.normal;
}

function getAttackIntentTier(totalDamage: number): 1 | 2 | 3 | 4 | 5 {
  if (totalDamage < 5) return 1;
  if (totalDamage < 10) return 2;
  if (totalDamage < 20) return 3;
  if (totalDamage < 40) return 4;
  return 5;
}

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

function afflictionToReferenceTarget(affliction: CodexAffliction): CodexReferenceTarget {
  const href = `/compendium/enchantments/${affliction.id.toLowerCase()}`;
  return {
    href,
    id: affliction.id,
    title: affliction.name,
    entity: {
      id: affliction.id,
      nameEn: affliction.nameEn,
      nameKo: affliction.name,
      imageUrl: affliction.imageUrl,
      href,
      color: "affliction",
      type: "affliction",
      afflictionData: affliction,
    },
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
    const loopY = from.y - 16 - laneOffset * 0.45;
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
    const loopY = Math.min(from.y, to.y) - 22 - laneOffset * 0.45;
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
  const combatStatStateByMoveId = buildMoveCombatStatStateById(monster);

  return moves.map((move) => {
    const baseDamageEntry = monster.damageValues
      ? findDamageForMove(move.id, monster.damageValues)
      : null;
    const baseBlockEntry = monster.blockValues
      ? findBlockForMove(move.id, monster.blockValues)
      : null;
    const combatStats = combatStatStateByMoveId.get(move.id) ?? EMPTY_MONSTER_COMBAT_STAT_STATE;
    const damageEntry = addDamageValueBonus(baseDamageEntry, combatStats.strength);
    const blockEntry = addDamageValueBonus(baseBlockEntry, combatStats.dexterity);
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

function buildMoveCombatStatStateById(monster: CodexMonster): Map<string, MonsterCombatStatState> {
  const initialMoveId = monster.moveGraph?.initial;
  if (!initialMoveId) return new Map();

  const fixedNextByMoveId = new Map<string, string>();
  for (const transition of monster.moveGraph?.transitions ?? []) {
    if (transition.from === "__START__" || transition.to === "__START__") continue;
    const isDeterministic = transition.condition == null && (transition.kind === "fixed" || transition.chance === 100);
    if (!isDeterministic) continue;
    if (fixedNextByMoveId.has(transition.from)) {
      fixedNextByMoveId.delete(transition.from);
      continue;
    }
    fixedNextByMoveId.set(transition.from, transition.to);
  }

  const stateByMoveId = new Map<string, MonsterCombatStatState>();
  let currentMoveId: string | null = initialMoveId;
  let combatStats = cloneMonsterCombatStatState(EMPTY_MONSTER_COMBAT_STAT_STATE);
  const maxSteps = Math.max(8, (monster.moves.length + monster.bestiaryMoves.length + fixedNextByMoveId.size) * 2);

  for (let step = 0; currentMoveId && step < maxSteps; step += 1) {
    if (!stateByMoveId.has(currentMoveId)) {
      stateByMoveId.set(currentMoveId, cloneMonsterCombatStatState(combatStats));
    }

    const move = getMonsterMove(monster, currentMoveId);
    if (move) {
      combatStats = applyMoveCombatStatChanges(combatStats, move);
    }

    const nextMoveId: string | null = fixedNextByMoveId.get(currentMoveId) ?? null;
    if (!nextMoveId || stateByMoveId.has(nextMoveId)) break;
    currentMoveId = nextMoveId;
  }

  return stateByMoveId;
}

function applyMoveCombatStatChanges(state: MonsterCombatStatState, move: MonsterMove): MonsterCombatStatState {
  let next = state;

  for (const application of move.powerApplications) {
    if (application.target !== "self") continue;
    if (application.powerId === "STRENGTH") {
      next = {
        ...next,
        strength: addDamageValues(next.strength, normalizeNullableDamageValue(application.amount)),
      };
    }
    if (application.powerId === "DEXTERITY") {
      next = {
        ...next,
        dexterity: addDamageValues(next.dexterity, normalizeNullableDamageValue(application.amount)),
      };
    }
  }

  return next;
}

function addDamageValueBonus(value: DamageValue | null, bonus: DamageValue): DamageValue | null {
  if (!value || isZeroDamageValue(bonus)) return value;
  return addDamageValues(value, bonus);
}

function addDamageValues(base: DamageValue, bonus: DamageValue): DamageValue {
  const normal = base.normal == null ? null : base.normal + (bonus.normal ?? 0);
  const shouldShowAscension = base.ascension != null || bonus.ascension != null;
  const ascensionBase = base.ascension ?? base.normal;
  const ascensionBonus = bonus.ascension ?? bonus.normal ?? 0;
  const ascension = shouldShowAscension && ascensionBase != null ? ascensionBase + ascensionBonus : null;

  return { normal, ascension };
}

function normalizeNullableDamageValue(value: DamageValue | null): DamageValue {
  return value ? normalizeNumericValue(value) : ZERO_DAMAGE_VALUE;
}

function cloneMonsterCombatStatState(state: MonsterCombatStatState): MonsterCombatStatState {
  return {
    strength: { ...state.strength },
    dexterity: { ...state.dexterity },
  };
}

function isZeroDamageValue(value: DamageValue): boolean {
  return (value.normal ?? 0) === 0 && (value.ascension ?? 0) === 0;
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
