"use client";

import { type CSSProperties, type PointerEvent, type ReactNode, useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "@/components/ui/static-image";
import { CommentSection } from "@/components/comment-section";
import { buildCodexCommentThreadKey } from "@/lib/comment-threads";
import type { ServiceLocale } from "@/lib/i18n";
import { localizeHref } from "@/lib/i18n";
import type { CodexGameUiLabels } from "@/lib/codex-game-ui";
import type { EntityVersionDiff, STS2Change, STS2Patch } from "@/lib/types";
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
  MonsterMoveGraphRandomBranch,
  MonsterMoveGraphState,
  MonsterMoveIntentDetail,
  MonsterMovePowerApplication,
  MonsterMovePowerTarget,
  MonsterMoveTransitionKind,
  MonsterMoveTransition,
} from "@/lib/codex-types";
import {
  getDefaultMonsterSkinSelections,
  getMonsterPhobiaModeLabel,
  getMonsterSkinOptionLabel,
  getMonsterSkinPartLabel,
  getMonsterSkinParts,
  getSelectedMonsterSkinNames,
  getSingleMonsterSkin,
  hasMonsterPhobiaMode,
  type MonsterSkinSelections,
} from "@/lib/monster-skins";
import {
  MONSTER_TYPE_CONFIG,
} from "@/lib/codex-types";
import {
  getRelatedAfflictionIdsForMonster,
  getRelatedCardIdsForMonster,
  getRelatedEncounterIdsForMonster,
  getRelatedPowerIdsForMonster,
} from "@/lib/codex-references";
import { EntityReferenceGroupLinks, type CodexReferenceTarget } from "./entity-reference-links";
import { EntityPreview, type EntityInfo } from "@/components/patch-note-renderer";
import { TinyCardIcon } from "@/components/history-course/card-action-icon";
import { TEXT_CREAM, TEXT_GREEN } from "@/lib/sts2-card-style";
import { GameCheckboxToggle } from "./game-checkbox";
import {
  DECIMILLIPEDE_PART_OPTIONS,
  DecimillipedeSpineStage,
  type DecimillipedePartId,
} from "./decimillipede-spine-stage";
import {
  getEffectiveDamageValue,
  getMonsterHpDisplay,
  MONSTER_HP_ASCENSION_LEVEL,
  MONSTER_MOVE_ASCENSION_LEVEL,
  MonsterAscensionStepper,
  MonsterHealthBar,
  useMonsterAscensionLevel,
} from "./monster-ascension";
import { MonsterSpineStage, type MonsterStageVisualBounds } from "./monster-spine-stage";
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
  label: string;
}

interface AttackRepeatInfo {
  value: DamageValue | null;
  isMulti: boolean;
}

type PatternKind = "linear" | "fixed" | "random" | "conditional" | "mixed" | "unknown";

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
  annotation?: string | null;
}

interface PatternDiagramEntryNode {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  kind: "start" | "end";
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
  label?: string | null;
  kind?: "random" | "conditional";
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
  entryNodes: PatternDiagramEntryNode[];
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
  ascensionLevel,
}: {
  summary: MoveSummary;
  ascensionLevel: number;
}) {
  const attackMetric = getMoveAttackMetric(summary, ascensionLevel);

  return (
    <span className="flex shrink-0 flex-wrap justify-end gap-2">
      {attackMetric && (
        <MetricTokenValue
          value={attackMetric.value}
          kind="attack"
          iconOverride={attackMetric.icon}
          label={attackMetric.label}
          ascensionLevel={ascensionLevel}
        />
      )}
      {summary.blockEntry != null && (
        <MetricTokenValue value={summary.blockEntry} kind="block" ascensionLevel={ascensionLevel} />
      )}
      <MoveStandaloneIntentTokens summary={summary} ascensionLevel={ascensionLevel} />
    </span>
  );
}

function MoveStandaloneIntentTokens({
  summary,
  ascensionLevel,
  compact = false,
}: {
  summary: MoveSummary;
  ascensionLevel: number;
  compact?: boolean;
}) {
  const intents = getStandaloneMoveIntentItems(summary, ascensionLevel);
  if (intents.length === 0) return null;

  return (
    <span className={`inline-flex items-center justify-center ${compact ? "gap-0.5" : "gap-1"}`}>
      {intents.map((intent) => (
        <span
          key={intent.key}
          className={`relative inline-flex items-center justify-center ${compact ? "h-5 w-5" : "h-6 w-6"}`}
          title={intent.label ?? intent.kind}
        >
          <Image
            src={intent.icon}
            alt=""
            width={compact ? 20 : 24}
            height={compact ? 20 : 24}
            className="h-full w-full object-contain"
          />
          {intent.label && (
            <span
              className="font-game-title absolute -bottom-0.5 left-1/2 -translate-x-1/2 text-[9px] font-black leading-none text-[#fff8db]"
              style={{ textShadow: "0 1px 0 #000, 0 0 3px #000" }}
            >
              {intent.label}
            </span>
          )}
        </span>
      ))}
    </span>
  );
}

function MetricTokenValue({
  value,
  kind,
  ascensionLevel,
  iconOverride,
  label,
  compact = false,
}: {
  value: DamageValue;
  kind: "attack" | "block" | "hp";
  ascensionLevel?: number;
  iconOverride?: string;
  label?: string | null;
  compact?: boolean;
}) {
  const icon = iconOverride ?? METRIC_TOKEN_ICONS[kind];
  const level = ascensionLevel ?? 0;
  const threshold = kind === "hp" ? MONSTER_HP_ASCENSION_LEVEL : MONSTER_MOVE_ASCENSION_LEVEL;
  const resolvedLabel = label ?? String(getEffectiveDamageValue(value, level, threshold) ?? "?");

  return (
    <span className={`inline-flex items-center font-game-text font-bold leading-none text-gray-100 ${compact ? "gap-0.5 text-xs" : "gap-1 text-sm"}`}>
      <Image
        src={icon}
        alt=""
        width={compact ? 18 : 22}
        height={compact ? 18 : 22}
        className={`${compact ? "h-4 w-4" : "h-5 w-5"} shrink-0 object-contain`}
      />
      <span>{resolvedLabel}</span>
    </span>
  );
}

function HpTokenValue({ monster, ascensionLevel }: { monster: CodexMonster; ascensionLevel: number }) {
  const hp = getMonsterHpDisplay(monster, ascensionLevel);
  if (!hp) return null;

  return (
    <span className="inline-flex items-center gap-1 font-game-text text-sm font-bold leading-none text-gray-100">
      <Image src={METRIC_TOKEN_ICONS.hp} alt="" width={22} height={22} className="h-5 w-5 shrink-0 object-contain" />
      <span>{hp.value}</span>
    </span>
  );
}

