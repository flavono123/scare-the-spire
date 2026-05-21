"use client";

import { useState, memo, Fragment, CSSProperties } from "react";
import Image from "@/components/ui/static-image";
import type { ServiceLocale } from "@/lib/i18n";
import { getCodexServiceMessages } from "@/lib/codex-service";
import { CodexCard } from "@/lib/codex-types";
import {
  hasCardUpgrade,
  parseDescription,
  renderCardDescription,
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
import { CardEngagementStatsOverlay } from "./engagement-stats";
import { resolveSts2EnergyIcon } from "@/lib/sts2-energy-icons";

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

const ANCIENT_FLAME_SHEET = "/images/game-assets/card-misc/ancient_card_flame_sheet.png";
const INFECTION_CARD_ID = "INFECTION";
const INFECTION_OVERLAY_BASE = "/images/sts2/card-overlays/infection/base.webp";
const INFECTION_OVERLAY_ANIMATED = "/images/sts2/card-overlays/infection/overlay.webp";
const AFFLICTION_OVERLAY_BASE = "/images/sts2/affliction-overlays";
const AFFLICTION_OVERLAY_IDS = new Set([
  "BOUND",
  "ENTANGLED",
  "GALVANIZED",
  "HEXED",
  "RINGING",
  "SMOG",
]);

const AFFLICTION_FRAME_COLORS: Record<string, { vignette?: string; glow: string }> = {
  BOUND: {
    vignette: "rgba(38, 153, 80, 0.1254902)",
    glow: "rgba(140, 255, 77, 1)",
  },
  ENTANGLED: {
    vignette: "rgba(51, 18, 0, 0.3764706)",
    glow: "rgba(216, 122, 91, 1)",
  },
  GALVANIZED: {
    vignette: "rgba(0, 162, 255, 0.2509804)",
    glow: "rgba(128, 223, 255, 1)",
  },
  HEXED: {
    vignette: "rgba(14, 0, 26, 0.5019608)",
    glow: "rgba(165, 121, 219, 1)",
  },
  RINGING: {
    glow: "rgba(174, 252, 255, 1)",
  },
  SMOG: {
    vignette: "rgba(14, 0, 26, 0.2509804)",
    glow: "rgba(202, 122, 202, 1)",
  },
};

const ENTANGLED_LEAVES = [
  { x: -102, y: -218, rotation: -0.5255747, scale: 0.5397214 },
  { x: -82, y: -207, rotation: 1.3220456, scale: 0.40900528 },
  { x: 105, y: -205, rotation: -1.0907083, scale: 0.419221 },
  { x: 148, y: -140, rotation: 0.62127, scale: 0.5397214 },
  { x: 148, y: -33, rotation: -0.592255, scale: 0.5397214 },
  { x: 145, y: 81, rotation: -1.1490887, scale: 0.39509588 },
  { x: 146, y: 145, rotation: -0.0710828, scale: 0.5397214 },
  { x: 109, y: 203, rotation: -0.87968427, scale: 0.44095248 },
  { x: -145, y: 110, rotation: 0.50267345, scale: 0.6153229 },
  { x: -153, y: 27, rotation: -1.2563549, scale: 0.6800933 },
  { x: -158, y: -17, rotation: 0.49224094, scale: 0.5397214 },
];

const PORTRAIT_BORDER_ASSETS: Record<string, string> = {
  공격: "/images/game-assets/card-portraits/card_portrait_border_attack.png",
  스킬: "/images/game-assets/card-portraits/card_portrait_border_skill.png",
  파워: "/images/game-assets/card-portraits/card_portrait_border_power.png",
  저주: "/images/game-assets/card-portraits/card_portrait_border_skill.png",
  상태이상: "/images/game-assets/card-portraits/card_portrait_border_skill.png",
  퀘스트: "/images/game-assets/card-portraits/card_portrait_border_skill.png",
};

function InfectionCardOverlay() {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 z-[3] pointer-events-none overflow-visible"
    >
      <Image
        src={INFECTION_OVERLAY_BASE}
        alt=""
        className="absolute max-w-none object-fill"
        style={{
          left: "2.33%",
          top: "1.18%",
          width: "93.67%",
          height: "93.84%",
        }}
      />
      <Image
        src={INFECTION_OVERLAY_ANIMATED}
        alt=""
        className="absolute max-w-none object-fill"
        style={{
          left: "-5.67%",
          top: "-5.92%",
          width: "111.05%",
          height: "108.29%",
        }}
      />
    </div>
  );
}

