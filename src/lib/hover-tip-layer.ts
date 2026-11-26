/**
 * Global stacking for game hover tips (keywords, assets, card side tips).
 * Keep `HOVER_TIP_LAYER_Z_INDEX` in sync with `--z-hover-tip` in globals.css.
 */
export const HOVER_TIP_LAYER_ID = "hover-tip-root";
export const HOVER_TIP_LAYER_Z_INDEX = 10050;

export type HoverTipPin = "top-left" | "bottom-left" | "center-right";

export function getHoverTipPortalRoot(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  return document.getElementById(HOVER_TIP_LAYER_ID) ?? document.body;
}

export function triggerRectFromAnchor(anchor: HTMLElement | null): DOMRect | null {
  let el: HTMLElement | null = anchor;
  while (el) {
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 || rect.height > 0) return rect;
    el = el.parentElement;
  }
  return null;
}

export function clampHoverTipPosition(input: {
  left: number;
  top: number;
  width: number;
  height: number;
  viewportWidth: number;
  viewportHeight: number;
  margin?: number;
}): { left: number; top: number } {
  const margin = input.margin ?? 8;
  const maxLeft = Math.max(margin, input.viewportWidth - input.width - margin);
  const maxTop = Math.max(margin, input.viewportHeight - input.height - margin);
  return {
    left: Math.min(Math.max(input.left, margin), maxLeft),
    top: Math.min(Math.max(input.top, margin), maxTop),
  };
}

/**
 * The area an element actually paints: its box plus every descendant that draws outside it
 * (card frames, banners and energy orbs overflow their CardTile box). Place by this, not the box.
 */
export function drawnRect(el: Element): DOMRect {
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const node of [el, ...el.querySelectorAll("*")]) {
    const r = node.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    left = Math.min(left, r.left);
    top = Math.min(top, r.top);
    right = Math.max(right, r.right);
    bottom = Math.max(bottom, r.bottom);
  }
  return left === Infinity ? el.getBoundingClientRect() : new DOMRect(left, top, right - left, bottom - top);
}

type Box = Pick<DOMRect, "left" | "top" | "right" | "bottom"> & Partial<DOMRect>;
export type HoverTipSide = "below" | "above" | "right" | "left";

function overlaps(a: Box, b: Box): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

/**
 * A tip position beside its trigger: the first side in `order` where the tip fits the viewport
 * without touching the trigger (closer than `gap`). If none fits, the side that leaves the most of it in view.
 */
export function placeBesideTrigger(input: {
  trigger: Box;
  tipWidth: number;
  tipHeight: number;
  order: readonly HoverTipSide[];
  align?: "start" | "center";
  viewportWidth: number;
  viewportHeight: number;
  gap?: number;
  margin?: number;
}): { left: number; top: number } {
  const { trigger, order, viewportWidth: vw, viewportHeight: vh } = input;
  const gap = input.gap ?? 8;
  const margin = input.margin ?? 8;
  const width = Math.max(0, input.tipWidth);
  const height = Math.max(0, input.tipHeight);
  const clampX = (x: number) => Math.min(Math.max(x, margin), Math.max(margin, vw - width - margin));
  const clampY = (y: number) => Math.min(Math.max(y, margin), Math.max(margin, vh - height - margin));
  const alongX = input.align === "center" ? trigger.left + (trigger.right - trigger.left) / 2 - width / 2 : trigger.left;
  const alongY = input.align === "center" ? trigger.top + (trigger.bottom - trigger.top) / 2 - height / 2 : trigger.top;
  const candidate = (side: HoverTipSide) => {
    if (side === "below") return { left: clampX(alongX), top: trigger.bottom + gap };
    if (side === "above") return { left: clampX(alongX), top: trigger.top - gap - height };
    if (side === "right") return { left: trigger.right + gap, top: clampY(alongY) };
    return { left: trigger.left - gap - width, top: clampY(alongY) };
  };
  const padded = { left: trigger.left - gap + 1, top: trigger.top - gap + 1, right: trigger.right + gap - 1, bottom: trigger.bottom + gap - 1 };
  let best: { left: number; top: number } | null = null;
  let bestVisible = -1;
  for (const side of order) {
    const pos = candidate(side);
    const box = { left: pos.left, top: pos.top, right: pos.left + width, bottom: pos.top + height };
    const inView = box.left >= margin - 0.5 && box.top >= margin - 0.5 && box.right <= vw - margin + 0.5 && box.bottom <= vh - margin + 0.5;
    if (inView && !overlaps(box, padded)) return pos;
    const visible = Math.max(0, Math.min(box.right, vw) - Math.max(box.left, 0)) * Math.max(0, Math.min(box.bottom, vh) - Math.max(box.top, 0));
    if (!overlaps(box, padded) && visible > bestVisible) {
      best = pos;
      bestVisible = visible;
    }
  }
  return best ?? clampHoverTipPosition({ ...candidate(order[0]), width, height, viewportWidth: vw, viewportHeight: vh, margin });
}

/** Pin a portaled tip next to its trigger; it never covers the trigger (see placeBesideTrigger). */
export function placePortaledHoverTip(input: {
  trigger: Box;
  tipWidth: number;
  tipHeight: number;
  pin: HoverTipPin;
  viewportWidth: number;
  viewportHeight: number;
  gap?: number;
  margin?: number;
}): { left: number; top: number } {
  const order: Record<HoverTipPin, readonly HoverTipSide[]> = {
    "top-left": ["below", "above", "right", "left"],
    "bottom-left": ["above", "below", "right", "left"],
    "center-right": ["right", "left", "below", "above"],
  };
  return placeBesideTrigger({ ...input, order: order[input.pin], align: input.pin === "center-right" ? "center" : "start" });
}
