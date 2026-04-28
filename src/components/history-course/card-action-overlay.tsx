"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CodexCard } from "@/lib/codex-types";
import { localize } from "@/lib/sts2-i18n";
import { CardActionIcon } from "./card-action-icon";

const APPEAR_MS = 220;
const HOLD_MS = 1100;
// `gained` cards fly to the deck chip; other actions stay near the node and
// fade. The transform window (white → green/purple, optional `+` reveal)
// happens during hold for visual readability.
const TRANSFORM_AT_HOLD_MS = 600; // when into hold the verb/color flips
const FLY_MS = 720;
const FADE_MS = 360;

export type CardActionKind = "gained" | "upgraded" | "enchanted" | "skipped";

export interface CardActionToken {
  kind: CardActionKind;
  /** Card the action targets. Omitted for `skipped` if no card_choices info. */
  cardId: string | null;
  enchantmentId?: string;
  floor: number;
  step: number;
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
        const card = token.cardId ? (cardsById[token.cardId] ?? null) : null;
        return (
          <CardActionFlyer
            key={`${token.kind}-${token.cardId ?? "skip"}-${token.floor}-${token.step}-${token.index}`}
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

type Phase = "appear" | "hold" | "transformed" | "fly" | "fade" | "done";

interface Point {
  x: number;
  y: number;
}

const VERB: Record<CardActionKind, string> = {
  gained: "선택",
  upgraded: "강화",
  enchanted: "인챈트",
  skipped: "넘기기",
};

const TRANSFORMED_TEXT_COLOR: Record<CardActionKind, string> = {
  gained: "#fafafa",
  upgraded: "#86efac",
  enchanted: "#d8b4fe",
  skipped: "#a1a1aa",
};

function CardActionFlyer({
  stageRef,
  token,
  card,
  rate,
  onDone,
}: {
  stageRef: React.RefObject<HTMLDivElement | null>;
  token: CardActionToken;
  card: CodexCard | null;
  rate: number;
  onDone: () => void;
}) {
  const [origin, setOrigin] = useState<Point | null>(null);
  const [target, setTarget] = useState<Point | null>(null);
  const offsetY = token.index * 38;
  const [phase, setPhase] = useState<Phase>("appear");
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  // Measure node origin + (for gained) deck chip destination once on mount.
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const stageRect = stage.getBoundingClientRect();
    const node = stage.querySelector<HTMLElement>('[data-node-current="true"]');
    if (node) {
      const r = node.getBoundingClientRect();
      setOrigin({
        x: r.left - stageRect.left + r.width + 14,
        y: r.top - stageRect.top + r.height / 2 - 30,
      });
    }
    if (token.kind === "gained") {
      const slot = stage.querySelector<HTMLElement>("[data-deck-target]");
      if (slot) {
        const r = slot.getBoundingClientRect();
        setTarget({
          x: r.left - stageRect.left + r.width / 2,
          y: r.top - stageRect.top + r.height / 2,
        });
      }
    }
  }, [stageRef, token.kind]);

  useEffect(() => {
    if (!origin) return;
    const f = 1 / Math.sqrt(Math.max(1, rate));
    const appear = Math.round(APPEAR_MS * f);
    const transformAt = appear + Math.round(TRANSFORM_AT_HOLD_MS * f);
    const holdDoneAt = appear + Math.round(HOLD_MS * f);
    const flying = token.kind === "gained";
    const flyDoneAt = holdDoneAt + Math.round((flying ? FLY_MS : FADE_MS) * f);

    const t1 = window.setTimeout(() => setPhase("hold"), appear);
    // Skipped doesn't visually transform (the verb is the entire content),
    // and gained's "transformed" is just a no-op color hold.
    const wantsTransform = token.kind === "upgraded" || token.kind === "enchanted";
    const t2 = wantsTransform
      ? window.setTimeout(() => setPhase("transformed"), transformAt)
      : null;
    const t3 = window.setTimeout(() => setPhase(flying ? "fly" : "fade"), holdDoneAt);
    const t4 = window.setTimeout(() => {
      setPhase("done");
      onDoneRef.current();
    }, flyDoneAt);
    return () => {
      window.clearTimeout(t1);
      if (t2) window.clearTimeout(t2);
      window.clearTimeout(t3);
      window.clearTimeout(t4);
    };
  }, [origin, rate, token.kind]);

