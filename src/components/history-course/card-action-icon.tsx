"use client";

import Image from "next/image";
import { CodexCard } from "@/lib/codex-types";
import {
  CHAR_FRAME_HSV,
  RARITY_BANNER_HSV,
  hsvToFilter,
} from "@/lib/sts2-card-style";

const FRAME_ASSET: Record<string, string> = {
  공격: "/images/game-assets/card-frames/card_frame_attack.png",
  스킬: "/images/game-assets/card-frames/card_frame_skill.png",
  파워: "/images/game-assets/card-frames/card_frame_power.png",
  저주: "/images/game-assets/card-frames/card_frame_skill.png",
  상태이상: "/images/game-assets/card-frames/card_frame_skill.png",
  퀘스트: "/images/game-assets/card-frames/card_frame_quest.png",
};

const BANNER_ASSET = "/images/game-assets/card-misc/card_banner.png";

interface CardActionIconProps {
  card: CodexCard;
  /** Pixel width. Aspect 300/422 preserved via aspectRatio. */
  width: number;
}

/**
 * Tiny assembled card silhouette — no portrait art. Reuses the same frame
 * + banner sprites the full CardTile uses, just smaller. The frame asset
 * already encodes the type-specific shape (attack = angled top, power =
 * rounded, skill = square, curse/status reuses skill, quest distinct), so
 * a character-HSV tint on the frame plus a rarity-HSV tint on the banner
 * is enough to read at a glance.
 */
export function CardActionIcon({ card, width }: CardActionIconProps) {
  const frameAsset = FRAME_ASSET[card.type] ?? FRAME_ASSET["스킬"];
  const charHsv = CHAR_FRAME_HSV[card.color] ?? CHAR_FRAME_HSV.colorless;
  const bannerHsv = RARITY_BANNER_HSV[card.rarity] ?? RARITY_BANNER_HSV["일반"];
  const frameFilter = hsvToFilter(charHsv);
  const bannerFilter = hsvToFilter(bannerHsv);

  return (
    <div
      className="relative shrink-0 select-none"
      style={{ width, aspectRatio: "300 / 422" }}
    >
      {/* Frame fills the silhouette — character-tinted. The frame asset
          itself encodes the type shape, so attacks get their angled top,
          powers their rounded corners, etc., for free. */}
      <Image
        src={frameAsset}
        alt=""
        fill
        sizes={`${width}px`}
        className="object-contain"
        style={{ filter: frameFilter }}
        unoptimized
      />

      {/* Top banner (rarity-tinted) — overhangs the frame slightly the same
          way the full CardTile lays it out, so a 30 px icon still reads as
          "this is a card-shaped thing." */}
      <div
        className="absolute"
        style={{
          top: "3%",
          left: "-9%",
          right: "-9%",
          height: "17%",
        }}
      >
        <Image
          src={BANNER_ASSET}
          alt=""
          fill
          sizes={`${Math.round(width * 1.18)}px`}
          className="object-contain"
          style={{ filter: bannerFilter }}
          unoptimized
        />
      </div>
    </div>
  );
}
