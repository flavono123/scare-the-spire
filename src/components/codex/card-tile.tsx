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

// Rarity -> border color
const RARITY_BORDER: Record<string, string> = {
  기본: "border-gray-600",
  일반: "border-gray-500",
  고급: "border-sky-400",
  희귀: "border-yellow-500",
  "고대의 존재": "border-purple-400",
  이벤트: "border-green-400",
  토큰: "border-amber-700",
  저주: "border-red-500",
  상태이상: "border-orange-400",
  퀘스트: "border-violet-400",
};

// Card type -> background accent
const TYPE_BG: Record<string, string> = {
  공격: "bg-red-900/30",
  스킬: "bg-blue-900/30",
  파워: "bg-amber-900/30",
  저주: "bg-red-950/40",
  상태이상: "bg-orange-950/40",
  퀘스트: "bg-violet-900/30",
};

interface CardTileProps {
  card: CodexCard;
  showUpgrade: boolean;
  showBeta: boolean;
}

export function CardTile({ card, showUpgrade, showBeta }: CardTileProps) {
  const [imgError, setImgError] = useState(false);

  // Determine which image to show
  let imageSrc: string | null = null;
  if (showBeta && card.betaImageUrl) {
    imageSrc = card.betaImageUrl;
  } else if (card.imageUrl) {
    imageSrc = card.imageUrl;
  } else if (card.betaImageUrl) {
    // No official art, fall back to beta
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

  // Star cost for Regent
  const starCostDisplay = card.starCost !== null ? card.starCost : null;

  // Energy icon
  const energyIcon = ENERGY_ICONS[card.color] ?? ENERGY_ICONS.colorless;

  const borderClass = RARITY_BORDER[card.rarity] ?? "border-gray-600";
  const typeBg = TYPE_BG[card.type] ?? "bg-gray-900/30";

  // Description: strip BBCode tags for display
  const cleanDesc = card.description
    .replace(/\[\/?\w+(?::?\w*)*\]/g, "")
    .replace(/\n/g, " ");

  // Upgrade indicator
  const upgradeInfo = showUpgrade && card.upgrade ? formatUpgrade(card) : null;

  return (
    <div
      className={`group relative flex flex-col rounded-xl border-2 ${borderClass} ${typeBg} overflow-hidden transition-all hover:scale-[1.03] hover:shadow-lg hover:shadow-black/40 cursor-pointer`}
    >
      {/* Card Image */}
      <div className="relative aspect-square bg-black/40 overflow-hidden">
        {imageSrc && !imgError ? (
          <Image
            src={imageSrc}
            alt={card.name}
            fill
            className="object-contain p-1"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 16vw"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-600 text-xs">
            No Image
          </div>
        )}

        {/* Cost Orb */}
        {costDisplay && (
          <div className="absolute top-1 left-1 flex items-center gap-0.5">
            <div className="relative w-7 h-7">
              <Image
                src={energyIcon}
                alt="cost"
                width={28}
                height={28}
                className="w-full h-full"
              />
              <span className="absolute inset-0 flex items-center justify-center text-xs font-black text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                {costDisplay}
              </span>
            </div>
            {starCostDisplay !== null && (
              <div className="relative w-6 h-6">
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

        {/* Beta badge */}
        {showBeta && card.betaImageUrl && (
          <span className="absolute top-1 right-1 bg-purple-600/80 text-[10px] px-1.5 py-0.5 rounded font-bold">
            BETA
          </span>
        )}
        {!showBeta && !card.imageUrl && card.betaImageUrl && (
          <span className="absolute top-1 right-1 bg-orange-600/80 text-[10px] px-1.5 py-0.5 rounded font-bold">
            BETA
          </span>
        )}
      </div>

      {/* Card Info */}
      <div className="flex flex-col gap-0.5 p-2 min-h-[4rem]">
        <div className="flex items-center justify-between gap-1">
          <span className="text-sm font-bold truncate leading-tight">
            {card.name}
          </span>
        </div>
        <span className="text-[10px] text-gray-500 uppercase">
          {card.type} · {card.rarity}
        </span>
        {upgradeInfo && (
          <span className="text-[10px] text-green-400 mt-0.5">
            ▲ {upgradeInfo}
          </span>
        )}
      </div>

      {/* Hover tooltip with full description */}
      <div className="pointer-events-none absolute inset-0 flex items-end opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <div className="w-full bg-gradient-to-t from-black via-black/95 to-transparent p-3 pt-8">
          <p className="text-xs text-gray-300 leading-relaxed line-clamp-4">
            {cleanDesc}
          </p>
          {card.keywords.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {card.keywords.map((kw) => (
                <span
                  key={kw}
                  className="bg-white/10 text-[10px] px-1.5 py-0.5 rounded"
                >
                  {kw}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatUpgrade(card: CodexCard): string | null {
  if (!card.upgrade) return null;
  const parts: string[] = [];

  for (const [key, val] of Object.entries(card.upgrade)) {
    if (key === "cost") {
      parts.push(`비용 → ${val}`);
    } else if (key === "add_retain") {
      parts.push("유지 추가");
    } else if (key === "add_innate") {
      parts.push("고유 추가");
    } else if (key === "remove_ethereal") {
      parts.push("유령 제거");
    } else if (key === "remove_exhaust") {
      parts.push("소멸 제거");
    } else if (typeof val === "string" && val.startsWith("+")) {
      parts.push(`${key} ${val}`);
    }
  }

  return parts.length > 0 ? parts.join(", ") : null;
}
