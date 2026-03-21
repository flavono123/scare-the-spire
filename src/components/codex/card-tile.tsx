"use client";

import { useState } from "react";
import Image from "next/image";
import { CodexCard } from "@/lib/codex-types";

// === Card type -> frame asset path ===
const FRAME_ASSETS: Record<string, string> = {
  공격: "/images/game-assets/card-frames/card_frame_attack.png",
  스킬: "/images/game-assets/card-frames/card_frame_skill.png",
  파워: "/images/game-assets/card-frames/card_frame_power.png",
  저주: "/images/game-assets/card-frames/card_frame_skill.png",
  상태이상: "/images/game-assets/card-frames/card_frame_skill.png",
  퀘스트: "/images/game-assets/card-frames/card_frame_quest.png",
};

// === Character color -> CSS filter to recolor red base frame ===
// Base frame is ironclad red. Transform with hue-rotate/saturate/brightness.
const CHAR_FILTER: Record<string, string> = {
  ironclad:    "hue-rotate(0deg) saturate(1) brightness(1)",
  silent:      "hue-rotate(121deg) saturate(0.8) brightness(0.75)",
  defect:      "hue-rotate(-169deg) saturate(1.2) brightness(1)",
  necrobinder: "hue-rotate(-60deg) saturate(0.8) brightness(0.8)",
  regent:      "hue-rotate(20deg) saturate(1) brightness(1)",
  colorless:   "hue-rotate(0deg) saturate(0) brightness(0.65)",
  curse:       "hue-rotate(-48deg) saturate(0.9) brightness(0.55)",
  event:       "hue-rotate(84deg) saturate(0.8) brightness(0.65)",
  status:      "hue-rotate(28deg) saturate(0.9) brightness(0.7)",
  token:       "hue-rotate(0deg) saturate(0) brightness(0.6)",
  quest:       "hue-rotate(-169deg) saturate(0.8) brightness(0.7)",
};

// === Rarity -> banner hue filter ===
// Base banner is cyan (#5BC8D8). Transform to rarity colors.
const RARITY_BANNER_FILTER: Record<string, string> = {
  기본:        "hue-rotate(0deg) saturate(0) brightness(0.7)",       // gray
  일반:        "hue-rotate(0deg) saturate(0) brightness(0.75)",      // silver
  고급:        "hue-rotate(-10deg) saturate(0.8) brightness(0.85)",  // blue (close to base)
  희귀:        "hue-rotate(-140deg) saturate(1.2) brightness(0.9)",  // gold
  "고대의 존재": "hue-rotate(-100deg) saturate(0.6) brightness(0.7)", // greenish
  이벤트:      "hue-rotate(-80deg) saturate(0.5) brightness(0.6)",
  토큰:        "hue-rotate(0deg) saturate(0) brightness(0.5)",
  저주:        "hue-rotate(150deg) saturate(0.6) brightness(0.4)",
  상태이상:     "hue-rotate(-120deg) saturate(0.4) brightness(0.5)",
  퀘스트:      "hue-rotate(-30deg) saturate(0.7) brightness(0.7)",
};

// === Energy icon paths (extracted from game) ===
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

// Font style for card text (actual game fonts)
const CARD_FONT = "var(--font-gc-batang), var(--font-kreon), serif";
const TITLE_FONT = "var(--font-spectral), var(--font-gc-batang), serif";

// Keyword descriptions
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

interface CardTileProps {
  card: CodexCard;
  showUpgrade: boolean;
  showBeta: boolean;
}

