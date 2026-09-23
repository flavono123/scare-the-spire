"use client";

import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

export function anchoredConPopupPosition(
  anchor: DOMRect | null,
  width: number,
  height: number,
) {
  if (typeof window === "undefined" || !anchor) {
    return { left: 16, top: 16, width: Math.min(width, 360) };
  }

  const viewW = window.innerWidth;
  const viewH = window.innerHeight;
  const actualWidth = Math.min(width, viewW - 16);

  const fitsAbove = anchor.top >= height + 10;
  const fitsBelow = viewH - anchor.bottom >= height + 10;

  let top: number;
  if (fitsAbove) {
    top = anchor.top - height - 8;
  } else if (fitsBelow) {
    top = anchor.bottom + 8;
  } else {
    const spaceAbove = anchor.top;
    const spaceBelow = viewH - anchor.bottom;
    if (spaceAbove >= spaceBelow) {
      top = Math.max(8, anchor.top - height - 8);
    } else {
      top = Math.min(viewH - height - 8, anchor.bottom + 8);
    }
  }

  let left = anchor.left;
  if (left + actualWidth > viewW - 8) {
    left = Math.max(8, viewW - actualWidth - 8);
  }
  if (left < 8) left = 8;

  return { left, top, width: actualWidth };
}

export function AnchoredConPopup({
  anchor,
  triggerRef,
  onClose,
  ariaLabel,
  dataAttribute,
  width,
  height,
  children,
}: {
  anchor: DOMRect | null;
  triggerRef?: RefObject<HTMLElement | null>;
  onClose: () => void;
  ariaLabel: string;
  dataAttribute: string;
  width: number;
  height: number;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const pos = anchoredConPopupPosition(anchor, width, height);

  useEffect(() => {
    const onDoc = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (panelRef.current?.contains(target)) return;
      if (triggerRef?.current?.contains(target)) return;
      onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const onScroll = (event: Event) => {
      if (panelRef.current?.contains(event.target as Node)) return;
      onClose();
    };

    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc, { passive: true });
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onClose);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("touchstart", onDoc);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onClose);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [onClose, triggerRef]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label={ariaLabel}
      {...{ [dataAttribute]: "" }}
      className="fixed z-[85] flex flex-col rounded-xl border border-border/80 bg-zinc-950/98 p-3.5 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150 sm:p-4"
      style={{
        left: pos.left,
        top: pos.top,
        width: pos.width,
      }}
    >
      {children}
    </div>,
    document.body,
  );
}
