"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Type, X } from "lucide-react";
import { ColorSwatchPicker } from "@/components/color-swatch-picker";
import { TextConChip } from "@/components/text-con/text-con-chip";
import {
  DEFAULT_TEXTCON_BG,
  DEFAULT_TEXTCON_TEXT,
  resolveTextConBg,
  TEXTCON_BG_COLORS,
  TEXTCON_MAX_CHARS,
  TEXTCON_TEXT_COLORS,
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
}: Omit<TextConPopupProps, "open">) {
  const [text, setText] = useState(initialText);
  const [bgColor, setBgColor] = useState(initialBgColor);
  const [textColor, setTextColor] = useState(initialTextColor);
  const panelRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const pos = popupPosition(anchor);

  useEffect(() => {
    textareaRef.current?.focus();
    textareaRef.current?.select();
  }, []);

  useEffect(() => {
    const onDoc = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (panelRef.current?.contains(target)) return;
      if (triggerRef?.current?.contains(target)) return;
      onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onClose);
    window.addEventListener("scroll", onClose, true);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onClose);
      window.removeEventListener("scroll", onClose, true);
    };
  }, [onClose, triggerRef]);

  const handleBgChange = (nextBg: string) => {
    setBgColor(nextBg);
    const resolved = resolveTextConBg(nextBg);
    setTextColor(resolved.defaultTextColor);
  };

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onInsert({
      text: trimmed,
      bgColor,
      textColor,
    });
    onClose();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      handleSubmit();
    }
  };

  const previewText = text.trim() || "슬서운\n이야기";

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label="글자콘 만들기"
      data-text-con-popup=""
      className="fixed z-[85] flex flex-col rounded-xl border border-border/80 bg-zinc-950/98 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150"
      style={{
        left: pos.left,
        top: pos.top,
        width: pos.width,
      }}
    >
      {/* Header bar matching DCInside textcon tab design */}
      <div className="flex shrink-0 items-center justify-between border-b border-border/70 px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
            <Type size={12} />
            <span>글자콘</span>
          </span>
          <span className="text-[11px] text-muted-foreground">
            글자로 글자콘을 만들어 등록해 보세요.
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X size={14} />
        </button>
      </div>

      {/* Body */}
      <div className="space-y-3.5 p-3.5 sm:p-4">
        {/* Large Preview Area */}
        <div className="flex min-h-[160px] items-center justify-center rounded-xl border border-white/10 bg-black/40 p-4">
          <TextConChip
            text={previewText}
            bgColor={bgColor}
            textColor={textColor}
            size="preview"
          />
        </div>

        {/* Color Selectors */}
        <div className="space-y-2.5 rounded-lg border border-border/50 bg-card/25 p-2.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="shrink-0 text-xs font-semibold text-muted-foreground">
              배경색
            </span>
            <ColorSwatchPicker
              items={TEXTCON_BG_COLORS}
              value={bgColor}
              onChange={handleBgChange}
              label="배경색 선택"
            />
          </div>

          <div className="flex items-center gap-2.5 border-t border-border/40 pt-2">
            <span className="shrink-0 text-xs font-semibold text-muted-foreground">
              글자색
            </span>
            <ColorSwatchPicker
              items={TEXTCON_TEXT_COLORS}
              value={textColor}
              onChange={setTextColor}
              label="글자색 선택"
            />
          </div>
        </div>

        {/* Text Input */}
        <div className="space-y-1">
          <div className="relative">
            <textarea
              ref={textareaRef}
              rows={2}
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, TEXTCON_MAX_CHARS))}
              onKeyDown={handleKeyDown}
              placeholder="슬서운&#10;이야기"
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
            <span className="absolute bottom-2 right-2 text-[10px] font-mono text-muted-foreground">
              {text.length}/{TEXTCON_MAX_CHARS}
            </span>
          </div>
        </div>

        {/* Action Button: centered prominent submit */}
        <div className="flex items-center justify-center pt-0.5">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!text.trim()}
            className="w-32 rounded-lg bg-primary py-2 text-xs font-bold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            등록
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
