"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
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
import { TinyCardIcon } from "@/components/history-course/card-action-icon";
import { DescriptionText } from "@/components/codex/codex-description";
import { TEXT_CREAM, TEXT_GREEN } from "@/lib/sts2-card-style";
import { resolveSts2EnergyIcon } from "@/lib/sts2-energy-icons";
import { GameHoverTip } from "./hover-tip";
import { bakePowerAmountDescription } from "./power-preview";
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
  animationId?: string;
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
  monsters?: readonly CodexMonster[];
  serviceLocale: ServiceLocale;
  patchId?: string;
  variant?: "full" | "compact";
  defaultOpen?: boolean;
}

interface MonsterPatchDiffSequence {
  labelKo: string;
  labelEn: string;
  monsterId?: string;
  moves?: MoveVisual[];
  moveIds?: string[];
  hpOverride?: DamageValue | null;
  initialPowerApplications?: readonly MonsterMovePowerApplication[] | null;
  effectNote?: (serviceLocale: ServiceLocale, ascensionLevel: number) => ReactNode;
  changes?: Record<string, Pick<MonsterMoveVisual, "animationId" | "damageChange" | "blockChange" | "powerChange">>;
}

interface MonsterPatchDiffSpec {
  titleKo: string;
  titleEn: string;
  summary: (serviceLocale: ServiceLocale, monster: CodexMonster, monsters: readonly CodexMonster[]) => ReactNode;
  before: MonsterPatchDiffSequence;
  after: MonsterPatchDiffSequence;
}

const INFESTED_PRISM_MOVE_ORDER = ["JAB", "RADIATE", "WHIRLWIND", "PULSATE"];
const ARROW_ICON = "/images/sts2/ui/settings_tiny_right_arrow.png";
const MOVE_PREVIEW_VIEWPORT_PADDING = { padTop: "0%", padBottom: "0%" } as const;
const OLD_INFESTED_PRISM_HP: DamageValue = { normal: 200, ascension: 215 };
const INFESTED_PRISM_VITAL_SPARK_AMOUNT: DamageValue = { normal: 2, ascension: 3 };
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
    animationId: "attack",
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
    animationId: "attack_block",
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
    animationId: "attack_double",
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
    animationId: "buff",
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

