"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "@/components/ui/static-image";
import { CommentSection } from "@/components/comment-section";
import { LikeButton } from "@/components/like-button";
import { useAuth } from "@/hooks/use-auth";
import { buildCodexCommentThreadKey } from "@/lib/comment-threads";
import type { ServiceLocale } from "@/lib/i18n";
import type { EntityVersionDiff, STS2Change, STS2Patch } from "@/lib/types";
import type { CodexGameUiLabels } from "@/lib/codex-game-ui";
import { localizeHref } from "@/lib/i18n";
import { getCodexServiceMessages } from "@/lib/codex-service";
import {
  CodexAffliction,
  CodexAncient,
  CodexCard,
  CodexEnchantment,
  CodexEvent,
  CodexMonster,
  CodexPotion,
  CodexPower,
  getCharacterColor,
} from "@/lib/codex-types";
import { CardTile } from "./card-tile";
import { DescriptionText, hasCardUpgrade } from "./codex-description";
import { GameChoiceFrame } from "./event-choice-frame";
import { GameCheckboxToggle } from "./game-checkbox";
import { HoverTip, HoverTipVariant } from "./hover-tip";
import { RichText } from "@/components/rich-text";
import { CARD_WIDTH_PRESET } from "@/lib/sts2-card-style";
import {
  getDefaultTinkerRiderForType,
  getMadScienceCardTypeFromId,
  getMadSciencePreviewCard,
  getTinkerRiderIdsForType,
  MAD_SCIENCE_DEFAULT_RIDER,
  MAD_SCIENCE_DEFAULT_TYPE,
  TINKER_RIDER_CHOICE_LABELS,
  replaceTinkerTemplateValues,
  type TinkerRiderId,
} from "@/lib/tinker-time";
import {
  TINKER_TIME_EVENT_ID,
  TINKER_TIME_EVENT_NAME_KO,
  TINKER_TIME_EVENT_PATH,
  getRelatedAncientIdsForCard,
  getRelatedEnchantmentIdsForCard,
  getRelatedEventIdsForCard,
  getRelatedMonsterIdsForCard,
  getRelatedPotionIdsForCard,
  getRelatedPowerIdsForCard,
} from "@/lib/codex-references";
import {
  canEnchantCard,
  shouldShowAmount,
  DEFAULT_ENCHANT_AMOUNT,
  getEnchantAddedKeywords,
  getEnchantRemovedKeywords,
  getEnchantForcedCost,
  substituteAmount,
  getEnchantAmountPresets,
  getEnchantStatModifier,
} from "@/lib/sts2-enchant-rules";
import {
  canAfflictCard,
  getAfflictionAddedKeywords,
  getAfflictionDescriptionSuffix,
  getAfflictionForcedCost,
  getAfflictionPreviewAmount,
} from "@/lib/sts2-affliction-rules";
import { EntityReferenceGroupLinks, type CodexReferenceTarget } from "./entity-reference-links";
import { STS2ChangeHistory } from "./sts2-change-history";

const ENCHANT_TIP_VARIANT: Record<string, HoverTipVariant> = {
  CORRUPTED: "debuff",
  GOOPY: "debuff",
};

function getEnchantTipVariant(enchant: CodexEnchantment): HoverTipVariant {
  if (ENCHANT_TIP_VARIANT[enchant.id]) return ENCHANT_TIP_VARIANT[enchant.id];
  if (enchant.cardType === "Attack") return "buff";
  return "default";
}

