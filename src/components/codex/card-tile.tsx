"use client";

import { useState } from "react";
import Image from "next/image";
import { CodexCard } from "@/lib/codex-types";

// === Character color palettes (from energy icon dominant colors) ===
const CHAR_COLORS: Record<string, { primary: string; dark: string; light: string }> = {
  ironclad: { primary: "#c03030", dark: "#6b1a1a", light: "#e06040" },
  silent:   { primary: "#209060", dark: "#0a3a28", light: "#40c080" },
  defect:   { primary: "#2868a0", dark: "#102840", light: "#60a8e0" },
  necrobinder: { primary: "#c04878", dark: "#401828", light: "#f098c8" },
  regent:   { primary: "#e87020", dark: "#4a2008", light: "#f8c040" },
  colorless: { primary: "#808080", dark: "#303030", light: "#b0b0b0" },
  curse:    { primary: "#6a3060", dark: "#281028", light: "#a06090" },
  event:    { primary: "#608040", dark: "#283018", light: "#90b060" },
  status:   { primary: "#887040", dark: "#382810", light: "#c0a060" },
  token:    { primary: "#707070", dark: "#282828", light: "#a0a0a0" },
  quest:    { primary: "#6060a0", dark: "#202040", light: "#9090d0" },
};

// Rarity -> frame trim color
const RARITY_TRIM: Record<string, string> = {
  기본: "#6b6b6b",
  일반: "#8a8a8a",
  고급: "#5ab8e8",
  희귀: "#e8c840",
  "고대의 존재": "#d070f0",
  이벤트: "#70a050",
  토큰: "#8a7060",
  저주: "#a04040",
  상태이상: "#c08040",
  퀘스트: "#8080c0",
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

// Type banner SVG icons
function AttackIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M6.92 5L5 6.92l4.06 4.06L5 15.03l1.94 1.94 4.06-4.06 4.03 4.03L17 15l-4.03-4.03L17 6.94 15.06 5l-4.03 4.03L6.92 5z" />
    </svg>
  );
}

function SkillIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C9.2 2 7 4.2 7 7c0 1.8 1.1 3.4 2.6 4.2L8 22h8l-1.6-10.8C15.9 10.4 17 8.8 17 7c0-2.8-2.2-5-5-5z" />
    </svg>
  );
}

function PowerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

const TYPE_ICONS: Record<string, React.FC<{ className?: string }>> = {
  공격: AttackIcon,
  스킬: SkillIcon,
  파워: PowerIcon,
};

// Type banner colors (inner card accent)
const TYPE_INNER: Record<string, { bg: string; text: string }> = {
  공격: { bg: "#5a2020", text: "#c08060" },
  스킬: { bg: "#1a3040", text: "#6098b8" },
  파워: { bg: "#3a2a10", text: "#c0a050" },
  저주: { bg: "#301830", text: "#806080" },
  상태이상: { bg: "#302818", text: "#a08850" },
  퀘스트: { bg: "#202838", text: "#7080a0" },
};

// Keyword descriptions (hover tooltips)
const KEYWORD_DESC: Record<string, string> = {
  교활: "교활 카드는 사일런트 카드 더미에 합류합니다.",
  보존: "이 카드는 턴 종료 시 버려지지 않습니다.",
  사용불가: "이 카드는 사용할 수 없습니다.",
  선천성: "이 카드는 매 전투 시작 시 손에 들어옵니다.",
  소멸: "이 카드는 사용 후 게임에서 제거됩니다.",
  영구: "이 카드는 어떤 방법으로도 제거할 수 없습니다.",
  휘발성: "이 카드는 턴 종료 시 손에 있으면 소멸합니다.",
};

