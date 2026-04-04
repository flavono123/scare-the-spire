"use client";

import Image from "next/image";
import Link from "next/link";
import {
  CodexPower,
  POWER_TYPE_CONFIG,
} from "@/lib/codex-types";
import { DescriptionText } from "./codex-description";

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

const STACK_TYPE_LABELS: Record<string, string> = {
  Counter: "카운터",
  Single: "단일",
  Duration: "지속",
  Intensity: "강도",
  None: "없음",
};

interface PowerDetailProps {
  power: CodexPower;
  onClose?: () => void;
}

export function PowerDetail({ power, onClose }: PowerDetailProps) {
  const typeConfig = POWER_TYPE_CONFIG[power.type];

  return (
    <div className="flex flex-col items-center gap-6 p-4 sm:p-6 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between w-full">
        <Link
          href="/codex/powers"
          className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
          onClick={(e) => {
            if (onClose) {
              e.preventDefault();
              onClose();
            }
          }}
        >
          ← 파워 도감
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

      {/* Large Power Image */}
      <div className="w-28 h-28 sm:w-36 sm:h-36 flex items-center justify-center">
        {power.imageUrl ? (
          <Image
            src={power.imageUrl}
            alt={power.name}
            width={144}
            height={144}
            className="w-full h-full object-contain drop-shadow-lg"
          />
        ) : (
          <div className="w-full h-full rounded-full bg-white/5 flex items-center justify-center text-gray-600 text-2xl">
            ?
          </div>
        )}
      </div>

      {/* Power Name */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-100">{power.name}</h1>
        <p className="text-sm text-gray-500">{power.nameEn}</p>
      </div>

      {/* Stats Row */}
      <div className="flex flex-wrap justify-center gap-2">
        <StatBadge
          label="유형"
          value={typeConfig.label}
          color={typeConfig.color}
        />
        <StatBadge
          label="중첩"
          value={STACK_TYPE_LABELS[power.stackType] ?? power.stackType}
        />
        {power.allowNegative && (
          <StatBadge label="음수" value="허용" color="#ef5350" />
        )}
      </div>

      {/* Description */}
      <div className="w-full bg-white/5 border border-white/10 rounded-lg p-4">
        <div className="text-sm text-gray-200 leading-relaxed">
          <DescriptionText description={power.description} />
        </div>
      </div>
    </div>
  );
}
