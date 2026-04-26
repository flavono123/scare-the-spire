"use client";

import { useState, memo } from "react";
import Image from "@/components/ui/static-image";
import { CodexCard } from "@/lib/codex-types";
import {
  parseDescription,
  renderUpgradedDescription,
  TermTooltip,
  KEYWORD_DESC,
  GOLD_TERM_DESC,
} from "./codex-description";
import {
  TITLE_OUTLINE_COLOR,
  ENERGY_OUTLINE_COLOR,
  STAR_OUTLINE_COLOR,
  TITLE_UPGRADED_OUTLINE,
  TEXT_CREAM,
  TEXT_GREEN,
  CHAR_FRAME_HSV,
  RARITY_BANNER_HSV,
  ANCIENT_BANNER_HSV,
  hsvToFilter,
  gameTextShadow,
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

// Ancient card text background — type-specific top cutout shape
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
// Layout config (% of 598x844 card frame)
// banner: 653x145 → w=109%, h=17.2%
// portrait border: 551x420
// plaque: 123x75
// energy orb: ~74x74
//
// Font sizes are emitted as `cqi` (container query inline) so all glyphs scale
// uniformly with the card width. Game baseline: 598px wide.
//   TitleLabel  26px → 4.35cqi
//   Description 21px → 3.51cqi
//   EnergyLabel 32px → 5.35cqi
//   TypeLabel   16px → 2.68cqi
//   StarLabel   22px → 3.68cqi
// =============================================================================

const L = {
  art: { top: 10, left: 5, right: 5, bottom: 56 },
  portraitBorder: { width: 92, height: 50, top: 10 },
  banner: { top: 4, height: 17, overhangX: 9 },
  plaque: { width: 22, top: 55 },
  desc: { top: 64, bottom: 95, paddingX: 12 },
  cost: { top: -3, left: -3, size: 16 },
  starCost: { top: 12, left: 0, size: 11 },
  enchant: { top: 13, left: -1, size: 14 },
};

const FONT_CQI = {
  title: 4.35,
  description: 3.51,
  cost: 5.35,
  type: 2.68,
  star: 3.68,
  enchant: 3.0,
};

// =============================================================================
// Component
// =============================================================================

interface CardTileProps {
  card: CodexCard;
  showUpgrade: boolean;
  showBeta: boolean;
  enchantmentImageUrl?: string | null;
  enchantmentLabel?: string | null;
  /** Append after card description (mimics game's enchantment extra_card_text). */
  descriptionSuffix?: string | null;
  onClick?: () => void;
}

export const CardTile = memo(function CardTile({
  card,
  showUpgrade,
  showBeta,
  enchantmentImageUrl,
  enchantmentLabel,
  descriptionSuffix,
  onClick,
}: CardTileProps) {
  const [imgError, setImgError] = useState(false);
  const [hoveredTerm, setHoveredTerm] = useState<string | null>(null);

  // === Derived values ===
  let imageSrc: string | null = null;
  if (showBeta && card.betaImageUrl) imageSrc = card.betaImageUrl;
  else if (card.imageUrl) imageSrc = card.imageUrl;
  else if (card.betaImageUrl) imageSrc = card.betaImageUrl;

  let costDisplay = "";
  if (card.isXCost) costDisplay = "X";
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

  // Build description
  const descText = isUpgraded
    ? renderUpgradedDescription(card)
    : card.description;
  const descParts = parseDescription(
    descText + (descriptionSuffix ? `\n${descriptionSuffix}` : "")
  );


  // ─── Shared description renderer ───
  const renderDescription = () => (
    <div
      className="text-center leading-[1.15]"
      style={{
        color: TEXT_CREAM,
        fontSize: `${FONT_CQI.description}cqi`,
        textShadow: `0.4cqi 0.4cqi 0 rgba(0,0,0,0.55)`,
      }}
    >
      {descParts.map((part, i) =>
        part.type === "gold" ? (
          <span
            key={i}
            className="relative font-bold cursor-help"
            style={{ color: "#EFC851" }}
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
        ) : part.type === "energy" ? (
          <span key={i} className="inline-flex items-baseline gap-0">
            {Array.from({ length: parseInt(part.text, 10) || 1 }, (_, j) => (
              <Image
                key={j}
                src={energyIcon}
                alt="energy"
                width={14}
                height={14}
                className="inline-block align-text-bottom mx-0.5"
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
                className="inline-block align-text-bottom mx-0.5"
                style={{ width: "1em", height: "1em" }}
              />
            ))}
          </span>
        ) : part.type === "newline" ? (
          <br key={i} />
        ) : (
          <span key={i}>{part.text}</span>
        )
      )}
      {card.keywords.length > 0 && (
        <>
          <br />
          {card.keywords.map((kw, i) => (
            <span key={`kw-${i}`}>
              {i > 0 && <span className="text-gray-500"> · </span>}
              <span
                className="relative font-bold cursor-help"
                style={{ color: "#EFC851" }}
                onMouseEnter={() => setHoveredTerm(kw)}
                onMouseLeave={() => setHoveredTerm(null)}
              >
                {kw}
                {hoveredTerm === kw && KEYWORD_DESC[kw] && (
                  <TermTooltip name={kw} desc={KEYWORD_DESC[kw]} />
                )}
              </span>
            </span>
          ))}
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
      <Image src={energyIcon} alt="cost" fill className="object-contain drop-shadow-lg" />
      <span
        className="absolute inset-0 flex items-center justify-center font-black"
        style={{
          color: TEXT_CREAM,
          fontSize: `${FONT_CQI.cost}cqi`,
          fontFamily: TITLE_FONT,
          textShadow: gameTextShadow(costOutline, 1.6),
          letterSpacing: "-0.03em",
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
        className="object-contain drop-shadow-md"
      />
      <span
        className="absolute inset-0 flex items-center justify-center font-black"
        style={{
          color: TEXT_CREAM,
          fontSize: `${FONT_CQI.star}cqi`,
          fontFamily: TITLE_FONT,
          textShadow: gameTextShadow(STAR_OUTLINE_COLOR, 1.2),
        }}
      >
        {card.starCost}
      </span>
    </div>
  ) : null;

  // ─── Enchantment slot (under cost orb) ───
  const renderEnchantSlot = () => enchantmentImageUrl ? (
    <div
      className="absolute z-[6] pointer-events-none"
      style={{
        top: `${L.enchant.top}%`,
        left: `${L.enchant.left}%`,
        width: `${L.enchant.size}%`,
        aspectRatio: "72/54",
      }}
      title={enchantmentLabel ?? undefined}
    >
      <Image
        src="/images/game-assets/card-misc/card_enchant.png"
        alt=""
        fill
        className="object-contain drop-shadow-md"
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative" style={{ width: "55%", aspectRatio: "1" }}>
          <Image
            src={enchantmentImageUrl}
            alt={enchantmentLabel ?? "enchantment"}
            fill
            className="object-contain"
          />
        </div>
      </div>
    </div>
  ) : null;

  // =====================================================================
  // ANCIENT CARD — full-art with game-extracted frame assets
  // =====================================================================
  if (isAncientCard) {
    const ancientTextBg = ANCIENT_TEXT_BG[card.type] ?? ANCIENT_TEXT_BG["스킬"];
    const ancientBannerFilter = hsvToFilter(ANCIENT_BANNER_HSV);

    return (
      <div
        className="group relative transition-transform hover:scale-[1.03] hover:z-10 cursor-pointer select-none"
        style={{ containerType: "inline-size" }}
        onClick={onClick}
      >
        <div className="relative" style={{ aspectRatio: "598/844" }}>

          {/* Layer 0: Full-bleed portrait art */}
          <div className="absolute inset-0 overflow-hidden rounded-[3%]">
            {imageSrc && !imgError ? (
              <Image
                src={imageSrc}
                alt={card.name}
                fill
                className="object-cover object-center"
                sizes="(max-width: 640px) 40vw, (max-width: 1024px) 20vw, 12vw"
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 text-gray-500 text-[10px]">
                No Image
              </div>
            )}
          </div>

          {/* Layer 1: Ancient card frame (HSV-tinted by character) */}
          <Image
            src="/images/game-assets/card-frames/card_frame_ancient.png"
            alt=""
            fill
            className="object-contain pointer-events-none z-[1]"
            style={{ filter: frameFilter }}
            sizes="(max-width: 640px) 45vw, (max-width: 1024px) 22vw, 14vw"
          />

          {/* Layer 2: Type-specific text background */}
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

          {/* Layer 3: Ancient banner */}
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
                textShadow: gameTextShadow(titleOutline, 1.2),
              }}
            >
              {card.name}{isUpgraded && "+"}
            </span>
          </div>

          {/* Layer 4: Type plaque */}
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

          {/* Layer 5: Description text */}
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

          {/* Layer 6: Energy cost orb */}
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
      className="group relative transition-transform hover:scale-[1.03] hover:z-10 cursor-pointer select-none"
      style={{ containerType: "inline-size" }}
      onClick={onClick}
    >
      <div className="relative" style={{ aspectRatio: "598/844" }}>

        {/* Layer 0: Card portrait */}
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
              sizes="(max-width: 640px) 40vw, (max-width: 1024px) 20vw, 12vw"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="flex items-center justify-center h-full bg-black/30 text-gray-500 text-[10px]">
              No Image
            </div>
          )}
        </div>

        {/* Layer 1: Card frame (HSV-tinted) */}
        <Image
          src={frameAsset}
          alt=""
          fill
          className="object-contain pointer-events-none z-[1]"
          style={{ filter: frameFilter }}
          sizes="(max-width: 640px) 45vw, (max-width: 1024px) 22vw, 14vw"
          priority={false}
        />

        {/* Layer 2: Portrait border */}
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

        {/* Layer 3: Name banner */}
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
              textShadow: gameTextShadow(titleOutline, 1.2),
            }}
          >
            {card.name}{isUpgraded && "+"}
          </span>
        </div>

        {/* Layer 4: Type plaque */}
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

        {/* Layer 5: Description text */}
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

        {/* Layer 6: Energy cost orb */}
        {renderCostOrb()}

        {/* Layer 7: Star cost (Regent) */}
        {renderStarCost()}

        {/* Layer 8: Enchantment slot (under cost orb) */}
        {renderEnchantSlot()}
      </div>
    </div>
  );
});
