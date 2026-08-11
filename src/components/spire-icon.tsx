"use client";

import Image from "@/components/ui/static-image";
import { useEffect, type CSSProperties } from "react";
import { cn } from "@/lib/utils";

export const SPIRE_ICON_COLORS = {
  gold: "#d4a843",
  blue: "#60a5fa",
  red: "#f87171",
  green: "#34d399",
  purple: "#c084fc",
  orange: "#fb923c",
  pink: "#f472b6",
  aqua: "#22d3ee",
} as const;

export type SpireIconColor = keyof typeof SPIRE_ICON_COLORS;
export type SpireIconVariant = "ghost" | SpireIconColor;

/** Game-token actions. Comment / edit / delete use Lucide instead. */
export const SPIRE_ACTION_TOKENS = {
  like: {
    label: "강령의 극의",
    src: "/images/sts2/powers/necro_mastery_power.webp",
  },
} as const;

const WAX_FILTER_ID = "spire-icon-wax-filter";

function ensureWaxFilter() {
  if (typeof document === "undefined") return;
  if (document.getElementById(WAX_FILTER_ID)) return;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
  svg.innerHTML = `
    <filter color-interpolation-filters="linearRGB" id="${WAX_FILTER_ID}">
      <feColorMatrix
        type="matrix"
        values="
          0.333333 0.333333 0.333333 0 0
          0.266667 0.266667 0.266667 0 0
          0.266667 0.266667 0.266667 0 0
          0        0        0        1 0
        "
      />
    </filter>
  `;
  document.body.prepend(svg);
}

export function SpireIcon({
  src,
  label,
  size = 16,
  variant = "ghost",
  className,
}: {
  src: string;
  label?: string;
  size?: number;
  variant?: SpireIconVariant;
  className?: string;
}) {
  useEffect(() => {
    ensureWaxFilter();
  }, []);

  const dimensions = { width: size, height: size };

  if (variant === "ghost") {
    return (
      <span
        className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
        style={dimensions}
        title={label}
      >
        <Image
          alt=""
          aria-hidden
          className="h-full w-full object-contain"
          height={size}
          src={src}
          style={{ filter: `url("#${WAX_FILTER_ID}")` }}
          unoptimized
          width={size}
        />
      </span>
    );
  }

  const color = SPIRE_ICON_COLORS[variant];
  const maskStyle: CSSProperties = {
    backgroundColor: color,
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
      aria-label={label}
      className={cn("relative inline-flex shrink-0 isolate", className)}
      role={label ? "img" : undefined}
      style={dimensions}
      title={label}
    >
      <Image
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full object-contain"
        height={size}
        src={src}
        style={{
          filter: "grayscale(1) contrast(1.12) brightness(0.72)",
          opacity: 0.8,
        }}
        unoptimized
        width={size}
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

/**
 * Like token (강령의 극의) only.
 * Idle = ghost wax. Hover/active = spire-gold.
 * `lift` enables toast-up; use only on index engagement controls.
 */
export function SpireLikeIcon({
  size = 14,
  active = false,
  lift = false,
  className,
}: {
  size?: number;
  active?: boolean;
  lift?: boolean;
  className?: string;
}) {
  const token = SPIRE_ACTION_TOKENS.like;

  return (
    <span
      className={cn(
        "relative inline-flex",
        lift && [
          "transition-transform duration-200 ease-out will-change-transform",
          "motion-reduce:transition-none motion-reduce:transform-none",
          "group-hover/spire:-translate-y-0.5 group-focus-visible/spire:-translate-y-0.5",
        ],
        className,
      )}
      style={{ width: size, height: size }}
    >
      <SpireIcon
        src={token.src}
        label={token.label}
        size={size}
        variant="ghost"
        className={cn(
          "absolute inset-0 transition-opacity duration-200 ease-out motion-reduce:transition-none",
          active
            ? "opacity-0"
            : "opacity-100 group-hover/spire:opacity-0 group-focus-visible/spire:opacity-0",
        )}
      />
      <SpireIcon
        src={token.src}
        label={token.label}
        size={size}
        variant="gold"
        className={cn(
          "absolute inset-0 transition-opacity duration-200 ease-out motion-reduce:transition-none",
          active
            ? "opacity-100"
            : "opacity-0 group-hover/spire:opacity-100 group-focus-visible/spire:opacity-100",
        )}
      />
    </span>
  );
}

/** Put on the clickable control wrapping SpireLikeIcon / index Lucide icons. */
export const SPIRE_ACTION_CONTROL_CLASS =
  "group/spire inline-flex items-center transition-colors";

/** Index-only Lucide toast-up + spire-gold hover. */
export const INDEX_LUCIDE_ICON_CLASS =
  "transition-[transform,color] duration-200 ease-out motion-reduce:transition-none motion-reduce:transform-none group-hover/spire:-translate-y-0.5 group-focus-visible/spire:-translate-y-0.5 group-hover/spire:text-[#d4a843] group-focus-visible/spire:text-[#d4a843]";
