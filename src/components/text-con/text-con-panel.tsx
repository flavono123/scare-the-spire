"use client";

import { useEffect, useRef, useState } from "react";
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
import { cn } from "@/lib/utils";

export interface TextConPanelProps {
  onClose: () => void;
  onInsert: (data: { text: string; bgColor: string; textColor: string }) => void;
  initialText?: string;
  initialBgColor?: string;
  initialTextColor?: string;
  autoFocus?: boolean;
  className?: string;
  showHeader?: boolean;
}

export function TextConPanel({
  onClose,
  onInsert,
  initialText = "",
  initialBgColor = DEFAULT_TEXTCON_BG,
  initialTextColor = DEFAULT_TEXTCON_TEXT,
  autoFocus = false,
  className,
  showHeader = true,
}: TextConPanelProps) {
  const [text, setText] = useState(initialText);
  const [bgColor, setBgColor] = useState(initialBgColor);
  const [textColor, setTextColor] = useState(initialTextColor);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (autoFocus) {
      textareaRef.current?.focus();
      textareaRef.current?.select();
    }
  }, [autoFocus]);

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
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      handleSubmit();
    }
  };

  const previewText = text;

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Header bar matching DCInside textcon tab design */}
      {showHeader && (
        <div className="flex shrink-0 items-center justify-between border-b border-border/70 pb-2.5">
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
      )}

      {/* Body */}
      <div className={cn("space-y-3.5", showHeader ? "pt-3.5" : "")}>
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
    </div>
  );
}
