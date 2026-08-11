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
