"use client";

import { ReactNode } from "react";

// =============================================================================
// 게임 hover_tip 9-slice (scenes/ui/hover_tip.tscn)
// 원본: 339×107 / patch margin (l,t,r,b) = (55, 43, 91, 32)
// =============================================================================

const SLICE = { top: 43, right: 91, bottom: 32, left: 55 };
const SCALE = 0.55; // 코덱스 페이지에 맞게 축소

const SRC: Record<HoverTipVariant, string> = {
  default: "/images/sts2/ui/hover_tip.png",
  buff: "/images/sts2/ui/hover_tip_buff.png",
  debuff: "/images/sts2/ui/hover_tip_debuff.png",
};

export type HoverTipVariant = "default" | "buff" | "debuff";

interface HoverTipProps {
  title: string;
  variant?: HoverTipVariant;
  icon?: string | null;
  children?: ReactNode;
  /** Inline-block when true, absolute-position the parent for tooltip positioning. */
  className?: string;
  style?: React.CSSProperties;
}

export function HoverTip({
  title,
  variant = "default",
  icon,
  children,
  className = "",
  style,
}: HoverTipProps) {
  const bt = Math.round(SLICE.top * SCALE);
  const br = Math.round(SLICE.right * SCALE);
  const bb = Math.round(SLICE.bottom * SCALE);
  const bl = Math.round(SLICE.left * SCALE);

  return (
    <div
      className={className}
      style={{
        // 9-slice via CSS border-image
        borderStyle: "solid",
        borderColor: "transparent",
        borderTopWidth: `${bt}px`,
        borderRightWidth: `${br}px`,
        borderBottomWidth: `${bb}px`,
        borderLeftWidth: `${bl}px`,
        borderImageSource: `url(${SRC[variant]})`,
        borderImageSlice: `${SLICE.top} ${SLICE.right} ${SLICE.bottom} ${SLICE.left} fill`,
        borderImageWidth: `${bt}px ${br}px ${bb}px ${bl}px`,
        borderImageRepeat: "stretch",
        boxSizing: "border-box",
        minWidth: 200,
        maxWidth: 320,
        ...style,
      }}
    >
      <div style={{ position: "relative", marginTop: -4 }}>
        <div
          className="flex items-center justify-center gap-1.5"
          style={{
            fontFamily: "var(--font-kreon), var(--font-gc-batang), serif",
            fontSize: 14,
            fontWeight: 700,
            color: "#EFC851",
            textShadow: "1.5px 1px 0 rgba(0,0,0,0.55)",
            textAlign: "center",
            marginBottom: 4,
          }}
        >
          <span>{title}</span>
          {icon && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={icon}
              alt=""
              style={{ width: 18, height: 18, objectFit: "contain" }}
            />
          )}
        </div>
        {children && (
          <div
            style={{
              fontFamily: "var(--font-kreon), var(--font-gc-batang), serif",
              fontSize: 12,
              lineHeight: 1.25,
              color: "#FFF6E2",
              textShadow: "1.5px 1px 0 rgba(0,0,0,0.45)",
            }}
          >
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
