export type CardSideTipHorizontal = "left" | "right";

/** Below this available side width, never attempt to show tips. */
export const CARD_SIDE_TIP_MIN_SIDE_WIDTH = 280;

export function cardSideTipSideFits(available: number, needed: number): boolean {
  return available >= needed && available >= CARD_SIDE_TIP_MIN_SIDE_WIDTH;
}

/** Pure placement pick — hide (null) unless a side fully fits without clipping. */
export function chooseCardSideTipHorizontal(opts: {
  leftSpace: number;
  rightSpace: number;
  tipWidth: number;
  preferSide: CardSideTipHorizontal;
}): CardSideTipHorizontal | null {
  const leftOk = cardSideTipSideFits(opts.leftSpace, opts.tipWidth);
  const rightOk = cardSideTipSideFits(opts.rightSpace, opts.tipWidth);
  if (opts.preferSide === "left") {
    if (leftOk) return "left";
    if (rightOk) return "right";
    return null;
  }
  if (rightOk) return "right";
  if (leftOk) return "left";
  return null;
}

export type CardSideTipFixedPlacement = {
  left: number;
  top: number;
};

const TIP_GAP = 12;
const VIEWPORT_PAD = 12;
const MIN_CARD_GAP = 8;

/** Place tip fully in viewport without overlapping the card (or detail rail). */
export function placeCardSideTip(opts: {
  card: Pick<DOMRect, "left" | "right" | "top" | "bottom">;
  tipWidth: number;
  tipHeight: number;
  preferSide: CardSideTipHorizontal;
  viewportWidth: number;
  viewportHeight: number;
  rail?: Pick<DOMRect, "left" | "right" | "top" | "bottom"> | null;
}): CardSideTipFixedPlacement | null {
  const { card, tipWidth, tipHeight, preferSide, viewportWidth, viewportHeight, rail } = opts;
  if (tipWidth <= 0 || tipHeight <= 0) return null;

  const trySide = (side: CardSideTipHorizontal): CardSideTipFixedPlacement | null => {
    let left = side === "right"
      ? card.right + TIP_GAP
      : card.left - TIP_GAP - tipWidth;

    left = Math.min(
      Math.max(left, VIEWPORT_PAD),
      viewportWidth - VIEWPORT_PAD - tipWidth,
    );

    const tipRight = left + tipWidth;
    if (side === "left") {
      if (tipRight > card.left - MIN_CARD_GAP) return null;
    } else if (left < card.right + MIN_CARD_GAP) {
      return null;
    }

    if (rail && tipRight > rail.left - VIEWPORT_PAD && left < rail.right) {
      return null;
    }

    let top = card.top;
    const maxTop = viewportHeight - VIEWPORT_PAD - tipHeight;
    if (top > maxTop) top = Math.max(VIEWPORT_PAD, maxTop);
    if (top < VIEWPORT_PAD) top = VIEWPORT_PAD;
    if (top + tipHeight > viewportHeight - VIEWPORT_PAD) return null;

    return { left, top };
  };

  return trySide(preferSide) ?? trySide(preferSide === "left" ? "right" : "left");
}
