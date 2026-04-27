"use client";

import { useState, memo, CSSProperties } from "react";
import Image from "@/components/ui/static-image";
import { CodexCard } from "@/lib/codex-types";
import {
  parseDescription,
  renderUpgradedDescription,
  renderEnchantedDescription,
  TermTooltip,
  KEYWORD_DESC,
  GOLD_TERM_DESC,
  type EnchantVarMod,
} from "./codex-description";
import {
  TITLE_OUTLINE_COLOR,
  ENERGY_OUTLINE_COLOR,
  STAR_OUTLINE_COLOR,
  ENCHANT_AMOUNT_OUTLINE,
  TITLE_UPGRADED_OUTLINE,
  TEXT_CREAM,
  TEXT_GREEN,
  TEXT_GOLD,
  CHAR_FRAME_HSV,
  RARITY_BANNER_HSV,
  ANCIENT_BANNER_HSV,
  hsvToFilter,
  gameStroke,
  CARD_ASPECT,
  CARD_WIDTH_PRESET,
  FONT_CQI,
} from "@/lib/sts2-card-style";

// =============================================================================
// Game-extracted asset paths
// =============================================================================

const FRAME_ASSETS: Record<string, string> = {
  공격: "/images/game-assets/card-frames/card_frame_attack.png",
  스킬: "/images/game-assets/card-frames/card_frame_skill.png",
  파워: "/images/game-assets/card-frames/card_frame_power.png",
  저주: "/images/game-assets/card-frames/card_frame_skill.png",
  상태이상: "/images/game-assets/card-frames/card_frame_skill.png",
  퀘스트: "/images/game-assets/card-frames/card_frame_quest.png",
};

const ANCIENT_TEXT_BG: Record<string, string> = {
  공격: "/images/game-assets/card-misc/ancient_card_text_bg_attack.png",
  스킬: "/images/game-assets/card-misc/ancient_card_text_bg_skill.png",
  파워: "/images/game-assets/card-misc/ancient_card_text_bg_power.png",
};

const PORTRAIT_BORDER_ASSETS: Record<string, string> = {
  공격: "/images/game-assets/card-portraits/card_portrait_border_attack.png",
  스킬: "/images/game-assets/card-portraits/card_portrait_border_skill.png",
  파워: "/images/game-assets/card-portraits/card_portrait_border_power.png",
  저주: "/images/game-assets/card-portraits/card_portrait_border_skill.png",
  상태이상: "/images/game-assets/card-portraits/card_portrait_border_skill.png",
  퀘스트: "/images/game-assets/card-portraits/card_portrait_border_skill.png",
};

const ENERGY_ICONS: Record<string, string> = {
  ironclad: "/images/game-assets/card-misc/energy_ironclad.png",
  silent: "/images/game-assets/card-misc/energy_silent.png",
  defect: "/images/game-assets/card-misc/energy_defect.png",
  necrobinder: "/images/game-assets/card-misc/energy_necrobinder.png",
  regent: "/images/game-assets/card-misc/energy_regent.png",
  colorless: "/images/game-assets/card-misc/energy_colorless.png",
  curse: "/images/game-assets/card-misc/energy_colorless.png",
  event: "/images/game-assets/card-misc/energy_colorless.png",
  status: "/images/game-assets/card-misc/energy_colorless.png",
  token: "/images/game-assets/card-misc/energy_colorless.png",
  quest: "/images/game-assets/card-misc/energy_quest.png",
};

// =============================================================================
// Fonts
// =============================================================================

const CARD_FONT = "var(--font-gc-batang), var(--font-kreon), serif";
const TITLE_FONT = "var(--font-spectral), var(--font-gc-batang), serif";

// =============================================================================
// Layout config (% of 300×422 holder coords)
// banner: card.tscn NameBanner offset(-160 ~ 160, -250 ~ -180) → w=320(=107%), h=70/422=16.6%
// energy orb: 64×64 / holder ~21%
// =============================================================================

const L = {
  art: { top: 9, left: 6, right: 6, bottom: 56 },
  portraitBorder: { width: 92, height: 50, top: 9 },
  banner: { top: 3, height: 17, overhangX: 9 },
  plaque: { width: 22, top: 55 },
  desc: { top: 64, bottom: 95, paddingX: 9 },
  cost: { top: -3, left: -3, size: 17 },
  starCost: { top: 13, left: 0, size: 12 },
  enchant: { top: 16, left: -3, width: 22, height: 14 },
};

