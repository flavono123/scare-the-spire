"use client";

import { useState } from "react";
import Image from "next/image";
import { CodexCard } from "@/lib/codex-types";

// Character color -> energy icon path
const ENERGY_ICONS: Record<string, string> = {
  ironclad: "/images/spire-codex/icons/ironclad_energy_icon.png",
  silent: "/images/spire-codex/icons/silent_energy_icon.png",
  defect: "/images/spire-codex/icons/defect_energy_icon.png",
  necrobinder: "/images/spire-codex/icons/necrobinder_energy_icon.png",
  regent: "/images/spire-codex/icons/regent_energy_icon.png",
  colorless: "/images/spire-codex/icons/colorless_energy_icon.png",
};

// Card type -> frame color scheme
const TYPE_FRAME: Record<string, { bg: string; border: string; banner: string; bannerText: string }> = {
  공격: { bg: "#4a1a1a", border: "#8b3a3a", banner: "#6b2a2a", bannerText: "#e8c8a0" },
  스킬: { bg: "#1a2a3a", border: "#3a5a7b", banner: "#2a4a6b", bannerText: "#a0c8e8" },
  파워: { bg: "#3a2a1a", border: "#7b6a3a", banner: "#6b5a2a", bannerText: "#e8d8a0" },
  저주: { bg: "#2a1a2a", border: "#5a3a5a", banner: "#4a2a4a", bannerText: "#d0a0d0" },
  상태이상: { bg: "#2a2a1a", border: "#5a5a3a", banner: "#4a4a2a", bannerText: "#d0d0a0" },
  퀘스트: { bg: "#1a2a2a", border: "#3a5a5a", banner: "#2a4a4a", bannerText: "#a0d0d0" },
};

