"use client";

import Image from "@/components/ui/static-image";
import Link from "next/link";
import { CommentSection } from "@/components/comment-section";
import { buildCodexCommentThreadKey } from "@/lib/comment-threads";
import {
  CodexPotion,
  POTION_RARITY_CONFIG,
  characterOutlineFilter,
  getCharacterColor,
  type PotionPool,
} from "@/lib/codex-types";
import { DescriptionText } from "./codex-description";

const POTION_POOL_LABELS: Record<PotionPool, string> = {
  shared: "공용",
  ironclad: "아이언클래드",
  silent: "사일런트",
  defect: "디펙트",
  necrobinder: "네크로바인더",
  regent: "리젠트",
  event: "이벤트",
};

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

interface PotionDetailProps {
  potion: CodexPotion;
  onClose?: () => void;
}

export function PotionDetail({ potion, onClose }: PotionDetailProps) {
  const rarityConfig = POTION_RARITY_CONFIG[potion.rarity];
  const poolColor = potion.pool !== "shared" && potion.pool !== "event"
    ? getCharacterColor(potion.pool)
    : undefined;

  return (
    <div className="flex flex-col items-center gap-6 p-4 sm:p-6 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between w-full">
        <Link
          href="/codex/potions"
          className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
          onClick={(e) => {
            if (onClose) {
              e.preventDefault();
              onClose();
            }
          }}
        >
          ← 포션 도감
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

      {/* Large Potion Image */}
      <div className="w-32 h-32 sm:w-40 sm:h-40 flex items-center justify-center">
        <Image
          src={potion.imageUrl}
          alt={potion.name}
          width={160}
          height={160}
          className="w-full h-full object-contain"
          style={{
            filter: characterOutlineFilter(potion.pool) ?? "drop-shadow(0 4px 8px rgba(0,0,0,0.5))",
          }}
        />
      </div>

      {/* Potion Name */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-100">{potion.name}</h1>
        <p className="text-sm text-gray-500">{potion.nameEn}</p>
      </div>

      {/* Stats Row */}
      <div className="flex flex-wrap justify-center gap-2">
        <StatBadge
          label="희귀도"
          value={rarityConfig.label}
          color={rarityConfig.color}
        />
        <StatBadge
          label="출처"
          value={POTION_POOL_LABELS[potion.pool]}
          color={poolColor}
        />
      </div>

      {/* Description */}
      <div className="w-full bg-white/5 border border-white/10 rounded-lg p-4">
        <div className="text-sm text-gray-200 leading-relaxed">
          <DescriptionText description={potion.description} />
        </div>
      </div>

      <div className="w-full bg-white/5 border border-white/10 rounded-lg p-4">
        <h2 className="text-sm font-bold text-gray-300 mb-3">댓글</h2>
        <CommentSection threadKey={buildCodexCommentThreadKey("potion", potion.id)} />
      </div>
    </div>
  );
}
