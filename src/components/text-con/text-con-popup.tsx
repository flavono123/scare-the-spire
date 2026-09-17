"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { TextConPanel } from "@/components/text-con/text-con-panel";
import {
  DEFAULT_TEXTCON_BG,
  DEFAULT_TEXTCON_TEXT,
} from "@/lib/text-con";

export interface TextConPopupProps {
  open: boolean;
  anchor: DOMRect | null;
  triggerRef?: React.RefObject<HTMLElement | null>;
  onClose: () => void;
  onInsert: (data: { text: string; bgColor: string; textColor: string }) => void;
  initialText?: string;
  initialBgColor?: string;
  initialTextColor?: string;
  autoFocus?: boolean;
}

function popupPosition(anchor: DOMRect | null) {
  const width = 360;
  const height = 475;
  if (typeof window === "undefined" || !anchor) {
    return { left: 16, top: 16, width };
  }

  const viewW = window.innerWidth;
  const viewH = window.innerHeight;
  const actualWidth = Math.min(width, viewW - 16);

  // Preference: open ABOVE the anchor since comments/editors are near bottom
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

export function TextConPopup(props: TextConPopupProps) {
  if (!props.open) return null;
  return <TextConPopupInner {...props} />;
}

function TextConPopupInner({
  anchor,
  triggerRef,
  onClose,
  onInsert,
  initialText = "",
  initialBgColor = DEFAULT_TEXTCON_BG,
  initialTextColor = DEFAULT_TEXTCON_TEXT,
  autoFocus = true,
}: Omit<TextConPopupProps, "open">) {
  const panelRef = useRef<HTMLDivElement>(null);
  const pos = popupPosition(anchor);

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
      // Ignore scrolls occurring inside the popup itself
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
      aria-label="글자콘 만들기"
      data-text-con-popup=""
      className="fixed z-[85] flex flex-col rounded-xl border border-border/80 bg-zinc-950/98 p-3.5 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150 sm:p-4"
      style={{
        left: pos.left,
        top: pos.top,
        width: pos.width,
      }}
    >
      <TextConPanel
        onClose={onClose}
        onInsert={(data) => {
          onInsert(data);
          onClose();
        }}
        initialText={initialText}
        initialBgColor={initialBgColor}
        initialTextColor={initialTextColor}
        autoFocus={autoFocus}
      />
    </div>,
    document.body,
  );
}