export function CardTile({ card, showUpgrade, showBeta }: CardTileProps) {
  const [imgError, setImgError] = useState(false);
  const [hoveredTerm, setHoveredTerm] = useState<string | null>(null);

  // Image selection
  let imageSrc: string | null = null;
  if (showBeta && card.betaImageUrl) imageSrc = card.betaImageUrl;
  else if (card.imageUrl) imageSrc = card.imageUrl;
  else if (card.betaImageUrl) imageSrc = card.betaImageUrl;

  // Cost
  let costDisplay = "";
  if (card.isXCost) costDisplay = "X";
  else if (card.cost >= 0) {
    costDisplay = showUpgrade && card.upgrade?.cost !== undefined
      ? String(card.upgrade.cost) : String(card.cost);
  }

  const frameAsset = FRAME_ASSETS[card.type] ?? FRAME_ASSETS["스킬"];
  const charFilter = CHAR_FILTER[card.color] ?? CHAR_FILTER.colorless;
  const bannerFilter = RARITY_BANNER_FILTER[card.rarity] ?? RARITY_BANNER_FILTER["일반"];
  const energyIcon = ENERGY_ICONS[card.color] ?? ENERGY_ICONS.colorless;
  const descParts = parseDescription(card.description);
  const upgradeInfo = showUpgrade && card.upgrade ? formatUpgrade(card) : null;
  const hasKeywords = card.keywords.length > 0;

  // Art area positioning based on frame shape analysis (598x844)
  // Attack V-notch: art ~5%-55%, desc starts ~57%
  // Skill straight: art ~5%-58%, desc starts ~58%
  // Power hex-cut: art ~5%-52%, desc starts ~54%
  const artHeightPct = card.type === "공격" ? "52%" : card.type === "파워" ? "48%" : "55%";
  const descTopPct = card.type === "공격" ? "55%" : card.type === "파워" ? "52%" : "57%";

  return (
    <div className="group relative transition-transform hover:scale-[1.03] hover:z-10 cursor-pointer select-none">
      <div className="relative" style={{ aspectRatio: "598/844" }}>
        {/* Layer 1: Card frame (game asset, color-shifted) */}
        <Image
          src={frameAsset}
          alt=""
          fill
          className="object-contain pointer-events-none"
          style={{ filter: charFilter }}
          sizes="(max-width: 640px) 45vw, (max-width: 1024px) 22vw, 14vw"
          priority={false}
        />

        {/* Layer 2: Card art (positioned within frame art area) */}
        <div
          className="absolute overflow-hidden"
          style={{
            top: "10%",
            left: "7%",
            right: "7%",
            height: artHeightPct,
          }}
        >
          {imageSrc && !imgError ? (
            <Image
              src={imageSrc}
              alt={card.name}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 40vw, (max-width: 1024px) 20vw, 12vw"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="flex items-center justify-center h-full bg-black/30 text-gray-500 text-[10px]">
              No Image
            </div>
          )}
        </div>

        {/* Layer 3: Name banner (game asset, rarity-colored) */}
        <div
          className="absolute flex items-center justify-center"
          style={{
            top: "1%",
            left: "-4%",
            right: "-4%",
            height: "12%",
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
            className="relative z-10 text-center truncate px-[18%]"
            style={{
              fontFamily: TITLE_FONT,
              fontSize: "clamp(10px, 1.4vw, 14px)",
              fontWeight: 700,
              color: "#2a2a2a",
              textShadow: "0 1px 0 rgba(255,255,255,0.25)",
              marginTop: "1%",
            }}
          >
            {card.name}
          </span>
        </div>

        {/* Layer 4: Type badge (small plaque at art/desc boundary) */}
        <div
          className="absolute left-1/2 -translate-x-1/2 z-10"
          style={{ top: `calc(${descTopPct} - 2%)` }}
        >
          <div className="relative">
            <Image
              src="/images/game-assets/card-misc/card_portrait_border_plaque.png"
              alt=""
              width={60}
              height={36}
              className="pointer-events-none"
              style={{ filter: bannerFilter }}
            />
            <span
              className="absolute inset-0 flex items-center justify-center"
              style={{
                fontFamily: CARD_FONT,
                fontSize: "8px",
                fontWeight: 700,
                color: "#2a2a2a",
              }}
            >
              {card.type}
            </span>
          </div>
        </div>

        {/* Layer 5: Description area (text over frame's dark area) */}
        <div
          className="absolute left-[8%] right-[8%] bottom-[5%] overflow-hidden flex flex-col justify-center"
          style={{
            top: `calc(${descTopPct} + 2%)`,
            fontFamily: CARD_FONT,
          }}
        >
          {/* Keywords */}
          {hasKeywords && (
            <div className="text-center mb-0.5 flex-shrink-0">
              {card.keywords.map((kw, i) => (
                <span key={i}>
                  {i > 0 && <span className="text-gray-500 text-[8px]"> · </span>}
                  <span
                    className="relative text-[10px] font-bold text-yellow-500 italic cursor-help"
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
            </div>
          )}

          {/* Description */}
          <div className="text-center text-[10px] leading-[1.45] text-gray-100 overflow-hidden flex-1">
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
          </div>

          {upgradeInfo && (
            <p className="text-center text-[8px] text-green-400 mt-0.5 flex-shrink-0">
              ▲ {upgradeInfo}
            </p>
          )}
        </div>

        {/* Layer 6: Cost orb (protruding top-left) */}
        {costDisplay && (
          <div className="absolute z-20" style={{ top: "-5%", left: "-5%" }}>
            <div className="relative" style={{ width: "20%", paddingBottom: "20%" }}>
              <Image
                src={energyIcon}
                alt="cost"
                fill
                className="object-contain drop-shadow-lg"
              />
              <span
                className="absolute inset-0 flex items-center justify-center font-black text-white"
                style={{
                  fontSize: "clamp(11px, 1.5vw, 16px)",
                  textShadow: "0 1px 3px rgba(0,0,0,0.9)",
                  fontFamily: TITLE_FONT,
                }}
              >
                {costDisplay}
              </span>
            </div>
            {/* Star cost below for Regent */}
            {card.starCost !== null && (
              <div className="relative mx-auto -mt-1" style={{ width: "60%" }}>
                <Image
                  src="/images/game-assets/card-misc/energy_regent.png"
                  alt="star"
                  width={28}
                  height={28}
                  className="w-full h-auto drop-shadow-md"
                />
                <span className="absolute inset-0 flex items-center justify-center text-[9px] font-black text-white">
                  {card.starCost}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TermTooltip({ name, desc }: { name: string; desc: string }) {
  return (
    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-44 bg-[#0a0a1a]/95 border border-yellow-500/30 rounded px-2 py-1.5 text-left z-50 pointer-events-none shadow-xl">
      <span className="font-bold text-yellow-400 text-[10px] block">{name}</span>
      <span className="text-[9px] text-gray-300 font-normal leading-relaxed not-italic">{desc}</span>
    </span>
  );
}

// === Description parsing ===

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

function formatUpgrade(card: CodexCard): string | null {
  if (!card.upgrade) return null;
  const parts: string[] = [];
  for (const [key, val] of Object.entries(card.upgrade)) {
    if (key === "cost") parts.push(`비용→${val}`);
    else if (key === "add_retain") parts.push("+보존");
    else if (key === "add_innate") parts.push("+선천성");
    else if (key === "remove_ethereal") parts.push("-휘발성");
    else if (key === "remove_exhaust") parts.push("-소멸");
    else if (typeof val === "string" && val.startsWith("+")) parts.push(`${key}${val}`);
  }
  return parts.length > 0 ? parts.join(" ") : null;
}
