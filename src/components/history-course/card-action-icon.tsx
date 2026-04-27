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

const PORTRAIT_BORDER: Record<string, string> = {
  공격: "/images/game-assets/card-portraits/card_portrait_border_attack.png",
  스킬: "/images/game-assets/card-portraits/card_portrait_border_skill.png",
  파워: "/images/game-assets/card-portraits/card_portrait_border_power.png",
  저주: "/images/game-assets/card-portraits/card_portrait_border_skill.png",
  상태이상: "/images/game-assets/card-portraits/card_portrait_border_skill.png",
  퀘스트: "/images/game-assets/card-portraits/card_portrait_border_skill.png",
};

interface CardActionIconProps {
  card: CodexCard;
  /** Pixel width. Aspect 300/422 preserved via aspectRatio. */
  width: number;
  showUpgrade?: boolean;
}

/**
 * Tiny card silhouette: frame tinted by character color + portrait window
 * (with art) + rarity-colored banner overlay. Designed for ~24-40px widths
 * where full CardTile text would be unreadable.
 */
export function CardActionIcon({ card, width, showUpgrade = false }: CardActionIconProps) {
  const frameAsset = FRAME_ASSET[card.type] ?? FRAME_ASSET["스킬"];
  const portraitAsset = PORTRAIT_BORDER[card.type] ?? PORTRAIT_BORDER["스킬"];
  const charHsv = CHAR_FRAME_HSV[card.color] ?? CHAR_FRAME_HSV.colorless;
  const bannerHsv = RARITY_BANNER_HSV[card.rarity] ?? RARITY_BANNER_HSV["일반"];
  const frameFilter = hsvToFilter(charHsv);
  const bannerFilter = hsvToFilter(bannerHsv);

  // Use beta art only as fallback (full-color is fine; we let the portrait
  // window crop it).
  const imageSrc = card.imageUrl ?? card.betaImageUrl ?? null;

  return (
    <div
      className="relative shrink-0 select-none"
      style={{ width, aspectRatio: "300 / 422" }}
      data-upgraded={showUpgrade ? "true" : undefined}
    >
      {/* Portrait window — same %-based bounds as CardTile.L.art */}
      <div
        className="absolute overflow-hidden"
        style={{ top: "9%", left: "6%", right: "6%", bottom: "44%" }}
      >
        {imageSrc ? (
          <Image
            src={imageSrc}
            alt=""
            fill
            sizes={`${width}px`}
            className="object-contain object-center"
            unoptimized
          />
        ) : (
          <div className="h-full w-full bg-black/40" />
        )}
      </div>

      {/* Character-tinted frame */}
      <Image
        src={frameAsset}
        alt=""
        fill
        sizes={`${width}px`}
        className="object-contain"
        style={{ filter: frameFilter }}
        unoptimized
      />

      {/* Rarity-tinted portrait border (rim around portrait window) */}
      <div
        className="absolute left-1/2 -translate-x-1/2"
        style={{ top: "9%", width: "92%", height: "50%" }}
      >
        <Image
          src={portraitAsset}
          alt=""
          fill
          sizes={`${width}px`}
          className="object-contain"
          style={{ filter: bannerFilter }}
          unoptimized
        />
      </div>
    </div>
  );
}
