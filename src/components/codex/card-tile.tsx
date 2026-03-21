"use client";

import { useState } from "react";
import Image from "next/image";
import { CodexCard } from "@/lib/codex-types";

// === Character frame colors (extracted from slaythespire2.gg composites) ===
// base: main frame, light: bevel highlight, dark: bevel shadow, desc: description bg
const CHAR_FRAME: Record<string, { base: string; light: string; dark: string; desc: string }> = {
  ironclad:    { base: "#893322", light: "#d8493a", dark: "#742b1d", desc: "#433933" },
  silent:      { base: "#2a6635", light: "#3a9848", dark: "#1a4422", desc: "#333d33" },
  defect:      { base: "#11618b", light: "#448bce", dark: "#0c4f71", desc: "#353f45" },
  necrobinder: { base: "#6b2a60", light: "#a848a0", dark: "#4a1840", desc: "#3d3340" },
  regent:      { base: "#8b5520", light: "#c88030", dark: "#5a3810", desc: "#403833" },
  colorless:   { base: "#555555", light: "#808080", dark: "#353535", desc: "#383838" },
  curse:       { base: "#4a1838", light: "#6a3050", dark: "#301020", desc: "#352830" },
  event:       { base: "#3a5525", light: "#5a8038", dark: "#253818", desc: "#333833" },
  status:      { base: "#5a4520", light: "#806838", dark: "#3a2a10", desc: "#383330" },
  token:       { base: "#484848", light: "#686868", dark: "#2a2a2a", desc: "#353535" },
  quest:       { base: "#384060", light: "#506090", dark: "#202838", desc: "#333540" },
};

// === Rarity colors (ribbon, inner frame, type badge) ===
// Extracted: Basic/Common=silver #a5a5a5, Uncommon=blue #5ab0d0, Rare=gold #d4a843, Ancient=green-gold #90a860
const RARITY_FRAME: Record<string, { ribbon: string; frame: string; glow: string }> = {
  기본:        { ribbon: "#a5a5a5", frame: "#8a8a8a", glow: "transparent" },
  일반:        { ribbon: "#a5a5a5", frame: "#8a8a8a", glow: "rgba(165,165,165,0.08)" },
  고급:        { ribbon: "#5ab0d8", frame: "#4a90c0", glow: "rgba(90,176,216,0.15)" },
  희귀:        { ribbon: "#d4a843", frame: "#c89830", glow: "rgba(212,168,67,0.2)" },
  "고대의 존재": { ribbon: "#90a860", frame: "#80a050", glow: "rgba(144,168,96,0.15)" },
  이벤트:      { ribbon: "#80a060", frame: "#60884a", glow: "rgba(128,160,96,0.1)" },
  토큰:        { ribbon: "#8a8070", frame: "#706050", glow: "transparent" },
  저주:        { ribbon: "#705050", frame: "#604040", glow: "rgba(112,80,80,0.1)" },
  상태이상:     { ribbon: "#807060", frame: "#685840", glow: "rgba(128,112,96,0.08)" },
  퀘스트:      { ribbon: "#7080a0", frame: "#506888", glow: "rgba(112,128,160,0.1)" },
};

