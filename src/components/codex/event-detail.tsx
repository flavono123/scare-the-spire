"use client";

import { useState, useMemo, useCallback, useEffect, type ReactNode } from "react";
import type { CSSProperties } from "react";
import Image from "@/components/ui/static-image";
import Link from "next/link";
import { CommentSection } from "@/components/comment-section";
import { buildCodexCommentThreadKey } from "@/lib/comment-threads";
import type { ServiceLocale } from "@/lib/i18n";
import { localizeHref } from "@/lib/i18n";
import type { CodexGameUiLabels } from "@/lib/codex-game-ui";
import type { EntityVersionDiff, STS2Change, STS2Patch } from "@/lib/types";
import {
  getCodexServiceMessages,
  type CodexServiceMessages,
} from "@/lib/codex-service";
import {
  CodexCard,
  CodexEnchantment,
  CodexEvent,
  CodexPotion,
  CodexPower,
  CodexRelic,
  EventOption,
  EventPage,
  MonsterSpineAsset,
  PotionRarityKo,
  characterOutlineFilter,
  getEventActs,
} from "@/lib/codex-types";
import { RichText } from "@/components/rich-text";
import { CardTile } from "@/components/codex/card-tile";
import { GameChoiceFrame } from "@/components/codex/event-choice-frame";
import { FakeMerchantSpineStage } from "@/components/codex/fake-merchant-spine-stage";
import { MonsterSpineStage } from "@/components/codex/monster-spine-stage";
import {
  getDefaultTinkerRiderForType,
  getMadScienceVariantId,
  getMadSciencePreviewCard,
  getTinkerRiderIdsForType,
  isTinkerCardTypeId,
  isTinkerRiderId,
  replaceTinkerTemplateValues,
  TINKER_CARD_TYPES,
  TINKER_CARD_TYPE_TO_KO,
  type TinkerCardType,
} from "@/lib/tinker-time";
import {
  FUTURE_OF_POTIONS_EVENT_ID,
  TINKER_TIME_EVENT_ID,
  getRelatedCardIdsForEvent,
  getRelatedEnchantmentIdsForEvent,
  getRelatedPowerIdsForEvent,
  getRelatedPotionIdsForEvent,
  getRelatedRelicIdsForEvent,
} from "@/lib/codex-references";
import { EntityReferenceGroupLinks, type CodexReferenceTarget } from "./entity-reference-links";
import { STS2ChangeHistory } from "./sts2-change-history";

const GAME_TEXT_SHADOW = "3px 2px 0 rgba(0,0,0,0.5), 0 0 12px rgba(0,0,0,0.75)";

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

const ABYSSAL_BATHS_BASE_DAMAGE = 3;
const ABYSSAL_BATHS_HARD_LIMIT = 15;
const TABLET_OF_TRUTH_MAX_HP_REMAINING_LABEL_KO = "현재 최대 체력 - 1";
const TABLET_OF_TRUTH_MAX_HP_REMAINING_LABEL_EN = "current Max HP - 1";
const TRIAL_CHOICES_PAGE_ID = "__TRIAL_CHOICES__";
const EVENT_VFX_ROOT = "/images/sts2/event-vfx";

const BATTLEWORN_DUMMY_SETTINGS: Record<string, { hp: number; titleEn: string; titleKo: string }> = {
  SETTING_1: { hp: 75, titleEn: "75 HP", titleKo: "체력 75" },
  SETTING_2: { hp: 150, titleEn: "150 HP", titleKo: "체력 150" },
  SETTING_3: { hp: 300, titleEn: "300 HP", titleKo: "체력 300" },
};

const TABLET_OF_TRUTH_COST_BY_PAGE_ID: Record<string, number | "MAX_HP_MINUS_ONE"> = {
  DECIPHER_1: 6,
  DECIPHER_2: 12,
  DECIPHER_3: 24,
  DECIPHER_4: "MAX_HP_MINUS_ONE",
};

const TRIAL_CHOICE_CASES = [
  {
    id: "MERCHANT",
    imageUrl: `${EVENT_VFX_ROOT}/trial_merchant.webp`,
  },
  {
    id: "NOBLE",
    imageUrl: `${EVENT_VFX_ROOT}/trial_noble.webp`,
  },
  {
    id: "NONDESCRIPT",
    imageUrl: `${EVENT_VFX_ROOT}/trial_nondescript.webp`,
  },
] as const;

const FUTURE_OF_POTIONS_OPTIONS: EventOption[] = [
  {
    id: "POTION_COMMON_ATTACK",
    title: "일반 포션: 공격 카드",
    description: "[gold]일반 포션[/gold]을(를) 잃습니다. [gold]강화[/gold]된 [gold]일반 공격[/gold] 카드를 얻습니다.",
  },
  {
    id: "POTION_COMMON_SKILL",
    title: "일반 포션: 스킬 카드",
    description: "[gold]일반 포션[/gold]을(를) 잃습니다. [gold]강화[/gold]된 [gold]일반 스킬[/gold] 카드를 얻습니다.",
  },
  {
    id: "POTION_EVENT_ATTACK",
    title: "이벤트 포션: 공격 카드",
    description: "[gold]이벤트 포션[/gold]을(를) 잃습니다. [gold]강화[/gold]된 [gold]희귀 공격[/gold] 카드를 얻습니다.",
  },
  {
    id: "POTION_EVENT_POWER",
    title: "이벤트 포션: 파워 카드",
    description: "[gold]이벤트 포션[/gold]을(를) 잃습니다. [gold]강화[/gold]된 [gold]희귀 파워[/gold] 카드를 얻습니다.",
  },
  {
    id: "POTION_EVENT_SKILL",
    title: "이벤트 포션: 스킬 카드",
    description: "[gold]이벤트 포션[/gold]을(를) 잃습니다. [gold]강화[/gold]된 [gold]희귀 스킬[/gold] 카드를 얻습니다.",
  },
  {
    id: "POTION_RARE_ATTACK",
    title: "희귀 포션: 공격 카드",
    description: "[gold]희귀 포션[/gold]을(를) 잃습니다. [gold]강화[/gold]된 [gold]희귀 공격[/gold] 카드를 얻습니다.",
  },
  {
    id: "POTION_RARE_POWER",
    title: "희귀 포션: 파워 카드",
    description: "[gold]희귀 포션[/gold]을(를) 잃습니다. [gold]강화[/gold]된 [gold]희귀 파워[/gold] 카드를 얻습니다.",
  },
  {
    id: "POTION_RARE_SKILL",
    title: "희귀 포션: 스킬 카드",
    description: "[gold]희귀 포션[/gold]을(를) 잃습니다. [gold]강화[/gold]된 [gold]희귀 스킬[/gold] 카드를 얻습니다.",
  },
  {
    id: "POTION_TOKEN_ATTACK",
    title: "토큰 포션: 공격 카드",
    description: "[gold]토큰 포션[/gold]을(를) 잃습니다. [gold]강화[/gold]된 [gold]일반 공격[/gold] 카드를 얻습니다.",
  },
  {
    id: "POTION_TOKEN_SKILL",
    title: "토큰 포션: 스킬 카드",
    description: "[gold]토큰 포션[/gold]을(를) 잃습니다. [gold]강화[/gold]된 [gold]일반 스킬[/gold] 카드를 얻습니다.",
  },
  {
    id: "POTION_UNCOMMON_ATTACK",
    title: "고급 포션: 공격 카드",
    description: "[gold]고급 포션[/gold]을(를) 잃습니다. [gold]강화[/gold]된 [gold]고급 공격[/gold] 카드를 얻습니다.",
  },
  {
    id: "POTION_UNCOMMON_POWER",
    title: "고급 포션: 파워 카드",
    description: "[gold]고급 포션[/gold]을(를) 잃습니다. [gold]강화[/gold]된 [gold]고급 파워[/gold] 카드를 얻습니다.",
  },
  {
    id: "POTION_UNCOMMON_SKILL",
    title: "고급 포션: 스킬 카드",
    description: "[gold]고급 포션[/gold]을(를) 잃습니다. [gold]강화[/gold]된 [gold]고급 스킬[/gold] 카드를 얻습니다.",
  },
];

const FUTURE_OF_POTIONS_RARITY_BY_OPTION_ID: Record<string, PotionRarityKo> = {
  POTION_COMMON_ATTACK: "일반",
  POTION_COMMON_SKILL: "일반",
  POTION_EVENT_ATTACK: "이벤트",
  POTION_EVENT_POWER: "이벤트",
  POTION_EVENT_SKILL: "이벤트",
  POTION_RARE_ATTACK: "희귀",
  POTION_RARE_POWER: "희귀",
  POTION_RARE_SKILL: "희귀",
  POTION_TOKEN_ATTACK: "토큰",
  POTION_TOKEN_SKILL: "토큰",
  POTION_UNCOMMON_ATTACK: "고급",
  POTION_UNCOMMON_POWER: "고급",
  POTION_UNCOMMON_SKILL: "고급",
};

const ENDLESS_CONVEYOR_DISH_OPTION_IDS = [
  "CAVIAR",
  "CLAM_ROLL",
  "FRIED_EEL",
  "GOLDEN_FYSH",
  "JELLY_LIVER",
  "SEAPUNK_SALAD",
  "SPICY_SNAPPY",
  "SUSPICIOUS_CONDIMENT",
] as const;

