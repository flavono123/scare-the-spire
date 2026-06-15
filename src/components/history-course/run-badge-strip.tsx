"use client";

import { useState } from "react";
import { HoverTip } from "@/components/codex/hover-tip";
import { RichText } from "@/components/rich-text";
import StaticImage from "@/components/ui/static-image";
import type { ServiceLocale } from "@/lib/i18n";
import {
  getRunBadgeDisplay,
  plainBadgeText,
  type RunBadgeDisplay,
} from "@/lib/run-badges";
import type { ReplayBadge } from "@/lib/sts2-run-replay";
import { cn } from "@/lib/utils";

type BadgeSize = "sm" | "md" | "lg";
type BadgeTipPlacement = "below-left" | "below-right";

const SIZE_CLASS: Record<BadgeSize, string> = {
  sm: "h-7 w-7",
  md: "h-9 w-9",
  lg: "h-11 w-11",
};

interface RunBadgeStripProps {
  badges: ReplayBadge[];
  serviceLocale: ServiceLocale;
  className?: string;
  max?: number;
  size?: BadgeSize;
  tipPlacement?: BadgeTipPlacement;
}

export function RunBadgeStrip({
  badges,
  serviceLocale,
  className,
  max,
  size = "md",
  tipPlacement = "below-left",
}: RunBadgeStripProps) {
  const displays = badges
    .map((badge) => getRunBadgeDisplay(badge, serviceLocale))
    .filter((badge): badge is RunBadgeDisplay => badge !== null);
  if (displays.length === 0) return null;

  const visible = typeof max === "number" ? displays.slice(0, max) : displays;
  const remaining = displays.length - visible.length;

  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {visible.map((badge, index) => (
        <RunBadgeIcon
          key={`${badge.id}-${badge.rarity}-${index}`}
          badge={badge}
          size={size}
          tipPlacement={tipPlacement}
        />
      ))}
      {remaining > 0 && (
        <span className="rounded-full bg-zinc-950/70 px-1.5 py-0.5 text-[10px] font-bold text-amber-100 ring-1 ring-amber-300/25">
          +{remaining}
        </span>
      )}
    </div>
  );
}

function RunBadgeIcon({
  badge,
  size,
  tipPlacement,
}: {
  badge: RunBadgeDisplay;
  size: BadgeSize;
  tipPlacement: BadgeTipPlacement;
}) {
  const description = plainBadgeText(badge.description);
  const title = description ? `${badge.title}: ${description}` : badge.title;
  const [hovered, setHovered] = useState(false);

  return (
    <span
      className={cn(
        "relative inline-block shrink-0 drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)]",
        SIZE_CLASS[size],
      )}
      role="img"
      aria-label={title}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      tabIndex={0}
    >
      <StaticImage
        src={badge.baseImageUrl}
        alt=""
        fill
        className="object-contain"
        aria-hidden
      />
      {badge.imageUrl && (
        <StaticImage
          src={badge.imageUrl}
          alt=""
          fill
          className="object-contain"
          aria-hidden
        />
      )}
      {hovered && (
        <span
          className={cn(
            "pointer-events-none absolute top-full z-50 block w-max max-w-[220px] translate-y-1.5 text-left",
            tipPlacement === "below-right" ? "right-0" : "left-0",
          )}
        >
          <HoverTip title={badge.title} style={{ maxWidth: 220 }}>
            {badge.description && (
              <RichText text={badge.description} />
            )}
          </HoverTip>
        </span>
      )}
    </span>
  );
}
