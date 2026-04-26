"use client";

import { ReactNode } from "react";

// =============================================================================
// 게임 hover_tip 9-slice (scenes/ui/hover_tip.tscn)
// 원본: 339×107 / patch margin (l,t,r,b) = (55, 43, 91, 32)
// 게임 폰트 사이즈: title 22px, description 22px (둘 다 동일)
// 게임 패딩(TextContainer margin): left=22, top=16, right=45, bottom=28
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

  // 게임 hover_tip: title 22px, description 22px — 동일 사이즈.
  // 카드 본문 폰트(380px 카드 × 7cqi = 26.6px)와 비슷한 크기.
  const fontSize = 16;

  return (
    <div
      className={className}
      style={{
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
        minWidth: 240,
        maxWidth: 360,
        ...style,
      }}
    >
      <div
        style={{
          // 게임 TextContainer margin: left=22, top=16, right=45, bottom=28 (스케일 적용)
          paddingLeft: Math.round(22 * SCALE),
          paddingTop: Math.round(16 * SCALE),
          paddingRight: Math.round(45 * SCALE),
          paddingBottom: Math.round(28 * SCALE),
          marginTop: -8,
          marginBottom: -8,
        }}
      >
        <div
          className="flex items-center gap-2"
          style={{
            fontFamily: "var(--font-kreon), var(--font-gc-batang), serif",
            fontSize,
            fontWeight: 700,
            color: "#EFC851",
            textShadow: "2px 2px 0 rgba(0,0,0,0.45)",
            textAlign: "left",
            marginBottom: 6,
          }}
        >
          <span>{title}</span>
          {icon && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={icon}
              alt=""
              style={{ width: fontSize + 2, height: fontSize + 2, objectFit: "contain" }}
            />
          )}
        </div>
        {children && (
          <div
            style={{
              fontFamily: "var(--font-kreon), var(--font-gc-batang), serif",
              fontSize,
              lineHeight: 1.4,
              color: "#FFF6E2",
              textShadow: "2px 2px 0 rgba(0,0,0,0.45)",
              textAlign: "left",
            }}
          >
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
