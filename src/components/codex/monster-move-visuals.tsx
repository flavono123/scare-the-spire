"use client";

import type { ReactNode } from "react";
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

interface MonsterAnimationPatchDiffBlockProps {
  monster: CodexMonster;
  serviceLocale: ServiceLocale;
  patchId?: string;
  variant?: "full" | "compact";
}

interface MonsterPatchDiffSequence {
  labelKo: string;
  labelEn: string;
  moves?: MoveVisual[];
  moveIds?: string[];
  hpOverride?: DamageValue | null;
  initialPowerApplications?: readonly MonsterMovePowerApplication[] | null;
  changes?: Record<string, Pick<MonsterMoveVisual, "damageChange" | "blockChange" | "powerChange">>;
}

interface MonsterPatchDiffSpec {
  titleKo: string;
  titleEn: string;
  summary: (serviceLocale: ServiceLocale) => ReactNode;
  before: MonsterPatchDiffSequence;
  after: MonsterPatchDiffSequence;
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
const DOUBLE_ATTACK_REPEAT: DamageValue = { normal: 2, ascension: null };
const TRIPLE_ATTACK_REPEAT: DamageValue = { normal: 3, ascension: null };

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

const OLD_AEONGLASS_MOVES: MoveVisual[] = [
  createMoveVisual({
    id: "EBB",
    name: "감쇠",
    nameEn: "Ebb",
    damage: { normal: 26, ascension: 32 },
    intents: [{ type: "SingleAttackIntent", damageKey: "Ebb", repeat: SINGLE_ATTACK_REPEAT }, { type: "DebuffIntent" }],
  }),
  createMoveVisual({
    id: "EYE_LASERS",
    name: "눈 레이저",
    nameEn: "Eye Lasers",
    damage: { normal: 11, ascension: 12 },
    intents: [{ type: "MultiAttackIntent", damageKey: "EyeLasers", repeat: DOUBLE_ATTACK_REPEAT }],
  }),
  createMoveVisual({
    id: "INCREASING_INTENSITY",
    name: "강도 증가",
    nameEn: "Increasing Intensity",
    intents: [{ type: "StatusIntent" }, { type: "BuffIntent" }],
  }),
];

const OLD_HAUNTED_SHIP_MOVES: MoveVisual[] = [
  createMoveVisual({
    id: "HAUNT",
    name: "출몰",
    nameEn: "Haunt",
    intents: [{ type: "DebuffIntent" }, { type: "StatusIntent" }],
    powers: [powerApplication("WEAK", "약화", "Weak", "Debuff", "player", { normal: 3, ascension: null })],
    cards: [cardApplication("DAZED", "어지러움", "Dazed", { normal: 5, ascension: null })],
  }),
  createMoveVisual({
    id: "RAMMING_SPEED",
    name: "전속력",
    nameEn: "Ramming Speed",
    damage: { normal: 10, ascension: 11 },
    intents: [{ type: "SingleAttackIntent", damageKey: "RammingSpeed", repeat: SINGLE_ATTACK_REPEAT }],
    damageChange: "removed",
  }),
  createMoveVisual({
    id: "SWIPE",
    name: "밀쳐내기",
    nameEn: "Swipe",
    damage: { normal: 13, ascension: 14 },
    intents: [{ type: "SingleAttackIntent", damageKey: "Swipe", repeat: SINGLE_ATTACK_REPEAT }],
  }),
  createMoveVisual({
    id: "STOMP",
    name: "발구르기",
    nameEn: "Stomp",
    damage: { normal: 4, ascension: 5 },
    intents: [{ type: "MultiAttackIntent", damageKey: "Stomp", repeat: TRIPLE_ATTACK_REPEAT }],
  }),
];

const OLD_PUNCH_CONSTRUCT_MOVES: MoveVisual[] = [
  createMoveVisual({
    id: "READY",
    name: "준비",
    nameEn: "Ready",
    intents: [{ type: "DefendIntent" }],
  }),
  createMoveVisual({
    id: "STRONG_PUNCH",
    name: "강한 펀치",
    nameEn: "Strong Punch",
    damage: { normal: 14, ascension: 16 },
    intents: [{ type: "SingleAttackIntent", damageKey: "StrongPunch", repeat: SINGLE_ATTACK_REPEAT }],
  }),
  createMoveVisual({
    id: "FAST_PUNCH",
    name: "빠른 펀치",
    nameEn: "Fast Punch",
    damage: { normal: 5, ascension: 6 },
    intents: [{ type: "MultiAttackIntent", damageKey: "FastPunch", repeat: DOUBLE_ATTACK_REPEAT }, { type: "DebuffIntent" }],
    powers: [powerApplication("WEAK", "약화", "Weak", "Debuff", "player", { normal: 1, ascension: null })],
  }),
];

const OLD_SKULKING_COLONY_HP: DamageValue = { normal: 70, ascension: 75 };
const OLD_SKULKING_COLONY_INITIAL_POWERS = [
  powerApplication("HARDENED_SHELL", "단단한 껍질", "Hardened Shell", "Buff", "self", { normal: 15, ascension: null }),
];
const OLD_SKULKING_COLONY_MOVES: MoveVisual[] = [
  createMoveVisual({
    id: "SMASH",
    name: "강타",
    nameEn: "Smash",
    damage: { normal: 12, ascension: 13 },
    intents: [{ type: "SingleAttackIntent", damageKey: "Smash", repeat: SINGLE_ATTACK_REPEAT }],
    damageChange: "removed",
  }),
  createMoveVisual({
    id: "ZOOM",
    name: "급가속",
    nameEn: "Zoom",
    damage: { normal: 14, ascension: 16 },
    intents: [{ type: "SingleAttackIntent", damageKey: "Zoom", repeat: SINGLE_ATTACK_REPEAT }],
  }),
  createMoveVisual({
    id: "INERTIA",
    name: "관성",
    nameEn: "Inertia",
    damage: { normal: 9, ascension: 11 },
    intents: [{ type: "SingleAttackIntent", damageKey: "Inertia", repeat: SINGLE_ATTACK_REPEAT }, { type: "BuffIntent" }],
    powers: [powerApplication("STRENGTH", "힘", "Strength", "Buff", "self", { normal: 2, ascension: 3 })],
  }),
  createMoveVisual({
    id: "PIERCING_STABS",
    name: "꿰뚫는 찌르기",
    nameEn: "Piercing Stabs",
    damage: { normal: 7, ascension: 8 },
    intents: [{ type: "MultiAttackIntent", damageKey: "PiercingStabs", repeat: DOUBLE_ATTACK_REPEAT }],
  }),
];

const MONSTER_PATCH_DIFFS: Record<string, Record<string, MonsterPatchDiffSpec>> = {
  "v0.106.0": {
    INFESTED_PRISM: {
      titleKo: "감염된 프리즘 리워크",
      titleEn: "Infested Prism Rework",
      summary: (serviceLocale) => serviceLocale === "ko"
        ? <>공격 피해가 낮아지고, 방출과 맥박에 방어가 붙었습니다. 맥박은 피해/방어와 <PatchDiffPowerLink powerId="VITAL_SPARK" serviceLocale={serviceLocale}>생명의 불꽃</PatchDiffPowerLink> 적용이 함께 보이는 행동입니다.</>
        : <>Attack damage is lower. Radiate and Pulsate now include Block, and Pulsate is shown with damage, Block, and <PatchDiffPowerLink powerId="VITAL_SPARK" serviceLocale={serviceLocale}>Vital Spark</PatchDiffPowerLink> application.</>,
      before: {
        labelKo: "이전",
        labelEn: "Before",
        moves: OLD_INFESTED_PRISM_MOVES,
        hpOverride: OLD_INFESTED_PRISM_HP,
        initialPowerApplications: [],
      },
      after: {
        labelKo: "이후",
        labelEn: "After",
        moveIds: INFESTED_PRISM_MOVE_ORDER,
      },
    },
    AEONGLASS: {
      titleKo: "영겁의 모래시계 행동 변화",
      titleEn: "Aeonglass Move Changes",
      summary: (serviceLocale) => serviceLocale === "ko"
        ? <>행동 패턴 조정과 함께 강도 증가에 방어/상태이상/버프 의도가 함께 드러납니다. <PatchDiffCardLink cardId="WITHER" serviceLocale={serviceLocale}>침체</PatchDiffCardLink>와 <PatchDiffPowerLink powerId="WITHERING_PRESENCE" serviceLocale={serviceLocale}>시들어가는 존재</PatchDiffPowerLink>는 별도 리워크 대상입니다.</>
        : <>The move pattern adjustment makes Increasing Intensity show defense, status, and buff intent together. <PatchDiffCardLink cardId="WITHER" serviceLocale={serviceLocale}>Wither</PatchDiffCardLink> and <PatchDiffPowerLink powerId="WITHERING_PRESENCE" serviceLocale={serviceLocale}>Withering Presence</PatchDiffPowerLink> are separate rework targets.</>,
      before: {
        labelKo: "이전",
        labelEn: "Before",
        moves: OLD_AEONGLASS_MOVES,
      },
      after: {
        labelKo: "이후",
        labelEn: "After",
        moveIds: ["EBB", "EYE_LASERS", "INCREASING_INTENSITY"],
        changes: {
          INCREASING_INTENSITY: { blockChange: "added", powerChange: "added" },
        },
      },
    },
    HAUNTED_SHIP: {
      titleKo: "유령선 행동 변화",
      titleEn: "Haunted Ship Move Changes",
      summary: (serviceLocale) => serviceLocale === "ko"
        ? <>전속력이 빠지고, 출몰 이후 밀쳐내기와 발구르기를 번갈아 쓰는 흐름으로 바뀝니다. 출몰 다음 첫 공격은 밀쳐내기입니다.</>
        : <>Ramming Speed is removed. After Haunt, the ship alternates Swipe and Stomp, starting with Swipe.</>,
      before: {
        labelKo: "이전",
        labelEn: "Before",
        moves: OLD_HAUNTED_SHIP_MOVES,
      },
      after: {
        labelKo: "이후",
        labelEn: "After",
        moveIds: ["HAUNT", "SWIPE", "STOMP"],
      },
    },
    PUNCH_CONSTRUCT: {
      titleKo: "권투형 구조체 행동 변화",
      titleEn: "Punch Construct Move Changes",
      summary: (serviceLocale) => serviceLocale === "ko"
        ? <>준비가 빠른 펀치로 이어지고, 빠른 펀치 다음에 강한 펀치가 옵니다. 빠른 펀치의 디버프는 약화에서 손상으로 바뀝니다.</>
        : <>Ready now leads into Fast Punch, and Fast Punch leads into Strong Punch. Fast Punch applies Frail instead of Weak.</>,
      before: {
        labelKo: "이전",
        labelEn: "Before",
        moves: OLD_PUNCH_CONSTRUCT_MOVES,
      },
      after: {
        labelKo: "이후",
        labelEn: "After",
        moveIds: ["READY", "FAST_PUNCH", "STRONG_PUNCH"],
        changes: {
          FAST_PUNCH: { powerChange: "added" },
        },
      },
    },
    SKULKING_COLONY: {
      titleKo: "잠행 군체 행동 변화",
      titleEn: "Skulking Colony Move Changes",
      summary: (serviceLocale) => serviceLocale === "ko"
        ? <>체력과 단단한 껍질 수치가 올라가고, 강타가 빠집니다. 전투 초반에는 급가속을 두 번 사용하며 더 이상 방어도를 얻지 않습니다.</>
        : <>HP and Hardened Shell increase, and Smash is removed. It now uses Zoom twice at the start and no longer gains Block.</>,
      before: {
        labelKo: "이전",
        labelEn: "Before",
        moves: OLD_SKULKING_COLONY_MOVES,
        hpOverride: OLD_SKULKING_COLONY_HP,
        initialPowerApplications: OLD_SKULKING_COLONY_INITIAL_POWERS,
      },
      after: {
        labelKo: "이후",
        labelEn: "After",
        moveIds: ["ZOOM", "ZOOM_MOVE_2", "INERTIA", "PIERCING_STABS"],
      },
    },
  },
};

export function MonsterAnimationPatchDiffBlock({
  monster,
  serviceLocale,
  patchId = "v0.106.0",
  variant = "full",
}: MonsterAnimationPatchDiffBlockProps) {
  const spec = getMonsterPatchDiffSpec(monster.id, patchId);
  if (!spec) return null;

  const compact = variant === "compact";
  const href = localizeHref(`/compendium/bestiary?monster=${monster.id.toLowerCase()}`, serviceLocale);
  const title = serviceLocale === "ko" ? spec.titleKo : spec.titleEn;

  return (
    <details className={compact ? "group mt-2" : "group my-4"} open>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-md border border-yellow-400/20 bg-black/30 px-3 py-2 marker:hidden">
        <span className="flex min-w-0 flex-col gap-1">
          <span className="font-game-title text-[11px] font-bold text-zinc-500">
            {serviceLocale === "ko" ? "애니메이션 패치 diff" : "Animation Patch Diff"}
          </span>
          <Link
            href={href}
            className="font-game-title text-sm font-bold text-yellow-300 underline decoration-yellow-500/30 underline-offset-2 hover:text-yellow-200"
            onClick={(event) => event.stopPropagation()}
          >
            {title}
          </Link>
        </span>
        <span className="shrink-0 text-xs text-zinc-500 transition-transform group-open:rotate-180">⌄</span>
      </summary>
      <div className={compact ? "mt-2" : "relative left-1/2 mt-2 w-[min(96vw,72rem)] -translate-x-1/2"}>
        <div className="rounded-lg border border-yellow-400/20 bg-black/25 p-3 shadow-[0_18px_45px_rgba(0,0,0,0.28)]">
          <p className="mb-3 font-game-text text-xs leading-relaxed text-zinc-400">
            {spec.summary(serviceLocale)}
          </p>

          <div className="space-y-3">
            <MoveSequenceRail
              sequence={spec.before}
              monster={monster}
              serviceLocale={serviceLocale}
              tone="before"
            />
            <MoveSequenceRail
              sequence={spec.after}
              monster={monster}
              serviceLocale={serviceLocale}
              tone="after"
            />
          </div>
        </div>
      </div>
    </details>
  );
}

export function InfestedPrismReworkBlock(props: Omit<MonsterAnimationPatchDiffBlockProps, "patchId">) {
  return <MonsterAnimationPatchDiffBlock {...props} patchId="v0.106.0" />;
}

export function hasMonsterAnimationPatchDiff(monsterId: string, patchId: string): boolean {
  return Boolean(getMonsterPatchDiffSpec(monsterId, patchId));
}

function getMonsterPatchDiffSpec(monsterId: string, patchId: string): MonsterPatchDiffSpec | null {
  return MONSTER_PATCH_DIFFS[normalizePatchId(patchId)]?.[monsterId.toUpperCase()] ?? null;
}

function normalizePatchId(patchId: string): string {
  return patchId.startsWith("v") ? patchId : `v${patchId}`;
}

function PatchDiffPowerLink({
  powerId,
  serviceLocale,
  children,
}: {
  powerId: string;
  serviceLocale: ServiceLocale;
  children: ReactNode;
}) {
  return (
    <Link
      href={localizeHref(`/compendium/powers?power=${powerId.toLowerCase()}`, serviceLocale)}
      className="font-bold text-yellow-300 underline decoration-yellow-500/30 underline-offset-2 hover:text-yellow-200"
    >
      {children}
    </Link>
  );
}

function PatchDiffCardLink({
  cardId,
  serviceLocale,
  children,
}: {
  cardId: string;
  serviceLocale: ServiceLocale;
  children: ReactNode;
}) {
  return (
    <Link
      href={localizeHref(`/compendium/cards?card=${cardId.toLowerCase()}`, serviceLocale)}
      className="font-bold text-yellow-300 underline decoration-yellow-500/30 underline-offset-2 hover:text-yellow-200"
    >
      {children}
    </Link>
  );
}

function MoveSequenceRail({
  sequence,
  monster,
  serviceLocale,
  tone,
}: {
  sequence: MonsterPatchDiffSequence;
  monster: CodexMonster;
  serviceLocale: ServiceLocale;
  tone: "before" | "after";
}) {
  const moves = buildSequenceMoves(monster, sequence);
  const label = serviceLocale === "ko" ? sequence.labelKo : sequence.labelEn;

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
              hpOverride={sequence.hpOverride}
              initialPowerApplications={sequence.initialPowerApplications}
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
          prominent
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
  if (intents.length === 0) {
    return <span className="pointer-events-none relative z-40 block h-full" aria-hidden="true" />;
  }

  return (
    <span
      className={`pointer-events-none relative z-40 flex h-full items-end justify-center ${compact ? "gap-0 pl-14 pr-1 pt-1" : "gap-0.5 pl-16 pr-2 pt-2"}`}
    >
      {intents.map(({ intent, kind, key }) => (
        <span key={key} className={`relative inline-flex items-center justify-center ${compact ? "h-8 w-8" : "h-11 w-11"}`}>
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

function buildSequenceMoves(monster: CodexMonster, sequence: MonsterPatchDiffSequence): MoveVisual[] {
  if (sequence.moves) return sequence.moves;
  if (!sequence.moveIds) return [];

  const moveById = new Map([...monster.bestiaryMoves, ...monster.moves].map((move) => [move.id, move]));
  return sequence.moveIds.flatMap((moveId) => {
    const move = moveById.get(moveId);
    if (!move) return [];
    const visual = buildMonsterMoveVisual(monster, move);
    const changes = sequence.changes?.[moveId];
    return [{
      ...visual,
      damageChange: changes?.damageChange ?? visual.damageChange,
      blockChange: changes?.blockChange ?? visual.blockChange,
      powerChange: changes?.powerChange ?? visual.powerChange,
    }];
  });
}

function createMoveVisual({
  id,
  name,
  nameEn,
  damage = null,
  block = null,
  intents = [],
  powers = [],
  cards = [],
  damageChange,
  blockChange,
  powerChange,
}: {
  id: string;
  name: string;
  nameEn: string;
  damage?: DamageValue | null;
  block?: DamageValue | null;
  intents?: MonsterMoveIntentDetail[];
  powers?: readonly MonsterMovePowerApplication[];
  cards?: readonly MonsterMoveCardApplication[];
  damageChange?: MoveChangeTone;
  blockChange?: MoveChangeTone;
  powerChange?: MoveChangeTone;
}): MoveVisual {
  return {
    id,
    name,
    nameEn,
    damage,
    block,
    intents,
    powers,
    cards,
    damageChange,
    blockChange,
    powerChange,
  };
}

function powerApplication(
  powerId: string,
  powerName: string,
  powerNameEn: string,
  powerType: MonsterMovePowerApplication["powerType"],
  target: MonsterMovePowerApplication["target"],
  amount: DamageValue | null,
): MonsterMovePowerApplication {
  return {
    powerId,
    powerName,
    powerNameEn,
    powerType,
    target,
    amount,
    imageUrl: `/images/sts2/powers/${powerId.toLowerCase()}_power.webp`,
  };
}

function cardApplication(
  cardId: string,
  cardName: string,
  cardNameEn: string,
  amount: DamageValue | null,
): MonsterMoveCardApplication {
  return {
    cardId,
    cardName,
    cardNameEn,
    amount,
    imageUrl: cardId === "WITHER" ? "/images/sts2/cards-beta/wither.webp" : `/images/sts2/cards/${cardId.toLowerCase()}.webp`,
  };
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
