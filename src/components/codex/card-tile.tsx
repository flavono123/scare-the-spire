"use client";

import { useState } from "react";
import Image from "next/image";
import { CodexCard } from "@/lib/codex-types";

// === Character frame colors (outer border + bevel) ===
const CHAR_FRAME: Record<string, { base: string; light: string; dark: string; inner: string }> = {
  ironclad:    { base: "#8b4533", light: "#b86b55", dark: "#5a2a1a", inner: "#6b3525" },
  silent:      { base: "#3a6b45", light: "#5a9b65", dark: "#1a3a20", inner: "#2a5535" },
  defect:      { base: "#3a5580", light: "#5a80b0", dark: "#1a2a45", inner: "#2a4565" },
  necrobinder: { base: "#6b3a6b", light: "#9b5a9b", dark: "#3a1a3a", inner: "#552a55" },
  regent:      { base: "#8b6030", light: "#b88850", dark: "#5a3a10", inner: "#6b4a20" },
  colorless:   { base: "#5a5a5a", light: "#808080", dark: "#303030", inner: "#454545" },
  curse:       { base: "#4a2040", light: "#6a3860", dark: "#2a1020", inner: "#3a1830" },
  event:       { base: "#4a5a30", light: "#6a8050", dark: "#2a3518", inner: "#3a4a25" },
  status:      { base: "#5a4a30", light: "#807050", dark: "#352a18", inner: "#4a3a25" },
  token:       { base: "#505050", light: "#707070", dark: "#2a2a2a", inner: "#404040" },
  quest:       { base: "#3a4060", light: "#5a6890", dark: "#1a2035", inner: "#2a3050" },
};

// === Rarity inner frame colors ===
const RARITY_FRAME: Record<string, { border: string; glow: string }> = {
  기본:        { border: "#6a6a6a", glow: "transparent" },
  일반:        { border: "#8a8a8a", glow: "rgba(180,180,180,0.1)" },
  고급:        { border: "#4a90d0", glow: "rgba(74,144,208,0.2)" },
  희귀:        { border: "#d4a843", glow: "rgba(212,168,67,0.25)" },
  "고대의 존재": { border: "#b060e0", glow: "rgba(176,96,224,0.2)" },
  이벤트:      { border: "#60a050", glow: "rgba(96,160,80,0.15)" },
  토큰:        { border: "#706050", glow: "transparent" },
  저주:        { border: "#8a3030", glow: "rgba(138,48,48,0.15)" },
  상태이상:     { border: "#8a6a30", glow: "rgba(138,106,48,0.15)" },
  퀘스트:      { border: "#6060a0", glow: "rgba(96,96,160,0.15)" },
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
            background: `linear-gradient(180deg, ${frame.inner} 0%, #252025 35%, #1e1a1e 100%)`,
            boxShadow: `inset 0 0 0 1.5px ${rarity.border}90, 0 0 6px ${rarity.glow}`,
          }}
        >
          {/* --- Name ribbon (silver scroll shape) --- */}
          <div className="relative z-10 flex-shrink-0">
            {/* Ribbon SVG background */}
            <div className="relative mx-1 mt-1">
              <svg viewBox="0 0 200 32" className="w-full h-auto" preserveAspectRatio="none">
                <defs>
                  <linearGradient id={`ribbon-${card.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={rarity.border} stopOpacity="0.9" />
                    <stop offset="50%" stopColor={rarity.border} stopOpacity="0.6" />
                    <stop offset="100%" stopColor={rarity.border} stopOpacity="0.4" />
                  </linearGradient>
                </defs>
                {/* Ribbon shape: curving down at edges */}
                <path
                  d="M8,6 Q0,6 2,16 L6,28 Q8,32 16,30 L184,30 Q192,32 194,28 L198,16 Q200,6 192,6 Z"
                  fill={`url(#ribbon-${card.id})`}
                  stroke={rarity.border}
                  strokeWidth="0.5"
                  strokeOpacity="0.5"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-gray-900 drop-shadow-[0_1px_0_rgba(255,255,255,0.3)] truncate px-4 font-[var(--font-cinzel)]">
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
                border: `2px solid ${rarity.border}50`,
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
                  background: `linear-gradient(180deg, ${rarity.border}cc, ${rarity.border}88)`,
                  boxShadow: `0 1px 3px rgba(0,0,0,0.4)`,
                }}
              >
                {card.type}
              </div>
            </div>
          </div>

          {/* --- Description area --- */}
          <div
            className="flex-1 flex flex-col justify-center px-2.5 py-1.5 min-h-0 overflow-hidden"
            style={{ background: "#1e1a1e" }}
          >
            {/* Keywords (centered, gold, own line) */}
            {hasKeywords && (
              <div className="text-center mb-1 flex-shrink-0">
                {card.keywords.map((kw, i) => (
                  <span key={i}>
                    {i > 0 && <span className="text-gray-600 text-[9px]"> · </span>}
                    <span
                      className="relative text-[10px] font-bold text-yellow-500 cursor-help"
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
            <div className="text-center text-[9px] leading-[1.4] text-gray-200 overflow-hidden flex-1">
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
