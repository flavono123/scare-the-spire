"use client";

import { type CSSProperties, type ReactNode } from "react";
import Image from "@/components/ui/static-image";
import {
  HOVER_TIP_BODY_COLOR,
  HOVER_TIP_SLICE,
  HOVER_TIP_SRC,
  HOVER_TIP_TITLE_COLOR,
} from "@/lib/hover-tip-chrome";

export type HoverTipVariant = "default" | "buff" | "debuff";
export type HoverTipArtMode = "official" | "beta";

const SCALE = 0.55;

const SRC = HOVER_TIP_SRC;

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
  title: ReactNode;
  variant?: HoverTipVariant;
  icon?: string | null;
  art?: HoverTipArt;
  compact?: boolean;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
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
  compact = false,
  children,
  className = "",
  style,
}: HoverTipProps) {
  const bt = compact ? 10 : Math.round(HOVER_TIP_SLICE.top * SCALE);
  const br = compact ? 12 : Math.round(HOVER_TIP_SLICE.right * SCALE);
  const bb = compact ? 8 : Math.round(HOVER_TIP_SLICE.bottom * SCALE);
  const bl = compact ? 12 : Math.round(HOVER_TIP_SLICE.left * SCALE);

  // 게임 hover_tip: title 22px, description 22px — 동일 사이즈.
  // 카드 본문 폰트(380px 카드 × 7cqi = 26.6px)와 비슷한 크기.
  const fontSize = compact ? 12 : 16;
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
        borderImageSlice: `${HOVER_TIP_SLICE.top} ${HOVER_TIP_SLICE.right} ${HOVER_TIP_SLICE.bottom} ${HOVER_TIP_SLICE.left} fill`,
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
          className={`flex items-center ${compact ? "gap-1" : "gap-2"}`}
          style={{
            fontFamily: "var(--font-game-text)",
            fontSize,
            fontWeight: 700,
            color: HOVER_TIP_TITLE_COLOR,
            textShadow: "2px 2px 0 rgba(0,0,0,0.45)",
            textAlign: "left",
            marginBottom: children || selectedArt ? compact ? 2 : 4 : 0,
            whiteSpace: compact ? "nowrap" : undefined,
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
              color: HOVER_TIP_BODY_COLOR,
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