// Rarity -> frame accent (outer glow / trim color)
const RARITY_ACCENT: Record<string, string> = {
  기본: "#6b6b6b",
  일반: "#8b8b8b",
  고급: "#4fc3f7",
  희귀: "#ffd740",
  "고대의 존재": "#ce93d8",
  이벤트: "#81c784",
  토큰: "#a1887f",
  저주: "#e57373",
  상태이상: "#ff8a65",
  퀘스트: "#b39ddb",
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

interface CardTileProps {
  card: CodexCard;
  showUpgrade: boolean;
  showBeta: boolean;
}

export function CardTile({ card, showUpgrade, showBeta }: CardTileProps) {
  const [imgError, setImgError] = useState(false);
  const [hoveredKeyword, setHoveredKeyword] = useState<string | null>(null);

  // Image selection
  let imageSrc: string | null = null;
  if (showBeta && card.betaImageUrl) {
    imageSrc = card.betaImageUrl;
  } else if (card.imageUrl) {
    imageSrc = card.imageUrl;
  } else if (card.betaImageUrl) {
    imageSrc = card.betaImageUrl;
  }

  // Cost display
  let costDisplay: string;
  if (card.isXCost) {
    costDisplay = "X";
  } else if (card.cost === -1) {
    costDisplay = "";
  } else if (showUpgrade && card.upgrade?.cost !== undefined) {
    costDisplay = String(card.upgrade.cost);
  } else {
    costDisplay = String(card.cost);
  }

  const starCostDisplay = card.starCost !== null ? card.starCost : null;
  const energyIcon = ENERGY_ICONS[card.color] ?? ENERGY_ICONS.colorless;
  const frame = TYPE_FRAME[card.type] ?? TYPE_FRAME["스킬"];
  const rarityAccent = RARITY_ACCENT[card.rarity] ?? "#6b6b6b";

  // Upgrade info
  const upgradeInfo = showUpgrade && card.upgrade ? formatUpgrade(card) : null;

  // Parse description with keyword highlighting
  const descParts = parseDescription(card.description);

  // Is beta badge needed?
  const showBetaBadge = (showBeta && card.betaImageUrl) || (!showBeta && !card.imageUrl && card.betaImageUrl);

  return (
    <div
      className="group relative flex flex-col cursor-pointer transition-transform hover:scale-[1.04] hover:z-10"
      style={{ perspective: "600px" }}
    >
      {/* Card frame */}
      <div
        className="relative rounded-lg overflow-hidden"
        style={{
          background: `linear-gradient(180deg, ${frame.border} 0%, ${frame.bg} 40%, ${frame.bg} 100%)`,
          boxShadow: `0 0 0 1.5px ${rarityAccent}40, 0 2px 8px rgba(0,0,0,0.5)`,
        }}
      >
        {/* Card name banner */}
        <div
          className="relative z-10 text-center py-1 px-2"
          style={{
            background: `linear-gradient(180deg, ${frame.border}dd, ${frame.banner}cc)`,
            borderBottom: `1px solid ${rarityAccent}40`,
          }}
        >
          <span
            className="text-[11px] font-bold leading-tight block truncate"
            style={{ color: frame.bannerText }}
          >
            {card.name}
          </span>
        </div>

        {/* Card art area */}
        <div className="relative mx-1.5 mt-0.5 aspect-[4/3] bg-black/60 rounded-sm overflow-hidden">
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
            <div className="flex items-center justify-center h-full text-gray-600 text-xs">
              No Image
            </div>
          )}

          {/* Beta badge */}
          {showBetaBadge && (
            <span className="absolute top-0.5 right-0.5 bg-purple-600/90 text-[8px] px-1 py-0.5 rounded font-bold text-white">
              BETA
            </span>
          )}
        </div>

        {/* Cost orb - protruding from top-left */}
        {costDisplay && (
          <div className="absolute -top-1 -left-1 z-20 flex items-center gap-0.5">
            <div className="relative w-8 h-8 drop-shadow-lg">
              <Image
                src={energyIcon}
                alt="cost"
                width={32}
                height={32}
                className="w-full h-full"
              />
              <span className="absolute inset-0 flex items-center justify-center text-sm font-black text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                {costDisplay}
              </span>
            </div>
            {starCostDisplay !== null && (
              <div className="relative w-6 h-6 drop-shadow-lg">
                <Image
                  src="/images/spire-codex/icons/star_icon.png"
                  alt="star cost"
                  width={24}
                  height={24}
                  className="w-full h-full"
                />
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                  {starCostDisplay}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Description area */}
        <div className="px-2 py-1.5 min-h-[3rem]">
          <p className="text-[10px] leading-[1.4] text-gray-300">
            {descParts.map((part, i) =>
              part.type === "keyword" ? (
                <span
                  key={i}
                  className="relative text-yellow-400 font-semibold cursor-help"
                  onMouseEnter={() => setHoveredKeyword(part.text)}
                  onMouseLeave={() => setHoveredKeyword(null)}
                >
                  {part.text}
                  {hoveredKeyword === part.text && KEYWORD_DESC[part.text] && (
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-40 bg-black/95 border border-yellow-500/30 rounded-md px-2 py-1.5 text-[10px] text-gray-200 font-normal leading-relaxed z-50 pointer-events-none shadow-lg">
                      <span className="font-bold text-yellow-400 block mb-0.5">{part.text}</span>
                      {KEYWORD_DESC[part.text]}
                    </span>
                  )}
                </span>
              ) : part.type === "gold" ? (
                <span key={i} className="text-yellow-400 font-medium">
                  {part.text}
                </span>
              ) : (
                <span key={i}>{part.text}</span>
              )
            )}
          </p>
          {upgradeInfo && (
            <p className="text-[9px] text-green-400 mt-0.5">▲ {upgradeInfo}</p>
          )}
        </div>

        {/* Type banner at bottom */}
        <div
          className="flex items-center justify-center py-0.5"
          style={{
            background: `linear-gradient(180deg, ${frame.banner}cc, ${frame.border}dd)`,
            borderTop: `1px solid ${rarityAccent}30`,
          }}
        >
          <span
            className="text-[9px] font-bold uppercase tracking-wider"
            style={{ color: `${rarityAccent}cc` }}
          >
            {card.type}
          </span>
        </div>
      </div>
    </div>
  );
}

interface DescPart {
  type: "text" | "keyword" | "gold";
  text: string;
}

function parseDescription(desc: string): DescPart[] {
  const parts: DescPart[] = [];
  // Replace newlines with spaces
  let text = desc.replace(/\n/g, " ");

  // Parse [gold]...[/gold] and keyword references
  const regex = /\[gold\](.*?)\[\/gold\]|\[energy:\d+\]|\[\/?\w+(?::?\w*)*\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    // Text before this match
    if (match.index > lastIndex) {
      parts.push({ type: "text", text: text.slice(lastIndex, match.index) });
    }

    if (match[1] !== undefined) {
      // [gold]...[/gold] - check if it's a keyword
      const goldText = match[1];
      if (KEYWORD_DESC[goldText]) {
        parts.push({ type: "keyword", text: goldText });
      } else {
        parts.push({ type: "gold", text: goldText });
      }
    }
    // else: skip other BBCode tags

    lastIndex = match.index + match[0].length;
  }

  // Remaining text
  if (lastIndex < text.length) {
    parts.push({ type: "text", text: text.slice(lastIndex) });
  }

  // Also check for standalone keywords not in [gold] tags
  return parts.flatMap((part) => {
    if (part.type !== "text") return [part];
    const kwPattern = new RegExp(
      `(${Object.keys(KEYWORD_DESC).join("|")})`,
      "g"
    );
    const subparts: DescPart[] = [];
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = kwPattern.exec(part.text)) !== null) {
      if (m.index > last) {
        subparts.push({ type: "text", text: part.text.slice(last, m.index) });
      }
      subparts.push({ type: "keyword", text: m[1] });
      last = m.index + m[0].length;
    }
    if (last < part.text.length) {
      subparts.push({ type: "text", text: part.text.slice(last) });
    }
    return subparts.length > 0 ? subparts : [part];
  });
}

function formatUpgrade(card: CodexCard): string | null {
  if (!card.upgrade) return null;
  const parts: string[] = [];

  for (const [key, val] of Object.entries(card.upgrade)) {
    if (key === "cost") {
      parts.push(`비용 → ${val}`);
    } else if (key === "add_retain") {
      parts.push("보존 추가");
    } else if (key === "add_innate") {
      parts.push("선천성 추가");
    } else if (key === "remove_ethereal") {
      parts.push("휘발성 제거");
    } else if (key === "remove_exhaust") {
      parts.push("소멸 제거");
    } else if (typeof val === "string" && val.startsWith("+")) {
      parts.push(`${key} ${val}`);
    }
  }

  return parts.length > 0 ? parts.join(", ") : null;
}
