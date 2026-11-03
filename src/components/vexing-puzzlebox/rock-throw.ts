/** A thrown potion arcs to its target, spinning, like a potion thrown at an enemy. */
const THROW_MS = 450;
const ROCK_SIZE_PX = 36;
const ARC_SAMPLES = 16;
const SPIN_DEG = 540;
const HIT_MS = 260;

function center(rect: DOMRect): { x: number; y: number } {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

/** Resolves when the rock lands; the rock itself is gone by then. */
export function playRockThrow(from: DOMRect, to: DOMRect, src: string): Promise<void> {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return Promise.resolve();
  const start = center(from);
  const end = center(to);
  const distance = Math.hypot(end.x - start.x, end.y - start.y);
  const lift = Math.max(80, distance * 0.35);

  const rock = document.createElement("img");
  rock.src = src;
  rock.alt = "";
  rock.setAttribute("aria-hidden", "true");
  rock.dataset.thrownRock = "";
  rock.style.cssText = [
    "position:fixed",
    "left:0",
    "top:0",
    `width:${ROCK_SIZE_PX}px`,
    `height:${ROCK_SIZE_PX}px`,
    "pointer-events:none",
    "z-index:795",
    "filter:drop-shadow(0 6px 6px rgba(0,0,0,0.45))",
  ].join(";");
  document.body.append(rock);

  const frames = Array.from({ length: ARC_SAMPLES + 1 }, (_, index) => {
    const t = index / ARC_SAMPLES;
    const x = start.x + (end.x - start.x) * t - ROCK_SIZE_PX / 2;
    const y = start.y + (end.y - start.y) * t - lift * 4 * t * (1 - t) - ROCK_SIZE_PX / 2;
    const scale = 1 + 0.35 * Math.sin(Math.PI * t);
    return { transform: `translate(${x}px, ${y}px) rotate(${SPIN_DEG * t}deg) scale(${scale})` };
  });
  const flight = rock.animate(frames, { duration: THROW_MS, easing: "linear", fill: "forwards" });
  return flight.finished.then(() => {
    rock.remove();
  }, () => {
    rock.remove();
  });
}

/** The struck tile jolts as if hit. */
export function playRockHit(element: HTMLElement): void {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  element.animate(
    [
      { transform: "translate(0, 0) rotate(0)" },
      { transform: "translate(-6px, 3px) rotate(-2deg)" },
      { transform: "translate(5px, -2px) rotate(1.5deg)" },
      { transform: "translate(-3px, 1px) rotate(-0.5deg)" },
      { transform: "translate(0, 0) rotate(0)" },
    ],
    { duration: HIT_MS, easing: "ease-out" },
  );
}
