import type { CSSProperties } from "react";
import { characterSlugFromReplay } from "@/lib/run-cover-suggest";

/** Tuned like Compendium character index inactive rows — crops black padding. */
const FACE_FOCUS: Record<string, string> = {
  defect: "55% 36%",
  ironclad: "52% 34%",
  necrobinder: "68% 35%",
  regent: "54% 36%",
  silent: "69% 34%",
};

const INACTIVE_FRAME: Record<
  string,
  { scale: number; translateX: string; translateY: string; transformOrigin: string }
> = {
  defect: {
    scale: 1.85,
    translateX: "-3%",
    translateY: "0%",
    transformOrigin: "52% 35%",
  },
  ironclad: {
    scale: 1.45,
    translateX: "8%",
    translateY: "-2%",
    transformOrigin: "58% 40%",
  },
  necrobinder: {
    scale: 1.55,
    translateX: "12%",
    translateY: "-2%",
    transformOrigin: "68% 38%",
  },
  regent: {
    scale: 1.48,
    translateX: "2%",
    translateY: "0%",
    transformOrigin: "54% 36%",
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

export function coverCharacterArtStyle(character: string | undefined): CSSProperties {
  const slug = characterSlugFromReplay(character);
  const frame = INACTIVE_FRAME[slug] ?? {
    scale: 1.4,
    translateX: "4%",
    translateY: "0%",
    transformOrigin: "55% 36%",
  };
  return {
    objectPosition: FACE_FOCUS[slug] ?? "56% 35%",
    transform: `translate3d(${frame.translateX}, ${frame.translateY}, 0) scale(${frame.scale})`,
    transformOrigin: frame.transformOrigin,
  };
}
