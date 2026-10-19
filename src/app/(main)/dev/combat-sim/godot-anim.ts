/**
 * Godot animation primitives the combat scene ports: Curve sampling, Gradient
 * sampling, Tween easings, and the per-frame `Lerp(a, b, dt * k)` the hand uses
 * (integrated, so any time gives the same value).
 */

export interface CurvePoint {
  x: number;
  y: number;
  leftTangent: number;
  rightTangent: number;
}

/** Curve.sample: cubic Bezier per segment with control points a third of the way along x (Curve::sample_local_nocheck). */
export function sampleCurve(points: CurvePoint[] | null | undefined, x: number, fallback = 1): number {
  if (!points || points.length === 0) return fallback;
  if (x <= points[0].x) return points[0].y;
  const last = points[points.length - 1];
  if (x >= last.x) return last.y;
  let i = 0;
  while (i < points.length - 2 && x > points[i + 1].x) i += 1;
  const a = points[i];
  const b = points[i + 1];
  const d = b.x - a.x;
  if (d <= 0) return b.y;
  const t = (x - a.x) / d;
  const third = d / 3;
  const y1 = a.y + third * a.rightTangent;
  const y2 = b.y - third * b.leftTangent;
  const u = 1 - t;
  return u * u * u * a.y + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * b.y;
}

export interface GradientData {
  offsets: number[];
  colors: number[][];
}

/** Gradient.sample with linear interpolation. Returns [r, g, b, a] in 0..1. */
export function sampleGradient(gradient: GradientData | null | undefined, x: number): number[] {
  if (!gradient || gradient.colors.length === 0) return [1, 1, 1, 1];
  const { offsets, colors } = gradient;
  if (x <= offsets[0]) return colors[0];
  for (let i = 0; i < offsets.length - 1; i += 1) {
    if (x <= offsets[i + 1]) {
      const span = offsets[i + 1] - offsets[i];
      const t = span <= 0 ? 1 : (x - offsets[i]) / span;
      return colors[i].map((value, c) => value + (colors[i + 1][c] - value) * t);
    }
  }
  return colors[colors.length - 1];
}

/** Godot Tween easings used by the combat UI. `t` in 0..1. */
export const ease = {
  linear: (t: number) => t,
  cubicOut: (t: number) => 1 - (1 - t) ** 3,
  cubicIn: (t: number) => t ** 3,
  quadOut: (t: number) => 1 - (1 - t) ** 2,
  quadIn: (t: number) => t * t,
  sineOut: (t: number) => Math.sin((t * Math.PI) / 2),
  expoOut: (t: number) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t)),
  /** Godot TRANS_BACK / EASE_OUT (overshoot 1.70158). */
  backOut: (t: number) => {
    const s = 1.70158;
    const u = t - 1;
    return u * u * ((s + 1) * u + s) + 1;
  },
};

export function clamp01(t: number): number {
  return Math.max(0, Math.min(1, t));
}

/** `value = Lerp(value, target, dt * k)` every frame, integrated: exact for small dt. */
export function expApproach(from: number, to: number, k: number, seconds: number): number {
  return to + (from - to) * Math.exp(-k * Math.max(0, seconds));
}

/** Shortest-arc angle approach, degrees. */
export function expApproachAngle(from: number, to: number, k: number, seconds: number): number {
  const delta = ((to - from + 540) % 360) - 180;
  return to - delta * Math.exp(-k * Math.max(0, seconds));
}

export function rgba(color: number[], alphaScale = 1): string {
  const [r, g, b, a = 1] = color;
  const byte = (value: number) => Math.round(clamp01(value) * 255);
  return `rgba(${byte(r)}, ${byte(g)}, ${byte(b)}, ${clamp01(a * alphaScale)})`;
}

export function multiplyColor(a: number[], b: number[]): number[] {
  return a.map((value, i) => value * (b[i] ?? 1));
}
