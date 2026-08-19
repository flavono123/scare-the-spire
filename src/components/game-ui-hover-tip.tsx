"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Same hover_tip.png chrome as site-navbar patch notes / contact / profile. */
export const GAME_UI_HOVER_TIP_NAV_DELAY_MS = 0;

export function GameUiHoverTip({
  label,
  delayMs = 350,
  className,
  children,
}: {
  label: string;
  delayMs?: number;
  className?: string;
  children: ReactNode;
}) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div
      className={cn("relative inline-flex", className)}
      onMouseEnter={() => {
        if (timerRef.current !== null) window.clearTimeout(timerRef.current);
        if (delayMs <= 0) {
          setVisible(true);
          return;
        }
        timerRef.current = window.setTimeout(() => setVisible(true), delayMs);
      }}
      onMouseLeave={() => {
        if (timerRef.current !== null) window.clearTimeout(timerRef.current);
        timerRef.current = null;
        setVisible(false);
      }}
    >
      {children}
      {visible && (
        <div className="pointer-events-none absolute left-1/2 top-full z-50 mt-0.5 -translate-x-1/2">
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
        </div>
      )}
    </div>
  );
}
