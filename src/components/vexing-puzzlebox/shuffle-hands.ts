import type { CharacterPoolSlug } from "@/lib/user-profile";

const CHARACTERS: CharacterPoolSlug[] = ["ironclad", "silent", "regent", "necrobinder", "defect"];
const TEXTURE_WIDTH = 422;
const TEXTURE_HEIGHT = 1200;
/** hand_image.tscn: TextureRect pivot (163, 10) plus GrabMarker (12, 212), in texture pixels. */
const GRAB_X = 175;
const GRAB_Y = 222;
/** NHandImage turns hand index % 4 to come in from the bottom, left, right, or top. */
const SIDE_ROTATION = { bottom: 0, left: Math.PI / 2, right: -Math.PI / 2, top: Math.PI } as const;
type Side = keyof typeof SIDE_ROTATION;
/** GrabRelic tweens 0.5 s each way; a shuffle has to stay quick, so the same moves run shorter. */
const APPROACH_MS = 200;
const CARRY_MS = 320;
const RETREAT_MS = 200;
const STAGGER_MS = 60;
const TOTAL_MS = APPROACH_MS + CARRY_MS + RETREAT_MS;
/** Tween.TransitionType.Sine with EaseType.InOut. */
const SINE_IN_OUT = "cubic-bezier(0.37, 0, 0.63, 1)";
const LEAN_RAD = 0.1;
const HAND_TILE_SHARE = 0.6;
const HAND_MIN_SCALE = 0.1;
const HAND_MAX_SCALE = 0.28;
const OFFSCREEN_MARGIN_PX = 30;

export const SHUFFLE_GRIP_MS = APPROACH_MS;
export const SHUFFLE_RELEASE_MS = APPROACH_MS + CARRY_MS;

export type ShuffleMove = {
  element: HTMLElement;
  from: DOMRect;
  to: DOMRect;
};

export function shuffleHandUrls(): string[] {
  return CHARACTERS.flatMap((character) => [
    `/images/sts2/ui/hands/${character}_paper.webp`,
    `/images/sts2/ui/hands/${character}_rock.webp`,
  ]);
}

