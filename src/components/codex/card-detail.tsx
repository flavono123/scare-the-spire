"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import Image from "@/components/ui/static-image";
import { CommentSection } from "@/components/comment-section";
import { buildCodexCommentThreadKey } from "@/lib/comment-threads";
import {
  CodexCard,
  CodexEnchantment,
  COLOR_LABELS,
  CardFilterCategory,
  CHARACTER_COLORS,
} from "@/lib/codex-types";
import { CardTile } from "./card-tile";
import { DescriptionText } from "./codex-description";
import { HoverTip, HoverTipVariant } from "./hover-tip";
import { CARD_WIDTH_PRESET } from "@/lib/sts2-card-style";
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

const ENCHANT_TIP_VARIANT: Record<string, HoverTipVariant> = {
  CORRUPTED: "debuff",
  GOOPY: "debuff",
};

function getEnchantTipVariant(enchant: CodexEnchantment): HoverTipVariant {
  if (ENCHANT_TIP_VARIANT[enchant.id]) return ENCHANT_TIP_VARIANT[enchant.id];
  if (enchant.cardType === "Attack") return "buff";
  return "default";
}

function getColorLabel(card: CodexCard): string {
  if (card.rarity === "고대의 존재") return "고대의 존재";
  const cat = (card.color === "event" ? "event" : card.color) as CardFilterCategory;
  return COLOR_LABELS[cat] ?? card.color;
}

function StatBadge({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
      <span className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</span>
      <span className="text-sm font-bold" style={color ? { color } : undefined}>
        {value}
      </span>
    </div>
  );
}

interface CardDetailProps {
  card: CodexCard;
  enchantments: CodexEnchantment[];
  onClose?: () => void;
}

