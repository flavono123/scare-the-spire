"use client";

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
import {
  getEffectiveDamageValue,
  MONSTER_MOVE_ASCENSION_LEVEL,
  MonsterAscensionStepper,
  MonsterHealthBar,
  useMonsterAscensionLevel,
} from "./monster-ascension";
import { MonsterSpineStage } from "./monster-spine-stage";

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
const BLOCK_ICON = "/images/sts2/ui/combat/block.png";
const MOVE_PREVIEW_VIEWPORT_PADDING = { padTop: "0%", padBottom: "0%" } as const;
const OLD_INFESTED_PRISM_HP: DamageValue = { normal: 200, ascension: 215 };
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

        <div className="space-y-3">
          <MoveSequenceRail
            label={labels.before}
            moves={OLD_INFESTED_PRISM_MOVES}
            monster={monster}
            serviceLocale={serviceLocale}
            tone="before"
            hpOverride={OLD_INFESTED_PRISM_HP}
            initialPowerApplications={[]}
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
  hpOverride,
  initialPowerApplications,
}: {
  label: string;
  moves: MoveVisual[];
  monster: CodexMonster;
  serviceLocale: ServiceLocale;
  tone: "before" | "after";
  hpOverride?: DamageValue | null;
  initialPowerApplications?: readonly MonsterMovePowerApplication[] | null;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-[4.5rem_minmax(0,1fr)] sm:items-center">
      <div className={`font-game-title text-xs font-bold ${tone === "after" ? "text-green-300" : "text-red-300"}`}>
        {label}
      </div>
      <div className="flex min-w-0 flex-nowrap items-center gap-1.5 overflow-x-auto pb-1">
        {moves.map((move, index) => (
          <span key={move.id} className="flex shrink-0 items-center gap-1.5">
            <MovePanel
              move={move}
              monster={monster}
              serviceLocale={serviceLocale}
              hpOverride={hpOverride}
              initialPowerApplications={initialPowerApplications}
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
  hpOverride,
  initialPowerApplications,
}: {
  move: MoveVisual;
  monster: CodexMonster;
  serviceLocale: ServiceLocale;
  hpOverride?: DamageValue | null;
  initialPowerApplications?: readonly MonsterMovePowerApplication[] | null;
}) {
  return (
    <span className="inline-flex w-44 shrink-0">
      <MonsterMoveHoverPreview
        move={move}
        monster={monster}
        serviceLocale={serviceLocale}
        variant="inline"
        loopAnimation
        hpOverride={hpOverride}
        initialPowerApplications={initialPowerApplications}
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
  variant = "hover",
  hpOverride = null,
  initialPowerApplications,
  loopAnimation = false,
}: {
  move: MonsterMoveVisual;
  monster: CodexMonster;
  serviceLocale: ServiceLocale;
  selectedMoveNonce?: number;
  title?: string;
  variant?: "hover" | "inline";
  hpOverride?: DamageValue | null;
  initialPowerApplications?: readonly MonsterMovePowerApplication[] | null;
  loopAnimation?: boolean;
}) {
  const [ascensionLevel, setAscensionLevel] = useMonsterAscensionLevel();
  const resolvedTitle = title ?? (serviceLocale === "ko" ? move.name : move.nameEn);
  const monsterName = serviceLocale === "ko" ? monster.name : monster.nameEn;
  const startingEffects = initialPowerApplications ?? monster.initialPowerApplications;
  const previewSurface = (
    <MovePreviewSurface
      move={move}
      monster={monster}
      serviceLocale={serviceLocale}
      selectedMoveNonce={selectedMoveNonce}
      ascensionLevel={ascensionLevel}
      setAscensionLevel={setAscensionLevel}
      variant={variant}
      hpOverride={hpOverride}
      initialPowerApplications={startingEffects}
      loopAnimation={loopAnimation}
    />
  );

  if (variant === "inline") {
    return previewSurface;
  }

  return (
    <GameHoverTip title={resolvedTitle} style={{ width: 280, maxWidth: 280 }}>
      <span className="mb-1.5 block font-game-text text-[11px] text-zinc-400">
        {monsterName}
      </span>
      {previewSurface}
      <span className="flex flex-wrap items-center gap-2">
        <MoveMetricTokens move={move} ascensionLevel={ascensionLevel} />
        <MoveApplicationIcons move={move} serviceLocale={serviceLocale} ascensionLevel={ascensionLevel} />
      </span>
    </GameHoverTip>
  );
}

function MovePreviewSurface({
  move,
  monster,
  serviceLocale,
  selectedMoveNonce,
  ascensionLevel,
  setAscensionLevel,
  variant,
  hpOverride,
  initialPowerApplications,
  loopAnimation,
}: {
  move: MoveVisual;
  monster: CodexMonster;
  serviceLocale: ServiceLocale;
  selectedMoveNonce: number;
  ascensionLevel: number;
  setAscensionLevel: (level: number | ((current: number) => number)) => void;
  variant: "hover" | "inline";
  hpOverride: DamageValue | null;
  initialPowerApplications: readonly MonsterMovePowerApplication[];
  loopAnimation: boolean;
}) {
  const compact = variant === "inline";
  const surfaceClass = compact
    ? "relative mb-0 block h-44 w-full overflow-hidden rounded bg-black/10"
    : "relative mb-2 block h-56 overflow-hidden rounded bg-black/25";
  const gridRows = compact
    ? "grid-rows-[2rem_minmax(0,1fr)_1.35rem_1.5rem]"
    : "grid-rows-[2.75rem_minmax(0,1fr)_1.65rem_1.9rem]";

  return (
    <span className={surfaceClass}>
      <span className="absolute left-1 top-1 z-50">
        <MonsterAscensionStepper
          level={ascensionLevel}
          onChange={setAscensionLevel}
          serviceLocale={serviceLocale}
          compact={compact}
        />
      </span>
      <span className={`grid h-full w-full ${gridRows}`}>
        <MoveIntentPreview move={move} ascensionLevel={ascensionLevel} compact={compact} />
        <span className="relative min-h-0">
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
            loopSelectedMove={loopAnimation}
          />
        </span>
        <span className="relative z-40 flex items-center justify-center">
          <MonsterHealthBar
            monster={monster}
            ascensionLevel={ascensionLevel}
            hpOverride={hpOverride}
            compact={compact}
          />
        </span>
        <InitialPowerPreview
          applications={initialPowerApplications}
          serviceLocale={serviceLocale}
          ascensionLevel={ascensionLevel}
          compact={compact}
        />
      </span>
    </span>
  );
}

function InitialPowerPreview({
  applications,
  serviceLocale,
  ascensionLevel,
  compact,
}: {
  applications: readonly MonsterMovePowerApplication[];
  serviceLocale: ServiceLocale;
  ascensionLevel: number;
  compact: boolean;
}) {
  if (applications.length === 0) return null;

  return (
    <span
      className={`pointer-events-none relative z-40 flex h-full items-center justify-center gap-1 ${compact ? "px-1" : "px-2"}`}
      aria-label={serviceLocale === "ko" ? "시작 효과" : "Starting effects"}
    >
      {applications.map((power) => (
        <PowerApplicationIcon
          key={`initial-${power.powerId}-${power.target}`}
          power={power}
          serviceLocale={serviceLocale}
          added={false}
          interactive={false}
          ascensionLevel={ascensionLevel}
          compact={compact}
        />
      ))}
    </span>
  );
}

function MoveIntentPreview({
  move,
  ascensionLevel,
  compact,
}: {
  move: MoveVisual;
  ascensionLevel: number;
  compact: boolean;
}) {
  const intents = move.intents
    .map((intent, index) => ({ intent, kind: getIntentKind(intent.type), key: `${intent.type}-${index}` }))
    .filter((item) => item.kind !== "hidden");
  if (intents.length === 0) return null;

  return (
    <span
      className={`pointer-events-none relative z-40 flex h-full items-end justify-center gap-1 ${compact ? "pt-1" : "pt-2"}`}
    >
      {intents.map(({ intent, kind, key }) => (
        <span key={key} className={`relative inline-flex items-center justify-center ${compact ? "h-9 w-9" : "h-12 w-12"}`}>
          <Image
            src={getIntentIcon(kind, move, intent, ascensionLevel)}
            alt=""
            width={compact ? 36 : 48}
            height={compact ? 36 : 48}
            className={`${compact ? "h-8 w-8" : "h-11 w-11"} object-contain drop-shadow-[0_5px_6px_rgba(0,0,0,0.78)]`}
          />
          {getIntentLabel(kind, move, intent, ascensionLevel) && (
            <span
              className={`font-game-title absolute -bottom-0.5 left-1/2 -translate-x-1/2 font-black leading-none text-[#fff8db] ${compact ? "text-xs" : "text-base"}`}
              style={{ textShadow: "0 2px 0 #000, 0 0 4px #000, 1px 1px 0 #000" }}
            >
              {getIntentLabel(kind, move, intent, ascensionLevel)}
            </span>
          )}
        </span>
      ))}
    </span>
  );
}

function MoveMetricTokens({
  move,
  ascensionLevel,
  compact = false,
}: {
  move: MoveVisual;
  ascensionLevel: number;
  compact?: boolean;
}) {
  const attackIntent = move.intents.find((intent) => getIntentKind(intent.type) === "attack" || getIntentKind(intent.type) === "deathBlow") ?? null;
  return (
    <>
      {move.damage && (
        <MetricToken
          icon={getAttackIcon(move.damage, getRepeatInfo(attackIntent), ascensionLevel)}
          label={formatAttackLabel(move.damage, getRepeatInfo(attackIntent), ascensionLevel)}
          change={move.damageChange}
          compact={compact}
        />
      )}
      {move.block && (
        <MetricToken
          icon={BLOCK_ICON}
          label={formatEffectiveValue(move.block, ascensionLevel)}
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
  ascensionLevel,
  interactive = true,
}: {
  move: MoveVisual;
  serviceLocale: ServiceLocale;
  ascensionLevel: number;
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
          ascensionLevel={ascensionLevel}
          compact={false}
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
  ascensionLevel,
  compact,
}: {
  power: MonsterMovePowerApplication;
  serviceLocale: ServiceLocale;
  added: boolean;
  interactive: boolean;
  ascensionLevel: number;
  compact: boolean;
}) {
  const className = `relative inline-flex items-center justify-center rounded-sm outline-none transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-yellow-300/70 ${compact ? "h-5 w-5" : "h-6 w-6"}`;
  const title = serviceLocale === "ko" ? power.powerName : power.powerNameEn;
  const amount = getEffectiveDamageValue(power.amount, ascensionLevel);
  const content = (
    <>
      {power.imageUrl && (
        <Image
          src={power.imageUrl}
          alt=""
          width={compact ? 20 : 24}
          height={compact ? 20 : 24}
          className={`${compact ? "h-5 w-5" : "h-6 w-6"} object-contain`}
        />
      )}
      {amount != null && (
        <span className="pointer-events-none absolute -bottom-0.5 -right-1 rounded bg-black/75 px-0.5 text-[9px] font-bold tabular-nums text-zinc-100">
          {amount}
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
  label,
  change,
  compact = false,
}: {
  icon: string;
  label: string | null;
  change?: MoveChangeTone;
  compact?: boolean;
}) {
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
      <span>{label ?? "?"}</span>
      {change === "added" && <span className="text-[10px] font-black text-green-300">+</span>}
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

function getIntentIcon(
  kind: IntentKind,
  move: MoveVisual,
  intent: MonsterMoveIntentDetail,
  ascensionLevel: number,
): string {
  if (kind === "attack" || kind === "deathBlow") {
    return getAttackIcon(move.damage, getRepeatInfo(intent), ascensionLevel);
  }
  return ANIMATED_INTENT_ICONS[kind] ?? INTENT_ICONS[kind];
}

function getIntentLabel(
  kind: IntentKind,
  move: MoveVisual,
  intent: MonsterMoveIntentDetail,
  ascensionLevel: number,
): string | null {
  if (kind === "attack" || kind === "deathBlow") {
    return formatAttackLabel(move.damage, getRepeatInfo(intent), ascensionLevel);
  }
  if (kind === "defend") {
    return formatEffectiveValue(move.block, ascensionLevel);
  }
  if (kind === "statusCard") {
    return formatEffectiveValue(move.cards[0]?.amount ?? null, ascensionLevel);
  }
  return null;
}

function getRepeatInfo(intent: MonsterMoveIntentDetail | null): { value: DamageValue | null; multi: boolean } {
  if (!intent) return { value: null, multi: false };
  if (intent.repeat) return { value: intent.repeat, multi: intent.type === "MultiAttackIntent" };
  return { value: SINGLE_ATTACK_REPEAT, multi: intent.type === "MultiAttackIntent" };
}

function getAttackIcon(
  damage: DamageValue | null,
  repeat: { value: DamageValue | null; multi: boolean },
  ascensionLevel: number,
): string {
  const total = getAttackTotal(damage, repeat, ascensionLevel) ?? 10;
  if (total < 5) return "/images/sts2/intents/attack_1.png";
  if (total < 10) return "/images/sts2/intents/attack_2.png";
  if (total < 20) return "/images/sts2/intents/attack_3.png";
  if (total < 40) return "/images/sts2/intents/attack_4.png";
  return "/images/sts2/intents/attack_5.png";
}

function getAttackTotal(
  damage: DamageValue | null,
  repeat: { value: DamageValue | null; multi: boolean },
  ascensionLevel: number,
): number | null {
  const damageValue = getEffectiveDamageValue(damage, ascensionLevel, MONSTER_MOVE_ASCENSION_LEVEL);
  if (damageValue == null) return null;
  return damageValue * (getEffectiveDamageValue(repeat.value, ascensionLevel, MONSTER_MOVE_ASCENSION_LEVEL) ?? 1);
}

function formatAttackLabel(
  damage: DamageValue | null,
  repeat: { value: DamageValue | null; multi: boolean },
  ascensionLevel: number,
): string | null {
  const damageValue = getEffectiveDamageValue(damage, ascensionLevel, MONSTER_MOVE_ASCENSION_LEVEL);
  if (damageValue == null) return null;
  if (!repeat.multi) return String(damageValue);
  return `${damageValue}x${getEffectiveDamageValue(repeat.value, ascensionLevel, MONSTER_MOVE_ASCENSION_LEVEL) ?? "?"}`;
}

function formatEffectiveValue(value: DamageValue | null, ascensionLevel: number): string | null {
  const resolved = getEffectiveDamageValue(value, ascensionLevel, MONSTER_MOVE_ASCENSION_LEVEL);
  return resolved == null ? null : String(resolved);
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
