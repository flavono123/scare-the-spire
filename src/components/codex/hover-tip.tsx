"use client";

import { ReactNode } from "react";
import Image from "@/components/ui/static-image";

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
export type HoverTipArtMode = "official" | "beta";

export type HoverTipArt = {
  mode: HoverTipArtMode;
  imageUrl?: string | null;
  betaImageUrl?: string | null;
  alt?: string;
  betaAlt?: string;
  width?: number;
  height?: number;
  className?: string;
};

interface HoverTipProps {
  title: string;
  variant?: HoverTipVariant;
  icon?: string | null;
  art?: HoverTipArt;
  children?: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

function selectedHoverTipArt(art?: HoverTipArt) {
  if (!art) return null;
  const imageUrl = art.mode === "beta" ? art.betaImageUrl : art.imageUrl;
  if (!imageUrl) return null;

  return {
    imageUrl,
    alt: art.mode === "beta" ? art.betaAlt ?? art.alt ?? "" : art.alt ?? "",
    width: art.width ?? 260,
    height: art.height ?? 146,
    className: art.className ?? "h-auto w-full object-cover",
  };
}

export function GameHoverTip({
  title,
  variant = "default",
  icon,
  art,
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
  const selectedArt = selectedHoverTipArt(art);

  return (
    <span
      className={className}
      style={{
        display: "block",
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
        // 패딩 0: 글자가 9-slice 가장자리(border)에서 바로 시작.
        // 호버팁 폭은 inner content 의 자연 wrap 폭에 맞춰 결정.
        ...style,
      }}
    >
      <span style={{ display: "block" }}>
        <span
          className="flex items-center gap-2"
          style={{
            fontFamily: "var(--font-game-text)",
            fontSize,
            fontWeight: 700,
            color: "#EFC851",
            textShadow: "2px 2px 0 rgba(0,0,0,0.45)",
            textAlign: "left",
            marginBottom: 4,
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
        </span>
        {selectedArt && (
          <span className="mb-2 block overflow-hidden rounded bg-black/25">
            <Image
              src={selectedArt.imageUrl}
              alt={selectedArt.alt}
              width={selectedArt.width}
              height={selectedArt.height}
              className={selectedArt.className}
            />
          </span>
        )}
        {children && (
          <span
            style={{
              display: "block",
              fontFamily: "var(--font-game-text)",
              fontSize,
              lineHeight: 1.4,
              color: "#FFF6E2",
              textShadow: "2px 2px 0 rgba(0,0,0,0.45)",
              textAlign: "left",
              textIndent: 0,
            }}
          >
            {children}
          </span>
        )}
      </span>
    </span>
  );
}

export { GameHoverTip as HoverTip };
