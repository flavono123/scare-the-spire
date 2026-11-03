"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { RichText } from "@/components/rich-text";
import Image from "@/components/ui/static-image";
import { styleVakuuLine, vakuuSpeechMs, VakuuSpeaker, type VakuuUtterance } from "@/lib/vakuu-chatter";

const BUBBLE_WIDTH_PX = 230;
const BUBBLE_HEIGHT_PX = 156;
const BUBBLE_GUTTER_PX = 8;
/** The speech bubble's tail sits this far along its width; a right-side bubble is flipped. */
const BUBBLE_TAIL_SHARE = 0.2;
/** NSpeechBubbleVfx fades out over 0.4 s. */
const FADE_OUT_MS = 400;

type Side = "left" | "right";

type VakuuBubble = {
  id: number;
  line: string;
  side: Side;
  left: number;
  top: number;
  holdMs: number;
};

export type VakuuSpeak = (
  utterance: VakuuUtterance,
  anchor: HTMLElement | null,
  options?: { corner?: boolean },
) => void;

const VakuuChatterContext = createContext<VakuuSpeak>(() => {});

export function useVakuu(): VakuuSpeak {
  return useContext(VakuuChatterContext);
}

/** Bubble spot above an anchor, or above one of its top corners for remarks about nothing in particular. */
function placeBubble(anchor: HTMLElement, corner: boolean): Pick<VakuuBubble, "side" | "left" | "top"> {
  const rect = anchor.getBoundingClientRect();
  const pointX = corner
    ? (Math.random() < 0.5 ? rect.left + BUBBLE_WIDTH_PX * 0.35 : rect.right - BUBBLE_WIDTH_PX * 0.35)
    : rect.left + rect.width / 2;
  const side: Side = pointX > window.innerWidth / 2 ? "right" : "left";
  const tailX = side === "left" ? BUBBLE_WIDTH_PX * BUBBLE_TAIL_SHARE : BUBBLE_WIDTH_PX * (1 - BUBBLE_TAIL_SHARE);
  const left = Math.min(
    Math.max(BUBBLE_GUTTER_PX, pointX - tailX),
    window.innerWidth - BUBBLE_WIDTH_PX - BUBBLE_GUTTER_PX,
  );
  const top = Math.max(BUBBLE_GUTTER_PX, rect.top - BUBBLE_HEIGHT_PX + 6);
  return { side, left, top };
}

export function VakuuChatterProvider({ name, children }: { name: string; children: ReactNode }) {
  const speaker = useRef(new VakuuSpeaker());
  const [bubble, setBubble] = useState<VakuuBubble | null>(null);
  const [leaving, setLeaving] = useState(false);
  const nextId = useRef(0);
  const timers = useRef<number[]>([]);

  const clearTimers = () => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
  };

  const speak = useCallback<VakuuSpeak>((utterance, anchor, options) => {
    if (!anchor || !anchor.isConnected) return;
    const line = speaker.current.pick(utterance, performance.now());
    if (!line) return;
    const holdMs = vakuuSpeechMs(line);
    nextId.current += 1;
    clearTimers();
    setLeaving(false);
    setBubble({ id: nextId.current, line: styleVakuuLine(line), holdMs, ...placeBubble(anchor, Boolean(options?.corner)) });
    // 0.4 s in, the hold, then 0.4 s out.
    timers.current.push(window.setTimeout(() => setLeaving(true), 400 + holdMs));
    timers.current.push(window.setTimeout(() => setBubble(null), 400 + holdMs + FADE_OUT_MS));
  }, []);

  useEffect(() => clearTimers, []);

  return (
    <VakuuChatterContext.Provider value={speak}>
      {children}
      {bubble && createPortal(
        <div
          key={bubble.id}
          role="status"
          aria-label={name}
          data-vakuu-bubble={bubble.side}
          className={`vakuu-bubble pointer-events-none fixed z-[905] ${leaving ? "vakuu-bubble-leaving" : ""}`}
          style={{ left: bubble.left, top: bubble.top, width: BUBBLE_WIDTH_PX, height: BUBBLE_HEIGHT_PX }}
        >
          <div className={`vakuu-bubble-box relative h-full w-full ${bubble.side === "right" ? "vakuu-bubble-right" : ""}`}>
            {/* NSpeechBubbleVfx flips the sprite for a right-side speaker; the grow animation owns the sprite's transform. */}
            <div className={`absolute inset-0 ${bubble.side === "right" ? "-scale-x-100" : ""}`}>
              <Image
                src="/images/sts2/ui/speech_bubble3_purple.webp"
                alt=""
                width={420}
                height={285}
                className="vakuu-bubble-sprite h-full w-full object-contain"
              />
            </div>
            <p className="vakuu-bubble-text absolute inset-x-5 top-4 flex h-[6.25rem] items-center justify-center text-center font-game-title text-sm font-semibold leading-snug text-[#fff6e2]/90 [text-shadow:2px_2px_0_rgba(0,0,0,0.5)] [word-break:keep-all]">
              <RichText text={bubble.line} />
            </p>
          </div>
        </div>,
        document.body,
      )}
    </VakuuChatterContext.Provider>
  );
}
