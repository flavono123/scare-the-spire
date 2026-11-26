"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import {
  HOVER_TIP_BODY_COLOR,
  HOVER_TIP_SLICE,
  HOVER_TIP_SRC,
  HOVER_TIP_TITLE_COLOR,
} from "@/lib/hover-tip-chrome";
import {
  drawnRect,
  getHoverTipPortalRoot,
  HOVER_TIP_LAYER_Z_INDEX,
  placeBesideTrigger,
} from "@/lib/hover-tip-layer";

/** Same hover_tip.png chrome as site-navbar patch notes / contact / profile. */
export const GAME_UI_HOVER_TIP_NAV_DELAY_MS = 0;

export function GameUiHoverTip({
  label,
  delayMs = 350,
  className,
  children,
  open = false,
}: {
  label: ReactNode;
  delayMs?: number;
  children: ReactNode;
  className?: string;
  /** Keep the tip visible, e.g. after a click on a blocked control. */
  open?: boolean;
}) {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  const visible = open || hovered;
  const [placement, setPlacement] = useState<{ left: number; top: number } | null>(null);
  const timerRef = useRef<number | null>(null);
  const portalRoot = typeof document !== "undefined" ? getHoverTipPortalRoot() : null;

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  // Measure the rendered tip and put it below (or above, or beside) the trigger, never over it.
  const updatePlacement = () => {
    const el = triggerRef.current;
    const tip = tipRef.current;
    if (!el || !tip) return;
    const tipBox = tip.getBoundingClientRect();
    const tipDrawn = drawnRect(tip);
    const next = placeBesideTrigger({
      trigger: drawnRect(el),
      tipWidth: tipDrawn.width,
      tipHeight: tipDrawn.height,
      order: ["below", "above", "right", "left"],
      align: "center",
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      gap: 4,
    });
    const left = next.left + (tipBox.left - tipDrawn.left);
    const top = next.top + (tipBox.top - tipDrawn.top);
    setPlacement((prev) => (prev && prev.left === left && prev.top === top ? prev : { left, top }));
  };

  useLayoutEffect(() => {
    if (!visible) {
      setPlacement(null);
      return;
    }
    updatePlacement();
    const onReposition = () => updatePlacement();
    window.addEventListener("scroll", onReposition, true);
    window.addEventListener("resize", onReposition);
    return () => {
      window.removeEventListener("scroll", onReposition, true);
      window.removeEventListener("resize", onReposition);
    };
  }, [visible, label]);

  const show = () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    if (delayMs <= 0) {
      setHovered(true);
      return;
    }
    timerRef.current = window.setTimeout(() => setHovered(true), delayMs);
  };

  const hide = () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    setHovered(false);
  };

  const wrapLabel = typeof label !== "string" || label.length > 24;
  const tip = visible && portalRoot
    ? createPortal(
      <div
        ref={tipRef}
        data-hover-tip-layer=""
        className="pointer-events-none dark"
        style={{
          position: "fixed",
          left: placement?.left ?? 0,
          top: placement?.top ?? 0,
          visibility: placement ? "visible" : "hidden",
          zIndex: HOVER_TIP_LAYER_Z_INDEX,
        }}
      >
        <div
          className={cn(
            "relative text-xs font-bold",
            wrapLabel
              ? "max-w-[22rem] whitespace-normal break-keep leading-snug"
              : "whitespace-nowrap",
          )}
          style={{
            borderImage: `url('${HOVER_TIP_SRC.default}') ${HOVER_TIP_SLICE.top} ${HOVER_TIP_SLICE.right} ${HOVER_TIP_SLICE.bottom} ${HOVER_TIP_SLICE.left} fill`,
            borderImageWidth: "16px 34px 12px 20px",
            borderStyle: "solid",
            padding: "2px 12px 6px 8px",
            color: typeof label === "string" ? HOVER_TIP_TITLE_COLOR : HOVER_TIP_BODY_COLOR,
            textShadow: "2px 1px 0 rgba(0,0,0,0.25)",
          }}
        >
          {label}
        </div>
      </div>,
      portalRoot,
    )
    : null;

  return (
    <span
      ref={triggerRef}
      data-hover-trigger=""
      className={cn("relative inline-flex", className)}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {tip}
    </span>
  );
}
