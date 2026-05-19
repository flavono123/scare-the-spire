"use client";

import { useState, useMemo, useCallback } from "react";
import type { CSSProperties } from "react";
import Image from "@/components/ui/static-image";
import Link from "next/link";
import { CommentSection } from "@/components/comment-section";
import { buildCodexCommentThreadKey } from "@/lib/comment-threads";
import type { ServiceLocale } from "@/lib/i18n";
import { localizeHref } from "@/lib/i18n";
import type { CodexGameUiLabels } from "@/lib/codex-game-ui";
import {
  getCodexServiceMessages,
  type CodexServiceMessages,
} from "@/lib/codex-service";
import {
  CodexCard,
  CodexEvent,
  CodexPotion,
  EventOption,
  EventPage,
  PotionRarityKo,
  characterOutlineFilter,
} from "@/lib/codex-types";
import { RichText } from "@/components/rich-text";
import { CardTile } from "@/components/codex/card-tile";
import { GameChoiceFrame } from "@/components/codex/event-choice-frame";
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
import { TINKER_TIME_EVENT_ID } from "@/lib/codex-references";
import { EntityReferenceLinks } from "./entity-reference-links";

const GAME_TEXT_SHADOW = "3px 2px 0 rgba(0,0,0,0.5), 0 0 12px rgba(0,0,0,0.75)";

