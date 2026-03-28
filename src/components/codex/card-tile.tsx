"use client";

import { useState } from "react";
import Image from "next/image";
import { CodexCard } from "@/lib/codex-types";
import { annotateCard } from "@/lib/card-annotations";

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
// Game-extracted HSV shader parameters (from .tres material files)
// =============================================================================

interface HSV { h: number; s: number; v: number }

const CHAR_HSV: Record<string, HSV> = {
  ironclad: { h: 0.025, s: 0.85, v: 1.0 },
  silent: { h: 0.32, s: 0.45, v: 1.2 },
  defect: { h: 0.55, s: 0.9, v: 1.0 },
  necrobinder: { h: 0.965, s: 0.55, v: 1.2 },  // card_frame_pink_mat (purple)
  regent: { h: 0.12, s: 1.5, v: 1.2 },         // card_frame_orange_mat (orange/gold)
  colorless: { h: 1.0, s: 0.0, v: 1.2 },
  curse: { h: 0.85, s: 0.05, v: 0.55 },
  quest: { h: 1.0, s: 1.0, v: 1.0 },
  event: { h: 1.0, s: 0.0, v: 1.0 },
  status: { h: 0.12, s: 0.3, v: 0.7 },
  token: { h: 1.0, s: 0.0, v: 0.8 },
};

function hsvToFilter(hsv: HSV): string {
  const hueDeg = Math.round(hsv.h * 360) % 360;
  return `hue-rotate(${hueDeg}deg) saturate(${hsv.s}) brightness(${hsv.v})`;
}