function AfflictionImageLayer({
  src,
  className,
  style,
  imageClassName = "object-fill",
}: {
  src: string;
  className?: string;
  style?: CSSProperties;
  imageClassName?: string;
}) {
  return (
    <span aria-hidden="true" className={`absolute ${className ?? ""}`} style={style}>
      <Image src={src} alt="" fill className={imageClassName} />
    </span>
  );
}

function AfflictionFrameBackdrop({ id }: { id: string }) {
  const colors = AFFLICTION_FRAME_COLORS[id] ?? AFFLICTION_FRAME_COLORS.BOUND;
  return (
    <>
      {id === "BOUND" && (
        <AfflictionImageLayer
          src={`${AFFLICTION_OVERLAY_BASE}/bound/bound_border_shader.webp`}
          className="sts2-affliction-overlay__border"
          style={{ left: "-20.33%", top: 0, width: "140.67%", height: "100%" }}
        />
      )}
      {colors.vignette && (
        <span
          aria-hidden="true"
          className="sts2-affliction-overlay__vignette"
          style={{ backgroundColor: colors.vignette }}
        />
      )}
    </>
  );
}

function AfflictionFrameGlow({ id }: { id: string }) {
  const colors = AFFLICTION_FRAME_COLORS[id] ?? AFFLICTION_FRAME_COLORS.BOUND;
  return (
    <>
      <span
        aria-hidden="true"
        className="sts2-affliction-overlay__glow"
        style={{ backgroundColor: colors.glow }}
      />
    </>
  );
}

function EntangledLeaves() {
  return (
    <>
      {ENTANGLED_LEAVES.map((leaf, index) => {
        const centerX = 150 + leaf.x;
        const centerY = 211 + leaf.y;
        return (
          <AfflictionImageLayer
            key={`${leaf.x}:${leaf.y}:${index}`}
            src={`${AFFLICTION_OVERLAY_BASE}/entangled/entangled_leaf_shader.webp`}
            className="sts2-affliction-overlay__entangled-leaf"
            style={{
              left: `${((centerX - 64) / 300) * 100}%`,
              top: `${((centerY - 64) / 422) * 100}%`,
              width: `${(128 / 300) * 100}%`,
              height: `${(128 / 422) * 100}%`,
              transform: `rotate(${leaf.rotation}rad) scale(${leaf.scale * 0.48})`,
            }}
          />
        );
      })}
    </>
  );
}

function GalvanizedCorner({
  style,
}: {
  style?: CSSProperties;
}) {
  return (
    <AfflictionImageLayer
      src={`${AFFLICTION_OVERLAY_BASE}/galvanized/galvanized_lightning_corner_shader.webp`}
      className="sts2-affliction-overlay__galvanized-corner"
      style={style}
    />
  );
}

