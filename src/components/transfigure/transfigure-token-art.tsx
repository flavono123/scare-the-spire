"use client";

import type { CSSProperties } from "react";
import { SPIRE_ICON_COLORS } from "@/components/spire-icon";
import Image from "@/components/ui/static-image";
import { characterOutlineFilter } from "@/lib/codex-types";
import { relicArtFilterCss } from "@/lib/relic-art-filters";
import type {
  TransfigureTokenColor,
  TransfigureTokenWax,
} from "@/lib/transfigure-types";
import { cn } from "@/lib/utils";

export function TransfigureTokenArt({
  src,
  label,
  size,
  color,
  wax,
  outlinePool,
  className,
}: {
  src: string;
  label: string;
  size: number;
  color?: TransfigureTokenColor | null;
  wax?: TransfigureTokenWax;
  outlinePool?: string;
  className?: string;
}) {
  const waxFilter = relicArtFilterCss(wax && wax !== "off" ? wax : "none");
  const outline = !color && (!wax || wax === "off") && outlinePool
    ? characterOutlineFilter(outlinePool)
    : undefined;
  const filter = [waxFilter, outline].filter(Boolean).join(" ") || undefined;
  const sized = !className;
  const dimensions: CSSProperties | undefined = sized
    ? { width: size, height: size }
    : undefined;

  if (!color) {
    return (
      <span
        className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
        style={dimensions}
        data-transfigure-token-art="original"
        data-transfigure-token-wax={wax && wax !== "off" ? wax : "off"}
      >
        <Image
          src={src}
          alt={label}
          width={size}
          height={size}
          className="h-full w-full object-contain"
          style={filter ? { filter } : undefined}
        />
      </span>
    );
  }

  const tint = SPIRE_ICON_COLORS[color];
  const maskStyle: CSSProperties = {
    backgroundColor: tint,
    maskImage: `url("${src}")`,
    maskPosition: "center",
    maskRepeat: "no-repeat",
    maskSize: "contain",
    WebkitMaskImage: `url("${src}")`,
    WebkitMaskPosition: "center",
    WebkitMaskRepeat: "no-repeat",
    WebkitMaskSize: "contain",
  };

  return (
    <span
      className={cn("relative inline-flex shrink-0 isolate items-center justify-center", className)}
      style={{ ...dimensions, filter: waxFilter }}
      role="img"
      aria-label={label}
      data-transfigure-token-art={color}
      data-transfigure-token-wax={wax && wax !== "off" ? wax : "off"}
    >
      <Image
        src={src}
        alt=""
        aria-hidden
        width={size}
        height={size}
        className="absolute inset-0 h-full w-full object-contain"
        style={{
          filter: "grayscale(1) contrast(1.12) brightness(0.72)",
          opacity: 0.8,
        }}
      />
      <span
        aria-hidden
        className="absolute inset-0"
        style={{ ...maskStyle, mixBlendMode: "color", opacity: 0.96 }}
      />
      <span
        aria-hidden
        className="absolute inset-0"
        style={{ ...maskStyle, mixBlendMode: "screen", opacity: 0.18 }}
      />
    </span>
  );
}