// Convert HSV to approximate hex color for border effects
function charHsvToColor(hsv: HSV): string {
  const h = hsv.h, s = hsv.s, v = hsv.v;
  const c = v * Math.min(s, 1);
  const x = c * (1 - Math.abs(((h * 6) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  const hi = Math.floor(h * 6) % 6;
  if (hi === 0) { r = c; g = x; }
  else if (hi === 1) { r = x; g = c; }
  else if (hi === 2) { g = c; b = x; }
  else if (hi === 3) { g = x; b = c; }
  else if (hi === 4) { r = x; b = c; }
  else { r = c; b = x; }
  const toHex = (n: number) => Math.round(Math.min(1, n + m) * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// =============================================================================
// Rarity colors — used for banner filter AND text outline
// Base banner asset is teal (~180° hue)
// =============================================================================

const RARITY_BANNER_FILTER: Record<string, string> = {
  기본: "saturate(0) brightness(0.7)",
  일반: "saturate(0) brightness(0.8)",
  고급: "hue-rotate(-10deg) saturate(0.8) brightness(0.85)",
  희귀: "hue-rotate(-140deg) saturate(1.2) brightness(0.9)",
  "고대의 존재": "hue-rotate(-100deg) saturate(0.6) brightness(0.7)",
  이벤트: "hue-rotate(-80deg) saturate(0.5) brightness(0.6)",
  토큰: "saturate(0) brightness(0.5)",
  저주: "hue-rotate(150deg) saturate(0.6) brightness(0.4)",
  상태이상: "hue-rotate(-120deg) saturate(0.4) brightness(0.5)",
  퀘스트: "hue-rotate(-30deg) saturate(0.7) brightness(0.7)",
};

// Rarity -> darker outline color for card name text
// In-game, outline follows the rarity banner color but darker
const RARITY_OUTLINE: Record<string, string> = {
  기본: "#2a2a2a",
  일반: "#303030",
  고급: "#1a3a5a",
  희귀: "#4a3010",
  "고대의 존재": "#1a3020",
  이벤트: "#1a2a20",
  토큰: "#1a1a1a",
  저주: "#2a1020",
  상태이상: "#1a1a2a",
  퀘스트: "#1a2a3a",
};

// Energy orb outline colors (darker shade of each orb's dominant color)
const ENERGY_OUTLINE: Record<string, string> = {
  ironclad: "#3a1008",
  silent: "#0a2a10",
  defect: "#081830",
  necrobinder: "#3a0820",
  regent: "#2a1a08",
  colorless: "#1a1a1a",
  curse: "#1a1a1a",
  event: "#1a1a1a",
  status: "#1a1a1a",
  token: "#1a1a1a",
  quest: "#081830",
};

// =============================================================================
// Fonts
// =============================================================================

const CARD_FONT = "var(--font-gc-batang), var(--font-kreon), serif";
const TITLE_FONT = "var(--font-spectral), var(--font-gc-batang), serif";

// =============================================================================
// Keyword / gold-term tooltips
// =============================================================================

const KEYWORD_DESC: Record<string, string> = {
  교활: "교활 카드는 사일런트 카드 더미에 합류합니다.",
  보존: "이 카드는 턴 종료 시 버려지지 않습니다.",
  사용불가: "이 카드는 사용할 수 없습니다.",
  선천성: "이 카드는 매 전투 시작 시 손에 들어옵니다.",
  소멸: "이 카드는 사용 후 게임에서 제거됩니다.",
  영구: "이 카드는 어떤 방법으로도 제거할 수 없습니다.",
  휘발성: "이 카드는 턴 종료 시 손에 있으면 소멸합니다.",
};

const GOLD_TERM_DESC: Record<string, string> = {
  힘: "카드의 공격 피해량이 증가합니다.",
  민첩: "카드의 방어도 획득량이 증가합니다.",
  방어도: "받는 피해를 줄여줍니다. 매 턴 시작 시 사라집니다.",
  약화: "약화된 적은 25% 적은 피해를 줍니다.",
  취약: "취약한 대상은 50% 더 많은 피해를 받습니다.",
  불가침: "체력이 1 이하로 줄어들지 않습니다.",
  가시: "피격 시 공격자에게 피해를 줍니다.",
  소환: "하수인을 소환합니다.",
  강화: "카드를 영구적으로 강화합니다.",
};

// =============================================================================
// Layout config (% of 598x844 card frame)
// Measured from actual game assets pixel dimensions.
// banner: 653x145 → w=109%, h=17.2% of card
// frame: 598x844
// portrait border: 551x420 → w=92%, h=49.8% of card
// plaque: 123x75 → w=20.6%, aspect 123/75
// energy orb: ~74x74 → 12.4% of card width
// =============================================================================

const L = {
  art: {
    top: 10,
    left: 5,
    right: 5,
    bottom: 56,
  },
  portraitBorder: {
    width: 92,
    height: 50,
    top: 10,
  },
  banner: {
    top: 4,
    height: 17,
    overhangX: 9,
  },
  plaque: {
    width: 22,
    top: 55,
  },
  desc: {
    top: 64,
    bottom: 95,
    paddingX: 12,
  },
  cost: {
    top: -3,
    left: -3,
    size: 16,
  },
  starCost: {
    top: 12,
    left: 0,
    size: 11,
  },
};


// Build text-shadow outline from a single color
function outlineShadow(color: string, px: number = 1): string {
  const offsets = [
    [-px, -px], [px, -px], [-px, px], [px, px],
    [0, -px], [0, px], [-px, 0], [px, 0],
  ];
  return offsets.map(([x, y]) => `${x}px ${y}px 0 ${color}`).join(", ");
}

// =============================================================================
// Component
// =============================================================================

interface CardTileProps {
  card: CodexCard;
  showUpgrade: boolean;
  showBeta: boolean;
}

export function CardTile({ card, showUpgrade, showBeta }: CardTileProps) {
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
  const charHsv = CHAR_HSV[card.color] ?? CHAR_HSV.colorless;
  const frameFilter = hsvToFilter(charHsv);
  const bannerFilter = RARITY_BANNER_FILTER[card.rarity] ?? RARITY_BANNER_FILTER["일반"];
  const nameOutline = RARITY_OUTLINE[card.rarity] ?? RARITY_OUTLINE["일반"];
  const costOutline = ENERGY_OUTLINE[card.color] ?? ENERGY_OUTLINE.colorless;
  const energyIcon = ENERGY_ICONS[card.color] ?? ENERGY_ICONS.colorless;
  const annotation = annotateCard(card);
  const isAncientCard = card.rarity === "고대의 존재";
  // Build description: when upgraded, substitute vars with upgraded values
  const isUpgraded = showUpgrade && card.upgrade != null;
  const descText = isUpgraded
    ? renderUpgradedDescription(card)
    : card.description;
  const descParts = parseDescription(descText);


  // ─── Shared description renderer ───
  const renderDescription = (extraClass?: string) => (
    <div className={`text-center text-[10px] leading-[1.15] text-gray-100 ${extraClass ?? ""}`}>
      {descParts.map((part, i) =>
        part.type === "gold" ? (
          <span
            key={i}
            className="relative text-yellow-500 font-bold cursor-help"
            onMouseEnter={() => setHoveredTerm(part.text)}
            onMouseLeave={() => setHoveredTerm(null)}
          >
            {part.text}
            {hoveredTerm === part.text && GOLD_TERM_DESC[part.text] && (
              <TermTooltip name={part.text} desc={GOLD_TERM_DESC[part.text]} />
            )}
          </span>
        ) : part.type === "energy" ? (
          <Image
            key={i}
            src={energyIcon}
            alt="energy"
            width={14}
            height={14}
            className="inline-block align-text-bottom mx-0.5"
          />
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
                className="relative font-bold text-yellow-500 cursor-help"
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

  // ─── Shared energy cost orb ───
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
        className="absolute inset-0 flex items-center justify-center font-black text-white"
        style={{
          fontSize: "clamp(12px, 1.5vw, 18px)",
          fontFamily: TITLE_FONT,
          textShadow: outlineShadow(costOutline, 2),
        }}
      >
        {costDisplay}
      </span>
    </div>
  ) : null;

  // ─── Shared star cost (Regent) — star shape, below energy orb ───
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
      {/* Star shape SVG */}
      <svg viewBox="0 0 48 48" className="absolute inset-0 w-full h-full drop-shadow-md">
        <path
          d="M24 2 L29.5 17.5 L46 17.5 L32.5 28 L37.5 44 L24 34 L10.5 44 L15.5 28 L2 17.5 L18.5 17.5 Z"
          fill="#e8920a"
          stroke="#7a4a00"
          strokeWidth="1.5"
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center font-black text-white"
        style={{
          fontSize: "clamp(8px, 0.9vw, 11px)",
          fontFamily: TITLE_FONT,
          textShadow: outlineShadow("#3a1a00", 1),
          marginTop: "5%",
        }}
      >
        {card.starCost}
      </span>
    </div>
  ) : null;

  // =====================================================================
  // UNIQUE CARD — full-art layout
  // Art fills entire card, description floats with frame-cutout shadow
  // =====================================================================
  if (isAncientCard) {
    return (
      <div className="group relative transition-transform hover:scale-[1.03] hover:z-10 cursor-pointer select-none">
        <div className="relative" style={{ aspectRatio: "598/844" }}>

          {/* ── Full-bleed portrait art (clipped to card shape) ── */}
          <div className="absolute inset-0 overflow-hidden rounded-[4%]">
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

          {/* ── Thin border frame (no fill, just edge, inside clip) ── */}
          <div className="absolute inset-0 overflow-hidden rounded-[4%]">
            <div
              className="absolute inset-0 z-[1] rounded-[4%] pointer-events-none"
              style={{
                boxShadow: `inset 0 0 0 3px rgba(0,0,0,0.5), inset 0 0 0 5px ${charHsvToColor(charHsv)}33`,
              }}
            />
          </div>

          {/* ── Name banner (ancient: gray, semi-transparent) ── */}
          <div
            className="absolute z-[3] flex items-center justify-center"
            style={{
              top: `${L.banner.top}%`,
              left: `-${L.banner.overhangX}%`,
              right: `-${L.banner.overhangX}%`,
              height: `${L.banner.height}%`,
              opacity: 0.8,
            }}
          >
            <Image
              src="/images/game-assets/card-misc/ancient_banner.png"
              alt=""
              fill
              className="object-contain pointer-events-none"
              style={{ filter: "saturate(0) brightness(0.7)" }}
            />
            <span
              className="relative z-10 text-center truncate px-[18%] w-full"
              style={{
                marginTop: "-10%",
                fontFamily: TITLE_FONT,
                fontSize: "clamp(9px, 1.4vw, 16px)",
                fontWeight: 800,
                color: isUpgraded ? "#6ee67a" : "rgba(255,255,255,0.9)",
                textShadow: outlineShadow(isUpgraded ? "#1a3a1a" : "#1a1a1a", 1),
              }}
            >
              {card.name}{isUpgraded && "+"}
            </span>
          </div>

          {/* ── Floating description panel with frame-cutout top ── */}
          <div
            className="absolute z-[5] left-0 right-0 bottom-0 overflow-hidden rounded-b-[4%]"
            style={{ top: "50%" }}
          >
            {/* Frame-cutout arch at top of description area */}
            <div
              className="absolute left-[4%] right-[4%] pointer-events-none z-[2]"
              style={{ top: "-2px", height: "18%" }}
            >
              <Image
                src={PORTRAIT_BORDER_ASSETS[card.type] ?? PORTRAIT_BORDER_ASSETS["스킬"]}
                alt=""
                fill
                className="object-contain object-bottom"
                style={{
                  filter: bannerFilter,
                  maskImage: "linear-gradient(to bottom, transparent 0%, black 60%)",
                  WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 60%)",
                }}
              />
            </div>

            {/* Semi-transparent background with top fade */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: "linear-gradient(to bottom, transparent 0%, rgba(10,10,20,0.75) 15%, rgba(10,10,20,0.88) 30%, rgba(10,10,20,0.92) 100%)",
              }}
            />

            {/* Type plaque */}
            <div
              className="absolute left-1/2 -translate-x-1/2 z-[4]"
              style={{ top: "8%", width: `${L.plaque.width}%` }}
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
                    fontSize: "clamp(6px, 0.8vw, 10px)",
                    fontWeight: 700,
                    color: "#3a2a1a",
                  }}
                >
                  {card.type}
                </span>
              </div>
            </div>

            {/* Description text */}
            <div
              className="absolute z-[5] overflow-hidden flex flex-col items-center justify-center"
              style={{
                top: "28%",
                bottom: "8%",
                left: `${L.desc.paddingX}%`,
                right: `${L.desc.paddingX}%`,
                fontFamily: CARD_FONT,
              }}
            >
              {renderDescription()}
            </div>
          </div>

          {/* ── Energy cost orb ── */}
          {renderCostOrb()}
          {renderStarCost()}
        </div>
      </div>
    );
  }

  // =====================================================================
  // STANDARD CARD — normal framed layout
  // =====================================================================
  return (
    <div className="group relative transition-transform hover:scale-[1.03] hover:z-10 cursor-pointer select-none">
      <div className="relative" style={{ aspectRatio: "598/844" }}>

        {/* ── Layer 0: Card portrait ── */}
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

        {/* ── Layer 1: Card frame (HSV-tinted) ── */}
        <Image
          src={frameAsset}
          alt=""
          fill
          className="object-contain pointer-events-none z-[1]"
          style={{ filter: frameFilter }}
          sizes="(max-width: 640px) 45vw, (max-width: 1024px) 22vw, 14vw"
          priority={false}
        />

        {/* ── Layer 2: Portrait border ── */}
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

        {/* ── Layer 3: Name banner (653x145, wider & taller than frame top) ── */}
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
              fontSize: "clamp(9px, 1.4vw, 16px)",
              fontWeight: 800,
              color: isUpgraded ? "#6ee67a" : "#ffffff",
              textShadow: outlineShadow(isUpgraded ? "#1a3a1a" : nameOutline, 1),
            }}
          >
            {card.name}{isUpgraded && "+"}
          </span>
        </div>

        {/* ── Layer 4: Type plaque ── */}
        <div
          className="absolute left-1/2 -translate-x-1/2 z-[4]"
          style={{
            top: `${L.plaque.top}%`,
            width: `${L.plaque.width}%`,
          }}
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
                fontSize: "clamp(6px, 0.8vw, 10px)",
                fontWeight: 700,
                color: "#3a2a1a",
              }}
            >
              {card.type}
            </span>
          </div>
        </div>

        {/* ── Layer 5: Description text ── */}
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

        {/* ── Layer 6: Energy cost orb ── */}
        {renderCostOrb()}

        {/* ── Layer 7: Star cost (Regent) ── */}
        {renderStarCost()}
      </div>
    </div>
  );
}

