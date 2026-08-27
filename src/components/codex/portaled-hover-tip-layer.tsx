"use client";

import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  getHoverTipPortalRoot,
  HOVER_TIP_LAYER_Z_INDEX,
  placePortaledHoverTip,
  triggerRectFromAnchor,
  type HoverTipPin,
} from "@/lib/hover-tip-layer";

export { HOVER_TIP_LAYER_Z_INDEX };
export type { HoverTipPin };

/**
 * Escape overflow/stacking by painting into `#hover-tip-root`.
 * Measures the nearest sized ancestor as the trigger, then clamps to the viewport.
 */
export function PortaledHoverTipLayer({
  children,
  pin = "top-left",
  interactive = false,
}: {
  children: ReactNode;
  pin?: HoverTipPin;
  /** Allow clicks (mobile tap previews). The global layer is pointer-events: none. */
  interactive?: boolean;
}) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [box, setBox] = useState<{ left: number; top: number } | null>(null);
  const portalRoot = mounted ? getHoverTipPortalRoot() : null;

  const updateBox = useCallback(() => {
    const trigger = triggerRectFromAnchor(anchorRef.current);
    const tip = tipRef.current;
    if (!trigger) return;
    setBox((prev) => {
      const next = placePortaledHoverTip({
        trigger,
        tipWidth: tip?.offsetWidth ?? 0,
        tipHeight: tip?.offsetHeight ?? 0,
        pin,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      });
      if (prev && prev.left === next.left && prev.top === next.top) return prev;
      return next;
    });
  }, [pin]);

  useLayoutEffect(() => {
    if (!mounted) return;
    updateBox();
    const raf = requestAnimationFrame(updateBox);
    const tip = tipRef.current;
    const observer = tip && typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(() => updateBox())
      : null;
    if (tip) observer?.observe(tip);
    return () => {
      cancelAnimationFrame(raf);
      observer?.disconnect();
    };
  }, [mounted, children, updateBox]);

  useLayoutEffect(() => {
    if (!mounted) return;
    window.addEventListener("resize", updateBox);
    window.addEventListener("scroll", updateBox, true);
    return () => {
      window.removeEventListener("resize", updateBox);
      window.removeEventListener("scroll", updateBox, true);
    };
  }, [mounted, updateBox]);

  const portal = mounted && portalRoot
    ? createPortal(
      <div
        ref={tipRef}
        data-hover-tip-layer=""
        className={interactive ? "pointer-events-auto" : "pointer-events-none"}
        style={{
          position: "fixed",
          left: box?.left ?? 0,
          top: box?.top ?? 0,
          visibility: box ? "visible" : "hidden",
          zIndex: HOVER_TIP_LAYER_Z_INDEX,
        }}
      >
        {children}
      </div>,
      portalRoot,
    )
    : null;

  return (
    <>
      <span
        ref={anchorRef}
        className="pointer-events-none absolute inset-0"
        aria-hidden
      />
      {portal}
    </>
  );
}
