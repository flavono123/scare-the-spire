"use client";

import Image from "next/image";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { localize } from "@/lib/sts2-i18n";

const APPEAR_MS = 220;
const HOLD_MS = 540;
const FLY_MS = 580;

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
  // after mount. The relic slot exists by this point because topbarState is
  // recomputed synchronously on step change.
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

  const flying = phase === "fly" && target;
  const center = flying ? target : origin;
  const scale = phase === "appear" ? 0.4 : flying ? 0.45 : 1;
  const opacity = phase === "appear" ? 0 : flying ? 0.85 : 1;
  const factor = 1 / Math.sqrt(Math.max(1, rate));
  // Transition duration applies to the *upcoming* state change. During
  // appear/hold we want the opacity/scale fade-in to last APPEAR_MS; during
  // fly we want the position+scale movement to last FLY_MS.
  const transitionMs = flying
    ? Math.round(FLY_MS * factor)
    : Math.round(APPEAR_MS * factor);
  const transitionEase = flying ? "cubic-bezier(0.55, 0.05, 0.6, 1)" : "ease-out";

  const label = localize("relics", token.id) ?? token.id.split(".").pop();

  return (
    <div
      aria-hidden
      data-testid="relic-fly"
      data-phase={phase}
      className="pointer-events-none absolute z-30"
      style={{
        left: center.x,
        top: center.y,
        transform: `translate(-50%, -50%) scale(${scale})`,
        transformOrigin: "center center",
        opacity,
        transition: `left ${transitionMs}ms ${transitionEase}, top ${transitionMs}ms ${transitionEase}, transform ${transitionMs}ms ${transitionEase}, opacity ${transitionMs}ms ${transitionEase}`,
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