// =============================================================================
// Tooltip
// =============================================================================

function TermTooltip({ name, desc }: { name: string; desc: string }) {
  return (
    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-44 bg-[#0a0a1a]/95 border border-yellow-500/30 rounded px-2 py-1.5 text-left z-50 pointer-events-none shadow-xl">
      <span className="font-bold text-yellow-400 text-[10px] block">{name}</span>
      <span className="text-[9px] text-gray-300 font-normal leading-relaxed not-italic">{desc}</span>
    </span>
  );
}

// =============================================================================
// Description parsing
// =============================================================================

interface DescPart {
  type: "text" | "gold" | "newline" | "energy";
  text: string;
}

function cleanDescription(desc: string): string {
  let text = desc;
  text = text.replace(/choose\([^)]*\):([^|}]*)\|[^}]*\}/g, "$1");
  text = text.replace(/\{[^}]*\}/g, "");
  text = text.replace(/\[[A-Z][a-zA-Z]*\]/g, "");
  return text;
}

function parseDescription(rawDesc: string): DescPart[] {
  const desc = cleanDescription(rawDesc);
  const parts: DescPart[] = [];
  const regex = /\[gold\](.*?)\[\/gold\]|\[energy:(\d+)\]|\[\/?\w+(?::?\w*)*\]|\n/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(desc)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", text: desc.slice(lastIndex, match.index) });
    }
    if (match[0] === "\n") {
      parts.push({ type: "newline", text: "" });
    } else if (match[1] !== undefined) {
      parts.push({ type: "gold", text: match[1] });
    } else if (match[2] !== undefined) {
      parts.push({ type: "energy", text: match[2] });
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < desc.length) {
    parts.push({ type: "text", text: desc.slice(lastIndex) });
  }
  return parts;
}