function center(rect: DOMRect): { x: number; y: number } {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

/** The board edge nearest the middle of a tile's path, so arms reach in without crossing the board. */
function sideFor(move: ShuffleMove, board: DOMRect): Side {
  const from = center(move.from);
  const to = center(move.to);
  const x = (from.x + to.x) / 2;
  const y = (from.y + to.y) / 2;
  const distances: [Side, number][] = [
    ["bottom", board.bottom - y],
    ["left", x - board.left],
    ["right", board.right - x],
    ["top", y - board.top],
  ];
  return distances.reduce((best, entry) => (entry[1] < best[1] ? entry : best))[0];
}

/** Where the grab point waits so the whole hand is off screen on its side. */
function offscreen(side: Side, point: { x: number; y: number }, reach: number): { x: number; y: number } {
  const distance = reach + OFFSCREEN_MARGIN_PX;
  switch (side) {
    case "bottom":
      return { x: point.x, y: window.innerHeight + distance };
    case "top":
      return { x: point.x, y: -distance };
    case "left":
      return { x: -distance, y: point.y };
    case "right":
      return { x: window.innerWidth + distance, y: point.y };
  }
}

function handImage(src: string, scale: number): HTMLImageElement {
  const image = document.createElement("img");
  image.src = src;
  image.alt = "";
  image.draggable = false;
  image.style.cssText = [
    "position:absolute",
    "max-width:none",
    `left:${-GRAB_X * scale}px`,
    `top:${-GRAB_Y * scale}px`,
    `width:${TEXTURE_WIDTH * scale}px`,
    `height:${TEXTURE_HEIGHT * scale}px`,
    "filter:drop-shadow(0 6px 8px rgba(0,0,0,0.35))",
  ].join(";");
  return image;
}

/**
 * One hand per moving tile, after NHandImage.GrabRelic: an open hand reaches in,
 * closes into a fist on the tile, carries it to its new slot, opens, and leaves.
 * The tiles must already sit in their new slots; they are drawn back to `from` until gripped.
 */
export function playShuffleHands(moves: ShuffleMove[]): void {
  if (moves.length === 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const board = moves.reduce<DOMRect>((box, move) => {
    const left = Math.min(box.left, move.from.left);
    const top = Math.min(box.top, move.from.top);
    const right = Math.max(box.right, move.from.right);
    const bottom = Math.max(box.bottom, move.from.bottom);
    return new DOMRect(left, top, right - left, bottom - top);
  }, moves[0].from);

  const layer = document.createElement("div");
  layer.setAttribute("aria-hidden", "true");
  layer.dataset.shuffleHands = String(moves.length);
  layer.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:790;overflow:hidden";
  document.body.append(layer);

  let longest = 0;
  for (const move of moves) {
    const delay = Math.random() * STAGGER_MS;
    longest = Math.max(longest, delay + TOTAL_MS);
    const side = sideFor(move, board);
    // Up to 16 arms cross the board at once, so each hand stays well under a tile wide.
    const scale = Math.min(HAND_MAX_SCALE, Math.max(HAND_MIN_SCALE, (move.from.width * HAND_TILE_SHARE) / TEXTURE_WIDTH));
    const rotation = SIDE_ROTATION[side] + (Math.random() - 0.5) * 2 * LEAN_RAD;
    const grip = center(move.from);
    const drop = center(move.to);
    const reach = GRAB_Y * scale;
    const start = offscreen(side, grip, reach);
    const end = offscreen(side, drop, reach);
    const character = CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)];

    const hand = document.createElement("div");
    hand.style.cssText = "position:absolute;left:0;top:0;width:0;height:0";
    const paper = handImage(`/images/sts2/ui/hands/${character}_paper.webp`, scale);
    const rock = handImage(`/images/sts2/ui/hands/${character}_rock.webp`, scale);
    rock.style.opacity = "0";
    hand.append(paper, rock);
    layer.append(hand);

    const place = (point: { x: number; y: number }) => (
      `translate(${point.x}px, ${point.y}px) rotate(${rotation}rad)`
    );
    const gripAt = APPROACH_MS / TOTAL_MS;
    const releaseAt = (APPROACH_MS + CARRY_MS) / TOTAL_MS;
    const timing = { duration: TOTAL_MS, delay, fill: "both" as const };
    hand.animate([
      { offset: 0, transform: place(start), easing: SINE_IN_OUT },
      { offset: gripAt, transform: place(grip), easing: SINE_IN_OUT },
      { offset: releaseAt, transform: place(drop), easing: SINE_IN_OUT },
      { offset: 1, transform: place(end) },
    ], timing);
    // GrabRelic swaps the paper texture for rock on the grab, and back on release.
    const fist = [
      { offset: 0, opacity: 0 },
      { offset: gripAt, opacity: 0 },
      { offset: gripAt, opacity: 1 },
      { offset: releaseAt, opacity: 1 },
      { offset: releaseAt, opacity: 0 },
      { offset: 1, opacity: 0 },
    ];
    rock.animate(fist, timing);
    paper.animate(fist.map((frame) => ({ ...frame, opacity: 1 - frame.opacity })), timing);

    const dx = move.from.left - move.to.left;
    const dy = move.from.top - move.to.top;
    move.element.style.zIndex = "20";
    const carry = move.element.animate(
      [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "translate(0, 0)" }],
      { duration: CARRY_MS, delay: delay + APPROACH_MS, easing: SINE_IN_OUT, fill: "backwards" },
    );
    carry.finished.then(() => {
      move.element.style.zIndex = "";
    }, () => {
      move.element.style.zIndex = "";
    });
  }
  window.setTimeout(() => layer.remove(), longest + 50);
}