export function CardDetail({ card, enchantments, onClose }: CardDetailProps) {
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showBeta, setShowBeta] = useState(false);
  const [activeEnchantId, setActiveEnchantId] = useState<string | null>(null);
  const [hoveredEnchantId, setHoveredEnchantId] = useState<string | null>(null);
  const [enchantAmount, setEnchantAmount] = useState<number>(DEFAULT_ENCHANT_AMOUNT);
  // 모바일은 카드를 더 작게 띄워 sticky 시 화면을 덜 가린다.
  // SSR 첫 페인트는 모바일 기준이라 hydration 안전.
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const costDisplay = card.isXCost ? "X" : String(card.cost);
  const charColor = CHARACTER_COLORS[card.color];

  // 게임 CanEnchant 룰 그대로 적용 (카드별 가능 인챈트만 표시)
  const eligibleEnchantments = useMemo(
    () => enchantments.filter((e) => canEnchantCard(e, card)),
    [enchantments, card]
  );

  const activeEnchant = useMemo(
    () => eligibleEnchantments.find((e) => e.id === activeEnchantId) ?? null,
    [eligibleEnchantments, activeEnchantId]
  );

  const hoveredEnchant = useMemo(
    () => eligibleEnchantments.find((e) => e.id === hoveredEnchantId) ?? null,
    [eligibleEnchantments, hoveredEnchantId]
  );

  const cardWidth = isDesktop ? CARD_WIDTH_PRESET.detail : CARD_WIDTH_PRESET.hover;

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

  // 툴팁 description은 amount 치환 적용 (hovered 카드는 enchant 안 붙어 있어도 미리보기 amount 사용)
  const hoveredDesc = hoveredEnchant
    ? substituteAmount(hoveredEnchant.description, enchantAmount, {
        asEnergyIcon: hoveredEnchant.id?.toUpperCase() === "SOWN",
      }) ?? hoveredEnchant.description
    : null;

  // 카드 + 메타 정보 (좌측 컬럼 / 모바일 sticky top)
  const cardPanel = (
    <div className="flex flex-col items-center gap-3">
      {/* Card는 고정 위치 + 팝오버는 absolute로 카드 우측에 떠 카드 위치를 흔들지 않음 */}
      <div className="relative" style={{ width: cardWidth }}>
        <CardTile
          card={card}
          showUpgrade={showUpgrade}
          showBeta={showBeta}
          width={cardWidth}
          enchantmentImageUrl={activeEnchant?.imageUrl ?? null}
          enchantmentLabel={activeEnchant?.name ?? null}
          enchantmentAmount={activeShowAmount ? enchantAmount : null}
          forcedCost={activeForcedCost}
          enchantAddedKeywords={activeAddedKeywords}
          enchantRemovedKeywords={activeRemovedKeywords}
          descriptionSuffix={activeExtraText}
          enchantStatMod={activeStatMod}
        />
        {hoveredEnchant && (
          <div
            className="hidden md:block"
            style={{
              position: "absolute",
              top: 0,
              left: "calc(100% + 16px)",
              width: 280,
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
                className="block text-center"
              />
            </HoverTip>
          </div>
        )}
      </div>

      {/* Card Name */}
      <div className="text-center">
        <h1 className="text-xl md:text-2xl font-bold text-gray-100">{card.name}</h1>
        <p className="text-xs md:text-sm text-gray-500">{card.nameEn}</p>
      </div>

      {/* Stats Row */}
      <div className="flex flex-wrap justify-center gap-1.5">
        <StatBadge label="유형" value={card.type} />
        <StatBadge label="희귀도" value={card.rarity} />
        <StatBadge label="비용" value={costDisplay} />
        <StatBadge label="캐릭터" value={getColorLabel(card)} color={charColor} />
        {card.damage !== null && (
          <StatBadge label="피해" value={String(card.damage)} color="#ef5350" />
        )}
        {card.block !== null && (
          <StatBadge label="방어도" value={String(card.block)} color="#4fc3f7" />
        )}
        {card.hitCount !== null && card.hitCount > 1 && (
          <StatBadge label="타격" value={`${card.hitCount}회`} />
        )}
      </div>

      {/* Keywords */}
      {card.keywords.length > 0 && (
        <div className="flex flex-wrap justify-center gap-1.5">
          {card.keywords.map((kw) => (
            <span
              key={kw}
              className="px-2 py-0.5 text-xs rounded-full bg-yellow-500/15 text-yellow-400 border border-yellow-500/30"
            >
              {kw}
            </span>
          ))}
        </div>
      )}

      {/* Toggles */}
      {(card.upgrade || card.betaImageUrl) && (
        <div className="flex gap-2">
          {card.upgrade && (
            <button
              onClick={() => setShowUpgrade((v) => !v)}
              className={`px-3 py-1 text-xs rounded-lg border transition-all ${
                showUpgrade
                  ? "bg-green-500/20 text-green-400 border-green-500/50"
                  : "bg-white/5 text-gray-400 border-white/10 hover:border-white/30"
              }`}
            >
              강화 보기
            </button>
          )}
          {card.betaImageUrl && (
            <button
              onClick={() => setShowBeta((v) => !v)}
              className={`px-3 py-1 text-xs rounded-lg border transition-all ${
                showBeta
                  ? "bg-purple-500/20 text-purple-400 border-purple-500/50"
                  : "bg-white/5 text-gray-400 border-white/10 hover:border-white/30"
              }`}
            >
              베타 아트
            </button>
          )}
        </div>
      )}
    </div>
  );

  // 인챈트 패널 (우측 컬럼 / 모바일 카드 아래)
  const enchantPanel = eligibleEnchantments.length > 0 ? (
    <div className="flex flex-col gap-2 w-full min-w-0">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-sm font-bold text-gray-300">
          가능한 인챈트 ({eligibleEnchantments.length})
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
              onClick={() => setActiveEnchantId(null)}
              className="text-xs text-gray-500 hover:text-gray-300"
            >
              해제
            </button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-3 lg:grid-cols-4 gap-2">
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
              onMouseEnter={() => setHoveredEnchantId(e.id)}
              onMouseLeave={() =>
                setHoveredEnchantId((cur) => (cur === e.id ? null : cur))
              }
              onFocus={() => setHoveredEnchantId(e.id)}
              onBlur={() =>
                setHoveredEnchantId((cur) => (cur === e.id ? null : cur))
              }
              className={`group flex flex-col items-center gap-1 p-2 rounded-lg border transition-all ${
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
              <span className="text-[10px] text-gray-200 text-center leading-tight">
                {e.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  ) : null;

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between w-full">
        <Link
          href="/codex/cards"
          className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
          onClick={(e) => {
            if (onClose) {
              e.preventDefault();
              onClose();
            }
          }}
        >
          ← 카드 도서관
        </Link>
        {onClose && (
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-gray-400"
            aria-label="닫기"
          >
            ✕
          </button>
        )}
      </div>

      {/* 데스크탑(md+): 좌 카드(sticky) + 우 인챈트 grid.
          모바일: 카드 sticky top + 그 아래 인챈트 grid 스크롤.
          → 인챈트 토글 시 카드가 항상 보여 결과 확인 즉시 가능. */}
      <div className="grid gap-4 md:grid-cols-[auto_minmax(0,1fr)] md:gap-8 md:items-start">
        <div
          className={
            // 양 모드 모두 sticky 적용. 모바일은 좁은 카드(280) + 작은 메타,
            // 데스크탑은 좌측 컬럼 sticky.
            "sticky top-0 z-20 bg-[#1a1a2e]/95 backdrop-blur-sm py-2 -mx-4 px-4 sm:-mx-6 sm:px-6 md:bg-transparent md:backdrop-blur-none md:top-4 md:py-0 md:mx-0 md:px-0 md:self-start"
          }
        >
          {cardPanel}
        </div>
        {enchantPanel}
      </div>

      <div className="w-full bg-white/5 border border-white/10 rounded-lg p-4">
        <h2 className="text-sm font-bold text-gray-300 mb-3">댓글</h2>
        <CommentSection threadKey={buildCodexCommentThreadKey("card", card.id)} />
      </div>
    </div>
  );
}
