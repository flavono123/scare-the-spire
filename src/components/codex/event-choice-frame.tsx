"use client";

import { useCallback, type CSSProperties, type ReactNode } from "react";

const GAME_CHOICE_TEXT_SHADOW = "3px 2px 0 rgba(0,0,0,0.25)";
const GAME_CHOICE_FRAME_STYLE: CSSProperties = {
  borderStyle: "solid",
  borderWidth: "20px 54px",
  borderImageSource: "url('/images/sts2/ui/event_button.png')",
  borderImageSlice: "50 58 50 58 fill",
  borderImageRepeat: "stretch",
};
const GAME_CHOICE_GLOW_STYLE: CSSProperties = {
  ...GAME_CHOICE_FRAME_STYLE,
  filter: "brightness(1.35) saturate(1.15)",
};

interface GameChoiceFrameProps<TPreview> {
  active?: boolean;
  children: ReactNode;
  onClick?: () => void;
  onPreviewChange?: (preview: TPreview | null) => void;
  preview?: TPreview | null;
}

export function GameChoiceFrame<TPreview = unknown>({
  active = false,
  children,
  onClick,
  onPreviewChange,
  preview,
}: GameChoiceFrameProps<TPreview>) {
  const interactive = Boolean(onClick);
  const showPreview = useCallback(() => {
    if (preview) onPreviewChange?.(preview);
  }, [onPreviewChange, preview]);
  const hidePreview = useCallback(() => {
    if (preview) onPreviewChange?.(null);
  }, [onPreviewChange, preview]);
  const className = `group relative block min-h-[74px] w-full overflow-visible border-0 bg-transparent p-0 text-left transition-transform duration-150 ${
    interactive ? "cursor-pointer hover:-translate-y-0.5 focus-visible:outline-none" : ""
  }`;
  const content = (
    <>
      <span
        className="pointer-events-none absolute bottom-0 left-[22px] right-0 top-0 translate-x-1 translate-y-1 opacity-35 brightness-50"
        style={GAME_CHOICE_FRAME_STYLE}
        aria-hidden
      />
      <span
        className="pointer-events-none absolute bottom-0 left-[22px] right-0 top-0 opacity-95"
        style={GAME_CHOICE_FRAME_STYLE}
        aria-hidden
      />
      <span
        className={`pointer-events-none absolute -bottom-0.5 left-[20px] right-[-2px] -top-0.5 mix-blend-screen blur-[1px] transition-opacity duration-150 group-hover:opacity-70 group-focus-visible:opacity-80 ${
          active ? "opacity-80" : "opacity-0"
        }`}
        style={GAME_CHOICE_GLOW_STYLE}
        aria-hidden
      />
      {(interactive || active) && (
        <span
          className={`pointer-events-none absolute left-0 top-1/2 h-0 w-0 -translate-y-1/2 border-y-[18px] border-l-[28px] border-y-transparent border-l-[#f1d06b] drop-shadow-[2px_2px_0_rgba(0,0,0,0.55)] transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 ${
            active ? "opacity-100" : "opacity-0"
          }`}
          aria-hidden
        />
      )}
      <div
        className="relative ml-[22px] flex min-h-[74px] flex-col justify-center break-keep px-[42px] py-[10px] pr-[46px]"
        style={{ textShadow: GAME_CHOICE_TEXT_SHADOW }}
      >
        {children}
      </div>
    </>
  );

  if (interactive) {
    return (
      <button
        type="button"
        onClick={onClick}
        onBlur={hidePreview}
        onFocus={showPreview}
        onMouseEnter={showPreview}
        onMouseLeave={hidePreview}
        className={className}
      >
        {content}
      </button>
    );
  }

  return (
    <div
      className={className}
      onMouseEnter={showPreview}
      onMouseLeave={hidePreview}
    >
      {content}
    </div>
  );
}
