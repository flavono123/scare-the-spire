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

export function placePortaledHoverTip(input: {
  trigger: DOMRect;
  tipWidth: number;
  tipHeight: number;
  pin: HoverTipPin;
  viewportWidth: number;
  viewportHeight: number;
  gap?: number;
  margin?: number;
}): { left: number; top: number } {
  const gap = input.gap ?? 8;
  const margin = input.margin ?? 8;
  const vw = input.viewportWidth;
  const vh = input.viewportHeight;
  const width = Math.max(0, input.tipWidth);
  const height = Math.max(0, input.tipHeight);

  let left: number;
  let top: number;

  if (input.pin === "bottom-left") {
    left = input.trigger.left;
    top = input.trigger.top - height - gap;
    if (height > 0 && top < margin) {
      top = input.trigger.bottom + gap;
    }
  } else if (input.pin === "center-right") {
    left = input.trigger.right + gap;
    top = input.trigger.top + input.trigger.height / 2 - height / 2;
  } else {
    left = input.trigger.left;
    top = input.trigger.bottom + gap;
    if (height > 0 && top + height > vh - margin) {
      top = input.trigger.top - height - gap;
    }
  }

  if (width > 0 && left + width > vw - margin) {
    left = input.trigger.right - width;
  }

  return clampHoverTipPosition({
    left,
    top,
    width,
    height,
    viewportWidth: vw,
    viewportHeight: vh,
    margin,
  });
}