function AfflictionCardOverlay({ afflictionId }: { afflictionId: string | null | undefined }) {
  const id = afflictionId?.toUpperCase();
  if (!id || !AFFLICTION_OVERLAY_IDS.has(id)) return null;

  return (
    <div
      aria-hidden="true"
      className={`absolute inset-0 z-[3] pointer-events-none overflow-visible sts2-affliction-overlay sts2-affliction-overlay--${id.toLowerCase()}`}
    >
      <div className="absolute inset-0 overflow-hidden sts2-affliction-overlay__mask">
        <AfflictionFrameBackdrop id={id} />

        {id === "GALVANIZED" && (
          <AfflictionImageLayer
            src={`${AFFLICTION_OVERLAY_BASE}/galvanized/galvanized_main_shader.webp`}
            className="sts2-affliction-overlay__main sts2-affliction-overlay__main--galvanized"
            style={{ left: "-20.33%", top: 0, width: "140.67%", height: "100%" }}
          />
        )}

        {id === "HEXED" && (
          <AfflictionImageLayer
            src={`${AFFLICTION_OVERLAY_BASE}/hexed/hexed_main_shader.webp`}
            className="sts2-affliction-overlay__main sts2-affliction-overlay__main--hexed"
            style={{ left: "-20.33%", top: 0, width: "140.67%", height: "100%" }}
          />
        )}

        {id === "RINGING" && (
          <AfflictionImageLayer
            src={`${AFFLICTION_OVERLAY_BASE}/ringing/ringing_main_shader.webp`}
            className="sts2-affliction-overlay__main sts2-affliction-overlay__main--ringing"
            style={{ left: "-20.33%", top: 0, width: "140.67%", height: "100%" }}
          />
        )}

        {id === "SMOG" && (
          <AfflictionImageLayer
            src={`${AFFLICTION_OVERLAY_BASE}/smog/smog_main_shader.webp`}
            className="sts2-affliction-overlay__smog-field"
            style={{ inset: 0 }}
          />
        )}

        {id === "SMOG" && (
          <AfflictionImageLayer
            src={`${AFFLICTION_OVERLAY_BASE}/smog/smog_outer_shader.webp`}
            className="sts2-affliction-overlay__smog-field sts2-affliction-overlay__smog-field--outer"
            style={{ left: "-20.33%", top: "-3.55%", width: "140.67%", height: "133.3%" }}
          />
        )}

        <AfflictionFrameGlow id={id} />
      </div>

      {id === "BOUND" && (
        <AfflictionImageLayer
          src={`${AFFLICTION_OVERLAY_BASE}/bound/bound_main_shader.webp`}
          className="sts2-affliction-overlay__main sts2-affliction-overlay__main--bound"
          style={{
            left: "-34.33%",
            top: "-9.95%",
            width: "140.67%",
            height: "100%",
            transform: "scale(1.2)",
          }}
        />
      )}

      {id === "ENTANGLED" && (
        <>
          <AfflictionImageLayer
            src={`${AFFLICTION_OVERLAY_BASE}/entangled/entangled_main_shader.webp`}
            className="sts2-affliction-overlay__main sts2-affliction-overlay__main--entangled"
            style={{
              left: "-34.33%",
              top: "-9.95%",
              width: "140.67%",
              height: "100%",
              transform: "scale(1.2)",
            }}
          />
          <EntangledLeaves />
        </>
      )}

      {id === "GALVANIZED" && (
        <>
          <GalvanizedCorner style={{ left: "-6%", top: "-4%", transform: "rotate(0deg)" }} />
          <GalvanizedCorner style={{ right: "-6%", top: "-4%", transform: "rotate(90deg)" }} />
          <GalvanizedCorner style={{ right: "-6%", bottom: "-4%", transform: "rotate(180deg)" }} />
          <GalvanizedCorner style={{ left: "-6%", bottom: "-4%", transform: "rotate(270deg)" }} />
        </>
      )}
    </div>
  );
}

const UPGRADE_ADDED_KEYWORDS: Record<string, string> = {
  add_innate: "선천성",
  innate: "선천성",
  add_retain: "보존",
};

const UPGRADE_REMOVED_KEYWORDS: Record<string, string> = {
  remove_exhaust: "소멸",
  remove_ethereal: "휘발성",
};

const PRE_DESCRIPTION_KEYWORD_ORDER = ["사용불가", "선천성", "휘발성"];

function getUpgradeKeywords(
  upgrade: CodexCard["upgrade"],
  mapping: Record<string, string>,
): string[] {
  if (!upgrade) return [];
  return Object.entries(mapping).flatMap(([key, keyword]) => (
    upgrade[key] ? [keyword] : []
  ));
}

// =============================================================================
// Fonts
// =============================================================================

const CARD_FONT = "var(--font-game-text)";
const TITLE_FONT = "var(--font-game-title)";

// =============================================================================
// Layout config (% of 300×422 holder coords)
// banner: card.tscn NameBanner offset(-160 ~ 160, -250 ~ -180) → w=320(=107%), h=70/422=16.6%
// energy orb: 64×64 / holder ~21%
// =============================================================================