// Gold term descriptions (game mechanics hover)
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
  if (showBeta && card.betaImageUrl) {
    imageSrc = card.betaImageUrl;
  } else if (card.imageUrl) {
    imageSrc = card.imageUrl;
  } else if (card.betaImageUrl) {
    imageSrc = card.betaImageUrl;
  }

  // Cost
  let costDisplay: string;
  if (card.isXCost) costDisplay = "X";
  else if (card.cost === -1) costDisplay = "";
  else if (showUpgrade && card.upgrade?.cost !== undefined) costDisplay = String(card.upgrade.cost);
  else costDisplay = String(card.cost);

  const starCost = card.starCost !== null ? card.starCost : null;
  const energyIcon = ENERGY_ICONS[card.color] ?? ENERGY_ICONS.colorless;
  const charColor = CHAR_COLORS[card.color] ?? CHAR_COLORS.colorless;
  const typeInner = TYPE_INNER[card.type] ?? TYPE_INNER["스킬"];
  const rarityTrim = RARITY_TRIM[card.rarity] ?? "#6b6b6b";
  const TypeIcon = TYPE_ICONS[card.type];

  // Parse description
  const descParts = parseDescription(card.description);
  const upgradeInfo = showUpgrade && card.upgrade ? formatUpgrade(card) : null;

  // Keywords on first line (centered)
  const hasKeywords = card.keywords.length > 0;

  return (
    <div className="group relative transition-transform hover:scale-[1.04] hover:z-10 cursor-pointer">
      <div
        className="relative overflow-hidden rounded-lg"
        style={{
          // Fixed aspect ratio card
          height: "280px",
          background: `linear-gradient(135deg, ${charColor.dark} 0%, ${charColor.primary}40 50%, ${charColor.dark} 100%)`,
          boxShadow: `inset 0 0 0 2px ${charColor.primary}80, 0 0 0 1px ${rarityTrim}60, 0 4px 12px rgba(0,0,0,0.6)`,
        }}
      >
        {/* === Card name banner (top) === */}
        <div
          className="relative z-10 text-center py-1 px-3"
          style={{
            background: `linear-gradient(180deg, ${charColor.primary}c0, ${charColor.dark}e0)`,
            borderBottom: `1px solid ${charColor.light}40`,
          }}
        >
          <span className="text-[11px] font-bold text-gray-100 drop-shadow-sm block truncate leading-tight font-[var(--font-cinzel)]">
            {card.name}
          </span>
        </div>

        {/* === Card art area === */}
        <div
          className="relative mx-2 mt-1 overflow-hidden rounded-sm"
          style={{
            height: "100px",
            border: `1px solid ${charColor.primary}60`,
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
            <div className="flex items-center justify-center h-full bg-black/40 text-gray-600 text-xs">
              No Image
            </div>
          )}
        </div>

        {/* === Cost orb (top-left, protruding) === */}
        {costDisplay && (
          <div className="absolute -top-0.5 -left-0.5 z-20">
            <div className="relative w-8 h-8 drop-shadow-lg">
              <Image src={energyIcon} alt="cost" width={32} height={32} className="w-full h-full" />
              <span className="absolute inset-0 flex items-center justify-center text-sm font-black text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                {costDisplay}
              </span>
            </div>
            {starCost !== null && (
              <div className="absolute top-0 left-8 w-5 h-5">
                <Image src="/images/spire-codex/icons/star_icon.png" alt="star" width={20} height={20} className="w-full h-full" />
                <span className="absolute inset-0 flex items-center justify-center text-[8px] font-black text-white">{starCost}</span>
              </div>
            )}
          </div>
        )}

        {/* === Description area === */}
        <div
          className="mx-2 mt-1 px-2 py-1 overflow-hidden"
          style={{
            height: "90px",
            background: `${typeInner.bg}80`,
            borderRadius: "3px",
            border: `1px solid ${charColor.primary}30`,
          }}
        >
          {/* Keywords (centered, first line) */}
          {hasKeywords && (
            <div className="text-center mb-0.5">
              {card.keywords.map((kw, i) => (
                <span key={i}>
                  {i > 0 && <span className="text-gray-600 text-[9px]"> · </span>}
                  <span
                    className="relative text-[10px] font-bold text-yellow-400 cursor-help"
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

          {/* Description text (centered) */}
          <div className="text-center text-[9px] leading-[1.35] text-gray-300 overflow-hidden" style={{ maxHeight: hasKeywords ? "65px" : "78px" }}>
            {descParts.map((part, i) =>
              part.type === "gold" ? (
                <span
                  key={i}
                  className="relative text-yellow-400 font-medium cursor-help"
                  onMouseEnter={() => setHoveredTerm(part.text)}
                  onMouseLeave={() => setHoveredTerm(null)}
                >
                  {part.text}
                  {hoveredTerm === part.text && GOLD_TERM_DESC[part.text] && (
                    <TermTooltip name={part.text} desc={GOLD_TERM_DESC[part.text]} />
                  )}
                </span>
              ) : part.type === "newline" ? (
                <br key={i} />
              ) : (
                <span key={i}>{part.text}</span>
              )
            )}
          </div>

          {upgradeInfo && (
            <p className="text-center text-[8px] text-green-400 mt-0.5">▲ {upgradeInfo}</p>
          )}
        </div>

        {/* === Type banner (bottom) === */}
        <div
          className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-1 py-1"
          style={{
            background: `linear-gradient(0deg, ${charColor.dark}f0, ${charColor.primary}60)`,
            borderTop: `1px solid ${charColor.light}30`,
          }}
        >
          {TypeIcon && (
            <span style={{ color: typeInner.text }}>
              <TypeIcon className="w-3 h-3" />
            </span>
          )}
          <span className="text-[9px] font-bold" style={{ color: typeInner.text }}>
            {card.type}
          </span>
        </div>
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
  type: "text" | "gold" | "newline";
  text: string;
}

function parseDescription(desc: string): DescPart[] {
  const parts: DescPart[] = [];
  const regex = /\[gold\](.*?)\[\/gold\]|\[energy:\d+\]|\[\/?\w+(?::?\w*)*\]|\n/g;
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
    }
    // Skip other BBCode tags
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
