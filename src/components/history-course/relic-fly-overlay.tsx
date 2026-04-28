"use client";

import Image from "next/image";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { localize } from "@/lib/sts2-i18n";

const APPEAR_MS = 220;
const HOLD_MS = 480;
const FLY_MS = 620;

function relicIconSrc(id: string): string {
  const slug = id.replace(/^RELIC\./, "").toLowerCase();
  return `/images/sts2/relics/${slug}.webp`;
}

interface Point {
  x: number;
  y: number;
}

type Phase = "appear" | "hold" | "fly" | "done";

export interface RelicFlyToken {
  id: string;
  floor: number;
  step: number;
  /** Position in the shared per-node action stack (cards above, relic
   * below them). Drives the vertical offset of the appear/hold pose. */
  stackIndex: number;
}

export function RelicFlyOverlay({
  stageRef,
  tokens,
  rate,
  onDone,
}: {
  stageRef: React.RefObject<HTMLDivElement | null>;
  tokens: RelicFlyToken[];
  rate: number;
  onDone: (token: RelicFlyToken) => void;
}) {
  return (
    <>
      {tokens.map((token) => (
        <RelicFlyer
          key={`${token.id}-${token.floor}-${token.step}`}
          stageRef={stageRef}
          token={token}
          rate={rate}
          onDone={() => onDone(token)}
        />
      ))}
    </>
  );
}

function RelicFlyer({
  stageRef,
  token,
  rate,
  onDone,
}: {
  stageRef: React.RefObject<HTMLDivElement | null>;
  token: RelicFlyToken;
  rate: number;
  onDone: () => void;
}) {
  const [origin, setOrigin] = useState<Point | null>(null);
  const [target, setTarget] = useState<Point | null>(null);
  const [phase, setPhase] = useState<Phase>("appear");
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  // Read source/destination rects relative to the stage container right
  // after mount. Origin uses the same anchor as the card-action overlay
  // (right side of the current node, vertically offset by stackIndex) so
  // cards and relics share a single visual stack with relics rendered
  // *below* the cards.
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const stageRect = stage.getBoundingClientRect();
    const node = stage.querySelector<HTMLElement>('[data-node-current="true"]');
    const slot = stage.querySelector<HTMLElement>(
      `[data-relic-target="${cssEscape(token.id)}"]`,
    );
    if (node) {
      const r = node.getBoundingClientRect();
      setOrigin({
        x: r.left - stageRect.left + r.width + 14,
        y: r.top - stageRect.top + r.height / 2 - 30,
      });
    }
    if (slot) {
      const r = slot.getBoundingClientRect();
      setTarget({
        x: r.left - stageRect.left + r.width / 2,
        y: r.top - stageRect.top + r.height / 2,
      });
    }
  }, [stageRef, token.id]);

  // Phase clock — appear → hold → fly → done. rate-aware: faster runs
  // shorten the dwell so the playback never feels stalled.
  useEffect(() => {
    if (!origin) return;
    const factor = 1 / Math.sqrt(Math.max(1, rate));
    const appearMs = Math.round(APPEAR_MS * factor);
    const holdMs = Math.round(HOLD_MS * factor);
    const flyMs = Math.round(FLY_MS * factor);
    const t1 = window.setTimeout(() => setPhase("hold"), appearMs);
    const t2 = window.setTimeout(() => setPhase("fly"), appearMs + holdMs);
    const t3 = window.setTimeout(() => {
      setPhase("done");
      onDoneRef.current();
    }, appearMs + holdMs + flyMs);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [origin, rate]);

  if (phase === "done" || !origin) return null;

  // Same horizontal stack offset the card-action overlay uses, so cards
  // and relics share a single column (cards on top by stackIndex 0..N,
  // relics below at stackIndex N+).
  const offsetY = token.stackIndex * 38;
  const factor = 1 / Math.sqrt(Math.max(1, rate));
  const flying = phase === "fly" && target !== null;
  const dx = flying ? target.x - origin.x : 0;
  const dy = flying ? target.y - origin.y : 0;
  const scale = phase === "appear" ? 0.55 : flying ? 0.45 : 1;
  const opacity = phase === "appear" ? 0 : 1;

  const transitionMs = flying
    ? Math.round(FLY_MS * factor)
    : Math.round(APPEAR_MS * factor);
  const ease = flying ? "cubic-bezier(0.45, 0.05, 0.6, 1)" : "ease-out";

  const label = localize("relics", token.id) ?? token.id.split(".").pop();

  return (
    <div
      aria-hidden
      data-testid="relic-fly"
      data-phase={phase}
      className="pointer-events-none absolute z-30"
      style={{
        left: origin.x,
        top: origin.y + offsetY,
        // Anchor at left edge / vertical center; translate3d carries both
        // the per-frame appear scale *and* the fly-out displacement.
        transform: `translate3d(${dx}px, calc(-50% + ${dy}px), 0) scale(${scale})`,
        transformOrigin: "left center",
        opacity,
        transition: `transform ${transitionMs}ms ${ease}, opacity ${transitionMs}ms ${ease}`,
        willChange: "transform, opacity",
      }}
    >
      <div className="flex items-center gap-2">
        <div className="relative h-8 w-8 shrink-0">
          <Image
            src={relicIconSrc(token.id)}
            alt=""
            fill
            sizes="32px"
            className="object-contain drop-shadow-[0_0_8px_rgba(255,200,120,0.85)]"
            unoptimized
          />
        </div>
        {!flying && (
          <p
            className="text-[13px] font-bold leading-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.85)]"
            style={{
              color: "#fef3c7",
              WebkitTextStroke: "0.5px rgba(0,0,0,0.85)",
            }}
          >
            {label}
            <span className="ml-1 text-xs text-zinc-300">획득</span>
          </p>
        )}
      </div>
    </div>
  );
}

function cssEscape(value: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }
  return value.replace(/(["\\\]\[])/g, "\\$1");
}
