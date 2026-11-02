export type MerchantLineKind = "success" | "failure";

/** NMerchantSlot.WiggleAnimation: two sine cycles of 10 units over 0.4 s, quad ease-out. */
const WIGGLE_DURATION_MS = 400;
const WIGGLE_AMPLITUDE_PX = 10;
const WIGGLE_SAMPLES = 16;
const WIGGLE_EASING = "cubic-bezier(0.25, 0.46, 0.45, 0.94)";

export function playPurchaseFailedWiggle(element: HTMLElement): void {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const keyframes = Array.from({ length: WIGGLE_SAMPLES + 1 }, (_, index) => {
    const progress = (index / WIGGLE_SAMPLES) * 2;
    const offset = Math.sin(progress * Math.PI * 2) * WIGGLE_AMPLITUDE_PX;
    return { transform: `translateX(${offset.toFixed(2)}px)` };
  });
  element.animate(keyframes, { duration: WIGGLE_DURATION_MS, easing: WIGGLE_EASING });
}
