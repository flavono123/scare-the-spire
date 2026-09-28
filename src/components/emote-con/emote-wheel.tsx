"use client";

import Image from "@/components/ui/static-image";
import { GameUiHoverTip } from "@/components/game-ui-hover-tip";
import {
  EMOTE_CONS,
  EMOTE_WEDGE_SHADOW_SRC,
  EMOTE_WEDGE_SRC,
  emoteHitBox,
  emoteLabel,
  emoteShadowFrame,
  emoteSrc,
  emoteWedgeFrame,
  type EmoteId,
} from "@/lib/emote-con";
import { cn } from "@/lib/utils";

export function EmoteWheel({
  size,
  locale,
  onPick,
}: {
  size: number;
  locale: "ko" | "en";
  onPick: (id: EmoteId) => void;
}) {
  return (
    <div
      data-emote-wheel=""
      role="group"
      aria-label={locale === "en" ? "Emotes" : "감정콘"}
      className="relative mx-auto touch-manipulation"
      style={{ width: size, height: size }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-full bg-black/80">
        {EMOTE_CONS.map((emote, index) => {
          const frame = emoteWedgeFrame(index, size);
          if (!frame) return null;
          const shadow = emoteShadowFrame(emote.wedge, emote.shadow, size);
          return (
            <div
              key={emote.id}
              className="absolute"
              style={{
                left: frame.left,
                top: frame.top,
                width: frame.width,
                height: frame.height,
                transform: `rotate(${frame.rotation}deg)`,
                transformOrigin: "0 0",
              }}
            >
              <Image
                src={EMOTE_WEDGE_SHADOW_SRC}
                alt=""
                width={Math.round(shadow.width)}
                height={Math.round(shadow.height)}
                aria-hidden
                className="absolute object-contain opacity-40"
                style={{
                  left: shadow.left,
                  top: shadow.top,
                  width: shadow.width,
                  height: shadow.height,
                }}
              />
              <Image
                src={EMOTE_WEDGE_SRC}
                alt=""
                width={Math.round(frame.width)}
                height={Math.round(frame.height)}
                aria-hidden
                className="absolute inset-0 h-full w-full object-contain opacity-45"
              />
            </div>
          );
        })}
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black"
          style={{ width: size * 0.28, height: size * 0.28 }}
        />
      </div>

      {EMOTE_CONS.map((emote, index) => {
        const box = emoteHitBox(index, size);
        const label = emoteLabel(emote.id, locale);
        return (
          <div
            key={emote.id}
            className="absolute"
            style={{ left: box.left, top: box.top, width: box.size, height: box.size }}
          >
            <GameUiHoverTip label={label} delayMs={0} className="h-full w-full">
              <button
                type="button"
                data-emote-id={emote.id}
                aria-label={label}
                onClick={() => onPick(emote.id)}
                className={cn(
                  "flex items-center justify-center rounded-full",
                  "transition-transform hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#EFC851]",
                  "active:scale-95",
                )}
                style={{ width: box.size, height: box.size }}
              >
                <Image
                  src={emoteSrc(emote.id)}
                  alt=""
                  width={72}
                  height={72}
                  aria-hidden
                  className="pointer-events-none h-[62%] w-[62%] object-contain drop-shadow-[0_2px_1px_rgba(0,0,0,0.45)]"
                />
              </button>
            </GameUiHoverTip>
          </div>
        );
      })}
    </div>
  );
}
