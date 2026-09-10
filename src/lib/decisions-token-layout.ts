import { CARD_ASPECT, CARD_ASPECT_H, CARD_ASPECT_W } from "@/lib/sts2-card-style";

/**
 * Tiermaker (measured 2026-09-10, Defect cards template at 375×812):
 *   portrait 80×120, square 80×80, label column 101px, ranked gutter 252px
 *   → 3 portraits per wrap. Those portraits are cropped art, not full cards.
 *
 * 어려운 결정 paints a full STS CardTile (`300/422`). A 72×101 tile in the
 * same ~295px gutter is also 3-wide, so a 26-card row is ~1.3 viewports.
 * Packed layout targets **6 full cards per wrap** via container `cqw`:
 *   card = clamp(36px, (100cqw − label − 2·pad − 5·gap) / 6, 72px)
 * On a 375px page (`px-4` → 343px board) that is ~45.5×64, ~6-wide.
 * Comfortable cap is the original 72px tile; `@xl` (~576px) only widens
 * the label column and token gap.
 *
 * Put `DECISIONS_BOARD_CONTAINER_CLASS` on the board and
 * `DECISIONS_BOARD_TOKEN_VARS_CLASS` on a child so `@xl` / `cqw` query
 * this board, not the viewport (lab iframes, index cards, 조각모음 embeds).
 */
export const DECISIONS_DECISIONS_CARD_WIDTH = 72;
export const DECISIONS_TOKEN_PACKED_COLUMNS = 6;
export const DECISIONS_TOKEN_MIN_CARD_WIDTH = 36;
export const DECISIONS_TOKEN_PACKED_GAP = 2;
export const DECISIONS_TOKEN_PACKED_LABEL_WIDTH = 48;
export const DECISIONS_TOKEN_PACKED_PAD = 6;
export const DECISIONS_TOKEN_PACKED_ICON_SIZE = 28;
export const DECISIONS_TOKEN_PACKED_MONSTER_SIZE = 32;
export const DECISIONS_TOKEN_COMFORTABLE_ICON_SIZE = 40;
export const DECISIONS_TOKEN_COMFORTABLE_MONSTER_SIZE = 48;
export const DECISIONS_TOKEN_COMFORTABLE_GAP = 4;
export const DECISIONS_TOKEN_COMFORTABLE_LABEL_WIDTH = 64;
export const DECISIONS_TOKEN_COMFORTABLE_PAD = 8;
export const DECISIONS_TOKEN_CARD_ASPECT = CARD_ASPECT;
/** 375 viewport minus Toy Box `px-4` shell. */
export const DECISIONS_TOKEN_REFERENCE_BOARD_WIDTH = 343;

export const DECISIONS_BOARD_CONTAINER_CLASS = "@container";
export const DECISIONS_BOARD_TOKEN_VARS_CLASS = [
  "[--dd-label:48px] [--dd-pad:6px] [--dd-gap:2px]",
  "[--dd-card:clamp(36px,calc((100cqw-var(--dd-label)-(2*var(--dd-pad))-(5*var(--dd-gap)))/6),72px)]",
  "[--dd-icon:clamp(28px,calc(var(--dd-card)*40/72),40px)]",
  "[--dd-monster:clamp(32px,calc(var(--dd-card)*48/72),48px)]",
  "@xl:[--dd-label:64px] @xl:[--dd-pad:8px] @xl:[--dd-gap:4px]",
].join(" ");

export function decisionsCardHeight(width: number): number {
  return Math.round((width * CARD_ASPECT_H) / CARD_ASPECT_W);
}

export function decisionsTokenGutter(
  boardWidth: number,
  labelWidth: number,
  pad: number,
): number {
  return Math.max(0, boardWidth - labelWidth - 2 * pad);
}

export function decisionsFluidCardWidth(
  boardWidth: number,
  packed = true,
): number {
  const label = packed
    ? DECISIONS_TOKEN_PACKED_LABEL_WIDTH
    : DECISIONS_TOKEN_COMFORTABLE_LABEL_WIDTH;
  const pad = packed ? DECISIONS_TOKEN_PACKED_PAD : DECISIONS_TOKEN_COMFORTABLE_PAD;
  const gap = packed ? DECISIONS_TOKEN_PACKED_GAP : DECISIONS_TOKEN_COMFORTABLE_GAP;
  const raw = (
    boardWidth - label - 2 * pad - (DECISIONS_TOKEN_PACKED_COLUMNS - 1) * gap
  ) / DECISIONS_TOKEN_PACKED_COLUMNS;
  return Math.min(
    DECISIONS_DECISIONS_CARD_WIDTH,
    Math.max(DECISIONS_TOKEN_MIN_CARD_WIDTH, raw),
  );
}

export function decisionsCardsPerRow(
  tokenGutterPx: number,
  cardWidth: number,
  gap: number,
): number {
  if (cardWidth <= 0) return 0;
  return Math.max(1, Math.floor((tokenGutterPx + gap) / (cardWidth + gap)));
}

export const DECISIONS_TOKEN_PACKED_CARD_WIDTH = decisionsFluidCardWidth(
  DECISIONS_TOKEN_REFERENCE_BOARD_WIDTH,
);