// Energy icon paths
const ENERGY_ICONS: Record<string, string> = {
  ironclad: "/images/spire-codex/icons/ironclad_energy_icon.png",
  silent: "/images/spire-codex/icons/silent_energy_icon.png",
  defect: "/images/spire-codex/icons/defect_energy_icon.png",
  necrobinder: "/images/spire-codex/icons/necrobinder_energy_icon.png",
  regent: "/images/spire-codex/icons/regent_energy_icon.png",
  colorless: "/images/spire-codex/icons/colorless_energy_icon.png",
};

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
  소멸: "카드가 게임에서 제거됩니다.",
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

  const starCost = card.starCost;
  const energyIcon = ENERGY_ICONS[card.color] ?? ENERGY_ICONS.colorless;
  const frame = CHAR_FRAME[card.color] ?? CHAR_FRAME.colorless;
  const rarity = RARITY_FRAME[card.rarity] ?? RARITY_FRAME["일반"];
  const descParts = parseDescription(card.description);
  const upgradeInfo = showUpgrade && card.upgrade ? formatUpgrade(card) : null;
  const hasKeywords = card.keywords.length > 0;

  return (
    <div className="group relative transition-transform hover:scale-[1.03] hover:z-10 cursor-pointer select-none">
      {/* === Outer card frame (character color, beveled) === */}
      <div
        className="relative rounded-xl overflow-hidden"
        style={{
          aspectRatio: "3/4.2",
          // Embossed/beveled border effect
          background: `linear-gradient(145deg, ${frame.light} 0%, ${frame.base} 30%, ${frame.base} 70%, ${frame.dark} 100%)`,
          boxShadow: `
            inset 2px 2px 3px ${frame.light}60,
            inset -2px -2px 3px ${frame.dark}80,
            0 4px 16px rgba(0,0,0,0.7)
          `,
          padding: "6px",
        }}
      >
        {/* === Inner card area === */}
        <div
          className="relative h-full rounded-lg overflow-hidden flex flex-col"
          style={{
            background: `linear-gradient(180deg, ${frame.base}40 0%, ${frame.desc} 40%, ${frame.desc} 100%)`,
            boxShadow: `inset 0 0 0 2px ${rarity.frame}90, 0 0 6px ${rarity.glow}`,
          }}
        >
          {/* --- Name ribbon (rarity-colored scroll) --- */}
          <div className="relative z-10 flex-shrink-0">
            <div className="relative mx-0.5 -mt-0.5">
              <svg viewBox="0 0 200 36" className="w-full" style={{ height: "28px" }} preserveAspectRatio="none">
                <defs>
                  <linearGradient id={`rib-${card.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={rarity.ribbon} />
                    <stop offset="40%" stopColor={rarity.ribbon} />
                    <stop offset="100%" stopColor={`${rarity.ribbon}cc`} />
                  </linearGradient>
                </defs>
                {/* Ribbon with curled ends extending past card */}
                <path
                  d="M0,8 Q0,0 10,2 L90,2 Q100,0 100,2 L110,2 Q120,0 120,2 L190,2 Q200,0 200,8 L200,24 Q200,32 194,34 L180,36 Q170,36 170,30 L170,28 Q168,24 162,24 L38,24 Q32,24 30,28 L30,30 Q30,36 20,36 L6,34 Q0,32 0,24 Z"
                  fill={`url(#rib-${card.id})`}
                  stroke={`${rarity.ribbon}80`}
                  strokeWidth="0.5"
                />
                {/* Highlight line at top */}
                <line x1="10" y1="4" x2="190" y2="4" stroke="white" strokeOpacity="0.25" strokeWidth="1" />
              </svg>
              <span
                className="absolute inset-0 flex items-center justify-center truncate px-5"
                style={{
                  fontFamily: "var(--font-cinzel), var(--font-spire), serif",
                  fontSize: "12px",
                  fontWeight: 700,
                  color: "#333333",
                  textShadow: "0 1px 0 rgba(255,255,255,0.3)",
                  paddingBottom: "3px",
                }}
              >
                {card.name}
              </span>
            </div>
          </div>

          {/* --- Card art area (pentagon bottom clip) --- */}
          <div className="relative flex-shrink-0 mx-1.5 mt-0.5" style={{ height: "48%" }}>
            <div
              className="relative w-full h-full overflow-hidden"
              style={{
                clipPath: "polygon(0 0, 100% 0, 100% 85%, 50% 100%, 0 85%)",
                border: `2px solid ${rarity.frame}60`,
                borderRadius: "4px 4px 0 0",
              }}
            >
              {imageSrc && !imgError ? (
                <Image
                  src={imageSrc}
                  alt={card.name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 45vw, (max-width: 1024px) 22vw, 14vw"
                  onError={() => setImgError(true)}
                />
              ) : (
                <div className="flex items-center justify-center h-full bg-black/50 text-gray-600 text-[10px]">
                  No Image
                </div>
              )}
            </div>

            {/* Type badge at pentagon bottom vertex */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1">
              <div
                className="px-2.5 py-0.5 rounded text-[8px] font-bold text-gray-800"
                style={{
                  fontFamily: "var(--font-spire), serif",
                  background: `linear-gradient(180deg, ${rarity.ribbon}cc, ${rarity.ribbon}88)`,
                  boxShadow: `0 1px 3px rgba(0,0,0,0.4)`,
                }}
              >
                {card.type}
              </div>
            </div>
          </div>

          {/* --- Description area --- */}
          <div
            className="flex-1 flex flex-col justify-center px-2 py-1.5 min-h-0 overflow-hidden rounded-b-md"
            style={{ background: frame.desc, borderTop: `1px solid ${frame.base}40`, fontFamily: "var(--font-spire), serif" }}
          >
            {/* Keywords (centered, gold, own line) */}
            {hasKeywords && (
              <div className="text-center mb-0.5 flex-shrink-0">
                {card.keywords.map((kw, i) => (
                  <span key={i}>
                    {i > 0 && <span className="text-gray-600 text-[9px]"> · </span>}
                    <span
                      className="relative text-[10px] font-bold text-yellow-500 cursor-help italic"
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

            {/* Description text */}
            <div className="text-center text-[10px] leading-[1.45] text-gray-100 overflow-hidden flex-1">
              {descParts.map((part, i) =>
                part.type === "gold" ? (
                  <span
                    key={i}
                    className="relative text-yellow-500 font-semibold cursor-help"
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
                    width={12}
                    height={12}
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
        </div>

        {/* === Cost orb (protruding top-left outside frame) === */}
        {costDisplay && (
          <div className="absolute -top-1.5 -left-1.5 z-20">
            <div className="relative w-9 h-9 drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]">
              <Image src={energyIcon} alt="cost" width={36} height={36} className="w-full h-full" />
              <span className="absolute inset-0 flex items-center justify-center text-sm font-black text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                {costDisplay}
              </span>
            </div>
            {/* Star cost below energy orb for Regent */}
            {starCost !== null && (
              <div className="relative w-6 h-6 -mt-1 mx-auto">
                <Image
                  src="/images/spire-codex/icons/star_icon.png"
                  alt="star"
                  width={24}
                  height={24}
                  className="w-full h-full drop-shadow-md"
                />
                <span className="absolute inset-0 flex items-center justify-center text-[9px] font-black text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                  {starCost}
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
      <span className="text-[9px] text-gray-300 font-normal leading-relaxed">{desc}</span>
    </span>
  );
}

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