const EVENT_OPTION_CARD_PREVIEW_IDS: Record<string, Record<string, readonly string[]>> = {
  AMALGAMATOR: {
    COMBINE_DEFENDS: ["ULTIMATE_DEFEND"],
    COMBINE_STRIKES: ["ULTIMATE_STRIKE"],
  },
  BUGSLAYER: {
    EXTERMINATION: ["EXTERMINATE"],
    SQUASH: ["SQUASH"],
  },
  BYRDONIS_NEST: {
    TAKE: ["BYRDONIS_EGG"],
  },
  CRYSTAL_SPHERE: {
    PAYMENT_PLAN: ["DEBT"],
  },
  ENDLESS_CONVEYOR: {
    SEAPUNK_SALAD: ["FEEDING_FRENZY"],
  },
  FIELD_OF_MAN_SIZED_HOLES: {
    RESIST: ["NORMALITY"],
  },
  GRAVE_OF_THE_FORGOTTEN: {
    CONFRONT: ["DECAY"],
  },
  LOST_WISP: {
    CLAIM: ["DECAY"],
  },
  LUMINOUS_CHOIR: {
    REACH_INTO_THE_FLESH: ["SPORE_MIND"],
  },
  PUNCH_OFF: {
    NAB: ["INJURY"],
  },
  REFLECTIONS: {
    SHATTER: ["BAD_LUCK"],
  },
  SPIRIT_GRAFTER: {
    LET_IT_IN: ["METAMORPHOSIS"],
  },
  SUNKEN_TREASURY: {
    SECOND_CHEST: ["GREED"],
  },
  THE_LANTERN_KEY: {
    FIGHT: ["LANTERN_KEY"],
    KEEP_THE_KEY: ["LANTERN_KEY"],
  },
  THE_LEGENDS_WERE_TRUE: {
    NAB_THE_MAP: ["SPOILS_MAP"],
  },
  THIS_OR_THAT: {
    ORNATE: ["CLUMSY"],
  },
  TRASH_HEAP: {
    GRAB: [
      "CALTROPS",
      "CLASH",
      "DISTRACTION",
      "DUAL_WIELD",
      "ENTRENCH",
      "HELLO_WORLD",
      "OUTMANEUVER",
      "REBOUND",
      "RIP_AND_TEAR",
      "STACK",
    ],
  },
  TRIAL: {
    MERCHANT_GUILTY: ["REGRET"],
    MERCHANT_INNOCENT: ["SHAME"],
    NOBLE_INNOCENT: ["REGRET"],
    NONDESCRIPT_GUILTY: ["DOUBT"],
    NONDESCRIPT_INNOCENT: ["DOUBT"],
  },
  UNREST_SITE: {
    REST: ["POOR_SLEEP"],
  },
  WELLSPRING: {
    BATHE: ["GUILTY"],
  },
  WOOD_CARVINGS: {
    BIRD: ["PECK"],
    TORUS: ["TORIC_TOUGHNESS"],
  },
  ZEN_WEAVER: {
    BREATHING_TECHNIQUES: ["ENLIGHTENMENT"],
  },
};

const EVENT_OPTION_RELIC_PREVIEW_IDS: Record<string, Record<string, readonly string[]>> = {
  COLORFUL_PHILOSOPHERS: {
    EQUALITY: ["PRISMATIC_GEM"],
  },
  COLOSSAL_FLOWER: {
    POLLINOUS_CORE: ["POLLINOUS_CORE"],
  },
  DROWNING_BEACON: {
    CLIMB: ["FRESNEL_LENS"],
  },
  GRAVE_OF_THE_FORGOTTEN: {
    ACCEPT: ["FORGOTTEN_SOUL"],
  },
  HUNGRY_FOR_MUSHROOMS: {
    BIG_MUSHROOM: ["BIG_MUSHROOM"],
    FRAGRANT_MUSHROOM: ["FRAGRANT_MUSHROOM"],
  },
  LOST_WISP: {
    CLAIM: ["LOST_WISP"],
  },
  ROOM_FULL_OF_CHEESE: {
    SEARCH: ["CHOSEN_CHEESE"],
  },
  ROUND_TEA_PARTY: {
    ENJOY_TEA: ["ROYAL_POISON"],
  },
  SUNKEN_STATUE: {
    GRAB_SWORD: ["SWORD_OF_STONE"],
  },
  TEA_MASTER: {
    BONE_TEA: ["BONE_TEA"],
    EMBER_TEA: ["EMBER_TEA"],
    TEA_OF_DISCOURTESY: ["TEA_OF_DISCOURTESY"],
  },
  TRASH_HEAP: {
    DIVE_IN: ["DARKSTONE_PERIAPT", "DREAM_CATCHER", "HAND_DRILL", "MAW_BANK", "THE_BOOT"],
  },
  WELCOME_TO_WONGOS: {
    MYSTERY_BOX: ["WONGOS_MYSTERY_TICKET"],
  },
  WAR_HISTORIAN_REPY: {
    UNLOCK_CAGE: ["HISTORY_COURSE"],
  },
};

const EVENT_OPTION_POTION_PREVIEW_IDS: Record<string, Record<string, readonly string[]>> = {
  DROWNING_BEACON: {
    BOTTLE: ["GLOWWATER_POTION"],
  },
  POTION_COURIER: {
    GRAB_POTIONS: ["FOUL_POTION"],
  },
};

const EVENT_OPTION_GENERATED_RANDOM_POTION_IDS: Record<string, readonly string[]> = {
  BATTLEWORN_DUMMY: ["SETTING_1"],
  ENDLESS_CONVEYOR: ["SUSPICIOUS_CONDIMENT"],
  PUNCH_OFF: ["FIGHT"],
  THE_LEGENDS_WERE_TRUE: ["SLOWLY_FIND_AN_EXIT"],
  WAR_HISTORIAN_REPY: ["UNLOCK_CHEST"],
  WELLSPRING: ["BOTTLE"],
  WHISPERING_HOLLOW: ["GOLD"],
};

type EventPreview = {
  cards?: CodexCard[];
  potions?: CodexPotion[];
  relics?: CodexRelic[];
};

interface TrialNpcOverlay {
  caseId: string;
  imageUrl: string;
}

interface ImageEventArtOverlay {
  alt: string;
  className: string;
  fill?: boolean;
  height?: number;
  kind?: "image";
  src: string;
  style?: CSSProperties;
  width?: number;
}

interface SpriteSheetEventArtOverlay {
  className: string;
  frameHeight: number;
  frameWidth: number;
  framesX: number;
  framesY: number;
  intervalMs?: number;
  kind: "sprite-sheet";
  src: string;
  style?: CSSProperties;
}

type EventArtOverlay = ImageEventArtOverlay | SpriteSheetEventArtOverlay;

interface EventSpineOverlayConfig {
  asset: MonsterSpineAsset;
  className: string;
  fallbackImageUrl: string | null;
  monsterName: string;
  viewportPadding?: {
    padBottom?: string;
    padLeft?: string;
    padRight?: string;
    padTop?: string;
  };
}

const EVENT_PORTRAIT_RECT_WIDTH = 2560;
const EVENT_PORTRAIT_RECT_HEIGHT = 1200;
const EVENT_GAME_VIEWPORT_WIDTH = 1920;
const EVENT_GAME_VIEWPORT_HEIGHT = 1080;
const EVENT_PORTRAIT_SCALE = 1.04;
// Source: default_event_layout.tscn. The layout root is shifted up by 39 px,
// while the 2560x1200 Portrait rect is centered 44 px lower inside that root.
const EVENT_PORTRAIT_CENTER_Y = 5;

const EVENT_GAME_VIEWPORT_PORTRAIT_STYLE: CSSProperties = {
  height: `${(EVENT_PORTRAIT_RECT_HEIGHT / EVENT_GAME_VIEWPORT_HEIGHT) * 100}%`,
  left: "50%",
  top: `calc(50% + ${(EVENT_PORTRAIT_CENTER_Y / EVENT_GAME_VIEWPORT_HEIGHT) * 100}%)`,
  transform: `translate(-50%, -50%) scale(${EVENT_PORTRAIT_SCALE})`,
  transformOrigin: "center",
  width: `${(EVENT_PORTRAIT_RECT_WIDTH / EVENT_GAME_VIEWPORT_WIDTH) * 100}%`,
};

type EventVfxAnchor = "default" | "trial";

const EVENT_VFX_ANCHORS: Record<EventVfxAnchor, { scale: number; x: number; y: number }> = {
  default: { scale: 1.04, x: 268, y: 49 },
  trial: { scale: 1.04, x: 292, y: 68 },
};

function eventPortraitVfxRect({
  anchor = "default",
  height,
  scale,
  width,
  x,
  y,
}: {
  anchor?: EventVfxAnchor;
  height: number;
  scale: number;
  width: number;
  x: number;
  y: number;
}): CSSProperties {
  const anchorConfig = EVENT_VFX_ANCHORS[anchor];
  const totalScale = scale * anchorConfig.scale;
  const scaledWidth = width * totalScale;
  const scaledHeight = height * totalScale;
  const centerX = anchorConfig.x + x * anchorConfig.scale;
  const centerY = anchorConfig.y + y * anchorConfig.scale;

  return {
    height: `${(scaledHeight / EVENT_PORTRAIT_RECT_HEIGHT) * 100}%`,
    left: `${((centerX - scaledWidth / 2) / EVENT_PORTRAIT_RECT_WIDTH) * 100}%`,
    top: `${((centerY - scaledHeight / 2) / EVENT_PORTRAIT_RECT_HEIGHT) * 100}%`,
    width: `${(scaledWidth / EVENT_PORTRAIT_RECT_WIDTH) * 100}%`,
  };
}

function eventVfxSpriteOverlay({
  anchor,
  className = "",
  height,
  scale = 1,
  src,
  style,
  width,
  x,
  y,
}: {
  anchor?: EventVfxAnchor;
  className?: string;
  height: number;
  scale?: number;
  src: string;
  style?: CSSProperties;
  width: number;
  x: number;
  y: number;
}): ImageEventArtOverlay {
  return {
    alt: "",
    className: `pointer-events-none absolute object-contain ${className}`.trim(),
    height,
    src,
    style: {
      ...eventPortraitVfxRect({ anchor, height, scale, width, x, y }),
      ...style,
    },
    width,
  };
}

function eventVfxSpriteSheetOverlay({
  anchor,
  className = "",
  frameHeight,
  frameWidth,
  framesX,
  framesY,
  intervalMs,
  scale = 1,
  src,
  style,
  x,
  y,
}: {
  anchor?: EventVfxAnchor;
  className?: string;
  frameHeight: number;
  frameWidth: number;
  framesX: number;
  framesY: number;
  intervalMs?: number;
  scale?: number;
  src: string;
  style?: CSSProperties;
  x: number;
  y: number;
}): EventArtOverlay {
  return {
    className: `pointer-events-none absolute bg-no-repeat ${className}`.trim(),
    frameHeight,
    frameWidth,
    framesX,
    framesY,
    intervalMs,
    kind: "sprite-sheet",
    src,
    style: {
      ...eventPortraitVfxRect({ anchor, height: frameHeight, scale, width: frameWidth, x, y }),
      ...style,
    },
  };
}

