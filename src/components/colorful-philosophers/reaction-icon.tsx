"use client";

import { SpireIcon } from "@/components/spire-icon";
import { COLORFUL_PHILOSOPHER_REACTION_TOKENS, type ColorfulPhilosopherReaction } from "@/lib/colorful-philosophers";
import { cn } from "@/lib/utils";

/** Idle wax, hover or selected color, with the same toast-up as index likes. */
export function ColorfulPhilosopherReactionIcon({
  kind,
  active = false,
  lift = false,
  size = 15,
}: {
  kind: ColorfulPhilosopherReaction;
  active?: boolean;
  lift?: boolean;
  size?: number;
}) {
  const token = COLORFUL_PHILOSOPHER_REACTION_TOKENS[kind];
  return (
    <span
      className={cn(
        "relative inline-flex",
        lift && [
          "transition-transform duration-200 ease-out will-change-transform",
          "motion-reduce:transition-none motion-reduce:transform-none",
          "group-hover/spire:-translate-y-0.5 group-focus-visible/spire:-translate-y-0.5",
        ],
      )}
      style={{ width: size, height: size }}
    >
      <SpireIcon
        src={token.src}
        size={size}
        variant="ghost"
        className={cn(
          "absolute inset-0 transition-opacity duration-200 ease-out motion-reduce:transition-none",
          active
            ? "opacity-0"
            : "opacity-100 group-hover/spire:opacity-0 group-focus-visible/spire:opacity-0",
        )}
      />
      <SpireIcon
        src={token.src}
        size={size}
        variant={token.variant}
        className={cn(
          "absolute inset-0 transition-opacity duration-200 ease-out motion-reduce:transition-none",
          active
            ? "opacity-100"
            : "opacity-0 group-hover/spire:opacity-100 group-focus-visible/spire:opacity-100",
        )}
      />
    </span>
  );
}