const ABYSSAL_BATHS_BASE_DAMAGE = 3;
const ABYSSAL_BATHS_HARD_LIMIT = 15;
const TABLET_OF_TRUTH_MAX_HP_REMAINING_LABEL_KO = "현재 최대 체력 - 1";
const TABLET_OF_TRUTH_MAX_HP_REMAINING_LABEL_EN = "current Max HP - 1";
const TRIAL_CHOICES_PAGE_ID = "__TRIAL_CHOICES__";

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
    imageUrl: "/images/sts2/events/trial_merchant.webp",
  },
  {
    id: "NOBLE",
    imageUrl: "/images/sts2/events/trial_noble.webp",
  },
  {
    id: "NONDESCRIPT",
    imageUrl: "/images/sts2/events/trial_nondescript.webp",
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

type EventPreview =
  | { kind: "card"; card: CodexCard }
  | { kind: "potions"; potions: CodexPotion[]; rarity: PotionRarityKo };

interface EventArtOverlay {
  alt: string;
  className: string;
  fill?: boolean;
  height?: number;
  src: string;
  style?: CSSProperties;
  width?: number;
}

const EVENT_VFX_CANVAS_WIDTH = 2160;
const EVENT_VFX_CANVAS_HEIGHT = 1000;
const EVENT_VFX_ROOT = "/images/sts2/event-vfx";

function eventVfxSpriteOverlay({
  className = "",
  height,
  scale = 1,
  src,
  style,
  width,
  x,
  y,
}: {
  className?: string;
  height: number;
  scale?: number;
  src: string;
  style?: CSSProperties;
  width: number;
  x: number;
  y: number;
}): EventArtOverlay {
  const scaledWidth = width * scale;
  const scaledHeight = height * scale;

  return {
    alt: "",
    className: `pointer-events-none absolute object-contain ${className}`.trim(),
    height,
    src,
    style: {
      height: `${(scaledHeight / EVENT_VFX_CANVAS_HEIGHT) * 100}%`,
      left: `${((x - scaledWidth / 2) / EVENT_VFX_CANVAS_WIDTH) * 100}%`,
      top: `${((y - scaledHeight / 2) / EVENT_VFX_CANVAS_HEIGHT) * 100}%`,
      width: `${(scaledWidth / EVENT_VFX_CANVAS_WIDTH) * 100}%`,
      ...style,
    },
    width,
  };
}

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
      className: "opacity-55 mix-blend-screen",
      height: 536,
      scale: 1.3,
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
    eventVfxSpriteOverlay({
      className: "opacity-80 drop-shadow-[0_0_18px_rgba(255,214,110,0.25)]",
      height: 532,
      src: `${EVENT_VFX_ROOT}/tablet_of_truth_rock.webp`,
      width: 2128,
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
      className: "opacity-95",
      height: 1200,
      scale: 0.94,
      src: `${EVENT_VFX_ROOT}/trial_top_layer.webp`,
      width: 2560,
      x: 952,
      y: 532,
    }),
    eventVfxSpriteOverlay({
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

function applyEventOptionDisplayFixups(
  event: CodexEvent,
  currentPageId: string | null,
  option: EventOption,
): EventOption {
  if (event.id === "BATTLEWORN_DUMMY") return applyBattlewornDummyOption(option, event);
  if (event.id === "HUNGRY_FOR_MUSHROOMS") return applyHungryForMushroomsDescription(option, event);
  if (event.id === "TABLET_OF_TRUTH") return applyTabletOfTruthCost(option, currentPageId, event);
  return option;
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

function trialChoiceBackgroundImageUrl(optionId: string): string | null {
  const trialCase = TRIAL_CHOICE_CASES.find((entry) => optionId.startsWith(`${entry.id}_`));
  return trialCase?.imageUrl ?? null;
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
  if (eventId === "TRIAL" && optionId === "ACCEPT") {
    return TRIAL_CHOICES_PAGE_ID;
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
  onPreviewChange,
  option,
  preview,
}: {
  backgroundImageUrl?: string | null;
  onPreviewChange?: (preview: EventPreview | null) => void;
  option: EventOption;
  preview?: EventPreview | null;
}) {
  return (
    <GameChoiceFrame
      backgroundImageUrl={backgroundImageUrl}
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
  event,
  gameUi,
  madScienceBaseCard,
  messages,
  onPreviewChange,
  potions,
}: {
  event: CodexEvent;
  gameUi: CodexGameUiLabels;
  madScienceBaseCard?: CodexCard | null;
  messages: CodexServiceMessages;
  onPreviewChange?: (preview: EventPreview | null) => void;
  potions?: CodexPotion[];
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

  const description = event.id === "TRIAL" && currentPageId === TRIAL_CHOICES_PAGE_ID
    ? null
    : currentPage?.description ?? event.description;

  const rawOptions = useMemo(() => {
    if (!currentPageId) return event.options ?? [];
    const page = pageMap.get(currentPageId);
    if (page?.options && page.options.length > 0) return page.options;
    if (allPage?.options && allPage.options.length > 0) return allPage.options;
    return [];
  }, [currentPageId, pageMap, event.options, allPage]);

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

    return rawOptions.map((option) => applyEventOptionDisplayFixups(event, currentPageId, option));
  }, [currentEntry, currentPageId, event, history, rawOptions, trialChoiceOptions]);

  const options = useMemo(
    () => displayOptions.filter((o) => !o.id.endsWith("_LOCKED") && o.title !== "잠김"),
    [displayOptions],
  );

  const previewByOptionId = useMemo(() => {
    const previews = new Map<string, EventPreview>();

    if (event.id === "THE_FUTURE_OF_POTIONS" && potions && potions.length > 0) {
      const potionsByRarity = new Map<PotionRarityKo, CodexPotion[]>();
      for (const potion of potions) {
        const list = potionsByRarity.get(potion.rarity) ?? [];
        list.push(potion);
        potionsByRarity.set(potion.rarity, list);
      }
      for (const list of potionsByRarity.values()) {
        list.sort((a, b) => a.name.localeCompare(b.name, "ko"));
      }
      for (const option of options) {
        const rarity = FUTURE_OF_POTIONS_RARITY_BY_OPTION_ID[option.id];
        if (!rarity) continue;
        previews.set(option.id, {
          kind: "potions",
          potions: potionsByRarity.get(rarity) ?? [],
          rarity,
        });
      }
      return previews;
    }

    if (event.id !== "TINKER_TIME" || !madScienceBaseCard) return previews;

    if (currentPageId === "CHOOSE_RIDER") {
      const selectedType = getTinkerSelectedType(currentEntry);
      if (!selectedType) return previews;
      const typeKo = TINKER_CARD_TYPE_TO_KO[selectedType];
      for (const option of options) {
        if (!isTinkerRiderId(option.id)) continue;
        previews.set(
          option.id,
          {
            kind: "card",
            card: getMadSciencePreviewCard(
              madScienceBaseCard,
              selectedType,
              option.id,
              gameUi.cardLibrary.types[typeKo] ?? typeKo,
            ),
          },
        );
      }
    }

    return previews;
  }, [currentEntry, currentPageId, event.id, gameUi.cardLibrary.types, madScienceBaseCard, options, potions]);

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
    const backgroundImageUrl = event.id === "TRIAL"
      ? trialChoiceBackgroundImageUrl(opt.id)
      : null;
    if (!navigable) {
      return (
        <OptionCard
          key={opt.id}
          backgroundImageUrl={backgroundImageUrl}
          option={opt}
          preview={preview}
          onPreviewChange={onPreviewChange}
        />
      );
    }
    return (
      <GameChoiceFrame
        key={opt.id}
        backgroundImageUrl={backgroundImageUrl}
        onClick={() => navigateTo(opt.id)}
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
  madScienceBaseCard?: CodexCard | null;
  potions?: CodexPotion[];
  onClose?: () => void;
}

function EventPotionSetPreview({ potions }: { potions: CodexPotion[] }) {
  const columns = Math.min(5, Math.max(1, Math.ceil(Math.sqrt(potions.length))));

  return (
    <div
      className="grid max-w-[320px] gap-2 drop-shadow-[0_18px_30px_rgba(0,0,0,0.75)]"
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
      {preview.kind === "card" ? (
        <div className="w-[150px] drop-shadow-[0_22px_40px_rgba(0,0,0,0.70)] sm:w-[158px]">
          <CardTile
            card={preview.card}
            showUpgrade={false}
            showBeta={false}
            width={158}
            interactive={false}
            serviceLocale={serviceLocale}
          />
        </div>
      ) : (
        <EventPotionSetPreview potions={preview.potions} />
      )}
    </div>
  );
}

export function EventDetail({
  serviceLocale,
  gameUi,
  event,
  madScienceBaseCard,
  potions,
  onClose,
}: EventDetailProps) {
  const serviceText = getCodexServiceMessages(serviceLocale);
  const isModal = Boolean(onClose);
  const [preview, setPreview] = useState<EventPreview | null>(null);
  const artOverlays = EVENT_ART_OVERLAYS[event.id] ?? [];
  const eventImageUrl = event.id === "TRIAL"
    ? "/images/sts2/events/trial_started.webp"
    : event.imageUrl;
  const rootClassName = isModal
    ? "mx-auto flex max-w-[92rem] flex-col gap-4 p-3 sm:p-5"
    : "mx-auto flex max-w-6xl flex-col gap-5 p-4 sm:p-6";
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
          title: `${card.name}(${typeLabel})`,
        };
      })
    : [];

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

      <section
        className="relative overflow-hidden rounded-xl border border-white/10 bg-black shadow-2xl"
        style={{ boxShadow: `inset 0 0 120px rgba(96, 165, 250, 0.08), 0 16px 60px rgba(0, 0, 0, 0.35)` }}
      >
        <div className="relative aspect-[3440/1616] min-h-[620px] w-full sm:min-h-0">
          {eventImageUrl ? (
            <>
              <Image
                src={eventImageUrl}
                alt={event.name}
                fill
                sizes="(max-width: 768px) 100vw, 1152px"
                className="object-contain"
                priority={Boolean(onClose)}
              />
              {artOverlays.map((overlay, overlayIndex) => (
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
              ))}
            </>
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_35%,rgba(96,165,250,0.20),transparent_34%),linear-gradient(135deg,#111827,#050505_65%)]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-l from-black/80 via-black/30 to-transparent" />
          {preview && <EventPreviewOverlay preview={preview} serviceLocale={serviceLocale} />}
          <div className={textPanelClassName}>
            <div className="relative flex min-h-0 flex-1 flex-col">
              <div className="pointer-events-none absolute -inset-6 rounded-full bg-black/35 blur-2xl" />
              <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto pr-2">
                <h1
                  className="font-game-title text-3xl font-bold leading-tight text-[#f3c640]"
                  style={{ textShadow: GAME_TEXT_SHADOW }}
                >
                  {event.name}
                </h1>
                <EventContentViewer
                  event={event}
                  gameUi={gameUi}
                  madScienceBaseCard={madScienceBaseCard}
                  messages={serviceText}
                  onPreviewChange={setPreview}
                  potions={potions}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <EntityReferenceLinks
        kind="card"
        serviceLocale={serviceLocale}
        targets={relatedMadScienceCards.map(({ card, href, id, title }) => ({
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
            type: "card",
            cardData: card,
          },
        }))}
      />

      <aside className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <h2 className="mb-3 text-sm font-bold text-gray-300">{serviceText.common.comments}</h2>
        <CommentSection threadKey={buildCodexCommentThreadKey("event", event.id)} />
      </aside>
    </div>
  );
}
