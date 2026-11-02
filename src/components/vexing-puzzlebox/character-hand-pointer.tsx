"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Image from "@/components/ui/static-image";
import { useStoredProfileSnapshot } from "@/hooks/use-user-profile";
import { characterPoolSlug, type CharacterPoolSlug } from "@/lib/user-profile";

export const CHARACTER_HAND_TARGET_ATTRIBUTE = "data-character-hand-target";

const HAND_TEXTURE_WIDTH = 422;
const HAND_TEXTURE_HEIGHT = 1200;
const HAND_RENDER_HEIGHT_PX = 320;
const HAND_SCALE = HAND_RENDER_HEIGHT_PX / HAND_TEXTURE_HEIGHT;
/** Fingertip in texture pixels, measured from each multiplayer_hand_*_point.png. */
const FINGERTIPS: Record<CharacterPoolSlug, { x: number; y: number }> = {
  ironclad: { x: 146, y: 19 },
  silent: { x: 159, y: 19 },
  regent: { x: 127, y: 22 },
  necrobinder: { x: 155, y: 18 },
  defect: { x: 213, y: 39 },
};
/** NHandImage follows at 0.07 s for remote players. */
const SMOOTH_TIME_S = 0.07;
/** NMerchantHand.StopPointing lingers 2 s after the mouse leaves a slot. */
const LINGER_MS = 2000;
const PRESSED_SCALE = 0.98;
/** NHandImage leans 0.48 rad at the edge of a 1920 wide screen. */
const EDGE_LEAN_RAD = 0.48;
const TIP_INSET_PX = 6;
const SETTLE_PX = 0.5;

/** MathHelper.SmoothDamp without the speed clamp. */
function smoothDamp(
  current: number,
  target: number,
  velocity: { value: number },
  deltaTime: number,
): number {
  const omega = 2 / SMOOTH_TIME_S;
  const x = omega * deltaTime;
  const decay = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = current - target;
  const temp = (velocity.value + omega * change) * deltaTime;
  velocity.value = (velocity.value - omega * temp) * decay;
  return target + (change + temp) * decay;
}

function hiddenY(): number {
  return window.innerHeight + 24;
}

/** Fingertip spot on a target: just inside its lower edge. */
function fingertipTarget(element: Element): { x: number; y: number } {
  const rect = element.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.bottom - TIP_INSET_PX };
}

export function CharacterHandPointer() {
  const { profile } = useStoredProfileSnapshot();
  const character = characterPoolSlug(profile.characterId);
  const handRef = useRef<HTMLDivElement>(null);
  const fingertip = FINGERTIPS[character];

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const hand = handRef.current;
    if (!hand) return;

    let target: Element | null = null;
    let lingerTimer: number | null = null;
    let frame: number | null = null;
    let lastTime = 0;
    let pressed = false;
    let x = window.innerWidth / 2;
    let y = hiddenY();
    const velocityX = { value: 0 };
    const velocityY = { value: 0 };

    const closestTarget = (node: EventTarget | null) => (
      node instanceof Element ? node.closest(`[${CHARACTER_HAND_TARGET_ATTRIBUTE}]`) : null
    );

    const step = (time: number) => {
      const deltaTime = Math.min((time - lastTime) / 1000, 0.05);
      lastTime = time;
      if (target && !target.isConnected) target = null;
      const goal = target ? fingertipTarget(target) : { x, y: hiddenY() };
      x = smoothDamp(x, goal.x, velocityX, deltaTime);
      y = smoothDamp(y, goal.y, velocityY, deltaTime);

      const lean = ((x - window.innerWidth / 2) / window.innerWidth) * 2 * EDGE_LEAN_RAD;
      const scale = pressed ? PRESSED_SCALE : 1;
      hand.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${lean}rad) scale(${scale})`;
      hand.style.visibility = y >= hiddenY() - 1 ? "hidden" : "visible";

      const settled = Math.abs(x - goal.x) < SETTLE_PX && Math.abs(y - goal.y) < SETTLE_PX;
      frame = settled && !target ? null : window.requestAnimationFrame(step);
    };

    const startLoop = () => {
      if (frame !== null) return;
      lastTime = performance.now();
      frame = window.requestAnimationFrame(step);
    };

    const clearLinger = () => {
      if (lingerTimer !== null) window.clearTimeout(lingerTimer);
      lingerTimer = null;
    };

    const scheduleRetreat = () => {
      clearLinger();
      lingerTimer = window.setTimeout(() => {
        target = null;
      }, LINGER_MS);
    };

    const pointAt = (element: Element) => {
      clearLinger();
      // A hidden hand rises straight up to the first target.
      if (!target && y >= hiddenY() - 1) x = fingertipTarget(element).x;
      target = element;
      startLoop();
    };

    const onPointerOver = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const element = closestTarget(event.target);
      if (element) pointAt(element);
    };
    const onPointerOut = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const element = closestTarget(event.target);
      if (element && element !== closestTarget(event.relatedTarget)) scheduleRetreat();
    };
    const onPointerDown = (event: PointerEvent) => {
      const element = closestTarget(event.target);
      if (!element) return;
      pointAt(element);
      pressed = true;
      startLoop();
    };
    const onPointerUp = (event: PointerEvent) => {
      pressed = false;
      startLoop();
      if (event.pointerType !== "mouse") scheduleRetreat();
    };

    document.addEventListener("pointerover", onPointerOver);
    document.addEventListener("pointerout", onPointerOut);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("pointerup", onPointerUp);
    return () => {
      document.removeEventListener("pointerover", onPointerOver);
      document.removeEventListener("pointerout", onPointerOut);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("pointerup", onPointerUp);
      clearLinger();
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, []);

  return createPortal(
    <div
      ref={handRef}
      aria-hidden="true"
      data-character-hand={character}
      className="pointer-events-none fixed left-0 top-0 z-[800]"
      style={{ visibility: "hidden", width: 0, height: 0 }}
    >
      <Image
        src={`/images/sts2/ui/hands/${character}_point.webp`}
        alt=""
        width={Math.round(HAND_TEXTURE_WIDTH * HAND_SCALE)}
        height={HAND_RENDER_HEIGHT_PX}
        className="absolute max-w-none drop-shadow-lg"
        style={{ left: -fingertip.x * HAND_SCALE, top: -fingertip.y * HAND_SCALE }}
      />
    </div>,
    document.body,
  );
}