const AEONGLASS_V106_MOVES: MoveVisual[] = [
  createMoveVisual({
    id: "EBB",
    name: "감쇠",
    nameEn: "Ebb",
    damage: { normal: 26, ascension: 32 },
    intents: [{ type: "SingleAttackIntent", damageKey: "Ebb", repeat: SINGLE_ATTACK_REPEAT }, { type: "DebuffIntent" }],
    powers: [powerApplication("EBB", "감쇠", "Ebb", "Debuff", "player", { normal: 3, ascension: null })],
    powerChange: "removed",
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
    block: { normal: 33, ascension: null },
    intents: [{ type: "StatusIntent" }, { type: "BuffIntent" }, { type: "DefendIntent" }],
    powers: [powerApplication("STRENGTH", "힘", "Strength", "Buff", "self", null)],
    cards: [witherUpgradeApplication()],
    blockChange: "removed",
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
    animationId: "attack",
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
    animationId: "attack_heavy",
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

const OLD_DOORMAKER_V103_MOVES: MoveVisual[] = [
  createMoveVisual({
    id: "WHAT_IS_IT",
    name: "What Is It",
    nameEn: "What Is It",
    intents: [{ type: "BuffIntent" }],
  }),
  createMoveVisual({
    id: "BEAM",
    name: "Beam",
    nameEn: "Beam",
    animationId: "attack",
    damage: { normal: 31, ascension: 34 },
    intents: [{ type: "SingleAttackIntent", damageKey: "LaserBeam", repeat: SINGLE_ATTACK_REPEAT }],
    damageChange: "removed",
  }),
  createMoveVisual({
    id: "GET_BACK_IN",
    name: "Get Back In",
    nameEn: "Get Back In",
    animationId: "attack",
    damage: { normal: 40, ascension: 45 },
    intents: [{ type: "SingleAttackIntent", damageKey: "GetBackInMove", repeat: SINGLE_ATTACK_REPEAT }, { type: "DebuffIntent" }],
    damageChange: "removed",
    powerChange: "removed",
  }),
];

const CURRENT_DOORMAKER_MOVES: MoveVisual[] = [
  createMoveVisual({
    id: "DRAMATIC_OPEN",
    name: "극적인 개방",
    nameEn: "Dramatic Open",
    intents: [{ type: "BuffIntent" }],
  }),
  createMoveVisual({
    id: "HUNGER",
    name: "굶주림",
    nameEn: "Hunger",
    animationId: "attack",
    damage: { normal: 30, ascension: 35 },
    intents: [{ type: "SingleAttackIntent", damageKey: "Hunger", repeat: SINGLE_ATTACK_REPEAT }],
  }),
  createMoveVisual({
    id: "SCRUTINY",
    name: "감시",
    nameEn: "Scrutiny",
    animationId: "attack",
    damage: { normal: 24, ascension: 26 },
    intents: [{ type: "SingleAttackIntent", damageKey: "Scrutiny", repeat: SINGLE_ATTACK_REPEAT }],
  }),
  createMoveVisual({
    id: "GRASP",
    name: "움켜쥐기",
    nameEn: "Grasp",
    animationId: "attack",
    damage: { normal: 10, ascension: 11 },
    intents: [{ type: "SingleAttackIntent", damageKey: "Grasp", repeat: SINGLE_ATTACK_REPEAT }],
  }),
];

const OLD_AXEBOT_HP: DamageValue = { normal: 40, ascension: 42 };
const OLD_AXEBOT_MOVES: MoveVisual[] = [
  createMoveVisual({
    id: "BOOT_UP",
    name: "시동",
    nameEn: "Boot Up",
    block: { normal: 10, ascension: null },
    intents: [{ type: "DefendIntent" }, { type: "BuffIntent" }],
  }),
  createMoveVisual({
    id: "ONE_TWO",
    name: "좌우 연타",
    nameEn: "The One-Two",
    animationId: "attack_double",
    damage: { normal: 5, ascension: 6 },
    intents: [{ type: "MultiAttackIntent", damageKey: "OneTwo", repeat: DOUBLE_ATTACK_REPEAT }],
    damageChange: "removed",
  }),
  createMoveVisual({
    id: "SHARPEN",
    name: "도끼 갈기",
    nameEn: "Sharpen",
    intents: [{ type: "BuffIntent" }],
    powers: [powerApplication("STRENGTH", "힘", "Strength", "Buff", "self", null)],
    powerChange: "removed",
  }),
  createMoveVisual({
    id: "HAMMER_UPPERCUT",
    name: "망치 올려치기",
    nameEn: "Hammer Uppercut",
    animationId: "attack",
    damage: { normal: 8, ascension: 10 },
    intents: [{ type: "SingleAttackIntent", damageKey: "HammerUppercut", repeat: SINGLE_ATTACK_REPEAT }, { type: "DebuffIntent" }],
    powers: [
      powerApplication("WEAK", "약화", "Weak", "Debuff", "player", { normal: 2, ascension: null }),
      powerApplication("FRAIL", "손상", "Frail", "Debuff", "player", { normal: 2, ascension: null }),
    ],
    damageChange: "removed",
  }),
];

const MONSTER_PATCH_DIFFS: Record<string, Record<string, MonsterPatchDiffSpec>> = {
  "v0.103.0": {
    DOORMAKER: {
      titleKo: "문을 만드는 자 행동 재배치",
      titleEn: "Doormaker Move Rearrangement",
      summary: (serviceLocale, monster) => serviceLocale === "ko"
        ? <>이전 패턴의 <PatchDiffMoveLink move={OLD_DOORMAKER_V103_MOVES[1]} monster={monster} serviceLocale={serviceLocale}>Beam</PatchDiffMoveLink>과 <PatchDiffMoveLink move={OLD_DOORMAKER_V103_MOVES[2]} monster={monster} serviceLocale={serviceLocale}>Get Back In</PatchDiffMoveLink>이 빠지고, 네 행동으로 재배치되었습니다. 이후 패턴은 피해량이 낮아지고 <PatchDiffPlainKeyword>디버프</PatchDiffPlainKeyword> 의도가 제거됩니다.</>
        : <>The old <PatchDiffMoveLink move={OLD_DOORMAKER_V103_MOVES[1]} monster={monster} serviceLocale={serviceLocale}>Beam</PatchDiffMoveLink> and <PatchDiffMoveLink move={OLD_DOORMAKER_V103_MOVES[2]} monster={monster} serviceLocale={serviceLocale}>Get Back In</PatchDiffMoveLink> pattern is replaced by four rearranged moves. The new pattern lowers damage and removes <PatchDiffPlainKeyword>Debuff</PatchDiffPlainKeyword> intent.</>,
      before: {
        labelKo: "이전",
        labelEn: "Before",
        moves: OLD_DOORMAKER_V103_MOVES,
      },
      after: {
        labelKo: "이후",
        labelEn: "After",
        moves: CURRENT_DOORMAKER_MOVES,
        changes: {
          DRAMATIC_OPEN: { powerChange: "added" },
          HUNGER: { damageChange: "added" },
          SCRUTINY: { damageChange: "added" },
          GRASP: { damageChange: "added" },
        },
      },
    },
  },
  "v0.104.0": {
    AXEBOT: {
      titleKo: "로봇 친구들 전투 리워크",
      titleEn: "Axebots Encounter Rework",
      summary: (serviceLocale, monster) => serviceLocale === "ko"
        ? <>여러 약한 <PatchDiffMonsterLink monster={monster} serviceLocale={serviceLocale}>잘라봇</PatchDiffMonsterLink>이 나오는 전투에서, <PatchDiffPowerLink powerId="STOCK" serviceLocale={serviceLocale}>재고</PatchDiffPowerLink>를 가진 더 강한 단일 잘라봇 전투로 바뀌었습니다. 체력과 공격 피해가 크게 오르고, <PatchDiffMoveLink move={OLD_AXEBOT_MOVES[2]} monster={monster} serviceLocale={serviceLocale}>도끼 갈기</PatchDiffMoveLink> 행동은 사라집니다.</>
        : <>The fight changes from multiple weaker <PatchDiffMonsterLink monster={monster} serviceLocale={serviceLocale}>Axebots</PatchDiffMonsterLink> into a stronger single Axebot with <PatchDiffPowerLink powerId="STOCK" serviceLocale={serviceLocale}>Stock</PatchDiffPowerLink>. HP and attack damage increase, and <PatchDiffMoveLink move={OLD_AXEBOT_MOVES[2]} monster={monster} serviceLocale={serviceLocale}>Sharpen</PatchDiffMoveLink> is removed.</>,
      before: {
        labelKo: "이전",
        labelEn: "Before",
        moves: OLD_AXEBOT_MOVES,
        hpOverride: OLD_AXEBOT_HP,
        initialPowerApplications: [],
      },
      after: {
        labelKo: "이후",
        labelEn: "After",
        moveIds: ["HAMMER_UPPERCUT", "ONE_TWO", "BOOT_UP"],
        changes: {
          HAMMER_UPPERCUT: { animationId: "attack", damageChange: "added", powerChange: "added" },
          ONE_TWO: { animationId: "attack_double", damageChange: "added" },
          BOOT_UP: { blockChange: "added", powerChange: "added" },
        },
      },
    },
  },
  "v0.105.0": {
    DOORMAKER: {
      titleKo: "3막 보스 교체",
      titleEn: "Act 3 Boss Replacement",
      summary: (serviceLocale, monster, monsters) => {
        const aeonglass = findPatchDiffMonster(monsters, "AEONGLASS");
        return serviceLocale === "ko"
          ? <><PatchDiffMonsterLink monster={monster} serviceLocale={serviceLocale}>문을 만드는 자</PatchDiffMonsterLink>가 3막 보스 자리에서 빠지고, 새 보스 <PatchDiffMonsterLink monster={aeonglass} serviceLocale={serviceLocale}>영겁의 모래시계</PatchDiffMonsterLink>로 교체됩니다. 전투는 문을 만드는 자의 네 행동 루프에서 감쇠, 눈 레이저, 강도 증가로 이어지는 새 패턴으로 바뀝니다.</>
          : <><PatchDiffMonsterLink monster={monster} serviceLocale={serviceLocale}>Doormaker</PatchDiffMonsterLink> leaves the Act 3 boss slot and is replaced by the new boss <PatchDiffMonsterLink monster={aeonglass} serviceLocale={serviceLocale}>Aeonglass</PatchDiffMonsterLink>. The fight changes from the four-move Doormaker loop to the new Ebb, Eye Lasers, Increasing Intensity pattern.</>;
      },
      before: {
        labelKo: "이전",
        labelEn: "Before",
        moves: CURRENT_DOORMAKER_MOVES,
      },
      after: {
        labelKo: "이후",
        labelEn: "After",
        monsterId: "AEONGLASS",
        moveIds: ["EBB", "EYE_LASERS", "INCREASING_INTENSITY"],
      },
    },
  },
  "v0.106.0": {
    INFESTED_PRISM: {
      titleKo: "감염된 프리즘 리워크",
      titleEn: "Infested Prism Rework",
      summary: (serviceLocale, monster) => serviceLocale === "ko"
        ? <>이전 <PatchDiffPowerLink powerId="VITAL_SPARK" serviceLocale={serviceLocale} versionContext="before">생명의 불꽃</PatchDiffPowerLink>은 공격 피해를 처음 받을 때 에너지 1을 주는 효과였고, 이후에는 전투 시작 시 3이 붙은 뒤 <PatchDiffMoveLink move={getPatchDiffMoveVisual(monster, "PULSATE", OLD_INFESTED_PRISM_MOVES[3])} monster={monster} serviceLocale={serviceLocale}>맥박</PatchDiffMoveLink>에서 +3을 더 얻습니다. 공격 피해가 낮아지고, <PatchDiffMoveLink move={getPatchDiffMoveVisual(monster, "RADIATE", OLD_INFESTED_PRISM_MOVES[1])} monster={monster} serviceLocale={serviceLocale}>방출</PatchDiffMoveLink>과 맥박에 <PatchDiffPlainKeyword>방어</PatchDiffPlainKeyword>가 붙었습니다.</>
        : <>Old <PatchDiffPowerLink powerId="VITAL_SPARK" serviceLocale={serviceLocale} versionContext="before">Vital Spark</PatchDiffPowerLink> granted 1 Energy the first time it took Attack damage each turn. After the rework, it starts with 3 and gains +3 more on <PatchDiffMoveLink move={getPatchDiffMoveVisual(monster, "PULSATE", OLD_INFESTED_PRISM_MOVES[3])} monster={monster} serviceLocale={serviceLocale}>Pulsate</PatchDiffMoveLink>. Attack damage is lower, and <PatchDiffMoveLink move={getPatchDiffMoveVisual(monster, "RADIATE", OLD_INFESTED_PRISM_MOVES[1])} monster={monster} serviceLocale={serviceLocale}>Radiate</PatchDiffMoveLink> and Pulsate now include <PatchDiffPlainKeyword>Block</PatchDiffPlainKeyword>.</>,
      before: {
        labelKo: "이전",
        labelEn: "Before",
        moves: OLD_INFESTED_PRISM_MOVES,
        hpOverride: OLD_INFESTED_PRISM_HP,
        initialPowerApplications: [],
        effectNote: (locale) => <VitalSparkPreviousEffectNote serviceLocale={locale} />,
      },
      after: {
        labelKo: "이후",
        labelEn: "After",
        moveIds: INFESTED_PRISM_MOVE_ORDER,
        effectNote: (locale, ascensionLevel) => <VitalSparkCurrentEffectNote serviceLocale={locale} ascensionLevel={ascensionLevel} />,
        changes: {
          JAB: { animationId: "attack" },
          RADIATE: { animationId: "attack_block" },
          WHIRLWIND: { animationId: "attack_double" },
          PULSATE: { animationId: "buff", powerChange: "added" },
        },
      },
    },
    AEONGLASS: {
      titleKo: "영겁의 모래시계 행동 변화",
      titleEn: "Aeonglass Move Changes",
      summary: (serviceLocale, monster) => serviceLocale === "ko"
        ? <>행동 패턴 조정과 함께 <PatchDiffMoveLink move={getPatchDiffMoveVisual(monster, "INCREASING_INTENSITY", OLD_AEONGLASS_MOVES[2])} monster={monster} serviceLocale={serviceLocale}>강도 증가</PatchDiffMoveLink>에 방어/상태이상/버프 의도가 함께 드러납니다. <PatchDiffCardLink cardId="WITHER" serviceLocale={serviceLocale}>침체</PatchDiffCardLink>와 <PatchDiffPowerLink powerId="WITHERING_PRESENCE" serviceLocale={serviceLocale}>시들어가는 존재</PatchDiffPowerLink>는 별도 리워크 대상입니다.</>
        : <>The move pattern adjustment makes <PatchDiffMoveLink move={getPatchDiffMoveVisual(monster, "INCREASING_INTENSITY", OLD_AEONGLASS_MOVES[2])} monster={monster} serviceLocale={serviceLocale}>Increasing Intensity</PatchDiffMoveLink> show defense, status, and buff intent together. <PatchDiffCardLink cardId="WITHER" serviceLocale={serviceLocale}>Wither</PatchDiffCardLink> and <PatchDiffPowerLink powerId="WITHERING_PRESENCE" serviceLocale={serviceLocale}>Withering Presence</PatchDiffPowerLink> are separate rework targets.</>,
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
      summary: (serviceLocale, monster) => serviceLocale === "ko"
        ? <><PatchDiffMoveLink move={OLD_HAUNTED_SHIP_MOVES[1]} monster={monster} serviceLocale={serviceLocale}>전속력</PatchDiffMoveLink>이 빠지고, <PatchDiffMoveLink move={getPatchDiffMoveVisual(monster, "HAUNT", OLD_HAUNTED_SHIP_MOVES[0])} monster={monster} serviceLocale={serviceLocale}>출몰</PatchDiffMoveLink> 이후 <PatchDiffMoveLink move={getPatchDiffMoveVisual(monster, "SWIPE", OLD_HAUNTED_SHIP_MOVES[2])} monster={monster} serviceLocale={serviceLocale}>밀쳐내기</PatchDiffMoveLink>와 <PatchDiffMoveLink move={getPatchDiffMoveVisual(monster, "STOMP", OLD_HAUNTED_SHIP_MOVES[3])} monster={monster} serviceLocale={serviceLocale}>발구르기</PatchDiffMoveLink>를 번갈아 쓰는 흐름으로 바뀝니다. 출몰 다음 첫 공격은 밀쳐내기입니다.</>
        : <><PatchDiffMoveLink move={OLD_HAUNTED_SHIP_MOVES[1]} monster={monster} serviceLocale={serviceLocale}>Ramming Speed</PatchDiffMoveLink> is removed. After <PatchDiffMoveLink move={getPatchDiffMoveVisual(monster, "HAUNT", OLD_HAUNTED_SHIP_MOVES[0])} monster={monster} serviceLocale={serviceLocale}>Haunt</PatchDiffMoveLink>, the ship alternates <PatchDiffMoveLink move={getPatchDiffMoveVisual(monster, "SWIPE", OLD_HAUNTED_SHIP_MOVES[2])} monster={monster} serviceLocale={serviceLocale}>Swipe</PatchDiffMoveLink> and <PatchDiffMoveLink move={getPatchDiffMoveVisual(monster, "STOMP", OLD_HAUNTED_SHIP_MOVES[3])} monster={monster} serviceLocale={serviceLocale}>Stomp</PatchDiffMoveLink>, starting with Swipe.</>,
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
      summary: (serviceLocale, monster) => serviceLocale === "ko"
        ? <><PatchDiffMoveLink move={getPatchDiffMoveVisual(monster, "READY", OLD_PUNCH_CONSTRUCT_MOVES[0])} monster={monster} serviceLocale={serviceLocale}>준비</PatchDiffMoveLink>가 <PatchDiffMoveLink move={getPatchDiffMoveVisual(monster, "FAST_PUNCH", OLD_PUNCH_CONSTRUCT_MOVES[2])} monster={monster} serviceLocale={serviceLocale}>빠른 펀치</PatchDiffMoveLink>로 이어지고, 빠른 펀치 다음에 <PatchDiffMoveLink move={getPatchDiffMoveVisual(monster, "STRONG_PUNCH", OLD_PUNCH_CONSTRUCT_MOVES[1])} monster={monster} serviceLocale={serviceLocale}>강한 펀치</PatchDiffMoveLink>가 옵니다. 빠른 펀치의 디버프는 <PatchDiffPowerLink powerId="WEAK" serviceLocale={serviceLocale}>약화</PatchDiffPowerLink>에서 <PatchDiffPowerLink powerId="FRAIL" serviceLocale={serviceLocale}>손상</PatchDiffPowerLink>으로 바뀝니다.</>
        : <><PatchDiffMoveLink move={getPatchDiffMoveVisual(monster, "READY", OLD_PUNCH_CONSTRUCT_MOVES[0])} monster={monster} serviceLocale={serviceLocale}>Ready</PatchDiffMoveLink> now leads into <PatchDiffMoveLink move={getPatchDiffMoveVisual(monster, "FAST_PUNCH", OLD_PUNCH_CONSTRUCT_MOVES[2])} monster={monster} serviceLocale={serviceLocale}>Fast Punch</PatchDiffMoveLink>, and Fast Punch leads into <PatchDiffMoveLink move={getPatchDiffMoveVisual(monster, "STRONG_PUNCH", OLD_PUNCH_CONSTRUCT_MOVES[1])} monster={monster} serviceLocale={serviceLocale}>Strong Punch</PatchDiffMoveLink>. Fast Punch applies <PatchDiffPowerLink powerId="FRAIL" serviceLocale={serviceLocale}>Frail</PatchDiffPowerLink> instead of <PatchDiffPowerLink powerId="WEAK" serviceLocale={serviceLocale}>Weak</PatchDiffPowerLink>.</>,
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
      summary: (serviceLocale, monster) => serviceLocale === "ko"
        ? <>체력과 <PatchDiffPowerLink powerId="HARDENED_SHELL" serviceLocale={serviceLocale}>단단한 껍질</PatchDiffPowerLink> 수치가 올라가고, <PatchDiffMoveLink move={OLD_SKULKING_COLONY_MOVES[0]} monster={monster} serviceLocale={serviceLocale}>강타</PatchDiffMoveLink>가 빠집니다. 전투 초반에는 <PatchDiffMoveLink move={getPatchDiffMoveVisual(monster, "ZOOM", OLD_SKULKING_COLONY_MOVES[1])} monster={monster} serviceLocale={serviceLocale}>급가속</PatchDiffMoveLink>을 두 번 사용하며 더 이상 <PatchDiffPlainKeyword>방어도</PatchDiffPlainKeyword>를 얻지 않습니다.</>
        : <>HP and <PatchDiffPowerLink powerId="HARDENED_SHELL" serviceLocale={serviceLocale}>Hardened Shell</PatchDiffPowerLink> increase, and <PatchDiffMoveLink move={OLD_SKULKING_COLONY_MOVES[0]} monster={monster} serviceLocale={serviceLocale}>Smash</PatchDiffMoveLink> is removed. It now uses <PatchDiffMoveLink move={getPatchDiffMoveVisual(monster, "ZOOM", OLD_SKULKING_COLONY_MOVES[1])} monster={monster} serviceLocale={serviceLocale}>Zoom</PatchDiffMoveLink> twice at the start and no longer gains <PatchDiffPlainKeyword>Block</PatchDiffPlainKeyword>.</>,
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
  "v0.107.0": {
    AEONGLASS: {
      titleKo: "영겁의 모래시계 감쇠 재배치",
      titleEn: "Aeonglass Ebb Reassignment",
      summary: (serviceLocale, monster) => serviceLocale === "ko"
        ? <><PatchDiffMoveLink move={AEONGLASS_V106_MOVES[0]} monster={monster} serviceLocale={serviceLocale}>감쇠</PatchDiffMoveLink>에서 <PatchDiffPowerLink powerId="EBB" serviceLocale={serviceLocale}>감쇠</PatchDiffPowerLink> 디버프가 빠지고, 대신 <PatchDiffPlainKeyword>방어도</PatchDiffPlainKeyword>가 붙습니다. <PatchDiffMoveLink move={AEONGLASS_V106_MOVES[2]} monster={monster} serviceLocale={serviceLocale}>강도 증가</PatchDiffMoveLink>는 더 이상 방어 행동이 아니고, 힘과 침체 강화만 남습니다.</>
        : <><PatchDiffMoveLink move={AEONGLASS_V106_MOVES[0]} monster={monster} serviceLocale={serviceLocale}>Ebb</PatchDiffMoveLink> no longer applies the <PatchDiffPowerLink powerId="EBB" serviceLocale={serviceLocale}>Ebb</PatchDiffPowerLink> debuff and now gains <PatchDiffPlainKeyword>Block</PatchDiffPlainKeyword> instead. <PatchDiffMoveLink move={AEONGLASS_V106_MOVES[2]} monster={monster} serviceLocale={serviceLocale}>Increasing Intensity</PatchDiffMoveLink> is no longer a defensive move, keeping only Strength and Wither upgrade pressure.</>,
      before: {
        labelKo: "이전",
        labelEn: "Before",
        moves: AEONGLASS_V106_MOVES,
      },
      after: {
        labelKo: "이후",
        labelEn: "After",
        moveIds: ["EBB", "EYE_LASERS", "INCREASING_INTENSITY"],
        changes: {
          EBB: { blockChange: "added" },
          INCREASING_INTENSITY: { blockChange: "removed" },
        },
      },
    },
  },
};

export function MonsterAnimationPatchDiffBlock({
  monster,
  monsters = [],
  serviceLocale,
  patchId = "v0.106.0",
  variant = "full",
  defaultOpen = true,
}: MonsterAnimationPatchDiffBlockProps) {
  const spec = getMonsterPatchDiffSpec(monster.id, patchId);
  if (!spec) return null;

  const compact = variant === "compact";
  const title = serviceLocale === "ko" ? spec.titleKo : spec.titleEn;

  return (
    <details className={compact ? "group mt-2" : "group my-4"} open={defaultOpen}>
      <summary className="inline-flex cursor-pointer list-none items-center gap-2 text-sm text-blue-400 transition-colors marker:hidden hover:text-blue-300">
        <span className="font-game-title font-bold">
          {title}
        </span>
        <span className="shrink-0 text-xs transition-transform group-open:rotate-180">⌄</span>
      </summary>
      <div className="mt-2">
        <div>
          <p className="mb-3 font-game-text text-xs leading-relaxed text-zinc-400">
            {spec.summary(serviceLocale, monster, monsters)}
          </p>

          <div className={compact ? "space-y-3" : "relative left-1/2 w-[min(96vw,72rem)] -translate-x-1/2 space-y-3"}>
            <MoveSequenceRail
              sequence={spec.before}
              monster={monster}
              monsters={monsters}
              serviceLocale={serviceLocale}
              tone="before"
              bleed={!compact}
            />
            <MoveSequenceRail
              sequence={spec.after}
              monster={monster}
              monsters={monsters}
              serviceLocale={serviceLocale}
              tone="after"
              bleed={!compact}
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

function findPatchDiffMonster(monsters: readonly CodexMonster[], monsterId: string): CodexMonster | null {
  return monsters.find((monster) => monster.id === monsterId) ?? null;
}

function getSequenceMonster(
  sequence: MonsterPatchDiffSequence,
  fallbackMonster: CodexMonster,
  monsters: readonly CodexMonster[],
): CodexMonster {
  if (!sequence.monsterId) return fallbackMonster;
  return findPatchDiffMonster(monsters, sequence.monsterId) ?? fallbackMonster;
}

type PatchDiffPowerVersionContext = "before" | "after";

interface PatchDiffPowerPreviewData {
  nameKo: string;
  nameEn: string;
  imageUrl: string;
  type: "buff" | "debuff" | "default";
  descriptionKo: string;
  descriptionEn: string;
  descriptionRawKo?: string;
  descriptionRawEn?: string;
  vars?: Record<string, number | string>;
  beforeDescriptionKo?: string;
  beforeDescriptionEn?: string;
}

const PATCH_DIFF_POWERS: Record<string, PatchDiffPowerPreviewData> = {
  FRAIL: {
    nameKo: "손상",
    nameEn: "Frail",
    imageUrl: "/images/sts2/powers/frail_power.webp",
    type: "debuff",
    descriptionKo: "손상 상태인 동안, 카드를 통해 얻는 [gold]방어도[/gold]가 [blue]25%[/blue] 감소합니다.",
    descriptionEn: "While Frail, gain [blue]25%[/blue] less [gold]Block[/gold] from cards.",
  },
  HARDENED_SHELL: {
    nameKo: "단단한 껍질",
    nameEn: "Hardened Shell",
    imageUrl: "/images/sts2/powers/hardened_shell_power.webp",
    type: "buff",
    descriptionKo: "이 생물은 한 턴에 체력을 [blue]20[/blue] 이상 잃을 수 없습니다.",
    descriptionEn: "This creature cannot lose more than [blue]20[/blue] HP each turn.",
  },
  STOCK: {
    nameKo: "재고",
    nameEn: "Stock",
    imageUrl: "/images/sts2/powers/stock_power.webp",
    type: "buff",
    descriptionKo: "사망 시, 그 장소에 새로운 잘라봇을 소환합니다.",
    descriptionEn: "When killed, a new Axebot is summoned in its place.",
  },
  STRENGTH: {
    nameKo: "힘",
    nameEn: "Strength",
    imageUrl: "/images/sts2/powers/strength_power.webp",
    type: "buff",
    descriptionKo: "힘은 공격 카드의 피해량을 증가시킵니다.",
    descriptionEn: "Strength adds additional damage to Attacks.",
  },
  VITAL_SPARK: {
    nameKo: "생명의 불꽃",
    nameEn: "Vital Spark",
    imageUrl: "/images/sts2/powers/vital_spark_power.webp",
    type: "buff",
    descriptionKo: "모든 [gold]스킬[/gold] 카드에 [gold]훼손됨[/gold]이 [blue]2[/blue] 추가됩니다.",
    descriptionEn: "ALL [gold]Skills[/gold] are [gold]Tainted[/gold] [blue]2[/blue].",
    descriptionRawKo: "모든 [gold]스킬[/gold] 카드에 [gold]훼손됨[/gold]이 [blue]{Amount}[/blue] 추가됩니다.",
    descriptionRawEn: "ALL [gold]Skills[/gold] are [gold]Tainted[/gold] [blue]{Amount}[/blue].",
    vars: { Amount: 2 },
    beforeDescriptionKo: "이 적이 매 턴마다 처음으로 공격 피해를 받을 시, 공격자가 [gold]에너지[/gold]를 [blue]1[/blue] 얻습니다.",
    beforeDescriptionEn: "The first time this enemy takes Attack damage each turn, the attacker gains [blue]1[/blue] [gold]Energy[/gold].",
  },
  WEAK: {
    nameKo: "약화",
    nameEn: "Weak",
    imageUrl: "/images/sts2/powers/weak_power.webp",
    type: "debuff",
    descriptionKo: "약화 상태인 생물의 공격은 가하는 피해량이 [blue]25%[/blue] 감소합니다.",
    descriptionEn: "Weakened creatures deal [blue]25%[/blue] less damage with Attacks.",
  },
  WITHERING_PRESENCE: {
    nameKo: "시들어가는 존재",
    nameEn: "Withering Presence",
    imageUrl: "/images/sts2/powers/withering_presence_power.webp",
    type: "buff",
    descriptionKo: "카드를 [blue]6[/blue]장 사용할 때마다, [gold]침체[/gold]를 1장 [gold]손[/gold]으로 가져옵니다.",
    descriptionEn: "Every [blue]6[/blue] cards you play, add a [gold]Wither[/gold] to your [gold]Hand[/gold].",
  },
};

const PATCH_DIFF_CARDS: Record<string, { nameKo: string; nameEn: string; imageUrl: string; typeKo: string; typeEn: string }> = {
  WITHER: { nameKo: "침체", nameEn: "Wither", imageUrl: "/images/sts2/cards-beta/wither.webp", typeKo: "상태이상", typeEn: "Status" },
};

function getPatchDiffMoveVisual(monster: CodexMonster, moveId: string, fallback?: MoveVisual): MoveVisual | null {
  const move = [...monster.bestiaryMoves, ...monster.moves].find((candidate) => candidate.id === moveId);
  return move ? buildMonsterMoveVisual(monster, move) : fallback ?? null;
}

function PatchDiffInlinePreview({
  href,
  children,
  preview,
}: {
  href: string;
  children: ReactNode;
  preview: (nonce: number) => ReactNode;
}) {
  const [show, setShow] = useState(false);
  const [previewNonce, setPreviewNonce] = useState(0);

  return (
    <span
      className="relative inline"
      onMouseEnter={() => {
        setPreviewNonce((value) => value + 1);
        setShow(true);
      }}
      onMouseLeave={() => setShow(false)}
      onFocus={() => {
        setPreviewNonce((value) => value + 1);
        setShow(true);
      }}
      onBlur={() => setShow(false)}
    >
      <Link
        href={href}
        className="font-game-title font-semibold spire-gold underline decoration-yellow-500/30 underline-offset-2 transition-colors hover:text-yellow-300"
      >
        {children}
      </Link>
      {show && (
        <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2">
          {preview(previewNonce)}
        </span>
      )}
    </span>
  );
}

function PatchDiffPlainKeyword({ children }: { children: ReactNode }) {
  return <span className="font-game-title font-semibold spire-gold">{children}</span>;
}

function PatchDiffMonsterLink({
  monster,
  serviceLocale,
  children,
}: {
  monster: CodexMonster | null;
  serviceLocale: ServiceLocale;
  children: ReactNode;
}) {
  if (!monster) return <PatchDiffPlainKeyword>{children}</PatchDiffPlainKeyword>;

  const title = serviceLocale === "ko" ? monster.name : monster.nameEn;
  const imageUrl = monster.bossImageUrl ?? monster.imageUrl;
  const hp = formatMonsterHpLabel(monster);
  const moveNames = monster.bestiaryMoves.length > 0
    ? monster.bestiaryMoves
      .filter((move) => !["NOTHING", "SPAWNED", "DEAD"].includes(move.id))
      .slice(0, 4)
      .map((move) => serviceLocale === "ko" ? move.name : move.nameEn)
      .join(", ")
    : null;

  return (
    <PatchDiffInlinePreview
      href={localizeHref(`/compendium/bestiary?monster=${monster.id.toLowerCase()}`, serviceLocale)}
      preview={() => (
        <GameHoverTip title={title} style={{ minWidth: 260, maxWidth: 340 }}>
          <span className="flex items-start gap-2.5">
            {imageUrl && (
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded bg-black/20">
                <Image src={imageUrl} alt="" width={64} height={64} className="h-14 w-14 object-contain" />
              </span>
            )}
            <span className="flex min-w-0 flex-col gap-1 font-game-text text-xs text-zinc-300">
              {hp && <span className="font-game-title spire-gold">HP {hp}</span>}
              {moveNames && <span>{moveNames}</span>}
            </span>
          </span>
        </GameHoverTip>
      )}
    >
      {children}
    </PatchDiffInlinePreview>
  );
}

function formatMonsterHpLabel(monster: CodexMonster): string | null {
  if (monster.minHp == null || monster.minHp === 9999) return null;
  const normal = monster.maxHp && monster.maxHp !== monster.minHp
    ? `${monster.minHp}-${monster.maxHp}`
    : `${monster.minHp}`;
  const ascension = monster.minHpAscension != null
    ? monster.maxHpAscension && monster.maxHpAscension !== monster.minHpAscension
      ? `${monster.minHpAscension}-${monster.maxHpAscension}`
      : `${monster.minHpAscension}`
    : null;
  return ascension ? `${normal} (${ascension})` : normal;
}

function InlineEnergyIcon({ amount = 1 }: { amount?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 align-middle">
      {Array.from({ length: amount }).map((_, index) => (
        <Image
          key={`energy-${index}`}
          src={resolveSts2EnergyIcon("colorless")}
          alt=""
          width={14}
          height={14}
          className="h-3.5 w-3.5 object-contain"
        />
      ))}
    </span>
  );
}

function VitalSparkPreviousEffectNote({ serviceLocale }: { serviceLocale: ServiceLocale }) {
  return (
    <>
      <PatchDiffPowerLink powerId="VITAL_SPARK" serviceLocale={serviceLocale} versionContext="before">
        {serviceLocale === "ko" ? "생명의 불꽃" : "Vital Spark"}
      </PatchDiffPowerLink>
      <span className="text-zinc-500">:</span>
      {serviceLocale === "ko" ? (
        <span>공격 피해를 처음 받으면 <InlineEnergyIcon /> 1</span>
      ) : (
        <span>first Attack damage taken grants <InlineEnergyIcon /> 1</span>
      )}
    </>
  );
}

function VitalSparkCurrentEffectNote({
  serviceLocale,
  ascensionLevel,
}: {
  serviceLocale: ServiceLocale;
  ascensionLevel: number;
}) {
  const amount = getEffectiveDamageValue(INFESTED_PRISM_VITAL_SPARK_AMOUNT, ascensionLevel, MONSTER_MOVE_ASCENSION_LEVEL) ?? 2;

  return (
    <>
      <PatchDiffPowerLink
        powerId="VITAL_SPARK"
        serviceLocale={serviceLocale}
        versionContext="after"
        amount={INFESTED_PRISM_VITAL_SPARK_AMOUNT}
      >
        {serviceLocale === "ko" ? "생명의 불꽃" : "Vital Spark"}
      </PatchDiffPowerLink>
      <span className="text-zinc-500">:</span>
      {serviceLocale === "ko" ? (
        <span>전투 시작 {amount}, 맥박에서 +{amount}</span>
      ) : (
        <span>starts at {amount}, Pulsate adds +{amount}</span>
      )}
    </>
  );
}

function PatchDiffPowerLink({
  powerId,
  serviceLocale,
  versionContext = "after",
  amount = null,
  children,
}: {
  powerId: string;
  serviceLocale: ServiceLocale;
  versionContext?: PatchDiffPowerVersionContext;
  amount?: DamageValue | null;
  children: ReactNode;
}) {
  const [ascensionLevel] = useMonsterAscensionLevel();
  const power = PATCH_DIFF_POWERS[powerId] ?? null;
  const title = power ? (serviceLocale === "ko" ? power.nameKo : power.nameEn) : String(children);
  const description = power
    ? getPatchDiffPowerDescription(power, serviceLocale, versionContext, amount, ascensionLevel)
    : null;

  return (
    <PatchDiffInlinePreview
      href={localizeHref(`/compendium/powers?power=${powerId.toLowerCase()}`, serviceLocale)}
      preview={() => (
        <GameHoverTip
          title={title}
          variant={power?.type === "buff" ? "buff" : power?.type === "debuff" ? "debuff" : "default"}
          style={{ minWidth: 240, maxWidth: 320 }}
        >
          <span className="flex items-start gap-2.5">
            {power?.imageUrl && (
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-black/20">
                <Image src={power.imageUrl} alt="" width={36} height={36} className="h-9 w-9 object-contain" />
              </span>
            )}
            {description ? (
              <DescriptionText description={description} />
            ) : (
              <span className="font-game-title spire-gold">{title}</span>
            )}
          </span>
        </GameHoverTip>
      )}
    >
      {children}
    </PatchDiffInlinePreview>
  );
}

function getPatchDiffPowerDescription(
  power: PatchDiffPowerPreviewData,
  serviceLocale: ServiceLocale,
  versionContext: PatchDiffPowerVersionContext,
  amount: DamageValue | null,
  ascensionLevel: number,
): string {
  if (versionContext === "before") {
    return serviceLocale === "ko"
      ? power.beforeDescriptionKo ?? power.descriptionKo
      : power.beforeDescriptionEn ?? power.descriptionEn;
  }

  const raw = serviceLocale === "ko" ? power.descriptionRawKo : power.descriptionRawEn;
  if (!raw) return serviceLocale === "ko" ? power.descriptionKo : power.descriptionEn;

  return bakePowerAmountDescription(raw, power.vars, amount, ascensionLevel, MONSTER_MOVE_ASCENSION_LEVEL)
    ?? (serviceLocale === "ko" ? power.descriptionKo : power.descriptionEn);
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
  const card = PATCH_DIFF_CARDS[cardId] ?? null;
  const title = card ? (serviceLocale === "ko" ? card.nameKo : card.nameEn) : String(children);
  const type = card ? (serviceLocale === "ko" ? card.typeKo : card.typeEn) : null;

  return (
    <PatchDiffInlinePreview
      href={localizeHref(`/compendium/cards?card=${cardId.toLowerCase()}`, serviceLocale)}
      preview={() => (
        <GameHoverTip title={title} style={{ minWidth: 220, maxWidth: 280 }}>
          {card?.imageUrl && (
            <span className="flex items-center gap-2">
              <Image src={card.imageUrl} alt="" width={42} height={42} className="h-11 w-11 rounded object-cover" />
              {type && <span className="font-game-title spire-gold">{type}</span>}
            </span>
          )}
        </GameHoverTip>
      )}
    >
      {children}
    </PatchDiffInlinePreview>
  );
}

function PatchDiffMoveLink({
  move,
  monster,
  serviceLocale,
  children,
}: {
  move: MoveVisual | null;
  monster: CodexMonster;
  serviceLocale: ServiceLocale;
  children: ReactNode;
}) {
  if (!move) return <PatchDiffPlainKeyword>{children}</PatchDiffPlainKeyword>;

  return (
    <PatchDiffInlinePreview
      href={localizeHref(`/compendium/bestiary?monster=${monster.id.toLowerCase()}`, serviceLocale)}
      preview={(nonce) => (
        <MonsterMoveHoverPreview
          move={move}
          monster={monster}
          serviceLocale={serviceLocale}
          selectedMoveNonce={nonce}
          title={serviceLocale === "ko" ? move.name : move.nameEn}
          loopAnimation
        />
      )}
    >
      {children}
    </PatchDiffInlinePreview>
  );
}

function MoveSequenceRail({
  sequence,
  monster,
  monsters,
  serviceLocale,
  tone,
  bleed = false,
}: {
  sequence: MonsterPatchDiffSequence;
  monster: CodexMonster;
  monsters: readonly CodexMonster[];
  serviceLocale: ServiceLocale;
  tone: "before" | "after";
  bleed?: boolean;
}) {
  const [ascensionLevel] = useMonsterAscensionLevel();
  const sequenceMonster = getSequenceMonster(sequence, monster, monsters);
  const moves = buildSequenceMoves(sequenceMonster, sequence);
  const label = serviceLocale === "ko" ? sequence.labelKo : sequence.labelEn;
  const effectNote = sequence.effectNote?.(serviceLocale, ascensionLevel);
  const labelClass = `font-game-title text-xs font-bold ${tone === "after" ? "text-green-300" : "text-red-300"}`;

  return (
    <div className={bleed ? "relative grid gap-2 sm:block" : "grid gap-2 sm:grid-cols-[4.5rem_minmax(0,1fr)] sm:items-center"}>
      <div className={bleed ? `${labelClass} sm:absolute sm:right-full sm:top-1/2 sm:mr-4 sm:-translate-y-1/2` : labelClass}>
        {label}
      </div>
      <div className="min-w-0">
        {effectNote && (
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5 font-game-text text-[11px] leading-tight text-zinc-400">
            {effectNote}
          </div>
        )}
        <div className="min-w-0 overflow-x-auto pb-1">
          <div className="mx-auto flex w-max flex-nowrap items-center gap-1.5">
            {moves.map((move, index) => (
              <span key={move.id} className="flex shrink-0 items-center gap-1.5">
                <MovePanel
                  move={move}
                  monster={sequenceMonster}
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
  const [ascensionLevel] = useMonsterAscensionLevel();
  const hasApplications = move.powers.length > 0 || move.cards.length > 0;

  return (
    <span className="inline-flex w-44 shrink-0 flex-col items-center gap-1">
      <MonsterMoveHoverPreview
        move={move}
        monster={monster}
        serviceLocale={serviceLocale}
        variant="inline"
        loopAnimation
        hpOverride={hpOverride}
        initialPowerApplications={initialPowerApplications}
      />
      {hasApplications && (
        <span className="flex max-w-full justify-center overflow-hidden px-1">
          <MoveApplicationIcons
            move={move}
            serviceLocale={serviceLocale}
            ascensionLevel={ascensionLevel}
            interactive={false}
          />
        </span>
      )}
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
      <MoveApplicationIcons move={move} serviceLocale={serviceLocale} ascensionLevel={ascensionLevel} />
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
  const surfaceRef = useRef<HTMLSpanElement | null>(null);
  const [loopNonce, setLoopNonce] = useState(0);
  const [stageInView, setStageInView] = useState(false);
  const stageMoveId = move.animationId ?? move.id;
  const stageMoveNonce = selectedMoveNonce + loopNonce;
  const stageMounted = !loopAnimation || stageInView;
  const fallbackImageUrl = monster.bossImageUrl ?? monster.imageUrl;
  const surfaceClass = compact
    ? "relative mb-0 block h-44 w-full overflow-hidden rounded bg-black/10"
    : "relative mb-2 block h-56 overflow-hidden rounded bg-black/25";
  const gridRows = compact
    ? "grid-rows-[2rem_minmax(0,1fr)_1.35rem_1.5rem]"
    : "grid-rows-[2.75rem_minmax(0,1fr)_1.65rem_1.9rem]";

  useEffect(() => {
    if (!loopAnimation) return;

    const interval = window.setInterval(() => {
      setLoopNonce((current) => (current + 1) % 100000);
    }, 1250);

    return () => window.clearInterval(interval);
  }, [loopAnimation, stageMoveId]);

  useEffect(() => {
    if (!loopAnimation) return;

    const node = surfaceRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => setStageInView(entry.isIntersecting && entry.intersectionRatio >= 0.55),
      { threshold: [0, 0.55] },
    );
    observer.observe(node);

    return () => observer.disconnect();
  }, [loopAnimation]);

  return (
    <span ref={surfaceRef} className={surfaceClass}>
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
          {stageMounted ? (
            <MonsterSpineStage
              asset={monster.spineAsset}
              fallbackImageUrl={fallbackImageUrl}
              monsterName={monster.name}
              selectedMoveId={stageMoveId}
              selectedMoveNonce={stageMoveNonce}
              imagePriority={false}
              showLoadingLabel={false}
              viewportTransitionTime={0}
              viewportPadding={MOVE_PREVIEW_VIEWPORT_PADDING}
              fallbackImageClassName="absolute inset-0 h-full w-full object-contain opacity-80"
              className="absolute inset-0"
              loopSelectedMove={loopAnimation}
            />
          ) : fallbackImageUrl ? (
            <Image
              src={fallbackImageUrl}
              alt={monster.name}
              width={640}
              height={640}
              className="absolute inset-0 h-full w-full object-contain opacity-80"
            />
          ) : null}
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
      className={`pointer-events-none relative z-40 flex h-full items-end justify-center ${compact ? "gap-0 pt-1" : "gap-0.5 pt-2"}`}
    >
      {intents.map(({ intent, kind, key }) => (
        <span key={key} className={`relative inline-flex items-center justify-center ${compact ? "h-7 w-7" : "h-10 w-10"}`}>
          <Image
            src={getIntentIcon(kind, move, intent, ascensionLevel)}
            alt=""
            width={compact ? 36 : 48}
            height={compact ? 36 : 48}
            className={`${compact ? "h-7 w-7" : "h-10 w-10"} object-contain drop-shadow-[0_5px_6px_rgba(0,0,0,0.78)]`}
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
    <span className="flex flex-wrap items-center gap-2">
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
      {move.cards.map((card) => {
        const displayedAmount = getCardApplicationDisplayAmount(card, ascensionLevel);
        const label = getCardApplicationDisplayName(card, serviceLocale);
        const upgraded = isUpgradeCardApplication(card);
        return (
          <span key={`${move.id}-${card.cardId}`} className="inline-flex min-h-7 items-center gap-1 whitespace-nowrap" title={label}>
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
              {label}
            </span>
            {displayedAmount != null && displayedAmount > 1 && (
              <span
                className="font-game-title text-[11px] font-black leading-none text-[#fff8db]"
                style={{ textShadow: "0 2px 0 #000, 0 0 4px #000, 1px 1px 0 #000" }}
              >
                x{displayedAmount}
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}

function isUpgradeCardApplication(card: MonsterMoveCardApplication): boolean {
  return card.applicationKind === "upgrade";
}

function getCardApplicationDisplayAmount(
  card: MonsterMoveCardApplication,
  ascensionLevel: number,
): number | null {
  if (isUpgradeCardApplication(card)) return null;
  return getEffectiveDamageValue(card.amount, ascensionLevel, MONSTER_MOVE_ASCENSION_LEVEL);
}

function getCardApplicationDisplayName(card: MonsterMoveCardApplication, serviceLocale: ServiceLocale): string {
  const cardName = serviceLocale === "ko" ? card.cardName : card.cardNameEn;
  if (!isUpgradeCardApplication(card)) return cardName;
  return `${cardName}+`;
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
  const amountLabel = amount != null ? `${added ? "+" : ""}${amount}` : null;
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
      {amountLabel != null && (
        <span className={`pointer-events-none absolute -bottom-0.5 -right-1 rounded bg-black/75 px-0.5 text-[9px] font-bold tabular-nums ${added ? "text-green-300" : "text-zinc-100"}`}>
          {amountLabel}
        </span>
      )}
      {added && amountLabel == null && (
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
      animationId: changes?.animationId ?? visual.animationId,
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
  animationId,
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
  animationId?: string;
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
    animationId,
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
    cardType: "상태이상",
    cardRarity: "상태이상",
    cardColor: "status",
    applicationKind: "add",
    amount,
    imageUrl: cardId === "WITHER" ? "/images/sts2/cards-beta/wither.webp" : `/images/sts2/cards/${cardId.toLowerCase()}.webp`,
  };
}

function witherUpgradeApplication(): MonsterMoveCardApplication {
  return {
    cardId: "WITHER",
    cardName: "침체",
    cardNameEn: "Wither",
    cardType: "상태이상",
    cardRarity: "상태이상",
    cardColor: "status",
    applicationKind: "upgrade",
    amount: { normal: 1, ascension: 2 },
    imageUrl: "/images/sts2/cards/wither.webp",
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
    const card = move.cards[0] ?? null;
    if (!card || isUpgradeCardApplication(card)) return null;
    return formatEffectiveValue(card.amount, ascensionLevel);
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
