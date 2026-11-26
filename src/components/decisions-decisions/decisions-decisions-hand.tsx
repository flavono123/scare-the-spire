"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Image from "@/components/ui/static-image";
import { HAND_TEXTURES, smoothDamp } from "@/components/vexing-puzzlebox/character-hand-pointer";
import { cacheBustSts2ImageUrl } from "@/lib/sts2-image-cache";

/** Characters with point and rock (fist) textures; the merchants have no fist, so they are out. */
export const HAND_CHARACTERS = ["ironclad", "silent", "regent", "necrobinder", "defect"] as const;
export type HandCharacter = (typeof HAND_CHARACTERS)[number];

/** Half the 짜퍼 커넥션스 hand, so it covers fewer pieces above the one it points at. */
const HAND_HEIGHT_PX = 160;
/** *_rock.webp texture size and hand_image.tscn grab point, as in shuffle-hands.ts. */
const FIST = { width: 422, height: 1200, gripX: 175, gripY: 222 };
const FIST_SCALE = HAND_HEIGHT_PX / FIST.height;
const SETTLE_PX = 0.5;
/** Fingertip y while pulled up: the whole arm sits above the viewport. */
const HIDDEN_Y = -12;
const POKE_PERIOD_MS = 650;
const POKE_PX = 10;

export function fistSrc(character: HandCharacter): string {
  return cacheBustSts2ImageUrl(`/images/sts2/ui/hands/${character}_rock.webp`);
}

/**
 * Fist hanging from above with its grip point at (x, y) of a positioned
 * container, laid over a carried piece.
 */
export function fistOverlay(character: HandCharacter, x: number, y: number): HTMLImageElement {
  const image = document.createElement("img");
  image.src = fistSrc(character);
  image.alt = "";
  image.draggable = false;
  const gripX = FIST.gripX * FIST_SCALE;
  const gripY = FIST.gripY * FIST_SCALE;
  image.style.cssText = [
    "position:absolute",
    "max-width:none",
    "pointer-events:none",
    "z-index:1",
    `left:${x - gripX}px`,
    `top:${y - gripY}px`,
    `width:${FIST.width * FIST_SCALE}px`,
    `height:${HAND_HEIGHT_PX}px`,
    `transform-origin:${gripX}px ${gripY}px`,
    "transform:rotate(180deg)",
    "filter:drop-shadow(0 6px 8px rgba(0,0,0,0.35))",
  ].join(";");
  return image;
}

/** Box the upside-down fist covers around its grip point, for sizing a drag image. */
export function fistBounds(x: number, y: number) {
  const width = FIST.width * FIST_SCALE;
  const gripX = FIST.gripX * FIST_SCALE;
  const gripY = FIST.gripY * FIST_SCALE;
  return {
    left: x - (width - gripX),
    right: x + gripX,
    top: y - (HAND_HEIGHT_PX - gripY),
    bottom: y + gripY,
  };
}

/**
 * Pointing goal for the hand: the fingertip spot in viewport pixels; "hide"
 * while a fist carries a piece (it vanishes in place and snaps to the next
 * target); null to pull back up.
 */
export type DecisionsHandGoal = { x: number; y: number } | "hide" | null;

/**
 * The shop's hand, in the pool's character: it hangs straight down from the
 * top of the screen and pokes the piece `getGoal()` names. Mouse/pen only,
 * and off under reduced motion.
 */
export function DecisionsDecisionsHand({
  getGoal,
  character,
}: {
  getGoal: () => DecisionsHandGoal;
  character: HandCharacter;
}) {
  const handRef = useRef<HTMLDivElement>(null);
  const getGoalRef = useRef(getGoal);
  const startRef = useRef<() => void>(() => {});

  useEffect(() => {
    getGoalRef.current = getGoal;
  }, [getGoal]);

  // Loaded up front so a drag image built at dragstart already shows the fist.
  useEffect(() => {
    new window.Image().src = fistSrc(character);
  }, [character]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;
    const element = handRef.current;
    if (!element) return;

    let frame: number | null = null;
    let lastTime = 0;
    let x = window.innerWidth / 2;
    let y = HIDDEN_Y;
    let away = false;
    let lastGoal: { x: number; y: number } | null = null;
    let idleSince = 0;
    const velocityX = { value: 0 };
    const velocityY = { value: 0 };

    const step = (time: number) => {
      const deltaTime = Math.min((time - lastTime) / 1000, 0.05);
      lastTime = time;
      const goal = getGoalRef.current();
      if (goal === "hide") {
        away = true;
        element.style.visibility = "hidden";
        frame = window.requestAnimationFrame(step);
        return;
      }
      if (away) {
        // Back from carrying: appear on the next piece at once, or stay up.
        away = false;
        x = goal ? goal.x : x;
        y = goal ? goal.y : HIDDEN_Y;
        velocityX.value = 0;
        velocityY.value = 0;
      } else if (goal && y <= HIDDEN_Y + 1) {
        // A hidden hand drops straight down to its first target.
        x = goal.x;
      }
      if (!goal || !lastGoal || Math.abs(goal.x - lastGoal.x) > 1 || Math.abs(goal.y - lastGoal.y) > 1) {
        idleSince = time;
      }
      lastGoal = goal;

      const target = goal ?? { x, y: HIDDEN_Y };
      x = smoothDamp(x, target.x, velocityX, deltaTime);
      y = smoothDamp(y, target.y, velocityY, deltaTime);
      // Pokes from the moment it lands on a piece: up and back down onto it.
      const poke = goal
        ? (POKE_PX * (1 - Math.cos((2 * Math.PI * (time - idleSince)) / POKE_PERIOD_MS))) / 2
        : 0;
      // Upside down: the arm comes from the ceiling, never leaning.
      element.style.transform = `translate3d(${x}px, ${y - poke}px, 0) rotate(180deg)`;
      element.style.visibility = y <= HIDDEN_Y + 1 ? "hidden" : "visible";
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

  // The loop stops once the hand is up; any render (a selection, a move) may give it a goal again.
  useEffect(() => {
    startRef.current();
  });

  const point = HAND_TEXTURES[character];
  const pointScale = HAND_HEIGHT_PX / point.height;
  return createPortal(
    <div
      ref={handRef}
      aria-hidden="true"
      data-decisions-decisions-hand={character}
      // Under the site header and the assign panel, over the flying piece (z-[24]).
      className="pointer-events-none fixed left-0 top-0 z-[25]"
      style={{ visibility: "hidden", width: 0, height: 0 }}
    >
      <Image
        src={`/images/sts2/ui/hands/${character}_point.webp`}
        alt=""
        width={Math.round(point.width * pointScale)}
        height={HAND_HEIGHT_PX}
        className="absolute max-w-none drop-shadow-lg"
        style={{ left: -point.tipX * pointScale, top: -point.tipY * pointScale }}
      />
    </div>,
    document.body,
  );
}
