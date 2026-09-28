/**
 * Multiplayer reaction-wheel emotes inserted into comments.
 *
 * Asset order matches the in-game wheel (east, then clockwise): the same
 * eight icons as `images/ui/emote`, not a like palette. The game ships no
 * locale strings for these, so the short names are service-owned.
 *
 * Hit targets sit on an even ring instead of the wedge sprites' overlapping
 * boxes, so a finger can tap one icon without selecting its neighbor.
 */

export const EMOTE_WHEEL_SCENE_SIZE = 500;
export const EMOTE_ICON_RADIUS_RATIO = 0.34;
export const EMOTE_HIT_RATIO = 0.2;
export const EMOTE_MIN_HIT_PX = 44;
export const EMOTE_DESKTOP_WHEEL_PX = 288;

export const EMOTE_WEDGE_SRC = "/images/sts2/ui/emote/wedge_2.png";
export const EMOTE_WEDGE_SHADOW_SRC = "/images/sts2/ui/emote/wedge_shadow.png";

export const EMOTE_CONS = [
  {
    id: "exclaim",
    file: "exclaim.png",
    labelKo: "느낌표",
    labelEn: "Exclaim",
    rotation: 0,
    wedge: [79.3333, -94, 261.333, 94],
    shadow: [-80.3332, -83.3333, 101.667, 104.667],
  },
  {
    id: "skull",
    file: "skull.png",
    labelKo: "해골",
    labelEn: "Skull",
    rotation: 45,
    wedge: [122, -11.3333, 304, 176.667],
    shadow: [-75.9151, -94.0001, 106.085, 93.9998],
  },
  {
    id: "thumb_down",
    file: "thumb_down.png",
    labelKo: "별로",
    labelEn: "Thumbs down",
    rotation: 90,
    wedge: [92.6667, 78, 274.667, 266],
    shadow: [-80.3335, -104.667, 101.666, 83.3333],
  },
  {
    id: "slime_sad",
    file: "slime_sad.png",
    labelKo: "슬라임",
    labelEn: "Sad slime",
    rotation: 135,
    wedge: [8.66666, 120.667, 190.667, 308.667],
    shadow: [-91.0001, -109.085, 90.9996, 78.9151],
  },
  {
    id: "question",
    file: "question.png",
    labelKo: "물음표",
    labelEn: "Question",
    rotation: 180,
    wedge: [-83.3333, 94, 98.6667, 282],
    shadow: [-101.667, -104.667, 80.3336, 83.3336],
  },
  {
    id: "heart",
    file: "heart.png",
    labelKo: "하트",
    labelEn: "Heart",
    rotation: 225,
    wedge: [-124.667, 12.6667, 57.3333, 200.667],
    shadow: [-106.085, -94.0002, 75.9146, 93.9998],
  },
  {
    id: "thumb_up",
    file: "thumb_up.png",
    labelKo: "엄지",
    labelEn: "Thumbs up",
    rotation: 270,
    wedge: [-95.3333, -76.6667, 86.6667, 111.333],
    shadow: [-101.667, -83.3332, 80.3331, 104.667],
  },
  {
    id: "happy_cultist",
    file: "happy_cultist.png",
    labelKo: "컬티스트",
    labelEn: "Cultist",
    rotation: 315,
    wedge: [-10, -120, 172, 67.9999],
    shadow: [-91, -78.915, 90.9998, 109.085],
  },
] as const;

export type EmoteId = (typeof EMOTE_CONS)[number]["id"];

type SceneRect = readonly [number, number, number, number];

const EMOTE_IDS = new Set<string>(EMOTE_CONS.map((emote) => emote.id));

export function isEmoteId(value: unknown): value is EmoteId {
  return typeof value === "string" && EMOTE_IDS.has(value);
}

export function emoteById(id: string) {
  return EMOTE_CONS.find((emote) => emote.id === id) ?? null;
}

export function emoteSrc(id: EmoteId): string {
  const emote = emoteById(id);
  return `/images/sts2/ui/emote/${emote?.file ?? "heart.png"}`;
}

/** Stable visible length for the comment counter. Korean is the service default. */
export function emotePlainText(id: string): string {
  return emoteById(id)?.labelKo ?? "";
}

export function emoteLabel(id: string, locale: "ko" | "en"): string {
  const emote = emoteById(id);
  if (!emote) return "";
  return locale === "en" ? emote.labelEn : emote.labelKo;
}

export function emoteStorageText(id: EmoteId): string {
  return `[감정콘:${id}]`;
}

export function emoteHitSize(wheelSize: number): number {
  return Math.max(EMOTE_MIN_HIT_PX, Math.round(wheelSize * EMOTE_HIT_RATIO));
}

export function emoteIconCenter(index: number, wheelSize: number) {
  const angle = index * (Math.PI / 4);
  const radius = wheelSize * EMOTE_ICON_RADIUS_RATIO;
  return {
    x: wheelSize / 2 + Math.cos(angle) * radius,
    y: wheelSize / 2 + Math.sin(angle) * radius,
  };
}

export function emoteHitBox(index: number, wheelSize: number) {
  const center = emoteIconCenter(index, wheelSize);
  const size = emoteHitSize(wheelSize);
  return {
    id: EMOTE_CONS[index]?.id ?? "exclaim",
    left: center.x - size / 2,
    top: center.y - size / 2,
    size,
  };
}

export function emoteHitBoxesOverlap(wheelSize: number): boolean {
  const boxes = EMOTE_CONS.map((_, index) => emoteHitBox(index, wheelSize));
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      const a = boxes[i]!;
      const b = boxes[j]!;
      const dx = (a.left + a.size / 2) - (b.left + b.size / 2);
      const dy = (a.top + a.size / 2) - (b.top + b.size / 2);
      if (Math.hypot(dx, dy) < (a.size + b.size) / 2 - 0.5) return true;
    }
  }
  return false;
}

/** Index 0 is east; indexes increase clockwise, matching the game wheel. */
export function emoteIndexFromDelta(dx: number, dy: number): number {
  const wrapped = (Math.atan2(dy, dx) + Math.PI / 8 + Math.PI * 2) % (Math.PI * 2);
  return Math.floor(wrapped / (Math.PI / 4)) % EMOTE_CONS.length;
}

function scene(wheelSize: number, value: number) {
  return value * (wheelSize / EMOTE_WHEEL_SCENE_SIZE);
}

export function emoteWedgeFrame(
  index: number,
  wheelSize: number,
) {
  const layout = EMOTE_CONS[index];
  if (!layout) return null;
  const [left, top, right, bottom] = layout.wedge;
  return {
    left: scene(wheelSize, EMOTE_WHEEL_SCENE_SIZE / 2 + left),
    top: scene(wheelSize, EMOTE_WHEEL_SCENE_SIZE / 2 + top),
    width: scene(wheelSize, right - left),
    height: scene(wheelSize, bottom - top),
    rotation: layout.rotation,
  };
}

export function emoteShadowFrame(parent: SceneRect, shadow: SceneRect, wheelSize: number) {
  const parentWidth = scene(wheelSize, parent[2] - parent[0]);
  const parentHeight = scene(wheelSize, parent[3] - parent[1]);
  return {
    left: parentWidth / 2 + scene(wheelSize, shadow[0]),
    top: parentHeight / 2 + scene(wheelSize, shadow[1]),
    width: scene(wheelSize, shadow[2] - shadow[0]),
    height: scene(wheelSize, shadow[3] - shadow[1]),
  };
}
