"use client";

import type { ServiceLocale } from "@/lib/i18n";
import { EngagementSpinner } from "@/components/engagement-spinner";

const GOLD = "#d6b25e";
const TEXT = "#f5f0df";
const MUTED = "#95856b";
const SHADOW = "0 1px 0 #000, 0 0 3px #000, 0 0 6px rgba(0,0,0,0.85)";

interface EngagementStatsTextProps {
  commentCount: number;
  likeCount: number;
  loading?: boolean;
  unavailable?: boolean;
  serviceLocale?: ServiceLocale;
  className?: string;
}

export function EngagementStatsText({
  commentCount,
  likeCount,
  loading = false,
  unavailable = false,
  serviceLocale = "ko",
  className = "",
}: EngagementStatsTextProps) {
  const commentsLabel = serviceLocale === "ko" ? "댓글:" : "Comments:";
  const likesLabel = serviceLocale === "ko" ? "좋아요:" : "Likes:";
  const value = unavailable ? "-" : null;

  if (loading) {
    return (
      <span className={`inline-flex items-center justify-center ${className}`}>
        <EngagementSpinner size={14} />
      </span>
    );
  }

  return (
    <span
      className={`font-service whitespace-nowrap font-bold leading-none ${className}`}
      style={{ textShadow: SHADOW }}
    >
      <span style={{ color: GOLD }}>{commentsLabel}</span>{" "}
      <span className="tabular-nums" style={{ color: TEXT }}>{value ?? commentCount}</span>
      <span className="px-1" style={{ color: MUTED }}>·</span>
      <span style={{ color: GOLD }}>{likesLabel}</span>{" "}
      <span className="tabular-nums" style={{ color: TEXT }}>{value ?? likeCount}</span>
    </span>
  );
}

export function CardEngagementStatsOverlay(props: EngagementStatsTextProps) {
  return (
    <div className="pointer-events-none absolute inset-x-[5%] bottom-[3%] z-20 flex justify-center text-[11px]">
      <EngagementStatsText {...props} />
    </div>
  );
}
