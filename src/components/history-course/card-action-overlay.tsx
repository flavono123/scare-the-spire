"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CodexCard } from "@/lib/codex-types";
import { localize } from "@/lib/sts2-i18n";
import { CardActionIcon } from "./card-action-icon";

const APPEAR_MS = 220;
const TRANSFORM_MS = 320;
const HOLD_MS = 720;
const FADE_MS = 360;

export type CardActionKind = "gained" | "upgraded" | "enchanted";

export interface CardActionToken {
  kind: CardActionKind;
  cardId: string;
  enchantmentId?: string;
  /** Stable key piece — drives React identity and replay re-trigger. */
  floor: number;
  step: number;
  /** Ordering within a single step (multiple cards in cards_gained). */
  index: number;
}

interface CardActionOverlayProps {
  stageRef: React.RefObject<HTMLDivElement | null>;
  tokens: CardActionToken[];
  cardsById: Record<string, CodexCard>;
  rate: number;
  onDone: (token: CardActionToken) => void;
}

export function CardActionOverlay({
  stageRef,
  tokens,
  cardsById,
  rate,
  onDone,
}: CardActionOverlayProps) {
  return (
    <>
      {tokens.map((token) => {
        const card = cardsById[token.cardId];
        if (!card) return null;
        return (
          <CardActionFlyer
            key={`${token.kind}-${token.cardId}-${token.floor}-${token.step}-${token.index}`}
            stageRef={stageRef}
            token={token}
            card={card}
            rate={rate}
            onDone={() => onDone(token)}
          />
        );
      })}
    </>
  );
}

type Phase = "appear" | "hold" | "transform" | "fade" | "done";

interface Point {
  x: number;
  y: number;
}

function CardActionFlyer({
  stageRef,
  token,
  card,
  rate,
  onDone,
}: {
  stageRef: React.RefObject<HTMLDivElement | null>;
  token: CardActionToken;
  card: CodexCard;
  rate: number;
  onDone: () => void;
}) {
  const [origin, setOrigin] = useState<Point | null>(null);
  // Stack offset by index — multiple cards in one step fan out vertically
  // so they don't overlap.
  const offsetY = token.index * 38;
  const [phase, setPhase] = useState<Phase>("appear");
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const stageRect = stage.getBoundingClientRect();
    const node = stage.querySelector<HTMLElement>('[data-node-current="true"]');
    if (!node) return;
    const r = node.getBoundingClientRect();
    setOrigin({
      x: r.left - stageRect.left + r.width + 14,
      y: r.top - stageRect.top + r.height / 2 - 30,
    });
  }, [stageRef]);

  useEffect(() => {
    if (!origin) return;
    const f = 1 / Math.sqrt(Math.max(1, rate));
    const appear = Math.round(APPEAR_MS * f);
    const hold = Math.round(HOLD_MS * f);
    const transform = Math.round(TRANSFORM_MS * f);
    const fade = Math.round(FADE_MS * f);
    const t1 = window.setTimeout(() => setPhase("hold"), appear);
    const needsTransform = token.kind !== "gained";
    const transformAt = appear + hold;
    const fadeAt = needsTransform ? transformAt + transform : transformAt;
    const doneAt = fadeAt + fade;
    const t2 = needsTransform
      ? window.setTimeout(() => setPhase("transform"), transformAt)
      : null;
    const t3 = window.setTimeout(() => setPhase("fade"), fadeAt);
    const t4 = window.setTimeout(() => {
      setPhase("done");
      onDoneRef.current();
    }, doneAt);
    return () => {
      window.clearTimeout(t1);
      if (t2) window.clearTimeout(t2);
      window.clearTimeout(t3);
      window.clearTimeout(t4);
    };
  }, [origin, rate, token.kind]);

  if (phase === "done" || !origin) return null;

  const opacity = phase === "appear" || phase === "fade" ? 0 : 1;
  const scale = phase === "appear" ? 0.7 : 1;
  const transformedColor = token.kind === "upgraded" ? "#86efac" : "#d8b4fe";
  const transformed = phase === "transform" || phase === "fade";
  const showPlus = token.kind === "upgraded" && transformed;

  const factor = 1 / Math.sqrt(Math.max(1, rate));
  // Apply the duration of the *transition into* the current phase so the
  // browser actually animates between renders. During hold the previous
  // change was the appear (scale/opacity) — keep that duration.
  const transitionMs = phase === "transform"
    ? Math.round(TRANSFORM_MS * factor)
    : phase === "fade"
      ? Math.round(FADE_MS * factor)
      : Math.round(APPEAR_MS * factor);

  const label = localize("cards", token.cardId) ?? token.cardId.split(".").pop();

  return (
    <div
      aria-hidden
      data-testid="card-action"
      data-kind={token.kind}
      data-phase={phase}
      className="pointer-events-none absolute z-30"
      style={{
        left: origin.x,
        top: origin.y + offsetY,
        transform: `translate(0, -50%) scale(${scale})`,
        transformOrigin: "left center",
        opacity,
        transition: `opacity ${transitionMs}ms ease-out, transform ${transitionMs}ms ease-out`,
      }}
    >
      <div className="flex items-center gap-2 rounded-md bg-black/65 px-2 py-1 shadow-lg">
        <CardActionIcon card={card} width={32} />
        <p
          className="text-[13px] font-bold leading-none drop-shadow"
          style={{
            color: transformed ? transformedColor : "#fafafa",
            transition: `color ${Math.round(TRANSFORM_MS * factor)}ms ease-out`,
          }}
        >
          {label}
          {showPlus && <span className="ml-0.5 text-[#86efac]">+</span>}
        </p>
      </div>
    </div>
  );
}
