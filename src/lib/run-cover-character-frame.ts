import type { CSSProperties } from "react";
import { characterSlugFromReplay } from "@/lib/run-cover-suggest";

/** Tuned for 16:9 cover crop — hide top letterbox; necro sits lower-right. */
const FACE_FOCUS: Record<string, string> = {
  defect: "55% 42%",
  ironclad: "52% 40%",
  necrobinder: "78% 44%",
  regent: "54% 46%",
  silent: "69% 34%",
};

const INACTIVE_FRAME: Record<
  string,
  { scale: number; translateX: string; translateY: string; transformOrigin: string }
> = {
  defect: {
    scale: 1.95,
    translateX: "-3%",
    translateY: "-10%",
    transformOrigin: "52% 40%",
  },
  ironclad: {
    scale: 1.58,
    translateX: "8%",
    translateY: "-12%",
    transformOrigin: "58% 42%",
  },
  necrobinder: {
    scale: 1.65,
    translateX: "-6%",
    translateY: "4%",
    transformOrigin: "78% 46%",
  },
  regent: {
    scale: 1.72,
    translateX: "2%",
    translateY: "-16%",
    transformOrigin: "54% 44%",
  },
  silent: {
    scale: 1.42,
    translateX: "6%",
    translateY: "-2%",
    transformOrigin: "64% 38%",
  },
};

const SELECT_BACKGROUNDS: Record<string, string> = {
  silent: "/images/sts2/character-select/character_select_silent_bg.webp",
  necrobinder: "/images/sts2/character-select/character_select_necrobinder_bg.webp",
};

export function coverCharacterSelectBackgroundSrc(
  character: string | undefined,
): string | null {
  const slug = characterSlugFromReplay(character);
  return SELECT_BACKGROUNDS[slug] ?? null;
}

export function coverCharacterArtStyle(
  character: string | undefined,
  extraTranslateXPct = 0,
): CSSProperties {
  const slug = characterSlugFromReplay(character);
  const frame = INACTIVE_FRAME[slug] ?? {
    scale: 1.4,
    translateX: "4%",
    translateY: "0%",
    transformOrigin: "55% 36%",
  };
  const translateX =
    extraTranslateXPct === 0
      ? frame.translateX
      : `calc(${frame.translateX} + ${extraTranslateXPct}%)`;
  return {
    objectPosition: FACE_FOCUS[slug] ?? "56% 35%",
    transform: `translate3d(${translateX}, ${frame.translateY}, 0) scale(${frame.scale})`,
    transformOrigin: frame.transformOrigin,
  };
}

/** TR→BL slice angle, from the horizontal, in screen space (y down). */
export const COVER_PARTY_DIAGONAL_DEG = 60;
const COVER_PARTY_ASPECT_H = 9 / 16;
const COVER_PARTY_SLANT_PCT =
  (COVER_PARTY_ASPECT_H / Math.tan((COVER_PARTY_DIAGONAL_DEG * Math.PI) / 180)) *
  100;
const COVER_PARTY_SEAM_PCT = 1.25;

export type CoverPartyPolygon = {
  topLeft: number;
  topRight: number;
  bottomRight: number;
  bottomLeft: number;
};

/** Equal-height parallelograms; only the 60° TR→BL edges move with slot index. */
export function coverPartySlicePolygon(
  slotIndex: number,
  partySize: number,
): CoverPartyPolygon {
  const n = Math.max(1, partySize);
  const i = Math.max(0, Math.min(slotIndex, n - 1));
  const half = COVER_PARTY_SLANT_PCT / 2;
  const leftMid = (i / n) * 100 - COVER_PARTY_SEAM_PCT;
  const rightMid = ((i + 1) / n) * 100 + COVER_PARTY_SEAM_PCT;
  return {
    topLeft: leftMid + half,
    topRight: rightMid + half,
    bottomRight: rightMid - half,
    bottomLeft: leftMid - half,
  };
}

export function coverPartyClipPath(slotIndex: number, partySize: number): string {
  const p = coverPartySlicePolygon(slotIndex, partySize);
  return `polygon(${p.topLeft}% 0%, ${p.topRight}% 0%, ${p.bottomRight}% 100%, ${p.bottomLeft}% 100%)`;
}

/** Keep the body in the right of each slice — select art is right-weighted. */
export function coverPartyCharacterImageStyle(
  character: string | undefined,
  slotIndex: number,
  partySize: number,
): CSSProperties {
  const n = Math.max(1, partySize);
  const targetX = ((slotIndex + 0.72) / n) * 100;
  return coverCharacterArtStyle(character, targetX - 72);
}

/** Full-bleed layer; spine + select background share this clip. */
export function coverPartyCharacterSlotStyle(
  character: string | undefined,
  slotIndex: number,
  partySize: number,
): { wrapper: CSSProperties; set: CSSProperties; image: CSSProperties } {
  const clip = coverPartyClipPath(slotIndex, partySize);
  const framed = coverPartyCharacterImageStyle(character, slotIndex, partySize);
  const { objectPosition, ...set } = framed;
  return {
    wrapper: {
      position: "absolute",
      inset: 0,
      zIndex: Math.max(1, partySize) - slotIndex,
      clipPath: clip,
      WebkitClipPath: clip,
    },
    set,
    image: { objectPosition },
  };
}
