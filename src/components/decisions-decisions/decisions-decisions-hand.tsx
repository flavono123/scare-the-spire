"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "@/components/ui/static-image";
import {
  HAND_TEXTURES,
  MERCHANT_HANDS,
  profileTokenCharacter,
  smoothDamp,
  type PointingHand,
} from "@/components/vexing-puzzlebox/character-hand-pointer";
import { useStoredProfileSnapshot } from "@/hooks/use-user-profile";
import type { CharacterPoolSlug } from "@/lib/user-profile";

/** Characters with paper/rock (grab) textures; the merchants only have a pointing one. */
export const GRAB_HAND_CHARACTERS = ["ironclad", "silent", "regent", "necrobinder", "defect"] as const;
export type GrabHandCharacter = (typeof GRAB_HAND_CHARACTERS)[number];

/** Half the 짜퍼 커넥션스 hand, so it covers fewer pieces above the one it points at. */
const HAND_HEIGHT_PX = 160;
/** *_rock.webp texture size and hand_image.tscn grab point, as in shuffle-hands.ts. */
const GRAB_TEXTURE = { width: 422, height: 1200, x: 175, y: 222 };
const SETTLE_PX = 0.5;
/** Fingertip y while hidden: the whole arm sits above the viewport. */
const HIDDEN_Y = -12;
/** After this long on one piece with nothing else going on, the finger starts poking it. */
const POKE_DELAY_MS = 900;
const POKE_PERIOD_MS = 650;
const POKE_PX = 10;

/**
 * Where the hand goes, in viewport pixels, or null to pull back up. A pointing
 * goal is the fingertip spot; a grab goal is the fist's grip point.
 */
export type DecisionsHandGoal = { x: number; y: number; grab: boolean } | null;

/**
 * The shop's hand: it hangs straight down from the top of the screen, points
 * at what `getGoal()` names each frame, pokes when left alone, and closes into
 * a fist to carry. Mouse/pen only, and off under reduced motion.
 */
export function DecisionsDecisionsHand({
  getGoal,
  poolCharacter,
}: {
  getGoal: () => DecisionsHandGoal;
  /** The pool's most common character, or null for a tie or none. */
  poolCharacter: GrabHandCharacter | null;
}) {
  const { stored, profile } = useStoredProfileSnapshot();
  const [random] = useState(() => ({
    merchant: MERCHANT_HANDS[Math.floor(Math.random() * MERCHANT_HANDS.length)],
    character: GRAB_HAND_CHARACTERS[Math.floor(Math.random() * GRAB_HAND_CHARACTERS.length)],
  }));
  const profileCharacter: CharacterPoolSlug | null = profileTokenCharacter(stored, profile);
  const pointHand: PointingHand = profileCharacter ?? random.merchant;
  // A merchant has no fist, so it lends the grab to the pool's character.
  const grabHand: CharacterPoolSlug = profileCharacter ?? poolCharacter ?? random.character;
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

    let frame: number | null = null;
    let lastTime = 0;
    let x = window.innerWidth / 2;
    let y = HIDDEN_Y;
    let grabbing = false;
    let lastGoal: DecisionsHandGoal = null;
    let idleSince = 0;
    const velocityX = { value: 0 };
    const velocityY = { value: 0 };

    const step = (time: number) => {
      const deltaTime = Math.min((time - lastTime) / 1000, 0.05);
      lastTime = time;
      const goal = getGoalRef.current();
      const hidden = y <= HIDDEN_Y + 1;
      // A hidden hand drops straight down to its first target.
      if (goal && hidden) x = goal.x;
      const moved = !goal || !lastGoal || goal.grab
        || Math.abs(goal.x - lastGoal.x) > 1 || Math.abs(goal.y - lastGoal.y) > 1;
      if (moved) idleSince = time;
      lastGoal = goal;

      const target = goal ?? { x, y: HIDDEN_Y };
      x = smoothDamp(x, target.x, velocityX, deltaTime);
      y = smoothDamp(y, target.y, velocityY, deltaTime);
      const idle = time - idleSince - POKE_DELAY_MS;
      const poke = goal && !goal.grab && idle > 0
        ? (POKE_PX * (1 - Math.cos((2 * Math.PI * idle) / POKE_PERIOD_MS))) / 2
        : 0;
      const nextGrabbing = Boolean(goal?.grab);
      if (nextGrabbing !== grabbing) {
        grabbing = nextGrabbing;
        element.dataset.grab = grabbing ? "true" : "false";
      }
      // Turned upside down: the arm comes from the ceiling, never leaning.
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

  const point = HAND_TEXTURES[pointHand];
  const pointScale = HAND_HEIGHT_PX / point.height;
  const grabScale = HAND_HEIGHT_PX / GRAB_TEXTURE.height;
  return createPortal(
    <div
      ref={handRef}
      aria-hidden="true"
      data-decisions-decisions-hand={pointHand}
      data-grab-hand={grabHand}
      data-grab="false"
      // Under the site header and the assign panel, over the flying piece (z-[24]).
      className="group/hand pointer-events-none fixed left-0 top-0 z-[25]"
      style={{ visibility: "hidden", width: 0, height: 0 }}
    >
      <Image
        src={`/images/sts2/ui/hands/${pointHand}_point.webp`}
        alt=""
        width={Math.round(point.width * pointScale)}
        height={HAND_HEIGHT_PX}
        className="absolute max-w-none drop-shadow-lg group-data-[grab=true]/hand:hidden"
        style={{ left: -point.tipX * pointScale, top: -point.tipY * pointScale }}
      />
      <Image
        src={`/images/sts2/ui/hands/${grabHand}_rock.webp`}
        alt=""
        width={Math.round(GRAB_TEXTURE.width * grabScale)}
        height={HAND_HEIGHT_PX}
        className="absolute hidden max-w-none drop-shadow-lg group-data-[grab=true]/hand:block"
        style={{ left: -GRAB_TEXTURE.x * grabScale, top: -GRAB_TEXTURE.y * grabScale }}
      />
    </div>,
    document.body,
  );
}