const FLAIL_KNIGHT_EVENT_SPINE_ASSET: MonsterSpineAsset = {
  id: "FLAIL_KNIGHT",
  source: "animations/monsters/flail_knight/flailknight",
  renderStatus: "spine",
  renderTags: ["event-background"],
  atlasUrl: "/spine/sts2/monsters/flail_knight/flailknight.atlas",
  binaryUrl: "/spine/sts2/monsters/flail_knight/flailknight.skel",
  textureUrls: ["/spine/sts2/monsters/flail_knight/flailknight.png"],
  skin: null,
  skins: ["default"],
  animations: [
    "attack_breaker",
    "attack_flail",
    "attack_ram",
    "buff",
    "die",
    "hurt",
    "idle_loop",
  ],
  bestiaryAnimations: ["hurt", "die"],
  idleAnimation: "idle_loop",
  moveAnimations: {},
  moveEffects: {},
};

const EVENT_SPINE_OVERLAYS: Record<string, EventSpineOverlayConfig[]> = {
  THE_LANTERN_KEY: [
    {
      asset: FLAIL_KNIGHT_EVENT_SPINE_ASSET,
      className: "left-[5%] top-[9%] h-[84%] w-[44%] opacity-95 drop-shadow-[0_24px_34px_rgba(0,0,0,0.62)]",
      fallbackImageUrl: "/images/sts2/monsters-render/flail_knight.webp",
      monsterName: "철퇴 기사",
    },
  ],
};

const EVENT_ART_OVERLAYS: Record<string, EventArtOverlay[]> = {
  BUGSLAYER: [
    eventVfxSpriteOverlay({
      className: "opacity-80 drop-shadow-[0_0_8px_rgba(255,255,255,0.35)]",
      height: 21,
      src: `${EVENT_VFX_ROOT}/infested_automaton_flies.webp`,
      width: 122,
      x: 638,
      y: 629,
    }),
    eventVfxSpriteOverlay({
      className: "opacity-55 drop-shadow-[0_0_8px_rgba(255,255,255,0.35)]",
      height: 21,
      src: `${EVENT_VFX_ROOT}/infested_automaton_flies.webp`,
      width: 122,
      x: 741,
      y: 593,
    }),
  ],
  BYRDONIS_NEST: [
    eventVfxSpriteOverlay({
      className: "opacity-80",
      height: 141,
      src: `${EVENT_VFX_ROOT}/byrdonis_feathers.webp`,
      width: 489,
      x: 554,
      y: -54,
    }),
    eventVfxSpriteOverlay({
      className: "opacity-80",
      height: 141,
      src: `${EVENT_VFX_ROOT}/byrdonis_feathers.webp`,
      width: 489,
      x: 835.577,
      y: -45.192,
    }),
    eventVfxSpriteOverlay({
      className: "opacity-90 mix-blend-screen",
      height: 60,
      src: `${EVENT_VFX_ROOT}/byrdonis_nest_shine.webp`,
      width: 70,
      x: 557,
      y: 535,
    }),
  ],
  COLOSSAL_FLOWER: [
    eventVfxSpriteOverlay({
      className: "opacity-35 mix-blend-screen",
      height: 2400,
      src: `${EVENT_VFX_ROOT}/trial_stand_light.webp`,
      width: 1251,
      x: 521,
      y: 352,
    }),
  ],
  DENSE_VEGETATION: [
    eventVfxSpriteOverlay({
      className: "opacity-95",
      height: 1200,
      scale: 0.93,
      src: "/images/sts2/events/dense_vegetation_foreground.webp",
      width: 2560,
      x: 970.208,
      y: 512.808,
    }),
    eventVfxSpriteOverlay({
      className: "opacity-75 drop-shadow-[0_0_8px_rgba(255,235,140,0.5)]",
      height: 143,
      scale: 0.5,
      src: `${EVENT_VFX_ROOT}/dense_vegetation/vfx_dense_vegetation_bug_03.webp`,
      width: 239,
      x: 313.323,
      y: 646.923,
    }),
  ],
  DOLL_ROOM: [
    eventVfxSpriteOverlay({
      className: "opacity-95",
      height: 942,
      scale: 0.93,
      src: `${EVENT_VFX_ROOT}/doll_room_foreground.webp`,
      width: 2560,
      x: 961,
      y: 655,
    }),
    eventVfxSpriteOverlay({
      className: "opacity-80 mix-blend-screen",
      height: 35,
      src: `${EVENT_VFX_ROOT}/doll_room_whisper_bubble_l.webp`,
      width: 35,
      x: 382,
      y: 287,
    }),
    eventVfxSpriteOverlay({
      className: "opacity-80 mix-blend-screen",
      height: 35,
      src: `${EVENT_VFX_ROOT}/doll_room_whisper_bubble_r.webp`,
      width: 35,
      x: 905,
      y: 368,
    }),
    eventVfxSpriteOverlay({
      className: "opacity-70 mix-blend-screen",
      height: 31,
      src: `${EVENT_VFX_ROOT}/doll_room_whispers.webp`,
      width: 93,
      x: 594,
      y: 449,
    }),
  ],
  INFESTED_AUTOMATON: [
    eventVfxSpriteOverlay({
      className: "opacity-80 drop-shadow-[0_0_8px_rgba(255,255,255,0.35)]",
      height: 21,
      src: `${EVENT_VFX_ROOT}/infested_automaton_flies.webp`,
      width: 122,
      x: 568,
      y: 703,
    }),
  ],
  LOST_WISP: [
    eventVfxSpriteOverlay({
      className: "opacity-95",
      height: 1200,
      src: `${EVENT_VFX_ROOT}/bedlam_beacon_foreground.webp`,
      width: 2560,
      x: 1014.62,
      y: 520.192,
    }),
  ],
  MORPHIC_GROVE: [
    eventVfxSpriteOverlay({
      className: "opacity-95",
      height: 1200,
      src: `${EVENT_VFX_ROOT}/morphic_grove/morphic_grove_foreground.webp`,
      width: 2560,
      x: 952,
      y: 532,
    }),
  ],
  POTION_COURIER: [
    eventVfxSpriteOverlay({
      className: "opacity-80",
      height: 141,
      src: `${EVENT_VFX_ROOT}/byrdonis_feathers.webp`,
      width: 489,
      x: 685.038,
      y: 34.145,
    }),
    eventVfxSpriteOverlay({
      className: "opacity-75 drop-shadow-[0_0_8px_rgba(255,255,255,0.35)]",
      height: 21,
      src: `${EVENT_VFX_ROOT}/infested_automaton_flies.webp`,
      width: 122,
      x: 561.038,
      y: 655.144,
    }),
    eventVfxSpriteOverlay({
      className: "opacity-90 drop-shadow-[0_0_8px_rgba(255,80,80,0.55)]",
      height: 33,
      src: `${EVENT_VFX_ROOT}/potion_courier_x.webp`,
      width: 39,
      x: 397.115,
      y: 472.952,
    }),
  ],
  SELF_HELP_BOOK: [
    eventVfxSpriteOverlay({
      className: "opacity-45 mix-blend-screen",
      height: 536,
      scale: 0.68,
      src: `${EVENT_VFX_ROOT}/self_help_book_shine.webp`,
      width: 1764,
      x: 570.192,
      y: 634.615,
    }),
  ],
  SYMBIOTE: [
    eventVfxSpriteOverlay({
      className: "opacity-95 drop-shadow-[0_0_14px_rgba(117,255,203,0.35)]",
      height: 213,
      scale: 0.5,
      src: `${EVENT_VFX_ROOT}/symbiote/symbiote_eye.webp`,
      width: 155,
      x: 662.5,
      y: 631.7,
    }),
    eventVfxSpriteOverlay({
      className: "opacity-75 mix-blend-screen",
      height: 116,
      src: `${EVENT_VFX_ROOT}/symbiote/symbiote_highlight.webp`,
      width: 151,
      x: 624,
      y: 555.8,
    }),
    eventVfxSpriteOverlay({
      className: "opacity-90 drop-shadow-[0_0_10px_rgba(117,255,203,0.35)]",
      height: 116,
      scale: 0.5,
      src: `${EVENT_VFX_ROOT}/symbiote/eye_01.webp`,
      width: 73,
      x: 592.2,
      y: 397,
    }),
    eventVfxSpriteOverlay({
      className: "opacity-90 drop-shadow-[0_0_10px_rgba(117,255,203,0.35)]",
      height: 78,
      scale: 0.5,
      src: `${EVENT_VFX_ROOT}/symbiote/eye_03.webp`,
      width: 60,
      x: 247.6,
      y: 286.8,
    }),
    eventVfxSpriteOverlay({
      className: "opacity-90 drop-shadow-[0_0_10px_rgba(117,255,203,0.35)]",
      height: 85,
      scale: 0.5,
      src: `${EVENT_VFX_ROOT}/symbiote/eye_02.webp`,
      width: 68,
      x: 522.3,
      y: 724.4,
    }),
    eventVfxSpriteOverlay({
      className: "opacity-85 drop-shadow-[0_0_10px_rgba(117,255,203,0.35)]",
      height: 78,
      scale: 0.4,
      src: `${EVENT_VFX_ROOT}/symbiote/eye_03.webp`,
      width: 60,
      x: 786.1,
      y: 577.6,
    }),
  ],
  TABLET_OF_TRUTH: [
    eventVfxSpriteSheetOverlay({
      className: "opacity-95 drop-shadow-[0_0_18px_rgba(255,214,110,0.25)]",
      frameHeight: 266,
      frameWidth: 266,
      framesX: 8,
      framesY: 2,
      intervalMs: 90,
      src: `${EVENT_VFX_ROOT}/tablet_of_truth_rock.webp`,
      x: 573,
      y: 554,
    }),
  ],
  TEA_MASTER: [
    eventVfxSpriteOverlay({
      className: "opacity-90 mix-blend-screen",
      height: 33,
      scale: 0.95,
      src: `${EVENT_VFX_ROOT}/tea_master/tea_master_05.webp`,
      width: 75,
      x: 554.501,
      y: 489.423,
    }),
    eventVfxSpriteOverlay({
      className: "opacity-90 mix-blend-screen",
      height: 60,
      src: `${EVENT_VFX_ROOT}/byrdonis_nest_shine.webp`,
      width: 70,
      x: 543.501,
      y: 483.423,
    }),
    eventVfxSpriteOverlay({
      className: "opacity-90 mix-blend-screen",
      height: 60,
      src: `${EVENT_VFX_ROOT}/byrdonis_nest_shine.webp`,
      width: 70,
      x: 581.501,
      y: 485.423,
    }),
  ],
  THE_FUTURE_OF_POTIONS: [
    {
      alt: "",
      className: "pointer-events-none object-contain",
      fill: true,
      src: `${EVENT_VFX_ROOT}/the_future_of_potions_foreground.webp`,
    },
    {
      alt: "",
      className: "pointer-events-none absolute object-contain opacity-85 mix-blend-screen",
      height: 657,
      src: `${EVENT_VFX_ROOT}/the_future_of_potions_glow.webp`,
      style: {
        height: "65.7%",
        left: "21%",
        top: "28.8%",
        width: "14.6%",
      },
      width: 315,
    },
  ],
  THIS_OR_THAT: [
    eventVfxSpriteOverlay({
      className: "opacity-75 drop-shadow-[0_0_8px_rgba(255,255,255,0.35)]",
      height: 21,
      src: `${EVENT_VFX_ROOT}/infested_automaton_flies.webp`,
      width: 122,
      x: 578.392,
      y: 711.346,
    }),
  ],
  TRIAL: [
    eventVfxSpriteOverlay({
      anchor: "trial",
      className: "opacity-95",
      height: 1200,
      scale: 0.94,
      src: `${EVENT_VFX_ROOT}/trial_top_layer.webp`,
      width: 2560,
      x: 952,
      y: 532,
    }),
    eventVfxSpriteOverlay({
      anchor: "trial",
      className: "opacity-60 mix-blend-screen",
      height: 542,
      src: `${EVENT_VFX_ROOT}/trial_light_beam.webp`,
      width: 132,
      x: 541,
      y: 305,
    }),
  ],
};

