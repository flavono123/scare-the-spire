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
  // after mount. The relic slot is hidden (opacity 0) while we're flying
  // but the element still exists in the DOM, so the queryselector finds
  // its destination geometry.
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
        x: r.left - stageRect.left + r.width / 2,
        y: r.top - stageRect.top + r.height / 2,
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

  // Single fixed position (origin) — translate-based animation handles
  // both the appear scale-in *and* the fly-out by composing a translate
  // and scale on the same node. Letting `left`/`top` animate would force
  // a layout pass per frame; transform stays on the compositor.
  const factor = 1 / Math.sqrt(Math.max(1, rate));
  const flying = phase === "fly" && target !== null;
  const dx = flying ? target.x - origin.x : 0;
  const dy = flying ? target.y - origin.y : 0;
  const scale = phase === "appear" ? 0.3 : flying ? 0.45 : 1;
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
        top: origin.y,
        // Compose: translate to fly destination, then scale + center the icon.
        transform: `translate3d(calc(-50% + ${dx}px), calc(-50% + ${dy}px), 0) scale(${scale})`,
        transformOrigin: "center center",
        opacity,
        transition: `transform ${transitionMs}ms ${ease}, opacity ${transitionMs}ms ${ease}`,
        willChange: "transform, opacity",
      }}
    >
      <div className="flex flex-col items-center gap-1">
        <div className="relative h-16 w-16">
          <Image
            src={relicIconSrc(token.id)}
            alt=""
            fill
            sizes="64px"
            className="object-contain drop-shadow-[0_0_18px_rgba(255,200,120,0.85)]"
            unoptimized
          />
        </div>
        {!flying && (
          <p className="rounded-full bg-black/65 px-2 py-0.5 text-[11px] font-bold text-amber-100 shadow">
            {label}
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
