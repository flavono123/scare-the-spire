"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

/** Same hover_tip.png chrome as site-navbar patch notes / contact / profile. */
export const GAME_UI_HOVER_TIP_NAV_DELAY_MS = 0;

/** Above board rows, modals, and other overflow-clipped chrome. */
const TIP_Z_INDEX = 400;

export function GameUiHoverTip({
  label,
  delayMs = 350,
  className,
  children,
}: {
  label: string;
  delayMs?: number;
  children: ReactNode;
  className?: string;
}) {
  const triggerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [placement, setPlacement] = useState<{
    left: number;
    top: number;
    above: boolean;
  } | null>(null);
  const timerRef = useRef<number | null>(null);
  const portalRoot = typeof document !== "undefined" ? document.body : null;

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  const updatePlacement = () => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const estimatedHeight = 36;
    const spaceBelow = window.innerHeight - rect.bottom;
    const above = spaceBelow < estimatedHeight + 8 && rect.top > estimatedHeight + 8;
    setPlacement({
      left: rect.left + rect.width / 2,
      top: above ? rect.top - 4 : rect.bottom + 2,
      above,
    });
  };

  useLayoutEffect(() => {
    if (!visible) return;
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
      setVisible(true);
      return;
    }
    timerRef.current = window.setTimeout(() => setVisible(true), delayMs);
  };

  const hide = () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    setVisible(false);
  };

  const tip = visible && placement && portalRoot
    ? createPortal(
      <div
        className="pointer-events-none"
        style={{
          position: "fixed",
          left: placement.left,
          top: placement.top,
          transform: placement.above ? "translate(-50%, -100%)" : "translate(-50%, 0)",
          zIndex: TIP_Z_INDEX,
        }}
      >
        <div
          className="relative whitespace-nowrap"
          style={{
            borderImage: "url('/images/sts2/ui/hover_tip.png') 43 91 32 55 fill",
            borderImageWidth: "16px 34px 12px 20px",
            borderStyle: "solid",
            padding: "2px 12px 6px 8px",
          }}
        >
          <span
            className="text-xs font-bold"
            style={{
              color: "rgb(239, 200, 81)",
              textShadow: "2px 1px 0 rgba(0,0,0,0.25)",
            }}
          >
            {label}
          </span>
        </div>
      </div>,
      portalRoot,
    )
    : null;

  return (
    <div
      ref={triggerRef}
      className={cn("relative inline-flex", className)}
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      {children}
      {tip}
    </div>
  );
}
