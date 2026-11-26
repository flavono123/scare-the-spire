"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "@/components/ui/static-image";
import {
  EDGE_LEAN_RAD,
  HAND_TEXTURES,
  MERCHANT_HANDS,
  profileTokenCharacter,
  smoothDamp,
  type PointingHand,
} from "@/components/vexing-puzzlebox/character-hand-pointer";
import { useStoredProfileSnapshot } from "@/hooks/use-user-profile";

/** Half the 짜퍼 커넥션스 hand, so it covers fewer pieces below the one it points at. */
const HAND_HEIGHT_PX = 160;
const SETTLE_PX = 0.5;

/** Fingertip spot in viewport pixels, or null to sink out of view. */
export type DecisionsHandGoal = { x: number; y: number } | null;

/**
 * The 짜퍼 커넥션스 pointing hand, driven by the caller instead of hover:
 * every frame it reaches for `getGoal()`. Mouse/pen only, and off under
 * reduced motion.
 */
export function DecisionsDecisionsHand({ getGoal }: { getGoal: () => DecisionsHandGoal }) {
  const { stored, profile } = useStoredProfileSnapshot();
  const [merchant] = useState(
    () => MERCHANT_HANDS[Math.floor(Math.random() * MERCHANT_HANDS.length)],
  );
  const hand: PointingHand = profileTokenCharacter(stored, profile) ?? merchant;
  const handRef = useRef<HTMLDivElement>(null);
  const getGoalRef = useRef(getGoal);
  const startRef = useRef<() => void>(() => {});

  useEffect(() => {
    getGoalRef.current = getGoal;
  }, [getGoal]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;
    const element = handRef.current;
    if (!element) return;

    const hiddenY = () => window.innerHeight + 24;
    let frame: number | null = null;
    let lastTime = 0;
    let x = window.innerWidth / 2;
    let y = hiddenY();
    const velocityX = { value: 0 };
    const velocityY = { value: 0 };

    const step = (time: number) => {
      const deltaTime = Math.min((time - lastTime) / 1000, 0.05);
      lastTime = time;
      const goal = getGoalRef.current();
      // A hidden hand rises straight up to its first target.
      if (goal && y >= hiddenY() - 1) x = goal.x;
      const target = goal ?? { x, y: hiddenY() };
      x = smoothDamp(x, target.x, velocityX, deltaTime);
      y = smoothDamp(y, target.y, velocityY, deltaTime);
      const lean = ((x - window.innerWidth / 2) / window.innerWidth) * 2 * EDGE_LEAN_RAD;
      element.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${lean}rad)`;
      element.style.visibility = y >= hiddenY() - 1 ? "hidden" : "visible";
      const settled = Math.abs(x - target.x) < SETTLE_PX && Math.abs(y - target.y) < SETTLE_PX;
      frame = settled && !goal ? null : window.requestAnimationFrame(step);
    };
    const start = () => {
      if (frame !== null) return;
      lastTime = performance.now();
      frame = window.requestAnimationFrame(step);
    };
    startRef.current = start;
    document.addEventListener("dragstart", start);
    start();
    return () => {
      startRef.current = () => {};
      document.removeEventListener("dragstart", start);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, []);

  // The loop stops once the hand is down; any render (a selection, a move) may give it a goal again.
  useEffect(() => {
    startRef.current();
  });

  const texture = HAND_TEXTURES[hand];
  const scale = HAND_HEIGHT_PX / texture.height;
  return createPortal(
    <div
      ref={handRef}
      aria-hidden="true"
      data-decisions-decisions-hand={hand}
      // Under the assign panel (z-30), over the flying piece (z-[24]).
      className="pointer-events-none fixed left-0 top-0 z-[25]"
      style={{ visibility: "hidden", width: 0, height: 0 }}
    >
      <Image
        src={`/images/sts2/ui/hands/${hand}_point.webp`}
        alt=""
        width={Math.round(texture.width * scale)}
        height={HAND_HEIGHT_PX}
        className="absolute max-w-none drop-shadow-lg"
        style={{ left: -texture.tipX * scale, top: -texture.tipY * scale }}
      />
    </div>,
    document.body,
  );
}
