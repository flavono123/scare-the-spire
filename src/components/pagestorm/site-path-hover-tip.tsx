"use client";

import type { CSSProperties } from "react";
import Image from "@/components/ui/static-image";

const DIALOGUE_NINE_PATCH = "/images/sts2/ancient-dialogue/dialogue_nine_patch.webp";

/**
 * Site-page preview. Ancient dialogue bubble filled with the in-game dialogue
 * color, so it stays distinct from the keyword hover tip.
 */
export function SitePathHoverTip({
  imageUrl,
  imageAlt,
  title,
  description,
}: {
  imageUrl?: string;
  imageAlt?: string;
  title: string;
  description?: string;
}) {
  const frame: CSSProperties = {
    backgroundColor: "#28454f",
    WebkitMaskBoxImageSource: `url(${DIALOGUE_NINE_PATCH})`,
    WebkitMaskBoxImageSlice: "28 27 fill",
    WebkitMaskBoxImageWidth: "14px",
    WebkitMaskBoxImageRepeat: "stretch",
  };
  return (
    <span className="block w-64 px-3 py-2.5" style={frame}>
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt={imageAlt ?? ""}
          width={320}
          height={180}
          className="mb-2 h-28 w-full object-cover"
        />
      ) : null}
      <span className="block truncate font-game-title text-sm font-bold spire-gold">{title}</span>
      {description ? (
        <span className="mt-1 block truncate text-xs text-white">{description}</span>
      ) : null}
    </span>
  );
}
