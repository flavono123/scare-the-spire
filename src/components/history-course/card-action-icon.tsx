"use client";

import Image from "next/image";
import type { CSSProperties } from "react";
import type { CardColor, CardRarityKo, CardTypeKo, CodexCard } from "@/lib/codex-types";
import { lookupHistoryCardVisual } from "@/lib/history-card-visuals";
import { historyEnchantmentImageUrl } from "@/lib/history-enchantments";

// Direct port of `scenes/cards/tiny_card.tscn` + NTinyCard.cs from the PCK.
// Sprite assets live under public/images/sts2/tiny-card/. The game tints them
// via Godot `Modulate` Color; we reproduce that with mask-image + backgroundColor.
//
// Banner colors and CardBack character colors are taken verbatim from
// NTinyCard.GetBannerColor and CardPoolModel.DeckEntryCardColor in the
// decompiled DLL (so they match in-game exactly).
const TINY = "/images/sts2/tiny-card";

// CardPoolModel.DeckEntryCardColor — character/pool tint applied to the
// card back silhouette. Hex pulled directly from each *CardPool.cs.
const POOL_COLOR: Record<CardColor, string> = {
  ironclad: "#D62000",
  silent: "#5EBD00",
  defect: "#3EB3ED",
  necrobinder: "#CD4EED",
  regent: "#E36600",
  colorless: "#A3A3A3",
  event: "#A3A3A3",
  curse: "#585B61",
  quest: "#24476A",
  status: "#FFFFFF",
  token: "#FFFFFF",
};

// NTinyCard.GetBannerColor — rarity tint on the title ribbon.
const BANNER_COLOR: Partial<Record<CardRarityKo, string>> = {
  기본: "#9C9C9C",
  일반: "#9C9C9C",
  고급: "#64FFFF",
  희귀: "#FFDA36",
  저주: "#E669FF",
  이벤트: "#13BE1A",
  퀘스트: "#F46836",
};

// CardModel.FrameMaterial comes from VisualCardPool. Its HSV shader only
// changes the brightness of this grayscale sprite in practice.
const FRAME_BRIGHTNESS: Record<CardColor, number> = {
  ironclad: 1,
  silent: 1.2,
  defect: 1,
  necrobinder: 1.2,
  regent: 1.2,
  colorless: 1.2,
  event: 1.2,
  curse: 0.55,
  quest: 1,
  status: 1.2,
  token: 1.2,
};

// Type → which portrait sprite encodes the card-shape silhouette
// (attack = inverted triangle, power = rounded square, default skill
// = rectangle). Curse / status / quest fall through to skill in-game.
function portraitName(type: string): string {
  if (type === "공격") return "attack_portrait";
  if (type === "파워") return "power_portrait";
  return "skill_portrait";
}

// Banner Shadow modulate from the tscn — a light cyan accent the game
// stamps behind the banner for a subtle drop. We keep the value as-is.
const BANNER_SHADOW_TINT = "#64FFFF";

// Portrait modulate — cream/gold from the tscn (Color 0.95, 0.92, 0.69).
const PORTRAIT_TINT = "#F2EBB1";

export interface TinyCardVisual {
  color: CardColor;
  visualColor?: CardColor;
  rarity: CardRarityKo;
  type: CardTypeKo;
}

interface TinyCardIconProps {
  card: TinyCardVisual;
  /** Pixel width. Aspect 1/1 — the in-game tiny_card scene is 32×32. */
  width: number;
}

interface CardActionIconProps extends TinyCardIconProps {
  card: CodexCard;
}

function maskLayer(
  src: string,
  color: string,
  opacity = 1,
  filter?: string,
): CSSProperties {
  return {
    position: "absolute",
    inset: 0,
    backgroundColor: color,
    opacity,
    maskImage: `url(${src})`,
    WebkitMaskImage: `url(${src})`,
    maskRepeat: "no-repeat",
    WebkitMaskRepeat: "no-repeat",
    maskPosition: "center",
    WebkitMaskPosition: "center",
    maskSize: "contain",
    WebkitMaskSize: "contain",
    filter,
    imageRendering: "pixelated",
  };
}