const L = {
  art: { top: 9, left: 6, right: 6, bottom: 56 },
  portraitBorder: { width: 92, height: 50, top: 9 },
  banner: { top: 3, height: 17, overhangX: 9 },
  ancientBanner: { top: -2.4, width: 112, aspectRatio: "671/182", titlePaddingX: 16, titleTranslateY: -28 },
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
  serviceLocale?: ServiceLocale;
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
  /** Active affliction overlay id. */
  afflictionId?: string | null;
  /** 카드에 박힌 인챈트 슬롯을 클릭했을 때 (해제 등). */
  onEnchantSlotClick?: () => void;
  onClick?: () => void;
  /** Static preview mode: disables pointer cursor and hover scale. */
  interactive?: boolean;
  engagementStats?: {
    commentCount: number;
    likeCount: number;
    loading: boolean;
    unavailable: boolean;
  } | null;
}

export const CardTile = memo(function CardTile({
  card,
  serviceLocale = "ko",
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
  afflictionId,
  onEnchantSlotClick,
  onClick,
  interactive = true,
  engagementStats,
}: CardTileProps) {
  const serviceText = getCodexServiceMessages(serviceLocale);
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
    costDisplay = showUpgrade && hasCardUpgrade(card) && card.upgrade?.cost !== undefined
      ? String(card.upgrade.cost) : String(card.cost);
  }

  const frameAsset = FRAME_ASSETS[card.type] ?? FRAME_ASSETS["스킬"];
  const portraitBorderAsset = PORTRAIT_BORDER_ASSETS[card.type] ?? PORTRAIT_BORDER_ASSETS["스킬"];
  const visualColor = card.visualColor ?? card.color;
  const charHsv = CHAR_FRAME_HSV[visualColor] ?? CHAR_FRAME_HSV.colorless;
  const frameFilter = hsvToFilter(charHsv);
  const bannerHsv = RARITY_BANNER_HSV[card.rarity] ?? RARITY_BANNER_HSV["일반"];
  const bannerFilter = hsvToFilter(bannerHsv);

  const isUpgraded = showUpgrade && hasCardUpgrade(card);
  const titleOutline = isUpgraded
    ? TITLE_UPGRADED_OUTLINE
    : (TITLE_OUTLINE_COLOR[card.rarity] ?? TITLE_OUTLINE_COLOR["일반"]);
  const titleColor = isUpgraded ? TEXT_GREEN : TEXT_CREAM;
  const costOutline = ENERGY_OUTLINE_COLOR[visualColor] ?? ENERGY_OUTLINE_COLOR.colorless;
  const energyIcon = resolveSts2EnergyIcon(visualColor);
  const isAncientCard = card.rarity === "고대의 존재";
  const isInfectionCard = card.id === INFECTION_CARD_ID;

  // 게임 outline_size: title=12, cost=16, type=0, enchant amount=8 (card.tscn)
  const titleStroke = gameStroke(titleOutline, cardWidth, 12);
  const costStroke = gameStroke(costOutline, cardWidth, 16);
  const starStroke = gameStroke(STAR_OUTLINE_COLOR, cardWidth, 12);
  const enchantAmountStroke = gameStroke(ENCHANT_AMOUNT_OUTLINE, cardWidth, 8);

  // 강화 + 인챈트 모두 누적 적용 (게임 순서: base → upgrade → enchant).
  // descriptionRaw 가 없으면 통합 함수가 card.description 으로 폴백.
  const hasEnchantStat = Boolean(
    enchantStatMod &&
      (enchantStatMod.damageAdd || enchantStatMod.damageMultiplier || enchantStatMod.blockAdd)
  );
  const descText = isUpgraded || hasEnchantStat
    ? renderCardDescription(card, {
        upgrade: isUpgraded,
        enchantMod: hasEnchantStat ? enchantStatMod : null,
      })
    : card.description;
  const descParts = parseDescription(descText);
  // 인챈트 추가 텍스트 — 분홍 baseline + 안의 모든 색을 분홍 통일.
  const suffixParts = descriptionSuffix
    ? parseDescription(descriptionSuffix)
    : null;

  // 표시할 키워드: 카드 keywords + 강화/인챈트 추가 - 강화/인챈트 제거
  const upgradeAddedKeywords = isUpgraded
    ? getUpgradeKeywords(card.upgrade, UPGRADE_ADDED_KEYWORDS)
    : [];
  const upgradeRemovedKeywords = isUpgraded
    ? getUpgradeKeywords(card.upgrade, UPGRADE_REMOVED_KEYWORDS)
    : [];
  const removedSet = new Set([
    ...upgradeRemovedKeywords,
    ...(enchantRemovedKeywords ?? []),
  ]);
  const baseKeywords = card.keywords.filter((k) => !removedSet.has(k));
  const displayKeywords = [
    ...baseKeywords,
    ...[...upgradeAddedKeywords, ...(enchantAddedKeywords ?? [])].filter(
      (k) => !removedSet.has(k) && !baseKeywords.includes(k)
    ),
  ];
  const keywordLookupKey = (keyword: string): string => keyword.split(/\s/)[0];
  const keywordDisplayText = (keyword: string): string => {
    const lookupKey = keywordLookupKey(keyword);
    const label = card.keywordLabels[lookupKey] ?? lookupKey;
    return keyword.replace(lookupKey, label);
  };
  const preDescriptionKeywords = displayKeywords
    .filter((kw) => PRE_DESCRIPTION_KEYWORD_ORDER.includes(keywordLookupKey(kw)))
    .sort((a, b) => (
      PRE_DESCRIPTION_KEYWORD_ORDER.indexOf(keywordLookupKey(a)) -
      PRE_DESCRIPTION_KEYWORD_ORDER.indexOf(keywordLookupKey(b))
    ));
  const postDescriptionKeywords = displayKeywords.filter(
    (kw) => !PRE_DESCRIPTION_KEYWORD_ORDER.includes(keywordLookupKey(kw)),
  );
  const renderKeyword = (kw: string) => {
    // 인챈트/강화 추가 키워드도 게임에선 일반 키워드와 동일한 골드.
    // 키워드 hover lookup은 첫 단어만 (예: "재사용 1" → "재사용")
    const lookupKey = keywordLookupKey(kw);
    const displayText = keywordDisplayText(kw);
    return (
      <span
        className="relative font-bold cursor-help"
        style={{ color: TEXT_GOLD }}
        onMouseEnter={() => setHoveredTerm(kw)}
        onMouseLeave={() => setHoveredTerm(null)}
      >
        {displayText}
        {hoveredTerm === kw && KEYWORD_DESC[lookupKey] && (
          <TermTooltip name={displayText} desc={KEYWORD_DESC[lookupKey]} />
        )}
      </span>
    );
  };
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
      {preDescriptionKeywords.map((kw, i) => (
        <Fragment key={`pre-kw-${kw}`}>
          {i > 0 && <br />}
          {renderKeyword(kw)}
        </Fragment>
      ))}
      {preDescriptionKeywords.length > 0 && descParts.length > 0 && <br />}
      {renderParts(descParts, "card")}
      {suffixParts && (
        <>
          <br />
          <span style={{ color: "#EE82EE" }}>{renderParts(suffixParts, "suffix")}</span>
        </>
      )}
      {postDescriptionKeywords.length > 0 && (
        <>
          <br />
          {postDescriptionKeywords.map((kw, i) => (
            <span key={`post-kw-${kw}`}>
              {i > 0 && <span className="text-gray-500"> · </span>}
              {renderKeyword(kw)}
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
  const slotInteractive = Boolean(onEnchantSlotClick);
  const enchantmentSlotLabel = enchantmentLabel ?? serviceText.enchantments;
  const removeEnchantActionLabel = serviceLocale === "ko"
    ? `${enchantmentSlotLabel} ${serviceText.cardsView.enchantments.remove}`
    : `${serviceText.cardsView.enchantments.remove} ${enchantmentSlotLabel}`;
  const renderEnchantSlot = () => enchantmentImageUrl ? (
    <div
      role={slotInteractive ? "button" : undefined}
      aria-label={slotInteractive ? removeEnchantActionLabel : undefined}
      tabIndex={slotInteractive ? 0 : undefined}
      onClick={slotInteractive
        ? (e) => {
            e.stopPropagation();
            onEnchantSlotClick?.();
          }
        : undefined}
      onKeyDown={slotInteractive
        ? (e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              onEnchantSlotClick?.();
            }
          }
        : undefined}
      className={`absolute z-[6] ${slotInteractive ? "cursor-pointer hover:scale-110 transition-transform" : "pointer-events-none"}`}
      style={{
        top: `${L.enchant.top}%`,
        left: `${L.enchant.left}%`,
        width: `${L.enchant.width}%`,
        aspectRatio: "72/54",
      }}
      title={slotInteractive ? removeEnchantActionLabel : enchantmentLabel ?? undefined}
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
  const cardRootClassName = interactive
    ? "group relative cursor-pointer select-none transition-transform hover:scale-[1.03] hover:z-10"
    : "group relative select-none";

  // =====================================================================
  // ANCIENT CARD
  // =====================================================================
  if (isAncientCard) {
    const ancientTextBg = ANCIENT_TEXT_BG[card.type] ?? ANCIENT_TEXT_BG["스킬"];
    const ancientBannerFilter = hsvToFilter(ANCIENT_BANNER_HSV);

    return (
      <div
        className={cardRootClassName}
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

          <AfflictionCardOverlay afflictionId={afflictionId} />

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
            className="absolute left-1/2 z-[3] flex -translate-x-1/2 items-center justify-center"
            style={{
              top: `${L.ancientBanner.top}%`,
              width: `${L.ancientBanner.width}%`,
              aspectRatio: L.ancientBanner.aspectRatio,
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
                aria-hidden
                className="pointer-events-none absolute left-1/2 z-[8]"
                style={{
                  top: "5%",
                  width: "66%",
                  height: "50%",
                  transform: "translateX(-50%)",
                  background: [
                    "linear-gradient(90deg, transparent 0%, rgba(83, 232, 255, 0.4) 22%, rgba(155, 255, 160, 0.26) 42%, rgba(255, 155, 78, 0.36) 70%, transparent 100%)",
                    "radial-gradient(ellipse at 50% 18%, rgba(236, 90, 255, 0.32) 0%, transparent 38%)",
                    "radial-gradient(ellipse at 50% 70%, rgba(255, 245, 190, 0.18) 0%, transparent 42%)",
                  ].join(", "),
                  filter: "blur(1.6px)",
                  mixBlendMode: "screen",
                  opacity: 0.9,
                }}
              />
              <span
                aria-hidden
                className="pointer-events-none absolute z-[9] overflow-hidden"
                style={{
                  left: "50.15%",
                  top: "-12.05%",
                  width: "9%",
                  aspectRatio: "49 / 69",
                  transform: "translate(-50%, -50%)",
                }}
              >
                <Image
                  src={ANCIENT_FLAME_SHEET}
                  alt=""
                  fill
                  className="sts2-ancient-card-flame__sheet pointer-events-none"
                  style={{
                    width: "1000%",
                    maxWidth: "none",
                    height: "100%",
                  }}
                />
              </span>
              <span
                className="relative z-10 w-full truncate text-center"
              style={{
                paddingLeft: `${L.ancientBanner.titlePaddingX}%`,
                paddingRight: `${L.ancientBanner.titlePaddingX}%`,
                transform: `translateY(${L.ancientBanner.titleTranslateY}%)`,
                fontFamily: TITLE_FONT,
                fontSize: `${FONT_CQI.title}cqi`,
                fontWeight: 800,
                lineHeight: 1,
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
                {card.typeLabel}
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
          {engagementStats && (
            <CardEngagementStatsOverlay
              commentCount={engagementStats.commentCount}
              likeCount={engagementStats.likeCount}
              loading={engagementStats.loading}
              unavailable={engagementStats.unavailable}
              serviceLocale={serviceLocale}
            />
          )}
        </div>
      </div>
    );
  }

  // =====================================================================
  // STANDARD CARD
  // =====================================================================
  return (
    <div
      className={cardRootClassName}
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

        {isInfectionCard && <InfectionCardOverlay />}
        <AfflictionCardOverlay afflictionId={afflictionId} />

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
              {card.typeLabel}
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
        {engagementStats && (
          <CardEngagementStatsOverlay
            commentCount={engagementStats.commentCount}
            likeCount={engagementStats.likeCount}
            loading={engagementStats.loading}
            unavailable={engagementStats.unavailable}
            serviceLocale={serviceLocale}
          />
        )}
      </div>
    </div>
  );
});
