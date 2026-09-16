"use client";

import { useEffect, useRef, useState } from "react";
import { ServiceModalFrame } from "@/components/service-modal-frame";
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

export interface TextConModalProps {
  open: boolean;
  onClose: () => void;
  onInsert: (data: { text: string; bgColor: string; textColor: string }) => void;
  initialText?: string;
  initialBgColor?: string;
  initialTextColor?: string;
}

export function TextConModal({
  open,
  onClose,
  onInsert,
  initialText = "",
  initialBgColor = DEFAULT_TEXTCON_BG,
  initialTextColor = DEFAULT_TEXTCON_TEXT,
}: TextConModalProps) {
  const [text, setText] = useState(initialText);
  const [bgColor, setBgColor] = useState(initialBgColor);
  const [textColor, setTextColor] = useState(initialTextColor);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setText(initialText);
      setBgColor(initialBgColor);
      setTextColor(initialTextColor);
      window.setTimeout(() => {
        textareaRef.current?.focus();
        textareaRef.current?.select();
      }, 50);
    }
  }, [open, initialText, initialBgColor, initialTextColor]);

  if (!open) return null;

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

  return (
    <ServiceModalFrame
      title={
        <div className="flex items-baseline gap-2">
          <span className="font-game-title font-bold text-base text-foreground">글자콘</span>
          <span className="text-xs text-muted-foreground">글자로 글자콘을 만들어 등록해 보세요.</span>
        </div>
      }
      titleId="text-con-modal-title"
      closeLabel="닫기"
      onClose={onClose}
      panelClassName="max-w-md w-full sm:mx-auto"
      bodyClassName="p-4 sm:p-5 space-y-4"
    >
      <div className="space-y-4 p-4 sm:p-5">
        {/* Large Preview Area */}
        <div className="flex min-h-[160px] sm:min-h-[190px] items-center justify-center rounded-xl border border-border/60 bg-muted/15 p-4">
          <TextConChip
            text={previewText}
            bgColor={bgColor}
            textColor={textColor}
            size="preview"
          />
        </div>

        {/* Color Selectors */}
        <div className="space-y-3 rounded-lg border border-border/50 bg-card/20 p-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="shrink-0 text-xs font-semibold text-muted-foreground">배경색</span>
            <ColorSwatchPicker
              items={TEXTCON_BG_COLORS}
              value={bgColor}
              onChange={handleBgChange}
              label="배경색 선택"
            />
          </div>

          <div className="flex items-center gap-3 border-t border-border/40 pt-2.5">
            <span className="shrink-0 text-xs font-semibold text-muted-foreground">글자색</span>
            <ColorSwatchPicker
              items={TEXTCON_TEXT_COLORS}
              value={textColor}
              onChange={setTextColor}
              label="글자색 선택"
            />
          </div>
        </div>

        {/* Text Input */}
        <div className="space-y-1.5">
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
          <p className="text-[11px] text-muted-foreground">줄바꿈을 넣어 2~3줄로 작성하면 예쁘게 표현됩니다.</p>
        </div>

        {/* Action Button */}
        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!text.trim()}
            className="rounded-lg bg-primary px-6 py-2 text-xs font-bold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            등록
          </button>
        </div>
      </div>
    </ServiceModalFrame>
  );
}