function getTinkerSelectedType(currentEntry: NavEntry | null): TinkerCardType | null {
  if (!currentEntry || currentEntry.pageId !== "CHOOSE_RIDER") return null;
  return isTinkerCardTypeId(currentEntry.optionId)
    ? currentEntry.optionId
    : null;
}

function applyAbyssalBathsDamage(option: EventOption, damage: number): EventOption {
  if (option.id !== "IMMERSE" && option.id !== "LINGER") return option;
  return {
    ...option,
    description: option.description.replace(/\[red\]\d+\[\/red\]/, `[red]${damage}[/red]`),
  };
}

function isEnglishEvent(event: CodexEvent): boolean {
  return event.name === event.nameEn;
}

function eventText(event: CodexEvent, ko: string, en: string): string {
  return isEnglishEvent(event) ? en : ko;
}

function dedupeById<T extends { id: string }>(items: readonly T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function optionIdMatches(map: Record<string, readonly string[]>, eventId: string, optionId: string): boolean {
  return map[eventId]?.includes(optionId) ?? false;
}

function isGeneratedPotionPoolPotion(potion: CodexPotion): boolean {
  return potion.rarity !== "이벤트" && potion.rarity !== "토큰";
}

function sortPotionsForPreview(potions: readonly CodexPotion[]): CodexPotion[] {
  return [...potions].sort((a, b) => a.name.localeCompare(b.name, "ko"));
}

function sortSlipperyBridgeOptions(options: readonly EventOption[]): EventOption[] {
  return [...options].sort((a, b) => {
    const aHold = a.id.startsWith("HOLD_ON");
    const bHold = b.id.startsWith("HOLD_ON");
    if (aHold === bHold) return 0;
    return aHold ? -1 : 1;
  });
}

function applyBattlewornDummyOption(option: EventOption, event: CodexEvent): EventOption {
  const setting = BATTLEWORN_DUMMY_SETTINGS[option.id];
  if (!setting) return option;
  return {
    ...option,
    title: eventText(event, setting.titleKo, setting.titleEn),
    description: option.description
      .replace(/\[blue\](?:\[?Setting1Hp\]?|75)\[\/blue\]/, `[blue]${setting.hp}[/blue]`)
      .replace(/\[blue\](?:\[?Setting2Hp\]?|150)\[\/blue\]/, `[blue]${setting.hp}[/blue]`)
      .replace(/\[blue\](?:\[?Setting3Hp\]?|300)\[\/blue\]/, `[blue]${setting.hp}[/blue]`),
  };
}

function tabletCostForOption(currentPageId: string | null, option: EventOption): number | "MAX_HP_MINUS_ONE" | null {
  if (option.id === "DECIPHER_1") return 3;
  if (option.id !== "DECIPHER" || !currentPageId) return null;
  return TABLET_OF_TRUTH_COST_BY_PAGE_ID[currentPageId] ?? null;
}

function applyTabletOfTruthCost(option: EventOption, currentPageId: string | null, event: CodexEvent): EventOption {
  const cost = tabletCostForOption(currentPageId, option);
  if (!cost) return option;
  const costText = cost === "MAX_HP_MINUS_ONE"
    ? eventText(event, TABLET_OF_TRUTH_MAX_HP_REMAINING_LABEL_KO, TABLET_OF_TRUTH_MAX_HP_REMAINING_LABEL_EN)
    : String(cost);
  return {
    ...option,
    description: option.description.replace(/\[red\][^\[]+\[\/red\]/, `[red]${costText}[/red]`),
  };
}

function applyHungryForMushroomsDescription(option: EventOption, event: CodexEvent): EventOption {
  if (option.id === "BIG_MUSHROOM") {
    return {
      ...option,
      description: eventText(
        event,
        "[gold]커다란 버섯[/gold]을 얻습니다. 매 전투 시작 시 카드를 [blue]2[/blue]장 [red]덜 뽑습니다[/red]. 최대 체력이 [green]20[/green] 증가합니다.",
        "Obtain [gold]Big Mushroom[/gold]. Draw [blue]2[/blue] [red]fewer cards[/red] at the start of each combat. Raise your Max HP by [green]20[/green].",
      ),
    };
  }
  if (option.id === "FRAGRANT_MUSHROOM") {
    return {
      ...option,
      description: eventText(
        event,
        "[gold]향기로운 버섯[/gold]을 얻습니다. 체력을 [red]15[/red] 잃습니다. 무작위 카드를 [blue]2[/blue]장 [gold]강화[/gold]합니다.",
        "Obtain [gold]Fragrant Mushroom[/gold]. Lose [red]15[/red] HP. [gold]Upgrade[/gold] [blue]2[/blue] random cards.",
      ),
    };
  }
  return option;
}

function applySlipperyBridgeOption(option: EventOption, event: CodexEvent, holdCount: number): EventOption {
  if (option.id === "OVERCOME") {
    return {
      ...option,
      description: eventText(
        event,
        "[red]무작위 카드[/red] 1장이 [gold]덱[/gold]에서 제거됩니다.",
        "A [red]random card[/red] is removed from your [gold]Deck[/gold].",
      ),
    };
  }
  if (!option.id.startsWith("HOLD_ON")) return option;
  const damage = 3 + holdCount;
  return {
    ...option,
    description: option.description.replace(/\[red\](?:\d+\+?|\[[^\]]+\])\[\/red\]/, `[red]${damage}[/red]`),
  };
}

function applyTeaMasterOption(option: EventOption, event: CodexEvent): EventOption {
  if (option.id === "BONE_TEA") {
    return {
      ...option,
      description: eventText(
        event,
        "[gold]골드[/gold]를 [red]50[/red] 지불합니다. 다음 전투 시작 시, 손에 있는 모든 카드를 [gold]강화[/gold]합니다.",
        "Pay [red]50[/red] [gold]Gold[/gold]. At the start of your next combat, [gold]Upgrade[/gold] all cards in your hand.",
      ),
    };
  }
  if (option.id === "EMBER_TEA") {
    return {
      ...option,
      description: eventText(
        event,
        "[gold]골드[/gold]를 [red]150[/red] 지불합니다. 다음 전투 시작 시, [gold]힘[/gold]을 [blue]2[/blue] 얻습니다.",
        "Pay [red]150[/red] [gold]Gold[/gold]. At the start of your next combat, gain [blue]2[/blue] [gold]Strength[/gold].",
      ),
    };
  }
  return option;
}

function applyEventOptionDisplayFixups(
  event: CodexEvent,
  currentPageId: string | null,
  option: EventOption,
): EventOption {
  if (event.id === "BATTLEWORN_DUMMY") return applyBattlewornDummyOption(option, event);
  if (event.id === "HUNGRY_FOR_MUSHROOMS") return applyHungryForMushroomsDescription(option, event);
  if (event.id === "TABLET_OF_TRUTH") return applyTabletOfTruthCost(option, currentPageId, event);
  if (event.id === "TEA_MASTER") return applyTeaMasterOption(option, event);
  return option;
}

function getOptionLabel(
  event: CodexEvent,
  pages: readonly EventPage[],
  optionId: string | null | undefined,
): string | null {
  if (!optionId) return null;
  for (const option of event.options ?? []) {
    if (option.id === optionId) return option.title;
  }
  for (const page of pages) {
    for (const option of page.options ?? []) {
      if (option.id === optionId) return option.title;
    }
  }
  return null;
}

function applyEventDescriptionFixups(
  event: CodexEvent,
  currentPageId: string | null,
  description: string | null | undefined,
  currentEntry: NavEntry | null,
  pages: readonly EventPage[],
): string | null | undefined {
  if (!description) return description;
  if (event.id === "ENDLESS_CONVEYOR" && currentPageId === "GRAB_SOMETHING_OFF_THE_BELT") {
    const title = getOptionLabel(event, pages, currentEntry?.optionId);
    if (title) return description.replace(/\[gold\]Last Dish Title\[\/gold\]/g, `[gold]${title}[/gold]`);
  }
  return description;
}

function buildTrialChoiceOptions(pageMap: Map<string, EventPage>): EventOption[] {
  return TRIAL_CHOICE_CASES.flatMap((trialCase) => {
    const page = pageMap.get(trialCase.id);
    return (page?.options ?? []).map((option) => ({
      ...option,
      id: `${trialCase.id}_${option.id}`,
    }));
  });
}

function trialNpcForOptionId(optionId: string): TrialNpcOverlay | null {
  const trialCase = TRIAL_CHOICE_CASES.find((entry) => optionId.startsWith(`${entry.id}_`));
  return trialCase ? { caseId: trialCase.id, imageUrl: trialCase.imageUrl } : null;
}

function resolveEventOptionPage(
  eventId: string,
  currentPageId: string | null,
  optionId: string,
  visitCount: number,
  pageMap: Map<string, EventPage>,
): string | null {
  if (
    eventId === "TINKER_TIME" &&
    currentPageId === "CHOOSE_CARD_TYPE" &&
    isTinkerCardTypeId(optionId) &&
    pageMap.has("CHOOSE_RIDER")
  ) {
    return "CHOOSE_RIDER";
  }
  if (eventId === "TABLET_OF_TRUTH" && optionId === "DECIPHER") {
    const currentStep = currentPageId?.match(/^DECIPHER_(\d+)$/)?.[1];
    const nextStep = currentStep ? Number(currentStep) + 1 : 1;
    const pageId = `DECIPHER_${nextStep}`;
    if (pageMap.has(pageId)) return pageId;
  }
  if (eventId === "TRIAL" && optionId === "ACCEPT") {
    return TRIAL_CHOICES_PAGE_ID;
  }
  if (
    eventId === "CRYSTAL_SPHERE" &&
    (optionId === "UNCOVER_FUTURE" || optionId === "PAYMENT_PLAN") &&
    pageMap.has("FINISH")
  ) {
    return "FINISH";
  }
  if (
    eventId === "ENDLESS_CONVEYOR" &&
    ENDLESS_CONVEYOR_DISH_OPTION_IDS.includes(optionId as typeof ENDLESS_CONVEYOR_DISH_OPTION_IDS[number])
  ) {
    return pageMap.has("GRAB_SOMETHING_OFF_THE_BELT") ? "GRAB_SOMETHING_OFF_THE_BELT" : null;
  }
  if (eventId === "TRIAL") {
    const [caseId, verdictId] = optionId.split("_");
    const resultPageId = `${caseId}_${verdictId}`;
    if (pageMap.has(resultPageId)) return resultPageId;
  }
  return resolveSequencePage(optionId, visitCount, pageMap);
}

// --- Option card (static) ---
function OptionCard({
  backgroundImageUrl,
  onHoverEnd,
  onHoverStart,
  onPreviewChange,
  option,
  preview,
}: {
  backgroundImageUrl?: string | null;
  onHoverEnd?: () => void;
  onHoverStart?: () => void;
  onPreviewChange?: (preview: EventPreview | null) => void;
  option: EventOption;
  preview?: EventPreview | null;
}) {
  return (
    <GameChoiceFrame
      backgroundImageUrl={backgroundImageUrl}
      onHoverEnd={onHoverEnd}
      onHoverStart={onHoverStart}
      preview={preview}
      onPreviewChange={onPreviewChange}
    >
      <div className="font-game-text text-[19px] font-bold leading-[1.05] text-[#d8cb72]">
        <RichText text={option.title} />
      </div>
      {option.description && (
        <div className="font-game-text text-[18px] leading-[1.08] text-[#fff6e2]">
          <RichText text={option.description} />
        </div>
      )}
    </GameChoiceFrame>
  );
}

// --- Navigation history entry ---
interface NavEntry {
  pageId: string;
  optionId: string;
}

// --- Resolve sequence pages (LINGER→LINGER1-9, DECIPHER→DECIPHER_1-5) ---
function resolveSequencePage(
  optionId: string,
  visitCount: number,
  pageMap: Map<string, EventPage>,
): string | null {
  if (pageMap.has(optionId)) {
    const idx = visitCount + 1;
    const underscored = `${optionId}_${idx}`;
    const suffixed = `${optionId}${idx}`;
    if (pageMap.has(underscored)) return underscored;
    if (pageMap.has(suffixed)) return suffixed;
    return optionId;
  }
  const idx = visitCount + 1;
  const candidates = [
    `${optionId}${idx}`,
    `${optionId}_${idx}`,
    `${optionId}${visitCount}`,
    `${optionId}_${visitCount}`,
  ];
  for (const c of candidates) {
    if (pageMap.has(c)) return c;
  }
  for (let i = idx - 1; i >= 1; i--) {
    if (pageMap.has(`${optionId}${i}`)) return `${optionId}${i}`;
    if (pageMap.has(`${optionId}_${i}`)) return `${optionId}_${i}`;
  }
  return null;
}

// --- Interactive event content viewer (game-like flow) ---
export function EventContentViewer({
  cards = [],
  event,
  gameUi,
  madScienceBaseCard,
  messages,
  onPreviewChange,
  onTrialNpcChange,
  potions,
  relics = [],
}: {
  cards?: CodexCard[];
  event: CodexEvent;
  gameUi: CodexGameUiLabels;
  madScienceBaseCard?: CodexCard | null;
  messages: CodexServiceMessages;
  onPreviewChange?: (preview: EventPreview | null) => void;
  onTrialNpcChange?: (overlay: TrialNpcOverlay | null) => void;
  potions?: CodexPotion[];
  relics?: CodexRelic[];
}) {
  const [history, setHistory] = useState<NavEntry[]>([]);
  const pages = useMemo(() => event.pages ?? [], [event.pages]);
  const pageMap = useMemo(
    () => new Map(pages.map((p) => [p.id, p])),
    [pages],
  );
  const allPage = pageMap.get("ALL") ?? null;

  const currentEntry = history.length > 0 ? history[history.length - 1] : null;
  const currentPageId = currentEntry?.pageId ?? null;
  const currentPage = currentPageId ? pageMap.get(currentPageId) ?? null : null;

  const baseDescription = event.id === "TRIAL" && currentPageId === TRIAL_CHOICES_PAGE_ID
    ? null
    : currentPage?.description ?? event.description;
  const description = applyEventDescriptionFixups(event, currentPageId, baseDescription, currentEntry, pages);

  const rawOptions = useMemo(() => {
    if (event.id === "ENDLESS_CONVEYOR") {
      const dishOptions = (allPage?.options ?? []).filter((option) => option.id !== "LOCKED");
      if (!currentPageId) return [...dishOptions, ...(event.options ?? [])];
      if (currentPageId === "GRAB_SOMETHING_OFF_THE_BELT") {
        const page = pageMap.get(currentPageId);
        return [...dishOptions, ...(page?.options ?? [])];
      }
    }
    if (!currentPageId) return event.options ?? [];
    const page = pageMap.get(currentPageId);
    if (page?.options && page.options.length > 0) return page.options;
    if (allPage?.options && allPage.options.length > 0) return allPage.options;
    return [];
  }, [currentPageId, pageMap, event.id, event.options, allPage]);

  const trialChoiceOptions = useMemo(() => {
    if (event.id !== "TRIAL" || currentPageId !== TRIAL_CHOICES_PAGE_ID) return [];
    return buildTrialChoiceOptions(pageMap);
  }, [currentPageId, event.id, pageMap]);

  const displayOptions = useMemo(() => {
    if (trialChoiceOptions.length > 0) {
      return trialChoiceOptions;
    }

    if (event.id === "THE_FUTURE_OF_POTIONS" && (!currentPageId || currentPageId === "INITIAL")) {
      return FUTURE_OF_POTIONS_OPTIONS;
    }

    if (event.id === "TINKER_TIME" && currentPageId === "CHOOSE_RIDER") {
      const selectedType = getTinkerSelectedType(currentEntry);
      const riderIds = selectedType ? getTinkerRiderIdsForType(selectedType) : [];
      const byId = new Map(rawOptions.map((option) => [option.id, option]));
      return riderIds
        .map((id) => byId.get(id))
        .filter((option): option is EventOption => Boolean(option))
        .map((option) => ({
          ...option,
          description: replaceTinkerTemplateValues(option.description),
        }));
    }

    if (event.id === "TINKER_TIME") {
      return rawOptions.map((option) => ({
        ...option,
        description: replaceTinkerTemplateValues(option.description),
      }));
    }

    if (event.id === "ABYSSAL_BATHS") {
      const bathCount = history.filter((entry) => entry.optionId === "IMMERSE" || entry.optionId === "LINGER").length;
      const nextDamage = ABYSSAL_BATHS_BASE_DAMAGE + bathCount;
      return rawOptions
        .filter((option) => option.id !== "LINGER" || bathCount < ABYSSAL_BATHS_HARD_LIMIT)
        .map((option) => applyAbyssalBathsDamage(option, nextDamage));
    }

    if (event.id === "SLIPPERY_BRIDGE") {
      const holdCount = history.filter((entry) => entry.optionId.startsWith("HOLD_ON")).length;
      const overcomeOption = event.options?.find((option) => option.id === "OVERCOME") ?? null;
      const mergedOptions = currentPageId?.startsWith("HOLD_ON") && overcomeOption
        ? [...rawOptions, overcomeOption]
        : rawOptions;
      return sortSlipperyBridgeOptions(mergedOptions)
        .map((option) => applySlipperyBridgeOption(option, event, holdCount));
    }

    if (event.id === "SELF_HELP_BOOK") {
      const hasReadOption = rawOptions.some((option) => option.id.startsWith("READ_") && !option.id.endsWith("_LOCKED"));
      return rawOptions
        .filter((option) => !(hasReadOption && option.id === "NO_OPTIONS"))
        .map((option) => applyEventOptionDisplayFixups(event, currentPageId, option));
    }

    return rawOptions.map((option) => applyEventOptionDisplayFixups(event, currentPageId, option));
  }, [currentEntry, currentPageId, event, history, rawOptions, trialChoiceOptions]);

  const options = useMemo(
    () => displayOptions.filter((o) => !o.id.endsWith("_LOCKED") && o.title !== "잠김"),
    [displayOptions],
  );

  const defaultTrialNpc = useMemo(() => {
    if (event.id !== "TRIAL" || currentPageId !== TRIAL_CHOICES_PAGE_ID) return null;
    return trialNpcForOptionId(options[0]?.id ?? "");
  }, [currentPageId, event.id, options]);

  useEffect(() => {
    if (event.id !== "TRIAL") return;
    onTrialNpcChange?.(defaultTrialNpc);
    return () => onTrialNpcChange?.(null);
  }, [defaultTrialNpc, event.id, onTrialNpcChange]);

  const previewByOptionId = useMemo(() => {
    const previews = new Map<string, EventPreview>();
    const cardById = new Map(cards.map((card) => [card.id, card]));
    const potionById = new Map((potions ?? []).map((potion) => [potion.id, potion]));
    const relicById = new Map(relics.map((relic) => [relic.id, relic]));
    const potionsByRarity = new Map<PotionRarityKo, CodexPotion[]>();
    for (const potion of potions ?? []) {
      const list = potionsByRarity.get(potion.rarity) ?? [];
      list.push(potion);
      potionsByRarity.set(potion.rarity, list);
    }
    for (const list of potionsByRarity.values()) {
      list.sort((a, b) => a.name.localeCompare(b.name, "ko"));
    }
    const generatedPotionPool = sortPotionsForPreview((potions ?? []).filter(isGeneratedPotionPoolPotion));

    if (currentPageId === "CHOOSE_RIDER") {
      const selectedType = getTinkerSelectedType(currentEntry);
      if (selectedType && madScienceBaseCard) {
        const typeKo = TINKER_CARD_TYPE_TO_KO[selectedType];
        for (const option of options) {
          if (!isTinkerRiderId(option.id)) continue;
          previews.set(
            option.id,
            {
              cards: [getMadSciencePreviewCard(
                madScienceBaseCard,
                selectedType,
                option.id,
                gameUi.cardLibrary.types[typeKo] ?? typeKo,
              )],
            },
          );
        }
      }
    }

    for (const option of options) {
      const preview = previews.get(option.id) ?? {};
      const cardIds = EVENT_OPTION_CARD_PREVIEW_IDS[event.id]?.[option.id] ?? [];
      const relicIds = EVENT_OPTION_RELIC_PREVIEW_IDS[event.id]?.[option.id] ?? [];
      const potionIds = EVENT_OPTION_POTION_PREVIEW_IDS[event.id]?.[option.id] ?? [];
      const cardsForOption = cardIds
        .map((cardId) => cardById.get(cardId))
        .filter((card): card is CodexCard => Boolean(card));
      const relicsForOption = relicIds
        .map((relicId) => relicById.get(relicId))
        .filter((relic): relic is CodexRelic => Boolean(relic));
      const potionsForOption = potionIds
        .map((potionId) => potionById.get(potionId))
        .filter((potion): potion is CodexPotion => Boolean(potion));

      if (event.id === "THE_FUTURE_OF_POTIONS") {
        const rarity = FUTURE_OF_POTIONS_RARITY_BY_OPTION_ID[option.id];
        if (rarity) potionsForOption.push(...(potionsByRarity.get(rarity) ?? []));
      }
      if (event.id === "POTION_COURIER" && option.id === "RANSACK") {
        potionsForOption.push(...(potionsByRarity.get("고급") ?? []).filter(isGeneratedPotionPoolPotion));
      }
      if (optionIdMatches(EVENT_OPTION_GENERATED_RANDOM_POTION_IDS, event.id, option.id)) {
        potionsForOption.push(...generatedPotionPool);
      }

      if (cardsForOption.length > 0) preview.cards = [...(preview.cards ?? []), ...cardsForOption];
      if (relicsForOption.length > 0) preview.relics = [...(preview.relics ?? []), ...relicsForOption];
      if (potionsForOption.length > 0) preview.potions = dedupeById([...(preview.potions ?? []), ...potionsForOption]);
      if (preview.cards?.length || preview.relics?.length || preview.potions?.length) {
        previews.set(option.id, preview);
      }
    }

    return previews;
  }, [cards, currentEntry, currentPageId, event.id, gameUi.cardLibrary.types, madScienceBaseCard, options, potions, relics]);

  const optionLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const opt of event.options ?? []) map.set(opt.id, opt.title);
    for (const page of pages) {
      for (const opt of page.options ?? []) map.set(opt.id, opt.title);
    }
    return map;
  }, [pages, event.options]);

  const canNavigate = useCallback(
    (optionId: string): boolean => {
      if (
        event.id === "TINKER_TIME" &&
        currentPageId === "CHOOSE_CARD_TYPE" &&
        isTinkerCardTypeId(optionId) &&
        pageMap.has("CHOOSE_RIDER")
      ) {
        return true;
      }
      if (event.id === "TRIAL" && optionId === "ACCEPT") {
        return true;
      }
      if (
        event.id === "ENDLESS_CONVEYOR" &&
        ENDLESS_CONVEYOR_DISH_OPTION_IDS.includes(optionId as typeof ENDLESS_CONVEYOR_DISH_OPTION_IDS[number])
      ) {
        return pageMap.has("GRAB_SOMETHING_OFF_THE_BELT");
      }
      if (event.id === "TRIAL") {
        const [caseId, verdictId] = optionId.split("_");
        if (pageMap.has(`${caseId}_${verdictId}`)) return true;
      }
      if (pageMap.has(optionId)) return true;
      if (pageMap.has(`${optionId}1`) || pageMap.has(`${optionId}_1`)) return true;
      if (pageMap.has(`${optionId}0`) || pageMap.has(`${optionId}_0`)) return true;
      return false;
    },
    [currentPageId, event.id, pageMap],
  );

  const navigateTo = useCallback(
    (optionId: string) => {
      const visitCount = history.filter((h) => h.optionId === optionId).length;
      const resolved = resolveEventOptionPage(event.id, currentPageId, optionId, visitCount, pageMap);
      if (!resolved) return;
      onPreviewChange?.(null);
      setHistory((prev) => [...prev, { pageId: resolved, optionId }]);
    },
    [currentPageId, event.id, history, onPreviewChange, pageMap],
  );

  const goBack = useCallback(() => {
    onPreviewChange?.(null);
    setHistory((prev) => prev.slice(0, -1));
  }, [onPreviewChange]);

  const reset = useCallback(() => {
    onPreviewChange?.(null);
    setHistory([]);
  }, [onPreviewChange]);

  const getBreadcrumbLabel = useCallback(
    (entry: NavEntry) => {
      return optionLabelMap.get(entry.optionId) ??
        optionLabelMap.get(entry.pageId) ??
        entry.pageId.replace(/_/g, " ");
    },
    [optionLabelMap],
  );

  const hasPages = pages.filter((p) => p.id !== "INITIAL").length > 0;

  const renderOption = (opt: EventOption) => {
    const navigable = hasPages && canNavigate(opt.id);
    const preview = previewByOptionId.get(opt.id) ?? null;
    const trialNpc = event.id === "TRIAL" ? trialNpcForOptionId(opt.id) : null;
    const showTrialNpc = () => {
      if (trialNpc) onTrialNpcChange?.(trialNpc);
    };
    const restoreTrialNpc = () => {
      if (trialNpc) onTrialNpcChange?.(defaultTrialNpc);
    };
    if (!navigable) {
      return (
        <OptionCard
          key={opt.id}
          backgroundImageUrl={null}
          onHoverEnd={restoreTrialNpc}
          onHoverStart={showTrialNpc}
          option={opt}
          preview={preview}
          onPreviewChange={onPreviewChange}
        />
      );
    }
    return (
      <GameChoiceFrame
        key={opt.id}
        backgroundImageUrl={null}
        onClick={() => navigateTo(opt.id)}
        onHoverEnd={restoreTrialNpc}
        onHoverStart={showTrialNpc}
        preview={preview}
        onPreviewChange={onPreviewChange}
      >
        <div className="font-game-text text-[19px] font-bold leading-[1.05] text-[#d8cb72]">
          <RichText text={opt.title} />
        </div>
        {opt.description && (
          <div className="font-game-text text-[18px] leading-[1.08] text-[#fff6e2]">
            <RichText text={opt.description} />
          </div>
        )}
      </GameChoiceFrame>
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Description */}
      {description && (
        <div
          className="mb-3 font-game-text text-sm leading-[1.65] text-[#fff4dc] sm:text-[15px]"
          style={{ textShadow: GAME_TEXT_SHADOW }}
        >
          <RichText text={description} />
        </div>
      )}

      {/* Breadcrumb */}
      {history.length > 0 && (
        <div
          className="mb-3 flex flex-wrap items-center gap-1.5 font-game-text text-[11px]"
          style={{ textShadow: GAME_TEXT_SHADOW }}
        >
          <button
            onClick={reset}
            className="text-[#b8a98c] transition-colors hover:text-[#f0cf6a]"
          >
            {messages.eventsView.first}
          </button>
          {history.map((entry, i) => (
            <span key={i} className="flex items-center gap-1.5">
              <span className="text-[#7f715a]">›</span>
              <button
                onClick={() => setHistory((prev) => prev.slice(0, i + 1))}
                className={`transition-colors ${
                  i === history.length - 1
                    ? "font-medium text-[#f0cf6a]"
                    : "text-[#b8a98c] hover:text-[#f0cf6a]"
                }`}
              >
                {getBreadcrumbLabel(entry)}
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Options */}
      {options.length > 0 && (
        <div className="mt-auto space-y-2.5 pt-5">
          {options.map(renderOption)}
        </div>
      )}

      {/* Back button */}
      {history.length > 0 && (
        <button
          onClick={goBack}
          className="mt-3 flex items-center gap-1 font-game-text text-[11px] text-[#b8a98c] transition-colors hover:text-[#f0cf6a]"
          style={{ textShadow: GAME_TEXT_SHADOW }}
        >
          <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
            <path d="M9.78 12.78a.75.75 0 01-1.06 0L4.47 8.53a.75.75 0 010-1.06l4.25-4.25a.75.75 0 011.06 1.06L6.06 8l3.72 3.72a.75.75 0 010 1.06z" />
          </svg>
          {messages.eventsView.previous}
        </button>
      )}
    </div>
  );
}

// --- Event detail page (game-like: background art with right-side event text) ---
interface EventDetailProps {
  serviceLocale: ServiceLocale;
  gameUi: CodexGameUiLabels;
  event: CodexEvent;
  cards?: CodexCard[];
  enchantments?: CodexEnchantment[];
  madScienceBaseCard?: CodexCard | null;
  potions?: CodexPotion[];
  powers?: CodexPower[];
  relics?: CodexRelic[];
  patches?: STS2Patch[];
  changes?: STS2Change[];
  versionDiffs?: EntityVersionDiff[];
  onClose?: () => void;
}

function EventPotionSetPreview({ potions }: { potions: CodexPotion[] }) {
  const columns = Math.min(5, Math.max(1, Math.ceil(Math.sqrt(potions.length))));

  return (
    <div className="drop-shadow-[0_18px_30px_rgba(0,0,0,0.75)]">
      <div
        className="grid max-w-[320px] gap-2"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {potions.map((potion) => (
          <div
            key={potion.id}
            className="relative flex h-12 w-12 items-center justify-center sm:h-14 sm:w-14"
          >
            <Image
              src={potion.imageUrl}
              alt={potion.name}
              width={56}
              height={56}
              className="h-11 w-11 object-contain sm:h-12 sm:w-12"
              style={{
                filter: `${characterOutlineFilter(potion.pool) ?? "drop-shadow(0 3px 5px rgba(0,0,0,0.65))"} drop-shadow(0 0 12px rgba(236,254,255,0.45))`,
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function EventRelicSetPreview({ relics }: { relics: CodexRelic[] }) {
  const visibleRelics = relics.filter((relic): relic is CodexRelic & { imageUrl: string } => Boolean(relic.imageUrl));
  const columns = Math.min(5, Math.max(1, Math.ceil(Math.sqrt(visibleRelics.length))));
  if (visibleRelics.length === 0) return null;

  return (
    <div className="drop-shadow-[0_18px_30px_rgba(0,0,0,0.75)]">
      <div
        className="grid max-w-[320px] gap-2"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {visibleRelics.map((relic) => (
          <div
            key={relic.id}
            className="relative flex h-12 w-12 items-center justify-center sm:h-14 sm:w-14"
          >
            <Image
              src={relic.imageUrl}
              alt={relic.name}
              width={56}
              height={56}
              className="h-11 w-11 object-contain sm:h-12 sm:w-12"
              style={{
                filter: `${characterOutlineFilter(relic.pool) ?? "drop-shadow(0 3px 5px rgba(0,0,0,0.65))"} drop-shadow(0 0 12px rgba(255,232,154,0.42))`,
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function EventCardSetPreview({
  cards,
  serviceLocale,
}: {
  cards: CodexCard[];
  serviceLocale: ServiceLocale;
}) {
  const columns = cards.length >= 4 ? 4 : Math.max(1, cards.length);

  return (
    <div
      className="grid max-w-[560px] gap-2 drop-shadow-[0_22px_40px_rgba(0,0,0,0.70)]"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {cards.map((card) => (
        <div key={card.id} className="w-[104px] sm:w-[118px]">
          <CardTile
            card={card}
            showUpgrade={false}
            showBeta={false}
            width={118}
            interactive={false}
            serviceLocale={serviceLocale}
          />
        </div>
      ))}
    </div>
  );
}

function EventSpriteSheetOverlay({ overlay }: { overlay: SpriteSheetEventArtOverlay }) {
  const totalFrames = overlay.framesX * overlay.framesY;
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (totalFrames <= 1) return;
    const timer = window.setInterval(() => {
      setFrame((current) => (current + 1) % totalFrames);
    }, overlay.intervalMs ?? 100);
    return () => window.clearInterval(timer);
  }, [overlay.intervalMs, totalFrames]);

  const column = frame % overlay.framesX;
  const row = Math.floor(frame / overlay.framesX);
  const x = overlay.framesX <= 1 ? 0 : (column / (overlay.framesX - 1)) * 100;
  const y = overlay.framesY <= 1 ? 0 : (row / (overlay.framesY - 1)) * 100;

  return (
    <span
      data-event-sprite-sheet={overlay.src}
      className={overlay.className}
      style={{
        ...overlay.style,
        backgroundImage: `url('${overlay.src}')`,
        backgroundPosition: `${x}% ${y}%`,
        backgroundSize: `${overlay.framesX * 100}% ${overlay.framesY * 100}%`,
      }}
      aria-hidden
    />
  );
}

function EventArtLayers({ overlays }: { overlays: EventArtOverlay[] }) {
  return overlays.map((overlay, overlayIndex) => (
    overlay.kind === "sprite-sheet" ? (
      <EventSpriteSheetOverlay
        key={`${overlay.src}-${overlayIndex}`}
        overlay={overlay}
      />
    ) : (
      <Image
        key={`${overlay.src}-${overlayIndex}`}
        src={overlay.src}
        alt={overlay.alt}
        fill={overlay.fill}
        width={overlay.width}
        height={overlay.height}
        className={overlay.className}
        style={overlay.style}
        aria-hidden={overlay.alt === "" ? true : undefined}
      />
    )
  ));
}

function GameViewportEventArt({
  children,
  eventName,
  imageUrl,
  overlays,
  priority,
}: {
  children?: ReactNode;
  eventName: string;
  imageUrl: string;
  overlays: EventArtOverlay[];
  priority: boolean;
}) {
  return (
    <div className="absolute left-1/2 top-1/2 aspect-video w-full -translate-x-1/2 -translate-y-1/2 overflow-hidden sm:inset-0 sm:aspect-auto sm:w-auto sm:translate-x-0 sm:translate-y-0">
      <div className="absolute" style={EVENT_GAME_VIEWPORT_PORTRAIT_STYLE}>
        <Image
          src={imageUrl}
          alt={eventName}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1536px) calc(100vw - 3rem), 1472px"
          className="object-contain"
          priority={priority}
        />
        <EventArtLayers overlays={overlays} />
        {children}
      </div>
    </div>
  );
}

function TrialNpcBackground({ overlay }: { overlay: TrialNpcOverlay }) {
  const npcOverlay = eventVfxSpriteOverlay({
    anchor: "trial",
    className: "z-10 opacity-95 drop-shadow-[0_24px_28px_rgba(0,0,0,0.60)]",
    height: 1288,
    scale: 0.5,
    src: overlay.imageUrl,
    width: 996,
    x: 568,
    y: 778,
  });
  const lightOverlay = eventVfxSpriteOverlay({
    anchor: "trial",
    className: "opacity-28 mix-blend-screen",
    height: 2400,
    scale: 0.72,
    src: `${EVENT_VFX_ROOT}/trial_stand_light.webp`,
    width: 1251,
    x: 583,
    y: 541,
  });

  return (
    <>
      <Image
        src={lightOverlay.src}
        alt=""
        width={lightOverlay.width}
        height={lightOverlay.height}
        className={lightOverlay.className}
        style={lightOverlay.style}
        aria-hidden
      />
      <Image
        src={npcOverlay.src}
        alt=""
        width={npcOverlay.width}
        height={npcOverlay.height}
        className={npcOverlay.className}
        style={npcOverlay.style}
        aria-hidden
      />
    </>
  );
}

function EventSpineOverlay({ config }: { config: EventSpineOverlayConfig }) {
  return (
    <div className={`pointer-events-none absolute ${config.className}`} aria-hidden>
      <MonsterSpineStage
        asset={config.asset}
        fallbackImageUrl={config.fallbackImageUrl}
        fallbackImageClassName="absolute inset-0 z-10 h-full w-full object-contain drop-shadow-2xl"
        imagePriority={false}
        monsterName={config.monsterName}
        selectedMoveId={null}
        showLoadingLabel={false}
        viewportPadding={config.viewportPadding}
        viewportTransitionTime={0}
        className="relative h-full w-full"
      />
    </div>
  );
}

function EventPreviewOverlay({
  preview,
  serviceLocale,
}: {
  preview: EventPreview;
  serviceLocale: ServiceLocale;
}) {
  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 sm:left-[27%]">
      <div className="flex max-h-[78%] max-w-[92vw] flex-col items-center justify-center gap-3">
        {preview.cards?.length ? (
          <EventCardSetPreview cards={preview.cards} serviceLocale={serviceLocale} />
        ) : null}
        {preview.relics?.length ? <EventRelicSetPreview relics={preview.relics} /> : null}
        {preview.potions?.length ? <EventPotionSetPreview potions={preview.potions} /> : null}
      </div>
    </div>
  );
}

export function EventDetail({
  serviceLocale,
  gameUi,
  event,
  cards = [],
  enchantments = [],
  madScienceBaseCard,
  potions,
  powers = [],
  relics = [],
  patches,
  changes,
  versionDiffs,
  onClose,
}: EventDetailProps) {
  const serviceText = getCodexServiceMessages(serviceLocale);
  const detailLabels = serviceLocale === "ko"
    ? { englishName: "영어명", patchHistory: "패치 이력", noPatchHistory: "구조화 변경 없음" }
    : { englishName: "English name", patchHistory: "Patch History", noPatchHistory: "No structured changes" };
  const isModal = Boolean(onClose);
  const [preview, setPreview] = useState<EventPreview | null>(null);
  const [commentCount, setCommentCount] = useState(0);
  const [trialNpcOverlay, setTrialNpcOverlay] = useState<TrialNpcOverlay | null>(null);
  const artOverlays = EVENT_ART_OVERLAYS[event.id] ?? [];
  const useFakeMerchantSpineArt = event.id === "FAKE_MERCHANT";
  const eventSpineOverlays = EVENT_SPINE_OVERLAYS[event.id] ?? [];
  const eventImageUrl = event.id === "TRIAL"
    ? "/images/sts2/events/trial_started.webp"
    : event.imageUrl;
  const eventTypeLabel = serviceLocale === "ko" ? "이벤트" : "Event";
  const eventActLabel = getEventActs(event)
    .map((act) => act ? gameUi.acts[act] : serviceText.labels.acts.none)
    .join(" / ");
  const rootClassName = isModal
    ? "mx-auto w-full max-w-[92rem] p-3 sm:p-4"
    : "mx-auto w-full max-w-[92rem] p-4 sm:p-6";
  const detailStackClassName = isModal
    ? "flex flex-col gap-3 sm:gap-4"
    : "flex flex-col gap-5";
  const stageSectionClassName = isModal
    ? "flex min-h-[22rem] min-w-0 items-center justify-center py-1"
    : "flex min-h-[22rem] min-w-0 items-center justify-center py-2";
  const stageFrameClassName = isModal
    ? "relative min-w-0 w-full overflow-hidden rounded-xl bg-black shadow-2xl ring-1 ring-white/10 lg:max-w-[min(100%,calc((100vh-21rem)*16/9))]"
    : "relative min-w-0 w-full overflow-hidden rounded-xl bg-black shadow-2xl ring-1 ring-white/10";
  const textPanelClassName = isModal
    ? "absolute inset-x-4 bottom-4 top-4 flex min-w-0 flex-col sm:inset-x-auto sm:bottom-[2%] sm:right-[3.5%] sm:top-[3%] sm:w-[45%] sm:min-w-[380px] sm:max-w-[560px]"
    : "absolute inset-x-4 bottom-4 top-4 flex min-w-0 flex-col sm:inset-x-auto sm:bottom-[6%] sm:right-[3.5%] sm:top-[7%] sm:w-[45%] sm:min-w-[380px] sm:max-w-[540px]";
  const relatedMadScienceCards = event.id === TINKER_TIME_EVENT_ID && madScienceBaseCard
    ? TINKER_CARD_TYPES.map((cardType) => {
        const id = getMadScienceVariantId(cardType);
        const typeKo = TINKER_CARD_TYPE_TO_KO[cardType];
        const typeLabel = gameUi.cardLibrary.types[typeKo] ?? typeKo;
        const card = {
          ...getMadSciencePreviewCard(
            madScienceBaseCard,
            cardType,
            getDefaultTinkerRiderForType(cardType),
            typeLabel,
          ),
          id,
        };
        return {
          card,
          href: `/compendium/cards/${id.toLowerCase()}`,
          id,
          title: card.name,
        };
      })
    : [];
  const cardById = new Map(cards.map((card) => [card.id, card]));
  const enchantmentById = new Map(enchantments.map((enchantment) => [enchantment.id, enchantment]));
  const powerById = new Map(powers.map((power) => [power.id, power]));
  const relicById = new Map(relics.map((relic) => [relic.id, relic]));
  const relatedCardTargets = [
    ...getRelatedCardIdsForEvent(event.id)
      .map((cardId) => cardById.get(cardId))
      .filter((card): card is CodexCard => Boolean(card))
      .map(cardToReferenceTarget),
    ...relatedMadScienceCards.map(({ card, href, id, title }) => ({
      href,
      id,
      title,
      entity: {
        id,
        nameEn: card.nameEn,
        nameKo: title,
        imageUrl: card.imageUrl,
        href,
        color: card.color,
        type: "card" as const,
        cardData: card,
      },
    })),
  ];
  const relatedRelicTargets = getRelatedRelicIdsForEvent(event.id)
    .map((relicId) => relicById.get(relicId))
    .filter((relic): relic is CodexRelic => Boolean(relic))
    .map(relicToReferenceTarget);
  const relatedEnchantmentTargets = getRelatedEnchantmentIdsForEvent(event.id)
    .map((enchantmentId) => enchantmentById.get(enchantmentId))
    .filter((enchantment): enchantment is CodexEnchantment => Boolean(enchantment))
    .map(enchantmentToReferenceTarget);
  const relatedPowerTargets = getRelatedPowerIdsForEvent(event.id)
    .map((powerId) => powerById.get(powerId))
    .filter((power): power is CodexPower => Boolean(power))
    .map(powerToReferenceTarget);
  const potionById = new Map((potions ?? []).map((potion) => [potion.id, potion]));
  const relatedPotionBase = getRelatedPotionIdsForEvent(event.id)
    .map((potionId) => potionById.get(potionId))
    .filter((potion): potion is CodexPotion => Boolean(potion));
  const relatedPotionPool = event.id === FUTURE_OF_POTIONS_EVENT_ID && potions
    ? potions
    : event.id === "POTION_COURIER" && potions
      ? [
          ...relatedPotionBase,
          ...potions.filter((potion) => potion.rarity === "고급"),
        ]
      : relatedPotionBase;
  const relatedPotionTargets = dedupeById(relatedPotionPool).map(potionToReferenceTarget);

  return (
    <div className={rootClassName}>
      <div className="flex items-center justify-between gap-3">
        <Link
          href={localizeHref("/compendium/events", serviceLocale)}
          className="text-sm text-gray-400 transition-colors hover:text-gray-200"
          onClick={(e) => {
            if (onClose) { e.preventDefault(); onClose(); }
          }}
        >
          ← {serviceText.eventsView.backToList}
        </Link>
        {onClose && (
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-white/10"
            aria-label={serviceText.common.close}
          >
            ✕
          </button>
        )}
      </div>

      <div className={detailStackClassName}>
        <section className={stageSectionClassName}>
          <div
            className={stageFrameClassName}
            style={{ boxShadow: `inset 0 0 120px rgba(96, 165, 250, 0.08), 0 16px 60px rgba(0, 0, 0, 0.35)` }}
          >
            <div
              data-event-art-stage={event.id}
              className="relative h-[34rem] w-full sm:h-auto sm:aspect-video"
            >
              {useFakeMerchantSpineArt ? (
                <div className="absolute left-1/2 top-1/2 aspect-video w-full -translate-x-1/2 -translate-y-1/2 overflow-hidden sm:inset-0 sm:aspect-auto sm:w-auto sm:translate-x-0 sm:translate-y-0">
                  <FakeMerchantSpineStage
                    fallbackImageUrl="/images/sts2/events/fake_merchant.webp"
                  />
                </div>
              ) : eventImageUrl ? (
                <GameViewportEventArt
                  eventName={event.name}
                  imageUrl={eventImageUrl}
                  overlays={artOverlays}
                  priority={Boolean(onClose)}
                >
                  {trialNpcOverlay && <TrialNpcBackground overlay={trialNpcOverlay} />}
                </GameViewportEventArt>
              ) : (
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_35%,rgba(96,165,250,0.20),transparent_34%),linear-gradient(135deg,#111827,#050505_65%)]" />
              )}
              {eventSpineOverlays.map((config) => (
                <EventSpineOverlay key={config.asset.id} config={config} />
              ))}
              <div className="absolute inset-0 bg-gradient-to-l from-black/80 via-black/30 to-transparent" />
              {preview && <EventPreviewOverlay preview={preview} serviceLocale={serviceLocale} />}
              <div className={textPanelClassName}>
                <div className="relative flex min-h-0 flex-1 flex-col">
                  <div className="pointer-events-none absolute -inset-6 rounded-full bg-black/35 blur-2xl" />
                  <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto pr-2 [scrollbar-width:none] 2xl:overflow-y-clip [&::-webkit-scrollbar]:hidden">
                    <h1
                      className="font-game-title text-3xl font-bold leading-tight text-[#f3c640]"
                      style={{ textShadow: GAME_TEXT_SHADOW }}
                    >
                      {event.name}
                    </h1>
                    <EventContentViewer
                      cards={cards}
                      event={event}
                      gameUi={gameUi}
                      madScienceBaseCard={madScienceBaseCard}
                      messages={serviceText}
                      onPreviewChange={setPreview}
                      onTrialNpcChange={setTrialNpcOverlay}
                      potions={potions}
                      relics={relics}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <aside className="grid gap-3 lg:grid-cols-[minmax(16rem,20rem)_minmax(0,1fr)] xl:grid-cols-[minmax(16rem,20rem)_minmax(0,1fr)_minmax(18rem,1fr)_minmax(18rem,1fr)] xl:items-start">
          <section className="rounded-lg border border-white/10 bg-black/20 px-4 py-3">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <MetaPill value={eventTypeLabel} color="#f3c640" />
                <MetaPill value={eventActLabel} color="#60a5fa" />
              </div>
              {event.nameEn !== event.name && (
                <div>
                  <div className="mb-1 text-[10px] uppercase tracking-wider text-gray-500">{detailLabels.englishName}</div>
                  <div className="font-game-text text-sm text-gray-300">{event.nameEn}</div>
                </div>
              )}
            </div>
          </section>

          <EntityReferenceGroupLinks
            gameUi={gameUi}
            groups={[
              { kind: "card", targets: relatedCardTargets },
              { kind: "relic", targets: relatedRelicTargets },
              { kind: "enchantment", targets: relatedEnchantmentTargets },
              { kind: "power", targets: relatedPowerTargets },
              { kind: "potion", targets: relatedPotionTargets },
            ]}
            serviceLocale={serviceLocale}
          />

          <InfoRailSection title={detailLabels.patchHistory}>
            <STS2ChangeHistory
              serviceLocale={serviceLocale}
              entityType="event"
              entityId={event.id}
              changes={changes}
              versionDiffs={versionDiffs}
              patches={patches}
              introducedInPatch={event.introducedInPatch}
              deprecatedInPatch={event.deprecatedInPatch}
              emptyLabel={detailLabels.noPatchHistory}
            />
          </InfoRailSection>

          <InfoRailSection title={`${serviceText.common.comments}${commentCount > 0 ? ` (${commentCount})` : ""}`}>
            <CommentSection
              threadKey={buildCodexCommentThreadKey("event", event.id)}
              onCountChange={setCommentCount}
            />
          </InfoRailSection>
        </aside>
      </div>
    </div>
  );
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

function relicToReferenceTarget(relic: CodexRelic): CodexReferenceTarget {
  const href = `/compendium/relics/${relic.id.toLowerCase()}`;
  return {
    href,
    id: relic.id,
    title: relic.name,
    entity: {
      id: relic.id,
      nameEn: relic.nameEn,
      nameKo: relic.name,
      imageUrl: relic.imageUrl,
      href,
      color: relic.pool,
      type: "relic",
      relicData: relic,
    },
  };
}

function enchantmentToReferenceTarget(enchantment: CodexEnchantment): CodexReferenceTarget {
  const href = `/compendium/enchantments/${enchantment.id.toLowerCase()}`;
  return {
    href,
    id: enchantment.id,
    title: enchantment.name,
    entity: {
      id: enchantment.id,
      nameEn: enchantment.nameEn,
      nameKo: enchantment.name,
      imageUrl: enchantment.imageUrl,
      href,
      color: enchantment.cardType ?? "Any",
      type: "enchantment",
      enchantmentData: enchantment,
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

function potionToReferenceTarget(potion: CodexPotion): CodexReferenceTarget {
  const href = `/compendium/potions/${potion.id.toLowerCase()}`;
  return {
    href,
    id: potion.id,
    title: potion.name,
    entity: {
      id: potion.id,
      nameEn: potion.nameEn,
      nameKo: potion.name,
      imageUrl: potion.imageUrl,
      href,
      color: potion.rarity,
      type: "potion",
      potionData: potion,
    },
  };
}
