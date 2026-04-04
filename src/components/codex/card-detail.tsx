"use client";

import { useState } from "react";
import Link from "next/link";
import { CodexCard, COLOR_LABELS, CardFilterCategory, CHARACTER_COLORS } from "@/lib/codex-types";
import { CardTile } from "./card-tile";

// Card color to Korean label for display
function getColorLabel(card: CodexCard): string {
  if (card.rarity === "고대의 존재") return "고대의 존재";
  const cat = (card.color === "event" ? "event" : card.color) as CardFilterCategory;
  return COLOR_LABELS[cat] ?? card.color;
}

// Stat badge component
function StatBadge({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
      <span className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</span>
      <span className="text-sm font-bold" style={color ? { color } : undefined}>
        {value}
      </span>
    </div>
  );
}

interface CardDetailProps {
  card: CodexCard;
  onClose?: () => void;
}

export function CardDetail({ card, onClose }: CardDetailProps) {
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showBeta, setShowBeta] = useState(false);

  const costDisplay = card.isXCost ? "X" : String(card.cost);
  const charColor = CHARACTER_COLORS[card.color];

  return (
    <div className="flex flex-col items-center gap-6 p-4 sm:p-6 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between w-full">
        <Link
          href="/codex/cards"
          className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
          onClick={(e) => {
            if (onClose) {
              e.preventDefault();
              onClose();
            }
          }}
        >
          ← 카드 도서관
        </Link>
        {onClose && (
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-gray-400"
            aria-label="닫기"
          >
            ✕
          </button>
        )}
      </div>

      {/* Large Card Render */}
      <div className="w-64 sm:w-72">
        <CardTile card={card} showUpgrade={showUpgrade} showBeta={showBeta} />
      </div>

      {/* Card Name */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-100">{card.name}</h1>
        <p className="text-sm text-gray-500">{card.nameEn}</p>
      </div>

      {/* Stats Row */}
      <div className="flex flex-wrap justify-center gap-2">
        <StatBadge label="유형" value={card.type} />
        <StatBadge label="희귀도" value={card.rarity} />
        <StatBadge label="비용" value={costDisplay} />
        <StatBadge
          label="캐릭터"
          value={getColorLabel(card)}
          color={charColor}
        />
        {card.damage !== null && (
          <StatBadge label="피해" value={String(card.damage)} color="#ef5350" />
        )}
        {card.block !== null && (
          <StatBadge label="방어도" value={String(card.block)} color="#4fc3f7" />
        )}
        {card.hitCount !== null && card.hitCount > 1 && (
          <StatBadge label="타격" value={`${card.hitCount}회`} />
        )}
      </div>

      {/* Keywords */}
      {card.keywords.length > 0 && (
        <div className="flex flex-wrap justify-center gap-1.5">
          {card.keywords.map((kw) => (
            <span
              key={kw}
              className="px-2 py-0.5 text-xs rounded-full bg-yellow-500/15 text-yellow-400 border border-yellow-500/30"
            >
              {kw}
            </span>
          ))}
        </div>
      )}

      {/* Toggles */}
      {card.upgrade && (
        <div className="flex gap-3">
          <button
            onClick={() => setShowUpgrade((v) => !v)}
            className={`px-3 py-1 text-xs rounded-lg border transition-all ${
              showUpgrade
                ? "bg-green-500/20 text-green-400 border-green-500/50"
                : "bg-white/5 text-gray-400 border-white/10 hover:border-white/30"
            }`}
          >
            강화 보기
          </button>
          {card.betaImageUrl && (
            <button
              onClick={() => setShowBeta((v) => !v)}
              className={`px-3 py-1 text-xs rounded-lg border transition-all ${
                showBeta
                  ? "bg-purple-500/20 text-purple-400 border-purple-500/50"
                  : "bg-white/5 text-gray-400 border-white/10 hover:border-white/30"
              }`}
            >
              베타 아트
            </button>
          )}
        </div>
      )}
    </div>
  );
}
