"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { RichText } from "@/components/rich-text";
import Image from "@/components/ui/static-image";
import type { MerchantLineKind } from "@/lib/merchant-feedback";

/** NMerchantDialogue: 0.5 s in, 1 s hold, 0.5 s fade. */
const BUBBLE_LIFETIME_MS = 2000;
const BUBBLE_WIDTH_PX = 230;
const BUBBLE_HEIGHT_PX = 156;
const BUBBLE_GUTTER_PX = 8;
/** The bubble's tail sits this far along its width. */
const BUBBLE_TAIL_SHARE = 0.2;

type MerchantBubble = {
  id: number;
  line: string;
  left: number;
  top: number;
};

type MerchantSay = (kind: MerchantLineKind, anchor: HTMLElement) => void;

const MerchantFeedbackContext = createContext<MerchantSay>(() => {});

export function useMerchantSay(): MerchantSay {
  return useContext(MerchantFeedbackContext);
}

export function MerchantFeedbackProvider({
  successLines,
  failureLines,
  children,
}: {
  successLines: string[];
  failureLines: string[];
  children: ReactNode;
}) {
  const [bubble, setBubble] = useState<MerchantBubble | null>(null);
  const nextId = useRef(0);
  const hideTimer = useRef<number | null>(null);

  const say = useCallback<MerchantSay>((kind, anchor) => {
    const lines = kind === "success" ? successLines : failureLines;
    if (lines.length === 0) return;
    const rect = anchor.getBoundingClientRect();
    const left = Math.min(
      Math.max(BUBBLE_GUTTER_PX, rect.left + rect.width / 2 - BUBBLE_WIDTH_PX * BUBBLE_TAIL_SHARE),
      window.innerWidth - BUBBLE_WIDTH_PX - BUBBLE_GUTTER_PX,
    );
    const top = Math.max(BUBBLE_GUTTER_PX, rect.top - BUBBLE_HEIGHT_PX + 6);
    nextId.current += 1;
    setBubble({
      id: nextId.current,
      line: lines[Math.floor(Math.random() * lines.length)],
      left,
      top,
    });
    if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setBubble(null), BUBBLE_LIFETIME_MS);
  }, [successLines, failureLines]);

  useEffect(() => () => {
    if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
  }, []);

  const value = useMemo(() => say, [say]);

  return (
    <MerchantFeedbackContext.Provider value={value}>
      {children}
      {bubble && createPortal(
        <div
          key={bubble.id}
          role="status"
          data-merchant-bubble
          className="merchant-bubble pointer-events-none fixed z-[900]"
          style={{
            left: bubble.left,
            top: bubble.top,
            width: BUBBLE_WIDTH_PX,
            height: BUBBLE_HEIGHT_PX,
          }}
        >
          <div className="merchant-bubble-box relative h-full w-full">
            <Image
              src="/images/sts2/ui/speech_bubble3.webp"
              alt=""
              width={420}
              height={285}
              className="merchant-bubble-sprite absolute inset-0 h-full w-full object-contain"
            />
            <p className="merchant-bubble-text absolute inset-x-5 top-4 flex h-[6.25rem] items-center justify-center text-center font-game-title text-sm font-semibold leading-snug text-[#fff6e2]/90 [text-shadow:3px_2px_0_rgba(0,0,0,0.25)] [word-break:keep-all]">
              <RichText text={bubble.line} />
            </p>
          </div>
        </div>,
        document.body,
      )}
    </MerchantFeedbackContext.Provider>
  );
}
