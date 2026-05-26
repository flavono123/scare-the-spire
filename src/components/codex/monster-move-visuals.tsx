"use client";

import { useCallback, useState, type CSSProperties } from "react";
import Link from "next/link";
import Image from "@/components/ui/static-image";
import type {
  CodexMonster,
  DamageValue,
  MonsterMove,
  MonsterMoveCardApplication,
  MonsterMoveIntentDetail,
  MonsterMovePowerApplication,
} from "@/lib/codex-types";
import type { ServiceLocale } from "@/lib/i18n";
import { localizeHref } from "@/lib/i18n";
import { GameHoverTip } from "./hover-tip";
import { MonsterSpineStage, type MonsterStageVisualBounds } from "./monster-spine-stage";

type IntentKind =
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

type MoveChangeTone = "buff" | "nerf" | "added" | "removed" | null;

export interface MonsterMoveVisual {
  id: string;
  name: string;
  nameEn: string;
  damage: DamageValue | null;
  block: DamageValue | null;
  intents: MonsterMoveIntentDetail[];
  powers: readonly MonsterMovePowerApplication[];
  cards: readonly MonsterMoveCardApplication[];
  damageChange?: MoveChangeTone;
  blockChange?: MoveChangeTone;
  powerChange?: MoveChangeTone;
}

type MoveVisual = MonsterMoveVisual;

interface InfestedPrismReworkBlockProps {
  monster: CodexMonster;
  serviceLocale: ServiceLocale;
  variant?: "full" | "compact";
}