  if (phase === "done" || !origin) return null;

  const factor = 1 / Math.sqrt(Math.max(1, rate));
  const flying = phase === "fly" && target !== null;
  const dx = flying ? target.x - origin.x : 0;
  const dy = flying ? target.y - origin.y : 0;
  const scale = phase === "appear" ? 0.7 : flying ? 0.2 : 1;
  const opacity = phase === "appear" || phase === "fade" ? 0 : 1;

  const transitionMs = flying
    ? Math.round(FLY_MS * factor)
    : phase === "fade"
      ? Math.round(FADE_MS * factor)
      : Math.round(APPEAR_MS * factor);
  const ease = flying ? "cubic-bezier(0.45, 0.05, 0.6, 1)" : "ease-out";

  // Label rendering — show {name} {verb} for card actions, plain "넘기기"
  // for skip. Upgraded transitions to {name}+ in green; enchanted to
  // {name} {enchantName} 인챈트 in purple.
  const transformed =
    phase === "transformed" || phase === "fly" || phase === "fade";
  const verb = VERB[token.kind];
  const cardName = token.cardId
    ? (localize("cards", token.cardId) ?? token.cardId.split(".").pop() ?? "?")
    : null;
  const enchantName = token.enchantmentId
    ? localize("enchantments", token.enchantmentId)
    : null;

  let labelNode: React.ReactNode;
  if (token.kind === "skipped") {
    labelNode = <span>{verb}</span>;
  } else if (token.kind === "upgraded") {
    labelNode = transformed ? (
      <span>
        {cardName}
        <span className="ml-0.5 text-[#86efac]">+</span>
        <span className="ml-1 text-xs text-zinc-300">{verb}</span>
      </span>
    ) : (
      <span>
        {cardName}
        <span className="ml-1 text-xs text-zinc-300">{verb}</span>
      </span>
    );
  } else if (token.kind === "enchanted") {
    labelNode = (
      <span>
        {cardName}
        {enchantName && <span className="ml-1">{enchantName}</span>}
        <span className="ml-1 text-xs text-zinc-300">{verb}</span>
      </span>
    );
  } else {
    // gained
    labelNode = (
      <span>
        {cardName}
        <span className="ml-1 text-xs text-zinc-300">{verb}</span>
      </span>
    );
  }

  const textColor = transformed
    ? TRANSFORMED_TEXT_COLOR[token.kind]
    : "#fafafa";

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
        // translate-only fly (gained) or stationary (others). Single fixed
        // anchor so transitions stay on the compositor.
        transform: `translate3d(${dx}px, calc(-50% + ${dy}px), 0) scale(${scale})`,
        transformOrigin: "left center",
        opacity,
        transition: `transform ${transitionMs}ms ${ease}, opacity ${transitionMs}ms ${ease}`,
        willChange: "transform, opacity",
      }}
    >
      <div className="flex items-center gap-2">
        {card ? (
          <CardActionIcon card={card} width={32} />
        ) : (
          // Skipped without card data — no icon. Just the label.
          <span aria-hidden className="inline-block h-8 w-8" />
        )}
        <p
          className="text-[13px] font-bold leading-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.85)]"
          style={{
            color: textColor,
            transition: `color ${Math.round(APPEAR_MS * factor)}ms ease-out`,
            // Dark text outline so the white label reads against the map
            // without needing a background plate.
            WebkitTextStroke: "0.5px rgba(0,0,0,0.85)",
          }}
        >
          {labelNode}
        </p>
      </div>
    </div>
  );
}