// =============================================================================
// Component
// =============================================================================

export type CardTileSize = keyof typeof CARD_WIDTH_PRESET;

interface CardTileProps {
  card: CodexCard;
  showUpgrade: boolean;
  showBeta: boolean;
  /** 고정 픽셀 폭. 게임처럼 반응형 X. 미지정 시 size="grid" 기본. */
  width?: number;
  size?: CardTileSize;
  enchantmentImageUrl?: string | null;
  enchantmentLabel?: string | null;
  enchantmentAmount?: number | null;
  /** 인챈트 적용 후 카드 코스트 (TezcatarasEmber 등). null이면 원래 cost. */
  forcedCost?: number | null;
  /** 인챈트가 추가하는 키워드(영구/선천성/보존/소멸). */
  enchantAddedKeywords?: string[];
  /** 인챈트가 제거하는 키워드(SoulsPower→소멸). */
  enchantRemovedKeywords?: string[];
  /** 카드 본문 끝에 분홍색으로 추가될 인챈트 효과 텍스트. BBCode OK. */
  descriptionSuffix?: string | null;
  /** 인챈트가 카드 damage/block 에 미치는 효과 — descriptionRaw 재렌더에 사용. */
  enchantStatMod?: EnchantVarMod | null;
  onClick?: () => void;
}