function multiplyColors(left: string, right: string): string {
  const channels = [1, 3, 5].map((offset) =>
    Math.round(
      (Number.parseInt(left.slice(offset, offset + 2), 16)
        * Number.parseInt(right.slice(offset, offset + 2), 16))
        / 255,
    )
      .toString(16)
      .padStart(2, "0"),
  );
  return `#${channels.join("")}`.toUpperCase();
}

export function TinyCardIcon({ card, width }: TinyCardIconProps) {
  const cardBackColor = POOL_COLOR[card.color];
  const frameBrightness = FRAME_BRIGHTNESS[card.visualColor ?? card.color];
  const bannerColor = BANNER_COLOR[card.rarity] ?? "#FFFFFF";
  const bannerShadowColor = multiplyColors(BANNER_SHADOW_TINT, bannerColor);
  const portrait = portraitName(card.type);

  return (
    <div
      className="relative shrink-0 select-none"
      style={{ width, height: width, imageRendering: "pixelated" }}
    >
      {/* CardBack — outer silhouette, character color */}
      <div
        style={maskLayer(
          `${TINY}/card_back.png`,
          cardBackColor,
          1,
          `brightness(${frameBrightness})`,
        )}
      />
      {/* Description box — dark inset overlay (opacity from tscn modulate alpha) */}
      <div style={maskLayer(`${TINY}/desc_box.png`, "#000000", 64 / 255)} />
      {/* PortraitShadow — pre-tinted (renders as <img> for its own RGBA) */}
      <Image
        src={`${TINY}/${portrait}_shadow.png`}
        alt=""
        fill
        sizes={`${width}px`}
        className="object-contain"
        style={{ imageRendering: "pixelated" }}
        unoptimized
      />
      {/* Portrait — type-specific shape, cream tinted */}
      <div style={maskLayer(`${TINY}/${portrait}.png`, PORTRAIT_TINT)} />
      {/* Banner shadow — accent behind banner */}
      <div style={maskLayer(`${TINY}/banner_shadow.png`, bannerShadowColor)} />
      {/* Banner — rarity-colored top ribbon */}
      <div style={maskLayer(`${TINY}/banner.png`, bannerColor)} />
    </div>
  );
}

export function CardActionIcon(props: CardActionIconProps) {
  return <TinyCardIcon {...props} />;
}

export function HistoryTinyCardIcon({
  id,
  width,
  enchantmentId,
}: {
  id: string;
  width: number;
  enchantmentId?: string;
}) {
  const visual = lookupHistoryCardVisual(id);
  const tokenSrc = enchantmentId ? historyEnchantmentImageUrl(enchantmentId) : null;
  if (!visual) {
    return (
      <div aria-hidden className="shrink-0" style={{ width, height: width }} />
    );
  }
  return (
    <div className="relative shrink-0 overflow-visible" style={{ width, height: width }}>
      <TinyCardIcon card={visual} width={width} />
      {tokenSrc ? (
        // NDeckHistoryEntry %Enchantment TextureRect: offset (18,12) size 24×24
        // on a 32×32 tiny card.
        <span
          className="pointer-events-none absolute"
          style={{
            left: `${(18 / 32) * 100}%`,
            top: `${(12 / 32) * 100}%`,
            width: `${(24 / 32) * 100}%`,
            height: `${(24 / 32) * 100}%`,
          }}
        >
          <Image
            src={tokenSrc}
            alt=""
            fill
            sizes={`${Math.ceil(width * 24 / 32)}px`}
            className="object-contain"
            style={{ imageRendering: "pixelated" }}
            unoptimized
          />
        </span>
      ) : null}
    </div>
  );
}