function MonsterIntentPreview({
  summary,
  ascensionLevel,
}: {
  summary: MoveSummary | null;
  ascensionLevel: number;
}) {
  const intents = summary ? buildMonsterIntentPreviewItems(summary, ascensionLevel) : [];
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

function MonsterDetailHealthBar({
  monster,
  ascensionLevel,
  visualBounds,
  reserveStartEffects,
}: {
  monster: CodexMonster;
  ascensionLevel: number;
  visualBounds: MonsterStageVisualBounds | null;
  reserveStartEffects: boolean;
}) {
  return (
    <div className="pointer-events-none absolute z-40 flex justify-center" style={getHealthBarPreviewStyle(visualBounds, reserveStartEffects)}>
      <MonsterHealthBar monster={monster} ascensionLevel={ascensionLevel} compact={false} />
    </div>
  );
}

function MonsterInitialPowerPreview({
  applications,
  serviceLocale,
  powerById,
  visualBounds,
  ascensionLevel,
  ownerName,
}: {
  applications: readonly MonsterMovePowerApplication[];
  serviceLocale: ServiceLocale;
  powerById: Map<string, CodexPower>;
  visualBounds: MonsterStageVisualBounds | null;
  ascensionLevel: number;
  ownerName: string;
}) {
  if (applications.length === 0) return null;

  return (
    <div
      className="absolute z-40 flex max-w-[calc(100%-1rem)] flex-wrap items-end justify-center gap-1.5"
      style={getInitialPowerPreviewStyle(visualBounds)}
      aria-label={serviceLocale === "ko" ? "시작 효과" : "Starting effects"}
      data-monster-starting-effects
    >
      {applications.map((application) => {
        const power = powerById.get(application.powerId);
        const label = serviceLocale === "ko" ? application.powerName : application.powerNameEn;
        const counterAmount = getPowerApplicationCounterAmount(application, power);
        const displayedAmount = getEffectiveDamageValue(counterAmount, ascensionLevel, MONSTER_MOVE_ASCENSION_LEVEL);

        return (
          <EntityPreview
            key={`initial-stage-${application.powerId}-${application.target}-${formatNumericValue(application.amount ?? { normal: null, ascension: null })}`}
            entity={buildPowerEntity(application, power, ascensionLevel, ownerName)}
            serviceLocale={serviceLocale}
            forcePosition="above"
            linkClassName="relative inline-flex h-9 w-9 items-center justify-center rounded-sm outline-none transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-yellow-300/70 sm:h-10 sm:w-10"
          >
            <span className="relative inline-flex h-9 w-9 items-center justify-center sm:h-10 sm:w-10" title={label}>
              {application.imageUrl && (
                <Image
                  src={application.imageUrl}
                  alt=""
                  width={40}
                  height={40}
                  className="h-9 w-9 object-contain drop-shadow-[0_5px_6px_rgba(0,0,0,0.78)] sm:h-10 sm:w-10"
                />
              )}
              {displayedAmount != null && (
                <span
                  className="pointer-events-none absolute -bottom-1 -right-1 font-game-title text-sm font-black leading-none text-[#fff8db]"
                  style={{ textShadow: "0 2px 0 #000, 0 0 4px #000, 1px 1px 0 #000" }}
                >
                  {displayedAmount}
                </span>
              )}
            </span>
          </EntityPreview>
        );
      })}
    </div>
  );
}

function getInitialPowerPreviewStyle(bounds: MonsterStageVisualBounds | null): CSSProperties {
  if (!bounds) {
    return {
      left: "50%",
      bottom: 8,
      transform: "translateX(-50%)",
    };
  }

  const safeInset = bounds.stageWidth < 480 ? 8 : 16;
  const tokenSize = bounds.stageWidth < 480 ? 36 : 40;
  const centerX = bounds.left + bounds.width / 2;
  const left = clampNumber(centerX, safeInset + tokenSize / 2, Math.max(safeInset + tokenSize / 2, bounds.stageWidth - safeInset - tokenSize / 2));

  return {
    left,
    bottom: safeInset,
    transform: "translateX(-50%)",
    maxWidth: Math.max(tokenSize, bounds.stageWidth - safeInset * 2),
  };
}

function getHealthBarPreviewStyle(bounds: MonsterStageVisualBounds | null, reserveStartEffects: boolean): CSSProperties {
  if (!bounds) {
    return {
      left: "50%",
      bottom: reserveStartEffects ? 58 : 24,
      transform: "translateX(-50%)",
    };
  }

  const safeInset = bounds.stageWidth < 480 ? 8 : 16;
  const gameWidth = bounds.width + 24;
  const barWidth = clampNumber(
    gameWidth,
    bounds.stageWidth < 480 ? 136 : 184,
    Math.max(bounds.stageWidth < 480 ? 136 : 184, bounds.stageWidth - safeInset * 2),
  );
  const gap = bounds.stageWidth < 480 ? 4 : 6;
  const reservedBottom = reserveStartEffects ? (bounds.stageWidth < 480 ? 44 : 50) : 0;
  const left = clampNumber(
    bounds.left + bounds.width / 2 - barWidth / 2,
    safeInset,
    Math.max(safeInset, bounds.stageWidth - barWidth - safeInset),
  );
  const top = clampNumber(bounds.bottom + gap, safeInset, Math.max(safeInset, bounds.stageHeight - 28 - safeInset - reservedBottom));

  return {
    left,
    top,
    width: barWidth,
  };
}

function areStageVisualBoundsEqual(
  a: MonsterStageVisualBounds | null,
  b: MonsterStageVisualBounds | null,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return Math.abs(a.left - b.left) < 0.5
    && Math.abs(a.top - b.top) < 0.5
    && Math.abs(a.right - b.right) < 0.5
    && Math.abs(a.bottom - b.bottom) < 0.5
    && Math.abs(a.stageWidth - b.stageWidth) < 0.5
    && Math.abs(a.stageHeight - b.stageHeight) < 0.5;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function MoveApplicationTokens({
  powers,
  cards,
  serviceLocale,
  powerById,
  cardById,
  ownerName,
}: {
  powers: readonly MonsterMovePowerApplication[];
  cards: readonly MonsterMoveCardApplication[];
  serviceLocale: ServiceLocale;
  powerById: Map<string, CodexPower>;
  cardById: Map<string, CodexCard>;
  ownerName: string;
}) {
  const [monsterAscensionLevel] = useMonsterAscensionLevel();

  if (powers.length === 0 && cards.length === 0) return null;

  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {powers.map((application) => (
        <MoveApplicationToken
          key={`power-${application.powerId}-${application.target}-${formatNumericValue(application.amount ?? { normal: null, ascension: null })}`}
          entity={buildPowerEntity(application, powerById.get(application.powerId), monsterAscensionLevel, ownerName)}
          imageUrl={application.imageUrl}
          label={serviceLocale === "ko" ? application.powerName : application.powerNameEn}
          amount={getPowerApplicationCounterAmount(application, powerById.get(application.powerId))}
          serviceLocale={serviceLocale}
        />
      ))}
      {cards.map((application) => (
        <MoveCardApplicationToken
          key={`card-${application.cardId}-${formatNumericValue(application.amount ?? { normal: null, ascension: null })}`}
          entity={buildCardEntity(application, cardById.get(application.cardId))}
          label={serviceLocale === "ko" ? application.cardName : application.cardNameEn}
          card={application}
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
  const [monsterAscensionLevel] = useMonsterAscensionLevel();
  const displayedAmount = getEffectiveDamageValue(amount, monsterAscensionLevel, MONSTER_MOVE_ASCENSION_LEVEL);

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
      {displayedAmount != null && (
        <span
          className="pointer-events-none absolute -bottom-1 -right-1 font-game-title text-[11px] font-black leading-none text-[#fff8db]"
          style={{ textShadow: "0 2px 0 #000, 0 0 4px #000, 1px 1px 0 #000" }}
        >
          {displayedAmount}
        </span>
      )}
    </EntityPreview>
  );
}

function MoveCardApplicationToken({
  entity,
  label,
  card,
  amount,
  serviceLocale,
}: {
  entity: EntityInfo;
  label: string;
  card: MonsterMoveCardApplication;
  amount: DamageValue | null;
  serviceLocale: ServiceLocale;
}) {
  const [monsterAscensionLevel] = useMonsterAscensionLevel();
  const upgraded = isUpgradeCardApplication(card);
  const displayedAmount = isUpgradeCardApplication(card)
    ? null
    : getEffectiveDamageValue(amount, monsterAscensionLevel, MONSTER_MOVE_ASCENSION_LEVEL);
  const displayLabel = upgraded ? `${label}+` : label;

  return (
    <EntityPreview
      entity={entity}
      serviceLocale={serviceLocale}
      linkClassName="inline-flex min-h-7 items-center gap-1 rounded-sm outline-none transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-yellow-300/70"
    >
      <span className="inline-flex min-h-7 items-center gap-1 whitespace-nowrap" title={displayLabel}>
        <TinyCardIcon
          card={{ color: card.cardColor, rarity: card.cardRarity, type: card.cardType }}
          width={24}
        />
        <span
          className="font-game-title text-sm font-black leading-none"
          style={{
            color: upgraded ? TEXT_GREEN : TEXT_CREAM,
            textShadow: "0 2px 0 #000, 0 0 4px #000, 1px 1px 0 #000",
          }}
        >
          {displayLabel}
        </span>
      </span>
      {displayedAmount != null && displayedAmount > 1 && (
        <span
          className="pointer-events-none font-game-title text-[11px] font-black leading-none text-[#fff8db]"
          style={{ textShadow: "0 2px 0 #000, 0 0 4px #000, 1px 1px 0 #000" }}
        >
          x{displayedAmount}
        </span>
      )}
    </EntityPreview>
  );
}

function isUpgradeCardApplication(card: MonsterMoveCardApplication): boolean {
  return card.applicationKind === "upgrade";
}

function InitialPowerApplicationsRail({
  applications,
  serviceLocale,
  powerById,
  ownerName,
}: {
  applications: readonly MonsterMovePowerApplication[];
  serviceLocale: ServiceLocale;
  powerById: Map<string, CodexPower>;
  ownerName: string;
}) {
  const [monsterAscensionLevel] = useMonsterAscensionLevel();

  return (
    <div className="space-y-1.5">
      {applications.map((application) => {
        const power = powerById.get(application.powerId);
        const label = serviceLocale === "ko" ? application.powerName : application.powerNameEn;
        const targetLabel = getPowerTargetLabel(application.target, serviceLocale);
        const counterAmount = getPowerApplicationCounterAmount(application, power);
        const displayedAmount = getEffectiveDamageValue(counterAmount, monsterAscensionLevel, MONSTER_MOVE_ASCENSION_LEVEL);

        return (
          <EntityPreview
            key={`initial-${application.powerId}-${application.target}-${formatNumericValue(application.amount ?? { normal: null, ascension: null })}`}
            entity={buildPowerEntity(application, power, monsterAscensionLevel, ownerName)}
            serviceLocale={serviceLocale}
            linkClassName="block rounded-md border border-white/[0.07] bg-white/[0.025] px-2.5 py-2 transition-colors hover:bg-white/[0.06] focus-visible:ring-2 focus-visible:ring-yellow-300/70"
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-black/30">
                {application.imageUrl && (
                  <Image src={application.imageUrl} alt="" width={32} height={32} className="h-8 w-8 object-contain" />
                )}
                {displayedAmount != null && (
                  <span
                    className="pointer-events-none absolute -bottom-1 -right-1 font-game-title text-xs font-black leading-none text-[#fff8db]"
                    style={{ textShadow: "0 2px 0 #000, 0 0 4px #000, 1px 1px 0 #000" }}
                  >
                    {displayedAmount}
                  </span>
                )}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-semibold text-gray-100">{label}</span>
                {power && power.nameEn !== power.name && (
                  <span className="font-game-text truncate text-[11px] text-gray-500">{power.nameEn}</span>
                )}
              </span>
              {targetLabel && (
                <span className="shrink-0 rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-medium text-gray-400">
                  {targetLabel}
                </span>
              )}
            </span>
          </EntityPreview>
        );
      })}
    </div>
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
              border: `1px solid ${box.kind === "conditional" ? "rgba(255, 69, 69, 0.42)" : "rgba(239, 200, 81, 0.34)"}`,
              backgroundColor: "rgba(7, 9, 20, 0.22)",
            }}
          >
            {box.label && (
              <span
                className="absolute left-3 top-2 max-w-[calc(100%-1.5rem)] truncate font-game-title text-[11px] font-bold"
                style={{ color: box.kind === "conditional" ? DIAGRAM_CONDITIONAL_COLOR : DIAGRAM_ARROW_COLOR }}
                title={box.label}
              >
                {box.label}
              </span>
            )}
          </div>
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
            <filter
              id={`${markerPrefix}-arrow-conditional-tint`}
              colorInterpolationFilters="sRGB"
            >
              <feColorMatrix
                type="matrix"
                values="0 0 0 0 1 0 0 0 0 0.2706 0 0 0 0 0.2706 0 0 0 1 0"
              />
            </filter>
            <marker
              id={`${markerPrefix}-arrow-normal`}
              markerWidth="10"
              markerHeight="10"
              refX="9"
              refY="5"
              orient="auto"
              markerUnits="userSpaceOnUse"
            >
              <image
                href={DIAGRAM_ARROW_ICON}
                x="0"
                y="0"
                width="10"
                height="10"
                preserveAspectRatio="xMidYMid meet"
              />
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
              <image
                href={DIAGRAM_ARROW_ICON}
                x="0"
                y="0"
                width="10"
                height="10"
                preserveAspectRatio="xMidYMid meet"
                filter={`url(#${markerPrefix}-arrow-conditional-tint)`}
              />
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

        {diagram.entryNodes.map((entry) => (
          <div
            key={entry.id}
            className="pointer-events-none absolute z-10 flex items-center justify-center rounded-full border font-game-title text-[10px] font-black tracking-[0.08em]"
            style={{
              left: entry.x,
              top: entry.y,
              width: entry.width,
              height: entry.height,
              borderColor: entry.kind === "start" ? "rgba(96, 165, 250, 0.72)" : "rgba(161, 161, 170, 0.58)",
              backgroundColor: entry.kind === "start" ? "rgba(30, 64, 175, 0.22)" : "rgba(39, 39, 42, 0.42)",
              color: entry.kind === "start" ? BESTIARY_START_COLOR : "#a1a1aa",
            }}
            data-pattern-entry={entry.kind}
          >
            {entry.label}
          </div>
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
  const [monsterAscensionLevel] = useMonsterAscensionLevel();
  const move = getMonsterMove(monster, node.id);
  const damageEntry = moveSummary?.damageEntry ?? (monster.damageValues ? findDamageForMove(node.id, monster.damageValues) : null);
  const blockEntry = moveSummary?.blockEntry ?? (monster.blockValues ? findBlockForMove(node.id, monster.blockValues) : null);
  const attackMetric = moveSummary ? getMoveAttackMetric(moveSummary, monsterAscensionLevel) : damageEntry ? buildAttackMetric(damageEntry, null, monsterAscensionLevel) : null;
  const standaloneIntents = moveSummary ? getStandaloneMoveIntentItems(moveSummary, monsterAscensionLevel) : [];
  const hasApplications = Boolean(move && (move.powerApplications.length > 0 || move.cardApplications.length > 0));
  const hasPrimaryContent = Boolean(attackMetric || blockEntry || hasApplications || standaloneIntents.length > 0);
  const showStateName = Boolean(move && !attackMetric && !blockEntry && !hasApplications);
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
      {node.annotation && (
        <span
          className="pointer-events-none absolute -top-5 left-1/2 z-20 max-w-[calc(100%+2rem)] -translate-x-1/2 whitespace-nowrap font-game-title text-[10px] font-bold text-[#efc851]"
          title={node.annotation}
        >
          {node.annotation}
        </span>
      )}
      <span className="relative z-10 flex h-full min-w-0 flex-col items-center justify-center gap-1">
        <span className="flex max-w-full flex-wrap items-center justify-center gap-x-1 gap-y-0.5">
          {attackMetric && (
            <MetricTokenValue
              value={attackMetric.value}
              kind="attack"
              iconOverride={attackMetric.icon}
              label={attackMetric.label}
              ascensionLevel={monsterAscensionLevel}
              compact
            />
          )}
          {blockEntry && (
            <MetricTokenValue value={blockEntry} kind="block" ascensionLevel={monsterAscensionLevel} compact />
          )}
          {moveSummary && standaloneIntents.length > 0 && (
            <MoveStandaloneIntentTokens summary={moveSummary} ascensionLevel={monsterAscensionLevel} compact />
          )}
        </span>
        {move && hasApplications && (
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
              ownerName={monster.name}
            />
          </span>
        )}
        {move && (showStateName || !hasPrimaryContent) && (
          <span className="font-game-title max-w-full truncate text-xs font-bold text-gray-100">
            {move.name}
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
  monsters?: CodexMonster[];
  encounters: CodexEncounter[];
  afflictions?: CodexAffliction[];
  cards?: CodexCard[];
  powers?: CodexPower[];
  patches?: STS2Patch[];
  changes?: STS2Change[];
  versionDiffs?: EntityVersionDiff[];
  onClose?: () => void;
}

export function MonsterDetail({
  serviceLocale,
  gameUi,
  backToListTitle,
  monster,
  monsters = [],
  encounters,
  afflictions = [],
  cards = [],
  powers = [],
  patches,
  changes,
  versionDiffs,
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
  const [phobiaModeState, setPhobiaModeState] = useState<{ monsterId: string; enabled: boolean }>({
    monsterId: monster.id,
    enabled: false,
  });
  const [decimillipedePartState, setDecimillipedePartState] = useState<{ monsterId: string; partId: DecimillipedePartId }>({
    monsterId: monster.id,
    partId: "middle",
  });
  const [stageVisualBoundsState, setStageVisualBoundsState] = useState<{ monsterId: string; bounds: MonsterStageVisualBounds | null }>({
    monsterId: monster.id,
    bounds: null,
  });
  const selectedMoveId = selectedMoveState.monsterId === monster.id ? selectedMoveState.moveId : null;
  const selectedMoveNonce = selectedMoveState.monsterId === monster.id ? selectedMoveState.nonce : 0;
  const [monsterAscensionLevel, setMonsterAscensionLevel] = useMonsterAscensionLevel();
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
  const handleStageVisualBoundsChange = useCallback((bounds: MonsterStageVisualBounds | null) => {
    setStageVisualBoundsState((state) => {
      if (state.monsterId === monster.id && areStageVisualBoundsEqual(state.bounds, bounds)) return state;
      return { monsterId: monster.id, bounds };
    });
  }, [monster.id]);
  const intentPreviewMoveId = intentPreviewState.monsterId === monster.id ? intentPreviewState.moveId : null;
  const intentPreviewSummary = moveSummaries.find((summary) => summary.move.id === intentPreviewMoveId) ?? null;
  const selectedSkinSelections = selectedSkinState.monsterId === monster.id
    ? selectedSkinState.selections
    : getDefaultMonsterSkinSelections(monster);
  const selectedDecimillipedePart = decimillipedePartState.monsterId === monster.id
    ? decimillipedePartState.partId
    : "middle";
  const hasPhobiaMode = hasMonsterPhobiaMode(monster);
  const phobiaModeEnabled = hasPhobiaMode && phobiaModeState.monsterId === monster.id && phobiaModeState.enabled;
  const phobiaModeImageUrl = monster.id === "DECIMILLIPEDE_SEGMENT" ? null : monster.phobiaModeImageUrl;
  const phobiaModeScene = monster.id === "DECIMILLIPEDE_SEGMENT" ? null : monster.phobiaModeScene;
  const selectedSkinNames = useMemo(
    () => getSelectedMonsterSkinNames(monster, selectedSkinSelections, { phobiaMode: phobiaModeEnabled }),
    [monster, selectedSkinSelections, phobiaModeEnabled],
  );
  const selectedSingleSkin = selectedSkinNames.length > 0 ? null : getSingleMonsterSkin(monster);
  const defaultSelectedMove = moveSummaries.find((summary) => summary.move.id === firstMoveId) ?? moveSummaries[0] ?? null;
  const selectedMove = moveSummaries.find((summary) => summary.move.id === selectedMoveId) ?? defaultSelectedMove;
  const selectedAccent = selectedMove ? getMoveToneColor(selectedMove.tone, typeConfig.color) : typeConfig.color;
  const imageSrc = monster.imageUrl ?? monster.bossImageUrl;
  const hasStageAsset = Boolean(monster.spineAsset || imageSrc);
  const stageVisualBounds = stageVisualBoundsState.monsterId === monster.id ? stageVisualBoundsState.bounds : null;
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
  const relatedCardTargets: CodexReferenceTarget[] = getRelatedCardIdsForMonster(monster)
    .map((cardId) => cardById.get(cardId))
    .filter((card): card is CodexCard => Boolean(card))
    .map(cardToReferenceTarget);
  const powerById = useMemo(() => new Map(powers.map((power) => [power.id, power])), [powers]);
  const relatedPowerTargets: CodexReferenceTarget[] = getRelatedPowerIdsForMonster(monster)
    .map((powerId) => powerById.get(powerId))
    .filter((power): power is CodexPower => Boolean(power))
    .map(powerToReferenceTarget);
  const hasStructuredMoveGraph = (monster.moveGraph?.states?.length ?? 0) > 0;
  const patternRail = transitionRows.length > 0 || hasStructuredMoveGraph ? (
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
            <div
              className="relative flex min-h-[22rem] w-full max-w-2xl items-center justify-center overflow-hidden"
              data-monster-detail-render
            >
            <div className="absolute left-2 top-2 z-50 sm:left-3 sm:top-3">
              <MonsterAscensionStepper
                level={monsterAscensionLevel}
                onChange={setMonsterAscensionLevel}
                serviceLocale={serviceLocale}
                prominent
              />
            </div>
            <div
              className="absolute bottom-10 left-[18%] right-[18%] h-8 rounded-[50%] blur-md"
              style={{ backgroundColor: hexToRgba(selectedAccent, 0.18) }}
            />
            {monster.id === "DECIMILLIPEDE_SEGMENT" ? (
              <DecimillipedeSpineStage
                fallbackImageUrl={null}
                monsterName={monster.name}
                selectedMoveId={selectedMoveId}
                selectedMoveNonce={selectedMoveNonce}
                mode="part"
                partId={selectedDecimillipedePart}
                showPhobiaMode={phobiaModeEnabled}
                className="relative z-10 h-[22rem] w-full sm:h-[30rem] lg:h-[34rem]"
                fallbackImageClassName="absolute inset-0 z-10 h-full w-full translate-y-[8%] scale-[0.92] object-contain drop-shadow-2xl"
                onVisualBoundsChange={handleStageVisualBoundsChange}
              />
            ) : hasStageAsset ? (
              <MonsterSpineStage
                asset={monster.spineAsset}
                fallbackImageUrl={imageSrc}
                monsterName={monster.name}
                selectedMoveId={selectedMoveId}
                selectedMoveNonce={selectedMoveNonce}
                selectedSkin={selectedSingleSkin}
                selectedSkins={selectedSkinNames}
                showPhobiaMode={phobiaModeEnabled}
                phobiaModeImageUrl={phobiaModeImageUrl}
                phobiaModeScene={phobiaModeScene}
                className="relative z-10 h-[22rem] w-full sm:h-[30rem] lg:h-[34rem]"
                viewportPadding={MONSTER_DETAIL_VIEWPORT_PADDING}
                fallbackImageClassName="absolute inset-0 z-10 h-full w-full translate-y-[8%] scale-[0.78] object-contain drop-shadow-2xl"
                onVisualBoundsChange={handleStageVisualBoundsChange}
              />
            ) : (
              <div
                className="relative z-10 flex h-52 w-52 items-center justify-center rounded-full border text-5xl font-bold"
                style={{ borderColor: `${typeConfig.color}66`, color: typeConfig.color }}
              >
                {monster.name.slice(0, 1)}
              </div>
            )}
            <MonsterIntentPreview summary={intentPreviewSummary} ascensionLevel={monsterAscensionLevel} />
            <MonsterDetailHealthBar
              monster={monster}
              ascensionLevel={monsterAscensionLevel}
              visualBounds={stageVisualBounds}
              reserveStartEffects={monster.initialPowerApplications.length > 0}
            />
            <MonsterInitialPowerPreview
              applications={monster.initialPowerApplications}
              serviceLocale={serviceLocale}
              powerById={powerById}
              visualBounds={stageVisualBounds}
              ascensionLevel={monsterAscensionLevel}
              ownerName={monster.name}
            />
          </div>

          <div className="text-center">
            <h1
              className="font-game-title break-keep text-3xl font-bold leading-tight text-gray-100 sm:text-4xl"
              style={{ color: typeConfig.color }}
            >
              {monster.name}
            </h1>
          </div>

          {(skinParts.length > 0 || hasPhobiaMode || monster.id === "DECIMILLIPEDE_SEGMENT") && (
            <div className="flex w-full max-w-2xl flex-wrap items-center justify-center gap-x-3 gap-y-2">
              {monster.id === "DECIMILLIPEDE_SEGMENT" && (
                <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5">
                  <span className="font-game-title text-sm font-bold text-[#f1c94f] [text-shadow:2px_2px_0_rgba(0,0,0,0.82)]">
                    {serviceLocale === "ko" ? "부위" : "Part"}
                  </span>
                  <div className="flex flex-wrap gap-1" role="group" aria-label={`${monster.name} ${serviceLocale === "ko" ? "부위" : "part"}`}>
                    {DECIMILLIPEDE_PART_OPTIONS.map((part) => {
                      const selected = selectedDecimillipedePart === part.id;
                      return (
                        <button
                          key={part.id}
                          type="button"
                          onClick={() => setDecimillipedePartState({ monsterId: monster.id, partId: part.id })}
                          className="rounded border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-white/10"
                          style={{
                            backgroundColor: selected ? hexToRgba(typeConfig.color, 0.18) : "rgba(255,255,255,0.03)",
                            borderColor: selected ? `${typeConfig.color}88` : "rgba(255,255,255,0.1)",
                            color: selected ? typeConfig.color : "#a1a1aa",
                          }}
                        >
                          {serviceLocale === "ko" ? part.labelKo : part.labelEn}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {hasPhobiaMode && (
                <GameCheckboxToggle
                  checked={phobiaModeEnabled}
                  onCheckedChange={(enabled) => setPhobiaModeState({ monsterId: monster.id, enabled })}
                  label={getMonsterPhobiaModeLabel(serviceLocale)}
                  size="md"
                />
              )}
              {skinParts.map((part) => {
                const partLabel = getMonsterSkinPartLabel(part, serviceLocale);

                  return (
                    <div key={part.id} className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5">
                      <span className="font-game-title text-sm font-bold text-[#f1c94f] [text-shadow:2px_2px_0_rgba(0,0,0,0.82)]">{partLabel}</span>
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
                    <HpTokenValue monster={monster} ascensionLevel={monsterAscensionLevel} />
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

          {monster.initialPowerApplications.length > 0 && (
            <InfoRailSection title={monsterText.startingEffects}>
              <InitialPowerApplicationsRail
                applications={monster.initialPowerApplications}
                serviceLocale={serviceLocale}
                powerById={powerById}
                ownerName={monster.name}
              />
            </InfoRailSection>
          )}

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
                            ownerName={monster.name}
                          />
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-1">
                          <MoveMetrics summary={summary} ascensionLevel={monsterAscensionLevel} />
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
              { kind: "card", targets: relatedCardTargets },
              { kind: "power", targets: relatedPowerTargets },
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
              versionDiffs={versionDiffs}
              patches={patches}
              monster={monster}
              monsters={monsters}
              introducedInPatch={monster.introducedInPatch}
              deprecatedInPatch={monster.deprecatedInPatch}
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
  padBottom: "16%",
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
const MONSTER_INTENT_ANIMATED_ICONS: Partial<Record<MonsterIntentKind, string>> = {
  buff: "/images/sts2/intents/animated/buff.webp",
  cardDebuff: "/images/sts2/intents/animated/card_debuff.webp",
  debuff: "/images/sts2/intents/animated/debuff.webp",
  escape: "/images/sts2/intents/animated/escape.webp",
  heal: "/images/sts2/intents/animated/heal.webp",
  sleep: "/images/sts2/intents/animated/sleep.webp",
  statusCard: "/images/sts2/intents/animated/status_card.webp",
  stun: "/images/sts2/intents/animated/stun.webp",
  summon: "/images/sts2/intents/animated/summon.webp",
  unknown: "/images/sts2/intents/animated/unknown.webp",
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

function buildMonsterIntentPreviewItems(summary: MoveSummary, ascensionLevel: number): MonsterIntentPreviewItem[] {
  return getMoveIntentDetails(summary.move).flatMap((intent, index) => {
    const kind = getMonsterIntentKind(intent.type);
    if (kind === "hidden") return [];

    return [{
      key: `${intent.type}-${index}`,
      kind,
      icon: getMonsterIntentIcon(kind, summary, intent, ascensionLevel),
      label: getMonsterIntentPreviewLabel(intent, kind, summary, ascensionLevel),
    }];
  });
}

function getStandaloneMoveIntentItems(summary: MoveSummary, ascensionLevel: number): MonsterIntentPreviewItem[] {
  return buildMonsterIntentPreviewItems(summary, ascensionLevel).filter((intent) => (
    intent.kind === "heal" ||
    intent.kind === "summon" ||
    intent.kind === "escape" ||
    intent.kind === "sleep" ||
    intent.kind === "stun" ||
    intent.kind === "unknown"
  ));
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

function getMonsterIntentIcon(
  kind: MonsterIntentKind,
  summary: MoveSummary,
  intent: MonsterMoveIntentDetail,
  ascensionLevel: number,
): string {
  if (kind === "attack") {
    return getAttackIntentIcon(summary.damageEntry, getIntentRepeatInfo(intent), ascensionLevel);
  }
  return MONSTER_INTENT_ANIMATED_ICONS[kind] ?? MONSTER_INTENT_ICONS[kind];
}

function getMonsterIntentPreviewLabel(
  intent: MonsterMoveIntentDetail,
  kind: MonsterIntentKind,
  summary: MoveSummary,
  ascensionLevel: number,
): string | null {
  if (kind === "attack" || kind === "deathBlow") {
    return formatAttackMetricLabel(summary.damageEntry, getIntentRepeatInfo(intent), ascensionLevel);
  }

  if (kind === "statusCard") {
    const card = summary.move.cardApplications[0] ?? null;
    if (!card || isUpgradeCardApplication(card)) return null;
    const amount = getEffectiveDamageValue(card.amount, ascensionLevel, MONSTER_MOVE_ASCENSION_LEVEL);
    return amount == null ? null : String(amount);
  }

  return null;
}

function getMoveAttackMetric(summary: MoveSummary, ascensionLevel: number): MoveAttackMetric | null {
  if (!summary.damageEntry) return null;
  return buildAttackMetric(summary.damageEntry, getPrimaryAttackIntent(summary.move), ascensionLevel);
}

function buildAttackMetric(value: DamageValue, intent: MonsterMoveIntentDetail | null, ascensionLevel: number): MoveAttackMetric {
  const repeat = getIntentRepeatInfo(intent);
  return {
    value,
    icon: getAttackIntentIcon(value, repeat, ascensionLevel),
    label: formatAttackMetricLabel(value, repeat, ascensionLevel) ?? String(getEffectiveDamageValue(value, ascensionLevel, MONSTER_MOVE_ASCENSION_LEVEL) ?? "?"),
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
  ascensionLevel: number,
): string | null {
  const damageValue = getEffectiveDamageValue(damage, ascensionLevel, MONSTER_MOVE_ASCENSION_LEVEL);
  if (damageValue == null) return null;
  const repeatValue = getEffectiveDamageValue(repeat.value, ascensionLevel, MONSTER_MOVE_ASCENSION_LEVEL);
  if (repeat.isMulti) return `${damageValue}x${repeatValue ?? "?"}`;
  return String(damageValue);
}

function getAttackIntentIcon(damage: DamageValue | null, repeat: AttackRepeatInfo, ascensionLevel: number): string {
  const totalDamage = getAttackTotalDamage(damage, repeat, ascensionLevel) ?? 10;
  return `/images/sts2/intents/attack_${getAttackIntentTier(totalDamage)}.png`;
}

function getAttackTotalDamage(
  damage: DamageValue | null,
  repeat: AttackRepeatInfo,
  ascensionLevel: number,
): number | null {
  const damageValue = getEffectiveDamageValue(damage, ascensionLevel, MONSTER_MOVE_ASCENSION_LEVEL);
  if (damageValue == null) return null;
  const repeatValue = getEffectiveDamageValue(repeat.value, ascensionLevel, MONSTER_MOVE_ASCENSION_LEVEL) ?? 1;
  return damageValue * repeatValue;
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
  ascensionLevel = 0,
  ownerName?: string,
): EntityInfo {
  const href = `/compendium/powers/${application.powerId.toLowerCase()}`;
  const powerDescriptionVars = getPowerApplicationDescriptionVars(application, ownerName);
  return {
    id: application.powerId,
    nameEn: power?.nameEn ?? application.powerNameEn,
    nameKo: power?.name ?? application.powerName,
    imageUrl: power?.imageUrl ?? application.imageUrl,
    href,
    color: power?.type ?? application.powerType,
    type: "power",
    powerData: power,
    powerAmount: application.amount,
    powerAmountAscensionLevel: ascensionLevel,
    powerAmountAscensionThreshold: MONSTER_MOVE_ASCENSION_LEVEL,
    powerDescriptionVars,
  };
}

function getPowerApplicationDescriptionVars(
  application: MonsterMovePowerApplication,
  ownerName?: string,
): Record<string, number | string> | undefined {
  if (!ownerName) return undefined;
  if (application.target === "self") return { OwnerName: ownerName };
  if (application.target === "player") return { ApplierName: ownerName };
  return undefined;
}

function buildCardEntity(
  application: MonsterMoveCardApplication,
  card: CodexCard | undefined,
): EntityInfo {
  const href = `/compendium/cards/${application.cardId.toLowerCase()}`;
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

function cardToReferenceTarget(card: CodexCard): CodexReferenceTarget {
  const href = `/compendium/cards/${card.id.toLowerCase()}`;
  return {
    href,
    id: card.id,
    title: card.name,
    entity: {
      id: card.id,
      nameEn: card.nameEn,
      nameKo: card.name,
      imageUrl: card.imageUrl,
      href,
      color: card.color,
      type: "card",
      cardData: card,
    },
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

function powerToReferenceTarget(power: CodexPower): CodexReferenceTarget {
  const href = `/compendium/powers/${power.id.toLowerCase()}`;
  return {
    href,
    id: power.id,
    title: power.name,
    entity: {
      id: power.id,
      nameEn: power.nameEn,
      nameKo: power.name,
      imageUrl: power.imageUrl,
      href,
      color: power.type,
      type: "power",
      powerData: power,
    },
  };
}

function getPowerTargetLabel(target: MonsterMovePowerTarget, serviceLocale: ServiceLocale): string | null {
  if (target === "self") return null;
  const labels: Record<Exclude<MonsterMovePowerTarget, "self">, { ko: string; en: string }> = {
    player: { ko: "플레이어", en: "Player" },
    ally: { ko: "아군", en: "Ally" },
    enemy: { ko: "적", en: "Enemy" },
    unknown: { ko: "대상", en: "Target" },
  };
  return labels[target][serviceLocale];
}

const STRUCTURED_FSM_SAMPLE_IDS = new Set(["GAS_BOMB", "AEONGLASS", "SOUL_NEXUS", "FABRICATOR"]);

function buildStructuredSamplePatternDiagramModel(
  monster: CodexMonster,
  serviceLocale: ServiceLocale,
): PatternDiagramModel | null {
  const states = monster.moveGraph?.states;
  if (!STRUCTURED_FSM_SAMPLE_IDS.has(monster.id) || !states || states.length === 0) return null;

  if (monster.id === "GAS_BOMB") {
    return buildTerminalPatternDiagramModel(monster, states, serviceLocale);
  }
  if (monster.id === "AEONGLASS") {
    return buildFixedLoopPatternDiagramModel(monster, states, serviceLocale);
  }
  if (monster.id === "SOUL_NEXUS") {
    return buildRandomClusterPatternDiagramModel(monster, states, serviceLocale);
  }
  if (monster.id === "FABRICATOR") {
    return buildConditionalClusterPatternDiagramModel(monster, states, serviceLocale);
  }
  return null;
}

function buildTerminalPatternDiagramModel(
  monster: CodexMonster,
  states: MonsterMoveGraphState[],
  serviceLocale: ServiceLocale,
): PatternDiagramModel | null {
  const initialId = monster.moveGraph?.initial;
  const initialState = states.find((state) => state.id === initialId && state.kind === "move");
  if (!initialState) return null;
  const text = getIntentFsmText(serviceLocale);

  const node = buildStructuredPatternNode(initialState.id, 156, 92, true);
  const start = buildPatternEntryNode("__START__", text.start, 26, 124, "start");
  const end = buildPatternEntryNode("__END__", text.end, 374, 124, "end");

  return {
    width: 470,
    height: 260,
    entryNodes: [start, end],
    nodes: [node],
    edges: [
      buildStructuredPatternEdge({
        key: "terminal-start",
        from: start.id,
        to: node.id,
        path: `M ${start.x + start.width} ${start.y + start.height / 2} H ${node.x}`,
        color: BESTIARY_START_COLOR,
        marker: "start",
      }),
      buildStructuredPatternEdge({
        key: "terminal-end",
        from: node.id,
        to: end.id,
        path: `M ${node.x + node.width} ${node.y + node.height / 2} H ${end.x}`,
        color: "#a1a1aa",
      }),
    ],
    phaseBoxes: [],
    choiceBoxes: [],
    phaseConnectors: [],
  };
}

function buildFixedLoopPatternDiagramModel(
  monster: CodexMonster,
  states: MonsterMoveGraphState[],
  serviceLocale: ServiceLocale,
): PatternDiagramModel | null {
  const moveById = new Map(states.filter((state) => state.kind === "move").map((state) => [state.id, state]));
  const initialId = monster.moveGraph?.initial;
  if (!initialId || !moveById.has(initialId)) return null;
  const text = getIntentFsmText(serviceLocale);

  const orderedIds: string[] = [];
  const seen = new Set<string>();
  let currentId: string | null = initialId;
  while (currentId && !seen.has(currentId)) {
    const state = moveById.get(currentId);
    if (!state) break;
    seen.add(currentId);
    orderedIds.push(currentId);
    currentId = state.next;
  }
  if (orderedIds.length === 0) return null;

  const nodeY = 100;
  const nodes = orderedIds.map((id, index) => buildStructuredPatternNode(id, 148 + index * 196, nodeY, id === initialId));
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const start = buildPatternEntryNode("__START__", text.start, 24, 132, "start");
  const edges: PatternDiagramEdge[] = [
    buildStructuredPatternEdge({
      key: "fixed-loop-start",
      from: start.id,
      to: initialId,
      path: `M ${start.x + start.width} ${start.y + start.height / 2} H ${nodeById.get(initialId)!.x}`,
      color: BESTIARY_START_COLOR,
      marker: "start",
    }),
  ];

  orderedIds.forEach((id) => {
    const state = moveById.get(id);
    const from = nodeById.get(id);
    const to = state?.next ? nodeById.get(state.next) : null;
    if (!from || !to) return;
    if (to.x > from.x) {
      edges.push(buildStructuredPatternEdge({
        key: `${id}-${to.id}`,
        from: id,
        to: to.id,
        path: `M ${from.x + from.width} ${from.y + from.height / 2} H ${to.x}`,
        color: DIAGRAM_ARROW_COLOR,
      }));
      return;
    }

    const returnY = 34;
    edges.push(buildStructuredPatternEdge({
      key: `${id}-${to.id}-return`,
      from: id,
      to: to.id,
      path: `M ${from.x + from.width / 2} ${from.y} V ${returnY} H ${to.x + to.width / 2} V ${to.y}`,
      color: DIAGRAM_ARROW_COLOR,
      isLoop: true,
    }));
  });

  return {
    width: nodes[nodes.length - 1].x + DIAGRAM_CELL_WIDTH + 64,
    height: 270,
    entryNodes: [start],
    nodes,
    edges,
    phaseBoxes: [],
    choiceBoxes: [],
    phaseConnectors: [],
  };
}

function buildRandomClusterPatternDiagramModel(
  monster: CodexMonster,
  states: MonsterMoveGraphState[],
  serviceLocale: ServiceLocale,
): PatternDiagramModel | null {
  const randomState = states.find((state) => state.kind === "random");
  if (!randomState || randomState.branches.length === 0) return null;
  const text = getIntentFsmText(serviceLocale);

  const boxX = 140;
  const boxY = 58;
  const nodeY = 126;
  const nodes = randomState.branches.map((branch, index) => (
    buildStructuredPatternNode(
      branch.to,
      boxX + 20 + index * 180,
      nodeY,
      branch.to === monster.moveGraph?.initial,
      formatRandomBranchAnnotation(branch, serviceLocale),
    )
  ));
  const boxWidth = 40 + nodes.length * DIAGRAM_CELL_WIDTH + Math.max(0, nodes.length - 1) * 32;
  const boxHeight = 184;
  const boxRight = boxX + boxWidth;
  const start = buildPatternEntryNode("__START__", text.start, 24, 158, "start");
  const initialNode = nodes.find((node) => node.id === monster.moveGraph?.initial) ?? nodes[0];
  const loopY = boxY - 28;
  const effectiveChance = getEqualCannotRepeatNextChance(randomState.branches);
  const boxLabel = `${text.random} · ${text.excludesPrevious}${effectiveChance == null ? "" : ` · ${formatIntentFsmTemplate(text.nextEach, { chance: formatChancePercent(effectiveChance) })}`}`;

  return {
    width: boxRight + 78,
    height: 310,
    entryNodes: [start],
    nodes,
    edges: [
      buildStructuredPatternEdge({
        key: "random-start",
        from: start.id,
        to: initialNode.id,
        path: `M ${start.x + start.width} ${start.y + start.height / 2} H ${initialNode.x}`,
        color: BESTIARY_START_COLOR,
        marker: "start",
      }),
      buildStructuredPatternEdge({
        key: "random-reroll",
        from: randomState.id,
        to: randomState.id,
        path: `M ${boxRight} ${boxY + boxHeight * 0.62} H ${boxRight + 36} V ${loopY} H ${boxX + boxWidth * 0.68} V ${boxY}`,
        color: DIAGRAM_ARROW_COLOR,
        isLoop: true,
        label: text.reroll,
        labelX: boxRight + 36,
        labelY: loopY + 12,
      }),
    ],
    phaseBoxes: [],
    choiceBoxes: [{
      id: randomState.id,
      x: boxX,
      y: boxY,
      width: boxWidth,
      height: boxHeight,
      label: boxLabel,
      kind: "random",
    }],
    phaseConnectors: [],
  };
}

function buildConditionalClusterPatternDiagramModel(
  monster: CodexMonster,
  states: MonsterMoveGraphState[],
  serviceLocale: ServiceLocale,
): PatternDiagramModel | null {
  const conditionalState = states.find((state) => state.kind === "conditional" && state.id === monster.moveGraph?.initial)
    ?? states.find((state) => state.kind === "conditional");
  if (!conditionalState || conditionalState.kind !== "conditional") return null;
  const stateById = new Map(states.map((state) => [state.id, state]));
  const randomConditionBranch = conditionalState.branches.find((branch) => stateById.get(branch.to)?.kind === "random");
  const randomState = randomConditionBranch ? stateById.get(randomConditionBranch.to) : null;
  if (!randomState || randomState.kind !== "random") return null;
  const text = getIntentFsmText(serviceLocale);
  const directBranches = conditionalState.branches.filter((branch) => stateById.get(branch.to)?.kind === "move");

  const outerX = 140;
  const outerY = 54;
  const outerWidth = 624;
  const outerHeight = 250;
  const randomBoxX = 170;
  const randomBoxY = 102;
  const randomBoxWidth = 374;
  const randomBoxHeight = 158;
  const nodeY = 142;
  const randomNodes = randomState.branches.map((branch, index) => (
    buildStructuredPatternNode(
      branch.to,
      randomBoxX + 18 + index * 178,
      nodeY,
      false,
      formatRandomBranchAnnotation(branch, serviceLocale),
    )
  ));
  const directNodes = directBranches.map((branch, index) => (
    buildStructuredPatternNode(
      branch.to,
      584,
      nodeY + index * (DIAGRAM_CELL_HEIGHT + 22),
      false,
      formatConditionalBranchLabel(branch.condition, serviceLocale),
    )
  ));
  const nodes = [...randomNodes, ...directNodes];
  const start = buildPatternEntryNode("__START__", text.start, 24, 163, "start");
  const outerRight = outerX + outerWidth;
  const loopY = outerY - 28;
  const randomConditionLabel = formatConditionalBranchLabel(randomConditionBranch?.condition ?? null, serviceLocale);
  const randomChance = randomState.branches[0]?.baseChance;
  const randomLabel = `${randomConditionLabel} · ${text.random}${randomChance == null ? "" : ` · ${formatChancePercent(randomChance)}`}`;

  return {
    width: outerRight + 82,
    height: 344,
    entryNodes: [start],
    nodes,
    edges: [
      buildStructuredPatternEdge({
        key: "conditional-start",
        from: start.id,
        to: conditionalState.id,
        path: `M ${start.x + start.width} ${start.y + start.height / 2} H ${outerX}`,
        color: BESTIARY_START_COLOR,
        marker: "start",
      }),
      buildStructuredPatternEdge({
        key: "conditional-reevaluate",
        from: conditionalState.id,
        to: conditionalState.id,
        path: `M ${outerRight} ${outerY + outerHeight * 0.62} H ${outerRight + 38} V ${loopY} H ${outerX + outerWidth * 0.7} V ${outerY}`,
        color: DIAGRAM_CONDITIONAL_COLOR,
        marker: "conditional",
        isLoop: true,
        label: text.reevaluate,
        labelX: outerRight + 38,
        labelY: loopY + 12,
      }),
    ],
    phaseBoxes: [],
    choiceBoxes: [
      {
        id: conditionalState.id,
        x: outerX,
        y: outerY,
        width: outerWidth,
        height: outerHeight,
        label: text.conditionalReevaluation,
        kind: "conditional",
      },
      {
        id: randomState.id,
        x: randomBoxX,
        y: randomBoxY,
        width: randomBoxWidth,
        height: randomBoxHeight,
        label: randomLabel,
        kind: "random",
      },
    ],
    phaseConnectors: [],
  };
}

function buildStructuredPatternNode(
  id: string,
  x: number,
  y: number,
  isInitial: boolean,
  annotation: string | null = null,
): PatternDiagramNode {
  return {
    id,
    x,
    y,
    width: DIAGRAM_CELL_WIDTH,
    height: DIAGRAM_CELL_HEIGHT,
    isInitial,
    phaseId: null,
    annotation,
  };
}

function buildPatternEntryNode(
  id: string,
  label: string,
  x: number,
  y: number,
  kind: "start" | "end",
): PatternDiagramEntryNode {
  return { id, label, x, y, width: 66, height: 32, kind };
}

function buildStructuredPatternEdge({
  key,
  from,
  to,
  path,
  color,
  marker = "normal",
  isLoop = false,
  label = null,
  labelX = 0,
  labelY = 0,
}: {
  key: string;
  from: string;
  to: string;
  path: string;
  color: string;
  marker?: PatternDiagramEdge["marker"];
  isLoop?: boolean;
  label?: string | null;
  labelX?: number;
  labelY?: number;
}): PatternDiagramEdge {
  return { key, from, to, path, color, marker, isLoop, label, labelX, labelY };
}

function formatRandomBranchAnnotation(branch: MonsterMoveGraphRandomBranch, serviceLocale: ServiceLocale): string {
  const text = getIntentFsmText(serviceLocale);
  const chance = branch.baseChance == null ? "?" : formatChancePercent(branch.baseChance);
  const repeatLabel = (() => {
    if (branch.repeat === "cannot_repeat") return formatIntentFsmTemplate(text.consecutiveLimit, { limit: "1" });
    if (branch.repeat === "max_consecutive") {
      const limit = branch.maxRepeats ?? "?";
      return formatIntentFsmTemplate(text.consecutiveLimit, { limit: String(limit) });
    }
    if (branch.repeat === "once") return text.oncePerCombat;
    if (branch.cooldown > 0) return formatIntentFsmTemplate(text.cooldown, { turns: String(branch.cooldown) });
    return text.canRepeat;
  })();
  return `${formatIntentFsmTemplate(text.baseChance, { chance })} · ${repeatLabel}`;
}

function getEqualCannotRepeatNextChance(branches: MonsterMoveGraphRandomBranch[]): number | null {
  if (branches.length < 2 || branches.some((branch) => branch.repeat !== "cannot_repeat" || branch.weight == null)) return null;
  const firstWeight = branches[0].weight;
  if (branches.some((branch) => branch.weight !== firstWeight)) return null;
  return Math.round((1000 / (branches.length - 1))) / 10;
}

function formatConditionalBranchLabel(condition: string | null, serviceLocale: ServiceLocale): string {
  const text = getIntentFsmText(serviceLocale);
  if (condition === "CanFabricate") return text.canFabricate;
  if (condition === "!CanFabricate") return text.cannotFabricate;
  return condition ?? text.condition;
}

function getIntentFsmText(serviceLocale: ServiceLocale) {
  return serviceMessages[serviceLocale].codex.monstersView.intentFsm;
}

function formatIntentFsmTemplate(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replace(`{${key}}`, value),
    template,
  );
}

function buildPatternDiagramModel(
  monster: CodexMonster,
  rows: TransitionTableRow[],
  phases: PatternPhase[],
  serviceLocale: ServiceLocale,
): PatternDiagramModel | null {
  const structuredSample = buildStructuredSamplePatternDiagramModel(monster, serviceLocale);
  if (structuredSample) return structuredSample;

  if (monster.id === "DECIMILLIPEDE_SEGMENT") {
    return buildDecimillipedePatternDiagramModel(rows, serviceLocale);
  }

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
  const edges = buildDiagramEdges(transitions, nodeById);
  const choiceBoxes = buildChoiceBoxes(transitions, nodeById);
  const phaseConnectors = buildPhaseConnectors(phaseBoxes);

  return {
    width: Math.max(360, maxRight),
    height: Math.max(180, cursorY + DIAGRAM_PAD - DIAGRAM_ROW_GAP),
    entryNodes: [],
    nodes,
    edges,
    phaseBoxes,
    choiceBoxes,
    phaseConnectors,
  };
}

function buildDecimillipedePatternDiagramModel(
  rows: TransitionTableRow[],
  serviceLocale: ServiceLocale,
): PatternDiagramModel | null {
  const requiredMoveIds = ["WRITHE", "CONSTRICT", "BULK", "DEAD", "REATTACH"];
  const presentMoveIds = new Set(rows.flatMap((row) => [row.from, row.to]));
  if (!requiredMoveIds.every((moveId) => presentMoveIds.has(moveId))) return null;

  const topY = 116;
  const bottomY = 356;
  const localHGap = 74;
  const x1 = DIAGRAM_PAD;
  const x2 = x1 + DIAGRAM_CELL_WIDTH + localHGap;
  const x3 = x2 + DIAGRAM_CELL_WIDTH + localHGap;
  const nodes: PatternDiagramNode[] = [
    buildPatternNode("WRITHE", x1, topY),
    buildPatternNode("CONSTRICT", x2, topY),
    buildPatternNode("BULK", x3, topY),
    buildPatternNode("DEAD", x1, bottomY),
    buildPatternNode("REATTACH", x2, bottomY),
  ];
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const rowByEdge = new Map(rows.map((row) => [`${row.from}->${row.to}`, row]));
  const randomLabel = getDiagramEdgeLabel(rowByEdge.get("REATTACH->WRITHE") ?? {
    key: "reattach-random",
    from: "REATTACH",
    to: "WRITHE",
    chance: 33.3,
    isStart: false,
    kind: "random",
    condition: null,
  });
  const conditionLabel = serviceLocale === "ko" ? "체력 0" : "0 HP";
  const edge = (
    key: string,
    from: string,
    to: string,
    path: string,
    label: string | null,
    labelX: number,
    labelY: number,
    kind: MonsterMoveTransitionKind = "fixed",
  ): PatternDiagramEdge => ({
    key,
    from,
    to,
    path,
    color: kind === "conditional" ? DIAGRAM_CONDITIONAL_COLOR : DIAGRAM_ARROW_COLOR,
    marker: kind === "conditional" ? "conditional" : "normal",
    isLoop: to === "WRITHE" && from === "BULK",
    label,
    labelX,
    labelY,
  });

  const writhe = nodeById.get("WRITHE");
  const constrict = nodeById.get("CONSTRICT");
  const bulk = nodeById.get("BULK");
  const dead = nodeById.get("DEAD");
  const reattach = nodeById.get("REATTACH");
  if (!writhe || !constrict || !bulk || !dead || !reattach) return null;

  const mainY = writhe.y + writhe.height / 2;
  const bottomMainY = dead.y + dead.height / 2;
  const topLoopY = writhe.y - 58;
  const conditionBusY = writhe.y + writhe.height + 48;
  const writheConditionX = writhe.x + 32;
  const constrictConditionX = constrict.x + constrict.width * 0.36;
  const bulkConditionX = bulk.x + bulk.width * 0.24;
  const deadConditionX = dead.x + 38;
  const randomLaneY1 = writhe.y + writhe.height + 78;
  const randomLaneY2 = randomLaneY1 + 28;
  const randomLaneY3 = randomLaneY2 + 28;
  const edges: PatternDiagramEdge[] = [
    edge(
      "decimillipede-writhe-constrict",
      "WRITHE",
      "CONSTRICT",
      `M ${writhe.x + writhe.width} ${mainY} H ${constrict.x}`,
      null,
      (writhe.x + writhe.width + constrict.x) / 2,
      mainY - 8,
    ),
    edge(
      "decimillipede-constrict-bulk",
      "CONSTRICT",
      "BULK",
      `M ${constrict.x + constrict.width} ${mainY} H ${bulk.x}`,
      null,
      (constrict.x + constrict.width + bulk.x) / 2,
      mainY - 8,
    ),
    edge(
      "decimillipede-bulk-writhe",
      "BULK",
      "WRITHE",
      `M ${bulk.x + bulk.width / 2} ${bulk.y} V ${topLoopY} H ${writhe.x + writhe.width / 2} V ${writhe.y}`,
      null,
      (bulk.x + writhe.x + writhe.width) / 2,
      topLoopY - 8,
    ),
    edge(
      "decimillipede-zero-hp-dead",
      "WRITHE",
      "DEAD",
      [
        `M ${writheConditionX} ${writhe.y + writhe.height} V ${conditionBusY}`,
        `M ${constrictConditionX} ${constrict.y + constrict.height} V ${conditionBusY}`,
        `M ${bulkConditionX} ${bulk.y + bulk.height} V ${conditionBusY}`,
        `M ${bulkConditionX} ${conditionBusY} H ${deadConditionX} V ${dead.y}`,
      ].join(" "),
      conditionLabel,
      (deadConditionX + constrictConditionX) / 2,
      conditionBusY - 6,
      "conditional",
    ),
    edge(
      "decimillipede-dead-reattach",
      "DEAD",
      "REATTACH",
      `M ${dead.x + dead.width} ${bottomMainY} H ${reattach.x}`,
      null,
      (dead.x + dead.width + reattach.x) / 2,
      bottomMainY - 8,
    ),
    edge(
      "decimillipede-reattach-writhe",
      "REATTACH",
      "WRITHE",
      `M ${reattach.x + reattach.width * 0.18} ${reattach.y} V ${randomLaneY1} H ${writhe.x + writhe.width / 2} V ${writhe.y + writhe.height}`,
      randomLabel,
      (reattach.x + writhe.x + writhe.width) / 2,
      randomLaneY1 + 12,
      "random",
    ),
    edge(
      "decimillipede-reattach-constrict",
      "REATTACH",
      "CONSTRICT",
      `M ${reattach.x + reattach.width / 2} ${reattach.y} V ${randomLaneY2} H ${constrict.x + constrict.width / 2} V ${constrict.y + constrict.height}`,
      randomLabel,
      reattach.x + reattach.width / 2 + 32,
      randomLaneY2 + 12,
      "random",
    ),
    edge(
      "decimillipede-reattach-bulk",
      "REATTACH",
      "BULK",
      `M ${reattach.x + reattach.width * 0.82} ${reattach.y} V ${randomLaneY3} H ${bulk.x + bulk.width / 2} V ${bulk.y + bulk.height}`,
      randomLabel,
      (reattach.x + bulk.x + bulk.width) / 2,
      randomLaneY3 + 12,
      "random",
    ),
  ];

  return {
    width: x3 + DIAGRAM_CELL_WIDTH + DIAGRAM_PAD,
    height: bottomY + DIAGRAM_CELL_HEIGHT + DIAGRAM_PAD,
    entryNodes: [],
    nodes,
    edges,
    phaseBoxes: [],
    choiceBoxes: [{
      id: "decimillipede-loop",
      x: x1 - 18,
      y: topY - 32,
      width: x3 + DIAGRAM_CELL_WIDTH - x1 + 36,
      height: DIAGRAM_CELL_HEIGHT + 72,
    }],
    phaseConnectors: [],
  };
}

function buildPatternNode(
  id: string,
  x: number,
  y: number,
): PatternDiagramNode {
  return {
    id,
    x,
    y,
    width: DIAGRAM_CELL_WIDTH,
    height: DIAGRAM_CELL_HEIGHT,
    isInitial: false,
    phaseId: null,
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

function buildDiagramEdges(
  transitions: TransitionTableRow[],
  nodeById: Map<string, PatternDiagramNode>,
): PatternDiagramEdge[] {
  const laneByRoute = new Map<string, number>();

  return transitions.flatMap((transition, index) => {
    const from = nodeById.get(transition.from);
    const to = nodeById.get(transition.to);
    if (!from || !to) return [];

    const routeKey = getDiagramEdgeRouteKey(from, to);
    const laneIndex = laneByRoute.get(routeKey) ?? 0;
    laneByRoute.set(routeKey, laneIndex + 1);
    const edge = buildDiagramEdge(transition, nodeById, index, laneIndex);
    return edge ? [edge] : [];
  });
}

function getDiagramEdgeRouteKey(from: PatternDiagramNode, to: PatternDiagramNode): string {
  if (from.id === to.id) return `self:${from.id}`;
  const fromColumn = Math.round(from.x / (DIAGRAM_CELL_WIDTH + DIAGRAM_H_GAP));
  const toColumn = Math.round(to.x / (DIAGRAM_CELL_WIDTH + DIAGRAM_H_GAP));
  const fromRow = Math.round(from.y / (DIAGRAM_CELL_HEIGHT + DIAGRAM_V_GAP));
  const toRow = Math.round(to.y / (DIAGRAM_CELL_HEIGHT + DIAGRAM_V_GAP));
  const direction = to.x > from.x + from.width / 2
    ? "forward"
    : to.x + to.width < from.x + from.width / 2
      ? "back"
      : "same-column";

  return `${direction}:${Math.min(fromColumn, toColumn)}-${Math.max(fromColumn, toColumn)}:${Math.min(fromRow, toRow)}-${Math.max(fromRow, toRow)}`;
}

function buildDiagramEdge(
  transition: TransitionTableRow,
  nodeById: Map<string, PatternDiagramNode>,
  index: number,
  laneIndex = 0,
): PatternDiagramEdge | null {
  const from = nodeById.get(transition.from);
  const to = nodeById.get(transition.to);
  if (!from || !to) return null;

  const kind = transition.kind === "conditional" ? "conditional" : transition.kind === "start" ? "start" : "fixed";
  const color = kind === "conditional" ? DIAGRAM_CONDITIONAL_COLOR : kind === "start" ? BESTIARY_START_COLOR : DIAGRAM_ARROW_COLOR;
  const marker = kind === "conditional" ? "conditional" : kind === "start" ? "start" : "normal";
  const laneOffset = laneIndex * 16 + (index % 2) * 4;
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
      label: null,
      kind: sourceTransitions.some((transition) => transition.kind === "conditional") ? "conditional" : "random",
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
    if ((move.id === "DEAD" && monster.id !== "DECIMILLIPEDE_SEGMENT") || move.id === "SPAWNED") return;
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
  const transitions = getDisplayPatternTransitions(monster);
  const structuredStates = monster.moveGraph?.states ?? [];
  if (transitions.length === 0 && structuredStates.length === 0) {
    return { kind: "unknown", hasPhases: false, phases: [] };
  }
  if (monster.id === "DECIMILLIPEDE_SEGMENT") {
    return { kind: "mixed", hasPhases: false, phases: [] };
  }

  const kinds = new Set(transitions.map((transition) => transition.kind ?? inferTransitionKind(transition)));
  const hasRandom = kinds.has("random") || structuredStates.some((state) => state.kind === "random");
  const hasConditional = kinds.has("conditional") || structuredStates.some((state) => state.kind === "conditional");
  const isLinear = structuredStates.length > 0
    && !hasRandom
    && !hasConditional
    && structuredStates.every((state) => state.kind !== "move" || state.next == null);
  const kind: PatternKind = isLinear
    ? "linear"
    : hasRandom && hasConditional
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
  const transitions = getDisplayPatternTransitions(monster);
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
  const intentFsm = getIntentFsmText(serviceLocale);
  const labels: Record<PatternKind, { ko: string; en: string }> = {
    linear: { ko: intentFsm.nonRepeatingKind, en: intentFsm.nonRepeatingKind },
    fixed: { ko: "고정 반복", en: "Fixed" },
    random: { ko: "무작위", en: "Random" },
    conditional: { ko: "조건부", en: "Conditional" },
    mixed: { ko: intentFsm.conditionalRandomKind, en: intentFsm.conditionalRandomKind },
    unknown: { ko: "미확인", en: "Unknown" },
  };
  return serviceLocale === "ko" ? labels[kind].ko : labels[kind].en;
}

function getFixedLoopLength(monster: CodexMonster): number | null {
  const graph = monster.moveGraph;
  if (!graph) return null;
  const displayTransitions = getLoopLengthPatternTransitions(monster);
  const transitions = displayTransitions.filter((transition) => {
    const kind = transition.kind ?? inferTransitionKind(transition);
    return kind === "fixed" && transition.from !== "__START__";
  });
  if (transitions.length === 0 || transitions.length !== displayTransitions.length) return null;
  const nextByMove = new Map<string, string>();
  for (const transition of transitions) {
    if (nextByMove.has(transition.from)) return null;
    nextByMove.set(transition.from, transition.to);
  }

  const seen = new Set<string>();
  const start = graph.initial ?? transitions[0]?.from ?? null;
  let current = start;
  if (!current) return null;
  while (!seen.has(current)) {
    seen.add(current);
    const next = nextByMove.get(current);
    if (!next) return null;
    current = next;
  }

  return current === start ? seen.size : null;
}

function getDisplayPatternTransitions(monster: CodexMonster): MonsterMoveTransition[] {
  return monster.moveGraph?.transitions ?? [];
}

function getLoopLengthPatternTransitions(monster: CodexMonster): MonsterMoveTransition[] {
  const transitions = getDisplayPatternTransitions(monster);
  if (monster.id !== "DECIMILLIPEDE_SEGMENT") return transitions;

  return transitions.filter((transition) => (
    transition.from !== "DEAD" &&
    transition.from !== "REATTACH" &&
    transition.to !== "DEAD" &&
    transition.to !== "REATTACH"
  ));
}

function formatHp(monster: CodexMonster): string | null {
  if (monster.minHp == null || monster.minHp === 9999) return null;
  if (monster.maxHp != null && monster.maxHp !== monster.minHp) {
    return `${monster.minHp}-${monster.maxHp}`;
  }
  return `${monster.minHp}`;
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

function getPowerApplicationCounterAmount(
  application: MonsterMovePowerApplication,
  power: CodexPower | undefined,
): DamageValue | null {
  if (!application.amount || !isCountablePower(power)) return null;
  return application.amount;
}

function isCountablePower(power: CodexPower | undefined): boolean {
  return power?.stackType === "Counter" || power?.stackType === "Duration" || power?.stackType === "Intensity";
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
  const transitions = getDisplayPatternTransitions(monster);
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
