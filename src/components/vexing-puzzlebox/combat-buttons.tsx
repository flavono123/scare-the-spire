"use client";

import type { MouseEvent } from "react";
import Image from "@/components/ui/static-image";

const COMBAT_UI_ROOT = "/images/sts2/ui/combat";
/** Label colors from draw_pile.tscn, discard_pile.tscn, and end_turn_button.tscn. */
const LABEL_COLOR = "#fff6e2";
const PILE_OUTLINE = "#881f20";
const END_TURN_OUTLINE = "#131f2e";
/** EndTurnButton Glow modulate (0, 0.831, 1) and GlowVfx modulate (0.25, 0.875, 1). */
const END_TURN_GLOW = "#00d4ff";
const END_TURN_GLOW_VFX = "#40dfff";

function gameLabelStyle(outline: string, shadowAlpha: number) {
  return {
    color: LABEL_COLOR,
    WebkitTextStroke: `3px ${outline}`,
    paintOrder: "stroke fill",
    textShadow: `2px 1px 0 rgba(0, 0, 0, ${shadowAlpha})`,
  } as const;
}

/**
 * A combat pile button: the draw or discard pile icon with its count badge.
 * The draw pile's badge sits on its upper left, the discard pile's beside it on the left.
 */
export function PileButton({
  pile,
  count,
  label,
  disabled,
  onClick,
}: {
  pile: "draw" | "discard";
  count: number;
  label: string;
  disabled?: boolean;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={`${label} ${count}`}
      data-pile-button={pile}
      className="group/pile flex w-20 flex-col items-center gap-1 disabled:opacity-45"
    >
      <span className="relative block h-14 w-14 transition-transform duration-150 ease-out group-enabled/pile:group-hover/pile:scale-110 group-enabled/pile:group-active/pile:scale-95 motion-reduce:transition-none">
        <Image
          src={`${COMBAT_UI_ROOT}/${pile}_pile.webp`}
          alt=""
          width={151}
          height={158}
          className="h-full w-full object-contain drop-shadow-[0_4px_4px_rgba(0,0,0,0.45)]"
        />
        <span
          className={`absolute flex h-[1.65rem] w-[1.95rem] items-center justify-center ${
            pile === "draw" ? "-left-2 -top-2" : "-left-7 -top-1"
          }`}
        >
          <Image
            src={`${COMBAT_UI_ROOT}/pile_button_count.webp`}
            alt=""
            width={95}
            height={80}
            className="absolute inset-0 h-full w-full object-contain"
          />
          <span
            className="relative font-game-title text-sm font-bold leading-none tabular-nums"
            style={gameLabelStyle(PILE_OUTLINE, 0.125)}
          >
            {count}
          </span>
        </span>
      </span>
      <span className="font-game-title text-xs font-bold leading-none" style={gameLabelStyle(PILE_OUTLINE, 0.125)}>
        {label}
      </span>
    </button>
  );
}

/** The combat end turn button; it glows like NEndTurnButton when the move is ready. */
export function EndTurnButton({
  label,
  ready,
  disabled,
  onClick,
}: {
  label: string;
  ready: boolean;
  disabled?: boolean;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  const glowMask = `url(${COMBAT_UI_ROOT}/end_turn_button_glow.webp) center / 100% 100% no-repeat`;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      data-end-turn-button={ready ? "ready" : "idle"}
      className="group/end relative h-[5.25rem] w-[10.5rem] shrink-0 disabled:cursor-not-allowed"
    >
      {ready && (
        <>
          <span
            aria-hidden="true"
            className="end-turn-glow-vfx absolute inset-0"
            style={{ backgroundColor: END_TURN_GLOW_VFX, mask: glowMask, WebkitMask: glowMask }}
          />
          <span
            aria-hidden="true"
            className="end-turn-glow absolute inset-0"
            style={{ backgroundColor: END_TURN_GLOW, mask: glowMask, WebkitMask: glowMask }}
          />
        </>
      )}
      <span className="absolute inset-0 transition-transform duration-150 ease-out group-enabled/end:group-hover/end:scale-105 group-enabled/end:group-active/end:scale-95 motion-reduce:transition-none">
        <Image
          src={`${COMBAT_UI_ROOT}/end_turn_button.webp`}
          alt=""
          width={512}
          height={256}
          className={`absolute inset-0 h-full w-full object-contain transition-[filter] duration-150 ${
            disabled ? "brightness-[0.6] saturate-50" : "group-hover/end:brightness-110"
          }`}
        />
        <span
          className={`absolute inset-0 flex items-center justify-center pb-0.5 font-game-title text-xl font-bold leading-none ${
            disabled ? "opacity-60" : ""
          }`}
          style={{ ...gameLabelStyle(END_TURN_OUTLINE, 0.19), textShadow: "3px 2px 0 rgba(0, 0, 0, 0.19)" }}
        >
          {label}
        </span>
      </span>
    </button>
  );
}