function getAfflictionTipVariant(_affliction: CodexAffliction): HoverTipVariant {
  void _affliction;
  return "debuff";
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

const CARD_RARITY_COLORS: Record<CodexCard["rarity"], string> = {
  기본: "#8b8b8b",
  일반: "#b0b0b0",
  고급: "#4fc3f7",
  희귀: "#ffd740",
  "고대의 존재": "#60a5fa",
  이벤트: "#ce93d8",
  토큰: "#81c784",
  저주: "#a78bfa",
  상태이상: "#ef4444",
  퀘스트: "#fbbf24",
};

const CARD_TYPE_COLORS: Record<CodexCard["type"], string> = {
  공격: "#ef4444",
  스킬: "#60a5fa",
  파워: "#c084fc",
  저주: "#a78bfa",
  상태이상: "#ef4444",
  퀘스트: "#fbbf24",
};

function getCardPoolLabel(
  card: CodexCard,
  serviceText: ReturnType<typeof getCodexServiceMessages>,
): string {
  if (card.rarity === "고대의 존재") return serviceText.labels.pools.ancient;

  switch (card.color) {
    case "ironclad":
    case "silent":
    case "defect":
    case "necrobinder":
    case "regent":
    case "colorless":
    case "event":
    case "curse":
    case "status":
      return serviceText.labels.pools[card.color];
    case "token":
      return serviceText.labels.cardRarities.토큰;
    case "quest":
      return serviceText.labels.cardRarities.퀘스트;
    default:
      return card.color;
  }
}

function getCardPoolColor(card: CodexCard): string | undefined {
  if (card.rarity === "고대의 존재") return "#60a5fa";
  if (card.color === "event") return "#ce93d8";
  if (card.color === "curse") return "#a78bfa";
  if (card.color === "status") return "#ef4444";
  if (card.color === "token") return "#81c784";
  if (card.color === "quest") return "#fbbf24";
  return getCharacterColor(card.color);
}

function getCardCostLabel(
  card: CodexCard,
  showUpgrade: boolean,
  serviceLocale: ServiceLocale,
): string {
  const upgradedCost = showUpgrade && hasCardUpgrade(card) ? card.upgrade?.cost : undefined;
  const cost = typeof upgradedCost === "number" ? upgradedCost : card.cost;
  const energyCost = card.isXCost ? "X" : cost >= 0 ? String(cost) : null;
  const starCost = card.starCost !== null ? `★ ${card.starCost}` : null;
  return [energyCost, starCost].filter(Boolean).join(" / ") || (
    serviceLocale === "ko" ? "비용 없음" : "No cost"
  );
}

interface CardDetailProps {
  serviceLocale: ServiceLocale;
  gameUi: CodexGameUiLabels;
  card: CodexCard;
  enchantments: CodexEnchantment[];
  afflictions: CodexAffliction[];
  relatedAncients?: CodexAncient[];
  relatedEvents?: CodexEvent[];
  relatedMonsters?: CodexMonster[];
  relatedPotions?: CodexPotion[];
  relatedPowers?: CodexPower[];
  patches?: STS2Patch[];
  changes?: STS2Change[];
  versionDiffs?: EntityVersionDiff[];
  onClose?: () => void;
}

function getCardDetailLabels(serviceLocale: ServiceLocale) {
  return serviceLocale === "ko"
    ? {
        patchHistory: "패치 이력",
        noPatchHistory: "구조화 변경 없음",
        englishName: "영어명",
      }
    : {
        patchHistory: "Patch History",
        noPatchHistory: "No structured changes",
        englishName: "English name",
      };
}

export function CardDetail({ serviceLocale, gameUi, card, enchantments, afflictions, relatedAncients = [], relatedEvents = [], relatedMonsters = [], relatedPotions = [], relatedPowers = [], patches, changes, versionDiffs, onClose }: CardDetailProps) {
  const serviceText = getCodexServiceMessages(serviceLocale);
  const detailLabels = getCardDetailLabels(serviceLocale);
  const { userId, ready: authReady, unavailable: authUnavailable } = useAuth();
  const threadKey = buildCodexCommentThreadKey("card", card.id);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showBeta, setShowBeta] = useState(false);
  const [activeEnchantId, setActiveEnchantId] = useState<string | null>(null);
  const [hoveredEnchantId, setHoveredEnchantId] = useState<string | null>(null);
  const [activeAfflictionId, setActiveAfflictionId] = useState<string | null>(null);
  const [hoveredAfflictionId, setHoveredAfflictionId] = useState<string | null>(null);
  const [enchantAmount, setEnchantAmount] = useState<number>(DEFAULT_ENCHANT_AMOUNT);
  const [madScienceRider, setMadScienceRider] = useState<TinkerRiderId>(MAD_SCIENCE_DEFAULT_RIDER);
  const [isDesktop, setIsDesktop] = useState(false);
  const [commentCount, setCommentCount] = useState(0);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const fixedMadScienceType = getMadScienceCardTypeFromId(card.id);
  const isMadScience = fixedMadScienceType !== null;
  const madScienceType = fixedMadScienceType ?? MAD_SCIENCE_DEFAULT_TYPE;
  const madScienceRiderIds = getTinkerRiderIdsForType(madScienceType);
  const effectiveMadScienceRider = madScienceRiderIds.includes(madScienceRider)
    ? madScienceRider
    : getDefaultTinkerRiderForType(madScienceType);
  const previewCard = isMadScience
    ? getMadSciencePreviewCard(
      card,
      madScienceType,
      effectiveMadScienceRider,
      card.typeLabel,
    )
    : card;

  // 게임 CanEnchant 룰 그대로 적용 (카드별 가능 인챈트만 표시)
  const eligibleEnchantments = enchantments.filter((e) => canEnchantCard(e, previewCard));
  const eligibleAfflictions = afflictions.filter((a) => canAfflictCard(a, previewCard));

  const activeEnchant = eligibleEnchantments.find((e) => e.id === activeEnchantId) ?? null;
  const activeAffliction = eligibleAfflictions.find((a) => a.id === activeAfflictionId) ?? null;
  const activeAfflictionAmount = getAfflictionPreviewAmount(activeAffliction);

  const hoveredEnchant = eligibleEnchantments.find((e) => e.id === hoveredEnchantId) ?? null;
  const hoveredAffliction = eligibleAfflictions.find((a) => a.id === hoveredAfflictionId) ?? null;
  const hoveredAfflictionAmount = getAfflictionPreviewAmount(hoveredAffliction);

  const cardWidth = isDesktop ? CARD_WIDTH_PRESET.detail : CARD_WIDTH_PRESET.hover;
  const canShowUpgrade = hasCardUpgrade(previewCard);
  const relatedEventIds = [
    ...getRelatedEventIdsForCard(card.id),
    ...(isMadScience ? [TINKER_TIME_EVENT_ID] : []),
  ].filter((eventId, index, eventIds) => eventIds.indexOf(eventId) === index);
  const relatedEventTargets = relatedEventIds.map((eventId) => {
    const relatedEvent = relatedEvents.find((event) => event.id === eventId) ?? null;
    const href = eventId === TINKER_TIME_EVENT_ID
      ? TINKER_TIME_EVENT_PATH
      : `/compendium/events/${eventId.toLowerCase()}`;
    const title = eventId === TINKER_TIME_EVENT_ID
      ? card.madScienceLabels?.eventTitle ?? relatedEvent?.name ?? TINKER_TIME_EVENT_NAME_KO
      : relatedEvent?.name ?? eventId;
    return {
      id: eventId,
      href,
      title,
      entity: {
        id: eventId,
        nameEn: relatedEvent?.nameEn ?? title,
        nameKo: title,
        imageUrl: relatedEvent?.imageUrl ?? null,
        href,
        color: "event",
        type: "event" as const,
        eventData: relatedEvent ?? undefined,
      },
    };
  });
  const ancientById = new Map(relatedAncients.map((ancient) => [ancient.id, ancient]));
  const relatedAncientTargets = getRelatedAncientIdsForCard(card, relatedAncients)
    .map((ancientId) => ancientById.get(ancientId))
    .filter((ancient): ancient is CodexAncient => Boolean(ancient))
    .map(ancientToReferenceTarget);
  const monsterById = new Map(relatedMonsters.map((monster) => [monster.id, monster]));
  const relatedMonsterTargets = getRelatedMonsterIdsForCard(card, relatedMonsters)
    .map((monsterId) => monsterById.get(monsterId))
    .filter((monster): monster is CodexMonster => Boolean(monster))
    .map(monsterToReferenceTarget);
  const powerById = new Map(relatedPowers.map((power) => [power.id, power]));
  const relatedPowerTargets = getRelatedPowerIdsForCard(card)
    .map((powerId) => powerById.get(powerId))
    .filter((power): power is CodexPower => Boolean(power))
    .map(powerToReferenceTarget);
  const potionById = new Map(relatedPotions.map((potion) => [potion.id, potion]));
  const relatedPotionTargets = getRelatedPotionIdsForCard(card.id)
    .map((potionId) => potionById.get(potionId))
    .filter((potion): potion is CodexPotion => Boolean(potion))
    .map(potionToReferenceTarget);
  const enchantmentById = new Map(enchantments.map((enchantment) => [enchantment.id, enchantment]));
  const relatedEnchantmentTargets = getRelatedEnchantmentIdsForCard(card.id)
    .map((enchantmentId) => enchantmentById.get(enchantmentId))
    .filter((enchantment): enchantment is CodexEnchantment => Boolean(enchantment))
    .map(enchantmentToReferenceTarget);

  // 활성 인챈트 효과: amount 치환, 추가/제거 키워드, forced cost, stat modifier
  const activeShowAmount = activeEnchant ? shouldShowAmount(activeEnchant) : false;
  const activePresets = activeEnchant ? getEnchantAmountPresets(activeEnchant) : [];
  const isSown = activeEnchant?.id?.toUpperCase() === "SOWN";
  const activeExtraText = activeEnchant
    ? substituteAmount(activeEnchant.extraCardText, enchantAmount, { asEnergyIcon: isSown })
    : null;
  const activeAddedKeywords = activeEnchant
    ? getEnchantAddedKeywords(activeEnchant, enchantAmount)
    : [];
  const activeRemovedKeywords = activeEnchant ? getEnchantRemovedKeywords(activeEnchant) : [];
  const activeForcedCost = activeEnchant ? getEnchantForcedCost(activeEnchant) : null;
  const activeStatMod = activeEnchant ? getEnchantStatModifier(activeEnchant, enchantAmount) : null;
  const activeAfflictionExtraText = activeAffliction
    ? getAfflictionDescriptionSuffix(activeAffliction, activeAfflictionAmount)
    : null;
  const activeAfflictionAddedKeywords = activeAffliction
    ? getAfflictionAddedKeywords(activeAffliction)
    : [];
  const activeDescriptionSuffix = [activeExtraText, activeAfflictionExtraText]
    .filter((text): text is string => Boolean(text))
    .join("\n") || null;
  const activeAddedKeywordsWithAffliction = [
    ...activeAddedKeywords,
    ...activeAfflictionAddedKeywords.filter((keyword) => !activeAddedKeywords.includes(keyword)),
  ];
  const activeForcedCostWithAffliction = getAfflictionForcedCost(activeAffliction, previewCard, {
    showUpgrade,
    enchantForcedCost: activeForcedCost,
    amount: activeAfflictionAmount,
  });

  // hover 시 보여줄 미리보기 amount는 hovered 인챈트의 자체 프리셋을 쓴다.
  // 활성 인챈트 위에 hover한 경우만 사용자가 고른 amount 그대로.
  // (→ 활성 인챈트 amount가 다른 인챈트 description에 새는 버그 방지)
  const hoveredAmount = hoveredEnchant
    ? hoveredEnchant.id === activeEnchantId
      ? enchantAmount
      : getEnchantAmountPresets(hoveredEnchant)[0] ?? DEFAULT_ENCHANT_AMOUNT
    : DEFAULT_ENCHANT_AMOUNT;
  const hoveredDesc = hoveredEnchant
    ? substituteAmount(hoveredEnchant.description, hoveredAmount, {
        asEnergyIcon: hoveredEnchant.id?.toUpperCase() === "SOWN",
      }) ?? hoveredEnchant.description
    : null;
  const hoveredAfflictionDesc = hoveredAffliction
    ? substituteAmount(hoveredAffliction.description, hoveredAfflictionAmount, {
        asEnergyIcon: hoveredAffliction.id?.toUpperCase() === "ENTANGLED",
      }) ?? hoveredAffliction.description
    : null;

  // 캐러셀: 좌/우 스크롤 가능 여부에 따라 게임 노란 화살표 노출
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const update = () => {
      setCanScrollLeft(el.scrollLeft > 4);
      setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [eligibleEnchantments.length]);

  const scrollBy = (dir: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.7, behavior: "smooth" });
  };

  const handleEnchantWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    const el = event.currentTarget;
    if (el.scrollWidth <= el.clientWidth) return;

    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY)
      ? event.deltaX
      : event.deltaY;
    if (delta === 0) return;

    const atStart = el.scrollLeft <= 1;
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1;
    if ((delta < 0 && atStart) || (delta > 0 && atEnd)) return;

    event.preventDefault();
    el.scrollLeft += delta;
  };

  const afflictionScrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollAfflictionLeft, setCanScrollAfflictionLeft] = useState(false);
  const [canScrollAfflictionRight, setCanScrollAfflictionRight] = useState(false);
  useEffect(() => {
    const el = afflictionScrollerRef.current;
    if (!el) return;
    const update = () => {
      setCanScrollAfflictionLeft(el.scrollLeft > 4);
      setCanScrollAfflictionRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [eligibleAfflictions.length]);

  const scrollAfflictionsBy = (dir: -1 | 1) => {
    const el = afflictionScrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.7, behavior: "smooth" });
  };

  const handleAfflictionWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    const el = event.currentTarget;
    if (el.scrollWidth <= el.clientWidth) return;

    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY)
      ? event.deltaX
      : event.deltaY;
    if (delta === 0) return;

    const atStart = el.scrollLeft <= 1;
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1;
    if ((delta < 0 && atStart) || (delta > 0 && atEnd)) return;

    event.preventDefault();
    el.scrollLeft += delta;
  };

  const poolLabel = getCardPoolLabel(previewCard, serviceText);
  const poolColor = getCardPoolColor(previewCard);
  const costLabel = getCardCostLabel(previewCard, showUpgrade, serviceLocale);
  const metaPills = [
    { value: gameUi.cardLibrary.types[previewCard.type], color: CARD_TYPE_COLORS[previewCard.type] },
    { value: gameUi.cardLibrary.rarities[previewCard.rarity], color: CARD_RARITY_COLORS[previewCard.rarity] },
    { value: poolLabel, color: poolColor },
    { value: costLabel, color: "#facc15" },
  ].filter((pill, index, pills) => (
    pills.findIndex((candidate) => candidate.value === pill.value) === index
  ));
  const madScienceChoices = isMadScience ? (
    <div className="w-full max-w-2xl space-y-2.5">
      {madScienceRiderIds.map((riderId) => {
        const active = effectiveMadScienceRider === riderId;
        const description = replaceTinkerTemplateValues(
          card.madScienceLabels?.riderChoiceDescriptions[riderId] ?? "",
        );
        return (
          <GameChoiceFrame
            key={riderId}
            active={active}
            onClick={() => setMadScienceRider(riderId)}
          >
            <div className="font-game-text text-[19px] font-bold leading-[1.05] text-[#d8cb72]">
              <RichText text={card.madScienceLabels?.riderChoiceLabels[riderId] ?? TINKER_RIDER_CHOICE_LABELS[riderId]} />
            </div>
            {description && (
              <div className="font-game-text text-[18px] leading-[1.08] text-[#fff6e2]">
                <RichText text={description} />
              </div>
            )}
          </GameChoiceFrame>
        );
      })}
    </div>
  ) : null;

  return (
    <div className="mx-auto w-full max-w-6xl p-4 sm:p-6">
      <div className="mb-4 flex w-full items-center justify-between gap-3">
        <Link
          href={localizeHref("/compendium/cards", serviceLocale)}
          className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
          onClick={(e) => {
            if (onClose) {
              e.preventDefault();
              onClose();
            }
          }}
        >
          ← {gameUi.cardLibraryTitle}
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

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)] lg:items-start">
        <section className="flex min-h-[34rem] flex-col items-center justify-center gap-4 py-4">
          {/* 카드 + hover popover (popover는 카드 우측, 캐러셀은 카드 아래라 안 겹침).
              활성 인챈트가 있으면 카드 hover 시에도 그 인챈트의 툴팁이 뜨고,
              카드 슬롯 클릭으로 해제 가능. */}
          <div
            className="relative"
            style={{ width: cardWidth }}
            onMouseEnter={() => {
              if (activeAfflictionId) setHoveredAfflictionId(activeAfflictionId);
              else if (activeEnchantId) setHoveredEnchantId(activeEnchantId);
            }}
            onMouseLeave={() => {
              setHoveredEnchantId((cur) => (cur === activeEnchantId ? null : cur));
              setHoveredAfflictionId((cur) => (cur === activeAfflictionId ? null : cur));
            }}
          >
          <CardTile
            card={previewCard}
            serviceLocale={serviceLocale}
            showUpgrade={showUpgrade}
            showBeta={showBeta}
            width={cardWidth}
            enchantmentImageUrl={activeEnchant?.imageUrl ?? null}
            enchantmentLabel={activeEnchant?.name ?? null}
            enchantmentAmount={activeShowAmount ? enchantAmount : null}
            forcedCost={activeForcedCostWithAffliction}
            enchantAddedKeywords={activeAddedKeywordsWithAffliction}
            enchantRemovedKeywords={activeRemovedKeywords}
            descriptionSuffix={activeDescriptionSuffix}
            enchantStatMod={activeStatMod}
            afflictionId={activeAffliction?.id ?? null}
            onEnchantSlotClick={() => {
              setActiveEnchantId(null);
              setEnchantAmount(DEFAULT_ENCHANT_AMOUNT);
              setHoveredEnchantId(null);
            }}
          />
          {hoveredEnchant && (
            <div
              className="hidden md:block"
              style={{
                position: "absolute",
                top: 0,
                left: "calc(100% + 16px)",
                // 콘텐츠 자연 폭(가장 긴 줄) 에 맞춰 호버팁이 줄어들도록 max-content + maxWidth.
                width: "max-content",
                maxWidth: 280,
                pointerEvents: "none",
                zIndex: 50,
              }}
            >
              <HoverTip
                title={hoveredEnchant.name}
                icon={hoveredEnchant.imageUrl ?? undefined}
                variant={getEnchantTipVariant(hoveredEnchant)}
              >
                <DescriptionText
                  description={hoveredDesc ?? hoveredEnchant.description}
                  className="block text-left"
                />
              </HoverTip>
            </div>
          )}
          {hoveredAffliction && (
            <div
              className="hidden md:block"
              style={{
                position: "absolute",
                top: 0,
                left: "calc(100% + 16px)",
                width: "max-content",
                maxWidth: 280,
                pointerEvents: "none",
                zIndex: 51,
              }}
            >
              <HoverTip
                title={hoveredAffliction.name}
                icon={hoveredAffliction.imageUrl ?? undefined}
                variant={getAfflictionTipVariant(hoveredAffliction)}
              >
                <DescriptionText
                  description={hoveredAfflictionDesc ?? hoveredAffliction.description}
                  className="block text-left"
                />
              </HoverTip>
            </div>
          )}
          </div>

          {/* 강화 / 베타 토글 — 카드 바로 아래 */}
          {(canShowUpgrade || card.betaImageUrl) && (
            <div className="flex flex-wrap items-center justify-center gap-2">
              {canShowUpgrade && (
                <GameCheckboxToggle
                  checked={showUpgrade}
                  onCheckedChange={setShowUpgrade}
                  label={gameUi.cardLibrary.viewUpgrades}
                  size="md"
                />
              )}
              {card.betaImageUrl && (
                <GameCheckboxToggle
                  checked={showBeta}
                  onCheckedChange={setShowBeta}
                  label={serviceText.cardsView.toggles.betaArt}
                  size="md"
                />
              )}
            </div>
          )}

          {madScienceChoices}

          {/* 인챈트 캐러셀 */}
          {eligibleEnchantments.length > 0 && (
            <div className="w-full max-w-3xl flex flex-col gap-2">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-sm font-bold text-gray-300">
                  {serviceText.cardsView.enchantments.possible} ({eligibleEnchantments.length})
                </h2>
                <div className="flex items-center gap-3">
                  {activeEnchant && activePresets.length > 1 && (
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="text-gray-500">amount</span>
                      <div className="flex gap-1">
                        {activePresets.map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setEnchantAmount(n)}
                            className={`min-w-[1.75em] px-1.5 py-0.5 rounded border transition-all ${
                              enchantAmount === n
                                ? "bg-yellow-500/20 text-yellow-300 border-yellow-500/60"
                                : "bg-white/5 text-gray-400 border-white/10 hover:border-white/30"
                            }`}
                            aria-pressed={enchantAmount === n}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {activeEnchant && (
                    <button
                      onClick={() => {
                        setActiveEnchantId(null);
                        setHoveredEnchantId(null);
                      }}
                      className="text-xs text-gray-500 hover:text-gray-300"
                    >
                      {serviceText.cardsView.enchantments.remove}
                    </button>
                  )}
                </div>
              </div>

              {/* 화살표는 캐러셀 바깥(좌우 32px 마진 영역)에 배치. 캐러셀 자체는 mx-10. */}
              <div className="relative">
                {canScrollLeft && (
                  <button
                    type="button"
                    aria-label={serviceText.cardsView.enchantments.previous}
                    onClick={() => scrollBy(-1)}
                    className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 flex items-center justify-center hover:scale-110 transition-transform drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]"
                  >
                    <Image
                      src="/images/sts2/ui/settings_tiny_left_arrow.png"
                      alt=""
                      width={32}
                      height={32}
                      className="object-contain"
                    />
                  </button>
                )}
                {canScrollRight && (
                  <button
                    type="button"
                    aria-label={serviceText.cardsView.enchantments.next}
                    onClick={() => scrollBy(1)}
                    className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 flex items-center justify-center hover:scale-110 transition-transform drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]"
                  >
                    <Image
                      src="/images/sts2/ui/settings_tiny_right_arrow.png"
                      alt=""
                      width={32}
                      height={32}
                      className="object-contain"
                    />
                  </button>
                )}

                <div
                  ref={scrollerRef}
                  data-testid="enchant-carousel"
                  onWheel={handleEnchantWheel}
                  className="mx-10 flex gap-2 overflow-x-auto scroll-smooth py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                  {eligibleEnchantments.map((e) => {
                    const active = activeEnchantId === e.id;
                    return (
                      <button
                        key={e.id}
                        onClick={() => {
                          setActiveEnchantId((prev) => {
                            if (prev === e.id) return null;
                            const presets = getEnchantAmountPresets(e);
                            if (presets.length > 0 && !presets.includes(enchantAmount)) {
                              setEnchantAmount(presets[0]);
                            }
                            return e.id;
                          });
                        }}
                        onMouseEnter={() => {
                          setHoveredAfflictionId(null);
                          setHoveredEnchantId(e.id);
                        }}
                        onMouseLeave={() =>
                          setHoveredEnchantId((cur) => (cur === e.id ? null : cur))
                        }
                        onFocus={() => {
                          setHoveredAfflictionId(null);
                          setHoveredEnchantId(e.id);
                        }}
                        onBlur={() =>
                          setHoveredEnchantId((cur) => (cur === e.id ? null : cur))
                        }
                        className={`shrink-0 w-20 flex flex-col items-center gap-1 p-2 rounded-lg border transition-all ${
                          active
                            ? "bg-yellow-500/15 border-yellow-500/60 ring-1 ring-yellow-500/30"
                            : "bg-white/5 border-white/10 hover:border-white/30"
                        }`}
                        aria-pressed={active}
                        title={e.name}
                      >
                        {e.imageUrl ? (
                          <div className="relative w-10 h-10">
                            <Image
                              src={e.imageUrl}
                              alt={e.name}
                              fill
                              className="object-contain"
                            />
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded bg-white/5" />
                        )}
                        <span className="text-[10px] text-gray-200 text-center leading-tight line-clamp-2">
                          {e.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* 고난 캐러셀 */}
          {eligibleAfflictions.length > 0 && (
            <div className="w-full max-w-3xl flex flex-col gap-2">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-sm font-bold text-gray-300">
                  {serviceText.cardsView.afflictions.possible} ({eligibleAfflictions.length})
                </h2>
                {activeAffliction && (
                  <button
                    onClick={() => {
                      setActiveAfflictionId(null);
                      setHoveredAfflictionId(null);
                    }}
                    className="text-xs text-gray-500 hover:text-gray-300"
                  >
                    {serviceText.cardsView.afflictions.remove}
                  </button>
                )}
              </div>

              <div className="relative">
                {canScrollAfflictionLeft && (
                  <button
                    type="button"
                    aria-label={serviceText.cardsView.afflictions.previous}
                    onClick={() => scrollAfflictionsBy(-1)}
                    className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 flex items-center justify-center hover:scale-110 transition-transform drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]"
                  >
                    <Image
                      src="/images/sts2/ui/settings_tiny_left_arrow.png"
                      alt=""
                      width={32}
                      height={32}
                      className="object-contain"
                    />
                  </button>
                )}
                {canScrollAfflictionRight && (
                  <button
                    type="button"
                    aria-label={serviceText.cardsView.afflictions.next}
                    onClick={() => scrollAfflictionsBy(1)}
                    className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 flex items-center justify-center hover:scale-110 transition-transform drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]"
                  >
                    <Image
                      src="/images/sts2/ui/settings_tiny_right_arrow.png"
                      alt=""
                      width={32}
                      height={32}
                      className="object-contain"
                    />
                  </button>
                )}

                <div
                  ref={afflictionScrollerRef}
                  data-testid="affliction-carousel"
                  onWheel={handleAfflictionWheel}
                  className="mx-10 flex gap-2 overflow-x-auto scroll-smooth py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                  {eligibleAfflictions.map((a) => {
                    const active = activeAfflictionId === a.id;
                    return (
                      <button
                        key={a.id}
                        onClick={() => {
                          setActiveAfflictionId((prev) => (prev === a.id ? null : a.id));
                        }}
                        onMouseEnter={() => {
                          setHoveredEnchantId(null);
                          setHoveredAfflictionId(a.id);
                        }}
                        onMouseLeave={() =>
                          setHoveredAfflictionId((cur) => (cur === a.id ? null : cur))
                        }
                        onFocus={() => {
                          setHoveredEnchantId(null);
                          setHoveredAfflictionId(a.id);
                        }}
                        onBlur={() =>
                          setHoveredAfflictionId((cur) => (cur === a.id ? null : cur))
                        }
                        className={`shrink-0 w-20 flex flex-col items-center gap-1 p-2 rounded-lg border transition-all ${
                          active
                            ? "bg-red-500/15 border-red-400/60 ring-1 ring-red-400/30"
                            : "bg-white/5 border-white/10 hover:border-white/30"
                        }`}
                        aria-pressed={active}
                        title={a.name}
                      >
                        {a.imageUrl ? (
                          <div className="relative w-10 h-10">
                            <Image
                              src={a.imageUrl}
                              alt={a.name}
                              fill
                              className="object-contain"
                            />
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded bg-white/5" />
                        )}
                        <span className="text-[10px] text-gray-200 text-center leading-tight line-clamp-2">
                          {a.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </section>

        <aside className="flex flex-col gap-3">
          <section className="rounded-lg border border-white/10 bg-black/20 px-4 py-3">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {metaPills.map((pill) => (
                  <MetaPill key={pill.value} value={pill.value} color={pill.color} />
                ))}
              </div>
              {previewCard.nameEn !== previewCard.name && (
                <div>
                  <div className="mb-1 text-[10px] uppercase tracking-wider text-gray-500">{detailLabels.englishName}</div>
                  <div className="font-game-text text-sm text-gray-300">{previewCard.nameEn}</div>
                </div>
              )}
            </div>
          </section>

          <EntityReferenceGroupLinks
            groups={[
              { kind: "ancient", targets: relatedAncientTargets },
              { kind: "event", targets: relatedEventTargets },
              { kind: "monster", targets: relatedMonsterTargets },
              { kind: "enchantment", targets: relatedEnchantmentTargets },
              { kind: "power", targets: relatedPowerTargets },
              { kind: "potion", targets: relatedPotionTargets },
            ]}
            serviceLocale={serviceLocale}
          />

          <InfoRailSection title={detailLabels.patchHistory}>
            <STS2ChangeHistory
              serviceLocale={serviceLocale}
              entityType="card"
              entityId={card.id}
              changes={changes}
              versionDiffs={versionDiffs}
              patches={patches}
              emptyLabel={detailLabels.noPatchHistory}
            />
          </InfoRailSection>

          <InfoRailSection title={`${serviceText.common.comments}${commentCount > 0 ? ` (${commentCount})` : ""}`}>
            <div className="mb-3 flex justify-end">
              <LikeButton
                storyId={threadKey}
                userId={userId}
                authReady={authReady}
                authUnavailable={authUnavailable}
              />
            </div>
            <CommentSection threadKey={threadKey} onCountChange={setCommentCount} />
          </InfoRailSection>
        </aside>
      </div>
    </div>
  );
}

function ancientToReferenceTarget(ancient: CodexAncient): CodexReferenceTarget {
  const href = `/compendium/ancients/${ancient.id.toLowerCase()}`;
  return {
    href,
    id: ancient.id,
    title: ancient.name,
    entity: {
      id: ancient.id,
      nameEn: ancient.nameEn,
      nameKo: ancient.name,
      imageUrl: ancient.imageUrl,
      href,
      color: ancient.act ?? "ancient",
      type: "ancient",
      ancientData: ancient,
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

function monsterToReferenceTarget(monster: CodexMonster): CodexReferenceTarget {
  const href = `/compendium/monsters/${monster.id.toLowerCase()}`;
  return {
    href,
    id: monster.id,
    title: monster.name,
    entity: {
      id: monster.id,
      nameEn: monster.nameEn,
      nameKo: monster.name,
      imageUrl: monster.imageUrl ?? monster.bossImageUrl,
      href,
      color: monster.type,
      type: "monster",
      monsterData: monster,
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