const INFESTED_PRISM_MOVE_ORDER = ["JAB", "RADIATE", "WHIRLWIND", "PULSATE"];
const ARROW_ICON = "/images/sts2/ui/settings_tiny_right_arrow.png";
const ASCENSION_ICON = "/images/sts2/ui/topbar/top_bar_ascension.png";
const BLOCK_ICON = "/images/sts2/ui/combat/block.png";
const MOVE_PREVIEW_VIEWPORT_PADDING = { padTop: "8%", padBottom: "0%" } as const;
const MOVE_PREVIEW_STAGE_TOP = 24;
const MOVE_PREVIEW_STAGE_BOTTOM = 4;
const INTENT_ICONS: Record<IntentKind, string> = {
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
const ANIMATED_INTENT_ICONS: Partial<Record<IntentKind, string>> = {
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
const INTENT_CLASS_TO_KIND: Record<string, IntentKind> = {
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

const OLD_INFESTED_PRISM_MOVES: MoveVisual[] = [
  {
    id: "JAB",
    name: "찌르기",
    nameEn: "Jab",
    damage: { normal: 22, ascension: 24 },
    block: null,
    intents: [{ type: "SingleAttackIntent", damageKey: "Jab", repeat: SINGLE_ATTACK_REPEAT }],
    powers: [],
    cards: [],
    damageChange: "removed",
  },
  {
    id: "RADIATE",
    name: "방출",
    nameEn: "Radiate",
    damage: { normal: 16, ascension: 18 },
    block: null,
    intents: [{ type: "SingleAttackIntent", damageKey: "Radiate", repeat: SINGLE_ATTACK_REPEAT }],
    powers: [],
    cards: [],
    damageChange: "removed",
  },
  {
    id: "WHIRLWIND",
    name: "소용돌이",
    nameEn: "Whirlwind",
    damage: { normal: 9, ascension: 10 },
    block: null,
    intents: [{ type: "MultiAttackIntent", damageKey: "Whirlwind", repeat: { normal: 3, ascension: null } }],
    powers: [],
    cards: [],
    damageChange: "removed",
  },
  {
    id: "PULSATE",
    name: "맥박",
    nameEn: "Pulsate",
    damage: null,
    block: null,
    intents: [],
    powers: [],
    cards: [],
  },
];

export function InfestedPrismReworkBlock({
  monster,
  serviceLocale,
  variant = "full",
}: InfestedPrismReworkBlockProps) {
  if (monster.id !== "INFESTED_PRISM") return null;

  const currentMoves = buildCurrentMoveVisuals(monster);
  const compact = variant === "compact";
  const href = localizeHref(`/compendium/bestiary?monster=${monster.id.toLowerCase()}`, serviceLocale);
  const labels = serviceLocale === "ko"
    ? {
        title: "감염된 프리즘 리워크",
        before: "이전",
        after: "이후",
        body: "공격 피해가 크게 낮아지고, 방출과 맥박에 방어가 붙었습니다. 맥박은 피해/방어와 생명의 불꽃 적용이 함께 보이는 행동입니다.",
        hp: "체력",
      }
    : {
        title: "Infested Prism Rework",
        before: "Before",
        after: "After",
        body: "Attack damage is much lower. Radiate and Pulsate now include Block, and Pulsate is shown with damage, Block, and Vital Spark application.",
        hp: "HP",
      };

  return (
    <div className={compact ? "mt-2" : "my-4"}>
      <div className="rounded-lg border border-yellow-400/20 bg-black/25 p-3 shadow-[0_18px_45px_rgba(0,0,0,0.28)]">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <Link
            href={href}
            className="font-game-title text-sm font-bold text-yellow-300 underline decoration-yellow-500/30 underline-offset-2 hover:text-yellow-200"
          >
            {labels.title}
          </Link>
        </div>

        {!compact && (
          <p className="mb-3 font-game-text text-xs leading-relaxed text-zinc-400">
            {labels.body}
          </p>
        )}

        <div className="mb-3 flex flex-wrap items-center gap-2 font-game-text text-xs text-zinc-400">
          <span className="text-zinc-500">{labels.hp}</span>
          <span className="font-bold text-red-300">200 <AscensionValue value={215} level={8} /></span>
          <span className="text-zinc-600">→</span>
          <span className="font-bold text-green-300">161 <AscensionValue value={171} level={8} /></span>
        </div>

        <div className="space-y-3">
          <MoveSequenceRail
            label={labels.before}
            moves={OLD_INFESTED_PRISM_MOVES}
            monster={monster}
            serviceLocale={serviceLocale}
            tone="before"
          />
          <MoveSequenceRail
            label={labels.after}
            moves={currentMoves}
            monster={monster}
            serviceLocale={serviceLocale}
            tone="after"
          />
        </div>
      </div>
    </div>
  );
}

function MoveSequenceRail({
  label,
  moves,
  monster,
  serviceLocale,
  tone,
}: {
  label: string;
  moves: MoveVisual[];
  monster: CodexMonster;
  serviceLocale: ServiceLocale;
  tone: "before" | "after";
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-[4.5rem_minmax(0,1fr)] sm:items-center">
      <div className={`font-game-title text-xs font-bold ${tone === "after" ? "text-green-300" : "text-red-300"}`}>
        {label}
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        {moves.map((move, index) => (
          <span key={move.id} className="flex min-w-0 items-center gap-1.5">
            <MovePanel
              move={move}
              monster={monster}
              serviceLocale={serviceLocale}
            />
            <Image
              src={ARROW_ICON}
              alt=""
              width={16}
              height={16}
              className={`h-4 w-4 object-contain ${index === moves.length - 1 ? "opacity-90" : ""}`}
            />
          </span>
        ))}
      </div>
    </div>
  );
}

function MovePanel({
  move,
  monster,
  serviceLocale,
}: {
  move: MoveVisual;
  monster: CodexMonster;
  serviceLocale: ServiceLocale;
}) {
  return (
    <span className="inline-flex w-[17.5rem] max-w-full">
      <MonsterMoveHoverPreview
        move={move}
        monster={monster}
        serviceLocale={serviceLocale}
      />
    </span>
  );
}

export function MonsterMoveHoverPreview({
  move,
  monster,
  serviceLocale,
  selectedMoveNonce = 0,
  title,
}: {
  move: MonsterMoveVisual;
  monster: CodexMonster;
  serviceLocale: ServiceLocale;
  selectedMoveNonce?: number;
  title?: string;
}) {
  const [visualBounds, setVisualBounds] = useState<MonsterStageVisualBounds | null>(null);
  const handleVisualBoundsChange = useCallback((bounds: MonsterStageVisualBounds | null) => {
    setVisualBounds((current) => areStageVisualBoundsEqual(current, bounds) ? current : bounds);
  }, []);
  const resolvedTitle = title ?? (serviceLocale === "ko" ? move.name : move.nameEn);
  const monsterName = serviceLocale === "ko" ? monster.name : monster.nameEn;

  return (
    <GameHoverTip title={resolvedTitle} style={{ width: 280, maxWidth: 280 }}>
      <span className="mb-1.5 block font-game-text text-[11px] text-zinc-400">
        {monsterName}
      </span>
      <span className="relative mb-2 block h-44 overflow-hidden rounded bg-black/25">
        <span
          className="absolute inset-x-0"
          style={{ top: MOVE_PREVIEW_STAGE_TOP, bottom: MOVE_PREVIEW_STAGE_BOTTOM }}
        >
          <MonsterSpineStage
            asset={monster.spineAsset}
            fallbackImageUrl={monster.bossImageUrl ?? monster.imageUrl}
            monsterName={monster.name}
            selectedMoveId={move.id}
            selectedMoveNonce={selectedMoveNonce}
            imagePriority={false}
            showLoadingLabel={false}
            viewportTransitionTime={0}
            viewportPadding={MOVE_PREVIEW_VIEWPORT_PADDING}
            fallbackImageClassName="absolute inset-0 h-full w-full object-contain opacity-80"
            className="absolute inset-0"
            onVisualBoundsChange={handleVisualBoundsChange}
          />
        </span>
        <MoveIntentPreview move={move} visualBounds={visualBounds} />
        <InitialPowerPreview
          applications={monster.initialPowerApplications}
          serviceLocale={serviceLocale}
          visualBounds={visualBounds}
        />
      </span>
      <span className="flex flex-wrap items-center gap-2">
        <MoveMetricTokens move={move} />
        <MoveApplicationIcons move={move} serviceLocale={serviceLocale} />
      </span>
    </GameHoverTip>
  );
}

function InitialPowerPreview({
  applications,
  serviceLocale,
  visualBounds,
}: {
  applications: readonly MonsterMovePowerApplication[];
  serviceLocale: ServiceLocale;
  visualBounds: MonsterStageVisualBounds | null;
}) {
  if (applications.length === 0) return null;

  return (
    <span
      className="pointer-events-none absolute z-40 flex items-end justify-center gap-1"
      style={getInitialPowerPreviewStyle(visualBounds, applications.length)}
      aria-label={serviceLocale === "ko" ? "시작 효과" : "Starting effects"}
    >
      {applications.map((power) => (
        <PowerApplicationIcon
          key={`initial-${power.powerId}-${power.target}`}
          power={power}
          serviceLocale={serviceLocale}
          added={false}
          interactive={false}
        />
      ))}
    </span>
  );
}

function MoveIntentPreview({
  move,
  visualBounds,
}: {
  move: MoveVisual;
  visualBounds: MonsterStageVisualBounds | null;
}) {
  const intents = move.intents
    .map((intent, index) => ({ intent, kind: getIntentKind(intent.type), key: `${intent.type}-${index}` }))
    .filter((item) => item.kind !== "hidden");
  if (intents.length === 0) return null;

  return (
    <span
      className="pointer-events-none absolute z-40 flex items-end justify-center gap-1"
      style={getIntentPreviewStyle(visualBounds, intents.length)}
    >
      {intents.map(({ intent, kind, key }) => (
        <span key={key} className="relative inline-flex h-12 w-12 items-center justify-center">
          <Image
            src={getIntentIcon(kind, move, intent)}
            alt=""
            width={48}
            height={48}
            className="h-11 w-11 object-contain drop-shadow-[0_5px_6px_rgba(0,0,0,0.78)]"
          />
          {kind === "attack" && move.damage && (
            <span
              className="font-game-title absolute -bottom-0.5 left-1/2 -translate-x-1/2 text-base font-black leading-none text-[#fff8db]"
              style={{ textShadow: "0 2px 0 #000, 0 0 4px #000, 1px 1px 0 #000" }}
            >
              {formatAttackLabel(move.damage, getRepeatInfo(intent), "normal")}
            </span>
          )}
        </span>
      ))}
    </span>
  );
}

function getIntentPreviewStyle(bounds: MonsterStageVisualBounds | null, count: number): CSSProperties {
  if (!bounds) {
    return {
      left: "50%",
      top: 4,
      transform: "translateX(-50%)",
    };
  }

  const safeInset = 4;
  const tokenSize = 56;
  const gap = 8;
  const groupWidth = Math.max(tokenSize, count * tokenSize + Math.max(0, count - 1) * gap);
  const halfWidth = groupWidth / 2;
  const centerX = bounds.left + bounds.width / 2;
  const left = clampNumber(centerX, safeInset + halfWidth, Math.max(safeInset + halfWidth, bounds.stageWidth - safeInset - halfWidth));
  const stageFrameHeight = MOVE_PREVIEW_STAGE_TOP + bounds.stageHeight + MOVE_PREVIEW_STAGE_BOTTOM;
  const top = clampNumber(
    MOVE_PREVIEW_STAGE_TOP + bounds.top - tokenSize - gap,
    safeInset,
    Math.max(safeInset, stageFrameHeight - tokenSize - safeInset),
  );

  return {
    left,
    top,
    transform: "translateX(-50%)",
  };
}

function getInitialPowerPreviewStyle(bounds: MonsterStageVisualBounds | null, count: number): CSSProperties {
  if (!bounds) {
    return {
      left: "50%",
      bottom: 4,
      transform: "translateX(-50%)",
    };
  }

  const safeInset = 4;
  const tokenSize = 24;
  const gap = 4;
  const groupWidth = Math.max(tokenSize, count * tokenSize + Math.max(0, count - 1) * gap);
  const halfWidth = groupWidth / 2;
  const centerX = bounds.left + bounds.width / 2;
  const left = clampNumber(centerX, safeInset + halfWidth, Math.max(safeInset + halfWidth, bounds.stageWidth - safeInset - halfWidth));
  const stageFrameHeight = MOVE_PREVIEW_STAGE_TOP + bounds.stageHeight + MOVE_PREVIEW_STAGE_BOTTOM;
  const top = clampNumber(
    MOVE_PREVIEW_STAGE_TOP + bounds.bottom + 4,
    safeInset,
    Math.max(safeInset, stageFrameHeight - tokenSize - safeInset),
  );

  return {
    left,
    top,
    transform: "translateX(-50%)",
  };
}

function MoveMetricTokens({ move, compact = false }: { move: MoveVisual; compact?: boolean }) {
  const attackIntent = move.intents.find((intent) => getIntentKind(intent.type) === "attack" || getIntentKind(intent.type) === "deathBlow") ?? null;
  return (
    <>
      {move.damage && (
        <MetricToken
          icon={getAttackIcon(move.damage, getRepeatInfo(attackIntent))}
          value={move.damage}
          normalLabel={formatAttackLabel(move.damage, getRepeatInfo(attackIntent), "normal")}
          ascensionLabel={formatAttackLabel(move.damage, getRepeatInfo(attackIntent), "ascension")}
          change={move.damageChange}
          compact={compact}
        />
      )}
      {move.block && (
        <MetricToken
          icon={BLOCK_ICON}
          value={move.block}
          change={move.blockChange}
          compact={compact}
        />
      )}
    </>
  );
}

function MoveApplicationIcons({
  move,
  serviceLocale,
  interactive = true,
}: {
  move: MoveVisual;
  serviceLocale: ServiceLocale;
  interactive?: boolean;
}) {
  if (move.powers.length === 0 && move.cards.length === 0) return null;

  return (
    <>
      {move.powers.map((power) => (
        <PowerApplicationIcon
          key={`${move.id}-${power.powerId}`}
          power={power}
          serviceLocale={serviceLocale}
          added={move.powerChange === "added"}
          interactive={interactive}
        />
      ))}
      {move.cards.map((card) => (
        <span key={`${move.id}-${card.cardId}`} className="relative inline-flex h-6 w-6 items-center justify-center" title={serviceLocale === "ko" ? card.cardName : card.cardNameEn}>
          {card.imageUrl && <Image src={card.imageUrl} alt="" width={24} height={24} className="h-6 w-6 object-contain" />}
        </span>
      ))}
    </>
  );
}

function PowerApplicationIcon({
  power,
  serviceLocale,
  added,
  interactive,
}: {
  power: MonsterMovePowerApplication;
  serviceLocale: ServiceLocale;
  added: boolean;
  interactive: boolean;
}) {
  const className = "relative inline-flex h-6 w-6 items-center justify-center rounded-sm outline-none transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-yellow-300/70";
  const title = serviceLocale === "ko" ? power.powerName : power.powerNameEn;
  const content = (
    <>
      {power.imageUrl && <Image src={power.imageUrl} alt="" width={24} height={24} className="h-6 w-6 object-contain" />}
      {power.amount && (
        <span className="pointer-events-none absolute -bottom-0.5 -right-1 rounded bg-black/75 px-0.5 text-[9px] font-bold tabular-nums text-zinc-100">
          {power.amount.normal ?? "?"}
        </span>
      )}
      {added && (
        <span className="pointer-events-none absolute -top-1 -right-1 text-[10px] font-black text-green-300">+</span>
      )}
    </>
  );

  if (!interactive) {
    return (
      <span className={className} title={title}>
        {content}
      </span>
    );
  }

  return (
    <Link
      href={localizeHref(`/compendium/powers?power=${power.powerId.toLowerCase()}`, serviceLocale)}
      className={className}
      title={title}
    >
      {content}
    </Link>
  );
}

function MetricToken({
  icon,
  value,
  normalLabel,
  ascensionLabel,
  change,
  compact = false,
}: {
  icon: string;
  value: DamageValue;
  normalLabel?: string | null;
  ascensionLabel?: string | null;
  change?: MoveChangeTone;
  compact?: boolean;
}) {
  const normalText = normalLabel ?? String(value.normal ?? "?");
  const ascensionText = ascensionLabel ?? (value.ascension == null ? null : String(value.ascension));
  const showAscension = ascensionText != null && ascensionText !== normalText;
  const changeClass = change === "added"
    ? "text-green-300"
    : change === "removed"
      ? "text-red-300"
      : change === "nerf"
        ? "text-green-300"
        : change === "buff"
          ? "text-red-300"
          : "text-zinc-100";

  return (
    <span className={`inline-flex items-center font-game-text font-bold leading-none ${changeClass} ${compact ? "gap-0.5 text-xs" : "gap-1 text-sm"}`}>
      <Image src={icon} alt="" width={compact ? 18 : 22} height={compact ? 18 : 22} className={`${compact ? "h-4 w-4" : "h-5 w-5"} object-contain`} />
      <span>{normalText}</span>
      {showAscension && <AscensionValue value={ascensionText} compact={compact} />}
      {change === "added" && <span className="text-[10px] font-black text-green-300">+</span>}
    </span>
  );
}

function AscensionValue({ value, level = 9, compact = false }: { value: string | number; level?: number; compact?: boolean }) {
  return (
    <span className={`inline-flex items-center text-orange-300 ${compact ? "gap-0.5" : "gap-1"}`}>
      <span className="text-zinc-500">(</span>
      <span className="relative inline-flex h-4 w-4 items-center justify-center align-middle">
        <Image src={ASCENSION_ICON} alt="" width={16} height={16} className="h-4 w-4 object-contain" />
        <span className="absolute inset-0 flex items-center justify-center pt-px text-[8px] font-black leading-none text-white drop-shadow">{level}</span>
      </span>
      <span>{value}</span>
      <span className="text-zinc-500">)</span>
    </span>
  );
}

function buildCurrentMoveVisuals(monster: CodexMonster): MoveVisual[] {
  const moveById = new Map([...monster.bestiaryMoves, ...monster.moves].map((move) => [move.id, move]));
  const oldById = new Map(OLD_INFESTED_PRISM_MOVES.map((move) => [move.id, move]));

  return INFESTED_PRISM_MOVE_ORDER.flatMap((moveId) => {
    const move = moveById.get(moveId);
    if (!move) return [];
    const visual = buildMonsterMoveVisual(monster, move);
    const old = oldById.get(moveId);
    return [{
      ...visual,
      damageChange: getDamageChange(old?.damage ?? null, visual.damage),
      blockChange: old?.block ? getDamageChange(old.block, visual.block) : visual.block ? "added" : null,
      powerChange: null,
    }];
  });
}

export function buildMonsterMoveVisual(
  monster: CodexMonster,
  move: MonsterMove,
  options: { damage?: DamageValue | null; block?: DamageValue | null } = {},
): MonsterMoveVisual {
  return {
    id: move.id,
    name: move.name,
    nameEn: move.nameEn,
    damage: options.damage !== undefined ? options.damage : findDamageForMove(monster, move),
    block: options.block !== undefined ? options.block : findBlockForMove(monster, move),
    intents: getMoveIntentDetails(move),
    powers: move.powerApplications,
    cards: move.cardApplications,
  };
}

function getMoveIntentDetails(move: MonsterMove): MonsterMoveIntentDetail[] {
  if (move.intentDetails.length > 0) return move.intentDetails;
  return move.intents.map((type) => ({ type }));
}

function findDamageForMove(monster: CodexMonster, move: MonsterMove): DamageValue | null {
  if (!monster.damageValues) return null;
  const explicitKey = getMoveIntentDetails(move).find((intent) => intent.damageKey)?.damageKey;
  if (explicitKey && monster.damageValues[explicitKey]) return monster.damageValues[explicitKey];
  return findValueForMoveId(move.id, monster.damageValues);
}

function findBlockForMove(monster: CodexMonster, move: MonsterMove): DamageValue | null {
  if (!monster.blockValues) return null;
  const explicitKey = getMoveIntentDetails(move).find((intent) => intent.blockKey)?.blockKey;
  if (explicitKey && monster.blockValues[explicitKey]) return monster.blockValues[explicitKey];
  return findValueForMoveId(move.id, monster.blockValues);
}

function findValueForMoveId(moveId: string, values: Record<string, DamageValue>): DamageValue | null {
  const moveKey = normalizeKey(moveId);
  for (const [key, value] of Object.entries(values)) {
    if (normalizeKey(key) === moveKey) return value;
  }
  for (const [key, value] of Object.entries(values)) {
    const normalizedKey = normalizeKey(key);
    if (moveKey.includes(normalizedKey) || normalizedKey.includes(moveKey)) return value;
  }
  return null;
}

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/_/g, "");
}

function getIntentKind(intent: string): IntentKind {
  const kind = INTENT_CLASS_TO_KIND[intent];
  if (kind) return kind;
  if (intent.includes("Attack")) return "attack";
  if (intent.includes("Buff")) return "buff";
  if (intent.includes("Debuff")) return "debuff";
  if (intent.includes("Defend")) return "defend";
  if (intent.includes("Status")) return "statusCard";
  return "unknown";
}

function getIntentIcon(kind: IntentKind, move: MoveVisual, intent: MonsterMoveIntentDetail): string {
  if (kind === "attack" || kind === "deathBlow") {
    return getAttackIcon(move.damage, getRepeatInfo(intent));
  }
  return ANIMATED_INTENT_ICONS[kind] ?? INTENT_ICONS[kind];
}

function getRepeatInfo(intent: MonsterMoveIntentDetail | null): { value: DamageValue | null; multi: boolean } {
  if (!intent) return { value: null, multi: false };
  if (intent.repeat) return { value: intent.repeat, multi: intent.type === "MultiAttackIntent" };
  return { value: SINGLE_ATTACK_REPEAT, multi: intent.type === "MultiAttackIntent" };
}

function getAttackIcon(damage: DamageValue | null, repeat: { value: DamageValue | null; multi: boolean }): string {
  const total = getAttackTotal(damage, repeat, "normal") ?? getAttackTotal(damage, repeat, "ascension") ?? 10;
  if (total < 5) return "/images/sts2/intents/attack_1.png";
  if (total < 10) return "/images/sts2/intents/attack_2.png";
  if (total < 20) return "/images/sts2/intents/attack_3.png";
  if (total < 40) return "/images/sts2/intents/attack_4.png";
  return "/images/sts2/intents/attack_5.png";
}

function getAttackTotal(
  damage: DamageValue | null,
  repeat: { value: DamageValue | null; multi: boolean },
  mode: "normal" | "ascension",
): number | null {
  const damageValue = getModeValue(damage, mode);
  if (damageValue == null) return null;
  return damageValue * (getModeValue(repeat.value, mode) ?? 1);
}

function formatAttackLabel(
  damage: DamageValue | null,
  repeat: { value: DamageValue | null; multi: boolean },
  mode: "normal" | "ascension",
): string | null {
  const damageValue = getModeValue(damage, mode);
  if (damageValue == null) return null;
  if (!repeat.multi) return String(damageValue);
  return `${damageValue}x${getModeValue(repeat.value, mode) ?? "?"}`;
}

function getModeValue(value: DamageValue | null, mode: "normal" | "ascension"): number | null {
  if (!value) return null;
  return mode === "ascension" ? value.ascension ?? value.normal : value.normal;
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

function getDamageChange(before: DamageValue | null, after: DamageValue | null): MoveChangeTone {
  if (!before && after) return "added";
  if (before && !after) return "removed";
  if (!before || !after) return null;
  const beforeTotal = before.normal ?? 0;
  const afterTotal = after.normal ?? 0;
  if (afterTotal < beforeTotal) return "nerf";
  if (afterTotal > beforeTotal) return "buff";
  return null;
}
