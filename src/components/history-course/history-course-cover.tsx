"use client";

import Image from "next/image";
import { useState } from "react";
import {
  characterSpireClass,
  coverCardArtSrc,
  coverCharacterPortraitSrc,
  coverCharacterSelectSrc,
  coverElementImageSrc,
  displayNameForCoverElement,
} from "@/lib/run-cover-display";
import type { CoverElement, CoverSpec } from "@/lib/run-cover-types";
import { cn } from "@/lib/utils";

// Re-export helper used by cover — keep display helpers colocated lightly.
function elementLabel(element: CoverElement): string {
  return displayNameForCoverElement(element);
}

interface HistoryCourseCoverProps {
  cover: CoverSpec;
  character: string;
  className?: string;
  /** denser layout for combo compact chips */
  size?: "index" | "compact";
}

export function HistoryCourseCover({
  cover,
  character,
  className,
  size = "index",
}: HistoryCourseCoverProps) {
  const phraseClass = characterSpireClass(character);
  const cardBg =
    cover.background.kind === "card-beta" ? cover.background : null;
  const cardArt = cardBg ? coverCardArtSrc(cardBg.cardId) : null;
  const [bgSrc, setBgSrc] = useState(
    cardArt ? cardArt.beta : coverCharacterSelectSrc(character),
  );
  const [bgFailedSelect, setBgFailedSelect] = useState(false);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg bg-zinc-950 ring-1 ring-white/10",
        size === "compact" ? "aspect-video w-full" : "aspect-video w-full",
        className,
      )}
    >
      <Image
        src={bgFailedSelect ? coverCharacterPortraitSrc(character) : bgSrc}
        alt=""
        fill
        sizes={size === "compact" ? "160px" : "360px"}
        className={cn(
          "object-cover",
          cardBg ? "object-center scale-110" : "object-right",
        )}
        onError={() => {
          if (cardArt && bgSrc === cardArt.beta) {
            setBgSrc(cardArt.src);
            return;
          }
          if (!cardBg && !bgFailedSelect) {
            setBgFailedSelect(true);
            setBgSrc(coverCharacterPortraitSrc(character));
          }
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-black/10" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30" />

      <div
        className={cn(
          "absolute inset-0 flex flex-col justify-between",
          size === "compact" ? "p-1.5" : "p-2.5 sm:p-3",
        )}
      >
        <p
          className={cn(
            "font-game-title font-bold leading-tight",
            phraseClass,
            size === "compact" ? "text-[11px]" : "text-sm sm:text-base",
            "cover-phrase-outline max-w-[85%]",
          )}
        >
          {cover.phrase}
        </p>

        {cover.elements.length > 0 && (
          <div className="flex items-end gap-1">
            {cover.elements.slice(0, 3).map((element) => (
              <CoverElementThumb
                key={`${element.kind}:${element.id}`}
                element={element}
                compact={size === "compact"}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CoverElementThumb({
  element,
  compact,
}: {
  element: CoverElement;
  compact: boolean;
}) {
  const [src, setSrc] = useState(coverElementImageSrc(element));
  const [failed, setFailed] = useState(false);
  const label = elementLabel(element);
  const dim = compact ? "h-7 w-7" : "h-10 w-10 sm:h-11 sm:w-11";

  return (
    <span
      className={cn(
        "relative shrink-0 overflow-hidden rounded-md bg-black/50 ring-1 ring-amber-300/30",
        dim,
      )}
      title={element.copies && element.copies > 1 ? `${label} ×${element.copies}` : label}
    >
      {!failed ? (
        <Image
          src={src}
          alt=""
          fill
          sizes={compact ? "28px" : "44px"}
          className="object-contain p-0.5"
          onError={() => {
            if (element.kind === "card" && src.includes("/cards/")) {
              // already primary
            }
            setFailed(true);
            setSrc("");
          }}
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-[9px] font-bold text-amber-200">
          {label.slice(0, 1)}
        </span>
      )}
      {element.copies && element.copies > 1 && (
        <span className="absolute -bottom-0.5 -right-0.5 rounded bg-black/80 px-0.5 text-[9px] font-bold leading-none text-amber-200 ring-1 ring-amber-300/40">
          ×{element.copies}
        </span>
      )}
    </span>
  );
}
