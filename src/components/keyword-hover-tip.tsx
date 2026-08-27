"use client";

import { type ReactNode, useState } from "react";
import { PortaledHoverTipLayer } from "@/components/codex/portaled-hover-tip-layer";
import { GameHoverTip } from "@/components/codex/hover-tip";
import { cn } from "@/lib/utils";

/**
 * Fallback keyword chrome when there is no Compendium entity to preview.
 * Always portals through the global hover-tip layer so overflow/z-index
 * on comments, cards, and composers cannot clip it.
 */
export function KeywordHoverTip({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <span
      className={cn("relative inline cursor-help font-semibold spire-gold", className)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      tabIndex={0}
    >
      {children}
      {hovered && description ? (
        <PortaledHoverTipLayer pin="top-left">
          <GameHoverTip title={title} style={{ minWidth: 200, maxWidth: 280 }}>
            <span className="block text-left">{description}</span>
          </GameHoverTip>
        </PortaledHoverTipLayer>
      ) : null}
    </span>
  );
}
