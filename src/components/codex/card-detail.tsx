"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "@/components/ui/static-image";
import { CommentSection } from "@/components/comment-section";
import { buildCodexCommentThreadKey } from "@/lib/comment-threads";
import { CodexCard, CodexEnchantment } from "@/lib/codex-types";
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
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

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

  return (
    <div className="flex flex-col items-center gap-4 p-4 sm:p-6 max-w-3xl mx-auto">
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

      {/* 카드 + hover popover (popover는 카드 우측, 캐러셀은 카드 아래라 안 겹침) */}
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
      </div>

      {/* 강화 / 베타 토글 — 카드 바로 아래 */}
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

      {/* 인챈트 캐러셀 */}
      {eligibleEnchantments.length > 0 && (
        <div className="w-full flex flex-col gap-2">
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

          {/* 화살표는 캐러셀 바깥(좌우 32px 마진 영역)에 배치. 캐러셀 자체는 mx-10. */}
          <div className="relative">
            {canScrollLeft && (
              <button
                type="button"
                aria-label="이전 인챈트"
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
                aria-label="다음 인챈트"
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
                    onMouseEnter={() => setHoveredEnchantId(e.id)}
                    onMouseLeave={() =>
                      setHoveredEnchantId((cur) => (cur === e.id ? null : cur))
                    }
                    onFocus={() => setHoveredEnchantId(e.id)}
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

      <div className="w-full bg-white/5 border border-white/10 rounded-lg p-4">
        <h2 className="text-sm font-bold text-gray-300 mb-3">댓글</h2>
        <CommentSection threadKey={buildCodexCommentThreadKey("card", card.id)} />
      </div>
    </div>
  );
}