// Build upgraded description by substituting {Var:diff()} templates with upgraded values
function renderUpgradedDescription(card: CodexCard): string {
  if (!card.upgrade || !card.descriptionRaw) return card.description;

  // Apply upgrade diffs to base vars
  const upgradedVars: Record<string, number> = { ...card.vars };
  for (const [key, diff] of Object.entries(card.upgrade)) {
    if (typeof diff === "string" && diff.match(/^[+-]\d+/)) {
      const delta = parseInt(diff, 10);
      // upgrade keys are lowercase, vars keys are mixed case — match case-insensitively
      const varKey = Object.keys(upgradedVars).find(
        (k) => k.toLowerCase() === key.toLowerCase()
      );
      if (varKey) {
        upgradedVars[varKey] = (upgradedVars[varKey] ?? 0) + delta;
      }
    }
  }

  // Substitute {VarName:diff()} or {VarName} with upgraded values
  return card.descriptionRaw.replace(
    /\{(\w+)(?::diff\(\))?\}/g,
    (match, varName: string) => {
      if (varName in upgradedVars) return String(upgradedVars[varName]);
      // Case-insensitive fallback
      const key = Object.keys(upgradedVars).find(
        (k) => k.toLowerCase() === varName.toLowerCase()
      );
      return key ? String(upgradedVars[key]) : match;
    }
  );
}
