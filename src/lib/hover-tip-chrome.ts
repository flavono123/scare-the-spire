import { TEXT_CREAM, TEXT_GOLD } from "@/lib/sts2-card-style";

/**
 * Game hover_tip NinePatchRect (scenes/ui/hover_tip.tscn).
 * Source art 339×107, patch margin left/top/right/bottom = 55/43/91/32.
 */
export const HOVER_TIP_SLICE = { top: 43, right: 91, bottom: 32, left: 55 } as const;

export const HOVER_TIP_SRC = {
  default: "/images/sts2/ui/hover_tip.png",
  buff: "/images/sts2/ui/hover_tip_buff.png",
  debuff: "/images/sts2/ui/hover_tip_debuff.png",
} as const;

export const HOVER_TIP_TITLE_COLOR = TEXT_GOLD;
export const HOVER_TIP_BODY_COLOR = TEXT_CREAM;
