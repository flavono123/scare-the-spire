"use client";

import Image from "next/image";
import type { CSSProperties } from "react";
import { CodexCard } from "@/lib/codex-types";

// Direct port of `scenes/cards/tiny_card.tscn` + NTinyCard.cs from the PCK.
// Sprite assets live under public/images/sts2/tiny-card/ and are pure
// white silhouettes (alpha-cut shapes). The game tints them via Godot
// `Modulate` Color; we reproduce that with mask-image + backgroundColor.
//
// Banner colors and CardBack character colors are taken verbatim from
// NTinyCard.GetBannerColor and CardPoolModel.DeckEntryCardColor in the
// decompiled DLL (so they match in-game exactly).
const TINY = "/images/sts2/tiny-card";

// CardPoolModel.DeckEntryCardColor — character/pool tint applied to the
// card back silhouette. Hex pulled directly from each *CardPool.cs.
const POOL_COLOR: Record<string, string> = {
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
const BANNER_COLOR: Record<string, string> = {
  기본: "#9C9C9C",
  일반: "#9C9C9C",
  고급: "#64FFFF",
  희귀: "#FFDA36",
  저주: "#E669FF",
  이벤트: "#13BE1A",
  퀘스트: "#F46836",
  // Ancient cards are basically rare-tier in mini icons; no
  // dedicated banner color in NTinyCard so reuse rare.
  "고대의 존재": "#FFDA36",
  토큰: "#9C9C9C",
  상태이상: "#9C9C9C",
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

interface CardActionIconProps {
  card: CodexCard;
  /** Pixel width. Aspect 1/1 — the in-game tiny_card scene is 32×32. */
  width: number;
}

function maskLayer(src: string, color: string, opacity = 1): CSSProperties {
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
  };
}

export function CardActionIcon({ card, width }: CardActionIconProps) {
  const cardBackColor = POOL_COLOR[card.color] ?? POOL_COLOR.colorless;
  const bannerColor = BANNER_COLOR[card.rarity] ?? BANNER_COLOR["일반"];
  const portrait = portraitName(card.type);

  return (
    <div
      className="relative shrink-0 select-none"
      style={{ width, height: width }}
    >
      {/* CardBack — outer silhouette, character color */}
      <div style={maskLayer(`${TINY}/card_back.png`, cardBackColor)} />
      {/* Description box — dark inset overlay (opacity from tscn modulate alpha) */}
      <div style={maskLayer(`${TINY}/desc_box.png`, "#000000", 0.25)} />
      {/* PortraitShadow — pre-tinted (renders as <img> for its own RGBA) */}
      <Image
        src={`${TINY}/${portrait}_shadow.png`}
        alt=""
        fill
        sizes={`${width}px`}
        className="object-contain"
        unoptimized
      />
      {/* Portrait — type-specific shape, cream tinted */}
      <div style={maskLayer(`${TINY}/${portrait}.png`, PORTRAIT_TINT)} />
      {/* Banner shadow — accent behind banner */}
      <div style={maskLayer(`${TINY}/banner_shadow.png`, BANNER_SHADOW_TINT)} />
      {/* Banner — rarity-colored top ribbon */}
      <div style={maskLayer(`${TINY}/banner.png`, bannerColor)} />
    </div>
  );
}