export const CardTile = memo(function CardTile({
  card,
  showUpgrade,
  showBeta,
  width,
  size = "grid",
  enchantmentImageUrl,
  enchantmentLabel,
  enchantmentAmount,
  forcedCost,
  enchantAddedKeywords,
  enchantRemovedKeywords,
  descriptionSuffix,
  enchantStatMod,
  onClick,
}: CardTileProps) {
  const [imgError, setImgError] = useState(false);
  const [hoveredTerm, setHoveredTerm] = useState<string | null>(null);

  const cardWidth = width ?? CARD_WIDTH_PRESET[size];

  // === Derived values ===
  let imageSrc: string | null = null;
  if (showBeta && card.betaImageUrl) imageSrc = card.betaImageUrl;
  else if (card.imageUrl) imageSrc = card.imageUrl;
  else if (card.betaImageUrl) imageSrc = card.betaImageUrl;

  let costDisplay = "";
  if (forcedCost !== undefined && forcedCost !== null) {
    costDisplay = String(forcedCost);
  } else if (card.isXCost) costDisplay = "X";
  else if (card.cost >= 0) {
    costDisplay = showUpgrade && card.upgrade?.cost !== undefined
      ? String(card.upgrade.cost) : String(card.cost);
  }

  const frameAsset = FRAME_ASSETS[card.type] ?? FRAME_ASSETS["스킬"];
  const portraitBorderAsset = PORTRAIT_BORDER_ASSETS[card.type] ?? PORTRAIT_BORDER_ASSETS["스킬"];
  const charHsv = CHAR_FRAME_HSV[card.color] ?? CHAR_FRAME_HSV.colorless;
  const frameFilter = hsvToFilter(charHsv);
  const bannerHsv = RARITY_BANNER_HSV[card.rarity] ?? RARITY_BANNER_HSV["일반"];
  const bannerFilter = hsvToFilter(bannerHsv);

  const isUpgraded = showUpgrade && card.upgrade != null;
  const titleOutline = isUpgraded
    ? TITLE_UPGRADED_OUTLINE
    : (TITLE_OUTLINE_COLOR[card.rarity] ?? TITLE_OUTLINE_COLOR["일반"]);
  const titleColor = isUpgraded ? TEXT_GREEN : TEXT_CREAM;
  const costOutline = ENERGY_OUTLINE_COLOR[card.color] ?? ENERGY_OUTLINE_COLOR.colorless;
  const energyIcon = ENERGY_ICONS[card.color] ?? ENERGY_ICONS.colorless;
  const isAncientCard = card.rarity === "고대의 존재";

  // 게임 outline_size: title=12, cost=16, type=0, enchant amount=8 (card.tscn)
  const titleStroke = gameStroke(titleOutline, cardWidth, 12);
  const costStroke = gameStroke(costOutline, cardWidth, 16);
  const starStroke = gameStroke(STAR_OUTLINE_COLOR, cardWidth, 12);
  const enchantAmountStroke = gameStroke(ENCHANT_AMOUNT_OUTLINE, cardWidth, 8);

  // descText 결정 우선순위:
  //  1) 인챈트 stat modifier 있으면 enchanted 렌더 (damage/block 변경)
  //  2) 강화면 upgraded 렌더
  //  3) 그 외엔 원본 description
  let descText: string;
  if (enchantStatMod && (enchantStatMod.damageAdd || enchantStatMod.damageMultiplier || enchantStatMod.blockAdd)) {
    descText = renderEnchantedDescription(card, enchantStatMod);
  } else if (isUpgraded) {
    descText = renderUpgradedDescription(card);
  } else {
    descText = card.description;
  }
  const descParts = parseDescription(descText);
  // 인챈트 추가 텍스트 — 분홍 baseline + 안의 모든 색을 분홍 통일.
  const suffixParts = descriptionSuffix
    ? parseDescription(descriptionSuffix)
    : null;

  // 표시할 키워드: 카드 keywords + 인챈트 추가 - 인챈트 제거
  const removedSet = new Set(enchantRemovedKeywords ?? []);
  const displayKeywords = [
    ...card.keywords.filter((k) => !removedSet.has(k)),
    ...((enchantAddedKeywords ?? []).filter(
      (k) => !card.keywords.includes(k)
    )),
  ];
  // ─── 텍스트 파트 렌더 헬퍼 ───
  // mode="card": 일반 카드 본문 — 색 BBCode 그대로 (gold→골드 hover, blue→블루)
  // mode="suffix": 인챈트 추가 본문 — 모든 색을 분홍(#EE82EE)로 통일
  const renderParts = (parts: ReturnType<typeof parseDescription>, mode: "card" | "suffix") =>
    parts.map((part, i) => {
      // suffix 모드에선 모든 색 BBCode를 분홍으로 통일
      if (mode === "suffix" && (
        part.type === "gold" || part.type === "blue" ||
        part.type === "red" || part.type === "purple" ||
        part.type === "upgrade"
      )) {
        return (
          <span key={i} className="font-bold" style={{ color: "#EE82EE" }}>{part.text}</span>
        );
      }
      return part.type === "gold" ? (
        <span
          key={i}
          className="relative font-bold cursor-help"
          style={{ color: TEXT_GOLD }}
          onMouseEnter={() => setHoveredTerm(part.text)}
          onMouseLeave={() => setHoveredTerm(null)}
        >
          {part.text}
          {hoveredTerm === part.text && GOLD_TERM_DESC[part.text] && (
            <TermTooltip name={part.text} desc={GOLD_TERM_DESC[part.text]} />
          )}
        </span>
      ) : part.type === "upgrade" ? (
        <span key={i} className="font-bold" style={{ color: TEXT_GREEN }}>{part.text}</span>
      ) : part.type === "blue" ? (
        <span key={i} className="font-bold" style={{ color: "#87CEEB" }}>{part.text}</span>
      ) : part.type === "red" ? (
        <span key={i} style={{ color: "#FF5555" }}>{part.text}</span>
      ) : part.type === "purple" ? (
        <span key={i} className="font-bold" style={{ color: "#EE82EE" }}>{part.text}</span>
      ) : part.type === "energy" ? (
        <span key={i} className="inline-flex items-baseline gap-0">
          {Array.from({ length: parseInt(part.text, 10) || 1 }, (_, j) => (
            <Image
              key={j}
              src={energyIcon}
              alt="energy"
              width={14}
              height={14}
              className="inline-block align-text-bottom mx-[0.1em]"
              style={{ width: "1em", height: "1em" }}
            />
          ))}
        </span>
      ) : part.type === "star" ? (
        <span key={i} className="inline-flex items-baseline gap-0">
          {Array.from({ length: parseInt(part.text, 10) || 1 }, (_, j) => (
            <Image
              key={j}
              src="/images/game-assets/card-misc/star_icon.png"
              alt="star"
              width={14}
              height={14}
              className="inline-block align-text-bottom mx-[0.1em]"
              style={{ width: "1em", height: "1em" }}
            />
          ))}
        </span>
      ) : part.type === "newline" ? (
        <br key={i} />
      ) : (
        <span key={i}>{part.text}</span>
      );
    });

  const renderDescription = () => (
    <div
      className="text-center leading-[1.18]"
      style={{
        color: TEXT_CREAM,
        fontSize: `${FONT_CQI.description}cqi`,
        textShadow: `${(2 / 300) * cardWidth}px ${(2 / 300) * cardWidth}px 0 rgba(0,0,0,0.45)`,
      }}
    >
      {renderParts(descParts, "card")}
      {suffixParts && (
        <>
          <br />
          <span style={{ color: "#EE82EE" }}>{renderParts(suffixParts, "suffix")}</span>
        </>
      )}
      {displayKeywords.length > 0 && (
        <>
          <br />
          {displayKeywords.map((kw, i) => {
            // 인챈트 추가 키워드도 게임에선 일반 키워드와 동일한 골드.
            // 키워드 hover lookup은 첫 단어만 (예: "재사용 1" → "재사용")
            const lookupKey = kw.split(/\s/)[0];
            return (
              <span key={`kw-${i}`}>
                {i > 0 && <span className="text-gray-500"> · </span>}
                <span
                  className="relative font-bold cursor-help"
                  style={{ color: TEXT_GOLD }}
                  onMouseEnter={() => setHoveredTerm(kw)}
                  onMouseLeave={() => setHoveredTerm(null)}
                >
                  {kw}
                  {hoveredTerm === kw && KEYWORD_DESC[lookupKey] && (
                    <TermTooltip name={lookupKey} desc={KEYWORD_DESC[lookupKey]} />
                  )}
                </span>
              </span>
            );
          })}
        </>
      )}
    </div>
  );

  // ─── Energy cost orb ───
  const renderCostOrb = () => costDisplay ? (
    <div
      className="absolute z-[6]"
      style={{
        top: `${L.cost.top}%`,
        left: `${L.cost.left}%`,
        width: `${L.cost.size}%`,
        aspectRatio: "1",
      }}
    >
      <Image src={energyIcon} alt="cost" fill className="object-contain" />
      <span
        className="absolute inset-0 flex items-center justify-center font-black"
        style={{
          color: TEXT_CREAM,
          fontSize: `${FONT_CQI.cost}cqi`,
          fontFamily: TITLE_FONT,
          letterSpacing: "-0.02em",
          ...(costStroke as CSSProperties),
        }}
      >
        {costDisplay}
      </span>
    </div>
  ) : null;

  // ─── Star cost (Regent) ───
  const renderStarCost = () => card.starCost !== null ? (
    <div
      className="absolute z-[6]"
      style={{
        top: `${L.starCost.top}%`,
        left: `${L.starCost.left}%`,
        width: `${L.starCost.size}%`,
        aspectRatio: "1",
      }}
    >
      <Image
        src="/images/game-assets/card-misc/energy_star.png"
        alt="star cost"
        fill
        className="object-contain"
      />
      <span
        className="absolute inset-0 flex items-center justify-center font-black"
        style={{
          color: TEXT_CREAM,
          fontSize: `${FONT_CQI.star}cqi`,
          fontFamily: TITLE_FONT,
          ...(starStroke as CSSProperties),
        }}
      >
        {card.starCost}
      </span>
    </div>
  ) : null;

  // ─── 인챈트 슬롯 (코스트 아래) — game material: hsv.gdshader(h=0.25, s=0.4, v=1.0)
  // → CSS filter 환산: hue-rotate(-270deg = +90deg) saturate(0.4) brightness(1.0)
  // 슬롯 텍스처를 검정/회색으로 만드는 게임 셰이더와 동일.
  const renderEnchantSlot = () => enchantmentImageUrl ? (
    <div
      className="absolute z-[6] pointer-events-none"
      style={{
        top: `${L.enchant.top}%`,
        left: `${L.enchant.left}%`,
        width: `${L.enchant.width}%`,
        aspectRatio: "72/54",
      }}
      title={enchantmentLabel ?? undefined}
    >
      {/* Slot base — 게임 ShaderMaterial_ots2x: HSV(0.25, 0.4, 1.0) */}
      <Image
        src="/images/game-assets/card-misc/card_enchant.png"
        alt=""
        fill
        className="object-contain"
        style={{ filter: "hue-rotate(90deg) saturate(0.4) brightness(1.0)" }}
      />
      {/* 인챈트 아이콘 — game Icon offset(14,9)~(49,44) within 72×54 슬롯 */}
      <div
        className="absolute"
        style={{
          left: `${(14 / 72) * 100}%`,
          top: `${(9 / 54) * 100}%`,
          width: `${((49 - 14) / 72) * 100}%`,
          height: `${((44 - 9) / 54) * 100}%`,
        }}
      >
        <Image
          src={enchantmentImageUrl}
          alt={enchantmentLabel ?? "enchantment"}
          fill
          className="object-contain"
        />
      </div>
      {/* Amount: game Label offset_left=26, top=27, right=66, bottom=53 (slot 72×54 내) */}
      {enchantmentAmount !== undefined && enchantmentAmount !== null && (
        <div
          className="absolute flex items-center justify-center"
          style={{
            left: `${(26 / 72) * 100}%`,
            top: `${(27 / 54) * 100}%`,
            width: `${((66 - 26) / 72) * 100}%`,
            height: `${((53 - 27) / 54) * 100}%`,
          }}
        >
          <span
            className="font-black"
            style={{
              color: TEXT_CREAM,
              fontSize: `${FONT_CQI.enchantAmount}cqi`,
              fontFamily: TITLE_FONT,
              lineHeight: 1,
              ...(enchantAmountStroke as CSSProperties),
            }}
          >
            {enchantmentAmount}
          </span>
        </div>
      )}
    </div>
  ) : null;

  // 카드 컨테이너 인라인 스타일: 고정 픽셀 + cqi 베이스
  const cardContainerStyle: CSSProperties = {
    width: cardWidth,
    aspectRatio: CARD_ASPECT,
    containerType: "inline-size",
  };

  // =====================================================================
  // ANCIENT CARD
  // =====================================================================
  if (isAncientCard) {
    const ancientTextBg = ANCIENT_TEXT_BG[card.type] ?? ANCIENT_TEXT_BG["스킬"];
    const ancientBannerFilter = hsvToFilter(ANCIENT_BANNER_HSV);

    return (
      <div
        className="group relative cursor-pointer select-none transition-transform hover:scale-[1.03] hover:z-10"
        style={cardContainerStyle}
        onClick={onClick}
      >
        <div className="relative w-full h-full">
          <div className="absolute inset-0 overflow-hidden rounded-[3%]">
            {imageSrc && !imgError ? (
              <Image
                src={imageSrc}
                alt={card.name}
                fill
                className="object-cover object-center"
                sizes={`${cardWidth}px`}
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 text-gray-500 text-[10px]">
                No Image
              </div>
            )}
          </div>

          <Image
            src="/images/game-assets/card-frames/card_frame_ancient.png"
            alt=""
            fill
            className="object-contain pointer-events-none z-[1]"
            style={{ filter: frameFilter }}
            sizes={`${cardWidth}px`}
          />

          <div
            className="absolute z-[2] pointer-events-none"
            style={{ left: "5%", right: "5%", bottom: "1%", height: "45%" }}
          >
            <Image
              src={ancientTextBg}
              alt=""
              fill
              className="object-contain object-bottom"
              style={{ filter: frameFilter, opacity: 0.92 }}
            />
          </div>

          <div
            className="absolute z-[3] flex items-center justify-center"
            style={{
              top: `${L.banner.top}%`,
              left: `-${L.banner.overhangX}%`,
              right: `-${L.banner.overhangX}%`,
              height: `${L.banner.height}%`,
            }}
          >
            <Image
              src="/images/game-assets/card-misc/ancient_banner.png"
              alt=""
              fill
              className="object-contain pointer-events-none"
              style={{ filter: ancientBannerFilter }}
            />
            <span
              className="relative z-10 text-center truncate px-[18%] w-full"
              style={{
                marginTop: "-10%",
                fontFamily: TITLE_FONT,
                fontSize: `${FONT_CQI.title}cqi`,
                fontWeight: 800,
                color: titleColor,
                ...(titleStroke as CSSProperties),
              }}
            >
              {card.name}{isUpgraded && "+"}
            </span>
          </div>

          <div
            className="absolute left-1/2 -translate-x-1/2 z-[4]"
            style={{ top: `${L.plaque.top}%`, width: `${L.plaque.width}%` }}
          >
            <div className="relative w-full" style={{ aspectRatio: "123/75" }}>
              <Image
                src="/images/game-assets/card-misc/card_portrait_border_plaque.png"
                alt=""
                fill
                className="pointer-events-none object-contain"
                style={{ filter: ancientBannerFilter }}
              />
              <span
                className="absolute inset-0 flex items-center justify-center"
                style={{
                  fontFamily: CARD_FONT,
                  fontSize: `${FONT_CQI.type}cqi`,
                  fontWeight: 700,
                  color: "rgba(0,0,0,0.75)",
                }}
              >
                {card.type}
              </span>
            </div>
          </div>

          <div
            className="absolute z-[5] overflow-hidden flex flex-col items-center justify-center"
            style={{
              top: `${L.desc.top}%`,
              bottom: `${100 - L.desc.bottom}%`,
              left: `${L.desc.paddingX}%`,
              right: `${L.desc.paddingX}%`,
              fontFamily: CARD_FONT,
            }}
          >
            {renderDescription()}
          </div>

          {renderCostOrb()}
          {renderStarCost()}
          {renderEnchantSlot()}
        </div>
      </div>
    );
  }

  // =====================================================================
  // STANDARD CARD
  // =====================================================================
  return (
    <div
      className="group relative cursor-pointer select-none transition-transform hover:scale-[1.03] hover:z-10"
      style={cardContainerStyle}
      onClick={onClick}
    >
      <div className="relative w-full h-full">
        <div
          className="absolute overflow-hidden"
          style={{
            top: `${L.art.top}%`,
            left: `${L.art.left}%`,
            right: `${L.art.right}%`,
            height: `${L.art.bottom - L.art.top}%`,
          }}
        >
          {imageSrc && !imgError ? (
            <Image
              src={imageSrc}
              alt={card.name}
              fill
              className="object-contain object-center"
              sizes={`${cardWidth}px`}
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="flex items-center justify-center h-full bg-black/30 text-gray-500 text-[10px]">
              No Image
            </div>
          )}
        </div>

        <Image
          src={frameAsset}
          alt=""
          fill
          className="object-contain pointer-events-none z-[1]"
          style={{ filter: frameFilter }}
          sizes={`${cardWidth}px`}
          priority={false}
        />

        <div
          className="absolute z-[2] pointer-events-none left-1/2 -translate-x-1/2"
          style={{
            top: `${L.portraitBorder.top}%`,
            width: `${L.portraitBorder.width}%`,
            height: `${L.portraitBorder.height}%`,
          }}
        >
          <Image
            src={portraitBorderAsset}
            alt=""
            fill
            className="object-contain"
            style={{ filter: bannerFilter }}
          />
        </div>

        <div
          className="absolute z-[3] flex items-center justify-center"
          style={{
            top: `${L.banner.top}%`,
            left: `-${L.banner.overhangX}%`,
            right: `-${L.banner.overhangX}%`,
            height: `${L.banner.height}%`,
          }}
        >
          <Image
            src="/images/game-assets/card-misc/card_banner.png"
            alt=""
            fill
            className="object-contain pointer-events-none"
            style={{ filter: bannerFilter }}
          />
          <span
            className="relative z-10 text-center truncate px-[18%] w-full"
            style={{
              marginTop: "-10%",
              fontFamily: TITLE_FONT,
              fontSize: `${FONT_CQI.title}cqi`,
              fontWeight: 800,
              color: titleColor,
              ...(titleStroke as CSSProperties),
            }}
          >
            {card.name}{isUpgraded && "+"}
          </span>
        </div>

        <div
          className="absolute left-1/2 -translate-x-1/2 z-[4]"
          style={{ top: `${L.plaque.top}%`, width: `${L.plaque.width}%` }}
        >
          <div className="relative w-full" style={{ aspectRatio: "123/75" }}>
            <Image
              src="/images/game-assets/card-misc/card_portrait_border_plaque.png"
              alt=""
              fill
              className="pointer-events-none object-contain"
              style={{ filter: bannerFilter }}
            />
            <span
              className="absolute inset-0 flex items-center justify-center"
              style={{
                fontFamily: CARD_FONT,
                fontSize: `${FONT_CQI.type}cqi`,
                fontWeight: 700,
                color: "rgba(0,0,0,0.75)",
              }}
            >
              {card.type}
            </span>
          </div>
        </div>

        <div
          className="absolute z-[5] overflow-hidden flex flex-col items-center justify-center"
          style={{
            top: `${L.desc.top}%`,
            bottom: `${100 - L.desc.bottom}%`,
            left: `${L.desc.paddingX}%`,
            right: `${L.desc.paddingX}%`,
            fontFamily: CARD_FONT,
          }}
        >
          {renderDescription()}
        </div>

        {renderCostOrb()}
        {renderStarCost()}
        {renderEnchantSlot()}
      </div>
    </div>
  );
});
